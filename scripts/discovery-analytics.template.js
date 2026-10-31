/* Existing anonymous analytics contract; no authentication, presence or account API. */
(()=>{'use strict';
const random=()=>crypto.randomUUID(),params=new URLSearchParams(location.search);
if(document.body.dataset.entry==='root'&&['desk','analysis','onchain','calendar','blind','game','market','domestic','research','strategists','chars'].includes(location.hash.slice(1)))return;
let id=random(),internal=params.get('internal')==='1';
try{if(params.get('internal')==='1')localStorage.setItem('tapeInternal','1');else if(params.get('internal')==='0')localStorage.removeItem('tapeInternal');internal=params.get('internal')==='1'||(params.get('internal')!=='0'&&localStorage.getItem('tapeInternal')==='1');id=localStorage.getItem('tapeVisitorId')||id;localStorage.setItem('tapeVisitorId',id);}catch{}
const session=random(),page=document.body.dataset.page||'',tab=page==='markets'?'domestic':page===''?'lounge':'chars';
let input=performance.now(),last=input,hidden=document.hidden,ended=false;
let ref=null;try{const h=new URL(document.referrer).hostname;if(h!==location.hostname)ref=h;}catch{}
const campaign=window.TapeCampaign?.route(location.search)||{rpc:'record_site_activity',fields:{}};
function send(seconds=0,view=false,keepalive=false){if(internal)return;fetch('__PUBLIC_URL__/rest/v1/rpc/'+campaign.rpc,{method:'POST',keepalive,headers:{apikey:'__PUBLISHABLE_KEY__','Content-Type':'application/json'},body:JSON.stringify({p_visitor_id:id,p_session_id:session,p_tab:tab,p_active_seconds:Math.max(0,Math.min(60,Math.round(seconds))),p_is_view:view,p_referrer_host:ref,p_internal:false,...campaign.fields})}).catch(()=>{});}
function flush(keepalive=false){const now=performance.now();if(!hidden){const seconds=Math.max(0,(Math.min(now,input+300000)-last)/1000);if(seconds>=1)send(seconds,false,keepalive);}last=now;}
['pointerdown','keydown','wheel','touchstart','scroll'].forEach(ev=>addEventListener(ev,()=>{input=performance.now();},{capture:true,passive:true}));
send(0,true);const timer=setInterval(()=>flush(),60000);
document.addEventListener('visibilitychange',()=>{flush(document.hidden);hidden=document.hidden;last=performance.now();});
addEventListener('pagehide',()=>{if(ended)return;ended=true;flush(true);clearInterval(timer);});
addEventListener('pageshow',ev=>{if(ev.persisted)location.reload();});
})();
