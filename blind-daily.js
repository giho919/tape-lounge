/* Versioned deterministic practice round. No account, public ranking or upload. */
((root) => {
  'use strict';
  const VERSION = 1, STOCK_VERSION = 2, LAUNCH = '2026-10-31', STOCK_LAUNCH = '2026-11-02';
  const STORES = {1:'tapeBlindDailyV1',2:'tapeBlindDailyV2'};
  const STREAK_STORE = 'tapeBlindDailyStreakV1';
  const DAY = 86400000, TOTAL = 1000, DAILY_PLAY = 200;
  const PROGRESS_PREFIX = 'tapeBlindDailyProgressV1';
  const POOL = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','LTCUSDT'];
  const STOCK_POOL = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','AVGO','TSLA','JPM','V','MA','COST','NFLX','XOM','WMT','AMD'];
  // Frozen historical range: changing today's date must not change an old round.
  const FIRST = Date.parse('2021-06-01T00:00:00Z'), LAST = Date.parse('2025-12-31T00:00:00Z');
  function dayKey(now = new Date()) { return new Date(+now + 9*3600000).toISOString().slice(0,10); }
  function validDay(day) { return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day+'T00:00:00Z')) && new Date(day+'T00:00:00Z').toISOString().slice(0,10) === day; }
  function requestedDay(query, today = dayKey()) { return validDay(query) && query >= LAUNCH && query <= today ? query : today; }
  function hash(text) { let n=2166136261; for (const c of text) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; }
  function selection(day) {
    if (!validDay(day)) throw new Error('Invalid challenge date');
    if (day >= STOCK_LAUNCH) return {version:STOCK_VERSION,id:`v${STOCK_VERSION}-${day}`,day,track:'stock',asset:`/reports/blind_daily_stock_v2/${day}.json`};
    const symbol = POOL[hash(`tape-daily-v1:symbol:${day}`)%POOL.length];
    const endDay = FIRST + hash(`tape-daily-v1:date:${day}`)%(Math.round((LAST-FIRST)/DAY)+1)*DAY;
    return {version:VERSION, id:`v1-${day}`, day, symbol, endTime:endDay+DAY-1};
  }
  function validate(candles, chosen) {
    if (!Array.isArray(candles) || candles.length !== TOTAL) throw new Error('오늘의 차트 데이터를 온전히 받지 못했습니다. 같은 판으로 다시 시도해 주세요.');
    const lastDay = chosen.endTime - DAY + 1;
    for (let i=0; i<TOTAL; i++) {
      const k=candles[i], expected=lastDay-(TOTAL-1-i)*DAY;
      if (!Array.isArray(k) || +k[0]!==expected || +k[6]!==expected+DAY-1) throw new Error('오늘의 차트 날짜를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const [o,h,l,c,v]=k.slice(1,6).map(Number);
      if (![o,h,l,c,v].every(Number.isFinite) || Math.min(o,h,l,c)<=0 || v<0 || l>Math.min(o,c) || h<Math.max(o,c)) throw new Error('오늘의 차트 값에 오류가 있습니다. 잠시 후 다시 시도해 주세요.');
    }
    return candles;
  }
  function validateStock(payload,chosen) {
    const bars=payload?.bars, min=Date.parse('2020-01-01T00:00:00Z'), max=Date.parse('2026-01-01T00:00:00Z');
    if (chosen?.version!==STOCK_VERSION || payload?.version!==STOCK_VERSION || payload?.day!==chosen.day || payload?.market!=='stock' || !STOCK_POOL.includes(payload?.symbol) || !Array.isArray(bars) || bars.length!==TOTAL) throw new Error('오늘의 미국 주식 차트를 온전히 받지 못했습니다. 같은 판으로 다시 시도해 주세요.');
    let previous=min-1;
    for (const row of bars) {
      if (!Array.isArray(row) || row.length<6) throw new Error('오늘의 주식 차트 값을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const [time,o,h,l,c,v]=row.map(Number);
      if (![time,o,h,l,c,v].every(Number.isFinite) || time<=previous || time<min || time>=max || Math.min(o,h,l,c)<=0 || v<0 || l>Math.min(o,c) || h<Math.max(o,c)) throw new Error('오늘의 주식 차트 값에 오류가 있습니다. 잠시 후 다시 시도해 주세요.');
      previous=time;
    }
    return bars;
  }
  function url(day,version=selection(day).version,lang=root.document?.documentElement?.lang||'ko') {
    const locale=['en','zh','ja'].includes(lang)?lang:'ko';
    const path=locale==='ko'?'/blind/':`/${locale}/tools/blind/`;
    const u=new URL(path,'https://tapelounge.com');u.searchParams.set('daily',day);if(version===STOCK_VERSION)u.searchParams.set('v',String(STOCK_VERSION));return u.href;
  }
  function read(storage,version=VERSION) {
    try { const value=JSON.parse(storage.getItem(STORES[version]));return value?.version===version && Array.isArray(value.records) ? value.records.filter(r=>validDay(r.day)&&Number.isFinite(r.roi)&&Number.isFinite(r.bh)).slice(-30) : []; } catch { return []; }
  }
  function previousDay(day) { return new Date(Date.parse(day+'T00:00:00Z')-DAY).toISOString().slice(0,10); }
  function previousDays(day=dayKey(),limit=7) {
    if (!validDay(day)) day=dayKey();
    const count=Number.isSafeInteger(limit)?Math.max(0,Math.min(30,limit)):7;
    const days=[];
    while(days.length<count) {
      day=previousDay(day);
      if(day<LAUNCH)break;
      days.push(day);
    }
    return days;
  }
  function streak(storage,today=dayKey()) {
    if (!validDay(today)) today=dayKey();
    try {
      const value=JSON.parse(storage.getItem(STREAK_STORE));
      if (value?.version===1 && validDay(value.day) && Number.isSafeInteger(value.days) && value.days>0 && value.days<=36500) {
        if (value.day===today) return {days:value.days,playedToday:true,lastDay:value.day};
        if (value.day===previousDay(today)) return {days:value.days,playedToday:false,lastDay:value.day};
        return {days:0,playedToday:false,lastDay:value.day};
      }
    } catch {}
    return {days:0,playedToday:false,lastDay:null};
  }
  function updateStreak(storage,day) {
    if (day!==dayKey()) return streak(storage);
    let previous=null;
    try { previous=JSON.parse(storage.getItem(STREAK_STORE)); } catch {}
    let days=1;
    if (previous?.version===1 && validDay(previous.day) && Number.isSafeInteger(previous.days) && previous.days>0 && previous.days<=36500) {
      if (previous.day===day) days=previous.days;
      else if (previous.day===previousDay(day)) days=previous.days+1;
    }
    try { storage.setItem(STREAK_STORE,JSON.stringify({version:1,day,days})); } catch {}
    return {days,playedToday:true,lastDay:day};
  }
  function record(storage, day, result,version=VERSION) {
    const records=read(storage,version), old=records.find(r=>r.day===day);
    if (old || !result.completed || !validDay(day) || ![result.roi,result.bh].every(Number.isFinite)) return {saved:false,first:old||null,streak:old&&day===dayKey()?updateStreak(storage,day):streak(storage)};
    const first={day,roi:result.roi,bh:result.bh,finishedAt:result.finishedAt};
    try { storage.setItem(STORES[version],JSON.stringify({version,records:[...records,first].sort((a,b)=>a.day.localeCompare(b.day)).slice(-30)}));return {saved:true,first,streak:day===dayKey()?updateStreak(storage,day):streak(storage)}; }
    catch { return {saved:false,first:null,streak:streak(storage)}; }
  }
  function progressKey(day,version) { return `${PROGRESS_PREFIX}:${version}:${day}`; }
  function validProgress(value,day,version) {
    const speeds=[0.5,1,1.5,2,2.5,3,3.5,4],leverages=[1,2,3,5,10];
    if(!value||value.schema!==1||value.day!==day||value.roundVersion!==version||!validDay(day)||![1,2].includes(version))return false;
    if(!Number.isSafeInteger(value.dayIndex)||value.dayIndex<0||value.dayIndex>=DAILY_PLAY)return false;
    if(typeof value.symbol!=='string'||(version===1?value.symbol!==selection(day).symbol:!STOCK_POOL.includes(value.symbol)))return false;
    if(!Number.isFinite(value.wallet)||value.wallet<0||value.wallet>1e12)return false;
    if(!Number.isSafeInteger(value.orderPct)||value.orderPct<0||value.orderPct>100)return false;
    if(!leverages.includes(value.leverage)||!speeds.includes(value.speed))return false;
    if(!Number.isFinite(value.elapsedMs)||value.elapsedMs<0||value.elapsedMs>1e9)return false;
    if(value.pos!==null&&value.pos!==undefined){const p=value.pos;if(!p||!['long','short'].includes(p.side)||![p.qty,p.entry,p.margin].every(Number.isFinite)||p.qty<=0||p.entry<=0||p.margin<0||!leverages.includes(p.lev))return false;}
    if(!Array.isArray(value.trades)||value.trades.length>2000)return false;
    return value.trades.every(t=>t&&Number.isSafeInteger(t.day)&&t.day>=0&&t.day<=DAILY_PLAY&&['BUY','SELL'].includes(t.side)&&['LONG','SHORT','CLOSE','COVER','LIQ'].includes(t.intent)&&[t.px,t.amt,t.fee].every(Number.isFinite)&&t.px>0&&t.amt>=0&&t.fee>=0&&leverages.includes(t.lev));
  }
  function readProgress(storage,day,version) {
    if(!validDay(day)||![1,2].includes(version))return null;
    try {
      const value=JSON.parse(storage.getItem(progressKey(day,version)));
      if(!validProgress(value,day,version))return null;
      return {schema:1,day,roundVersion:version,symbol:value.symbol,dayIndex:value.dayIndex,wallet:value.wallet,
        pos:value.pos?{side:value.pos.side,qty:value.pos.qty,entry:value.pos.entry,margin:value.pos.margin,lev:value.pos.lev}:null,
        trades:value.trades.map(t=>({day:t.day,side:t.side,intent:t.intent,px:t.px,amt:t.amt,fee:t.fee,lev:t.lev})),
        speed:value.speed,orderPct:value.orderPct,leverage:value.leverage,elapsedMs:value.elapsedMs};
    } catch { return null; }
  }
  function writeProgress(storage,value) {
    if(!value||!validProgress(value,value.day,value.roundVersion))return false;
    try { storage.setItem(progressKey(value.day,value.roundVersion),JSON.stringify(value));return true; }
    catch { return false; }
  }
  function clearProgress(storage,day,version) {
    if(!validDay(day)||![1,2].includes(version))return false;
    try { storage.removeItem(progressKey(day,version));return true; }
    catch { return false; }
  }
  function shareText(chosen,result,lang=root.document?.documentElement?.lang||'ko') {
    const pct = value => `${value>=0?'+':''}${value.toFixed(2)}%`;
    const locale=['en','zh','ja'].includes(lang)?lang:'ko', stock=chosen.version===STOCK_VERSION, current=chosen.day===dayKey();
    const unit=locale==='ko'?(stock?'거래일':'일'):locale==='en'?(stock?'trading days':'days'):locale==='zh'?(stock?'个交易日':'天'):(stock?'取引日':'日');
    const status=result.completed
      ? locale==='ko'?`200${unit} 완주`:locale==='en'?`Completed 200 ${unit}`:locale==='zh'?`完成200${unit}`:`${stock?'200取引日':'200日'}完走`
      : result.bankrupt
        ? locale==='ko'?'파산 정산':locale==='en'?'Settled after liquidation':locale==='zh'?'强平结算':'清算で決済'
        : locale==='ko'?`${result.days}${unit} 중간 정산`:locale==='en'?`${result.days} ${unit} · settled early`:locale==='zh'?`${result.days}${unit} · 提前结算`:`${result.days}${unit}・途中精算`;
    if(locale==='en') return `Tape Lounge · ${chosen.day} ${current?'Daily round':'Past round'}\n${status} · Return ${pct(result.roi)}\nBuy and hold over the same period ${pct(result.bh)} (before fees)\nPaper chart practice · Open positions valued at the final close\n${url(chosen.day,chosen.version,locale)}`;
    if(locale==='zh') return `Tape Lounge · ${chosen.day} ${current?'今日牌局':'历史牌局'}\n${status} · 我的收益 ${pct(result.roi)}\n同期买入持有 ${pct(result.bh)}（未扣费用）\n历史行情模拟练习 · 未平仓位按最后收盘价估值\n${url(chosen.day,chosen.version,locale)}`;
    if(locale==='ja') return `Tape Lounge · ${chosen.day} ${current?'今日の一局':'過去の一局'}\n${status}・リターン ${pct(result.roi)}\n同期間の買い持ち ${pct(result.bh)}（手数料前）\n過去チャートの模擬練習・残ったポジションは最終終値で評価\n${url(chosen.day,chosen.version,locale)}`;
    return `Tape Lounge · ${chosen.day} ${current?'오늘의 판':'지난 판'}\n${status} · 내 수익률 ${pct(result.roi)}\n같은 기간 보유 ${pct(result.bh)} (수수료 전)\n과거 차트 모의 연습 · 잔여 포지션은 마지막 종가 평가\n${url(chosen.day,chosen.version,locale)}`;
  }
  const api=Object.freeze({dayKey,validDay,requestedDay,selection,validate,validateStock,url,read,previousDays,streak,record,readProgress,writeProgress,clearProgress,shareText});
  if (typeof module === 'object' && module.exports) module.exports=api;
  else root.BlindDaily=api;
})(typeof window === 'undefined' ? globalThis : window);
