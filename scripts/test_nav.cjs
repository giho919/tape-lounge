// 측면 인덱스 탭 구조와 발표장 배지. 브라우저 없이 index.html 을 읽어 검사한다.
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), crypto=require('node:crypto'), path=require('node:path');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8').replace(/\r\n/g,'\n');
const app=fs.readFileSync(require.resolve('../lounge-app.js'),'utf8');
const builder=fs.readFileSync(require.resolve('./build_discovery.py'),'utf8');
let tests=0; const test=(l,f)=>{f();tests++;console.log('PASS',l);};

const TABS=['lounge','domestic','desk','analysis','chain','macro','game','chars'];

test('탭 여덟 개가 아이콘과 이름을 따로 들고, 기존 선택 로직 계약을 지킨다',()=>{
 const block=html.slice(html.indexOf('<div class="tabs"'), html.indexOf('</div>',html.indexOf('data-tab="chars"'))+6);
 for(const t of TABS){
  const re=new RegExp(`data-tab="${t}"[^>]*>\\s*<i class="ic" aria-hidden="true">([^<]+)</i><span class="nm">([^<]+)</span>`);
  const m=block.match(re);
  assert.ok(m,`${t} 탭이 아이콘/이름 구조가 아니다`);
  assert.ok(m[1].trim()&&m[2].trim(),t);
 }
 assert.equal((block.match(/role="tab"/g)||[]).length,8);
 assert.ok(block.includes('aria-orientation="vertical"'),'세로 탭임을 알려야 한다');
 assert.equal((block.match(/class="tab on"/g)||[]).length,1,'처음 선택된 탭은 하나');
 // 기존 스크립트가 쓰는 선택자를 그대로 유지하는지
 assert.ok(app.includes("document.querySelectorAll('.tab').forEach"),'선택 로직이 .tab 을 계속 쓴다');
 for(const t of TABS)assert.ok(app.includes(`'${t}'`)||app.includes(`"${t}"`),t);
});

test('국가별 언어 안내가 API에 연결될 수 있고 요청에 referrer·쿠키를 보내지 않는다',()=>{
 const locale=fs.readFileSync(require.resolve('../home-language.js'),'utf8');
 assert.ok(locale.includes("fetch('https://api.country.is/'"));
 assert.ok(locale.includes("credentials: 'omit'"));
 assert.ok(locale.includes("referrerPolicy: 'no-referrer'"));
 for(const page of ['../classic-home.html','../index.html','../en/index.html','../zh/index.html','../ja/index.html']){
  const source=fs.readFileSync(require.resolve(page),'utf8');
  const policy=source.match(/Content-Security-Policy[^>]*content="([^"]+)"/);
  assert.ok(policy?.[1].includes('https://api.country.is'),`${page} blocks country lookup`);
 }
});

test('번역된 홈 화면에도 동적 실시간 문구 번역기를 불러온다',()=>{
 const localeBytes=fs.readFileSync(require.resolve('../live-home-locale.js'),'utf8').replace(/\r\n/g,'\n');
 const localeVersion=crypto.createHash('sha256').update(localeBytes).digest('hex').slice(0,12);
 for(const [page,lang] of [['../en/index.html','en'],['../zh/index.html','zh'],['../ja/index.html','ja']]){
  const source=fs.readFileSync(require.resolve(page),'utf8');
  assert.match(source,new RegExp(`<html[^>]*lang="${lang}"`),`${page} lang`);
  assert.ok(source.includes(`/live-home-locale.js?v=${localeVersion}`),`${page} must load the current live translator`);
  assert.doesNotMatch(source,/<script[^>]+src="\$1[0-9a-f]{12}"/i,`${page} must not reference a malformed locale script`);
 }
});

