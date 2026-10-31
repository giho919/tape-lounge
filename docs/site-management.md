# Site management

## Audience milestone

The operating goal is 100 daily unique visitors, measured on the Asia/Seoul
calendar. Use the private analytics views; do not publish audience records,
visitor identifiers, or credentials in this repository. Counts represent unique
browsers rather than independently verified people. Exclude internal visits and
inspect engagement and traffic quality before claiming the milestone. Do not
add daily unique counts together and call the sum weekly unique visitors.

Keep the original casino/lounge presentation. Small improvements should solve
an observed problem or have a measurable acquisition or retention hypothesis.
The removed guide, short-term pit boss, liquidation tower/jackpot panels, and
duplicate room directory must remain absent.

## Homepage and publishing

`classic-home.html` is the homepage source. Run `python3 scripts/build_discovery.py`
to update `/`, `/ko/`, and `/terminal/` together. The hourly publisher regenerates
these copies, so editing only `index.html` is temporary.

The same generator serves seven direct tool paths: `/domestic/`, `/desk/`,
`/analysis/`, `/onchain/`, `/calendar/`, `/blind/`, and `/strategists/`. These are
full application entries with the selected panel present in the initial HTML,
their own titles/canonical URLs, and real navigation links. Normal clicks use
the History API to preserve the running app; old fragment bookmarks still work.
Keep all seven generated entries in the publisher's staging list. The public
source snapshot and `/terminal/` remain `noindex`; the generated home is indexable.
The sitemap's tool dates follow the source hash instead of changing hourly when
only a report refreshes. This enables discovery; it does not prove indexing or
promise a ranking. Check search-console evidence when available.

The Korean live lounge exposes direct links to the localized editorial entry
pages (`/en/`, `/zh/`, `/ja/`) from its header. Those pages label the full live
tools as Korean so visitors know what opens before leaving the translated view.

## Daily blind-chart return loop

The daily challenge records a first completed result and a consecutive-day
completion count in browser-local storage. The count advances once per KST
challenge day, only after finishing that day's official round; replaying an old
date does not extend it. Crypto and U.S.-stock rounds share the streak key across
the version change. No account, public ranking, analytics write or server-side
record is introduced. Keep the local-only wording visible wherever the streak
is shown.

Route checks:

```
python3 scripts/test_tool_routes.py
node scripts/test_tool_routes.cjs
node scripts/test_nav.cjs
node scripts/test_chart_analysis.cjs
```

The browser route test blocks external writes and checks direct entry without
JavaScript, initial panel visibility, regular navigation without reloading,
back/forward, refresh, internal query preservation, keyboard and old bookmarks.

Review the live page, errors, data freshness, small-screen overflow, and the
relevant interaction after each change. Use `?internal=1` in development and
verification browsers. Block writes in browser tests: no production chat,
anonymous signups, paper orders, or analytics test traffic.
`scripts/browser_read_only.cjs` also stops write fetches and beacons inside the
test page, since a keepalive request at unload can outlive network interception.

## Chart-analysis audience coverage

Apply `supabase/site_analytics_analysis.sql` as the recorded
`include_analysis_in_site_analytics` migration before deploying the matching
homepage source. It expands only the existing seven-argument RPC's tab
allowlist. It does not replace that RPC with the older bootstrap definition.
The patch is idempotent and stops for review if the expected guard has changed.
The function's owner, ACL, empty search path, internal-traffic handling and
write limits are preserved. Raw analytics remain private.

Run `scripts/test_site_analytics_analysis.sql` as an administrator: its
transaction rolls back all synthetic rows. It checks an anonymous caller,
internal exclusion, session reuse, duration cap, all eight valid tab IDs,
invalid-tab rejection and private-table permissions. Compare the function
definition and ACL before/after and confirm that no synthetic rows persisted.
The browser route test intercepts the analysis payload with `p_internal=true`
and blocks its external write. Historical missing visits cannot be recovered.

On 2026-10-31 a live race quote exposed an undefined `spread` in `renderRace`.
The race-only failure occurred once per second while the socket-free smoke test
stayed green. The smoke test now injects deterministic quote data and verifies
the leader, runner-up gap, leader change, tie, and clock formatting as well as
the existing page checks. Run:

```
node scripts/test_lounge_full_smoke.cjs
node scripts/test_lounge_readability.cjs
```

