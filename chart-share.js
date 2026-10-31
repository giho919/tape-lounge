/* Local PNG export and public chart deep links. No upload or page screenshots. */
(() => {
  'use strict';
  const source = window.TapeChartSource;
  const open = document.getElementById('chartShareOpen');
  if (!source || !open || typeof HTMLDialogElement === 'undefined') return;
  source.restore();
  const jump = document.querySelector('.chartJump');
  if (jump) {
    jump.href = location.pathname + location.search + '#loungeChart';
    jump.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.caroGo(0);
      const url = new URL(location.href);
      url.searchParams.set('chart', 'BTC');
      url.hash = 'loungeChart';
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      document.getElementById('loungeChart').scrollIntoView({block:'start'});
    });
  }
  const dialog = document.createElement('dialog');
  dialog.id = 'chartShareDialog';
  dialog.setAttribute('aria-labelledby', 'chartShareTitle');
  dialog.innerHTML = `<div class="chartShareHead"><h2 id="chartShareTitle">차트 한 장</h2><button id="chartShareClose" type="button" aria-label="닫기" autofocus>×</button></div>
    <p id="chartShareMeta"></p><img id="chartSharePreview" alt="공유할 차트 미리보기" hidden>
    <p id="chartShareStatus" role="status" aria-live="polite"></p>
    <div class="chartShareActions"><button id="chartShareSave" type="button" disabled>이미지 저장</button><button id="chartShareNative" type="button" hidden>이미지 공유</button><button id="chartShareCopy" type="button">링크 복사</button></div>
    <input id="chartShareLink" aria-label="복사할 종목·시간봉 링크" readonly hidden>
    <p class="chartShareNote">이미지는 현재 보이는 차트를 저장합니다. 링크는 같은 종목·시간봉의 최신 차트를 엽니다.</p>`;
  document.body.append(dialog);
  const el = id => document.getElementById('chartShare' + id);
  const preview = el('Preview'), status = el('Status'), save = el('Save'), native = el('Native'), copy = el('Copy'), link = el('Link');
  let generation = 0, prepared = null, objectUrl = null, publicUrl = '';
  const revoke = url => { if (url) setTimeout(() => URL.revokeObjectURL(url), 60000); };
  function clear() {
    generation++;
    revoke(objectUrl);
    objectUrl = null;
    prepared = null;
    preview.removeAttribute('src');
    preview.hidden = true;
    save.disabled = true;
    native.hidden = true;
    link.hidden = true;
    copy.disabled = false;
  }
  function urlFor(info) {
    const url = new URL('https://tapelounge.com/');
    url.searchParams.set('chart', info.key);
    url.searchParams.set('tf', info.tf);
    url.hash = 'loungeChart';
    return url.href;
  }
  function imageFor(snapshot) {
    const panes = snapshot.panes;
    if (panes.length !== 3 || panes.some(p => !p.width || !p.height)) throw new Error('차트가 아직 준비되지 않았습니다.');
    const width = Math.min(1600, Math.max(720, panes[0].width));
    const logicalWidth = 960, scale = width / logicalWidth;
    const heights = panes.map(p => p.height / p.width * logicalWidth);
    const height = Math.ceil((132 + heights.reduce((a,b) => a+b, 0) + 64 + 94) * scale);
    if (height > 6500) throw new Error('차트 크기를 조정한 뒤 다시 시도해 주세요.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#12151c'; ctx.fillRect(0, 0, logicalWidth, height / scale);
    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif';
    function text(value, x, y, size, color) { ctx.fillStyle = color; ctx.font = `${size}px ${font}`; ctx.fillText(value, x, y); }
    text('TAPE LOUNGE', 24, 35, 26, '#d4af37');
    text(`${snapshot.market} · ${snapshot.label} (${snapshot.tf})`, 24, 70, 24, '#e2e8f0');
    const stamp = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(snapshot.capturedAt));
    text(`${stamp} KST · 캡처 시점`, 24, 98, 17, '#9aa5b6');
    text(`SMA ${snapshot.maPeriods.join(' · ')}   /   Supertrend ${snapshot.stPeriod}, ${snapshot.stMultiplier}`, 24, 121, 16, '#9aa5b6');
    let y = 132;
    panes.forEach((pane, i) => {
      if (i) { text(i === 1 ? 'MACD 12 · 26 · 9' : 'RSI 14 · Wilder · 30 / 70', 24, y + 23, 17, i === 1 ? '#38bdf8' : '#c084fc'); y += 32; }
      ctx.drawImage(pane, 0, y, logicalWidth, heights[i]);
      y += heights[i];
    });
    text('tapelounge.com', 24, y + 30, 22, '#d4af37');
    text('차트 시간축 UTC · 미마감 봉은 변동할 수 있습니다.', 24, y + 56, 16, '#9aa5b6');
    text('Charts: TradingView Lightweight Charts™ · tradingview.com', 24, y + 80, 16, '#9aa5b6');
    return canvas;
  }
  async function prepare() {
    clear();
    const token = generation, info = source.describe();
    publicUrl = urlFor(info);
    el('Meta').textContent = `${info.market} · ${info.label}`;
    status.textContent = '현재 차트를 이미지로 준비하고 있습니다.';
    dialog.showModal();
    try {
      await new Promise(requestAnimationFrame);
      if (token !== generation || !dialog.open) return;
      const snapshot = source.capture();
      publicUrl = urlFor(snapshot);
      el('Meta').textContent = `${snapshot.market} · ${snapshot.label}`;
      const canvas = imageFor(snapshot);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다. 다시 시도해 주세요.')), 'image/png'));
      if (token !== generation || !dialog.open) return;
      const filename = `tape-lounge-${snapshot.key.replace(/\./g, '-')}-${snapshot.tf}-${snapshot.capturedAt.slice(0,19).replace(/[:T]/g, '-')}-UTC.png`;
      const file = new File([blob], filename, {type:'image/png'});
      objectUrl = URL.createObjectURL(blob);
      prepared = {file, filename, url:objectUrl, title:`Tape Lounge · ${snapshot.key} · ${snapshot.label}`};
      preview.src = objectUrl; preview.hidden = false;
      save.disabled = false;
      try { native.hidden = !(navigator.share && navigator.canShare?.({files:[file]})); } catch { native.hidden = true; }
      status.textContent = '이미지가 준비됐습니다. 저장하거나 공유해 보세요.';
    } catch (error) {
      if (token === generation && dialog.open) status.textContent = error.message || '이미지를 만들지 못했습니다. 링크는 복사할 수 있습니다.';
    }
  }
  open.hidden = false;
  open.addEventListener('click', () => { if (!dialog.open) void prepare(); });
  el('Close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', clear);
  save.addEventListener('click', () => {
    if (!prepared) return;
    const a = document.createElement('a'); a.href = prepared.url; a.download = prepared.filename;
    document.body.append(a); a.click(); a.remove();
    status.textContent = '이미지 저장을 요청했습니다.';
  });
  native.addEventListener('click', async () => {
    if (!prepared) return;
    const token = generation, current = prepared;
    native.disabled = true;
    try {
      await navigator.share({files:[current.file], title:current.title, url:publicUrl});
      if (token === generation) status.textContent = '공유 창으로 전달했습니다.';
    } catch (error) {
      if (token === generation) status.textContent = error.name === 'AbortError' ? '공유를 취소했습니다.' : '이 브라우저에서는 이미지 공유가 어렵습니다. 이미지 저장이나 링크 복사를 이용해 주세요.';
    } finally { native.disabled = false; }
  });
  copy.addEventListener('click', async () => {
    const token = generation, url = publicUrl;
    copy.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (token === generation) status.textContent = '종목·시간봉 링크를 복사했습니다.';
    } catch {
      if (token === generation) { link.value = url; link.hidden = false; link.focus(); link.select(); status.textContent = '아래 링크를 길게 누르거나 선택해 복사해 주세요.'; }
    } finally { copy.disabled = false; }
  });
})();
