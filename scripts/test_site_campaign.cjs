const assert=require('node:assert/strict');
const campaign=require('../site-campaign.js');
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
const link=new URL(campaign.tag('https://tapelounge.com/?chart=ETH&tf=4h&internal=1&room=PRIVATE&token=SECRET#loungeChart','threads','andy_scan_20261031'));
assert.equal(link.origin,'https://tapelounge.com');
assert.equal(link.searchParams.get('chart'),'ETH');assert.equal(link.searchParams.get('tf'),'4h');assert.equal(link.hash,'#loungeChart');
assert.equal(link.searchParams.get('internal'),null);assert.equal(link.searchParams.get('room'),null);assert.equal(link.searchParams.get('token'),null);
assert.equal([...link.searchParams.keys()].length,5);
assert.equal(new URL(campaign.tag('https://tapelounge.com/blind/?daily=2026-10-31','x','daily_blind')).searchParams.get('daily'),'2026-10-31');
for(const target of ['https://evil.example/','http://tapelounge.com/','https://tapelounge.com/ops/','https://user:pass@tapelounge.com/'])assert.throws(()=>campaign.tag(target,'threads','site_launch'));
assert.throws(()=>campaign.tag('https://tapelounge.com/','threads','anything-private'));
console.log('Owned campaign parsing, canonical labels, strict allowlists, separate RPC selection, safe deep links and private-query stripping passed.');
