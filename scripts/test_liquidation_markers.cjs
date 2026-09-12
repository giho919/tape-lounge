// 라운지 차트의 청산·고래 마커. 브라우저 없이 index.html 에서 함수만 떼어내 검사한다.
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const src=html.slice(html.indexOf('function snapToBar('), html.indexOf('\nfunction appendHydratedLiqBlock('));
const renderSrc=html.slice(html.indexOf('const MARKER_LABEL_PX'), html.indexOf('// 확대·이동하면 들어갈 수 있는 라벨 수가 달라지므로'));
assert.ok(src.includes('rebuildLiquidationMarkers')&&renderSrc.includes('renderBtcMarkers'),'대상 함수를 찾지 못했다');
assert.ok(!html.includes('liquidationBucketTime'),'초 단위로 직접 나누던 옛 버킷 계산은 남아 있으면 안 된다');
assert.ok(!/chartPxPerBar|minTier/.test(html),'배율로 마커를 숨기던 코드는 남아 있으면 안 된다');

let tests=0; const test=(label,fn)=>{fn();tests++;console.log('PASS',label);};
const HOUR=3600000, DAY=24*HOUR, now=Date.parse('2026-09-12T03:30:00Z');
const MIN_USD=+src.match(/MARKER_MIN_USD\s*=\s*(\d+)/)[1];
assert.ok(MIN_USD>=1e6,'표시 기준이 너무 낮다');
// 마지막 봉은 아직 형성 중 — 봉 시작은 현재보다 조금 과거다
const bars=step=>{const last=now-Math.floor(step*0.9);return Array.from({length:1000},(_,i)=>[last-(999-i)*step,'1','1','1','1']);};
const MONTH=[Date.UTC(2026,5,1),Date.UTC(2026,6,1),Date.UTC(2026,7,1),Date.UTC(2026,8,1)].map(t=>[t,'1','1','1','1']);
const big=MIN_USD*1.2;
const liq=(minutesAgo,long,short=0)=>({event_type:'liquidation',
  event_time:new Date(now-minutesAgo*60000).toISOString(),metadata:{long_usd:long,short_usd:short}});

function run(barArray,rows){
  const ctx={chartSeed:[barArray],Date,Math,Array,Map,moneyShort:v=>'$'+Math.round(v/1000)+'K',liquidationMarkers:null};
  vm.createContext(ctx);
  vm.runInContext(src+'\n'+rows.map((r,i)=>`recordLiquidationForChart(${JSON.stringify({...r,event_key:'k'+i})});`).join('\n')
    +'\nrebuildLiquidationMarkers();',ctx);
  return ctx.liquidationMarkers;
}

