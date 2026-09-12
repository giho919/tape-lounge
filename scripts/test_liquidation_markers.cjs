// 라운지 차트의 청산 마커. 브라우저 없이 index.html 에서 함수만 떼어내 검사한다.
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const src=html.slice(html.indexOf('function snapToBar('), html.indexOf('function appendHydratedLiqBlock('));
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
test('최근순이 아니라 큰 청산 10개를 남긴다',()=>{
 // 1시간 차트에서 서로 다른 봉에 떨어지도록 61분씩 벌린다
 const rows=[liq(1400,9_000_000,0),...Array.from({length:20},(_,i)=>liq(i*61+1,1000*(i+1),0))];
 const out=run(bars(HOUR),rows);
 assert.equal(out.length,10);
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
console.log(tests+' liquidation marker checks passed');
