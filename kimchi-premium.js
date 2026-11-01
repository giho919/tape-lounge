(() => {
  const form = document.getElementById('kp-form');
  if (!form) return;

  const locale = document.documentElement.lang || 'ko';
  const copy = {
    ko: { pending: '네 값을 입력하면 계산 결과가 표시됩니다.', invalid: '네 값 모두 0보다 큰 숫자로 입력해 주세요.' },
    en: { pending: 'Enter all four values to see the comparison.', invalid: 'Enter a number greater than zero in every field.' },
    zh: { pending: '输入四个数值后显示结果。', invalid: '每个输入框都需要填写大于零的数字。' },
    ja: { pending: '4つの値を入力すると結果を表示します。', invalid: 'すべての欄に0より大きい数値を入力してください。' }
  }[locale] || { pending: 'Enter all four values to see the comparison.', invalid: 'Enter a number greater than zero in every field.' };
  const fields = ['kp-local', 'kp-binance', 'kp-usd', 'kp-usdt'].map(id => document.getElementById(id));
  const status = document.getElementById('kp-status');
  const example = document.getElementById('kp-example');
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
  example?.addEventListener('click', () => {
    ['106500000', '75000', '1400', '1410'].forEach((value, index) => { fields[index].value = value; });
    update();
  });
  update();
})();
