// Unit-level DOM/network adapters. No browser, production posts or database calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require.resolve('../domestic.js'),'utf8');
const report=fs.readFileSync(require.resolve('../reports/andy_scan.html'),'utf8');
const stamp=report.match(/class='ts'>(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST/);
assert.ok(stamp,'published report date contract');
assert.ok(report.includes("id='andy-retest'"),'published section contract');
const section=report.split("id='andy-retest'")[1].split('</section>')[0];
const reportRows=[...section.matchAll(/<tr>(.*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td>(.*?)<\/td>/g)].map(x=>({textContent:x[1]})));
assert.ok(reportRows.length>0,'published table rows contract');
const current=Date.parse(`${stamp[1]}T${stamp[2]}:00+09:00`)+1000;
const ticks=[{market:'KRW-BTC',trade_price:135200000,trade_timestamp:current,acc_trade_price_24h:2e9,signed_change_rate:.01},{market:'KRW-USDT',trade_price:1352,trade_timestamp:current}];
async function run({hidden=false,fail=false,storageFail=false}={}){
 const nodes={},requests=[],timers=new Map(),events={};let seq=0,mutate;
 const node=id=>nodes[id]??=({innerHTML:'',textContent:'',dataset:{},hidden:false,classList:{contains:()=>hidden},addEventListener:(event,cb)=>events[id+':'+event]=cb,querySelector:()=>null,setAttribute(){},scrollIntoView(){}});
 const doc={hidden:false,getElementById:node,activeElement:null,addEventListener:(event,cb)=>events[event]=cb};
 class Clock extends Date{constructor(...a){super(...(a.length?a:[current]));}static now(){return current;}}
 const context={console,Date:Clock,document:doc,window:{document:doc},localStorage:{getItem(){if(storageFail)throw Error('blocked');return '[]';},setItem(){if(storageFail)throw Error('blocked');}},AbortController,
  setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(cb){mutate=cb;}observe(){}},
  DOMParser:class{parseFromString(){return {querySelector:sel=>sel==='.hdr .ts'?{textContent:stamp[0]}:sel==='#andy-retest'?{}:null,querySelectorAll:()=>reportRows.map(t=>({querySelectorAll:()=>t}))};}},
  fetch:async(url,opts)=>{requests.push(url);assert.equal(opts.credentials,'omit');assert.ok(opts.signal);if(fail)throw Error('offline');let data;if(url.includes('upbit'))data=ticks;else if(url.includes('binance'))data=[{symbol:'BTCUSDT',lastPrice:'100000',closeTime:current}];else if(url.includes('frankfurter'))data={date:stamp[1],rates:{KRW:1300}};else data=report;return {ok:true,json:async()=>data,text:async()=>data};}};
 vm.runInNewContext(code,context);for(let i=0;i<20;i++)await Promise.resolve();
 return {nodes,requests,timers,events,hide:()=>{hidden=true;mutate();}};
}
(async()=>{
 let r=await run({hidden:true});assert.equal(r.requests.length,0);assert.equal(r.timers.size,0);console.log('PASS hidden tab performs no requests');
 r=await run();assert.equal(r.requests.length,4);assert.ok(r.nodes['dm-table'].innerHTML.includes('BTC'));assert.ok(r.nodes['dm-table'].innerHTML.includes('+4.00%'));assert.ok(r.nodes['dm-andy'].innerHTML.includes('BTC'));assert.ok(r.nodes['dm-andy-at'].textContent.includes('현재 신호 아님'));console.log('PASS quotation, premium and current published Andy contract');
 r.nodes['dm-basis'].onchange({target:{value:'usdt'}});assert.ok(r.nodes['dm-table'].innerHTML.includes('0.00%'));assert.equal(r.requests.length,4);console.log('PASS basis change uses existing data without new requests');
 r.hide();assert.equal(r.timers.size,0);console.log('PASS leaving tab stops future polls');
 r=await run({fail:true});assert.ok(r.nodes['dm-status'].textContent.includes('조회 실패'));assert.ok(!r.nodes['dm-table'].innerHTML.includes('NaN'));assert.ok([...r.timers.values()].some(x=>x.ms>=1000));console.log('PASS failure labels and bounded retry');
 r=await run({storageFail:true});assert.ok(r.nodes['dm-count'].textContent.includes('저장이 차단'));console.log('PASS blocked local storage does not break rendering');
})().catch(e=>{console.error(e);process.exitCode=1;});
