"""Create small, immutable US-stock payloads for shared daily blind rounds."""
from datetime import date, datetime, timedelta
from hashlib import sha256
import json
from pathlib import Path
from zoneinfo import ZoneInfo

STOCK_POOL = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','AVGO','TSLA',
              'JPM','V','MA','COST','NFLX','XOM','WMT','AMD']
TOTAL = 1000
LAUNCH = date(2026, 11, 2)
EARLIEST_END = date(2024, 1, 1)
LATEST_END = date(2025, 12, 31)
EARLIEST_PLAY = date(2020, 1, 1)


def _make_payload(day: date, stock_data: dict) -> dict:
    day_text = day.isoformat()
    selected = int.from_bytes(sha256(f'tape-stock-v2:symbol:{day_text}'.encode()).digest()[:4], 'big') % len(STOCK_POOL)
    order = STOCK_POOL[selected:] + STOCK_POOL[:selected]
    for symbol in order:
        rows = stock_data.get(symbol)
        if not isinstance(rows, list) or len(rows) < TOTAL:
            continue
        eligible = []
        for index, row in enumerate(rows):
            if not isinstance(row, list) or len(row) < 6:
                continue
            try:
                stamp = int(row[0])
                bar_day = datetime.fromtimestamp(stamp / 1000, tz=ZoneInfo('UTC')).date()
                if (index >= TOTAL - 1 and EARLIEST_END <= bar_day <= LATEST_END
                        and datetime.fromtimestamp(int(rows[index - 200][0]) / 1000, tz=ZoneInfo('UTC')).date() >= EARLIEST_PLAY):
                    eligible.append(index)
            except (IndexError, TypeError, ValueError, OverflowError):
                continue
        if not eligible:
            continue
        digest = sha256(f'tape-stock-v2:end:{day_text}'.encode()).digest()
        end_index = eligible[int.from_bytes(digest[:8], 'big') % len(eligible)]
        bars = [[int(row[0]), *[float(value) for value in row[1:6]]] for row in rows[end_index - TOTAL + 1:end_index + 1]]
        if len(bars) != TOTAL:
            continue
        return {
            'schema': 1,
            'version': 2,
            'day': day_text,
            'market': 'stock',
            'symbol': symbol,
            'endDate': datetime.fromtimestamp(bars[-1][0] / 1000, tz=ZoneInfo('UTC')).date().isoformat(),
            'bars': bars,
        }
    raise ValueError(f'No valid 1,000-bar US-stock round available for {day_text}')


def ensure_rounds(root: Path) -> bool:
    """Prepare today and the next two KST dates without changing old rounds."""
    source = root / 'reports' / 'stocks.json'
    if not source.is_file():
        raise FileNotFoundError(f'Missing stock history bundle: {source}')
    stock_data = json.loads(source.read_text(encoding='utf-8'))
    if not isinstance(stock_data, dict):
        raise ValueError('US-stock history bundle must be a symbol-to-bars object')
    today = datetime.now(ZoneInfo('Asia/Seoul')).date()
    target_dir = root / 'reports' / 'blind_daily_stock_v2'
    changed = False
    for offset in range(3):
        day = today + timedelta(days=offset)
        if day < LAUNCH:
            continue
        target = target_dir / f'{day.isoformat()}.json'
        if target.exists():
            continue
        target_dir.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(_make_payload(day, stock_data), separators=(',', ':')) + '\n'
        temporary = target.with_suffix('.json.tmp')
        temporary.write_text(payload, encoding='utf-8', newline='\n')
        temporary.replace(target)
        changed = True
    return changed
