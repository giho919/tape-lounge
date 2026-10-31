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

Review the live page, errors, data freshness, small-screen overflow, and the
relevant interaction after each change. Use `?internal=1` in development and
verification browsers. Block writes in browser tests: no production chat,
anonymous signups, paper orders, or analytics test traffic.

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
