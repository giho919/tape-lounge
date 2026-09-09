const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const code=html.slice(html.indexOf('function oscillatorStep('),html.indexOf('function makeOscillators('));
const ctx=vm.createContext({});vm.runInContext(code,ctx);
const api=vm.runInContext('({oscillatorStep,seedOscillators,tickOscillators})',ctx);
const clone=x=>JSON.parse(JSON.stringify(x));
function series(){return {data:[],setData(d){this.data=clone(d);},update(p){if(this.data.at(-1)?.time===p.time)this.data[this.data.length-1]=clone(p);else{assert.ok(!this.data.length||this.data.at(-1).time<p.time);this.data.push(clone(p));}}};}
function state(){return {series:Array.from({length:4},series),before:null,last:null,macdValue:{},signalValue:{},histValue:{},rsiValue:{}};}
const bars=Array.from({length:360},(_,i)=>({time:i+1,close:100+i*.05+Math.sin(i/7)*15}));
const close=bars.map(b=>b.close);
function ema(xs,n){let sum=0,value=null;return xs.map((x,i)=>{sum+=x;if(i<n-1)return null;value=i===n-1?sum/n:value*(1-2/(n+1))+x*2/(n+1);return value;});}
const fast=ema(close,12),slow=ema(close,26),macd=close.map((_,i)=>slow[i]===null?null:fast[i]-slow[i]);
const signal=Array(25).fill(null).concat(ema(macd.slice(25),9));
const rsi=Array(14).fill(null);let gain=0,loss=0;
for(let i=1;i<close.length;i++){const d=close[i]-close[i-1];if(i<=14){gain+=Math.max(d,0)/14;loss+=Math.max(-d,0)/14;}else{gain=(gain*13+Math.max(d,0))/14;loss=(loss*13+Math.max(-d,0))/14;}if(i>=14)rsi.push(gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss));}
const seeded=state();api.seedOscillators(seeded,bars);
for(let i=0;i<bars.length;i++)for(const [j,want] of [macd[i],signal[i],signal[i]===null?null:macd[i]-signal[i],rsi[i]].entries()){
 const got=seeded.series[j].data[i].value;if(want===null)assert.equal(got,undefined);else assert.ok(Math.abs(got-want)<1e-10,`batch mismatch at ${i}/${j}`);
}
const live=state();api.seedOscillators(live,[]);
for(let i=0;i<bars.length;i++){
 for(const c of [300,1,bars[i].close])api.tickOscillators(live,{time:bars[i].time,close:c});
 const prefix=state();api.seedOscillators(prefix,bars.slice(0,i+1));
 assert.deepEqual(clone(live.last),clone(prefix.last),'intrabar state '+i);
 assert.deepEqual(live.series.map(s=>s.data),prefix.series.map(s=>s.data),'prefix/no future '+i);
}
for(const [slope,expected] of [[0,50],[1,100],[-1,0]]){const s=state();api.seedOscillators(s,Array.from({length:60},(_,i)=>({time:i,close:100+slope*i})));assert.equal(s.last.rsi,expected);}
const golden=state();api.seedOscillators(golden,[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28].map((close,time)=>({time,close})));
assert.ok(Math.abs(golden.last.rsi-70.464135021097)<1e-9);
const before=clone(live.last);api.tickOscillators(live,bars[0]);assert.deepEqual(clone(live.last),before);
api.seedOscillators(live,[]);assert.equal(live.last,null);assert.ok(live.series.every(s=>s.data.length===0));assert.equal(live.rsiValue.textContent,'—');
console.log('MACD EMA12/26/signal9, RSI Wilder14: independent batch, golden RSI, warm-up, intrabar/no future, flat/up/down, stale/reset passed');
