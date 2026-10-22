"""Offline contract checks; never accesses accounts, DB, auth or network."""
from datetime import datetime
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.local=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag in {'script','link'}:
            value=a.get('src') or a.get('href','')
            if value.startswith('/') and not value.startswith('//'):self.local.append(value.split('?')[0])

pages=[ROOT/'index.html',*(ROOT/lang/'index.html' for lang in ['ko','en','zh','ja'])]
for path in pages:
    text=path.read_text(encoding='utf-8');page=Page();page.feed(text)
    assert len(page.ids)==len(set(page.ids)),f'Duplicate ID: {path}'
    assert all((ROOT/ref.lstrip('/')).exists() for ref in page.local if not ref.endswith('/')),path
    assert 'stage.js?v=' in text and 'stage-community.js?v=' in text
    assert all(x in page.ids for x in ['stage-chart','stage-case','stage-chat-form','stage-note-form'])
    assert 'hreflang="ja"' in text and 'rel="canonical"' in text
for lang in ['ko','en','zh','ja']:
    ET.parse(ROOT/lang/'feed.xml')
ET.parse(ROOT/'sitemap.xml')
config=json.loads((ROOT/'data/stage-config.json').read_text(encoding='utf-8'))
assert config['key'].startswith('sb_publishable_')
assert 'service_role' not in json.dumps(config)
assert set(config['words'])=={'ko','en','zh','ja'}
assert len({tuple(x.keys()) for x in config['words'].values()})==1
manifest=json.loads((ROOT/'data/scenes.json').read_text(encoding='utf-8'))
count=0
for path in (ROOT/'data/scenes').glob('*.json'):
    s=json.loads(path.read_text(encoding='utf-8'));count+=1
    assert s['id']==path.stem==sha256(s['event']['event_key'].encode()).hexdigest()[:16]
    assert re.fullmatch('[A-Z0-9]{1,24}USDT',s['symbol'])
    stamp=int(datetime.fromisoformat(s['eventAt']).timestamp()*1000)
    archived=int(datetime.fromisoformat(s['archivedAt']).timestamp()*1000)
    bars=s['candles'];past=[b for b in bars if b[6]<=stamp]
    assert past and s['reference']==past[-1][4]
    assert all(b[6]<archived and b[0]<b[6] and b[2]>=max(b[1],b[4]) and b[3]<=min(b[1],b[4]) for b in bars)
    assert all(b[0]-a[0]==60000 for a,b in zip(bars,bars[1:]))
    if s['complete']:assert bars[-1][6]>=stamp//60000*60000+31*60000-1001
    assert all('user_id' not in row for row in s['context'])
assert all((ROOT/f'data/scenes/{s["id"]}.json').exists() for s in manifest['scenes'])
daily=manifest['daily']['id']
if daily:
    s=json.loads((ROOT/f'data/scenes/{daily}.json').read_text(encoding='utf-8'))
    assert s['complete'] and s['symbol']=='BTCUSDT'
print(json.dumps({'pages':len(pages),'scenes':count,'daily':daily,'checks':'passed'}))