test('연속 도전 카드도 게임 설명을 유지하고 네 언어에서 오늘 기록을 함께 안내한다',()=>{
 const rotation=fs.readFileSync(require.resolve('../lounge-rotation.js'),'utf8');
 const locale=fs.readFileSync(require.resolve('../live-home-locale.js'),'utf8');
 assert.match(rotation,/slides\[0\]\.copy = `\$\{slides\[0\]\.copy\} 어제까지 \$\{streak\.days\}일 연속 · 오늘 완주하면 이어집니다\.`/);
 assert.match(locale,/비교합니다\\\..*어제까지 \(\\d\+\)일 연속 · 오늘 완주하면 이어집니다/);
 for(const phrase of ['Yesterday’s ${dayCount}-day streak continues if you finish today.','截至昨天已连续完成 ${dayCount} 天，今天完赛即可延续。','昨日まで${dayCount}日連続。今日完走すれば記録が続きます。'])assert.ok(locale.includes(phrase),`missing localized streak text: ${phrase}`);
});

test('다국어 라이브 도구 진입점은 현재 번역기를 불러와 게임 조작부까지 번역한다',()=>{
 const localePath=path.resolve(__dirname,'../live-home-locale.js');
 const localeBytes=fs.readFileSync(localePath,'utf8').replace(/\r\n/g,'\n');
 const localeVersion=crypto.createHash('sha256').update(localeBytes).digest('hex').slice(0,12);
 const slugs=['','blind','domestic','desk','analysis','onchain','calendar','strategists'];
 for(const lang of ['en','zh','ja'])for(const slug of slugs){
  const route=path.resolve(__dirname,'..',lang,'tools',slug,'index.html');
  const source=fs.readFileSync(route,'utf8');
  assert.match(source,new RegExp(`<html[^>]*lang="${lang}"`),`${lang}/${slug} lang`);
  assert.ok(source.includes(`/live-home-locale.js?v=${localeVersion}`),`${lang}/${slug} must load the current live translator`);
  assert.doesNotMatch(source,/<script[^>]+src="\$1[0-9a-f]{12}"/i,`${lang}/${slug} must not reference a malformed locale script`);
 }
 const locale=fs.readFileSync(localePath,'utf8');
 for(const label of ['🎰 블라인드 차트','🎲 나만의 판','📈 미국주식','판에 앉는다 →','롱'])
  assert.ok(locale.includes(label),`live translator must cover blind game label ${label}`);
 assert.match(locale,/function refreshBlindGuideLinks\(\)/,'blind chart guide must stay in the selected language');
 const guide=app.match(/function bgGuideHref\(\) \{[\s\S]*?\n\}/)?.[0];
 assert.ok(guide,'dynamic blind chart screens must have a guide URL helper');
 for(const [lang,href] of [['ko','/ko/learn/blind-chart-practice/'],['en','/en/learn/blind-chart-practice/'],['zh','/zh/learn/blind-chart-practice/'],['ja','/ja/learn/blind-chart-practice/']]){
  const context={document:{documentElement:{lang}}};
  assert.equal(vm.runInNewContext(`${guide}; bgGuideHref()`,context),href,`${lang} guide URL`);
 }
 assert.ok(builder.includes("game_path='/blind/' if lang=='ko' else f'/{lang}/tools/blind/'"),'guide CTA must stay in the selected language');
 for(const languageClaim of ['The live game controls are available in Korean, English, Simplified Chinese, and Japanese.','游戏界面支持韩语、英语、简体中文和日语。','ゲーム操作は韓国語・英語・簡体字中国語・日本語に対応しています。'])assert.ok(fs.readFileSync(require.resolve('../scripts/discovery_content.py'),'utf8').includes(languageClaim),`editorial copy must match localized game: ${languageClaim}`);
 assert.ok(fs.readFileSync(require.resolve('../scripts/discovery_content.py'),'utf8').includes("'2026-11-01','2026-11-02']"),'updated game guide must preserve publish date and record a modified date');
 assert.equal((app.match(/href="\$\{bgGuideHref\(\)\}"/g)||[]).length,2,'daily and solo overlays must both use the localized guide');
});

