const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'btc-long-channel.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const store=new Map(),context={window:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};
vm.createContext(context);vm.runInContext(source,context);const api=context.window.BtcLongChannel;
function make(){const objects=[];return {objects,timeScale:()=>({timeToCoordinate:t=>100+(t-1668988800)/86400*10}),addLineSeries(options){const s={options,data:[],attachPrimitive(p){this.primitive=p;p.attached({requestUpdate:()=>{}});},priceToCoordinate:p=>100-p/1000,setData(d){this.data=Array.from(d);},applyOptions(o){Object.assign(this.options,o);},update(p){const last=this.data.at(-1);assert(!last||p.time>=last.time,'out-of-order update');if(last?.time===p.time)this.data[this.data.length-1]=p;else this.data.push(p);}};objects.push(s);return s;}};}
let tests=0;function test(name,f){f();tests++;console.log('PASS',name);}
test('SVG와 같은 두 저점과 고점을 지난다',()=>{
 assert(Math.abs(api.valueAt(api.A.time,0)-api.A.price)<1e-8);
 assert(Math.abs(api.valueAt(api.B.time,0)-api.B.price)<1e-8);
 assert(Math.abs(api.valueAt(api.H.time,4)-api.H.price)<1e-8);
 assert(Math.abs(api.slope-8.543509015256587)<1e-10);
 assert(Math.abs(api.step-14188.361601941748)<1e-9);
});
test('13개 평행선은 날짜 좌표를 사용하고 가격축 자동확대를 하지 않는다',()=>{
 const chart=make(),s=api.attach(chart);assert.equal(s.series.length,13);
 s.series.forEach(x=>{assert.equal(x.options.autoscaleInfoProvider(),null);assert.equal(x.options.priceScaleId,'right');assert.equal(x.options.lastValueVisible,false);});
 const t=Date.UTC(2026,9,10)/1000;api.offsets.forEach(k=>assert(Math.abs(api.valueAt(t+86400,k)-api.valueAt(t,k)-api.slope)<1e-8));
});
test('캔들 시각만 시딩하며 중복/잘못된 시각은 제거한다',()=>{
 const s=api.attach(make()),t=Date.UTC(2026,9,10)/1000;api.seed(s,[t+60,t,NaN,t,-1]);
 s.series.forEach(x=>assert.deepEqual(x.data.map(p=>p.time),[t,t+60]));
});
test('진행봉 반복 갱신은 같은 시각이며 새 봉만 추가한다',()=>{
 const s=api.attach(make()),t=Date.UTC(2026,9,10)/1000;api.seed(s,[t]);api.tick(s,t);api.tick(s,t);
 s.series.forEach(x=>assert.equal(x.data.length,1));api.tick(s,t+60);s.series.forEach(x=>assert.equal(x.data.length,2));
 api.tick(s,t);api.tick(s,NaN);s.series.forEach(x=>assert.equal(x.data.length,2));
});
test('이전 OFF 설정과 관계없이 빗각을 항상 표시한다',()=>{
 store.set('tapeBtcLongChannel','off');const s=api.attach(make()),t=Date.UTC(2026,9,10)/1000;
 api.seed(s,[t]);s.series.forEach(x=>{assert.equal(x.options.visible,true);assert.equal(x.data.length,1);});
 assert(!source.includes('localStorage'));assert.equal(api.setEnabled,undefined);
});
test('시간봉 전환은 옛 시각을 지운 뒤 다시 시딩한다',()=>{
 const s=api.attach(make()),t=Date.UTC(2026,9,10)/1000;api.seed(s,[t]);api.clear(s);assert.equal(s.lastTime,null);s.series.forEach(x=>assert.equal(x.data.length,0));
 api.seed(s,[t-86400,t]);s.series.forEach(x=>assert.equal(x.data.length,2));
});
test('BTC만 연결되고 실시간/시간봉 전환 훅이 존재한다',()=>{
 assert(html.includes("elId === 'c_btc'"));assert(html.includes('BtcLongChannel.seed(chart.longChannel'));
 assert(html.includes('BtcLongChannel.tick(chart.longChannel,k.t/1000)'));assert(html.includes('BtcLongChannel.clear(chart.longChannel)'));
 assert.equal((html.match(/data-analysis-open/g)||[]).length,0);
 assert(!/btcLongWeekly|btcLongToggle|btcLongHint|btc-long-tools/.test(html));
});
test('가격조회·주문·DB 호출을 추가하지 않는다',()=>{
 assert(!/\bfetch\s*\(|new WebSocket|\.rpc\s*\(|\b(?:sbc|supabase)\.from\s*\(/.test(source));
});
test('미래 선은 오른쪽 끝까지 이어지고 캔들 시각을 추가하지 않는다',()=>{
 const s=api.attach(make()),t=api.B.time;api.seed(s,[t-86400,t],'1d');
 const points=api.rayPoints(s,300);assert.equal(points[0].x,100);assert.equal(points.at(-1).x,300);assert.equal(points.at(-1).time,t+20*86400);
 s.series.forEach(x=>assert(x.data.every(p=>p.time<=t)));assert.equal(s.primitive.autoscaleInfo(),null);
 let strokes=0;const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},stroke(){strokes++;}};
 s.primitive.paneViews()[0].renderer().draw({useMediaCoordinateSpace:f=>f({context:ctx,mediaSize:{width:300,height:400}})});assert.equal(strokes,13);
 api.clear(s);assert.equal(api.rayPoints(s,300).length,0);
});
test('월봉 미래 좌표는 30일 고정이 아니라 실제 달력을 따른다',()=>{
 const s=api.attach(make()),t=Date.UTC(2026,0,1)/1000;api.seed(s,[Date.UTC(2025,11,1)/1000,t],'1M');
 assert.equal(api.futureTime(s,1),Date.UTC(2026,1,1)/1000);assert.equal(api.futureTime(s,2),Date.UTC(2026,2,1)/1000);
});
console.log(tests+' BTC channel checks passed');
