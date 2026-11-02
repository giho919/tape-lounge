const assert=require('node:assert/strict');
const daily=require('../blind-daily.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../blind-daily.js'),'utf8');
const shareSource=fs.readFileSync(path.join(__dirname,'../blind-daily-share.js'),'utf8');
const campaignSource=fs.readFileSync(path.join(__dirname,'../site-campaign.js'),'utf8');
const localized=lang=>{const window={document:{documentElement:{lang}}};vm.runInNewContext(source,{window,URL,URLSearchParams});return window.BlindDaily;};
const shareWindow={document:{documentElement:{lang:'ko'}}};
vm.runInNewContext(campaignSource,{window:shareWindow,URL,URLSearchParams});
shareWindow.BlindDaily=localized('ko');
vm.runInNewContext(shareSource,{window:shareWindow,document:shareWindow.document});
const shareCopy=lang=>shareWindow.TapeDailyShare.copyFor(lang);
const day='2026-10-31', chosen=daily.selection(day), DAY=86400000;
assert.deepEqual(chosen,{version:1,id:'v1-2026-10-31',day,symbol:'BNBUSDT',endTime:1711670399999},'v1 date links must remain reproducible');
assert.equal(daily.dayKey(new Date('2026-10-31T14:59:59Z')),'2026-10-31');
assert.equal(daily.dayKey(new Date('2026-10-31T15:00:00Z')),'2026-11-01');
for(const value of ['2026-02-30','2026-13-01','<script>','2026-1-01',null])assert.equal(daily.validDay(value),false);
for(const value of ['1','2020-01-01','2026-11-01','bad'])assert.equal(daily.requestedDay(value,day),day);
assert.equal(daily.requestedDay(day,'2026-11-01'),day);
assert.deepEqual(daily.selection(day),chosen);
assert.notDeepEqual(daily.selection('2026-11-01'),chosen);
assert.equal(localized('ko').url('2026-11-02',2),'https://tapelounge.com/blind/?daily=2026-11-02&v=2');
for(const lang of ['en','zh','ja'])assert.equal(localized(lang).url('2026-11-02',2),`https://tapelounge.com/${lang}/tools/blind/?daily=2026-11-02&v=2`);
assert.ok(localized('en').shareText(daily.selection('2026-11-02'),{roi:1,bh:2,completed:true,bankrupt:false},'en').includes('Completed 200 trading days'));
assert.ok(localized('en').shareText(daily.selection('2026-11-02'),{roi:1,bh:2,completed:true,bankrupt:false},'en').endsWith('https://tapelounge.com/en/tools/blind/?daily=2026-11-02&v=2'));
const cardCopyExpectations={
 ko:{round:'오늘의 판',complete:'200거래일 완주',early:'12거래일 중간 정산',duration:'200거래일 플레이 · 가상 자금 $10,000',returnLabel:'내 수익률',save:'이미지 저장'},
 en:{round:'Daily round',complete:'Completed 200 trading days',early:'12 trading days · settled early',duration:'200 trading days played · $10,000 virtual funds',returnLabel:'My return',save:'Save image'},
 zh:{round:'今日牌局',complete:'完成200个交易日',early:'12个交易日 · 提前结算',duration:'200个交易日模拟 · 虚拟资金 $10,000',returnLabel:'我的收益',save:'保存图片'},
 ja:{round:'今日の一局',complete:'200取引日完走',early:'12取引日・途中精算',duration:'200取引日プレイ · 仮想資金 $10,000',returnLabel:'自分のリターン',save:'画像を保存'},
};
for(const [lang,expected] of Object.entries(cardCopyExpectations)){
 const copy=shareCopy(lang);
 assert.equal(copy.round,expected.round,`${lang} result card title`);
 assert.equal(copy.status({completed:true,market:'stock'}),expected.complete,`${lang} completed status`);
 assert.equal(copy.status({completed:false,bankrupt:false,days:12,market:'stock'}),expected.early,`${lang} early status`);
 assert.equal(copy.status({completed:false,bankrupt:true,days:12,market:'stock'}),copy.bankrupt,`${lang} liquidation status`);
 assert.equal(copy.duration({days:200,market:'stock'}),expected.duration,`${lang} play duration`);
 assert.equal(copy.returnLabel,expected.returnLabel,`${lang} return label`);
 assert.equal(copy.saveButton,expected.save,`${lang} save button`);
 assert.ok(copy.cardFailed,`${lang} image error must be localized`);
 assert.ok(copy.dialogNote&&!/[가-힣]/.test(copy.dialogNote)||lang==='ko',`${lang} share note must be localized`);
 shareWindow.document.documentElement.lang=lang;shareWindow.BlindDaily=localized(lang);
 const path=lang==='ko'?'/blind/':`/${lang}/tools/blind/`;
 assert.equal(shareWindow.TapeDailyShare.shareUrlFor({day:'2026-11-02',version:2}),`https://tapelounge.com${path}?daily=2026-11-02&v=2&utm_source=share&utm_medium=referral&utm_campaign=daily_blind`,`${lang} result image link attribution`);
}
shareWindow.document.documentElement.lang='ko';shareWindow.BlindDaily=localized('ko');
assert.equal(shareWindow.TapeDailyShare.shareUrlFor({day:'2026-10-31',version:1}),'https://tapelounge.com/blind/?daily=2026-10-31&utm_source=share&utm_medium=referral&utm_campaign=daily_blind','crypto result image link attribution');
const shareVersion=crypto.createHash('sha256').update(shareSource).digest('hex').slice(0,12),htmlFiles=[];
const collectHtml=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())collectHtml(full);else if(entry.isFile()&&entry.name.endsWith('.html'))htmlFiles.push(full);}};
collectHtml(path.resolve(__dirname,'..'));
const sharePages=htmlFiles.map(file=>({file,html:fs.readFileSync(file,'utf8')})).filter(page=>page.html.includes('blind-daily-share.js?v='));
assert.ok(sharePages.length>=30,'generated pages loading the daily result card were not all found');
for(const page of sharePages)assert.ok(page.html.includes(`blind-daily-share.js?v=${shareVersion}`),`${path.relative(path.resolve(__dirname,'..'),page.file)} loads a stale result-card script`);
assert.ok(chosen.endTime<Date.parse('2026-01-01T00:00:00Z'));
const bars=Array.from({length:1000},(_,i)=>{const t=chosen.endTime-DAY+1-(999-i)*DAY;return[t,'100','110','90','105','20',t+DAY-1];});
assert.equal(daily.validate(bars,chosen),bars);
for(const mutate of [a=>a.pop(),a=>{a[6][0]++;},a=>{a[5][4]='111';},a=>{a[2][1]='NaN';},a=>{a[4][5]='-1';},a=>{a[3][6]++;}]){
 const bad=structuredClone(bars);mutate(bad);assert.throws(()=>daily.validate(bad,chosen));
}
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const progress={schema:1,day,roundVersion:1,symbol:chosen.symbol,dayIndex:8,wallet:9500,pos:{side:'long',qty:2,entry:100,margin:200,lev:2},trades:[{day:2,side:'BUY',intent:'LONG',px:100,amt:200,fee:.2,lev:2}],speed:2,orderPct:25,leverage:2,elapsedMs:32000};
assert.equal(daily.writeProgress(storage,progress),true);
assert.deepEqual(daily.readProgress(storage,day,1),progress,'valid in-progress decisions and position survive local reload');
assert.equal(daily.writeProgress(storage,{...progress,dayIndex:200}),false,'completed rounds cannot be kept as resumable progress');
assert.equal(daily.writeProgress(storage,{...progress,symbol:'ETHUSDT'}),false,'a saved round cannot change its hidden symbol');
assert.equal(daily.clearProgress(storage,day,1),true);assert.equal(daily.readProgress(storage,day,1),null);
const stockProgress={schema:1,day:'2026-11-02',roundVersion:2,symbol:'AAPL',dayIndex:12,wallet:10000,pos:null,trades:[],speed:2,orderPct:25,leverage:1,elapsedMs:24000};
assert.equal(daily.writeProgress(storage,stockProgress),true);assert.deepEqual(daily.readProgress(storage,stockProgress.day,2),stockProgress,'stock rounds keep a valid local resume checkpoint');
assert.equal(daily.writeProgress(storage,{...stockProgress,symbol:'UNKNOWN'}),false,'a stock checkpoint must use a bundled symbol');
assert.equal(daily.clearProgress(storage,stockProgress.day,2),true);
assert.equal(daily.writeProgress({setItem(){throw Error('quota');}},progress),false,'storage failure does not break the game');
const result={roi:0,bh:5.25,completed:true,finishedAt:'2026-10-31T08:00:00Z'};
assert.deepEqual(daily.record(storage,day,{...result,completed:false}),{saved:false,first:null,streak:{days:0,playedToday:false,lastDay:null}});
assert.equal(daily.read(storage).length,0);
assert.equal(daily.record(storage,day,result).saved,true);
assert.equal(daily.record(storage,day,{...result,roi:99}).saved,false);
assert.equal(daily.read(storage)[0].roi,0,'retries cannot replace the first completed result');
assert.deepEqual(daily.record({getItem(){throw Error('denied');},setItem(){throw Error('denied');}},day,result),{saved:false,first:null,streak:{days:0,playedToday:false,lastDay:null}});
assert.deepEqual(daily.read({getItem:()=>'{broken'}),[]);
for(let i=0;i<35;i++)daily.record(storage,new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10),result);
assert.equal(daily.read(storage).length,30);
const shared=daily.shareText(chosen,{...result,days:200});
assert.ok(shared.includes('200일 완주'));assert.ok(shared.includes('과거 차트 모의 연습'));
assert.equal(shared.split('\n').at(-1),'https://tapelounge.com/blind/?daily=2026-10-31');
assert.ok(daily.shareText(chosen,{...result,completed:false,days:12}).includes('12일 중간 정산'));
assert.ok(daily.shareText(chosen,{...result,completed:false,bankrupt:true,days:12}).includes('파산 정산'));
console.log(JSON.stringify({selection:chosen}));
console.log('Daily blind: fixed historical selection, KST rollover, full-candle validation, resume checkpoint validation, first-completion storage, retention cap and clean share text passed.');
