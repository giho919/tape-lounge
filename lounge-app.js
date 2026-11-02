const $ = id => document.getElementById(id);
const fmt = (n, d=0) => n.toLocaleString('ko-KR', {maximumFractionDigits:d, minimumFractionDigits:d});
let activeTab = document.body.dataset.entryTab || 'lounge';
const tabLive = name => activeTab === name && !document.hidden;
const SPOT_DATA_API = 'https://data-api.binance.vision/api/v3';

// ═══ 탭 ═══
// ═══ 탭별 주소 ═══
// Each tool has a static entry page; clicks keep the current application alive.
// Old fragment links remain valid for existing bookmarks and shared reports.
const TAB_SLUG = { lounge:'', domestic:'domestic', desk:'desk', analysis:'analysis', chain:'onchain', macro:'calendar', game:'blind', chars:'strategists' };
const SLUG_TAB = Object.fromEntries(Object.entries(TAB_SLUG).filter(([,v]) => v).map(([k,v]) => [v, k]));

function selectTab(t, fromHash = false) {
  if (typeof siteAnalyticsTabLeaving === 'function') siteAnalyticsTabLeaving();
  activeTab = t.dataset.tab;
  if (!fromHash) {
    const slug = TAB_SLUG[activeTab] || '';
    const rootPath = (document.documentElement.dataset.liveToolsRoot || '').replace(/\/+$/, '');
    const path = slug ? `${rootPath}/${slug}/` : (rootPath ? `${rootPath}/` : '/');
    const want = path + location.search;
    if (location.pathname + location.search + location.hash !== want) history.pushState(null, '', want);
  }
  document.querySelectorAll('.tab').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-selected', 'false'); });
  t.classList.add('on'); t.setAttribute('aria-selected', 'true');
  $('tab-lounge').classList.toggle('hidden', t.dataset.tab !== 'lounge');
  $('tab-desk').classList.toggle('hidden', t.dataset.tab !== 'desk');
  $('tab-analysis').classList.toggle('hidden', t.dataset.tab !== 'analysis');
  if (t.dataset.tab === 'analysis' && typeof window.initChartAnalysis === 'function') window.initChartAnalysis();
  $('tab-domestic').classList.toggle('hidden', t.dataset.tab !== 'domestic');
  $('tab-chars').classList.toggle('hidden', t.dataset.tab !== 'chars');
  $('tab-game').classList.toggle('hidden', t.dataset.tab !== 'game');
  $('tab-chain').classList.toggle('hidden', t.dataset.tab !== 'chain');
  $('tab-macro').classList.toggle('hidden', t.dataset.tab !== 'macro');
  if (t.dataset.tab !== 'game') {
    clearInterval(bgTimer); bgTimer = null;   // 개인 판은 정지, 스터디 판은 복귀 시 서버 시각으로 따라잡음
    if (typeof studyDisconnect === 'function') studyDisconnect();
  }
  if (t.dataset.tab === 'lounge') requestAnimationFrame(trimDeck);   // 복귀 시 실제 폭으로 덱 재정렬
  if (typeof paperLoop === 'function') paperLoop();
  if (typeof syncChat === 'function') syncChat();   // 라운지 이탈/복귀 시 채팅 회선 정리
  if (typeof siteAnalyticsTabEntered === 'function') siteAnalyticsTabEntered();
  if (typeof syncRuntimeState === 'function') syncRuntimeState();
}
document.querySelectorAll('.tab').forEach(t => {
  t.onclick = e => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); selectTab(t);
  };
  t.onkeydown = e => { if (e.key === ' ') { e.preventDefault(); selectTab(t); } };
});

// Real paths for new links; fragments take precedence for legacy links.
function applyTabFromLocation() {
  const slug = (location.hash || '').replace(/^#/, '').toLowerCase();
  const appRoot = (document.documentElement.dataset.liveToolsRoot || '').replace(/^\/+|\/+$/g, '');
  const routePath = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '');
  const pathSlug = appRoot && (routePath === appRoot || routePath.startsWith(appRoot + '/'))
    ? routePath.slice(appRoot.length).replace(/^\/+/, '')
    : routePath;
  const tabId = SLUG_TAB[slug] || SLUG_TAB[pathSlug] || 'lounge';
  if (tabId === activeTab) return;
  const t = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (t) selectTab(t, true);
}
window.addEventListener('hashchange', applyTabFromLocation);
window.addEventListener('popstate', applyTabFromLocation);
// 첫 적용은 스크립트 평가가 끝난 뒤로 미룬다 — selectTab 이 아래쪽에서 let 으로
// 선언되는 bgTimer 등을 참조하므로 즉시 호출하면 TDZ ReferenceError 로 죽는다.
setTimeout(applyTabFromLocation, 0);

// 탭 바가 좁아져 스크롤이 필요할 때만 우측 페이드 표시 — 숨겨진 스크롤바만으론
// 오른쪽에 탭이 더 있다는 게 안 보여서(scrollbar-width:none) 대부분 라운지에만 머문 원인 중 하나였다.
(() => {
  const wrap = document.querySelector('.tabsWrap'), bar = document.querySelector('.tabs');
  if (!wrap || !bar) return;
  const update = () => wrap.classList.toggle('scrollable', bar.scrollWidth - bar.scrollLeft - bar.clientWidth > 4);
  bar.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// ═══ 라이브 차트 (lightweight-charts) ═══
const MA_DEFS = [[5, '#f6d365'], [20, '#ff9f43'], [60, '#4ade80'], [120, '#38bdf8'], [200, '#c084fc']];
const ST_PERIOD = 10, ST_MULTIPLIER = 3;
const ST_UP = '#4ade80', ST_DOWN = '#f87171';
document.querySelectorAll('[data-indicator-legend]').forEach(el => {
  el.innerHTML = `<span class="maLgd">SMA ${MA_DEFS.map(([p,c])=>`<b style="color:${c}">${p}</b>`).join(' ')}</span><span class="stLegend" title="Supertrend · Wilder ATR ${ST_PERIOD}, 배수 ${ST_MULTIPLIER}. 진행 중인 봉의 값은 바뀔 수 있습니다.">Supertrend ${ST_PERIOD} × ${ST_MULTIPLIER} · <span class="up">상승</span> / <span class="dn">하락</span> (점선)</span>`;
});
// Causal Wilder ATR + trailing HL2 bands. Initial ATR is the mean of the first N true ranges.
// A live candle is always recalculated from the preceding candle, never from its own last tick.
function supertrendStep(prev, bar, period = ST_PERIOD, multiplier = ST_MULTIPLIER) {
  const tr = prev ? Math.max(bar.high-bar.low,Math.abs(bar.high-prev.close),Math.abs(bar.low-prev.close)) : bar.high-bar.low;
  const count = (prev?.count || 0) + 1, sum = count <= period ? (prev?.sum || 0) + tr : 0;
  const atr = count < period ? null : count === period ? sum/period : (prev.atr*(period-1)+tr)/period;
  const state = {time:bar.time,close:bar.close,count,sum,atr,upper:null,lower:null,direction:1,value:null};
  if (atr === null) return state;
  const middle = (bar.high+bar.low)/2, upper = middle+multiplier*atr, lower = middle-multiplier*atr;
  state.upper = prev?.atr == null || upper < prev.upper || prev.close > prev.upper ? upper : prev.upper;
  state.lower = prev?.atr == null || lower > prev.lower || prev.close < prev.lower ? lower : prev.lower;
  state.direction = prev?.atr == null ? 1 : prev.direction === 1 ? (bar.close > state.upper ? -1 : 1) : (bar.close < state.lower ? 1 : -1);
  state.value = state.direction === -1 ? state.lower : state.upper;
  return state;
}
function supertrendPoint(state) {
  return state.value === null ? {time:state.time} : {time:state.time,value:state.value,color:state.direction===-1?ST_UP:ST_DOWN};
}
function makeSupertrend(ch) {
  return {series:ch.addLineSeries({color:ST_UP,lineWidth:2,lineStyle:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}),before:null,last:null,data:[]};
}
function pushSupertrend(st, bar) {
  if (st.last && bar.time < st.last.time) return null;
  const same = st.last?.time === bar.time, prev = same ? st.before : st.last;
  const next = supertrendStep(prev,bar), point = supertrendPoint(next);
  if (same) st.data[st.data.length-1] = point;
  else { st.before = st.last; st.data.push(point); }
  st.last = next;
  let redraw = false;
  const prior = st.data[st.data.length-2];
  if (prior && prev?.value !== null && prev?.value !== undefined) {
    // LWC 4.2 uses each point's color for the outgoing segment. Hide only the trend-flip bridge.
    const color = prev.direction !== next.direction ? 'transparent' : prev.direction===-1?ST_UP:ST_DOWN;
    redraw = prior.color !== color; prior.color = color;
  }
  if (st.data.length > 2000) { st.data.shift(); redraw = true; }
  return {point,redraw};
}
function seedSupertrend(st, bars) {
  st.before = st.last = null; st.data = [];
  bars.forEach(bar => pushSupertrend(st,bar));
  st.series.setData(st.data);
}
function tickSupertrend(st, bar) {
  const changed = pushSupertrend(st,bar);
  if (!changed) return;
  if (changed.redraw) st.series.setData(st.data);
  else st.series.update(changed.point);
}
// EMA uses SMA seeds; RSI uses Wilder's mean of the first 14 close changes.
function oscillatorStep(prev, bar) {
  const count=(prev?.count||0)+1, sum=count<=26?(prev?.sum||0)+bar.close:0;
  const fast=count<12?null:count===12?sum/12:prev.fast+(bar.close-prev.fast)*2/13;
  const slow=count<26?null:count===26?sum/26:prev.slow+(bar.close-prev.slow)*2/27;
  const macd=slow===null?null:fast-slow, signalCount=Math.max(0,count-25);
  const signalSum=signalCount>0&&signalCount<=9?(prev?.signalSum||0)+macd:0;
  const signal=signalCount<9?null:signalCount===9?signalSum/9:prev.signal+(macd-prev.signal)*.2;
  const hist=signal===null?null:macd-signal;
  const delta=prev?bar.close-prev.close:0,gain=Math.max(0,delta),loss=Math.max(0,-delta);
  const gainSum=count<=15?(prev?.gainSum||0)+gain:0,lossSum=count<=15?(prev?.lossSum||0)+loss:0;
  const avgGain=count<15?null:count===15?gainSum/14:(prev.avgGain*13+gain)/14;
  const avgLoss=count<15?null:count===15?lossSum/14:(prev.avgLoss*13+loss)/14;
  const rsi=avgGain===null?null:avgGain===0&&avgLoss===0?50:avgLoss===0?100:100-100/(1+avgGain/avgLoss);
  const histColor=hist===null?'transparent':hist>=0?(hist>=(prev?.hist??0)?'#26a69a':'#80cbc4'):(hist<=(prev?.hist??0)?'#ef5350':'#ef9a9a');
  return {time:bar.time,close:bar.close,count,sum,fast,slow,macd,signalCount,signalSum,signal,hist,histColor,gainSum,lossSum,avgGain,avgLoss,rsi};
}
function oscillatorPoints(state) {
  return ['macd','signal','hist','rsi'].map(key=>state[key]===null?{time:state.time}:{time:state.time,value:state[key],...(key==='hist'?{color:state.histColor}:{})});
}
function oscillatorLabels(osc) {
  const val=x=>x===null||x===undefined?'—':x.toFixed(2),s=osc.last;
  osc.macdValue.textContent='MACD '+val(s?.macd);
  osc.signalValue.textContent='Signal '+val(s?.signal);
  osc.histValue.textContent='Hist '+val(s?.hist);
  osc.rsiValue.textContent=val(s?.rsi);
}
function seedOscillators(osc,bars) {
  osc.suspend=true;osc.before=osc.last=null;
  const data=[[],[],[],[]];
  bars.forEach(bar=>{osc.before=osc.last;osc.last=oscillatorStep(osc.last,bar);oscillatorPoints(osc.last).forEach((p,i)=>data[i].push(p));});
  osc.series.forEach((s,i)=>s.setData(data[i]));
  oscillatorLabels(osc);osc.suspend=false;
}
function tickOscillators(osc,bar) {
  if(osc.last&&bar.time<osc.last.time)return;
  const same=osc.last?.time===bar.time,prev=same?osc.before:osc.last;
  if(!same)osc.before=osc.last;
  osc.last=oscillatorStep(prev,bar);
  osc.suspend=true;oscillatorPoints(osc.last).forEach((p,i)=>osc.series[i].update(p));osc.suspend=false;
  oscillatorLabels(osc);
}
function makeOscillators(main,priceSeries,el,blind=false) {
  const parent=el.parentElement,frame=document.createElement('div');frame.className='priceChartFrame';
  el.before(frame);frame.append(el);
  const watermark=parent.querySelector(':scope > .chartWatermark');if(watermark)frame.append(watermark);
  const host=document.createElement('div');host.className='oscillators';frame.after(host);
  host.innerHTML='<section class="oscPane" aria-label="MACD 지표"><div class="oscHead"><b>MACD <small>12 · 26 · 9</small></b><span class="oscValues" title="현재 봉 · 마감 전 변동 가능"><span data-value="macd" style="color:#38bdf8"></span><span data-value="signal" style="color:#ff9f43"></span><span data-value="hist"></span></span></div><div class="oscMacd"></div></section><section class="oscPane" aria-label="RSI 지표"><div class="oscHead"><b>RSI <small>14 · Wilder · 30 / 70</small></b><span class="oscValues" data-value="rsi" style="color:#c084fc" title="현재 봉 · 마감 전 변동 가능"></span></div><div class="oscRsi"></div></section>';
  const make=(node,timeVisible)=>LightweightCharts.createChart(node,{
    width:el.clientWidth,height:132,layout:{background:{color:'#12151c'},textColor:'#6b7280',fontSize:10},
    grid:{vertLines:{color:'#1a1f2b'},horzLines:{color:'#1a1f2b'}},crosshair:{mode:0},
    rightPriceScale:{borderColor:'#232838',minimumWidth:70},
    timeScale:{visible:timeVisible,borderColor:'#232838',timeVisible:true,secondsVisible:false,rightOffset:CHART_RIGHT_PAD,fixLeftEdge:true,minBarSpacing:.6,shiftVisibleRangeOnNewBar:false},
    handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
    handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:false},axisDoubleClickReset:true}
  });
  const macdCh=make(host.querySelector('.oscMacd'),false),rsiCh=make(host.querySelector('.oscRsi'),!blind);
  main.applyOptions({rightPriceScale:{minimumWidth:70},timeScale:{visible:false}});
  const line={lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:'price',precision:2,minMove:.01}};
  const hist=macdCh.addHistogramSeries({...line}),macd=macdCh.addLineSeries({...line,color:'#38bdf8'}),signal=macdCh.addLineSeries({...line,color:'#ff9f43'});
  macd.createPriceLine({price:0,color:'#536070',lineWidth:1,lineStyle:2,axisLabelVisible:false});
  const rsi=rsiCh.addLineSeries({...line,color:'#c084fc',lineWidth:2,autoscaleInfoProvider:()=>({priceRange:{minValue:0,maxValue:100}})});
  rsiCh.priceScale('right').applyOptions({scaleMargins:{top:0,bottom:0}});
  [30,50,70].forEach(price=>rsi.createPriceLine({price,color:price===50?'#354050':'#6b597d',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:''}));
  const osc={charts:[main,macdCh,rsiCh],series:[macd,signal,hist,rsi],before:null,last:null,suspend:false,host,
    macdValue:host.querySelector('[data-value="macd"]'),signalValue:host.querySelector('[data-value="signal"]'),histValue:host.querySelector('[data-value="hist"]'),rsiValue:host.querySelector('[data-value="rsi"]')};
  let syncing=false;
  osc.syncRange=(source=main)=>{
    if(syncing||osc.suspend||!osc.last)return;
    const range=source.timeScale().getVisibleLogicalRange();if(!range)return;
    syncing=true;
    try{osc.charts.forEach(ch=>{if(ch===source)return;const r=ch.timeScale().getVisibleLogicalRange();if(!r||Math.abs(r.from-range.from)>.001||Math.abs(r.to-range.to)>.001)ch.timeScale().setVisibleLogicalRange(range);});}
    finally{syncing=false;}
  };
  osc.charts.forEach(ch=>ch.timeScale().subscribeVisibleLogicalRangeChange(()=>osc.syncRange(ch)));
  // Shared crosshair, including a price-candle fallback while an oscillator is warming up.
  let crossSync=false;const anchors=[priceSeries,macd,rsi];
  osc.charts.forEach((ch,i)=>ch.subscribeCrosshairMove(param=>{
    if(crossSync)return;crossSync=true;
    try{osc.charts.forEach((other,j)=>{if(i===j)return;const point=param.logical==null?null:anchors[j].dataByIndex(param.logical);const value=point?.value??point?.close;
      if(param.time!=null&&value!==undefined)other.setCrosshairPosition(value,param.time,anchors[j]);else other.clearCrosshairPosition();});}
    finally{crossSync=false;}
  }));
  osc.resize=()=>{
    if(!el.clientWidth)return;
    const range=main.timeScale().getVisibleLogicalRange();osc.suspend=true;
    macdCh.resize(el.clientWidth,132);rsiCh.resize(el.clientWidth,132);
    const axisWidth=Math.max(70,...osc.charts.map(ch=>ch.priceScale('right').width()));
    osc.charts.forEach(ch=>ch.applyOptions({rightPriceScale:{minimumWidth:axisWidth}}));
    osc.suspend=false;if(range)main.timeScale().setVisibleLogicalRange(range);osc.syncRange();
  };
  new ResizeObserver(osc.resize).observe(el);
  oscillatorLabels(osc);return osc;
}
const LOUNGE_KL_LIMIT = 1000;      // Binance klines 1회 요청 상한
const CHART_RIGHT_PAD = 10;        // 최신 캔들이 가격축에 붙지 않도록 오른쪽에 비워 둘 봉 수
const LOUNGE_VIEW_BARS = 160;      // 처음 보여줄 캔들 수 (나머지는 왼쪽으로 밀어 두고 탐색)

// 사용자가 과거를 들여다보는 중이면 실시간 갱신이 화면을 끌고 가지 않도록 한다
// 새 봉이 붙을 때만 개수를 올린다 (같은 봉 갱신은 그대로)
function chartBumpBars(chart, timeSec) {
  if (timeSec <= chart.lastT) return false;
  chart.bars += 1; chart.lastT = timeSec;
  return true;
}
// 오른쪽 끝까지 밀어 둔 상태의 scrollPosition은 0이 아니라 rightOffset이다
function chartAtRightEdge(ch) {
  const pos = ch.timeScale().scrollPosition();
  return typeof pos !== 'number' || pos >= CHART_RIGHT_PAD - 1.5;
}
// 새로 붙은 봉 수만큼 보이는 범위를 그대로 옮긴다. scrollToRealTime은 애니메이션이
// 붙어 있어 자동 밀림과 겹치면 흔들리므로 쓰지 않는다.
function chartFollowBars(ch, n) {
  if (!n) return;
  const r = ch.timeScale().getVisibleLogicalRange();
  if (!r) return;
  ch.timeScale().setVisibleLogicalRange({ from: r.from + n, to: r.to + n });
}
function chartShowRecent(ch, total, bars = LOUNGE_VIEW_BARS) {
  const to = total - 1 + CHART_RIGHT_PAD;
  if (total > bars) ch.timeScale().setVisibleLogicalRange({ from: to - bars, to });
  else ch.timeScale().fitContent();
}
// 오른쪽 여백은 rightOffset이 만든다. 라이브러리가 스크롤을 rightOffset까지만
// 허용하므로 별도 제한 장치는 필요 없다. fixRightEdge를 함께 켜면 마지막 캔들이
// 축에 붙어 버려 여백이 사라지므로 쓰지 않는다.
function makeChart(elId) {
  const el = $(elId);
  const ch = LightweightCharts.createChart(el, {
    layout: { background: { color: '#12151c' }, textColor: '#6b7280', fontSize: 10 },
    grid: { vertLines: { color: '#1a1f2b' }, horzLines: { color: '#1a1f2b' } },
    crosshair: { mode: 0 },
    rightPriceScale: { borderColor: '#232838' },
    timeScale: {
      borderColor: '#232838', timeVisible: true, secondsVisible: false, rightOffset: CHART_RIGHT_PAD,
      fixLeftEdge: true,
      // 새 봉마다 화면이 저절로 밀리면 과거를 보는 중에도 끌려간다. 따라가기는 직접 한다
      shiftVisibleRangeOnNewBar: false,
      minBarSpacing: 0.6,
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: true },
  });
  const s = ch.addCandlestickSeries({
    upColor: '#4ade80', downColor: '#f87171', borderVisible: false,
    wickUpColor: '#4ade80', wickDownColor: '#f87171',
  });
  const ma = MA_DEFS.map(([p, c]) => ch.addLineSeries({
    color: c, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
  }));
  const vol = ch.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '', priceLineVisible: false, lastValueVisible: false });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });   // 하단 16% 오버레이
  new ResizeObserver(() => ch.applyOptions({ width: el.clientWidth })).observe(el);
  const chart = { ch, s, ma, vol, st:makeSupertrend(ch), osc:makeOscillators(ch,s,el), bars: 0, lastT: -Infinity };
  if (elId === 'c_btc' && window.BtcLongChannel) chart.longChannel = window.BtcLongChannel.attach(ch);
  return chart;
}
const volColor = (o, c) => c >= o ? 'rgba(74,222,128,.55)' : 'rgba(248,113,113,.55)';
function seedMA(chart, closes, times) {
  MA_DEFS.forEach(([p], mi) => {
    const data = [];
    let sum = 0;
    for (let j = 0; j < closes.length; j++) {
      sum += closes[j];
      if (j >= p) sum -= closes[j - p];
      if (j >= p - 1) data.push({ time: times[j], value: sum / p });
    }
    chart.ma[mi].setData(data);
  });
}
const LOUNGE_CHART_IDS = ['c_btc','c_eth','c_dom','c_qqq'];
const loungeCharts = [null, null, null, null];
let chartSeed = [null, null, null, null], chartLive = [null, null, null, null];
function chartOf(i) { return loungeCharts[i]; }
function hydrateLoungeChart(i) {
  const chart = chartOf(i), kl = chartSeed[i];
  if (!chart || !kl?.length) return;
  chart.bars = kl.length; chart.lastT = kl[kl.length - 1][0] / 1000;
  chart.osc.suspend=true;
  chart.s.setData(kl.map(k => ({ time:k[0]/1000, open:+k[1], high:+k[2], low:+k[3], close:+k[4] })));
  if (chart.longChannel) window.BtcLongChannel.seed(chart.longChannel,kl.map(k=>k[0]/1000),chartTf);
  chart.vol.setData(kl.map(k => ({ time:k[0]/1000, value:+k[5], color:volColor(+k[1],+k[4]) })));
  seedMA(chart, kl.map(k=>+k[4]), kl.map(k=>k[0]/1000));
  seedSupertrend(chart.st,kl.map(k=>({time:k[0]/1000,high:+k[2],low:+k[3],close:+k[4]})));
  seedOscillators(chart.osc,kl.map(k=>({time:k[0]/1000,close:+k[4]})));
  const live = chartLive[i];
  if (live && live.t/1000 >= chart.lastT) {
    chartBumpBars(chart, live.t / 1000);
    chart.s.update({ time:live.t/1000, open:+live.o, high:+live.h, low:+live.l, close:+live.c });
    if (chart.longChannel) window.BtcLongChannel.tick(chart.longChannel,live.t/1000);
    chart.vol.update({ time:live.t/1000, value:+live.v, color:volColor(+live.o,+live.c) });
    maTick(i,live);
    tickSupertrend(chart.st,{time:live.t/1000,high:+live.h,low:+live.l,close:+live.c});
    tickOscillators(chart.osc,{time:live.t/1000,close:+live.c});
  }
  chartShowRecent(chart.ch, chart.bars);
  chart.osc.syncRange();
}
function ensureLoungeChart(i) {
  if (!loungeCharts[i]) {
    loungeCharts[i] = makeChart(LOUNGE_CHART_IDS[i]);
    if (i === 0) watchBtcMarkerZoom(loungeCharts[i]);
    hydrateLoungeChart(i);
    if (!chartSeed[i]) seedChart(i).then(() => {
      if (i === 0) { refreshComboMarkers(); refreshCandleGrades(); refreshTreasureLevels(); renderBtcMarkers(); }
      if (i === caroIdx) reseedDeck();
    });
  }
  return loungeCharts[i];
}
// 차트 마커는 고래와 청산만 남긴다. 캔들 등급·콤보·보물상자는 HUD 칩에서 계속 보여준다.
let liquidationMarkers = [];
const whaleBuckets = new Map();

// 마커는 어느 배율에서든 그대로 남는다. 예전에는 봉이 좁아지면 등급 낮은 마커를 통째로
// 숨겨서 확대·축소할 때마다 보였다 안 보였다 했다. 지금은 점은 항상 두고, 라벨만 금액이
// 큰 것부터 자리를 잡는다 — 축소해도 큰 건은 숫자를 유지하고, 확대하면 틈이 벌어지면서
// 작은 것들의 숫자가 더해질 뿐 이미 있던 숫자가 사라지지 않는다.
const MARKER_LABEL_PX = 96;    // 라벨 하나가 가로로 차지하는 대략적 폭
function renderBtcMarkers() {
  const chart = chartOf(0); if (!chart) return;
  // 고래도 청산과 같은 방식으로 실제 캔들에 맞춘다. 예전에는 분 단위 키라 1분봉에서만 보였다.
  const whaleBars = new Map();
  const addWhale = (time, buy, sell, count) => {
    if (time === null) return;
    const cur = whaleBars.get(time) || { time, buy:0, sell:0, count:0 };
    cur.buy += buy; cur.sell += sell; cur.count += count;
    whaleBars.set(time, cur);
  };
  // 접속 전 기록(장부)과 접속 후 실시간 기록을 같은 캔들 위에서 합친다.
  whaleLedger.forEach(w => addWhale(snapToBar(w.at), w.buy ? w.usd : 0, w.buy ? 0 : w.usd, 1));
  whaleBuckets.forEach(w => addWhale(snapToBar(w.time * 1000), w.buy, w.sell, w.count));
  const whales = [...whaleBars.values()].map(w => {
    const buy = w.buy >= w.sell, total = w.buy + w.sell;
    return { time:w.time, position:buy?'belowBar':'aboveBar', color:buy?'#4ade80':'#f87171', shape:'circle',
             weight:total, text:`🐋 ${moneyShort(total)}${w.count>1?' ×'+w.count:''}` };
  });
  const all = [...liquidationMarkers, ...whales, ...macroMarkers].sort((a, b) => a.time - b.time);
  const ts = chart.ch.timeScale(), labeled = new Set(), taken = [];
  for (const m of [...all].sort((a, b) => (b.weight || 0) - (a.weight || 0))) {
    const x = ts.timeToCoordinate(m.time);   // 화면 밖이면 null
    if (x === null || taken.some(t => Math.abs(t - x) < MARKER_LABEL_PX)) continue;
    taken.push(x); labeled.add(m);
  }
  chart.s.setMarkers(all.map(m => labeled.has(m) ? m : { ...m, text: '' }));
}
// 확대·이동하면 들어갈 수 있는 라벨 수가 달라지므로 프레임 단위로 다시 그린다
let btcMarkerRaf = null;
function watchBtcMarkerZoom(chart) {
  chart.ch.timeScale().subscribeVisibleLogicalRangeChange(() => {
    if (btcMarkerRaf) return;
    btcMarkerRaf = requestAnimationFrame(() => { btcMarkerRaf = null; renderBtcMarkers(); });
  });
}

// 캐러셀 (BTC / ETH / BTC.D / NASDAQ)
let caroIdx = 0;
function caroGo(i) {
  caroIdx = (i + 4) % 4;
  document.querySelectorAll('.caroPage').forEach(p => p.classList.toggle('hidden', +p.dataset.p !== caroIdx));
  document.querySelectorAll('.ct2').forEach(t => t.classList.toggle('on', +t.dataset.c === caroIdx));
  const el = document.querySelectorAll('.caroPage')[caroIdx].querySelector('.chart');
  const chart = ensureLoungeChart(caroIdx);
  requestAnimationFrame(() => {
    const w = el.clientWidth, h = el.clientHeight || 460;
    chart.ch.resize(w, h);
    chart.osc.resize();
    if (chartAtRightEdge(chart.ch)) chartShowRecent(chart.ch, chart.bars);
  });
  if (typeof reseedDeck === 'function') reseedDeck();   // 덱은 선택된 차트를 따라감
}
function caroMove(d) { caroGo(caroIdx + d); }
window.caroGo = caroGo; window.caroMove = caroMove;

let dayOpen = null, ethOpen = null, qqqOpen = null;
function updateHomeQuote(px, chg) {
  const priceEl = $('homeBtcPrice'), changeEl = $('homeBtcChange');
  if (priceEl && Number.isFinite(px) && px > 0) priceEl.textContent = fmt(px, 1);
  if (changeEl && Number.isFinite(chg)) {
    changeEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
    changeEl.className = 'num ' + (chg >= 0 ? 'up' : 'dn');
  }
}
// 장대/돌파·베팅 판정용 1분봉 이력 시딩 (BTC 고정 — 이펙트는 항상 1분 기준)
// REST 실패는 실시간 스트림까지 중단시키지 않고 조용히 건너뛴다.
(async () => {
  try {
    const quoteResponse = await fetch(`${SPOT_DATA_API}/ticker/24hr?symbol=BTCUSDT`);
    if (!quoteResponse.ok) return;
    const d = await quoteResponse.json();
    const open = +d.openPrice, last = +d.lastPrice, change = +d.priceChangePercent;
    if (Number.isFinite(open)) dayOpen = open;
    if (Number.isFinite(last) && Number.isFinite(change)) updateHomeQuote(last, change);
    const candleResponse = await fetch(`${SPOT_DATA_API}/klines?symbol=BTCUSDT&interval=1m&limit=61`);
    if (!candleResponse.ok) return;
    const kl = await candleResponse.json();
    if (!Array.isArray(kl)) return;
    kl.slice(0, -1).forEach(k => {
      bodyHist.push(Math.abs(+k[4]-+k[1])/+k[1]*100);
      hiHist.push(+k[2]); loHist.push(+k[3]);
    });
    while (bodyHist.length > 30) bodyHist.shift();
  } catch(e) {}
})();
(async () => { try { const r=await fetch(`${SPOT_DATA_API}/ticker/24hr?symbol=ETHUSDT`);if(r.ok){const n=+(await r.json()).openPrice;if(Number.isFinite(n))ethOpen=n;} } catch(e) {} })();
(async () => { try { const r=await fetch(`${SPOT_DATA_API}/ticker/24hr?symbol=QQQBUSDT`);if(r.ok){const n=+(await r.json()).openPrice;if(Number.isFinite(n))qqqOpen=n;} } catch(e) {} })();

// ═══ 타임프레임 공용 차트 피드 (4차트 + 캔들 덱) ═══
const TF_LABEL = { '1m':'1분', '15m':'15분', '1h':'60분', '4h':'240분', '1d':'일봉', '1w':'주봉', '1M':'월봉' };
const entryChartTf = document.body.dataset.entryTab === 'lounge' ? new URLSearchParams(location.search).get('tf') : null;
let chartTf = Object.hasOwn(TF_LABEL, entryChartTf) ? entryChartTf : '1m';
document.querySelectorAll('.tfb').forEach(b => b.classList.toggle('on', b.dataset.tf === chartTf));
const CHART_SYMS = [
  { sym: 'BTCUSDT',    spot: true,  name: 'BTC' },
  { sym: 'ETHUSDT',    spot: true,  name: 'ETH' },
  { sym: 'BTCDOMUSDT', spot: false, name: 'BTC.D' },
  { sym: 'QQQBUSDT',   spot: true,  name: 'NASDAQ' },
];
let lastBtcKt = null, lastBtcClose = null, lastBtcClosedTime = null;
const treasure = { high:null, low:null, highLine:null, lowLine:null, highOpen:false, lowOpen:false };

