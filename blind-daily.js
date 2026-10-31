/* Versioned deterministic practice round. No account, public ranking or upload. */
((root) => {
  'use strict';
  const VERSION = 1, STOCK_VERSION = 2, LAUNCH = '2026-10-31', STOCK_LAUNCH = '2026-11-02';
  const STORES = {1:'tapeBlindDailyV1',2:'tapeBlindDailyV2'};
  const STREAK_STORE = 'tapeBlindDailyStreakV1';
  const DAY = 86400000, TOTAL = 1000;
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
  function url(day,version=selection(day).version) { const u=new URL('https://tapelounge.com/blind/');u.searchParams.set('daily',day);if(version===STOCK_VERSION)u.searchParams.set('v',String(STOCK_VERSION));return u.href; }
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
  function shareText(chosen,result) {
    const pct = value => `${value>=0?'+':''}${value.toFixed(2)}%`;
    const unit=chosen.version===STOCK_VERSION?'거래일':'일';
    return `Tape Lounge · ${chosen.day} ${chosen.day===dayKey()?'오늘의 판':'지난 판'}\n${result.completed?`200${unit} 완주`:result.bankrupt?'파산 정산':`${result.days}${unit} 중간 정산`} · 내 수익률 ${pct(result.roi)}\n같은 기간 보유 ${pct(result.bh)} (수수료 전)\n과거 차트 모의 연습 · 잔여 포지션은 마지막 종가 평가\n${url(chosen.day,chosen.version)}`;
  }
  const api=Object.freeze({dayKey,validDay,requestedDay,selection,validate,validateStock,url,read,previousDays,streak,record,shareText});
  if (typeof module === 'object' && module.exports) module.exports=api;
  else root.BlindDaily=api;
})(typeof window === 'undefined' ? globalThis : window);
