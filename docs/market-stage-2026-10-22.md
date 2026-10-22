# Market stage — 2026-10-22 (superseded)

The owner later asked to roll the public homepage back to the casino-style terminal.
The root now mirrors `/terminal/`; this experiment remains in git history and the
localized discovery pages, but is no longer the main experience.

Supersedes the paper/ink home reviewed earlier today. No trading, model, messaging,
account/order services or database policies were changed.

## Visitor flow

- `/{ko,en,zh,ja}/`: single chart-first dark lounge. Live BTC/ETH/SOL/XRP spot,
  actual received trades, public market-event markers and a quiet-view option.
- Replay: select an archived scene, scrub closed 1m candles, play, or return live.
  Historical tick flow is not reconstructed. All-market futures liquidations are
  labelled against a BTC spot reference, never described as exclusively BTC.
- Your call: a complete previous-UTC-day BTC breakout, chosen chronologically,
  frozen for the day, with future candles withheld from the plotted series until
  a local choice/skip. The result compares the reference closed spot candle with
  the observed close within +15m. No money, prizes, remote scores or claims of skill.
  Source JSON is public: this is a casual exercise, not cheat-proof competition.
- My observations: reference price, scene time and actual recording time stay
  distinct. Notes (100), choices (90), saved symbols and return snapshots live in
  localStorage only. Storage-blocked mode lasts only for the current visit.
- Conversation: same `salon_chat`, explicit AI/HUMAN labels, optional
  `[tl-scene:<16hex>] ` body prefix within the existing 200-character limit.
  Both lounge and old terminal turn that prefix into a scene link. No schema/RLS
  changes. Existing anonymous auth, Turnstile and DB rate limits remain required.
  Browsing creates no auth user. Polling only while the discussion pane is visible.

## Sources and publishing

`stage.js`, `stage-community.js`, `stage.css`, `scripts/stage_content.py` provide
the interaction/UI. The stdlib builder retains canonicals, hreflang, JSON-LD,
sitemap, RSS and server-readable text; it versions the new assets too.
`data/stage-config.json` contains only constants already public in the old frontend:
publishable key, URL, public CAPTCHA key, pinned SDK URL/SRI and translated UI copy.
Never put a service-role key or private data in this file or repository.

`python3 scripts/collect_scenes.py --collect` reads the public event API (47h/500
rows) and Binance public 1m spot candles. Up to 100 new/incomplete scenes per run,
20 minutes before through 30 minutes after the event, closed candles only. New-file
quotas per UTC hour are 3 price events, 3 liquidation/jackpot events, 2 whales and
1 candle event; existing/incomplete records are retained/completed. This bounds
static storage growth and duplicate minutes without selecting future winners.
The filename is SHA256(event_key)[:16]. Complete individual scene files are immutable.
The filmstrip manifest retains 180 entries; old scene permalinks keep their files.
Sampling limits mean this is a curated-size archive, not an exhaustive audit ledger.
No chat/account records are copied. Public source outages preserve the last archive.

Existing minute-17 hourly website-only publisher now collects scenes before build,
in an isolated checkout with flock and rebase. Browser live quotes/events refresh
every 30s, archive index every 10m, conversation every 15s while visible. The trade
socket is one combined stream for the selected asset; hidden tabs close it and
pause playback. Animations are bounded and respect reduced-motion.

Foreign exchange is a dated daily Frankfurter reference, not an executable FX quote.
The home premium is Upbit/Binance; the old terminal and markets retain their labelled
sources. Andy candidates display report timestamps, not claims of current live scans.
Event sequence alone is not represented as proof of causation.

## Compatibility / verification boundaries

`/terminal/` preserves detailed indicators, long BTC channels, games and older tabs.
Original `/reports/` URLs remain unchanged. Older root hash bookmarks redirect there.
Internal visits retain `?internal=1` and existing analytics exclusion. Four locale
pages remain first-class static routes, not machine-translated redirects.

QA must check public reads, replay controls, live return, local note persistence,
daily reveal, language switching and narrow viewport. Never send test posts to
public chat, create test auth users or trigger bot/Telegram/order paths for UI QA.
Screenshot availability and retention gains must not be claimed without evidence.