function closedBtcBars() {
  const seed = chartSeed[0] || [];
  if (!seed.length) return [];
  const last = seed[seed.length-1];
  const lastIsClosed = lastBtcClosedTime === last[0] || (lastBtcKt !== null && last[0] < lastBtcKt);
  return seed.slice(0, lastIsClosed ? seed.length : -1);
}
function candleGrade(bodyPct, avgBody) {
  const ratio = avgBody > 0 ? bodyPct/avgBody : 1;
  return ratio >= 3.2 ? {tier:'epic',label:'EPIC',ratio} : ratio >= 2 ? {tier:'rare',label:'RARE',ratio} : ratio >= 1.3 ? {tier:'uncommon',label:'UNCOMMON',ratio} : {tier:'common',label:'COMMON',ratio};
}
function refreshComboMarkers() {
  const bars = closedBtcBars().slice(-80);
  let dir = 0, streak = 0;
  for (const k of bars) {
    const next = +k[4] > +k[1] ? 1 : +k[4] < +k[1] ? -1 : 0;
    if (!next) { dir = 0; streak = 0; continue; }
    if (next === dir) streak++;
    else { dir = next; streak = 1; }
  }
  $('comboHud').textContent = streak >= 2 ? `COMBO · ${streak} ${dir>0?'UP':'DOWN'}` : 'COMBO · —';
  $('comboHud').classList.toggle('hot', streak >= 3);
}
function refreshCandleGrades() {
  const bars = closedBtcBars().slice(-100), bodies = [];
  let latest = null;
  for (const k of bars) {
    const bodyPct = Math.abs(+k[4]-+k[1]) / +k[1] * 100;
    const avgBody = bodies.length ? bodies.reduce((a,b)=>a+b,0)/bodies.length : bodyPct;
    latest = candleGrade(bodyPct, avgBody);
    bodies.push(bodyPct); if (bodies.length > 30) bodies.shift();
  }
  $('gradeHud').textContent = latest ? `CANDLE · ${latest.label}` : 'CANDLE · —';
  $('gradeHud').classList.toggle('hot', latest?.tier === 'rare' || latest?.tier === 'epic');
}
function clearTreasureLines() {
  const chart = chartOf(0); if (!chart) return;
  if (treasure.highLine) chart.s.removePriceLine(treasure.highLine);
  if (treasure.lowLine) chart.s.removePriceLine(treasure.lowLine);
  treasure.highLine = treasure.lowLine = null;
}
function refreshTreasureLevels() {
  const bars = closedBtcBars().slice(-40);
  if (bars.length < 10) return;
  clearTreasureLines();
  const highBar = bars.reduce((a,b) => +b[2] > +a[2] ? b : a);
  const lowBar = bars.reduce((a,b) => +b[3] < +a[3] ? b : a);
  treasure.high = +highBar[2]; treasure.low = +lowBar[3];
  treasure.highOpen = treasure.lowOpen = false;
  const chart = chartOf(0); if (!chart) return;
  treasure.highLine = chart.s.createPriceLine({ price:treasure.high, color:'rgba(212,175,55,.65)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'🧰 HIGH' });
  treasure.lowLine = chart.s.createPriceLine({ price:treasure.low, color:'rgba(34,211,238,.55)', lineWidth:1, lineStyle:2, axisLabelVisible:true, title:'🧰 LOW' });
  $('chestHud').textContent = `🧰 ${fmt(treasure.low,0)} ↔ ${fmt(treasure.high,0)}`;
}
function openTreasure(side, k) {
  const isHigh = side === 'high', bars = closedBtcBars().slice(-30);
  const avgVol = bars.length ? bars.reduce((s,b)=>s + +b[5],0)/bars.length : 0;
  const volRatio = avgVol ? +k.v/avgVol : 1;
  const rank = volRatio >= 2.5 ? '💎 DIAMOND' : volRatio >= 1.5 ? '🥇 GOLD' : '🥉 BRONZE';
  const chart = chartOf(0);
  if (isHigh) { treasure.highOpen = true; if (treasure.highLine && chart) chart.s.removePriceLine(treasure.highLine); treasure.highLine = null; }
  else { treasure.lowOpen = true; if (treasure.lowLine && chart) chart.s.removePriceLine(treasure.lowLine); treasure.lowLine = null; }
  $('chestHud').textContent = `OPEN · ${rank}`;
  $('chestHud').classList.add('hot'); setTimeout(()=>$('chestHud').classList.remove('hot'), 1800);
  renderBtcMarkers();
}
function checkTreasure(k) {
  if (treasure.high && !treasure.highOpen && +k.h >= treasure.high) openTreasure('high', k);
  if (treasure.low && !treasure.lowOpen && +k.l <= treasure.low) openTreasure('low', k);
}
let whaleMarkerTimer = null;
function recordWhaleFootprint(val, isBuy, tradeTime) {
  const time = Math.floor(tradeTime/60000)*60;
  const w = whaleBuckets.get(time) || {time,buy:0,sell:0,count:0};
  if (isBuy) w.buy += val; else w.sell += val;
  w.count++; whaleBuckets.set(time, w);
  while (whaleBuckets.size > 60) whaleBuckets.delete(whaleBuckets.keys().next().value);
  $('whaleHud').textContent = `🐋 ${isBuy?'BUY':'SELL'} ${moneyShort(val)}`;
  $('whaleHud').classList.add('hot'); setTimeout(()=>$('whaleHud').classList.remove('hot'), 1400);
  if (!whaleMarkerTimer) whaleMarkerTimer = setTimeout(() => {
    whaleMarkerTimer = null;
    renderBtcMarkers();
  }, 500);
}

const chartSeedGeneration = [0,0,0,0];
async function seedChart(i) {
  const cs = CHART_SYMS[i], tf = chartTf, generation = ++chartSeedGeneration[i];
  try {
    const base = cs.spot ? SPOT_DATA_API : 'https://fapi.binance.com/fapi/v1';
    const kl = await (await fetch(`${base}/klines?symbol=${cs.sym}&interval=${tf}&limit=${LOUNGE_KL_LIMIT}`)).json();
    if (tf !== chartTf || generation !== chartSeedGeneration[i]) return;
    if (!Array.isArray(kl) || !kl.length) throw new Error('bad');
    chartSeed[i] = kl; hydrateLoungeChart(i);
    if (i === 2 && kl.length) $('domPx').textContent = fmt(+kl[kl.length - 1][4], 1);
  } catch(e) { if (tf === chartTf && generation === chartSeedGeneration[i]) chartSeed[i] = null; }
}
async function seedAll() {
  const targets = loungeCharts.map((chart,i)=>chart?i:null).filter(i=>i!==null);
  await Promise.all(targets.map(seedChart));
  refreshComboMarkers();
  refreshCandleGrades();
  refreshTreasureLevels();
  renderBtcMarkers();
}

let wsChart = null, wsChartF = null;
function connectChartWS() {
  if (!tabLive('lounge')) return;
  if (wsChart) { wsChart.onmessage = null; try { wsChart.close(); } catch(e) {} }
  if (wsChartF) { wsChartF.onmessage = null; try { wsChartF.close(); } catch(e) {} }
  const tf = chartTf;
  wsChart = new WebSocket(`wss://stream.binance.com:9443/stream?streams=btcusdt@kline_${tf}/ethusdt@kline_${tf}/qqqbusdt@kline_${tf}`);
  wsChart.onmessage = ev => { if (!tabLive('lounge')) return; const { stream, data } = JSON.parse(ev.data); handleChartK(stream, data.k); };
  wsChartF = new WebSocket(`wss://fstream.binance.com/stream?streams=btcdomusdt@kline_${tf}`);
  wsChartF.onmessage = ev => { if (!tabLive('lounge')) return; const { stream, data } = JSON.parse(ev.data); handleChartK(stream, data.k); };
}
function disconnectChartWS() {
  for (const socket of [wsChart, wsChartF]) if (socket) { socket.onmessage = null; socket.onclose = null; try { socket.close(); } catch(e) {} }
  wsChart = wsChartF = null;
}

function cdTxt(ms) {
  const s = Math.max(0, ms/1000|0);
  if (s < 100) return s + '초';
  if (s < 3600) return (s/60|0) + '분';
  if (s < 86400) return (s/3600|0) + '시간 ' + ((s%3600)/60|0) + '분';
  return (s/86400|0) + '일';
}

function maTick(i, k) {
  const seed = chartSeed[i], chart = chartOf(i);
  if (!seed || !chart) return;
  const closes = [];   // 완결 봉 종가, 최신부터 (진행 중 봉 제외)
  for (let j = seed.length - 1; j >= 0 && closes.length < 200; j--) {
    if (seed[j][0] < k.t) closes.push(+seed[j][4]);
  }
  MA_DEFS.forEach(([p], mi) => {
    if (closes.length < p - 1) return;
    let sum = +k.c;
    for (let j = 0; j < p - 1; j++) sum += closes[j];
    chart.ma[mi].update({ time: k.t/1000, value: sum / p });
  });
}

function handleChartK(stream, k) {
  if (k.i && k.i !== chartTf) return;
  const i = stream.startsWith('btcdom') ? 2 : stream.startsWith('btcusdt') ? 0 : stream.startsWith('ethusdt') ? 1 : 3;
  if (k.t < (chartLive[i]?.t ?? -Infinity) || k.t/1000 < (chartOf(i)?.lastT ?? -Infinity)) return;
  chartLive[i] = k;
  const chart = chartOf(i);
  if (chart) {
    const follow = chartAtRightEdge(chart.ch);
    const fresh = chartBumpBars(chart, k.t / 1000);
    chart.s.update({ time: k.t/1000, open:+k.o, high:+k.h, low:+k.l, close:+k.c });
    if (chart.longChannel) window.BtcLongChannel.tick(chart.longChannel,k.t/1000);
    chart.vol.update({ time: k.t/1000, value: +k.v, color: volColor(+k.o, +k.c) });
    maTick(i, k);
    if (chartSeed[i]) {
      tickSupertrend(chart.st,{time:k.t/1000,high:+k.h,low:+k.l,close:+k.c});
      tickOscillators(chart.osc,{time:k.t/1000,close:+k.c});
      chart.osc.syncRange();
    }
    if (fresh && follow) chartFollowBars(chart.ch, 1);
  }
  if (i === 0) { $('cd').textContent = cdTxt(k.T - Date.now()); lastBtcKt = k.t; lastBtcClose = +k.c; checkTreasure(k); paperTick(+k.c); }
  if (i === 1) {
    $('ethPx').textContent = fmt(+k.c, 1);
    if (ethOpen) {
      const chg = (+k.c/ethOpen - 1) * 100;
      $('ethChg').textContent = (chg>=0?'+':'') + chg.toFixed(2) + '% (24h)';
      $('ethChg').className = 'num ' + (chg>=0?'up':'dn');
    }
  }
  if (i === 2) $('domPx').textContent = fmt(+k.c, 1);
  if (i === 3) {
    $('qqqPx').textContent = fmt(+k.c, 2);
    if (qqqOpen) {
      const chg = (+k.c/qqqOpen - 1) * 100;
      $('qqqChg').textContent = (chg>=0?'+':'') + chg.toFixed(2) + '% (24h)';
      $('qqqChg').className = 'num ' + (chg>=0?'up':'dn');
    }
  }
  if (k.x) {
    if (chartSeed[i]) {
      const last = chartSeed[i][chartSeed[i].length - 1];
      if (last && last[0] === k.t) chartSeed[i][chartSeed[i].length - 1] = [k.t, k.o, k.h, k.l, k.c, k.v];
      else chartSeed[i].push([k.t, k.o, k.h, k.l, k.c, k.v]);
      if (chartSeed[i].length > LOUNGE_KL_LIMIT) chartSeed[i].shift();
    }
    if (i === 0) { lastBtcClosedTime = k.t; refreshComboMarkers(); refreshCandleGrades(); refreshTreasureLevels(); renderBtcMarkers(); }
    if (i === caroIdx) dealFromSeedTail(i);
  }
}

// ═══ 캔들 덱 리시드 — 선택된 차트 × 선택된 봉 ═══
let deckBody = [], deckVol = [], nextCardEl = null;
function ensureNextCard() {
  if (nextCardEl && nextCardEl.parentElement === deck) return;
  nextCardEl = document.createElement('div');
  nextCardEl.className = 'card nextcard';
  nextCardEl.innerHTML = '<div class="cardI"><div class="cf back">?</div></div>';
  deck.appendChild(nextCardEl);
}
function deckStats() {
  return [
    deckBody.length ? deckBody.reduce((a,b)=>a+b,0)/deckBody.length : 0,
    deckVol.length ? deckVol.reduce((a,b)=>a+b,0)/deckVol.length : 0,
  ];
}
function dealFromSeedTail(i) {
  if (!chartSeed[i] || !chartSeed[i].length) return;
  const k = chartSeed[i][chartSeed[i].length - 1];
  const [ab, av] = deckStats();
  dealCard(+k[1], +k[2], +k[3], +k[4], +k[5], k[0], ab, av);
  deckBody.push(Math.abs(+k[4]-+k[1])/+k[1]*100); if (deckBody.length > 30) deckBody.shift();
  deckVol.push(+k[5]); if (deckVol.length > 30) deckVol.shift();
}
function reseedDeck() {
  deck.innerHTML = ''; deckBody = []; deckVol = [];
  $('deckSub').textContent = `${CHART_SYMS[caroIdx].name} · ${TF_LABEL[chartTf]}`;
  const kl = chartSeed[caroIdx];
  if (!kl) return;
  kl.slice(-31, -15).forEach(k => { deckBody.push(Math.abs(+k[4]-+k[1])/+k[1]*100); deckVol.push(+k[5]); });
  kl.slice(-15, -1).forEach(k => {
    const [ab, av] = deckStats();
    dealCard(+k[1], +k[2], +k[3], +k[4], +k[5], k[0], ab, av, true);   // silent 리시드
    deck.lastChild.classList.remove('deal');
    deck.lastChild.classList.add('flipped');
    deckBody.push(Math.abs(+k[4]-+k[1])/+k[1]*100);
    deckVol.push(+k[5]);
  });
  ensureNextCard();
}
async function setTf(tf) {
  if (!Object.hasOwn(TF_LABEL,tf) || tf === chartTf) return;
  disconnectChartWS();
  chartTf = tf;
  chartLive = [null, null, null, null];
  chartSeed = [null, null, null, null];
  loungeCharts.forEach(chart=>{
    if (!chart) return;
    chart.osc.suspend=true;
    if (chart.longChannel) window.BtcLongChannel.clear(chart.longChannel);
    chart.s.setData([]); chart.vol.setData([]); chart.ma.forEach(s=>s.setData([]));
    seedSupertrend(chart.st,[]); chart.bars=0; chart.lastT=-Infinity;
    seedOscillators(chart.osc,[]);
  });
  document.querySelectorAll('.tfb').forEach(b => b.classList.toggle('on', b.dataset.tf === tf));
  $('cd').textContent = '--';
  await seedAll();
  if (tf !== chartTf) return;
  rebuildLiquidationMarkers();
  rebuildMacroMarkers();
  renderBtcMarkers();
  connectChartWS();
  reseedDeck();
}
window.setTf = setTf;
ensureLoungeChart(0);

// Public chart-only adapter. Never capture the page, chat or paper-account DOM.
window.TapeChartSource = Object.freeze({
  describe() {
    const markets = ['BTC / USDT · Binance', 'ETH / USDT · Binance', 'BTCDOMUSDT · Binance 선물지수', 'QQQB / USDT · ETF 토큰'];
    const keys = ['BTC', 'ETH', 'BTC.D', 'NASDAQ'];
    return { key:keys[caroIdx], market:markets[caroIdx], tf:chartTf, label:TF_LABEL[chartTf] };
  },
  restore() {
    if (document.body.dataset.entryTab !== 'lounge') return;
    const key = new URLSearchParams(location.search).get('chart');
    const index = ['BTC', 'ETH', 'BTC.D', 'NASDAQ'].indexOf(key);
    if (index >= 0) caroGo(index);
    if (location.hash === '#loungeChart') requestAnimationFrame(() => $('loungeChart').scrollIntoView({block:'start'}));
  },
  capture() {
    const chart = chartOf(caroIdx), page = document.querySelector(`.caroPage[data-p="${caroIdx}"]`);
    if (activeTab !== 'lounge' || !page?.getBoundingClientRect().width || !chart?.bars || !chartSeed[caroIdx]) {
      throw new Error('차트 데이터를 불러온 뒤 다시 시도해 주세요.');
    }
    return { ...this.describe(), capturedAt:new Date().toISOString(), maPeriods:MA_DEFS.map(d => d[0]), stPeriod:ST_PERIOD, stMultiplier:ST_MULTIPLIER, panes:chart.osc.charts.map(c => c.takeScreenshot()) };
  }
});

// ═══ 체결의 비 ═══
const rain = $('rain'), rctx = rain.getContext('2d');
function sizeRain(){
  const wrap = rain.parentElement;
  // 숨김 탭에서는 clientWidth가 0 → 그대로 대입하면 캔버스가 지워지고 복귀해도 살아나지 않는다
  if (!wrap.clientWidth) return;
  rain.width = wrap.clientWidth;
  const h3h = wrap.querySelector('h3').offsetHeight;
  const lg = $('rainLegend') ? $('rainLegend').offsetHeight : 0;
  rain.height = Math.max(220, wrap.clientHeight - h3h - lg - 6);
}
function alignPanels(){
  // 컬럼 정렬은 CSS grid stretch + 채팅 flex:1이 담당 — 여기선 rain 캔버스 크기만 갱신
  sizeRain();
  if (typeof startRain === 'function') startRain();
}
window.addEventListener('resize', alignPanels);
requestAnimationFrame(() => requestAnimationFrame(alignPanels));
setTimeout(alignPanels, 400);
// 체결 폭주나 프레임 지연 때 시각 연출만 낮춘다. 원본 거래 계산은 항상 전부 처리한다.
const effectDeviceCeiling = matchMedia('(prefers-reduced-motion: reduce)').matches ? .28 : matchMedia('(max-width: 760px)').matches ? .62 : (navigator.hardwareConcurrency||8) <= 4 ? .72 : 1;
let effectQuality = effectDeviceCeiling, effectRateQuality = 1, effectFrameQuality = 1;
let effectTradeCount = 0, effectRateAt = performance.now();
let effectLastFrame = performance.now(), effectFrameAvg = 16.7, effectTuneAt = performance.now();
function noteEffectTrade() { effectTradeCount++; }
function sampleEffectLoad(now) {
  const rateElapsed = now - effectRateAt;
  if (rateElapsed >= 500) {
    const rate = effectTradeCount * 1000 / rateElapsed;
    effectRateQuality = rate > 120 ? .32 : rate > 70 ? .48 : rate > 35 ? .66 : rate > 18 ? .82 : 1;
    effectTradeCount = 0; effectRateAt = now;
  }
  const dt = now - effectLastFrame; effectLastFrame = now;
  if (dt > 0 && dt < 120) effectFrameAvg = effectFrameAvg * .92 + dt * .08;
  if (now - effectTuneAt >= 500) {
    effectFrameQuality = effectFrameAvg > 30 ? .38 : effectFrameAvg > 24 ? .56 : effectFrameAvg > 20 ? .72 : effectFrameAvg > 18 ? .86 : 1;
    const target = Math.min(effectRateQuality, effectFrameQuality, effectDeviceCeiling);
    effectQuality += (target - effectQuality) * (target < effectQuality ? .45 : .12);
    effectTuneAt = now;
  }
}
const drops = [], rings = [];
let rainRaf = null;
let buyVol = 0, sellVol = 0;  // 60초 수급
function startRain() { if (!rainRaf && tabLive('lounge')) rainRaf = requestAnimationFrame(drawRain); }
function addRainRing(ring) { rings.push(ring); startRain(); }
function spawnDrop(valUsd, isBuy, isWhale = valUsd >= 500000) {
  if (!tabLive('lounge')) return;
  const r = Math.max(1.5, Math.min(30, Math.pow(valUsd, 0.38) / 5));
  const half = rain.width / 2;
  const x = isBuy ? half + 10 + Math.random() * (half - 30) : 10 + Math.random() * (half - 30);
  drops.push({ x, y: -10, vy: 2 + Math.random()*2 + r*0.12, r, side:isBuy, val:valUsd, whale:isWhale, alpha: 1 });
  const cap = Math.round(100 + 160 * effectQuality);
  if (drops.length > cap) drops.splice(0, drops.length - cap);
  startRain();
}
const tapeVisualBucket = {buy:0, sell:0, buyMax:0, sellMax:0};
function queueTapeVisual(val, isBuy) {
  noteEffectTrade();
  const side = isBuy ? 'buy' : 'sell';
  tapeVisualBucket[side] += val;
  tapeVisualBucket[side + 'Max'] = Math.max(tapeVisualBucket[side + 'Max'], val);
}
setInterval(() => {
  const buy = tapeVisualBucket.buy, sell = tapeVisualBucket.sell;
  const buyMax = tapeVisualBucket.buyMax, sellMax = tapeVisualBucket.sellMax;
  tapeVisualBucket.buy = 0; tapeVisualBucket.sell = 0;
  tapeVisualBucket.buyMax = 0; tapeVisualBucket.sellMax = 0;
  if (!tabLive('lounge')) return;
  if (buy > 0) { spawnDrop(buy, true, buyMax >= 500000); bookHit(buy, true); }
  if (sell > 0) { spawnDrop(sell, false, sellMax >= 500000); bookHit(sell, false); }
}, 80);
if (!localStorage.getItem('salonRainIntro')) $('rainIntro').classList.remove('hidden');
function rainIntroClose() {
  $('rainIntro').classList.add('hidden');
  localStorage.setItem('salonRainIntro', '1');
}
window.rainIntroClose = rainIntroClose;
function drawRain() {
  rainRaf = null;
  if (!tabLive('lounge')) return;
  rctx.clearRect(0,0,rain.width,rain.height);
  // 중앙 분리선
  rctx.strokeStyle = 'rgba(35,40,56,.8)'; rctx.setLineDash([3,5]);
  rctx.beginPath(); rctx.moveTo(rain.width/2, 0); rctx.lineTo(rain.width/2, rain.height); rctx.stroke();
  rctx.setLineDash([]);
  for (let i = drops.length-1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.vy;
    if (d.y > rain.height + 20) { drops.splice(i,1); continue; }
    const col = d.side ? '74,222,128' : '248,113,113';
    rctx.beginPath(); rctx.arc(d.x, d.y, d.r, 0, 7);
    rctx.fillStyle = `rgba(${col},${d.r < 4 ? .45 : .8})`;
    rctx.fill();
    // 꼬리
    if (d.r >= 3) {
      rctx.beginPath(); rctx.moveTo(d.x, d.y - d.r*2.2); rctx.lineTo(d.x, d.y - d.r);
      rctx.strokeStyle = `rgba(${col},.25)`; rctx.lineWidth = d.r*.6; rctx.stroke();
    }
    if (d.whale) { rctx.strokeStyle = 'rgba(212,175,55,.9)'; rctx.lineWidth = 2; rctx.beginPath(); rctx.arc(d.x,d.y,d.r+2,0,7); rctx.stroke(); }
    if (d.r >= 12) {
      rctx.fillStyle = 'rgba(10,12,16,.9)'; rctx.font = `bold ${Math.max(8,d.r*.55)}px Menlo`; rctx.textAlign='center';
      rctx.fillText('$'+(d.val >= 1e6 ? (d.val/1e6).toFixed(1)+'M' : (d.val/1000|0)+'K'), d.x, d.y+3);
    }
  }
  for (let i = rings.length-1; i >= 0; i--) {
    const g = rings[i]; g.r += 5;
    rctx.beginPath(); rctx.arc(g.x,g.y,g.r,0,7);
    rctx.strokeStyle = (g.side?'rgba(74,222,128,':'rgba(248,113,113,') + Math.max(0,1-g.r/g.max) + ')';
    rctx.lineWidth = 3; rctx.stroke();
    if (g.r > g.max) rings.splice(i,1);
  }
  if (drops.length || rings.length) rainRaf = requestAnimationFrame(drawRain);
}
startRain();
// 수급 바 (지수 감쇠)
setInterval(() => {
  if (!tabLive('lounge')) return;
  buyVol *= 0.94; sellVol *= 0.94;
  const tot = buyVol + sellVol;
  if (tot > 0) {
    $('pB').style.width = (buyVol/tot*100) + '%';
    $('pS').style.width = (sellVol/tot*100) + '%';
  }
}, 500);

// ═══ 라운지 피드 ═══
const feed = $('feed');
let chatUnread = 0;
function chatViewport() {
  const top = feed.getBoundingClientRect().top;
  const anchor = [...feed.children].find(node => node.getBoundingClientRect().bottom > top + 1);
  return { atEnd:feed.scrollHeight - feed.clientHeight - feed.scrollTop < 40,
    node:anchor, id:anchor?.dataset.chatId, offset:anchor ? anchor.getBoundingClientRect().top - top : 0 };
}
function updateChatJump() {
  const button = $('chatJump');
  button.hidden = chatUnread === 0;
  button.textContent = `새 메시지 ${chatUnread > 99 ? '99+' : chatUnread}개 ↓`;
}
function jumpToLatestChat() {
  chatUnread = 0; updateChatJump();
  feed.scrollTop = feed.scrollHeight;
}
function restoreChatViewport(view) {
  if (view.atEnd) { jumpToLatestChat(); return; }
  const anchor = view.id ? [...feed.children].find(node => node.dataset.chatId === view.id) : view.node;
  if (anchor?.parentElement === feed) {
    feed.scrollTop += anchor.getBoundingClientRect().top - feed.getBoundingClientRect().top - view.offset;
  }
}
function appendChatMessage(node) {
  const view = chatViewport();
  feed.appendChild(node);
  while (feed.children.length > 60) feed.removeChild(feed.firstChild);
  if (!view.atEnd) { chatUnread++; updateChatJump(); }
  restoreChatViewport(view);
}
feed.addEventListener('scroll', () => {
  if (feed.scrollHeight - feed.clientHeight - feed.scrollTop < 16 && chatUnread) {
    chatUnread = 0; updateChatJump();
  }
}, {passive:true});
function chatTimeElement(createdAt) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (!Number.isFinite(+date)) return null;
  const time = document.createElement('time');
  time.className = 'chatTime'; time.dateTime = date.toISOString();
  time.textContent = date.toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  if (date.toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}) !== new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})) {
    time.textContent = date.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit'}) + ' ' + time.textContent;
  }
  time.title = date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) + ' · 한국시간';
  return time;
}
const CHAT_AVA = {
  madam: 'avatars/madam.jpg?v=069975a', andy: 'avatars/andy.jpg?v=069975a', justin: 'avatars/prof.jpg?v=069975a',
  degen: 'avatars/degen.png', hermit: 'avatars/hermit.png', wolf: 'avatars/wolf.png'
};
function say(cls, who, body) {
  const m = document.createElement('div');
  m.className = 'msg ' + cls;
  const ava = CHAT_AVA[cls] ? `<img class="ava" src="${CHAT_AVA[cls]}" alt="">` : '';
  m.innerHTML = ava + (who ? `<span class="who">${who}</span>` : '') + `<span class="body">${body}</span>`;
  appendChatMessage(m);
}
// 서버에서 내려오는 서신은 HTML로 해석하지 않는다. 배포 파이프라인이나 JSON이
// 오염돼도 방문자 브라우저에서 스크립트가 실행되지 않도록 DOM 텍스트로만 렌더링한다.
function sayLetter(cls, who, body) {
  const safeCls = CHAT_AVA[cls] ? cls : 'sys';
  const m = document.createElement('div');
  m.className = 'msg ' + safeCls;
  if (CHAT_AVA[safeCls]) {
    const img = document.createElement('img');
    img.className = 'ava';
    img.src = CHAT_AVA[safeCls];
    img.alt = '';
    m.appendChild(img);
  }
  if (who) {
    const name = document.createElement('span');
    name.className = 'who';
    name.textContent = who;
    m.appendChild(name);
  }
  const text = document.createElement('span');
  text.className = 'body';
  text.textContent = String(body ?? '');
  m.appendChild(text);
  appendChatMessage(m);
}
// 전략가 서신 — 서버가 매일 reports/letters.json에 갱신 (실패 시 폴백)
const CHAR_NAME = { madam: '鄭마담', andy: 'Andy', justin: 'Prof. Justin' };
const LETTER_FALLBACK = [
  { cls:'madam', at:'최근 갱신', body:'판은 늘 돌아가고 있어. 자세한 소식은 장부에 적어뒀으니 열어봐.' },
  { cls:'andy', at:'최근 갱신', body:'그물은 매일 밤 걷는다. 오늘 명단은 저녁 전보에서.' },
  { cls:'justin', at:'최근 갱신', body:'이달 소견서는 연구실에 걸어뒀습니다. 판단은 모형이, 결정은 사람이.' },
];
const LETTER_CARD = {
  madam: ['madamRecentMeta', 'madamRecentText', '아침 서신'],
  andy: ['andyRecentMeta', 'andyRecentText', '스캔 전보'],
  justin: ['justinRecentMeta', 'justinRecentText', '월간 소견서'],
};
const JUSTIN_REVIEW_COPY = {
  ko: { meta:'10/28 데이터 기준 · 임시 판정', value:'임시 판정', note:'정상 데이터 수집 후 재학습 시 자동 갱신', body:'현재 표시된 11월 예측값은 10월 28일까지의 데이터로 계산한 임시값입니다. 데이터가 정상적으로 수집되어 재학습이 완료되면 새 예측값으로 자동 교체됩니다.' },
  en: { meta:'Provisional · data through Oct 28', value:'Provisional', note:'Will refresh after complete data is retrained', body:'The November forecast shown here is provisional and uses data through Oct 28. It will be replaced automatically after complete data is collected and the model is retrained.' },
  zh: { meta:'截至10月28日数据 · 临时判断', value:'临时判断', note:'完整数据重训后自动更新', body:'当前显示的11月预测值是基于截至10月28日数据计算的临时值。数据正常收集并完成重新训练后，将自动替换为新预测值。' },
  ja: { meta:'10月28日までのデータ · 暫定判定', value:'暫定判定', note:'完全なデータで再学習後に自動更新', body:'現在表示されている11月の予測値は、10月28日までのデータによる暫定値です。データが正常に収集され、再学習が完了すると新しい予測値に自動で置き換わります。' },
};
function justinLetterConflicts(m) {
  if (m?.cls !== 'justin') return false;
  const body = String(m.body || ''), value = String(m.kpi?.value || ''), note = String(m.kpi?.note || '');
  const bodyAllows = /진입\s*허용/.test(body), bodyBlocks = /진입\s*(차단|제한)/.test(body);
  const valueAllows = /진입\s*허용/.test(value), valueBlocks = /진입\s*(차단|제한)/.test(value);
  const noteAllows = /판정\s*허용/.test(note), noteBlocks = /판정\s*(차단|제한)/.test(note);
  return (bodyAllows && (valueBlocks || noteBlocks)) || (bodyBlocks && (valueAllows || noteAllows)) || (valueAllows && noteBlocks) || (valueBlocks && noteAllows);
}
async function loadLetters() {
  let list = null, updated = '';
  try {
    const r = await fetch('reports/letters.json?t=' + Date.now());
    if (r.ok) {
      const j = await r.json();
      if (j && j.messages && j.messages.length) { list = j.messages; updated = j.updated || ''; }
    }
  } catch(e) {}
  if (!list) list = LETTER_FALLBACK;
  list.forEach((m, i) => {
    const review = justinLetterConflicts(m) ? (JUSTIN_REVIEW_COPY[document.documentElement.lang] || JUSTIN_REVIEW_COPY.ko) : null;
    const card = LETTER_CARD[m.cls];
    if (card) {
      $(card[0]).textContent = `${review?.meta || m.at || updated || '최근 갱신'} · ${card[2]}`;
      $(card[1]).textContent = review?.body || String(m.body || '');
    }
    const tile = document.querySelector(`#stratKpi .kpiTile[data-kpi="${m.cls}"]`);
    if (tile && m.kpi) {
      tile.querySelector('.l').textContent = String(m.kpi.label || '');
      tile.querySelector('.v').textContent = review?.value || String(m.kpi.value || '—');
      const d = tile.querySelector('.d');
      d.textContent = review?.note || String(m.kpi.note || '');
      d.className = 'd ' + (review ? 'flat' : (['pos','neg','flat'].includes(m.kpi.tone) ? m.kpi.tone : 'flat'));
    } else if (tile) {
      tile.querySelector('.v').textContent = '—';
      const d = tile.querySelector('.d');
      d.textContent = '다음 갱신을 기다리는 중';
      d.className = 'd flat';
    }
  });
}
loadLetters();

// ═══ 닉네임 (채팅·블라인드 방에서 공용) ═══
let myNick = localStorage.getItem('salonNick') || '나 (닉네임 설정)';
function renderNick() { $('nickBtn').textContent = myNick.startsWith('나 ') ? '닉네임 설정' : myNick; }
function setNick() {
  const n = prompt('닉네임을 입력하세요 (최대 10자)', myNick.startsWith('나 ') ? '' : myNick);
  if (n && n.trim()) {
    myNick = n.trim().slice(0, 10);
    localStorage.setItem('salonNick', myNick);
    renderNick();
  }
}
window.setNick = setNick;

// ═══ Supabase — 라이브 채팅 · 리더보드 ═══
const SUPA_URL = 'https://mmvhyzajmfkilldxxazs.supabase.co';
const SUPA_KEY = 'sb_publishable_S5ohCvizmH8zI-H1wvRupA_aHTG4YOH';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sbc = null, myUid = null, authPending = null;
try { sbc = window.supabase.createClient(SUPA_URL, SUPA_KEY); } catch(e) { console.log('supabase off', e); }

// ═══ 익명 관전 인원 · 개인정보 없는 방문 통계 ═══
const siteUuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
});
let analyticsVisitorId = null;
try {
  analyticsVisitorId = localStorage.getItem('tapeVisitorId');
  if (!analyticsVisitorId) { analyticsVisitorId = siteUuid(); localStorage.setItem('tapeVisitorId', analyticsVisitorId); }
} catch(e) { analyticsVisitorId = siteUuid(); }
const analyticsSessionId = siteUuid();
let analyticsLastActiveAt = performance.now(), analyticsTimer = null, analyticsStarted = false;
let presenceChannel = null, presenceConnectionTimer = null, presenceRealtimeState = 'idle';
const PRESENCE_REALTIME_TIMEOUT_MS = 8000;
let analyticsQualificationVisibleSeconds = 0, analyticsVisibleSince = document.hidden ? null : analyticsLastActiveAt;

// ── 유휴 상한 ──
// 예전에는 탭이 화면에 떠 있기만 하면 60초마다 60초를 그대로 적립했다.
// 그래서 방치된 탭 하나가 하루 1,440분(=24시간)을 찍어 체류시간 지표가 통째로 망가졌다.
// 이제 마지막 실제 조작 이후 IDLE_LIMIT_MS 가 지나면 적립을 멈춘다.
const IDLE_LIMIT_MS = 5 * 60 * 1000;
let analyticsLastInputAt = performance.now();
const markUserInput = () => { analyticsLastInputAt = performance.now(); scheduleSiteAnalyticsQualification(); };
['pointerdown','keydown','wheel','touchstart','scroll'].forEach(ev =>
  window.addEventListener(ev, markUserInput, { passive:true, capture:true }));

// ── 유입 경로 ── 호스트만, 우리 도메인은 제외(내부 이동)
const analyticsReferrerHost = (() => {
  try {
    if (!document.referrer) return null;
    const h = new URL(document.referrer).hostname.toLowerCase();
    return (!h || h === location.hostname) ? null : h;
  } catch(e) { return null; }
})();

// ── 운영자/내부 트래픽 표시 ──
// ?internal=1 로 한 번 켜두면 이 브라우저는 계속 내부로 집계된다 (?internal=0 으로 해제).
let analyticsInternal = false;
try {
  const q = new URLSearchParams(location.search).get('internal');
  if (q === '1') localStorage.setItem('tapeInternal', '1');
  else if (q === '0') localStorage.removeItem('tapeInternal');
  analyticsInternal = localStorage.getItem('tapeInternal') === '1';
} catch(e) {}

const analyticsAutomated = !analyticsInternal && (navigator.webdriver === true ||
  /(?:googlebot|google-inspectiontool|googleother|google-agent|storebot-google|bingbot|duckduckbot|baiduspider|yandexbot|applebot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|redditbot|pinterestbot|ahrefsbot|semrushbot|mj12bot|bytespider|gptbot|claudebot|perplexitybot|crawler|spider|headlesschrome|phantomjs|lighthouse|pagespeed)/i.test(navigator.userAgent || ''));
const analyticsQualificationDelayMs = 5000;
let analyticsQualified = analyticsInternal, analyticsQualificationTimer = null;

const analyticsCampaignRoute = window.TapeCampaign?.route(location.search) || {rpc:'record_site_activity',fields:{}};

function analyticsPayload(activeSeconds = 0, isView = false) {
  return {
    p_visitor_id: analyticsVisitorId, p_session_id: analyticsSessionId, p_tab: activeTab,
    p_active_seconds: Math.max(0, Math.min(60, Math.round(activeSeconds))), p_is_view:isView,
    p_referrer_host: analyticsReferrerHost, p_internal: analyticsInternal,
    ...analyticsCampaignRoute.fields,
  };
}
async function recordSiteActivity(activeSeconds = 0, keepalive = false, isView = false) {
  if (!sbc || !analyticsVisitorId || analyticsAutomated) return;
  const body = analyticsPayload(activeSeconds, isView);
  try {
    if (keepalive) {
      await fetch(`${SUPA_URL}/rest/v1/rpc/${analyticsCampaignRoute.rpc}`, {
        method:'POST', keepalive:true, headers:{ apikey:SUPA_KEY, 'Content-Type':'application/json' }, body:JSON.stringify(body)
      });
    } else {
      const { error } = await sbc.rpc(analyticsCampaignRoute.rpc, body);
      if (error) console.warn('analytics off', error.message);
    }
  } catch(e) { console.warn('analytics off'); }
}
function qualifySiteAnalytics() {
  if (analyticsQualified || analyticsAutomated || document.hidden) return false;
  const now = performance.now();
  const visibleSeconds = analyticsQualificationVisibleSeconds +
    (analyticsVisibleSince === null ? 0 : Math.max(0, (now - analyticsVisibleSince) / 1000));
  analyticsQualified = true;
  clearTimeout(analyticsQualificationTimer); analyticsQualificationTimer = null;
  analyticsQualificationVisibleSeconds = 0; analyticsVisibleSince = null;
  analyticsLastActiveAt = analyticsLastInputAt = now;
  recordSiteActivity(visibleSeconds, false, !analyticsStarted);
  analyticsStarted = true;
  startSitePresence();
  if (!analyticsTimer) analyticsTimer = setInterval(() => siteAnalyticsFlush(false), 60000);
  return true;
}
function scheduleSiteAnalyticsQualification() {
  if (analyticsQualified || analyticsAutomated || document.hidden || analyticsQualificationTimer) return;
  analyticsQualificationTimer = setTimeout(() => {
    analyticsQualificationTimer = null;
    qualifySiteAnalytics();
  }, analyticsQualificationDelayMs);
}
function siteAnalyticsFlush(keepalive = false) {
  if (!analyticsQualified || analyticsAutomated || (document.hidden && !keepalive)) return;
  const now = performance.now();
  // 조작이 끊긴 뒤의 시간은 활동으로 치지 않는다. 마지막 입력까지만 인정.
  const countUntil = Math.min(now, analyticsLastInputAt + IDLE_LIMIT_MS);
  const elapsed = Math.max(0, (countUntil - analyticsLastActiveAt) / 1000);
  analyticsLastActiveAt = now;
  if (elapsed < 1 && !keepalive) return;   // 유휴 중에는 서버 호출 자체를 생략
  recordSiteActivity(elapsed, keepalive);
}
function siteAnalyticsTabLeaving() { siteAnalyticsFlush(false); }
function siteAnalyticsTabEntered() {
  const alreadyQualified = analyticsQualified;
  analyticsLastActiveAt = performance.now(); markUserInput();   // 탭 전환은 명백한 조작
  if (alreadyQualified) recordSiteActivity(0, false, true);
}
window.siteAnalyticsTabLeaving = siteAnalyticsTabLeaving;
window.siteAnalyticsTabEntered = siteAnalyticsTabEntered;

function renderViewerCount() {
  if (!presenceChannel) return;
  if (presenceRealtimeState !== 'connected') {
    $('viewerCount').textContent = presenceRealtimeLabel();
    return;
  }
  const count = Object.keys(presenceChannel.presenceState() || {}).length;
  $('viewerCount').textContent = `${count}명 관전 중`;
}
function presenceRealtimeLabel() {
  if (presenceRealtimeState === 'connected') return `${Object.keys(presenceChannel?.presenceState() || {}).length}명 관전 중`;
  if (presenceRealtimeState === 'reconnecting') return '재연결 중';
  if (presenceRealtimeState === 'delayed') return '접속자 확인 지연';
  if (presenceRealtimeState === 'idle') return '자리 비움';
  return '접속자 연결 중';
}
function armPresenceConnectionTimer(channel) {
  clearTimeout(presenceConnectionTimer);
  presenceConnectionTimer = setTimeout(() => {
    if (presenceChannel !== channel || presenceRealtimeState === 'connected') return;
    presenceRealtimeState = 'delayed';
    renderViewerCount();
  }, PRESENCE_REALTIME_TIMEOUT_MS);
}
function startSitePresence() {
  if (!sbc || document.hidden || presenceChannel || analyticsAutomated || !analyticsQualified) return;
  // 고정 채널명 — 세션마다 다른 이름을 쓰면(구 -${presenceSeq}) 탭 전환 후 재구독한 사람이
  // 새 채널로 옮겨가 버려 같은 순간에도 서로 다른 채널에 흩어지고 인원수가 실제보다 적게 잡혔다.
  const channel = sbc.channel('tape-lounge-presence', { config:{ presence:{ key:analyticsSessionId } } })
    .on('presence', { event:'sync' }, renderViewerCount);
  presenceChannel = channel;
  presenceRealtimeState = 'connecting';
  renderViewerCount();
  armPresenceConnectionTimer(channel);
  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED' && presenceChannel === channel) {
      presenceRealtimeState = 'connected';
      clearTimeout(presenceConnectionTimer); presenceConnectionTimer = null;
      if (!analyticsInternal) {
        try { await channel.track({ online_at:new Date().toISOString() }); }
        catch (error) { console.warn('presence track unavailable'); }
      }
      renderViewerCount();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      presenceRealtimeState = 'reconnecting';
      renderViewerCount();
      armPresenceConnectionTimer(channel);
    }
  });
}
function stopSitePresence() {
  if (!presenceChannel) return;
  const channel = presenceChannel; presenceChannel = null;
  presenceRealtimeState = 'idle';
  clearTimeout(presenceConnectionTimer); presenceConnectionTimer = null;
  channel.untrack().catch(() => {}); sbc.removeChannel(channel);
  $('viewerCount').textContent = presenceRealtimeLabel();
}
function syncSiteAudience() {
  const now = performance.now();
  if (!analyticsQualified) {
    if (document.hidden) {
      if (analyticsVisibleSince !== null) analyticsQualificationVisibleSeconds += Math.max(0, (now - analyticsVisibleSince) / 1000);
      analyticsVisibleSince = null;
    } else if (analyticsVisibleSince === null) {
      analyticsVisibleSince = now;
    }
  }
  if (document.hidden) {
    siteAnalyticsFlush(true); stopSitePresence(); clearInterval(analyticsTimer); analyticsTimer = null;
    if (!analyticsQualified) { clearTimeout(analyticsQualificationTimer); analyticsQualificationTimer = null; }
  } else if (analyticsAutomated) {
    return;
  } else if (analyticsQualified) {
    analyticsLastActiveAt = performance.now(); recordSiteActivity(0, false, !analyticsStarted); analyticsStarted = true; startSitePresence();
    if (!analyticsTimer) analyticsTimer = setInterval(() => siteAnalyticsFlush(false), 60000);
  } else {
    scheduleSiteAnalyticsQualification();
  }
}
document.addEventListener('visibilitychange', syncSiteAudience);
window.addEventListener('pagehide', () => { siteAnalyticsFlush(true); stopSitePresence(); });
syncSiteAudience();
// 익명 인증 — 쓰기(점수·채팅) 첫 시도 때만 세션 발급 (구경만 하면 계정 안 만듦)
const TURNSTILE_SITEKEY = '0x4AAAAAAEDtJF9PJ4ZwYXIl';
let captchaWidgetId = null, captchaPending = null;
function waitForTurnstile() {
  return new Promise((resolve, reject) => {
    const until = Date.now() + 10000;
    const check = () => window.turnstile ? resolve() :
      Date.now() >= until ? reject(new Error('보안 인증을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')) : setTimeout(check, 100);
    check();
  });
}
async function getCaptchaToken() {
  if (captchaPending) return captchaPending;
  const gate = $('captchaGate'), err = $('captchaError');
  gate.classList.remove('hidden'); err.textContent = '';
  captchaPending = (async () => {
    await waitForTurnstile();
    return new Promise((resolve, reject) => {
      const options = {
        sitekey: TURNSTILE_SITEKEY, theme: 'dark',
        callback: token => { gate.classList.add('hidden'); resolve(token); },
        'error-callback': () => { err.textContent = '보안 인증에 실패했습니다. 다시 시도해 주세요.'; reject(new Error(err.textContent)); },
        'expired-callback': () => { err.textContent = '인증 시간이 만료되었습니다. 다시 시도해 주세요.'; },
      };
      if (captchaWidgetId === null) captchaWidgetId = window.turnstile.render('#captchaWidget', options);
      else window.turnstile.reset(captchaWidgetId);
    });
  })();
  try { return await captchaPending; }
  finally { captchaPending = null; }
}
async function ensureAuth() {
  if (!sbc) return null;
  if (myUid) return myUid;
  if (authPending) return authPending;
  authPending = (async () => {
    try {
      const { data: { session } } = await sbc.auth.getSession();
      if (session?.user) { myUid = session.user.id; return myUid; }
      const captchaToken = await getCaptchaToken();
      const { data, error } = await sbc.auth.signInAnonymously({ options: { captchaToken } });
      if (error) { console.log('anon auth off', error.message); return null; }
      myUid = data.user?.id || null;
    } catch(e) { console.log('auth err', e); }
    return myUid;
  })();
  try { return await authPending; }
  finally { authPending = null; }
}

