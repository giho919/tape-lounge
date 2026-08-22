#!/usr/bin/env python3
"""Build a validated, reusable Tape Lounge dialogue library with the local LLM.

The generator only writes a local JSONL candidate file. It never publishes to
Supabase or the public lounge. Generated lines may use whitelisted placeholders
that are filled with verified live values when a scene is selected later.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import random
import re
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


LLM_URL = os.getenv("TAPE_LLM_URL", "http://127.0.0.1:8091/v1/chat/completions")
LLM_MODEL = os.getenv(
    "TAPE_LLM_MODEL", "/home/shyoo/models/qwen3-8b/Qwen3-8B-Q4_K_M.gguf"
)

AGENTS = {
    "madam": ("鄭마담", "공식 전략가로서 시장 국면을 짧고 묵직하게 정리한다"),
    "andy": ("Andy", "공식 전략가로서 종목 확산과 시장 폭을 빠르게 살핀다"),
    "justin": ("Prof. Justin", "공식 전략가로서 단일 관측보다 표본과 조건을 중시한다"),
    "watcher": ("관망이", "짧게 궁금한 점을 묻고 확인된 사실을 우선한다"),
    "chart_doryeong": ("차트도령", "가격 구조와 범위 위치를 차분하게 해석한다"),
    "funding_bear": ("펀딩곰", "펀딩과 미결제약정을 보되 한 수치로 단정하지 않는다"),
    "spot_sister": ("현물누나", "현물 관점에서 확인할 위험 요인을 정리한다"),
    "degen": ("디젠", "청산과 변동성에 빠르게 반응하지만 무모한 거래를 부추기지 않는다"),
    "hermit": ("허밋", "온체인과 네트워크 신호를 짧고 조용하게 짚는다"),
    "wolf": ("울프", "체결과 호가 흐름을 직설적으로 읽되 방향을 확정하지 않는다"),
}


@dataclass(frozen=True)
class Scenario:
    key: str
    situation: str
    agents: tuple[str, ...]
    placeholders: tuple[str, ...] = ()


SCENARIOS = (
    Scenario("quiet_range", "변동성과 거래량이 모두 낮은 조용한 횡보", ("watcher", "chart_doryeong", "spot_sister", "madam")),
    Scenario("near_day_high", "현재가가 일중 고가에 가까우나 아직 갱신하지 않은 상태", ("watcher", "chart_doryeong", "wolf", "spot_sister", "madam"), ("high_gap_pct",)),
    Scenario("near_day_low", "현재가가 일중 저가에 가까우나 아직 이탈하지 않은 상태", ("watcher", "chart_doryeong", "wolf", "spot_sister", "madam"), ("low_gap_pct",)),
    Scenario("volume_burst", "평소보다 거래량이 갑자기 커진 상태", ("watcher", "wolf", "degen", "spot_sister", "andy"), ("volume_ratio",)),
    Scenario("long_liquidation", "롱 포지션 청산이 짧은 시간에 크게 발생한 상태", ("watcher", "degen", "funding_bear", "wolf", "justin"), ("liquidation_usd",)),
    Scenario("short_liquidation", "숏 포지션 청산이 짧은 시간에 크게 발생한 상태", ("watcher", "degen", "funding_bear", "wolf", "justin"), ("liquidation_usd",)),
    Scenario("funding_positive", "펀딩비가 양수이며 과열 여부를 추가 확인해야 하는 상태", ("watcher", "funding_bear", "degen", "spot_sister", "justin"), ("funding_pct",)),
    Scenario("funding_negative", "펀딩비가 음수이며 한쪽 쏠림 여부를 추가 확인해야 하는 상태", ("watcher", "funding_bear", "degen", "spot_sister", "justin"), ("funding_pct",)),
    Scenario("oi_price_up", "가격과 미결제약정이 함께 증가한 상태", ("watcher", "funding_bear", "wolf", "spot_sister", "justin"), ("oi_change_pct", "price_change_pct")),
    Scenario("oi_price_down", "가격은 하락하고 미결제약정은 증가한 상태", ("watcher", "funding_bear", "wolf", "degen", "justin"), ("oi_change_pct", "price_change_pct")),
    Scenario("bid_heavy", "근접 호가에서 매수 잔량이 상대적으로 두꺼운 상태", ("watcher", "wolf", "chart_doryeong", "spot_sister"), ("book_imbalance",)),
    Scenario("ask_heavy", "근접 호가에서 매도 잔량이 상대적으로 두꺼운 상태", ("watcher", "wolf", "chart_doryeong", "spot_sister"), ("book_imbalance",)),
    Scenario("spread_wide", "최우선 매수·매도 호가 간격이 평소보다 넓어진 상태", ("watcher", "wolf", "degen", "spot_sister"), ("spread_usdt",)),
    Scenario("fear_extreme", "공포탐욕 지수가 극단적 공포 구간인 상태", ("watcher", "spot_sister", "chart_doryeong", "hermit", "madam"), ("fear_greed",)),
    Scenario("greed_extreme", "공포탐욕 지수가 극단적 탐욕 구간인 상태", ("watcher", "spot_sister", "funding_bear", "degen", "madam"), ("fear_greed",)),
    Scenario("mempool_busy", "비트코인 멤풀이 붐비고 예상 수수료가 높아진 상태", ("watcher", "hermit", "spot_sister"), ("fee_rate",)),
    Scenario("block_settled", "새 비트코인 블록이 확정되어 대기 거래가 처리된 직후", ("watcher", "hermit", "spot_sister"), ("block_height",)),
    Scenario("calm_after_shock", "큰 변동과 청산 이후 가격 움직임이 잠시 잦아든 상태", ("watcher", "degen", "wolf", "spot_sister", "madam")),
    Scenario("btc_dominance_up", "비트코인 도미넌스가 이전 관측보다 상승한 상태", ("watcher", "spot_sister", "degen", "chart_doryeong", "andy"), ("dominance_change_pct",)),
)

RAW_NUMBER_RE = re.compile(r"\d")
PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")
KOREAN_RE = re.compile(r"[가-힣]")
DISALLOWED = (
    "무조건", "확실", "보장", "풀매수", "풀숏", "사라", "팔아",
    "롱 가자", "숏 가자", "진입해", "손절해", "익절해", "내 포지션",
    "수익 인증", "오르는 중", "내리는 중", "세력이다",
)


def request_json(url: str, payload: dict[str, Any], timeout: int = 120) -> Any:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def build_prompt(scenario: Scenario, count: int) -> list[dict[str, str]]:
    cast = "\n".join(
        f"- {key}={AGENTS[key][0]}: {AGENTS[key][1]}" for key in scenario.agents
    )
    placeholders = ", ".join(f"{{{name}}}" for name in scenario.placeholders) or "없음"
    system = """/no_think
