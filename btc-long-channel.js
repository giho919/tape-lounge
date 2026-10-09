/* BTC-only linear channels; future rays are drawings, not synthetic market data. */
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
  const intervals = {'1m':60,'15m':900,'1h':3600,'4h':14400,'1d':DAY,'1w':7*DAY};
  function futureTime(state,bars) {
    if (state.tf==='1M') {
      const d=new Date(state.lastTime*1000),n=Math.floor(bars),f=bars-n;
      const start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)/1000;
      const end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n+1,1)/1000;
      return start+(end-start)*f;
    }
    return state.lastTime+bars*(intervals[state.tf]||(state.lastTime-state.prevTime));
  }
  function rayPoints(state,width) {
    if(state.lastTime===null||state.prevTime===null)return [];
    const ts=state.chart.timeScale(),x=ts.timeToCoordinate(state.lastTime),prev=ts.timeToCoordinate(state.prevTime);
    if(x===null||prev===null||!Number.isFinite(x)||!Number.isFinite(prev)||x<=prev||x>=width)return [];
    const spacing=x-prev,start=Math.max(0,x),first=(start-x)/spacing,last=(width-x)/spacing;
    const points=[{x:start,time:futureTime(state,first)}];
    // Calendar months have unequal durations; keep their exact date geometry.
    if(state.tf==='1M')for(let n=Math.floor(first)+1;n<last;n++)points.push({x:x+n*spacing,time:futureTime(state,n)});
    points.push({x:width,time:futureTime(state,last)});
    return points;
  }
  function futurePrimitive(state) {
    const renderer={draw(target){
      target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
        const points=rayPoints(state,mediaSize.width);if(points.length<2)return;
        ctx.save();ctx.beginPath();ctx.rect(0,0,mediaSize.width,mediaSize.height);ctx.clip();
        offsets.forEach(offset=>{
          ctx.strokeStyle=offset===0||offset===4?'rgba(223,193,124,.85)':'rgba(226,232,240,.48)';
          ctx.lineWidth=offset===0||offset===4?2:1;ctx.beginPath();let started=false;
          points.forEach(p=>{const y=state.series[0].priceToCoordinate(valueAt(p.time,offset));
            if(y===null||!Number.isFinite(y)){started=false;return;}if(!started){ctx.moveTo(p.x,y);started=true;}else ctx.lineTo(p.x,y);
          });ctx.stroke();
        });ctx.restore();
      });
    }};
    const views=[{zOrder:()=> 'normal',renderer:()=>renderer}];
    return {paneViews:()=>views,autoscaleInfo:()=>null,
      attached:({requestUpdate})=>{state.requestUpdate=requestUpdate;},detached:()=>{state.requestUpdate=null;}};
  }
  function attach(chart) {
    const state = {chart,lastTime:null,prevTime:null,tf:null,series:[],requestUpdate:null};
    state.series = offsets.map(offset => chart.addLineSeries({
      color:offset===0||offset===4?'rgba(223,193,124,.85)':'rgba(226,232,240,.48)',
      lineWidth:offset===0||offset===4?2:1,
      priceScaleId:'right',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,
      visible:true,
      // A far-away rail must not stretch the candle axis or affect MACD/RSI.
      autoscaleInfoProvider:() => null,
    }));
    state.primitive=futurePrimitive(state);
    state.series[0].attachPrimitive(state.primitive);
    return state;
  }
  function clear(state) {
    if (!state) return;
    state.series.forEach(series=>series.setData([]));
    state.lastTime=null;
    state.prevTime=null;state.tf=null;state.requestUpdate?.();
  }
  function seed(state,times,tf) {
    if (!state) return;
    const ordered = [...new Set(times.filter(t=>Number.isFinite(t)&&t>0))].sort((a,b)=>a-b);
    state.lastTime = ordered.length?ordered[ordered.length-1]:null;
    state.prevTime=ordered.length>1?ordered[ordered.length-2]:null;state.tf=tf||null;
    offsets.forEach((offset,i)=>{
      state.series[i].setData(ordered.map(time=>({time,value:valueAt(time,offset)})).filter(p=>p.value>0));
    });
    state.requestUpdate?.();
  }
  function tick(state,time) {
    if (!state||!Number.isFinite(time)||time<=0||(state.lastTime!==null&&time<state.lastTime)) return;
    offsets.forEach((offset,i)=>{const value=valueAt(time,offset);if(value>0)state.series[i].update({time,value});});
    if(state.lastTime!==null&&time>state.lastTime)state.prevTime=state.lastTime;
    state.lastTime=time;state.requestUpdate?.();
  }
  window.BtcLongChannel=Object.freeze({A,B,H,slope,step,offsets,valueAt,attach,clear,seed,tick,futureTime,rayPoints});
})();