function nickColor(n) {
  let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 60% 72%)`;
}
const CHAT_CREW_ICON = { watcher:'○', chart_doryeong:'⌁', funding_bear:'₣', spot_sister:'●' };
const CHAT_OFFICIAL = new Set(['madam', 'andy', 'justin']);
// Aligned with the market/reply automation roles; no invented credentials or positions.
const CREW_PROFILES = Object.freeze({
  watcher: {name:'관망이', motto:'다들 한쪽만 볼 때, 반대쪽도 한번 보자.', focus:'거시경제 · 엇갈리는 시장 신호', style:'서두르지 않는 관찰자. 서로 다른 근거를 놓고, 아직 모르는 부분도 함께 짚어요.'},
  chart_doryeong: {name:'차트도령', motto:'선을 넘었는지보다, 넘고 나서가 궁금해.', focus:'가격 흐름 · 고점과 저점 · 캔들', style:'확인하고 말하는 차트파. 돌파와 되돌림을 쉬운 말로 풀고, 다음에 볼 지점을 하나씩 짚어요.'},
  funding_bear: {name:'펀딩곰', motto:'한쪽으로 너무 몰리면 좀 신경 쓰이더라.', focus:'선물 청산 · 롱·숏 쏠림', style:'과열을 경계하는 신중파. 청산이 어느 쪽에 몰렸는지 살펴요. 청산만으로 펀딩비를 단정하지 않아요.'},
  spot_sister: {name:'현물누나', motto:'큰 체결은 눈에 띄지. 속마음까지는 모르고.', focus:'큰 체결 · 매수와 매도 흐름', style:'수급을 차분히 보는 실용파. 확인된 큰 거래를 짚되, 고래의 의도나 온체인 이동으로 넘겨짚지 않아요.'},
  degen: {name:'디젠', motto:'와, 방금 건 눈이 번쩍 뜨이네.', focus:'큰 청산 · 급격한 가격 변화', style:'큰 장면에 짧고 생생하게 반응하는 타입. 호들갑은 조금, 매수·매도 부추기기는 없이.'},
  hermit: {name:'허밋', motto:'차트 밖 기록도 천천히 보면 재밌어.', focus:'온체인 지표 · 비트코인 네트워크', style:'기록을 들여다보는 조용한 탐구파. 확인된 온체인 자료에 기준 날짜를 붙여 말해요. 자료가 오래되면 쉬어가요.'},
  wolf: {name:'울프', motto:'장면 하나보다, 그 앞뒤를 같이 보자.', focus:'사건의 순서 · 이어지는 시장 흐름', style:'앞뒤 맥락을 잇는 정리파. 여러 시점의 사건을 엮되, 순서만 보고 원인이라고 단정하지 않아요.'}
});
let crewCardTrigger = null;
function openCrewCard(agentKey, trigger) {
  if (!Object.hasOwn(CREW_PROFILES, agentKey)) return;
  const profile = CREW_PROFILES[agentKey], dialog = $('crewCard');
  crewCardTrigger = trigger;
  $('crewTitle').textContent = profile.name;
  $('crewMotto').textContent = '“' + profile.motto + '”';
  $('crewFocus').textContent = profile.focus;
  $('crewStyle').textContent = profile.style;
  const portrait = $('crewPortrait');
  portrait.replaceChildren();
  if (Object.hasOwn(CHAT_AVA, agentKey)) {
    const img = document.createElement('img'); img.src = CHAT_AVA[agentKey]; img.alt = ''; portrait.append(img);
  } else { portrait.textContent = CHAT_CREW_ICON[agentKey] || '○'; }
  // Reuse the bounded public-chat cache. Opening a card never fetches or publishes anything.
  const rows = [...chatRows.values()].map(entry => entry.row)
    .filter(row => row.author_type === 'virtual' && row.agent_key === agentKey)
    .sort((a,b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || Number(b.id) - Number(a.id))
    .slice(0,3);
  const quotes = rows.map(row => {
    const li = document.createElement('li'), text = document.createElement('p');
    const time = chatTimeElement(row.created_at);
    if (time) { time.className = ''; li.append(time); }
    text.textContent = row.body; li.append(text); return li;
  });
  $('crewQuotes').replaceChildren(...quotes);
  $('crewEmpty').hidden = rows.length > 0;
  $('crewRecent').open = false;
  if (!dialog.open) dialog.showModal();
}
function closeCrewCard() {
  // Restore synchronously: a delayed native close event must not steal focus from the next click.
  const target = crewCardTrigger?.isConnected ? crewCardTrigger : feed;
  crewCardTrigger = null;
  $('crewCard').close();
  target.focus({preventScroll:true});
}
$('crewClose').addEventListener('click', closeCrewCard);
$('crewCard').addEventListener('cancel', event => { event.preventDefault(); closeCrewCard(); });
$('crewCard').addEventListener('click', event => {
  if (event.target !== event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeCrewCard();
});
function sayUser(nick, body, authorType = 'human', agentKey = null, createdAt = null, id = null, append = true) {
  const m = document.createElement('div');
  const virtual = authorType === 'virtual';
  m.className = `msg user${virtual ? ' virtual' : ''}`;
  const official = virtual && CHAT_OFFICIAL.has(agentKey);
  const ava = virtual && CHAT_AVA[agentKey]
    ? `<img class="ava" src="${CHAT_AVA[agentKey]}" alt="">`
    : virtual && CHAT_CREW_ICON[agentKey]
      ? `<span class="crewAva" aria-hidden="true">${CHAT_CREW_ICON[agentKey]}</span>` : '';
  const tag = virtual
    ? `<span class="aiTag${official ? ' official' : ''}" title="AI가 생성한 공개 시장 대화">${official ? '공식 전략가 · AI' : '라운지 크루 · AI'}</span>` : '';
  m.innerHTML = `${ava}<span class="who" style="color:${nickColor(nick)}">${esc(nick)}</span>${tag}<span class="body">${esc(body)}</span>`;
  if (virtual && Object.hasOwn(CREW_PROFILES, agentKey)) {
    const name = document.createElement('button');
    name.type = 'button'; name.className = 'who crewName'; name.style.color = nickColor(nick);
    name.textContent = nick; name.setAttribute('aria-label', `${CREW_PROFILES[agentKey].name} 크루 명함 보기`);
    name.setAttribute('aria-haspopup', 'dialog'); name.setAttribute('aria-controls', 'crewCard');
    name.addEventListener('click', () => openCrewCard(agentKey,name));
    m.querySelector('.who').replaceWith(name);
  }
  if (id !== null) m.dataset.chatId = String(id);
  const time = chatTimeElement(createdAt);
  if (time) m.prepend(time);
  if (append) appendChatMessage(m);
  return m;
}
let _lastChat = 0, _chatSending = false;
async function chatSend() {
  if (_chatSending) return;
  const inp = $('chatTxt'), body = inp.value.trim();
  if (!body) return;
  if (myNick.startsWith('나 ')) { setNick(); if (myNick.startsWith('나 ')) return; }
  if (Date.now() - _lastChat < 3000) return;   // 도배 쿨다운 3초
  const button = $('chatSendBtn');
  let status = $('chatSendStatus');
  if (!status) {
    status = document.createElement('div');
    status.id = 'chatSendStatus';
    status.setAttribute('role', 'status');
    status.style.cssText = 'color:#e7b86d;font-size:12px;padding:4px 12px';
    inp.parentElement.insertAdjacentElement('afterend', status);
  }
  _chatSending = true;
  button.disabled = true;
  button.textContent = '전송 중…';
  status.textContent = '';
  try {
    if (!sbc) throw new Error('chat unavailable');
    await ensureAuth();
    if (!myUid) throw new Error('authentication unavailable');
    const { error } = await sbc.from('salon_chat').insert({ nick: myNick, body, user_id: myUid });
    if (error) throw error;
    _lastChat = Date.now();
    // Preserve a new draft typed while the request was in flight.
    if (inp.value.trim() === body) inp.value = '';
  } catch (error) {
    status.textContent = '전송을 확인하지 못했어요. 채팅에 올라왔는지 확인한 뒤 다시 시도해 주세요.';
    console.warn('chat send failed');
  } finally {
    _chatSending = false;
    button.disabled = false;
    button.textContent = '전송';
  }
}
window.chatSend = chatSend;


// ═══ 채팅 실시간 연결 — 라운지가 보일 때만 유지하고 복귀 시 누락분 동기화 ═══
let chatChannel = null, chatChannelSeq = 0, chatConnectionTimer = null;
let chatRealtimeState = 'idle';
const chatRows = new Map();
let chatArrivalSequence = 0, chatHistoryGeneration = 0;
const CHAT_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CHAT_REALTIME_TIMEOUT_MS = 8000;
function chatRealtimeLabel() {
  if (chatRealtimeState === 'connected') return '실시간 · 한국시간';
  if (chatRealtimeState === 'reconnecting') return '재연결 중';
  if (chatRealtimeState === 'delayed') return '실시간 연결 지연';
  if (chatRealtimeState === 'idle') return '대화 잠시 멈춤';
  return '실시간 연결 중';
}
function armChatConnectionTimer(channel) {
  clearTimeout(chatConnectionTimer);
  chatConnectionTimer = setTimeout(() => {
    if (chatChannel !== channel || chatRealtimeState === 'connected') return;
    chatRealtimeState = 'delayed';
    $('chatConnection').textContent = chatRealtimeLabel();
  }, CHAT_REALTIME_TIMEOUT_MS);
}
function chatRowIsRecent(row) {
  const created = Date.parse(row?.created_at || '');
  return Number.isFinite(created) && created >= Date.now() - CHAT_RECENT_WINDOW_MS;
}
function chatEmptyCopy() {
  const copy = {
    ko: {
      group: '라운지 대화 시작 주제', title: '최근 대화가 없어요',
      intro: '오늘 시장에서 눈에 들어온 장면을 한 줄로 나눠보세요.',
      hint: '주제를 누르면 입력창에만 채워져요. 직접 보내야 게시됩니다.',
      prompts: ['BTC, 어떤 가격을 보고 있어요?', '세션 중 어디가 강했나요?', '이 차트의 지지는 어디로 봐요?'],
    },
    en: {
      group: 'Lounge conversation starters', title: 'Quiet at the table',
      intro: 'Start with one market detail you noticed today.',
      hint: 'A topic only fills the box. Edit and send it when ready.',
      prompts: ['Which BTC level are you watching?', 'Which session is leading?', 'Where do you see support here?'],
    },
    zh: {
      group: '休息室讨论话题', title: '桌边暂时很安静',
      intro: '说说你今天注意到的一个市场细节吧。',
      hint: '点击话题只会填入输入框，编辑后需手动发送。',
      prompts: ['你在关注 BTC 哪个价位？', '今天哪个时段更强？', '你把哪里看作支撑？'],
    },
    ja: {
      group: 'ラウンジの会話テーマ', title: 'テーブルはまだ静かです',
      intro: '今日の相場で気になった場面を一言どうぞ。',
      hint: 'テーマを押すと入力欄に入ります。編集して送信してください。',
      prompts: ['BTCのどの価格を見ていますか？', '今日はどの時間帯が強い？', 'どこをサポートと見ますか？'],
    },
  };
  return copy[document.documentElement.lang] || copy.ko;
}
function renderChatEmptyState() {
  const copy = chatEmptyCopy();
  const empty = document.createElement('div');
  empty.className = 'chatEmpty';
  empty.setAttribute('role', 'group');
  empty.setAttribute('aria-label', copy.group);
  const title = document.createElement('strong');
  title.textContent = copy.title;
  const intro = document.createElement('span');
  intro.textContent = copy.intro;
  const prompts = document.createElement('div');
  prompts.className = 'chatPromptList';
  for (const prompt of copy.prompts) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chatPrompt';
    button.textContent = prompt;
    button.addEventListener('click', () => {
      const input = $('chatTxt');
      if (!input) return;
      input.value = prompt;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.focus();
    });
    prompts.append(button);
  }
  const hint = document.createElement('small');
  hint.textContent = copy.hint;
  empty.append(title, intro, prompts, hint);
  return empty;
}
function renderChatRow(row) {
  if (!row || row.id == null || !chatRowIsRecent(row) || chatRows.has(String(row.id))) return;
  feed.querySelector('.chatEmpty')?.remove();
  chatRows.set(String(row.id), {row, sequence:++chatArrivalSequence});
  while (chatRows.size > 120) chatRows.delete(chatRows.keys().next().value);
  sayUser(row.nick, row.body, row.author_type, row.agent_key, row.created_at, row.id);
}
async function loadChatHistory() {
  if (!sbc) return;
  const generation = ++chatHistoryGeneration, startedSequence = chatArrivalSequence;
  try {
    const { data, error } = await sbc.from('salon_chat').select('id,created_at,nick,body,author_type,agent_key').gte('created_at', new Date(Date.now() - CHAT_RECENT_WINDOW_MS).toISOString()).order('id', { ascending: false }).limit(60);
    if (generation !== chatHistoryGeneration) return;
    if (error) throw error;
    // Keep INSERTs received during the history request, but remove deleted old rows.
    const merged = new Map((data || []).map(row => [String(row.id), row]));
    chatRows.forEach(({row,sequence}, key) => { if (sequence > startedSequence) merged.set(key,row); });
    const rows = [...merged.values()].filter(chatRowIsRecent).sort((a,b) => Number(a.id) - Number(b.id)).slice(-60);
    const view = chatViewport();
    chatRows.clear();
    const nodes = rows.map(row => {
      chatRows.set(String(row.id), {row,sequence:chatArrivalSequence});
      return sayUser(row.nick,row.body,row.author_type,row.agent_key,row.created_at,row.id,false);
    });
    feed.replaceChildren(...(nodes.length ? nodes : [renderChatEmptyState()]));
    restoreChatViewport(view);
    $('chatConnection').textContent = chatRealtimeLabel();
  } catch (error) {
    if (generation === chatHistoryGeneration) $('chatConnection').textContent = '대화 불러오기 지연';
    console.warn('chat history unavailable');
  }
}
function chatWanted() {
  const onLounge = document.querySelector('.tab.on')?.dataset.tab === 'lounge';
  return sbc && !document.hidden && onLounge;
}
async function syncChat() {
  if (chatWanted()) {
    if (!chatChannel) {
      const channel = sbc.channel(`salon-chat-${++chatChannelSeq}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'salon_chat' },
            p => { if (chatChannel === channel) renderChatRow(p.new); });
      chatChannel = channel;
      chatRealtimeState = 'connecting';
      $('chatConnection').textContent = chatRealtimeLabel();
      if (!feed.childElementCount) feed.replaceChildren(renderChatEmptyState());
      // Show recent conversation even when this browser cannot open a realtime socket.
      loadChatHistory();
      armChatConnectionTimer(channel);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED' && chatChannel === channel) {
          chatRealtimeState = 'connected';
          clearTimeout(chatConnectionTimer); chatConnectionTimer = null;
          $('chatConnection').textContent = chatRealtimeLabel();
          loadChatHistory();
        }
        if (chatChannel === channel && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          chatRealtimeState = 'reconnecting';
          $('chatConnection').textContent = chatRealtimeLabel();
          armChatConnectionTimer(channel);
          console.warn('chat realtime', status);
        }
      });
    }
  } else if (chatChannel) {
    const channel = chatChannel; chatChannel = null;
    chatRealtimeState = 'idle';
    clearTimeout(chatConnectionTimer); chatConnectionTimer = null;
    chatHistoryGeneration++;  // Ignore a history response from a closed connection.
    $('chatConnection').textContent = chatRealtimeLabel();
    sbc.removeChannel(channel);   // 백그라운드·타 탭에서는 회선 반납
  }
}
document.addEventListener('visibilitychange', syncChat);
window.syncChat = syncChat;
syncChat();

renderNick();


function spotlight(){ const s=$('spot'); s.classList.remove('go'); void s.offsetWidth; s.classList.add('go'); }

// ═══ split-flap 가격 ═══
let lastFlap = '', lastFlapT = 0;
function setFlap(str) {
  const now = Date.now();
  if (now - lastFlapT < 450) return;
  lastFlapT = now;
  const el = $('livePx');
  if (el.children.length !== str.length || lastFlap.length !== str.length) {
    el.innerHTML = [...str].map(c => `<span>${c}</span>`).join('');
  } else {
    [...str].forEach((c, i) => {
      const sp = el.children[i];
      if (lastFlap[i] !== c) { sp.textContent = c; sp.classList.remove('flap'); void sp.offsetWidth; sp.classList.add('flap'); }
    });
  }
  lastFlap = str;
}

// ═══ 전면 이펙트 레이어 ═══
const fx = $('fx'), fctx = fx.getContext('2d');
const fxP = [];
function sizeFx(){ fx.width = innerWidth; fx.height = innerHeight; if (typeof startFx === 'function' && fxP?.length) startFx(); }
sizeFx(); window.addEventListener('resize', sizeFx);
let fxRaf = null;
function startFx() { if (!fxRaf && tabLive('lounge') && fxP.length) fxRaf = requestAnimationFrame(drawFx); }
function fxBurst({up=true, count=80, colors=['74,222,128'], gravity=0.12, speed=9}) {
  if (!tabLive('lounge')) return;
  count = Math.max(12, Math.round(count * effectQuality));
  for (let i=0; i<count; i++) {
    fxP.push({
      x: Math.random()*fx.width,
      y: up ? fx.height + 10 : -10,
      vx: (Math.random()-.5)*3,
      vy: up ? -(speed*0.6 + Math.random()*speed) : (speed*0.6 + Math.random()*speed),
      g: up ? gravity : gravity*0.4,
      r: 1.5 + Math.random()*3.5,
      col: colors[Math.random()*colors.length|0],
      life: 1,
    });
  }
  const cap = Math.round(120 + 240 * effectQuality);
  if (fxP.length > cap) fxP.splice(0, fxP.length - cap);
  startFx();
}
function drawFx(now = performance.now()){
  fxRaf = null;
  if (!tabLive('lounge')) return;
  sampleEffectLoad(now);
  fctx.clearRect(0,0,fx.width,fx.height);
  for (let i=fxP.length-1; i>=0; i--) {
    const p = fxP[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= 0.012;
    if (p.life <= 0 || p.y > fx.height+30 || p.y < -30) { fxP.splice(i,1); continue; }
    fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, 7);
    fctx.fillStyle = `rgba(${p.col},${p.life*.9})`;
    fctx.fill();
    // 궤적
    fctx.beginPath(); fctx.moveTo(p.x - p.vx*2.5, p.y - p.vy*2.5); fctx.lineTo(p.x, p.y);
    fctx.strokeStyle = `rgba(${p.col},${p.life*.3})`; fctx.lineWidth = p.r*.7; fctx.stroke();
  }
  if (fxP.length) fxRaf = requestAnimationFrame(drawFx);
}
let bannerTimer = null;
function fxBanner(html, color) {
  const b = $('fxBanner');
  b.innerHTML = html; b.style.color = color;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(()=>b.classList.remove('show'), 2000);
}
function vign(color) {
  const v = $('vign');
  v.style.background = `radial-gradient(ellipse at center, transparent 55%, ${color} 130%)`;
  v.style.opacity = .8;
  setTimeout(()=>v.style.opacity = 0, 600);
}
function shakeScreen(){ document.body.classList.add('shake'); setTimeout(()=>document.body.classList.remove('shake'), 550); }
function neonBlast(){ document.body.classList.remove('neon'); void document.body.offsetWidth; document.body.classList.add('neon'); setTimeout(()=>document.body.classList.remove('neon'),1900); }

// 장대봉/돌파 감지 상태
const bodyHist = [], hiHist = [], loHist = [];
let bkUpCool = 0, bkDnCool = 0;

// ═══ 캔들 덱 ═══
const deck = $('deck');
function trimDeck() {
  // 패널 폭에 들어가는 만큼만 유지 (카드 76 + 간격 8)
  // 숨김 탭이면 clientWidth=0 → 잘못된 최솟값으로 줄어드는 것 방지 (넉넉히 20 유지, 복귀 시 재정렬)
  const w = deck.clientWidth;
  const fit = w ? Math.max(4, Math.floor((w - 28 + 8) / 84)) : 20;
  while (deck.children.length > fit) deck.removeChild(deck.firstChild);
}
window.addEventListener('resize', trimDeck);
function dealCard(o, h, l, c, vol, timeMs, avgBody, avgVol, silent) {
  const up = c >= o;
  const bodyPct = Math.abs(c-o)/o*100;
  const {tier} = candleGrade(bodyPct, avgBody);
  const badge = tier === 'epic' ? (up ? '👑' : '💀') : tier === 'rare' ? '★' : '';
  const col = up ? '#4ade80' : '#f87171';
  // 캔들 SVG (덱 카드 안)
  const span = Math.max(h-l, 1e-9);
  const Y = p => 4 + (h-p)/span * 52;
  const bt = Y(Math.max(o,c)), bb = Y(Math.min(o,c));
  const svg = `<svg viewBox="0 0 30 60" width="30" height="58">
    <line x1="15" y1="${Y(h)}" x2="15" y2="${Y(l)}" stroke="${col}" stroke-width="2"/>
    <rect x="8" y="${bt}" width="14" height="${Math.max(2, bb-bt)}" rx="1.5" fill="${col}"/></svg>`;
  const t = new Date(timeMs);
  const el = document.createElement('div');
  el.className = `card deal r-${tier}` + (tier==='epic' && !up ? ' dn-epic' : '');
  el.style.setProperty('--tilt', ((Math.random()*4)-2).toFixed(1) + 'deg');
  el.innerHTML = `<div class="cardI">
    <div class="cf back">T·S</div>
    <div class="cf front">${badge ? `<span class="badge">${badge}</span>` : ''}
      <span class="ct num">${['1d','1w','1M'].includes(chartTf) ? `${t.getMonth()+1}/${t.getDate()}` : `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`}</span>
      ${svg}
      <span class="cv num" style="color:${col}">${up?'+':''}${((c/o-1)*100).toFixed(2)}%</span>
      <div class="cvol"><i style="width:${Math.min(100, avgVol>0 ? vol/avgVol*50 : 30)}%;background:${col}"></i></div>
    </div></div>`;
  // ? 카드(다음 봉 자리) 앞에 끼워넣기 — ?는 항상 맨 오른쪽
  deck.insertBefore(el, nextCardEl && nextCardEl.parentElement === deck ? nextCardEl : null);
  trimDeck();
  // 리시드(과거 카드 재생성)는 조용히 — 알림·연출·플립 애니메이션 없음
  if (silent) return;
  // 뒷면 딜 → 플립 공개 (에픽은 예고 진동 후)
  if (tier === 'epic') {
    el.classList.add('pre-epic');
    setTimeout(() => { el.classList.remove('pre-epic'); el.classList.add('flipped'); spotlight(); neonBlast(); }, 1400);
  } else {
    setTimeout(() => el.classList.add('flipped'), 650);
  }
  if (tier === 'epic') say('sys','', `🃏 ${up?'👑 <b class="gold">전설의 양봉 카드</b>':'💀 <b class="dn">파멸의 음봉 카드</b>'} 등장 (${up?'+':''}${((c/o-1)*100).toFixed(2)}%)`);
}

function onCandleClose(k) {
  const o=+k.o, c=+k.c, h=+k.h, l=+k.l;
  const bodyPct = Math.abs(c-o)/o*100;
  const avg = bodyHist.length >= 10 ? bodyHist.reduce((a,b)=>a+b,0)/bodyHist.length : 0.06;
  const th = Math.max(avg*3.2, 0.15);
  if (bodyPct >= th) {
    const up = c >= o;
    if (up) {
      fxBurst({up:true, count:Math.min(220, 90+bodyPct*120), colors:['74,222,128','212,175,55'], speed:11});
      vign('rgba(74,222,128,.35)');
      fxBanner(`▲ 장대양봉<small class="num">+${bodyPct.toFixed(2)}% / 1분</small>`, '#4ade80');
      say('sys','', `🚀 <b class="up">장대양봉</b> +${bodyPct.toFixed(2)}% (1분)`);
    } else {
      fxBurst({up:false, count:Math.min(220, 90+bodyPct*120), colors:['248,113,113'], speed:12});
      vign('rgba(248,113,113,.4)');
      shakeScreen();
      fxBanner(`▼ 장대음봉<small class="num">-${bodyPct.toFixed(2)}% / 1분</small>`, '#f87171');
      say('sys','', `🔻 <b class="dn">장대음봉</b> -${bodyPct.toFixed(2)}% (1분)`);
    }
  }
  bodyHist.push(bodyPct); if (bodyHist.length > 30) bodyHist.shift();
  hiHist.push(h); if (hiHist.length > 60) hiHist.shift();
  loHist.push(l); if (loHist.length > 60) loHist.shift();
}
function checkBreakout(px) {
  const now = Date.now();
  if (hiHist.length < 30) return;
  const hi = Math.max(...hiHist), lo = Math.min(...loHist);
  if (px > hi && now > bkUpCool) {
    bkUpCool = now + 180000;
    fxBurst({up:true, count:160, colors:['212,175,55','255,236,170'], speed:10, gravity:.09});
    vign('rgba(212,175,55,.35)');
    fxBanner(`▲ 60분 고점 돌파<small class="num">${fmt(px,0)}</small>`, '#d4af37');
    say('sys','', `⚡ <b class="gold">60분 고점 돌파</b> <span class="num">${fmt(px,0)}</span>`);
  } else if (px < lo && now > bkDnCool) {
    bkDnCool = now + 180000;
    fxBurst({up:false, count:160, colors:['248,113,113','120,20,20'], speed:13});
    vign('rgba(248,113,113,.5)');
    shakeScreen();
    fxBanner(`▼ 60분 저점 붕괴<small class="num">${fmt(px,0)}</small>`, '#f87171');
    say('sys','', `🕳 <b class="dn">60분 저점 붕괴</b> <span class="num">${fmt(px,0)}</span>`);
  }
}

// ═══ 관전 카지노 — Pit Boss · 코인 경마장 ═══
const moneyShort = n => n >= 1e9 ? '$' + (n/1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + (n/1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + (n/1e3).toFixed(0) + 'K' : '$' + Math.round(n);
const mmss = ms => {
  const s = Math.max(0, Math.ceil(ms/1000));
  return String(s/60|0).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
};

// 청산을 실제 캔들 시각에 맞춰 붙인다. 예전에는 시간대별 초 단위로 직접 나눠 버킷을 만들었는데,
// 그 표에 주봉·월봉이 없어 두 시간대에서는 청산 마커가 통째로 사라졌고(길이가 일정하지 않아 초로 못 나눈다),
// 한 캔들에 여러 버킷이 겹쳐 같은 자리에 점이 포개지기도 했다. 캔들에 직접 맞추면 둘 다 생기지 않는다.
function snapToBar(timestamp) {
  const bars = chartSeed[0];
  if (!Array.isArray(bars) || !bars.length) return null;
  const t = Math.floor(timestamp / 1000);
  if (t < bars[0][0] / 1000) return null;
  let lo = 0, hi = bars.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bars[mid][0] / 1000 <= t) lo = mid; else hi = mid - 1; }
  return bars[lo][0] / 1000;
}
// 차트 마커 전용 장부. 과거 청산을 계속 보관해 차트에 표시한다.
const MARKER_HISTORY_DAYS = 30;      // 수집기가 쌓아 둔 만큼
const MARKER_ROW_FLOOR = 1000000;    // 이보다 작은 전표는 받아오지 않는다 (합계에 거의 영향 없음)
const MARKER_MIN_USD = 10000000;     // 한 캔들에 이만큼 모여야 마커를 찍는다
const liquidationLedger = new Map();
const whaleLedger = new Map();       // 접속 전에 지나간 고래까지 (실시간 whaleBuckets 과 합쳐 쓴다)
function recordWhaleForChart(row) {
  if (row?.event_type !== 'whale' || !row.event_key) return false;
  const usd = +row.amount_usd || 0; if (usd <= 0) return false;
  whaleLedger.set(row.event_key, { at:+new Date(row.event_time), usd, buy:String(row.side||'').toLowerCase() === 'buy' });
  return true;
}
function recordLiquidationForChart(row) {
  if (row?.event_type !== 'liquidation' || !row.event_key) return false;
  const meta = row.metadata || {};
  const long = +meta.long_usd || 0, short = +meta.short_usd || 0;
  if (long + short <= 0) return false;
  liquidationLedger.set(row.event_key, { at:+new Date(row.event_time), long, short });
  return true;
}
// 지표 발표. reports/econ_calendar.json 은 발표장 탭이 쓰는 같은 파일이고,
// 이미 관측된 발표에는 발표 직후 BTC 가 얼마나 움직였는지(m5/m15/m60)가 들어 있다.
const MACRO_GRADES = { VIP:4e12, MAIN:2e12 };   // 라벨 우선순위 — 드물고 중요하므로 청산보다 앞세운다
let macroMarkers = [];
function rebuildMacroMarkers() {
  const events = Array.isArray(macroData?.events) ? macroData.events : [];
  macroMarkers = events.map(e => {
    const weight = MACRO_GRADES[e?.importance]; if (!weight) return null;      // SIDE 는 찍지 않는다
    const at = +new Date(e.scheduled_at); if (!Number.isFinite(at) || at > Date.now()) return null;
    const time = snapToBar(at); if (time === null) return null;
    const btc = e.btc || {}, move = [btc.m60, btc.m15, btc.m5].find(v => Number.isFinite(+v));
    const label = `📅 ${e.code || e.title || ''}`;
    return { time, position:'aboveBar', color:'#d4af37', shape:'square', weight,
             text: move === undefined ? label : `${label} ${move>0?'+':''}${(+move).toFixed(2)}%` };
  }).filter(Boolean).sort((a,b) => a.time - b.time);
}
function rebuildLiquidationMarkers() {
  const grouped = new Map();
  liquidationLedger.forEach(item => {
    const time = snapToBar(item.at); if (time === null) return;
    const current = grouped.get(time) || { time, long:0, short:0 };
    current.long += item.long; current.short += item.short;
    grouped.set(time, current);
  });
  // 개수는 제한하지 않는다 — 화면에 들어오는 만큼 과거까지 보여 준다. 대신 한 캔들에
  // 모인 금액이 기준을 넘어야 찍는다. 캔들이 길수록 더 쉽게 넘으므로 긴 시간대에서
  // 자연히 더 많이 보이고, 1분봉에서는 정말 큰 순간만 남는다.
  liquidationMarkers = [...grouped.values()]
    .filter(item => item.long + item.short >= MARKER_MIN_USD)
    .sort((a,b) => a.time - b.time)
    .map(item => {
      const longWipeout = item.long >= item.short, total = item.long + item.short;
      return { time:item.time, position:longWipeout?'aboveBar':'belowBar', color:longWipeout?'#f87171':'#4ade80', shape:'circle',
               weight:total, text:`${longWipeout?'🩸':'⚡'} ${moneyShort(total)}` };
    });
}

function applyMarketEvent(row) {
  if (!row?.event_key) return;
  if (recordLiquidationForChart(row)) { rebuildLiquidationMarkers(); renderBtcMarkers(); }
  if (recordWhaleForChart(row)) renderBtcMarkers();
}

// 차트 마커용 청산 이력 — 최근 24시간에 한정하지 않고 수집된 만큼 받는다.
// 표시 기준보다 훨씬 작은 전표는 서버에서 걸러 받는 양을 줄인다.
async function loadLiquidationLedger() {
  if (!sbc) return;
  const since = new Date(Date.now() - MARKER_HISTORY_DAYS * 86400000).toISOString();
  const { data, error } = await sbc.from('market_events')
    .select('event_key,event_type,event_time,metadata')
    .eq('event_type','liquidation').gte('amount_usd', MARKER_ROW_FLOOR)
    .gte('event_time', since).order('event_time', {ascending:false}).limit(5000);
  if (error) { console.warn('liquidation history unavailable'); return; }
  (data || []).forEach(recordLiquidationForChart);
  rebuildLiquidationMarkers(); renderBtcMarkers();
  loadWhaleLedger(); loadMacroMarkers();
}

// 고래 이력 — 실시간 회선은 접속한 뒤의 체결만 주므로 지나간 것은 따로 받는다.
async function loadWhaleLedger() {
  if (!sbc) return;
  const since = new Date(Date.now() - MARKER_HISTORY_DAYS * 86400000).toISOString();
  const { data, error } = await sbc.from('market_events')
    .select('event_key,event_type,event_time,side,amount_usd')
    .eq('event_type','whale').gte('event_time', since).order('event_time', {ascending:false}).limit(2000);
  if (error) { console.warn('whale history unavailable'); return; }
  (data || []).forEach(recordWhaleForChart);
  renderBtcMarkers();
}

// 지표 발표 — 발표장 탭과 같은 파일. 라운지에서도 한 번은 받아야 차트에 찍을 수 있다.
async function loadMacroMarkers() {
  if (!macroData) { try { await macroLoad(); } catch(e) { return; } }
  rebuildMacroMarkers(); renderBtcMarkers();
}

function subscribeMarketEvents() {
  if (!sbc) return;
  loadLiquidationLedger();
  sbc.channel('market-events-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', {event:'*', schema:'public', table:'market_events'}, payload => applyMarketEvent(payload.new))
    .subscribe();
}

subscribeMarketEvents();

