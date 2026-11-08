"""Create compact US-stock shards and immutable shared daily blind rounds."""
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


def _write_if_changed(path: Path, payload: bytes) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.read_bytes() == payload:
        return False
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_bytes(payload)
    temporary.replace(path)
    return True


def ensure_stock_shards(root: Path, stock_data: dict) -> bool:
    """Publish one compact file per eligible symbol plus a small lookup index."""
    target_dir = root / 'reports' / 'stocks-v1'
    symbols = sorted(
        symbol for symbol, rows in stock_data.items()
        if isinstance(symbol, str) and isinstance(rows, list) and len(rows) >= TOTAL
    )
    if not symbols:
        raise ValueError('No US-stock history has enough bars for a blind round')

    entries = []
    changed = False
    for symbol in symbols:
        filename = sha256(symbol.encode('utf-8')).hexdigest()[:16] + '.json'
        payload = json.dumps(stock_data[symbol], separators=(',', ':'), allow_nan=False).encode('utf-8') + b'\n'
        changed = _write_if_changed(target_dir / filename, payload) or changed
        entries.append({'symbol': symbol, 'file': filename})

    index = json.dumps(
        {'schema': 1, 'symbols': entries},
        ensure_ascii=False,
        separators=(',', ':'),
        sort_keys=True,
    ).encode('utf-8') + b'\n'
    return _write_if_changed(target_dir / 'index.json', index) or changed


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
    source_bytes = source.read_bytes()
    stock_data = json.loads(source_bytes)
    if not isinstance(stock_data, dict):
        raise ValueError('US-stock history bundle must be a symbol-to-bars object')
    changed = ensure_stock_shards(root, stock_data)
    today = datetime.now(ZoneInfo('Asia/Seoul')).date()
    target_dir = root / 'reports' / 'blind_daily_stock_v2'
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