test('마커 시각은 반드시 실제 캔들 시각이고, 한 캔들에 겹치지 않는다',()=>{
 const rows=Array.from({length:40},(_,i)=>liq(i*30+1,big));
 for(const [name,bar] of [['1분',bars(60000)],['15분',bars(900000)],['1시간',bars(HOUR)],['4시간',bars(4*HOUR)],['일봉',bars(DAY)],['주봉',bars(7*DAY)],['월봉',MONTH]]){
  const out=run(bar,rows), times=new Set(bar.map(b=>b[0]/1000));
  assert.ok(out.length>0,name+': 마커가 하나도 없다');
  for(const m of out)assert.ok(times.has(m.time),`${name}: ${m.time} 는 캔들에 없는 시각`);
  assert.equal(new Set(out.map(m=>m.time)).size,out.length,name+': 한 캔들에 마커가 겹쳤다');
  for(let i=1;i<out.length;i++)assert.ok(out[i].time>out[i-1].time,name+': 시간순이 아니다');
 }
});
test('개수 제한 없이 과거까지 — 24시간 넘는 기록도 그대로 찍는다',()=>{
 const rows=Array.from({length:120},(_,i)=>liq(i*240+1,big));   // 20일치, 4시간 간격
 const out=run(bars(4*HOUR),rows);
 assert.equal(out.length,120,'개수를 자르면 안 된다');
 const oldest=(now-119*240*60000)/1000;
 assert.ok(out[0].time<=oldest+4*3600,'20일 전 기록이 빠졌다');
 assert.ok(!/slice\(0,\s*\d+\)/.test(src),'상한을 두는 slice 가 남아 있다');
 assert.ok(!/cutoff/.test(src),'24시간 컷오프가 남아 있다');
});
test('기준 미만은 찍지 않고, 같은 캔들에 모이면 합산해서 넘길 수 있다',()=>{
 assert.equal(run(bars(HOUR),[liq(30,MIN_USD-1)]).length,0,'기준 미만');
 assert.equal(run(bars(HOUR),[liq(30,MIN_USD)]).length,1,'기준과 같으면 찍는다');
 const half=MIN_USD*0.6;
 assert.equal(run(bars(HOUR),[liq(30,half)]).length,0);
 assert.equal(run(bars(HOUR),[liq(30,half),liq(35,half)]).length,1,'같은 봉에 모이면 합산');
 assert.equal(run(bars(60000),[liq(30,half),liq(35,half)]).length,0,'다른 봉이면 각각 기준 미달');
});
test('주봉·월봉에서도 청산이 마지막 봉에 하나로 합쳐진다',()=>{
 const rows=[liq(60,big),liq(120,big),liq(180,0,big)];
 for(const [name,bar] of [['주봉',bars(7*DAY)],['월봉',MONTH]]){
  const out=run(bar,rows);
  assert.equal(out.length,1,name);
  assert.equal(out[0].time,bar[bar.length-1][0]/1000,name+': 마지막 봉에 붙어야 한다');
 }
});
test('롱·숏에 따라 위아래와 색이 갈리고, 값이 없는 전표는 버린다',()=>{
 const up=run(bars(HOUR),[liq(30,0,big)])[0];
 assert.equal(up.position,'belowBar'); assert.equal(up.color,'#4ade80'); assert.ok(up.text.startsWith('⚡'));
 const dn=run(bars(HOUR),[liq(30,big)])[0];
 assert.equal(dn.position,'aboveBar'); assert.equal(dn.color,'#f87171'); assert.ok(dn.text.startsWith('🩸'));
 assert.equal(run(bars(HOUR),[liq(30,0,0)]).length,0,'금액 0');
 assert.equal(run(bars(HOUR),[{event_type:'liquidation',event_time:new Date(now).toISOString()}]).length,0,'metadata 없음');
 assert.equal(run(bars(HOUR),[{event_type:'whale',event_time:new Date(now).toISOString(),metadata:{long_usd:big}}]).length,0,'청산 아님');
});
test('캔들 시작 이전·차트 미준비는 조용히 건너뛴다',()=>{
 assert.equal(run(bars(60000),[liq(5000,big)]).length,0,'캔들 범위보다 과거');
 for(const bad of [null,[],undefined])assert.equal(run(bad,[liq(30,big)]).length,0,'차트가 아직 없을 때');
});

