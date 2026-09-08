const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function extract(start,end){const i=html.indexOf(start);assert.ok(i>=0);return html.slice(i,html.indexOf(end,i));}
const ctx=vm.createContext({document:{querySelectorAll:()=>[]}});
vm.runInContext(extract('const MA_DEFS =','const LOUNGE_KL_LIMIT =')+extract('function seedMA(','const LOUNGE_CHART_IDS ='),ctx);
const api=vm.runInContext('({MA_DEFS,supertrendStep,seedSupertrend,tickSupertrend,seedMA})',ctx);
const clone=x=>JSON.parse(JSON.stringify(x));
function makeState(){const series={data:[],sets:0,updates:0,setData(d){this.data=clone(d);this.sets++;},update(p){const last=this.data.at(-1);assert.ok(!last||p.time>=last.time);if(last?.time===p.time)this.data[this.data.length-1]=clone(p);else this.data.push(clone(p));this.updates++;}};return {series,before:null,last:null,data:[]};}
const bars=Array.from({length:440},(_,i)=>{const close=100+Math.sin(i/8)*25+i*.015;return {time:1000+i*60,open:close-.3,high:close+1.7,low:close-1.2,close};});
assert.deepEqual(clone(api.MA_DEFS.map(d=>d[0])),[5,20,60,120,200]);
const chart={ma:api.MA_DEFS.map(()=>({setData(d){this.data=clone(d);}}))};
api.seedMA(chart,bars.map(b=>b.close),bars.map(b=>b.time));
for(let i=0;i<5;i++){const p=api.MA_DEFS[i][0];assert.equal(chart.ma[i].data.length,bars.length-p+1);assert.ok(Math.abs(chart.ma[i].data.at(-1).value-bars.slice(-p).reduce((s,b)=>s+b.close,0)/p)<1e-10);}
// Hand-calculated fixture: gap true range, initial down band, then up flip.
let prev=null;const golden=[{high:11,low:9,close:10},{high:12,low:10,close:11},{high:13,low:11,close:12},{high:16,low:14,close:15}].map((b,i)=>prev=api.supertrendStep(prev,{time:i,...b},3,1));
assert.equal(golden[1].atr,null);assert.equal(golden[2].atr,2);assert.equal(golden[2].value,14);assert.equal(golden[2].direction,1);
assert.ok(Math.abs(golden[3].atr-8/3)<1e-12);assert.ok(Math.abs(golden[3].value-37/3)<1e-12);assert.equal(golden[3].direction,-1);
// Independent batch recurrence, not the incremental implementation.
function reference(xs){
 const trs=xs.map((b,i)=>Math.max(b.high-b.low,i?Math.abs(b.high-xs[i-1].close):0,i?Math.abs(b.low-xs[i-1].close):0));
 const out=[];let atr=null,upper=null,lower=null,direction=1;
 for(let i=0;i<xs.length;i++){
  const b=xs[i];if(i<9){out.push(null);continue;}
  atr=i===9?trs.slice(0,10).reduce((a,b)=>a+b,0)/10:(atr*9+trs[i])/10;
  const bu=(b.high+b.low)/2+3*atr,bl=(b.high+b.low)/2-3*atr;
  upper=i===9||bu<upper||xs[i-1].close>upper?bu:upper;
  lower=i===9||bl>lower||xs[i-1].close<lower?bl:lower;
  direction=i===9?1:direction===1?(b.close>upper?-1:1):(b.close<lower?1:-1);
  out.push({value:direction===-1?lower:upper,direction});
 }return out;
}
const expected=reference(bars),st=makeState();api.seedSupertrend(st,bars);
let flips=0;
for(let i=0;i<bars.length;i++){
 if(!expected[i]){assert.equal(st.data[i].value,undefined);continue;}
 assert.ok(Math.abs(st.data[i].value-expected[i].value)<1e-10);
 if(expected[i+1]&&expected[i].direction!==expected[i+1].direction){assert.equal(st.data[i].color,'transparent');flips++;}
}
assert.ok(flips>6,'fixture must exercise both trend directions');
// Every prefix is invariant to future data. Streaming and one-shot results agree.
const live=makeState();api.seedSupertrend(live,bars.slice(0,80));
for(let i=80;i<bars.length;i++){
 const extreme={...bars[i],high:400,low:1,close:i%2?399:2};
 api.tickSupertrend(live,extreme);api.tickSupertrend(live,{...bars[i],high:250,close:249});api.tickSupertrend(live,bars[i]);
 const batch=makeState();api.seedSupertrend(batch,bars.slice(0,i+1));
 assert.deepEqual(clone(live.last),clone(batch.last),'intrabar recalculation at '+i);
 assert.deepEqual(clone(live.data),clone(batch.data),'plot restoration at '+i);
 assert.deepEqual(live.series.data,clone(live.data),'rendered series at '+i);
}
assert.deepEqual(clone(live.data),clone(st.data));
const before=clone(live.last);api.tickSupertrend(live,bars[0]);assert.deepEqual(clone(live.last),before);
api.seedSupertrend(live,[]);assert.equal(live.last,null);assert.equal(live.series.data.length,0);
const long=makeState();for(let i=0;i<2400;i++)api.tickSupertrend(long,{time:i,high:101,low:99,close:100});
assert.equal(long.data.length,2000);assert.equal(long.last.count,2400);assert.equal(long.last.atr,2);
console.log('SMA 5/20/60/120/200; ATR/gap golden fixture; batch oracle; trend gaps; intrabar restoration; causal prefixes; reset/stale/bounded state passed');
