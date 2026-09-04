import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).with_name("ops_health_collector.py")
SPEC = importlib.util.spec_from_file_location("ops_health_collector", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def healthy_snapshot():
    return {
        "main_bot_ok": True,
        "bithumb_timer_ok": True,
        "bithumb_last_exit_code": 0,
        "bithumb_account_1_aligned": True,
        "bithumb_account_2_aligned": True,
        "root_disk_used_pct": 7.0,
        "memory_available_mb": 10_000,
        "cpu_temp_c": 57.0,
        "gpu_temp_c": 41.0,
        "cpu_usage_pct": 12.0,
        "disk_busy_pct": 2.0,
        "details": {
            "bithumb": {"status_error": None, "status_age_seconds": 30.0},
            "kubernetes": {"available": True, "unhealthy": 0},
            "services": {"tape-market-recorder.service": "active"},
        },
    }


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return b'{"ok":true}'


class CollectorTests(unittest.TestCase):
    def test_cpu_percentage(self):
        self.assertEqual(MODULE.cpu_percentage((100, 20), (200, 40)), 80.0)

    def test_disk_rates(self):
        read, write, busy = MODULE.disk_rates((100, 200, 1000), (120, 240, 1100), 2)
        self.assertEqual((read, write, busy), (5.0, 10.0, 5.0))

    def test_healthy_assessment(self):
        self.assertEqual(MODULE.assess_health(healthy_snapshot()), ("healthy", []))

    def test_bot_failure_is_critical(self):
        snapshot = healthy_snapshot()
        snapshot["main_bot_ok"] = False
        status, issues = MODULE.assess_health(snapshot)
        self.assertEqual(status, "critical")
        self.assertIn("main_bot_unhealthy", issues)

    def test_resource_pressure_is_degraded(self):
        snapshot = healthy_snapshot()
        snapshot["cpu_temp_c"] = 78.0
        snapshot["disk_busy_pct"] = 95.0
        status, issues = MODULE.assess_health(snapshot)
        self.assertEqual(status, "degraded")
        self.assertEqual(issues, ["cpu_temp_c_high", "disk_busy"])

    def test_publish_signs_exact_envelope(self):
        health = {"sample_key": "server:123"}
        with tempfile.TemporaryDirectory() as directory:
            key = Path(directory) / "key.pem"
            key.write_text("not-used-by-mock", encoding="utf-8")
            completed = mock.Mock(stdout=b"signature")
            with mock.patch.object(MODULE.time, "time", return_value=1234), \
                 mock.patch.object(MODULE.subprocess, "run", return_value=completed) as signer, \
                 mock.patch.object(MODULE.urllib.request, "urlopen", return_value=FakeResponse()) as opener:
                MODULE.publish(health, key)
        body = signer.call_args.kwargs["input"]
        self.assertEqual(json.loads(body), {"timestamp": 1234, "health": health})
        request = opener.call_args.args[0]
        self.assertEqual(request.method, "POST")
        self.assertEqual(request.get_header("X-ops-timestamp"), "1234")
        self.assertEqual(request.get_header("X-ops-signature"), "c2lnbmF0dXJl")


if __name__ == "__main__":
    unittest.main()