const RACE_COINS = ['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','LINK'];
const race = Object.fromEntries(RACE_COINS.map(s => [s,{start:null,last:null,openTime:null}]));
let raceRoundEnd = (Math.floor(Date.now()/300000)+1)*300000;
function buildRace() {
  const rows = $('raceRows'); rows.textContent = '';
  RACE_COINS.forEach(sym => {
    const row = document.createElement('div'); row.className = 'raceRow'; row.dataset.sym = sym;
    const coin = document.createElement('span'); coin.className = 'raceCoin'; coin.textContent = sym;
    const track = document.createElement('div'); track.className = 'raceTrack';
    const runner = document.createElement('i'); runner.className = 'raceRunner'; runner.textContent = '●'; track.appendChild(runner);
    const pct = document.createElement('span'); pct.className = 'racePct num'; pct.textContent = '—';
    row.append(coin,track,pct); rows.appendChild(row);
  });
}
function raceValues() {
  const roundStart = raceRoundEnd - 300000;
  return RACE_COINS.map(sym => ({sym, pct:race[sym].openTime === roundStart && Number.isFinite(race[sym].start) && race[sym].start > 0 && Number.isFinite(race[sym].last) ? (race[sym].last/race[sym].start-1)*100 : null})).sort((a,b)=>(b.pct ?? -Infinity)-(a.pct ?? -Infinity));
}
function renderRace() {
  const vals = raceValues(), ready = vals.filter(v=>Number.isFinite(v.pct)), maxAbs = Math.max(.05,...ready.map(x=>Math.abs(x.pct)));
  vals.forEach((v, rank) => {
    const row = document.querySelector(`.raceRow[data-sym="${v.sym}"]`); if (!row) return;
    row.style.order = rank; row.classList.toggle('leader', ready.length > 0 && v === ready[0]);
    const runner = row.querySelector('.raceRunner'), pct = row.querySelector('.racePct');
    if (!Number.isFinite(v.pct)) { runner.style.left = '50%'; pct.textContent = '—'; pct.className = 'racePct num'; return; }
    runner.style.left = (5 + (v.pct/maxAbs+1)*43) + '%';
    pct.textContent = (v.pct>=0?'+':'') + v.pct.toFixed(2) + '%'; pct.className = 'racePct num ' + (v.pct>=0?'up':'dn');
  });
  if (!ready.length) {
    $('raceLeader').textContent = '시세 연결 중';
    $('raceClock').textContent = mmss(raceRoundEnd-Date.now());
    return;
  }
  const lead = ready[0];
  const spread = lead.pct - (ready[1]?.pct ?? lead.pct);
  $('raceLeader').textContent = `${lead.sym} 선두 · 격차 ${spread.toFixed(2)}%p`;
  $('raceClock').textContent = mmss(raceRoundEnd-Date.now());
}
buildRace(); renderRace();
let wsRace = null;
const RACE_STREAMS = RACE_COINS.map(sym => `${sym.toLowerCase()}usdt@kline_5m`).join('/');
function applyRaceSnapshot(symbol, candle) {
  if (!RACE_COINS.includes(symbol) || !Array.isArray(candle)) return false;
  const openTime = Number(candle[0]), open = Number(candle[1]), close = Number(candle[4]), end = Number(candle[6]);
  if (![openTime,open,close,end].every(Number.isFinite) || open <= 0 || close <= 0 || end < openTime || end + 1 < Date.now() - 5000) return false;
  if (openTime < raceRoundEnd - 300000) return false;
  const state = race[symbol];
  if (state.openTime !== null && state.openTime > openTime) return false;
  if (state.openTime === openTime && state.last !== null) return false;
  state.start = open;
  state.last = close;
  state.openTime = openTime;
  raceRoundEnd = end + 1;
  renderRace();
  return true;
}
function applyRaceKline(data) {
  const k = data?.k, symbol = String(k?.s || '').replace(/USDT$/, '');
  if (!RACE_COINS.includes(symbol)) return;
  const openTime = Number(k.t), open = Number(k.o), close = Number(k.c), end = Number(k.T);
  if (![openTime,open,close,end].every(Number.isFinite) || open <= 0 || close <= 0 || end < openTime || end + 1 < Date.now() - 5000 || openTime < raceRoundEnd - 300000) return;
  const state = race[symbol];
  if (state.openTime !== null && openTime < state.openTime) return;
  if (state.openTime !== openTime) {
    state.start = open;
    state.openTime = openTime;
  }
  state.last = close;
  raceRoundEnd = end + 1;
}
let raceSnapshotRequested = false;
async function bootstrapRaceSnapshot() {
  await Promise.all(RACE_COINS.map(async symbol => {
    if (race[symbol].last !== null) return;
    try {
      const response = await fetch(`${SPOT_DATA_API}/klines?symbol=${symbol}USDT&interval=5m&limit=1`, {cache:'no-store'});
      if (!response.ok) return;
      const candles = await response.json();
      if (Array.isArray(candles?.[0])) applyRaceSnapshot(symbol, candles[0]);
    } catch (_) {}
  }));
}
function connectRaceWS() {
  if (!tabLive('lounge') || wsRace) return;
  if (!raceSnapshotRequested) { raceSnapshotRequested = true; bootstrapRaceSnapshot(); }
  wsRace = new WebSocket('wss://stream.binance.com:9443/stream?streams=' + RACE_STREAMS);
  wsRace.onmessage = ev => {
    if (!tabLive('lounge')) return;
    const payload = JSON.parse(ev.data), data = payload?.data;
    if (data?.e !== 'kline' || data?.k?.i !== '5m') return;
    applyRaceKline(data);
  };
  wsRace.onclose = () => { wsRace = null; if (tabLive('lounge')) setTimeout(connectRaceWS, 1800); };
}
function disconnectRaceWS() {
  if (wsRace) { wsRace.onmessage = null; wsRace.onclose = null; try { wsRace.close(); } catch(e) {} }
  wsRace = null;
}
setInterval(() => {
  if (!tabLive('lounge')) return;
  if (Date.now() >= raceRoundEnd) raceRoundEnd = (Math.floor(Date.now()/300000)+1)*300000;
  renderRace();
}, 1000);

// ═══ 바이낸스 웹소켓 ═══
// ═══ 호가창 (order book) — 매도벽·매수벽 + 체결 시 붕괴 ═══
const BOOK_ROWS = 8;
let bookAsks = [], bookBids = [];
const bookAskEl = $('bookAsks'), bookBidEl = $('bookBids');
(function buildBook() {
  for (const [el, side] of [[bookAskEl, 'ask'], [bookBidEl, 'bid']]) {
    for (let i = 0; i < BOOK_ROWS; i++) {
      const r = document.createElement('div'); r.className = 'bookRow ' + side;
      r.innerHTML = '<div class="bar"></div><span class="px"></span><span class="sz"></span>';
      el.appendChild(r);
    }
  }
})();
function renderBook() {
  if (!bookAsks.length || !bookBids.length) return;
  const asks = bookAsks.slice(0, BOOK_ROWS), bids = bookBids.slice(0, BOOK_ROWS);
  const maxSz = Math.max(...asks.map(a => +a[1]), ...bids.map(b => +b[1]), 1e-9);
  const ar = bookAskEl.children;
  for (let i = 0; i < BOOK_ROWS; i++) {
    const a = asks[BOOK_ROWS - 1 - i], row = ar[i];   // 위=먼(높은)가격, 아래=mid에 가까운 최저가
    if (!a) { row.style.visibility = 'hidden'; continue; }
    row.style.visibility = ''; row.querySelector('.px').textContent = (+a[0]).toFixed(1);
    row.querySelector('.sz').textContent = (+a[1]).toFixed(3);
    row.querySelector('.bar').style.width = (+a[1] / maxSz * 100) + '%';
  }
  const br = bookBidEl.children;
  for (let i = 0; i < BOOK_ROWS; i++) {
    const b = bids[i], row = br[i];   // 위=최고가(mid에 가까움)
    if (!b) { row.style.visibility = 'hidden'; continue; }
    row.style.visibility = ''; row.querySelector('.px').textContent = (+b[0]).toFixed(1);
    row.querySelector('.sz').textContent = (+b[1]).toFixed(3);
    row.querySelector('.bar').style.width = (+b[1] / maxSz * 100) + '%';
  }
  const mid = (+asks[0][0] + +bids[0][0]) / 2, spread = (+asks[0][0] - +bids[0][0]);
  $('bookMidPx').textContent = fmt(mid, 1);
  $('bookSpread').textContent = '스프레드 ' + spread.toFixed(1);
}
function bookBreak(rowEl, usd) {
  if (document.hidden || !rowEl || rowEl.style.visibility === 'hidden') return;
  rowEl.classList.remove('break'); void rowEl.offsetWidth; rowEl.classList.add('break');
  const panel = $('bookPanel'), pr = panel.getBoundingClientRect(), rect = rowEl.getBoundingClientRect();
  const n = Math.max(2, Math.round(Math.min(12, 4 + Math.floor(usd / 40000)) * effectQuality));
  const isAsk = rowEl.classList.contains('ask');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'shard';
    s.style.background = isAsk ? '#f87171' : '#4ade80';
    s.style.left = (rect.left - pr.left + rect.width * (0.3 + Math.random() * 0.5)) + 'px';
    s.style.top = (rect.top - pr.top + 6) + 'px';
    panel.appendChild(s);
    const ang = Math.random() * Math.PI * 2, d = 14 + Math.random() * 34;
    requestAnimationFrame(() => {
      s.style.transition = 'transform .5s ease-out, opacity .5s ease-out';
      s.style.transform = `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d + 8}px) rotate(${Math.random()*180|0}deg)`;
      s.style.opacity = '0';
    });
    setTimeout(() => s.remove(), 540);
  }
}
function bookHit(usd, isBuy) {
  // 시장가 매수 → 매도벽(ask) 최저가부터 / 매도 → 매수벽(bid) 최고가부터 소비
  const rows = isBuy ? [...bookAskEl.children].reverse() : [...bookBidEl.children];
  const hitN = effectQuality < .7 ? 1 : usd >= 250000 ? 3 : usd >= 60000 ? 2 : 1;
  let done = 0;
  for (const row of rows) { if (row.style.visibility === 'hidden') continue; bookBreak(row, usd); if (++done >= hitN) break; }
}

let ws = null, marketUiTimer = null, depthUiTimer = null, pendingMarketUi = null;
function queueMarketUi(px, isBuy) {
  pendingMarketUi = {px,isBuy};
  if (marketUiTimer) return;
  marketUiTimer = setTimeout(() => {
    marketUiTimer = null;
    const next = pendingMarketUi; pendingMarketUi = null;
    if (!next || !tabLive('lounge')) return;
    const {px,isBuy} = next;
    updateHomeQuote(px, dayOpen ? (px / dayOpen - 1) * 100 : null);
    setFlap(fmt(px, 1));
    $('livePx').style.color = isBuy ? 'var(--grn)' : 'var(--red)';
    if (dayOpen) {
      const chg = (px/dayOpen - 1) * 100;
      $('liveChg').textContent = (chg>=0?'+':'') + chg.toFixed(2) + '% (24h)';
      $('liveChg').className = 'num ' + (chg>=0?'up':'dn');
    }

  }, 120);
}
function queueDepthUi() {
  if (depthUiTimer) return;
  depthUiTimer = setTimeout(() => { depthUiTimer = null; if (tabLive('lounge')) renderBook(); }, 180);
}
function connectMainWS() {
  if (!tabLive('lounge') || ws) return;
  ws = new WebSocket('wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/btcusdt@kline_1m/btcusdt@depth20@100ms');
  ws.onmessage = ev => {
  if (!tabLive('lounge')) return;
  const { stream, data } = JSON.parse(ev.data);
  if (stream.endsWith('aggTrade')) {
    const px = +data.p, qty = +data.q, val = px*qty, isBuy = !data.m;
    queueMarketUi(px, isBuy);
    queueTapeVisual(val, isBuy);
    checkBreakout(px);
    if (isBuy) buyVol += val; else sellVol += val;
    if (val >= 500000) {
      recordWhaleFootprint(val, isBuy, data.T || Date.now());
      say('sys', '', `🐳 ${isBuy?'매수':'매도'} <b class="num ${isBuy?'up':'dn'}">$${fmt(val/1000)}K</b> — 큰손 등장`);
    }
  } else if (stream.endsWith('depth20@100ms')) {
    bookAsks = data.asks; bookBids = data.bids; queueDepthUi();
  } else if (stream === 'btcusdt@kline_1m') {
    // 이펙트·베팅 판정은 항상 BTC 1분 기준 (차트 표시는 wsChart가 담당)
    if (data.k.x) onCandleClose(data.k);
  }
  };
  ws.onclose = () => { ws = null; if (tabLive('lounge')) setTimeout(connectMainWS, 1500); };
}
function disconnectMainWS() {
  if (ws) { ws.onmessage = null; ws.onclose = null; try { ws.close(); } catch(e) {} }
  ws = null; clearTimeout(marketUiTimer); clearTimeout(depthUiTimer); marketUiTimer = depthUiTimer = null; pendingMarketUi = null;
}
// ═══ 데모 모드 (?demo) — 이펙트 자동 시연 ═══
function runDemo() {
  const demoSteps = [
    [2500, () => { say('sys','','🎬 <b class="gold">이펙트 데모 시작</b> — 실제로는 시장 이벤트에 반응합니다');
                   // 고래 몇 마리 투하
                   for (let i=0;i<6;i++) setTimeout(()=>spawnDrop(400000+Math.random()*2000000, Math.random()>.4), i*350); }],
    [5000, () => { fxBurst({up:true, count:200, colors:['74,222,128','212,175,55'], speed:11});
                   vign('rgba(74,222,128,.35)');
                   fxBanner('▲ 장대양봉<small class="num">+0.42% / 1분</small>', '#4ade80'); }],
    [9000, () => { fxBurst({up:true, count:160, colors:['212,175,55','255,236,170'], speed:10, gravity:.09});
                   vign('rgba(212,175,55,.35)');
                   fxBanner('▲ 60분 고점 돌파<small class="num">64,850</small>', '#d4af37'); }],
    [13000, () => { fxBurst({up:false, count:200, colors:['248,113,113'], speed:12});
                    vign('rgba(248,113,113,.4)'); shakeScreen();
                    fxBanner('▼ 장대음봉<small class="num">-0.51% / 1분</small>', '#f87171'); }],
    [17000, () => { fxBurst({up:false, count:160, colors:['248,113,113','120,20,20'], speed:13});
                    vign('rgba(248,113,113,.5)'); shakeScreen();
                    fxBanner('▼ 60분 저점 붕괴<small class="num">62,100</small>', '#f87171');
                    const f=$('liqFlash'); f.textContent='💥 롱 청산 $842K'; f.style.color='var(--red)';
                    f.style.opacity=1; setTimeout(()=>f.style.opacity=0,1800);
                    addRainRing({x:rain.width*.3, y:120, r:4, max:150, side:false}); }],
    [18000, () => { spotlight(); neonBlast(); }],
    [19500, () => { const now = Date.now();
                    dealCard(64000, 64580, 63980, 64520, 999, now, 0.04, 400);
                    say('sys','','🃏 (데모) 전설의 양봉 카드가 딜리는 모습'); }],
    [22000, () => say('sys','','🎬 데모 끝 — 이후는 전부 실시간 시장입니다')],
  ];
  demoSteps.forEach(([t, fn]) => setTimeout(fn, t));
}
if (location.search.includes('demo') || location.hash.includes('demo')) runDemo();


// ═══ 🎰 블라인드 차트 게임 ═══
const BG_POOL = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','LTCUSDT','LINKUSDT','AVAXUSDT','TRXUSDT','XLMUSDT','ATOMUSDT','UNIUSDT','ETCUSDT','FILUSDT','NEARUSDT','SANDUSDT','MANAUSDT','AAVEUSDT','ALGOUSDT','VETUSDT','EOSUSDT','XTZUSDT','CHZUSDT'];
const BG_HIST = 800, BG_PLAY = 200, BG_TOTAL = BG_HIST + BG_PLAY;   // 1000 = Binance klines 1회 상한
// 상장이 늦은 종목은 1000봉이 안 나온다 — 받은 만큼만 쓰되 최소 이 정도는 있어야 판을 연다
const BG_MIN_TOTAL = BG_PLAY + 260;
// 미국주식은 브라우저에서 Yahoo CORS 불가 → 서버가 전체 이력을 받아 만든 번들(reports/stocks.json)을 1회 로드
let stockBundle = null;
async function loadStockBundle() {
  if (stockBundle) return stockBundle;
  const r = await fetch('reports/stocks.json');
  if (!r.ok) throw new Error('bundle fetch ' + r.status);
  stockBundle = await r.json();
  return stockBundle;
}
// 종목 배열에서 endMs(이하) 마지막 캔들 기준 460봉 슬라이스 (부족하면 null)
function stockSlice(arr, endMs) {
  let endIdx = -1;
  for (let i = 0; i < arr.length; i++) { if (arr[i][0] <= endMs) endIdx = i; else break; }
  if (endIdx < BG_TOTAL - 1) return null;
  return arr.slice(endIdx - BG_TOTAL + 1, endIdx + 1);
}
const BG_VIEW_BARS = 140;   // 판에 앉았을 때 처음 보이는 캔들 수
const BG_FEE_RATE = 0.001;
const BG_MAX_LEVERAGE = 10;
const BG_LEV_STEPS = [1, 2, 3, 5, 10];
const BG_MMR = 0.005;   // 유지증거금률 0.5% · 격리 마진
let bgCh = null, bgS = null, bgMA = null, bgVol = null, bgST = null, bgOsc = null, bg = null, bgPct = 25, bgLev = 1, bgMode = 'solo';
function resizeBlindCharts(forceRepaint = true) {
  const el = $('bgChart');
  if (!bgCh || !el?.isConnected) return false;
  const width = el.clientWidth, height = el.clientHeight;
  if (width < 1 || height < 1) return false;
  bgCh.resize(width, height, forceRepaint);
  bgOsc?.resize();
  return true;
}
let bgResizeTimer = null;
let bgRecoveryTimers = [];
function scheduleBlindChartResize() {
  if (!bgCh) return;
  let passes = 0;
  const resize = () => { resizeBlindCharts(true); passes++; if (passes < 2) requestAnimationFrame(resize); };
  requestAnimationFrame(() => requestAnimationFrame(resize));
  clearTimeout(bgResizeTimer);
  bgResizeTimer = setTimeout(() => resizeBlindCharts(true), 160);
}
function bgChartRecover() {
  if (!bgCh || !bgS) return;
  const range = bgCh.timeScale().getVisibleLogicalRange();
  if (bg) {
    const visible = bg.norm.slice(0, bg.idx + 1);
    bgS.setData(visible);
    bgMASet(); bgVolSet();
    const markers = [...(bg.markers || [])];
    if (bg.gameMode === 'study' && bg.over && typeof studyOpinionMarkers === 'function') markers.push(...studyOpinionMarkers());
    bgS.setMarkers(markers.sort((a,b) => a.time - b.time));
    if (range) {
      try { bgCh.timeScale().setVisibleLogicalRange(range); }
      catch { chartShowRecent(bgCh, visible.length, BG_VIEW_BARS); }
    } else chartShowRecent(bgCh, visible.length, BG_VIEW_BARS);
  }
  scheduleBlindChartResize();
}
function scheduleBlindChartRecovery() {
  scheduleBlindChartResize();
  if (!bgCh || !bg) return;
  bgRecoveryTimers.forEach(clearTimeout);
  bgRecoveryTimers = [];
  const generation = bgLoadGeneration;
  // Some mobile WebViews report their final canvas size only after the page transition.
  // Re-seed the revealed series after layout settles; this never advances the round.
  for (const delay of [180, 650, 1400]) {
    bgRecoveryTimers.push(setTimeout(() => {
      if (!bgCh || !bg || document.hidden || generation !== bgLoadGeneration) return;
      bgChartRecover();
    }, delay));
  }
}
window.addEventListener('resize', scheduleBlindChartRecovery, {passive:true});
window.addEventListener('orientationchange', scheduleBlindChartRecovery, {passive:true});
window.addEventListener('pageshow', scheduleBlindChartRecovery);
window.visualViewport?.addEventListener('resize', scheduleBlindChartRecovery, {passive:true});
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleBlindChartRecovery(); });
let bgLoadGeneration = 0;
const bgDailyQuery = new URLSearchParams(location.search).get('daily');
const bgStartRequested = new URLSearchParams(location.search).get('start') === '1';
let bgDailySelection = null;
function bgSaveDailyProgress() {
  if (!bg || bg.gameMode !== 'daily' || bg.over || !bg.daily) return false;
  const dayIndex = bg.idx - bg.base;
  if (!Number.isSafeInteger(dayIndex) || dayIndex < 0 || dayIndex >= BG_PLAY) return false;
  try {
    return window.BlindDaily.writeProgress(window.localStorage, {
      schema: 1, day: bg.daily.day, roundVersion: bg.daily.version, symbol: bg.sym,
      dayIndex, wallet: bg.wallet, pos: bg.pos ? { ...bg.pos } : null,
      trades: bg.trades.map(t => ({ day: t.day, side: t.side, intent: t.intent, px: t.px, amt: t.amt, fee: t.fee, lev: t.lev })),
      speed: bgSpeed, orderPct: bgPct, leverage: bgLev, elapsedMs: bg.elapsedMs || 0,
    });
  } catch { return false; }
}
function bgClearDailyProgress(selection = bg?.daily || bgDailySelection) {
  if (!selection?.day || !selection?.version) return false;
  try { return window.BlindDaily.clearProgress(window.localStorage, selection.day, selection.version); }
  catch { return false; }
}
function bgDailyMarkersFromTrades(trades, norm, base) {
  return [...trades].reverse().map(t => {
    const candle = norm[base + Math.max(0, Math.min(BG_PLAY, t.day))];
    if (!candle) return null;
    const buy = t.side === 'BUY', liq = t.intent === 'LIQ';
    return { time: candle.time, position: liq ? (buy ? 'aboveBar' : 'belowBar') : (buy ? 'belowBar' : 'aboveBar'),
      color: liq || !buy ? '#f87171' : '#4ade80', shape: buy ? 'arrowUp' : 'arrowDown', text: liq ? '청산' : buy ? 'B' : 'S' };
  }).filter(Boolean);
}
window.addEventListener('pagehide', bgSaveDailyProgress);
document.addEventListener('visibilitychange', () => { if (document.hidden) bgSaveDailyProgress(); });
function bgPctSync(v) {
  v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  bgPct = v;
  $('bgPctSlider').value = v; $('bgPctNum').value = v;
  $('bgPctFill').style.width = v + '%';
  $('bgBuyCustom').textContent = `롱 ${v}%` + (bgLev > 1 ? ` ${bgLev}×` : '');
  $('bgSellCustom').textContent = `숏 ${v}%` + (bgLev > 1 ? ` ${bgLev}×` : '');
}
window.bgPctSync = bgPctSync;

function bgLevRender() {
  $('bgLevVal').textContent = bgLev + '×';
  $('bgLevVal').style.color = bgLev >= 5 ? '#f87171' : 'var(--gold)';
  $('bgLevRow').innerHTML = BG_LEV_STEPS.map(x =>
    `<div class="lv${x === bgLev ? ' on' : ''}${x === bgLev && x >= 5 ? ' hot' : ''}" onclick="bgLevSync(${x})">${x}×</div>`
  ).join('');
  bgPctSync(bgPct);
  if (bg) blindStatus();
}
function bgLevSync(v) {
  v = Math.max(1, Math.min(BG_MAX_LEVERAGE, Math.round(Number(v) || 1)));
  const open = bg && !bg.over && bg.pos;
  if (open && bg.gameMode === 'study') { studySetLeverage(v); return; }
  if (open && !bgApplyLeverage(v)) {
    bgOrderMsg(`${v}배로 내리려면 증거금이 더 필요합니다`);
    bgLevRender();
    return;
  }
  bgLev = v;
  bgOrderMsg('');
  bgLevRender();
}
window.bgLevSync = bgLevSync;

function blindOpen() {
  if (!bgCh) {
    requestAnimationFrame(() => {
      const el = $('bgChart');
      bgCh = LightweightCharts.createChart(el, {
        layout: { background: { color: '#12151c' }, textColor: '#6b7280', fontSize: 10 },
        grid: { vertLines: { color: '#1a1f2b' }, horzLines: { color: '#1a1f2b' } },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: '#232838' },
        // 날짜는 숨기되 좌우 탐색은 허용 — 시리즈에는 진행된 날짜까지만 들어가고
        // 여백에는 캔들이 없으므로 미래 시세는 볼 수 없다
        timeScale: { visible: false, fixLeftEdge: true, minBarSpacing: 0.6, rightOffset: CHART_RIGHT_PAD, shiftVisibleRangeOnNewBar: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: true },
      });
      bgS = bgCh.addCandlestickSeries({
        upColor: '#4ade80', downColor: '#f87171', borderVisible: false,
        wickUpColor: '#4ade80', wickDownColor: '#f87171',
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      bgMA = MA_DEFS.map(([p, c]) => bgCh.addLineSeries({
        color: c, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      }));
      bgST = makeSupertrend(bgCh);
      bgOsc = makeOscillators(bgCh,bgS,el,true);
      bgVol = bgCh.addHistogramSeries({
        priceFormat: { type: 'volume' }, priceScaleId: '', priceLineVisible: false, lastValueVisible: false,
      });
      bgVol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });   // 하단 16%에 거래량 오버레이
      bgCh.resize(el.clientWidth, el.clientHeight || 480);
      new ResizeObserver(() => resizeBlindCharts(true)).observe(el);
      scheduleBlindChartResize();
    });
  }
  const best = localStorage.getItem('salonBlindBest');
  if (best !== null) $('bgBest').textContent = `최고 기록 ${(+best >= 0 ? '+' : '')}${(+best).toFixed(1)}%`;
  bgLevRender();
  if (bgMode === 'study') { studyOpen(); return; }
  $('bgStudyPanel').classList.add('hidden');
  $('bgTrackRow').classList.toggle('hidden', bgMode === 'daily');
  $('bgPlayRow').classList.remove('hidden'); $('bgSoloFinish').classList.remove('hidden');
  $('bgModeDesc').textContent = bgMode === 'daily' ? '오늘 모두 같은 차트 · 200거래일 · 한국시간 자정 교체' : '랜덤 과거 차트 · 종목·날짜는 정산 때 공개';
  // 게임 탭 복귀: 진행 중이면 재개, 없으면 시작 인트로
  if (bg && !bg.over) { if (bg.playing) soloTickStart(); soloStatus(); }
  else if (!bg) bgShowSoloOverlay();
  scheduleBlindChartResize();
}

// kl([ts,o,h,l,c,v] 배열) → bg 세팅 (나만의 판 공용)
function bgSetupSolo(kl, symName, track, gameMode = 'solo', resumeState = null) {
  // 서버가 보낸 라운드 길이에서 유도 — 예전에 저장된 짧은 라운드도 그대로 열린다
  const startIdx = Math.max(0, kl.length - BG_PLAY - 1);
  const base = +kl[startIdx][4];
  bg = {
    sym: symName, track,
    realStart: new Date(+kl[startIdx][0]).toISOString().slice(0, 10),
    realEnd: new Date(+kl[kl.length - 1][0]).toISOString().slice(0, 10),
    realDates: kl.map(k => new Date(+k[0]).toISOString().slice(0, 10)),
    norm: kl.map((k, i) => ({ time: 946684800 + i * 86400, open: +k[1]/base*100, high: +k[2]/base*100, low: +k[3]/base*100, close: +k[4]/base*100, volume: +k[5] })),
    idx: startIdx, base: startIdx, wallet: 10000, pos: null, trades: [], markers: [], over: false, bankrupt: false, gameMode,
    studyRoomId: gameMode === 'study' ? studyRoom?.id : null,
    daily: gameMode === 'daily' ? bgDailySelection : null,
  };
  if (resumeState) {
    bg.idx = bg.base + resumeState.dayIndex;
    bg.wallet = resumeState.wallet;
    bg.pos = resumeState.pos ? { ...resumeState.pos } : null;
    bg.trades = resumeState.trades.map(t => ({ ...t }));
    bg.elapsedMs = resumeState.elapsedMs;
    bg.markers = bgDailyMarkersFromTrades(bg.trades, bg.norm, bg.base);
    bgSpeed = resumeState.speed;
    bgPct = resumeState.orderPct;
    bgLev = resumeState.leverage;
  }
  bgOsc.suspend=true;
  bgS.setData(bg.norm.slice(0, bg.idx + 1));
  bgMASet(); bgVolSet(); bgS.setMarkers(bg.markers);
  chartShowRecent(bgCh, bg.idx + 1, BG_VIEW_BARS);
  scheduleBlindChartRecovery();
  $('bgOver').classList.add('hidden');
  $('bgSym').textContent = track === 'stock' ? '❓ ??? · 미국 증시' : '❓ ??? / USDT';
  $('bgLog').innerHTML = bg.trades.length ? bg.trades.slice(0, 30).map(renderTradeRow).join('') : '<div style="padding:10px 0;color:var(--dim)">아직 거래가 없습니다</div>';
  if (gameMode === 'study') studyRestorePlayerState();
  blindStatus();
  if (gameMode === 'study') studyGameReady();
  else soloStart(resumeState?.elapsedMs || 0);   // 시간 자동 진행 시작
}

async function blindStart(resumeDaily = false) {
  const generation = ++bgLoadGeneration;
  if (bgMode === 'daily') { await bgStartDaily(generation, resumeDaily); return; }
  const track = bgTrack;
  $('bgOverBox').innerHTML = '<h4>🎲 나만의 판</h4><p>과거의 판을 뒤지는 중…</p>';
  if (track === 'stock') {
    try {
      const b = await loadStockBundle();
      if (generation !== bgLoadGeneration || bgMode !== 'solo' || track !== bgTrack) return;
      const syms = Object.keys(b);
      for (let t = 0; t < 12; t++) {
        const sym = syms[Math.floor(Math.random() * syms.length)];
        const arr = b[sym];
        const endIdx = BG_TOTAL - 1 + Math.floor(Math.random() * (arr.length - BG_TOTAL + 1));
        const kl = arr.slice(endIdx - BG_TOTAL + 1, endIdx + 1);
        if (kl.length === BG_TOTAL) { bgSetupSolo(kl, sym, 'stock'); return; }
      }
    } catch (e) { /* 아래 실패 메시지 */ }
    if (generation !== bgLoadGeneration || bgMode !== 'solo' || track !== bgTrack) return;
    $('bgOverBox').innerHTML = '<h4>🎲 나만의 판</h4><p>주식 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p><button type="button" class="go" onclick="blindStart()">재시도</button>';
    return;
  }
  for (let t = 0; t < 8; t++) {
    const sym = BG_POOL[Math.floor(Math.random() * BG_POOL.length)];
    const minEnd = Date.parse('2021-06-01'), maxEnd = Date.now() - 10 * 86400e3;
    const endTime = minEnd + Math.floor(Math.random() * (maxEnd - minEnd));
    try {
      const kl = await (await fetch(`${SPOT_DATA_API}/klines?symbol=${sym}&interval=1d&limit=${BG_TOTAL}&endTime=${endTime}`)).json();
      if (generation !== bgLoadGeneration || bgMode !== 'solo' || track !== bgTrack) return;
      if (!Array.isArray(kl) || kl.length < BG_MIN_TOTAL) continue;
      bgSetupSolo(kl, sym, 'crypto');
      return;
    } catch (e) { /* 다른 종목 재시도 */ }
    if (generation !== bgLoadGeneration || bgMode !== 'solo' || track !== bgTrack) return;
  }
  $('bgOverBox').innerHTML = '<h4>🎲 나만의 판</h4><p>판을 차리지 못했습니다. 잠시 후 다시 시도해 주세요.</p><button type="button" class="go" onclick="blindStart()">재시도</button>';
}