test('대표 홈페이지는 Google 사이트명 구조화 데이터를 유지한다',()=>{
 const block=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(block,'canonical homepage must publish WebSite JSON-LD');
 const schema=JSON.parse(block[1]);
 assert.equal(schema['@type'],'WebSite');
 assert.equal(schema.name,'Tape Lounge');
 assert.equal(schema.url,'https://tapelounge.com/');
 assert.deepEqual(schema.alternateName,['테이프라운지','tapelounge.com']);
 const ko=fs.readFileSync(require.resolve('../ko/index.html'),'utf8');
 assert.ok(ko.includes(block[0]),'the canonical Korean alias must carry the same site identity');
 assert.ok(builder.includes("'@type': 'WebSite'")&&builder.includes('application/ld+json'),'the generator must preserve homepage structured data');
});

test('홈 검색 제목은 차트 연습을 앞세우고 시세·김프를 설명에 유지한다',()=>{
 const ko=fs.readFileSync(require.resolve('../index.html'),'utf8');
 assert.match(ko,/<title>미국주식 차트 게임·실시간 비트코인 시세와 김프 \| Tape Lounge<\/title>/);
 assert.match(ko,/name="description" content="종목과 날짜를 가린 과거 미국주식·비트코인 차트에서 가상 매매를 연습하고 같은 기간 보유와 비교하세요\. 실시간 비트코인 시세와 김치 프리미엄도 확인할 수 있습니다\./);
 for(const [path,terms] of [
  ['../en/index.html',['Blind chart practice','live crypto markets','hidden-date historical stock and crypto charts']],
  ['../zh/index.html',['盲图交易练习','隐藏标的和日期','实时行情']],
  ['../ja/index.html',['ブラインドチャート練習','銘柄名と日付を隠した過去','リアルタイム相場']],
 ]){
  const page=fs.readFileSync(require.resolve(path),'utf8');
  for(const term of terms)assert.ok(page.includes(term),`${path} missing ${term}`);
 }
});

test('코인 경마는 방문 시각이 아니라 Binance 공통 5분 봉 시가로 시작한다',()=>{
 assert.ok(app.includes("const RACE_STREAMS = RACE_COINS.map(sym => `${sym.toLowerCase()}usdt@kline_5m`).join('/');"));
 assert.ok(app.includes("new WebSocket('wss://stream.binance.com:9443/stream?streams=' + RACE_STREAMS)"));
 assert.ok(app.includes('`${SPOT_DATA_API}/klines?symbol=${symbol}USDT&interval=5m&limit=1`'));
 const src=app.match(/function applyRaceKline\(data\) \{[\s\S]*?\n\}/)?.[0];
 const snapshotSrc=app.match(/function applyRaceSnapshot\(symbol, candle\) \{[\s\S]*?\n\}/)?.[0];
 const valuesSrc=app.match(/function raceValues\(\) \{[\s\S]*?\n\}/)?.[0];
 assert.ok(src,'race kline adapter must be explicit and testable');
 assert.ok(snapshotSrc,'race snapshot adapter must be explicit and testable');
 assert.ok(valuesSrc,'race ranking must use an explicit shared candle window');
 const now=Math.floor(Date.now()/300000)*300000, ctx={RACE_COINS:['BTC','ETH'],race:{BTC:{start:null,last:null,openTime:null},ETH:{start:null,last:null,openTime:null}},raceRoundEnd:now+300000,Date,renderRace(){}};
 vm.createContext(ctx);
 vm.runInContext(snapshotSrc+'; applyRaceSnapshot("BTC",['+now+',"100","105","99","103",0,'+(now+299999)+']);',ctx);
 assert.equal(ctx.race.BTC.start,100,'race baseline must use Binance kline open');
 assert.equal(ctx.race.BTC.last,103,'initial race value must use the shared candle close');
 assert.equal(ctx.raceRoundEnd,now+300000,'initial race clock must use the candle close time');
 vm.runInContext(src+'; applyRaceKline({e:"kline",k:{s:"BTCUSDT",i:"5m",t:'+now+',o:"100",c:"104",T:'+(now+299999)+'}});',ctx);
 assert.equal(ctx.race.BTC.last,104,'live kline must advance the snapshot value');
 vm.runInContext('applyRaceSnapshot("BTC",['+now+',"100","105","99","101",0,'+(now+299999)+']);',ctx);
 assert.equal(ctx.race.BTC.last,104,'a late REST snapshot must not overwrite a live update');
 vm.runInContext('applyRaceKline({e:"kline",k:{s:"BTCUSDT",i:"5m",t:'+(now-300000)+',o:"90",c:"91",T:'+(now-1)+'}})',ctx);
 assert.equal(ctx.race.BTC.last,104,'an old candle must not roll the race back');
 vm.runInContext(valuesSrc+'; race.ETH={start:95,last:100,openTime:'+(now-300000)+'}; JSON.stringify(raceValues())',ctx);
 assert.equal(JSON.parse(vm.runInContext('JSON.stringify(raceValues())',ctx)).find(x=>x.sym==='ETH').pct,null,'previous-round values must not compete in the current race');
 vm.runInContext('applyRaceKline({e:"kline",k:{s:"ETHUSDT",i:"5m",t:'+(now+300000)+',o:"100",c:"101",T:'+(now+599999)+'}})',ctx);
 const current=JSON.parse(vm.runInContext('JSON.stringify(raceValues())',ctx));
 assert.equal(current.find(x=>x.sym==='BTC').pct,null,'a new round must hide other coins until their new candle arrives');
 assert.ok(Number.isFinite(current.find(x=>x.sym==='ETH').pct),'the first coin in a new round should update immediately');
 vm.runInContext('applyRaceKline({e:"kline",k:{s:"XYZUSDT",i:"5m",t:'+now+',o:"1",c:"2",T:'+(now+299999)+'}})',ctx);
 assert.equal(ctx.raceRoundEnd,now+600000,'unknown symbols must not move the shared race clock');
});

test('현물 REST는 Binance 공개 시세용 API를 사용하고, 조회 실패가 초기화를 깨지 않는다',()=>{
 assert.ok(app.includes("const SPOT_DATA_API = 'https://data-api.binance.vision/api/v3';"));
 assert.ok(!app.includes('https://api.binance.com/api/v3'),'spot reads should not use the general API host');
 assert.ok(app.includes("if (!quoteResponse.ok) return;"),'failed quote seed must not reject the startup task');
 assert.ok(app.includes('if (!Array.isArray(kl)) return;'),'invalid candle payload must be ignored');
 assert.ok(app.includes("'https://fapi.binance.com/fapi/v1'"),'futures market endpoint must remain unchanged');
 const policy=html.match(/Content-Security-Policy[^>]*content="([^"]+)"/)?.[1]||'';
 assert.ok(policy.includes('https://data-api.binance.vision'),'the spot data endpoint must be allowed by the home CSP');
 assert.ok(!policy.includes('https://api.binance.com'),'the unused general API origin should leave the home CSP');
});

