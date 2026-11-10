/* Export the fixed long-channel snapshot as a watermarked PNG. No upload or URL sharing. */
(() => {
  'use strict';
  const button = document.getElementById('caImageShare');
  const image = document.getElementById('caLongImage');
  const status = document.getElementById('caStatus');
  if (!button || !image || !status) return;

  const copy = {
    busy: '차트 이미지를 준비하고 있습니다.',
    saved: '차트 이미지 저장을 시작했습니다.',
    shared: '이미지 공유 창을 열었습니다.',
    canceled: '공유를 취소했습니다.',
    error: '이미지를 만들지 못했습니다. 다시 시도해 주세요.'
  };
  button.hidden = false;

  function decodeImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(copy.error));
      img.src = url;
    });
  }

  async function toPng(sourceText) {
    if (!sourceText.includes('<svg') || !sourceText.includes('tapelounge.com')) {
      throw new Error(copy.error);
    }
    const svgBlob = new Blob([sourceText], {type:'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = await decodeImage(svgUrl);
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1040;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(copy.error);
      ctx.fillStyle = '#0a1018';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error(copy.error)), 'image/png');
      });
      return blob;
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = copy.busy;
    try {
      const src = image.dataset.src || image.getAttribute('src');
      if (!src) throw new Error(copy.error);
      const url = new URL(src, document.baseURI);
      const response = await fetch(url.href, {credentials:'same-origin', cache:'force-cache'});
      if (!response.ok) throw new Error(copy.error);
      const blob = await toPng(await response.text());
      const date = url.pathname.match(/btc-channels-(\d{4}-\d{2}-\d{2})-/);
      const filename = 'tapelounge-btc-channel-' + (date ? date[1] : 'latest') + '.png';
      if (typeof File === 'function' && navigator.share && navigator.canShare) {
        const file = new File([blob], filename, {type:'image/png'});
        if (navigator.canShare({files:[file]})) {
          try {
            await navigator.share({files:[file], title:'Tape Lounge · BTC 장기 채널'});
            status.textContent = copy.shared;
            return;
          } catch (error) {
            if (error && error.name === 'AbortError') {
              status.textContent = copy.canceled;
              return;
            }
          }
        }
      }
      download(blob, filename);
      status.textContent = copy.saved;
    } catch (error) {
      status.textContent = error && error.message ? error.message : copy.error;
    } finally {
      button.disabled = false;
    }
  });
})();
