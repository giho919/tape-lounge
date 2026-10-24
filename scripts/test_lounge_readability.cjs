const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
function extract(start,end){return html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));}
const chat = extract("const feed = $('feed');","// 전략가 서신");
const people = extract("function nickColor(", "function chatWanted()");
const bootstrap = [
  "const $=id=>document.getElementById(id);",
  "const esc=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML};",
  "let myNick='테스트',myUid='test-only',sbc=null;",
  "async function ensureAuth(){} function setNick(){}",
  "function setPit(p){$('pitTitle').textContent=p.title;$('pitCopy').textContent=p.copy;$('pitTag').textContent=p.tag;}",
  chat,people
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
   assert.equal(await page.locator('#highlightList,#towerLong,#jackpotCard').count(),0,'removed lounge panels must stay absent');
   assert.equal(await page.locator('.spectatorCard').count(),1,'the coin race remains in the observatory');
   assert.equal(await page.locator('#raceRows').count(),1);
   assert.equal(await page.locator('#deckPanel').count(),1,'the candle deck remains available');
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
    for(const [label,selector] of [['guide','.loungeGuide'],['race','.spectatorCard'],['chat','#chatPanel']])
     await page.locator(selector).screenshot({path:path.join(process.env.LOUNGE_SCREENSHOTS,label+'-'+width+'.png')});
   }
   assert.deepEqual(errors,[]);
   console.log(width+'px: removed panels/race/deck/unread/scroll/time/escaping/guide/overflow passed');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