function bgDailyArchiveMarkup(day,today) {
  const dates = day === today ? window.BlindDaily.previousDays(day,7) : [today,...window.BlindDaily.previousDays(day,7)];
  if (!dates.length) return '';
  const internal = new URLSearchParams(location.search).get('internal') === '1';
  const links = dates.map(archiveDay => {
    const round = window.BlindDaily.selection(archiveDay), target = new URL(window.BlindDaily.url(archiveDay,round.version));
    if (internal) target.searchParams.set('internal','1');
    const label = `${archiveDay===today?'오늘 · ':''}${archiveDay.slice(5).replace('-','/')} · ${round.track==='stock'?'미국주식':'코인'}`;
    return `<a href="${target.pathname}${target.search}">${label}</a>`;
  }).join('');
  const summary = day === today ? '지난 판 다시 보기' : '오늘·지난 날짜 바꾸기';
  return `<details class="bgDailyArchive"><summary>${summary}</summary><div class="bgDailyArchiveLinks">${links}</div></details>`;
}
function bgGuideHref() {
  const lang = document.documentElement.lang;
  return ['en','zh','ja'].includes(lang) ? `/${lang}/learn/blind-chart-practice/` : '/ko/learn/blind-chart-practice/';
}
function bgShowDailyOverlay() {
  bgSpeed = 2;
  $('bgPlayRow').classList.add('prestart');
  bgRenderSpeed();
  const day = window.BlindDaily.requestedDay(bgDailyQuery);
  const today = window.BlindDaily.dayKey();
  bgDailySelection = window.BlindDaily.selection(day);
  const stockRound = bgDailySelection.version === 2, marketName = stockRound ? '미국 주식' : '코인', unit = stockRound ? '거래일' : '일';
  document.getElementById('bgSym').textContent = stockRound ? '❓ ??? · 미국 증시' : '❓ ??? / USDT';
  let first = null;
  try { first = window.BlindDaily.read(localStorage,bgDailySelection.version).find(r => r.day === day); } catch {}
  let progress = null;
  try { progress = window.BlindDaily.readProgress(localStorage, day, bgDailySelection.version); } catch {}
  if (first && progress) { bgClearDailyProgress(bgDailySelection); progress = null; }
  let run = {days:0,playedToday:false};
  try { run = window.BlindDaily.streak(localStorage); } catch {}
  const runCopy = day !== today ? '연속 출전은 당일 오늘의 판 완주로 기록됩니다.' : run.playedToday ? `오늘 출전 완료 · ${run.days}일 연속` : run.days ? `어제까지 ${run.days}일 연속 · 오늘 완주하면 이어집니다.` : '오늘 완주하면 연속 출전 기록이 시작됩니다.';
  const runBadge = `<span class="bgStreakBadge">♠ ${runCopy}</span>`;
  const archive = bgDailyArchiveMarkup(day,today), heading = day===today ? '🎴 오늘의 판' : `🎴 ${day} · 지난 판`;
  $('bgTrackRow').classList.add('hidden');
  $('bgModeDesc').textContent = day===today ? '오늘 모두 같은 차트 · 200거래일 · 한국시간 자정 교체' : '지난 판 재연 · 오늘의 연속 출전 기록과 별도';
  const startAction = progress
    ? `<button class="go" type="button" onclick="blindStart(true)">D+${progress.dayIndex}부터 이어하기 →</button><button class="go" type="button" onclick="blindStart(false)">처음부터 다시</button>`
    : `<button class="go" type="button" onclick="blindStart(false)">${first?'같은 판 다시 연습':day===today?'오늘의 판 시작':'지난 판 다시 하기'} →</button>`;
  $('bgOverBox').innerHTML = `<h4>${heading}</h4><p><b style="color:var(--gold)">${day} · ${marketName}</b><br>종목과 날짜를 가린 같은 차트로 200${unit} 동안 버텨 보세요. 끝나면 내 매매와 같은 기간 보유 수익률을 비교합니다.</p>
    <div class="bgDailyActions">${startAction}<button class="go bgDailyInvite" type="button" onclick="bgShareDailyChallenge()">친구와 같은 판 하기 ↗</button></div>
    ${progress?`<p class="bgDailyInfo">이 기기에 D+${progress.dayIndex}까지 진행을 저장했습니다. 브라우저를 닫았다 열어도 이어갈 수 있어요.</p>`:''}
    <p class="bgDailyInfo">가상 자금 $10,000 · 실제 주문 없음 · 기본 속도 2×로 약 4분. 시작 전이나 진행 중에 속도를 바꾸고 잠시 멈출 수 있어요.</p>
    <p class="bgDailyInfo">${first ? `첫 완주 ${first.roi>=0?'+':''}${first.roi.toFixed(2)}% · 같은 기간 보유 ${first.bh>=0?'+':''}${first.bh.toFixed(2)}%<br>` : ''}${runBadge}<br>${day===today?'완주와 연속 출전 기록은 이 브라우저에만 저장됩니다.':'지난 판 완주 기록은 저장되지만 연속 출전에는 반영되지 않습니다.'}</p>
    ${archive}
    <a class="bgGuideLink" href="${bgGuideHref()}" target="_blank" rel="noopener noreferrer">게임 방식과 정산 기준 ↗</a>
    <p class="bgDailyInfo" id="bgDailyInviteStatus" role="status" aria-live="polite"></p><textarea readonly hidden id="bgDailyInviteCopy" aria-label="복사할 판 초대 문구와 링크"></textarea>`;
}
async function bgShareDailyChallenge(statusId = 'bgDailyInviteStatus', copyId = 'bgDailyInviteCopy') {
  const day = bgDailySelection?.day || window.BlindDaily.requestedDay(bgDailyQuery);
  const version = bgDailySelection?.version || window.BlindDaily.selection(day).version;
  const url = bgDailyInviteUrl(day,version);
  const current = day === window.BlindDaily.dayKey();
  const lang = ['en','zh','ja'].includes(document.documentElement.lang) ? document.documentElement.lang : 'ko';
  const words = {
    ko: {today:'오늘의 판',past:'지난 판',stocks:'미국 주식',crypto:'코인',tradingDays:'거래일',days:'일',invite:'같이 해볼래? 같은 과거 {market} 차트로 200{period} 모의 매매하고, 마지막에 같은 기간 보유 수익률과 비교하는 판이야.',shared:'공유할 앱을 선택했어요.',cancelled:'공유를 취소했어요.',copied:'초대 문구와 판 링크를 복사했어요.',manual:'아래 초대 문구와 링크를 선택해 복사해 주세요.'},
    en: {today:"today’s round",past:'a past round',stocks:'U.S. stock',crypto:'crypto',tradingDays:'trading days',days:'days',invite:'Want to try {round}? Trade a past {market} chart with the ticker and dates hidden for 200 {period}, then compare your choices with simply holding.',shared:'Choose an app to share with.',cancelled:'Share cancelled.',copied:'Invitation and round link copied.',manual:'Select and copy the invitation and link below.'},
    zh: {today:'今日牌局',past:'历史牌局',stocks:'美股',crypto:'加密资产',tradingDays:'个交易日',days:'天',invite:'要不要一起玩{round}？在隐藏标的和日期的{market}历史图表上进行200{period}模拟交易，再与同期持有比较。',shared:'请选择要分享的应用。',cancelled:'已取消分享。',copied:'邀请文案和牌局链接已复制。',manual:'请在下方选择并复制邀请文案和链接。'},
    ja: {today:'今日の一局',past:'過去の一局',stocks:'米国株',crypto:'暗号資産',tradingDays:'取引日',days:'日',invite:'{round}を一緒に試してみませんか？銘柄と日付を伏せた過去の{market}チャートで200{period}の模擬取引を行い、同期間の保有と比べます。',shared:'共有するアプリを選んでください。',cancelled:'共有をキャンセルしました。',copied:'招待文とラウンドリンクをコピーしました。',manual:'下の招待文とリンクを選択してコピーしてください。'},
  }[lang];
  const round = current ? words.today : words.past;
  const market = version === 2 ? words.stocks : words.crypto;
  const period = version === 2 ? words.tradingDays : words.days;
  const title = `Tape Lounge · ${day} · ${round}`;
  const text = words.invite.replace('{round}',round).replace('{market}',market).replace('{period}',period);
  const invite = `${text}\n${url}`;
  const msg = $(statusId), copy = $(copyId);
  const setStatus = value => { if (msg?.isConnected) { msg.textContent = value; msg.hidden = false; } };
  if (navigator.share) {
    try {
      await navigator.share({title,text,url});
      setStatus(words.shared);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') { setStatus(words.cancelled); return; }
    }
  }
  try {
    await navigator.clipboard.writeText(invite);
    setStatus(words.copied);
  } catch {
    if (copy?.isConnected) {
      copy.value = invite; copy.hidden = false; copy.focus(); copy.select();
      setStatus(words.manual);
    }
  }
}
function bgDailyInviteUrl(day,version) {
  const url = window.BlindDaily.url(day,version);
  try { return window.TapeCampaign?.tagDailyBlindShare(url) || url; }
  catch { return url; }
}
function bgDailyShareText(chosen,result) {
  const plainUrl = window.BlindDaily.url(chosen.day,chosen.version);
  return window.BlindDaily.shareText(chosen,result).replace(plainUrl,bgDailyInviteUrl(chosen.day,chosen.version));
}
async function bgStartDaily(generation, resumeRequested = false) {
  const chosen = bgDailySelection || window.BlindDaily.selection(window.BlindDaily.requestedDay(bgDailyQuery));
  bgDailySelection = chosen;
  let resumeState = null;
  try { if (resumeRequested) resumeState = window.BlindDaily.readProgress(window.localStorage, chosen.day, chosen.version); } catch {}
  if (resumeRequested && !resumeState) {
    $('bgOverBox').innerHTML = '<h4>🎴 저장된 진행을 찾지 못했습니다.</h4><p>처음부터 새 판으로 시작해 주세요.</p><button type="button" class="go" onclick="blindStart(false)">처음부터 시작 →</button>';
    return;
  }
  $('bgOverBox').innerHTML = '<h4>🎴 오늘의 판</h4><p>오늘의 과거 차트를 준비하고 있습니다…</p>';
  try {
    let kl, symbol, track;
    if (chosen.version === 2) {
      const response = await fetch(chosen.asset);
      if (!response.ok) throw new Error('오늘의 미국 주식 차트를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const payload = await response.json();
      kl = window.BlindDaily.validateStock(payload,chosen);
      symbol = payload.symbol; track = 'stock';
      if (resumeState && resumeState.symbol !== symbol) throw new Error('저장된 판의 종목을 확인하지 못했습니다. 처음부터 다시 시작해 주세요.');
      bgDailySelection = {...chosen,symbol};
    } else {
      const response = await fetch(`${SPOT_DATA_API}/klines?symbol=${chosen.symbol}&interval=1d&limit=${BG_TOTAL}&endTime=${chosen.endTime}`);
      if (!response.ok) throw new Error('오늘의 차트에 연결하지 못했습니다. 같은 판으로 다시 시도해 주세요.');
      kl = window.BlindDaily.validate(await response.json(), chosen);
      symbol = chosen.symbol; track = 'crypto';
    }
    if (generation !== bgLoadGeneration || bgMode !== 'daily') return;
    if (!resumeRequested) bgClearDailyProgress(chosen);
    bgLev = resumeState?.leverage ?? 1; bgPct = resumeState?.orderPct ?? 25; bgSpeed = resumeState?.speed ?? 2;
    bgLevRender(); bgRenderSpeed();
    bgSetupSolo(kl, symbol, track, 'daily', resumeState);
  } catch (error) {
    if (generation !== bgLoadGeneration || bgMode !== 'daily') return;
    $('bgOverBox').innerHTML = `<h4>🎴 오늘의 판</h4><p>${esc(error.message)}</p><button type="button" class="go" onclick="blindStart()">같은 판 재시도</button>`;
  }
}
async function bgCopyDailyResult() {
  if (!bg?.daily || !bg.over) return;
  const result = {roi:(bgTotal()/10000-1)*100,bh:(bg.norm[bg.idx].close/bg.norm[bg.base].close-1)*100,days:bg.idx-bg.base,completed:bg.idx===bg.norm.length-1,bankrupt:bg.bankrupt};
  const text = bgDailyShareText(bg.daily,result), target = $('bgDailyCopyText'), msg = $('bgDailyCopyStatus');
  try { await navigator.clipboard.writeText(text); if (msg?.isConnected) msg.textContent = '결과와 같은 판의 링크를 복사했습니다.'; }
  catch { if (target?.isConnected) { target.value=text;target.hidden=false;target.focus();target.select();if(msg)msg.textContent='아래 내용을 선택해 복사해 주세요.'; } }
}
window.bgCopyDailyResult = bgCopyDailyResult;
function bgOpenDailyShare() {
  if (!bg?.daily || !bg.over || !window.TapeDailyShare) return;
  const result = {roi:(bgTotal()/10000-1)*100,bh:(bg.norm[bg.idx].close/bg.norm[bg.base].close-1)*100,days:bg.idx-bg.base,completed:bg.idx===bg.norm.length-1,bankrupt:bg.bankrupt};
  const label = result.completed ? `200${bg.daily.version===2?'거래일':'일'} 완주` : result.bankrupt ? '파산 정산' : '중간 정산';
  window.TapeDailyShare.open({
    day:bg.daily.day, version:bg.daily.version, market:bg.daily.track || 'crypto', symbol:bg.sym.replace('USDT',''), label, days:result.days,
    roi:result.roi, bh:result.bh, completed:result.completed,
    text:bgDailyShareText(bg.daily,result),
  });
}
window.bgOpenDailyShare = bgOpenDailyShare;

function bgMASet() {
  const vis = bg.norm.slice(0, bg.idx + 1);
  seedSupertrend(bgST,vis); // Revealed candles only; never calculate from the hidden future.
  seedOscillators(bgOsc,vis);
  MA_DEFS.forEach(([p], mi) => {
    const data = [];
    let sum = 0;
    for (let j = 0; j < vis.length; j++) {
      sum += vis[j].close;
      if (j >= p) sum -= vis[j - p].close;
      if (j >= p - 1) data.push({ time: vis[j].time, value: sum / p });
    }
    bgMA[mi].setData(data);
  });
}
function bgVolSet() {
  bgVol.setData(bg.norm.slice(0, bg.idx + 1).map(x => ({
    time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(74,222,128,.55)' : 'rgba(248,113,113,.55)',
  })));
}
function bgPrice() { return bg.norm[bg.idx].close; }

// ── 격리 마진 포지션 계산 ──
// 청산 조건: 미실현 손실이 (증거금 − 유지증거금)을 다 먹는 지점
function bgLiqPrice(pos) {
  if (!pos || pos.qty <= 0 || pos.margin <= 0) return null;
  const gap = pos.margin / pos.qty - BG_MMR * pos.entry;
  return Math.max(0, pos.side === 'long' ? pos.entry - gap : pos.entry + gap);
}
function bgUnreal(px) {
  const p = bg.pos;
  if (!p) return 0;
  return (p.side === 'long' ? px - p.entry : p.entry - px) * p.qty;
}
function bgPosLev(pos) { return pos ? Number(pos.lev) || 0 : 0; }
function bgNotional(pos) { return pos ? pos.qty * pos.entry : 0; }
// 거래소 항등식: 필요증거금 = 명목가 ÷ 레버리지
function bgRequiredMargin(pos, lev) { return bgNotional(pos) / lev; }
// 지금 낼 수 있는 최대 주문 명목가 (수수료까지 지갑에서 빠지는 것을 감안)
function bgMaxNotional(lev) {
  if (!bg) return 0;
  return (bg.wallet * lev) / (1 + lev * BG_FEE_RATE);
}
// 레버리지 변경 = 포지션 전체 재증거금 산정, 차액을 지갑과 정산
function bgApplyLeverage(v) {
  const p = bg && !bg.over ? bg.pos : null;
  if (!p) return true;
  const required = bgRequiredMargin(p, v);
  const delta = required - p.margin;        // 양수면 추가 납입, 음수면 반환
  if (delta > bg.wallet + 0.01) return false;   // 잔고 부족 → 거절 (1센트는 반올림 먼지)
  bg.wallet = Math.max(0, bg.wallet - delta);
  p.margin = required;
  p.lev = v;
  return true;
}
function bgOrderMsg(text) {
  const el = $('bgOrderMsg');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
}
function bgTotal() {
  const p = bg.pos;
  return Math.max(0, bg.wallet + (p ? p.margin + bgUnreal(bgPrice()) : 0));
}

function blindStatus() {
  const day = bg.idx - bg.base;
  const px = bgPrice(), p = bg.pos;
  $('bgDay').textContent = `D+${day} / ${BG_PLAY}`;
  $('bgPx').textContent = px.toFixed(2);
  $('bgCash').textContent = '$' + fmt(bg.wallet);
  const liqEl = $('bgLiq'), pnlEl = $('bgPnl');
  if (p) {
    const isLong = p.side === 'long';
    $('bgCoin').innerHTML = `<b style="color:${isLong?'var(--grn)':'var(--red)'}">${isLong?'LONG':'SHORT'}</b> `
      + `${p.qty.toFixed(4)} <span style="color:var(--gold)">${bgPosLev(p)}×</span>`;
    $('bgEntry').textContent = p.entry.toFixed(2);
    $('bgMargin').textContent = '$' + fmt(p.margin, 2);
    const liq = bgLiqPrice(p);
    liqEl.textContent = liq === null ? '—' : liq.toFixed(2);
    // 현재가가 청산가 5% 이내로 붙으면 경고색
    liqEl.classList.toggle('warn', liq !== null && (isLong ? px <= liq * 1.05 : px >= liq * 0.95));
    const pnl = bgUnreal(px), roe = p.margin > 0 ? pnl / p.margin * 100 : 0;
    pnlEl.textContent = `${pnl>=0?'+':'-'}$${fmt(Math.abs(pnl), 2)} (${roe>=0?'+':''}${roe.toFixed(1)}%)`;
    pnlEl.style.color = pnl > 0 ? 'var(--grn)' : pnl < 0 ? 'var(--red)' : '#c6cad3';
  } else {
    $('bgCoin').textContent = bg.bankrupt ? '💀 파산' : '없음';
    $('bgEntry').textContent = '—';
    $('bgMargin').textContent = '—';
    liqEl.textContent = '—'; liqEl.classList.remove('warn');
    pnlEl.textContent = '—'; pnlEl.style.color = '#c6cad3';
  }
  $('bgNotional').textContent = p ? '$' + fmt(bgNotional(p)) : '—';
  $('bgMaxOrd').textContent = '$' + fmt(bgMaxNotional(bgLev));
  $('bgTot').textContent = '$' + fmt(bgTotal());
  const roi = (bgTotal() / 10000 - 1) * 100;
  const el = $('bgRoi');
  el.textContent = (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%';
  el.style.color = roi > 0 ? 'var(--grn)' : roi < 0 ? 'var(--red)' : '#c6cad3';
}

function renderTradeRow(t) {
  const liq = t.intent === 'LIQ';
  const label = liq ? '강제청산' : esc(t.intent || (t.side === 'BUY' ? 'LONG' : 'SHORT'));
  const color = liq ? '#f87171' : (t.side === 'BUY' ? 'var(--grn)' : 'var(--red)');
  const lev = Number(t.lev) > 1 ? ` ${Number(t.lev)}×` : '';
  const fee = Number(t.fee || 0);
  const day = Math.max(0, Math.min(BG_PLAY, Number(t.day) || 0));
  const px = Number(t.px) || 0, amt = Number(t.amt) || 0;
  const tail = liq ? '증거금 소멸' : `fee $${fmt(fee)}`;
  return `<div class="tr"><span>D+${day} <b style="color:${color}">${label}${lev}</b></span><span class="num">@${px.toFixed(2)} · $${fmt(amt)} · ${tail}</span></div>`;
}
async function blindTrade(action, pct) {
  if (!bg || bg.over) return;
  pct = Math.max(0, Math.min(1, Number(pct) || 0));
  if (!pct) return;
  if (bg.gameMode === 'study') { await studyTrade(action, pct); return; }
  const px = bgPrice(), day = bg.idx - bg.base, p = bg.pos;
  const want = action === 'buy' ? 'long' : 'short';
  let notional = 0, qty = 0, fee = 0, intent = '', lev = bgLev;

  if (p && p.side !== want) {
    // 반대 방향 주문 = 보유 포지션 축소 (남은 수량 비율만큼)
    qty = p.qty * pct;
    notional = qty * px;
    if (notional < 1) { bgOrderMsg('정리할 수량이 없습니다'); return; }
    fee = notional * BG_FEE_RATE;
    const realized = (p.side === 'long' ? px - p.entry : p.entry - px) * qty;
    const freed = p.margin * pct;
    bg.wallet += freed + realized - fee;
    p.qty -= qty; p.margin -= freed;
    intent = p.side === 'long' ? 'CLOSE' : 'COVER';
    if (p.qty < 1e-10 || p.margin <= 0) bg.pos = null;
  } else {
    // 신규 진입 또는 같은 방향 추가 진입 — 주문 비율은 최대 주문가능 명목가 대비
    notional = bgMaxNotional(lev) * pct;
    if (notional < 1) { bgOrderMsg('주문 가능 금액이 부족합니다'); return; }
    fee = notional * BG_FEE_RATE;
    qty = notional / px;
    if (!p) {
      const margin = notional / lev;
      bg.wallet -= margin + fee;
      bg.pos = { side: want, qty, entry: px, margin, lev };
    } else {
      // 추가 진입 후에도 필요증거금 = 전체 명목가 ÷ 레버리지가 유지되도록 재산정
      const nextQty = p.qty + qty;
      const nextEntry = (p.entry * p.qty + px * qty) / nextQty;
      const required = (nextQty * nextEntry) / lev;
      const delta = required - p.margin;
      if (delta + fee > bg.wallet + 0.01) { bgOrderMsg('증거금이 부족합니다'); return; }
      bg.wallet -= delta + fee;
      p.qty = nextQty; p.entry = nextEntry; p.margin = required; p.lev = lev;
    }
    intent = want === 'long' ? 'LONG' : 'SHORT';
  }
  bgOrderMsg('');
  if (bg.wallet < 0) bg.wallet = 0;
  bg.trades.unshift({ day, side: action === 'buy' ? 'BUY' : 'SELL', intent, px, amt: notional, fee, lev });
  bg.markers.push({
    time: bg.norm[bg.idx].time,
    position: action === 'buy' ? 'belowBar' : 'aboveBar',
    color: action === 'buy' ? '#4ade80' : '#f87171',
    shape: action === 'buy' ? 'arrowUp' : 'arrowDown',
    text: action === 'buy' ? 'B' : 'S',
  });
  bgS.setMarkers(bg.markers);
  $('bgLog').innerHTML = bg.trades.slice(0, 30).map(renderTradeRow).join('');
  blindStatus();
  bgSaveDailyProgress();
}

// 캔들 고저가 청산가를 스치면 증거금 전액 소멸
function bgCheckLiquidation() {
  const p = bg.pos;
  if (!p) return false;
  const liq = bgLiqPrice(p);
  if (liq === null) return false;
  const c = bg.norm[bg.idx];
  if (p.side === 'long' ? c.low > liq : c.high < liq) return false;
  const isLong = p.side === 'long';
  bg.trades.unshift({
    day: bg.idx - bg.base, side: isLong ? 'SELL' : 'BUY',
    intent: 'LIQ', px: liq, amt: p.qty * liq, fee: 0, lev: bgPosLev(p),
  });
  bg.markers.push({
    time: c.time, position: isLong ? 'belowBar' : 'aboveBar',
    color: '#f87171', shape: isLong ? 'arrowDown' : 'arrowUp', text: '청산',
  });
  bg.pos = null;
  bgS.setMarkers(bg.markers);
  $('bgLog').innerHTML = bg.trades.slice(0, 30).map(renderTradeRow).join('');
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 520);
  return true;
}

function bgAdvanceOneDay() {
  bg.idx++;
  const x = bg.norm[bg.idx];
  bgS.update(x);
  tickSupertrend(bgST,x);
  tickOscillators(bgOsc,x);bgOsc.syncRange();
  bgVol.update({ time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(74,222,128,.55)' : 'rgba(248,113,113,.55)' });
  MA_DEFS.forEach(([p], mi) => {
    if (bg.idx + 1 < p) return;
    let sum = 0;
    for (let j = bg.idx - p + 1; j <= bg.idx; j++) sum += bg.norm[j].close;
    bgMA[mi].update({ time: x.time, value: sum / p });
  });
  if (bgCheckLiquidation() && bg.gameMode !== 'study' && bgTotal() < 1) {
    bg.bankrupt = true;
    blindFinish(true);   // 밑천이 다 녹으면 즉시 정산
  }
  if ((bg.idx - bg.base) % 5 === 0) bgSaveDailyProgress();
}
async function blindFinish(early) {
  if (!bg || bg.over) return;
  bg.over = true;
  $('bgPlayRow').classList.add('prestart');
  clearInterval(bgTimer); bgTimer = null;
  const roi = (bgTotal() / 10000 - 1) * 100;
  const bh = (bg.norm[bg.idx].close / bg.norm[bg.base].close - 1) * 100;  // 같은 기간 존버
  const name = bg.sym.replace('USDT', '');
  $('bgSym').textContent = bg.track === 'stock' ? name : `${name} / USDT`;
  if (bg.gameMode === 'study') {
    $('bgOverBox').innerHTML = '<h4>🎰 공동 정산</h4><p>테이블 장부를 맞추는 중…</p>';
    $('bgOver').classList.remove('hidden');
    await studyFinishRound();
    return;
  }
  if (bg.daily) {
    bgClearDailyProgress(bg.daily);
    const completed = bg.idx === bg.norm.length - 1;
    let recorded = {saved:false,first:null,streak:{days:0,playedToday:false}};
    try { recorded = window.BlindDaily.record(localStorage, bg.daily.day, {roi,bh,completed,finishedAt:new Date().toISOString()},bg.daily.version); } catch {}
    window.dispatchEvent(new Event('tape-blind-daily-updated'));
    const first = recorded.first;
    const run = recorded.streak || {days:0,playedToday:false};
    const runCopy = bg.daily.day===window.BlindDaily.dayKey() ? run.playedToday ? `오늘 출전 완료 · ${run.days}일 연속` : '오늘 판을 완주하면 연속 출전 기록이 갱신됩니다.' : '';
    const runBadge = runCopy ? `<span class="bgStreakBadge">♠ ${runCopy}</span>` : '';
    const unit = bg.daily.version===2 ? '거래일' : '일';
    $('bgOverBox').innerHTML = `<h4>🎴 ${bg.daily.day} · ${completed?'완주':bg.bankrupt?'파산 정산':'중간 정산'}</h4>
      <p>이 판의 정체는 <b style="color:var(--gold)">${name}</b><br><span style="color:var(--dim)">${bg.realStart} ~ ${bg.realDates[bg.idx]} · ${bg.idx-bg.base}${unit}</span></p>
      <div class="big num" style="color:${roi>=0?'var(--grn)':'var(--red)'}">${roi>=0?'+':''}${roi.toFixed(2)}%</div>
      <p>같은 기간 보유 <b>${bh>=0?'+':''}${bh.toFixed(2)}%</b> <small>(수수료 전)</small><br>${roi>=bh?'이번 판에서는 보유 수익률을 앞섰습니다.':'이번 판에서는 보유 수익률이 더 높았습니다.'}</p>
      <p class="bgDailyInfo">${recorded.saved?'첫 완주 기록을 이 브라우저에 저장했습니다.':first?`이 브라우저의 첫 완주 ${first.roi>=0?'+':''}${first.roi.toFixed(2)}%` : completed?'브라우저 기록을 저장하지 못했습니다.':'200일을 끝까지 마치면 첫 완주 기록이 남습니다.'}${runBadge?`<br>${runBadge}`:''}<br>남아 있는 포지션은 마지막 종가로 평가합니다.</p>
      <div class="resultWatermark">tapelounge.com</div><div class="bgDailyActions"><button type="button" class="go" onclick="bgOpenDailyShare()">결과 카드 저장·공유</button><button type="button" class="go" onclick="bgCopyDailyResult()">결과·도전 링크 복사</button><button type="button" class="go" onclick="blindStart()">같은 판 연습</button></div>
      <p class="bgDailyInfo" id="bgDailyCopyStatus" role="status"></p><textarea readonly hidden id="bgDailyCopyText" aria-label="복사할 모의 결과와 도전 링크"></textarea>`;
    $('bgOver').classList.remove('hidden');
    return;
  }
  const prevBest = localStorage.getItem('salonBlindBest');
  const isBest = prevBest === null || roi > +prevBest;
  if (isBest) { localStorage.setItem('salonBlindBest', roi.toFixed(2)); $('bgBest').textContent = `최고 기록 ${(roi>=0?'+':'')}${roi.toFixed(1)}%`; }
  const liqCount = bg.trades.filter(t => t.intent === 'LIQ').length;
  const beat = roi >= bh;
  const verdicts = bg.bankrupt
    ? ['밑천이 다 녹았습니다. 레버리지는 양날의 검이죠.', '강제청산으로 판이 끝났습니다. 다음엔 배수를 낮춰보시죠.', '시장이 수업료를 받아갔습니다.']
    : beat
    ? ['존버를 이겼습니다. 판을 읽을 줄 아는 손이군요.', '시장을 앞섰습니다 — 정마담이 눈여겨볼 솜씨.', '차트만 보고 이 정도면, 대단한 감입니다.']
    : ['이번엔 존버가 이겼네요. 다음 판이 있습니다.', '시장이 한 수 위였습니다. 판은 늘 다시 열립니다.', '가만히 있는 것도 실력이라는 걸 시장이 알려주는군요.'];
  $('bgOverBox').innerHTML = `
    <h4>${bg.bankrupt ? '💀 파산' : early ? '🏳 중간 정산' : '🎰 정체 공개'}</h4>
    <p>이 판의 정체는 <b style="color:var(--gold);font-size:16px">${name}</b><br>
    <span style="color:var(--dim)">${bg.realStart} ~ ${bg.realDates[bg.idx]} 실제 시세</span></p>
    <div class="big num" style="color:${roi>0?'var(--grn)':roi<0?'var(--red)':'#c6cad3'}">${roi>=0?'+':''}${roi.toFixed(2)}%</div>
    <p>같은 기간 존버: <b class="num" style="color:${bh>0?'var(--grn)':'var(--red)'}">${bh>=0?'+':''}${bh.toFixed(2)}%</b>
    ${isBest ? ' · <b style="color:var(--gold)">🏆 신기록!</b>' : ''}
    ${liqCount ? `<br><b style="color:var(--red)">강제청산 ${liqCount}회</b>` : ''}
    <br>${verdicts[Math.floor(Math.random()*verdicts.length)]}</p>
    <div class="resultWatermark">tapelounge.com</div>
    <button type="button" class="go" onclick="blindStart()">한 판 더 🎲</button>`;
  $('bgOver').classList.remove('hidden');
}
// ═══ 블라인드 차트 — 시간 자동 진행 엔진 (재생 / 일시정지 / 속도) ═══
const BG_TICK_MS = 2400;   // 1시뮬레이션일 = 실시간 2.4초 (속도 1×) · 200일 완주 약 8분
const BG_SPEEDS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
const BG_ROOM_SPEEDS = [1, 2, 4];
let bgTimer = null, bgTickLast = 0, bgSpeed = 1;

function bgShowSoloOverlay() {
  const stock = bgTrack === 'stock';
  if (bgMode !== 'daily') bgSpeed = 1;
  $('bgPlayRow').classList.add('prestart');
  [$('bgPlayBtn'), $('bgSpeedDownBtn'), $('bgSpeedUpBtn'), $('bgFinishBtn')].forEach(el => {
    el.classList.remove('roomLocked'); el.style.pointerEvents = ''; el.setAttribute('aria-disabled', 'false');
  });
  $('bgFinishBtn').textContent = '🏳 여기서 정산';
  $('bgStudyPanel').classList.add('hidden'); $('bgTrackRow').classList.remove('hidden');
  $('bgPlayRow').classList.remove('hidden'); $('bgSoloFinish').classList.remove('hidden');
  $('bgLiveRow').classList.add('hidden');
  $('bgOverBox').innerHTML = `<h4>🎲 나만의 판</h4><p>과거의 어느 실제 ${stock ? '미국 증시' : '코인 시장'}에 던져집니다. <b style="color:#fff">종목도, 날짜도 비밀.</b><br>
    시작가는 100으로 환산되어 힌트가 없습니다.<br>
    가상 자금 <b style="color:var(--gold)">$10,000</b>으로 매매합니다. 실제 주문은 없습니다.<br>
    시간이 저절로 흐르며 재생·일시정지·속도를 조절할 수 있습니다.<br>
    일봉 200개 뒤 종목·날짜를 공개하고, 같은 구간 보유 수익률과 비교합니다.</p>
    <button type="button" class="go" onclick="blindStart()">판에 앉는다 →</button><a class="bgGuideLink" href="${bgGuideHref()}" target="_blank" rel="noopener noreferrer">게임 방식과 정산 기준 ↗</a>`;
  $('bgSym').textContent = stock ? '❓ ??? · 미국 증시' : '❓ ??? / USDT';
  bgRenderSpeed();
  $('bgOver').classList.remove('hidden');
  if (bgMode === 'daily') bgShowDailyOverlay();
}

// 자동 진행 시작 (blindStart → bgSetupSolo 끝에서 호출)
function soloStart(elapsedMs = 0) {
  bg.elapsedMs = Math.max(0, Number(elapsedMs) || 0); bg.playing = true;
  $('bgPlayRow').classList.remove('prestart');
  $('bgPlayRow').classList.remove('hidden'); $('bgSoloFinish').classList.remove('hidden');
  $('bgLiveRow').classList.remove('hidden');
  bgRenderSpeed(); soloTickStart(); soloStatus(); bgSaveDailyProgress();
}
function soloTickStart() {
  clearInterval(bgTimer);
  bgTickLast = Date.now();   // 재개 기준 — 탭 비운 동안(타이머 정지)은 누적 안 됨
  bgTimer = setInterval(soloTick, 200);
}
function soloTick() {
  if (!bg || bg.over || !bg.playing) return;
  const now = Date.now();
  bg.elapsedMs += (now - bgTickLast) * bgSpeed;   // 속도 배율만큼 게임 시간 가속
  bgTickLast = now;
  const day = Math.min(BG_PLAY, Math.floor(bg.elapsedMs / BG_TICK_MS));
  const target = bg.base + day;
  let added = 0, atEdge = chartAtRightEdge(bgCh);
  while (bg.idx < target && !bg.over) { bgAdvanceOneDay(); added++; }
  if (added) { if (atEdge) chartFollowBars(bgCh, added); blindStatus(); }
  soloStatus();
  if (bg.idx >= bg.norm.length - 1) { clearInterval(bgTimer); bgTimer = null; blindFinish(false); }
}
function soloPauseToggle() {
  if (!bg || bg.over) return;
  if (bg.gameMode === 'study') { studyHostControl(studyRoom?.playing ? 'pause' : 'play'); return; }
  if (bg.playing) { soloTick(); if (!bg || bg.over) return; }
  bg.playing = !bg.playing;
  if (bg.playing) soloTickStart(); else { clearInterval(bgTimer); bgTimer = null; }
  soloStatus(); bgSaveDailyProgress();
}
function bgRenderSpeed(speed = bgSpeed) {
  const roomMode = bg?.gameMode === 'study';
  const speeds = roomMode ? BG_ROOM_SPEEDS : BG_SPEEDS;
  const value = roomMode ? +(studyRoom?.speed || speed) : speed;
  const index = speeds.indexOf(value);
  const select = $('bgSpeedSelect'), optionSet = speeds.join(',');
  if (select.dataset.speedOptions !== optionSet) {
    select.innerHTML = speeds.map(rate => `<option value="${rate}">${rate}×</option>`).join('');
    select.dataset.speedOptions = optionSet;
  }
  select.value = String(value);
  const oneSpeed = $('bgSpeedOneBtn');
  oneSpeed.setAttribute('aria-pressed', value === 1 ? 'true' : 'false');
  $('bgSpeedDownBtn').disabled = index <= 0;
  $('bgSpeedUpBtn').disabled = index < 0 || index >= speeds.length - 1;
}
function soloSetSpeed(requested) {
  const target = Number(requested);
  if (bg?.gameMode === 'study') {
    const started = studyRoom?.status === 'running' && studyNow() >= Date.parse(studyRoom.start_at || 0);
    if (studyRoom?.host_user_id !== myUid || !started || !BG_ROOM_SPEEDS.includes(target)) return;
    if (target !== +(studyRoom?.speed || 1)) studyHostControl(`speed_${target}`);
    return;
  }
  if (!BG_SPEEDS.includes(target)) return;
  if (bg?.playing) soloTick();
  if (!bg || bg.over) return;
  bgSpeed = target;
  bgRenderSpeed();
  bgSaveDailyProgress();
}
function soloAdjustSpeed(direction) {
  if (bg?.gameMode === 'study') {
    const speed = +(studyRoom?.speed || 1);
    const index = BG_ROOM_SPEEDS.indexOf(speed);
    const next = BG_ROOM_SPEEDS[Math.max(0, Math.min(BG_ROOM_SPEEDS.length - 1, index + Math.sign(direction)))];
    if (next !== speed) soloSetSpeed(next);
    return;
  }
  const index = BG_SPEEDS.indexOf(bgSpeed);
  soloSetSpeed(BG_SPEEDS[Math.max(0, Math.min(BG_SPEEDS.length - 1, index + Math.sign(direction)))]);
}
function soloCycleSpeed() { soloAdjustSpeed(1); }
function blindSettle() {
  if (bg?.gameMode === 'study') studyHostControl('settle');
  else blindFinish(true);
}
function soloStatus() {
  const day = bg ? bg.idx - bg.base : 0;
  const btn = $('bgPlayBtn'), dot = $('bgLiveDot'), txt = $('bgLiveTxt');
  if (!bg || bg.over) { btn.textContent = '⏸ 일시정지'; btn.setAttribute('aria-label','일시정지'); return; }
  if (bg.playing) {
    btn.textContent = '⏸ 일시정지';
    btn.setAttribute('aria-label','일시정지');
    txt.innerHTML = `▶ 진행 중 · D+${day}/${BG_PLAY}`;
    dot.style.background = 'var(--grn)'; dot.style.boxShadow = '0 0 8px var(--grn)';
  } else {
    btn.textContent = '▶ 재생';
    btn.setAttribute('aria-label','다시 재생');
    txt.innerHTML = `⏸ 일시정지 · D+${day}/${BG_PLAY}`;
    dot.style.background = 'var(--dim)'; dot.style.boxShadow = 'none';
  }
}
window.soloPauseToggle = soloPauseToggle; window.soloSetSpeed = soloSetSpeed; window.soloCycleSpeed = soloCycleSpeed; window.blindSettle = blindSettle;

let bgTrack = 'stock';
function bgSetTrack(track) {
  if (bgMode === 'daily') return;
  if (bgTrack === track) return;
  if (bgMode === 'study' && studyRoom) return;
  bgTrack = track;
  bgLoadGeneration++;
  document.querySelectorAll('.bgTrackBtn').forEach(b => b.classList.toggle('on', b.dataset.t === track));
  clearInterval(bgTimer); bgTimer = null;
  if (bg) bg.over = true;
  bg = null;
  if (bgMode === 'study') studyHomeOverlay();
  else bgShowSoloOverlay();   // 새 트랙 인트로 (판에 앉는다 누르면 시작)
}
window.bgSetTrack = bgSetTrack;

// ═══ 블라인드 함께 보는 판 — Supabase 방 상태 + 서버 시각 동기화 ═══
const STUDY_INVITE_CODE = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6);
let studyRoom = null, studyPlayers = [], studyCalls = [], studyChannel = null;
let studyServerOffset = 0, studyLoading = false, studyRefreshTimer = null;
const STUDY_ROOM_COLUMNS = 'id,code,host_user_id,host_nick,track,status,start_at,speed,playing,elapsed_ms,state_at,created_at,expires_at';

function studyFriendly(error) {
  const m = error?.message || '';
  if (m.includes('ROOM_NOT_FOUND')) return '열려 있는 테이블을 찾지 못했습니다.';
  if (m.includes('ROOM_FULL')) return '이 그룹은 12명이 모두 찼습니다.';
  if (m.includes('CREATE_COOLDOWN')) return '새 그룹은 30초 뒤에 다시 만들 수 있습니다.';
  if (m.includes('ACTIVE_ROOM_LIMIT')) return '동시에 열 수 있는 그룹은 세 개까지입니다.';
  if (m.includes('INVALID_NICK')) return '닉네임은 1~10자로 입력해 주세요.';
  if (m.includes('NEED_TWO_PLAYERS')) return '두 명 이상 앉아야 시작할 수 있습니다.';
  if (m.includes('NOT_ALL_READY')) return '아직 READY하지 않은 사람이 있습니다.';
  if (m.includes('HOST_ONLY')) return '방장만 이 기능을 사용할 수 있습니다.';
  if (m.includes('CONTROL_NOT_OPEN')) return '공동 진행이 시작된 뒤에 조작할 수 있습니다.';
  if (m.includes('ROUND_NOT_OVER')) return '아직 공동 정산 시각이 되지 않았습니다.';
  if (m.includes('CANNOT_LEAVE')) return '현재 이 판에서 나갈 수 없습니다.';
  if (m.includes('INSUFFICIENT_MARGIN')) return '증거금이 부족해 레버리지를 내릴 수 없습니다.';
  if (m.includes('ORDER_NOT_OPEN')) return '지금은 주문할 수 없습니다.';
  if (m.includes('INVALID_ORDER')) return '주문 가능 금액이 부족합니다.';
  if (m.includes('duplicate key')) return '이 구간 전망은 이미 선택했습니다.';
  return '그룹 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}
function studyHomeOverlay(message = '') {
  $('bgStudyPanel').classList.remove('hidden'); $('bgTrackRow').classList.remove('hidden');
  $('bgPlayRow').classList.add('hidden'); $('bgSoloFinish').classList.add('hidden'); $('bgLiveRow').classList.add('hidden');
  $('bgStudyPanel').querySelector('h3 small').textContent = '같은 차트 · 같은 시각';
  $('studyPanelBody').innerHTML = '<div style="font-size:10px;line-height:1.7;color:var(--dim)">그룹을 만들거나 초대 코드로 입장하세요.<br>숨은 차트와 주문 결과는 서버가 판정합니다.</div>';
  $('bgOverBox').innerHTML = `<h4>👥 함께 보는 판</h4><p>같은 숨은 종목을 같은 속도로 읽습니다.<br>READY가 모이면 10초 뒤 동시에 출발합니다.</p>
    <div class="studyHome">
      <div class="studyAction"><b>새 그룹</b><span>선택한 ${bgTrack === 'stock' ? '미국주식' : '코인'} 시장으로 방을 엽니다.</span><button class="studyMiniBtn" style="margin-top:10px" onclick="studyCreateRoom()">방 만들기</button></div>
      <div class="studyAction"><b>코드로 입장</b><span>방장에게 받은 6자리 코드를 입력하세요.</span><div class="studyJoin"><input id="studyCodeInput" maxlength="6" value="${esc(STUDY_INVITE_CODE)}" placeholder="ABC234" oninput="this.value=this.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'')"><button class="studyMiniBtn" onclick="studyJoinRoom()">입장</button></div></div>
    </div><div class="studyErr" id="studyHomeErr">${esc(message)}</div>`;
  $('bgOver').classList.remove('hidden');
}
function studyErrorEl() { return $('studyLobbyErr') || $('studyHomeErr'); }
function bgSetMode(mode) {
  if (!['solo','daily','study'].includes(mode) || mode === bgMode) { if (mode === 'study') studyOpen(); return; }
  if (bgMode === 'study' && studyRoom?.status === 'running') {
    const e = studyErrorEl(); if (e) e.textContent = '진행 중인 테이블은 정산 뒤에 나갈 수 있습니다.';
    return;
  }
  bgSaveDailyProgress();
  clearInterval(bgTimer); bgTimer = null; bg = null;
  bgLoadGeneration++;
  bgMode = mode;
  document.querySelectorAll('.blindModeBtn').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  if (mode === 'study') studyOpen();
  else { studyDisconnect(); $('bgStudyPanel').classList.add('hidden'); $('bgModeDesc').textContent = '랜덤 과거 차트 · 종목·날짜는 정산 때 공개'; bgShowSoloOverlay(); }
}
window.bgSetMode = bgSetMode;

function studyOpen() {
  $('bgModeDesc').textContent = '같은 숨은 차트 · 같은 속도로 함께 출발';
  $('bgStudyPanel').classList.remove('hidden'); $('bgPlayRow').classList.add('hidden'); $('bgSoloFinish').classList.add('hidden');
  const saved = localStorage.getItem('tapeStudyRoom');
  if (studyRoom) { studySubscribe(); studyRefresh(); }
  else if (saved) studyConnect(saved);
  else studyHomeOverlay();
}
function studyRequireNick() {
  if (myNick.startsWith('나 ')) setNick();
  return !myNick.startsWith('나 ');
}
async function studyCreateRoom() {
  if (!sbc || !studyRequireNick()) return;
  const errEl = studyErrorEl(); if (errEl) errEl.textContent = '테이블을 여는 중…';
  await ensureAuth(); if (!myUid) { if (errEl) errEl.textContent = '손님 확인이 필요합니다.'; return; }
  const { data, error } = await sbc.rpc('blind_create_room', { p_track:bgTrack, p_nick:myNick });
  if (error) { if (errEl) errEl.textContent = studyFriendly(error); return; }
  await studyConnectOrCleanup(data);
}
async function studyJoinRoom() {
  if (!sbc || !studyRequireNick()) return;
  const input = $('studyCodeInput'), code = (input?.value || '').trim().toUpperCase();
  const errEl = studyErrorEl();
  if (code.length !== 6) { if (errEl) errEl.textContent = '6자리 코드를 입력해 주세요.'; return; }
  if (errEl) errEl.textContent = '테이블을 찾는 중…';
  await ensureAuth(); if (!myUid) { if (errEl) errEl.textContent = '손님 확인이 필요합니다.'; return; }
  const { data, error } = await sbc.rpc('blind_join_room', { p_code:code, p_nick:myNick });
  if (error) { if (errEl) errEl.textContent = studyFriendly(error); return; }
  await studyConnectOrCleanup(data);
}
async function studyConnectOrCleanup(roomId) {
  if (await studyConnect(roomId)) return true;
  if (sbc && myUid) {
    const {error} = await sbc.rpc('blind_leave_room', {p_room_id:roomId});
    if (error) console.warn('study join cleanup', error.message);
  }
  localStorage.removeItem('tapeStudyRoom');
  return false;
}
async function studyClockSync() {
  const before = Date.now();
  const { data } = await sbc.rpc('blind_server_time');
  const after = Date.now();
  if (data) studyServerOffset = Date.parse(data) - (before + after) / 2;
}
async function studyConnect(roomId) {
  await ensureAuth(); if (!myUid) return false;
  localStorage.setItem('tapeStudyRoom', roomId);
  await studyClockSync();
  const ok = await studyRefresh(roomId);
  if (!ok) { localStorage.removeItem('tapeStudyRoom'); studyRoom = null; studyHomeOverlay('테이블 연결에 실패했습니다. 입장 기록을 정리했으니 다시 시도해 주세요.'); return false; }
  studySubscribe();
  return true;
}
function studyDisconnect() {
  clearTimeout(studyRefreshTimer);
  if (studyChannel && sbc) sbc.removeChannel(studyChannel);
  studyChannel = null;
}
function studySubscribe() {
  if (!sbc || !studyRoom || document.querySelector('.tab.on')?.dataset.tab !== 'game') return;
  if (studyChannel) sbc.removeChannel(studyChannel);
  studyChannel = sbc.channel('blind-study-' + studyRoom.id)
    .on('postgres_changes', {event:'*', schema:'public', table:'blind_rooms', filter:`id=eq.${studyRoom.id}`}, studyRefreshSoon)
    .on('postgres_changes', {event:'*', schema:'public', table:'blind_room_players', filter:`room_id=eq.${studyRoom.id}`}, studyRefreshSoon)
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'blind_room_calls', filter:`room_id=eq.${studyRoom.id}`}, studyRefreshSoon)
    .subscribe();
}
function studyRefreshSoon() {
  clearTimeout(studyRefreshTimer);
  studyRefreshTimer = setTimeout(() => studyRefresh(), 120);
}
async function studyRefresh(roomId = studyRoom?.id) {
  if (!sbc || !roomId) return false;
  const [{data:room,error}, {data:players}, {data:calls}] = await Promise.all([
    sbc.from('blind_rooms').select(STUDY_ROOM_COLUMNS).eq('id', roomId).single(),
    sbc.from('blind_room_players').select('*').eq('room_id', roomId).order('joined_at'),
    sbc.from('blind_room_calls').select('*').eq('room_id', roomId).order('day').order('created_at'),
  ]);
  if (error || !room) return false;
  studyRoom = room; studyPlayers = players || []; studyCalls = calls || [];
  bgTrack = room.track;
  document.querySelectorAll('.bgTrackBtn').forEach(b => b.classList.toggle('on', b.dataset.t === bgTrack));
  if (room.status === 'lobby') studyRenderLobby();
  else await studyPrepareRound();
  return true;
}
function studyRenderLobby() {
  $('bgTrackRow').classList.remove('hidden'); $('bgLiveRow').classList.add('hidden');
  const me = studyPlayers.find(p => p.user_id === myUid), isHost = studyRoom.host_user_id === myUid;
  const allReady = studyPlayers.length >= 2 && studyPlayers.every(p => p.ready);
  const rows = studyPlayers.map(p => `<div class="studyPlayer${p.ready?' ready':''}"><span>${esc(p.nick)}${p.user_id===studyRoom.host_user_id?' · 방장':''}</span><span>${p.ready?'● READY':'○ 대기'}</span></div>`).join('');
  $('bgOverBox').innerHTML = `<h4>👥 함께 보는 판</h4><p>${studyRoom.track==='stock'?'미국주식':'코인'} · 200일 · 속도 1×</p><div class="studyCode">${esc(studyRoom.code)}</div>
    <div class="studyLobby">${rows}</div><div class="studyBtns">
      <button class="go invite" onclick="studyCopyInvite()">🔗 초대 링크 복사</button>
      <button class="go nick" onclick="studyChangeNick()">✎ 닉네임 변경</button>
      <button class="go ready" onclick="studyToggleReady()">${me?.ready?'✓ READY 취소':'✓ READY'}</button>
      ${isHost?`<button class="go start" onclick="studyStartRoom()" style="${allReady?'':'opacity:.45'}">▶ 10초 후 시작</button>`:''}
      <button class="go leave" onclick="studyLeaveRoom()">← 방 선택</button>
    </div><div class="studyErr" id="studyLobbyErr">${allReady?'전원 READY · 방장이 시작할 수 있습니다.':studyPlayers.length<2?'한 명 이상 더 기다리는 중입니다.':'READY를 기다리는 중입니다.'}</div>`;
  $('bgOver').classList.remove('hidden');
  $('studyRoomMeta').textContent = `${studyRoom.code} · LOBBY`;
  $('studyPanelBody').innerHTML = `<div class="studyRoomLine"><span>참가자</span><b>${studyPlayers.length}명</b></div><div style="padding-top:9px;font-size:10px;color:var(--dim)">모두 READY하면 방장이 판을 엽니다.</div>`;
}
async function studyToggleReady() {
  const me = studyPlayers.find(p => p.user_id === myUid); if (!me) return;
  const { error } = await sbc.from('blind_room_players').update({ready:!me.ready}).eq('room_id',studyRoom.id).eq('user_id',myUid);
  if (error) { const e=studyErrorEl(); if(e)e.textContent=studyFriendly(error); } else studyRefresh();
}
async function studyStartRoom() {
  const { error } = await sbc.rpc('blind_start_room', {p_room_id:studyRoom.id});
  if (error) { const e=studyErrorEl(); if(e)e.textContent=studyFriendly(error); } else studyRefresh();
}
async function studyCopyInvite() {
  const url = `${location.origin}${location.pathname}?room=${studyRoom.code}`;
  try { await navigator.clipboard.writeText(url); const e=studyErrorEl(); if(e)e.textContent='초대 링크를 복사했습니다.'; }
  catch(e) { const out=studyErrorEl(); if(out)out.textContent=`초대 코드: ${studyRoom.code}`; }
}
async function studyChangeNick() {
  if (!sbc || !studyRoom) return;
  const current = studyPlayers.find(p => p.user_id === myUid)?.nick || myNick;
  const input = prompt('그룹에서 사용할 닉네임 (최대 10자)', current);
  if (!input || !input.trim()) return;
  const next = input.trim().slice(0,10);
  const {error} = await sbc.rpc('blind_update_nick', {p_room_id:studyRoom.id, p_nick:next});
  if (error) { alert(studyFriendly(error)); return; }
  myNick = next; localStorage.setItem('salonNick', myNick);
  renderNick();
  await studyRefresh();
}
async function studyLeaveRoom() {
  if (studyRoom && sbc) {
    if (studyRoom.status === 'running' && !confirm('진행 중인 판에서 나갈까요? 현재 수익률과 판단 기록은 방에서 제거됩니다.')) return;
    const {error} = await sbc.rpc('blind_leave_room', {p_room_id:studyRoom.id});
    if (error) { const e=studyErrorEl(); if(e)e.textContent=studyFriendly(error); else alert(studyFriendly(error)); return; }
  }
  studyDisconnect(); localStorage.removeItem('tapeStudyRoom');
  studyRoom = null; studyPlayers = []; studyCalls = []; bg = null;
  studyHomeOverlay();
}

// 함께 보는 판은 서버 장부가 정본 — wallet/pos를 그대로 받아 반영
function bgApplyServerLedger(src) {
  if (!bg || !src) return;
  bg.wallet = Number(src.wallet ?? src.cash ?? bg.wallet ?? 10000);
  const raw = src.pos;
  const qty = Number(raw?.qty || 0);
  bg.pos = (raw && qty > 1e-10 && (raw.side === 'long' || raw.side === 'short'))
    ? { side: raw.side, qty, entry: Number(raw.entry) || 0,
        margin: Number(raw.margin) || 0, lev: Number(raw.lev) || 1 }
    : null;
  if (bg.pos) bgLev = bg.pos.lev;
  bg.bankrupt = !bg.pos && bg.wallet < 1;
}

function studyRestorePlayerState() {
  if (!bg) return;
  const me = studyPlayers.find(p => p.user_id === myUid);
  if (!me) return;
  bgApplyServerLedger(me);
  bg.trades = Array.isArray(me.trades) ? me.trades : [];
  bg.markers = [...bg.trades].reverse().map(t => ({
    time: bg.norm[Math.max(bg.base, Math.min(bg.norm.length - 1, bg.base + (+t.day || 0)))].time,
    position: t.side === 'BUY' ? 'belowBar' : 'aboveBar',
    color: t.side === 'BUY' ? '#4ade80' : '#f87171',
    shape: t.side === 'BUY' ? 'arrowUp' : 'arrowDown',
    text: t.side === 'BUY' ? 'B' : 'S',
  }));
  bgS.setMarkers(bg.markers);
  $('bgLog').innerHTML = bg.trades.length ? bg.trades.slice(0, 30).map(renderTradeRow).join('') : '<div style="padding:10px 0;color:var(--dim)">아직 거래가 없습니다</div>';
}
async function studyEdge(action, extra = {}) {
  const {data, error} = await sbc.functions.invoke('blind-round', {body:{action, room_id:studyRoom?.id, ...extra}});
  if (error) throw new Error(await edgeErrorCode(error) || error.message || 'SERVER_ERROR');
  if (data?.error) throw new Error(data.error);
  return data;
}
function studyApplyState(state) {
  if (!bg || !state) return;
  bgApplyServerLedger(state);
  bg.trades = Array.isArray(state.trades) ? state.trades : [];
  bg.markers = [...bg.trades].reverse().map(t => ({
    time:bg.norm[Math.max(bg.base,Math.min(bg.norm.length-1,bg.base+(+t.day||0)))].time,
    position:t.side==='BUY'?'belowBar':'aboveBar', color:t.side==='BUY'?'#4ade80':'#f87171',
    shape:t.side==='BUY'?'arrowUp':'arrowDown', text:t.side==='BUY'?'B':'S',
  }));
  bgS.setMarkers(bg.markers);
  $('bgLog').innerHTML = bg.trades.length ? bg.trades.slice(0,30).map(renderTradeRow).join('') : '<div style="padding:10px 0;color:var(--dim)">아직 거래가 없습니다</div>';
  blindStatus();
}
async function studySetLeverage(v) {
  if (!sbc || !bg || !studyRoom || bg.over) return;
  try {
    const state = await studyEdge('leverage', { lev: v });
    studyApplyState(state);
    bgLev = v;
    bgOrderMsg('');
  } catch (error) {
    bgOrderMsg(studyFriendly(error));
  }
  bgLevRender();
}

async function studyTrade(action, pct) {
  if (!sbc || !bg || !studyRoom || bg.over) return;
  try {
    const state = await studyEdge('trade', {side:action, pct, lev:bgLev});
    studyApplyState(state);
  } catch (error) {
    const out = studyErrorEl();
    if (out) out.textContent = studyFriendly(error);
    else console.warn('study trade', error.message);
  }
}
async function studyHostControl(action) {
  if (!sbc || !studyRoom || studyRoom.host_user_id !== myUid) return;
  const {error} = await sbc.rpc('blind_control_room', {p_room_id:studyRoom.id, p_action:action});
  if (error) { const e=studyErrorEl(); if(e)e.textContent=studyFriendly(error); return; }
  await studyRefresh();
}

async function studyKlines() {
  const data = await studyEdge('round');
  if (!Array.isArray(data?.kl) || data.kl.length < BG_PLAY + 2) throw new Error('study candles');
  return {sym:'HIDDEN', kl:data.kl};
}
async function studyWaitChart() {
  for (let i=0; i<40 && !bgCh; i++) await new Promise(r => setTimeout(r, 50));
  if (!bgCh) throw new Error('chart not ready');
}
async function studyPrepareRound() {
  $('bgTrackRow').classList.add('hidden');
  if (bg?.studyRoomId === studyRoom.id) { if (!bg.over) studyGameReady(); return; }
  if (studyLoading) return;
  studyLoading = true;
  $('bgOverBox').innerHTML = '<h4>👥 함께 보는 판</h4><p>모두에게 같은 차트를 배분하는 중…</p>';
  $('bgOver').classList.remove('hidden');
  try {
    await studyWaitChart();
    const {sym, kl} = await studyKlines();
    bgSetupSolo(kl, sym, studyRoom.track, 'study');
  } catch(e) {
    $('bgOverBox').innerHTML = '<h4>연결 지연</h4><p>공동 차트를 불러오지 못했습니다.</p><button class="go" onclick="studyPrepareRound()">다시 불러오기</button>';
  } finally { studyLoading = false; }
}
function studyGameReady() {
  if (!bg || !studyRoom) return;
  $('bgPlayRow').classList.remove('hidden'); $('bgSoloFinish').classList.remove('hidden'); $('bgLiveRow').classList.remove('hidden');
  studyUpdateControls();
  clearInterval(bgTimer); bgTimer = setInterval(studyTick, 200);
  studyTick(); studyRenderPanel();
}
function studyNow() { return Date.now() + studyServerOffset; }
function studyElapsedMs() {
  if (!studyRoom) return 0;
  let elapsed = +(studyRoom.elapsed_ms || 0);
  if (studyRoom.playing && studyRoom.state_at) {
    elapsed += Math.max(0, studyNow() - Date.parse(studyRoom.state_at)) * +(studyRoom.speed || 1);
  }
  return Math.min(BG_PLAY * BG_TICK_MS, elapsed);
}
function studyUpdateControls() {
  const isHost = studyRoom?.host_user_id === myUid;
  const started = studyRoom?.status === 'running' && studyNow() >= Date.parse(studyRoom.start_at || 0);
  const enabled = isHost && started;
  $('bgPlayRow').classList.toggle('prestart', !started);
  const play = $('bgPlayBtn'), speedDown = $('bgSpeedDownBtn'), speedUp = $('bgSpeedUpBtn'), speedOne = $('bgSpeedOneBtn'), speedSelect = $('bgSpeedSelect'), finish = $('bgFinishBtn');
  play.textContent = studyRoom?.playing ? '⏸ 일시정지' : '▶ 재생';
  play.setAttribute('aria-label',studyRoom?.playing ? '일시정지' : '다시 재생');
  bgRenderSpeed(+(studyRoom?.speed || 1));
  finish.textContent = isHost ? '🏳 여기서 정산' : '🔒 방장만 정산';
  [play, speedDown, speedUp, speedOne, finish].forEach(el => {
    el.classList.toggle('roomLocked', !enabled);
    el.style.pointerEvents = enabled ? '' : 'none';
    el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  });
  speedSelect.disabled = !enabled;
}
function studyTick() {
  if (!bg || bg.over || !studyRoom?.start_at) return;
  const remain = Date.parse(studyRoom.start_at) - studyNow();
  if (remain > 0) {
    $('bgOverBox').innerHTML = `<h4>ALL BETS LOCKED</h4><div class="big num">${Math.max(1,Math.ceil(remain/1000))}</div><p>같은 종목 · 같은 출발 시각</p>`;
    $('bgOver').classList.remove('hidden');
    $('bgLiveTxt').textContent = `동시 출발까지 ${Math.ceil(remain/1000)}초`;
    return;
  }
  $('bgOver').classList.add('hidden');
  const elapsed = studyElapsedMs();
  const day = Math.min(BG_PLAY, Math.floor(elapsed / BG_TICK_MS));
  const target = bg.base + day;
  let added = 0, atEdge = chartAtRightEdge(bgCh);
  while (bg.idx < target && !bg.over) { bgAdvanceOneDay(); added++; }
  if (added) { if (atEdge) chartFollowBars(bgCh, added); blindStatus(); studyRenderPanel(); }
  const live = studyRoom.playing && studyRoom.status === 'running';
  $('bgLiveTxt').textContent = `${live?'● GROUP LIVE':'⏸ GROUP PAUSED'} · ${studyPlayers.length}명 · D+${day}/${BG_PLAY}`;
  $('bgLiveDot').style.background = live ? 'var(--gold)' : 'var(--dim)'; $('bgLiveDot').style.boxShadow = live ? '0 0 8px var(--gold)' : 'none';
  studyUpdateControls();
  if (elapsed >= BG_PLAY * BG_TICK_MS || studyRoom.status === 'finished') { clearInterval(bgTimer); bgTimer = null; blindFinish(false); }
}
function studyRenderPanel() {
  if (!studyRoom || studyRoom.status === 'lobby') return;
  const day = bg ? bg.idx - bg.base : 0;
  const checkpoint = Math.min(180, Math.floor(day / 20) * 20);
  const mine = studyCalls.find(c => c.user_id === myUid && c.day === checkpoint);
  $('studyRoomMeta').textContent = `${studyRoom.code} · ${studyRoom.status.toUpperCase()}`;
  $('studyPanelBody').innerHTML = `<div class="studyRoomLine"><span>현재 전망 구간</span><b>D+${checkpoint} → D+${checkpoint+19}</b></div>
    ${mine ? `<div class="studyLockState" style="color:var(--gold)">✓ ${mine.stance.toUpperCase()}</div>` : `<div class="studyCallBtns"><button onclick="studyLockCall('bull')">▲ 강세</button><button onclick="studyLockCall('neutral')">― 중립</button><button onclick="studyLockCall('bear')">▼ 약세</button></div><div class="studyLockState">이 구간에서는 한 번만 선택할 수 있습니다.</div>`}
    <button class="studyExitBtn" onclick="studyLeaveRoom()">🚪 판에서 나가기</button>`;
}
async function studyLockCall(stance) {
  const { error } = await sbc.rpc('blind_lock_call', {p_room_id:studyRoom.id, p_stance:stance, p_note:''});
  if (error) { const s=document.querySelector('.studyLockState'); if(s)s.textContent=studyFriendly(error); return; }
  await studyRefresh();
}
async function studyFinishRound() {
  let result;
  try { result = await studyEdge('finish'); }
  catch (error) {
    $('bgOverBox').innerHTML = `<h4>정산 지연</h4><p>${esc(studyFriendly(error))}</p><button class="go" onclick="studyFinishRound()">다시 정산</button>`;
    return;
  }
  await studyRefresh();
  await studyShowResults(String(result.symbol || '—').replace('USDT',''), result.real_start, result.real_end);
}
function studyOpinionMarkers() {
  const grouped = new Map();
  studyCalls.forEach(call => {
    const key = `${call.day}:${call.stance}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(studyPlayers.find(p => p.user_id === call.user_id)?.nick || '손님');
  });
  const style = {
    bull:{position:'belowBar',color:'#4ade80',shape:'arrowUp',icon:'▲'},
    neutral:{position:'aboveBar',color:'#d4af37',shape:'circle',icon:'●'},
    bear:{position:'aboveBar',color:'#f87171',shape:'arrowDown',icon:'▼'},
  };
  return [...grouped.entries()].map(([key,names]) => {
    const [day, stance] = key.split(':'), s = style[stance];
    const who = names.slice(0,2).join('·') + (names.length > 2 ? ` 외 ${names.length-2}` : '');
    return {time:bg.norm[Math.min(bg.norm.length-1, bg.base+(+day))].time, position:s.position, color:s.color, shape:s.shape, text:`${s.icon} ${names.length} · ${who}`};
  });
}
function studyViewChart() {
  $('bgOver').classList.add('hidden');
  chartShowRecent(bgCh, bg ? bg.idx + 1 : BG_TOTAL, BG_PLAY + 30);
}
async function studyShowResults(name = '—', realStart = '', realEnd = '') {
  const {data:calls} = await sbc.from('blind_room_calls').select('*').eq('room_id',studyRoom.id).order('day').order('created_at');
  studyCalls = calls || studyCalls;
  const buyHold = studyPlayers.find(p => p.buy_hold != null)?.buy_hold;
  const rows = [...studyPlayers].sort((a,b) => (b.roi ?? -1e9) - (a.roi ?? -1e9)).map((p,i) => `<div class="studyResultRow"><span>${i+1}. ${esc(p.nick)}</span><b style="color:${p.roi>0?'var(--grn)':p.roi<0?'var(--red)':'#cfd4dd'}">${p.roi==null?'대기':`${p.roi>=0?'+':''}${(+p.roi).toFixed(2)}%`}</b><span>${Array.isArray(p.trades)?p.trades.length:0}회</span></div>`).join('');
  const opinions = studyOpinionMarkers();
  bgS.setMarkers([...bg.markers, ...opinions].sort((a,b) => a.time - b.time));
  if (realStart) bg.realStart = realStart;
  if (realEnd) bg.realEnd = realEnd;
  bg.sym = name;
  const endDate = realEnd || bg.realEnd;
  $('bgOverBox').innerHTML = `<h4>IDENTITY REVEAL</h4><p>이 판의 정체는 <b style="color:var(--gold);font-size:16px">${esc(name)}</b><br><span style="color:var(--dim)">${bg.realStart} ~ ${endDate} 실제 시세${buyHold==null?'':` · 존버 ${buyHold>=0?'+':''}${(+buyHold).toFixed(2)}%`}</span></p>
    <div class="studyResults">${rows}</div><div class="studyCalls"><div class="studyCallRow">💬 ${opinions.length ? `${studyCalls.length}개의 시장 전망을 구간별로 묶어 차트에 표시했습니다.` : '선택한 시장 전망이 없습니다.'}</div></div>
    <div class="resultWatermark">tapelounge.com</div>
    <div class="studyBtns"><button class="go invite" onclick="studyViewChart()">차트에서 의견 보기</button><button class="go leave" onclick="studyLeaveRoom()">방 선택</button></div>`;
  $('bgOver').classList.remove('hidden'); studyRenderPanel();
}

window.studyCreateRoom = studyCreateRoom; window.studyJoinRoom = studyJoinRoom;
window.studyToggleReady = studyToggleReady; window.studyStartRoom = studyStartRoom;
window.studyCopyInvite = studyCopyInvite; window.studyChangeNick = studyChangeNick; window.studyLeaveRoom = studyLeaveRoom;
window.studyPrepareRound = studyPrepareRound; window.studyLockCall = studyLockCall; window.studyFinishRound = studyFinishRound; window.studyViewChart = studyViewChart;

window.blindOpen = blindOpen; window.blindStart = blindStart;
// ═══ 라운지 모의투자 (BTC 무기한 · 격리 마진) ═══
// 체결가와 청산 판정은 서버가 바이낸스 시세로 한다. 여기서는 화면 표시만 계산한다.
const PAPER_LEV_STEPS = [1, 2, 3, 5, 10];
const PAPER_MMR = 0.005, PAPER_FEE = 0.001;
let paper = null, paperLev = 1, paperPct = 25, paperBusy = false;
let paperPoll = null, paperLiqAsk = 0;

// 400 응답의 오류 코드는 본문에 있다 — supabase-js의 error.message에는 안 담긴다
async function edgeErrorCode(error) {
  try { return (await error?.context?.json())?.error || ''; } catch (e) { return ''; }
}
async function paperEdge(action, extra = {}) {
  const { data, error } = await sbc.functions.invoke('paper-trade', { body: { action, ...extra } });
  if (error) throw new Error(await edgeErrorCode(error) || error.message || 'SERVER_ERROR');
  if (data?.error) throw new Error(data.error);
  return data;
}
function paperSay(text, tone) {
  const el = $('pMsg');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
  el.classList.toggle('paperBust', tone === 'bust');
}
function paperLiqPrice(pos) {
  if (!pos || !(pos.qty > 0) || !(pos.margin > 0)) return null;
  const gap = pos.margin / pos.qty - PAPER_MMR * pos.entry;
  return Math.max(0, pos.side === 'long' ? pos.entry - gap : pos.entry + gap);
}
function paperMaxNotional() {
  const wallet = paper ? paper.wallet : 10000;   // 첫 주문 전에는 시드 기준으로 보여준다
  return (wallet * paperLev) / (1 + paperLev * PAPER_FEE);
}
function pPctSync(v) {
  v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  paperPct = v;
  $('pPctSlider').value = v; $('pPctNum').value = v;
  $('pPctFill').style.width = v + '%';
  $('pBuy').textContent = `롱 ${v}%` + (paperLev > 1 ? ` ${paperLev}×` : '');
  $('pSell').textContent = `숏 ${v}%` + (paperLev > 1 ? ` ${paperLev}×` : '');
}
function pLevRender() {
  $('pLevVal').textContent = paperLev + '×';
  $('pLevVal').style.color = paperLev >= 5 ? '#f87171' : 'var(--gold)';
  $('pLevRow').innerHTML = PAPER_LEV_STEPS.map(x =>
    `<div class="lv${x === paperLev ? ' on' : ''}${x === paperLev && x >= 5 ? ' hot' : ''}" onclick="pLevSync(${x})">${x}×</div>`
  ).join('');
  pPctSync(paperPct);
  paperRender();
}
async function pLevSync(v) {
  v = Math.max(1, Math.min(10, Math.round(Number(v) || 1)));
  const p = paper?.pos;
  if (p) {
    if (paperBusy || v === p.lev) { pLevRender(); return; }
    // 필요증거금 변화를 먼저 계산한다 — 지갑으로 감당이 안 되면 서버까지 갈 것도 없다
    const delta = (p.qty * p.entry) / v - p.margin;
    if (delta > paper.wallet + 0.01) {
      paperSay('증거금이 부족합니다.');
      pLevRender();
      return;
    }
    paperBusy = true;
    try { paperApply(await paperEdge('leverage', { lev: v })); paperLev = v; paperSay(''); }
    catch (e) { paperSay(paperWhy(e)); }
    finally { paperBusy = false; }
  } else {
    paperLev = v;
  }
  pLevRender();
}
function paperWhy(e) {
  const m = e?.message || '';
  if (m.includes('INSUFFICIENT_MARGIN')) return '증거금이 부족합니다.';
  if (m.includes('INVALID_ORDER')) return '주문 가능 금액이 부족합니다.';
  if (m.includes('NO_PRICE')) return '시세를 받아오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  if (m.includes('AUTH_REQUIRED')) return '접속 확인이 필요합니다. 새로고침 후 다시 시도해 주세요.';
  // 짧은 오류 코드면 그대로 보여준다 — 무엇이 왔는지 알아야 고칠 수 있다
  return /^[A-Z_]{3,32}$/.test(m) ? `요청이 거절되었습니다 (${m})` : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
function paperApply(state) {
  if (!state) return;
  paper = {
    wallet: Number(state.wallet) || 0,
    pos: state.pos && Number(state.pos.qty) > 0 ? {
      side: state.pos.side, qty: +state.pos.qty, entry: +state.pos.entry,
      margin: +state.pos.margin, lev: Number(state.pos.lev) || 1,
    } : null,
    refills: Number(state.refills) || 0,
    liquidations: Number(state.liquidations) || 0,
    peak: Number(state.peak_equity) || 0,
  };
  if (paper.pos) paperLev = paper.pos.lev;
  if (state.refilled) paperSay(`💀 파산 — 시드를 다시 채웠습니다 (${paper.refills}회째)`, 'bust');
  pLevRender();
}
function paperPrice() { return lastBtcClose || 0; }
function paperUnreal(px) {
  const p = paper?.pos;
  if (!p || !px) return 0;
  return (p.side === 'long' ? px - p.entry : p.entry - px) * p.qty;
}
function paperEquity() {
  if (!paper) return 0;
  const p = paper.pos;
  return Math.max(0, paper.wallet + (p ? p.margin + paperUnreal(paperPrice()) : 0));
}
function paperRender() {
  if (!$('pWallet')) return;
  const px = paperPrice(), p = paper?.pos;
  document.querySelectorAll('#paperStat .posOnly').forEach(el => el.classList.toggle('hidden', !p));
  $('pWallet').textContent = paper ? '$' + fmt(paper.wallet) : '$' + fmt(10000);
  $('pMaxOrd').textContent = '$' + fmt(paperMaxNotional());
  const liqEl = $('pLiq'), pnlEl = $('pPnl');
  if (p) {
    const isLong = p.side === 'long';
    $('pPos').innerHTML = `<b style="color:${isLong?'var(--grn)':'var(--red)'}">${isLong?'LONG':'SHORT'}</b> `
      + `${p.qty.toFixed(4)} <span style="color:var(--gold)">${p.lev}×</span>`;
    $('pEntry').textContent = fmt(p.entry, 2);
    $('pNotional').textContent = '$' + fmt(p.qty * p.entry);
    $('pMargin').textContent = '$' + fmt(p.margin, 2);
    const liq = paperLiqPrice(p);
    liqEl.textContent = liq === null ? '—' : fmt(liq, 2);
    liqEl.classList.toggle('warn', liq !== null && px > 0 && (isLong ? px <= liq * 1.02 : px >= liq * 0.98));
    const pnl = paperUnreal(px), roe = p.margin > 0 ? pnl / p.margin * 100 : 0;
    pnlEl.textContent = px ? `${pnl>=0?'+':'-'}$${fmt(Math.abs(pnl), 2)} (${roe>=0?'+':''}${roe.toFixed(1)}%)` : '—';
    pnlEl.style.color = pnl > 0 ? 'var(--grn)' : pnl < 0 ? 'var(--red)' : '#c6cad3';
  } else {
    $('pPos').textContent = paper ? '없음' : '주문하면 시작됩니다';
    $('pEntry').textContent = '—'; $('pNotional').textContent = '—'; $('pMargin').textContent = '—';
    liqEl.textContent = '—'; liqEl.classList.remove('warn');
    pnlEl.textContent = '—'; pnlEl.style.color = '#c6cad3';
  }
  $('pEquity').textContent = paper ? '$' + fmt(paperEquity()) : '$' + fmt(10000);
  $('paperBadge').textContent = paper
    ? `청산 ${paper.liquidations} · 파산 ${paper.refills} · 최고 $${fmt(paper.peak)}`
    : '가상 자금 $10,000';
}
// 실시간 시세가 청산가를 넘어서면 서버에 확정을 요청한다 (5초에 한 번까지)
function paperTick(px) {
  if (!paper?.pos || !px) { paperRender(); paperBoardRender(); return; }
  const liq = paperLiqPrice(paper.pos);
  const hit = liq !== null && (paper.pos.side === 'long' ? px <= liq : px >= liq);
  paperRender(); paperBoardRender();
  if (hit && Date.now() - paperLiqAsk > 5000) { paperLiqAsk = Date.now(); paperSync(); }
}
async function paperSync() {
  if (!sbc || paperBusy) return;
  const { data: { session } } = await sbc.auth.getSession();
  if (!session?.user) return;            // 아직 주문한 적 없는 방문자는 계좌를 만들지 않는다
  paperBusy = true;
  try { paperApply(await paperEdge('state', { lev: paperLev })); }
  catch (e) { /* 조회 실패는 조용히 넘긴다 */ }
  finally { paperBusy = false; }
}
async function paperOrder(side) {
  if (paperBusy) return;
  const pct = paperPct / 100;
  if (!pct) { paperSay('주문 비율을 정해 주세요.'); return; }
  paperBusy = true; paperSay('');
  try {
    if (!myUid && !(await ensureAuth())) {
      paperSay('접속 확인에 실패했습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }
    const nick = myNick.startsWith('나 ') ? '' : myNick;
    paperApply(await paperEdge(side, { pct, lev: paperLev, nick }));
  } catch (e) {
    paperSay(paperWhy(e));
  } finally { paperBusy = false; }
}
// ── 실시간 포지션 랭킹: 서버는 포지션 원본만 주고, 순위는 실시간 시세로 여기서 매긴다 ──
let paperBoardRows = [];
async function paperBoardFetch() {
  if (!sbc || activeTab !== 'lounge') return;
  try {
    const { data, error } = await sbc.rpc('paper_leaderboard');
    if (error || !Array.isArray(data)) return;
    paperBoardRows = data;
    paperBoardRender();
  } catch (e) { /* 랭킹은 없어도 그만 */ }
}
function paperBoardRender() {
  const box = $('paperBoard'); if (!box) return;
  const px = paperPrice();
  const rows = paperBoardRows.map(r => {
    const qty = +r.qty, entry = +r.entry, margin = +r.margin;
    if (!(qty > 0) || !(margin > 0) || !(entry > 0) || !px) return null;
    const pnl = (r.side === 'long' ? px - entry : entry - px) * qty;
    return { ...r, roe: pnl / margin * 100 };
  }).filter(Boolean).sort((a, b) => b.roe - a.roe).slice(0, 5);
  box.classList.toggle('hidden', !rows.length);
  if (!rows.length) return;
  $('pbRows').innerHTML = rows.map((r, i) => {
    const isLong = r.side === 'long';
    return `<div class="pbRow${r.me ? ' me' : ''}"><span class="rk">${i + 1}</span>`
      + `<span class="nm">${esc(r.nick || '게스트')}${r.me ? ' · 나' : ''}</span>`
      + `<span class="sd" style="color:${isLong ? 'var(--grn)' : 'var(--red)'}">${isLong ? 'LONG' : 'SHORT'} ${+r.lev || 1}×</span>`
      + `<span class="roe" style="color:${r.roe > 0 ? 'var(--grn)' : r.roe < 0 ? 'var(--red)' : '#c6cad3'}">${r.roe >= 0 ? '+' : ''}${r.roe.toFixed(1)}%</span></div>`;
  }).join('');
}

function paperLoop() {
  clearInterval(paperPoll); paperPoll = null;
  if (activeTab !== 'lounge') return;
  paperSync(); paperBoardFetch();
  // 창을 열어 둔 채로도 청산이 확정되고 랭킹도 낡지 않도록 주기적으로 맞춘다
  paperPoll = setInterval(() => {
    if (document.hidden) return;
    if (paper?.pos) paperSync();
    paperBoardFetch();
  }, 60000);
}
window.pPctSync = pPctSync; window.pLevSync = pLevSync; window.paperOrder = paperOrder;
pLevRender();
setTimeout(paperLoop, 1500);   // 이미 세션이 있으면 계좌를 복원한다

window.blindTrade = blindTrade; window.blindFinish = blindFinish;

if (STUDY_INVITE_CODE) setTimeout(() => {
  document.querySelector('.tab[data-tab="game"]')?.click();
  bgSetMode('study');
}, 0);
else if (bgDailyQuery !== null) setTimeout(() => {
  document.querySelector('.tab[data-tab="game"]')?.click();
  bgSetMode('daily');
  if (bgStartRequested) {
    const day = window.BlindDaily.requestedDay(bgDailyQuery);
    const selection = window.BlindDaily.selection(day);
    const completed = window.BlindDaily.read(localStorage, selection.version).some(result => result.day === day);
    if (!completed) {
      const progress = Boolean(window.BlindDaily.readProgress(localStorage, day, selection.version));
      void blindStart(progress);
    }
  }
}, 0);

// ═══ 📣 거시 발표장 ═══
let macroData = null, macroStarted = false, macroClockTimer = null, macroRefreshTimer = null;
const macroDate = iso => new Date(iso);
const macroKst = (iso, withDate=true) => macroDate(iso).toLocaleString('ko-KR', {
  timeZone:'Asia/Seoul', month:withDate?'numeric':undefined, day:withDate?'numeric':undefined,
  weekday:withDate?'short':undefined, hour:'2-digit', minute:'2-digit', hour12:false,
});
const macroValue = e => e.actual === null || e.actual === undefined ? '—' : `${e.actual}${e.unit||''}`;
const macroPrevious = e => e.previous === null || e.previous === undefined ? '—' : `${e.previous}${e.unit||''}`;
function macroRemaining(ms) {
  if (ms <= 0) return 'ON AIR';
  const sec=Math.floor(ms/1000),day=Math.floor(sec/86400),hour=Math.floor(sec%86400/3600),min=Math.floor(sec%3600/60),s=sec%60;
  return `${day?day+'D ':''}${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function macroEvents() { return Array.isArray(macroData?.events) ? macroData.events : []; }
function macroRenderBoard() {
  const board=$('macroBoard'),now=Date.now(),horizon=now+14*86400000;
  let rows=macroEvents().filter(e=>+macroDate(e.scheduled_at)>=now-3600000&&+macroDate(e.scheduled_at)<=horizon);
  if(!rows.length)rows=macroEvents().filter(e=>+macroDate(e.scheduled_at)>=now).slice(0,8);
  board.replaceChildren();
  if(!rows.length){const empty=document.createElement('div');empty.className='macroEmpty';empty.textContent='예정된 공식 발표가 없습니다.';board.append(empty);return;}
  rows.forEach(e=>{
    const row=document.createElement('div');row.className='macroDay';
    const when=document.createElement('div');when.className='macroWhen';const wb=document.createElement('b');wb.textContent=macroKst(e.scheduled_at).split(' ').slice(0,2).join(' ');const ws=document.createElement('span');ws.textContent=macroKst(e.scheduled_at,false)+' KST';when.append(wb,ws);
    const badge=document.createElement('span');badge.className='macroBadge '+String(e.importance||'').toLowerCase();badge.textContent=e.importance||'SIDE';
    const event=document.createElement('div');event.className='macroEvent';const eb=document.createElement('b');eb.textContent=`${e.code} · ${e.title}`;const es=document.createElement('span');es.textContent=e.note||'공식 발표';event.append(eb,es);
    const source=document.createElement('span');source.className='macroSource';source.textContent=e.source;
    const result=document.createElement('span');result.className='macroResult '+(e.actual!==null?'done':e.status==='waiting'?'wait':'');result.textContent=e.actual!==null?`실제 ${macroValue(e)}`:e.status==='waiting'?'확인 대기':e.status==='observed'?'일정 종료':'예정';
    row.append(when,badge,event,source,result);board.append(row);
  });
}
function macroRenderSettlement() {
  const host=$('macroSettlement'),now=Date.now(),past=macroEvents().filter(e=>+macroDate(e.scheduled_at)<=now).sort((a,b)=>+macroDate(b.scheduled_at)-+macroDate(a.scheduled_at));
  const event=past.find(e=>e.actual!==null)||past[0];host.replaceChildren();
  if(!event){const empty=document.createElement('div');empty.className='macroEmpty';empty.textContent='발표가 끝나면 전표가 열립니다.';host.append(empty);return;}
  const card=document.createElement('div');card.className='settleCard'+(event.actual!==null?' live':'');
  const tag=document.createElement('div');tag.className='settleTag';tag.textContent=event.actual!==null?'OFFICIAL SETTLED':'OFFICIAL CHECK';
  const title=document.createElement('div');title.className='settleTitle';title.textContent=`${event.code} · ${event.title}`;
  const time=document.createElement('div');time.className='settleTime';time.textContent=`${macroKst(event.scheduled_at)} KST · ${event.source}`;
  const nums=document.createElement('div');nums.className='settleNums';
  const prev=document.createElement('div');prev.className='settleNum';const pl=document.createElement('span');pl.textContent='PREVIOUS';const pv=document.createElement('b');pv.textContent=macroPrevious(event);prev.append(pl,pv);
  const arrow=document.createElement('div');arrow.className='settleArrow';arrow.textContent='→';
  const actual=document.createElement('div');actual.className='settleNum';const al=document.createElement('span');al.textContent='ACTUAL';const av=document.createElement('b');av.textContent=event.actual!==null?macroValue(event):'확인 대기';av.style.fontSize=event.actual!==null?'23px':'14px';actual.append(al,av);nums.append(prev,arrow,actual);
  const note=document.createElement('div');note.className='settleNote';note.textContent=event.actual!==null?'공식 실제치가 확인된 전표입니다. 시장 예상치는 사용하지 않습니다.':event.actual_supported?'발표 시각은 지났지만 무료 공식 실제치가 아직 확인되지 않았습니다.':'일정 종료를 기록했습니다. 이 항목은 현재 실제치 자동 확정 대상이 아닙니다.';
  card.append(tag,title,time,nums,note);host.append(card);
}
function macroRenderShocks() {
  const host=$('macroShocks');host.replaceChildren();
  const rows=macroEvents().filter(e=>e.btc&&Object.keys(e.btc).length).sort((a,b)=>+macroDate(b.scheduled_at)-+macroDate(a.scheduled_at)).slice(0,4);
  if(!rows.length){const empty=document.createElement('div');empty.className='macroEmpty';empty.textContent='발표가 끝나면 BTC 5·15·60분 반응이 기록됩니다.';host.append(empty);return;}
  rows.forEach(e=>{const row=document.createElement('div');row.className='shockRow';const code=document.createElement('span');code.className='shockCode';code.textContent=e.code;const name=document.createElement('span');name.className='shockName';name.textContent=macroKst(e.scheduled_at);row.append(code,name);[['m5','5M'],['m15','15M'],['m60','60M']].forEach(([key,label])=>{const cell=document.createElement('span');cell.className='shockMove';const small=document.createElement('small');small.textContent=label;const val=e.btc[key];cell.textContent='';cell.append(small,document.createTextNode(val===undefined?'—':`${val>=0?'+':''}${val.toFixed(2)}%`));if(val!==undefined)cell.classList.add(val>=0?'up':'dn');row.append(cell);});host.append(row);});
}
function macroRender() {
  macroRenderBoard();macroRenderSettlement();macroRenderShocks();macroTick();
  if(macroData?.generated_at)$('macroUpdated').textContent=`갱신 ${macroKst(macroData.generated_at)} KST`;
}
function macroTick() {
  if(!macroData)return;const now=Date.now(),next=macroEvents().find(e=>+macroDate(e.scheduled_at)>now);
  if(next){const left=+macroDate(next.scheduled_at)-now;$('macroNextGrade').textContent=next.importance;$('macroNextTitle').textContent=`${next.code} · ${next.title}`;$('macroNextTime').textContent=`${macroKst(next.scheduled_at)} KST · ${next.source}`;$('macroCountdown').textContent=macroRemaining(left);
  }else{$('macroNextGrade').textContent='CLEAR';$('macroNextTitle').textContent='예정된 발표 없음';$('macroNextTime').textContent='공식 전보 대기';$('macroCountdown').textContent='--:--:--';}
}
async function macroLoad() {
  try{const response=await fetch(`reports/econ_calendar.json?v=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);macroData=await response.json();macroRender();refreshTabBadges();}
  catch(e){const board=$('macroBoard');board.replaceChildren();const empty=document.createElement('div');empty.className='macroEmpty';empty.textContent='발표 전보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.';board.append(empty);$('macroNextTitle').textContent='공식 전보 연결 대기';$('macroNextTime').textContent='데이터가 복구되면 자동 갱신됩니다.';}
}
// ── 인덱스 탭 배지 ──
// 라운지가 이미 들고 있는 데이터로만 만든다. 숨은 탭을 위해 따로 조회하지 않는다는
// 기존 원칙을 깨지 않으려는 것이라, 배지가 붙는 건 발표장 하나뿐이다.
function setTabBadge(tab, text, note){
  const el = document.querySelector(`.tab[data-tab="${tab}"]`); if (!el) return;
  let b = el.querySelector('.tabBadge');
  if (!text) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('b'); b.className = 'tabBadge'; el.appendChild(b); }
  b.textContent = text; b.title = note || '';
}
function refreshTabBadges(){
  const now = Date.now();
  const next = (Array.isArray(macroData?.events) ? macroData.events : [])
    .filter(e => e?.importance === 'VIP' || e?.importance === 'MAIN')
    .map(e => ({ e, at: +new Date(e.scheduled_at) }))
    .filter(x => Number.isFinite(x.at) && x.at > now)
    .sort((a, b) => a.at - b.at)[0];
  // 하루 안으로 다가온 발표만 알린다. 늘 켜져 있는 숫자는 배지가 아니라 장식이다.
  const mins = next ? Math.round((next.at - now) / 60000) : null;
  if (mins === null || mins > 1440) { setTabBadge('macro', ''); return; }
  setTabBadge('macro', mins <= 90 ? `${Math.max(1, mins)}분` : `${Math.round(mins / 60)}시간`,
    `${next.e.code} · ${next.e.title}`);
}
setInterval(refreshTabBadges, 60000);

function macroOpen(){macroLoad();if(!macroStarted){macroStarted=true;macroClockTimer=setInterval(macroTick,1000);macroRefreshTimer=setInterval(macroLoad,300000);}}
function macroClose(){clearInterval(macroClockTimer);clearInterval(macroRefreshTimer);macroClockTimer=macroRefreshTimer=null;macroStarted=false;}
window.macroOpen=macroOpen;

// ═══ ⛓ 블록 금고 ═══
const MEMPOOL = 'https://mempool.space/api';
let onchainStarted = false, onchainTimer = null, chainClockTimer = null, lastChainHeight = null, lastBlockTs = null;
const btcText = sats => { const btc=sats/1e8; return btc>=1000?`${(btc/1000).toFixed(1)}K BTC`:`${btc.toFixed(btc>=10?1:3)} BTC`; };
let chainReport = null, chainReportPending = null;
const chainNum = v => Number.isFinite(+v) ? +v : null;
const chainClamp = (v,a,b) => Math.max(a,Math.min(b,v));
function chainRows(data){ return Array.isArray(data?.history) ? data.history.filter(r=>r&&r.date) : []; }
function chainLatest(rows,key){ for(let i=rows.length-1;i>=0;i--){const v=chainNum(rows[i][key]);if(v!==null)return v;}return null; }
function chainAvg(rows,key,n){ const vals=rows.slice(-n).map(r=>chainNum(r[key])).filter(v=>v!==null); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null; }
function chainSum(rows,key,n){ return rows.slice(-n).reduce((s,r)=>s+(chainNum(r[key])||0),0); }
function chainPct(value,base){ return value!==null&&base ? (value/base-1)*100 : null; }
function chainSigned(v,d=1,suffix='%'){ return v===null?'—':`${v>=0?'+':''}${v.toFixed(d)}${suffix}`; }
function chainCompact(v,d=1){ if(v===null)return '—'; const a=Math.abs(v); if(a>=1e12)return (v/1e12).toFixed(d)+'T';if(a>=1e9)return (v/1e9).toFixed(d)+'B';if(a>=1e6)return (v/1e6).toFixed(d)+'M';if(a>=1e3)return (v/1e3).toFixed(d)+'K';return v.toFixed(d); }
function chainMoney(v){ if(v===null)return '—'; return '$'+chainCompact(v,v>=1e6?1:0); }
function chainTone(v,dead=1){ return Math.abs(v)<dead?'':v>0?'up':'dn'; }
function chainMake(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function chainPillar(host,{icon,title,state,value,copy,tone}){const card=chainMake('div','chainPillar '+(tone||''));const top=chainMake('div','chainPillarTop');top.append(chainMake('span','',icon+' '+title),chainMake('b','',state));card.append(top,chainMake('div','chainPillarValue',value),chainMake('div','chainPillarCopy',copy));host.append(card);}
function chainMetric(host,{label,value,delta,hint,tone}){const card=chainMake('div','chainMetric');card.append(chainMake('div','chainMetricLabel',label),chainMake('div','chainMetricValue',value),chainMake('div','chainMetricDelta '+(tone||''),delta),chainMake('div','chainMetricHint',hint));host.append(card);}
function renderChainReport(data){
  const rows=chainRows(data); if(!rows.length)throw new Error('empty on-chain report');
  const price=chainLatest(rows,'price'),mvrv=chainLatest(rows,'mvrv'),active=chainLatest(rows,'active_addresses'),tx=chainLatest(rows,'transactions'),hash=chainLatest(rows,'hash_rate'),fees=chainLatest(rows,'fees_btc'),issuance=chainLatest(rows,'issuance_btc'),blocks=chainLatest(rows,'blocks'),addresses=chainLatest(rows,'addresses_with_balance'),exchange=chainLatest(rows,'exchange_balance_btc'),supply=chainLatest(rows,'supply_btc'),roi1y=chainLatest(rows,'roi_1y');
  const active30=chainAvg(rows,'active_addresses',30),tx30=chainAvg(rows,'transactions',30),hash30=chainAvg(rows,'hash_rate',30),exchange30=chainAvg(rows,'exchange_balance_btc',30);
  const activeD=chainPct(active,active30),txD=chainPct(tx,tx30),hashD=chainPct(hash,hash30),exchangeD=chainPct(exchange,exchange30);
  const net7=chainSum(rows,'exchange_inflow_btc',7)-chainSum(rows,'exchange_outflow_btc',7);
  const realized=price&&mvrv?price/mvrv:null,feeShare=fees!==null&&issuance!==null&&fees+issuance?fees/(fees+issuance)*100:null,reservePct=exchange&&supply?exchange/supply*100:null,inflation=issuance&&supply?issuance*365/supply*100:null;
  const activityScore=chainClamp(50+(activeD||0)*1.6+(txD||0)*.6,15,85);
  const flowScore=chainClamp(50-net7/120,15,85);
  const valueScore=mvrv===null?50:mvrv<1?58:mvrv<1.5?72:mvrv<2?62:mvrv<2.5?44:28;
  const minerScore=chainClamp(50+(hashD||0)*1.4+(feeShare||0)*.5,15,85);
  const score=Math.round((activityScore+flowScore+valueScore+minerScore)/4);
  const verdict=score>=65?'축적과 네트워크 체력이 우세':score>=55?'건설적이지만 확인이 필요':score>=45?'신호가 엇갈린 중립 구간':score>=35?'수요 둔화에 주의할 구간':'방어적 조건이 우세';
  $('chainScore').style.setProperty('--score',score);$('chainScoreNum').textContent=score;$('chainVerdict').textContent=verdict;
  $('chainVerdictSub').textContent=score>=55?'거래소 수급과 가치 구간은 우호적이지만, 단기 방향은 활동 증가가 이어지는지 확인해야 합니다.':'한쪽 신호만 강하게 믿기보다 활동·수급·가치·채굴의 엇갈림이 해소되는지 보는 편이 좋습니다.';
  const checks=[
    [activeD>=0?'up':'dn','활동',`활성 주소가 30일 평균보다 ${chainSigned(activeD)} ${activeD>=0?'많습니다.':'적습니다.'}`],
    [net7<=0?'up':'dn','거래소',`7일 순${net7<=0?'유출':'유입'} ${chainCompact(Math.abs(net7),1)} BTC · ${net7<=0?'즉시 팔 수 있는 물량 감소 쪽':'잠재 매도 유동성 증가 쪽'}입니다.`],
    [mvrv>2.4?'dn':mvrv>=1?'up':'','가치',`MVRV ${mvrv?.toFixed(2)??'—'} · 평균 원가 추정치는 ${chainMoney(realized)}입니다.`],
    [hashD>=0?'up':'dn','채굴',`해시레이트가 30일 평균보다 ${chainSigned(hashD)}입니다.`]
  ];
  const checklist=$('chainChecklist');checklist.replaceChildren();checks.forEach(c=>{const row=chainMake('div','chainCheck');row.append(chainMake('i',c[0]),chainMake('b','',c[1]),chainMake('span','',c[2]));checklist.append(row);});
  const pillars=$('chainPillars');pillars.replaceChildren();
  chainPillar(pillars,{icon:'👥',title:'네트워크 활동',state:activityScore>=58?'EXPANDING':activityScore<42?'COOLING':'STEADY',value:`${chainCompact(active,0)} active`,copy:`거래 ${chainCompact(tx,0)}건 · 활성 주소는 30일 평균 대비 ${chainSigned(activeD)}. 사용자 수가 아니라 사용 흔적으로 읽습니다.`,tone:chainTone(activityScore-50,8)});
  chainPillar(pillars,{icon:'🏦',title:'거래소 수급',state:net7<0?'NET OUTFLOW':net7>0?'NET INFLOW':'BALANCED',value:`${net7>=0?'+':''}${chainCompact(net7,1)} BTC / 7D`,copy:`거래소 보유량 ${chainCompact(exchange,1)} BTC(${reservePct?.toFixed(1)??'—'}%). 입금은 매도 가능성이지 매도 확정이 아닙니다.`,tone:net7<0?'up':net7>0?'dn':''});
  chainPillar(pillars,{icon:'⚖️',title:'가치 구간',state:mvrv<1?'UNDERWATER':mvrv<2?'BALANCED':mvrv<2.5?'PROFIT HEAVY':'HEATED',value:`MVRV ${mvrv?.toFixed(2)??'—'}`,copy:`현재가 ${chainMoney(price)} · 실현가격 추정 ${chainMoney(realized)}. 이익권 물량의 크기이지 매도 시점표는 아닙니다.`,tone:mvrv>2.4?'dn':mvrv>=1&&mvrv<2?'up':''});
  chainPillar(pillars,{icon:'⛏',title:'채굴·보안',state:hashD>=3?'STRENGTHENING':hashD<=-3?'SOFTENING':'STABLE',value:`${chainCompact(hash/1e6,1)} EH/s`,copy:`30일 평균 대비 ${chainSigned(hashD)} · 채굴 수익 중 수수료 비중 ${feeShare?.toFixed(1)??'—'}%. 장기 체력 지표입니다.`,tone:chainTone(hashD,3)});
  const metrics=$('chainMetrics');metrics.replaceChildren();
  [
    {label:'MVRV',value:mvrv?.toFixed(2)??'—',delta:`실현가격 ${chainMoney(realized)}`,hint:'시장가 ÷ 실현가치',tone:mvrv>2.4?'dn':mvrv>=1?'up':''},
    {label:'ACTIVE ADDRESSES',value:chainCompact(active,0),delta:`vs 30D ${chainSigned(activeD)}`,hint:'하루 동안 활동한 주소',tone:chainTone(activeD,3)},
    {label:'TRANSACTIONS',value:chainCompact(tx,0),delta:`vs 30D ${chainSigned(txD)}`,hint:'확정된 일일 거래 수',tone:chainTone(txD,3)},
    {label:'EXCHANGE NETFLOW · 7D',value:`${net7>=0?'+':''}${chainCompact(net7,1)} BTC`,delta:net7<=0?'순유출 · 공급 감소 쪽':'순유입 · 매도 가능 물량 쪽',hint:'유입 합계 − 유출 합계',tone:net7<0?'up':net7>0?'dn':''},
    {label:'EXCHANGE RESERVE',value:`${chainCompact(exchange,1)} BTC`,delta:`vs 30D ${chainSigned(exchangeD)}`,hint:`유통량의 ${reservePct?.toFixed(1)??'—'}%`,tone:exchangeD<0?'up':exchangeD>0?'dn':''},
    {label:'HASH RATE',value:`${chainCompact(hash/1e6,1)} EH/s`,delta:`vs 30D ${chainSigned(hashD)}`,hint:'채굴 연산력 추정',tone:chainTone(hashD,3)},
    {label:'NETWORK FEES',value:`${fees?.toFixed(2)??'—'} BTC`,delta:`채굴수익 중 ${feeShare?.toFixed(1)??'—'}%`,hint:'하루 총수수료',tone:''},
    {label:'NEW ISSUANCE',value:`${issuance?.toFixed(1)??'—'} BTC`,delta:`연율 ${inflation?.toFixed(2)??'—'}%`,hint:'하루 신규 발행량',tone:''},
    {label:'ADDRESSES WITH BALANCE',value:chainCompact(addresses,1),delta:'잔액 0 초과',hint:'주소 수 ≠ 사용자 수',tone:''},
    {label:'BLOCKS / DAY',value:blocks?.toFixed(0)??'—',delta:`평균 간격 ${blocks?((1440/blocks).toFixed(1)+'분'):'—'}`,hint:'목표는 약 10분/블록',tone:''},
    {label:'BTC SUPPLY',value:`${chainCompact(supply,2)} BTC`,delta:`신규 ${issuance?.toFixed(1)??'—'} BTC/day`,hint:'현재 발행된 공급량',tone:''},
    {label:'PRICE RETURN · 1Y',value:chainSigned(roi1y,1),delta:`현물가 ${chainMoney(price)}`,hint:'온체인 해석의 가격 문맥',tone:chainTone(roi1y,5)}
  ].forEach(m=>chainMetric(metrics,m));
  const asOf=data.as_of||rows.at(-1).date,generated=data.generated_at?new Date(data.generated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—';
  $('chainDataStamp').innerHTML=`<b>Coin Metrics Community</b> · 기준일 ${esc(asOf)} UTC · 생성 ${esc(generated)} KST · 일일 지표는 확정·수정 시차가 서로 다를 수 있습니다. BALANCE ${score}는 투자 추천이 아닌 설명용 합성값입니다.`;
}
async function loadChainReport(){
  if(chainReport){renderChainReport(chainReport);return;}if(chainReportPending)return chainReportPending;
  chainReportPending=(async()=>{try{const r=await fetch('reports/onchain.json?v='+Math.floor(Date.now()/900000),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);chainReport=await r.json();renderChainReport(chainReport);}catch(e){$('chainVerdict').textContent='일일 장부 연결 대기';$('chainVerdictSub').textContent='실시간 멤풀은 정상 작동합니다. 일일 온체인 스냅샷은 다음 갱신 때 다시 연결합니다.';$('chainDataStamp').textContent='일일 온체인 데이터를 불러오지 못했습니다. LIVE FLOOR와는 독립된 데이터입니다.';}finally{chainReportPending=null;}})();return chainReportPending;
}
function renderRoulette(fee, blocks) {
  const vals=[fee?.fastestFee,fee?.halfHourFee,fee?.hourFee,fee?.economyFee,fee?.minimumFee].filter(Number.isFinite);
  const legend=$('rouletteLegend'); legend.replaceChildren();
  const labels=['PENTHOUSE','VIP','LOBBY','ECONOMY','BASEMENT'];
  (vals.length?vals:[0,0,0,0,0]).forEach((v,i)=>{const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('b');a.textContent=labels[i];b.textContent=v?`${v} sat/vB`:'—';row.append(a,b);legend.append(row);});
  const first=Array.isArray(blocks)?blocks[0]:null;
  if(first?.nTx){const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('b');a.textContent='NEXT BLOCK SEATS';b.textContent=fmt(first.nTx);row.append(a,b);legend.append(row);}
}
function renderElevator(mp, fee, blocks) {
  const el=$('mempoolElevator'); el.replaceChildren(); const maxTx=Math.max(1,...(blocks||[]).slice(0,4).map(b=>+b.nTx||0));
  const floors=[
    {name:'B1 · 대기',fee:fee?.minimumFee||1,n:Math.max(0,(mp?.count||0)-(blocks||[]).slice(0,3).reduce((s,b)=>s+(+b.nTx||0),0))},
    {name:'L · 일반',fee:fee?.economyFee||0,n:+blocks?.[2]?.nTx||0},
    {name:'VIP · 급행',fee:fee?.hourFee||0,n:+blocks?.[1]?.nTx||0},
    {name:'PH · 다음',fee:fee?.fastestFee||0,n:+blocks?.[0]?.nTx||0,vip:true},
  ];
  floors.forEach(f=>{const row=document.createElement('div');row.className='eFloor'+(f.vip?' vip':'');const name=document.createElement('span');name.className='eFloorName';name.textContent=f.name;const bar=document.createElement('div');bar.className='eFloorBar';const fill=document.createElement('i');fill.style.width=Math.min(100,f.n/maxTx*100)+'%';bar.append(fill);const val=document.createElement('b');val.textContent=`${f.fee} sat · ${fmt(f.n)}`;row.append(name,bar,val);el.append(row);});
}
function renderWhaleVault(txs) {
  const vault=$('whaleVault'); vault.replaceChildren();
  const large=(txs||[]).map(tx=>({txid:tx.txid||'',value:+tx.value||0,fee:+tx.fee||0})).sort((a,b)=>b.value-a.value).slice(0,6);
  if(!large.length){const n=document.createElement('div');n.className='chainNote';n.textContent='열린 금고가 없습니다.';vault.append(n);return [];}
  large.forEach((tx,i)=>{const card=document.createElement('div');card.className='vault'+(i===0?' vip':'');const tag=document.createElement('div');tag.className='vaultTag';tag.textContent=i===0?'VIP VAULT':'MEMPOOL VAULT';const amt=document.createElement('div');amt.className='vaultAmt';amt.textContent=btcText(tx.value);const meta=document.createElement('div');meta.className='vaultMeta';meta.textContent=`${tx.txid.slice(0,8)}… · fee ${fmt(tx.fee)} sats`;card.append(tag,amt,meta);vault.append(card);}); return large;
}
function renderChainSignals(mp,fee,blockAge,whales) {
  const signals=[];
  if(blockAge>1200) signals.push(['⏳','BLOCK DROUGHT',`${Math.floor(blockAge/60)}분째 새 블록 없음`,'DELAY',true]);
  if((fee?.fastestFee||0)>=50) signals.push(['🔥','FEE SURGE',`급행 ${fee.fastestFee} sat/vB`,'HOT',true]);
  if((mp?.vsize||0)>=20000000) signals.push(['🌊','MEMPOOL FLOOD',`${(mp.vsize/1e6).toFixed(1)} MB 대기`,'FLOOD',true]);
  const giants=(whales||[]).filter(w=>w.value>=100e8);
  if(giants.length>=3) signals.push(['🐋','WHALE PARADE',`100 BTC+ 전송 ${giants.length}건 포착`,'VIP',true]);
  if((mp?.vsize||Infinity)<2000000) signals.push(['✨','CLEAR FLOOR','멤풀이 빠르게 비워진 상태','CALM',false]);
  if(!signals.length) signals.push(['🔒','VAULT NORMAL','특이 징후 없이 정산 진행 중','STABLE',false]);
  const board=$('chainSignals'); board.replaceChildren();
  signals.slice(0,5).forEach(s=>{const row=document.createElement('div');row.className='chainSignal'+(s[4]?' hot':'');const icon=document.createElement('span');icon.textContent=s[0];const main=document.createElement('div');const b=document.createElement('b');b.textContent=s[1];const copy=document.createElement('span');copy.textContent=s[2];main.append(b,copy);const code=document.createElement('em');code.textContent=s[3];row.append(icon,main,code);board.append(row);});
}
function blockLanding(height, block) {
  $('landingHeight').textContent='#'+height; $('landingMeta').textContent=block?`${fmt(block.tx_count||0)}건 정산 · ${Math.round(block.size/1000||0)} KB`:'새 블록이 금고에 착륙했습니다.';
  const el=$('blockLanding');el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3800);const wheel=$('rouletteWheel');wheel.classList.remove('settle');void wheel.offsetWidth;wheel.classList.add('settle');
}
function updateChainClock(){if(!lastBlockTs)return;const age=Math.max(0,Date.now()/1000-lastBlockTs),eta=Math.max(0,600-age);$('chainBlockAge').textContent=`마지막 블록 ${Math.floor(age/60)}분 전 · LIVE`;$('nextBlockEta').textContent=eta?`~${Math.max(1,Math.ceil(eta/60))}m`:'DUE';}
async function onchainRefresh() {
  const all=await Promise.allSettled([
    fetch(`${MEMPOOL}/mempool`).then(r=>r.json()),fetch(`${MEMPOOL}/v1/fees/recommended`).then(r=>r.json()),fetch(`${MEMPOOL}/mempool/recent`).then(r=>r.json()),fetch(`${MEMPOOL}/blocks/tip/height`).then(r=>r.text()),fetch(`${MEMPOOL}/v1/fees/mempool-blocks`).then(r=>r.json()),fetch(`${MEMPOOL}/v1/blocks`).then(r=>r.json()),
  ]); const get=i=>all[i].status==='fulfilled'?all[i].value:null;
  const mp=get(0),fee=get(1),txs=get(2),height=+(get(3)),mBlocks=get(4),blocks=get(5),latest=Array.isArray(blocks)?blocks[0]:null;
  if(height){$('chainHeight').textContent='#'+height;if(lastChainHeight!==null&&height>lastChainHeight)blockLanding(height,latest);lastChainHeight=height;}
  if(latest?.timestamp)lastBlockTs=latest.timestamp;
  if(mp){$('mempoolCount').textContent=fmt(mp.count);$('mempoolSize').textContent=mp.vsize>=1e6?`${(mp.vsize/1e6).toFixed(1)} MB`:`${(mp.vsize/1e3).toFixed(0)} KB`;}
  if(fee)$('fastFee').textContent=`${fee.fastestFee} sat/vB`;
  renderRoulette(fee,Array.isArray(mBlocks)?mBlocks:[]);renderElevator(mp,fee,Array.isArray(mBlocks)?mBlocks:[]);const whales=renderWhaleVault(Array.isArray(txs)?txs:[]);
  const age=lastBlockTs?Math.max(0,Date.now()/1000-lastBlockTs):0;renderChainSignals(mp,fee,age,whales);updateChainClock();$('chainUpdated').textContent=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function onchainOpen(){loadChainReport();onchainRefresh();if(!onchainStarted){onchainStarted=true;onchainTimer=setInterval(onchainRefresh,20000);chainClockTimer=setInterval(updateChainClock,1000);}}
function onchainClose(){clearInterval(onchainTimer);clearInterval(chainClockTimer);onchainTimer=chainClockTimer=null;onchainStarted=false;}

// 선물 청산 — Binance 현행 market 스트림, 끊김 시 자동 재연결
let wsl, liqReconnectTimer;
const seenLiquidations = new Set();
function connectLiquidations() {
  if (!tabLive('lounge') || wsl) return;
  clearTimeout(liqReconnectTimer);
  wsl = new WebSocket('wss://fstream.binance.com/market/stream?streams=!forceOrder@arr/btcdomusdt@kline_1m');
  wsl.onclose = () => {
    wsl = null;
    if (tabLive('lounge')) liqReconnectTimer = setTimeout(connectLiquidations, 3000);
  };
  wsl.onerror = () => wsl?.close();
  wsl.onmessage = ev => {
  if (!tabLive('lounge')) return;
  const { stream: lst, data: ldata } = JSON.parse(ev.data);
  if (lst === 'btcdomusdt@kline_1m') {
    $('domPx').textContent = fmt(+ldata.k.c, 1);   // 차트 갱신은 wsChartF 담당
    return;
  }
  const o = ldata.o;
  if (!o) return;
  const eventKey = `${o.s}:${o.S}:${o.T}:${o.z}`;
  if (seenLiquidations.has(eventKey)) return;
  seenLiquidations.add(eventKey);
  if (seenLiquidations.size > 500) seenLiquidations.delete(seenLiquidations.values().next().value);
  const val = +(o.z || o.q) * +(o.ap || o.p), longLiq = o.S === 'SELL';
  if (!Number.isFinite(val) || val <= 0) return;
  if (o.s !== 'BTCUSDT') {
    if (val >= 200000) say('sys','', `💥 ${o.s.replace('USDT','')} ${longLiq?'롱':'숏'} 청산 <b class="num ${longLiq?'dn':'up'}">$${fmt(val/1000)}K</b>`);
    return;
  }
  const flash = $('liqFlash');
  flash.textContent = `💥 ${longLiq?'롱':'숏'} 청산 $${fmt(val/1000)}K`;
  flash.style.color = longLiq ? 'var(--red)' : 'var(--grn)';
  flash.style.opacity = 1; setTimeout(()=>flash.style.opacity=0, 1800);
  addRainRing({ x: 30+Math.random()*(rain.width-60), y: 50+Math.random()*180, r: 4, max: Math.max(40, Math.min(160, Math.sqrt(val)/7)), side: !longLiq });
  if (val >= 30000) say('sys','', `💥 ${longLiq?'롱':'숏'} 청산 <b class="num ${longLiq?'dn':'up'}">$${fmt(val/1000)}K</b>`);
  };
}
function disconnectLiquidations() {
  clearTimeout(liqReconnectTimer); liqReconnectTimer = null;
  if (wsl) { wsl.onmessage = null; wsl.onclose = null; try { wsl.close(); } catch(e) {} }
  wsl = null;
}

// ═══ 세션 챔피언십 — 아시아·유럽·미국장 최근 회차 수익률 비교 ═══
// 5분봉 REST 스냅샷만 사용 (웹소켓 없음). 라운지가 보이는 동안 5분마다 갱신.
let sessionBars = [], sessionTimer = null, sessionFetching = false;
function sessionDayStart(){ const d = new Date(Date.now()+9*3600000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 9*3600000; }
// 세션은 달력 날짜에 맞춰 돌지 않는다(US는 22~08로 자정을 넘김).
// 최근 30시간을 받아 각 세션의 '가장 최근 회차'를 항상 채운다.
function sessionFetchStart(){ return Date.now() - 30*3600000; }
function sessionKstDay(ts){ const d = new Date(ts+9*3600000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`; }
function sessionNameOf(ts){ const h = new Date(ts+9*3600000).getUTCHours();
  return h>=8 && h<16 ? 'ASIA' : h>=16 && h<22 ? 'EUROPE' : 'US'; }
function renderSessions() {
  // 라벨이 같아도 다른 날의 세션일 수 있다 (US는 22~08로 자정을 넘김).
  // 연속 구간으로 쪼갠 뒤 각 세션의 '가장 최근 구간'만 집계한다.
  const runs = [];
  sessionBars.forEach(b => {
    const name = sessionNameOf(b.t);
    const last = runs[runs.length - 1];
    if (last && last.name === name) last.bars.push(b);
    else runs.push({ name, bars: [b] });
  });
  const groups = {ASIA:[], EUROPE:[], US:[]};
  runs.forEach(r => { groups[r.name] = r.bars; });   // 뒤쪽 구간이 앞쪽을 덮어씀
  const liveName = runs.length ? runs[runs.length-1].name : null;   // 마지막 구간 = 진행 중
  const today = sessionKstDay(Date.now());
  const stats = Object.entries(groups).map(([name, a]) => {
    if (!a.length) return { name, a, ret:null, range:null, score:-1 };
    const open = a[0].o, close = a.at(-1).c;
    const hi = Math.max(...a.map(x => x.h)), lo = Math.min(...a.map(x => x.l));
    const ret = (close/open - 1) * 100, range = (hi/lo - 1) * 100;
    const end = name === liveName ? Date.now() : a.at(-1).t + 5*60000;
    const minutes = Math.max(1, Math.floor((end - a[0].t) / 60000));
    return { name, a, ret, range, minutes };
  });
  const winner = stats.filter(x => x.ret !== null)
    .sort((a,b) => (b.ret - a.ret) || (b.range - a.range))[0];
  const grid = $('sessionGrid'); grid.textContent = '';
  stats.forEach(s => {
    const c = document.createElement('div');
    c.className = 'sessionCard' + (s.name === liveName ? ' live' : '');
    const label = document.createElement('span'); label.textContent = s.name;
    if (s.a.length) {
      const st = document.createElement('i');
      st.className = 'sessionState' + (s.name === liveName ? ' live' : '');
      st.textContent = s.name === liveName ? '진행 중'
        : sessionKstDay(s.a.at(-1).t + 5*60000) === today ? '오늘 마감' : '어제 마감';
      label.appendChild(st);
    }
    const b = document.createElement('b');
    b.textContent = s.ret === null ? '—' : `${s.ret>=0?'+':''}${s.ret.toFixed(2)}%`;
    if (s.ret !== null) b.className = s.ret >= 0 ? 'up' : 'dn';
    const small = document.createElement('small');
    small.textContent = s.ret === null ? '아직 열리지 않음'
      : `변동폭 ${s.range.toFixed(2)}% · ${s.minutes}분`;
    c.append(label, b, small); grid.appendChild(c);
  });
  $('sessionBadge').textContent = winner ? `${winner.name} LEADS` : 'LATEST';
  $('sessionCopy').textContent = winner
    ? `${winner.name} 세션이 등락률 ${winner.ret>=0?'+':''}${winner.ret.toFixed(2)}%로 수익률 선두입니다. 변동폭은 ${winner.range.toFixed(2)}%입니다.`
    : '세션 장부를 기다리고 있습니다.';
}
async function fetchSessions() {
  if (sessionFetching) return;
  sessionFetching = true;
  try {
    const r = await fetch(`${SPOT_DATA_API}/klines?symbol=BTCUSDT&interval=5m&startTime=${sessionFetchStart()}&limit=360`);
    const k = await r.json();
    if (Array.isArray(k)) {
      sessionBars = k.map(x => ({ t:+x[0], o:+x[1], h:+x[2], l:+x[3], c:+x[4] }));
      renderSessions();
    }
  } catch(e) {
    $('sessionCopy').textContent = '세션 장부를 다시 불러오는 중입니다.';
  } finally { sessionFetching = false; }
}
function sessionOpen() {
  if (sessionTimer) return;
  fetchSessions();
  sessionTimer = setInterval(fetchSessions, 300000);   // 5분 스냅샷
}
function sessionClose() { clearInterval(sessionTimer); sessionTimer = null; }

// ═══ 📊 마켓 인텔리전스 데스크 ═══
const DESK_FUT='https://fapi.binance.com',DESK_MARKET=DESK_FUT+'/fapi/v1',DESK_FDATA=DESK_FUT+'/futures/data';
const DESK_STRUCTURE_TTL=120000,DESK_DERIV_TTL=60000;
let deskActiveView='structure',deskRuntimeOn=false,deskWsMarket=null,deskWsBook=null,deskTimer=null,deskMarketRetry=null,deskBookRetry=null,deskGeneration=0,deskStructurePending=false,deskDerivPending=false,deskStructureNext=0,deskDerivNext=0;
const deskControllers=new Set();
const deskState={price:null,tfs:{},daily:[],weekly:[],session:[],cvdSeed:[],structureAt:0,derivAt:0,premium:null,oi:null,oiHist:[],globalHist:[],takerHist:[],bids:[],asks:[],buckets:[],lastWhale:null,marketConnected:false,bookConnected:false,wallTrack:{bid:null,ask:null}};

function deskView(name){
  deskActiveView=name;
  document.querySelectorAll('[data-desk-view]').forEach(b=>b.classList.toggle('on',b.dataset.deskView===name));
  document.querySelectorAll('[data-desk-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.deskPanel!==name));
  deskRenderActive();
}
function deskNum(n,d=2){return Number.isFinite(n)?fmt(n,d):'—';}
function deskPct(n,d=2){return Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(d)}%`:'—';}
function deskSignedMoney(n){return Number.isFinite(n)?`${n>=0?'+':'−'}${moneyShort(Math.abs(n))}`:'—';}
function deskTone(el,tone){if(!el)return;el.className='deskPill'+(tone?' '+tone:'');}
function deskMapBars(rows){return Array.isArray(rows)?rows.map(k=>({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5],end:+k[6],qv:+k[7],tbq:+k[10]})).filter(k=>Number.isFinite(k.c)):[];}
async function deskJson(url,signal){const r=await fetch(url,{signal,credentials:'omit'});if(!r.ok){const e=new Error(`HTTP ${r.status}`),retry=+(r.headers.get('Retry-After')||0);e.retryAfter=retry>0?retry*1000:0;throw e;}const d=await r.json();if(d&&Number.isFinite(+d.code)&&+d.code<0)throw new Error(d.msg||'Binance API error');return d;}
function deskAbortController(){const c=new AbortController();deskControllers.add(c);return c;}

function deskEMA(values,n){
  if(values.length<n)return null;let e=values.slice(0,n).reduce((a,c)=>a+c,0)/n,k=2/(n+1);
  for(let i=n;i<values.length;i++)e=values[i]*k+e*(1-k);return e;
}
function deskRSI(values,n=14){
  if(values.length<=n)return null;let gain=0,loss=0;
  for(let i=1;i<=n;i++){const d=values[i]-values[i-1];if(d>0)gain+=d;else loss-=d;}
  gain/=n;loss/=n;
  for(let i=n+1;i<values.length;i++){const d=values[i]-values[i-1];gain=(gain*(n-1)+Math.max(0,d))/n;loss=(loss*(n-1)+Math.max(0,-d))/n;}
  if(!loss)return 100;return 100-100/(1+gain/loss);
}
function deskATR(bars,n=14){
  if(bars.length<=n)return null;const tr=[];
  for(let i=1;i<bars.length;i++)tr.push(Math.max(bars[i].h-bars[i].l,Math.abs(bars[i].h-bars[i-1].c),Math.abs(bars[i].l-bars[i-1].c)));
  let a=tr.slice(0,n).reduce((x,y)=>x+y,0)/n;for(let i=n;i<tr.length;i++)a=(a*(n-1)+tr[i])/n;return a;
}
function deskATRSeries(bars,n=14){
  if(bars.length<=n)return[];const tr=[];
  for(let i=1;i<bars.length;i++)tr.push(Math.max(bars[i].h-bars[i].l,Math.abs(bars[i].h-bars[i-1].c),Math.abs(bars[i].l-bars[i-1].c)));
  let a=tr.slice(0,n).reduce((x,y)=>x+y,0)/n,out=[a/bars[n].c*100];
  for(let i=n;i<tr.length;i++){a=(a*(n-1)+tr[i])/n;out.push(a/bars[i+1].c*100);}return out;
}
function deskAnalyze(tf){
  const bars=(deskState.tfs[tf]||[]).slice(0,-1),closes=bars.map(x=>x.c),last=bars.at(-1);if(!last)return null;
  const e20=deskEMA(closes,20),e50=deskEMA(closes,50),e200=deskEMA(closes,200),rsi=deskRSI(closes),atr=deskATR(bars);
  if(![e20,e50,e200,rsi,atr].every(Number.isFinite))return null;
  const score=Number(last.c>e20)+Number(e20>e50)+Number(e50>e200)+Number(rsi>=50),bull=last.c>e20&&e20>e50&&e50>e200,bear=last.c<e20&&e20<e50&&e50<e200;
  const meta=bull?['상승 정렬','up']:bear?['하락 정렬','dn']:['혼조','mid'];
  const range=bars.slice(-20),hi=Math.max(...range.map(x=>x.h)),lo=Math.min(...range.map(x=>x.l)),pos=hi>lo?(last.c-lo)/(hi-lo)*100:50;
  return{tf,last,e20,e50,e200,rsi,atr,atrPct:atr/last.c*100,score,label:meta[0],tone:meta[1],pos};
}
function deskSessionVwap(){const a=deskState.session;if(!a.length)return null;const base=a.reduce((s,x)=>s+x.v,0),quote=a.reduce((s,x)=>s+x.qv,0);return base?quote/base:null;}
function deskVolPercentile(){const s=deskATRSeries((deskState.tfs['4h']||[]).slice(0,-1)).slice(-181);if(!s.length)return null;const v=s.at(-1);return s.filter(x=>x<=v).length/s.length*100;}
function deskStructureScore(){
  const weights={"15m":1,"1h":2,"4h":3,"1d":3};let total=0,w=0;
  Object.entries(weights).forEach(([tf,weight])=>{const a=deskAnalyze(tf);if(a){total+=a.score/4*100*weight;w+=weight;}});
  if(!w)return null;let score=total/w,vwap=deskSessionVwap(),px=deskState.price||deskState.tfs['5m']?.at(-1)?.c;if(Number.isFinite(vwap)&&Number.isFinite(px))score+=px>=vwap?4:-4;return Math.max(0,Math.min(100,score));
}

async function deskFetchStructure(){
  if(deskStructurePending||!deskRuntimeOn)return;deskStructurePending=true;const gen=deskGeneration,c=deskAbortController();
  try{
    const dayStart=Math.floor(Date.now()/86400000)*86400000,tfs=['5m','15m','1h','4h','1d'];
    const all=await Promise.all([
      ...tfs.map(tf=>deskJson(`${DESK_MARKET}/klines?symbol=BTCUSDT&interval=${tf}&limit=${tf==='5m'?220:499}`,c.signal)),
      deskJson(`${DESK_MARKET}/klines?symbol=BTCUSDT&interval=1w&limit=3`,c.signal),
      deskJson(`${DESK_MARKET}/klines?symbol=BTCUSDT&interval=5m&startTime=${dayStart}&limit=288`,c.signal),
      deskJson(`${DESK_MARKET}/klines?symbol=BTCUSDT&interval=1m&limit=61`,c.signal)
    ]);
    if(gen!==deskGeneration||!deskRuntimeOn)return;
    tfs.forEach((tf,i)=>deskState.tfs[tf]=deskMapBars(all[i]));deskState.daily=deskState.tfs['1d'];deskState.weekly=deskMapBars(all[5]);deskState.session=deskMapBars(all[6]);
    deskState.cvdSeed=deskMapBars(all[7]).slice(0,-1).map(x=>({ts:x.t,end:x.end,delta:2*x.tbq-x.qv})).filter(x=>Number.isFinite(x.delta));
    deskState.price=deskState.price||deskState.tfs['5m']?.at(-1)?.c||null;deskState.structureAt=Date.now();deskStructureNext=deskState.structureAt+DESK_STRUCTURE_TTL;deskRenderActive();
  }catch(e){if(e.name!=='AbortError'){deskStructureNext=Date.now()+(e.retryAfter||15000);if(tabLive('desk'))$('deskStatus').textContent='구조 데이터 지연 · 재시도';}}
  finally{deskControllers.delete(c);deskStructurePending=false;}
}
async function deskFetchDerivatives(){
  if(deskDerivPending||!deskRuntimeOn)return;deskDerivPending=true;const gen=deskGeneration,c=deskAbortController();
  try{
    const all=await Promise.all([
      deskJson(`${DESK_FUT}/fapi/v1/premiumIndex?symbol=BTCUSDT`,c.signal),
      deskJson(`${DESK_FUT}/fapi/v1/openInterest?symbol=BTCUSDT`,c.signal),
      deskJson(`${DESK_FDATA}/openInterestHist?symbol=BTCUSDT&period=5m&limit=13`,c.signal),
      deskJson(`${DESK_FDATA}/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=13`,c.signal),
      deskJson(`${DESK_FDATA}/takerlongshortRatio?symbol=BTCUSDT&period=5m&limit=13`,c.signal)
    ]);
    if(gen!==deskGeneration||!deskRuntimeOn)return;
    deskState.premium=all[0];deskState.oi=all[1];deskState.oiHist=Array.isArray(all[2])?all[2]:[];deskState.globalHist=Array.isArray(all[3])?all[3]:[];deskState.takerHist=Array.isArray(all[4])?all[4]:[];deskState.derivAt=Date.now();deskDerivNext=deskState.derivAt+DESK_DERIV_TTL;deskRenderActive();
  }catch(e){if(e.name!=='AbortError'){deskDerivNext=Date.now()+(e.retryAfter||15000);if(tabLive('desk'))$('deskDerivAt').textContent='데이터 재시도';}}
  finally{deskControllers.delete(c);deskDerivPending=false;}
}

function deskRenderMtf(){
  const body=$('deskMtfBody');if(!body)return;body.replaceChildren();let up=0,dn=0,ready=0;
  [['15m','15분'],['1h','1시간'],['4h','4시간'],['1d','일봉']].forEach(([tf,label])=>{
    const a=deskAnalyze(tf),tr=document.createElement('tr');
    if(!a){const td=document.createElement('td');td.colSpan=9;td.textContent=`${label} 지표를 계산하는 중입니다.`;tr.append(td);body.append(tr);return;}
    ready++;if(a.tone==='up')up++;if(a.tone==='dn')dn++;
    const vals=[label,a.label,'$ '+deskNum(a.last.c,0),'$ '+deskNum(a.e20,0),'$ '+deskNum(a.e50,0),'$ '+deskNum(a.e200,0),a.rsi.toFixed(1),a.atrPct.toFixed(2)+'%',a.pos.toFixed(0)+'%'];
    vals.forEach((v,i)=>{const td=document.createElement('td');if(i===1){const b=document.createElement('span');b.className='deskTrend '+a.tone;b.textContent=v;td.append(b);}else td.textContent=v;tr.append(td);});body.append(tr);
  });
  const badge=$('deskMtfBadge');if(ready<4){badge.textContent='SCANNING';deskTone(badge,'');}else if(up>=3){badge.textContent=`${up}/4 UP`;deskTone(badge,'up');}else if(dn>=3){badge.textContent=`${dn}/4 DOWN`;deskTone(badge,'dn');}else{badge.textContent='MIXED';deskTone(badge,'gold');}
}
function deskLevelData(){
  const px=deskState.price||deskState.tfs['5m']?.at(-1)?.c,day=deskState.daily,week=deskState.weekly,four=deskState.tfs['4h']||[];if(!Number.isFinite(px)||day.length<2)return[];
  const prev=day.at(-2),swing=four.slice(-21,-1),vwap=deskSessionVwap(),out=[['전일 고가 · PDH',prev.h],['전일 저가 · PDL',prev.l],['전일 종가 · PDC',prev.c],['주간 시가 · W OPEN',week.at(-1)?.o],['UTC 일간 VWAP',vwap]];
  if(swing.length){out.push(['4H 20봉 고점',Math.max(...swing.map(x=>x.h))],['4H 20봉 저점',Math.min(...swing.map(x=>x.l))]);}
  return out.filter(x=>Number.isFinite(x[1])).map(([name,price])=>({name,price,dist:(price/px-1)*100})).sort((a,b)=>Math.abs(a.dist)-Math.abs(b.dist));
}
function deskRenderLevels(){
  const el=$('deskLevels'),levels=deskLevelData();if(!el)return;el.replaceChildren();
  if(!levels.length){const n=document.createElement('div');n.className='deskNote';n.textContent='가격대를 계산하고 있습니다.';el.append(n);return;}
  const atrPct=deskAnalyze('1h')?.atrPct;
  levels.forEach(x=>{const row=document.createElement('div');row.className='deskLevel '+(x.dist>=0?'above':'below');const name=document.createElement('span');name.textContent=x.name;const price=document.createElement('b');price.textContent='$ '+deskNum(x.price,0);const dist=document.createElement('em');dist.textContent=`${x.dist>=0?'위':'아래'} ${Math.abs(x.dist).toFixed(2)}%${Number.isFinite(atrPct)?` · ${(Math.abs(x.dist)/atrPct).toFixed(1)} ATR`:''}`;row.append(name,price,dist);el.append(row);});
  const nearest=levels[0],badge=$('deskLevelBadge');badge.textContent=`NEAR ${Math.abs(nearest.dist).toFixed(2)}%`;deskTone(badge,Math.abs(nearest.dist)<=.25?'gold':'');
}
function deskRangeData(){
  const a=deskState.daily;if(a.length<22)return null;const current=a.at(-1),ranges=[];for(let i=a.length-21;i<=a.length-2;i++)ranges.push((a[i].h-a[i].l)/a[i-1].c*100);const adrPct=ranges.reduce((s,x)=>s+x,0)/ranges.length,currentPct=(current.h-current.l)/a.at(-2).c*100,used=adrPct?currentPct/adrPct*100:0;return{current,adrPct,currentPct,used};
}
function deskRenderRange(){
  const r=deskRangeData();if(!r)return;$('deskRangeUse').textContent=r.used.toFixed(0)+'%';$('deskRangePx').textContent=`오늘 $${fmt(r.current.h-r.current.l,0)} 사용`;$('deskAdr').textContent=r.adrPct.toFixed(2)+'%';$('deskRangeFill').style.width=Math.min(100,r.used)+'%';
  const badge=$('deskRangeBadge');badge.textContent=r.used>=120?'RANGE EXPANDED':r.used>=80?'RANGE ACTIVE':'ADR 20';deskTone(badge,r.used>=120?'dn':r.used>=80?'gold':'');
  $('deskRangeCopy').textContent=r.used>=120?'최근 20일 평균 일중 범위를 크게 넘어섰습니다. 변동성 확대와 추격 리스크를 함께 감안할 구간입니다.':r.used>=80?'평균 일중 범위에 근접했습니다. 사용률은 상한선이나 남은 변동 여력을 뜻하지 않습니다.':`현재 일중 범위는 ADR20의 ${r.used.toFixed(0)}%입니다. ADR은 방향 신호나 하루 변동의 상한선이 아닙니다.`;
}
function deskRenderContext(){
  const score=deskStructureScore();if(!Number.isFinite(score))return;const a1=deskAnalyze('1h'),a4=deskAnalyze('4h'),vwap=deskSessionVwap(),px=deskState.price||0,above=Number.isFinite(vwap)&&px>=vwap;
  $('deskContextScore').textContent=Math.round(score);let title,copy,badge,tone;
  if(score>=75){title='상승 구조가 여러 시간축에서 합류';badge='BULLISH ALIGN';tone='up';}
  else if(score>=58){title='상승 우위지만 시간축 확인이 필요';badge='UP BIAS';tone='up';}
  else if(score<=25){title='하락 구조가 여러 시간축에서 합류';badge='BEARISH ALIGN';tone='dn';}
  else if(score<=42){title='하락 우위지만 시간축 확인이 필요';badge='DOWN BIAS';tone='dn';}
  else{title='시간축이 엇갈리는 중립 구조';badge='MIXED';tone='gold';}
  copy=`1시간 ${a1?.label||'계산 중'} · 4시간 ${a4?.label||'계산 중'} · 현재가는 UTC 세션 VWAP ${above?'위':'아래'}입니다. 점수는 방향 예측 확률이 아니라 조건 합류도입니다.`;
  $('deskContextTitle').textContent=title;$('deskContextCopy').textContent=copy;$('deskContextBadge').textContent=badge;deskTone($('deskContextBadge'),tone);$('deskContextScore').style.color=tone==='up'?'var(--grn)':tone==='dn'?'var(--red)':'var(--gold)';
}
function deskRenderStructure(){deskRenderMtf();deskRenderLevels();deskRenderRange();deskRenderContext();}

function deskOiChanges(){
  const h=deskState.oiHist;if(h.length<2)return{m5:null,h1:null,vals:[]};const vals=h.map(x=>+x.sumOpenInterest).filter(Number.isFinite),last=vals.at(-1);return{m5:vals.length>1?(last/vals.at(-2)-1)*100:null,h1:vals.length>=13?(last/vals.at(-13)-1)*100:(last/vals[0]-1)*100,vals};
}
function deskPrice1h(){const a=(deskState.tfs['5m']||[]).slice(0,-1);return a.length>=13?(a.at(-1).c/a.at(-13).c-1)*100:null;}
function deskSetRatio(longId,shortId,numId,longPct){
  if(!Number.isFinite(longPct))return;const v=Math.max(0,Math.min(100,longPct));$(longId).style.width=v+'%';$(shortId).style.width=(100-v)+'%';$(numId).textContent=`L ${v.toFixed(1)} / S ${(100-v).toFixed(1)}`;
}
function deskLinePoints(vals,w,h){
  if(vals.length<2)return'';const min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;return vals.map((v,i)=>`${(i/(vals.length-1)*w).toFixed(1)},${(h-6-(v-min)/span*(h-12)).toFixed(1)}`).join(' ');
}
function deskRenderDerivatives(){
  const p=deskState.premium,oi=deskState.oi,ch=deskOiChanges(),global=deskState.globalHist,taker=deskState.takerHist;if(!p&&!oi)return;
  const funding=+p?.lastFundingRate*100,basis=p?(+p.markPrice/+p.indexPrice-1)*100:null,oiQty=+oi?.openInterest,mark=+p?.markPrice,oiValue=oiQty*mark;
  $('deskFunding').textContent=deskPct(funding,4);$('deskFunding').className=funding>=.01?'dn':funding<=-.01?'up':'';$('deskFundingNext').textContent=p?.nextFundingTime?`다음 ${new Date(+p.nextFundingTime).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`:'다음 정산 —';
  $('deskBasis').textContent=deskPct(basis,3);$('deskOi').textContent=Number.isFinite(oiQty)?fmt(oiQty,0)+' BTC':'—';$('deskOiNotional').textContent=Number.isFinite(oiValue)?`명목 ${moneyShort(oiValue)}`:'명목가치 —';$('deskOi1h').textContent=deskPct(ch.h1,2);$('deskOi5m').textContent=`5분 ${deskPct(ch.m5,2)}`;
  const longs=global.map(x=>+x.longAccount*100).filter(Number.isFinite),gNow=longs.at(-1),gAvg=longs.length?longs.reduce((a,c)=>a+c,0)/longs.length:null,tLast=taker.at(-1),buy=+tLast?.buyVol,sell=+tLast?.sellVol,tBuy=buy+sell?buy/(buy+sell)*100:null;
  deskSetRatio('deskGlobalLong','deskGlobalShort','deskGlobalRatio',gNow);deskSetRatio('deskTopLong','deskTopShort','deskTopRatio',gAvg);deskSetRatio('deskTakerBuy','deskTakerSell','deskTakerRatio',tBuy);
  const crowd=$('deskCrowdBadge');if(Number.isFinite(gNow)&&Number.isFinite(tBuy)&&Math.abs(gNow-50)>=8&&Math.sign(gNow-50)===Math.sign(tBuy-50)){crowd.textContent='CROWDED';deskTone(crowd,'dn');$('deskCrowdCopy').textContent='계정 포지션과 공격 체결이 같은 방향으로 강하게 몰렸습니다. 지속 신호가 아니라 과밀 리스크로도 읽어야 합니다.';}else if(Number.isFinite(gNow)&&Number.isFinite(tBuy)&&Math.sign(gNow-50)!==Math.sign(tBuy-50)&&Math.abs(tBuy-50)>=4){crowd.textContent='DIVERGENCE';deskTone(crowd,'gold');$('deskCrowdCopy').textContent='보유 포지션과 최근 공격 체결의 방향이 엇갈립니다. 포지션 전환인지 단기 방어인지 추가 확인이 필요합니다.';}else{crowd.textContent='BALANCED';deskTone(crowd,'');$('deskCrowdCopy').textContent='계정 포지션과 최근 공격 체결 사이에 뚜렷한 과밀이나 괴리가 없습니다.';}
  const pc=deskPrice1h(),oc=ch.h1;let title='큰 방향 변화 없음',copy=`가격 ${deskPct(pc,2)} · OI ${deskPct(oc,2)}. 임계값 안의 혼조 구간입니다.`,tone='';
  if(Number.isFinite(pc)&&Number.isFinite(oc)){if(pc>.10&&oc>.25){title='상승 + 포지션 확대';copy='가격과 OI가 함께 증가했습니다. 어느 한쪽의 신규 진입으로 단정하지 않고 체결 방향을 추가 확인합니다.';tone='up';}else if(pc<-.10&&oc>.25){title='하락 + 포지션 확대';copy='가격 하락과 OI 증가가 동반됩니다. 방향성 포지션이 확대되는 구간으로 실제 테이커 흐름을 함께 봅니다.';tone='dn';}else if(pc>.10&&oc<-.25){title='상승 + 디레버리징';copy='가격은 오르지만 OI가 감소합니다. 신규 수요보다 기존 포지션 정리의 영향일 수 있습니다.';tone='gold';}else if(pc<-.10&&oc<-.25){title='하락 + 디레버리징';copy='가격과 OI가 함께 감소합니다. 신규 포지션보다 기존 레버리지 축소의 영향일 수 있습니다.';tone='dn';}}
  $('deskOiTitle').textContent=title;$('deskOiCopy').textContent=`${copy} · 가격 ${deskPct(pc,2)} / OI ${deskPct(oc,2)}`;$('deskOiBadge').textContent=tone?title.replace(' 가능','').toUpperCase():'HEURISTIC';deskTone($('deskOiBadge'),tone);
  $('deskOiLine').setAttribute('points',deskLinePoints(ch.vals,400,100));$('deskOiLine').style.stroke=ch.h1>=0?'var(--grn)':'var(--red)';$('deskDerivAt').textContent=deskState.derivAt?new Date(deskState.derivAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'60S CACHE';
}

function deskPruneBuckets(now=Date.now()){
  const cut=now-600000;while(deskState.buckets.length&&deskState.buckets[0].ts<cut)deskState.buckets.shift();
}
function deskVisibleWall(levels,side,now){
  if(!levels.length){deskState.wallTrack[side]=null;return null;}const rows=levels.map(x=>({px:+x[0],val:(+x[0])*(+x[1])})).filter(x=>Number.isFinite(x.val)),sorted=rows.map(x=>x.val).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)]||0,candidate=rows.reduce((m,x)=>x.val>m.val?x:m,{px:null,val:-1});
  if(!Number.isFinite(candidate.px)||candidate.val<Math.max(100000,median*3)){deskState.wallTrack[side]=null;return null;}let track=deskState.wallTrack[side];if(!track||track.px!==candidate.px){track={px:candidate.px,since:now};deskState.wallTrack[side]=track;}track.val=candidate.val;track.median=median;track.ready=now-track.since>=3000;return track;
}
function deskFlowStats(now=Date.now()){
  deskPruneBuckets(now);const buckets=deskState.buckets;
  const sum=(ms)=>buckets.filter(b=>b.ts>=now-ms).reduce((a,b)=>{a.buy+=b.buy;a.sell+=b.sell;a.count+=b.count;a.whales+=b.whales;return a;},{buy:0,sell:0,count:0,whales:0});
  const s15=sum(15000),s60=sum(60000),recentRate=s15.count/15,total60=s60.buy+s60.sell,aggImb=total60?(s60.buy-s60.sell)/total60*100:null;
  const bid=deskState.bids.reduce((s,x)=>s+(+x[0])*(+x[1]),0),ask=deskState.asks.reduce((s,x)=>s+(+x[0])*(+x[1]),0),imb=bid+ask?(bid-ask)/(bid+ask)*100:null,bestBid=+deskState.bids[0]?.[0],bestAsk=+deskState.asks[0]?.[0],mid=bestBid&&bestAsk?(bestBid+bestAsk)/2:null,spread=mid?(bestAsk-bestBid)/mid*10000:null;
  return{s15,s60,aggImb,recentRate,bid,ask,imb,spread,spreadUsd:bestBid&&bestAsk?bestAsk-bestBid:null,bidWall:deskVisibleWall(deskState.bids,'bid',now),askWall:deskVisibleWall(deskState.asks,'ask',now)};
}
function deskCvdSeries(){let c=0,vals=[];deskState.cvdSeed.forEach(x=>{c+=x.delta;vals.push({ts:x.ts,v:c});});const seedEnd=deskState.cvdSeed.at(-1)?.end||0;deskState.buckets.filter(b=>b.ts>seedEnd).forEach(b=>{c+=b.buy-b.sell;vals.push({ts:b.ts,v:c});});return{vals:vals.map(x=>x.v),delta:vals.at(-1)?.v||0};}
function deskSparkWithZero(vals,w,h){if(vals.length<2)return{points:'',zero:h/2};const min=Math.min(0,...vals),max=Math.max(0,...vals),span=max-min||1,y=v=>h-6-(v-min)/span*(h-12);return{points:vals.map((v,i)=>`${(i/(vals.length-1)*w).toFixed(1)},${y(v).toFixed(1)}`).join(' '),zero:y(0)};}
function deskRenderFlow(){
  const s=deskFlowStats(),total60=s.s60.buy+s.s60.sell,buy60=total60?s.s60.buy/total60*100:null,total15=s.s15.buy+s.s15.sell,buy15=total15?s.s15.buy/total15*100:50,series=deskCvdSeries(),plot=deskSparkWithZero(series.vals,600,120);
  $('deskCvd').textContent=deskSignedMoney(series.delta);$('deskCvd').className=series.delta>=0?'up':'dn';$('deskBuyShare').textContent=Number.isFinite(buy60)?buy60.toFixed(1)+'%':'—';$('deskFlowNotional').textContent=total60?`60초 ${moneyShort(total60)}`:'체결 집계 중';$('deskBookImbalance').textContent=Number.isFinite(s.imb)?`${s.imb>=0?'BID +':'ASK '}${Math.abs(s.imb).toFixed(1)}%`:'—';$('deskIntensity').textContent=Number.isFinite(s.aggImb)?deskPct(s.aggImb,1):'—';$('deskTradesSec').textContent=`초당 ${s.recentRate.toFixed(1)}건`;
  $('deskFlowBuy').textContent=buy15.toFixed(0);$('deskFlowSell').textContent=(100-buy15).toFixed(0);$('deskSpread').textContent=Number.isFinite(s.spread)?`SPREAD $${s.spreadUsd.toFixed(2)} · ${s.spread.toFixed(2)} bp`:'SPREAD —';
  const px=deskState.price||1,showWall=(wall,priceId,metaId,side)=>{if(!wall){$(priceId).textContent='—';$(metaId).textContent='뚜렷한 벽 없음';return;}if(!wall.ready){$(priceId).textContent='$ '+fmt(wall.px,0);$(metaId).textContent='3초 지속 여부 검증 중';return;}$(priceId).textContent='$ '+fmt(wall.px,0);$(metaId).textContent=`${moneyShort(wall.val)} · mid ${Math.abs((wall.px/px-1)*10000).toFixed(1)} bp · ${side}`;};showWall(s.bidWall,'deskBidWall','deskBidWallMeta','VISIBLE BID');showWall(s.askWall,'deskAskWall','deskAskWallMeta','VISIBLE ASK');
  $('deskCvdLine').setAttribute('points',plot.points);const base=$('deskCvdSvg').querySelector('.deskSparkBase');base.setAttribute('y1',plot.zero);base.setAttribute('y2',plot.zero);$('deskCvdLine').style.stroke=series.delta>=0?'var(--grn)':'var(--red)';$('deskCvdStart').textContent='60M ANCHOR $0';$('deskCvdNow').textContent=`NOW ${deskSignedMoney(series.delta)}`;
  const aligned=Number.isFinite(s.imb)&&Math.sign(buy60-50)===Math.sign(s.imb);$('deskCvdCopy').textContent=!Number.isFinite(buy60)?'실시간 체결 버킷을 채우고 있습니다.':aligned?`60초 체결과 상위 호가가 모두 ${buy60>=50?'매수':'매도'} 쪽으로 합류합니다.`:`60초 체결은 ${buy60>=50?'매수':'매도'} 우위지만 호가 잔량은 반대여서 괴리가 있습니다.`;
  const w=deskState.lastWhale;$('deskWhaleCopy').textContent=w&&Date.now()-w.ts<300000?`최근 고래: ${w.buy?'공격 매수':'공격 매도'} ${moneyShort(w.val)} · ${Math.round((Date.now()-w.ts)/1000)}초 전`:'$25만 이상 단일 체결을 함께 감시합니다.';
  $('deskCvdBadge').textContent=series.delta>=0?'BUY DELTA':'SELL DELTA';deskTone($('deskCvdBadge'),series.delta>=0?'up':'dn');const connected=deskState.marketConnected&&deskState.bookConnected;$('deskFlowBadge').textContent=connected?'LIVE TAPE':'CONNECTING';deskTone($('deskFlowBadge'),connected?'up':'');
}

function deskRenderRisk(){
  const a1=deskAnalyze('1h'),vol=deskVolPercentile(),range=deskRangeData(),p=deskState.premium,ch=deskOiChanges(),flow=deskFlowStats(),global=deskState.globalHist.map(x=>+x.longAccount*100).filter(Number.isFinite),g=global.at(-1),t=deskState.takerHist.at(-1),tb=+t?.buyVol,ts=+t?.sellVol,taker=tb+ts?tb/(tb+ts)*100:null;
  if(Number.isFinite(vol)){$('deskVolPct').textContent=vol.toFixed(0)+'%';const regime=vol>=90?'극고변동':vol>=70?'고변동':vol<=25?'저변동·압축':'보통 변동';$('deskVolRegime').textContent=regime;$('deskVolBadge').textContent=regime.toUpperCase();deskTone($('deskVolBadge'),vol>=90?'dn':vol<=25?'gold':'');}
  if(a1){$('deskAtr1h').textContent=a1.atrPct.toFixed(2)+'%';$('deskAtr1hUsd').textContent=`가격 거리 $${fmt(a1.atr,0)}`;}
  if(range){$('deskRiskRange').textContent=range.used.toFixed(0)+'%';}
  const funding=+p?.lastFundingRate*100;$('deskRiskFunding').textContent=deskPct(funding,4);$('deskRiskFundingAt').textContent=p?.nextFundingTime?new Date(+p.nextFundingTime).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'정산 시각 —';
  const px=+p?.markPrice||deskState.price||a1?.last.c,bands=$('deskRiskBands');if(a1&&Number.isFinite(px)){bands.replaceChildren();[1,1.5,2].forEach(m=>{const row=document.createElement('div');row.className='deskRiskBand';const tag=document.createElement('span');tag.textContent=m.toFixed(1)+' ATR';const b=document.createElement('b');b.textContent=`$${fmt(px-a1.atr*m,0)} — $${fmt(px+a1.atr*m,0)}`;const e=document.createElement('em');e.textContent=`±${(a1.atr/px*100*m).toFixed(2)}%`;row.append(tag,b,e);bands.append(row);});}
  const a4=deskAnalyze('4h'),a15=deskAnalyze('15m'),vwap=deskSessionVwap(),price=deskState.price||0,weekOpen=deskState.weekly.at(-1)?.o,prev=deskState.daily.at(-2),cvd=deskCvdSeries().delta,confirmUp=[cvd>0,ch.h1>0,taker>=52].filter(Boolean).length>=2,confirmDn=[cvd<0,ch.h1<0,taker<=48].filter(Boolean).length>=2;
  const scenarios=[
    {title:'PDH 상방 돌파 감시',checks:[a15?.last.c>prev?.h,a1?.tone==='up'&&a4?.tone==='up'&&price>vwap&&price>weekOpen,confirmUp,price>prev?.h],copy:'Trigger PDH 확정봉 돌파 · Context 1H/4H+VWAP · Confirmation CVD/OI/taker · Invalidation PDH 복귀'},
    {title:'PDL 하방 이탈 감시',checks:[a15?.last.c<prev?.l,a1?.tone==='dn'&&a4?.tone==='dn'&&price<vwap&&price<weekOpen,confirmDn,price<prev?.l],copy:'Trigger PDL 확정봉 이탈 · Context 1H/4H+VWAP · Confirmation CVD/OI/taker · Invalidation PDL 복귀'},
    {title:'압축 후 변동성 확대 감시',checks:[vol<=35,Math.abs(ch.h1||0)>=.30,Math.abs(flow.aggImb||0)>=8,(range?.used||0)<120],copy:'Trigger 저변동 · Context ADR 미과열 · Confirmation OI+공격 체결 · Invalidation 압축 지속'},
    {title:'포지션 과밀 되돌림 위험',checks:[Math.abs((g??50)-50)>=8,Math.abs(funding)>=.01,Number.isFinite(taker)&&Math.sign(g-50)!==Math.sign(taker-50),Math.abs(deskPrice1h()||0)>=.10],copy:'Trigger 계정 쏠림 · Context 펀딩 · Confirmation 반대 테이커 · Invalidation 가격 추세 지속'}
  ];
  const el=$('deskScenarios');el.replaceChildren();let best=0;scenarios.forEach(s=>{const count=s.checks.filter(Boolean).length;best=Math.max(best,count);const row=document.createElement('div');row.className='deskScenario';const main=document.createElement('div');const b=document.createElement('b');b.textContent=s.title;const p=document.createElement('p');p.textContent=s.copy;const score=document.createElement('span');score.textContent=`${count}/4`;main.append(b,p);row.append(main,score);el.append(row);});$('deskScenarioBadge').textContent=best===4?'SETUP 4/4':best===3?'WATCH 3/4':'NO SETUP';deskTone($('deskScenarioBadge'),best>=3?'gold':'');
}
function deskRenderActive(){
  const px=deskState.price||deskState.tfs['5m']?.at(-1)?.c;if(Number.isFinite(px))$('deskPrice').textContent='$ '+fmt(px,0);
  if(deskActiveView==='structure')deskRenderStructure();else if(deskActiveView==='derivatives')deskRenderDerivatives();else if(deskActiveView==='flow')deskRenderFlow();else if(deskActiveView==='risk')deskRenderRisk();
}
function deskConnected(){return deskState.marketConnected&&deskState.bookConnected;}
function deskSyncConnectionUi(){const on=deskConnected();$('deskDot').classList.toggle('on',on);$('deskStatus').textContent=on?'BTCUSDT PERP 실시간':'시장·호가 회선 연결 중';}
function deskConnectMarket(){
  if(!tabLive('desk')||deskWsMarket)return;clearTimeout(deskMarketRetry);$('deskStatus').textContent='퍼펫 체결 회선 연결 중';
  deskWsMarket=new WebSocket('wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade');
  deskWsMarket.onopen=()=>{deskState.marketConnected=true;deskSyncConnectionUi();};
  deskWsMarket.onclose=()=>{deskWsMarket=null;deskState.marketConnected=false;deskSyncConnectionUi();if(tabLive('desk'))deskMarketRetry=setTimeout(deskConnectMarket,1800);};deskWsMarket.onerror=()=>deskWsMarket?.close();
  deskWsMarket.onmessage=ev=>{if(!tabLive('desk'))return;try{const d=JSON.parse(ev.data)?.data;if(!d)return;const ts=d.T||Date.now(),val=(+d.p)*(+d.q),buy=!d.m,sec=Math.floor(ts/1000)*1000;deskState.price=+d.p;let b=deskState.buckets.at(-1);if(!b||b.ts!==sec){b={ts:sec,buy:0,sell:0,count:0,whales:0};deskState.buckets.push(b);}b[buy?'buy':'sell']+=val;b.count++;if(val>=250000){b.whales++;deskState.lastWhale={ts,val,buy};}}catch(e){}};
}
function deskConnectBook(){
  if(!tabLive('desk')||deskWsBook)return;clearTimeout(deskBookRetry);
  deskWsBook=new WebSocket('wss://fstream.binance.com/public/stream?streams=btcusdt@depth20@500ms');
  deskWsBook.onopen=()=>{deskState.bookConnected=true;deskSyncConnectionUi();};
  deskWsBook.onclose=()=>{deskWsBook=null;deskState.bookConnected=false;deskSyncConnectionUi();if(tabLive('desk'))deskBookRetry=setTimeout(deskConnectBook,2200);};deskWsBook.onerror=()=>deskWsBook?.close();
  deskWsBook.onmessage=ev=>{if(!tabLive('desk'))return;try{const d=JSON.parse(ev.data)?.data;if(!d)return;deskState.bids=d.b||d.bids||[];deskState.asks=d.a||d.asks||[];}catch(e){}};
}
function deskTick(){
  if(!tabLive('desk'))return;const now=Date.now();deskPruneBuckets(now);if(now>=deskStructureNext)deskFetchStructure();if(now>=deskDerivNext)deskFetchDerivatives();deskRenderActive();
  if(deskConnected())$('deskStatus').textContent=`PERP 실시간 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
}
function deskOpen(){
  if(!tabLive('desk'))return;if(!deskRuntimeOn){deskRuntimeOn=true;deskGeneration++;deskState.buckets=[];deskState.bids=[];deskState.asks=[];deskState.lastWhale=null;deskState.wallTrack={bid:null,ask:null};deskConnectMarket();deskConnectBook();const now=Date.now();if(now-deskState.structureAt>=DESK_STRUCTURE_TTL)deskStructureNext=0;if(now-deskState.derivAt>=DESK_DERIV_TTL)deskDerivNext=0;if(now>=deskStructureNext)deskFetchStructure();if(now>=deskDerivNext)deskFetchDerivatives();deskTimer=setInterval(deskTick,1000);}deskRenderActive();
}
function deskClose(){
  if(!deskRuntimeOn)return;deskRuntimeOn=false;deskGeneration++;clearInterval(deskTimer);clearTimeout(deskMarketRetry);clearTimeout(deskBookRetry);deskTimer=deskMarketRetry=deskBookRetry=null;deskControllers.forEach(c=>c.abort());deskControllers.clear();
  [deskWsMarket,deskWsBook].forEach(ws=>{if(!ws)return;ws.onmessage=null;ws.onclose=null;try{ws.close();}catch(e){}});deskWsMarket=deskWsBook=null;deskState.marketConnected=deskState.bookConnected=false;deskState.buckets=[];deskState.bids=[];deskState.asks=[];deskState.wallTrack={bid:null,ask:null};$('deskDot').classList.remove('on');$('deskStatus').textContent='탭을 열면 연결';
}

// ═══ 실행 수명주기 — 보이는 탭만 갱신 ═══
let loungeRuntimeOn = false;
function startLoungeRuntime() {
  if (!tabLive('lounge')) return;
  if (!loungeRuntimeOn) {
    loungeRuntimeOn = true;
    connectChartWS(); connectMainWS(); connectRaceWS(); connectLiquidations();
  }
  sizeRain();   // 숨김 중 리사이즈로 어긋난 캔버스 치수를 복귀 시 복구
  startRain(); startFx();
}
function stopLoungeRuntime() {
  if (!loungeRuntimeOn) return;
  loungeRuntimeOn = false;
  disconnectChartWS(); disconnectMainWS(); disconnectRaceWS(); disconnectLiquidations();
  drops.length = 0; rings.length = 0; fxP.length = 0; buyVol = sellVol = 0;
  tapeVisualBucket.buy = tapeVisualBucket.sell = tapeVisualBucket.buyMax = tapeVisualBucket.sellMax = 0;
  if (rainRaf) cancelAnimationFrame(rainRaf); if (fxRaf) cancelAnimationFrame(fxRaf);
  rainRaf = fxRaf = null;
  rctx.clearRect(0,0,rain.width,rain.height); fctx.clearRect(0,0,fx.width,fx.height);
}
function syncRuntimeState() {
  if (tabLive('lounge')) startLoungeRuntime(); else stopLoungeRuntime();
  if (tabLive('lounge')) sessionOpen(); else sessionClose();
  if (tabLive('desk')) deskOpen(); else deskClose();
  if (tabLive('chain')) onchainOpen(); else onchainClose();
  if (tabLive('macro')) macroOpen(); else macroClose();
  if (!tabLive('game')) { clearInterval(bgTimer); bgTimer = null; }
  else if (activeTab === 'game') blindOpen();
}
document.addEventListener('visibilitychange', syncRuntimeState);
syncRuntimeState();
