"""Offline checks for the shared, localized lounge homes and public scene archive."""
from datetime import datetime
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
LANGS=['ko','en','zh','ja']
SLUGS={'lounge':'','game':'blind','domestic':'domestic','desk':'desk',
       'analysis':'analysis','chain':'onchain','macro':'calendar','chars':'strategists'}

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.local=[]; self.tabs={}; self.languages={}
        self.canonical=[]; self.robots=[]; self.alternates={}; self.html_lang=None
        self.entry=None; self.live_root=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='html': self.html_lang=a.get('lang'); self.live_root=a.get('data-live-tools-root')
        if tag=='body': self.entry=a.get('data-entry-tab')
        if 'id' in a: self.ids.append(a['id'])
        if tag=='link' and a.get('rel')=='canonical': self.canonical.append(a['href'])
        if tag=='link' and a.get('rel')=='alternate' and a.get('hreflang'):
            self.alternates[a['hreflang']]=a.get('href')
        if tag=='meta' and a.get('name')=='robots': self.robots.append(a['content'])
        if tag in {'script','link'}:
            value=a.get('src') or a.get('href','')
            if value.startswith('/') and not value.startswith('//'): self.local.append(value.split('?')[0])
        if a.get('data-tab'):
            assert tag=='a','Navigation must remain real links'
            self.tabs[a['data-tab']]=a
        if a.get('data-language'): self.languages[a['data-language']]=a.get('href')

routes={
  'ko': {key:('/'+slug.rstrip('/')+'/' if slug else '/') for key,slug in SLUGS.items()},
  **{lang:{key:(f'/{lang}/tools/{slug}/' if slug else f'/{lang}/')
             for key,slug in SLUGS.items()}
     for lang in ['en','zh','ja']}
}
required_ids={'loungeRotation','sessionPanel','raceRows','loungeChart','paperPanel','chatPanel','rainWrap','bookPanel'}
language_targets={'ko':'/','en':'/en/','zh':'/zh/','ja':'/ja/'}

for lang in LANGS:
    path=ROOT/('index.html' if lang=='ko' else f'{lang}/index.html')
    text=path.read_text(encoding='utf-8'); page=Page(); page.feed(text)
    canonical='https://tapelounge.com'+language_targets[lang]
    assert len(page.ids)==len(set(page.ids)),f'Duplicate ID: {path}'
    assert all((ROOT/ref.lstrip('/')).exists() for ref in page.local if not ref.endswith('/')),path
    assert page.html_lang==lang,(path,page.html_lang)
    assert page.entry=='lounge',(path,page.entry)
    assert page.canonical==[canonical],(path,page.canonical)
    assert page.robots and page.robots[0].startswith('index,follow'),(path,page.robots)
    assert set(page.tabs)==set(routes[lang]),(path,set(page.tabs))
    assert {k:a['href'] for k,a in page.tabs.items()}==routes[lang],path
    assert [k for k,a in page.tabs.items() if a.get('aria-selected')=='true']==['lounge'],path
    assert required_ids.issubset(set(page.ids)),(path,required_ids-set(page.ids))
    assert set(page.alternates)==set(LANGS+['x-default']),(path,page.alternates)
    assert page.languages==language_targets,(path,page.languages)
    assert 'Prototype v0.5' not in text,path
    if lang=='ko':
        assert '/home-language.js?v=' in text
    else:
        assert page.live_root==f'/{lang}/tools',(path,page.live_root)
        assert '/live-home-locale.js?v=' in text
    assert canonical in {n.text for n in ET.parse(ROOT/'sitemap.xml').findall('.//{*}loc')},path

for lang in LANGS:
    ET.parse(ROOT/lang/'feed.xml')
ET.parse(ROOT/'sitemap.xml')
locale_js=(ROOT/'live-home-locale.js').read_text(encoding='utf-8')
footer='본 사이트는 정보 제공 목적이며 투자 권유가 아닙니다. 모든 투자 판단과 책임은 이용자 본인에게 있습니다. · 데이터: Binance, Bithumb, Frankfurter, mempool.space, BLS, BEA, Federal Reserve, alternative.me, CoinGecko (실시간, 지연 가능) · TAPE LOUNGE · CRYPTO LOUNGE · EST. 2026'
assert footer in locale_js,'Localized footer must match the current shared-home source'
config=json.loads((ROOT/'data/stage-config.json').read_text(encoding='utf-8'))
assert config['key'].startswith('sb_publishable_')
assert 'service_role' not in json.dumps(config)
assert set(config['words'])==set(LANGS)
assert len({tuple(x.keys()) for x in config['words'].values()})==1
manifest=json.loads((ROOT/'data/scenes.json').read_text(encoding='utf-8'))
count=0
for path in (ROOT/'data/scenes').glob('*.json'):
    s=json.loads(path.read_text(encoding='utf-8')); count+=1
    assert s['id']==path.stem==sha256(s['event']['event_key'].encode()).hexdigest()[:16]
    assert re.fullmatch('[A-Z0-9]{1,24}USDT',s['symbol'])
    stamp=int(datetime.fromisoformat(s['eventAt']).timestamp()*1000)
    archived=int(datetime.fromisoformat(s['archivedAt']).timestamp()*1000)
    bars=s['candles']; past=[b for b in bars if b[6]<=stamp]
    assert past and s['reference']==past[-1][4]
    assert all(b[6]<archived and b[0]<b[6] and b[2]>=max(b[1],b[4]) and b[3]<=min(b[1],b[4]) for b in bars)
    assert all(b[0]-a[0]==60000 for a,b in zip(bars,bars[1:]))
    if s['complete']: assert bars[-1][6]>=stamp//60000*60000+31*60000-1001
    assert all('user_id' not in row for row in s['context'])
assert all((ROOT/f'data/scenes/{s["id"]}.json').exists() for s in manifest['scenes'])
daily=manifest['daily']['id']
if daily:
    s=json.loads((ROOT/f'data/scenes/{daily}.json').read_text(encoding='utf-8'))
    assert s['complete'] and s['symbol']=='BTCUSDT'
print(json.dumps({'localizedHomes':len(LANGS),'sceneFiles':count,'dailyScene':daily,'checks':'passed'}))
