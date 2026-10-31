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
git clone --shared --no-checkout -q "$site_repo" "$publish_dir"
git -C "$publish_dir" remote set-url origin github-salon:giho919/tape-lounge.git
git -C "$publish_dir" fetch -q origin main
git -C "$publish_dir" checkout -q -B discovery-build origin/main
git -C "$publish_dir" config user.name 'Salon Bot'
git -C "$publish_dir" config user.email salon-bot@mirage
cd "$publish_dir"
python3 scripts/collect_scenes.py --collect || echo 'Public scene refresh unavailable; retaining the last archive.' >&2
python3 scripts/build_discovery.py
git add -- index.html ko en zh ja terminal/index.html domestic/index.html desk/index.html analysis/index.html onchain/index.html calendar/index.html blind/index.html strategists/index.html sitemap.xml data/discovery.json data/stage-config.json data/scenes.json data/scenes discovery-analytics.js
if git diff --cached --quiet; then exit 0; fi
git diff --cached --check
git commit -q -m 'data: refresh localized public observation pages'
# Report publishers may push while we build. Rebase only this isolated clean checkout.
git fetch -q origin main
git rebase origin/main
python3 scripts/build_discovery.py
git add -- index.html ko en zh ja terminal/index.html domestic/index.html desk/index.html analysis/index.html onchain/index.html calendar/index.html blind/index.html strategists/index.html sitemap.xml data/discovery.json data/stage-config.json data/scenes.json data/scenes discovery-analytics.js
if ! git diff --cached --quiet; then git commit --amend --no-edit -q; fi
git push -q origin HEAD:main
