(() => {
  'use strict';

  const copy = {
    ko: { shared: '공유 메뉴를 열었어요.', copied: '링크를 복사했어요.', cancelled: '공유를 취소했어요.', manual: '아래 링크를 길게 눌러 복사해 주세요.' },
    en: { shared: 'Shared.', copied: 'Link copied.', cancelled: 'Sharing canceled.', manual: 'Copy the link shown below.' },
    zh: { shared: '已打开分享菜单。', copied: '链接已复制。', cancelled: '已取消分享。', manual: '请长按下方链接进行复制。' },
    ja: { shared: '共有メニューを開きました。', copied: 'リンクをコピーしました。', cancelled: '共有をキャンセルしました。', manual: '下のリンクを長押ししてコピーしてください。' }
  };
  const messages = copy[document.documentElement.lang] || copy.ko;

  document.querySelectorAll('[data-article-share]').forEach(button => {
    button.addEventListener('click', async () => {
      const root = button.closest('.guide-share');
      const status = root?.querySelector('[data-article-share-status]');
      const input = root?.querySelector('[data-article-share-url]');
      const canonical = document.querySelector('link[rel="canonical"]');
      const url = canonical?.href || `${location.origin}${location.pathname}`;
      const title = document.querySelector('h1')?.textContent?.trim() || document.title;
      if (!root || !status || !input) return;

      button.disabled = true;
      status.textContent = '';
      try {
        if (typeof navigator.share === 'function') {
          try {
            await navigator.share({ title, text: `${title} · Tape Lounge`, url });
            status.textContent = messages.shared;
            return;
          } catch (error) {
            if (error?.name === 'AbortError') {
              status.textContent = messages.cancelled;
              return;
            }
          }
        }

        try {
          if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(url);
          status.textContent = messages.copied;
        } catch {
          input.value = url;
          input.hidden = false;
          input.focus();
          input.select();
          status.textContent = messages.manual;
        }
      } finally {
        button.disabled = false;
      }
    });
  });
})();
