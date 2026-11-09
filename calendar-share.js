(() => {
  'use strict';
  const button = document.getElementById('macroShareButton');
  const status = document.getElementById('macroShareStatus');
  if (!button || !status) return;

  const language = (document.documentElement.lang || 'ko').slice(0, 2).toLowerCase();
  const copy = {
    ko: {
      title: '거시 발표장 | Tape Lounge',
      text: '미국 경제지표 발표 일정과 발표 뒤 비트코인 반응을 함께 확인해보세요.',
      button: '발표장 공유 ↗', opening: '공유 메뉴를 여는 중…', shared: '공유 메뉴를 열었습니다.', cancelled: '공유를 취소했습니다.', copied: '링크를 복사했습니다.', failed: '링크를 복사하지 못했습니다.'
    },
    en: {
      title: 'Macro floor | Tape Lounge',
      text: 'Track official U.S. releases and see how Bitcoin reacts afterward.',
      button: 'Share this floor ↗', opening: 'Opening share options…', shared: 'Share sheet opened.', cancelled: 'Sharing cancelled.', copied: 'Link copied.', failed: 'Could not copy the link.'
    },
    zh: {
      title: '宏观发布厅 | Tape Lounge',
      text: '查看美国官方经济数据发布时间，以及发布后比特币的市场反应。',
      button: '分享发布厅 ↗', opening: '正在打开分享菜单…', shared: '已打开分享菜单。', cancelled: '已取消分享。', copied: '链接已复制。', failed: '无法复制链接。'
    },
    ja: {
      title: 'マクロ発表フロア | Tape Lounge',
      text: '米国の公式経済指標の発表予定と、その後のビットコインの反応を確認できます。',
      button: '発表フロアを共有 ↗', opening: '共有メニューを開いています…', shared: '共有メニューを開きました。', cancelled: '共有をキャンセルしました。', copied: 'リンクをコピーしました。', failed: 'リンクをコピーできませんでした。'
    }
  }[language] || {
    title: 'Macro floor | Tape Lounge',
    text: 'Track official U.S. releases and see how Bitcoin reacts afterward.',
    button: 'Share this floor ↗', opening: 'Opening share options…', shared: 'Share sheet opened.', cancelled: 'Sharing cancelled.', copied: 'Link copied.', failed: 'Could not copy the link.'
  };

  button.textContent = copy.button;
  const pageUrl = () => window.TapeCampaign?.tagMacroShare(location.href) || new URL(location.pathname, location.origin).href;
  async function copyLink(url) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }
    const field = document.createElement('textarea');
    field.value = url;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) throw new Error('Clipboard unavailable');
  }

  button.addEventListener('click', async () => {
    status.textContent = '';
    const url = pageUrl();
    if (navigator.share) {
      status.textContent = copy.opening;
      try {
        await navigator.share({title: copy.title, text: copy.text, url});
        status.textContent = copy.shared;
        return;
      } catch (error) {
        if (error?.name === 'AbortError') {
          status.textContent = copy.cancelled;
          return;
        }
      }
    }
    status.textContent = '';
    try {
      await copyLink(url);
      status.textContent = copy.copied;
    } catch {
      status.textContent = copy.failed;
    }
  });
})();