// ── 확대·축소해도 마커가 사라지지 않는지 ──
function draw(pxPerBar, liqMarkers, whales, ledger=new Map(), macro=[]){
  let drawn=null;
  const first=Math.min(...liqMarkers.map(m=>m.time), ...[...whales.values()].map(w=>w.time), ...macro.map(m=>m.time));
  const ctx={ chartOf:()=>({ ch:{ timeScale:()=>({ timeToCoordinate:t=>(t-first)/60*pxPerBar }) }, s:{ setMarkers:m=>{drawn=m;} } }),
    snapToBar:ms=>Math.floor(ms/1000), moneyShort:v=>'$'+Math.round(v/1000)+'K',
    liquidationMarkers:liqMarkers, whaleBuckets:whales, whaleLedger:ledger, macroMarkers:macro, Map, Math, Set, Array };
  vm.createContext(ctx); vm.runInContext(renderSrc+'\nrenderBtcMarkers();',ctx);
  return drawn;
}
test('배율을 바꿔도 마커는 그대로 남고, 큰 금액의 숫자는 계속 보인다',()=>{
  const liqM=[{time:1000,weight:9e8,text:'🩸 $900000K',shape:'circle'},
              {time:1060,weight:5e5,text:'🩸 $500K',shape:'circle'},
              {time:1120,weight:3e5,text:'🩸 $300K',shape:'circle'},
              {time:1180,weight:2e5,text:'🩸 $200K',shape:'circle'}];
  const whales=new Map([[1240,{time:1240,buy:4e5,sell:0,count:2}]]);
  const zoomOut=draw(1,liqM,whales), zoomIn=draw(40,liqM,whales);
  assert.equal(zoomOut.length,5,'축소해도 마커 개수는 그대로');
  assert.equal(zoomIn.length,5,'확대해도 마커 개수는 그대로');
  const biggest=m=>m.find(x=>x.text.includes('900000K'));
  assert.ok(biggest(zoomOut)&&biggest(zoomIn),'가장 큰 청산의 숫자는 어느 배율에서도 남는다');
  const labels=m=>m.filter(x=>x.text).length;
  assert.ok(labels(zoomIn)>labels(zoomOut),'확대하면 숫자가 더 보여야 한다');
  assert.ok(zoomOut.every(m=>m.shape==='circle'),'점 자체는 항상 그린다');
});
test('고래도 실제 캔들에 붙어 모든 시간대에서 함께 그려진다',()=>{
  const out=draw(30,[{time:1000,weight:1e6,text:'🩸 $1000K',shape:'circle'}],
    new Map([[1300,{time:1300,buy:9e5,sell:1e5,count:3}]]));
  assert.equal(out.length,2,'청산과 고래가 함께 그려진다');
  const whale=out.find(m=>m.text.includes('🐋'));
  assert.ok(whale); assert.equal(whale.time,1300,'고래도 실제 캔들 시각에 붙는다');
  assert.equal(whale.position,'belowBar'); assert.equal(whale.color,'#4ade80');
  assert.ok(whale.text.includes('×3'),'같은 캔들에 모인 건수를 적는다');
  assert.ok(!/chartTf === '1m' \?/.test(html),'고래를 1분봉에서만 그리던 조건도 없어야 한다');
});
test('차트용 청산 장부는 하이라이트와 분리돼 24시간 정리에 지워지지 않는다',()=>{
  assert.ok(/liquidationLedger/.test(html),'전용 장부가 없다');
  assert.ok(!/rebuildLiquidationMarkers[\s\S]{0,400}marketEventRows/.test(src),'마커가 24시간짜리 marketEventRows 를 다시 참조한다');
  assert.ok(/loadLiquidationLedger[\s\S]{0,600}gte\('amount_usd', MARKER_ROW_FLOOR\)/.test(html),'작은 전표를 서버에서 걸러야 한다');
  assert.ok(/MARKER_HISTORY_DAYS \* 86400000/.test(html),'24시간이 아니라 여러 날을 받아야 한다');
});

// ── 지표 발표 ──
function macroRun(barArray, events){
  // src 안에 let macroMarkers 선언이 있어 컨텍스트 속성에 안 잡힌다 — 완료값으로 받는다
  const ctx={chartSeed:[barArray],macroData:{events},Date,Math,Array,Map,Number};
  vm.createContext(ctx);
  return vm.runInContext(src+'\nrebuildMacroMarkers(); macroMarkers;',ctx);
}
const ev=(minutesAgo,code,importance,btc)=>({code,importance,title:code,
  scheduled_at:new Date(now-minutesAgo*60000).toISOString(),btc:btc||{}});

