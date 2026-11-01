/* A non-blocking locale suggestion for the Korean live app. */
(() => {
  'use strict';

  const supported = ['ko', 'en', 'zh', 'ja'];
  const languages = {
    en: {
      text: 'English market notes and guides are available.',
      tools: 'The live lounge is also available in English.',
      privacy: 'Country lookup uses country.is, which receives your IP; Tape Lounge does not store your IP or location.',
      link: 'Open the English live lounge ↗', dismiss: 'Stay here', close: 'Dismiss language suggestion',
    },
    zh: {
      text: '中文市场文章与指南可供阅读。',
      tools: '实时行情大厅也支持中文。',
      privacy: '国家判断使用 country.is，该服务会接收请求 IP；Tape Lounge 不保存 IP 或位置。',
      link: '打开中文实时行情大厅 ↗', dismiss: '留在这里', close: '关闭语言建议',
    },
    ja: {
      text: '市況記事とガイドを日本語で読めます。',
      tools: 'ライブマーケットラウンジも日本語で利用できます。',
      privacy: '国の判定に country.is を使い、同サービスはリクエスト IP を受信します。Tape Lounge は IP や位置を保存しません。',
      link: '日本語のライブラウンジを開く ↗', dismiss: 'このまま見る', close: '言語の提案を閉じる',
    },
  };

  const read = (key, fallback = null) => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      try { return JSON.parse(value); } catch { return value; }
    } catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const browserLanguage = () => {
    const candidates = [...(navigator.languages || []), navigator.language || ''];
    for (const value of candidates) {
      const prefix = String(value).toLowerCase().split('-')[0];
      if (supported.includes(prefix)) return prefix;
    }
    return 'en';
  };
  const languageForCountry = country => {
    const code = String(country || '').toUpperCase();
    if (code === 'KR') return 'ko';
    if (code === 'JP') return 'ja';
    if (['CN', 'TW', 'HK', 'MO'].includes(code)) return 'zh';
    return 'en';
  };
  const internalVisit = () => {
    try {
      return new URLSearchParams(location.search).get('internal') === '1' || localStorage.getItem('tapeInternal') === '1';
    } catch { return new URLSearchParams(location.search).get('internal') === '1'; }
  };
  const readRecommendation = async () => {
    const cached = read('tl_country_language');
    if (cached && supported.includes(cached.lang) && Number.isFinite(cached.at) && Date.now() - cached.at < 7 * 86400000) return cached.lang;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch('https://api.country.is/', {
        signal: controller.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error(`Country lookup ${response.status}`);
      const result = await response.json();
      const lang = languageForCountry(result.country);
      write('tl_country_language', { lang, country: true, at: Date.now() });
      return lang;
    } catch {
      return browserLanguage();
    } finally {
      clearTimeout(timeout);
    }
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-language]');
    if (link && supported.includes(link.dataset.language)) {
      write('tl_language', link.dataset.language);
      try {
        const target = new URL(link.href, location.href);
        if (target.origin !== location.origin) return;
        const current = new URL(location.href);
        for (const key of ['internal', 'utm_source', 'utm_medium', 'utm_campaign', 'asset', 'interval', 'tf', 'daily']) {
          if (current.searchParams.has(key) && !target.searchParams.has(key)) {
            target.searchParams.set(key, current.searchParams.get(key));
          }
        }
        link.href = target.href;
      } catch {}
    }
  });

  const start = async () => {
    const box = document.getElementById('homeLocaleSuggestion');
    if (!box || document.documentElement.lang !== 'ko' || internalVisit() || read('tl_locale_dismissed', false)) return;
    const chosen = read('tl_language');
    const recommendation = chosen && supported.includes(chosen) ? chosen : await readRecommendation();
    if (!languages[recommendation] || recommendation === 'ko') return;
    const copy = languages[recommendation];
    box.innerHTML = `<div class="homeLocaleCopy"><span>${copy.text} ${copy.tools}</span><small>${copy.privacy}</small></div><div class="homeLocaleActions"><a class="homeLocaleLink" href="/${recommendation}/tools/" hreflang="${recommendation}" lang="${recommendation}" data-language="${recommendation}">${copy.link}</a><button class="homeLocaleDismiss" type="button">${copy.dismiss}</button><button class="homeLocaleDismiss" type="button" aria-label="${copy.close}">×</button></div>`;
    box.hidden = false;
    box.querySelectorAll('.homeLocaleDismiss').forEach(button => button.addEventListener('click', () => {
      write('tl_locale_dismissed', true);
      box.hidden = true;
    }, { once: true }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
