/* Compatibility bridge, not a second market/chart implementation. */
document.addEventListener('DOMContentLoaded',()=>{
  let language='ko';try{language=JSON.parse(localStorage.getItem('tl_language'))||language;}catch{}
  const labels={ko:'← 새 홈 · 기존 차트와 라운지',en:'← Home · Classic terminal in Korean',zh:'← 首页 · 韩语经典终端',ja:'← ホーム · 韓国語の従来ターミナル'};
  if(!labels[language])language='ko';
  const back=document.createElement('a');back.href='/'+language+'/';back.textContent=labels[language];back.className='v2-backlink';
  document.querySelector('.wrap')?.prepend(back);
  const symbol=new URLSearchParams(location.search).get('asset');
  if(!symbol||!/^[A-Z0-9]{1,24}$/.test(symbol))return;
  if(['BTC','ETH'].includes(symbol)){
    document.querySelector('.tab[data-tab="lounge"]')?.click();
    if(typeof caroGo==='function')caroGo(symbol==='ETH'?1:0);
  }else if(window.TapeMarket){
    document.querySelector('.tab[data-tab="domestic"]')?.click();
    window.TapeMarket.open(symbol);
  }
},{once:true});
