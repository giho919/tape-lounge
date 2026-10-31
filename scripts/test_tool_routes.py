"""Validate generated tool entry pages without external data or credentials."""
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ROUTES = {'lounge': '/', 'domestic': '/domestic/', 'desk': '/desk/',
          'analysis': '/analysis/', 'chain': '/onchain/', 'macro': '/calendar/',
          'game': '/blind/', 'chars': '/strategists/'}

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.tabs={}; self.panels={}; self.canonicals=[]
        self.robots=[]; self.entry=None; self.redirects=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='body': self.entry=a.get('data-entry-tab')
        if tag=='link' and a.get('rel')=='canonical': self.canonicals.append(a['href'])
        if tag=='meta' and a.get('name')=='robots': self.robots.append(a['content'])
        if tag=='meta' and a.get('http-equiv','').lower()=='refresh': self.redirects.append(a)
        if a.get('data-tab'):
            assert tag=='a', 'Navigation must be a real link'
            self.tabs[a['data-tab']]=a
        if a.get('id','').startswith('tab-'): self.panels[a['id'][4:]]=a

sitemap=ET.parse(ROOT/'sitemap.xml')
listed={n.text for n in sitemap.findall('.//{*}loc')}
for tab, route in ROUTES.items():
    source=(ROOT/route.strip('/')/'index.html').read_text(encoding='utf-8')
    page=Page(); page.feed(source)
    assert page.entry==tab, (route, page.entry)
    assert page.canonicals==['https://tapelounge.com'+route], route
    assert page.robots==['index,follow'], route
    assert not page.redirects and 'location.replace(' not in source, route
    assert len(page.tabs)==8, route
    assert {k:a['href'] for k,a in page.tabs.items()}==ROUTES, route
    assert [k for k,a in page.tabs.items() if a['aria-selected']=='true']==[tab], route
    assert [k for k,a in page.panels.items() if 'hidden' not in a.get('class','').split()]==[tab], route
    assert 'https://tapelounge.com'+route in listed, route
    assert '<base href="/">' in source, route

assert 'https://tapelounge.com/classic-home.html' not in listed
assert 'https://tapelounge.com/terminal/' not in listed
assert '<meta name="robots" content="noindex,follow">' in (ROOT/'classic-home.html').read_text(encoding='utf-8')
print('8 tool routes: real links, selected content, canonical, robots and sitemap passed')
