/* A real market stage: one quote source, recorded scenes, local observations. No orders. */
(()=>{'use strict';
const $=id=>document.getElementById(id),lang=document.documentElement.lang;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbolOK=s=>typeof s==='string'&&/^[A-Z0-9]{1,24}$/.test(s),idOK=s=>/^[a-f0-9]{16}$/.test(s||'');
const number=n=>n!==null&&n!==''&&Number.isFinite(Number(n));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
let storageOK=true;
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{storageOK=false;return false;}};
const params=new URLSearchParams(location.search),locale={ko:'ko-KR',en:'en-US',zh:'zh-CN',ja:'ja-JP'}[lang]||'en-US';
const money=n=>number(n)?Number(n).toLocaleString('en-US',{maximumFractionDigits:n<1?6:n<100?4:2}):'—';
const pct=n=>number(n)?`${n>0?'+':''}${Number(n).toFixed(2)}%`:'—';
const compact=n=>number(n)?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n):'—';
const at=value=>Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString(locale,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'—';
const tone=n=>n>=0?'positive':'negative';
const cache=new Map(),requests=new Set(),sceneCache=new Map();
let config,t,watch,chart,series,volumeSeries,priceLine,selectedLine,resizeObserver;
let mode='live',asset='BTC',bars=[],cursor=0,scene=null,selectedPrice=null,generation=0,noteDraft=null;
let quoteAt=0,quotes={},fx=null,fxAt=0,won={},wonAt=0,events=[],eventsAt=0,archive=null,archiveAt=0;
let ws=null,wsRetry=null,retries=0,lastStreamAt=0,trades=[],flowSince=0,lastTradeId=null,tradeRenderAt=0,liveFetchAt=0;
let playTimer=null,tickTimer=null,playing=false,sceneLoading=false,archiveBusy=false,eventBusy=false,quoteBusy=false,caseRevealed=false,caseReference=null,caseEnd=null;
let particles=[],animation=0,lastFrame=0,quiet=read('tl_stage_quiet',false),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let savedRaw=read('tl_domestic_favorites',[]),favorites=new Set((Array.isArray(savedRaw)?savedRaw:[]).filter(symbolOK).slice(0,500));
let notes=read('tl_stage_observations_v1',[]);notes=(Array.isArray(notes)?notes:[]).filter(x=>x&&symbolOK(x.asset)&&number(x.price)&&x.price>0&&Number.isFinite(Date.parse(x.recordedAt))).slice(-100);
const prior=read('tl_discovery_visit_v1',null);
const observedKey='tl_stage_observations_v1',chartColor='#0d1215';

async function getJSON(url,{signal,headers={},fresh=false}={}){
 const ac=new AbortController();requests.add(ac);const stop=()=>ac.abort();signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)ac.abort();const timer=setTimeout(stop,16000);
 try{const response=await fetch(url,{signal:ac.signal,headers,credentials:'omit',cache:fresh?'no-store':'no-cache',referrerPolicy:'no-referrer'});if(!response.ok)throw Error(`HTTP ${response.status}`);return await response.json();}
 finally{clearTimeout(timer);requests.delete(ac);signal?.removeEventListener('abort',stop);}
}
async function shortID(key){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));return [...new Uint8Array(hash)].slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('');}
function getFavoriteLabel(){return `${favorites.has(asset)?'★':'☆'} ${favorites.has(asset)?t.saved:t.save}`;}
function status(text){$('stage-action-status').textContent=text;}
function pub(path){return getJSON(config.url+'/rest/v1/'+path,{headers:{apikey:config.key},fresh:true});}
function sourceSymbol(event){return /^[A-Z0-9]{1,24}USDT$/.test(event?.symbol||'')?event.symbol:'BTCUSDT';}
function sceneTitle(row){
 if(!row)return t.chooseScene;
 if(lang==='ko'&&row.title)return row.title;
 const type=row.event_type,symbol=row.symbol==='ALL'?'ALL':String(row.symbol||'BTC').replace(/USDT$/,'');
 const side=['long','short','up','down'].includes(row.side)?t[row.side]:'';
 return `${symbol} · ${side} ${type==='breakout'||type==='breakdown'?t.breakout:type==='whale'?t.whale:type==='candle'?t.candle:t.liquidation}`.replace(/\s+/g,' ');
}
function sceneDetail(row){
 if(!row)return '';
 if(lang==='ko'&&row.detail)return row.detail;
 const parts=[];if(number(row.amount_usd))parts.push('$'+compact(row.amount_usd));if(number(row.price))parts.push(money(row.price));if(number(row.metadata?.count))parts.push(String(row.metadata.count));return parts.join(' · ');
}
function showPanel(name){
 ['now','observations','discussion'].forEach(key=>{$('stage-panel-'+key).hidden=key!==name;});
 document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===name)));
 window.dispatchEvent(new CustomEvent('tl:stage-panel',{detail:{name}}));
}
function updateMode(){
 document.body.dataset.stageMode=mode;document.body.dataset.revealed=String(caseRevealed);
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 document.querySelectorAll('[data-asset]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.asset===asset));b.disabled=mode!=='live';});
 $('stage-state').textContent=mode==='live'?'LIVE':mode==='daily'?'YOUR CALL':'REPLAY';$('stage-state').classList.toggle('replaying',mode!=='live');
 $('stage-symbol').textContent=asset+' / USDT';$('stage-full-chart').href='/terminal/?asset='+asset;
 $('stage-transport').hidden=mode==='live';$('stage-case').hidden=mode!=='daily';
 $('stage-favorite').textContent=getFavoriteLabel();$('stage-favorite').setAttribute('aria-pressed',String(favorites.has(asset)));
 $('stage-share').disabled=mode==='live'||!scene?.id||!scene?.archivedAt||mode==='daily'&&!caseRevealed;
 $('stage-observe').disabled=mode==='daily'&&!caseRevealed;
 $('stage-trades').hidden=mode!=='live';$('stage-replay-context').hidden=mode==='live';$('stage-quiet').disabled=mode!=='live';
 $('stage-chart-hint').textContent=mode==='live'?t.chartHint:t.snapshotOnly;
 $('stage-tape-status').textContent=mode==='live'?t.loading:t.snapshotOnly;
 $('stage-buy-pressure').style.width='50%';
 window.dispatchEvent(new CustomEvent('tl:stage-scene',{detail:{id:scene?.id||null,title:sceneTitle(scene?.event),mode}}));
}
function clearLines(){if(series&&priceLine){series.removePriceLine(priceLine);priceLine=null;}if(series&&selectedLine){series.removePriceLine(selectedLine);selectedLine=null;}selectedPrice=null;}
function ensureChart(){
 if(chart||!window.LightweightCharts)return;
 const el=$('stage-chart');
 chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{type:'solid',color:chartColor},textColor:'#83968a',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:10,attributionLogo:true},grid:{vertLines:{color:'#18231f'},horzLines:{color:'#1b2722'}},rightPriceScale:{borderColor:'#27332b',scaleMargins:{top:.12,bottom:.22}},timeScale:{borderColor:'#27332b',timeVisible:true,secondsVisible:false,rightOffset:6},crosshair:{vertLine:{color:'#69786a',labelBackgroundColor:'#39483b'},horzLine:{color:'#69786a',labelBackgroundColor:'#39483b'}},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false}});
 series=chart.addCandlestickSeries({upColor:'#71b695',downColor:'#ce8776',borderVisible:false,wickUpColor:'#71b695',wickDownColor:'#ce8776',priceLineColor:'#789782',priceFormat:{type:'price',precision:2,minMove:.01}});
 volumeSeries=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'',lastValueVisible:false,priceLineVisible:false});volumeSeries.priceScale().applyOptions({scaleMargins:{top:.84,bottom:0}});
 resizeObserver=new ResizeObserver(()=>{if(chart)chart.applyOptions({width:el.clientWidth,height:el.clientHeight});resizeCanvas();});resizeObserver.observe(el);
 chart.subscribeClick(param=>{if(!param.point||mode==='daily'&&!caseRevealed)return;const value=series.coordinateToPrice(param.point.y);if(!number(value)||value<=0)return;selectedPrice=Number(value);if(selectedLine)series.removePriceLine(selectedLine);selectedLine=series.createPriceLine({price:selectedPrice,color:'#c2a46b',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:t.watch});status(t.reference+': '+money(selectedPrice));});
 chart.subscribeCrosshairMove(param=>{const d=param.seriesData?.get(series),el=$('stage-crosshair');if(!d||!number(d.close)){el.hidden=true;return;}el.hidden=false;el.textContent=`O ${money(d.open)}  H ${money(d.high)}  L ${money(d.low)}  C ${money(d.close)}`;});
}
function parseBars(raw){
 if(!Array.isArray(raw))return [];
 const map=new Map();raw.forEach(k=>{if(!Array.isArray(k)||k.length<7)return;const b={time:Math.floor(Number(k[0])/1000),open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4]),volume:Number(k[5]),closeTime:Number(k[6])};if([b.time,b.open,b.high,b.low,b.close,b.volume,b.closeTime].every(Number.isFinite)&&Math.min(b.open,b.high,b.low,b.close)>0)map.set(b.time,b);});return [...map.values()].sort((a,b)=>a.time-b.time);
}
function visibleBars(){return mode==='live'?bars:bars.slice(0,cursor+1);}
function fallbackChart(selected){
 if(!selected.length)return;const min=Math.min(...selected.map(b=>b.low)),max=Math.max(...selected.map(b=>b.high)),range=max-min||max*.001;
 const points=selected.map((b,i)=>`${12+i/Math.max(1,selected.length-1)*950},${20+(max-b.close)/range*330}`).join(' ');
 $('stage-chart').innerHTML=`<svg class="stage-chart-fallback" viewBox="0 0 980 380" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" stroke="#83ba9c" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
}
function draw(reset=false){
 const selected=visibleBars();if(!selected.length)return;ensureChart();
 if(chart){
  const precision=asset==='BTC'||asset==='ETH'||asset==='SOL'?2:asset==='XRP'?4:Math.min(8,Math.max(2,Math.ceil(-Math.log10(selected.at(-1).close))+4));series.applyOptions({priceFormat:{type:'price',precision,minMove:10**-precision}});
  series.setData(selected.map(({time,open,high,low,close})=>({time,open,high,low,close})));
  volumeSeries.setData(selected.map(b=>({time:b.time,value:b.volume,color:b.close>=b.open?'#426f5766':'#80544766'})));
  const marked=new Map(),rows=mode==='live'?events.filter(x=>sourceSymbol(x.event)===asset+'USDT').slice().reverse().map(x=>x.event):[scene?.event];
  rows.forEach(row=>{if(!row||Date.parse(row.event_time)>selected.at(-1).closeTime||Date.parse(row.event_time)<selected[0].time*1000)return;const b=selected.filter(b=>b.time*1000<=Date.parse(row.event_time)).at(-1);if(b)marked.set(b.time,{time:b.time,position:row.side==='down'||row.side==='long'?'aboveBar':'belowBar',color:'#d5b982',shape:'circle',text:sceneTitle(row)});});
  series.setMarkers([...marked.values()].sort((a,b)=>a.time-b.time));
  if(reset)chart.timeScale().setVisibleLogicalRange({from:Math.max(0,selected.length-(mode==='live'?100:40)),to:selected.length+5});
 }else fallbackChart(selected);
 $('stage-chart-empty').hidden=true;
 const last=selected.at(-1);$('stage-price').textContent=money(mode==='live'&&number(quotes[asset]?.price)&&Date.now()-quoteAt<120000?quotes[asset].price:last.close);
 $('stage-at').textContent=at(mode==='live'?Date.now():last.closeTime);$('stage-at').dateTime=new Date(mode==='live'?Date.now():last.closeTime).toISOString();
 $('stage-chart').setAttribute('aria-label',`${asset} ${mode} ${at(selected[0].time*1000)}–${at(last.closeTime)} / ${money(last.close)} USDT / ${selected.length}`);
 if(mode!=='live'){
  const base=scene?.reference||selected[0].close,value=(last.close/base-1)*100;$('stage-delta').textContent=pct(value);$('stage-delta').className=tone(value);
  $('stage-cursor').textContent=at(last.closeTime);$('stage-scrub').value=String(cursor);renderContext();
 }else{const q=Date.now()-quoteAt<120000?quotes[asset]:null;$('stage-delta').textContent=q?pct(q.change)+' · 24h':'';$('stage-delta').className=q?tone(q.change):'';}
}
function stopPlayback(){playing=false;clearInterval(playTimer);playTimer=null;$('stage-play').textContent='▶';$('stage-play').setAttribute('aria-label',t?.play||'Play');}
function startPlayback(){
 if(mode==='live'||!bars.length||mode==='daily'&&!caseRevealed)return;stopPlayback();const max=Number($('stage-scrub').max);if(cursor>=max)cursor=Math.max(0,bars.findIndex(b=>b.closeTime>Date.parse(scene.eventAt))-8);
 playing=true;$('stage-play').textContent='Ⅱ';$('stage-play').setAttribute('aria-label',t.pause);
 playTimer=setInterval(()=>{if(document.hidden||mode==='live'){stopPlayback();return;}cursor=Math.min(max,cursor+1);draw();if(chart)chart.timeScale().scrollToPosition(5,false);if(cursor>=max)stopPlayback();},Math.max(80,700/Number($('stage-speed').value)));
}
function setReferenceLine(){if(!series||!scene?.reference)return;priceLine=series.createPriceLine({price:scene.reference,color:'#a58e5d',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:t.reference});}
function renderContext(){
 if(mode==='live'||!scene)return;const until=visibleBars().at(-1)?.closeTime||0;const rows=(scene.context||[]).filter(x=>Date.parse(x.event_time)<=until).slice().sort((a,b)=>Date.parse(a.event_time)-Date.parse(b.event_time)).slice(-4);
 $('stage-replay-context').innerHTML=rows.map(x=>`<div><time>${esc(at(x.event_time))}</time> · ${esc(sceneTitle(x))} <span>${esc(sceneDetail(x))}</span></div>`).join('')+`<p>${esc(t.snapshotOnly)}</p>`;
}
function showSceneInfo(row){
 $('stage-scene-title').textContent=row?sceneTitle(row):t.emptyScenes;$('stage-scene-detail').textContent=sceneDetail(row);$('stage-scene-time').textContent=row?at(row.event_time):'';$('stage-scene-time').dateTime=row?.event_time||'';
 $('stage-scene-kind').textContent=mode==='live'?t.latest.toUpperCase():t.record.toUpperCase();
 $('stage-scene-context').textContent=row?`${t.source}: ${row.symbol==='ALL'?'ALL futures · BTC spot reference':sourceSymbol(row)+' spot reference'}`:'';
}
async function fetchLiveBars(reset=false){
 const token=generation,chosen=asset;if(mode!=='live'||document.hidden)return;
 try{const raw=await getJSON(`https://data-api.binance.vision/api/v3/klines?symbol=${chosen}USDT&interval=5m&limit=360`,{fresh:true});if(token!==generation||mode!=='live')return;const data=parseBars(raw);if(!data.length)throw Error('No candles');bars=data;liveFetchAt=Date.now();draw(reset);$('stage-data-state').textContent=`Binance spot · 5m · ${t.quote} ${at(liveFetchAt)}`;if(asset==='BTC')renderSessions(data);}
 catch{if(token===generation)$('stage-data-state').textContent=t.unavailable;}
}
function closeSocket(){clearTimeout(wsRetry);wsRetry=null;const old=ws;ws=null;if(old){old.onclose=null;old.onmessage=null;old.close();}trades=[];particles=[];lastTradeId=null;cancelAnimationFrame(animation);animation=0;lastStreamAt=0;}
function openSocket(){
 closeSocket();if(mode!=='live'||document.hidden)return;flowSince=Date.now();const chosen=asset,token=generation;
 try{const sock=new WebSocket(`wss://stream.binance.com:9443/stream?streams=${chosen.toLowerCase()}usdt@aggTrade/${chosen.toLowerCase()}usdt@kline_5m`);ws=sock;
  sock.onopen=()=>{if(ws!==sock)return;retries=0;flowSince=Date.now();lastStreamAt=Date.now();};
  sock.onmessage=message=>{if(ws!==sock||token!==generation||mode!=='live'||document.hidden)return;let d;try{d=JSON.parse(message.data).data;}catch{return;}if(!d||d.s!==chosen+'USDT')return;lastStreamAt=Date.now();
   if(d.e==='aggTrade'){
    if(d.a===lastTradeId)return;lastTradeId=d.a;const trade={price:Number(d.p),usd:Number(d.p)*Number(d.q),buy:!d.m,at:Number(d.T),received:Date.now()};if(!Number.isFinite(trade.usd)||!Number.isFinite(trade.price)||trade.price<=0)return;
    trades.push(trade);while(trades.length>1500||trades.length&&Date.now()-trades[0].received>60000)trades.shift();
    if(Date.now()-tradeRenderAt>=250){renderTrades();tradeRenderAt=Date.now();addParticle(trade);}
   }else if(d.e==='kline'&&d.k&&bars.length){const k=d.k,b={time:Math.floor(Number(k.t)/1000),open:Number(k.o),high:Number(k.h),low:Number(k.l),close:Number(k.c),volume:Number(k.v),closeTime:Number(k.T)};if(!Object.values(b).every(Number.isFinite))return;const last=bars.at(-1);if(b.time<last.time)return;if(b.time===last.time)bars[bars.length-1]=b;else{bars.push(b);if(bars.length>400)bars.shift();}if(series){series.update({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close});volumeSeries.update({time:b.time,value:b.volume,color:b.close>=b.open?'#426f5766':'#80544766'});}else draw();$('stage-price').textContent=money(b.close);$('stage-at').textContent=at(Date.now());$('stage-data-state').textContent=`Binance spot · 5m · WS · ${at(lastStreamAt)}`;}
  };
  sock.onerror=()=>{if(ws===sock)$('stage-tape-status').textContent=t.delay;};
  sock.onclose=()=>{if(ws!==sock)return;ws=null;$('stage-tape-status').textContent=t.delay;trades=[];particles=[];lastStreamAt=0;if(mode==='live'&&!document.hidden)wsRetry=setTimeout(openSocket,Math.min(30000,1500*2**Math.min(5,retries++)));};
 }catch{$('stage-tape-status').textContent=t.unavailable;}
}
function renderTrades(){
 if(mode!=='live')return;const recent=trades.filter(x=>Date.now()-x.received<=60000);if(!recent.length){$('stage-trades').textContent=ws?.readyState===1?t.loading:t.delay;$('stage-buy-pressure').style.width='50%';return;}
 const total=recent.reduce((a,x)=>a+x.usd,0),buy=recent.filter(x=>x.buy).reduce((a,x)=>a+x.usd,0);
 $('stage-buy-pressure').style.width=(total?buy/total*100:50)+'%';$('stage-tape-status').textContent=`${t.received} ${Math.min(60,Math.floor((Date.now()-flowSince)/1000))}s · ${t.buy} ${Math.round(buy/total*100)}% · $${compact(total)}`;
 $('stage-trades').innerHTML=recent.slice(-8).reverse().map(x=>`<div class="stage-trade ${x.buy?'positive':'negative'}"><time>${esc(new Date(x.at).toLocaleTimeString(locale,{hour12:false}))}</time><b>${esc(money(x.price))}</b><span>$${esc(compact(x.usd))}</span></div>`).join('');
}
function resizeCanvas(){const el=$('stage-flow-canvas'),r=el.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);el.width=Math.round(r.width*dpr);el.height=Math.round(r.height*dpr);}
function addParticle(trade){
 if(quiet||reduced||mode!=='live'||document.hidden||particles.length>=20||!series)return;
 const y=series.priceToCoordinate(trade.price),r=$('stage-flow-canvas').getBoundingClientRect();if(y===null||y<0||y>r.height)return;
 particles.push({start:performance.now(),y,x:trade.buy?r.width*.8:r.width*.2,buy:trade.buy,r:Math.min(5,1+Math.log10(Math.max(1,trade.usd/1000)))});if(!animation)animation=requestAnimationFrame(drawParticles);
}
function drawParticles(now){
 animation=0;const canvas=$('stage-flow-canvas'),ctx=canvas.getContext('2d');if(!ctx)return;const dpr=Math.min(2,devicePixelRatio||1);ctx.setTransform(dpr,0,0,dpr,0,0);const w=canvas.width/dpr,h=canvas.height/dpr;ctx.clearRect(0,0,w,h);
 if(quiet||reduced||document.hidden||mode!=='live'){particles=[];return;}
 if(now-lastFrame<33){animation=requestAnimationFrame(drawParticles);return;}lastFrame=now;particles=particles.filter(p=>now-p.start<850);
 particles.forEach(p=>{const age=(now-p.start)/850;ctx.globalAlpha=(1-age)*.65;ctx.fillStyle=p.buy?'#80bf9f':'#d99880';ctx.beginPath();ctx.arc(p.x+(p.buy?-1:1)*age*35,p.y,p.r*(1+age*.4),0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;if(particles.length)animation=requestAnimationFrame(drawParticles);
}
function renderSessions(data){
 const groups={},runs=[];data.forEach(b=>{const h=new Date(b.time*1000+9*3600000).getUTCHours(),name=h>=8&&h<16?'asia':h>=16&&h<22?'europe':'us',last=runs.at(-1);if(last?.name===name)last.bars.push(b);else runs.push({name,bars:[b]});});runs.shift();runs.forEach(x=>groups[x.name]=x);
 $('stage-sessions').innerHTML=['asia','europe','us'].map(name=>{const r=groups[name],value=r?(r.bars.at(-1).close/r.bars[0].open-1)*100:null;return `<div><span>${esc(t[name])}</span><b class="${number(value)?tone(value):''}">${pct(value)}</b><time>${r?esc(at(r.bars[0].time*1000)):'—'}</time></div>`;}).join('');
}
async function fetchQuotes(){
 if(quoteBusy||document.hidden)return;quoteBusy=true;
 try{const symbols=['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','LINK'].map(s=>s+'USDT');const raw=await getJSON('https://data-api.binance.vision/api/v3/ticker/24hr?type=MINI&symbols='+encodeURIComponent(JSON.stringify(symbols)),{fresh:true});if(!Array.isArray(raw))throw Error('Quotes');const next={};raw.forEach(q=>{const p=Number(q.lastPrice),o=Number(q.openPrice),s=q.symbol?.replace(/USDT$/,'');if(symbolOK(s)&&p>0&&o>0)next[s]={price:p,change:(p/o-1)*100};});quotes=next;quoteAt=Date.now();
 document.querySelectorAll('[data-quote-symbol]').forEach(el=>{const q=quotes[el.dataset.quoteSymbol];el.querySelector('b').textContent=q?money(q.price):'—';el.querySelector('small').textContent=q?pct(q.change):'—';el.querySelector('small').className=q?tone(q.change):'';});
 if(mode==='live'&&quotes[asset]){$('stage-price').textContent=money(quotes[asset].price);$('stage-delta').textContent=pct(quotes[asset].change)+' · 24h';$('stage-delta').className=tone(quotes[asset].change);}
 renderSaved();renderNotes();renderReturn();fetchWon();
 }catch{document.querySelectorAll('[data-quote-symbol] small').forEach(el=>el.textContent=t.delay);}finally{quoteBusy=false;}
}
async function fetchWon(){
 try{const [raw,rate]=await Promise.all([getJSON('https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-USDT',{fresh:true}),!fx||Date.now()-fxAt>3600000?getJSON('https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW',{fresh:true}):Promise.resolve(null)]);if(rate&&number(rate.rates?.KRW)){fx={rate:Number(rate.rates.KRW),date:rate.date};fxAt=Date.now();}if(Array.isArray(raw)){raw.forEach(x=>{if(number(x.trade_price))won[x.market]=Number(x.trade_price);});wonAt=Date.now();}
 $('stage-fx').textContent=fx?money(fx.rate):'—';$('stage-fx-date').textContent=fx?.date||'—';const premium=fx&&won['KRW-BTC']&&quotes.BTC&&Date.now()-quoteAt<120000&&Date.now()-wonAt<120000?(won['KRW-BTC']/(quotes.BTC.price*fx.rate)-1)*100:null;$('stage-premium').textContent=pct(premium);$('stage-premium').className=number(premium)?tone(premium):'';
 }catch{$('stage-premium').textContent='—';$('stage-premium-source').textContent=t.delay;}
}
function renderSaved(){
 const symbols=favorites.size?[...favorites].slice(0,8):['BTC','ETH'];$('stage-saved').innerHTML=symbols.map(s=>{const q=quotes[s];return `<div class="stage-saved-row"><button type="button" data-open-asset="${s}">${favorites.has(s)?'★ ':''}${s}</button><span>${q?money(q.price):'—'}<small class="${q&&Date.now()-quoteAt<120000?tone(q.change):''}">${q&&Date.now()-quoteAt<120000?pct(q.change):'—'}</small></span></div>`;}).join('');
}
function renderReturn(){if(!prior?.at||Date.now()-prior.at<900000||Date.now()-prior.at>90*86400000)return;const changed=[...favorites].filter(s=>quotes[s]&&number(prior.prices?.[s])&&prior.prices[s]>0).map(s=>({s,p:(quotes[s].price/prior.prices[s]-1)*100})).sort((a,b)=>Math.abs(b.p)-Math.abs(a.p));if(changed[0])$('stage-return').textContent=`${t.return}: ${changed[0].s} ${pct(changed[0].p)} · ${at(prior.at)}`;}
function snapshotVisit(){if(Date.now()-quoteAt>120000||!favorites.size)return;const prices={};favorites.forEach(s=>{if(quotes[s])prices[s]=quotes[s].price;});save('tl_discovery_visit_v1',{at:quoteAt,prices});}
function toggleFavorite(){if(favorites.has(asset))favorites.delete(asset);else if(favorites.size<500)favorites.add(asset);save('tl_domestic_favorites',[...favorites]);$('stage-favorite').textContent=getFavoriteLabel();$('stage-favorite').setAttribute('aria-pressed',String(favorites.has(asset)));renderSaved();if(!storageOK)status(t.storageFail);}
function renderCandidates(){
 const chosen=watch.candidates.filter(x=>x.timeframe==='4h'&&x.stage!=='이미 많이 벌어짐');const rows=(chosen.length?chosen:watch.candidates).slice(0,5),index=['ko','en','zh','ja'].indexOf(lang);
 $('stage-report-stamp').textContent=`${t.reportAt}: ${at(watch.reportAt)}`;
 $('stage-candidates').innerHTML=rows.map(x=>`<button type="button" class="stage-candidate-row" data-candidate="${x.timeframe}:${x.symbol}"><b>${esc(x.symbol)}<small>${esc(x.timeframe)}</small></b><span>${esc(watch.stages[x.stage]?.[index]||x.stage)}<small>${number(x.distancePct)?`${esc(t.distance)} ${Number(x.distancePct).toFixed(1)}%`:''}</small></span></button>`).join('');
}
function openCandidate(key){
 const x=watch.candidates.find(x=>x.timeframe+':'+x.symbol===key);if(!x)return;const index=['ko','en','zh','ja'].indexOf(lang);$('stage-candidate-title').textContent=`${x.symbol} / ${x.timeframe}`;
 $('stage-candidate-body').innerHTML=`<p>${esc(t.reportAt)} ${esc(at(x.lastSeenAt))}</p><p>${esc(t.support)}: ${number(x.support)?money(x.support):'—'} · ${esc(t.distance)}: ${number(x.distancePct)?Number(x.distancePct).toFixed(1)+'%':'—'}</p><ol>${x.timeline.map(ev=>`<li><time>${esc(at(ev.at))}</time> · ${esc(watch.stages[ev.stage]?.[index]||ev.stage)}</li>`).join('')}</ol><p class="stage-footnote">${esc(watch.copy[lang].radarNote)}</p><button type="button" data-view-candidate="${esc(x.symbol)}">${esc(t.chart)} ↗</button><a href="/${lang}/watch/?q=${esc(x.symbol)}">${esc(t.history)} ↗</a>`;
 $('stage-candidate-dialog').showModal();
}
function renderNotes(){
 $('stage-observations').innerHTML=notes.length?notes.slice().reverse().map(n=>{const q=quotes[n.asset],change=q&&Date.now()-quoteAt<120000?(q.price/n.price-1)*100:null;return `<article class="stage-note-item"><header><button type="button" data-note-open="${esc(n.id)}">${esc(n.asset)} · ${money(n.price)}</button><button type="button" data-note-delete="${esc(n.id)}" aria-label="${esc(t.delete)}">×</button></header>${n.text?`<p>${esc(n.text)}</p>`:''}<small>${esc(t.reference)}: ${esc(at(n.sceneAt))} · ${esc(n.mode==='live'?t.live:t.replay)}</small><time>${esc(t.recordedAt)}: ${esc(at(n.recordedAt))}</time><div class="stage-note-change ${number(change)?tone(change):''}">${pct(change)} <small>${esc(t.compare)} · ${esc(t.localOnly)}</small></div></article>`;}).join(''):`<p class="stage-footnote">${esc(t.emptyNotes)}</p>`;
}
function noteReference(){const current=visibleBars().at(-1);return selectedPrice||((mode==='live'&&Date.now()-quoteAt<120000&&quotes[asset]?.price)||current?.close);}
function openNote(){const price=noteReference();if(!number(price)||price<=0){status(t.unavailable);return;}stopPlayback();noteDraft={asset,price:Number(price),mode,sceneId:scene?.id||null,sceneAt:new Date(mode==='live'?Date.now():visibleBars().at(-1).closeTime).toISOString()};$('stage-note-reference').textContent=`${asset} / ${money(price)} USDT · ${t.reference}: ${at(noteDraft.sceneAt)}`;$('stage-note-dialog').showModal();$('stage-note-input').focus();}
function saveNote(event){event.preventDefault();if(!noteDraft)return;notes.push({id:crypto.randomUUID(),...noteDraft,text:$('stage-note-input').value.trim(),recordedAt:new Date().toISOString()});noteDraft=null;notes=notes.slice(-100);save(observedKey,notes);$('stage-note-input').value='';$('stage-note-dialog').close();renderNotes();showPanel('observations');status(storageOK?t.saved:t.storageFail);}
async function fetchEvents(){
 if(eventBusy||document.hidden)return;eventBusy=true;
 try{const query=new URLSearchParams({select:'event_key,event_type,event_time,symbol,side,price,amount_usd,title,detail,tone,metadata',is_highlight:'eq.true',event_time:'gte.'+new Date(Date.now()-24*3600000).toISOString(),order:'event_time.desc',limit:'120'});const rows=await pub('market_events?'+query);if(!Array.isArray(rows))throw Error('Events');const next=await Promise.all(rows.filter(r=>typeof r.event_key==='string'&&Date.parse(r.event_time)<=Date.now()+60000).map(async row=>({id:await shortID(row.event_key),event:row,symbol:sourceSymbol(row),eventAt:row.event_time})));events=next;eventsAt=Date.now();if(mode==='live'){showSceneInfo(events[0]?.event);draw();}}
 catch{if(!events.length)$('stage-scene-title').textContent=t.unavailable;}finally{eventBusy=false;}
}
function allScenes(){const merged=new Map((archive?.scenes||[]).map(s=>[s.id,s]));events.forEach(s=>merged.set(s.id,{...merged.get(s.id),...s}));return [...merged.values()].sort((a,b)=>Date.parse(b.eventAt)-Date.parse(a.eventAt));}
async function fetchArchive(){
 if(archiveBusy||document.hidden)return;archiveBusy=true;
 try{const value=await getJSON('/data/scenes.json');if(value.schema!==1||!Array.isArray(value.scenes))throw Error('Archive');archive=value;archiveAt=Date.now();}
 catch{if(!archive)status(t.unavailable);}finally{archiveBusy=false;}
}
async function loadScene(id){
 if(!idOK(id))throw Error('Invalid scene');if(sceneCache.has(id))return sceneCache.get(id);
 try{const value=await getJSON('/data/scenes/'+id+'.json');if(value.id!==id||!Array.isArray(value.candles)||!value.event)throw Error('Scene contract');sceneCache.set(id,value);return value;}
 catch(error){const known=events.find(x=>x.id===id);if(!known)throw error;const atMs=Date.parse(known.eventAt),start=Math.floor(atMs/60000)*60000-20*60000;const raw=await getJSON(`https://data-api.binance.vision/api/v3/klines?symbol=${known.symbol}&interval=1m&startTime=${start}&endTime=${Math.min(Date.now(),start+51*60000-1)}&limit=60`,{fresh:true});const candles=raw.filter(k=>Number(k[6])<Date.now()).map(k=>[Number(k[0]),...k.slice(1,6).map(Number),Number(k[6])]);const past=candles.filter(k=>k[6]<=atMs);if(!past.length)throw error;return {...known,schema:1,reference:past.at(-1)[4],candles,context:events.filter(x=>Math.abs(Date.parse(x.eventAt)-atMs)<15*60000).map(x=>x.event),complete:false,archivedAt:null};}
}
async function openScene(id,daily=false){
 if(!idOK(id))return;const token=++generation;sceneLoading=true;stopPlayback();closeSocket();clearLines();$('stage-chart-empty').hidden=false;$('stage-chart-empty').textContent=t.loading;
 try{const value=await loadScene(id);if(token!==generation)return;const next=parseBars(value.candles);if(!next.length)throw Error('Empty scene');scene=value;asset=value.symbol.replace(/USDT$/,'');bars=next;mode=daily?'daily':'replay';caseRevealed=false;
 const cut=Date.parse(scene.eventAt),pre=bars.findLastIndex(b=>b.closeTime<=cut);cursor=Math.max(0,pre);caseReference=Number(scene.reference);caseEnd=bars.findLastIndex(b=>b.closeTime<=cut+15*60000);
 $('stage-scrub').max=String(mode==='daily'?cursor:bars.length-1);$('stage-scrub').min='0';$('stage-case-date').textContent=archive?.daily?.date||scene.eventAt.slice(0,10);$('stage-case-status').textContent=mode==='daily'?t.futureHidden:'';
 const stored=read('tl_stage_calls_v1',{}),call=stored[id];document.querySelectorAll('[data-choice]').forEach(b=>{b.disabled=!!call;b.setAttribute('aria-pressed',String(call?.choice===b.dataset.choice));});
 updateMode();showSceneInfo(scene.event);draw(true);setReferenceLine();$('stage-data-state').textContent=`${t.source}: Binance spot · 1m · ${scene.archivedAt?t.archive+' '+at(scene.archivedAt):t.partial}`;
 const url=new URL(location.href);url.searchParams.set('scene',id);if(daily)url.searchParams.set('practice','1');else url.searchParams.delete('practice');history.replaceState(null,'',url);
 if(mode==='daily'&&call)revealCase(call,false);
 }catch{if(token===generation){$('stage-chart-empty').hidden=!!bars.length;$('stage-chart-empty').textContent=t.unavailable;status(t.unavailable);if(mode==='live')openSocket();}}
 finally{if(token===generation)sceneLoading=false;}
}
async function goLive(nextAsset=asset){
 if(!symbolOK(nextAsset))return;const token=++generation;sceneLoading=false;stopPlayback();closeSocket();clearLines();mode='live';asset=nextAsset;scene=null;bars=[];caseRevealed=false;updateMode();$('stage-chart-empty').hidden=false;$('stage-chart-empty').textContent=t.loading;$('stage-trades').textContent=t.loading;showSceneInfo(events[0]?.event);
 const url=new URL(location.href);url.searchParams.delete('scene');url.searchParams.delete('practice');url.searchParams.set('asset',asset);history.replaceState(null,'',url);
 $('stage-price').textContent='—';$('stage-delta').textContent='';$('stage-at').textContent='';$('stage-data-state').textContent=t.loading;
 await fetchLiveBars(true);if(token===generation&&mode==='live'&&!document.hidden)openSocket();
}
async function dailyCase(){if(!archive)await fetchArchive();if(!archive?.daily?.id){status(t.notReady);return;}await openScene(archive.daily.id,true);}
function revealCase(call,animate=true){
 if(mode!=='daily'||!scene)return;caseRevealed=true;document.body.dataset.revealed='true';$('stage-scrub').max=String(bars.length-1);const actual=caseEnd>=0?bars[caseEnd].close:null,value=number(actual)?(actual/caseReference-1)*100:null;
 $('stage-case-status').textContent=`${t.locked} ${t.result}: ${pct(value)} · ${t.reference} ${money(caseReference)} → ${money(actual)} USDT · +15m`;
 document.querySelectorAll('[data-choice]').forEach(b=>{b.disabled=true;b.setAttribute('aria-pressed',String(b.dataset.choice===call.choice));});updateMode();if(animate){$('stage-speed').value='3';startPlayback();}else draw(true);
}
function makeCall(choice){if(mode!=='daily'||caseRevealed||!['above','below','skip'].includes(choice)||!scene?.complete||caseEnd<0){status(t.notReady);return;}const calls=read('tl_stage_calls_v1',{});if(calls[scene.id]){revealCase(calls[scene.id]);return;}const call={choice,recordedAt:new Date().toISOString(),reference:caseReference};calls[scene.id]=call;const keys=Object.keys(calls);if(keys.length>90)keys.slice(0,-90).forEach(k=>delete calls[k]);save('tl_stage_calls_v1',calls);revealCase(call);}
async function shareScene(){if(!scene?.archivedAt||!idOK(scene.id))return;const url=new URL('/'+lang+'/',location.origin);url.searchParams.set('scene',scene.id);try{await navigator.clipboard.writeText(url.href);status(t.copyDone);}catch{status(t.copyFail+' '+url.href);}}
async function languageSuggestion(){
 const known={ko:'한국어',en:'English',zh:'中文',ja:'日本語'};if(document.body.dataset.entry!=='root')return;let next=read('tl_language',null),country=false;
 if(!known[next]){const old=read('tl_country_language',null);if(old&&Date.now()-old.at<7*86400000){next=old.lang;country=old.country;}else{try{const value=await getJSON('https://api.country.is/',{fresh:true});next=value.country==='KR'?'ko':value.country==='JP'?'ja':['CN','TW','HK','MO'].includes(value.country)?'zh':'en';country=true;save('tl_country_language',{lang:next,country:true,at:Date.now()});}catch{next=navigator.language?.slice(0,2);if(!known[next])next='en';}}}
 if(next===lang||!known[next]||read('tl_locale_dismissed',false))return;const el=$('locale-suggestion');el.innerHTML=`<p>${esc(country?t.country:t.browser)}</p><a href="/${next}/" data-language="${next}">${esc(known[next])} ↗</a><button type="button" id="stage-language-dismiss" aria-label="${esc(t.dismiss)}">×</button>`;el.hidden=false;$('stage-language-dismiss').onclick=()=>{save('tl_locale_dismissed',true);el.hidden=true;};
}
function bind(){
 document.addEventListener('click',event=>{
  const button=event.target.closest('button'),anchor=event.target.closest('a[href]');
  if(anchor){const url=new URL(anchor.href,location.href);if(url.origin===location.origin&&params.get('internal')==='1')url.searchParams.set('internal','1');if(anchor.dataset.language){save('tl_language',anchor.dataset.language);if(scene?.id)url.searchParams.set('scene',scene.id);}anchor.href=url.href;}
  if(!button)return;
  if(button.dataset.mode){if(button.dataset.mode==='live')goLive();else if(button.dataset.mode==='daily')dailyCase();else{const first=allScenes()[0];if(first)openScene(first.id);else status(t.emptyScenes);}}
  if(button.dataset.asset)goLive(button.dataset.asset);
  if(button.dataset.panel)showPanel(button.dataset.panel);
  if(button.dataset.openScene)openScene(button.dataset.openScene);
  if(button.dataset.openAsset)goLive(button.dataset.openAsset);
  if(button.dataset.candidate)openCandidate(button.dataset.candidate);
  if(button.dataset.viewCandidate){$('stage-candidate-dialog').close();goLive(button.dataset.viewCandidate);}
  if(button.dataset.choice)makeCall(button.dataset.choice);
  if(button.dataset.noteDelete){notes=notes.filter(n=>n.id!==button.dataset.noteDelete);save(observedKey,notes);renderNotes();}
  if(button.dataset.noteOpen){const n=notes.find(x=>x.id===button.dataset.noteOpen);if(n){if(n.sceneId)openScene(n.sceneId);else goLive(n.asset);}}
  if(button.dataset.closeDialog)$(button.dataset.closeDialog)?.close();
 });
 $('stage-observe').onclick=openNote;$('stage-note-form').onsubmit=saveNote;$('stage-favorite').onclick=toggleFavorite;$('stage-share').onclick=shareScene;$('stage-back-live').onclick=()=>goLive();
 $('stage-play').onclick=()=>playing?stopPlayback():startPlayback();$('stage-speed').onchange=()=>{if(playing)startPlayback();};$('stage-scrub').oninput=event=>{stopPlayback();cursor=Math.min(Number(event.target.max),Math.max(0,Number(event.target.value)));draw(true);};
 $('stage-quiet').checked=quiet;$('stage-quiet').onchange=event=>{quiet=event.target.checked;save('tl_stage_quiet',quiet);particles=[];const ctx=$('stage-flow-canvas').getContext('2d');ctx?.clearRect(0,0,$('stage-flow-canvas').width,$('stage-flow-canvas').height);};
 addEventListener('storage',event=>{if(event.key==='tl_domestic_favorites'){const raw=read(event.key,[]);favorites=new Set((Array.isArray(raw)?raw:[]).filter(symbolOK));renderSaved();$('stage-favorite').textContent=getFavoriteLabel();}if(event.key===observedKey){const raw=read(observedKey,[]);if(Array.isArray(raw))notes=raw.filter(n=>n&&symbolOK(n.asset)&&number(n.price)&&n.price>0).slice(-100);renderNotes();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){snapshotVisit();stopPlayback();closeSocket();requests.forEach(c=>c.abort());}else{tick();if(mode==='live'){fetchLiveBars();openSocket();}}});
 addEventListener('pagehide',()=>{snapshotVisit();stopPlayback();closeSocket();clearInterval(tickTimer);requests.forEach(c=>c.abort());resizeObserver?.disconnect();chart?.remove();chart=null;});
 addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
}
async function tick(){
 if(document.hidden)return;
 if(Date.now()-quoteAt>30000)fetchQuotes();if(Date.now()-eventsAt>30000)fetchEvents();if(Date.now()-archiveAt>600000)fetchArchive();
 if(mode==='live'&&!sceneLoading){if(Date.now()-lastStreamAt>20000&&Date.now()-liveFetchAt>25000)fetchLiveBars();if(lastStreamAt&&Date.now()-lastStreamAt>20000)$('stage-tape-status').textContent=t.delay;renderTrades();}
}
async function init(){
 try{[config,watch]=await Promise.all([getJSON('/data/stage-config.json'),getJSON('/data/discovery.json')]);t=config.words[lang];if(!t||config.schema!==1||!config.key.startsWith('sb_publishable_'))throw Error('Config');}
 catch{$('stage-chart-empty').textContent='Data unavailable / 자료 연결 지연';return;}
 const oldHash=location.hash.slice(1);if(document.body.dataset.entry==='root'&&['desk','analysis','onchain','calendar','blind','game','market','domestic','research','strategists','chars'].includes(oldHash)){location.replace('/terminal/'+location.search+location.hash);return;}
 try{if(params.get('internal')==='1')localStorage.setItem('tapeInternal','1');else if(params.get('internal')==='0')localStorage.removeItem('tapeInternal');}catch{}
 window.TapeStage={getContext:()=>({id:scene?.id||null,title:sceneTitle(scene?.event),mode,archive:!!scene?.archivedAt}),openScene,showPanel,config,t,at,esc,getJSON,pub};
 bind();renderCandidates();renderSaved();renderNotes();languageSuggestion();ensureChart();resizeCanvas();
 fetchQuotes();const archived=fetchArchive();fetchEvents();
 if(idOK(params.get('scene'))){await archived;await openScene(params.get('scene'),params.get('practice')==='1');}
 else if(params.get('practice')==='1'){await archived;await dailyCase();if(mode==='live')await goLive('BTC');}
 else await goLive(symbolOK(params.get('asset'))?params.get('asset'):'BTC');
 tickTimer=setInterval(tick,10000);window.dispatchEvent(new Event('tl:stage-ready'));
}
init();
})();
