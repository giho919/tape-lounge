// Real chart engine; all network writes and WebSockets blocked. No live orders or sharing.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const browserReadOnly=require('./browser_read_only.cjs'),daily=require('../blind-daily.js');
const root=path.resolve(__dirname,'..'),day='2026-10-31',selected=daily.selection(day);
const artifacts=process.env.TAPE_TEST_ARTIFACTS||path.join(os.tmpdir(),'tape-blind-daily-test');
function candles(url){
 const tf=url.searchParams.get('interval'),step={'1m':60000,'15m':900000,'1h':3600000,'4h':14400000,'1w':604800000,'1M':2592000000}[tf]||86400000;
 const count=+(url.searchParams.get('limit')||320),end=Math.floor(+(url.searchParams.get('endTime')||Date.now())/step)*step;
 return Array.from({length:count},(_,i)=>{const c=100+i*.03+Math.sin(i/13)*8,t=end-(count-1-i)*step;return[t,''+(c-.4),''+(c+2),''+(c-2),''+c,'20',t+step-1,'2500',10,'10','1200','0'];});
}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  for(const width of [1440,390,320]){
   const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce',serviceWorkers:'block'});
   await browserReadOnly(context);await context.routeWebSocket('**/*',ws=>ws.close());
   let fail=false,hold=false,release=null;const dailyRequests=[];
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname.endsWith('binance.com')&&u.pathname.endsWith('/klines')){
     const isDaily=u.searchParams.get('endTime')===String(selected.endTime);
     if(isDaily){dailyRequests.push(u.href);if(hold)await new Promise(r=>{release=r;});if(fail)return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});}
     return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(candles(u))});
    }
    return route.fallback();
   });
   await context.addInitScript(()=>{window.__copiedDaily=null;window.__copyDenied=false;Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(__copyDenied)throw Error('denied');window.__copiedDaily=value;}}});});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/blind/?internal=1&private_note=PRIVATE&daily='+day,{waitUntil:'load',timeout:60000});
   await page.waitForFunction(()=>typeof bgMode!=='undefined'&&bgMode==='daily'&&bgCh);
   assert.ok((await page.locator('#bgOverBox').textContent()).includes(day));
   assert.equal(await page.locator('#bgTrackRow').isVisible(),false);
   assert.equal(await page.locator('.blindModeBtn.on').getAttribute('data-m'),'daily');
   await page.locator('#bgOverBox .go').click();
   await page.waitForFunction(()=>bg?.gameMode==='daily');
   await page.evaluate(()=>{if(bg.playing)soloPauseToggle();});
   const round=await page.evaluate(()=>({day:bg.daily.day,sym:bg.sym,speed:bgSpeed,lev:bgLev,pct:bgPct,base:bg.base,total:bg.norm.length,visible:bgS.data().length,idx:bg.idx,osc:bgOsc.last.count,st:bgST.last.count,price:bg.norm[bg.base].close}));
   assert.equal(round.day,day);assert.equal(round.sym,selected.symbol);assert.equal(round.total,1000);assert.equal(round.base,799);assert.equal(round.speed,4);assert.equal(round.lev,1);assert.equal(round.pct,25);assert.equal(round.price,100);
   assert.equal(round.visible,round.idx+1);assert.equal(round.osc,round.visible);assert.equal(round.st,round.visible);
   const beforeWrites=await page.evaluate(()=>__tapeTestBlockedWrites);
   // Orders below execute only the local simulation branch.
   await page.locator('#bgBuyCustom').click();
   assert.ok(await page.evaluate(()=>bg.pos?.side==='long'));
   assert.equal(await page.evaluate(()=>__tapeTestBlockedWrites),beforeWrites,'practice order must not send a network write');
   await page.evaluate(()=>{while(bg.idx<bg.norm.length-1&&!bg.over)bgAdvanceOneDay();});
   await page.evaluate(()=>blindFinish(false));
   await page.waitForFunction(()=>bg.over&&!document.getElementById('bgOver').classList.contains('hidden'));
   assert.ok((await page.locator('#bgOverBox').textContent()).includes('완주'));
   const record=await page.evaluate(()=>BlindDaily.read(localStorage));assert.equal(record.length,1);assert.equal(record[0].day,day);
   await page.getByRole('button',{name:'결과·도전 링크 복사'}).click();
   const text=await page.evaluate(()=>__copiedDaily);
   assert.ok(text.includes('과거 차트 모의 연습'));assert.equal(text.split('\n').at(-1),'https://tapelounge.com/blind/?daily='+day);assert.equal(text.includes('internal'),false);assert.equal(text.includes('PRIVATE'),false);
   await page.evaluate(()=>{window.__copyDenied=true;});
   await page.getByRole('button',{name:'결과·도전 링크 복사'}).click();
   assert.equal(await page.locator('#bgDailyCopyText').isVisible(),true);assert.equal(await page.locator('#bgDailyCopyText').inputValue(),text);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no page overflow '+width);
   await page.screenshot({path:path.join(artifacts,`daily-result-${width}.png`)});
   await page.reload({waitUntil:'load'});await page.waitForFunction(()=>bgMode==='daily'&&bgCh);
   assert.ok((await page.locator('#bgOverBox').textContent()).includes('첫 완주'));
   await page.screenshot({path:path.join(artifacts,`daily-intro-${width}.png`)});
   fail=true;await page.locator('#bgOverBox .go').click();
   await page.waitForFunction(()=>document.getElementById('bgOverBox').textContent.includes('같은 판 재시도'));
   assert.equal(await page.evaluate(()=>bg===null),true,'failed data must never substitute a random round');
   assert.ok(dailyRequests.every(raw=>new URL(raw).searchParams.get('symbol')===selected.symbol));
   fail=false;hold=true;const count=dailyRequests.length;
   await page.locator('#bgOverBox .go').click();
   await page.waitForFunction(()=>document.getElementById('bgOverBox').textContent.includes('준비하고'));
   while(dailyRequests.length===count)await new Promise(r=>setTimeout(r,20));
   await page.locator('.blindModeBtn[data-m="solo"]').click();release();hold=false;
   await page.waitForTimeout(150);
   assert.equal(await page.evaluate(()=>bgMode),'solo');assert.equal(await page.evaluate(()=>bg===null),true,'late daily response must not replace the new mode');
   assert.equal(await page.locator('#bgTrackRow').isVisible(),true);
   await page.locator('#bgOverBox .go').click();await page.waitForFunction(()=>bg?.gameMode==='solo');
   await page.evaluate(()=>{if(bg.playing)soloPauseToggle();});
   assert.equal(await page.evaluate(()=>bg.daily),null,'normal random practice stays independent');
   await page.locator('.blindModeBtn[data-m="study"]').click();
   assert.equal(await page.evaluate(()=>bgMode),'study');
   assert.equal(await page.locator('#bgTrackRow').isVisible(),true,'group setup still permits choosing its market');
   assert.ok((await page.locator('#bgOverBox').textContent()).includes('함께 보는 판'),'group entry still opens without starting a room');
   assert.deepEqual(errors,[]);console.log(JSON.stringify({width,recordSaved:true,dailyRequests:dailyRequests.length,errors:errors.length}));
   await context.close();
  }
  console.log('Daily blind UI passed: same chart, hidden future, local simulated trade, finish/record/reload, clean sharing, fallback and stale-load safety.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
