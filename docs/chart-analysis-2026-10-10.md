# Chart analysis · 장기 빗각

- Main navigation: `analysis`, direct hash `/#analysis`, redirect route `/analysis/`.
- Redirect preserves query parameters, including `internal=1`.
- Lounge chart has no extra analysis or overlay controls. Analysis remains accessible through the main navigation and standalone `/analysis/` URL. BTC always has its native 13-line overlay; old local OFF preferences are ignored. Other symbols do not receive BTC rails.
- The live overlay calculates each rail from fixed anchors at existing candle timestamps, including live candle updates. A native series primitive extends the same rails from the last candle to the right edge of the visible pane. These are geometric projections, not price predictions or synthetic candles: the data timeline and MACD/RSI data remain unchanged. Ray coordinates update with scrolling, zooming, resizing and new bars; monthly projection uses actual calendar months. It uses a linear price axis and excludes rails and projections from autoscale. No automatic refitting is performed. Intraday rails may lie outside the visible price range; existing week/month timeframe controls remain unchanged.
- Long-term linear-price channel is the default. The 2022-onward channel is folded into an optional comparison.
- Analysis-image snapshot source: Binance BTCUSDT weekly candles, 2017.08–2026.10.25 (latest fully closed week). The 2026-10-26 week is shown separately as an incomplete candle at the 2026-11-01 snapshot price. This is not the full history of Bitcoin and is not live data; the Lounge candles remain live.
- Long-term slope uses weekly lows from 2018-12-10 and 2022-11-21. The parallel line through the 2021-11-08 weekly high defines a width, subdivided into quarters and extended into 13 parallel rails. Anchors are selected retrospectively; apparent contacts are not independently validated support/resistance.
- No logarithmic price axis, forecast, automatic signal, AI request, new market request, database write or order action is implemented by the analysis component.
- The long chart loads once on opening the tab. The comparison chart loads only on expansion of its details panel. Zoom changes presentation only, with native horizontal scrolling.
- **2026-10-31 update:** chart-analysis visits now use the same privacy-preserving `record_site_activity` RPC as the seven other tabs. The additive `include_analysis_in_site_analytics` migration expands the current RPC's tab allowlist and preserves its existing owner, grants, write limits, and internal-traffic exclusion. The browser-side skip is removed. No missing historical visits are reconstructed. See [site management](site-management.md) for deployment order and rollback-only integration checks.
- Static checks: `node scripts/test_nav.cjs`, `node scripts/test_chart_analysis.cjs`, and `node scripts/test_btc_long_channel.cjs`.
- Overlay browser QA checks BTC-only scope, always-visible rails despite old OFF preferences, removed controls and shortcuts, existing candle timestamps only, repeated intrabar updates and competing timeframe requests. No trading logic is modified.
- Browser QA: mobile 320px/390px and desktop 1440px; tab selection, lazy image loading, zoom, comparison expansion, keyboard activation, hash reload and query-preserving redirect. Test browsers block external POST requests and WebSockets.

## 2026-11-01 snapshot refresh

- Reused the existing long-term anchors: weekly lows on 2018-12-10 and 2022-11-21, with the 2021-11-08 high setting the parallel-channel width. The 2026-06-29 low ($57,800.19) is near the long-channel +2 rail ($55,095.98); the latest completed weekly close ($80,154.09) is between +3 ($70,241) and +4 ($84,430). This supports retaining the historical anchors rather than refitting them to one recent move; it does not validate them as predictive support.
- The snapshot includes 480 confirmed weekly candles through 2026-10-25 and a visually distinct incomplete week that began 2026-10-26. The live BTC quote is separately marked; the report's rightward rails are geometry only.
- Lounge `MARKET CONTEXT` carousel was removed from the shared entry template. Top market tiles and the Session Championship remain. Its carousel styles, event handlers and one-second polling were removed; market-event subscription remains for chart annotations.

## 2026-11-01 02:29 KST quote refresh

- Refreshed the spot-price marker and the still-open 2026-10-26 weekly candle from Binance Spot BTC/USDT. At the snapshot: open $80,154.09, high $81,971.00, low $76,325.98, latest price $77,613.26. The previous fully closed weekly candle remains 2026-10-19 through 2026-10-25.
- The historical channel anchors, slope and spacing are unchanged. This is a quote/candle refresh, not a refit to recent prices; the current week remains visibly provisional and the rails remain geometric extensions.
