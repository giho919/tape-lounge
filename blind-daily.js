/* Versioned deterministic practice round. No account, public ranking or upload. */
((root) => {
  'use strict';
  const VERSION = 1, LAUNCH = '2026-10-31', STORE = 'tapeBlindDailyV1';
  const DAY = 86400000, TOTAL = 1000;
  const POOL = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','LTCUSDT'];
  // Frozen historical range: changing today's date must not change an old round.
  const FIRST = Date.parse('2021-06-01T00:00:00Z'), LAST = Date.parse('2025-12-31T00:00:00Z');
  function dayKey(now = new Date()) { return new Date(+now + 9*3600000).toISOString().slice(0,10); }
  function validDay(day) { return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day+'T00:00:00Z')) && new Date(day+'T00:00:00Z').toISOString().slice(0,10) === day; }
  function requestedDay(query, today = dayKey()) { return validDay(query) && query >= LAUNCH && query <= today ? query : today; }
  function hash(text) { let n=2166136261; for (const c of text) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; }
  function selection(day) {
    if (!validDay(day)) throw new Error('Invalid challenge date');
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
  function url(day) { const u=new URL('https://tapelounge.com/blind/');u.searchParams.set('daily',day);return u.href; }
  function read(storage) {
    try { const value=JSON.parse(storage.getItem(STORE));return value?.version===VERSION && Array.isArray(value.records) ? value.records.filter(r=>validDay(r.day)&&Number.isFinite(r.roi)&&Number.isFinite(r.bh)).slice(-30) : []; } catch { return []; }
  }
  function record(storage, day, result) {
    const records=read(storage), old=records.find(r=>r.day===day);
    if (old || !result.completed || !validDay(day) || ![result.roi,result.bh].every(Number.isFinite)) return {saved:false,first:old||null};
    const first={day,roi:result.roi,bh:result.bh,finishedAt:result.finishedAt};
    try { storage.setItem(STORE,JSON.stringify({version:VERSION,records:[...records,first].sort((a,b)=>a.day.localeCompare(b.day)).slice(-30)}));return {saved:true,first}; }
    catch { return {saved:false,first:null}; }
  }
  function shareText(chosen,result) {
    const pct = value => `${value>=0?'+':''}${value.toFixed(2)}%`;
    return `Tape Lounge · ${chosen.day} 오늘의 판\n${result.completed?'200일 완주':result.bankrupt?'파산 정산':`${result.days}일 중간 정산`} · 내 수익률 ${pct(result.roi)}\n같은 기간 보유 ${pct(result.bh)} (수수료 전)\n과거 차트 모의 연습 · 잔여 포지션은 마지막 종가 평가\n${url(chosen.day)}`;
  }
  const api=Object.freeze({dayKey,validDay,requestedDay,selection,validate,url,read,record,shareText});
  if (typeof module === 'object' && module.exports) module.exports=api;
  else root.BlindDaily=api;
})(typeof window === 'undefined' ? globalThis : window);
