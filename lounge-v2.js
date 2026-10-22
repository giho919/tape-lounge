/* Navigation, observation ledger and browser-local watchlist. No trading or account access. */
(function () {
'use strict';
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validSymbol = s => typeof s === 'string' && /^[A-Z0-9]{1,24}$/.test(s);
const validNumber = x => x !== null && x !== '' && Number.isFinite(Number(x));
const date = at => Number.isFinite(typeof at==='number'?at:Date.parse(at)) ? new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '시각 미확인';
const pct = n => validNumber(n) ? `${n>0?'+':''}${Number(n).toFixed(2)}%` : '—';
const money = n => validNumber(n) ? '$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:n<1?6:n<100?4:2}) : '—';
const tone = n => !validNumber(n) ? '' : n >= 0 ? 'up' : 'dn';
const chip = (stage, active=true) => `<span class="v2-chip${!active||stage==='이미 많이 벌어짐'?' muted':stage==='눌림 대기'?' wait':''}">${esc(stage)}</span>`;
function node(tag, cls, html='') { const el=document.createElement(tag); el.className=cls; el.innerHTML=html; return el; }
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
let storageOk = true;
function save(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { storageOk=false; } }

// Build the shell before the legacy engines measure their chart/canvas containers.
document.body.classList.add('lounge-v2');
const lounge = byId('tab-lounge'), header = document.querySelector('.hdr'), bar=document.querySelector('.tabs');
document.querySelector('.brand').innerHTML='<a href="#" aria-label="Tape Lounge 라운지">TAPE LOUNGE</a><small>READ THE TAPE · FOLLOW THE CHANGE</small>';
const aux=node('div','v2-aux-tabs'); aux.hidden=true; header.append(aux);
const names={lounge:['◉','라운지'],domestic:['▥','마켓'],chars:['⌁','리서치']};
document.querySelectorAll('.tab').forEach(tab=>{
  const pair=names[tab.dataset.tab];
  if(pair){tab.querySelector('.ic').textContent=pair[0];tab.querySelector('.nm').textContent=pair[1];tab.title={lounge:'시장 변화 · 차트 · 관심 종목',domestic:'전체 시세 · 김프 · 종목 검색',chars:'후보 이력 · 전략가 리포트 · 시장 자료'}[tab.dataset.tab];}
  else aux.append(tab);
});
bar.setAttribute('aria-orientation','horizontal'); bar.setAttribute('aria-label','주요 화면');
const more=node('details','v2-more','<summary>더보기 ↗</summary><div><button type="button" data-open-tab="desk">차트 상세 · 데스크</button><button type="button" data-open-tab="chain">온체인 자료</button><button type="button" data-open-tab="macro">경제 일정</button><button type="button" data-open-tab="game">플레이룸 · 블라인드</button></div>'); header.append(more);
const hero=node('section','v2-hero',`<div><div class="v2-eyebrow">THE DAILY OBSERVATION</div><h1>시장의 변화, 다음 관찰.</h1><p>지금 달라진 것부터. 관심 있는 종목은 계속 지켜보세요.</p></div><div class="v2-hero-note"><b id="v2-today"></b><span>실시간 시세 · 기록으로 이어지는 관찰</span></div>`);
lounge.prepend(hero);
const returnBox=node('section','v2-return','<strong id="v2-return-title">먼저 확인하기</strong><p id="v2-return-copy">시장 자료를 연결하고 있어요. 새 후보와 관심 종목의 변화를 이곳에 모읍니다.</p>'); returnBox.setAttribute('aria-label','지난 방문 이후 변화');
const strip=lounge.querySelector('.strip');strip.after(returnBox);
[0,1,5,3,2,6,4].forEach((order,i)=>{if(strip.children[i])strip.children[i].style.order=String(order);});
const chart=document.querySelector('#tab-lounge .caro'), paper=byId('paperPanel'), chat=byId('chatPanel');
const workspace=node('div','v2-workspace'), chartColumn=node('div','v2-chart'), sidebar=node('aside','v2-sidebar');
chartColumn.append(chart,node('div','v2-chart-tools','<span>시세 연결 시 실시간 · 미연결 시 60초 조회</span><a href="#desk" data-open-tab="desk">추세·가격대 자세히 ↗</a>'));
sidebar.innerHTML=`<section class="v2-section" aria-labelledby="v2-andy-title"><header class="v2-section-head"><h2 id="v2-andy-title">Andy의 관찰 목록<small id="v2-andy-stamp">게시 리포트를 확인하는 중</small></h2><a href="#research" data-ledger-link>전체 기록 ↗</a></header><div id="v2-andy-counts" class="v2-stage-counts"></div><div id="v2-candidates"><p class="v2-empty">후보를 불러오고 있어요.</p></div><p class="v2-note" id="v2-andy-note">마감봉 기준의 관찰 목록 · 실시간 매수 신호가 아닙니다.</p></section>
<section class="v2-section" aria-labelledby="v2-watch-title"><header class="v2-section-head"><h2 id="v2-watch-title">내 관심 종목<small id="v2-watch-sub">별표를 누르면 이 브라우저에 보관됩니다.</small></h2><a href="#market">종목 찾기 ↗</a></header><div class="v2-watch-search"><input id="v2-watch-input" aria-label="관심 종목 티커" placeholder="BTC, ETH, SOL…" maxlength="24"><button type="button" id="v2-watch-add">추가</button></div><div id="v2-watch-rows"></div><p class="v2-note" id="v2-quote-stamp">Binance USDT 현물 · 24시간 등락</p></section>`;
workspace.append(chartColumn,sidebar); returnBox.after(workspace);
const context=node('section','v2-context-grid',`<article class="v2-context-item"><h2>세션 흐름</h2><strong id="v2-session-title">최근 세션을 확인 중</strong><p id="v2-session-copy">아시아 · 유럽 · 미국장의 최근 회차를 비교합니다.</p><a href="#v2-observatory" data-observatory-link>관전석 펼치기 ↗</a></article><article class="v2-context-item"><h2>다음 주요 일정</h2><strong id="v2-event-title">공식 일정을 확인 중</strong><p id="v2-event-copy">발표 시각은 한국시간 기준입니다.</p><a href="#calendar" data-open-tab="macro">발표 일정 전체 ↗</a></article>`); workspace.after(context);
const reading=node('section','v2-reading');reading.setAttribute('aria-label','전략가들의 최근 기록');context.after(reading);
const bottom=node('div','v2-bottom'), highlights=byId('highlightList')?.closest('.panel');
if(highlights)bottom.append(highlights);bottom.append(chat);reading.after(bottom);
const chatFilters=node('div','v2-chat-filter','<button type="button" data-chat-filter="all" aria-pressed="true">전체 대화</button><button type="button" data-chat-filter="human" aria-pressed="false">사람 대화</button>'); chat.querySelector('h3').after(chatFilters);
const humanEmpty=node('p','v2-empty','불러온 최근 대화에는 사람 메시지가 없어요. 시장을 보며 든 생각을 먼저 남겨도 좋아요.');humanEmpty.hidden=true;byId('feed').after(humanEmpty);
const observatory=node('details','v2-observatory','<summary>관전석 <span>체결의 비 · 청산 · 세션 · 코인 레이스</span></summary>');observatory.id='v2-observatory';
observatory.append(lounge.querySelector('.spectatorFloor'),lounge.querySelector('.flowRow'));bottom.after(observatory);
const play=node('details','v2-play','<summary>플레이룸 <span>가짜 돈으로 연습하거나, 이름을 가린 과거 차트를 읽어보세요.</span></summary><p class="v2-backlink"><a href="#blind" data-open-tab="game">블라인드 차트 시작 ↗</a></p>');play.id='v2-play';play.append(paper);observatory.after(play);
window.loungeSpectating=()=>observatory.open;
lounge.querySelector('.main')?.remove();
const research=byId('tab-chars');
research.prepend(node('nav','v2-research-nav','<button type="button" data-ledger-link>Andy 관찰 이력</button><button type="button" data-open-tab="chain">온체인 자료</button><button type="button" data-open-tab="macro">경제 일정</button><button type="button" data-open-tab="analysis">차트 연구</button>'));
research.querySelector('.stratHeading h2').textContent='관찰과 근거의 기록';
research.querySelector('.stratHeading p').textContent='발견한 순간부터 이후 변화까지. 세 전략가의 기록을 함께 읽습니다.';
const ledger=node('section','v2-section v2-ledger',`<header class="v2-section-head"><h2>Andy 관찰 이력<small id="v2-ledger-coverage">보관된 리포트의 당시 상태를 모읍니다.</small></h2><a href="reports/andy_scan.html" target="_blank" rel="noopener">원본 리포트 ↗</a></header><div class="v2-ledger-tools"><input type="search" id="v2-ledger-search" aria-label="관찰 이력 종목 검색" placeholder="종목 찾기"><select id="v2-ledger-filter" aria-label="관찰 이력 범위"><option value="active">현재 관찰</option><option value="all">전체 기록</option><option value="archive">목록 제외</option><option value="4h">4시간봉</option><option value="1d">일봉</option></select></div><div id="v2-ledger-rows" class="v2-ledger-scroll"><p class="v2-empty">기록을 불러오고 있어요.</p></div><p class="v2-note">최초 등장은 보관 범위 안에서의 첫 관측입니다. 목록 제외만으로 지지 이탈·손절을 판단하지 않습니다. 관찰 기록과 실제 매매 성과는 다릅니다.</p>`);ledger.id='v2-ledger';research.append(ledger);
['desk','chain','macro','analysis','game'].forEach(id=>{
  const section=byId('tab-'+id);if(!section)return;
  section.prepend(node('nav','v2-detail-nav',`<button type="button" data-open-tab="${id==='game'?'lounge':'chars'}">← ${id==='game'?'라운지':'리서치'}</button><span>${{desk:'차트 상세 · 선물 데스크',chain:'온체인 자료',macro:'경제 일정',analysis:'차트 연구',game:'플레이룸'}[id]}</span>`));
});
const dialog=node('dialog','v2-dialog',`<header class="v2-dialog-head"><h2 id="v2-dialog-title"></h2><button type="button" id="v2-dialog-star" aria-pressed="false">☆ 관심</button><button type="button" id="v2-dialog-close" aria-label="종목 상세 닫기">닫기 ✕</button></header><nav class="v2-dialog-controls" aria-label="종목 차트 주기"><button type="button" data-modal-tf="60" aria-pressed="false">1시간</button><button type="button" data-modal-tf="240" aria-pressed="true">4시간</button><button type="button" data-modal-tf="D" aria-pressed="false">일봉</button></nav><div id="v2-dialog-chart"></div><div class="v2-dialog-body" id="v2-dialog-body"></div>`);dialog.setAttribute('aria-labelledby','v2-dialog-title');document.body.append(dialog);

document.addEventListener('DOMContentLoaded',init,{once:true});
function init() {
  const DEFAULTS=['BTC','ETH','SOL','XRP'];
  let favorites=new Set((Array.isArray(read('tl_domestic_favorites',[]))?read('tl_domestic_favorites',[]):[]).filter(validSymbol).slice(0,500));
  let prior=read('tl_lounge_visit_v2',null);if(!prior||!Number.isFinite(prior.at)||prior.at>Date.now()+300000||Date.now()-prior.at>90*86400000)prior=null;
  let watch=null,quotes={},quotesAt=0,calendar=null,letters=null,pending=false,controller=null,timer=null,lastRefresh=0,modalSymbol=null,modalTf='240',dialogTrigger=null;
  let quoteFailed=false,watchFailed=false,ledgerFilter='active',ledgerSearch='',ledgerLimit=150;
  const updateHumanEmpty=()=>{humanEmpty.hidden=!chat.classList.contains('v2-human-only')||!!byId('feed').querySelector('.msg.user:not(.virtual)');};
  new MutationObserver(updateHumanEmpty).observe(byId('feed'),{childList:true});
  const homeVisible=()=>!document.hidden&&!lounge.classList.contains('hidden');
  const researchVisible=()=>!document.hidden&&!research.classList.contains('hidden');
  const isQuoteFresh=()=>quotesAt>0&&Date.now()-quotesAt<=120000;
  function go(tab){const el=document.querySelector(`.tab[data-tab="${tab}"]`);if(el)el.click();}
  function star(symbol){if(!validSymbol(symbol))return;favorites.has(symbol)?favorites.delete(symbol):favorites.add(symbol);save('tl_domestic_favorites',[...favorites]);window.dispatchEvent(new CustomEvent('tl:favorites',{detail:{symbols:[...favorites]}}));renderWatch();renderCandidates();renderLedger();if(modalSymbol===symbol)renderDialogBody();}
  function snapshot(){
    // Only persist data actually observed while this browser was looking at the lounge.
    if(lounge.classList.contains('hidden')&&research.classList.contains('hidden'))return;
    const old=read('tl_lounge_visit_v2',{}),prices={};
    if(isQuoteFresh())Object.entries(quotes).forEach(([s,q])=>{if(DEFAULTS.includes(s)||favorites.has(s))prices[s]=q.price;});
    const stages=watch&&!watchFailed?Object.fromEntries(watch.candidates.map(x=>[x.timeframe+':'+x.symbol,x.stage])):old.stages;
    if(!Object.keys(prices).length&&!stages)return;
    save('tl_lounge_visit_v2',{at:Date.now(),prices:Object.keys(prices).length?prices:old.prices,quoteAt:isQuoteFresh()?quotesAt:old.quoteAt,stages,reportAt:watch?.reportAt||old.reportAt});
  }
  function renderReturn(){
    const parts=[],hasPrior=prior&&Date.now()-prior.at>=900000;
    byId('v2-return-title').textContent=hasPrior?'다녀간 사이':'먼저 확인하기';
    if(hasPrior&&prior.prices&&Number.isFinite(prior.quoteAt)&&isQuoteFresh()){
      const changes=[...favorites,...DEFAULTS].filter((s,i,a)=>a.indexOf(s)===i&&quotes[s]&&validNumber(prior.prices[s])&&prior.prices[s]>0).map(s=>({s,p:(quotes[s].price/prior.prices[s]-1)*100})).sort((a,b)=>Math.abs(b.p)-Math.abs(a.p));
      if(changes[0])parts.push(`${changes[0].s} ${pct(changes[0].p)} (${date(prior.quoteAt)} 관측 대비)`);
    }
    if(watch&&!watchFailed){
      const changed=hasPrior&&prior.stages?watch.candidates.filter(x=>prior.stages[x.timeframe+':'+x.symbol]&&prior.stages[x.timeframe+':'+x.symbol]!==x.stage):[];
      const added=hasPrior&&prior.stages?watch.candidates.filter(x=>!prior.stages[x.timeframe+':'+x.symbol]):[];
      if(changed[0])parts.push(`${changed[0].symbol} ${changed[0].timeframe==='4h'?'4시간봉':'일봉'} 관찰이 ‘${changed[0].stage}’로 변경`);
      else if(added.length)parts.push(`최근 리포트에 새 관찰 ${added.length}건`);
      else if(!parts.length)parts.push(`Andy의 ${date(watch.reportAt)} 리포트: 관찰 ${watch.candidates.length}건`);
    }
    if(!parts.length)parts.push(quoteFailed||watchFailed?'일부 자료 연결이 지연되고 있어요. 표시 시각과 원본을 확인해 주세요.':'관심 종목을 저장하면 다음 방문에 관측한 가격과 후보 상태의 변화를 알려드려요.');
    byId('v2-return-copy').textContent=parts.slice(0,2).join(' · ');
  }
  function renderWatch(){
    const symbols=favorites.size?[...favorites].slice(0,10):DEFAULTS;
    byId('v2-watch-sub').textContent=favorites.size?`${favorites.size}개 저장 · 이 브라우저에서 유지`:'기본 종목입니다. 별표로 내 목록을 만들어 보세요.';
    byId('v2-watch-rows').innerHTML=symbols.map(s=>{
      const q=quotes[s],fresh=isQuoteFresh();
      return `<div class="v2-watch-row"><button type="button" class="v2-star" data-star-symbol="${s}" aria-label="${s} 관심 종목" aria-pressed="${favorites.has(s)}">${favorites.has(s)?'★':'☆'}</button><button type="button" class="v2-symbol" data-symbol="${s}">${s}</button><span class="v2-watch-price">${q?money(q.price):'—'}<small class="${fresh&&q?tone(q.change):''}">${q?(fresh?pct(q.change):'시세 지연'):(quoteFailed?'연결 대기':'시세 확인 중')}</small></span></div>`;
    }).join('');
    byId('v2-quote-stamp').textContent=!storageOk?'브라우저 저장이 차단되어 관심 목록은 이번 방문에만 유지됩니다.':quotesAt?`Binance USDT 현물 · ${date(quotesAt)} KST 관측 · 24시간 등락${isQuoteFresh()?'':' · 갱신 지연'}`:'Binance USDT 현물 · 시세가 없는 티커는 가격을 표시하지 않습니다.';
  }
  function renderCandidates(){
    if(!watch){byId('v2-candidates').innerHTML='<p class="v2-empty">후보 기록을 연결하지 못했어요.<br><a href="reports/andy_scan.html">Andy 원본 리포트 열기 ↗</a></p>';return;}
    const stale=Date.now()-Date.parse(watch.reportAt)>36*3600000;
    byId('v2-andy-stamp').textContent=`${date(watch.reportAt)} KST 리포트${stale?' · 오래된 자료':''}`;
    const cs=watch.candidates.filter(x=>x.timeframe==='4h'),preferred=cs.filter(x=>x.stage!=='이미 많이 벌어짐');
    const selected=(preferred.length?preferred:watch.candidates.filter(x=>x.timeframe==='1d')).slice(0,4);
    byId('v2-andy-counts').innerHTML=['지지 확인','재출발','눌림 대기'].map(s=>`<span>${s}<b>${cs.filter(x=>x.stage===s).length}</b></span>`).join('');
    byId('v2-candidates').innerHTML=selected.length?selected.map(x=>`<article class="v2-candidate"><button type="button" class="v2-symbol" data-symbol="${x.symbol}">${x.symbol} <span style="font-size:10px;color:var(--dim);font-weight:400">${x.timeframe==='4h'?'4H':'1D'}</span></button>${chip(x.stage)}<p>${validNumber(x.distancePct)?`리포트 당시 지지선까지 ${Number(x.distancePct).toFixed(1)}% · `:''}첫 관측 ${date(x.firstSeenAt)}</p></article>`).join(''):'<p class="v2-empty">이번 리포트에는 표시할 후보가 없습니다.</p>';
    byId('v2-andy-note').textContent=stale?'36시간 이상 지난 리포트입니다. 현재 후보로 판단하기 전에 원본 갱신을 확인하세요.':'4시간봉은 마감봉 기준 · 지지 확인과 재출발을 우선 표시합니다.';
  }
  function renderLedger(){
    if(!watch){byId('v2-ledger-rows').innerHTML='<p class="v2-empty">관찰 이력을 불러오지 못했습니다. 원본 리포트를 확인해 주세요.</p>';return;}
    byId('v2-ledger-coverage').textContent=`${date(watch.coverage.fromAt)}부터 ${watch.coverage.reports}회 게시 기록 · 마지막 ${date(watch.reportAt)} KST`;
    const matching=[...watch.candidates,...watch.archive].filter(x=>(ledgerFilter==='all'||ledgerFilter==='active'&&x.active||ledgerFilter==='archive'&&!x.active||x.timeframe===ledgerFilter)&&(!ledgerSearch||x.symbol.includes(ledgerSearch)));
    const all=matching.slice(0,ledgerLimit);
    byId('v2-ledger-rows').innerHTML=all.length?`<table><thead><tr><th>종목 · 주기</th><th>최근 상태</th><th>보관 중 첫 관측</th><th>상태 변화</th></tr></thead><tbody>${all.map(x=>`<tr><td><button type="button" class="v2-symbol" data-symbol="${x.symbol}">${x.symbol}</button><p>${x.timeframe==='4h'?'4시간봉':'일봉'}</p></td><td>${chip(x.active?x.stage:'목록 제외',x.active)}<p>마지막 등재 ${date(x.lastSeenAt)}</p></td><td>${date(x.firstSeenAt)}<p>KST · 보관 범위 기준</p></td><td>${x.timeline.slice(-3).map(t=>`<p>${date(t.at)} · ${esc(t.stage)}</p>`).join('')}</td></tr>`).join('')}</tbody></table>`:'<p class="v2-empty">조건에 맞는 관찰 기록이 없습니다.</p>';
    if(matching.length>all.length)byId('v2-ledger-rows').insertAdjacentHTML('beforeend',`<p class="v2-note">${matching.length}건 중 ${all.length}건 표시 · <button type="button" class="v2-text-button" data-ledger-more>기록 더 보기 ↓</button></p>`);
  }
  function renderReading(){
    const defs=[['madam','鄭마담 · 운용 장부','BTC와 금, 지금의 선택','madam_daily.html'],['andy','Andy · 후보 관찰','다음에 지켜볼 종목','andy_scan.html'],['justin','Justin · 국면 연구','이번 달 시장의 조건','justin_lab.html']];
    reading.innerHTML=defs.map(([key,label,title,url])=>{const msg=letters?.messages?.find(x=>x.cls===key);return `<a href="reports/${url}"><small>${label}</small><strong>${esc(msg?.kpi?.value||title)}</strong><p>${esc(msg?.kpi?.note||title)}</p><time>${msg?.at?esc(msg.at)+' KST 기준':'리포트 열기'} ↗</time></a>`;}).join('');
  }
  function renderContext(){
    const source=byId('sessionCopy')?.textContent;
    if(source&&!/읽고|집계 중/.test(source)){byId('v2-session-title').textContent=byId('sessionBadge')?.textContent?.replace(' LEADS',' 선두')||'최근 세션 비교';byId('v2-session-copy').textContent=source;}
    if(calendar){
      const next=(calendar.events||[]).filter(x=>Number.isFinite(Date.parse(x.scheduled_at))&&Date.parse(x.scheduled_at)>Date.now()).sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at))[0];
      byId('v2-event-title').textContent=next?`${next.code} · ${next.title}`:'예정된 주요 일정 없음';
      byId('v2-event-copy').textContent=next?`${date(next.scheduled_at)} KST · ${Math.ceil((Date.parse(next.scheduled_at)-Date.now())/3600000)}시간 후 · ${next.source}`:`일정 자료 기준 ${date(calendar.generated_at)} KST`;
    }
  }
  function render(){renderWatch();renderCandidates();renderReturn();renderReading();renderContext();}
  async function get(url){const res=await fetch(url,{cache:url.startsWith('https:')?'no-store':'no-cache',credentials:'omit',signal:controller.signal});if(!res.ok)throw Error('HTTP '+res.status);return res.json();}
  async function refresh(force=false){
    if(pending||(!homeVisible()&&!researchVisible())||!force&&Date.now()-lastRefresh<60000)return;
    pending=true;lastRefresh=Date.now();controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),16000);
    const jobs=[];
    if(homeVisible())jobs.push(get('https://data-api.binance.vision/api/v3/ticker/24hr?type=MINI').then(rows=>{
      if(!Array.isArray(rows)||!rows.length)throw Error('Invalid quotes');const next={};
      for(const q of rows){const s=q.symbol?.endsWith('USDT')?q.symbol.slice(0,-4):'';if(validSymbol(s)&&validNumber(q.lastPrice)&&Number(q.lastPrice)>0&&validNumber(q.openPrice)&&Number(q.openPrice)>0&&Number.isFinite(q.closeTime)&&Math.abs(Date.now()-q.closeTime)<120000)next[s]={price:Number(q.lastPrice),change:(Number(q.lastPrice)/Number(q.openPrice)-1)*100};}
      if(!Object.keys(next).length)throw Error('Stale quotes');quotes=next;quotesAt=Date.now();quoteFailed=false;window.dispatchEvent(new CustomEvent('tl:quotes',{detail:{quotes,at:quotesAt}}));renderWatch();renderReturn();
    }).catch(e=>{if(e.name!=='AbortError')quoteFailed=true;}));
    if(!watch||Date.now()-Date.parse(watch.fetchedAt||0)>300000)jobs.push(get('data/andy-watch.json').then(data=>{
      const safe=x=>validSymbol(x.symbol)&&['4h','1d'].includes(x.timeframe)&&typeof x.stage==='string'&&Array.isArray(x.timeline)&&Number.isFinite(Date.parse(x.firstSeenAt))&&Number.isFinite(Date.parse(x.lastSeenAt));
      if(data.schema!==1||!Number.isFinite(Date.parse(data.reportAt))||Date.parse(data.reportAt)>Date.now()+300000||!Array.isArray(data.candidates)||!Array.isArray(data.archive)||!data.coverage||!Number.isFinite(Date.parse(data.coverage.fromAt)))throw Error('Invalid ledger');
      watch={...data,candidates:data.candidates.filter(safe),archive:data.archive.filter(safe),fetchedAt:new Date().toISOString()};watchFailed=false;renderCandidates();renderLedger();renderReturn();
    }).catch(e=>{if(e.name!=='AbortError')watchFailed=true;}));
    if(!letters||Date.now()-Date.parse(letters.fetchedAt||0)>300000)jobs.push(get('reports/letters.json').then(data=>{if(!Array.isArray(data.messages))throw Error('Invalid letters');letters={...data,fetchedAt:new Date().toISOString()};renderReading();}).catch(()=>{}));
    if(!calendar||Date.now()-Date.parse(calendar.fetchedAt||0)>900000)jobs.push(get('reports/econ_calendar.json').then(data=>{if(!Array.isArray(data.events))throw Error('Invalid calendar');calendar={...data,fetchedAt:new Date().toISOString()};renderContext();}).catch(()=>{byId('v2-event-title').textContent='일정 연결 대기';}));
    try{await Promise.all(jobs);}finally{clearTimeout(timeout);pending=false;controller=null;render();renderLedger();snapshot();}
  }
  function sync(){clearInterval(timer);timer=null;if(homeVisible()||researchVisible()){refresh();timer=setInterval(()=>{renderWatch();renderReturn();renderContext();refresh();},15000);}else{snapshot();controller?.abort();}}
  function iframe(){
    if(!modalSymbol||!dialog.open)return;
    const q=new URLSearchParams({symbol:`BINANCE:${modalSymbol}USDT`,interval:modalTf,theme:'dark',style:'1',locale:'kr',timezone:'Asia/Seoul',hide_side_toolbar:'1',allow_symbol_change:'0',save_image:'0',withdateranges:'0',utm_source:'tapelounge.com'});
    const frame=document.createElement('iframe');frame.src='https://s.tradingview.com/widgetembed/?'+q;frame.title=`${modalSymbol}/USDT Binance 현물 ${modalTf==='D'?'일봉':modalTf+'분'} 차트`;frame.referrerPolicy='no-referrer';byId('v2-dialog-chart').replaceChildren(frame);
    dialog.querySelectorAll('[data-modal-tf]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.modalTf===modalTf)));
  }
  function renderDialogBody(){
    const s=modalSymbol,q=quotes[s],entries=watch?[...watch.candidates,...watch.archive].filter(x=>x.symbol===s):[];
    byId('v2-dialog-title').textContent=s+' / USDT';byId('v2-dialog-star').textContent=favorites.has(s)?'★ 관심 저장됨':'☆ 관심';byId('v2-dialog-star').setAttribute('aria-pressed',String(favorites.has(s)));
    byId('v2-dialog-body').innerHTML=`<p>${q?`${money(q.price)} · 24시간 ${pct(q.change)} · ${date(quotesAt)} KST 관측${isQuoteFresh()?'':' · 시세 지연'}`:'Binance USDT 현물 차트 · 거래 가능한 마켓이 없으면 차트가 표시되지 않을 수 있습니다.'}</p>`+entries.map(x=>`<section><p style="margin-top:15px">${x.timeframe==='4h'?'4시간봉':'일봉'} · ${chip(x.active?x.stage:'목록 제외',x.active)} · 리포트 ${date(x.lastSeenAt)} KST</p><div class="v2-timeline">${x.timeline.slice(-8).map(t=>`<span><time>${date(t.at)} KST</time>${esc(t.stage)}</span>`).join('')}</div>${validNumber(x.support)?`<p>마지막 등재 당시 추세 지지선 ${money(x.support)}${validNumber(x.testLow)?` · 지지시험 저점 ${money(x.testLow)}`:''}. 현재 가격의 지지선이나 자동 주문 기준이 아닙니다.</p>`:''}</section>`).join('')+(!entries.length?'<p style="margin-top:15px">보관된 Andy 관찰 기록에 없는 종목입니다. 관심 종목으로 저장해 다시 확인할 수 있어요.</p>':'')+'<p style="margin-top:15px"><a href="reports/andy_scan.html" target="_blank" rel="noopener">Andy 원본 리포트 ↗</a> · <a href="#market" id="v2-go-market">마켓에서 찾기 ↗</a></p>';
    byId('v2-go-market').onclick=e=>{e.preventDefault();const symbol=modalSymbol;closeDialog();go('domestic');window.TapeMarket?.open(symbol);};
  }
  function openSymbol(s,trigger){if(!validSymbol(s))return;dialogTrigger=trigger;modalSymbol=s;modalTf='240';renderDialogBody();if(!dialog.open)dialog.showModal();iframe();}
  function closeDialog(){dialog.close();byId('v2-dialog-chart').replaceChildren();dialogTrigger?.focus({preventScroll:true});modalSymbol=null;}
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-ledger-more]')){ledgerLimit+=150;renderLedger();}
    const open=e.target.closest('[data-open-tab]'),symbol=e.target.closest('[data-symbol]'),starButton=e.target.closest('[data-star-symbol]'),ledgerLink=e.target.closest('[data-ledger-link]');
    if(open){e.preventDefault();more.open=false;go(open.dataset.openTab);window.scrollTo({top:0,behavior:'instant'});}
    if(symbol)openSymbol(symbol.dataset.symbol,symbol);
    if(starButton)star(starButton.dataset.starSymbol);
    if(ledgerLink){e.preventDefault();go('chars');requestAnimationFrame(()=>ledger.scrollIntoView({behavior:'smooth',block:'start'}));}
    if(e.target.closest('[data-observatory-link]')){e.preventDefault();observatory.open=true;observatory.scrollIntoView({behavior:'smooth',block:'start'});}
    const filter=e.target.closest('[data-chat-filter]');if(filter){chat.classList.toggle('v2-human-only',filter.dataset.chatFilter==='human');chatFilters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===filter)));updateHumanEmpty();}
    const tf=e.target.closest('[data-modal-tf]');if(tf&&['60','240','D'].includes(tf.dataset.modalTf)){modalTf=tf.dataset.modalTf;iframe();}
  });
  byId('v2-dialog-close').onclick=closeDialog;byId('v2-dialog-star').onclick=()=>star(modalSymbol);dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  const add=()=>{let s=byId('v2-watch-input').value.trim().toUpperCase();if(s.length>4)s=s.replace(/\/USDT$|USDT$/,'');if(!validSymbol(s)){byId('v2-watch-input').setCustomValidity('영문·숫자 티커를 입력해 주세요.');byId('v2-watch-input').reportValidity();return;}byId('v2-watch-input').setCustomValidity('');if(!favorites.has(s))star(s);byId('v2-watch-input').value='';};
  byId('v2-watch-add').onclick=add;byId('v2-watch-input').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)add();};byId('v2-watch-input').oninput=e=>e.target.setCustomValidity('');
  byId('v2-ledger-search').oninput=e=>{ledgerSearch=e.target.value.trim().toUpperCase();ledgerLimit=150;renderLedger();};byId('v2-ledger-filter').onchange=e=>{ledgerFilter=e.target.value;ledgerLimit=150;renderLedger();};
  window.addEventListener('tl:favorites',e=>{favorites=new Set((e.detail?.symbols||[]).filter(validSymbol).slice(0,500));renderWatch();if(modalSymbol)renderDialogBody();});
  window.addEventListener('storage',e=>{if(e.key==='tl_domestic_favorites'){const stored=read(e.key,[]);favorites=new Set((Array.isArray(stored)?stored:[]).filter(validSymbol));renderWatch();}});
  window.addEventListener('tl:tab',e=>{
    const group=e.detail?.tab;document.querySelector('.tab[data-tab="chars"]').classList.toggle('v2-group-on',['desk','chain','macro','analysis'].includes(group));
    sync();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)snapshot();sync();});window.addEventListener('pagehide',()=>{snapshot();controller?.abort();clearInterval(timer);});
  observatory.addEventListener('toggle',()=>{if(observatory.open){window.dispatchEvent(new Event('resize'));if(typeof connectRaceWS==='function')connectRaceWS();}else{if(typeof disconnectRaceWS==='function')disconnectRaceWS();}document.body.classList.toggle('v2-spectating',observatory.open);});
  play.addEventListener('toggle',()=>window.dispatchEvent(new Event('resize')));
  byId('v2-today').textContent=new Date().toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'});
  // A useful initial timeframe; all original timeframes, SMA, Supertrend, MACD and RSI remain available.
  if(typeof setTf==='function')setTf('4h');
  render();renderLedger();sync();
}
})();
