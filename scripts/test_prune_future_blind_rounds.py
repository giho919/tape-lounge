import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('prune_future_blind_rounds.py').resolve()


class PruneFutureRoundsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='tape-round-prune-')
        self.root = Path(self.temp.name)
        subprocess.run(['git', 'init', '-q'], cwd=self.root, check=True)
        subprocess.run(['git', 'config', 'user.name', 'Tape Lounge Test'], cwd=self.root, check=True)
        subprocess.run(['git', 'config', 'user.email', 'test@example.invalid'], cwd=self.root, check=True)
        self.rounds = self.root / 'reports' / 'blind_daily_stock_v2'
        self.rounds.mkdir(parents=True)
        for day in ('2026-11-01', '2026-11-02', '2026-11-03'):
            (self.rounds / f'{day}.json').write_text(day, encoding='utf-8')
        subprocess.run(['git', 'add', 'reports/blind_daily_stock_v2'], cwd=self.root, check=True)
        subprocess.run(['git', 'commit', '-qm', 'fixture'], cwd=self.root, check=True)
        (self.rounds / '2026-11-04.json').write_text('untracked future', encoding='utf-8')

    def tearDown(self):
        self.temp.cleanup()

    def test_preserves_past_and_today_and_removes_future_answers(self):
        subprocess.run(
            [sys.executable, str(SCRIPT), 'reports/blind_daily_stock_v2/2026-11-02.json'],
            cwd=self.root,
            check=True,
        )
        self.assertTrue((self.rounds / '2026-11-01.json').exists())
        self.assertTrue((self.rounds / '2026-11-02.json').exists())
        self.assertFalse((self.rounds / '2026-11-03.json').exists())
        self.assertFalse((self.rounds / '2026-11-04.json').exists())
        tracked = subprocess.run(
            ['git', 'ls-files', '--', 'reports/blind_daily_stock_v2'],
            cwd=self.root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.splitlines()
        self.assertEqual(tracked, [
            'reports/blind_daily_stock_v2/2026-11-01.json',
            'reports/blind_daily_stock_v2/2026-11-02.json',
        ])

    def test_rejects_payload_outside_round_directory(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), 'reports/2026-11-02.json'],
            cwd=self.root,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
