#!/usr/bin/env python3
"""매시간 대사를 쓰기 전에 볼 컨텍스트를 한 번에 출력한다.

시황 수치, 지금 활성인 장면과 점수, 최근 라운지 발화(중복 회피용), 장면별
사용 가능한 플레이스홀더를 모아 보여준다. 이걸 보고 그 시점 맥락에 맞는
대사를 쓴 뒤 claude_dialogue_batch.py --live --append 로 넣는다.

읽기 전용이다. 아무것도 발행하지 않는다.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("lc", BASE / "lounge_crew.py")
lc = importlib.util.module_from_spec(spec)
sys.modules["lc"] = lc
spec.loader.exec_module(lc)


def main() -> int:
    snap = lc.fetch_snapshot()
    state = lc.load_state(lc.DEFAULT_STATE)
    scenes = lc.detect_scenes(snap, state)
    scenes = sorted(scenes, key=lambda s: -s.score)

    print("── 시황 ──")
    print(f"  BTC {snap.price:,.0f}  24h {snap.change_24h_pct:+.2f}%  "
          f"고점까지 {snap.high_gap_pct:.2f}%  저점까지 {snap.low_gap_pct:.2f}%")
    print(f"  펀딩 {snap.funding_pct:+.4f}%  미결제 {snap.oi_btc:,.0f} BTC  "
          f"1h 가격 {snap.price_change_1h_pct:+.2f}%  1h 미결제 {snap.oi_change_1h_pct:+.2f}%")
    print(f"  거래량비 {snap.volume_ratio:.2f}  호가비 {snap.book_ratio:.3f}  "
          f"스프레드 {snap.spread_usdt:.2f}  심리 {snap.fear_greed}")
    print(f"  도미넌스 {snap.btc_dominance:.2f}%  수수료 {snap.fee_rate}  블록 {snap.block_height:,}")

    print("\n── 활성 장면 (점수 높은 순) ──")
    for s in scenes[:6]:
        facts = ", ".join(f"{k}={v}" for k, v in s.facts.items()) or "(플레이스홀더 없음)"
        print(f"  {s.key:18s} {s.score:6.1f}   {facts}")

    chat = lc.recent_chat()
    bodies = list(chat.get("recent_bodies", []))
    print(f"\n── 최근 24시간 라운지 발화 {len(bodies)}건 (이 문장들과 겹치면 안 됨) ──")
    for b in bodies[:12]:
        print(f"  · {b[:70]}")
    if len(bodies) > 12:
        print(f"  … 외 {len(bodies) - 12}건")

    counts = chat.get("agent_counts", {})
    if counts:
        print("\n── 최근 인물별 등장 횟수 (적은 쪽을 써주면 좋음) ──")
        for k, v in sorted(counts.items(), key=lambda x: x[1]):
            print(f"  {lc.AGENT_NAMES.get(k, k):12s} {v}")

    lib = [json.loads(l) for l in lc.DEFAULT_LIBRARY.read_text(encoding="utf-8").splitlines() if l.strip()]
    live = [r for r in lib if r.get("source") == "claude-live"]
    mine = [r for r in lib if r.get("source") == "claude-authored"]
    print(f"\n── 라이브러리 ── 전체 {len(lib)} · 상설 {len(mine)} · 실시간 {len(live)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
