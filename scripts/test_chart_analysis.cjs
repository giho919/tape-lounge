const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'chart-analysis.js'),'utf8');
let tests=0;function test(label,fn){fn();tests++;console.log('PASS',label);}
test('분석 탭은 유지하고 라운지 바로가기 버튼은 제거한다',()=>{
 assert(html.includes('data-tab="analysis"'));assert(html.includes('analysis:\'analysis\''));
 assert(!html.includes('data-analysis-open'));assert(html.includes("$('tab-analysis').classList.toggle('hidden'"));
 assert(html.includes("window.initChartAnalysis()"));
});
test('장기 차트가 기본이고 최근 차트는 접힌 비교 자료다',()=>{
 const start=html.indexOf('<section id="tab-analysis"');const end=html.indexOf('<section id="tab-domestic"',start);const section=html.slice(start,end);
 assert(section.indexOf('linear-long.svg')<section.indexOf('linear-recent.svg'));
 assert(/<details class="ca-recent" id="caRecent">/.test(section));
 assert.equal((section.match(/data-ca-image/g)||[]).length,2);
 assert(!/<img[^>]+\ssrc=/.test(section),'숨은 탭은 이미지를 요청하면 안 된다');
 assert(section.includes('고정 분석 자료'));assert(section.includes('실시간으로 갱신되지 않으며'));
});
test('분석 기능은 시세·DB·주문 API를 호출하지 않는다',()=>{
 assert(!/\bfetch\s*\(|new WebSocket|\.rpc\s*\(|\.from\s*\(/.test(js));
 const f=html.slice(html.indexOf('async function recordSiteActivity('),html.indexOf('function siteAnalyticsFlush('));
 assert(f.indexOf("if (activeTab === 'analysis') return;")<f.indexOf('analyticsPayload('));
});
test('hash 첫 진입과 lazy 초기화 경합을 처리한다',()=>{
 assert(js.includes("if (!section.classList.contains('hidden')) init();"));
 assert(js.includes("image.hasAttribute('src')"));
 assert(js.includes("image.addEventListener('error'"));
 assert(js.includes("recent.addEventListener('toggle'"));
});
test('새 스크립트와 기존 인라인 스크립트가 모두 문법 검증을 통과한다',()=>{
 new vm.Script(js);for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
});
test('독립 경로가 internal 매개변수를 보존한다',()=>{
 const redirect=fs.readFileSync(path.join(root,'analysis','index.html'),'utf8');assert(redirect.includes("location.search+'#analysis'"));
});
console.log(tests+' chart analysis checks passed');
