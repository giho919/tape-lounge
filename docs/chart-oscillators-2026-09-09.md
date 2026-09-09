# MACD / RSI subpanels — 2026-09-09

User requested English `Supertrend` labeling and separate MACD and RSI below the
chart. Applied to the existing four lounge charts and the blind solo/shared chart.
SMA 5/20/60/120/200 and Supertrend 10×3 calculations remain unchanged.

## Display

- Price (candles, SMA, Supertrend, volume), then MACD, then RSI.
- MACD 12/26/9: blue MACD, orange signal, positive/negative histogram with four
  momentum colors and a zero line. Both averages and signal use EMA.
- RSI 14: purple line, fixed 0–100 scale, 30/50/70 reference lines.
- Headers show the current candle's values; hovering shows a crosshair/axis value.
  Current candle values can change before close. Initial unavailable values show —.
- A shared bottom time axis in the lounge; all date axes remain hidden in blind.
- Scroll, zoom and crosshair synchronize in both directions among the three panels.
  Equal price-axis widths align the same candle to the same horizontal pixel.
- Price watermark stays within the price panel. Existing black/gold styles and
  Lightweight Charts 4.2 dependency are retained (no chart-library upgrade).

## Calculation / lifecycle

EMA uses a mean of its first N samples as seed, then alpha 2/(N+1). MACD starts
at candle 26; its signal and histogram start at candle 34. RSI uses the mean of
the first 14 close changes, then Wilder smoothing. It starts at candle 15.
Flat (zero gain and loss) is explicitly 50; up-only is 100 and down-only is 0.
Platforms with first-value EMA seeds, different source history or flat conventions
may differ near the left edge; do not claim exact platform parity.

Each open-candle update recomputes from the preceding candle state, so repeated
ticks cannot compound EMA/RMA smoothing. Older timestamps are ignored. New candles
advance once; historical seed and streaming calculation agree. Timeframe changes
clear all four oscillator series and reuse existing generation checks. Buffered
live candles replay into the subpanels after history loads. Blind initialization
uses only the revealed slice through bg.idx, then one revealed candle per advance.

Subpanels are created lazily with their price chart, reused across tab visits,
and consume the same candles. No new fetch, websocket, timer, database write, AI
call or dependency is added. Two scalar state snapshots are kept; plotted series
retain the same time coverage as the price chart for logical-index synchronization.
Actual trading bots, desk analytics, scheduled comments and trading rules unchanged.

## Verification

- `test_oscillators.cjs`: independent EMA/MACD/RSI batch calculations, hand-checkable
  RSI example, initialization, repeated intrabar changes, every causal prefix,
  flat/up/down edge cases, stale timestamp and reset.
- `test_chart_indicators_ui.cjs`: actual pinned library, 1440/390/360px, four
  symbols/seven intervals, racing timeframe responses, new/intrabar/stale candles,
  both-direction ranges, same-pixel alignment, crosshair, history-reader position,
  visible values, exactly two panes and blind no-future/no-date checks.
- Existing Supertrend/SMA, chat send, readability, crew-card and full-app smoke
  tests also run. External writes and WebSockets are blocked in browser tests;
  fixtures are never posted to the public site.

References: [MACD](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/),
[RSI](https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/),
[LWC 4.2 time scale API](https://tradingview.github.io/lightweight-charts/docs/4.2/api/interfaces/ITimeScaleApi).
