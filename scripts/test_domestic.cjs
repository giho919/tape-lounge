const assert=require('node:assert/strict');
const fs=require('node:fs');
const {premium,fresh,fxValid,rowsFor}=require('../domestic.js');
const now=Date.parse('2026-09-09T12:00:00Z');
const fx={date:'2026-09-09',rates:{KRW:1300}};
const ticks=[{market:'KRW-BTC',trade_price:135200000,trade_timestamp:now,acc_trade_price_24h:2e9,signed_change_rate:0.01},{market:'KRW-USDT',trade_price:1352,trade_timestamp:now}];
const global={BTC:{lastPrice:'100000',closeTime:now}};
let tests=0;function test(label,fn){fn();tests++;console.log('PASS',label);}
test('premium equation and missing/zero values',()=>{assert.ok(Math.abs(premium(135200000,100000,1300)-4)<1e-10);for(const value of [null,undefined,0,-1,NaN,Infinity,''])assert.equal(premium(1,1,value),null);});
test('freshness boundaries and future timestamps',()=>{assert.equal(fresh(now-120000,now),true);assert.equal(fresh(now-120001,now),false);assert.equal(fresh(now+31000,now),false);});
test('daily FX must have valid date and positive rate',()=>{assert.ok(fxValid(fx,now));assert.equal(fxValid({...fx,date:'2026-08-31'},now),false);assert.equal(fxValid({...fx,date:'2026-09-12'},now),false);assert.equal(fxValid({date:fx.date,rates:{KRW:0}},now),false);});
test('FX and domestic USDT are distinct',()=>{assert.ok(Math.abs(rowsFor(ticks,global,fx,'fx',now)[0].premium-4)<1e-10);assert.equal(rowsFor(ticks,global,fx,'usdt',now)[0].premium,0);});
test('stale local trade excludes premium but preserves labeled quote',()=>{const r=rowsFor([{...ticks[0],trade_timestamp:now-121000}],global,fx,'fx',now)[0];assert.equal(r.premium,null);assert.equal(r.reason,'체결 지연');assert.equal(r.price,ticks[0].trade_price);});
test('missing or stale remote excludes premium',()=>{assert.equal(rowsFor(ticks,{},fx,'fx',now)[0].reason,'해외 비교 없음');assert.equal(rowsFor(ticks,{BTC:{...global.BTC,closeTime:now-121000}},fx,'fx',now)[0].premium,null);});
test('stale USDT does not fall back to FX',()=>{assert.equal(rowsFor([ticks[0],{...ticks[1],trade_timestamp:now-121000}],global,fx,'usdt',now)[0].premium,null);});
test('anomalous spread not promoted',()=>{assert.equal(rowsFor([{...ticks[0],trade_price:500000000}],global,fx,'fx',now)[0].reason,'가격차 재확인');});
test('malformed symbol filtered',()=>{assert.equal(rowsFor([{...ticks[0],market:'KRW-<script>'}],global,fx,'fx',now).length,0);});
test('tab integration, CSP and JS syntax',()=>{const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.equal((html.match(/id="tab-domestic"/g)||[]).length,1);assert.ok(html.includes("domestic:'domestic'"));assert.ok(html.includes("$('tab-domestic').classList.toggle"));assert.ok(html.includes("https://api.upbit.com https://data-api.binance.vision"));for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!m[1].includes('src=')&&!m[1].includes('application/'))new Function(m[2]);}new Function(fs.readFileSync(require.resolve('../domestic.js'),'utf8'));});
console.log(tests+' domestic checks passed');
