/* Public quotation-only domestic desk. No orders, credentials or server writes. */
(function(root){
'use strict';
const MAX_AGE=120000, FX_AGE=7*86400000;
const num=x=>x!==null&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const positive=x=>num(x)!==null&&num(x)>0;
const fresh=(at,now=Date.now())=>positive(at)&&now-at>=-30000&&now-at<=MAX_AGE;
const safeSymbol=s=>typeof s==='string'&&/^[A-Z0-9]{1,24}$/.test(s);
const premium=(local,foreign,rate)=>[local,foreign,rate].every(positive)?(local/(foreign*rate)-1)*100:null;
function fxValid(fx,now=Date.now()){const at=Date.parse(fx?.date+'T00:00:00Z');return positive(fx?.rates?.KRW)&&Number.isFinite(at)&&now-at>=-86400000&&now-at<=FX_AGE;}
function rowsFor(tickers,global,fx,basis,now=Date.now()){
 const tether=tickers.find(x=>x.market==='KRW-USDT');
 const rate=basis==='usdt'?(fresh(tether?.trade_timestamp,now)?num(tether?.trade_price):null):(fxValid(fx,now)?num(fx.rates.KRW):null);
 return tickers.filter(t=>t.market?.startsWith('KRW-')&&safeSymbol(t.market.slice(4))).map(t=>{
  const symbol=t.market.slice(4),g=global[symbol],at=num(t.trade_timestamp);
  const current=fresh(at,now),remote=!!g&&fresh(g.closeTime,now);
  const price=num(t.trade_price),foreign=g?num(g.lastPrice):null,high=num(t.high_price);
  const p=current&&remote?premium(price,foreign,rate):null,valid=p!==null&&Math.abs(p)<=50;
  const converted=remote&&positive(foreign)&&positive(rate)?foreign*rate:null,open=remote?num(g.openPrice):null;
  const fv=remote?num(g.quoteVolume):null;
  return {symbol,price,volume:num(t.acc_trade_price_24h),change:num(t.signed_change_rate)===null?null:num(t.signed_change_rate)*100,changeKrw:num(t.signed_change_price),at,current,
   high,low:num(t.low_price),fromHigh:positive(high)&&positive(price)?(price/high-1)*100:null,
   foreign,foreignKrw:converted,foreignChange:positive(open)&&positive(foreign)?(foreign/open-1)*100:null,foreignVolume:fv,foreignVolumeKrw:fv!==null&&positive(rate)?fv*rate:null,
   premium:valid?p:null,gap:valid&&converted!==null?price-converted:null,
   reason:!current?'체결 지연':!g?'해외 비교 없음':!remote?'해외 시세 지연':!rate?'환산 기준 없음':p!==null&&Math.abs(p)>50?'가격차 재확인':'',market:t.market};
 });
}
const api={premium,fresh,fxValid,rowsFor};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document)return;
const el=document.getElementById('tab-domestic');if(!el)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=0)=>num(x)===null?'—':Number(x).toLocaleString('ko-KR',{maximumFractionDigits:d});
const pct=x=>num(x)===null?'—':(x>0?'+':'')+Number(x).toFixed(2)+'%';
const color=x=>num(x)===null?'dm-muted':x>=0?'dm-up':'dm-down';
const krw=x=>num(x)===null?'—':'₩'+fmt(x,x<100?4:x<1000?2:0);
const won=x=>num(x)===null?'':fmt(x,x<100?4:x<1000?2:0);
const signedWon=x=>num(x)===null?'':(x>0?'+':x<0?'-':'')+won(Math.abs(x));
const eok=x=>{const n=num(x);if(n===null)return '';if(n<1e8)return fmt(n/1e4)+'만';const e=Math.round(n/1e8);return e<1e4?fmt(e)+'억':fmt(Math.floor(e/1e4))+'조 '+fmt(e%1e4)+'억';};
const signedKrw=x=>num(x)===null?'—':(x>0?'+':x<0?'-':'')+krw(Math.abs(x));
const usdt=x=>num(x)===null?'—':x>=1e9?fmt(x/1e9,2)+'B':x>=1e6?fmt(x/1e6,1)+'M':fmt(x);
const time=x=>new Date(x).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
let storageWarning=false;
let favorites=new Set();try{const a=JSON.parse(localStorage.getItem('tl_domestic_favorites')||'[]');if(Array.isArray(a))favorites=new Set(a.filter(safeSymbol).slice(0,500));}catch{storageWarning=true;}
const state={venue:'upbit',basis:'fx',only:false,andyOnly:false,query:'',sort:'volume',dir:1,selected:null,tickers:{upbit:[],bithumb:[]},global:{},meta:[],fx:null,andy:null,errors:{},at:{},busy:false,timer:null,paint:null,controllers:new Set(),epoch:0,lastAttempt:0};
el.innerHTML=`<div class="dm-top"><h1>국내장</h1><a href="#strategists">전략가들 ↗</a></div>
<div class="dm-pair"><label class="dm-card"><span>기준 거래소</span><select id="dm-venue"><option value="upbit">업비트 KRW</option><option value="bithumb">빗썸 KRW</option></select></label><span class="dm-swap" aria-hidden="true">⇄</span><label class="dm-card"><span>비교 기준</span><select id="dm-basis"><option value="fx">바이낸스 USDT · 고시환율</option><option value="usdt">바이낸스 USDT · 국내 USDT</option></select></label></div>
<div class="dm-find"><button id="dm-favorites" aria-pressed="false" title="관심 코인만 보기">☆</button><button id="dm-andy-only" aria-pressed="false" title="Andy 후보만 보기">Andy</button><input id="dm-search" type="search" placeholder="BTC, 비트코인…" maxlength="40" aria-label="종목 찾기"><span id="dm-count"></span></div>
<div id="dm-detail" hidden class="dm-detail"></div>
<div class="dm-scroll" tabindex="0" role="region" aria-label="국내 시세 표"><table><thead><tr id="dm-head"></tr></thead><tbody id="dm-table"></tbody></table></div>
<div class="dm-foot"><p id="dm-status" role="status" aria-live="polite">국내 시세를 불러오는 중입니다.</p><p class="dm-strip" id="dm-rates"></p><p class="dm-strip"><span id="dm-andy-at">Andy 장부 확인 중…</span> <a href="reports/andy_scan.html#andy-retest" target="_blank" rel="noopener">장부 ↗</a></p></div>
<details><summary>계산 기준과 데이터 주의사항</summary><p>표 읽는 법: 칸마다 위가 국내(기준 거래소), 아래 작은 숫자가 그에 대응하는 값입니다. 현재가 아래는 해외 환산가, 김프 아래는 국내 가격에서 환산가를 뺀 금액, 전일대비 아래는 변동 금액, 거래액 아래는 해외 24시간 거래대금을 같은 환산 기준으로 원화로 옮긴 값입니다. 비교할 수 없는 종목은 김프를 비우고 그 아래에 이유를 적습니다. 머리글을 누르면 정렬 기준과 오름·내림 방향이 바뀌고, 이름을 누르면 24시간 고가 대비·해외 등락을 포함한 자세한 값이 열립니다.</p><p>원달러 기준: (국내 원화 가격 ÷ (Binance 현물 USDT 가격 × 일일 USD/KRW 기준환율) − 1) × 100. 1 USDT ≈ 1 USD를 가정한 근사치로, 테더의 달러 가격차가 포함될 수 있습니다. 기준환율은 실시간 환율이 아니며 주말·휴일에는 마지막 고시일을 사용합니다.</p><p>USDT 기준: (국내 원화 가격 ÷ (Binance 현물 USDT 가격 × 선택 거래소 USDT/KRW 가격) − 1) × 100. 원달러 기준 김프와 다른 값입니다. 양쪽 가격은 같은 순간의 호가가 아닌 최근 체결가입니다.</p><p>시세는 WebSocket으로 수신해 화면에 1초 단위로 묶어 반영합니다. 연결이 끊기면 30초 주기 조회로 전환하며, 국내장을 떠나면 연결을 닫습니다. 최초 연결이나 재연결은 요청 제한 때문에 수 초 이상 걸릴 수 있습니다. 마지막 국내 체결·해외 시세가 2분을 넘거나 기준환율이 7일을 넘으면 가격차 계산에서 제외합니다. 이전 가격은 지연 표시로 남을 수 있습니다.</p><p>동일 티커 기준 비교이며 토큰·네트워크의 동일성과 입출금 가능 여부를 보증하지 않습니다. 입출금 상태는 미확인입니다. 수수료·슬리피지·송금 지연을 반영한 차익거래 수익이 아니며, 큰 가격차만 보고 거래하지 마세요. ±50% 초과 값은 재확인 대상으로 계산값을 숨깁니다.</p><p>출처: Upbit·Bithumb 공개 시세, Binance 현물, Frankfurter 일일 환율, Tape Lounge Andy 리포트. 관심 코인은 이 브라우저에만 저장됩니다.</p></details>`;
const $=id=>document.getElementById(id);
const names={BTC:'비트코인',ETH:'이더리움',XRP:'리플',SOL:'솔라나',DOGE:'도지코인',USDT:'테더',ETC:'이더리움클래식'};
function name(s){return (state.venue==='bithumb'?state.meta.find(m=>m.market==='KRW-'+s)?.korean_name:null)||names[s]||s;}
function visible(){return !el.classList.contains('hidden')&&!document.hidden;}
function rowButton(r){return `<button data-select="${r.symbol}">${r.symbol}</button>`;}
const COLUMNS=[{key:'symbol',label:'이름',first:-1},{key:'price',label:'현재가'},{key:'premium',label:'김프'},{key:'change',label:'전일대비'},{key:'volume',label:'거래액(일)'}];
function heading(c){return c.key==='premium'?(state.basis==='fx'?'김프':'USDT 김프'):c.label;}
function order(a,b){const k=state.sort,d=state.dir;if(k==='symbol')return d===1?b.symbol.localeCompare(a.symbol):a.symbol.localeCompare(b.symbol);const x=num(a[k]),y=num(b[k]);if(x===null&&y===null)return a.symbol.localeCompare(b.symbol);if(x===null)return 1;if(y===null)return -1;return (d===1?y-x:x-y)||a.symbol.localeCompare(b.symbol);}
function render(){
 const focused=document.activeElement;
 const restore=focused?.dataset?.star?['star',focused.dataset.star]:focused?.dataset?.select?['select',focused.dataset.select]:null;
 const now=Date.now(),rows=rowsFor(state.tickers[state.venue],state.global,state.fx,state.basis,now);
 const andyFresh=state.andy&&now-state.andy.at<=36*3600000&&now-state.andy.at>=-300000;
 const stages=andyFresh?state.andy.stages:{};
 const u=state.tickers[state.venue].find(t=>t.market==='KRW-USDT');
 $('dm-rates').innerHTML=`<span>USD/KRW <b>${fxValid(state.fx)?krw(state.fx.rates.KRW):'—'}</b> ${esc(state.fx?.date||'조회 대기')} · 일일 기준</span><span>국내 USDT <b>${krw(u?.trade_price)}</b> ${fresh(u?.trade_timestamp)?'최근 체결':'체결 지연·미확인'}</span><span>해외 기준 <b>Binance 현물</b></span>`;
 const relevant=[state.venue,'binance',...(state.basis==='fx'?['fx']:[])];
 const failures=relevant.filter(k=>state.errors[k]);
 $('dm-status').textContent=`국내 ${live[state.venue]?'실시간 수신':'연결 대기·30초 조회'} · 해외 ${live.binance?'실시간 수신':'연결 대기·30초 조회'} · 화면 1초 반영`+(state.at[state.venue]?` · ${time(state.at[state.venue])} KST`:'')+(failures.length?' · 일부 조회 실패: '+failures.map(k=>({upbit:'업비트',bithumb:'빗썸',binance:'Binance',fx:'환율'}[k])).join(', '):'')+(storageWarning?' · 브라우저 저장이 차단되어 관심 목록은 이번 방문 동안만 유지됩니다.':'');
 $('dm-head').innerHTML=COLUMNS.map(c=>{const t=esc(heading(c)),on=state.sort===c.key;return `<th${on?` aria-sort="${state.dir===1?'descending':'ascending'}"`:''}><button data-sort="${c.key}" title="${t} 기준 정렬">${t}<span aria-hidden="true">${on?(state.dir===1?'▼':'▲'):'⇅'}</span></button></th>`;}).join('');
 $('dm-andy-at').textContent=state.andy?`${state.andy.label} · 매일 20시 갱신${andyFresh?' · 현재 신호 아님':' · 오래된 리포트, 후보 표시는 보류'}`:'리포트를 확인하지 못했습니다. 원본 장부에서 확인해 주세요.';
 const filtered=rows.filter(r=>(!state.only||favorites.has(r.symbol))&&(!state.andyOnly||stages[r.symbol])&&(!state.query||(r.symbol+' '+name(r.symbol)).toLowerCase().includes(state.query))).sort(order);
 $('dm-count').textContent=`암호화폐 총 ${filtered.length}개`;
 $('dm-table').innerHTML=filtered.length?filtered.map(r=>`<tr><td class="dm-name"><button data-select="${r.symbol}">${esc(name(r.symbol))}</button><small><button data-star="${r.symbol}" aria-label="${r.symbol} 관심 코인" aria-pressed="${favorites.has(r.symbol)}">${favorites.has(r.symbol)?'★':'☆'}</button>${r.symbol}${stages[r.symbol]?` <span class="dm-badge" title="Andy 장부 · ${esc(stages[r.symbol])}">${esc(stages[r.symbol])}</span>`:''}</small></td><td><b>${won(r.price)||'—'}</b><small>${won(r.foreignKrw)}</small></td><td><b class="${color(r.premium)}">${r.premium===null?'':pct(r.premium)}</b><small${r.gap===null?' class="dm-warn"':''}>${r.gap===null?esc(r.reason):signedWon(r.gap)}</small></td><td><b class="${color(r.change)}">${pct(r.change)}</b><small>${signedWon(r.changeKrw)}</small></td><td><b>${eok(r.volume)||'—'}</b><small>${eok(r.foreignVolumeKrw)}</small></td></tr>`).join(''):`<tr><td colspan="5">${state.only?'관심 코인의 별표를 눌러 나만의 목록을 만들어 보세요.':'검색 결과가 없거나 시세를 조회하지 못했습니다.'}</td></tr>`;
 if(restore&&safeSymbol(restore[1]))el.querySelector(`[data-${restore[0]}="${restore[1]}"]`)?.focus({preventScroll:true});
 const selected=rows.find(r=>r.symbol===state.selected);$('dm-detail').hidden=!selected;
 if(selected){const r=selected;const venueName=state.venue==='upbit'?'업비트':'빗썸';$('dm-detail').innerHTML=`<h2>${esc(name(r.symbol))} · ${r.symbol}</h2><p>${venueName} 원화마켓 ${krw(r.price)} · 전일 대비 ${pct(r.change)} · 24h 고 ${krw(r.high)} / 저 ${krw(r.low)}</p><p>해외 환산가 ${krw(r.foreignKrw)} · 가격차 ${pct(r.premium)}${r.gap===null?'':` (${signedKrw(r.gap)})`} · 해외 등락 ${pct(r.foreignChange)} · 24h 고가 대비 ${pct(r.fromHigh)} · 해외 거래대금 ${usdt(r.foreignVolume)} USDT ${esc(r.reason)}</p><p>${stages[r.symbol]?`Andy 장부: ${esc(stages[r.symbol])} (${esc(state.andy.label)}).`:'현재 연결된 Andy 지지 확인·재출발 후보는 아닙니다.'} 입출금 상태는 미확인입니다.</p><a href="https://www.binance.com/en/trade/${r.symbol}_USDT?type=spot" target="_blank" rel="noopener noreferrer">해외 현물 차트 ↗</a> · <a href="reports/andy_scan.html#andy-retest" target="_blank" rel="noopener">Andy 장부 ↗</a> · <a href="#">라운지에서 이야기하기 →</a>`;}
}
async function get(url,epoch,asText=false){
 const c=new AbortController();state.controllers.add(c);const t=setTimeout(()=>c.abort(),12000);
 try{const r=await fetch(url,{signal:c.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);const data=asText?await r.text():await r.json();if(epoch!==state.epoch)throw Error('Cancelled');return data;}finally{clearTimeout(t);state.controllers.delete(c);}
}
async function job(key,fn){try{await fn();delete state.errors[key];}catch(e){if(e.name!=='AbortError'&&e.message!=='Cancelled')state.errors[key]=true;}}
async function domestic(venue,epoch){
 let ticks;
 if(venue==='upbit')ticks=await get('https://api.upbit.com/v1/ticker/all?quote_currencies=KRW',epoch);
 else{
  if(!state.meta.length||Date.now()-(state.at.meta||0)>3600000){const m=await get('https://api.bithumb.com/v1/market/all?isDetails=true',epoch);if(!Array.isArray(m))throw Error('Invalid markets');state.meta=m.filter(x=>/^KRW-[A-Z0-9]+$/.test(x.market));state.at.meta=Date.now();}
  ticks=[];for(let i=0;i<state.meta.length;i+=80){if(epoch!==state.epoch)throw Error('Cancelled');const batch=await get('https://api.bithumb.com/v1/ticker?markets='+state.meta.slice(i,i+80).map(x=>x.market).join(','),epoch);if(!Array.isArray(batch))throw Error('Invalid ticks');ticks.push(...batch);}
 }
 if(!Array.isArray(ticks)||!ticks.length)throw Error('Empty market');
 const previous=new Map(state.tickers[venue].map(x=>[x.market,x]));state.tickers[venue]=ticks.map(x=>{const old=previous.get(x.market);return old&&old.trade_timestamp>x.trade_timestamp?old:x;});state.at[venue]=Date.now();
}
async function loadAndy(epoch){
 const html=await get('reports/andy_scan.html',epoch,true),doc=new DOMParser().parseFromString(html,'text/html');
 const label=doc.querySelector('.hdr .ts')?.textContent?.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST/);
 if(!label||!doc.querySelector('#andy-retest'))throw Error('Invalid report');
 const stages={};doc.querySelectorAll('#andy-retest table tr').forEach(tr=>{const t=tr.querySelectorAll('td');if(t.length<2)return;const s=t[0].textContent.trim().replace(/\/USDT$/,''),stage=t[1].textContent.trim();if(safeSymbol(s)&&['지지 확인','재출발','눌림 대기','이미 많이 벌어짐'].includes(stage))stages[s]='4h · '+stage;});
 doc.querySelectorAll('table tr').forEach(tr=>{if(tr.closest?.('#andy-retest'))return;const t=tr.querySelectorAll('td');if(t.length<3)return;const s=t[1].textContent.trim(),m=t[2].textContent.trim().match(/^[ABC] · (신규 돌파|추세 진행|바닥 반전)$/);if(safeSymbol(s)&&m)stages[s]=(stages[s]?stages[s]+' / ':'')+'일봉 · '+m[1];});
 state.andy={label:label[0],at:Date.parse(`${label[1]}T${label[2]}:00+09:00`),stages};state.at.andy=Date.now();
}
async function refresh(){
 if(!visible()||state.busy)return;
 if(Date.now()-state.lastAttempt<30000){schedule();return;}
 const epoch=state.epoch;state.busy=true;state.lastAttempt=Date.now();render();
 await Promise.all([job(state.venue,async()=>{if(streams?.healthy(state.venue)||streams?.canPoll(state.venue)===false)return;streams?.touch(state.venue);await domestic(state.venue,epoch);}),job('binance',async()=>{if(streams?.healthy('binance'))return;const d=await get('https://data-api.binance.vision/api/v3/ticker/24hr',epoch);if(!Array.isArray(d))throw Error('Invalid global');for(const x of d){if(!x.symbol?.endsWith('USDT'))continue;const s=x.symbol.slice(0,-4);if(safeSymbol(s)&&(!state.global[s]||x.closeTime>=state.global[s].closeTime))state.global[s]=x;}}),
 job('fx',async()=>{if(state.fx&&Date.now()-(state.at.fx||0)<3600000)return;const f=await get('https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW',epoch);if(!fxValid(f))throw Error('Invalid FX');state.fx=f;state.at.fx=Date.now();}),
 job('andy',async()=>{if(Date.now()-(state.at.andy||0)<300000)return;await loadAndy(epoch);})]);
 state.busy=false;if(visible()){streams?.start(state.venue,state.tickers[state.venue].map(x=>x.market));render();}schedule();
}
function schedule(){clearTimeout(state.timer);if(visible())state.timer=setTimeout(refresh,Math.max(1000,30000-(Date.now()-state.lastAttempt)));}
function sync(){if(!visible()){clearTimeout(state.timer);clearTimeout(state.paint);state.paint=null;streams?.stop();state.epoch++;state.controllers.forEach(c=>c.abort());}else{render();refresh();}}
el.addEventListener('click',e=>{const star=e.target.closest('[data-star]'),select=e.target.closest('[data-select]'),sort=e.target.closest('[data-sort]');if(sort){const k=sort.dataset.sort;state.dir=state.sort===k?-state.dir:(COLUMNS.find(c=>c.key===k)?.first??1);state.sort=k;render();}if(star){const s=star.dataset.star;favorites.has(s)?favorites.delete(s):favorites.add(s);try{localStorage.setItem('tl_domestic_favorites',JSON.stringify([...favorites]));}catch{storageWarning=true;}render();}if(select){state.selected=select.dataset.select;render();$('dm-detail').scrollIntoView({block:'nearest',behavior:'smooth'});}});
$('dm-venue').onchange=e=>{streams?.stop();state.venue=e.target.value;state.selected=null;render();refresh();};
$('dm-basis').onchange=e=>{state.basis=e.target.value;render();};
$('dm-search').oninput=e=>{state.query=e.target.value.trim().toLowerCase();render();};
$('dm-favorites').onclick=e=>{state.only=!state.only;e.currentTarget.setAttribute('aria-pressed',String(state.only));render();};
$('dm-andy-only').onclick=e=>{state.andyOnly=!state.andyOnly;e.currentTarget.setAttribute('aria-pressed',String(state.andyOnly));render();};
const live={};
function paint(){if(!visible()||state.paint)return;state.paint=setTimeout(()=>{state.paint=null;if(visible())render();},1000);}
const streams=root.DomesticStreams?.createStreams({onState:(kind,on)=>{live[kind]=on;paint();},onData:(kind,updates)=>{
 if(kind==='binance'){for(const x of updates){if(!state.global[x.symbol]||x.closeTime>=state.global[x.symbol].closeTime)state.global[x.symbol]={...state.global[x.symbol],...x};}}
 else {const map=new Map(state.tickers[kind].map(x=>[x.market,x]));for(const x of updates){const old=map.get(x.market);if(!old||x.trade_timestamp>=old.trade_timestamp)map.set(x.market,{...old,...x});}state.tickers[kind]=[...map.values()];state.at[kind]=Date.now();}
 delete state.errors[kind];paint();}});
new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']});document.addEventListener('visibilitychange',sync);sync();
})(typeof window!=='undefined'?window:globalThis);
