const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
function extract(start,end){return html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));}
const chat = extract("const feed = $('feed');","// 전략가 서신");
const people = extract("function nickColor(", "function chatWanted()");
const highlights = extract('let highlights = [];','function liquidationBucketTime(');
const bootstrap = [
  "const $=id=>document.getElementById(id);",
  "const esc=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML};",
  "let myNick='테스트',myUid='test-only',sbc=null;",
  "async function ensureAuth(){} function setNick(){}",
  "function setPit(p){$('pitTitle').textContent=p.title;$('pitCopy').textContent=p.copy;$('pitTag').textContent=p.tag;}",
  chat,people,highlights
].join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  for(const width of [1440,390,360]){
   const page=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>route.abort());
   await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));
   await page.addScriptTag({content:bootstrap});
   await page.evaluate(()=>{
    marketHistoryReady=true;
    ['liquidation','breakout','whale','macro','jackpot','candle'].forEach((type,i)=>marketEventRows.set('e'+i,{
     event_key:'e'+i,event_type:type,is_highlight:true,event_time:new Date(Date.now()-(i+1)*600000).toISOString(),
     icon:'◈',title:['롱 청산이 이어진 구간','최근 고점을 넘긴 순간','큰 현물 체결이 나온 장면','경제지표 발표 기록','청산 누적이 커진 구간','폭이 커진 확정봉'][i],
     detail:'격리된 UI 테스트 전표 · 실제 시장 기록으로 게시되지 않음',tone:'flat'}));
    marketEventRows.set('old',{event_key:'old',event_type:'whale',is_highlight:true,event_time:new Date(Date.now()-3*3600000).toISOString(),icon:'◈',title:'오래된 테스트',detail:'3시간 전',tone:'flat'});
    syncMarketHighlights();
   });
   assert.equal(await page.locator('.highlightRow').count(),7);
   await page.locator('[data-highlight-kind="whale"]').click();
   assert.equal(await page.locator('.highlightRow').count(),2);
   await page.selectOption('#highlightPeriod','1');
   assert.equal(await page.locator('.highlightRow').count(),1);
   await page.locator('.highlightRow').focus();await page.keyboard.press('Enter');
   assert.match(await page.locator('#pitTitle').textContent(),/큰 현물/);
   assert.equal(await page.locator('#pitTag').textContent(),'REPLAY');
   assert.match(await page.locator('#pitCopy').textContent(),/한국시간/);
   await page.evaluate(()=>{marketHistoryError=true;renderHighlights();});
   assert.match(await page.locator('#highlightStatus').textContent(),/연결 지연/);
   await page.evaluate(()=>{marketHistoryError=false;marketEventRows.clear();syncMarketHighlights();});
   assert.match(await page.locator('#highlightList').textContent(),/해당 전표가 없어요/);
   await page.evaluate(()=>{
    setHighlightKind('all');setHighlightWindow(24);
    for(let i=0;i<25;i++)marketEventRows.set('page'+i,{event_key:'page'+i,event_type:'breakout',is_highlight:true,event_time:new Date(Date.now()-i*60000).toISOString(),icon:'◈',title:'테스트 전표 '+i,detail:'UI 테스트',tone:'up'});
    syncMarketHighlights();
   });
   assert.equal(await page.locator('.highlightRow').count(),12);
   await page.locator('#highlightMore').click();assert.equal(await page.locator('.highlightRow').count(),24);
   await page.evaluate(()=>{
    for(let i=1;i<=60;i++)renderChatRow({id:i,nick:i%3?'참가자':'관망이',body:'UI 테스트 대화입니다. 새 메시지가 와도 읽던 자리를 지킵니다. '+i,
     author_type:i%3?'human':'virtual',agent_key:i%3?null:'watcher',created_at:new Date(Date.now()-i*60000).toISOString()});
    jumpToLatestChat();
   });
   assert.equal(await page.locator('#feed .msg').count(),60);
   assert.equal(await page.locator('#feed time').count(),60);
   assert.equal(await page.locator('#chatJump').isVisible(),false);
   await page.locator('#chatPanel').scrollIntoViewIfNeeded();
   const pos=await page.evaluate(()=>{
    feed.scrollTop=feed.scrollHeight/2;const before=chatViewport();
    renderChatRow({id:61,nick:'새 참가자',body:'새 메시지 테스트',author_type:'human',created_at:'2026-09-07T22:00:00Z'});
    const after=[...feed.children].find(n=>n.dataset.chatId===before.id);
    return {delta:after.getBoundingClientRect().top-feed.getBoundingClientRect().top-before.offset,atEnd:chatViewport().atEnd};
   });
   assert.ok(Math.abs(pos.delta)<2,JSON.stringify(pos));assert.equal(pos.atEnd,false);
   assert.equal(await page.locator('#chatJump').isVisible(),true);
   assert.match(await page.locator('[data-chat-id="61"] time').textContent(),/07:00$/);
   await page.locator('#chatJump').click();
   assert.equal(await page.locator('#chatJump').isVisible(),false);
   assert.ok(await page.evaluate(()=>feed.scrollHeight-feed.clientHeight-feed.scrollTop<2));
   await page.evaluate(async()=>{
    let release;sbc={from(){return {select(){return this},order(){return this},limit(){return new Promise(r=>release=r)}}}};
    const pending=loadChatHistory();
    renderChatRow({id:62,nick:'대기 중 도착',body:'이력 조회 중 도착한 대화',author_type:'human',created_at:new Date().toISOString()});
    release({data:[{id:61,nick:'이력',body:'서버에 남은 대화',author_type:'human',created_at:new Date().toISOString()}],error:null});
    await pending;
   });
   assert.deepEqual(await page.locator('#feed .msg').evaluateAll(xs=>xs.map(x=>x.dataset.chatId)),['61','62']);
   await page.evaluate(()=>renderChatRow({id:62,nick:'중복',body:'중복 메시지'}));
   assert.equal(await page.locator('#feed .msg').count(),2);
   await page.evaluate(()=>renderChatRow({id:63,nick:'<img src=x onerror=alert(1)>',body:'<script>alert(1)</script>',created_at:'invalid'}));
   assert.equal(await page.locator('[data-chat-id="63"] img').count(),0);
   assert.equal(await page.locator('[data-chat-id="63"] time').count(),0);
   await page.locator('.loungeGuide summary').click();
   assert.equal(await page.locator('.loungeGuide').getAttribute('open'),'');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'page overflow at '+width);
   if(process.env.LOUNGE_SCREENSHOTS){
    for(const [label,selector] of [['guide','.loungeGuide'],['highlights','.spectatorCard:last-child'],['chat','#chatPanel']])
     await page.locator(selector).screenshot({path:path.join(process.env.LOUNGE_SCREENSHOTS,label+'-'+width+'.png')});
   }
   assert.deepEqual(errors,[]);
   console.log(width+'px: filter/replay/paging/unread/scroll/time/race/escaping/guide/overflow passed');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
