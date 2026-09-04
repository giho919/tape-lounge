#!/usr/bin/env python3
"""Select and publish a Tape Lounge crew conversation from verified facts.

The 10,000-pack local library is the normal path. Recently used wording is
removed before selection and underused speakers are preferred. The local Qwen
model can be asked only when no fresh reviewed pack remains. Dry-run is the
default; publishing requires both --publish and TAPE_AI_CHAT_ENABLE=1.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BINANCE = "https://fapi.binance.com"
SUPABASE_URL = os.getenv("TAPE_SUPABASE_URL", "https://mmvhyzajmfkilldxxazs.supabase.co")
SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "TAPE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_S5ohCvizmH8zI-H1wvRupA_aHTG4YOH"
)
PUBLISH_URL = os.getenv(
    "TAPE_AI_CHAT_PUBLISH_URL",
    f"{SUPABASE_URL}/functions/v1/lounge-chat-publish",
)
LLM_URL = os.getenv("TAPE_LLM_URL", "http://127.0.0.1:8091/v1/chat/completions")
LLM_MODEL = os.getenv(
    "TAPE_LLM_MODEL", "/home/shyoo/models/qwen3-8b/Qwen3-8B-Q4_K_M.gguf"
)
BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LIBRARY = BASE_DIR / "data" / "ai_dialogue_library.jsonl"
DEFAULT_STATE = Path.home() / ".local" / "state" / "tape-lounge" / "lounge-crew.json"

AGENT_NAMES = {
    "madam": "鄭마담",
    "andy": "Andy",
    "justin": "Prof. Justin",
    "watcher": "관망이",
    "chart_doryeong": "차트도령",
    "funding_bear": "펀딩곰",
    "spot_sister": "현물누나",
    "degen": "디젠",
    "hermit": "허밋",
    "wolf": "울프",
}
OFFICIAL = {"madam", "andy", "justin"}
RECENT_CHAT_HOURS = 24
RECENT_CHAT_LIMIT = 500
OFFICIAL_GAP_SECONDS = 4 * 3600
OFFICIAL_CHANCE = 0.15
# 손으로 쓴 대사 우선 추첨 확률 (claude_dialogue_batch.py 가 채워 넣는다)
AUTHORED_SOURCE = "claude-authored"
# 손으로 쓴 팩이 충분히 쌓여 항상 우선한다. 그 팩이 최근 중복 필터로 고갈되면
# choose_pack 이 자동으로 기존 풀로 되돌아가므로 1.0 이어도 침묵하지 않는다.
AUTHORED_CHANCE = 1.0
PUBLISH_ATTEMPTS = 3
TRANSIENT_HTTP_STATUS = {408, 425, 429, 500, 502, 503, 504}
PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")
NUMBER_RE = re.compile(r"[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%p|%|배|M|K)?")
BANNED = (
    "무조건", "확실", "보장", "풀매수", "풀숏", "사라", "팔아",
    "롱 가자", "숏 가자", "진입해", "손절해", "익절해", "내 포지션",
    "수익 인증", "세력이다", "지지 확인", "저항 확인", "안착",
)
LLM_UNVERIFIED_CLAIMS = (
    "올랐", "오른", "오르고", "내렸", "내린", "내리고",
    "줄었", "줄어", "늘었", "늘어", "쌓", "사라",
    "지지", "저항", "돌파", "이탈", "회복", "반등",
    "강해졌", "약해졌", "끝이 보",
)
LLM_TERM_NORMALIZATIONS = (
    (r"(?:open\s*interest|오픈\s*인터레스트|오픈\s*이자|오\s*아이|오이)", "OI"),
    (r"미체결\s*약정", "미결제약정"),
    (r"미결제\s+약정", "미결제약정"),
    (r"비티씨", "BTC"),
    (r"유에스디티", "USDT"),
    (r"알에스아이", "RSI"),
    (r"이엠에이", "EMA"),
    (r"에스엠에이", "SMA"),
    (r"에이티알", "ATR"),
    (r"(?:브이왑|브이와프)", "VWAP"),
    (r"씨브이디", "CVD"),
    (r"엠브이알브이", "MVRV"),
    (r"(?:book\s*imbalance|북\s*(?:임밸런스|인밸런스))", "호가 불균형"),
    (r"(?:order\s*book|오더\s*북|호가\s*북)", "호가창"),
    (r"(?:funding\s*rate|펀딩\s*레이트|펀비)", "펀딩비"),
    (r"(?:long[-\s]*short\s*ratio|롱\s*숏\s*(?:레이시오|비율))", "롱·숏 비율"),
    (r"(?:liquidation|리퀴데이션)", "청산"),
    (r"(?:mark\s*price|마크\s*프라이스)", "마크가격"),
    (r"(?:index\s*price|인덱스\s*프라이스)", "지수가격"),
    (r"(?:taker\s*buy|테이커\s*바이)", "테이커 매수"),
    (r"(?:taker\s*sell|테이커\s*셀)", "테이커 매도"),
    (r"(?<![A-Za-z])bid(?![A-Za-z])|비드", "매수호가"),
    (r"(?<![A-Za-z])ask(?![A-Za-z])|애스크|아스크", "매도호가"),
    (r"(?<![A-Za-z])volume(?![A-Za-z])|볼륨", "거래량"),
    (r"비트\s*도미(?!넌스)", "BTC 도미넌스"),
)
LLM_KOREAN_CANONICAL_TERMS = (
    "미결제약정", "호가 불균형", "호가창", "펀딩비", "롱·숏 비율",
    "청산", "마크가격", "지수가격", "테이커 매수", "테이커 매도",
    "매수호가", "매도호가", "거래량", "BTC 도미넌스",
)


@dataclass
class MarketSnapshot:
    captured_at: float
    price: float
    high_24h: float
    low_24h: float
    change_24h_pct: float
    high_gap_pct: float
    low_gap_pct: float
    range_24h_pct: float
    funding_pct: float
    oi_btc: float
    spread_usdt: float
    spread_bps: float
    volume_ratio: float | None = None
    price_change_1h_pct: float | None = None
    oi_change_1h_pct: float | None = None
    book_ratio: float | None = None
    fear_greed: int | None = None
    fee_rate: float | None = None
    block_height: int | None = None
    btc_dominance: float | None = None
    shock_range_pct: float | None = None
    recent_body_pct: float | None = None


@dataclass(frozen=True)
class Scene:
    key: str
    score: float
    facts: dict[str, str]


def request_json(
    url: str,
    *,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 15,
) -> Any:
    request_headers = {
        "Accept": "application/json",
        "User-Agent": "Tape-Lounge-Crew/1.0",
        **(headers or {}),
    }
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode()
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def optional(result: dict[str, Any], key: str) -> Any | None:
    value = result.get(key)
    return None if isinstance(value, Exception) else value


def fetch_snapshot() -> MarketSnapshot:
    urls = {
        "premium": f"{BINANCE}/fapi/v1/premiumIndex?symbol=BTCUSDT",
        "ticker": f"{BINANCE}/fapi/v1/ticker/24hr?symbol=BTCUSDT",
        "oi": f"{BINANCE}/fapi/v1/openInterest?symbol=BTCUSDT",
        "depth": f"{BINANCE}/fapi/v1/depth?symbol=BTCUSDT&limit=20",
        "klines": f"{BINANCE}/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=90",
        "oi_hist": f"{BINANCE}/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=13",
        "fng": "https://api.alternative.me/fng/?limit=1&format=json",
        "fees": "https://mempool.space/api/v1/fees/recommended",
        "height": "https://mempool.space/api/blocks/tip/height",
        "global": "https://api.coingecko.com/api/v3/global",
    }
    results: dict[str, Any] = {}

    def fetch(item: tuple[str, str]) -> tuple[str, Any]:
        key, url = item
        try:
            if key == "height":
                request = urllib.request.Request(url, headers={"User-Agent": "Tape-Lounge-Crew/1.0"})
                with urllib.request.urlopen(request, timeout=12) as response:
                    return key, int(response.read().decode().strip())
            return key, request_json(url, timeout=12)
        except Exception as exc:
            return key, exc

    with ThreadPoolExecutor(max_workers=6) as pool:
        for key, value in pool.map(fetch, urls.items()):
            results[key] = value

    required = ("premium", "ticker", "oi", "depth", "klines")
    failed = [key for key in required if isinstance(results.get(key), Exception)]
    if failed:
        raise RuntimeError(f"required market requests failed: {','.join(failed)}")

    premium, ticker, oi, depth, klines = (results[key] for key in required)
    price = float(ticker["lastPrice"])
    high = float(ticker["highPrice"])
    low = float(ticker["lowPrice"])
    bids = [(float(level[0]), float(level[1])) for level in depth["bids"]]
    asks = [(float(level[0]), float(level[1])) for level in depth["asks"]]
    bid_notional = sum(price_level * qty for price_level, qty in bids)
    ask_notional = sum(price_level * qty for price_level, qty in asks)
    spread = max(0.0, asks[0][0] - bids[0][0])

    closed = klines[:-1]
    last_quote = float(closed[-1][7])
    previous_quotes = [float(row[7]) for row in closed[-21:-1]]
    average_quote = sum(previous_quotes) / max(len(previous_quotes), 1)
    hour_start = float(closed[-61][4]) if len(closed) >= 61 else float(closed[0][4])
    hour_end = float(closed[-1][4])
    recent_ranges = [(float(row[2]) - float(row[3])) / max(float(row[4]), 1e-12) * 100 for row in closed[-10:]]
    recent_bodies = [abs(float(row[4]) - float(row[1])) / max(float(row[1]), 1e-12) * 100 for row in closed[-2:]]

    oi_change = None
    oi_hist = optional(results, "oi_hist")
    if isinstance(oi_hist, list) and len(oi_hist) >= 2:
        first_oi = float(oi_hist[0]["sumOpenInterest"])
        last_oi = float(oi_hist[-1]["sumOpenInterest"])
        oi_change = (last_oi / first_oi - 1) * 100 if first_oi else None

    fng = optional(results, "fng")
    fees = optional(results, "fees")
    global_data = optional(results, "global")
    fear_greed = int(fng["data"][0]["value"]) if isinstance(fng, dict) and fng.get("data") else None
    fee_rate = float(fees["fastestFee"]) if isinstance(fees, dict) and fees.get("fastestFee") is not None else None
    dominance = None
    if isinstance(global_data, dict):
        dominance = global_data.get("data", {}).get("market_cap_percentage", {}).get("btc")
        dominance = float(dominance) if dominance is not None else None

    return MarketSnapshot(
        captured_at=time.time(),
        price=price,
        high_24h=high,
        low_24h=low,
        change_24h_pct=float(ticker["priceChangePercent"]),
        high_gap_pct=max(0.0, (high - price) / max(price, 1e-12) * 100),
        low_gap_pct=max(0.0, (price - low) / max(price, 1e-12) * 100),
        range_24h_pct=(high - low) / max(price, 1e-12) * 100,
        funding_pct=float(premium["lastFundingRate"]) * 100,
        oi_btc=float(oi["openInterest"]),
        spread_usdt=spread,
        spread_bps=spread / max(price, 1e-12) * 10000,
        volume_ratio=last_quote / average_quote if average_quote else None,
        price_change_1h_pct=(hour_end / hour_start - 1) * 100 if hour_start else None,
        oi_change_1h_pct=oi_change,
        book_ratio=bid_notional / ask_notional if ask_notional else None,
        fear_greed=fear_greed,
        fee_rate=fee_rate,
        block_height=optional(results, "height"),
        btc_dominance=dominance,
        shock_range_pct=max(recent_ranges) if recent_ranges else None,
        recent_body_pct=sum(recent_bodies) / len(recent_bodies) if recent_bodies else None,
    )


def pct(value: float) -> str:
    return f"{value:+.2f}%"


def multiple(value: float) -> str:
    if value >= 10:
        return "10배 이상"
    return f"{value:.2f}배"


def money(value: float) -> str:
    if value >= 1_000_000:
        return f"${value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"${value / 1_000:.0f}K"
    return f"${value:.0f}"


def previous_snapshot(state: dict[str, Any]) -> dict[str, Any]:
    value = state.get("snapshot")
    return value if isinstance(value, dict) else {}


def detect_scenes(snapshot: MarketSnapshot, state: dict[str, Any]) -> list[Scene]:
    scenes: list[Scene] = []
    previous = previous_snapshot(state)
    if snapshot.high_gap_pct <= 0.7:
        scenes.append(Scene("near_day_high", 72 - snapshot.high_gap_pct * 20, {"high_gap_pct": pct(snapshot.high_gap_pct)}))
    if snapshot.low_gap_pct <= 0.7:
        scenes.append(Scene("near_day_low", 72 - snapshot.low_gap_pct * 20, {"low_gap_pct": pct(snapshot.low_gap_pct)}))
    if snapshot.volume_ratio is not None and snapshot.volume_ratio >= 1.8:
        scenes.append(Scene("volume_burst", min(90, 58 + snapshot.volume_ratio * 6), {"volume_ratio": multiple(snapshot.volume_ratio)}))
    if snapshot.funding_pct >= 0.005:
        scenes.append(Scene("funding_positive", min(67, 42 + snapshot.funding_pct * 900), {"funding_pct": pct(snapshot.funding_pct)}))
    elif snapshot.funding_pct <= -0.005:
        scenes.append(Scene("funding_negative", min(67, 42 + abs(snapshot.funding_pct) * 900), {"funding_pct": pct(snapshot.funding_pct)}))
    if (
        snapshot.oi_change_1h_pct is not None
        and snapshot.price_change_1h_pct is not None
        and snapshot.oi_change_1h_pct >= 0.3
        and abs(snapshot.price_change_1h_pct) >= 0.25
    ):
        key = "oi_price_up" if snapshot.price_change_1h_pct > 0 else "oi_price_down"
        scenes.append(Scene(key, 68, {
            "oi_change_pct": pct(snapshot.oi_change_1h_pct),
            "price_change_pct": pct(snapshot.price_change_1h_pct),
        }))
    if snapshot.book_ratio is not None and snapshot.book_ratio >= 1.6:
        scenes.append(Scene("bid_heavy", min(76, 55 + snapshot.book_ratio * 5), {"book_imbalance": multiple(snapshot.book_ratio)}))
    elif snapshot.book_ratio is not None and snapshot.book_ratio <= 0.625:
        scenes.append(Scene("ask_heavy", min(76, 55 + (1 / max(snapshot.book_ratio, 1e-9)) * 5), {"book_imbalance": multiple(1 / snapshot.book_ratio)}))
    if snapshot.spread_bps >= 0.3:
        scenes.append(Scene("spread_wide", 65, {"spread_usdt": f"{snapshot.spread_usdt:.1f} USDT"}))
    if snapshot.fear_greed is not None and snapshot.fear_greed <= 25:
        scenes.append(Scene("fear_extreme", 66 + (25 - snapshot.fear_greed) / 3, {"fear_greed": str(snapshot.fear_greed)}))
    elif snapshot.fear_greed is not None and snapshot.fear_greed >= 75:
        scenes.append(Scene("greed_extreme", 66 + (snapshot.fear_greed - 75) / 3, {"fear_greed": str(snapshot.fear_greed)}))
    if snapshot.fee_rate is not None and snapshot.fee_rate >= 20:
        scenes.append(Scene("mempool_busy", min(75, 58 + snapshot.fee_rate / 5), {"fee_rate": f"{snapshot.fee_rate:.0f} sat/vB"}))
    previous_height = previous.get("block_height")
    if isinstance(previous_height, int) and snapshot.block_height and snapshot.block_height > previous_height:
        scenes.append(Scene("block_settled", 62, {"block_height": f"{snapshot.block_height:,}"}))
    if (
        snapshot.shock_range_pct is not None
        and snapshot.recent_body_pct is not None
        and snapshot.shock_range_pct >= 0.5
        and snapshot.recent_body_pct <= 0.08
    ):
        scenes.append(Scene("calm_after_shock", 64, {}))
    previous_dominance = previous.get("btc_dominance")
    if isinstance(previous_dominance, (int, float)) and snapshot.btc_dominance is not None:
        change = snapshot.btc_dominance - float(previous_dominance)
        if change >= 0.15:
            scenes.append(Scene("btc_dominance_up", 62 + min(8, change * 10), {"dominance_change_pct": f"{change:+.2f}%p"}))
    if snapshot.range_24h_pct <= 2.0 and (snapshot.volume_ratio or math.inf) <= 0.8:
        scenes.append(Scene("quiet_range", 36, {}))

    liquidation = state.get("pending_liquidation")
    if isinstance(liquidation, dict) and time.time() - float(liquidation.get("at", 0)) <= 900:
        amount = float(liquidation.get("amount", 0))
        side = liquidation.get("side")
        if amount >= 250_000 and side in ("long", "short"):
            scenes.append(Scene(f"{side}_liquidation", min(98, 72 + math.log10(amount / 250_000 + 1) * 14), {"liquidation_usd": money(amount)}))
    return scenes


def load_state(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def load_library(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                value = json.loads(line)
                if value.get("status") == "ready":
                    rows.append(value)
    if not rows:
        raise RuntimeError("dialogue library is empty")
    return rows


def choose_scene(scenes: list[Scene], state: dict[str, Any], forced: str | None) -> Scene | None:
    if forced:
        match = next((scene for scene in scenes if scene.key == forced), None)
        return match or Scene(forced, 100, {})
    if not scenes:
        return None
    scenes = sorted(scenes, key=lambda item: item.score, reverse=True)
    top = scenes[0].score
    eligible = [scene for scene in scenes if scene.score >= top - 10]
    last_scene = state.get("last_scene")
    alternatives = [scene for scene in eligible if scene.key != last_scene]
    if alternatives:
        eligible = alternatives
    return random.choices(eligible, weights=[max(1, scene.score) ** 2 for scene in eligible], k=1)[0]


def render_pack(pack: dict[str, Any], facts: dict[str, str]) -> list[dict[str, str]] | None:
    messages: list[dict[str, str]] = []
    for raw in pack.get("messages", []):
        key, body = raw.get("agent_key"), raw.get("body")
        if key not in AGENT_NAMES or not isinstance(body, str):
            return None
        required = set(PLACEHOLDER_RE.findall(body))
        if not required.issubset(facts):
            return None
        try:
            rendered = body.format_map(facts)
        except (KeyError, ValueError):
            return None
        if "{" in rendered or not 8 <= len(rendered) <= 100 or any(term in rendered for term in BANNED):
            return None
        messages.append({"agent_key": key, "nick": AGENT_NAMES[key], "body": rendered})
    return messages if 2 <= len(messages) <= 6 else None


def normalize_body(body: str) -> str:
    """Collapse numeric variants so cosmetically changed repeats still match."""
    return re.sub(r"\s+", " ", NUMBER_RE.sub("#", body.casefold())).strip()


def normalize_llm_terms(body: str) -> str:
    """Canonicalize common model transliterations before safety validation."""
    for pattern, replacement in LLM_TERM_NORMALIZATIONS:
        body = re.sub(pattern, replacement, body, flags=re.IGNORECASE)
    particle_pairs = {
        "은": ("은", "는"), "는": ("은", "는"),
        "이": ("이", "가"), "가": ("이", "가"),
        "을": ("을", "를"), "를": ("을", "를"),
        "과": ("과", "와"), "와": ("과", "와"),
    }
    for term in LLM_KOREAN_CANONICAL_TERMS:
        last_hangul = next((char for char in reversed(term) if "가" <= char <= "힣"), None)
        if not last_hangul:
            continue
        jong = (ord(last_hangul) - ord("가")) % 28

        def fix_particle(match: re.Match[str]) -> str:
            particle = match.group(1)
            if particle in ("으로", "로"):
                return term + ("로" if jong in (0, 8) else "으로")
            with_batchim, without_batchim = particle_pairs[particle]
            return term + (with_batchim if jong else without_batchim)

        body = re.sub(
            rf"{re.escape(term)}(으로|로|은|는|이|가|을|를|과|와)",
            fix_particle,
            body,
        )
    return re.sub(r"\s+", " ", body).strip()


def empty_chat_context() -> dict[str, Any]:
    return {
        "human": 0.0,
        "virtual": 0.0,
        "recent_bodies": set(),
        "agent_counts": {},
    }


def choose_pack(
    library: list[dict[str, Any]],
    scene: Scene,
    state: dict[str, Any],
    chat: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, str]]] | None:
    chat = chat or empty_chat_context()
    recent = set(state.get("recent_ids", []))
    recent_bodies = set(chat.get("recent_bodies", set()))
    agent_counts = chat.get("agent_counts", {})
    last_lead = state.get("last_lead_agent")
    official_ready = time.time() - float(state.get("last_official_at", 0)) >= OFFICIAL_GAP_SECONDS
    candidates = [row for row in library if row.get("scenario_key") == scene.key and row.get("id") not in recent]
    random.shuffle(candidates)

    rendered_candidates: list[tuple[dict[str, Any], list[dict[str, str]]]] = []
    for pack in candidates:
        rendered = render_pack(pack, scene.facts)
        if not rendered:
            continue
        if any(normalize_body(message["body"]) in recent_bodies for message in rendered):
            continue
        rendered_candidates.append((pack, rendered))

    without_official = [item for item in rendered_candidates if not any(m["agent_key"] in OFFICIAL for m in item[1])]
    with_official = [item for item in rendered_candidates if any(m["agent_key"] in OFFICIAL for m in item[1])]
    if official_ready and with_official and random.random() < OFFICIAL_CHANCE:
        pool = with_official
    else:
        pool = without_official or rendered_candidates

    # 손으로 쓴 대사를 우선한다. 기존 10,000팩은 조합 생성물이라 "응, 그 정도 선에서
    # 보는 게 맞겠네" 같은 상투구가 여러 팩에 반복된다. 손으로 쓴 팩은 수가 훨씬 적어
    # 균등 추첨으로는 거의 뽑히지 않으므로 확률을 따로 준다. 그 팩이 고갈되면(중복
    # 필터에 걸리면) 자동으로 기존 풀로 돌아가므로 침묵하지 않는다.
    authored = [item for item in pool if item[0].get("source") == AUTHORED_SOURCE]
    if authored and random.random() < AUTHORED_CHANCE:
        pool = authored

    if not pool:
        return None

    # Keep expertise tied to the scene, then prefer the least-heard eligible cast.
    non_repeating_leads = [item for item in pool if item[1][0]["agent_key"] != last_lead]
    if non_repeating_leads:
        pool = non_repeating_leads

    def balance_key(item: tuple[dict[str, Any], list[dict[str, str]]]) -> tuple[float, int, float]:
        speakers = {message["agent_key"] for message in item[1]}
        counts = [int(agent_counts.get(agent, 0)) for agent in speakers]
        return (sum(counts) / max(len(counts), 1), max(counts, default=0), random.random())

    return min(pool, key=balance_key)


def recent_chat() -> dict[str, Any]:
    since = datetime.fromtimestamp(
        time.time() - RECENT_CHAT_HOURS * 3600, timezone.utc
    ).isoformat()
    query = urllib.parse.urlencode({
        "select": "created_at,author_type,agent_key,body",
        "created_at": f"gte.{since}",
        "order": "created_at.desc",
        "limit": str(RECENT_CHAT_LIMIT),
    })
    rows = request_json(
        f"{SUPABASE_URL}/rest/v1/salon_chat?{query}",
        headers={"apikey": SUPABASE_PUBLISHABLE_KEY},
    )
    context = empty_chat_context()
    for row in rows if isinstance(rows, list) else []:
        kind = row.get("author_type")
        if kind not in ("human", "virtual"):
            continue
        if not context[kind]:
            try:
                context[kind] = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")).timestamp()
            except (KeyError, ValueError, TypeError):
                pass
        if kind != "virtual":
            continue
        agent, body = row.get("agent_key"), row.get("body")
        if agent in AGENT_NAMES:
            context["agent_counts"][agent] = context["agent_counts"].get(agent, 0) + 1
        if isinstance(body, str) and body.strip():
            context["recent_bodies"].add(normalize_body(body))
    return context


def should_publish(scene: Scene | None, latest: dict[str, Any], force: bool) -> tuple[bool, str]:
    if force:
        return True, "forced"
    now = time.time()
    if latest.get("human", 0) and now - latest["human"] < 4 * 60:
        return False, "human_conversation_active"
    min_gap = 25 * 60 if scene and scene.score >= 65 else 60 * 60
    if latest.get("virtual", 0) and now - latest["virtual"] < min_gap:
        return False, "virtual_cooldown"
    return True, "ready"


def llm_agent_keys(scene: Scene | None) -> tuple[str, ...]:
    key = scene.key if scene else ""
    if key in {"funding_positive", "funding_negative", "oi_price_up", "oi_price_down", "long_liquidation", "short_liquidation"}:
        return ("funding_bear", "spot_sister", "degen", "watcher", "wolf")
    if key in {"volume_burst", "bid_heavy", "ask_heavy", "spread_wide"}:
        return ("wolf", "watcher", "chart_doryeong", "spot_sister", "degen")
    if key in {"mempool_busy", "block_settled"}:
        return ("hermit", "watcher", "spot_sister", "wolf")
    return ("chart_doryeong", "watcher", "spot_sister", "wolf", "degen")


def allowed_llm_numbers(snapshot: MarketSnapshot, scene: Scene | None = None) -> set[str]:
    allowed = {
        f"{snapshot.price:,.1f}", pct(snapshot.change_24h_pct),
        pct(snapshot.high_gap_pct), pct(snapshot.low_gap_pct),
        pct(snapshot.funding_pct), f"{snapshot.spread_usdt:.1f}", "24",
    }
    if scene:
        for value in scene.facts.values():
            allowed.update(NUMBER_RE.findall(value))
    return allowed


def llm_fallback(
    snapshot: MarketSnapshot,
    chat: dict[str, Any] | None = None,
    scene: Scene | None = None,
) -> list[dict[str, str]] | None:
    chat = chat or empty_chat_context()
    allowed_agents = {key: AGENT_NAMES[key] for key in llm_agent_keys(scene)}
    agent_counts = chat.get("agent_counts", {})
    underused = sorted(allowed_agents, key=lambda key: (int(agent_counts.get(key, 0)), key))[:4]
    prompt = f"""/no_think
