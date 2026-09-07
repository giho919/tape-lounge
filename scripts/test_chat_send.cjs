const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
const code = html.slice(html.indexOf('let _lastChat ='), html.indexOf('window.chatSend = chatSend;') + 'window.chatSend = chatSend;'.length);
async function scenario({fail=false,auth=true,concurrent=false,newDraft=false}={}) {
  const nodes = {chatTxt:{value:'test draft',parentElement:{insertAdjacentElement(_,x){nodes[x.id]=x;}}},chatSendBtn:{disabled:false,textContent:'전송'}};
  let calls=0, resolve;
  const pending = new Promise(r=>{resolve=r});
  const context = {window:{},Date,console:{warn(){}},$:id=>nodes[id],myNick:'tester',myUid:auth?'uid':null,
    setNick(){},ensureAuth:async()=>{},document:{createElement(){return {style:{},setAttribute(){}};}},
    sbc:{from(){return {async insert(){calls++; if(concurrent) await pending; if(fail) throw Error('network'); return {error:null};}}}}};
  vm.createContext(context); vm.runInContext(code, context);
  const first = context.window.chatSend();
  await Promise.resolve(); await Promise.resolve();
  if(concurrent) {
    await context.window.chatSend();
    if(newDraft) nodes.chatTxt.value='next draft';
    resolve();
  }
  await first;
  assert.equal(nodes.chatSendBtn.disabled,false);
  if(fail || !auth){assert.equal(nodes.chatTxt.value,'test draft'); assert.ok(nodes.chatSendStatus.textContent);}
  else {assert.equal(nodes.chatTxt.value,newDraft?'next draft':'');}
  assert.equal(calls,auth?1:0);
}
(async()=>{
  await scenario(); await scenario({fail:true}); await scenario({auth:false});
  await scenario({concurrent:true}); await scenario({concurrent:true,newDraft:true});
  console.log('5 chat-send scenarios passed');
})().catch(e=>{console.error(e);process.exitCode=1});
