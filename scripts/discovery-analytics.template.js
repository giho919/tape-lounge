/* Existing anonymous analytics contract; no authentication, presence or account API. */
(()=>{'use strict';
const random=()=>crypto.randomUUID(),params=new URLSearchParams(location.search);
if(document.body.dataset.entry==='root'&&['desk','analysis','onchain','calendar','blind','game','market','domestic','research','strategists','chars'].includes(location.hash.slice(1)))return;
let id=random(),internal=params.get('internal')==='1';
try{if(params.get('internal')==='1')localStorage.setItem('tapeInternal','1');else if(params.get('internal')==='0')localStorage.removeItem('tapeInternal');internal=params.get('internal')==='1'||(params.get('internal')!=='0'&&localStorage.getItem('tapeInternal')==='1');id=localStorage.getItem('tapeVisitorId')||id;localStorage.setItem('tapeVisitorId',id);}catch{}
const automated=navigator.webdriver===true||/(?:googlebot|google-inspectiontool|googleother|google-agent|storebot-google|bingbot|duckduckbot|baiduspider|yandexbot|applebot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|redditbot|pinterestbot|ahrefsbot|semrushbot|mj12bot|bytespider|gptbot|claudebot|perplexitybot|crawler|spider|headlesschrome|phantomjs|lighthouse|pagespeed)/i.test(navigator.userAgent||'');
const session=random(),page=document.body.dataset.page||'',entryTab=document.body.dataset.entryTab||'',validTabs=new Set(['lounge','desk','chain','macro','game','chars','domestic','analysis','learn','watch','research','about']),tab=validTabs.has(entryTab)?entryTab:page==='markets'?'domestic':page==='decision'?'game':page==='learn'||page.startsWith('learn/')?'learn':['watch','research','about'].includes(page)?page:page===''?'lounge':'chars';
let input=performance.now(),last=input,hidden=document.hidden,ended=false,qualified=false,qualifyTimer=null;
let qualificationVisibleSeconds=0,visibleSince=hidden?null:input;
let ref=null;try{const h=new URL(document.referrer).hostname;if(h!==location.hostname)ref=h;}catch{}
const campaign=window.TapeCampaign?.route(location.search)||{rpc:'record_site_activity',fields:{}};
const rpc=campaign.rpc==='record_site_campaign_activity'?'record_site_campaign_activity_page':'record_site_activity_page';
const pageKey=window.TapeCampaign?.pageKey(location.pathname)||'other';
function send(seconds=0,view=false,keepalive=false){if(internal||automated)return Promise.resolve(false);return fetch('__PUBLIC_URL__/rest/v1/rpc/'+rpc,{method:'POST',keepalive,headers:{apikey:'__PUBLISHABLE_KEY__','Content-Type':'application/json'},body:JSON.stringify({p_visitor_id:id,p_session_id:session,p_tab:tab,p_active_seconds:Math.max(0,Math.min(60,Math.round(seconds))),p_is_view:view,p_referrer_host:ref,p_internal:false,p_page_key:pageKey,...campaign.fields})}).then(response=>response.ok).catch(()=>false);}
const initialView=send(0,true,true);
window.TapeAnalytics=Object.freeze({decisionEvent:async eventType=>{if(internal||automated||!['start','complete'].includes(eventType))return false;await initialView;return fetch('__PUBLIC_URL__/rest/v1/rpc/record_decision_game_event',{method:'POST',keepalive:true,headers:{apikey:'__PUBLISHABLE_KEY__','Content-Type':'application/json'},body:JSON.stringify({p_visitor_id:id,p_event_type:eventType,p_internal:false})}).then(response=>response.ok).catch(()=>false);}});
function qualify(){if(qualified||automated||hidden)return;const now=performance.now(),visibleSeconds=qualificationVisibleSeconds+(visibleSince===null?0:Math.max(0,(now-visibleSince)/1000));qualified=true;clearTimeout(qualifyTimer);qualifyTimer=null;qualificationVisibleSeconds=0;visibleSince=null;input=last=now;send(visibleSeconds,false);}
function scheduleQualification(){if(qualified||automated||hidden||qualifyTimer!==null)return;qualifyTimer=setTimeout(()=>{qualifyTimer=null;qualify();},5000);}
function flush(keepalive=false){const now=performance.now();if(qualified&&!hidden){const seconds=Math.max(0,(Math.min(now,input+300000)-last)/1000);if(seconds>=1)send(seconds,false,keepalive);}last=now;}
['pointerdown','keydown','wheel','touchstart','scroll'].forEach(ev=>addEventListener(ev,()=>{input=performance.now();scheduleQualification();},{capture:true,passive:true}));
scheduleQualification();const timer=setInterval(()=>{if(qualified)flush();},60000);
document.addEventListener('visibilitychange',()=>{const now=performance.now();flush(document.hidden);if(!qualified){if(document.hidden){if(visibleSince!==null)qualificationVisibleSeconds+=Math.max(0,(now-visibleSince)/1000);visibleSince=null;}else visibleSince=now;}hidden=document.hidden;last=now;if(hidden){clearTimeout(qualifyTimer);qualifyTimer=null;}else scheduleQualification();});
addEventListener('pagehide',()=>{if(ended)return;ended=true;if(qualified)flush(true);else{const now=performance.now(),seconds=qualificationVisibleSeconds+(visibleSince===null?0:Math.max(0,(now-visibleSince)/1000));if(seconds>=1)send(seconds,false,true);}clearInterval(timer);clearTimeout(qualifyTimer);});
addEventListener('pageshow',ev=>{if(ev.persisted)location.reload();});
})();
