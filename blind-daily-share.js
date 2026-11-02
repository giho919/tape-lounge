/* Local result-card PNG and optional native share sheet. No uploads or scoring writes. */
(() => {
  'use strict';

  let dialog = null, objectUrl = null, preparedFile = null, preparedName = '', currentData = null;
  const get = id => document.getElementById(id);
  const pct = value => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const COPY = Object.freeze({
    ko: {
      kicker:'TODAY’S BLIND / 과거 차트 연습', round:'오늘의 판', stockUnit:'거래일', dayUnit:'일',
      complete:unit=>`200${unit} 완주`, bankrupt:'파산 정산', early:(days,unit)=>`${days}${unit} 중간 정산`,
      duration:(days,unit)=>`${days}${unit} 플레이 · 가상 자금 $10,000`, returnLabel:'내 수익률',
      holdLabel:'같은 기간 보유', beforeFees:'(수수료 전)', edgeLabel:'보유 대비', edgeUnit:'%p',
      next:'다음 판은 당신 차례', disclaimer:'모의 연습 결과 · 실제 주문·투자 성과 아님 · 잔여 포지션은 마지막 종가 평가',
      shareTitle:'Tape Lounge · 오늘의 판', dialogTitle:'오늘의 판 · 결과 카드', close:'닫기',
      previewAlt:'오늘의 판 모의 결과 카드 미리보기', saveButton:'이미지 저장', deviceShareButton:'기기로 공유',
      dialogNote:'카드는 이 기기에서 만들어집니다. 실제 주문이나 투자 실적이 아니며, 공유할 곳은 기기 공유창에서 직접 선택합니다.',
      preparing:'결과 카드를 만들고 있습니다…', ready:'준비됐어요. 저장하거나 기기 공유창에서 보낼 곳을 고르세요.',
      openingShare:'기기 공유창을 열었습니다.', cancelled:'공유를 취소했어요.', shareFailed:'공유를 완료하지 못했습니다. 이미지 저장을 이용해 주세요.',
      saveRequested:'이미지 저장을 요청했어요.', unsupported:'이 브라우저에서는 결과 카드를 열 수 없습니다.',
      cardFailed:'결과 이미지를 만들지 못했습니다. 다시 시도해 주세요.',
      shareFallback:'Tape Lounge 오늘의 판 결과',
    },
    en: {
      kicker:'DAILY BLIND / HISTORICAL CHART PRACTICE', round:'Daily round', stockUnit:'trading days', dayUnit:'days',
      complete:unit=>`Completed 200 ${unit}`, bankrupt:'Liquidated', early:(days,unit)=>`${days} ${unit} · settled early`,
      duration:(days,unit)=>`${days} ${unit} played · $10,000 virtual funds`, returnLabel:'My return',
      holdLabel:'Buy and hold over the same period', beforeFees:'(before fees)', edgeLabel:'vs. holding', edgeUnit:' pp',
      next:'Your turn at the table', disclaimer:'Practice only · No real orders or investment returns · Open positions marked at the final close',
      shareTitle:'Tape Lounge · Daily round', dialogTitle:'Daily round · Result card', close:'Close',
      previewAlt:'Preview of your virtual trading result card', saveButton:'Save image', deviceShareButton:'Share from device',
      dialogNote:'This card is created on your device. It shows a practice result, not an actual order or investment return. Choose where to share it in your device share sheet.',
      preparing:'Creating your result card…', ready:'Ready. Save the image or choose an app in the share sheet.',
      openingShare:'Opening your device share sheet.', cancelled:'Sharing canceled.', shareFailed:'Could not share. Save the image instead.',
      saveRequested:'Image save requested.', unsupported:'This browser cannot open the result card.',
      cardFailed:'Could not create the result image. Please try again.',
      shareFallback:'Tape Lounge daily round result',
    },
    zh: {
      kicker:'每日盲图 / 历史行情练习', round:'今日牌局', stockUnit:'个交易日', dayUnit:'天',
      complete:unit=>`完成200${unit}`, bankrupt:'强平结算', early:(days,unit)=>`${days}${unit} · 提前结算`,
      duration:(days,unit)=>`${days}${unit}模拟 · 虚拟资金 $10,000`, returnLabel:'我的收益',
      holdLabel:'同期买入持有', beforeFees:'（未扣费用）', edgeLabel:'相对持有', edgeUnit:'个百分点',
      next:'下一局轮到你', disclaimer:'仅供模拟练习 · 非真实订单或投资收益 · 未平仓位按最后收盘价估值',
      shareTitle:'Tape Lounge · 今日牌局', dialogTitle:'今日牌局 · 结果卡', close:'关闭',
      previewAlt:'模拟交易结果卡预览', saveButton:'保存图片', deviceShareButton:'通过设备分享',
      dialogNote:'结果卡在本机生成。卡片展示的是模拟练习结果，不是真实订单或投资收益。请在设备分享菜单中选择分享对象。',
      preparing:'正在生成结果卡…', ready:'已准备好。可以保存图片或在分享菜单中选择应用。',
      openingShare:'正在打开设备分享菜单。', cancelled:'已取消分享。', shareFailed:'分享失败，请改用保存图片。',
      saveRequested:'已请求保存图片。', unsupported:'此浏览器无法打开结果卡。',
      cardFailed:'无法生成结果图片，请重试。',
      shareFallback:'Tape Lounge 今日牌局结果',
    },
    ja: {
      kicker:'今日のブラインド / 過去チャート練習', round:'今日の一局', stockUnit:'取引日', dayUnit:'日',
      complete:unit=>`200${unit}完走`, bankrupt:'清算で決済', early:(days,unit)=>`${days}${unit}・途中精算`,
      duration:(days,unit)=>`${days}${unit}プレイ · 仮想資金 $10,000`, returnLabel:'自分のリターン',
      holdLabel:'同期間の買い持ち', beforeFees:'（手数料前）', edgeLabel:'保有比', edgeUnit:'pt',
      next:'次はあなたの番', disclaimer:'練習用の結果 · 実際の注文・投資成績ではありません · 残ったポジションは最終終値で評価',
      shareTitle:'Tape Lounge · 今日の一局', dialogTitle:'今日の一局 · 結果カード', close:'閉じる',
      previewAlt:'仮想売買の結果カードプレビュー', saveButton:'画像を保存', deviceShareButton:'端末から共有',
      dialogNote:'カードはこの端末で作成します。実際の注文や投資成績ではありません。共有先は端末の共有メニューから選んでください。',
      preparing:'結果カードを作成しています…', ready:'準備できました。画像を保存するか、共有メニューからアプリを選んでください。',
      openingShare:'端末の共有メニューを開きました。', cancelled:'共有をキャンセルしました。', shareFailed:'共有できませんでした。画像を保存してください。',
      saveRequested:'画像の保存を要求しました。', unsupported:'このブラウザでは結果カードを開けません。',
      cardFailed:'結果画像を作成できませんでした。もう一度お試しください。',
      shareFallback:'Tape Lounge 今日の一局の結果',
    },
  });

  function copyFor(lang = 'ko') {
    const copy = COPY[lang] || COPY.ko;
    return Object.freeze({...copy,status:data=>statusLabel(data,copy),duration:data=>durationLabel(data,copy)});
  }
  function statusLabel(data, copy) {
    const unit = data.market === 'stock' ? copy.stockUnit : copy.dayUnit;
    const bankrupt = data.bankrupt ?? data.label === '파산 정산';
    return data.completed ? copy.complete(unit) : bankrupt ? copy.bankrupt : copy.early(data.days,unit);
  }
  function durationLabel(data, copy) {
    return copy.duration(data.days,data.market === 'stock' ? copy.stockUnit : copy.dayUnit);
  }

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
    const copy = copyFor(document.documentElement.lang);
    if (typeof HTMLDialogElement === 'undefined') throw new Error(copy.unsupported);
    dialog = document.createElement('dialog');
    dialog.id = 'bgDailyShareDialog';
    dialog.setAttribute('aria-labelledby', 'bgDailyShareTitle');
    dialog.innerHTML = `<div class="bgDailyShareHead"><b id="bgDailyShareTitle">${copy.dialogTitle}</b><button id="bgDailyShareClose" type="button" aria-label="${copy.close}">×</button></div>
      <img id="bgDailySharePreview" alt="${copy.previewAlt}" hidden>
      <p id="bgDailyShareStatus" role="status" aria-live="polite"></p>
      <div class="bgDailyShareActions"><button id="bgDailyShareSave" type="button" disabled>${copy.saveButton}</button><button id="bgDailyShareNative" type="button" hidden>${copy.deviceShareButton}</button></div>
      <p class="bgDailyShareNote">${copy.dialogNote}</p>`;
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
    const copy = copyFor(document.documentElement.lang);
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(copy.cardFailed);

    const background = ctx.createLinearGradient(0, 0, 1200, 630);
    background.addColorStop(0, '#181a1f'); background.addColorStop(.55, '#0e1117'); background.addColorStop(1, '#17150f');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1200, 630);
    ctx.strokeStyle = '#51452a'; ctx.lineWidth = 2; rounded(ctx, 25, 25, 1150, 580, 22); ctx.stroke();
    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif';
    const text = (value, x, y, size, color, weight = 500) => { ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${font}`; ctx.fillText(value, x, y); };
    const fitText = (value, x, y, maxWidth, size, color, weight = 700) => {
      ctx.fillStyle = color;
      do { ctx.font = `${weight} ${size}px ${font}`; if (ctx.measureText(value).width <= maxWidth) break; size -= 1; } while (size > 16);
      ctx.fillText(value, x, y);
    };

    text('TAPE LOUNGE', 64, 78, 25, '#d4af37', 700);
    text(copy.kicker, 64, 111, 15, '#aab1bf', 600);
    ctx.textAlign = 'right'; text(data.day, 1135, 78, 19, '#e5e7eb', 600); ctx.textAlign = 'left';
    ctx.strokeStyle = '#343947'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(64, 137); ctx.lineTo(1136, 137); ctx.stroke();

    text(copy.round, 66, 184, 18, '#d4af37', 600);
    fitText(statusLabel(data,copy), 66, 244, 442, 38, '#f4f0e7');
    text(data.market === 'stock' ? data.symbol : `${data.symbol} / USDT`, 66, 298, 25, '#aab1bf', 600);
    text(durationLabel(data,copy), 66, 339, 16, '#828b9c', 500);

    rounded(ctx, 550, 165, 584, 257, 16); ctx.fillStyle = 'rgba(8,10,14,.72)'; ctx.fill();
    ctx.strokeStyle = '#393d47'; ctx.lineWidth = 1; ctx.stroke();
    text(copy.returnLabel, 586, 207, 15, '#9ba3b2', 600);
    ctx.fillStyle = data.roi >= 0 ? '#4ade80' : '#fb7185';
    ctx.font = `800 76px ${font}`; ctx.fillText(pct(data.roi), 580, 297);
    text(`${copy.holdLabel}  ${pct(data.bh)}  ${copy.beforeFees}`, 586, 350, 19, '#d8dce5', 600);
    const edge = data.roi - data.bh;
    text(`${copy.edgeLabel} ${edge >= 0 ? '+' : ''}${edge.toFixed(2)}${copy.edgeUnit}`, 586, 386, 15, edge >= 0 ? '#4ade80' : '#fb7185', 600);

    ctx.strokeStyle = '#343947'; ctx.beginPath(); ctx.moveTo(64, 458); ctx.lineTo(1136, 458); ctx.stroke();
    text(copy.next, 66, 501, 22, '#f0d77a', 700);
    const inviteUrl = window.BlindDaily?.url(data.day,data.version) || `https://tapelounge.com/blind/?daily=${data.day}${data.version === 2 ? '&v=2' : ''}`;
    text(inviteUrl.replace('https://tapelounge.com','tapelounge.com'), 66, 536, 18, '#e5e7eb', 600);
    text(copy.disclaimer, 66, 578, 14, '#929aaa', 500);
    text('TAPE LOUNGE', 1134, 578, 13, '#756439', 700);
    return canvas;
  }

  async function open(data) {
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.day) || !Number.isFinite(data.roi) || !Number.isFinite(data.bh)) return;
    const copy = copyFor(document.documentElement.lang);
    const surface = ensureDialog();
    release();
    currentData = data;
    get('bgDailyShareStatus').textContent = copy.preparing;
    surface.showModal();
    try {
      const canvas = makeCard(data);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(file => file ? resolve(file) : reject(new Error(copy.cardFailed)), 'image/png'));
      if (!surface.open) return;
      preparedName = `tape-lounge-daily-${data.day}.png`;
      preparedFile = typeof File === 'function' ? new File([blob], preparedName, {type:'image/png'}) : null;
      objectUrl = URL.createObjectURL(blob);
      const preview = get('bgDailySharePreview'); preview.src = objectUrl; preview.hidden = false;
      get('bgDailyShareSave').disabled = false;
      const shareButton = get('bgDailyShareNative');
      try { shareButton.hidden = !(preparedFile && navigator.share && navigator.canShare?.({files:[preparedFile]})); }
      catch { shareButton.hidden = true; }
      get('bgDailyShareStatus').textContent = copy.ready;
    } catch (error) {
      if (surface.open) get('bgDailyShareStatus').textContent = error.message || copy.shareFailed;
    }
  }

  function save() {
    if (!objectUrl || !preparedName) return;
    const link = document.createElement('a'); link.href = objectUrl; link.download = preparedName;
    document.body.append(link); link.click(); link.remove();
    get('bgDailyShareStatus').textContent = copyFor(document.documentElement.lang).saveRequested;
  }

  async function share() {
    if (!preparedFile || !navigator.share) return;
    const copy = copyFor(document.documentElement.lang), button = get('bgDailyShareNative'); button.disabled = true;
    try {
      await navigator.share({files:[preparedFile], title:copy.shareTitle, text:currentData?.text || copy.shareFallback});
      if (dialog?.open) get('bgDailyShareStatus').textContent = copy.openingShare;
    } catch (error) {
      if (dialog?.open) get('bgDailyShareStatus').textContent = error.name === 'AbortError' ? copy.cancelled : copy.shareFailed;
    } finally { button.disabled = false; }
  }

  window.TapeDailyShare = Object.freeze({open,copyFor});
})();