An inactive publisher is not sufficient evidence that it should be enabled.
Check its configuration and reason for being stopped before restoring it.
Website maintenance must not change trading strategy, exchange orders, model
training, or Telegram/social publishing.

Chart sharing uses `chart-share.js` / `.css` and the `TapeChartSource` adapter
in `classic-home.html`. The adapter captures only the three Lightweight Charts
canvases: price/volume, MACD and RSI. It keeps the visible range and series intact.
The PNG identifies the instrument, interval, capture time, indicators and chart
provider; BTCDOM futures and the QQQB token are explicitly named. There is no
upload endpoint. Native file sharing is optional, with download and link fallbacks.

Shared links use only whitelisted `chart` and `tf` values on the public homepage,
plus `#loungeChart`. Internal flags and unrelated query parameters must never be
copied. A shared link opens the latest chart for that selection; it does not
reconstruct the historical viewport shown in the saved PNG. The price-tile jump
stays in the running page and preserves internal exclusion.

Run `node scripts/test_chart_share.cjs` after rebuilding. It tests actual chart
screenshots at desktop/phone widths, PNG downloads, private-state exclusion,
clean deep links, native-share cancellation, clipboard fallback, loading errors,
and closing during encoding. OS sharing and clipboard are mocked; external writes
and WebSockets are blocked. Artifacts go to `TAPE_TEST_ARTIFACTS` or a temporary
directory, never to published pages. Both new assets are included in the discovery
generator's fingerprint. Broader site navigation remains covered by the existing
route and full-lounge smoke tests.

## Daily blind practice

`blind-daily.js` adds a date-keyed local practice mode beside solo and group play.
`/blind/?daily=YYYY-MM-DD` reopens that day's puzzle; `?daily=1` selects the current
KST day. The v1 hash, symbol pool and historical date bounds are frozen. Never
change old date selections when adding a future version. One fixed public Binance
request retrieves 1,000 complete daily candles. Validate the full expected date
range and OHLCV before playing; errors retry the same puzzle, without substituting
a random market. Generation guards stop late responses from replacing a new mode.

The direct blind-game route has a dedicated 1200×630 social preview image. Keep its
Open Graph/Twitter image metadata in `scripts/build_discovery.py`'s `tool_page()`
and include the image in `TOOL_ASSETS` so generated routes and freshness hashes stay
in sync. Its search title and description are defined in `TOOL_PAGES`; keep those
keywords aligned with the visible US-stock/crypto historical-chart simulation. The
lounge homepage keeps the separate general `og.png`.

The localized blind-chart explainer lives in `scripts/discovery_content.py`. Keep
its hindsight and no-real-orders caveats accurate in every language; its publication
date feeds the rendered byline, Article metadata, RSS and sitemap. The current game
controls are Korean, so localized article links label that limitation before entry.

The existing engine reveals only the available candles to price and indicators.
Daily starts at 100, with $10,000 simulated funds, 1x leverage, 25% order size and
3x playback (~3 minutes for 200 days). Its speed can be adjusted from 0.5x to 4x
in 0.5x steps. Users may adjust the controls. P&L is marked
to the last revealed close; an open position is not assumed closed free of cost.
Early settlement shows the actual revealed end date. There are no real orders,
new database tables, uploads, public rankings or automatic social posts.

The first 200-day completion for each date is stored locally (at most 30 records).
Replays do not replace it; early settlement does not create a completion record.
Storage failure must not prevent playing or showing the result. Copying a result
includes its date, completion status, simulated P&L, same-period holding return and
clean public puzzle link. Other query parameters are excluded. It is a client-side
practice game, not a tamper-proof competition; hidden data can be inspected by a
determined user. Do not present its local records as audited performance.

Mobile WebViews can restore a chart after their viewport changes or the app resumes.
The blind chart therefore resizes with its measured width and height, then re-seeds
only the currently revealed candles and indicators after a round starts and when
the page returns, changes orientation or resizes its viewport. Retries are bounded
and preserve the visible range, game progress, orders, balances and selected puzzle.
The mobile recovery button remains available if the embedded renderer still fails.
Do not make opening Safari a normal prerequisite. Desktop mobile-width preview is
not proof of Threads iOS behavior; report that limitation until checked in the
actual app.

Blind-round pause and speed controls stay directly above the chart so mobile players
can reach them without scrolling to the account/order panel. Daily mode starts at 3×
and adjusts in 0.5× steps from 0.5× to 4×. Shared-table mode keeps the host-controlled
1× → 2× → 4× cycle.

