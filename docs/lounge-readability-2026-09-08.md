# Lounge readability additions — 2026-09-08

The existing black/gold lounge and six-tab structure are unchanged. No new backend,
database table, AI call, market-data subscription or polling timer was introduced.

## Visitor-facing features
- A closed-by-default **라운지 안내** disclosure explains the highlight replay, liquidation
  versus executed trades versus unfilled orders, AI badges, and paper-money simulation.
- **시장 하이라이트** can be filtered to 1/6/24 hours and all/liquidation/price/whale/macro.
  Filters run on the existing shared event ledger. Twelve cards are shown initially,
  with twelve more per click up to sixty. Counts refer to loaded records, not an
  assurance that every market event in the requested period was recorded.
- Replay cards are keyboard-accessible buttons and bind the actual selected event,
  not a mutable array index. The main table shows REPLAY and the original KST date/time.
  Reduced-motion preference disables the replay pulse and smooth scrolling.
- Persisted chat messages show server-created timestamps in KST; the full date is in
  the time element tooltip. AI identity badges are unchanged.
- New messages do not move a visitor who is reading older chat. A new-message button
  returns to the latest conversation. Message buffers remain bounded.
- History refresh merges realtime INSERTs received while the query was pending, removes
  stale/deleted records from the previous snapshot, and ignores superseded responses.
- Korean IME composition Enter no longer sends an unfinished message.

## Verification
- Existing 41 Python tests and 5 chat-send scenarios passed.
- Chromium UI assertions at 1440/390/360 px cover filters, keyboard replay, paging,
  timestamps, unread count, scroll anchors, realtime/history race, duplicate suppression,
  HTML escaping, guide disclosure, and horizontal overflow.
- Full application smoke test uses the actual page and public reads; outbound writes
  and WebSockets are blocked. Initialization, chat history, guide, filters and tab
  lifecycle passed with no uncaught JavaScript errors.
- Test data exists only in the isolated browser context, never in the public database.

Run browser tests with a locally available Playwright module and browser:
`node scripts/test_lounge_readability.cjs` and `node scripts/test_lounge_full_smoke.cjs`.
Optional CHROME_PATH selects a browser binary; LOUNGE_SCREENSHOTS saves component QA images.