너는 Tape Lounge의 '라운지 크루 · AI' 대화 라이브러리 작가다.
JSON 이외에는 출력하지 않는다. 실제 사람인 척하거나 투자 경험과 포지션을 주장하지 않는다.
대사는 전문 정보 70%, 자연스러운 반응 30%다. 매매 지시와 확정 예측을 하지 않는다.
인물마다 말투는 구분하되 유행어와 과장된 캐릭터 연기를 반복하지 않는다."""
    user = f"""상황: {scenario.situation}
등장 가능 인물:
{cast}

허용 플레이스홀더: {placeholders}

서로 다른 대화 {count}세트를 작성해라.
- 각 세트는 3~5개 메시지이고 최소 3명이 등장한다.
- agent_key는 등장 가능 인물에서만 고른다.
- 각 문장은 자연스러운 한국어 8~72자다.
- 입력에 없는 가격 방향, 원인, 지지선, 저항선, 수치를 만들지 않는다.
- 숫자가 필요하면 허용 플레이스홀더를 그대로 쓴다. 그 외 숫자는 쓰지 않는다.
- 앞 대사에 반응하는 대화이며 독립된 보고서 문장을 나열하지 않는다.
- 같은 문장 구조, 같은 결론, 같은 등장 순서를 반복하지 않는다.
- '매수해', '매도해', '들어가', '무조건', '확실', '보장'은 금지다.

형식:
{{"conversations":[{{"messages":[{{"agent_key":"watcher","body":"..."}}]}}]}}"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def call_llm(scenario: Scenario, count: int) -> list[Any]:
    result = request_json(
        LLM_URL,
        {
            "model": LLM_MODEL,
            "temperature": 0.78,
            "top_p": 0.9,
            "max_tokens": min(1800, 320 * count + 160),
            "response_format": {"type": "json_object"},
            "messages": build_prompt(scenario, count),
        },
    )
    content = result["choices"][0]["message"]["content"].strip()
    return json.loads(content).get("conversations", [])


