# Chart analysis · 장기 빗각

- Main navigation: `analysis`, direct hash `/#analysis`, redirect route `/analysis/`.
- Redirect preserves query parameters, including `internal=1`.
- Lounge chart has no extra analysis or overlay controls. Analysis remains accessible through the main navigation and standalone `/analysis/` URL. BTC always has its native 13-line overlay; old local OFF preferences are ignored. Other symbols do not receive BTC rails.
- The live overlay calculates each rail from fixed anchors at existing candle timestamps, including live candle updates. It uses a linear price axis and excludes the rails from autoscale so they do not distort the candle range. It adds no future timestamps or automatic refitting. Intraday rails may lie outside the visible price range; existing week/month timeframe controls remain unchanged.
- Long-term linear-price channel is the default. The 2022-onward channel is folded into an optional comparison.
- Analysis-image snapshot source: Binance BTCUSDT weekly candles, 2017.08–2026.10.09. This is not the full history of Bitcoin and is not live data; the Lounge candles remain live.
- Long-term slope uses weekly lows from 2018-12-10 and 2022-11-21. The parallel line through the 2021-11-08 weekly high defines a width, subdivided into quarters and extended into 13 parallel rails. Anchors are selected retrospectively; apparent contacts are not independently validated support/resistance.
- No logarithmic price axis, forecast, automatic signal, AI request, new market request, database write or order action is implemented by the analysis component.
- The long chart loads once on opening the tab. The comparison chart loads only on expansion of its details panel. Zoom changes presentation only, with native horizontal scrolling.
- Existing Supabase `record_site_activity` only accepts seven old tab IDs. The client skips that RPC while `activeTab === 'analysis'` to prevent `INVALID_TAB`. Analysis-tab views/time are not collected in this release; database schema and audience policy are unchanged. Existing tabs keep their normal analytics behavior.
- Static checks: `node scripts/test_nav.cjs`, `node scripts/test_chart_analysis.cjs`, and `node scripts/test_btc_long_channel.cjs`.
- Overlay browser QA checks BTC-only scope, always-visible rails despite old OFF preferences, removed controls and shortcuts, existing candle timestamps only, repeated intrabar updates and competing timeframe requests. No trading logic is modified.
- Browser QA: mobile 320px/390px and desktop 1440px; tab selection, lazy image loading, zoom, comparison expansion, keyboard activation, hash reload and query-preserving redirect. Test browsers block external POST requests and WebSockets.
