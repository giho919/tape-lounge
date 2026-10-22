# Discovery-led redesign · 2026-10-22

Presentation superseded after owner review by [the market stage](market-stage-2026-10-22.md).
This document retains the earlier research and SEO architecture history.

This supersedes the earlier same-day presentation at the site front door. Existing
tools remain at `/terminal/` with a root base URL; published report URLs do not move.
No strategy, order, training, Telegram or crew scheduling changes are involved.

## Reference review, not an imitation or a traffic claim

| Reference inspected | Useful pattern | Adaptation |
|---|---|---|
| [Reddit](https://www.reddit.com/) | Scannable stream, explicit categories, compact view | Short observation rows with expandable source history, not endless fabricated posts |
| [GitHub Explore](https://github.com/explore) | Discover → inspect → save | A shared browser-local watchlist from market or candidate rows |
| [Product Hunt](https://www.producthunt.com/) | Clear numbered discovery and readable descriptions | Numbered editorial reading routes; no invented popularity/upvotes |
| [TradingView Markets](https://www.tradingview.com/markets/) | A market index with drill-down destinations | A proper market URL, symbol search, source-aware quotes and chart drill-down |

No reference's assets, articles, branding or code were copied. Pages were inspected
for information architecture; a traffic ranking or a causal retention improvement
was not established. Google guidance informs crawlable links, actual translated
body text, separate locale URLs and no forced IP-language redirects:
[multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites),
[AI features](https://developers.google.com/search/docs/appearance/ai-features).

## Product / design

Paper/ink editorial front, with restrained amber and green. Responsive main nav:
Today / Markets / Radar / Read. Research has a real URL linked from the reading room.
The old black/gold terminal retains its indicators, chat, games and market tools.
Main quotes/charts are progressive enhancements; no random/simulated values are used.
The first screen shows a real price chart and three perspectives, not a wall of widgets.
Source snapshots, terminology and limitations remain explicit.

Markets compares Binance spot with Upbit KRW and a dated Frankfurter reference.
This is not executable arbitrage; USDT/USD basis, fees and transfer limits matter.
Missing/older-than-120-second input quotes do not yield a premium. The old multi-
exchange table remains available in Terminal → Market. The new market index is a
reading surface, not a replacement execution quote service.

## Languages

`/ko/`, `/en/`, `/zh/`, `/ja/` each contain nine real HTML pages: home, markets, watch,
research, reading index, about/methodology, and three original guides. They have
translated article bodies, titles/descriptions, self canonical URLs and reciprocal
hreflang including x-default. Root duplicates Korean with `/ko/` canonical.

Country-based suggestion is only on the neutral root: manual choice first, then
country.is country lookup cached seven days, then browser language fallback. Country
mapping KR→ko, JP→ja, CN/TW/HK/MO→zh, otherwise en. No forced redirect, IP/coordinates
storage or analytics country field. The lookup provider sees the network IP; the
privacy page discloses this. This is approximate country detection, not identity.
Original strategist reports and the classic terminal remain Korean and are labeled
as original content; this deployment does not pretend they have full translations.

## Build and updates

`python3 scripts/build_discovery.py` uses only already published observation and
letter JSON. It makes 37 HTML documents (root plus 4×9), four RSS feeds, sitemap and
a public discovery JSON; it does no exchange fetch, imports from Mirage or messaging.
It preserves report timestamps and does not re-estimate historical signals.

`scripts/publish_discovery.sh` is an hourly, website-only publisher. It uses a locked,
isolated temporary clone rather than touching the report publisher's shared checkout.
Only explicit generated paths are staged; no changes means no commit. A failed push
does not overwrite the remote; its next invocation can rebuild from current data.
Cron logs to `/home/shyoo/logs/tape-lounge-discovery.log` at minute 17 each hour.
Check that log and cron entry for operational status; code existence alone is not proof.

Hash bookmarks for the old detailed screens are redirected to the terminal. Existing
`/desk/`, `/onchain/`, `/calendar/`, `/analysis/`, `/blind/`, `/strategists/` entry points
are retained. Public report URLs remain stable, including Telegram links.

## Search and AI-agent access

Real HTML content, crawlable anchors, sitemap, robots, canonical/hreflang, visible-
content-matching WebPage/Article JSON-LD, dated original guides, sources/limitations,
RSS and public JSON. `llms.txt` is a convenience index, not a ranking requirement.
No fake reviews, publisher credentials, performance results or keyword-stuffed pages.
The sitemap contains localized public pages and the three original reports. The
terminal is noindex/follow; hash-only tools are not presented as indexed articles.

Indexing/ranking and AI citations are not guaranteed. Search Console domain ownership
and sitemap submission require access to the owner's search account; no fabricated
verification token or claim of submission is made. Inspect coverage and query/click
data there after deployment. Main-price data are browser-fetched, not server-indexed
live quotes; static report content is available without JS.

## Measurement / privacy

Reuse `record_site_activity` with the existing publishable key, allowed screen groups,
five-minute inactivity cap, visible-page active seconds, referrer host only and the
existing visitor ID. No new schema, admin key, authentication, presence or public
analytics endpoint. New pages map markets→domestic, home→lounge, others→chars;
therefore report grouping is coarser than individual SEO URLs. Internal visits are
not sent, and `?internal=1` propagates on navigation even if storage is blocked.
Newly saved assets share `tl_domestic_favorites`; saved/return-price state remains local.

Measure external arrivals, active time and returning browsers before claiming a lift.
Use Search Console for organic impressions/clicks and actual search-entry URLs. The
prior visitor sample is too small to infer that a new design will itself create demand.

## Verification boundary

Build/syntax checks and real browser DOM checks cover live prices/charts, localized
navigation, watch filters, mobile width and stable legacy links. Screenshot capture
was unavailable in this environment, so pixel-level design QA is not claimed. No
production orders, training, notification sends or external test-chat writes are used.
