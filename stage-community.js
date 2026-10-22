/* Existing chat/RLS/auth contract. Browsing creates no auth users or public messages. */
(()=>{'use strict';
let stage,scope='all',rows=[],busy=false,sending=false,timer=null,clientPromise=null,captchaPromise=null,widget=null,lastSent=0,currentScopeKey='',loadedFor='';
const $=id=>document.getElementById(id),prefix=id=>`[tl-scene:${id}] `;
const scenePrefix=/^\[tl-scene:([a-f0-9]{16})\]\s*/;
function context(){return stage?.getContext();}
function visible(){return stage&&!document.hidden&&!$('stage-panel-discussion').hidden;}
function updateScope(){const id=context()?.id;document.querySelector('[data-chat-scope="scene"]').disabled=!id;if(scope==='scene'&&!id)scope='all';document.querySelectorAll('[data-chat-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chatScope===scope)));$('stage-chat-input').maxLength=200-(scope==='scene'&&id?prefix(id).length:0);}
function render(){
 const {t,esc,at}=stage,feed=$('stage-chat-feed'),nearBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<45,top=feed.scrollTop;
 const id=context()?.id,visibleRows=scope==='scene'?rows.filter(r=>r.body?.startsWith(prefix(id))||r.body?.startsWith(prefix(id).trim())):rows;
 feed.innerHTML=visibleRows.length?visibleRows.map(r=>{const match=String(r.body||'').match(scenePrefix),text=match?String(r.body).slice(match[0].length):r.body,ai=r.author_type==='virtual';return `<article class="stage-chat-row"><header><b>${esc(r.nick)}</b><span class="stage-ai-tag">${ai?esc(t.ai):'HUMAN'}</span><time datetime="${esc(r.created_at)}">${esc(at(r.created_at))}</time></header>${match?`<a class="stage-chat-scene" href="/${document.documentElement.lang}/?scene=${match[1]}">↳ ${esc(t.record)}</a>`:''}<p>${esc(text)}</p></article>`;}).join(''):`<p class="stage-footnote">${esc(t.chatEmpty)}</p>`;
 if(nearBottom)feed.scrollTop=feed.scrollHeight;else feed.scrollTop=top;
}
async function load(){
 if(!visible()||busy)return;busy=true;const key=scope==='scene'?context()?.id||'all':'all';currentScopeKey=key;
 try{const query=new URLSearchParams({select:'id,created_at,nick,body,author_type,agent_key',order:'id.desc',limit:'50'});if(key!=='all')query.set('body','like.'+prefix(key).trim()+'*');const value=await stage.pub('salon_chat?'+query);if(!Array.isArray(value))throw Error('Chat');if(currentScopeKey!==key)return;rows=value.reverse();loadedFor=key;render();$('stage-chat-status').textContent=scope==='scene'?stage.t.sceneChat+' · '+context().title:stage.t.allChat;}
 catch{if(currentScopeKey===key)$('stage-chat-status').textContent=stage.t.delay;}finally{busy=false;if(currentScopeKey!==key&&visible())load();}
}
function script(url,integrity){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=url;if(integrity){el.integrity=integrity;el.crossOrigin='anonymous';}el.onload=resolve;el.onerror=reject;document.head.appendChild(el);});}
async function getClient(){
 if(!clientPromise)clientPromise=(async()=>{if(!window.supabase)await script(stage.config.sdk.url,stage.config.sdk.integrity);return window.supabase.createClient(stage.config.url,stage.config.key);})();
 try{return await clientPromise;}catch(e){clientPromise=null;throw e;}
}
async function captcha(){
 if(captchaPromise)return captchaPromise;
 captchaPromise=(async()=>{
  if(!window.turnstile)await script('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  const dialog=$('stage-auth-dialog');dialog.showModal();$('stage-auth-status').textContent='';
  return await new Promise((resolve,reject)=>{
   let settled=false;const finish=(error,token)=>{if(settled)return;settled=true;dialog.removeEventListener('close',closed);if(dialog.open)dialog.close();error?reject(error):resolve(token);};
   const closed=()=>finish(Error('Authentication cancelled'));dialog.addEventListener('close',closed,{once:true});
   if(widget!==null)window.turnstile.remove(widget);
   widget=window.turnstile.render('#stage-auth-widget',{sitekey:stage.config.turnstile,theme:'dark',callback:token=>finish(null,token),'error-callback':()=>finish(Error('Authentication failed')),'expired-callback':()=>finish(Error('Authentication expired'))});
  });
 })();
 try{return await captchaPromise;}finally{captchaPromise=null;}
}
async function send(event){
 event.preventDefault();if(sending||Date.now()-lastSent<3000)return;const original=$('stage-chat-input').value,nick=$('stage-chat-nick').value.trim(),draft=original.trim(),ctx=context();if(!draft||!nick)return;
 const body=(scope==='scene'&&ctx.id?prefix(ctx.id):'')+draft;if(body.length>200||nick.length>20){$('stage-chat-status').textContent=stage.t.sendFail;return;}
 sending=true;$('stage-chat-send').disabled=true;$('stage-chat-send').textContent=stage.t.sending;
 try{const client=await getClient(),existing=await client.auth.getSession();let user=existing.data?.session?.user;
  if(!user){const token=await captcha(),result=await client.auth.signInAnonymously({options:{captchaToken:token}});if(result.error||!result.data.user)throw Error('Authentication');user=result.data.user;}
  const result=await client.from('salon_chat').insert({nick,body,user_id:user.id});if(result.error)throw result.error;
  lastSent=Date.now();try{localStorage.setItem('salonNick',nick);}catch{}
  if($('stage-chat-input').value===original)$('stage-chat-input').value='';$('stage-chat-status').textContent=stage.t.sent;await load();
 }catch(error){$('stage-chat-status').textContent=String(error?.message||'').toLowerCase().includes('auth')?stage.t.authFail:stage.t.sendFail;}
 finally{sending=false;$('stage-chat-send').disabled=false;$('stage-chat-send').textContent=stage.t.send;}
}
function sync(){if(!stage)return;updateScope();clearInterval(timer);timer=null;if(visible()){load();timer=setInterval(load,15000);}}
function ready(){if(stage)return;stage=window.TapeStage;if(!stage)return;try{const old=localStorage.getItem('salonNick');if(old&&!old.startsWith('나 '))$('stage-chat-nick').value=old.slice(0,20);}catch{}
 $('stage-chat-form').onsubmit=send;document.querySelectorAll('[data-chat-scope]').forEach(button=>button.onclick=()=>{scope=button.dataset.chatScope;currentScopeKey='';rows=[];render();sync();});
 document.addEventListener('visibilitychange',sync);addEventListener('tl:stage-panel',sync);addEventListener('tl:stage-scene',()=>{currentScopeKey='';if(scope==='scene'){rows=[];render();}sync();});
 addEventListener('pagehide',()=>{clearInterval(timer);});updateScope();}
addEventListener('tl:stage-ready',ready,{once:true});if(window.TapeStage)ready();
})();
