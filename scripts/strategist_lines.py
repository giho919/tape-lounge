#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tape Lounge 라운지 캐릭터 반응 문장 생성기.

mirage의 로컬 llama-server(Qwen3-8B)로 캐릭터별·이벤트별 채팅 문장을 미리 만들어
reports/strategist_lines.json 으로 떨군다. 실시간 생성은 지연이 20초를 넘겨
쓸 수 없으므로, 클라이언트는 이 정적 풀에서 즉시 골라 쓴다.

--publish 는 변경이 있을 때만 main에 push한다 (onchain_report.py와 같은 방식).

문장은 전부 이름·아바타를 달고 나가는 하우스 캐릭터의 대사다. 방문자를 사칭하지
않으며, 매수·매도 지시나 수익 보장 표현은 생성 단계에서 걸러낸다.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

UTC = timezone.utc
REPO = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO / "reports" / "strategist_lines.json"
LLM = "http://127.0.0.1:8091/v1/chat/completions"
LINES_PER_SLOT = 4
MAX_ATTEMPTS = 2

CAST = {
    "madam": (
        "'鄭마담'. 여의도 살롱의 안주인이자 비트코인 시스템 트레이딩 총괄. "
        "추세와 국면이 둘 다 열릴 때만 움직이고, 판이 험하면 아무것도 하지 않는 것도 매매라고 믿는다. "
        "반말. 노련하고 단정적이며 말수가 적다."
    ),
    "andy": (
        "'Andy'. 시카고의 알트코인 스카우터. 매일 밤 거래대금 상위 150여 종목을 훑는다. "
        "발굴은 기계가 하고 결정은 사람이 한다는 신조. 반말. 담백하고 건조하다."
    ),
    "justin": (
        "'Prof. Justin'. 연구실의 수석 연구원. 시장 국면을 모형으로 판정한다. "
        "판단은 모형이, 결정은 사람이 한다고 말한다. 존댓말. 신중하고 단정을 피한다."
    ),
    "degen": (
        "'Degen'. 라운지의 도박꾼 단골. 밈코인과 레버리지를 사랑하고 늘 흥분해 있다. "
        "반말. 과장되고 시끄럽지만 밉지 않다. 자기가 물린 얘기를 자주 한다."
    ),
    "hermit": (
        "'Cyber Hermit'. 라운지 구석의 은둔자. 온종일 화면만 본다. "
        "반말. 극도로 과묵하고 관조적이며, 짧고 서늘한 한 문장만 남긴다."
    ),
    "wolf": (
        "'Wolf'. 옛 월가 출신의 늙은 브로커. 전화통에 불나던 시절 얘기를 자주 꺼낸다. "
        "반말. 공격적이고 자신만만하지만 한물간 티가 난다."
    ),
}

# 이벤트 키 → 그 장면에 반응할 캐릭터들 (클라이언트 STRAT_REACT와 같은 구성)
EVENTS = {
    "candle": ("BTC 1분봉에 평소보다 훨씬 큰 장대봉이 떴다", ["madam", "degen"]),
    "breakout": ("BTC가 최근 60분 고점을 위로 돌파했다", ["madam", "wolf"]),
    "breakdown": ("BTC가 최근 60분 저점을 아래로 깨고 내려갔다", ["madam", "hermit"]),
    "race": ("알트코인들이 5분 수익률로 경주 중이고 선두가 바뀌었다", ["andy", "degen"]),
    "whale": ("BTC에서 50만 달러가 넘는 단일 체결(고래)이 나왔다", ["andy", "wolf"]),
    "pressure": ("체결 흐름이 한쪽 방향으로 뚜렷하게 쏠리고 있다", ["wolf", "andy"]),
    "tower-crash": ("한쪽 방향 선물 청산이 몰리면서 청산 타워가 무너졌다", ["justin", "hermit"]),
    "liq-jackpot": ("전 시장 15분 누적 청산이 500만 달러를 넘겨 잭팟이 터졌다", ["degen", "justin"]),
    "liquidation": ("선물 강제 청산 한 건이 들어왔다", ["justin", "hermit"]),
}

