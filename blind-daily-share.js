/* Local result-card PNG and optional native share sheet. No uploads or scoring writes. */
(() => {
  'use strict';

  let dialog = null, objectUrl = null, preparedFile = null, preparedName = '', currentData = null;
  const get = id => document.getElementById(id);
  const pct = value => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  function rounded(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius);
    else {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
    }
  }

  function ensureDialog() {
    if (dialog) return dialog;
    if (typeof HTMLDialogElement === 'undefined') throw new Error('이 브라우저에서는 결과 카드를 열 수 없습니다.');
    dialog = document.createElement('dialog');
    dialog.id = 'bgDailyShareDialog';
    dialog.setAttribute('aria-labelledby', 'bgDailyShareTitle');
    dialog.innerHTML = `<div class="bgDailyShareHead"><b id="bgDailyShareTitle">오늘의 판 · 결과 카드</b><button id="bgDailyShareClose" type="button" aria-label="닫기">×</button></div>
      <img id="bgDailySharePreview" alt="오늘의 판 모의 결과 카드 미리보기" hidden>
      <p id="bgDailyShareStatus" role="status" aria-live="polite"></p>
      <div class="bgDailyShareActions"><button id="bgDailyShareSave" type="button" disabled>이미지 저장</button><button id="bgDailyShareNative" type="button" hidden>기기로 공유</button></div>
      <p class="bgDailyShareNote">카드는 이 기기에서 만들어집니다. 실제 주문이나 투자 실적이 아니며, 공유할 곳은 기기 공유창에서 직접 선택합니다.</p>`;
    document.body.append(dialog);
    get('bgDailyShareClose').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', release);
    get('bgDailyShareSave').addEventListener('click', save);
    get('bgDailyShareNative').addEventListener('click', share);
    return dialog;
  }

  function release() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null; preparedFile = null; preparedName = ''; currentData = null;
    const preview = get('bgDailySharePreview');
    if (preview) { preview.removeAttribute('src'); preview.hidden = true; }
    const saveButton = get('bgDailyShareSave'), shareButton = get('bgDailyShareNative');
    if (saveButton) saveButton.disabled = true;
    if (shareButton) { shareButton.disabled = false; shareButton.hidden = true; }
  }

  function makeCard(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('결과 이미지를 만들지 못했습니다.');

    const background = ctx.createLinearGradient(0, 0, 1200, 630);
    background.addColorStop(0, '#181a1f'); background.addColorStop(.55, '#0e1117'); background.addColorStop(1, '#17150f');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1200, 630);
    ctx.strokeStyle = '#51452a'; ctx.lineWidth = 2; rounded(ctx, 25, 25, 1150, 580, 22); ctx.stroke();
    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif';
    const text = (value, x, y, size, color, weight = 500) => { ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${font}`; ctx.fillText(value, x, y); };

    text('TAPE LOUNGE', 64, 78, 25, '#d4af37', 700);
    text('TODAY’S BLIND  /  과거 차트 연습', 64, 111, 15, '#aab1bf', 600);
    ctx.textAlign = 'right'; text(data.day, 1135, 78, 19, '#e5e7eb', 600); ctx.textAlign = 'left';
    ctx.strokeStyle = '#343947'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(64, 137); ctx.lineTo(1136, 137); ctx.stroke();

    text('오늘의 판', 66, 184, 18, '#d4af37', 600);
    text(data.label, 66, 244, 38, '#f4f0e7', 700);
    text(data.market === 'stock' ? data.symbol : `${data.symbol} / USDT`, 66, 298, 25, '#aab1bf', 600);
    text(`${data.days}${data.market === 'stock' ? '거래일' : '일'} 플레이 · 가상 자금 $10,000`, 66, 339, 16, '#828b9c', 500);

    rounded(ctx, 550, 165, 584, 257, 16); ctx.fillStyle = 'rgba(8,10,14,.72)'; ctx.fill();
    ctx.strokeStyle = '#393d47'; ctx.lineWidth = 1; ctx.stroke();
    text('내 수익률', 586, 207, 15, '#9ba3b2', 600);
    ctx.fillStyle = data.roi >= 0 ? '#4ade80' : '#fb7185';
    ctx.font = `800 76px ${font}`; ctx.fillText(pct(data.roi), 580, 297);
    text(`같은 기간 보유  ${pct(data.bh)}  (수수료 전)`, 586, 350, 19, '#d8dce5', 600);
    const edge = data.roi - data.bh;
    text(`보유 대비 ${edge >= 0 ? '+' : ''}${edge.toFixed(2)}%p`, 586, 386, 15, edge >= 0 ? '#4ade80' : '#fb7185', 600);

    ctx.strokeStyle = '#343947'; ctx.beginPath(); ctx.moveTo(64, 458); ctx.lineTo(1136, 458); ctx.stroke();
    text('다음 판은 당신 차례', 66, 501, 22, '#f0d77a', 700);
    text(`tapelounge.com/blind/?daily=${data.day}${data.version === 2 ? '&v=2' : ''}`, 66, 536, 18, '#e5e7eb', 600);
    text('모의 연습 결과 · 실제 주문·투자 성과 아님 · 잔여 포지션은 마지막 종가 평가', 66, 578, 14, '#929aaa', 500);
    text('TAPE LOUNGE', 1134, 578, 13, '#756439', 700);
    return canvas;
  }

  async function open(data) {
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.day) || !Number.isFinite(data.roi) || !Number.isFinite(data.bh)) return;
    const surface = ensureDialog();
    release();
    currentData = data;
    get('bgDailyShareStatus').textContent = '결과 카드를 만들고 있습니다…';
    surface.showModal();
    try {
      const canvas = makeCard(data);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(file => file ? resolve(file) : reject(new Error('이미지를 만들지 못했습니다. 다시 시도해 주세요.')), 'image/png'));
      if (!surface.open) return;
      preparedName = `tape-lounge-daily-${data.day}.png`;
      preparedFile = typeof File === 'function' ? new File([blob], preparedName, {type:'image/png'}) : null;
      objectUrl = URL.createObjectURL(blob);
      const preview = get('bgDailySharePreview'); preview.src = objectUrl; preview.hidden = false;
      get('bgDailyShareSave').disabled = false;
      const shareButton = get('bgDailyShareNative');
      try { shareButton.hidden = !(preparedFile && navigator.share && navigator.canShare?.({files:[preparedFile]})); }
      catch { shareButton.hidden = true; }
      get('bgDailyShareStatus').textContent = '준비됐어요. 저장하거나 기기 공유창에서 보낼 곳을 고르세요.';
    } catch (error) {
      if (surface.open) get('bgDailyShareStatus').textContent = error.message || '이미지를 만들지 못했습니다.';
    }
  }

  function save() {
    if (!objectUrl || !preparedName) return;
    const link = document.createElement('a'); link.href = objectUrl; link.download = preparedName;
    document.body.append(link); link.click(); link.remove();
    get('bgDailyShareStatus').textContent = '이미지 저장을 요청했어요.';
  }

  async function share() {
    if (!preparedFile || !navigator.share) return;
    const button = get('bgDailyShareNative'); button.disabled = true;
    try {
      await navigator.share({files:[preparedFile], title:'Tape Lounge · 오늘의 판', text:currentData?.text || 'Tape Lounge 오늘의 판 결과'});
      if (dialog?.open) get('bgDailyShareStatus').textContent = '기기 공유창을 열었습니다.';
    } catch (error) {
      if (dialog?.open) get('bgDailyShareStatus').textContent = error.name === 'AbortError' ? '공유를 취소했어요.' : '공유를 완료하지 못했습니다. 이미지 저장을 이용해 주세요.';
    } finally { button.disabled = false; }
  }

  window.TapeDailyShare = Object.freeze({open});
})();
