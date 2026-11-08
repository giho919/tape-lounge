#!/usr/bin/env bash
# Website-only static rebuild. Never imports Mirage, orders, training or Telegram code.
set -euo pipefail
exec 9>/tmp/tape-lounge-discovery-publish.lock
flock -n 9 || exit 0
site_repo=/home/shyoo/projects/tape-lounge
publish_dir=$(mktemp -d /tmp/tape-lounge-discovery-publish.XXXXXXXX)
cleanup() {
  case "$publish_dir" in /tmp/tape-lounge-discovery-publish.*) rm -rf -- "$publish_dir";; esac
}
trap cleanup EXIT
stage_public_files() {
  git add -- index.html ko en zh ja terminal/index.html domestic/index.html desk/index.html analysis/index.html onchain/index.html calendar/index.html blind/index.html strategists/index.html decision/index.html en/decision/index.html zh/decision/index.html ja/decision/index.html decision-og-ko-20261101.png decision-og-en-20261101.png decision-og-zh-20261101.png decision-og-ja-20261101.png home-og-ko-20261102.png home-og-en-20261102.png home-og-zh-20261102.png home-og-ja-20261102.png reports/andy_scan.html reports/madam_daily.html reports/justin_lab.html sitemap.xml robots.txt data/discovery.json data/stage-config.json data/scenes.json data/scenes discovery-analytics.js classic-home.html home-language.js lounge-rotation.js live-home-locale.js avatars/madam.jpg avatars/andy.jpg avatars/prof.jpg avatars/madam.webp avatars/andy.webp avatars/prof.webp
  # Keep the full history bundle as a source for daily rounds, but publish only
  # the per-symbol files used by the opt-in solo-stock game.
  git add -- reports/stocks-v1/
  # Keep the active day's game payload available, but never publish future answers early.
  git add -u -- reports/blind_daily_stock_v2/
  local today_payload="reports/blind_daily_stock_v2/$(TZ=Asia/Seoul date +%F).json"
  if [[ -f "$today_payload" ]]; then git add -f -- "$today_payload"; fi
  # Keep historical rounds for replay, but publish no future answer payloads.
  python3 scripts/prune_future_blind_rounds.py "$today_payload"
}
git clone --shared --no-checkout -q "$site_repo" "$publish_dir"
git -C "$publish_dir" remote set-url origin github-salon:giho919/tape-lounge.git
git -C "$publish_dir" fetch -q origin main
git -C "$publish_dir" checkout -q -B discovery-build origin/main
git -C "$publish_dir" config user.name 'Salon Bot'
git -C "$publish_dir" config user.email salon-bot@mirage
cd "$publish_dir"
python3 scripts/test_prune_future_blind_rounds.py
python3 scripts/generate_home_og.py
python3 scripts/collect_scenes.py --collect || echo 'Public scene refresh unavailable; retaining the last archive.' >&2
python3 scripts/build_discovery.py
stage_public_files
if git diff --cached --quiet; then exit 0; fi
git diff --cached --check
git commit -q -m 'data: refresh localized public observation pages'
# Other report publishers can advance main between our fetch and push. Retry
# only that race, rebuilding the public allowlist on the newest remote tree.
for attempt in 1 2 3; do
  if push_output=$(git push -q origin HEAD:main 2>&1); then
    exit 0
  fi
  case "$push_output" in
    *non-fast-forward*|*"fetch first"*|*rejected*) ;;
    *) printf '%s\n' "$push_output" >&2; exit 1 ;;
  esac
  if (( attempt == 3 )); then
    printf '%s\n' "$push_output" >&2
    echo 'Publish stopped after 3 concurrent main updates; the next hourly run will retry.' >&2
    exit 1
  fi
  echo "Remote main changed during publish; refreshing the isolated build (retry $((attempt + 1))/3)." >&2
  sleep $((attempt * 2))
  git fetch -q origin main
  if ! git rebase origin/main; then
    git rebase --abort || true
    echo 'Publish rebase conflicted with newer main; the next hourly run will retry.' >&2
    exit 1
  fi
  python3 scripts/generate_home_og.py
  python3 scripts/collect_scenes.py --collect || echo 'Public scene refresh unavailable; retaining the last archive.' >&2
  python3 scripts/build_discovery.py
  stage_public_files
  git diff --cached --check
  if ! git diff --cached --quiet; then git commit --amend --no-edit -q; fi
  if git diff --quiet origin/main HEAD; then exit 0; fi
done