너는 Tape Lounge 라운지 크루의 짧은 대화를 쓴다. 다음 관찰값만 사용할 수 있다.
BTC {snapshot.price:,.1f} USDT, 24시간 {pct(snapshot.change_24h_pct)}, 고가까지 {pct(snapshot.high_gap_pct)},
저가까지 {pct(snapshot.low_gap_pct)}, 펀딩 {pct(snapshot.funding_pct)}, 스프레드 {snapshot.spread_usdt:.1f} USDT.
인물: {json.dumps(allowed_agents, ensure_ascii=False)}
현재 장면: {scene.key if scene else "general"}, 검증된 장면 값: {json.dumps(scene.facts if scene else {}, ensure_ascii=False)}
최근 적게 나온 인물 후보: {json.dumps(underused, ensure_ascii=False)}
서로 반응하는 자연스러운 반말 2~4개를 JSON으로만 출력한다.
가능하면 최근 적게 나온 인물을 포함한다. 각 문장은 위의 검증된 관찰값을 그대로 말하거나, 새 사실을 보태지 않는 짧은 반응이어야 한다.
위에 적힌 현재 관찰값만 말하고, 이전보다 올랐다·내렸다·줄었다·늘었다 같은 변화나 원인·지지·저항·전망을 추측하지 않는다.
새 숫자·매매 지시·실제 포지션은 만들지 않는다.
항상 질문으로 시작하거나 깔끔하게 결론내지 말고, 짧은 맞장구나 반론을 섞는다.
형식: {{"messages":[{{"agent_key":"wolf","body":"..."}}]}}"""
    result = request_json(
        LLM_URL,
        payload={
            "model": LLM_MODEL,
            "temperature": 0.72,
            "top_p": 0.88,
            "max_tokens": 420,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": prompt}],
        },
        timeout=90,
    )
    raw = json.loads(result["choices"][0]["message"]["content"])
    rows = raw.get("messages")
    if not isinstance(rows, list) or not 2 <= len(rows) <= 4:
        return None
    allowed_numbers = allowed_llm_numbers(snapshot, scene)
    messages: list[dict[str, str]] = []
    speakers: set[str] = set()
    seen_bodies: set[str] = set()
    recent_bodies = set(chat.get("recent_bodies", set()))
    for row in rows:
        key, body = row.get("agent_key"), row.get("body")
        if key not in allowed_agents or not isinstance(body, str):
            continue
        body = normalize_llm_terms(body)
        if not 8 <= len(body) <= 90:
            continue
        if any(term in body for term in BANNED):
            continue
        if any(term in body for term in LLM_UNVERIFIED_CLAIMS):
            continue
        if any(number not in allowed_numbers for number in NUMBER_RE.findall(body)):
            continue
        normalized = normalize_body(body)
        if normalized in recent_bodies or normalized in seen_bodies:
            continue
        seen_bodies.add(normalized)
        speakers.add(key)
        messages.append({"agent_key": key, "nick": AGENT_NAMES[key], "body": body})
    return messages if len(speakers) >= 2 else None


def publishing_key() -> str:
    if os.getenv("TAPE_AI_CHAT_ENABLE") != "1":
        raise RuntimeError("publishing is locked; set TAPE_AI_CHAT_ENABLE=1")
    signing_key = os.getenv("TAPE_AI_CHAT_SIGNING_KEY")
    if not signing_key or not Path(signing_key).is_file():
        raise RuntimeError("TAPE_AI_CHAT_SIGNING_KEY must point to a private key")
    return signing_key


def post_message(
    batch_id: str,
    sequence: int,
    message: dict[str, str],
    signing_key: str,
    attempts: int = PUBLISH_ATTEMPTS,
) -> bool:
    """Post once logically; retries reuse the idempotency identity."""
    for attempt in range(attempts):
        timestamp = int(time.time())
        payload = {
            "timestamp": timestamp,
            "batch_id": batch_id,
            "sequence": sequence,
            "message": message,
        }
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        signed = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", signing_key],
            input=body,
            capture_output=True,
            check=True,
        ).stdout
        request = urllib.request.Request(
            PUBLISH_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Tape-Lounge-Crew/1.0",
                "x-tape-timestamp": str(timestamp),
                "x-tape-signature": base64.b64encode(signed).decode(),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result = json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code not in TRANSIENT_HTTP_STATUS:
                raise RuntimeError(f"chat publisher returned HTTP {exc.code}") from exc
            if attempt == attempts - 1:
                return False
        except (TimeoutError, urllib.error.URLError):
            if attempt == attempts - 1:
                return False
        else:
            if result.get("ok") is not True:
                raise RuntimeError("chat publisher rejected the message")
            return True
        time.sleep(2 ** attempt)
    return False


def pending_publish(
    messages: list[dict[str, str]], scene: Scene | None, pack_id: str | None
) -> dict[str, Any]:
    return {
        "batch_id": str(uuid.uuid4()),
        "next_sequence": 0,
        "messages": messages,
        "scene": scene.key if scene else "llm",
        "pack_id": pack_id,
        "queued_at": time.time(),
    }


def resume_publish(
    state_path: Path,
    state: dict[str, Any],
    delay_min: int,
    delay_max: int,
) -> bool:
    pending = state.get("pending_publish")
    if not isinstance(pending, dict):
        return True
    batch_id = pending.get("batch_id")
    messages = pending.get("messages")
    sequence = pending.get("next_sequence")
    if (
        not isinstance(batch_id, str)
        or not isinstance(messages, list)
        or not isinstance(sequence, int)
        or not 0 <= sequence <= len(messages)
    ):
        raise RuntimeError("pending publish state is invalid")
    signing_key = publishing_key()
    while sequence < len(messages):
        message = messages[sequence]
        if not isinstance(message, dict):
            raise RuntimeError("pending publish message is invalid")
        if not post_message(batch_id, sequence, message, signing_key):
            print(
                json.dumps({
                    "publish": "deferred",
                    "batch_id": batch_id,
                    "next_sequence": sequence,
                }),
                file=sys.stderr,
            )
            return False
        sequence += 1
        pending["next_sequence"] = sequence
        save_state(state_path, state)
        if sequence < len(messages):
            time.sleep(random.randint(delay_min, delay_max))
    return True


def finalize_publish(state_path: Path, state: dict[str, Any]) -> None:
    pending = state.get("pending_publish")
    if not isinstance(pending, dict):
        return
    messages = pending.get("messages")
    if not isinstance(messages, list) or not messages:
        raise RuntimeError("completed publish state is invalid")
    state["last_scene"] = pending.get("scene", "llm")
    state["last_published_at"] = time.time()
    pack_id = pending.get("pack_id")
    recent_ids = ([pack_id] if isinstance(pack_id, str) else []) + list(
        state.get("recent_ids", [])
    )
    state["recent_ids"] = recent_ids[:500]
    if any(message.get("agent_key") in OFFICIAL for message in messages):
        state["last_official_at"] = time.time()
    state["last_lead_agent"] = messages[0]["agent_key"]
    state.pop("pending_liquidation", None)
    state.pop("pending_publish", None)
    save_state(state_path, state)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--scenario")
    parser.add_argument("--no-llm", action="store_true")
    parser.add_argument("--delay-min", type=int, default=25)
    parser.add_argument("--delay-max", type=int, default=70)
    parser.add_argument("--library", type=Path, default=DEFAULT_LIBRARY)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    args = parser.parse_args()
    if args.delay_min < 20 or args.delay_max < args.delay_min:
        parser.error("delays must satisfy 20 <= min <= max")

    state = load_state(args.state)
    if args.publish and isinstance(state.get("pending_publish"), dict):
        pending = state["pending_publish"]
        print(json.dumps({
            "source": "pending",
            "decision": "resume_pending",
            "batch_id": pending.get("batch_id"),
            "next_sequence": pending.get("next_sequence"),
        }, ensure_ascii=False, indent=2))
        if resume_publish(args.state, state, args.delay_min, args.delay_max):
            finalize_publish(args.state, state)
        return 0

    snapshot = fetch_snapshot()
    scenes = detect_scenes(snapshot, state)
    scene = choose_scene(scenes, state, args.scenario)
    latest = recent_chat() if args.publish else empty_chat_context()
    source, pack_id, messages = "none", None, None
    if scene:
        chosen = choose_pack(load_library(args.library), scene, state, latest)
        if chosen:
            pack, messages = chosen
            source, pack_id = "library", pack["id"]
    if messages is None and not args.no_llm:
        try:
            messages = llm_fallback(snapshot, latest, scene)
            source = "llm" if messages else "none"
        except (
            KeyError, TypeError, ValueError, json.JSONDecodeError,
            TimeoutError, urllib.error.URLError,
        ):
            messages = None

    allowed, reason = should_publish(scene, latest, args.force)
    result = {
        "source": source,
        "scene": scene.key if scene else None,
        "score": round(scene.score, 1) if scene else None,
        "pack_id": pack_id,
        "decision": reason if messages else "no_valid_dialogue",
        "messages": messages or [],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if args.publish:
        state["snapshot"] = asdict(snapshot)
        if messages and allowed:
            state["pending_publish"] = pending_publish(messages, scene, pack_id)
            save_state(args.state, state)
            if resume_publish(args.state, state, args.delay_min, args.delay_max):
                finalize_publish(args.state, state)
            return 0
        save_state(args.state, state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
