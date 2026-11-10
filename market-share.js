/* Share the current, fresh market-table snapshot as a branded image. */
(()=>{'use strict';
const button=document.getElementById('market-share-button'),rowsNode=document.getElementById('market-rows'),status=document.getElementById('market-share-status');
if(!button||!rowsNode||!status)return;
let copy;try{copy=JSON.parse(button.dataset.copy||'{}');}catch{return;}
const locale={ko:'ko-KR',en:'en-US',zh:'zh-CN',ja:'ja-JP'}[document.documentElement.lang]||'ko-KR';
const text=(key)=>String(copy[key]||'');
function quoteTime(){const value=Number(rowsNode.dataset.observedAt);return Number.isFinite(value)&&value>0?value:0;}
function currentRows(){return [...rowsNode.querySelectorAll('tr[data-market-symbol]')].slice(0,8).map(row=>{const cells=row.querySelectorAll('td');return{symbol:row.dataset.marketSymbol,price:cells[1]?.textContent.trim()||'—',change:cells[2]?.textContent.trim()||'—',premium:cells[3]?.textContent.trim()||'—',volume:cells[4]?.textContent.trim()||'—'};}).filter(row=>/^[A-Z0-9]{1,24}$/.test(row.symbol||''));}
function fresh(){const at=quoteTime();return at>0&&Date.now()-at<120000;}
function update(){const hasRows=currentRows().some(row=>row.price!=='—');button.disabled=!fresh()||!hasRows;if(!fresh())status.textContent=quoteTime()?text('stale'):text('waiting');else if(!hasRows)status.textContent=text('empty');else if(status.textContent===text('waiting')||status.textContent===text('stale')||status.textContent===text('empty'))status.textContent='';}
const observer=new MutationObserver(update);observer.observe(rowsNode,{childList:true,subtree:true,attributes:true,attributeFilter:['data-observed-at']});update();
function roundedRect(ctx,x,y,w,h,r){const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();}
function stamp(at){return new Intl.DateTimeFormat(locale,{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at))+' KST';}
function makeImage(data,at){
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1500;const g=canvas.getContext('2d');if(!g)throw Error('Canvas unavailable');
 g.fillStyle='#f5f3ed';g.fillRect(0,0,1200,1500);
 g.strokeStyle='#d8dbd0';g.lineWidth=2;roundedRect(g,26,26,1148,1448,18);g.stroke();
 g.fillStyle='#b44828';g.font='600 22px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText('TAPE LOUNGE  ·  MARKET INDEX',72,100);
 g.fillStyle='#212722';g.font='700 54px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText(text('title'),72,202,1000);
 g.fillStyle='#666d65';g.font='400 23px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText(text('updated')+'  ·  '+stamp(at),72,260,1000);
 g.strokeStyle='#b44828';g.lineWidth=2;g.beginPath();g.moveTo(72,306);g.lineTo(1128,306);g.stroke();
 const col={asset:84,price:460,change:635,premium:850,volume:1114};
 g.fillStyle='#666d65';g.font='600 18px Inter, "Segoe UI", "Noto Sans KR", sans-serif';
 g.textAlign='left';g.fillText(text('asset'),col.asset,374,230);
 g.textAlign='right';g.fillText(text('price'),col.price,374,300);g.fillText(text('change'),col.change,374,160);g.fillText(text('premium'),col.premium,374,200);g.fillText(text('volume'),col.volume,374,250);
 g.strokeStyle='#d8dbd0';g.beginPath();g.moveTo(72,400);g.lineTo(1128,400);g.stroke();
 const start=446,rowH=92;
 data.forEach((row,i)=>{const y=start+i*rowH,baseline=y+37;g.fillStyle=i%2?'#f0eee7':'#fffefa';roundedRect(g,68,y-22,1064,78,8);g.fill();g.fillStyle='#212722';g.font='700 27px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.textAlign='left';g.fillText(row.symbol,col.asset,baseline,220);g.fillStyle='#666d65';g.font='400 16px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText('USDT',col.asset,baseline+25,220);g.textAlign='right';g.fillStyle='#212722';g.font='600 24px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText(row.price,col.price,baseline,300);g.fillStyle=row.change.startsWith('-')?'#b44828':row.change==='—'?'#666d65':'#286a55';g.fillText(row.change,col.change,baseline,160);g.fillStyle=row.premium.startsWith('-')?'#b44828':row.premium==='—'?'#666d65':'#286a55';g.fillText(row.premium,col.premium,baseline,200);g.fillStyle='#555c55';g.font='500 22px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText(row.volume,col.volume,baseline,250);});
 const footer=446+data.length*rowH+64;g.strokeStyle='#d8dbd0';g.beginPath();g.moveTo(72,footer-24);g.lineTo(1128,footer-24);g.stroke();
 g.textAlign='left';g.fillStyle='#414a43';g.font='500 18px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText(text('source'),72,footer+16,1040);
 g.fillStyle='#666d65';g.font='400 16px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText(text('note'),72,footer+52,1040);
 g.textAlign='right';g.fillStyle='#b44828';g.font='700 26px Inter, "Segoe UI", "Noto Sans KR", sans-serif';g.fillText('tapelounge.com',1128,1440,600);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG export failed')),'image/png'));
}
async function download(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=`tapelounge-market-${new Date(quoteTime()).toISOString().slice(0,16).replace(/[:T]/g,'-')}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
button.addEventListener('click',async()=>{update();if(button.disabled){status.textContent=fresh()?text('empty'):text('stale');return;}const data=currentRows(),at=quoteTime();if(!data.length){status.textContent=text('empty');return;}button.disabled=true;try{const blob=await makeImage(data,at),file=new File([blob],`tapelounge-market-${new Date(at).toISOString().slice(0,10)}.png`,{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:text('title'),text:text('source')});status.textContent=text('shared');}catch(error){status.textContent=error?.name==='AbortError'?text('cancelled'):text('error');}}else{await download(blob);status.textContent=text('saved');}}catch{status.textContent=text('error');}finally{update();}});
document.addEventListener('visibilitychange',update);setInterval(update,15000);
})();
