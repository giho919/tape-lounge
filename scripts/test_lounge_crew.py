import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


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

    def test_numeric_variants_share_repeat_key(self):
        self.assertEqual(
            MODULE.normalize_body("매도 쪽이 5.00배 우세해."),
            MODULE.normalize_body("매도 쪽이 6.57배 우세해."),
        )

    def test_pack_rejects_recent_wording_and_prefers_underused_cast(self):
        library = [
            {"id": "repeated", "scenario_key": "ask_heavy", "messages": [
                {"agent_key": "watcher", "body": "위에 매도벽 꽤 두껍다. 여기서 막히는 거야?"},
                {"agent_key": "wolf", "body": "실제 체결을 더 봐야겠네."},
            ]},
            {"id": "overused", "scenario_key": "ask_heavy", "messages": [
                {"agent_key": "watcher", "body": "매도 잔량이 다시 쌓이는 중이네."},
                {"agent_key": "spot_sister", "body": "걸어둔 주문보다 체결 결과를 볼게."},
            ]},
            {"id": "balanced", "scenario_key": "ask_heavy", "messages": [
                {"agent_key": "chart_doryeong", "body": "통과 여부가 확인될 때까지 기다려 보자."},
                {"agent_key": "wolf", "body": "한 번 더 찍히는지를 보겠어."},
            ]},
        ]
        chat = MODULE.empty_chat_context()
        chat["recent_bodies"] = {MODULE.normalize_body("위에 매도벽 꽤 두껍다. 여기서 막히는 거야?")}
        chat["agent_counts"] = {"watcher": 20, "spot_sister": 18, "chart_doryeong": 2, "wolf": 3}
        with mock.patch.object(MODULE.random, "random", return_value=0.9):
            chosen = MODULE.choose_pack(library, MODULE.Scene("ask_heavy", 70, {}), {}, chat)
        self.assertIsNotNone(chosen)
        self.assertEqual(chosen[0]["id"], "balanced")

    def test_pack_returns_none_when_only_recent_wording_remains(self):
        library = [{"id": "one", "scenario_key": "quiet_range", "messages": [
            {"agent_key": "watcher", "body": "지금은 조용해서 한 번 더 볼래."},
            {"agent_key": "spot_sister", "body": "서두르지 않고 기다려 보자."},
        ]}]
        chat = MODULE.empty_chat_context()
        chat["recent_bodies"] = {MODULE.normalize_body("지금은 조용해서 한 번 더 볼래.")}
        self.assertIsNone(MODULE.choose_pack(library, MODULE.Scene("quiet_range", 36, {}), {}, chat))

    def test_pack_avoids_same_lead_when_alternative_exists(self):
        library = [
            {"id": "same", "scenario_key": "bid_heavy", "messages": [
                {"agent_key": "watcher", "body": "매수벽이 다시 두꺼워졌네."},
                {"agent_key": "wolf", "body": "체결이 따라오는지 보자."},
            ]},
            {"id": "other", "scenario_key": "bid_heavy", "messages": [
                {"agent_key": "chart_doryeong", "body": "가격이 벽 위에서 버티는지를 보자."},
                {"agent_key": "spot_sister", "body": "주문만 보고 결론내리진 않을게."},
            ]},
        ]
        chosen = MODULE.choose_pack(
            library, MODULE.Scene("bid_heavy", 70, {}), {"last_lead_agent": "watcher"}
        )
        self.assertIsNotNone(chosen)
        self.assertEqual(chosen[0]["id"], "other")

    def test_state_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            MODULE.save_state(path, {"recent_ids": ["one"]})
            self.assertEqual(MODULE.load_state(path)["recent_ids"], ["one"])


if __name__ == "__main__":
    unittest.main()