The bottom navigation keeps the lounge first and the blind game second because
the game currently earns the longest sessions. Leave the remaining tabs in place;
review this priority against later visitor and engagement data before moving it.

Completed daily rounds also offer a 1200×630 branded result card for local PNG
download or the device's native share sheet. The card labels the result as
simulation, includes the same-period holding comparison and the date-keyed public
challenge link. Image creation is local; there is no upload, public score table,
or server-side verification. Keep the clean result-copy link available as a
separate fallback.

Before a daily round starts, the intro also offers a user-triggered invite to the
same date-keyed challenge. It opens the device share sheet when available, then
copies the clean public URL, with a selectable text fallback if clipboard access
is unavailable. Do not attach campaign or internal tracking parameters to these
personal invites, and do not send or post them automatically.

Run `node scripts/test_blind_daily.cjs` and `node scripts/test_blind_daily_ui.cjs`.
They cover deterministic/KST selection, candle integrity, local persistence and
retention, real chart/indicator visibility, a local simulated trade, full finish,
reload, share text, clipboard fallback, unavailable data, stale network replies,
and normal solo play at desktop/mobile widths. Block writes with
`scripts/browser_read_only.cjs`; mock clipboard and all practice candle responses.

## Owned social campaign attribution

`site-campaign.js` recognizes owned Threads/X/Instagram links with `utm_medium=social`
and a known topic: `andy_scan`, `kimchi_fx`, `session_championship`, `daily_blind`,
or `site_launch`, optionally followed by `_YYYYMMDD`. `twitter` normalizes to `x`.
Unknown, partial or duplicate labels use the unchanged seven-argument analytics
RPC. Valid links use `record_site_campaign_activity`, a separate write-only RPC
that delegates to the existing collector and attaches the first valid campaign
to that visitor/session pair. It preserves the original function and its limits.
Never store the full incoming URL or arbitrary UTM values.

Apply the recorded `add_site_campaign_attribution` migration before deploying the
matching client. `supabase/site_campaign_analytics.sql` is its reviewed SQL snapshot,
not an old-bootstrap replacement or an automatically replayed setup script. It
adds nullable session labels, private aggregate views and an RLS-protected daily
table. The later `allow_instagram_campaign_attribution` migration expands only the
source allowlist; its reviewed SQL snapshot is
`supabase/site_campaign_instagram_source.sql`. The existing maintenance job rolls
campaigns before its raw-session purge; its owner, ACL, schedule and other actions
are preserved. No public read access is added. The public anonymous write-only
SECURITY DEFINER endpoint is intentional.

Private reports: `site_analytics_campaigns_today`, `site_analytics_campaigns_recent`
and `site_analytics_campaigns_daily`. They report unique browsers, sessions, active
seconds and sessions with at least 30 active seconds per source/topic. Deduplicate
tabs per session and count on the actual KST activity day, including overnight
sessions. Raw recent coverage follows the existing retention window; daily rows
survive the purge. Re-run daily rollups only within available raw coverage.

Campaign labels attribute the link, not independently verified platform origin:
a copied Threads-tagged link may be opened elsewhere. A visitor can appear in
several campaigns, so campaign visitor counts must not be summed as global uniques.
Existing visits without tags are not retroactively assigned to a source. Report
tagged arrivals alongside engagement and the site's overall audience quality.

Generate links with `require('./site-campaign.js').tag(publicUrl,source,campaign)`.
It preserves only safe public chart/daily-puzzle selections and strips internal
flags, room codes and unrelated query parameters. Keep ordinary user share links
clean; only explicitly prepared promotional links should carry campaign tags.
There is no automatic social publishing or installation of social integrations.

Checks: `node scripts/test_site_campaign.cjs`,
`node scripts/test_site_campaign_ui.cjs`, and the administrator transaction in
`scripts/test_site_campaign.sql`. Browser writes are intercepted before dispatch.
The SQL checks exercise anonymous-role calls, unchanged legacy calls, first touch,
visitor/session binding, deduplication, internal exclusion, time caps, malformed
labels, rollover, idempotent rollups and the existing rate limit. All synthetic
rows and rollups roll back. Confirm the reserved referrer `campaign-check.invalid`
and campaign names ending `_19000101` left no rows, then compare core definition
and ACL and review security/performance advisories.
