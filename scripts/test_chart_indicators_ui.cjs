// Full app + real pinned chart library, deterministic candles. All external writes and WebSockets blocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const periods={'1m':60000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000,'1w':604800000,'1M':2592000000};
function candles(tf,count){const step=periods[tf]||60000,end=Math.floor(Date.now()/step)*step;return Array.from({length:count},(_,i)=>{
 const c=100+Math.sin(i/9)*22+i*.015,t=end-(count-1-i)*step;
 return [t,''+(c-.4),''+(c+1.8),''+(c-1.6),''+c,'100',t+step-1,'10000',25,'50','5000','0'];
});}
(async()=>{
 const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.json':'application/json','.js':'text/javascript','.png':'image/png'}[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  for(const width of [1440,390,360]){
   const page=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(!['GET','HEAD','OPTIONS'].includes(req.method()))return route.abort();
    if(u.hostname.endsWith('binance.com')&&u.pathname.endsWith('/klines')){
     const tf=u.searchParams.get('interval');
     if(tf==='1h')await new Promise(r=>setTimeout(r,200));
     return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(candles(tf,Math.min(320,+(u.searchParams.get('limit')||320))))});
    }
    return route.continue();
   });
   await page.routeWebSocket('**/*',ws=>ws.close());
   await page.goto('http://127.0.0.1:'+server.address().port+'/?internal=1',{waitUntil:'load',timeout:60000});
   await page.waitForFunction(()=>typeof chartOf!=='undefined'&&chartOf(0)?.st.last?.count===320);
   for(let i=0;i<4;i++){
    await page.evaluate(i=>caroGo(i),i);
    await page.waitForFunction(i=>chartOf(i)?.st.last?.count===320,i);
    const info=await page.evaluate(i=>({ma:chartOf(i).ma.map(s=>s.data().length),st:chartOf(i).st.series.data().length,periods:MA_DEFS.map(d=>d[0])}),i);
    assert.deepEqual(info,{ma:[316,301,261,201,121],st:311,periods:[5,20,60,120,200]}); // ATR warm-up: no line for the first 9 candles.
   }
   await page.evaluate(async()=>{await Promise.all([setTf('1h'),setTf('4h')]);});
   assert.equal(await page.evaluate(()=>chartTf),'4h');
   assert.ok(await page.evaluate(()=>chartSeed.every(ks=>ks[1][0]-ks[0][0]===14400000)));
   assert.ok(await page.evaluate(()=>loungeCharts.every(c=>c.st.last.count===320)));
   await page.evaluate(()=>{
    const i=1,k=chartSeed[i].at(-1),before=chartOf(i).st.last;
    handleChartK('ethusdt@kline_1m',{i:'1m',t:k[0],o:k[1],h:'999',l:'1',c:'999',v:'100',T:k[6]});
    if(chartOf(i).st.last!==before)throw Error('wrong timeframe accepted');
    for(const close of [200,5,+k[4]])handleChartK('ethusdt@kline_4h',{i:'4h',t:k[0],o:k[1],h:String(Math.max(+k[2],close)),l:String(Math.min(+k[3],close)),c:String(close),v:'100',T:k[6]});
    if(chartOf(i).st.last.count!==320)throw Error('intrabar count drift');
    const last=chartOf(i).st.last;
    handleChartK('ethusdt@kline_4h',{i:'4h',t:k[0]+14400000,o:k[4],h:String(+k[4]+2),l:String(+k[4]-2),c:k[4],v:'100',T:k[6]+14400000,x:true});
    if(chartOf(i).st.last.count!==321||chartOf(i).ma[0].data().length!==317)throw Error('new candle not appended');
    handleChartK('ethusdt@kline_4h',{i:'4h',t:k[0],o:k[1],h:'999',l:'1',c:'999',v:'100',T:k[6]});
    if(chartOf(i).st.last.count!==321||chartOf(i).st.before!==last)throw Error('stale candle altered state');
   });
   // At least 200 seed bars are visible after each supported timeframe switch.
   for(const tf of ['15m','1d','1w','1M','1m']){
    await page.evaluate(tf=>setTf(tf),tf);
    assert.ok(await page.evaluate(()=>loungeCharts.every(c=>c.ma[4].data().length===121&&c.st.last.count===320)));
   }
   await page.evaluate(()=>caroGo(0));
   assert.match(await page.locator('.caro [data-indicator-legend]').textContent(),/SMA 5 20 60 120 200/);
   assert.match(await page.locator('.caro [data-indicator-legend]').textContent(),/슈퍼트렌드 10 × 3/);
   assert.ok(await page.evaluate(()=>{const el=document.querySelector('.caro');return el.scrollWidth<=el.clientWidth+1}));
   if(process.env.LOUNGE_SCREENSHOTS)await page.locator('.caro').screenshot({path:path.join(process.env.LOUNGE_SCREENSHOTS,'indicators-'+width+'.png')});
   await page.locator('.tab[data-tab="game"]').click();
   await page.waitForFunction(()=>typeof bgST!=='undefined'&&bgST);
   await page.evaluate(()=>{
    const visible=chartSeed[0].slice(0,250).map((k,i)=>({time:946684800+i*86400,open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]}));
    bg={idx:249,norm:visible.concat([{get high(){throw Error('hidden future read')}}]),pos:null};
    bgS.setData(visible);bgMASet();bgVolSet();
    if(bgST.last.count!==250||bgMA[4].data().length!==51)throw Error('blind seed mismatch');
    bg.norm[250]={...visible.at(-1),time:946684800+250*86400};bgAdvanceOneDay();
    if(bgST.last.count!==251||bgST.last.time!==bg.norm[250].time)throw Error('blind reveal mismatch');
   });
   assert.deepEqual(errors,[]);
   console.log(width+'px: four live charts, timeframe races/reset, intrabar update, all intervals, legend/overflow, blind no-lookahead passed');
   await page.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
