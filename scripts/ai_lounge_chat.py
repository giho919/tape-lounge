#!/usr/bin/env python3
"""Generate a small, validated Tape Lounge AI-guest conversation.

Dry-run is the default. Publishing requires both --publish and
TAPE_AI_CHAT_ENABLE=1 so a test command cannot write to the public lounge.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


BINANCE = "https://fapi.binance.com"
LLM_URL = os.getenv("TAPE_LLM_URL", "http://127.0.0.1:8091/v1/chat/completions")
LLM_MODEL = os.getenv(
    "TAPE_LLM_MODEL", "/home/shyoo/models/qwen3-8b/Qwen3-8B-Q4_K_M.gguf"
)
SUPABASE_URL = os.getenv("TAPE_SUPABASE_URL", "https://mmvhyzajmfkilldxxazs.supabase.co")

AGENTS = {
    "watcher": "관망이",
    "chart_doryeong": "차트도령",
    "funding_bear": "펀딩곰",
    "spot_sister": "현물누나",
}
SPEAKER_ORDER = ("watcher", "chart_doryeong", "funding_bear", "spot_sister", "watcher")
BANNED = (
    "매수",
    "매도",
    "진입",
    "손절",
    "익절",
    "무조건",
    "확실",
    "보장",
    "수익 인증",
    "내 포지션",
    "지지 확인",
    "저항 확인",
    "안착",
    "유지 중",
    "증가 중",
    "감소 중",
    "오르는 중",
    "내리는 중",
    "인 모양",
)
NUMBER_RE = re.compile(r"[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|K)?")
HANJA_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]")


@dataclass(frozen=True)
class Snapshot:
    price: float
    change_pct: float
    high: float
    low: float
    range_position_pct: float
    high_gap_pct: float
    funding_pct: float
    open_interest_btc: float
    spread: float

    def displays(self) -> dict[str, str]:
        return {
            "price": f"{self.price:,.1f}",
            "change": f"{self.change_pct:+.2f}%",
            "high": f"{self.high:,.0f}",
            "low": f"{self.low:,.0f}",
            "range": f"{self.range_position_pct:.1f}%",
            "high_gap": f"{self.high_gap_pct:.2f}%",
            "funding": f"{self.funding_pct:+.6f}%",
            "funding_short": f"{self.funding_pct:+.2f}%",
            "oi": f"{self.open_interest_btc:,.3f}",
            "spread": f"{self.spread:.1f}",
        }


def request_json(url: str, *, payload: dict[str, Any] | None = None, timeout: int = 15) -> Any:
    headers = {"Accept": "application/json", "User-Agent": "Tape-Lounge-AI-Chat/1.0"}
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode()
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def fetch_snapshot() -> Snapshot:
    premium = request_json(f"{BINANCE}/fapi/v1/premiumIndex?symbol=BTCUSDT")
    ticker = request_json(f"{BINANCE}/fapi/v1/ticker/24hr?symbol=BTCUSDT")
    oi = request_json(f"{BINANCE}/fapi/v1/openInterest?symbol=BTCUSDT")
    depth = request_json(f"{BINANCE}/fapi/v1/depth?symbol=BTCUSDT&limit=5")

    price = float(ticker["lastPrice"])
    high = float(ticker["highPrice"])
    low = float(ticker["lowPrice"])
    span = max(high - low, 1e-12)
    best_bid = float(depth["bids"][0][0])
    best_ask = float(depth["asks"][0][0])
    return Snapshot(
        price=price,
        change_pct=float(ticker["priceChangePercent"]),
        high=high,
        low=low,
        range_position_pct=(price - low) / span * 100,
        high_gap_pct=(high - price) / price * 100,
        funding_pct=float(premium["lastFundingRate"]) * 100,
        open_interest_btc=float(oi["openInterest"]),
        spread=max(0.0, best_ask - best_bid),
    )


def build_prompt(snapshot: Snapshot) -> list[dict[str, str]]:
    d = snapshot.displays()
    system = """/no_think
너는 Tape Lounge의 AI 손님 대화 작가다. 전문 정보 70%, 가벼운 반응 30%로 쓴다.
인물은 watcher=관망이(짧은 질문), chart_doryeong=차트도령(확인된 가격 구조),
funding_bear=펀딩곰(선물 수치를 섣불리 단정하지 않음), spot_sister=현물누나(확인할 포인트 정리)다.

