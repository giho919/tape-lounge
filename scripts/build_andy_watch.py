"""Publish a quotation-only observation ledger from already published Andy reports.

No exchange access, account configuration, imports from Mirage, or notifications.
Historical states are taken from Git report snapshots, never recomputed with today's data.
"""
import argparse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess

STAGES = {"지지 확인", "재출발", "눌림 대기", "이미 많이 벌어짐"}


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.row, self.cell, self.parts = [], None, False, []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        if tag == "td" and self.row is not None:
            self.cell, self.parts = True, []

    def handle_data(self, data):
        if self.cell:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "td" and self.cell:
            self.row.append("".join(self.parts).strip())
            self.cell = False
        if tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None


def number(value):
    try:
        n = float(value.replace(",", "").replace("%", "").replace("$", ""))
        return n if abs(n) < 1e15 else None
    except (ValueError, AttributeError):
        return None


def parse_report(text):
    stamp = re.search(r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST", text)
    if not stamp or "andy-retest" not in text:
        raise ValueError("Andy report contract missing: timestamp or observation section")
    at = datetime.fromisoformat(f"{stamp[1]}T{stamp[2]}:00+09:00").astimezone(timezone.utc).isoformat()
    parser = Tables()
    parser.feed(text)
    items = {}
    for row in parser.rows:
        if len(row) >= 6 and row[1] in STAGES and re.fullmatch(r"[A-Z0-9]{1,24}/USDT", row[0]):
            symbol = row[0].split("/")[0]
            items[f"4h:{symbol}"] = dict(symbol=symbol, timeframe="4h", stage=row[1],
                distancePct=number(row[3]), support=number(row[4]), testLow=number(row[5]))
        elif len(row) >= 4 and re.fullmatch(r"[A-Z0-9]{1,24}", row[1]) and re.match(r"^[ABC] · (신규 돌파|추세 진행|바닥 반전)", row[2]):
            symbol = row[1]
            items[f"1d:{symbol}"] = dict(symbol=symbol, timeframe="1d", stage=row[2].split(" · ", 1)[1])
    return dict(at=at, reportHash=sha256(text.encode()).hexdigest(), items=list(items.values()))


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout.decode("utf-8")


def build(repo, history=True):
    target = repo / "data/andy-watch.json"
    snapshots = {}
    if target.exists():
        for s in json.loads(target.read_text(encoding="utf-8")).get("snapshots", []):
            snapshots[s["at"]] = s
    if history:
        commits = git(repo, "log", "--since=90 days ago", "--format=%H", "--", "reports/andy_scan.html").splitlines()
        for commit in reversed(commits[:100]):
            try:
                snap = parse_report(git(repo, "show", f"{commit}:reports/andy_scan.html"))
                snapshots[snap["at"]] = snap
            except (ValueError, subprocess.CalledProcessError):
                continue
    latest = parse_report((repo / "reports/andy_scan.html").read_text(encoding="utf-8"))
    snapshots[latest["at"]] = latest
    ordered = sorted(snapshots.values(), key=lambda s: s["at"])[-90:]
    # A failed/rolled-back publisher must not silently pair an old report with a newer ledger.
    if ordered[-1]["at"] != latest["at"]:
        raise ValueError("Current report is older than the preserved observation ledger")
    ledger = {}
    for snap in ordered:
        present = set()
        for item in snap["items"]:
            key = item["timeframe"] + ":" + item["symbol"]
            present.add(key)
            entry = ledger.setdefault(key, dict(symbol=item["symbol"], timeframe=item["timeframe"],
                firstSeenAt=snap["at"], timeline=[]))
            if not entry["timeline"] or entry["timeline"][-1]["stage"] != item["stage"]:
                entry["timeline"].append(dict(at=snap["at"], stage=item["stage"]))
            entry.update(item, lastSeenAt=snap["at"], active=True)
        for key, entry in ledger.items():
            if key not in present and entry.get("active"):
                entry["active"] = False
                entry["timeline"].append(dict(at=snap["at"], stage="목록 제외"))
    current = [e for e in ledger.values() if e["active"]]
    priority = {s: i for i, s in enumerate(["재출발", "지지 확인", "눌림 대기", "신규 돌파", "추세 진행", "바닥 반전", "이미 많이 벌어짐"])}
    current.sort(key=lambda e: (priority.get(e["stage"], 99), e["symbol"]))
    archive = sorted([e for e in ledger.values() if not e["active"]], key=lambda e: e["lastSeenAt"], reverse=True)
    result = dict(schema=1, reportAt=latest["at"], source="reports/andy_scan.html",
        coverage=dict(fromAt=ordered[0]["at"], toAt=latest["at"], reports=len(ordered)),
        candidates=current, archive=archive, snapshots=ordered,
        method="공개된 일별 리포트의 당시 관찰 상태. 목록 제외는 매도·손절·지지 이탈 판정이 아닙니다. 최초 등장은 보관 범위 안에서의 첫 관측입니다.")
    target.parent.mkdir(exist_ok=True)
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(target)
    return dict(reports=len(ordered), candidates=len(current), archived=len(archive), reportAt=latest["at"])


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args.add_argument("--current-only", action="store_true", help="Append current report to existing ledger without scanning Git history")
    opt = args.parse_args()
    print(json.dumps(build(opt.repo.resolve(), not opt.current_only), ensure_ascii=False))