# 투자 권유·수익 보장으로 읽힐 수 있는 표현은 버린다
BANNED = re.compile(
    r"(사라|사세요|매수해|매도해|팔아라|파세요|들어가라|진입해|풀매수|풀매도"
    r"|보장|확실히 오른|무조건|추천합니다|추천한다|익절하세요|손절하세요)"
)


def ask(persona: str, scene: str, seen: list[str]) -> str | None:
    avoid = ""
    if seen:
        avoid = "\n이미 나온 문장이라 피할 것:\n" + "\n".join(f"- {s}" for s in seen[-6:])
    body = {
        "model": "local",
        "messages": [
            {
                "role": "system",
                "content": (
                    f"너는 크립토 라운지의 단골 캐릭터 {persona}\n"
                    "라운지 채팅창에 던지는 혼잣말 한 문장을 쓴다.\n"
                    "규칙: 정확히 한 문장. 40자 이내. 따옴표·이모지·해시태그 금지. "
                    "매수/매도 지시나 수익 보장 표현 금지. 캐릭터 말투를 유지할 것."
                ),
            },
            {"role": "user", "content": f"지금 시장 상황: {scene}\n한마디만.{avoid}"},
        ],
        "temperature": 1.0,
        "top_p": 0.95,
        "max_tokens": 60,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    req = Request(LLM, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=120) as r:
            out = json.load(r)["choices"][0]["message"]["content"]
    except (URLError, OSError, KeyError, json.JSONDecodeError) as exc:
        print(f"    LLM 호출 실패: {exc}", file=sys.stderr)
        return None
    return clean(out)


def clean(raw: str) -> str | None:
    line = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
    line = line.strip().strip('"“”‘’\'').replace("\n", " ").strip()
    line = re.sub(r"\s+", " ", line)
    if not 4 <= len(line) <= 60:
        return None
    if BANNED.search(line):
        return None
    if re.search(r"[#\U0001F300-\U0001FAFF]", line):
        return None
    return line


def build() -> dict:
    lines: dict[str, list[dict]] = {}
    for key, (scene, cast) in EVENTS.items():
        entry = []
        for who in cast:
            got: list[str] = []
            for _ in range(LINES_PER_SLOT * MAX_ATTEMPTS):
                if len(got) >= LINES_PER_SLOT:
                    break
                line = ask(CAST[who], scene, got)
                if line and line not in got:
                    got.append(line)
            print(f"  {key:14s} {who:7s} {len(got)}문장")
            if got:
                entry.append({"who": who, "lines": got})
        if entry:
            lines[key] = entry
    return {
        "generated": datetime.now(UTC).isoformat(timespec="seconds"),
        "model": "qwen3-8b-q4_k_m",
        "lines": lines,
    }


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "-C", str(REPO), *args], timeout=120, capture_output=True, text=True)


def prepare_publish() -> None:
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("작업 트리가 깨끗하지 않아 publish를 중단합니다")
    if git("fetch", "-q", "origin", "main").returncode:
        raise RuntimeError("git fetch 실패")
    if git("reset", "--hard", "origin/main").returncode:
        raise RuntimeError("git reset 실패")


def publish(output: Path, now: datetime) -> None:
    git("add", str(output.relative_to(REPO)))
    if git("commit", "-q", "-m", f"data: 라운지 대사 {now:%Y-%m-%d %H:%M}").returncode:
        print("대사 변경 없음 (스킵)")
        return
    if git("push", "-q").returncode:
        raise RuntimeError("git push 실패")
    print("라운지 대사 push 완료")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    ap.add_argument("--publish", action="store_true")
    args = ap.parse_args()
    if args.publish:
        prepare_publish()
    now = datetime.now(UTC)
    report = build()
    total = sum(len(c["lines"]) for cast in report["lines"].values() for c in cast)
    if total < 20:
        raise RuntimeError(f"생성된 문장이 {total}개뿐이라 발행하지 않습니다")
    out = args.output.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"총 {total}문장 → {out}")
    if args.publish:
        publish(out, now)


if __name__ == "__main__":
    main()
