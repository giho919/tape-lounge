/* BTC-only linear channel geometry. Reuses chart candle timestamps; no requests or signals. */
(() => {
  'use strict';
  const DAY = 86400;
  const A = Object.freeze({time:1544400000,price:3156.26}); // 2018-12-10 weekly low
  const B = Object.freeze({time:1668988800,price:15476}); // 2022-11-21 weekly low
  const H = Object.freeze({time:1636329600,price:69000}); // 2021-11-08 weekly high
  const slope = (B.price-A.price)/((B.time-A.time)/DAY);
  const base = time => A.price+slope*(time-A.time)/DAY;
  const step = (H.price-base(H.time))/4;
  const offsets = Object.freeze(Array.from({length:13},(_,i)=>i-1));
  const valueAt = (time,offset) => base(time)+step*offset;
  let preferred = true;
  try { preferred = localStorage.getItem('tapeBtcLongChannel') !== 'off'; } catch(e) {}
  function attach(chart) {
    const state = {enabled:preferred,lastTime:null,series:[]};
    state.series = offsets.map(offset => chart.addLineSeries({
      color:offset===0||offset===4?'rgba(223,193,124,.85)':'rgba(226,232,240,.48)',
      lineWidth:offset===0||offset===4?2:1,
      priceScaleId:'right',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,
      visible:state.enabled,
      // A far-away rail must not stretch the candle axis or affect MACD/RSI.
      autoscaleInfoProvider:() => null,
    }));
    return state;
  }
  function clear(state) {
    if (!state) return;
    state.series.forEach(series=>series.setData([]));
    state.lastTime=null;
  }
  function seed(state,times) {
    if (!state) return;
    const ordered = [...new Set(times.filter(t=>Number.isFinite(t)&&t>0))].sort((a,b)=>a-b);
    state.lastTime = ordered.length?ordered[ordered.length-1]:null;
    offsets.forEach((offset,i)=>{
      state.series[i].setData(state.enabled?ordered.map(time=>({time,value:valueAt(time,offset)})).filter(p=>p.value>0):[]);
    });
  }
  function tick(state,time) {
    if (!state||!state.enabled||!Number.isFinite(time)||time<=0||(state.lastTime!==null&&time<state.lastTime)) return;
    offsets.forEach((offset,i)=>{const value=valueAt(time,offset);if(value>0)state.series[i].update({time,value});});
    state.lastTime=time;
  }
  function setEnabled(state,enabled,times) {
    if (!state) return;
    state.enabled=Boolean(enabled);preferred=state.enabled;
    try { localStorage.setItem('tapeBtcLongChannel',state.enabled?'on':'off'); } catch(e) {}
    state.series.forEach(series=>series.applyOptions({visible:state.enabled}));
    seed(state,times);
  }
  function bind(bridge) {
    const toggle=document.getElementById('btcLongToggle'),weekly=document.getElementById('btcLongWeekly');
    if (!toggle||toggle.dataset.bound) return;
    toggle.dataset.bound='1';
    function sync() {
      const state=bridge.getChart()?.longChannel;
      const enabled=state?.enabled??preferred;
      toggle.disabled=bridge.getSymbol()!==0;
      toggle.setAttribute('aria-pressed',String(enabled));
      toggle.textContent=enabled?'장기 빗각 ON':'장기 빗각 OFF';
      const hint=document.getElementById('btcLongHint');
      hint.textContent=toggle.disabled?'BTC 전용 빗각입니다. 장기 주봉 보기로 BTC를 열 수 있습니다.':'기준점은 고정 · 날짜에 따라 선 위치 계산 · 주·월봉 권장 (분봉에서는 화면 밖일 수 있음)';
    }
    toggle.addEventListener('click',()=>{
      const chart=bridge.getChart();if(!chart?.longChannel||bridge.getSymbol()!==0)return;
      setEnabled(chart.longChannel,!chart.longChannel.enabled,bridge.getTimes());sync();
    });
    weekly.addEventListener('click',async()=>{
      weekly.disabled=true;weekly.textContent='주봉을 불러오는 중';
      try {
        bridge.selectBtc();
        const chart=bridge.getChart();setEnabled(chart.longChannel,true,bridge.getTimes());sync();
        await bridge.setTf('1w');
        if (bridge.getTf()==='1w') {
          const current=bridge.getChart();current.ch.timeScale().fitContent();current.osc.syncRange();
        }
      } finally {weekly.disabled=false;weekly.textContent='장기 주봉 보기';}
    });
    window.syncBtcLongChannelControls=sync;
    sync();
  }
  window.BtcLongChannel=Object.freeze({A,B,H,slope,step,offsets,valueAt,attach,clear,seed,tick,setEnabled,bind});
})();
