/* Public ticker streams; injectable transport and clock for deterministic tests. */
(function(root){
'use strict';
function normalize(kind,d){
 if(kind==='binance')return Array.isArray(d)?d.filter(x=>/^[A-Z0-9]+USDT$/.test(x.s)&&Number(x.c)>0).map(x=>({symbol:x.s.slice(0,-4),lastPrice:x.c,openPrice:x.o,highPrice:x.h,lowPrice:x.l,quoteVolume:x.q,closeTime:x.E})):[];
 if(d?.type!=='ticker'||!/^KRW-[A-Z0-9]+$/.test(d.code)||!(Number(d.trade_price)>0))return [];
 return [{...d,market:d.code}];
}
function createStreams({onData,onState=()=>{},WebSocket:WS=root.WebSocket,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 const slots={};const gate={};let running=false;
 function cancel(s){if(!s)return;clearTimer(s.timer);clearTimer(s.watch);if(s.ws){s.ws.onclose=s.ws.onmessage=s.ws.onerror=s.ws.onopen=null;s.ws.close();}s.ws=null;}
 function connect(kind,s){
  if(!running||slots[kind]!==s||!WS)return;
  const wait=Math.max(0,(gate[kind]||0)+12000-now());
  if(wait){s.timer=setTimer(()=>connect(kind,s),wait);return;}
  gate[kind]=now();s.last=now();s.received=false;onState(kind,false);
  let ws;try{ws=new WS(kind==='binance'?'wss://stream.binance.com:9443/ws/!miniTicker@arr':kind==='upbit'?'wss://api.upbit.com/websocket/v1':'wss://ws-api.bithumb.com/websocket/v1');}catch{retry();return;}
  s.ws=ws;ws.binaryType='arraybuffer';
  function retry(){if(!running||slots[kind]!==s)return;cancel(s);onState(kind,false);s.failures++;s.timer=setTimer(()=>connect(kind,s),Math.min(60000,15000*2**Math.min(s.failures-1,2)));}
  ws.onopen=()=>{if(slots[kind]!==s||s.ws!==ws)return;if(kind!=='binance')ws.send(JSON.stringify([{ticket:'tape-domestic-'+now()},{type:'ticker',codes:s.codes},{format:'DEFAULT'}]));};
  ws.onmessage=e=>{if(slots[kind]!==s||!running||s.ws!==ws)return;try{const d=JSON.parse(typeof e.data==='string'?e.data:new TextDecoder().decode(e.data));const rows=normalize(kind,d);if(rows.length){s.last=now();s.received=true;s.failures=0;onState(kind,true);onData(kind,rows);}}catch{}};
  ws.onclose=retry;ws.onerror=()=>{if(s.ws===ws)ws.close();};
  function watch(){if(!running||slots[kind]!==s)return;if(now()-s.last>45000){retry();return;}s.watch=setTimer(watch,10000);}s.watch=setTimer(watch,10000);
 }
 return {
  /* 연결 시도 직후 12초는 REST 조회를 거른다 — 웹소켓이 먼저 채울 기회를 준다. 반대로 REST 조회는
     연결을 늦추지 않는다: 늦추면 탭을 다시 열 때마다 실시간 수신이 12초씩 밀린다. */
  canPoll(kind){return !(gate[kind]&&now()-gate[kind]<12000);},
  start(venue,codes,withBinance=true){running=true;const keep=withBinance?[venue,'binance']:[venue];
   for(const k of Object.keys(slots))if(!keep.includes(k)){cancel(slots[k]);delete slots[k];onState(k,false);}
   for(const k of keep){if(slots[k]||(k!=='binance'&&!codes.length))continue;const s={codes:[...codes],failures:0,last:0};slots[k]=s;connect(k,s);}},
  healthy(kind){const s=slots[kind];return !!(s?.ws?.readyState===1&&now()-s.last<45000&&s.received);},
  stop(){running=false;for(const k of Object.keys(slots)){cancel(slots[k]);delete slots[k];onState(k,false);}}
 };
}
const api={normalize,createStreams};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DomesticStreams=api;
})(typeof window!=='undefined'?window:globalThis);
