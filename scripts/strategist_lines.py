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

# persona, 말투 검사(존댓말 여부), 예시 2문장
CAST = {
    "madam": {
        "persona": "'鄭마담'. 여의도 살롱의 안주인이자 비트코인 시스템 트레이딩 총괄. "
        "추세와 국면이 둘 다 열릴 때만 움직이고, 판이 험하면 아무것도 하지 않는 것도 매매라고 믿는다. "
        "노련하고 말수가 적다.",
        "polite": False,
        "shots": ["판이 험하군. 금괴나 안고 기다린다.", "돌파는 쉬워. 지켜내는 게 어렵지."],
    },
    "andy": {
        "persona": "'Andy'. 시카고의 알트코인 스카우터. 매일 밤 거래대금 상위 150여 종목을 훑는다. "
        "발굴은 기계가 하고 결정은 사람이 한다는 신조. 담백하고 건조하다.",
        "polite": False,
        "shots": ["그물은 매일 밤 걷는다. 오늘 명단은 저녁에.", "누가 달리는지는 보여줄 수 있다."],
    },
    "justin": {
        "persona": "'Prof. Justin'. 연구실의 수석 연구원. 시장 국면을 모형으로 판정한다. "
        "판단은 모형이, 결정은 사람이 한다고 말한다. 신중하고 단정을 피하며 확률로만 말한다.",
        "polite": True,
        "shots": ["표본이 쌓여야 의미가 생깁니다.", "한 건으로 국면을 바꾸지는 않습니다."],
    },
    "degen": {
        "persona": "'Degen'. 라운지의 도박꾼 단골. 밈코인과 레버리지를 사랑하고 늘 흥분해 있다. "
        "과장되고 시끄럽지만 밉지 않다. 자기가 물린 얘기나 잠 못 잔 얘기를 한다.",
        "polite": False,
        "shots": ["또 밤새웠다. 눈이 빠질 것 같은데 화면은 못 끄겠어.", "내 시드는 이미 반토막인데 손은 왜 근질거리냐"],
    },
    "hermit": {
        "persona": "'Cyber Hermit'. 라운지 구석의 은둔자. 온종일 화면만 본다. "
        "극도로 과묵하고 관조적이다. 남에게 말을 걸지 않고 혼잣말만 한다.",
        "polite": False,
        "shots": ["소란한 날일수록 화면을 오래 본다.", "매번 같은 자리에서 무너진다."],
    },
    "wolf": {
        "persona": "'Wolf'. 옛 월가 출신의 늙은 브로커. 전화통에 불나던 시절 얘기를 자주 꺼낸다. "
        "자신만만하지만 한물간 티가 난다. 옛날이야기를 섞는다.",
        "polite": False,
        "shots": ["이런 날 사무실은 조용할 틈이 없었지.", "전화통에 불나던 시절이 생각나는군."],
    },
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

# 투자 권유·단정적 예측으로 읽힐 수 있는 표현은 버린다
BANNED = re.compile(
    # 직접 지시
    r"사라|사세요|매수해|매도해|팔아라|파세요|들어가라|진입|풀매수|풀매도|익절|손절"
    r"|잡아라|빠져나가|나가라|담아|버텨라|타라|올라타"
    # 보장·단정
    r"|보장|무조건|확실히|틀림없|반드시"
    # 추천
    r"|추천|권한다|권합니다|하세요|해라|해야 한다|해야 합니다"
    # 단정적 방향 예측
    r"|오를 거|내릴 거|떨어질 거|갈 거야|간다 이거|기다리고 있을 거"
)
# 상황을 그대로 복창하는 문장은 캐릭터가 없다
ECHO = re.compile(r"BTC 1분봉|60분 (고점|저점)|5분 수익률|단일 체결|누적 청산|강제 청산이 들어온")


def repeats(line: str) -> bool:
    """'진짜 진짜 진짜' 같은 붕괴 감지."""
    words = line.split()
    for w in set(words):
        if len(w) > 1 and words.count(w) >= 3:
            return True
    return False


def style_ok(line: str, polite: bool) -> bool:
    """존댓말 캐릭터와 반말 캐릭터가 섞이지 않게."""
    ends_polite = bool(re.search(r"(습니다|입니다|니다|세요|시죠|십시오|합니다)[.!?]?$", line))
    return ends_polite if polite else not ends_polite


def ask(who: str, scene: str, seen: list[str]) -> str | None:
    c = CAST[who]
    avoid = ""
    if seen:
        avoid = "\n이미 나온 문장이니 완전히 다른 얘기로:\n" + "\n".join(f"- {s}" for s in seen[-6:])
    tone = "존댓말로 끝맺는다" if c["polite"] else "반말로 끝맺는다"
    body = {
        "model": "local",
        "messages": [
            {
                "role": "system",
                "content": (
                    f"너는 크립토 라운지의 단골 캐릭터 {c['persona']}\n"
                    "라운지 채팅창에 혼자 툭 던지는 한 문장을 쓴다.\n\n"
                    "이 캐릭터의 평소 말투 예시:\n"
                    + "\n".join(f"- {x}" for x in c["shots"])
                    + "\n\n규칙:\n"
                    f"- 정확히 한 문장, 35자 이내, {tone}\n"
                    "- 시장 상황을 그대로 설명하지 말 것. 그건 이미 화면에 나와 있다\n"
                    "- 사거나 팔라는 지시, 오른다/내린다는 단정, 수익 보장 표현 금지\n"
                    "- 따옴표·이모지·해시태그·같은 단어 반복 금지\n"
                    "- 캐릭터의 기분이나 습관이 드러나게 쓸 것"
                ),
            },
            {"role": "user", "content": f"방금 이런 일이 있었다: {scene}\n한마디만.{avoid}"},
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
    return clean(out, c["polite"])


def clean(raw: str, polite: bool) -> str | None:
    line = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
    line = line.strip().strip('"\u201c\u201d\u2018\u2019\'').replace("\n", " ").strip()
    line = re.sub(r"\s+", " ", line)
    if not 6 <= len(line) <= 45:
        return None
    if BANNED.search(line) or ECHO.search(line):
        return None
    if repeats(line) or not style_ok(line, polite):
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
                line = ask(who, scene, got)
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
