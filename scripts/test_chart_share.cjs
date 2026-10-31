// Real pinned chart API, deterministic public candles; no network writes or real OS sharing.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const browserReadOnly=require('./browser_read_only.cjs');
const root=path.resolve(__dirname,'..');
const artifacts=process.env.TAPE_TEST_ARTIFACTS||path.join(os.tmpdir(),'tape-chart-share-test');
const periods={'1m':60000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000,'1w':604800000,'1M':2592000000};
function candles(tf,count){const step=periods[tf]||60000,end=Math.floor(Date.now()/step)*step;return Array.from({length:count},(_,i)=>{
 const c=100+Math.sin(i/9)*22+i*.015,t=end-(count-1-i)*step;
 return [t,''+(c-.4),''+(c+1.8),''+(c-1.6),''+c,'100',t+step-1,'10000',25,'50','5000','0'];
});}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{
   if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  for(const width of [1440,390,320]){
   const context=await browser.newContext({viewport:{width,height:960},deviceScaleFactor:width<500?2:1,reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true});
   await browserReadOnly(context);
   await context.routeWebSocket('**/*',ws=>ws.close());
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname.endsWith('binance.com')&&u.pathname.endsWith('/klines'))return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(candles(u.searchParams.get('interval'),Math.min(320,+(u.searchParams.get('limit')||320))))});
    return route.fallback();
   });
   await context.addInitScript(()=>{
    window.__clipboard=[];window.__shares=[];window.__shareCancel=false;window.__copyFail=false;window.__delayBlob=false;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{if(window.__copyFail)throw Error('denied');window.__clipboard.push(value);}}});
    Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>innerWidth<500&&files?.length===1&&files[0].type==='image/png'});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shares.push({title:data.title,url:data.url,name:data.files[0].name,type:data.files[0].type,size:data.files[0].size});if(window.__shareCancel)throw new DOMException('cancel','AbortError');}});
    const texts=new WeakMap(),draws=new WeakMap(),fill=CanvasRenderingContext2D.prototype.fillText,draw=CanvasRenderingContext2D.prototype.drawImage,toBlob=HTMLCanvasElement.prototype.toBlob;
    CanvasRenderingContext2D.prototype.fillText=function(...args){const log=texts.get(this.canvas)||[];log.push(String(args[0]));texts.set(this.canvas,log);return fill.apply(this,args);};
    CanvasRenderingContext2D.prototype.drawImage=function(...args){draws.set(this.canvas,(draws.get(this.canvas)||0)+1);return draw.apply(this,args);};
    HTMLCanvasElement.prototype.toBlob=function(callback,...args){window.__export={texts:texts.get(this)||[],draws:draws.get(this)||0,width:this.width,height:this.height};return toBlob.call(this,blob=>{if(window.__delayBlob)setTimeout(()=>callback(blob),250);else callback(blob);},...args);};
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/?internal=1&private_note=PRIVATE-ROOM&chart=ETH&tf=4h#loungeChart',{waitUntil:'load',timeout:60000});
   await page.waitForFunction(()=>window.TapeChartSource&&chartOf(1)?.bars===320);
   assert.deepEqual(await page.evaluate(()=>TapeChartSource.describe()),{key:'ETH',market:'ETH / USDT · Binance',tf:'4h',label:'240분'});
   assert.equal(await page.locator('.tfb.on').getAttribute('data-tf'),'4h');
   assert.ok(await page.locator('#loungeChart').evaluate(el=>el.getBoundingClientRect().top<100),'deep link scrolls to chart');
   await page.evaluate(()=>{const sentinel=document.createElement('p');sentinel.textContent='PRIVATE-CHAT-ACCOUNT-999';document.querySelector('#feed').append(sentinel);});
   const before=await page.evaluate(()=>({range:chartOf(1).ch.timeScale().getVisibleLogicalRange(),bars:chartOf(1).bars,series:chartOf(1).s.data()}));
   await page.locator('#chartShareOpen').click();
   await page.waitForFunction(()=>!document.getElementById('chartShareSave').disabled);
   assert.equal(await page.locator('#chartShareDialog').isVisible(),true);
   assert.ok(await page.locator('#chartSharePreview').evaluate(img=>img.complete&&img.naturalWidth>=720));
   const exported=await page.evaluate(()=>window.__export);
   assert.equal(exported.draws,3,'exactly the price, MACD and RSI snapshots are composited');
   for(const text of ['ETH / USDT','MACD','RSI','SMA 5','TradingView'])assert.ok(exported.texts.some(s=>s.includes(text)),text);
   assert.equal(exported.texts.some(s=>s.includes('PRIVATE')),false);
   assert.ok(exported.height>exported.width&&exported.height<6500);
   assert.deepEqual(await page.evaluate(()=>({range:chartOf(1).ch.timeScale().getVisibleLogicalRange(),bars:chartOf(1).bars,series:chartOf(1).s.data()})),before,'export must preserve visible range and series');
   await page.locator('#chartShareCopy').click();
   const shared='https://tapelounge.com/?chart=ETH&tf=4h#loungeChart';
   assert.deepEqual(await page.evaluate(()=>__clipboard),[shared],'internal and private query parameters must not leave the page');
   const downloadPromise=page.waitForEvent('download');
   await page.locator('#chartShareSave').click();
   const download=await downloadPromise;
   assert.match(download.suggestedFilename(),/^tape-lounge-ETH-4h-.*-UTC\.png$/);
   const output=path.join(artifacts,`chart-${width}.png`);await download.saveAs(output);
   const bytes=fs.readFileSync(output);
   assert.equal(bytes.subarray(1,4).toString(),'PNG');
   assert.equal(bytes.readUInt32BE(16),exported.width);assert.equal(bytes.readUInt32BE(20),exported.height);
   assert.ok(bytes.length>15000,'image must contain the actual chart');
   if(width<500){
    await page.locator('#chartShareNative').click();
    assert.equal((await page.evaluate(()=>__shares))[0].url,shared);
    assert.ok((await page.evaluate(()=>__shares))[0].size>15000);
    await page.evaluate(()=>{window.__shareCancel=true;});
    let downloads=0;page.on('download',()=>downloads++);
    await page.locator('#chartShareNative').click();
    await page.waitForFunction(()=>document.getElementById('chartShareStatus').textContent==='공유를 취소했습니다.');
    assert.equal(downloads,0,'cancel must not trigger a download');
   }else assert.equal(await page.locator('#chartShareNative').isVisible(),false);
   await page.evaluate(()=>{window.__copyFail=true;});
   await page.locator('#chartShareCopy').click();
   await page.waitForFunction(()=>!document.getElementById('chartShareLink').hidden);
   assert.equal(await page.locator('#chartShareLink').inputValue(),shared);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no page overflow '+width);
   assert.equal(await page.locator('#chartShareDialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,'no dialog overflow '+width);
   await page.screenshot({path:path.join(artifacts,`share-dialog-${width}.png`)});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.getElementById('chartShareDialog').open);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'chartShareOpen');
   // Closing during PNG encoding must invalidate the pending result.
   await page.evaluate(()=>{window.__delayBlob=true;window.__export=null;});
   await page.locator('#chartShareOpen').click();
   await page.waitForFunction(()=>window.__export!==null);
   await page.locator('#chartShareClose').click();
   await page.waitForTimeout(350);
   assert.equal(await page.locator('#chartSharePreview').getAttribute('src'),null);
   assert.equal(await page.locator('#chartShareSave').isDisabled(),true);
   await page.evaluate(()=>{window.__delayBlob=false;chartSeed[caroIdx]=null;});
   await page.locator('#chartShareOpen').click();
   await page.waitForFunction(()=>document.getElementById('chartShareStatus').textContent.includes('불러온 뒤'));
   assert.equal(await page.locator('#chartShareSave').isDisabled(),true,'unloaded data must not export a blank chart');
   await page.locator('#chartShareClose').click();
   await page.goto(base+'/?internal=1&chart=not-an-asset&tf=not-a-timeframe',{waitUntil:'load'});
   await page.waitForFunction(()=>window.TapeChartSource&&chartOf(0)?.bars===320);
   assert.equal(await page.evaluate(()=>TapeChartSource.describe().key),'BTC');
   assert.equal(await page.evaluate(()=>TapeChartSource.describe().tf),'1m');
   await page.evaluate(()=>caroGo(1));
   await page.locator('.chartJump').click();
   assert.equal(await page.evaluate(()=>TapeChartSource.describe().key),'BTC','price tile jumps to the BTC chart');
   assert.equal(new URL(page.url()).searchParams.get('internal'),'1','price jump preserves internal exclusion and does not reload');
   if(width===1440){
    for(const [key,market] of [['BTC.D','선물지수'],['NASDAQ','ETF 토큰']]){
     await page.goto(base+'/?internal=1&chart='+encodeURIComponent(key)+'&tf=1d#loungeChart',{waitUntil:'load'});
     await page.waitForFunction(()=>window.TapeChartSource&&chartOf(caroIdx)?.bars===320);
     assert.equal(await page.evaluate(()=>TapeChartSource.describe().key),key);
     assert.ok((await page.locator('.caroPage:not(.hidden)').textContent()).length>0);
     await page.locator('#chartShareOpen').click();
     await page.waitForFunction(()=>!document.getElementById('chartShareSave').disabled);
     assert.ok((await page.locator('#chartShareMeta').textContent()).includes(market),'market type is explicitly named');
     await page.locator('#chartShareCopy').click();
     await page.waitForFunction(()=>window.__clipboard.length===1);
     const url=new URL(await page.evaluate(()=>__clipboard.at(-1)));
     assert.equal(url.searchParams.get('chart'),key);assert.equal(url.searchParams.get('tf'),'1d');
     await page.locator('#chartShareClose').click();
    }
   }
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({width,exportWidth:exported.width,exportHeight:exported.height,errors:errors.length}));
   await context.close();
  }
  console.log('Chart sharing passed: real chart PNG, clean deep links, mobile sharing, cancellation, clipboard fallback and pending-close safety.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
