(() => {
  const form = document.getElementById('kp-form');
  if (!form) return;

  const locale = document.documentElement.lang || 'ko';
  const copy = {
    ko: { pending: '네 값을 입력하면 계산 결과가 표시됩니다.', invalid: '네 값 모두 0보다 큰 숫자로 입력해 주세요.', loading: '공개 시세와 환율을 불러오는 중…', success: '시세 조회 완료 · KST {time} · USD/KRW 기준일 {date}', error: '시세를 모두 불러오지 못했습니다. 잠시 뒤 다시 시도하거나 직접 입력해 주세요.' },
    en: { pending: 'Enter all four values to see the comparison.', invalid: 'Enter a number greater than zero in every field.', loading: 'Fetching public market quotes and reference FX…', success: 'Quotes loaded · KST {time} · USD/KRW reference date {date}', error: 'Could not retrieve all quotes. Try again or enter the values manually.' },
    zh: { pending: '输入四个数值后显示结果。', invalid: '每个输入框都需要填写大于零的数字。', loading: '正在读取公开行情与参考汇率…', success: '报价已载入 · KST {time} · USD/KRW 汇率日期 {date}', error: '未能取得全部报价。请稍后重试，或手动输入数值。' },
    ja: { pending: '4つの値を入力すると結果を表示します。', invalid: 'すべての欄に0より大きい数値を入力してください。', loading: '公開価格と参考為替を取得中…', success: '価格を取得しました · KST {time} · USD/KRW 参考日 {date}', error: 'すべての価格を取得できませんでした。再試行するか、手動で入力してください。' }
  }[locale] || { pending: 'Enter all four values to see the comparison.', invalid: 'Enter a number greater than zero in every field.' };
  const fields = ['kp-local', 'kp-binance', 'kp-usd', 'kp-usdt'].map(id => document.getElementById(id));
  const status = document.getElementById('kp-status');
  const example = document.getElementById('kp-example');
  const liveButton = document.getElementById('kp-live-quotes');
  const resultIds = ['kp-usd-value', 'kp-usd-premium', 'kp-usdt-value', 'kp-usdt-gap', 'kp-basis-value'];

  const parse = field => {
    const raw = field.value.replace(/[\s,，]/g, '');
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : NaN;
  };
  const money = value => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'KRW', maximumFractionDigits: 0
  }).format(value);
  const percent = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Math.abs(value))}%`;
  const tone = value => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  const set = (id, value, valueTone) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = value;
    if (valueTone) node.dataset.tone = valueTone;
  };
  const clearResults = () => resultIds.forEach(id => set(id, '—', 'neutral'));
  const getJSON = async url => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Quote request failed');
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const update = () => {
    const values = fields.map(parse);
    if (values.some(Number.isNaN)) {
      clearResults();
      status.textContent = copy.invalid;
      return;
    }
    if (values.some(value => value === null)) {
      clearResults();
      status.textContent = fields.every(field => !field.value.trim()) ? copy.pending : copy.invalid;
      return;
    }

    const [localKrw, btcUsdt, usdKrw, usdtKrw] = values;
    const usdBenchmark = btcUsdt * usdKrw;
    const usdtBenchmark = btcUsdt * usdtKrw;
    const usdPremium = (localKrw / usdBenchmark - 1) * 100;
    const usdtGap = (localKrw / usdtBenchmark - 1) * 100;
    const tetherBasis = (usdtKrw / usdKrw - 1) * 100;
    if (![usdBenchmark, usdtBenchmark, usdPremium, usdtGap, tetherBasis].every(Number.isFinite)) {
      clearResults();
      status.textContent = copy.invalid;
      return;
    }

    set('kp-usd-value', money(usdBenchmark));
    set('kp-usd-premium', percent(usdPremium), tone(usdPremium));
    set('kp-usdt-value', money(usdtBenchmark));
    set('kp-usdt-gap', percent(usdtGap), tone(usdtGap));
    set('kp-basis-value', percent(tetherBasis), tone(tetherBasis));
    status.textContent = '';
  };

  fields.forEach(field => field.addEventListener('input', update));
  form.addEventListener('reset', () => window.setTimeout(update, 0));
  liveButton?.addEventListener('click', async () => {
    liveButton.disabled = true;
    liveButton.setAttribute('aria-busy', 'true');
    status.textContent = copy.loading;
    try {
      const [upbit, binance, bithumb, fx] = await Promise.all([
        getJSON('https://api.upbit.com/v1/ticker?markets=KRW-BTC'),
        getJSON('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT'),
        getJSON('https://api.bithumb.com/v1/ticker?markets=KRW-USDT'),
        getJSON('https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW')
      ]);
      const localKrw = Number(Array.isArray(upbit) && upbit.find(item => item.market === 'KRW-BTC')?.trade_price);
      const btcUsdt = Number(binance?.price);
      const usdtKrw = Number(Array.isArray(bithumb) && bithumb.find(item => item.market === 'KRW-USDT')?.trade_price);
      const usdKrw = Number(fx?.rates?.KRW);
      if (![localKrw, btcUsdt, usdKrw, usdtKrw].every(value => Number.isFinite(value) && value > 0) || typeof fx?.date !== 'string') {
        throw new Error('Invalid quote response');
      }
      [localKrw, btcUsdt, usdKrw, usdtKrw].forEach((value, index) => { fields[index].value = String(value); });
      update();
      const time = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
      status.textContent = copy.success.replace('{time}', time).replace('{date}', fx.date);
    } catch {
      status.textContent = copy.error;
    } finally {
      liveButton.disabled = false;
      liveButton.removeAttribute('aria-busy');
    }
  });
  example?.addEventListener('click', () => {
    ['106500000', '75000', '1400', '1410'].forEach((value, index) => { fields[index].value = value; });
    update();
  });
  update();
  if (liveButton && fields.every(field => !field.value.trim())) liveButton.click();
})();
