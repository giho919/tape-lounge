import importlib.util
from pathlib import Path
import sys
import threading
import time
import types
import unittest
from unittest import mock


sys.modules.setdefault("websocket", types.SimpleNamespace(WebSocketApp=object))
MODULE_PATH = Path(__file__).with_name("market_event_recorder.py")
SPEC = importlib.util.spec_from_file_location("market_event_recorder", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def recorder():
    value = MODULE.Recorder.__new__(MODULE.Recorder)
    value.lock = threading.Lock()
    value.body_history = MODULE.deque([0.05] * 30, maxlen=30)
    value.high_history = MODULE.deque([101.0] * 60, maxlen=60)
    value.low_history = MODULE.deque([99.0] * 60, maxlen=60)
    value.last_price = 100.0
    value.liquidation_minutes = {}
    value.liquidation_window = MODULE.deque()
    value.jackpot_ready = True
    value.breakout_cooldown = {"up": 0.0, "down": 0.0}
    return value


class RecorderTests(unittest.TestCase):
    def test_money_format(self):
        self.assertEqual(MODULE.money(1_250_000), "$1.2M")
        self.assertEqual(MODULE.money(250_000), "$250K")

    def test_large_candle_creates_canonical_event(self):
        value = recorder()
        stored = []
        value.publish = lambda event: stored.append(event) or True
        value.on_candle({
            "t": 60_000, "T": 119_999, "o": "100", "h": "101",
            "l": "99", "c": "100.30",
        })
        self.assertEqual(len(stored), 1)
        self.assertEqual(stored[0]["event_type"], "candle")
        self.assertTrue(stored[0]["is_highlight"])

    def test_liquidation_minute_aggregates_both_sides(self):
        value = recorder()
        minute = int(time.time() * 1000) // 60_000 * 60_000
        value.liquidation_minutes[minute] = {
            "long": 400_000.0, "short": 150_000.0, "count": 6,
            "max": 200_000.0, "last_publish": 0.0, "published_amount": 0.0,
        }
        stored = []
        value.publish = lambda event: stored.append(event) or True
        value.flush_liquidations()
        self.assertEqual(len(stored), 1)
        event = stored[0]
        self.assertEqual(event["amount_usd"], 550_000.0)
        self.assertEqual(event["metadata"]["long_usd"], 400_000.0)
        self.assertTrue(event["is_highlight"])

    def test_final_liquidation_minute_is_not_republished_unchanged(self):
        value = recorder()
        minute = int(time.time() * 1000) // 60_000 * 60_000 - 60_000
        value.liquidation_minutes[minute] = {
            "long": 100_000.0, "short": 50_000.0, "count": 2,
            "max": 100_000.0, "last_publish": 0.0, "published_amount": 150_000.0,
        }
        stored = []
        value.publish = lambda event: stored.append(event) or True
        value.flush_liquidations()
        self.assertEqual(stored, [])

    def test_restart_restores_current_liquidation_minute(self):
        value = recorder()
        minute = int(time.time() * 1000) // 60_000 * 60_000
        rows = [{
            "event_time": MODULE.iso_time(minute), "amount_usd": 300_000,
            "metadata": {"long_usd": 200_000, "short_usd": 100_000, "count": 4, "max_event_usd": 150_000},
        }]
        with mock.patch.object(MODULE, "fetch_json", return_value=rows):
            value.seed_liquidations()
        self.assertEqual(value.liquidation_minutes[minute]["published_amount"], 300_000)
        self.assertEqual(sum(item[1] for item in value.liquidation_window), 300_000)

    def test_restart_restores_breakout_cooldown(self):
        value = recorder()
        event_time = MODULE.iso_time(time.time() * 1000)
        with mock.patch.object(MODULE, "fetch_json", return_value=[{"event_time": event_time, "side": "up"}]):
            value.seed_breakout_cooldowns()
        self.assertGreater(value.breakout_cooldown["up"], time.time() + 14 * 60)


if __name__ == "__main__":
    unittest.main()
