"""Archive PUBLIC market events and public spot candles. No privileged keys or writes to DB.

Explicit --collect only. This does not import trading code, make orders, run models,
publish messages, or copy chat/user/account records. Existing complete scenes stay fixed.
"""
import argparse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import math
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
FIELDS='event_key,event_type,event_time,symbol,side,price,amount_usd,title,detail,tone,metadata'
KINDS={'breakout','breakdown','liquidation','jackpot','whale','candle'}

def get(url, headers=None):
    with urlopen(Request(url,headers={'User-Agent':'TapeLounge-PublicSceneArchive/1.0',**(headers or {})}),timeout=15) as response:
        return json.load(response)

def write(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n'
    if path.exists() and path.read_text(encoding='utf-8')==text:return
    temporary=path.with_suffix('.json.tmp');temporary.write_text(text,encoding='utf-8');temporary.replace(path)

def stamp(value):
    return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(timezone.utc)

def scene_id(key):
    return sha256(key.encode()).hexdigest()[:16]

def finite(value):
    try:return float(value) if math.isfinite(float(value)) else None
    except (ValueError,TypeError):return None

def summary(scene):
    return {k:scene[k] for k in ['id','event','symbol','eventAt','archivedAt','complete','reference','source']}

def collect():
    # Read only constants already published in the old frontend, never a server env/config.
    source=(ROOT/'terminal/index.html').read_text(encoding='utf-8')
    base=re.search(r"const SUPA_URL = '([^']+)'",source)[1]
    key=re.search(r"const SUPA_KEY = '([^']+)'",source)[1]
    if not key.startswith('sb_publishable_'):raise ValueError('Expected public frontend key')
    now=datetime.now(timezone.utc); millis=int(now.timestamp()*1000)
    query=urlencode({'select':FIELDS,'is_highlight':'eq.true','event_time':'gte.'+(now-timedelta(hours=47)).isoformat(),'order':'event_time.desc','limit':'500'})
    rows=get(base+'/rest/v1/market_events?'+query,{'apikey':key})
    if not isinstance(rows,list):raise ValueError('Public event response is not a list')
    index_path=ROOT/'data/scenes.json'
    old=json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {'scenes':[]}
    known={s['id']:s for s in old['scenes']}
    ready=[]
    for row in rows:
        if row.get('event_type') not in KINDS or not isinstance(row.get('event_key'),str):continue
        at=stamp(row['event_time']); age=(now-at).total_seconds()
        if age<180:continue
        sid=scene_id(row['event_key']);path=ROOT/f'data/scenes/{sid}.json'
        if path.exists():
            cached=json.loads(path.read_text(encoding='utf-8'))
            if cached.get('complete'):
                known[sid]=summary(cached);continue
        ready.append((row,at,sid,path))
    # Bound long-term static archive growth and avoid preserving dozens of near-duplicate
    # liquidation minutes. Selection depends on category/time, never subsequent returns.
    def bucket(event):
        kind=event['event_type']
        category='price' if kind in {'breakout','breakdown'} else 'liquidation' if kind in {'liquidation','jackpot'} else kind
        return (event['event_time'][:13],category)
    quotas={'price':3,'liquidation':3,'whale':2,'candle':1}
    counts={}
    for item in known.values():
        slot=bucket(item['event']);counts[slot]=counts.get(slot,0)+1
    selected=[]
    for item in ready:
        row,_,_,path=item;slot=bucket(row)
        if not path.exists():
            if counts.get(slot,0)>=quotas.get(slot[1],0):continue
            counts[slot]=counts.get(slot,0)+1
        selected.append(item)
    # Recent records first; hour-by-hour runs fill the public window without a burst.
    archived=0;failures=0
    for row,at,sid,path in selected[:100]:
        try:
            raw_symbol=row.get('symbol') or 'BTCUSDT'
            symbol=raw_symbol if re.fullmatch(r'[A-Z0-9]{1,24}USDT',raw_symbol) else 'BTCUSDT'
            start=int(at.timestamp()//60*60000)-20*60000;end=start+51*60000-1
            klines=get('https://data-api.binance.vision/api/v3/klines?'+urlencode({'symbol':symbol,'interval':'1m','startTime':start,'endTime':min(end,millis),'limit':60}))
            if not isinstance(klines,list):raise ValueError('No public candles')
            bars=[]
            for k in klines:
                values=[finite(k[i]) for i in [1,2,3,4,5]]
                if all(v is not None for v in values) and min(values[:4])>0 and int(k[6])<millis:
                    bars.append([int(k[0]),*values,int(k[6])])
            if len(bars)<15:raise ValueError('Too few closed candles')
            cutoff=int(at.timestamp()*1000)
            past=[b for b in bars if b[6]<=cutoff]
            if not past:raise ValueError('Missing pre-event reference')
            # Price replay uses a documented closed SPOT candle reference, not ALL-market liq price.
            reference=past[-1][4]
            meta=row.get('metadata') or {}
            event={k:row.get(k) for k in ['event_key','event_type','event_time','symbol','side','price','amount_usd','title','detail','tone']}
            event['metadata']={k:meta[k] for k in ['count','long_usd','short_usd','range_low','range_high','final'] if k in meta}
            context=[{k:r.get(k) for k in ['event_key','event_type','event_time','symbol','side','price','amount_usd','title','detail','tone']} for r in rows if abs((stamp(r['event_time'])-at).total_seconds())<=15*60]
            scene={'schema':1,'id':sid,'event':event,'symbol':symbol,'eventAt':at.isoformat(),'archivedAt':now.isoformat(),'complete':bars[-1][6]>=end-1000,'reference':reference,'candles':bars,'context':context[:40], 'source':{'events':'Supabase public market_events','candles':'Binance spot / api/v3/klines / 1m','scope':'ALL-market events are shown against a BTC spot reference, not attributed exclusively to BTC.'}}
            write(path,scene);known[sid]=summary(scene);archived+=1
            time.sleep(.08)
        except Exception as error:
            failures+=1
            print(f'Could not archive {sid}: {type(error).__name__}',file=sys.stderr)
    ordered=sorted(known.values(),key=lambda x:x['eventAt'],reverse=True)[:180]
    # The daily case is picked by chronology, never by which future return looks impressive.
    yesterday=(now-timedelta(days=1)).date().isoformat()
    eligible=sorted([s for s in ordered if s['complete'] and s['symbol']=='BTCUSDT' and s['eventAt'][:10]==yesterday and s['event']['event_type'] in {'breakout','breakdown'}],key=lambda s:s['eventAt'])
    daily=eligible[0]['id'] if eligible else None
    previous=old.get('daily',{})
    if previous.get('date')==now.date().isoformat() and previous.get('id') and (ROOT/f"data/scenes/{previous['id']}.json").exists():
        daily=previous['id']  # Freeze the case for the UTC day, even when the filmstrip rolls.
    write(index_path,{'schema':1,'fetchedAt':now.isoformat(),'scenes':ordered,'daily':{'date':now.date().isoformat(),'id':daily,'rule':'First archived BTC price breakout on the previous UTC day, with complete follow-up. Not selected by outcome.'},'coverage':{'fromAt':ordered[-1]['eventAt'] if ordered else None,'toAt':ordered[0]['eventAt'] if ordered else None},'method':'As-recorded public events with closed Binance spot candles. Price replay is not a reconstruction of historical tick-by-tick order flow or causation. Individual archived scene files remain at data/scenes/<id>.json.'})
    return {'archived':archived,'failed':failures,'listed':len(ordered),'daily':daily,'fetchedAt':now.isoformat()}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--collect',action='store_true');opt=parser.parse_args()
    if not opt.collect:parser.error('Pass --collect to read public APIs and archive public scenes')
    print(json.dumps(collect()))
