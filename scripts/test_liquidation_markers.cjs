// 라운지 차트의 청산 마커. 브라우저 없이 index.html 에서 함수만 떼어내 검사한다.
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const src=html.slice(html.indexOf('function snapToBar('), html.indexOf('function appendHydratedLiqBlock('));
const renderSrc=html.slice(html.indexOf('const MARKER_LABEL_PX'), html.indexOf('// 확대·이동하면 들어갈 수 있는 라벨 수가 달라지므로'));
assert.ok(src.includes('rebuildLiquidationMarkers'),'대상 함수를 찾지 못했다');
assert.ok(!html.includes('liquidationBucketTime'),'초 단위로 직접 나누던 옛 버킷 계산은 남아 있으면 안 된다');

let tests=0; const test=(label,fn)=>{fn();tests++;console.log('PASS',label);};
const HOUR=3600000, now=Date.parse('2026-09-12T03:30:00Z');
// 시간대별 캔들 1000개 (바이낸스 klines 형식: [openTime(ms), ...])
// 마지막 봉은 아직 형성 중 — 봉 시작은 현재보다 조금 과거다
const bars=step=>{const last=now-Math.floor(step*0.9);return Array.from({length:1000},(_,i)=>[last-(999-i)*step,'1','1','1','1']);};
const MONTH=[Date.UTC(2026,5,1),Date.UTC(2026,6,1),Date.UTC(2026,7,1),Date.UTC(2026,8,1)].map(t=>[t,'1','1','1','1']);

function run(barArray,rows){
  const ctx={chartSeed:[barArray],marketEventRows:new Map(rows.map((r,i)=>[i,r])),Date,Math,Array,
    moneyShort:v=>'$'+Math.round(v/1000)+'K',liquidationMarkers:null};
  vm.createContext(ctx); vm.runInContext(src+'\nrebuildLiquidationMarkers();',ctx);
  return ctx.liquidationMarkers;
}
const liq=(minutesAgo,long,short)=>({event_type:'liquidation',
  event_time:new Date(now-minutesAgo*60000).toISOString(),metadata:{long_usd:long,short_usd:short}});

test('마커 시각은 반드시 실제 캔들 시각이다 — 모든 시간대',()=>{
 const rows=Array.from({length:40},(_,i)=>liq(i*30+1,1000*(i+1),500));
 for(const [name,bar] of [['1분',bars(60000)],['15분',bars(900000)],['1시간',bars(HOUR)],['4시간',bars(4*HOUR)],['일봉',bars(24*HOUR)],['주봉',bars(7*24*HOUR)],['월봉',MONTH]]){
  const out=run(bar,rows);
  const times=new Set(bar.map(b=>b[0]/1000));
  assert.ok(out.length>0,name+': 마커가 하나도 없다');
  for(const m of out)assert.ok(times.has(m.time),`${name}: ${m.time} 는 캔들에 없는 시각`);
  assert.equal(new Set(out.map(m=>m.time)).size,out.length,name+': 한 캔들에 마커가 겹쳤다');
  for(let i=1;i<out.length;i++)assert.ok(out[i].time>out[i-1].time,name+': 시간순이 아니다');
 }
});
test('주봉·월봉에서도 24시간 청산이 마지막 봉에 하나로 합쳐진다',()=>{
 const rows=[liq(60,100,0),liq(120,200,0),liq(180,0,300)];
 for(const [name,bar] of [['주봉',bars(7*24*HOUR)],['월봉',MONTH]]){
  const out=run(bar,rows);
  assert.equal(out.length,1,name);
  assert.equal(out[0].time,bar[bar.length-1][0]/1000,name+': 마지막 봉에 붙어야 한다');
 }
});
test('최근순이 아니라 큰 청산을 남기고, 캔들을 가리지 않는 선에서 넉넉히 보여 준다',()=>{
 // 1시간 차트에서 서로 다른 봉에 떨어지도록 61분씩 벌린다
 const rows=[liq(1400,9_000_000,0),...Array.from({length:20},(_,i)=>liq(i*61+1,1000*(i+1),0))];
 const out=run(bars(HOUR),rows);
 assert.equal(out.length,21,'21개 봉이면 21개 다 보여 준다');
 // 1시간 차트는 24시간 안에 봉이 24개뿐이라 상한은 1분 차트에서 확인한다
 const many=run(bars(60000),Array.from({length:40},(_,i)=>liq(i*5+1,1000*(i+1),0)));
 assert.equal(many.length,24,'상한은 24개');
 assert.ok(many.every(m=>+m.text.replace(/\D/g,'')>=17),'남은 24개는 작은 것이 아니라 금액이 큰 쪽이다');
 assert.ok(out.some(m=>m.text.includes('9000K')),'24시간 중 가장 큰 청산이 빠졌다');
 const span=out[out.length-1].time-out[0].time;
 assert.ok(span>=3600,'마커가 한곳에 몰려 있다: '+span+'초');
});
test('롱·숏에 따라 위아래와 색이 갈리고, 빈 버킷은 만들지 않는다',()=>{
 const up=run(bars(HOUR),[liq(30,0,50000)])[0];
 assert.equal(up.position,'belowBar'); assert.equal(up.color,'#4ade80'); assert.ok(up.text.startsWith('⚡'));
 const dn=run(bars(HOUR),[liq(30,50000,0)])[0];
 assert.equal(dn.position,'aboveBar'); assert.equal(dn.color,'#f87171'); assert.ok(dn.text.startsWith('🩸'));
 assert.equal(run(bars(HOUR),[liq(30,0,0)]).length,0,'금액 0 인 전표로 마커를 만들면 안 된다');
 assert.equal(run(bars(HOUR),[{event_type:'liquidation',event_time:new Date(now-30*60000).toISOString()}]).length,0,'metadata 없는 전표');
});
test('24시간 밖·캔들 시작 이전·차트 미준비는 조용히 건너뛴다',()=>{
 assert.equal(run(bars(HOUR),[liq(25*60,999,0)]).length,0,'24시간 밖');
 assert.equal(run(bars(60000),[liq(1000,999,0)]).length,0,'캔들 범위보다 과거');
 for(const bad of [null,[],undefined])assert.equal(run(bad,[liq(30,999,0)]).length,0,'차트가 아직 없을 때');
 assert.equal(run(bars(HOUR),[{event_type:'whale',event_time:new Date(now).toISOString(),metadata:{long_usd:1}}]).length,0,'청산이 아닌 전표');
});

