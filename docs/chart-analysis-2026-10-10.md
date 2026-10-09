# Chart analysis · 장기 빗각

- Main navigation: `analysis`, direct hash `/#analysis`, redirect route `/analysis/`.
- Redirect preserves query parameters, including `internal=1`.
- Lounge chart toolbar has a “장기 빗각 보기” button; live chart calculations and overlays are unchanged.
- Long-term linear-price channel is the default. The 2022-onward channel is folded into an optional comparison.
- Snapshot source: Binance BTCUSDT weekly candles, 2017.08–2026.10.09. This is not the full history of Bitcoin and is not live data.
- Long-term slope uses weekly lows from 2018-12-10 and 2022-11-21. The parallel line through the 2021-11-08 weekly high defines a width, subdivided into quarters and extended into 13 parallel rails. Anchors are selected retrospectively; apparent contacts are not independently validated support/resistance.
- No logarithmic price axis, forecast, automatic signal, AI request, new market request, database write or order action is implemented by the analysis component.
- The long chart loads once on opening the tab. The comparison chart loads only on expansion of its details panel. Zoom changes presentation only, with native horizontal scrolling.
- Existing Supabase `record_site_activity` only accepts seven old tab IDs. The client skips that RPC while `activeTab === 'analysis'` to prevent `INVALID_TAB`. Analysis-tab views/time are not collected in this release; database schema and audience policy are unchanged. Existing tabs keep their normal analytics behavior.
- Static checks: `node scripts/test_nav.cjs` and `node scripts/test_chart_analysis.cjs`.
- Browser QA: mobile 320px/390px and desktop 1440px; tab selection, toolbar shortcut, lazy image loading, zoom, comparison expansion, keyboard activation, hash reload and query-preserving redirect. Test browsers block external POST requests and WebSockets.
