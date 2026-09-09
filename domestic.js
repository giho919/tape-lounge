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
  const p=current&&remote?premium(t.trade_price,g.lastPrice,rate):null;
  return {symbol,price:num(t.trade_price),volume:num(t.acc_trade_price_24h),change:num(t.signed_change_rate)===null?null:num(t.signed_change_rate)*100,at,current,
   foreign:g?num(g.lastPrice):null,premium:p!==null&&Math.abs(p)<=50?p:null,reason:!current?'체결 지연':!g?'해외 비교 없음':!remote?'해외 시세 지연':!rate?'환산 기준 없음':p!==null&&Math.abs(p)>50?'가격차 재확인':'',market:t.market};
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
const volume=x=>num(x)===null?'—':x>=1e8?fmt(x/1e8,1)+'억':fmt(x/1e4)+'만';
const time=x=>new Date(x).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
let storageWarning=false;
let favorites=new Set();try{const a=JSON.parse(localStorage.getItem('tl_domestic_favorites')||'[]');if(Array.isArray(a))favorites=new Set(a.filter(safeSymbol).slice(0,500));}catch{storageWarning=true;}
const state={venue:'upbit',basis:'fx',only:false,query:'',sort:'volume',selected:null,tickers:{upbit:[],bithumb:[]},global:{},meta:[],fx:null,andy:null,errors:{},at:{},busy:false,timer:null,controllers:new Set(),epoch:0,lastAttempt:0};
el.innerHTML=`<div class="dm-head"><div><h1>국내장</h1><p>국내 시세와 해외 가격차, 관심 종목을 한 장에서.</p></div><a href="#strategists">전략가들 ↗</a></div>
<div class="dm-strip" id="dm-rates"></div><p id="dm-status" role="status" aria-live="polite">국내 시세를 불러오는 중입니다.</p>
<div class="dm-tools"><label>국내 거래소<select id="dm-venue"><option value="upbit">업비트</option><option value="bithumb">빗썸</option></select></label><label>가격차 환산 기준<select id="dm-basis"><option value="fx">원달러 일일 기준 · 근사 김프</option><option value="usdt">선택 거래소 USDT 가격</option></select></label><label>종목 찾기<input id="dm-search" type="search" placeholder="BTC, 비트코인…" maxlength="40"></label><label>정렬<select id="dm-sort"><option value="volume">거래대금 순</option><option value="premium">가격차 높은 순</option><option value="change">등락률 순</option></select></label><button id="dm-favorites" aria-pressed="false">☆ 관심 코인</button></div>
<div class="dm-grid"><section class="dm-box"><h2>국내에서 눈에 띄는 종목</h2><p>24시간 거래대금 10억 원 이상 중 양의 가격차 상위. 자금 유입을 단정하는 지표는 아닙니다.</p><ul class="dm-list" id="dm-leaders"></ul></section><section class="dm-box"><h2>Andy의 국내 상장 후보</h2><p id="dm-andy-at">후보 장부 확인 중…</p><ul class="dm-list" id="dm-andy"></ul><a href="reports/andy_scan.html#andy-retest" target="_blank" rel="noopener">전체 후보·차트 보기 ↗</a></section></div>
<div id="dm-detail" hidden class="dm-detail"></div>
<p id="dm-count"></p><div class="dm-scroll" tabindex="0" role="region" aria-label="국내 시세 표, 가로 스크롤 가능"><table><thead><tr><th>관심</th><th>종목</th><th>국내 현재가</th><th>전일 대비</th><th>해외 현물 USDT</th><th id="dm-premium-label">근사 김프</th><th>거래대금 · 24h</th><th>비교 상태</th></tr></thead><tbody id="dm-table"></tbody></table></div>
<details><summary>계산 기준과 데이터 주의사항</summary><p>원달러 기준: (국내 원화 가격 ÷ (Binance 현물 USDT 가격 × 일일 USD/KRW 기준환율) − 1) × 100. 1 USDT ≈ 1 USD를 가정한 근사치로, 테더의 달러 가격차가 포함될 수 있습니다. 기준환율은 실시간 환율이 아니며 주말·휴일에는 마지막 고시일을 사용합니다.</p><p>USDT 기준: (국내 원화 가격 ÷ (Binance 현물 USDT 가격 × 선택 거래소 USDT/KRW 가격) − 1) × 100. 원달러 기준 김프와 다른 값입니다. 양쪽 가격은 같은 순간의 호가가 아닌 최근 체결가입니다.</p><p>30초 간격 조회, 국내장을 보고 있을 때만 갱신합니다. 마지막 국내 체결·해외 시세가 2분을 넘거나 기준환율이 7일을 넘으면 가격차 계산에서 제외합니다. 이전 가격은 지연 표시로 남을 수 있습니다.</p><p>동일 티커 기준 비교이며 토큰·네트워크의 동일성과 입출금 가능 여부를 보증하지 않습니다. 입출금 상태는 미확인입니다. 수수료·슬리피지·송금 지연을 반영한 차익거래 수익이 아니며, 큰 가격차만 보고 거래하지 마세요. ±50% 초과 값은 재확인 대상으로 계산값을 숨깁니다.</p><p>출처: Upbit·Bithumb 공개 시세, Binance 현물, Frankfurter 일일 환율, Tape Lounge Andy 리포트. 관심 코인은 이 브라우저에만 저장됩니다.</p></details>`;
const $=id=>document.getElementById(id);
const names={BTC:'비트코인',ETH:'이더리움',XRP:'리플',SOL:'솔라나',DOGE:'도지코인',USDT:'테더',ETC:'이더리움클래식'};
function name(s){return (state.venue==='bithumb'?state.meta.find(m=>m.market==='KRW-'+s)?.korean_name:null)||names[s]||s;}
function visible(){return !el.classList.contains('hidden')&&!document.hidden;}
function rowButton(r){return `<button data-select="${r.symbol}">${r.symbol}</button>`;}
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
 $('dm-status').textContent=(state.busy?'시세 갱신 중 · ':state.at[state.venue]?`마지막 조회 ${time(state.at[state.venue])} KST · `:'조회 대기 · ')+(failures.length?'일부 조회 실패: '+failures.map(k=>({upbit:'업비트',bithumb:'빗썸',binance:'Binance',fx:'환율'}[k])).join(', ')+' · 다음 주기에 재시도합니다.':'30초 간격 · 최근 체결가 기준');
 $('dm-premium-label').textContent=state.basis==='fx'?'근사 김프':'USDT 기준 가격차';
 const leaders=rows.filter(r=>r.premium>0&&r.volume>=1e9&&r.symbol!=='USDT').sort((a,b)=>b.premium-a.premium).slice(0,4);
 $('dm-leaders').innerHTML=leaders.length?leaders.map(r=>`<li><div>${rowButton(r)} <span class="${color(r.premium)}">${pct(r.premium)}</span></div><span>${volume(r.volume)}원<small>입출금 상태 미확인</small></span></li>`).join(''):'<li>현재 비교 가능한 조건 충족 종목이 없습니다.</li>';
 const candidates=rows.filter(r=>stages[r.symbol]).sort((a,b)=>(stages[a.symbol]==='재출발'?-1:0)-(stages[b.symbol]==='재출발'?-1:0)||(b.volume||0)-(a.volume||0));
 $('dm-andy-at').textContent=state.andy?`${state.andy.label} · 매일 20시 갱신${andyFresh?' · 현재 신호 아님':' · 오래된 리포트, 후보 표시는 보류'}`:'리포트를 확인하지 못했습니다. 원본 장부에서 확인해 주세요.';
 $('dm-andy').innerHTML=candidates.length?candidates.slice(0,4).map(r=>`<li><div>${rowButton(r)}<small>${esc(stages[r.symbol])} · 리포트 당시</small></div><span>${krw(r.price)}<small>${pct(r.premium)} ${esc(r.reason)}</small></span></li>`).join(''):'<li>이 거래소에서 연결할 지지 확인·재출발 후보가 없습니다.</li>';
 const filtered=rows.filter(r=>(!state.only||favorites.has(r.symbol))&&(!state.query||(r.symbol+' '+name(r.symbol)).toLowerCase().includes(state.query))).sort((a,b)=>(b[state.sort]??-Infinity)-(a[state.sort]??-Infinity)||a.symbol.localeCompare(b.symbol));
 $('dm-count').textContent=`${state.venue==='upbit'?'업비트':'빗썸'} 원화마켓 · ${filtered.length}종 · 종목을 누르면 연결 정보를 볼 수 있습니다.${storageWarning?' 브라우저 저장이 차단되어 관심 목록은 이번 방문 동안만 유지됩니다.':''}`;
 $('dm-table').innerHTML=filtered.length?filtered.map(r=>`<tr><td><button data-star="${r.symbol}" aria-label="${r.symbol} 관심 코인" aria-pressed="${favorites.has(r.symbol)}">${favorites.has(r.symbol)?'★':'☆'}</button></td><td>${rowButton(r)}<small>${esc(name(r.symbol))}</small>${stages[r.symbol]?`<span class="dm-badge">Andy · ${esc(stages[r.symbol])}</span>`:''}</td><td>${krw(r.price)}</td><td class="${color(r.change)}">${pct(r.change)}</td><td>${fmt(r.foreign,6)}</td><td class="${color(r.premium)}">${pct(r.premium)}</td><td>${volume(r.volume)}원</td><td class="${r.reason?'dm-warn':'dm-muted'}">${esc(r.reason||'비교 가능')}<small>국내 체결 ${r.at?time(r.at):'—'}</small></td></tr>`).join(''):`<tr><td colspan="8">${state.only?'관심 코인의 별표를 눌러 나만의 목록을 만들어 보세요.':'검색 결과가 없거나 시세를 조회하지 못했습니다.'}</td></tr>`;
 if(restore&&safeSymbol(restore[1]))el.querySelector(`[data-${restore[0]}="${restore[1]}"]`)?.focus({preventScroll:true});
 const selected=rows.find(r=>r.symbol===state.selected);$('dm-detail').hidden=!selected;
 if(selected){const r=selected;const venueName=state.venue==='upbit'?'업비트':'빗썸';$('dm-detail').innerHTML=`<h2>${esc(name(r.symbol))} · ${r.symbol}</h2><p>${venueName} 원화마켓 ${krw(r.price)} · 가격차 ${pct(r.premium)} ${esc(r.reason)}</p><p>${stages[r.symbol]?`Andy 장부: ${esc(stages[r.symbol])} (${esc(state.andy.label)}).`:'현재 연결된 Andy 지지 확인·재출발 후보는 아닙니다.'} 입출금 상태는 미확인입니다.</p><a href="https://www.binance.com/en/trade/${r.symbol}_USDT?type=spot" target="_blank" rel="noopener noreferrer">해외 현물 차트 ↗</a> · <a href="reports/andy_scan.html#andy-retest" target="_blank" rel="noopener">Andy 장부 ↗</a> · <a href="#">라운지에서 이야기하기 →</a>`;}
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
 state.tickers[venue]=ticks;state.at[venue]=Date.now();
}
async function loadAndy(epoch){
 const html=await get('reports/andy_scan.html',epoch,true),doc=new DOMParser().parseFromString(html,'text/html');
 const label=doc.querySelector('.hdr .ts')?.textContent?.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST/);
 if(!label||!doc.querySelector('#andy-retest'))throw Error('Invalid report');
 const stages={};doc.querySelectorAll('#andy-retest table tr').forEach(tr=>{const t=tr.querySelectorAll('td');if(t.length<2)return;const s=t[0].textContent.trim().replace(/\/USDT$/,''),stage=t[1].textContent.trim();if(safeSymbol(s)&&['지지 확인','재출발'].includes(stage))stages[s]=stage;});
 state.andy={label:label[0],at:Date.parse(`${label[1]}T${label[2]}:00+09:00`),stages};state.at.andy=Date.now();
}
async function refresh(){
 if(!visible()||state.busy)return;
 if(Date.now()-state.lastAttempt<30000){schedule();return;}
 const epoch=state.epoch;state.busy=true;state.lastAttempt=Date.now();render();
 await Promise.all([job(state.venue,()=>domestic(state.venue,epoch)),job('binance',async()=>{const d=await get('https://data-api.binance.vision/api/v3/ticker/24hr',epoch);if(!Array.isArray(d))throw Error('Invalid global');state.global=Object.fromEntries(d.filter(x=>x.symbol?.endsWith('USDT')&&safeSymbol(x.symbol.slice(0,-4))).map(x=>[x.symbol.slice(0,-4),x]));}),
 job('fx',async()=>{if(state.fx&&Date.now()-(state.at.fx||0)<3600000)return;const f=await get('https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW',epoch);if(!fxValid(f))throw Error('Invalid FX');state.fx=f;state.at.fx=Date.now();}),
 job('andy',async()=>{if(Date.now()-(state.at.andy||0)<300000)return;await loadAndy(epoch);})]);
 state.busy=false;if(visible())render();schedule();
}
function schedule(){clearTimeout(state.timer);if(visible())state.timer=setTimeout(refresh,Math.max(1000,30000-(Date.now()-state.lastAttempt)));}
function sync(){if(!visible()){clearTimeout(state.timer);state.epoch++;state.controllers.forEach(c=>c.abort());}else{render();refresh();}}
el.addEventListener('click',e=>{const star=e.target.closest('[data-star]'),select=e.target.closest('[data-select]');if(star){const s=star.dataset.star;favorites.has(s)?favorites.delete(s):favorites.add(s);try{localStorage.setItem('tl_domestic_favorites',JSON.stringify([...favorites]));}catch{storageWarning=true;}render();}if(select){state.selected=select.dataset.select;render();$('dm-detail').scrollIntoView({block:'nearest',behavior:'smooth'});}});
$('dm-venue').onchange=e=>{state.venue=e.target.value;state.selected=null;render();refresh();};
$('dm-basis').onchange=e=>{state.basis=e.target.value;render();};
$('dm-sort').onchange=e=>{state.sort=e.target.value;render();};
$('dm-search').oninput=e=>{state.query=e.target.value.trim().toLowerCase();render();};
$('dm-favorites').onclick=e=>{state.only=!state.only;e.currentTarget.setAttribute('aria-pressed',String(state.only));render();};
new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']});document.addEventListener('visibilitychange',sync);sync();
})(typeof window!=='undefined'?window:globalThis);