규칙:
- 입력에 적힌 관찰값만 사용하고 새 수치, 지지선, 저항선, 원인, 전망을 만들지 않는다.
- 실제 포지션이나 수익 경험을 주장하지 않는다. 매매 지시와 확정 예측을 하지 않는다.
- '지지 확인', '저항 확인', '안착'이라는 표현은 쓰지 않는다.
- 한국어와 ASCII 숫자만 쓴다. 메시지는 12~72자이며 마지막 반응은 8자 이상이다.
- 지정 순서대로 5개 메시지를 쓰고 앞말에 반응하되 반복하지 않는다.
- 수치 보고서처럼 쉼표로 나열하지 말고, 단골끼리 반말로 관찰과 반응을 주고받는다.
- JSON 이외에는 출력하지 않는다.
형식: {"messages":[{"agent_key":"watcher","body":"..."}]}"""
    user = f"""관찰값:
- BTC 현재 {d['price']} USDT, 24시간 {d['change']}
- 24시간 고가 {d['high']}, 저가 {d['low']}
- 현재 위치는 24시간 범위의 {d['range']}, 고가까지 {d['high_gap']}
- 최근 펀딩비 {d['funding']}
- 현재 미결제약정 {d['oi']} BTC. 이전값이 없으므로 증가나 감소는 말할 수 없음
- 최우선 호가 스프레드 {d['spread']} USDT

대화 순서: watcher, chart_doryeong, funding_bear, spot_sister, watcher
좋은 대화 리듬:
- watcher는 오늘 움직임을 보고 무엇부터 확인할지 가볍게 묻는다.
- chart_doryeong은 현재 범위 위치 숫자, '고가', '갱신 전'을 한 문장에 넣는다.
- funding_bear는 펀딩 수치와 '한 시점만으로 단정하기 어렵다'는 뜻을 함께 말한다.
- spot_sister는 '고가 갱신 여부'와 '다음 펀딩 변화'를 한 문장에 자연스럽게 넣는다.
- watcher는 숫자를 반복하지 않고 '확인' 또는 '보자'를 넣어 짧게 끝낸다."""
    example = f"""문장 품질 예시. 사실과 수치는 이번 관찰값으로 바꿔 쓰되 이 자연스러운 호흡을 따른다:
