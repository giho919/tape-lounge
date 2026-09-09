// Unit-level DOM/network adapters. No browser, production posts or database calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require.resolve('../domestic.js'),'utf8');
const report=fs.readFileSync(require.resolve('../reports/andy_scan.html'),'utf8');
const stamp=report.match(/class='ts'>(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST/);
assert.ok(stamp,'published report date contract');
assert.ok(report.includes("id='andy-retest'"),'published section contract');
const section=report.split("id='andy-retest'")[1].split('</section>')[0];
const reportRows=[...section.matchAll(/<tr>(.*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td>(.*?)<\/td>/g)].map(x=>({textContent:x[1]})));
const daily=report.slice(report.indexOf('</section>'));
const dailyRows=[...daily.matchAll(/<tr>(.*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>(.*?)<\/td>/g)].map(x=>({textContent:x[1].replace(/<[^>]+>/g,'')})));
assert.ok(reportRows.length>0,'published table rows contract');
const current=Date.parse(`${stamp[1]}T${stamp[2]}:00+09:00`)+1000;
const ticks=[{market:'KRW-BTC',trade_price:135200000,trade_timestamp:current,acc_trade_price_24h:2e9,signed_change_rate:.01,signed_change_price:1352000,high_price:138000000,low_price:134000000},{market:'KRW-USDT',trade_price:1352,trade_timestamp:current}];
async function run({hidden=false,fail=false,storageFail=false,reportAge=0}={}){
 const nodes={},requests=[],timers=new Map(),events={};let seq=0,mutate;
 const node=id=>nodes[id]??=({innerHTML:'',textContent:'',dataset:{},hidden:false,classList:{contains:()=>hidden},addEventListener:(event,cb)=>events[id+':'+event]=cb,querySelector:()=>null,setAttribute(){},scrollIntoView(){}});
 const doc={hidden:false,getElementById:node,activeElement:null,addEventListener:(event,cb)=>events[event]=cb};
 class Clock extends Date{constructor(...a){super(...(a.length?a:[current+reportAge]));}static now(){return current+reportAge;}}
 const context={console,Date:Clock,document:doc,window:{document:doc},localStorage:{getItem(){if(storageFail)throw Error('blocked');return '[]';},setItem(){if(storageFail)throw Error('blocked');}},AbortController,
  setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(cb){mutate=cb;}observe(){}},
  DOMParser:class{parseFromString(){return {querySelector:sel=>sel==='.hdr .ts'?{textContent:stamp[0]}:sel==='#andy-retest'?{}:null,querySelectorAll:sel=>(sel.startsWith('#andy-retest')?reportRows:dailyRows).map(t=>({querySelectorAll:()=>t}))};}},
  fetch:async(url,opts)=>{requests.push(url);assert.equal(opts.credentials,'omit');assert.ok(opts.signal);if(fail)throw Error('offline');let data;if(url.includes('bithumb/v1/market')||url.includes('bithumb.com/v1/market'))data=[{market:'KRW-BTC',korean_name:'비트코인'}];else if(url.includes('bithumb'))data=[{...ticks[0],trade_price:135900000}];else if(url.includes('upbit'))data=ticks;else if(url.includes('binance'))data=[{symbol:'BTCUSDT',lastPrice:'100000',openPrice:'98000',quoteVolume:'1234567890',closeTime:current}];else if(url.includes('frankfurter'))data={date:stamp[1],rates:{KRW:1300}};else data=report;return {ok:true,json:async()=>data,text:async()=>data};}};
 vm.runInNewContext(code,context);for(let i=0;i<20;i++)await Promise.resolve();
 return {nodes,requests,timers,events,hide:()=>{hidden=true;mutate();}};
}
(async()=>{
 {const css=fs.readFileSync(require.resolve('../domestic.css'),'utf8');
  assert.ok(!/overflow-x\s*:\s*auto/.test(css),'표는 가로 스크롤 없이 화면 폭에 맞춘다');
  assert.ok(css.includes('max-width:0'),'이름 칸이 남는 폭을 흡수하고 말줄임한다');
  assert.ok(!/max-height\s*:\s*\d+vh/.test(css),'세로는 페이지 스크롤 하나로만 움직인다');
  console.log('PASS table fits the viewport width with a single vertical scroll');}
 let r=await run({hidden:true});assert.equal(r.requests.length,0);assert.equal(r.timers.size,0);console.log('PASS hidden tab performs no requests');
 r=await run();assert.equal(r.requests.length,4);assert.ok(r.nodes['dm-table'].innerHTML.includes('BTC'));assert.ok(r.nodes['dm-table'].innerHTML.includes('+4.00%'));assert.ok(r.nodes['dm-table'].innerHTML.includes('title="Andy 장부 · 4h · 지지 확인"'));assert.ok(r.nodes['dm-andy-at'].textContent.includes('현재 신호 아님'));console.log('PASS quotation, premium and current published Andy contract');
 const click=(x,attr,value)=>x.events['tab-domestic:click']({target:{closest:sel=>sel==='['+attr+']'?{dataset:{[attr.slice(5)]:value}}:null}});
 assert.equal((r.nodes['dm-head'].innerHTML.match(/<th/g)||[]).length,5);
 for(const label of ['이름','현재가','김프','전일대비','거래액(일)'])assert.ok(r.nodes['dm-head'].innerHTML.includes(label),label);
 const html=r.nodes['dm-table'].innerHTML;
 assert.ok(html.includes('<b>135,200,000</b><small>130,000,000</small>'),'국내가 위, 해외 환산가 아래');
 assert.ok(html.includes('+4.00%</b><small>+520만</small>'),'김프 %와 금액이 한 칸에');
 assert.ok(html.includes('+1.00%</b><small>+135만</small>'),'전일대비 %와 변동액이 한 칸에');
 assert.ok(html.includes('<b>20억</b><small>1조 6,049억</small>'),'국내 거래액과 해외 원화 환산 거래액');
 assert.ok(!html.includes('₩'),'표 안에서는 통화기호를 빼고 숫자만');
 assert.ok(r.nodes['dm-count'].textContent.includes('총 2개'));
 console.log('PASS five paired columns render domestic figure over its foreign counterpart');
 assert.ok(r.nodes['dm-table'].innerHTML.includes('해외 비교 없음'),'비교 불가 사유는 김프 칸 아래에 남는다');
 assert.ok(r.nodes['dm-table'].innerHTML.includes('<b class="dm-muted"></b><small class="dm-warn">해외 비교 없음</small>'),'비교 불가 종목의 김프는 값을 비우고 사유만 남긴다');
 console.log('PASS unavailable premium is left blank with its reason beneath');
 const at=s=>r.nodes['dm-table'].innerHTML.indexOf('data-select="'+s+'"');
 click(r,'data-sort','symbol');assert.ok(r.nodes['dm-head'].innerHTML.includes('aria-sort="ascending"'));assert.ok(at('BTC')<at('USDT'));
 click(r,'data-sort','symbol');assert.ok(r.nodes['dm-head'].innerHTML.includes('aria-sort="descending"'));assert.ok(at('USDT')<at('BTC'));
 click(r,'data-sort','volume');assert.ok(at('BTC')<at('USDT'));
 console.log('PASS header sorting toggles direction and reorders rows');
 {const before=r.requests.length;
  r.nodes['dm-venue'].onchange({target:{value:'bithumb'}});
  assert.ok(r.nodes['dm-table'].innerHTML.includes('빗썸 시세를 불러오는 중입니다.'),'전환 직후에는 검색 결과 없음이 아니라 불러오는 중');
  for(let i=0;i<20;i++)await Promise.resolve();
  const asked=r.requests.slice(before).filter(u=>u.includes('bithumb'));
  assert.ok(asked.length>=2,'거래소 전환은 30초 간격을 기다리지 않고 즉시 조회한다: '+asked.length);
  assert.ok(r.nodes['dm-table'].innerHTML.includes('135,900,000'),'전환한 거래소의 시세가 표에 들어온다');
  r.nodes['dm-venue'].onchange({target:{value:'upbit'}});for(let i=0;i<20;i++)await Promise.resolve();}
 console.log('PASS switching venue fetches at once instead of waiting for the poll');
 {const before=r.requests.length;r.nodes['dm-basis'].onchange({target:{value:'usdt'}});assert.ok(r.nodes['dm-table'].innerHTML.includes('0.00%'));assert.equal(r.requests.length,before);}console.log('PASS basis change uses existing data without new requests');
 r.nodes['dm-andy-only'].onclick({currentTarget:{setAttribute(){}}});assert.ok(r.nodes['dm-table'].innerHTML.includes('BTC'));assert.ok(!r.nodes['dm-table'].innerHTML.includes('data-select="USDT"'));console.log('PASS Andy filter preserves all matching rows');
 r.hide();assert.equal(r.timers.size,0);console.log('PASS leaving tab stops future polls');
 r=await run({fail:true});assert.ok(r.nodes['dm-status'].textContent.includes('조회 실패'));assert.ok(!r.nodes['dm-table'].innerHTML.includes('NaN'));assert.ok([...r.timers.values()].some(x=>x.ms>=1000));console.log('PASS failure labels and bounded retry');
 r=await run({storageFail:true});assert.ok(r.nodes['dm-status'].textContent.includes('저장이 차단'));console.log('PASS blocked local storage does not break rendering');
 r=await run({reportAge:37*3600000});assert.ok(!r.nodes['dm-table'].innerHTML.includes('Andy ·'));assert.ok(r.nodes['dm-andy-at'].textContent.includes('오래된 리포트'));console.log('PASS stale report suppresses every Andy badge');
})().catch(e=>{console.error(e);process.exitCode=1;});
