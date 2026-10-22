/* Compatibility bridge, not a second market/chart implementation. */
document.addEventListener('DOMContentLoaded',()=>{
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
