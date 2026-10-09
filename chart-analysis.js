/* Static snapshots only: no market requests, sockets, AI calls or live overlays. */
(() => {
  'use strict';
  const section = document.getElementById('tab-analysis');
  if (!section) return;
  const zoom = document.getElementById('caZoom');
  const recent = document.getElementById('caRecent');
  const status = document.getElementById('caStatus');
  function positionExpanded() {
    if (!section.classList.contains('ca-expanded')) return;
    section.querySelectorAll('.ca-scroll').forEach(scroller => {
      const image = scroller.querySelector('img');
      if (image && image.hasAttribute('src')) scroller.scrollLeft = Math.max(0, image.clientWidth * .8 - scroller.clientWidth * .5);
    });
  }
  function load(image) {
    if (!image || image.hasAttribute('src')) return;
    image.addEventListener('load', () => {
      if (image.id === 'caLongImage') status.textContent = '2026.10.09 기준 고정 자료 · 실시간 시세가 아닙니다.';
      positionExpanded();
    }, {once:true});
    image.addEventListener('error', () => {
      status.textContent = '차트를 불러오지 못했습니다. 분석 원본 링크로 확인해 주세요.';
    }, {once:true});
    image.src = image.dataset.src;
  }
  function init() {
    const image = document.getElementById('caLongImage');
    if (!image.hasAttribute('src')) status.textContent = '장기 빗각 차트를 불러오는 중입니다.';
    load(image);
    if (recent.open) load(recent.querySelector('img'));
  }
  window.initChartAnalysis = init;
  zoom.addEventListener('click', () => {
    const expanded = section.classList.toggle('ca-expanded');
    zoom.setAttribute('aria-pressed', String(expanded));
    zoom.textContent = expanded ? '전체 흐름 보기' : '확대해서 보기';
    if (expanded) requestAnimationFrame(positionExpanded);
  });
  recent.addEventListener('toggle', () => {
    if (recent.open && !section.classList.contains('hidden')) load(recent.querySelector('img'));
  });
  document.querySelectorAll('[data-analysis-open]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="analysis"]')?.click();
      window.scrollTo({top:0,behavior:'auto'});
    });
  });
  // Hash selection can run before this deferred script finishes loading.
  if (!section.classList.contains('hidden')) init();
})();
