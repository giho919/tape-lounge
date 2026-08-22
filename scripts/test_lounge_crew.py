import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("lounge_crew.py")
SPEC = importlib.util.spec_from_file_location("lounge_crew", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def snapshot(**changes):
    values = dict(
        captured_at=1.0, price=100.0, high_24h=101.0, low_24h=99.0,
        change_24h_pct=0.5, high_gap_pct=1.0, low_gap_pct=1.0,
        range_24h_pct=2.0, funding_pct=0.0, oi_btc=1000.0,
        spread_usdt=0.1, spread_bps=0.1, volume_ratio=1.0,
        price_change_1h_pct=0.0, oi_change_1h_pct=0.0, book_ratio=1.0,
        fear_greed=50, fee_rate=2.0, block_height=100,
        btc_dominance=50.0, shock_range_pct=0.1, recent_body_pct=0.1,
    )
    values.update(changes)
    return MODULE.MarketSnapshot(**values)


class SceneTests(unittest.TestCase):
    def test_detects_volume_and_bid_scenes(self):
        scenes = MODULE.detect_scenes(snapshot(volume_ratio=2.4, book_ratio=1.8), {})
        keys = {scene.key for scene in scenes}
        self.assertIn("volume_burst", keys)
        self.assertIn("bid_heavy", keys)

    def test_detects_new_block_from_previous_snapshot(self):
        scenes = MODULE.detect_scenes(snapshot(block_height=101), {"snapshot": {"block_height": 100}})
        self.assertIn("block_settled", {scene.key for scene in scenes})

    def test_human_activity_blocks_publish(self):
        allowed, reason = MODULE.should_publish(
            MODULE.Scene("volume_burst", 80, {}), {"human": MODULE.time.time(), "virtual": 0}, False
        )
        self.assertFalse(allowed)
        self.assertEqual(reason, "human_conversation_active")

    def test_render_rejects_missing_fact(self):
        pack = {"messages": [
            {"agent_key": "wolf", "body": "지금 {book_imbalance} 우세야."},
            {"agent_key": "watcher", "body": "그럼 체결을 더 볼게."},
        ]}
        self.assertIsNone(MODULE.render_pack(pack, {}))

    def test_extreme_book_ratio_is_capped_for_display(self):
        self.assertEqual(MODULE.multiple(20.88), "10배 이상")

    def test_state_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            MODULE.save_state(path, {"recent_ids": ["one"]})
            self.assertEqual(MODULE.load_state(path)["recent_ids"], ["one"])


if __name__ == "__main__":
    unittest.main()
