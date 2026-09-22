// 측면 인덱스 탭 구조와 발표장 배지. 브라우저 없이 index.html 을 읽어 검사한다.
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
let tests=0; const test=(l,f)=>{f();tests++;console.log('PASS',l);};

const TABS=['lounge','domestic','desk','chain','macro','game','chars'];

test('탭 일곱 개가 아이콘과 이름을 따로 들고, 기존 선택 로직 계약을 지킨다',()=>{
 const block=html.slice(html.indexOf('<div class="tabs"'), html.indexOf('</div>',html.indexOf('data-tab="chars"'))+6);
 for(const t of TABS){
  const re=new RegExp(`data-tab="${t}"[^>]*>\\s*<i class="ic" aria-hidden="true">([^<]+)</i><span class="nm">([^<]+)</span>`);
  const m=block.match(re);
  assert.ok(m,`${t} 탭이 아이콘/이름 구조가 아니다`);
  assert.ok(m[1].trim()&&m[2].trim(),t);
 }
 assert.equal((block.match(/role="tab"/g)||[]).length,7);
 assert.ok(block.includes('aria-orientation="vertical"'),'세로 탭임을 알려야 한다');
 assert.equal((block.match(/class="tab on"/g)||[]).length,1,'처음 선택된 탭은 하나');
 // 기존 스크립트가 쓰는 선택자를 그대로 유지하는지
 assert.ok(html.includes("document.querySelectorAll('.tab').forEach"),'선택 로직이 .tab 을 계속 쓴다');
 for(const t of TABS)assert.ok(html.includes(`'${t}'`)||html.includes(`"${t}"`),t);
});

test('인덱스는 스크롤과 무관하게 고정되고, 본문이 그 아래로 들어가지 않는다',()=>{
 const rail=html.match(/\.tabsWrap \{[^}]*\}/)[0];
 assert.ok(/position:fixed/.test(rail),'고정이 아니면 라운지를 보는 동안 사라진다');
 assert.ok(/right:max\(0px/.test(rail),'넓은 화면에서 본문 오른쪽 끝에 붙어야 한다');
 const wrap=html.match(/\.wrap \{[^}]*\}/)[0];
 assert.ok(/padding-right:158px/.test(wrap),'본문에 인덱스 폭만큼 여백이 없다');
 assert.ok(/@media\(max-width:760px\)\{\.tab\{width:46px/.test(html),'좁은 화면은 아이콘만 남겨야 한다');
 assert.ok(/padding-right:56px/.test(html),'좁은 화면 본문 여백');
 // 옛 가로 탭바 잔재
 assert.ok(!/\.tabs\{overflow-x:auto/.test(html),'가로 스크롤 탭바 규칙이 남아 있다');
 assert.ok(!/\.tabsWrap\{width:100%;order:3\}/.test(html),'탭바를 헤더 아래로 내리던 규칙이 남아 있다');
});

// 배지: 라운지가 이미 들고 있는 macroData 로만 만든다
function badge(events, nowIso){
  const src=html.match(/function setTabBadge[\s\S]*?\nsetInterval\(refreshTabBadges, 60000\);/)[0];
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
 const src=html.match(/function refreshTabBadges[\s\S]*?\n\}/)[0];
 assert.ok(!/fetch|sbc\.from/.test(src),'배지가 직접 네트워크를 부르면 안 된다');
 assert.ok(/macroData/.test(src));
 assert.ok(/refreshTabBadges\(\);\}/.test(html.match(/macroData=await response\.json\(\);[^\n]*/)[0]+'}'),'달력을 받은 뒤 갱신해야 한다');
});

console.log(tests+' nav checks passed');
