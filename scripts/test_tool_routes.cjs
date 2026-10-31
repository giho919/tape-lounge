const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const routes={lounge:'/',domestic:'/domestic/',desk:'/desk/',analysis:'/analysis/',chain:'/onchain/',macro:'/calendar/',game:'/blind/',chars:'/strategists/'};
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{
   if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  // The selected panel and real links must exist before JavaScript or data load.
  const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await plain.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const staticPage=await plain.newPage();
  for(const [tab,route] of Object.entries(routes)){
   await staticPage.goto(base+route+'?internal=1');
   assert.equal(await staticPage.locator('body').getAttribute('data-entry-tab'),tab);
   assert.equal(await staticPage.locator('.tab[aria-selected="true"]').getAttribute('data-tab'),tab);
   assert.equal(await staticPage.locator('#tab-'+tab).evaluate(el=>el.classList.contains('hidden')),false);
   assert.equal(await staticPage.locator('meta[name="robots"]').getAttribute('content'),'index,follow');
   assert.equal(await staticPage.locator('link[rel="canonical"]').getAttribute('href'),'https://tapelounge.com'+route);
   for(const [key,href] of Object.entries(routes))assert.equal(await staticPage.locator(`a.tab[data-tab="${key}"]`).getAttribute('href'),href);
   assert.equal(await staticPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route);
  }
  await plain.close();
  const live=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await live.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
  await live.routeWebSocket('**/*',ws=>ws.close());
  const page=await live.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [tab,route] of Object.entries(routes)){
   await page.goto(base+route+'?internal=1',{waitUntil:'load'});
   await page.waitForFunction(expected=>typeof activeTab!=='undefined'&&activeTab===expected,tab);
   assert.equal(await page.evaluate(()=>loungeRuntimeOn),tab==='lounge',route);
   assert.equal(await page.locator('.tab[aria-selected="true"]').getAttribute('data-tab'),tab);
  }
  await page.goto(base+'/desk/?internal=1',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof activeTab!=='undefined'&&activeTab==='desk');
  assert.equal(await page.evaluate(()=>loungeRuntimeOn),false,'direct desk entry must not start lounge sockets');
  const identity=await page.evaluate(()=>{window.routeTestIdentity=Math.random();return routeTestIdentity;});
  await page.locator('.tab[data-tab="chars"]').click();
  assert.equal(new URL(page.url()).pathname,'/strategists/');
  assert.equal(new URL(page.url()).search,'?internal=1');
  assert.equal(await page.evaluate(()=>routeTestIdentity),identity,'normal tab click must preserve the running app');
  await page.goBack();
  await page.waitForFunction(()=>activeTab==='desk');
  await page.goForward();
  await page.waitForFunction(()=>activeTab==='chars');
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>activeTab==='chars');
  assert.equal(await page.locator('#tab-chars').isVisible(),true,'refresh preserves the selected tool');
  await page.locator('.tab[data-tab="chain"]').press('Space');
  await page.waitForFunction(()=>activeTab==='chain');
  assert.equal(new URL(page.url()).pathname,'/onchain/');
  await page.goto(base+'/?internal=1#blind',{waitUntil:'load'});
  await page.waitForFunction(()=>activeTab==='game');
  assert.equal(await page.locator('#tab-game').isVisible(),true,'legacy bookmarks still open the correct tool');
  await page.goto(base+'/analysis/?internal=1',{waitUntil:'load'});
  await page.waitForFunction(()=>activeTab==='analysis');
  await page.waitForFunction(()=>{const image=document.getElementById('caLongImage');return image.complete&&image.naturalWidth>0;});
  assert.match(await page.locator('#caLongImage').getAttribute('src'),/linear-long\.svg$/);
  assert.equal(await page.locator('#tab-lounge').isVisible(),false);
  assert.deepEqual(errors,[]);
  if(process.env.TAPE_ROUTE_SCREENSHOT){
   await page.goto(base+'/strategists/?internal=1',{waitUntil:'load'});
   await page.screenshot({path:process.env.TAPE_ROUTE_SCREENSHOT});
  }
  console.log('8 direct entries without JS; native links; SPA navigation; history; refresh; query preservation; keyboard; legacy fragments; analysis initialization: passed. All external writes blocked.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
