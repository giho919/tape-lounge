const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const campaign=require('../site-campaign.js');
const app=fs.readFileSync(path.join(__dirname,'../lounge-app.js'),'utf8');
const query=(source,name,medium='social')=>new URLSearchParams({utm_source:source,utm_medium:medium,utm_campaign:name}).toString();
for(const source of ['threads','x','twitter'])for(const name of campaign.topics){
 const raw=query(source,name),parsed={source:source==='twitter'?'x':source,campaign:name};
 assert.deepEqual(campaign.parse(raw),parsed);
 assert.deepEqual(campaign.parse(query(source,name+'_20261031')), {...parsed,campaign:name+'_20261031'});
 assert.deepEqual(campaign.route(raw),{rpc:'record_site_campaign_activity',fields:{p_campaign_source:parsed.source,p_campaign_name:name}});
}
for(const raw of ['',query('google','site_launch'),query('threads','private-secret'),query('threads','andy_scan','email'),query('x','andy_scan_202610310'),query('x','https://example.com/key'),query('threads','andy_scan')+'&utm_source=x','utm_source=threads&utm_medium=social']){
 assert.equal(campaign.parse(raw),null,raw);
 assert.deepEqual(campaign.route(raw),{rpc:'record_site_activity',fields:{}});
}
assert.deepEqual(campaign.parse(query(' THREADS ',' ANDY_SCAN ')),{source:'threads',campaign:'andy_scan'});
const shared=query('share','decision_game','referral');
assert.deepEqual(campaign.parse(shared),{source:'share',campaign:'decision_game'});
assert.deepEqual(campaign.route(shared),{rpc:'record_site_campaign_activity',fields:{p_campaign_source:'share',p_campaign_name:'decision_game'}});
const dailyShared=query('share','daily_blind','referral');
assert.deepEqual(campaign.parse(dailyShared),{source:'share',campaign:'daily_blind'});
assert.deepEqual(campaign.route(dailyShared),{rpc:'record_site_campaign_activity',fields:{p_campaign_source:'share',p_campaign_name:'daily_blind'}});
for(const raw of [query('share','decision_game'),query('threads','decision_game','referral'),query('share','site_launch','referral'),query('share','daily_blind')]) assert.equal(campaign.parse(raw),null,raw);
const link=new URL(campaign.tag('https://tapelounge.com/?chart=ETH&tf=4h&internal=1&room=PRIVATE&token=SECRET#loungeChart','threads','andy_scan_20261031'));
assert.equal(link.origin,'https://tapelounge.com');
assert.equal(link.searchParams.get('chart'),'ETH');assert.equal(link.searchParams.get('tf'),'4h');assert.equal(link.hash,'#loungeChart');
assert.equal(link.searchParams.get('internal'),null);assert.equal(link.searchParams.get('room'),null);assert.equal(link.searchParams.get('token'),null);
assert.equal([...link.searchParams.keys()].length,5);
assert.equal(new URL(campaign.tag('https://tapelounge.com/blind/?daily=2026-10-31','x','daily_blind')).searchParams.get('daily'),'2026-10-31');
const directBlind=new URL(campaign.tagDailyBlindShare('https://tapelounge.com/blind/?daily=2026-11-02&v=2&internal=1&session=PRIVATE'));
assert.equal(directBlind.href,'https://tapelounge.com/blind/?daily=2026-11-02&v=2&utm_source=share&utm_medium=referral&utm_campaign=daily_blind');
for(const lang of ['en','zh','ja']){
 const localizedBlind=new URL(campaign.tagDailyBlindShare(`https://tapelounge.com/${lang}/tools/blind/?daily=2026-11-02&v=2&internal=1`));
 assert.equal(localizedBlind.href,`https://tapelounge.com/${lang}/tools/blind/?daily=2026-11-02&v=2&utm_source=share&utm_medium=referral&utm_campaign=daily_blind`);
 assert.equal(new URL(campaign.tag(`https://tapelounge.com/${lang}/tools/blind/?daily=2026-11-02`,'threads','daily_blind')).searchParams.get('daily'),'2026-11-02');
}
for(const target of ['https://tapelounge.com/blind/?daily=2026-02-30','https://tapelounge.com/blind/?daily=2026-11-02&v=1','https://tapelounge.com/decision/?daily=2026-11-02','https://evil.example/blind/?daily=2026-11-02'])assert.throws(()=>campaign.tagDailyBlindShare(target));
const inviteHelper=app.match(/function bgDailyInviteUrl\(day,version\) \{[\s\S]*?\n\}/)?.[0];
const resultHelper=app.match(/function bgDailyShareText\(chosen,result\) \{[\s\S]*?\n\}/)?.[0];
const inviteAction=app.match(/async function bgShareDailyChallenge\(statusId = 'bgDailyInviteStatus', copyId = 'bgDailyInviteCopy'\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(inviteHelper&&resultHelper,'daily challenge and result shares must use one attributable link');
assert.ok(inviteAction,'home and game invites must use the same daily share action');
const rawDaily='https://tapelounge.com/blind/?daily=2026-11-02&v=2';
const shareContext={window:{TapeCampaign:campaign,BlindDaily:{url:()=>rawDaily,shareText:()=>`Result\n${rawDaily}`}}};
assert.equal(vm.runInNewContext(`${inviteHelper}; bgDailyInviteUrl('2026-11-02',2)`,shareContext),campaign.tagDailyBlindShare(rawDaily));
assert.equal(vm.runInNewContext(`${resultHelper}; bgDailyShareText({day:'2026-11-02',version:2},{roi:1})`,shareContext),`Result\n${campaign.tagDailyBlindShare(rawDaily)}`);
(async()=>{
 const day='2026-11-02';
 const run=async(lang,version,native=true)=>{
  const status={isConnected:true,hidden:true,textContent:''},copy={isConnected:true,hidden:true,value:'',focus(){},select(){}};
  const seen={};
  const context={
   bgDailySelection:null,bgDailyQuery:null,
   window:{BlindDaily:{requestedDay:()=>day,selection:()=>({version}),dayKey:()=>day,url:(d,v)=>`https://tapelounge.com/${lang==='ko'?'':`${lang}/tools/`}blind/?daily=${d}${v===2?'&v=2':''}`},TapeCampaign:campaign},
   document:{documentElement:{lang}},
   navigator:{share:native?async value=>{seen.payload=value;}:undefined,clipboard:{writeText:async value=>{seen.clip=value;}}},
   $:id=>id==='status'?status:copy,URL,URLSearchParams,
  };
  await vm.runInNewContext(`${inviteHelper};${inviteAction};bgShareDailyChallenge('status','copy')`,context);
  return {status,copy,...seen};
 };
 const english=await run('en',2,true);
 assert.match(english.payload.title,/today’s round/);
 assert.match(english.payload.text,/U\.S\. stock chart.*200 trading days/);
 assert.equal(english.payload.url,'https://tapelounge.com/en/tools/blind/?daily=2026-11-02&v=2&utm_source=share&utm_medium=referral&utm_campaign=daily_blind');
 assert.equal(english.status.textContent,'Choose an app to share with.');
 const copied=await run('ko',2,false);
 assert.match(copied.clip,/미국 주식 차트/);
 assert.match(copied.clip,/utm_campaign=daily_blind/);
 assert.equal(copied.status.textContent,'초대 문구와 판 링크를 복사했어요.');
 console.log('Daily invite share sheet and clipboard fallback preserve locale and attributable public URLs.');
})().catch(error=>{console.error(error);process.exitCode=1;});
for(const target of ['https://evil.example/','http://tapelounge.com/','https://tapelounge.com/ops/','https://user:pass@tapelounge.com/'])assert.throws(()=>campaign.tag(target,'threads','site_launch'));
assert.throws(()=>campaign.tag('https://tapelounge.com/','threads','anything-private'));
const decisionTemplate=fs.readFileSync(path.join(__dirname,'decision-template.html'),'utf8');
assert.match(decisionTemplate,/<script defer src="\/site-campaign\.js\?v=__ANALYTICS_VERSION__"><\/script>\s*<script defer src="\/discovery-analytics\.js\?v=__ANALYTICS_VERSION__"><\/script>/);
assert.match(decisionTemplate,/new URL\(location\.pathname,'https:\/\/tapelounge\.com'\)/);
assert.match(decisionTemplate,/utm_source','share'.*utm_medium','referral'.*utm_campaign','decision_game'/);
console.log('Owned campaign parsing, canonical labels, strict allowlists, separate RPC selection, safe deep links and private-query stripping passed.');
