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
const STAGES=['지지 확인','재출발','눌림 대기','이미 많이 벌어짐'];
const andyRow=reportRows.find(t=>t.length>=2&&/^[A-Z0-9]+\/USDT$/.test(t[0].textContent)&&STAGES.includes(t[1].textContent));
assert.ok(andyRow,'발행 리포트에 후보가 하나는 있어야 한다');
const andySymbol=andyRow[0].textContent.replace('/USDT',''),andyStage='4h · '+andyRow[1].textContent;
assert.notEqual(andySymbol,'USDT');
const ticks=[{market:'KRW-BTC',trade_price:135200000,trade_timestamp:current,acc_trade_price_24h:2e9,signed_change_rate:.01,signed_change_price:1352000,high_price:138000000,low_price:134000000},{market:'KRW-USDT',trade_price:1300,trade_timestamp:current}].concat(andySymbol==='BTC'?[]:[{market:'KRW-'+andySymbol,trade_price:5000,trade_timestamp:current,acc_trade_price_24h:1e8,signed_change_rate:0}]);
async function run({hidden=false,fail=false,storageFail=false,reportAge=0,hang=''}={}){
 const nodes={},requests=[],timers=new Map(),events={};let seq=0,mutate;
 const node=id=>nodes[id]??=({innerHTML:'',textContent:'',dataset:{},hidden:false,classList:{contains:()=>hidden},addEventListener:(event,cb)=>events[id+':'+event]=cb,querySelector:()=>null,setAttribute(){},scrollIntoView(){}});
 const doc={hidden:false,getElementById:node,activeElement:null,addEventListener:(event,cb)=>events[event]=cb};
 let skew=0;
 class Clock extends Date{constructor(...a){super(...(a.length?a:[current+reportAge+skew]));}static now(){return current+reportAge+skew;}}
 const context={console,Date:Clock,URLSearchParams,document:doc,window:{document:doc},localStorage:{getItem(){if(storageFail)throw Error('blocked');return '[]';},setItem(){if(storageFail)throw Error('blocked');}},AbortController,
  setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(cb){mutate=cb;}observe(){}},
  DOMParser:class{parseFromString(){return {querySelector:sel=>sel==='.hdr .ts'?{textContent:stamp[0]}:sel==='#andy-retest'?{}:null,querySelectorAll:sel=>(sel.startsWith('#andy-retest')?reportRows:dailyRows).map(t=>({querySelectorAll:()=>t}))};}},
  fetch:async(url,opts)=>{requests.push(url);assert.equal(opts.credentials,'omit');assert.ok(opts.signal);if(fail)throw Error('offline');if(hang&&url.includes(hang))return new Promise(()=>{});let data;if(url.includes('/candles/minutes/')){const n=+url.match(/count=(\d+)/)[1];
   data=Array.from({length:n},(_,i)=>({candle_date_time_utc:new Date(current-i*3600000).toISOString().slice(0,19),opening_price:100+i,high_price:110+i,low_price:90+i,trade_price:105+i}));}
  else if(url.includes('bithumb/v1/market')||url.includes('bithumb.com/v1/market'))data=[{market:'KRW-BTC',korean_name:'비트코인'}];else if(url.includes('bithumb'))data=[{...ticks[0],trade_price:135900000}];else if(url.includes('upbit'))data=ticks;else if(url.includes('binance'))data=[{symbol:'BTCUSDT',lastPrice:'100000',openPrice:'98000',quoteVolume:'1234567890',closeTime:current}];else if(url.includes('bybit'))data={time:current,result:{list:[{symbol:'BTCUSDT',lastPrice:'101000',prevPrice24h:'98000',turnover24h:'555000000'}]}};else data=report;return {ok:true,json:async()=>data,text:async()=>data};}};
 vm.runInNewContext(code,context);for(let i=0;i<60;i++)await Promise.resolve();
 /* 예약된 재시도를 실제로 돌려 본다 — 붙박이 시계라 시간도 함께 밀어 준다. */
 const fire=async ms=>{skew+=ms;const due=[...timers.entries()];timers.clear();
  for(const [,t] of due)await t.fn();for(let i=0;i<25;i++)await Promise.resolve();};
 return {nodes,requests,timers,events,fire,hide:()=>{hidden=true;mutate();}};
}
(async()=>{
 {const css=fs.readFileSync(require.resolve('../domestic.css'),'utf8');
  assert.ok(!/overflow-x\s*:\s*auto/.test(css),'표는 가로 스크롤 없이 화면 폭에 맞춘다');
  assert.ok(css.includes('max-width:0'),'이름 칸이 남는 폭을 흡수하고 말줄임한다');
  assert.ok(!/max-height\s*:\s*\d+vh/.test(css),'세로는 페이지 스크롤 하나로만 움직인다');
  console.log('PASS table fits the viewport width with a single vertical scroll');}
 let r=await run({hidden:true});assert.equal(r.requests.length,0);assert.equal(r.timers.size,0);console.log('PASS hidden tab performs no requests');
 r=await run();assert.equal(r.requests.length,3);assert.ok(r.nodes['dm-table'].innerHTML.includes('BTC'));assert.ok(r.nodes['dm-table'].innerHTML.includes('+4.00%'));assert.ok(!r.requests.some(u=>u.includes('frankfurter')),'환율은 더 이상 조회하지 않는다');assert.ok(r.nodes['dm-table'].innerHTML.includes(`title="Andy 장부 · ${andyStage}"`),'리포트에 실린 '+andySymbol+' 후보가 표에 배지로 나온다');assert.ok(r.nodes['dm-andy-at'].textContent.includes('현재 신호 아님'));console.log('PASS quotation, premium and current published Andy contract');
 const click=(x,attr,value)=>x.events['tab-domestic:click']({target:{closest:sel=>sel==='['+attr+']'?{dataset:{[attr.slice(5)]:value}}:null}});
 assert.equal((r.nodes['dm-head'].innerHTML.match(/<th/g)||[]).length,5);
 for(const label of ['이름','현재가','김프','전일대비','거래액(일)'])assert.ok(r.nodes['dm-head'].innerHTML.includes(label),label);
 const html=r.nodes['dm-table'].innerHTML;
 assert.ok(html.includes('<b>135,200,000</b><small>130,000,000</small>'),'국내가 위, 해외 환산가 아래');
 assert.ok(html.includes('+4.00%</b><small>+520만</small>'),'김프 %와 금액이 한 칸에');
 assert.ok(html.includes('+1.00%</b><small>+135만</small>'),'전일대비 %와 변동액이 한 칸에');
 assert.ok(html.includes('<b>20억</b><small>1조 6,049억</small>'),'국내 거래액과 해외 원화 환산 거래액');
 assert.ok(!html.includes('₩'),'표 안에서는 통화기호를 빼고 숫자만');
 assert.ok(r.nodes['dm-count'].textContent.includes('총 '+ticks.length+'개'));
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
 {for(const id of ['dm-chart','dm-rest'])assert.ok(!(r.nodes[id]?.innerHTML||'').includes('dm-open'),'처음에는 아무 코인도 펼쳐져 있지 않다');
  click(r,'data-select','BTC');
  const rows=r.nodes['dm-table'].innerHTML,rest=r.nodes['dm-rest'].innerHTML;
  /* 세 tbody 가 이 순서로 이어 붙는다: …행 · 누른 행 | 차트 | 상세 · 나머지 행 */
  assert.ok(rows.trimEnd().endsWith('</tr>')&&rows.lastIndexOf('data-select="BTC"')>rows.lastIndexOf('<tr',rows.lastIndexOf('data-select="BTC"'))-1,'누른 행이 첫 tbody 의 마지막');
  assert.equal(rows.slice(rows.lastIndexOf('data-select="BTC"')).match(/<tr/g),null,'누른 행 뒤에 다른 행이 붙지 않는다');
  assert.ok(r.nodes['dm-chart'].innerHTML.startsWith('<tr class="dm-open dm-open-chart">'),'차트가 바로 다음 줄');
  assert.ok(rest.startsWith('<tr class="dm-open">'),'상세가 그다음 줄');
  assert.ok(rows.includes('aria-expanded="true"'));
  assert.ok(rest.includes('고가 대비')&&rest.includes('해외 등락'),'표에서 뺀 값들이 상세에 남아 있다');
  assert.ok(rest.includes('₩5,200,000'),'상세는 줄이지 않은 정확한 금액을 보여준다');
  assert.ok(rest.includes('data-select="USDT"'),'나머지 행은 상세 아래로 이어진다');
  click(r,'data-select','BTC');
  for(const id of ['dm-chart','dm-rest'])assert.ok(!r.nodes[id].innerHTML.includes('dm-open'),'같은 코인을 다시 누르면 접힌다');}
 console.log('PASS detail opens under the row it belongs to and toggles shut');

 {click(r,'data-select','BTC');
  const chart=r.nodes['dm-chart'].innerHTML,facts=r.nodes['dm-rest'].innerHTML;
  assert.ok(chart.includes('<iframe class="dm-chart"'),'차트가 붙는다');
  assert.ok(chart.includes('symbol=UPBIT%3ABTCKRW'),'기준 거래소 심볼로 연다');
  assert.ok(chart.includes('interval=60')&&chart.includes('data-interval="60" aria-pressed="true"'),'기본은 1시간봉');
  assert.ok(!r.requests.some(u=>u.includes('tradingview')),'차트 때문에 우리가 부르는 요청은 없다');
  for(const label of ['업비트 현재가','김프','24시간 고 / 저','고가 대비','해외 등락','거래액 · 국내 / 해외'])
   assert.ok(facts.includes(label),'정리된 항목: '+label);
  assert.ok(facts.includes('₩5,200,000')&&facts.includes('₩1,352,000'),'표가 줄인 금액은 여기서 정확히 보여 준다');

  const frame=r.nodes['dm-chart'].innerHTML,before=r.nodes['dm-rest'].innerHTML;
  /* 시세가 바뀌어 표를 다시 그려도 iframe 이 든 줄은 건드리면 안 된다 — 건드리면 차트가 처음부터 다시 읽힌다. */
  r.events['tab-domestic:click']({target:{closest:sel=>sel==='[data-star]'?{dataset:{star:'USDT'}}:null}});
  assert.notEqual(r.nodes['dm-rest'].innerHTML,before,'다른 줄은 실제로 다시 그려졌다');
  assert.equal(r.nodes['dm-chart'].innerHTML,frame,'그래도 차트 줄은 그대로다');
  click(r,'data-interval','240');
  assert.ok(r.nodes['dm-chart'].innerHTML.includes('interval=240'),'봉 주기를 바꾸면 다시 연다');
  assert.notEqual(r.nodes['dm-chart'].innerHTML,frame);
  click(r,'data-select','BTC');
  assert.equal(r.nodes['dm-chart'].innerHTML,'','접으면 차트도 사라진다');
  click(r,'data-interval','60');}
 console.log('PASS the panel embeds the chart once and reopens it only on a period change');
 {const before=r.requests.length;
  r.nodes['dm-foreign'].onchange({target:{value:'bybit'}});
  for(let i=0;i<20;i++)await Promise.resolve();
  const asked=r.requests.slice(before);
  assert.ok(asked.some(u=>u.includes('bybit.com')),'고른 해외 거래소를 바로 조회한다');
  assert.ok(!asked.some(u=>u.includes('binance')),'바이낸스는 더 이상 부르지 않는다');
  assert.ok(r.nodes['dm-table'].innerHTML.includes('131,300,000'),'바이비트 시세로 해외 환산가가 바뀐다');
  assert.ok(r.nodes['dm-rates'].innerHTML.includes('바이비트'));
  r.nodes['dm-foreign'].onchange({target:{value:'없는거래소'}});
  assert.ok(r.nodes['dm-rates'].innerHTML.includes('바이비트'),'모르는 값은 무시한다');}
 console.log('PASS switching the foreign exchange refetches and reprices');
 r.nodes['dm-andy-only'].onclick({currentTarget:{setAttribute(){}}});assert.ok(r.nodes['dm-table'].innerHTML.includes('data-select="'+andySymbol+'"'));assert.ok(!r.nodes['dm-table'].innerHTML.includes('data-select="USDT"'));console.log('PASS Andy filter preserves all matching rows');
 r.hide();assert.equal(r.timers.size,0);console.log('PASS leaving tab stops future polls');
 {r=await run({fail:true});
  assert.ok(r.nodes['dm-table'].innerHTML.includes('불러오는 중'),'한 번 걸렀다고 실패라고 말하지 않는다');
  assert.ok(!r.nodes['dm-status'].textContent.includes('다시 시도 중'),'한 번 실패는 알리지 않는다');
  const soon=[...r.timers.values()].map(t=>t.ms);
  assert.ok(soon.length&&soon.every(ms=>ms>=1000&&ms<=6000),'시세가 하나도 없으면 30초를 기다리지 않고 곧 다시 시도한다: '+soon);
  const before=r.requests.length;
  for(let i=0;i<4;i++)await r.fire(8000);
  assert.ok(r.requests.length>before,'예약된 재시도가 실제로 다시 조회한다');
  assert.ok(r.nodes['dm-status'].textContent.includes('다시 시도 중'),'계속 실패하면 그때 알린다');
  assert.ok(r.nodes['dm-table'].innerHTML.includes('계속 불러오지 못하고'));
  assert.ok(!r.nodes['dm-table'].innerHTML.includes('NaN'));
  const later=[...r.timers.values()].map(t=>t.ms);
  assert.ok(later.length&&later.every(ms=>ms>=1000&&ms<=30000),'재시도 간격은 30초를 넘지 않는다: '+later);}
 console.log('PASS a single miss stays quiet, repeated misses are announced and retried sooner');
 {/* 해외 전 종목은 국내보다 훨씬 크고 느리다 — 표가 그걸 기다리면 안 된다. */
  const r2=await run({hang:'binance'});
  assert.ok(r2.nodes['dm-table'].innerHTML.includes('data-select="BTC"'),'해외 조회가 끝나기 전에 국내 표가 먼저 나온다');
  assert.ok(r2.nodes['dm-table'].innerHTML.includes('해외 시세 대기'),'아직 안 온 해외는 비교 없음이 아니라 대기로 적는다');
  assert.ok(!r2.nodes['dm-table'].innerHTML.includes('불러오는 중입니다'));}
 console.log('PASS the table paints as soon as the domestic quotes land');

 {const r3=await run({hang:'andy_scan'});
  assert.ok(r3.nodes['dm-table'].innerHTML.includes('data-select="BTC"'),'Andy 리포트를 기다리지 않는다');}
 console.log('PASS a slow report never holds the table back');

 {const r4=await run();
  const batches=r4.requests.filter(u=>u.includes('bithumb.com/v1/ticker?'));
  r4.nodes['dm-venue'].onchange({target:{value:'bithumb'}});
  for(let i=0;i<30;i++)await Promise.resolve();
  const after=r4.requests.filter(u=>u.includes('bithumb.com/v1/ticker?'));
  assert.ok(after.length>batches.length,'전환하면 빗썸을 조회한다');
  assert.ok(r4.requests.some(u=>u.includes('type=MINI')),'바이낸스는 가벼운 MINI 응답을 쓴다');}
 console.log('PASS venue switch fans out and Binance uses the lighter payload');
 r=await run({storageFail:true});assert.ok(r.nodes['dm-status'].textContent.includes('저장이 차단'));console.log('PASS blocked local storage does not break rendering');
 r=await run({reportAge:37*3600000});assert.ok(!r.nodes['dm-table'].innerHTML.includes('Andy ·'));assert.ok(r.nodes['dm-andy-at'].textContent.includes('오래된 리포트'));console.log('PASS stale report suppresses every Andy badge');
})().catch(e=>{console.error(e);process.exitCode=1;});
