// Isolated fixtures only: no requests, accounts or public chat writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function extract(start,end){const i=html.indexOf(start);assert.ok(i>=0);return html.slice(i,html.indexOf(end,i));}
const bootstrap=[
 "const $=id=>document.getElementById(id);const esc=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML};",
 "let myNick='test',myUid=null,sbc=null;async function ensureAuth(){}function setNick(){}",
 extract("const feed = $('feed');","// 전략가 서신"),
 extract('function nickColor(', 'function chatWanted()')
].join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:360,height:640},{width:740,height:360}]){
   const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.abort());
   await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));
   await page.addScriptTag({content:bootstrap});
   await page.evaluate(()=>{
    Object.entries(CREW_PROFILES).forEach(([key,p],i)=>renderChatRow({id:i+1,nick:p.name,body:'격리된 명함 UI 테스트',author_type:'virtual',agent_key:key,created_at:'2026-09-08T13:00:00Z'}));
    renderChatRow({id:20,nick:'차트도령',body:'사람의 동명 닉네임',author_type:'human',agent_key:'chart_doryeong'});
    renderChatRow({id:21,nick:'알 수 없는 AI',body:'미등록 크루',author_type:'virtual',agent_key:'unknown'});
    for(let i=0;i<5;i++)renderChatRow({id:30+i,nick:'차트도령',body:'차트 테스트 '+i,author_type:'virtual',agent_key:'chart_doryeong',created_at:new Date(Date.UTC(2026,8,8,14,i)).toISOString()});
   });
   assert.equal(await page.locator('[data-chat-id="20"] button').count(),0);
   assert.equal(await page.locator('[data-chat-id="21"] button').count(),0);
   for(const name of ['관망이','차트도령','펀딩곰','현물누나','디젠','허밋','울프']){
    const opener=page.getByRole('button',{name:name+' 크루 명함 보기',exact:true}).first();
    await opener.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#crewTitle').textContent(),name);
    assert.match(await page.locator('.crewAi').textContent(),/AI 캐릭터/);
    assert.equal(await page.locator('#crewCard').isVisible(),true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#crewCard').open);
    await page.waitForFunction(el=>el===document.activeElement,await opener.elementHandle(),{timeout:2000}).catch(async e=>{
     console.log(name,await page.evaluate(()=>({active:document.activeElement.outerHTML,trigger:crewCardTrigger?.outerHTML,errors:typeof openCrewCard})),errors);throw e;
    });
    assert.ok(await opener.evaluate(el=>el===document.activeElement));
   }
   const chart=page.getByRole('button',{name:'차트도령 크루 명함 보기',exact:true}).last();
   await chart.click();await page.locator('#crewRecent summary').click();
   assert.deepEqual(await page.locator('#crewQuotes p').allTextContents(),['차트 테스트 4','차트 테스트 3','차트 테스트 2']);
   assert.match(await page.locator('#crewQuotes time').first().textContent(),/23:04$/);
   assert.ok(await page.evaluate(()=>{const d=$('crewCard'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth;}));
   if(process.env.LOUNGE_SCREENSHOTS&&viewport.height>400)await page.locator('#crewCard').screenshot({path:path.join(process.env.LOUNGE_SCREENSHOTS,'crew-'+viewport.width+'.png')});
   await page.locator('#crewClose').click();
   await page.waitForFunction(()=>!document.querySelector('#crewCard').open);
   await chart.click();
   await page.locator('#crewClose').focus();await page.keyboard.press('Tab');
   assert.ok(await page.evaluate(()=>$('crewCard').contains(document.activeElement)));
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#crewCard').open);
   await chart.click();await page.mouse.click(1,1);
   assert.equal(await page.locator('#crewCard').isVisible(),false);
   await page.evaluate(()=>{
    renderChatRow({id:99,nick:'차트도령',body:'<img src=x onerror=alert(1)>',author_type:'virtual',agent_key:'chart_doryeong',created_at:'2026-09-09T00:00:00Z'});
   });
   await page.locator('[data-chat-id="99"] button').click();await page.locator('#crewRecent summary').click();
   assert.equal(await page.locator('#crewQuotes img').count(),0);
   assert.match(await page.locator('#crewQuotes p').first().textContent(),/onerror/);
   await page.evaluate(()=>feed.replaceChildren());
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.activeElement===document.querySelector('#feed'));
   await page.evaluate(()=>{chatRows.clear();openCrewCard('hermit',feed);});
   await page.locator('#crewRecent summary').click();assert.equal(await page.locator('#crewEmpty').isVisible(),true);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#crewCard').open);
   await page.evaluate(()=>openCrewCard('__proto__',feed));assert.equal(await page.locator('#crewCard').isVisible(),false);
   assert.deepEqual(errors,[]);
   console.log(viewport.width+'x'+viewport.height+': 7 profiles, identity, keyboard, close/focus, recent order, KST, escaping, empty, overflow passed');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
