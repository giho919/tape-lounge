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
  function attach(chart) {
    const state = {lastTime:null,series:[]};
    state.series = offsets.map(offset => chart.addLineSeries({
      color:offset===0||offset===4?'rgba(223,193,124,.85)':'rgba(226,232,240,.48)',
      lineWidth:offset===0||offset===4?2:1,
      priceScaleId:'right',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,
      visible:true,
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
      state.series[i].setData(ordered.map(time=>({time,value:valueAt(time,offset)})).filter(p=>p.value>0));
    });
  }
  function tick(state,time) {
    if (!state||!Number.isFinite(time)||time<=0||(state.lastTime!==null&&time<state.lastTime)) return;
    offsets.forEach((offset,i)=>{const value=valueAt(time,offset);if(value>0)state.series[i].update({time,value});});
    state.lastTime=time;
  }
  window.BtcLongChannel=Object.freeze({A,B,H,slope,step,offsets,valueAt,attach,clear,seed,tick});
})();
