#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tape Lounge BTC on-chain daily snapshot.

Coin Metrics Community API의 무료 일일 지표를 정적 JSON으로 정규화한다.
기본 출력은 reports/onchain.json이며 --publish는 변경이 있을 때만 main에 push한다.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

UTC = timezone.utc
REPO = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO / "reports" / "onchain.json"
API = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
HEADERS = {"User-Agent": "TapeLounge/1.0 (public on-chain reader)"}

METRICS = {
    "PriceUSD": "price",
    "CapMrktCurUSD": "market_cap_usd",
    "CapMVRVCur": "mvrv",
    "AdrActCnt": "active_addresses",
    "TxCnt": "transactions",
    "HashRate": "hash_rate",
    "IssTotNtv": "issuance_btc",
    "FeeTotNtv": "fees_btc",
    "BlkCnt": "blocks",
    "AdrBalCnt": "addresses_with_balance",
    "FlowInExNtv": "exchange_inflow_btc",
    "FlowOutExNtv": "exchange_outflow_btc",
    "SplyExNtv": "exchange_balance_btc",
    "SplyCur": "supply_btc",
    "ROI1yr": "roi_1y",
}


def fetch_json(url: str) -> dict[str, Any]:
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=35) as response:
        return json.load(response)


def number(value: Any) -> float | int | None:
    if value in (None, ""):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return int(num) if num.is_integer() and abs(num) < 9_007_199_254_740_991 else num


def build_report(now: datetime) -> dict[str, Any]:
    params = {
        "assets": "btc",
        "metrics": ",".join(METRICS),
        "frequency": "1d",
        "start_time": (now - timedelta(days=160)).date().isoformat(),
        "page_size": 1000,
        "sort": "time",
    }
    payload = fetch_json(f"{API}?{urlencode(params)}")
    history: list[dict[str, Any]] = []
    for raw in payload.get("data", []):
        time_text = str(raw.get("time", ""))
        if not time_text:
            continue
        row: dict[str, Any] = {"date": time_text[:10]}
        for source, public in METRICS.items():
            value = number(raw.get(source))
            if value is not None:
                row[public] = value
        if len(row) >= 5:
            history.append(row)
    history.sort(key=lambda item: item["date"])
    if len(history) < 30:
        raise RuntimeError(f"온체인 이력이 부족합니다: {len(history)}일")
    return {
        "schema": 1,
        "asset": "btc",
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "as_of": history[-1]["date"],
        "source": {
            "name": "Coin Metrics Community API",
            "url": "https://community-api.coinmetrics.io/v4",
            "frequency": "1d",
            "license_note": "Community data; attribution required",
        },
        "history": history,
    }


def stable(report: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in report.items() if key != "generated_at"}


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "-C", str(REPO), *args], timeout=120, capture_output=True, text=True)


def prepare_publish() -> None:
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("tape-lounge 작업트리가 깨끗하지 않아 publish를 중단합니다")
    fetched = git("fetch", "-q", "origin", "main")
    if fetched.returncode:
        raise RuntimeError(f"git fetch 실패: {fetched.stderr.strip()[:180]}")
    reset = git("reset", "--hard", "origin/main")
    if reset.returncode:
        raise RuntimeError(f"git reset 실패: {reset.stderr.strip()[:180]}")


def publish(output: Path, now: datetime) -> None:
    rel = str(output.relative_to(REPO))
    git("add", rel)
    committed = git("commit", "-q", "-m", f"data: 온체인 스냅샷 {now:%Y-%m-%d}")
    if committed.returncode:
        print("온체인 변경 없음 (스킵)")
        return
    pushed = git("push", "-q")
    if pushed.returncode:
        raise RuntimeError(f"git push 실패: {pushed.stderr.strip()[:180]}")
    print("온체인 스냅샷 push 완료")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    if args.publish:
        prepare_publish()
    now = datetime.now(UTC)
    report = build_report(now)
    output = args.output.expanduser().resolve()
    previous = None
    if output.exists():
        try:
            previous = json.loads(output.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    if previous is not None and stable(previous) == stable(report):
        print(f"온체인 내용 변경 없음 · 기준일 {report['as_of']}")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(report['history'])}일 저장 · 기준일 {report['as_of']} · {output}")
    if args.publish:
        publish(output, now)


if __name__ == "__main__":
    main()