test('지표 발표는 관측된 VIP·MAIN 만 찍고, 라벨에 발표 후 BTC 움직임을 적는다',()=>{
  const out=macroRun(bars(HOUR),[
    ev(120,'CPI','VIP',{m5:0.07,m15:0.643,m60:0.56}),
    ev(300,'PPI','MAIN',{m5:-0.547,m15:-0.857,m60:-1.109}),
    ev(400,'TRADE','SIDE',{m60:9}),
    ev(-600,'FOMC','VIP'),                     // 아직 안 온 발표
  ]);
  assert.equal(out.length,2,'SIDE 와 미래 일정은 빼야 한다');
  const cpi=out.find(m=>m.text.includes('CPI'));
  assert.ok(cpi.text.includes('+0.56%'),'60분 움직임을 쓴다: '+cpi.text);
  assert.ok(out.find(m=>m.text.includes('PPI')).text.includes('-1.11%'));
  assert.ok(out.every(m=>m.shape==='square'&&m.color==='#d4af37'),'청산·고래와 구분되는 모양·색');
  assert.ok(out.every(m=>m.weight>1e10),'청산 금액보다 앞서 라벨을 받는다');
  const times=new Set(bars(HOUR).map(b=>b[0]/1000));
  for(const m of out)assert.ok(times.has(m.time),'실제 캔들 시각에 붙는다');
  assert.equal(macroRun(bars(HOUR),[ev(120,'CPI','VIP')])[0].text,'📅 CPI','움직임을 모르면 이름만');
  for(const bad of [null,undefined,{},{events:'x'}])
    assert.equal(vm.runInNewContext(src+'\nrebuildMacroMarkers(); macroMarkers.length;',
      {chartSeed:[bars(HOUR)],macroData:bad,Date,Math,Array,Map,Number}),0,'달력이 없어도 죽지 않는다');
});
test('지표 발표는 청산을 밀어내지 않고 함께, 라벨은 발표가 먼저 가져간다',()=>{
  const macro=[{time:1000,weight:4e12,text:'📅 CPI +0.56%',shape:'square',color:'#d4af37',position:'aboveBar'}];
  const liqM=[{time:1002,weight:6e9,text:'🩸 $6000000K',shape:'circle'}];
  const out=draw(1,liqM,new Map(),new Map(),macro);
  assert.equal(out.length,2,'둘 다 그린다');
  assert.ok(out.find(m=>m.text.includes('CPI')),'좁아도 발표 라벨은 남는다');
  assert.equal(out.find(m=>m.shape==='circle').text,'','같은 자리라 청산 라벨은 양보');
});
test('고래는 접속 전 기록과 접속 중 기록을 같은 캔들에서 합친다',()=>{
  const out=draw(30,[],new Map([[1000,{time:1000,buy:2e5,sell:0,count:1}]]),
    new Map([['w1',{at:1000*1000,usd:3e5,buy:true}],['w2',{at:1000*1000,usd:1e5,buy:false}]]));
  assert.equal(out.length,1,'한 캔들에 하나로 합쳐진다');
  assert.ok(out[0].text.includes('×3'),'건수는 3건: '+out[0].text);
  assert.ok(out[0].text.includes('600K'),'금액은 60만: '+out[0].text);
  assert.equal(out[0].position,'belowBar','매수가 더 많으면 아래');
  const sellHeavy=draw(30,[],new Map(),new Map([['w1',{at:1000*1000,usd:9e5,buy:false}]]));
  assert.equal(sellHeavy[0].position,'aboveBar'); assert.equal(sellHeavy[0].color,'#f87171');
});
test('두 정책과 두 조회가 실제로 배선돼 있다',()=>{
  assert.ok(/loadWhaleLedger[\s\S]{0,400}eq\('event_type','whale'\)/.test(html),'고래 이력 조회 없음');
  assert.ok(/loadMacroMarkers[\s\S]{0,300}macroLoad\(\)/.test(html),'발표장과 같은 파일을 쓰지 않는다');
  assert.ok(/loadWhaleLedger\(\); loadMacroMarkers\(\);/.test(html),'적재가 호출되지 않는다');
  assert.ok(/rebuildMacroMarkers\(\);\n  renderBtcMarkers\(\);\n  connectChartWS/.test(html),'시간대 변경 시 발표 마커를 다시 스냅하지 않는다');
  assert.ok(/recordWhaleForChart\(row\)/.test(html),'실시간 고래가 장부에 안 들어간다');
});
console.log(tests+' liquidation marker checks passed');