- 관망이: 오늘 움직임이 큰데 고가까지는 {d['high_gap']} 남았네. 뭐부터 확인할까?
- 차트도령: 지금은 범위 {d['range']} 지점이고 아직 {d['high']} 고가 갱신 전이야.
- 펀딩곰: 펀딩은 {d['funding_short']}. 양수지만 한 시점만으로 과열 단정은 어렵지.
- 현물누나: 그럼 고가 갱신 여부랑 다음 펀딩 변화를 같이 보면 되겠네.
- 관망이: 좋아, 추측보다 확인되는 것부터 보자."""
    user = f"{user}\n\n{example}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def call_llm(snapshot: Snapshot) -> list[dict[str, str]]:
    result = request_json(
        LLM_URL,
        payload={
            "model": LLM_MODEL,
            "temperature": 0.62,
            "top_p": 0.85,
            "max_tokens": 520,
            "response_format": {"type": "json_object"},
            "messages": build_prompt(snapshot),
        },
        timeout=75,
    )
    content = result["choices"][0]["message"]["content"].strip()
    parsed = json.loads(content)
    messages = parsed.get("messages")
    if not isinstance(messages, list):
        raise ValueError("LLM response has no messages array")
    return messages


def allowed_numbers(snapshot: Snapshot) -> set[str]:
    values = set(snapshot.displays().values())
    values.update({"24", "70%", "30%"})
    return values


def normalized_similarity(left: str, right: str) -> float:
    clean = lambda value: re.sub(r"[^0-9A-Za-z가-힣]", "", value).lower()
    return difflib.SequenceMatcher(None, clean(left), clean(right)).ratio()


def validate_batch(raw: list[dict[str, Any]], snapshot: Snapshot) -> tuple[list[dict[str, str]], list[str]]:
    errors: list[str] = []
    valid: list[dict[str, str]] = []
    allowed = allowed_numbers(snapshot)
    if len(raw) != len(SPEAKER_ORDER):
        errors.append(f"message_count:{len(raw)}")
        return [], errors

    for index, (message, expected_key) in enumerate(zip(raw, SPEAKER_ORDER)):
        key = message.get("agent_key") if isinstance(message, dict) else None
        body = message.get("body") if isinstance(message, dict) else None
        reason = None
        if key != expected_key or key not in AGENTS:
            reason = "speaker"
        elif not isinstance(body, str) or not (8 if index == 4 else 12) <= len(body.strip()) <= 72:
            reason = "length"
        elif HANJA_RE.search(body):
            reason = "foreign_script"
        elif any(word in body for word in BANNED):
            reason = "banned_claim"
        elif any(token not in allowed for token in NUMBER_RE.findall(body)):
            reason = "unknown_number"
        elif any(normalized_similarity(body, old["body"]) >= 0.78 for old in valid):
            reason = "duplicate"
        elif index == 0 and not any(word in body for word in ("확인", "볼까", "뭐부터")):
            reason = "watcher_opener"
        elif index == 1 and not (
            "고가" in body
            and "갱신 전" in body
            and snapshot.displays()["range"] in body
            and snapshot.displays()["high"] in body
        ):
            reason = "chart_observation"
        elif index == 2 and not (
            "펀딩" in body and any(word in body for word in ("한 시점", "단정", "못 박"))
        ):
            reason = "funding_guardrail"
        elif index == 3 and not (
            "고가" in body
            and "펀딩" in body
            and any(word in body for word in ("보면", "확인"))
        ):
            reason = "spot_summary"
        elif index == 4 and (NUMBER_RE.search(body) or not any(word in body for word in ("확인", "보자"))):
            reason = "watcher_close"

        if reason:
            errors.append(f"message_{index}:{reason}")
            continue
        valid.append({"agent_key": key, "nick": AGENTS[key], "body": body.strip()})

    if errors:
        return [], errors
    return valid, []


def fallback_batch(snapshot: Snapshot) -> list[dict[str, str]]:
    d = snapshot.displays()
    bodies = (
        f"오늘 움직임 큰데 고가까지 {d['high_gap']} 남았네. 뭐부터 확인할까?",
        f"현재 범위 위치는 {d['range']}고 아직 {d['high']} 고가 갱신 전이야.",
        f"펀딩은 {d['funding']}지만 한 시점만으로 과열을 단정하긴 어려워.",
        f"고가 갱신 여부와 다음 펀딩 변화, 두 가지만 이어서 보면 되겠네.",
        "오케이. 먼저 가격이 실제로 갱신하는지 지켜보자.",
    )
    return [
        {"agent_key": key, "nick": AGENTS[key], "body": body}
        for key, body in zip(SPEAKER_ORDER, bodies)
    ]


def generate(snapshot: Snapshot) -> tuple[list[dict[str, str]], str, list[str]]:
    try:
        raw = call_llm(snapshot)
        valid, errors = validate_batch(raw, snapshot)
        if valid:
            return valid, "llm", []
        return fallback_batch(snapshot), "fallback", errors
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, urllib.error.URLError) as exc:
        return fallback_batch(snapshot), "fallback", [f"llm_error:{type(exc).__name__}"]


def publish(messages: list[dict[str, str]], delay_min: int, delay_max: int) -> None:
    if os.getenv("TAPE_AI_CHAT_ENABLE") != "1":
        raise RuntimeError("publishing is locked; set TAPE_AI_CHAT_ENABLE=1 explicitly")
    service_key = os.getenv("TAPE_SUPABASE_SERVICE_KEY")
    if not service_key:
        raise RuntimeError("TAPE_SUPABASE_SERVICE_KEY is required")
    url = f"{SUPABASE_URL}/rest/v1/salon_chat"
    for index, message in enumerate(messages):
        payload = {
            "nick": message["nick"],
            "body": message["body"],
            "author_type": "virtual",
            "agent_key": message["agent_key"],
        }
        data = json.dumps(payload, ensure_ascii=False).encode()
        request = urllib.request.Request(
            url,
            data=data,
            method="POST",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
                "User-Agent": "Tape-Lounge-AI-Chat/1.0",
            },
        )
        with urllib.request.urlopen(request, timeout=15):
            pass
        if index < len(messages) - 1:
            time.sleep(random.randint(delay_min, delay_max))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true", help="write the validated batch to Supabase")
    parser.add_argument("--delay-min", type=int, default=30)
    parser.add_argument("--delay-max", type=int, default=90)
    args = parser.parse_args()
    if args.delay_min < 20 or args.delay_max < args.delay_min:
        parser.error("delays must satisfy 20 <= min <= max")

    snapshot = fetch_snapshot()
    messages, source, errors = generate(snapshot)
    result = {"source": source, "validation_errors": errors, "messages": messages}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.publish:
        publish(messages, args.delay_min, args.delay_max)
    return 0


if __name__ == "__main__":
    sys.exit(main())
