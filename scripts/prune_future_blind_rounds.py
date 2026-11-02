#!/usr/bin/env python3
"""Keep future blind-round answers out of the published repository."""
from datetime import date
from pathlib import Path
import subprocess
import sys

ROUND_DIR = Path('reports/blind_daily_stock_v2')


def tracked(path: Path) -> bool:
    return subprocess.run(
        ['git', 'ls-files', '--error-unmatch', '--', path.as_posix()],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    ).returncode == 0


def prune(today_path: str) -> None:
    expected_prefix = f'{ROUND_DIR.as_posix()}/'
    if not today_path.startswith(expected_prefix) or not today_path.endswith('.json'):
        raise ValueError('Expected today’s report path under reports/blind_daily_stock_v2')
    today_text = today_path[len(expected_prefix):-5]
    today = date.fromisoformat(today_text)
    if today.isoformat() != today_text:
        raise ValueError('Today’s report filename must use YYYY-MM-DD')

    for path in ROUND_DIR.glob('*.json'):
        try:
            candidate_day = date.fromisoformat(path.stem)
        except ValueError:
            continue
        rel = path.as_posix()
        if rel == today_path:
            continue
        if candidate_day > today:
            if tracked(path):
                subprocess.run(['git', 'rm', '-q', '--', rel], check=True)
            else:
                path.unlink()
        elif not tracked(path):
            path.unlink()


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: prune_future_blind_rounds.py reports/blind_daily_stock_v2/YYYY-MM-DD.json')
    try:
        prune(sys.argv[1])
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print(f'Could not prune daily round payloads: {exc}', file=sys.stderr)
        raise SystemExit(1)