// ── 확대·축소해도 마커가 사라지지 않는지 ──
function draw(pxPerBar, liqMarkers, whales){
  let drawn=null;
  const times=[...liqMarkers.map(m=>m.time), ...[...whales.values()].map(w=>Math.floor(w.time))];
  const first=Math.min(...times);
  const ctx={ chartOf:()=>({ ch:{ timeScale:()=>({ timeToCoordinate:t=>(t-first)/60*pxPerBar }) },
                              s:{ setMarkers:m=>{drawn=m;} } }),
    snapToBar:ms=>Math.floor(ms/1000), moneyShort:v=>'$'+Math.round(v/1000)+'K',
    liquidationMarkers:liqMarkers, whaleBuckets:whales, Map, Math, Set, Array };
  vm.createContext(ctx); vm.runInContext(renderSrc+'\nrenderBtcMarkers();',ctx);
  return drawn;
}
test('배율을 바꿔도 마커는 그대로 남고, 큰 금액의 숫자는 계속 보인다',()=>{
  const liq=[{time:1000,weight:9e8,text:'🩸 $900000K',shape:'circle'},
             {time:1060,weight:5e5,text:'🩸 $500K',shape:'circle'},
             {time:1120,weight:3e5,text:'🩸 $300K',shape:'circle'},
             {time:1180,weight:2e5,text:'🩸 $200K',shape:'circle'}];
  const whales=new Map([[1240,{time:1240,buy:4e5,sell:0,count:2}]]);
  const zoomOut=draw(1,liq,whales), zoomIn=draw(40,liq,whales);
  assert.equal(zoomOut.length,5,'축소해도 마커 개수는 그대로');
  assert.equal(zoomIn.length,5,'확대해도 마커 개수는 그대로');
  const big=m=>m.find(x=>x.text.includes('900000K'));
  assert.ok(big(zoomOut),'가장 큰 청산의 숫자는 축소해도 남는다');
  assert.ok(big(zoomIn),'확대해도 남는다');
  const labels=m=>m.filter(x=>x.text).length;
  assert.ok(labels(zoomIn)>=labels(zoomOut),'확대하면 숫자가 줄지 않고 늘어난다');
  assert.ok(labels(zoomIn)>labels(zoomOut),'확대했는데 더 보이지 않는다');
  assert.ok(zoomOut.every(m=>m.shape==='circle'),'점 자체는 항상 그린다');
  for(let i=1;i<zoomOut.length;i++)assert.ok(zoomOut[i].time>=zoomOut[i-1].time,'시간순');
});
test('고래도 실제 캔들에 붙어 모든 시간대에서 함께 그려진다',()=>{
  const out=draw(30,[{time:1000,weight:1e6,text:'🩸 $1000K',shape:'circle'}],
    new Map([[1300,{time:1300,buy:9e5,sell:1e5,count:3}]]));
  assert.equal(out.length,2,'청산과 고래가 함께 그려진다');
  const whale=out.find(m=>m.text.includes('🐋'));
  assert.ok(whale,'고래 마커가 없다');
  assert.equal(whale.time,1300,'고래도 실제 캔들 시각에 붙는다');
  assert.equal(whale.position,'belowBar'); assert.equal(whale.color,'#4ade80');
  assert.ok(whale.text.includes('×3'),'같은 캔들에 모인 건수를 적는다');
  const src2=fs.readFileSync(require.resolve('../index.html'),'utf8');
  assert.ok(!/chartPxPerBar|minTier/.test(src2),'배율로 마커를 숨기던 코드는 남아 있으면 안 된다');
  assert.ok(!/chartTf === '1m' \?/.test(src2),'고래를 1분봉에서만 그리던 조건도 없어야 한다');
});
console.log(tests+' liquidation marker checks passed');
