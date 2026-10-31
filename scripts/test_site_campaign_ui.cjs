// Capture request bodies before dispatch; no synthetic audience writes or social posts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),browserReadOnly=require('./browser_read_only.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  await browserReadOnly(context);await context.routeWebSocket('**/*',ws=>ws.close());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const entry of ['/?internal=1','/domestic/?internal=1','/en/watch/?internal=0']){
   const url=entry+'&utm_source=threads&utm_medium=social&utm_campaign=andy_scan_20261031&private_note=SECRET';
   await page.goto(base+url,{waitUntil:'load',timeout:60000});
   await page.waitForFunction(()=>window.__tapeTestAnalytics.some(p=>p.p_campaign_source==='threads'));
   let bodies=await page.evaluate(()=>__tapeTestAnalytics);
   assert.ok(bodies.every(p=>p.p_campaign_source==='threads'&&p.p_campaign_name==='andy_scan_20261031'));
   assert.ok(bodies.every(p=>p.p_internal===!entry.includes('internal=0')));
   assert.ok(bodies.every(p=>Object.keys(p).length===9));
   assert.equal(JSON.stringify(bodies).includes('SECRET'),false);
   if(entry.startsWith('/?')){
    const session=bodies[0].p_session_id;
    await page.locator('.tab[data-tab="analysis"]').click();
    await page.waitForFunction(()=>__tapeTestAnalytics.some(p=>p.p_tab==='analysis'&&p.p_campaign_source==='threads'));
    bodies=await page.evaluate(()=>__tapeTestAnalytics);assert.ok(bodies.every(p=>p.p_session_id===session));
    await page.evaluate(()=>siteAnalyticsFlush(true));
    assert.ok((await page.evaluate(()=>__tapeTestAnalytics)).every(p=>p.p_campaign_source==='threads'));
   }
  }
  // Localized internal traffic stays silent, including an explicit social tag.
  await page.goto(base+'/ja/watch/?internal=1&utm_source=x&utm_medium=social&utm_campaign=site_launch',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>__tapeTestAnalytics.length),0);
  for(const labels of ['','&utm_source=threads&utm_medium=social&utm_campaign=private-secret','&utm_source=threads&utm_medium=social&utm_campaign=andy_scan&utm_source=x']){
   await page.goto(base+'/?internal=1'+labels,{waitUntil:'load'});
   await page.waitForFunction(()=>__tapeTestAnalytics.length>0);
   const bodies=await page.evaluate(()=>__tapeTestAnalytics);
   assert.ok(bodies.every(p=>Object.keys(p).length===7&&p.p_campaign_source===undefined),'untagged/invalid links use the exact legacy payload');
  }
  await page.goto(base+'/en/watch/?internal=0',{waitUntil:'load'});
  await page.waitForFunction(()=>__tapeTestAnalytics.length>0);
  assert.ok((await page.evaluate(()=>__tapeTestAnalytics)).every(p=>Object.keys(p).length===7));
  assert.deepEqual(errors,[]);
  console.log('Campaign browser payloads passed: lounge/tool/localized entries, keepalive, SPA session reuse, internal exclusion and exact old payloads. All writes blocked before dispatch.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
