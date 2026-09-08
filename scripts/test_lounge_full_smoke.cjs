const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{
   if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   const type={'.html':'text/html; charset=utf-8','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.js':'text/javascript'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],blocked=[];
  page.on('pageerror',e=>errors.push(e.message));
  // No analytics, anonymous signups, chat posts or orders can leave this browser.
  await page.route('**/*',route=>{
   if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){blocked.push(route.request().url());return route.abort();}
   return route.continue();
  });
  await page.routeWebSocket('**/*',ws=>ws.close());
  await page.goto('http://127.0.0.1:'+server.address().port+'/?internal=1',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof loungeRuntimeOn!=='undefined'&&loungeRuntimeOn,null,{timeout:20000});
  await page.evaluate(()=>loadChatHistory());
  assert.ok(await page.locator('#feed .msg').count()>0,'public chat history should load');
  assert.ok(await page.locator('#feed time').count()>0,'real rows carry server timestamps');
  const crew=page.locator('#feed .crewName').first();
  assert.ok(await crew.count()>0,'public AI crew should have profile buttons');
  await crew.click();
  assert.equal(await page.locator('#crewCard').isVisible(),true);
  await page.locator('#crewRecent summary').click();
  assert.ok(await page.locator('#crewQuotes li').count()>0,'profile uses loaded public messages');
  await page.locator('#crewClose').click();
  await page.locator('.loungeGuide summary').click();
  assert.ok(await page.locator('.loungeGuide').getAttribute('open')!==null);
  await page.locator('[data-highlight-kind="price"]').click();
  await page.selectOption('#highlightPeriod','6');
  await page.locator('.tab[data-tab="desk"]').click();
  assert.equal(await page.locator('#tab-lounge').isVisible(),false);
  await page.locator('.tab[data-tab="lounge"]').click();
  assert.equal(await page.locator('#tab-lounge').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('Full application initialized; live read-only chat, filters, guide, tab lifecycle passed. Blocked writes: '+blocked.length);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
