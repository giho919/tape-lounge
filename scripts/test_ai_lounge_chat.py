import unittest

from ai_lounge_chat import Snapshot, fallback_batch, validate_batch


SNAPSHOT = Snapshot(
    price=76398.8,
    change_pct=9.615,
    high=76900.0,
    low=69482.0,
    range_position_pct=93.24,
    high_gap_pct=0.656,
    funding_pct=0.004543,
    open_interest_btc=109076.658,
    spread=0.1,
)


class ValidationTest(unittest.TestCase):
    def test_fallback_is_valid(self):
        valid, errors = validate_batch(fallback_batch(SNAPSHOT), SNAPSHOT)
        self.assertEqual(errors, [])
        self.assertEqual(len(valid), 5)

    def test_unknown_number_rejects_whole_batch(self):
        batch = fallback_batch(SNAPSHOT)
        batch[0]["body"] = "지금 80,000까지 갈 가능성을 먼저 확인해 보자."
        valid, errors = validate_batch(batch, SNAPSHOT)
        self.assertEqual(valid, [])
        self.assertIn("message_0:unknown_number", errors)

    def test_trade_instruction_is_rejected(self):
        batch = fallback_batch(SNAPSHOT)
        batch[1]["body"] = "지금 바로 매수하면 된다고 생각해."
        valid, errors = validate_batch(batch, SNAPSHOT)
        self.assertEqual(valid, [])
        self.assertIn("message_1:banned_claim", errors)

    def test_wrong_speaker_order_is_rejected(self):
        batch = fallback_batch(SNAPSHOT)
        batch[0]["agent_key"] = "funding_bear"
        valid, errors = validate_batch(batch, SNAPSHOT)
        self.assertEqual(valid, [])
        self.assertIn("message_0:speaker", errors)

    def test_unproven_funding_trend_is_rejected(self):
        batch = fallback_batch(SNAPSHOT)
        batch[2]["body"] = "펀딩은 +0.004543% 수준을 계속 유지 중인 것 같아."
        valid, errors = validate_batch(batch, SNAPSHOT)
        self.assertEqual(valid, [])
        self.assertIn("message_2:banned_claim", errors)

    def test_natural_closer_is_allowed(self):
        batch = fallback_batch(SNAPSHOT)
        batch[4]["body"] = "좋아, 확인해 보자"
        valid, errors = validate_batch(batch, SNAPSHOT)
        self.assertEqual(errors, [])
        self.assertEqual(valid[4]["body"], "좋아, 확인해 보자")


if __name__ == "__main__":
    unittest.main()
