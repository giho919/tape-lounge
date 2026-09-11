const assert=require('node:assert/strict');
const fs=require('node:fs');
const {premium,fresh,rowsFor,stamped,FOREIGN,foreignRows}=require('../domestic.js');
const now=Date.parse('2026-09-09T12:00:00Z');
const ticks=[{market:'KRW-BTC',trade_price:135200000,trade_timestamp:now,acc_trade_price_24h:2e9,signed_change_rate:0.01,high_price:138000000,low_price:134000000},{market:'KRW-USDT',trade_price:1300,trade_timestamp:now}];
const global={BTC:{lastPrice:'100000',openPrice:'98000',quoteVolume:'1234567890',closeTime:now}};
let tests=0;function test(label,fn){fn();tests++;console.log('PASS',label);}
test('premium equation and missing/zero values',()=>{assert.ok(Math.abs(premium(135200000,100000,1300)-4)<1e-10);for(const value of [null,undefined,0,-1,NaN,Infinity,''])assert.equal(premium(1,1,value),null);});
test('freshness boundaries and future timestamps',()=>{assert.equal(fresh(now-120000,now),true);assert.equal(fresh(now-120001,now),false);assert.equal(fresh(now+31000,now),false);});
test('premium converts through the domestic USDT price, not a currency rate',()=>{assert.ok(Math.abs(rowsFor(ticks,global,now)[0].premium-4)<1e-10);assert.ok(rowsFor([ticks[0],{...ticks[1],trade_price:1400}],global,now)[0].premium<0,'USDT가 비싸지면 김프는 줄어든다');const src=fs.readFileSync(require.resolve('../domestic.js'),'utf8');assert.ok(!/frankfurter|fxValid/.test(src),'환율 경로는 남아 있지 않다');});
test('stale local trade excludes premium but preserves labeled quote',()=>{const r=rowsFor([{...ticks[0],trade_timestamp:now-121000}],global,now)[0];assert.equal(r.premium,null);assert.equal(r.reason,'체결 지연');assert.equal(r.price,ticks[0].trade_price);});
test('missing or stale remote excludes premium',()=>{assert.equal(rowsFor(ticks,{},now)[0].reason,'해외 비교 없음');assert.equal(rowsFor(ticks,{BTC:{...global.BTC,closeTime:now-121000}},now)[0].premium,null);});
test('stale or missing domestic USDT clears the premium instead of substituting a rate',()=>{for(const t of [[ticks[0],{...ticks[1],trade_timestamp:now-121000}],[ticks[0]]]){const r=rowsFor(t,global,now)[0];assert.equal(r.premium,null);assert.equal(r.foreignKrw,null);assert.equal(r.reason,'국내 USDT 시세 없음');}});
test('anomalous spread not promoted',()=>{assert.equal(rowsFor([{...ticks[0],trade_price:500000000},ticks[1]],global,now)[0].reason,'가격차 재확인');});
test('malformed symbol filtered',()=>{assert.equal(rowsFor([{...ticks[0],market:'KRW-<script>'}],global,now).length,0);});
test('foreign price converted to KRW and gap agrees with premium',()=>{const r=rowsFor(ticks,global,now)[0];assert.equal(r.foreignKrw,130000000);assert.equal(r.gap,5200000);assert.ok(Math.abs(r.price-(r.foreignKrw+r.gap))<1e-6);assert.ok(Math.abs(r.gap/r.foreignKrw*100-r.premium)<1e-9);});
test('foreign change, foreign turnover and distance from 24h high',()=>{const r=rowsFor(ticks,global,now)[0];assert.ok(Math.abs(r.foreignChange-(100000/98000-1)*100)<1e-9);assert.equal(r.foreignVolume,1234567890);assert.ok(Math.abs(r.fromHigh-(135200000/138000000-1)*100)<1e-9);assert.equal(r.high,138000000);assert.equal(r.low,134000000);});
test('stale or missing remote clears every converted column',()=>{const stale=rowsFor(ticks,{BTC:{...global.BTC,closeTime:now-121000}},now)[0];for(const k of ['foreignKrw','gap','foreignChange','foreignVolume','foreignVolumeKrw'])assert.equal(stale[k],null,k);const none=rowsFor(ticks,{},now)[0];for(const k of ['foreignKrw','gap','foreignChange'])assert.equal(none[k],null,k);const noRate=rowsFor([ticks[0],{...ticks[1],trade_timestamp:now-121000}],global,now)[0];assert.equal(noRate.foreignKrw,null);assert.equal(noRate.gap,null);assert.equal(noRate.foreignVolumeKrw,null);assert.ok(Math.abs(noRate.foreignChange-(100000/98000-1)*100)<1e-9);});
test('anomalous spread hides the gap amount too',()=>{const r=rowsFor([{...ticks[0],trade_price:500000000},ticks[1]],global,now)[0];assert.equal(r.premium,null);assert.equal(r.gap,null);assert.equal(r.foreignKrw,130000000);});
test('sortable columns exist on every row and headers are declared',()=>{const r=rowsFor(ticks,global,now)[0];const src=fs.readFileSync(require.resolve('../domestic.js'),'utf8');for(const k of ['price','change','changeKrw','foreignKrw','premium','foreignChange','volume','foreignVolumeKrw'])assert.ok(k in r,k);for(const k of ['symbol','price','change','premium','volume'])assert.ok(src.includes("key:'"+k+"'"),k);assert.ok(!src.includes("id=\"dm-sort\""));});
test('bithumb REST timestamps are corrected, its websocket and upbit are left alone',()=>{
 const at=Date.parse('2026-09-09T23:52:22Z');
 const rest={market:'KRW-BTC',trade_date:'20260909',trade_time:'235222',trade_date_kst:'20260910',trade_time_kst:'085222',trade_timestamp:at+9*3600000};
 assert.equal(fresh(rest.trade_timestamp,at),false);
 assert.equal(stamped(rest).trade_timestamp,at);
 assert.equal(fresh(stamped(rest).trade_timestamp,at),true);
 const ws={market:'KRW-BTC',trade_date:'20260910',trade_time:'085222',trade_timestamp:at};
 assert.equal(stamped(ws),ws,'_kst 쌍이 없는 웹소켓 형식은 손대지 않는다');
 const upbit={market:'KRW-BTC',trade_date:'20260909',trade_time:'235218',trade_date_kst:'20260910',trade_time_kst:'085218',trade_timestamp:at-3108};
 assert.equal(stamped(upbit),upbit,'몇 초 차이는 교정하지 않는다');
 for(const bad of [{...rest,trade_time:'2352'},{...rest,trade_date:null},{...rest,trade_timestamp:null}])assert.equal(stamped(bad),bad);
 assert.equal(rowsFor([{...rest,trade_price:1}],{},at)[0].current,false,'교정 전 시세는 지연으로 처리');
 assert.equal(rowsFor([{...stamped(rest),trade_price:1}],{},at)[0].current,true,'교정 후에는 비교 대상이 된다');
});
test('every foreign exchange parses to the same shape',()=>{
 const at=1700000000000,shapes={
  binance:[{symbol:'BTCUSDT',lastPrice:'77100',openPrice:'78300',quoteVolume:'1225000000',closeTime:at},{symbol:'BTCBUSD',lastPrice:'1'}],
  bybit:{time:at,result:{list:[{symbol:'BTCUSDT',lastPrice:'77100',prevPrice24h:'78300',turnover24h:'546000000'},{symbol:'BTCEUR',lastPrice:'1'}]}},
  okx:{data:[{instId:'BTC-USDT',last:'77100',open24h:'78300',volCcy24h:'410000000',ts:String(at)},{instId:'BTC-USDC',last:'1'}]},
  gate:[{currency_pair:'BTC_USDT',last:'77100',change_percentage:'-1.53',quote_volume:'540000000'},{currency_pair:'BTC_ETH',last:'1'}],
  bitget:{data:[{symbol:'BTCUSDT',lastPr:'77100',open:'78300',quoteVolume:'223000000',ts:String(at)},{symbol:'BTCUSDC',lastPr:'1'}]}};
 for(const [key,payload] of Object.entries(shapes)){
  const rows=foreignRows(key,payload,at);
  assert.ok(rows&&rows.BTC,key);
  assert.equal(Object.keys(rows).length,1,key+': USDT 마켓만 남긴다');
  const b=rows.BTC;
  assert.equal(Number(b.lastPrice),77100,key);
  assert.ok(Math.abs(Number(b.openPrice)-78300)<20,key+': 24시간 전 가격 '+b.openPrice);
  assert.ok(Number(b.quoteVolume)>1e8,key);
  assert.equal(b.closeTime,at,key+': 시각은 거래소 값이거나 응답을 받은 시각');
  assert.ok(Math.abs(rowsFor(ticks,rows,now).find(r=>r.symbol==='BTC').premium)<50,key);
 }
 assert.equal(foreignRows('binance',[],at),null,'빈 응답은 성공으로 치지 않는다');
 assert.equal(foreignRows('binance',{oops:1},at),null);
 assert.equal(foreignRows('없는거래소',[],at),null);
 assert.equal(foreignRows('binance',[{symbol:'<script>USDT',lastPrice:'1'},{symbol:'BADUSDT',lastPrice:'0'}],at),null,'이상한 티커와 0원 시세는 버린다');
});
test('every foreign host is declared in the CSP',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const connect=html.match(/connect-src([^;"]*)/)[1];
 for(const [key,v] of Object.entries(FOREIGN)){
  const host=new URL(v.url).origin;
  assert.ok(connect.includes(host+' ')||connect.includes(host+';'),key+' 호스트가 CSP에 없음: '+host);
 }
 assert.ok(connect.includes('https://api.frankfurter.dev'),'라운지 USD/KRW 타일이 쓰는 호스트는 남겨 둔다');
 assert.ok(html.includes('id="dm-foreign"')===false,'해외 거래소 선택은 domestic.js가 그린다');
});
test('the chart is an embedded iframe, not a script we run',()=>{
 const src=fs.readFileSync(require.resolve('../domestic.js'),'utf8');
 assert.ok(src.includes('https://s.tradingview.com/widgetembed/'),'문서화된 임베드 주소를 쓴다');
 assert.ok(!/s3\.tradingview\.com|embed-widget|createElement\('script'\)/.test(src),'TradingView 로더 스크립트는 이 페이지에서 실행하지 않는다');
 assert.ok(src.includes("sandbox=\"allow-scripts allow-same-origin allow-popups"),'iframe 은 sandbox 로 막아 둔다');
 assert.ok(src.includes('referrerpolicy="strict-origin-when-cross-origin"'),'주소 전체가 아니라 사이트 출처만 넘긴다');
 assert.ok(src.includes("TV={upbit:'UPBIT',bithumb:'BITHUMB'}"),'기준 거래소를 그대로 차트 거래소로 쓴다');
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const frame=html.match(/frame-src([^;"]*)/)[1];
 assert.ok(frame.includes('https://s.tradingview.com'),'CSP frame-src 에 있어야 iframe 이 뜬다');
 assert.ok(!/script-src[^;]*tradingview/.test(html),'script-src 에는 넣지 않는다');
});
test('bithumb batches go out together and the table never waits on one fetch',()=>{
 const src=fs.readFileSync(require.resolve('../domestic.js'),'utf8');
 assert.ok(/urls\.map\(u=>get\(u,epoch\)\)/.test(src),'빗썸 80종 배치는 순차가 아니라 동시에 보낸다');
 assert.ok(src.includes('type=MINI'),'바이낸스는 호가·체결건수까지 오는 전체 응답 대신 MINI');
 assert.equal((src.match(/\.then\(paintNow\)|paintNow\(\);/g)||[]).length,3,'조회 갈래가 각자 끝나는 대로 그린다');
 assert.ok(/paintNow\(\);\}\)\.then\(\(\)=>job\('andy'/.test(src),'232KB 짜리 Andy 리포트는 국내 조회가 끝난 뒤에 받아 첫 화면과 다투지 않는다');
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 for(const host of ['https://api.upbit.com','https://data-api.binance.vision'])
  assert.ok(html.includes(`<link rel="preconnect" href="${host}" crossorigin>`),host+' 은 미리 연결해 둔다');
 assert.ok(!/rel="preconnect"[^>]*bybit|rel="preconnect"[^>]*okx/.test(html),'기본값이 아닌 거래소까지 미리 연결하지는 않는다');
 assert.ok(src.includes('if(state.busy){if(force)state.again=true;return;}'),'조회 중 전환 요청을 버리지 않는다');
});
test('tab integration, CSP and JS syntax',()=>{const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.equal((html.match(/id="tab-domestic"/g)||[]).length,1);assert.ok(html.includes("domestic:'domestic'"));assert.ok(html.includes("$('tab-domestic').classList.toggle"));assert.ok(html.includes("https://api.upbit.com https://data-api.binance.vision"));for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!m[1].includes('src=')&&!m[1].includes('application/'))new Function(m[2]);}new Function(fs.readFileSync(require.resolve('../domestic.js'),'utf8'));});
console.log(tests+' domestic checks passed');
