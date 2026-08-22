#!/usr/bin/env python3
"""Record canonical public market events for Tape Lounge.

The browser remains responsible for live visual effects. This daemon keeps the
shared 48-hour event ledger so visitors who arrive later see the same highlights
and recent liquidation clusters. Every write is signed and validated by a
dedicated Supabase Edge Function.
"""

from __future__ import annotations

import base64
import json
import logging
import math
import os
import re
import signal
import subprocess
import threading
import time
import urllib.request
import urllib.parse
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import websocket


SPOT_REST = "https://api.binance.com/api/v3"
SPOT_WS = (
    "wss://stream.binance.com:9443/stream?"
    "streams=btcusdt@aggTrade/btcusdt@kline_1m"
)
LIQUIDATION_WS = "wss://fstream.binance.com/market/stream?streams=!forceOrder@arr"
PUBLISH_URL = os.getenv(
    "TAPE_MARKET_EVENT_PUBLISH_URL",
    "https://mmvhyzajmfkilldxxazs.supabase.co/functions/v1/market-event-publish",
)
SUPABASE_URL = os.getenv("TAPE_SUPABASE_URL", "https://mmvhyzajmfkilldxxazs.supabase.co")
SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "TAPE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_S5ohCvizmH8zI-H1wvRupA_aHTG4YOH"
)
SIGNING_KEY = Path(
    os.getenv(
        "TAPE_MARKET_EVENT_SIGNING_KEY",
        "/home/shyoo/.config/tape-lounge/lounge-crew-signing-key.pem",
    )
)
BASE_DIR = Path(__file__).resolve().parents[1]
MACRO_PATH = BASE_DIR / "reports" / "econ_calendar.json"

LIQUIDATION_STORE_MIN = 100_000
LIQUIDATION_HIGHLIGHT_MIN = 1_000_000
JACKPOT_TARGET = 5_000_000
JACKPOT_WINDOW_SECONDS = 15 * 60

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
LOG = logging.getLogger("tape-market-recorder")


def iso_time(milliseconds: int | float) -> str:
    return datetime.fromtimestamp(milliseconds / 1000, timezone.utc).isoformat().replace("+00:00", "Z")


def money(value: float) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    return f"${value / 1_000:.0f}K"


def fetch_json(url: str, timeout: int = 15, headers: dict[str, str] | None = None) -> Any:
    request = urllib.request.Request(url, headers={
        "User-Agent": "Tape-Market-Recorder/1.0",
        **(headers or {}),
    })
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


