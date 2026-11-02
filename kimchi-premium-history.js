(() => {
  const section = document.querySelector('[data-kp-history]');
  if (!section) return;

  let copy;
  try {
    copy = JSON.parse(section.dataset.copy || '{}');
  } catch {
    return;
  }

  const locale = document.documentElement.lang || 'ko';
  const svg = section.querySelector('[data-kp-chart]');
  const buttons = [...section.querySelectorAll('[data-kp-days]')];
  const status = section.querySelector('[data-kp-status]');
  const accessibleList = section.querySelector('[data-kp-table]');
  const CACHE_KEY = 'tape-lounge-kimchi-history-v1';
  const CACHE_MS = 6 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  let points = null;
  let selectedDays = 90;
  let loading = false;
  let loaded = false;

  const kstDate = date => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  const shiftDate = (value, amount) => {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  };
  const dateDistance = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const validPoints = value => Array.isArray(value) && value.length >= 30 && value.every(item =>
    validDate(item.date) && Number.isFinite(item.usd) && Number.isFinite(item.usdt));
  const formatPercent = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Math.abs(value))}%`;
  const formatTick = value => `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0
  }).format(value)}%`;
  const formatDate = value => new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC', month: 'short', day: 'numeric'
  }).format(new Date(`${value}T12:00:00Z`));
  const setStatus = value => { status.textContent = value; };
  const addSvg = (tag, attrs = {}, parent = svg) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    parent.append(node);
    return node;
  };
  const niceStep = range => {
    const raw = range / 4;
    const scale = 10 ** Math.floor(Math.log10(Math.max(raw, 0.01)));
    const normalized = raw / scale;
    const multiplier = [1, 2, 2.5, 5, 10].find(value => normalized <= value) || 10;
    return multiplier * scale;
  };

  function draw() {
    if (!validPoints(points)) return;
    if (selectedDays === 90 && points.length < 90) selectedDays = 30;
    const visible = points.slice(-Math.min(selectedDays, points.length));
    const series = [
      { key: 'usd', className: 'usd', label: copy.seriesUsd },
      { key: 'usdt', className: 'usdt', label: copy.seriesUsdt }
    ];
    const values = visible.flatMap(point => [point.usd, point.usdt]);
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    if (maxValue === minValue) { minValue -= 0.5; maxValue += 0.5; }
    const padding = Math.max((maxValue - minValue) * 0.1, 0.15);
    const step = niceStep(maxValue - minValue + padding * 2);
    const low = Math.floor((minValue - padding) / step) * step;
    const high = Math.ceil((maxValue + padding) / step) * step;
    const plot = { left: 62, right: 744, top: 18, bottom: 274 };
    const x = index => plot.left + (visible.length < 2 ? 0 : index * (plot.right - plot.left) / (visible.length - 1));
    const y = value => plot.bottom - ((value - low) / (high - low)) * (plot.bottom - plot.top);

    svg.replaceChildren();
    const title = addSvg('title', { id: 'kp-history-svg-title' });
    title.textContent = `${copy.chartDescription} · ${formatDate(visible[0].date)}–${formatDate(visible.at(-1).date)}`;
    const desc = addSvg('desc');
    desc.textContent = `${copy.seriesUsd}: ${formatPercent(visible.at(-1).usd)}. ${copy.seriesUsdt}: ${formatPercent(visible.at(-1).usdt)}.`;
    svg.setAttribute('aria-labelledby', 'kp-history-svg-title');

    for (let tick = low; tick <= high + step * 0.01; tick += step) {
      const tickY = y(tick);
      addSvg('line', {
        x1: plot.left, x2: plot.right, y1: tickY, y2: tickY,
        class: Math.abs(tick) < step / 1000 ? 'kp-zero-line' : 'kp-grid-line'
      });
      const label = addSvg('text', { x: plot.left - 9, y: tickY + 4, 'text-anchor': 'end', class: 'kp-axis-label' });
      label.textContent = formatTick(tick);
    }

    const labelIndexes = [...new Set([0, Math.floor((visible.length - 1) / 2), visible.length - 1])];
    for (const index of labelIndexes) {
      const label = addSvg('text', {
        x: x(index), y: plot.bottom + 26,
        'text-anchor': index === 0 ? 'start' : index === visible.length - 1 ? 'end' : 'middle',
        class: 'kp-axis-label'
      });
      label.textContent = formatDate(visible[index].date);
    }

    for (const item of series) {
      const coordinates = visible.map((point, index) => `${x(index).toFixed(2)},${y(point[item.key]).toFixed(2)}`).join(' ');
      addSvg('polyline', { points: coordinates, class: `kp-line kp-line-${item.className}` });
      visible.forEach((point, index) => {
        const circle = addSvg('circle', {
          cx: x(index), cy: y(point[item.key]), r: 2.4,
          class: `kp-point-${item.className}`
        });
        const pointTitle = addSvg('title', {}, circle);
        pointTitle.textContent = `${point.date} · ${item.label}: ${formatPercent(point[item.key])}`;
      });
    }

    section.querySelector('[data-kp-latest-usd]').textContent = formatPercent(visible.at(-1).usd);
    section.querySelector('[data-kp-latest-usd]').dataset.tone = visible.at(-1).usd >= 0 ? 'positive' : 'negative';
    section.querySelector('[data-kp-latest-usdt]').textContent = formatPercent(visible.at(-1).usdt);
    section.querySelector('[data-kp-latest-usdt]').dataset.tone = visible.at(-1).usdt >= 0 ? 'positive' : 'negative';
    section.querySelector('[data-kp-asof]').textContent = copy.asof
      .replace('{date}', visible.at(-1).date)
      .replace('{count}', String(visible.length));
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.kpDays) === selectedDays));
      if (Number(button.dataset.kpDays) === 90) button.disabled = points.length < 90;
    }

    const rows = visible.slice(-10).map(point => {
      const item = document.createElement('li');
      item.textContent = `${copy.dateLabel}: ${point.date}; ${copy.seriesUsd}: ${formatPercent(point.usd)}; ${copy.seriesUsdt}: ${formatPercent(point.usdt)}`;
      return item;
    });
    accessibleList.replaceChildren(...rows);
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!value || value.version !== 1 || !Number.isFinite(value.savedAt) || !validPoints(value.points)) return null;
      return value;
    } catch {
      return null;
    }
  }

  function writeCache(value) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), points: value }));
    } catch { /* Private browsing or full storage: keep this visit working. */ }
  }

  async function getJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Historical quote request failed: ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function dateRate(rates, date) {
    for (let index = rates.length - 1; index >= 0; index -= 1) {
      if (rates[index].date <= date && dateDistance(rates[index].date, date) <= 7) return rates[index].rate;
    }
    return null;
  }

  async function fetchHistory() {
    const today = kstDate(new Date());
    const firstDate = shiftDate(today, -90);
    const fromFx = shiftDate(today, -120);
    const [btcRows, usdtRows, fxRows] = await Promise.all([
      getJson('https://api.bithumb.com/v1/candles/days?market=KRW-BTC&count=200'),
      getJson('https://api.bithumb.com/v1/candles/days?market=KRW-USDT&count=200'),
      getJson(`https://api.frankfurter.dev/v2/rates?base=USD&quotes=KRW&from=${fromFx}&to=${today}`)
    ]);
    if (!Array.isArray(btcRows) || !Array.isArray(usdtRows) || !Array.isArray(fxRows)) throw new Error('Unexpected history response');

    const btcByDate = new Map();
    const usdtByDate = new Map();
    for (const candle of btcRows) {
      const date = candle?.candle_date_time_kst?.slice(0, 10);
      const close = Number(candle?.trade_price);
      if (validDate(date) && date >= firstDate && date < today && Number.isFinite(close) && close > 0) btcByDate.set(date, { candle, close });
    }
    for (const candle of usdtRows) {
      const date = candle?.candle_date_time_kst?.slice(0, 10);
      const close = Number(candle?.trade_price);
      if (validDate(date) && date >= firstDate && date < today && Number.isFinite(close) && close > 0) usdtByDate.set(date, close);
    }
    const rates = fxRows.map(row => ({ date: row?.date, rate: Number(row?.rate) }))
      .filter(row => validDate(row.date) && Number.isFinite(row.rate) && row.rate > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const records = [...btcByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, data]) => {
      const usdtKrw = usdtByDate.get(date);
      const usdKrw = dateRate(rates, date);
      if (!usdtKrw || !usdKrw) return [];
      const utcStart = Date.parse(`${data.candle.candle_date_time_utc}Z`);
      if (!Number.isFinite(utcStart)) return [];
      const binanceOpen = utcStart + 23 * HOUR;
      if (binanceOpen % HOUR !== 0) return [];
      return [{ date, localBtc: data.close, usdtKrw, usdKrw, binanceOpen }];
    });
    if (records.length < 30) throw new Error('Not enough aligned daily quotes');

    const firstOpen = records[0].binanceOpen;
    const lastOpen = records.at(-1).binanceOpen;
    const totalHours = Math.floor((lastOpen - firstOpen) / HOUR) + 1;
    const requests = [];
    for (let offset = 0; offset < totalHours; offset += 1000) {
      const startTime = firstOpen + offset * HOUR;
      const endTime = Math.min(lastOpen, startTime + 999 * HOUR);
      const params = new URLSearchParams({ symbol: 'BTCUSDT', interval: '1h', startTime: String(startTime), endTime: String(endTime), limit: '1000' });
      requests.push(getJson(`https://data-api.binance.vision/api/v3/klines?${params}`));
    }
    const klineChunks = await Promise.all(requests);
    const binanceByOpen = new Map();
    for (const chunk of klineChunks) {
      if (!Array.isArray(chunk)) throw new Error('Unexpected Binance candle response');
      for (const candle of chunk) {
        const open = Number(candle?.[0]);
        const close = Number(candle?.[4]);
        if (Number.isFinite(open) && Number.isFinite(close) && close > 0) binanceByOpen.set(open, close);
      }
    }
    const result = records.flatMap(record => {
      const btcUsdt = binanceByOpen.get(record.binanceOpen);
      if (!btcUsdt) return [];
      const usd = (record.localBtc / (btcUsdt * record.usdKrw) - 1) * 100;
      const usdt = (record.localBtc / (btcUsdt * record.usdtKrw) - 1) * 100;
      return Number.isFinite(usd) && Number.isFinite(usdt) ? [{ date: record.date, usd, usdt }] : [];
    });
    if (result.length < 30) throw new Error('Not enough complete, aligned history');
    return result.slice(-90);
  }

  async function load() {
    if (loading || loaded) return;
    loading = true;
    const cached = readCache();
    const cacheAge = cached ? Date.now() - cached.savedAt : Infinity;
    if (cached && cacheAge < CACHE_MS) {
      points = cached.points;
      draw();
      setStatus(points.length < 90 ? copy.partial.replace('{count}', String(points.length)) : copy.cached);
      loaded = true;
      loading = false;
      return;
    }

    setStatus(copy.loading);
    try {
      points = await fetchHistory();
      selectedDays = points.length >= 90 ? 90 : 30;
      draw();
      writeCache(points);
      setStatus(points.length < 90 ? copy.partial.replace('{count}', String(points.length)) : copy.updated);
      loaded = true;
    } catch {
      if (cached) {
        points = cached.points;
        selectedDays = points.length >= 90 ? 90 : 30;
        draw();
        setStatus(copy.stale);
        loaded = true;
      } else {
        setStatus(copy.error);
      }
    } finally {
      loading = false;
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    if (!points) { void load(); return; }
    selectedDays = Number(button.dataset.kpDays);
    draw();
  }));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void load();
    }, { rootMargin: '240px 0px' });
    observer.observe(section);
  } else {
    void load();
  }
})();
