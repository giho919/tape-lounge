# 국내장 (2026-09-09)

Existing static GitHub Pages architecture preserved. No new market-data backend, trading,
Telegram or scheduled-task changes. `#domestic` uses the normal tab/analytics lifecycle.
Existing live seven-argument `record_site_activity` allowlist expanded with `domestic`
only, preserving security, limits, internal exclusion and referrer handling. Remote
migration: `allow_domestic_tab_in_site_analytics`. Internal test transaction verified
the new tab's view count and rolled back; no synthetic visitor rows retained.
The SQL bootstrap's older signature is not reapplied to production.

- Upbit KRW ticker/all, Bithumb v1 market/all + ticker batches of 80, Binance public
  market-data-only 24hr endpoint, Frankfurter daily USD/KRW. No credentials.
- Runs every 30 seconds only while this tab is visible. Bounded 12-second requests;
  hidden tabs abort pending requests, use generation checks and stop the timer.
- Last local trade / foreign ticker over 120s old: premium suppressed, old quote labeled.
  FX date over seven days: suppressed. Never substitute a fixed FX or zero.
- FX basis assumes 1 USDT approximately 1 USD, labeled approximation. Domestic
  USDT basis uses the selected venue's fresh KRW-USDT price. These are not mixed.
- Positive premium leaders require KRW 1 billion 24h turnover. Not a flow or buy signal.
  Absolute spreads over 50% suppressed. Symbol matches do not guarantee token/network
  identity. Deposit/withdrawal status explicitly unverified; no net-arbitrage claims.
- Andy reads only the published same-origin report: `.hdr .ts` KST timestamp and
  `#andy-retest table` rows. Only 지지 확인/재출발 stages. Missing/changed structure or
  report over 36 hours old must not produce current candidates. Never execute report code.
- Stars persisted locally, scoped `tl_domestic_favorites`; no account data.
- Automated pure calculation/source integration checks: `node scripts/test_domestic.cjs`.
  Runtime adapter checks: `node scripts/test_domestic_runtime.cjs` (six checks including
  actual published Andy table contract). No browser visual testing was requested.
  Public API access/CORS and Bithumb 80-market batch checked separately.

Sources: https://docs.upbit.com/kr/kr/reference/list-quote-tickers
https://apidocs.bithumb.com/ https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md
https://frankfurter.dev/