def normalize(value: str) -> str:
    return re.sub(r"[^A-Za-z가-힣{}_]", "", value).lower()


def validate(
    raw: Any, scenario: Scenario, accepted_texts: list[str]
) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(raw, dict) or not isinstance(raw.get("messages"), list):
        return None, "shape"
    messages = raw["messages"]
    if not 2 <= len(messages) <= 6:
        return None, "message_count"

    speakers: set[str] = set()
    clean_messages: list[dict[str, str]] = []
    for message in messages:
        if not isinstance(message, dict):
            return None, "message_shape"
        key, body = message.get("agent_key"), message.get("body")
        if key not in scenario.agents or not isinstance(body, str):
            return None, "speaker"
        body = body.strip()
        if not 8 <= len(body) <= 72 or not KOREAN_RE.search(body):
            return None, "length_or_language"
        if any(term in body for term in DISALLOWED):
            return None, "unsafe_claim"
        found = set(PLACEHOLDER_RE.findall(body))
        if not found.issubset(set(scenario.placeholders)):
            return None, "placeholder"
        if RAW_NUMBER_RE.search(PLACEHOLDER_RE.sub("", body)):
            return None, "raw_number"
        speakers.add(key)
        clean_messages.append({"agent_key": key, "nick": AGENTS[key][0], "body": body})

    if len(speakers) < 2:
        return None, "speaker_variety"

    combined = normalize(" ".join(message["body"] for message in clean_messages))
    if any(difflib.SequenceMatcher(None, combined, old).ratio() >= 0.8 for old in accepted_texts):
        return None, "duplicate"
    return {"scenario_key": scenario.key, "messages": clean_messages}, None


def quotas(total: int) -> dict[str, int]:
    base, remainder = divmod(total, len(SCENARIOS))
    return {
        scenario.key: base + (1 if index < remainder else 0)
        for index, scenario in enumerate(SCENARIOS)
    }


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    temp.replace(path)


def generate(total: int, batch_size: int, output: Path, seed: int) -> int:
    random.seed(seed)
    wanted = quotas(total)
    rows: list[dict[str, Any]] = []
    accepted_texts: list[str] = []
    errors: dict[str, int] = {}

    for scenario in SCENARIOS:
        target = wanted[scenario.key]
        attempts = 0
        while sum(row["scenario_key"] == scenario.key for row in rows) < target:
            have = sum(row["scenario_key"] == scenario.key for row in rows)
            request_count = min(batch_size, target - have)
            attempts += 1
            if attempts > max(8, target * 3):
                print(f"stopped {scenario.key}: accepted {have}/{target}", flush=True)
                break
            try:
                candidates = call_llm(scenario, request_count)
            except Exception as exc:
                errors[type(exc).__name__] = errors.get(type(exc).__name__, 0) + 1
                time.sleep(min(attempts, 5))
                continue
            for candidate in candidates:
                valid, reason = validate(candidate, scenario, accepted_texts)
                if not valid:
                    errors[reason or "unknown"] = errors.get(reason or "unknown", 0) + 1
                    continue
                valid["id"] = f"pilot-{len(rows) + 1:04d}"
                valid["source"] = "qwen3-8b-q4"
                valid["status"] = "candidate"
                rows.append(valid)
                accepted_texts.append(normalize(" ".join(m["body"] for m in valid["messages"])))
                if sum(row["scenario_key"] == scenario.key for row in rows) >= target:
                    break
            write_jsonl(output, rows)
            print(f"{scenario.key}: {sum(row['scenario_key'] == scenario.key for row in rows)}/{target} | total {len(rows)}/{total}", flush=True)

    summary = output.with_suffix(".summary.json")
    summary.write_text(
        json.dumps({"target": total, "accepted": len(rows), "errors": errors}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return 0 if len(rows) == total else 2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=300)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--output", type=Path, default=Path("data/ai_dialogue_pilot.jsonl"))
    parser.add_argument("--seed", type=int, default=20260822)
    args = parser.parse_args()
    if args.target < 1 or args.batch_size < 1:
        parser.error("target and batch-size must be positive")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    return generate(args.target, args.batch_size, args.output, args.seed)


if __name__ == "__main__":
    raise SystemExit(main())
