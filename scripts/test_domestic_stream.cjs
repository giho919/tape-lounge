const assert=require('node:assert/strict');
const {normalize,createStreams}=require('../domestic-stream.js');
let at=100000,id=0;const timers=new Map(),sockets=[],events=[],status=[];
function advance(ms){const end=at+ms;while(true){const next=[...timers].filter(([,x])=>x.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);at=next[1].at;next[1].fn();}at=end;}
class WS{constructor(url){this.url=url;this.readyState=0;sockets.push(this);}send(s){this.sent=JSON.parse(s);}close(){this.readyState=3;this.onclose?.();}open(){this.readyState=1;this.onopen?.();}data(d,binary=false){const s=JSON.stringify(d);this.onmessage?.({data:binary?new TextEncoder().encode(s).buffer:s});}}
const streams=createStreams({WebSocket:WS,now:()=>at,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:at+ms});return id;},clearTimer:i=>timers.delete(i),onData:(k,d)=>events.push([k,d]),onState:(k,on)=>status.push([k,on])});
assert.equal(normalize('upbit',{type:'ticker',code:'KRW-BTC',trade_price:0}).length,0);
assert.deepEqual(normalize('binance',[{s:'BTCUSDT',c:'1',o:'0.8',h:'1.2',l:'0.7',q:'900',E:123}]),[{symbol:'BTC',lastPrice:'1',openPrice:'0.8',highPrice:'1.2',lowPrice:'0.7',quoteVolume:'900',closeTime:123}]);
streams.touch('upbit');streams.start('upbit',['KRW-BTC','KRW-USDT']);
assert.equal(sockets.length,1);assert.ok(sockets[0].url.includes('miniTicker'));assert.equal(streams.canPoll('upbit'),false);
advance(11999);assert.equal(sockets.length,1);advance(1);assert.equal(sockets.length,2);const up=sockets[1];up.open();assert.equal(up.sent[1].type,'ticker');assert.deepEqual(up.sent[1].codes,['KRW-BTC','KRW-USDT']);
assert.equal(streams.healthy('upbit'),false);up.data({type:'ticker',code:'KRW-BTC',trade_price:20,trade_timestamp:at},true);assert.equal(streams.healthy('upbit'),true);assert.equal(events.at(-1)[1][0].market,'KRW-BTC');
streams.start('upbit',['KRW-BTC']);assert.equal(sockets.length,2);console.log('PASS subscription, binary decoding, rate spacing and duplicate prevention');
up.close();const count=sockets.length;advance(14999);assert.equal(sockets.length,count);advance(1);assert.equal(sockets.length,count+1);assert.equal(streams.canPoll('upbit'),false);console.log('PASS reconnect backoff and REST/connection shared gate');
streams.start('bithumb',['KRW-ETH']);const bt=sockets.at(-1);assert.ok(bt.url.includes('ws-api.bithumb'));bt.open();bt.data({type:'ticker',code:'KRW-ETH',trade_price:2,trade_timestamp:at});assert.equal(streams.healthy('bithumb'),true);assert.equal(streams.healthy('upbit'),false);console.log('PASS venue switch closes old stream');
streams.stop();assert.equal(timers.size,0);assert.ok(sockets.every(x=>x.readyState===3));const before=events.length;up.data({type:'ticker',code:'KRW-BTC',trade_price:99});assert.equal(events.length,before);console.log('PASS stop closes sockets and rejects late data');
streams.start('bithumb',['KRW-ETH']);advance(12000);const last=sockets.at(-1);last.open();advance(60000);assert.equal(last.readyState,3);streams.stop();assert.equal(timers.size,0);console.log('PASS silent socket watchdog');