class Publisher:
    def __init__(self, signing_key: Path) -> None:
        if not signing_key.is_file():
            raise RuntimeError(f"signing key not found: {signing_key}")
        self.signing_key = signing_key

    def publish(self, event: dict[str, Any]) -> None:
        timestamp = int(time.time())
        payload = {"timestamp": timestamp, "event": event}
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        signature = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", str(self.signing_key)],
            input=body,
            capture_output=True,
            check=True,
        ).stdout
        request = urllib.request.Request(
            PUBLISH_URL,
            data=body,
            headers={
                "content-type": "application/json",
                "accept": "application/json",
                "user-agent": "Tape-Market-Recorder/1.0",
                "x-tape-timestamp": str(timestamp),
                "x-tape-signature": base64.b64encode(signature).decode(),
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
        if result.get("ok") is not True:
            raise RuntimeError("market event publisher rejected the event")


class Recorder:
    def __init__(self) -> None:
        self.publisher = Publisher(SIGNING_KEY)
        self.stop = threading.Event()
        self.lock = threading.Lock()
        self.body_history: deque[float] = deque(maxlen=30)
        self.high_history: deque[float] = deque(maxlen=60)
        self.low_history: deque[float] = deque(maxlen=60)
        self.liquidation_minutes: dict[int, dict[str, Any]] = {}
        self.liquidation_window: deque[tuple[float, float, bool]] = deque()
        self.seen_liquidations: set[str] = set()
        self.seen_order: deque[str] = deque(maxlen=2000)
        self.last_price: float | None = None
        self.breakout_cooldown = {"up": 0.0, "down": 0.0}
        self.jackpot_ready = True
        self.last_macro_scan = 0.0

    def seed_bars(self) -> None:
        bars = fetch_json(f"{SPOT_REST}/klines?symbol=BTCUSDT&interval=1m&limit=61")
        for bar in bars[:-1]:
            open_price, high, low, close = map(float, (bar[1], bar[2], bar[3], bar[4]))
            self.body_history.append(abs(close - open_price) / open_price * 100)
            self.high_history.append(high)
            self.low_history.append(low)
        if bars:
            self.last_price = float(bars[-1][4])
        LOG.info("seeded %d closed BTC one-minute bars", len(self.high_history))

    def seed_liquidations(self) -> None:
        since = datetime.fromtimestamp(time.time() - JACKPOT_WINDOW_SECONDS, timezone.utc).isoformat()
        query = urllib.parse.urlencode({
            "select": "event_time,amount_usd,metadata",
            "event_type": "eq.liquidation",
            "event_time": f"gte.{since}",
            "order": "event_time.asc",
            "limit": "1000",
        })
        rows = fetch_json(
            f"{SUPABASE_URL}/rest/v1/market_events?{query}",
            headers={"apikey": SUPABASE_PUBLISHABLE_KEY},
        )
        current_minute = int(time.time() * 1000) // 60_000 * 60_000
        for row in rows:
            event_ms = int(datetime.fromisoformat(row["event_time"].replace("Z", "+00:00")).timestamp() * 1000)
            metadata = row.get("metadata") or {}
            long_value = float(metadata.get("long_usd") or 0)
            short_value = float(metadata.get("short_usd") or 0)
            if long_value:
                self.liquidation_window.append((event_ms / 1000, long_value, True))
            if short_value:
                self.liquidation_window.append((event_ms / 1000, short_value, False))
            if event_ms == current_minute:
                total = long_value + short_value
                self.liquidation_minutes[current_minute] = {
                    "long": long_value,
                    "short": short_value,
                    "count": int(metadata.get("count") or 0),
                    "max": float(metadata.get("max_event_usd") or 0),
                    "last_publish": time.time(),
                    "published_amount": total,
                }
        total = sum(item[1] for item in self.liquidation_window)
        self.jackpot_ready = total < JACKPOT_TARGET
        LOG.info("restored %d liquidation minutes (%s / 15m)", len(rows), money(total))

    def event(self, **values: Any) -> dict[str, Any]:
        return {
            "event_key": values["event_key"],
            "event_type": values["event_type"],
            "event_time": values["event_time"],
            "icon": values["icon"],
            "title": values["title"],
            "detail": values["detail"],
            "tone": values.get("tone", "gold"),
            "symbol": values.get("symbol"),
            "side": values.get("side"),
            "price": values.get("price"),
            "amount_usd": values.get("amount_usd"),
            "importance": values.get("importance", 50),
            "is_highlight": values.get("is_highlight", False),
            "metadata": values.get("metadata", {}),
        }

    def publish(self, event: dict[str, Any]) -> bool:
        try:
            self.publisher.publish(event)
            LOG.info("stored %s %s", event["event_type"], event["event_key"])
            return True
        except Exception:
            LOG.exception("failed to store %s", event.get("event_key"))
            return False

    def on_spot(self, raw: str) -> None:
        message = json.loads(raw)
        stream, data = message.get("stream", ""), message.get("data", {})
        if stream.endswith("@aggTrade"):
            price, quantity = float(data["p"]), float(data["q"])
            self.last_price = price
            value = price * quantity
            is_buy = not bool(data["m"])
            self.check_breakout(price, int(data.get("T", time.time() * 1000)))
            if value >= 1_000_000:
                side = "buy" if is_buy else "sell"
                self.publish(self.event(
                    event_key=f"whale:btc:{data['a']}",
                    event_type="whale",
                    event_time=iso_time(int(data.get("T", time.time() * 1000))),
                    icon="🐳",
                    title=f"BTC 고래 {('매수' if is_buy else '매도')}",
                    detail=f"{money(value)} 단일 시장가 체결",
                    tone="up" if is_buy else "dn",
                    symbol="BTCUSDT",
                    side=side,
                    price=price,
                    amount_usd=round(value, 2),
                    importance=min(92, 78 + int(math.log10(value / 1_000_000 + 1) * 12)),
                    is_highlight=True,
                    metadata={"trade_id": int(data["a"]), "quantity_btc": quantity},
                ))
        elif stream.endswith("@kline_1m") and data.get("k", {}).get("x"):
            self.on_candle(data["k"])

    def on_candle(self, candle: dict[str, Any]) -> None:
        open_price = float(candle["o"])
        high = float(candle["h"])
        low = float(candle["l"])
        close = float(candle["c"])
        body_pct = abs(close - open_price) / open_price * 100
        average = sum(self.body_history) / len(self.body_history) if len(self.body_history) >= 10 else 0.06
        threshold = max(average * 3.2, 0.15)
        if body_pct >= threshold:
            is_up = close >= open_price
            self.publish(self.event(
                event_key=f"candle:btc:1m:{int(candle['t'])}",
                event_type="candle",
                event_time=iso_time(int(candle["T"])),
                icon="🚀" if is_up else "🕳",
                title=f"BTC 1분 장대{('양봉' if is_up else '음봉')}",
                detail=f"{('+' if is_up else '-')}{body_pct:.2f}% · 평소 몸통의 {body_pct / max(average, 0.001):.1f}배",
                tone="up" if is_up else "dn",
                symbol="BTCUSDT",
                side="up" if is_up else "down",
                price=close,
                importance=94,
                is_highlight=True,
                metadata={"body_pct": round(body_pct, 5), "average_body_pct": round(average, 5)},
            ))
        self.body_history.append(body_pct)
        self.high_history.append(high)
        self.low_history.append(low)

    def check_breakout(self, price: float, event_ms: int) -> None:
        if len(self.high_history) < 30:
            return
        now = time.time()
        ceiling, floor = max(self.high_history), min(self.low_history)
        side = None
        if price > ceiling and now >= self.breakout_cooldown["up"]:
            side = "up"
        elif price < floor and now >= self.breakout_cooldown["down"]:
            side = "down"
        if not side:
            return
        self.breakout_cooldown[side] = now + 15 * 60
        window = event_ms // (15 * 60_000) * (15 * 60_000)
        self.publish(self.event(
            event_key=f"breakout:btc:{side}:{window}",
            event_type="breakout",
            event_time=iso_time(event_ms),
            icon="⚡" if side == "up" else "🕳",
            title=f"BTC 60분 {('고점 돌파' if side == 'up' else '저점 붕괴')}",
            detail=f"{price:,.0f}에서 직전 60분 {('천장을 넘었습니다.' if side == 'up' else '바닥이 깨졌습니다.')}",
            tone="up" if side == "up" else "dn",
            symbol="BTCUSDT",
            side=side,
            price=price,
            importance=92,
            is_highlight=True,
            metadata={"range_high": ceiling, "range_low": floor},
        ))

    def on_liquidation(self, raw: str) -> None:
        message = json.loads(raw)
        order = message.get("data", {}).get("o")
        if not order:
            return
        event_ms = int(order.get("T") or time.time() * 1000)
        dedupe_key = f"{order.get('s')}:{order.get('S')}:{event_ms}:{order.get('z')}"
        with self.lock:
            if dedupe_key in self.seen_liquidations:
                return
            if len(self.seen_order) == self.seen_order.maxlen:
                self.seen_liquidations.discard(self.seen_order[0])
            self.seen_order.append(dedupe_key)
            self.seen_liquidations.add(dedupe_key)

        quantity = float(order.get("z") or order.get("q") or 0)
        price = float(order.get("ap") or order.get("p") or 0)
        value = quantity * price
        if not math.isfinite(value) or value <= 0:
            return
        long_wipeout = order.get("S") == "SELL"
        minute = event_ms // 60_000 * 60_000
        with self.lock:
            bucket = self.liquidation_minutes.setdefault(minute, {
                "long": 0.0, "short": 0.0, "count": 0, "max": 0.0,
                "last_publish": 0.0, "published_amount": 0.0,
            })
            bucket["long" if long_wipeout else "short"] += value
            bucket["count"] += 1
            bucket["max"] = max(bucket["max"], value)
            self.liquidation_window.append((event_ms / 1000, value, long_wipeout))
            self.trim_liquidation_window(event_ms / 1000)
            total = sum(item[1] for item in self.liquidation_window)
            long_total = sum(item[1] for item in self.liquidation_window if item[2])
            if total < JACKPOT_TARGET * 0.45:
                self.jackpot_ready = True
            fire = self.jackpot_ready and total >= JACKPOT_TARGET
            if fire:
                self.jackpot_ready = False
        if fire:
            self.publish_jackpot(event_ms, total, long_total, total - long_total)

    def trim_liquidation_window(self, now: float) -> None:
        while self.liquidation_window and now - self.liquidation_window[0][0] > JACKPOT_WINDOW_SECONDS:
            self.liquidation_window.popleft()

    def publish_jackpot(self, event_ms: int, total: float, long_total: float, short_total: float) -> None:
        long_wipeout = long_total >= short_total
        window = event_ms // (15 * 60_000) * (15 * 60_000)
        self.publish(self.event(
            event_key=f"jackpot:{window}:{'long' if long_wipeout else 'short'}",
            event_type="jackpot",
            event_time=iso_time(event_ms),
            icon="🎰",
            title=f"{('롱' if long_wipeout else '숏')} 청산 잭팟",
            detail=f"15분 누적 {money(total)}",
            tone="dn" if long_wipeout else "up",
            symbol="ALL",
            side="long" if long_wipeout else "short",
            price=self.last_price,
            amount_usd=round(total, 2),
            importance=100,
            is_highlight=True,
            metadata={"long_usd": round(long_total, 2), "short_usd": round(short_total, 2)},
        ))

    def flush_liquidations(self) -> None:
        now = time.time()
        current_minute = int(now * 1000) // 60_000 * 60_000
        pending: list[tuple[int, dict[str, Any], bool]] = []
        with self.lock:
            for minute, source in list(self.liquidation_minutes.items()):
                total = source["long"] + source["short"]
                final = minute < current_minute
                changed = total - source["published_amount"] >= 50_000
                due = now - source["last_publish"] >= 10
                needs_final = final and source["published_amount"] < total
                needs_live_update = not final and changed and due
                if total >= LIQUIDATION_STORE_MIN and (needs_final or needs_live_update):
                    pending.append((minute, dict(source), final))
                if minute < current_minute - 2 * 60_000:
                    del self.liquidation_minutes[minute]
        for minute, bucket, final in pending:
            total = bucket["long"] + bucket["short"]
            long_wipeout = bucket["long"] >= bucket["short"]
            highlight = (
                total >= LIQUIDATION_HIGHLIGHT_MIN or
                bucket["max"] >= 500_000 or
                (bucket["count"] >= 5 and total >= 500_000)
            )
            stored = self.publish(self.event(
                event_key=f"liquidation:minute:{minute}",
                event_type="liquidation",
                event_time=iso_time(minute),
                icon="🩸" if long_wipeout else "⚡",
                title=f"전 시장 {('롱' if long_wipeout else '숏')} 청산 {('폭발' if highlight else '집중')}",
                detail=f"1분 누적 {money(total)} · {bucket['count']}건",
                tone="dn" if long_wipeout else "up",
                symbol="ALL",
                side="long" if long_wipeout else "short",
                price=self.last_price,
                amount_usd=round(total, 2),
                importance=min(98, 62 + int(math.log10(max(1, total / 100_000)) * 18)),
                is_highlight=highlight,
                metadata={
                    "long_usd": round(bucket["long"], 2),
                    "short_usd": round(bucket["short"], 2),
                    "count": int(bucket["count"]),
                    "max_event_usd": round(bucket["max"], 2),
                    "final": final,
                },
            ))
            if stored:
                with self.lock:
                    current = self.liquidation_minutes.get(minute)
                    if current:
                        current["last_publish"] = time.time()
                        current["published_amount"] = total

    def scan_macro(self) -> None:
        if not MACRO_PATH.is_file():
            return
        try:
            data = json.loads(MACRO_PATH.read_text())
            now_ms = time.time() * 1000
            for item in data.get("events", []):
                if item.get("actual") is None:
                    continue
                event_ms = datetime.fromisoformat(item["scheduled_at"].replace("Z", "+00:00")).timestamp() * 1000
                if not 0 <= now_ms - event_ms <= 24 * 3600_000:
                    continue
                unit = item.get("unit") or ""
                actual = f"{item['actual']}{unit}"
                previous = "—" if item.get("previous") is None else f"{item['previous']}{unit}"
                event_id = re.sub(r"[^a-z0-9_-]", "", str(item["id"]).lower())
                self.publish(self.event(
                    event_key=f"macro:{event_id}",
                    event_type="macro",
                    event_time=iso_time(event_ms),
                    icon="📣",
                    title=f"{item['code']} 실제 {actual}",
                    detail=f"이전 {previous} → 실제 {actual}",
                    tone="gold",
                    symbol=None,
                    side=None,
                    price=None,
                    amount_usd=None,
                    importance=96 if item.get("importance") == "VIP" else 84,
                    is_highlight=True,
                    metadata={"source": item.get("source"), "calendar_id": str(item["id"])},
                ))
        except Exception:
            LOG.exception("macro calendar scan failed")

    def maintenance(self) -> None:
        while not self.stop.wait(2):
            self.flush_liquidations()
            if time.time() - self.last_macro_scan >= 60:
                self.last_macro_scan = time.time()
                self.scan_macro()

    def stream(self, name: str, url: str, handler: Any) -> None:
        while not self.stop.is_set():
            try:
                app = websocket.WebSocketApp(
                    url,
                    on_open=lambda _ws: LOG.info("%s stream connected", name),
                    on_message=lambda _ws, message: handler(message),
                    on_error=lambda _ws, error: LOG.warning("%s stream error: %s", name, error),
                    on_close=lambda _ws, code, reason: LOG.warning("%s stream closed: %s %s", name, code, reason),
                )
                app.run_forever(ping_interval=20, ping_timeout=10)
            except Exception:
                LOG.exception("%s stream crashed", name)
            if not self.stop.wait(3):
                LOG.info("reconnecting %s stream", name)

    def run(self) -> None:
        self.seed_bars()
        try:
            self.seed_liquidations()
        except Exception:
            LOG.exception("could not restore recent liquidation history; continuing live")
        threads = [
            threading.Thread(target=self.stream, args=("spot", SPOT_WS, self.on_spot), daemon=True),
            threading.Thread(target=self.stream, args=("liquidation", LIQUIDATION_WS, self.on_liquidation), daemon=True),
            threading.Thread(target=self.maintenance, daemon=True),
        ]
        for thread in threads:
            thread.start()
        while not self.stop.wait(1):
            pass


def main() -> int:
    recorder = Recorder()
    signal.signal(signal.SIGTERM, lambda *_: recorder.stop.set())
    signal.signal(signal.SIGINT, lambda *_: recorder.stop.set())
    recorder.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