test('넓은 화면은 우측 인덱스, 좁은 화면은 하단 독 — 어느 쪽이든 늘 보인다',()=>{
 const rail=html.match(/\.tabsWrap \{[^}]*\}/)[0];
 assert.ok(/position:fixed/.test(rail),'고정이 아니면 라운지를 보는 동안 사라진다');
 assert.ok(/right:max\(0px/.test(rail),'넓은 화면에서 본문 오른쪽 끝에 붙어야 한다');
 const wrap=html.match(/\.wrap \{[^}]*\}/)[0];
 assert.ok(/padding-right:158px/.test(wrap),'본문에 인덱스 폭만큼 여백이 없다');
 // 좁은 화면은 세로 레일이 아니라 하단 독. 세로 레일은 가로폭을 먹어 본문 글자가 깨졌다.
 const m=html.slice(html.indexOf('@media(max-width:760px){\n.tabsWrap{top:auto'));
 const dock=m.slice(0, m.indexOf('.macroHero'));
 assert.ok(/bottom:0/.test(dock)&&/left:0/.test(dock)&&/right:0/.test(dock),'독이 하단 전체 폭을 쓰지 않는다');
 assert.ok(/transform:none/.test(dock),'세로 가운데 정렬을 풀지 않았다');
 assert.ok(/flex-direction:row/.test(dock),'독은 가로로 놓여야 한다');
 assert.ok(/env\(safe-area-inset-bottom\)/.test(dock),'아이폰 홈 인디케이터 영역을 피해야 한다');
 assert.ok(!/\.tab \.nm\{display:none\}/.test(dock),'아이콘만 남기면 무슨 탭인지 알 수 없다');
 assert.ok(/padding:0 10px calc\(70px \+ env\(safe-area-inset-bottom\)\)/.test(html),'본문이 독 뒤로 가려진다');
 assert.ok(!/max-width:760px[^@]*padding-right:56px/.test(html),'좁은 화면에 가로 여백이 남아 있다');
 assert.ok(!/max-width:380px\)\{\.wrap\{padding-left:7px;padding-right:52px/.test(html),'초소형 화면 가로 여백 잔재');
 // 옛 가로 탭바 잔재
 assert.ok(!/\.tabs\{overflow-x:auto/.test(html),'가로 스크롤 탭바 규칙이 남아 있다');
 assert.ok(!/\.tabsWrap\{width:100%;order:3\}/.test(html),'탭바를 헤더 아래로 내리던 규칙이 남아 있다');
});

test('공유 앱 버전 갱신이 한국어 바로가기 7개에도 반영된다',()=>{
 const appBytes=fs.readFileSync(require.resolve('../lounge-app.js'),'utf8').replace(/\r\n/g,'\n');
 const appVersion=crypto.createHash('sha256').update(appBytes).digest('hex').slice(0,12);
 const pages=['../index.html','../blind/index.html','../domestic/index.html','../desk/index.html','../analysis/index.html','../onchain/index.html','../calendar/index.html','../strategists/index.html'];
 for(const page of pages){
  const source=fs.readFileSync(require.resolve(page),'utf8');
  assert.ok(source.includes(`/lounge-app.js?v=${appVersion}`),`${page} must load the current shared app`);
 }
 const start=builder.indexOf('def build_live_tools_only():');
 const liveOnly=builder.slice(start,builder.indexOf('\ndef stage(',start));
 assert.match(liveOnly,/for slug, selected, title, description in TOOL_PAGES:[\s\S]*?write\(f'\{slug\}\/index\.html'/,'live-only publishing must regenerate direct Korean tool routes');
});

test('블라인드 판 공유 이미지는 페이지 언어를 따라간다',()=>{
 const routes={ko:'../blind/index.html',en:'../en/tools/blind/index.html',zh:'../zh/tools/blind/index.html',ja:'../ja/tools/blind/index.html'};
 for(const [lang,path] of Object.entries(routes)){
  const page=fs.readFileSync(require.resolve(path),'utf8');
  const image=`https://tapelounge.com/home-og-${lang}-20261102.png`;
  assert.ok(fs.existsSync(require.resolve(`../home-og-${lang}-20261102.png`)),`${lang} preview asset must exist`);
  assert.ok(page.includes(`<meta property="og:image" content="${image}">`),`${lang} OG preview must use its localized card`);
  assert.ok(page.includes(`<meta name="twitter:image" content="${image}">`),`${lang} Twitter preview must use its localized card`);
 }
});

test('블라인드 차트 안내문에서 오늘의 판으로 바로 갈 수 있다',()=>{
 const routes={
  ko:['../ko/learn/blind-chart-practice/index.html','/blind/?daily=1','오늘의 판 플레이하기 ↗'],
  en:['../en/learn/blind-chart-practice/index.html','/en/tools/blind/?daily=1','Play today’s market replay ↗'],
  zh:['../zh/learn/blind-chart-practice/index.html','/zh/tools/blind/?daily=1','开始今天的行情回放 ↗'],
  ja:['../ja/learn/blind-chart-practice/index.html','/ja/tools/blind/?daily=1','今日の相場リプレイを始める ↗'],
 };
 for(const [lang,[path,href,label]] of Object.entries(routes)){
  const page=fs.readFileSync(require.resolve(path),'utf8');
  const byline=page.indexOf('<p class="byline">');
  const afterByline=page.indexOf('</p>',byline)+4;
  assert.ok(byline>=0&&afterByline>3,`${lang} guide must retain its byline`);
  assert.ok(page.slice(afterByline,afterByline+250).includes(`href="${href}"`),`${lang} game CTA must follow the introduction`);
  assert.ok(page.slice(afterByline,afterByline+250).includes(label),`${lang} CTA must be localized`);
  assert.ok(page.includes(`<aside class="article-end"><p><a class="" href="${href}">${label}</a></p>`),`${lang} game CTA must remain at the article end`);
 }
 const sitemap=fs.readFileSync(require.resolve('../sitemap.xml'),'utf8');
 for(const lang of Object.keys(routes)){
  const loc=`https://tapelounge.com/${lang==='ko'?'ko/':`${lang}/`}learn/blind-chart-practice/`;
  assert.ok(sitemap.includes(`<loc>${loc}</loc><lastmod>2026-11-02</lastmod>`),`${lang} guide sitemap date must match its actual last edit`);
 }
});

// 배지: 라운지가 이미 들고 있는 macroData 로만 만든다
function badge(events, nowIso){
  const src=app.match(/function setTabBadge[\s\S]*?\nsetInterval\(refreshTabBadges, 60000\);/)[0];
  let text=null, note=null, removed=false;
  const el={ querySelector:()=>null, appendChild:o=>{el._b=o}, _b:null };
  const ctx={ macroData:{events}, Math, Array, Number, Date,
    document:{ querySelector:()=>el, createElement:()=>({ set textContent(v){text=v}, set title(v){note=v} }) } };
  ctx.setInterval=()=>0;
  vm.createContext(ctx);
  const now=Date.parse(nowIso);
  ctx.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[now])) } static now(){ return now } };
  vm.runInContext(src+'\nrefreshTabBadges();',ctx);
  return text;
}
const ev=(minsAhead,code,imp,now)=>({code,title:code,importance:imp,
  scheduled_at:new Date(Date.parse(now)+minsAhead*60000).toISOString()});

