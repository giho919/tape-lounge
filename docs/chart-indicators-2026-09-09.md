# Chart indicators — 2026-09-09

## Scope and defaults

- Lounge BTC/ETH/BTC.D/NASDAQ and the blind solo/shared chart use SMA 5/20/60/120/200.
- Supertrend: Wilder ATR length 10, multiplier 3, HL2 source. Defaults chosen because
  the user did not specify Supertrend parameters. This is a chart overlay only.
- Green up / red down dashed line, width 2; SMA remains width 1 solid. The shared
  legend is generated from constants and wraps below the timeframe controls.
- Desk structure analytics (EMA 20/50/200, RSI/ATR), server strategies, thresholds,
  order execution, chat prompts and scheduled jobs are unchanged.

## Calculation and rendering

True range includes gaps from the previous close (first candle uses high-low).
The first ATR is the mean of ten true ranges; subsequent values use Wilder RMA.
Until the initial ATR exists no line is plotted. Initial trend is down. Bands
trail until the prior close breaks them; the current close decides a direction
change. The open candle is provisional and may flip back before closing.

Each update recomputes from the previous candle's immutable state, not from the
last update of the same candle. No tick-by-tick ATR drift. A new candle advances
state exactly once. Rendering retains at most 2,000 points without resetting ATR;
history reseeding reinitializes from the fetched history, so results may differ
slightly from platforms with different history lengths or ATR initialization.

LWC 4.2 colors a line segment using its starting point. Only the outgoing bridge
at a direction change is transparent: no misleading diagonal connecting bands.
Reversal of an intrabar flip restores the previous segment's color. A complete
setData is used only for seeding, a changed bridge, or buffer pruning; ordinary
ticks update one point. This adds no requests, timers or external dependencies.

Hydration replays the buffered live candle into SMA and Supertrend. Timeframe
switches disconnect the previous feed, clear all chart/indicator caches, and
ignore obsolete history responses and old-interval websocket messages. Older
candles are rejected. The blind chart only seeds through bg.idx and advances one
revealed candle at a time; hidden future OHLC is never read by these indicators.

## Verification

- `node scripts/test_chart_indicators.cjs`: SMA windows, hand-calculated ATR/gap
  fixture, independent batch Supertrend oracle, both directions, no future dependence,
  repeated intrabar flips/restoration, reset, stale timestamps and bounded state.
- `node scripts/test_chart_indicators_ui.cjs`: actual pinned LWC 4.2 in Chromium at
  1440/390/360px; all four charts, seven intervals, racing timeframe requests,
  live/new/stale candles, legends/overflow, blind revealed-only seed and advance.
- Existing 41 Python tests, chat-send tests, readability tests, crew-card tests and
  full-app public-read smoke also run. All browser writes and WebSockets blocked;
  synthetic candle fixtures exist only in an isolated browser, never published.

## Primary references

- [TradingView Supertrend calculation](https://www.tradingview.com/support/solutions/43000634738-supertrend/)
- [Lightweight Charts 4.2 series API](https://tradingview.github.io/lightweight-charts/docs/4.2/series-types)
- [LWC 4.2 line renderer](https://github.com/tradingview/lightweight-charts/blob/v4.2.0/src/renderers/walk-line.ts)
