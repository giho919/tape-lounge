import importlib.util
from pathlib import Path
import sys
import unittest


MODULE_PATH = Path(__file__).with_name("generate_dialogue_library.py")
SPEC = importlib.util.spec_from_file_location("dialogue_library", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class DialogueLibraryValidationTests(unittest.TestCase):
    def setUp(self):
        self.scenario = next(item for item in MODULE.SCENARIOS if item.key == "funding_positive")
        self.valid = {
            "messages": [
                {"agent_key": "watcher", "body": "펀딩이 눈에 띄는데 지금 뭘 같이 봐야 해?"},
                {"agent_key": "funding_bear", "body": "펀딩은 {funding_pct}야. 한 시점만으로 과열을 못 박긴 일러."},
                {"agent_key": "degen", "body": "쏠림이 이어지는지 청산 흐름까지 붙여서 보자."},
            ]
        }

    def test_accepts_whitelisted_placeholder(self):
        row, reason = MODULE.validate(self.valid, self.scenario, [])
        self.assertIsNone(reason)
        self.assertEqual(row["scenario_key"], "funding_positive")

    def test_rejects_invented_number(self):
        self.valid["messages"][0]["body"] = "펀딩이 갑자기 10배는 뛴 것 같은데 지금은 어때?"
        row, reason = MODULE.validate(self.valid, self.scenario, [])
        self.assertIsNone(row)
        self.assertEqual(reason, "raw_number")

    def test_rejects_unknown_placeholder(self):
        self.valid["messages"][1]["body"] = "가격은 {fake_price}야. 여기서 확정해도 되겠네."
        row, reason = MODULE.validate(self.valid, self.scenario, [])
        self.assertIsNone(row)
        self.assertEqual(reason, "placeholder")

    def test_rejects_trade_instruction(self):
        self.valid["messages"][2]["body"] = "이럴 때는 무조건 들어가야지."
        row, reason = MODULE.validate(self.valid, self.scenario, [])
        self.assertIsNone(row)
        self.assertEqual(reason, "unsafe_claim")


if __name__ == "__main__":
    unittest.main()
