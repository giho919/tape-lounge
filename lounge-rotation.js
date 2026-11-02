(() => {
  'use strict';

  const root = document.getElementById('loungeRotation');
  if (!root) return;

  const eyebrow = document.getElementById('loungeRotationEyebrow');
  const title = document.getElementById('loungeRotationTitle');
  const copy = document.getElementById('loungeRotationCopy');
  const link = document.getElementById('loungeRotationLink');
  const share = document.getElementById('loungeRotationShare');
  const shareStatus = document.getElementById('loungeRotationShareStatus');
  const inviteCopy = document.getElementById('loungeRotationInviteCopy');
  const count = document.getElementById('loungeRotationCount');
  const main = document.getElementById('loungeRotationMain');
  const dots = [...root.querySelectorAll('[data-rotation-to]')];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let inViewport = true;
  if ('IntersectionObserver' in window) {
    inViewport = false;
    const visibilityObserver = new IntersectionObserver(entries => {
      inViewport = Boolean(entries[0]?.isIntersecting);
    }, { threshold: 0.2 });
    visibilityObserver.observe(root);
  }

  const slides = [
    {
      eyebrow: "TODAY'S DEAL",
      title: '오늘의 판 · 약 4분',
      copy: '로그인 없이 종목·날짜를 가린 실제 차트에서 매수·매도를 연습하세요. 200일 후 같은 기간 보유와 비교합니다. 기본 2×로 약 4분.',
      link: '/blind/?daily=1&start=1',
      label: '오늘 판 바로 시작 ↗',
    },
    {
      eyebrow: 'YOUR CALL',
      title: '그때 나라면?',
      copy: '매수·대기·보유·청산을 고르고 다음 5일을 확인해요. 1D·4H·1H 차트와 당시 심리·펀딩비도 볼 수 있어요.',
      link: '/decision/',
      label: '한 판 시작 ↗',
    },
    {
      eyebrow: 'SESSION CHAMPIONSHIP',
      title: '세션마다 다른 판이 열립니다',
      copy: '아시아·유럽·미국의 최근 회차를 같은 기준으로 비교합니다.',
      link: '#sessionPanel',
      label: '세션 기록 보기 ↓',
    },
    {
      eyebrow: "ANDY'S WATCH",
      title: 'Andy의 후보 관찰 기록',
      copy: '돌파와 눌림이 어떻게 이어졌는지 공개된 기록에서 확인해 보세요.',
      link: '/domestic/',
      label: '관찰 목록 보기 ↗',
    },
  ];

  const currentUrl = new URL(window.location.href);
  const liveToolsRoot = document.documentElement.dataset.liveToolsRoot || '';
  const liveToolPages = new Set(['blind', 'domestic', 'desk', 'analysis', 'onchain', 'calendar', 'strategists']);
  function withVisitContext(value) {
    if (value.startsWith('#')) return value;
    const target = new URL(value, window.location.origin);
    const toolPath = target.pathname.replace(/^\/+|\/+$/g, '');
    const pageLang = document.documentElement.lang;
    if (liveToolsRoot && toolPath === 'decision' && ['en', 'zh', 'ja'].includes(pageLang)) target.pathname = `/${pageLang}/decision/`;
    else if (liveToolsRoot && liveToolPages.has(toolPath)) target.pathname = `${liveToolsRoot}/${toolPath}/`;
    for (const key of ['internal', 'utm_source', 'utm_medium', 'utm_campaign']) {
      const current = currentUrl.searchParams.get(key);
      if (current && !target.searchParams.has(key)) target.searchParams.set(key, current);
    }
    return `${target.pathname}${target.search}${target.hash}`;
  }

  let active = 0;
  let paused = reduceMotion;
  let pointerInside = false;
  let focusInside = false;
  let andyRequested = false;
  let dailyState = '';

  function show(index) {
    active = (index + slides.length) % slides.length;
    const item = slides[active];
    main.classList.remove('is-changing');
    void main.offsetWidth;
    main.classList.add('is-changing');
    eyebrow.textContent = item.eyebrow;
    title.textContent = item.title;
    copy.textContent = item.copy;
    link.href = withVisitContext(item.link);
    link.textContent = item.label;
    // Keep the invitation visible while other lounge cards rotate so visitors
    // do not have to wait for the daily-deal slide to share today's round.
    if (share) share.hidden = false;
    if (active !== 0) {
      if (shareStatus) { shareStatus.textContent = ''; shareStatus.hidden = true; }
      if (inviteCopy) inviteCopy.hidden = true;
    }
    count.textContent = `${String(active + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    dots.forEach((dot, dotIndex) => dot.setAttribute('aria-pressed', String(dotIndex === active)));
    root.dataset.current = String(active);
    if (active === 3) loadAndy();
  }

  function updateDailyRound() {
    try {
      const daily = window.BlindDaily;
      if (!daily) return;
      const day = daily.dayKey();
      const selection = daily.selection(day);
      const streak = daily.streak(localStorage);
      const state = `${day}:${streak.days}:${streak.playedToday}`;
      if (state === dailyState) return;
      dailyState = state;
      const market = selection.track === 'stock' ? '미국 주식' : '코인';
      const date = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', month: 'long', day: 'numeric',
      }).format(new Date(`${day}T00:00:00+09:00`));
      slides[0].eyebrow = `TODAY'S DEAL · ${date} · ${market}`;
      slides[0].title = selection.track === 'stock' ? '오늘의 미국 주식 판 · 약 4분' : '오늘의 판 · 약 4분';
      slides[0].copy = selection.track === 'stock'
        ? '로그인 없이 무료 4분 한 판. 종목·날짜를 가린 실제 미국주식 차트 200거래일을 매매해 보세요. 그냥 보유했을 때보다 잘할 수 있을까요?'
        : '로그인 없이 종목·날짜를 가린 실제 차트에서 매수·매도를 연습하세요. 200일 후 같은 기간 보유와 비교합니다. 기본 2×로 약 4분.';
      slides[0].label = '오늘 판 바로 시작 ↗';
      if (streak.playedToday) {
        slides[0].copy = `오늘 완주했어요. ${streak.days}일 연속 출전 기록을 다시 보고 같은 판을 공유해 보세요.`;
        slides[0].label = '오늘 결과 다시 보기 ↗';
      } else if (streak.days > 0) {
        slides[0].copy = `${slides[0].copy} 어제까지 ${streak.days}일 연속 · 오늘 완주하면 이어집니다.`;
        slides[0].label = '오늘 이어서 도전 ↗';
      }
      const target = new URL(daily.url(day, selection.version), window.location.origin);
      if (!streak.playedToday) target.searchParams.set('start', '1');
      slides[0].link = `${target.pathname}${target.search}`;
      if (active === 0) show(active);
    } catch { /* Keep the useful static invitation if local date or storage is unavailable. */ }
  }

  function loadAndy() {
    if (andyRequested) return;
    andyRequested = true;
    fetch('/data/discovery.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const candidates = Array.isArray(data?.candidates) ? data.candidates.filter(item => item?.active) : [];
        if (!candidates.length) return;
        const daily = candidates.filter(item => item.timeframe === '1d').length;
        const fourHour = candidates.filter(item => item.timeframe === '4h').length;
        const support = candidates.filter(item => item.timeframe === '4h' && item.stage === '지지 확인').length;
        const observedAt = data.reportAt ? new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric',
        }).format(new Date(data.reportAt)) : '';
        slides[3].eyebrow = `ANDY'S WATCH${observedAt ? ` · ${observedAt} 기준` : ''}`;
        slides[3].title = `일봉 ${daily} · 4시간봉 ${fourHour}`;
        slides[3].copy = support
          ? `그중 ${support}종목은 4시간봉 지지 확인 단계. 공개된 관찰 기록을 이어 볼 수 있어요.`
          : '돌파와 눌림이 어떻게 이어졌는지 공개된 기록에서 확인해 보세요.';
        if (active === 3) show(active);
      })
      .catch(() => { /* The live lounge remains usable if the public summary is unavailable. */ });
  }

  function updatePauseButton() {
    const button = root.querySelector('[data-rotation-toggle]');
    if (!button) return;
    button.textContent = paused ? '▶' : 'Ⅱ';
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? '자동 넘김 시작' : '자동 넘김 멈추기');
  }

  root.querySelector('[data-rotation-prev]')?.addEventListener('click', () => show(active - 1));
  root.querySelector('[data-rotation-next]')?.addEventListener('click', () => show(active + 1));
  share?.addEventListener('click', () => {
    if (typeof window.bgShareDailyChallenge === 'function') {
      window.bgShareDailyChallenge('loungeRotationShareStatus', 'loungeRotationInviteCopy');
    }
  });
  root.querySelector('[data-rotation-toggle]')?.addEventListener('click', () => {
    paused = !paused;
    updatePauseButton();
  });
  dots.forEach((dot, index) => dot.addEventListener('click', () => show(index)));
  root.addEventListener('pointerenter', () => { pointerInside = true; });
  root.addEventListener('pointerleave', () => { pointerInside = false; });
  root.addEventListener('focusin', () => { focusInside = true; });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) focusInside = false;
  });
  document.addEventListener('visibilitychange', updatePauseButton);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDailyRound(); });
  window.addEventListener('pageshow', updateDailyRound);
  window.addEventListener('storage', event => {
    if (!event.key || event.key === 'tapeBlindDailyStreakV1') updateDailyRound();
  });
  window.addEventListener('tape-blind-daily-updated', updateDailyRound);

  const sessionObserver = new MutationObserver(() => {
    const badge = document.getElementById('sessionBadge')?.textContent?.trim();
    const summary = document.getElementById('sessionCopy')?.textContent?.trim();
    if (!summary) return;
    slides[2].eyebrow = badge && badge !== 'LATEST' ? `SESSION CHAMPIONSHIP · ${badge}` : 'SESSION CHAMPIONSHIP';
    const leader = summary.match(/^([A-Z]+) 세션이 등락률 ([+-]?[0-9.]+%)/);
    slides[2].title = leader ? `${leader[1]} 세션 ${leader[2]}` : '세션마다 다른 판이 열립니다';
    slides[2].copy = summary || '아시아·유럽·미국의 최근 회차를 같은 기준으로 비교합니다.';
    if (active === 2) show(active);
  });
  const sessionCopy = document.getElementById('sessionCopy');
  if (sessionCopy) sessionObserver.observe(sessionCopy, { childList: true, characterData: true, subtree: true });

  updateDailyRound();
  show(active);
  updatePauseButton();
  window.setInterval(() => {
    if (!paused && !pointerInside && !focusInside && !document.hidden && inViewport && root.offsetParent !== null) show(active + 1);
  }, 20000);
})();