test('발표장 배지는 하루 안으로 다가온 VIP·MAIN 발표에만 붙는다',()=>{
 const N='2026-09-22T00:00:00Z';
 assert.equal(badge([ev(45,'CPI','VIP',N)],N),'45분');
 assert.equal(badge([ev(90,'CPI','VIP',N)],N),'90분');
 assert.equal(badge([ev(200,'FOMC','VIP',N)],N),'3시간');
 assert.equal(badge([ev(1440,'GDP','VIP',N)],N),'24시간','경계는 포함');
 assert.equal(badge([ev(1441,'GDP','VIP',N)],N),null,'하루 넘으면 붙이지 않는다');
 assert.equal(badge([ev(60,'TRADE','SIDE',N)],N),null,'SIDE 는 알리지 않는다');
 assert.equal(badge([ev(-30,'CPI','VIP',N)],N),null,'이미 지난 발표');
 assert.equal(badge([],N),null); assert.equal(badge([{importance:'VIP'}],N),null,'시각이 없는 항목');
 // 가장 가까운 것을 고르는지
 assert.equal(badge([ev(600,'GDP','VIP',N),ev(30,'CPI','VIP',N)],N),'30분');
});

test('배지는 라운지가 이미 받은 달력만 쓰고, 숨은 탭을 위해 따로 조회하지 않는다',()=>{
 const src=app.match(/function refreshTabBadges[\s\S]*?\n\}/)[0];
 assert.ok(!/fetch|sbc\.from/.test(src),'배지가 직접 네트워크를 부르면 안 된다');
 assert.ok(/macroData/.test(src));
 assert.ok(/refreshTabBadges\(\);\}/.test(app.match(/macroData=await response\.json\(\);[^\n]*/)[0]+'}'),'달력을 받은 뒤 갱신해야 한다');
});

console.log(tests+' nav checks passed');
