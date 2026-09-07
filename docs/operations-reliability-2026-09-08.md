# 2026-09-08 operations reliability fixes

- Both Codex heartbeats use `select * from private.lounge_reply_candidates();`.
  SQL applies 90-minute lookback, 2-minute wait, 10-minute per-user bundles,
  covered-message exclusion, 30-minute user cooldown and 10-minute global cooldown.
  Evaluate every returned bundle before choosing one; greetings must not block later questions.
  Market-event eligibility is 45 minutes, matching the publisher RPC.
- The hourly status check reads all 65 minutes of health history, not only the newest row.
  Report recovered incidents distinctly from current failures and avoid repeated alerts.
- On-chain publication uses a locked disposable clone of origin/main. It never resets/stashes
  the operational working directory. Commit errors fail visibly and concurrent upstream pushes
  are retried with fetch/rebase in the disposable clone only.
- Chat keeps the draft until confirmed success, preserves a new in-flight draft, blocks concurrent
  sends, and displays a retry warning. An ambiguous network failure is not automatically retried.
- Collector v1.1 reports Kubernetes/systemd lookup failures, failed units, and unknown account
  alignment separately from actual mismatches. Disk usage uses used/(used+available), matching df.
- Bithumb notification delivery uses a durable mode-600 pending queue in the existing alert-state
  file. Failed deliveries retry in later five-minute runs (at most three per run, stop on outage).
  The notification-only --retry-alerts mode never reads balances or submits orders.
  This is at-least-once delivery: a Telegram acceptance followed by lost acknowledgement can
  still cause a duplicate; there is no Telegram idempotency key.
- No strategy thresholds, signal rules, position sizes, account credentials or main-bot restart changed.

Verification: 41 Tape Lounge Python tests, 5 Node chat-send scenarios, 17 existing Bithumb
tests and 4 new notification tests passed. SQL historical read-only check: Kiki pending before
answer = 1; at the incorrectly skipped 00:10 run after answer = 0. New queue function is not
executable by anon/authenticated, only the existing service role/admin path.
