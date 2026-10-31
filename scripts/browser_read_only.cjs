// Test isolation must survive page unload: keepalive fetches can outlive routing.
// Install before navigation, in addition to network interception.
module.exports=async function browserReadOnly(target){
 const networkBlocked=[];
 await target.addInitScript(()=>{
  window.__tapeTestBlockedWrites=0;
  window.__tapeTestAnalytics=[];
  const readMethods=new Set(['GET','HEAD','OPTIONS']);
  const originalFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
   if(!readMethods.has(method)){
    window.__tapeTestBlockedWrites++;
    const url=typeof input==='string'?input:input.url;
    if(/\/rpc\/record_site_(?:campaign_)?activity(?:\?|$)/.test(url||'')){
     try{window.__tapeTestAnalytics.push(JSON.parse(init?.body));}catch{}
    }
    return Promise.reject(new TypeError('Test blocked a network write'));
   }
   return originalFetch(input,init);
  };
  navigator.sendBeacon=()=>{window.__tapeTestBlockedWrites++;return false;};
 });
 await target.route('**/*',route=>{
  if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){
   networkBlocked.push(route.request().url());return route.abort();
  }
  return route.continue();
 });
 return networkBlocked;
};
