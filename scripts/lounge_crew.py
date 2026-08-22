#!/usr/bin/env python3
"""Select and publish a Tape Lounge crew conversation from verified facts.

The 10,000-pack local library is the normal path. The local Qwen model is only
asked for a conversation when no reviewed scenario matches. Dry-run is the
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
PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")
NUMBER_RE = re.compile(r"[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%p|%|배|M|K)?")
BANNED = (
    "무조건", "확실", "보장", "풀매수", "풀숏", "사라", "팔아",
    "롱 가자", "숏 가자", "진입해", "손절해", "익절해", "내 포지션",
    "수익 인증", "세력이다", "지지 확인", "저항 확인", "안착",
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


def choose_pack(
    library: list[dict[str, Any]], scene: Scene, state: dict[str, Any]
) -> tuple[dict[str, Any], list[dict[str, str]]] | None:
    recent = set(state.get("recent_ids", []))
    official_ready = time.time() - float(state.get("last_official_at", 0)) >= 6 * 3600
    candidates = [row for row in library if row.get("scenario_key") == scene.key and row.get("id") not in recent]
    random.shuffle(candidates)
    without_official = [row for row in candidates if not any(m.get("agent_key") in OFFICIAL for m in row.get("messages", []))]
    with_official = [row for row in candidates if any(m.get("agent_key") in OFFICIAL for m in row.get("messages", []))]
    if official_ready and with_official and random.random() < 0.08:
        candidates = with_official
    else:
        candidates = without_official or candidates
    for pack in candidates:
        rendered = render_pack(pack, scene.facts)
        if rendered:
            return pack, rendered
    return None


def recent_chat() -> dict[str, float]:
    query = urllib.parse.urlencode({
        "select": "created_at,author_type",
        "order": "created_at.desc",
        "limit": "40",
    })
    rows = request_json(
        f"{SUPABASE_URL}/rest/v1/salon_chat?{query}",
        headers={"apikey": SUPABASE_PUBLISHABLE_KEY},
    )
    latest = {"human": 0.0, "virtual": 0.0}
    for row in rows if isinstance(rows, list) else []:
        kind = row.get("author_type")
        if kind not in latest or latest[kind]:
            continue
        try:
            latest[kind] = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")).timestamp()
        except (KeyError, ValueError, TypeError):
            pass
    return latest


def should_publish(scene: Scene | None, latest: dict[str, float], force: bool) -> tuple[bool, str]:
    if force:
        return True, "forced"
    now = time.time()
    if latest.get("human", 0) and now - latest["human"] < 4 * 60:
        return False, "human_conversation_active"
    min_gap = 25 * 60 if scene and scene.score >= 65 else 60 * 60
    if latest.get("virtual", 0) and now - latest["virtual"] < min_gap:
        return False, "virtual_cooldown"
    return True, "ready"


def allowed_llm_numbers(snapshot: MarketSnapshot) -> set[str]:
    return {
        f"{snapshot.price:,.1f}", pct(snapshot.change_24h_pct),
        pct(snapshot.high_gap_pct), pct(snapshot.low_gap_pct),
        pct(snapshot.funding_pct), f"{snapshot.spread_usdt:.1f}", "24",
    }


def llm_fallback(snapshot: MarketSnapshot) -> list[dict[str, str]] | None:
    allowed_agents = {key: name for key, name in AGENT_NAMES.items() if key not in OFFICIAL}
    prompt = f"""/no_think
너는 Tape Lounge 라운지 크루의 짧은 대화를 쓴다. 다음 관찰값만 사용할 수 있다.
BTC {snapshot.price:,.1f} USDT, 24시간 {pct(snapshot.change_24h_pct)}, 고가까지 {pct(snapshot.high_gap_pct)},
저가까지 {pct(snapshot.low_gap_pct)}, 펀딩 {pct(snapshot.funding_pct)}, 스프레드 {snapshot.spread_usdt:.1f} USDT.
인물: {json.dumps(allowed_agents, ensure_ascii=False)}
서로 반응하는 자연스러운 반말 2~4개를 JSON으로만 출력한다.
새 숫자·원인·지지·저항·전망·매매 지시·실제 포지션은 만들지 않는다.
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
    allowed_numbers = allowed_llm_numbers(snapshot)
    messages: list[dict[str, str]] = []
    speakers: set[str] = set()
    for row in rows:
        key, body = row.get("agent_key"), row.get("body")
        if key not in allowed_agents or not isinstance(body, str) or not 8 <= len(body.strip()) <= 90:
            return None
        body = body.strip()
        if any(term in body for term in BANNED):
            return None
        if any(number not in allowed_numbers for number in NUMBER_RE.findall(body)):
            return None
        speakers.add(key)
        messages.append({"agent_key": key, "nick": AGENT_NAMES[key], "body": body})
    return messages if len(speakers) >= 2 else None


def publish(messages: list[dict[str, str]], delay_min: int, delay_max: int) -> None:
    if os.getenv("TAPE_AI_CHAT_ENABLE") != "1":
        raise RuntimeError("publishing is locked; set TAPE_AI_CHAT_ENABLE=1")
    signing_key = os.getenv("TAPE_AI_CHAT_SIGNING_KEY")
    if not signing_key or not Path(signing_key).is_file():
        raise RuntimeError("TAPE_AI_CHAT_SIGNING_KEY must point to a private key")
    batch_id = str(uuid.uuid4())
    for index, message in enumerate(messages):
        timestamp = int(time.time())
        payload = {
            "timestamp": timestamp,
            "batch_id": batch_id,
            "sequence": index,
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
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
        if result.get("ok") is not True:
            raise RuntimeError("chat publisher rejected the message")
        if index < len(messages) - 1:
            time.sleep(random.randint(delay_min, delay_max))


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
    snapshot = fetch_snapshot()
    scenes = detect_scenes(snapshot, state)
    scene = choose_scene(scenes, state, args.scenario)
    source, pack_id, messages = "none", None, None
    if scene:
        chosen = choose_pack(load_library(args.library), scene, state)
        if chosen:
            pack, messages = chosen
            source, pack_id = "library", pack["id"]
    if messages is None and not args.no_llm:
        try:
            messages = llm_fallback(snapshot)
            source = "llm" if messages else "none"
        except (KeyError, TypeError, ValueError, json.JSONDecodeError, urllib.error.URLError):
            messages = None

    latest = recent_chat() if args.publish else {"human": 0.0, "virtual": 0.0}
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
            publish(messages, args.delay_min, args.delay_max)
            state["last_scene"] = scene.key if scene else "llm"
            state["last_published_at"] = time.time()
            recent_ids = ([pack_id] if pack_id else []) + list(state.get("recent_ids", []))
            state["recent_ids"] = recent_ids[:500]
            if any(message["agent_key"] in OFFICIAL for message in messages):
                state["last_official_at"] = time.time()
            state.pop("pending_liquidation", None)
        save_state(args.state, state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
