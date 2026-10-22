"""Build crawlable, localized public pages using published data only. No network."""
from datetime import datetime, timezone
from email.utils import format_datetime
from hashlib import sha256
from html import escape as e
import json
from pathlib import Path
import sys
from xml.etree.ElementTree import Element, SubElement, tostring
from discovery_content import COPY, LANGS, STAGES

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://tapelounge.com'
VERSION = '20261022-discovery1'
SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'LINK']
NAMES = ['Bitcoin', 'Ethereum', 'Solana', 'XRP', 'BNB', 'Dogecoin', 'Cardano', 'Chainlink']

def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

def write(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_text(encoding='utf-8') == text:
        return
    temporary = target.with_suffix(target.suffix + '.tmp')
    temporary.write_text(text, encoding='utf-8', newline='\n')
    temporary.replace(target)

def url(lang, page=''):
    return f'/{lang}/' + (page.rstrip('/') + '/' if page else '')

def stage(value, lang):
    return STAGES.get(value, [value]*4)[list(LANGS).index(lang)]

def link(href, label, cls=''):
    return f'<a class="{cls}" href="{e(href, quote=True)}">{e(label)}</a>'

def section_head(title, more='', href=''):
    return f'<header class="section-head"><h2>{e(title)}</h2>{link(href, more+" ↗") if href else ""}</header>'

def radar_rows(data, lang, limit=None):
    c=COPY[lang]
    selected=data['candidates'][:limit] if limit else data['candidates']
    rows=[]
    for item in selected:
        s=item['symbol']; tag=stage(item['stage'], lang)
        dist=item.get('distancePct')
        rows.append(f'<article class="radar-row" id="observation-{item["timeframe"]}-{s}" data-symbol="{s}" data-stage="{e(item["stage"])}" data-tf="{item["timeframe"]}">'
            f'<button class="star" data-star="{s}" aria-label="{s} · {e(c["save"])}" aria-pressed="false">☆</button>'
            f'<div class="radar-name"><a href="{url(lang,"watch")}?q={s}">{s}</a><small>{e(c["fourHour"] if item["timeframe"]=="4h" else c["daily"])}</small></div>'
            f'<span class="stage stage-{list(STAGES).index(item["stage"]) if item["stage"] in STAGES else 0}">{e(tag)}</span>'
            f'<span class="radar-distance">{e(c["distance"])}<b>{f"{dist:.1f}%" if isinstance(dist,(int,float)) else "—"}</b></span>'
            f'<details class="observation-detail"><summary>{e(c["timeline"])}</summary><p>{e(c["first"])}: <time datetime="{item["firstSeenAt"]}">{item["firstSeenAt"][:10]}</time></p><ol>'+''.join(f'<li><time datetime="{ev["at"]}">{ev["at"][:10]}</time> · {e(stage(ev["stage"],lang))}</li>' for ev in item['timeline'])+'</ol></details></article>')
    return ''.join(rows)

def guide_cards(lang):
    c=COPY[lang]
    return '<div class="reading-grid">'+''.join(f'<article class="reading-card"><span class="reading-no">0{i+1} / FIELD NOTES</span><h3>{link(url(lang,"learn/"+g[0]),g[1])}</h3><p>{e(g[2])}</p>{link(url(lang,"learn/"+g[0]),c["read"]+" ↗")}</article>' for i,g in enumerate(c['guides']))+'</div>'

def market_table(lang, home=False):
    c=COPY[lang]
    rows=''.join(f'<tr data-market-symbol="{s}"><td><button class="star" data-star="{s}" aria-label="{s} · {e(c["save"])}" aria-pressed="false">☆</button><a href="{url(lang,"watch")}?q={s}">{s}</a><small>{n}</small></td><td data-price>—</td><td data-change>—</td><td data-premium>—</td><td data-volume>—</td></tr>' for s,n in zip(SYMBOLS[:5 if home else 8],NAMES))
    return f'<div class="table-wrap"><table class="market-table"><caption class="sr-only">{e(c["market"])}</caption><thead><tr>'+''.join(f'<th scope="col">{e(c[k])}</th>' for k in ['asset','price','change','premium','volume'])+f'</tr></thead><tbody id="market-rows">{rows}</tbody></table></div><p class="data-note" id="quote-status" role="status">{e(c["snapshot"])}</p>'

def reports(lang):
    c=COPY[lang]
    return '<div class="reports-grid">'+''.join(f'<article class="report-card"><span class="role-label">0{i+1} / AI PERSPECTIVE</span><h3>{e(c["roles"][i])}</h3><p>{e(c["roleCopy"][i])}</p><p class="report-kpi" data-report-kpi="{role}"></p><time data-report-time="{role}"></time>{link("/reports/"+name,c["original"]+" ↗")}</article>' for i,(role,name) in enumerate([('madam','madam_daily.html'),('andy','andy_scan.html'),('justin','justin_lab.html')]))+'</div>'

def render(lang, page, data, letters, generated, root=False):
    c=COPY[lang]; titles={'':c['headline'].replace('\n',' '),'markets':c['market'],'watch':c['radar'],'research':c['research'],'learn':c['learn'],'about':c['about']}
    guide=next((g for g in c['guides'] if page=='learn/'+g[0]),None)
    title=guide[1] if guide else titles[page]
    desc=guide[2] if guide else c.get({'':'intro','markets':'marketIntro','watch':'radarIntro','research':'researchIntro','learn':'learnIntro','about':'aboutText'}[page])
    current=BASE+url(lang,page)
    nav=''.join(link(url(lang,p),c['nav'][i], 'selected' if page==p or (p=='learn' and guide) else '') for i,p in enumerate(['','markets','watch','learn']))
    languages=''.join(f'<a href="{url(l,page)}" lang="{l}" hreflang="{l}" data-language="{l}" '+('aria-current="true"' if l==lang else '')+f'>{label}</a>' for l,label in LANGS.items())
    alts=''.join(f'<link rel="alternate" hreflang="{l}" href="{BASE+url(l,page)}">' for l in LANGS)+f'<link rel="alternate" hreflang="x-default" href="{BASE+url("ko",page)}">'
    schema=[{'@context':'https://schema.org','@type':'WebSite','name':'Tape Lounge','url':BASE+'/'}, {'@context':'https://schema.org','@type':'WebPage','name':title,'description':desc,'url':current,'inLanguage':lang,'isPartOf':{'@type':'WebSite','url':BASE+'/'}}]
    if guide:
        schema.append({'@context':'https://schema.org','@type':'Article','headline':title,'description':desc,'inLanguage':lang,'datePublished':'2026-10-22','dateModified':'2026-10-22','author':{'@type':'Organization','name':'Tape Lounge','url':BASE+'/ko/about/'},'mainEntityOfPage':current})
    stamp=f'<span class="report-stamp">{e(c["report"])} <time datetime="{data["reportAt"]}">{data["reportAt"][:16]} UTC</time></span>'
    filters=f'<div class="filter-row" role="group" aria-label="{e(c["radar"])}">'+''.join(f'<button data-filter="{value}" aria-pressed="{"true" if value=="all" else "false"}">{e(c[key])}</button>' for value,key in [('all','allStages'),('지지 확인','confirmed'),('눌림 대기','waiting'),('1d','daily'),('saved','saved'),('archive','archive')])+'</div>'
    pulse=f'<section class="pulse"><header><span class="eyebrow">01 / {e(c["chart"])}</span><div class="chart-assets">'+''.join(f'<button data-chart-symbol="{s}" aria-pressed="{"true" if s=="BTC" else "false"}">{s}</button>' for s in SYMBOLS[:4])+f'</div></header><div class="pulse-price"><strong id="pulse-price">—</strong><span id="pulse-change"></span></div><div id="pulse-chart" role="img" aria-label="{e(c["chart"])}"><p>{e(c["loading"])}</p></div><div class="pulse-bottom"><div class="chart-ranges">'+''.join(f'<button data-range="{r}" aria-pressed="{"true" if r=="7d" else "false"}">{r.upper()}</button>' for r in ['1d','7d','30d'])+f'</div>{link("/terminal/#desk",c["openChart"]+" ↗")}</div><p class="data-note" id="chart-status">{e(c["chartNote"])}</p></section>'
    sidebar=f'<aside class="briefing"><span class="eyebrow">THE READING ROOM</span><h2>{e(c["research"])}</h2>'+''.join(f'<a class="brief-row" href="{url(lang,"research")}"><span>0{i+1}</span><div><b>{e(c["roles"][i])}</b><p>{e(c["roleCopy"][i])}</p></div><span>↗</span></a>' for i in range(3))+'</aside>'
    if page=='':
        body=f'<section class="opening"><div><p class="eyebrow">THE MARKET, WITHOUT THE NOISE.</p><h1>{e(c["headline"]).replace(chr(10),"<br>")}</h1></div><div class="opening-aside"><p>{e(c["intro"])}</p>{link(url(lang,"markets"),c["market"]+" ↗","text-link")}</div></section><div class="lead-grid">{pulse}{sidebar}</div>'
        body+=f'<section class="return-band"><span>↳</span><div><h2>{e(c["returnTitle"])}</h2><p id="return-copy">{e(c["returnEmpty"])}</p></div>{link(url(lang,"watch")+"?saved=1",c["saved"]+" ↗")}</section>'
        body+=f'<section>{section_head(c["market"],c["all"],url(lang,"markets"))}{market_table(lang,True)}<p class="data-note">{link(url(lang,"learn/kimchi-premium"),c["guides"][0][1]+" ↗")}</p></section>'
        body+=f'<div class="lower-grid"><section>{section_head(c["radar"],c["all"],url(lang,"watch"))}{stamp}<div id="radar-rows">{radar_rows(data,lang,6)}</div><p class="data-note">{e(c["radarNote"])}</p></section><aside class="watch-panel"><span class="eyebrow">YOUR CORNER</span><h2>{e(c["save"])}</h2><p>{e(c["watchIntro"])}</p><div id="saved-rows"></div>{link(url(lang,"watch"),c["all"]+" ↗")}</aside></div>'
        body+=f'<section class="session-section">{section_head(c["session"])}<div class="session-grid" id="session-rows"><p>{e(c["loading"])}</p></div><p class="data-note">{e(c["sessionNote"])}</p></section><section>{section_head(c["learn"],c["all"],url(lang,"learn"))}{guide_cards(lang)}</section>'
    elif page=='markets':
        body=f'<div class="page-opening"><p class="eyebrow">MARKET INDEX</p><h1>{e(title)}</h1><p>{e(desc)}</p></div><div class="market-controls"><label>{e(c["find"])}<input id="market-search" type="search" placeholder="BTC, ETH…"></label><div class="filter-row"><button id="market-saved" aria-pressed="false">☆ {e(c["saved"])}</button><select id="market-sort" aria-label="{e(c["volume"])}"><option value="volume">{e(c["volume"])}</option><option value="change">{e(c["change"])}</option><option value="premium">{e(c["premium"])}</option></select></div></div>{market_table(lang)}<button id="market-more" hidden>{e(c["all"])}</button><div class="method-inline"><p>{e(c["fxNote"])}</p><p id="fx-status">{e(c["fxDate"])}: —</p>{link(url(lang,"learn/kimchi-premium"),c["guides"][0][1]+" ↗")}</div>'
    elif page=='watch':
        body=f'<div class="page-opening"><p class="eyebrow">THE OBSERVATION DESK</p><h1>{e(title)}</h1><p>{e(desc)}</p></div><div id="watch-asset" hidden><h2 id="watch-asset-title"></h2>{pulse}</div><div class="radar-toolbar"><label>{e(c["find"])}<input type="search" id="radar-search" placeholder="BTC, ETH…"></label>{stamp}</div>{filters}<div id="radar-rows">{radar_rows(data,lang)}</div><p id="radar-empty" hidden>{e(c["empty"])}</p><p class="method-inline">{e(c["radarNote"])}</p>{link("/reports/andy_scan.html",c["original"]+" ↗")}<section>{section_head(c["next"])}{guide_cards(lang)}</section>'
    elif page=='research':
        body=f'<div class="page-opening"><p class="eyebrow">RESEARCH ROOM / AI PERSONAS</p><h1>{e(title)}</h1><p>{e(desc)}</p></div>{reports(lang)}<section>{section_head(c["next"])}<div class="tool-links">{link(url(lang,"watch"),c["radar"]+" ↗")}{link("/terminal/#onchain","On-chain ↗")}{link("/terminal/#calendar","Calendar ↗")}{link("/terminal/#analysis","BTC channels ↗")}</div></section>'
    elif guide:
        body=f'<article class="guide"><nav class="breadcrumbs">{link(url(lang,"learn"),c["nav"][3])} / FIELD NOTES</nav><p class="eyebrow">TAPE LOUNGE / EDITORIAL</p><h1>{e(title)}</h1><p class="standfirst">{e(desc)}</p><p class="byline">Tape Lounge · <time datetime="2026-10-22">2026-10-22</time></p>'+''.join(f'<section><span class="paragraph-number">0{i+1}</span><p>{e(p)}</p></section>' for i,p in enumerate(guide[3]))+f'<aside class="article-end">{e(c["disclaimer"])}<p>{link(url(lang,"about"),c["method"]+" ↗")}</p></aside></article><section>{section_head(c["next"])}{guide_cards(lang)}</section>'
    elif page=='learn':
        body=f'<div class="page-opening"><p class="eyebrow">FIELD NOTES</p><h1>{e(title)}</h1><p>{e(desc)}</p></div>{guide_cards(lang)}<section class="learn-callout"><h2>{e(c["radar"])}</h2><p>{e(c["radarIntro"])}</p>{link(url(lang,"watch"),c["all"]+" ↗")}</section>'
    else:
        body=f'<article class="guide"><p class="eyebrow">THE COLOPHON</p><h1>{e(title)}</h1><p class="standfirst">{e(c["aboutText"])}</p><section><h2>{e(c["method"])}</h2><p>{e(c["sourceText"])}</p><p>{e(c["dataText"])}</p><p><a href="https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints" rel="noopener">Binance API</a> · <a href="https://global-docs.upbit.com/reference/list-tickers" rel="noopener">Upbit API</a> · <a href="https://frankfurter.dev/" rel="noopener">Frankfurter</a></p><p><a href="/data/andy-watch.json">Observation JSON</a> · <a href="/data/discovery.json">Public summary JSON</a> · <a href="/{lang}/feed.xml">RSS</a></p></section><section><h2>{e(c["privacy"])}</h2><p>{e(c["analyticsText"])}</p><p>{e(c["countryPrivacy"])}</p></section><section><h2>AI</h2><p>{e(c["researchIntro"])}</p><p>{e(c["disclaimer"])}</p></section></article>'
    schema_json=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')
    return f'''<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} — Tape Lounge</title><meta name="description" content="{e(desc,quote=True)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{current}">{alts}
<meta property="og:type" content="{'article' if guide else 'website'}"><meta property="og:title" content="{e(title,quote=True)} — Tape Lounge"><meta property="og:description" content="{e(desc,quote=True)}"><meta property="og:url" content="{current}"><meta property="og:image" content="{BASE}/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#f5f3ed"><meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https://data-api.binance.vision https://api.upbit.com https://api.frankfurter.dev https://api.country.is https://*.supabase.co; frame-src 'none'">
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/discovery.css?v={VERSION}"><link rel="alternate" type="application/rss+xml" href="/{lang}/feed.xml" title="Tape Lounge"><script type="application/ld+json">{schema_json}</script><script defer src="/discovery.js?v={VERSION}"></script><script defer src="/discovery-analytics.js?v={VERSION}"></script></head>
<body data-page="{page}" data-entry="{'root' if root else 'locale'}"><a class="skip" href="#content">Skip to content</a><div class="edition-bar"><span>{e(c['edition'])}</span><span>INDEPENDENT / CRYPTO / OBSERVATION</span></div>
<header class="masthead"><a class="wordmark" href="{url(lang)}" aria-label="Tape Lounge"><span class="brand-icon">t.</span><span>TAPE<span class="wordmark-light">LOUNGE</span><small>A PLACE TO READ THE MARKET.</small></span></a><nav class="primary-nav" aria-label="Navigation">{nav}</nav><div class="header-actions"><a class="terminal-link" href="/terminal/">{e(c['tools'])} ↗</a><details class="languages"><summary aria-label="Language">◎ {lang.upper()}</summary><div>{languages}</div></details></div></header>
<div id="locale-suggestion" hidden role="status"></div><main id="content"><div class="site-search"><label for="site-search">⌕ <span class="sr-only">{e(c['find'])}</span></label><input id="site-search" type="search" placeholder="{e(c['searchHint'])}" autocomplete="off" aria-controls="search-results"><span class="search-caption">MARKETS / IDEAS / PERSPECTIVES</span><div id="search-results" hidden></div></div>{body}</main>
<footer><div class="footer-top"><a class="footer-brand" href="{url(lang)}">TAPE LOUNGE<span>{e(c['edition'])}</span></a><div>{link(url(lang,'research'),c['research'])}{link(url(lang,'about'),c['method'])}<a href="/{lang}/feed.xml">RSS ↗</a><a href="/data/discovery.json">Open data ↗</a></div></div><p>{e(c['disclaimer'])}</p><div class="footer-bottom"><span>© 2026 Tape Lounge</span><nav aria-label="Languages">{languages}</nav></div></footer></body></html>'''

def build(force=False):
    inputs=['scripts/build_discovery.py','scripts/discovery_content.py','scripts/discovery-analytics.template.js','data/andy-watch.json','reports/letters.json']
    fingerprint=sha256(b''.join((ROOT/p).read_bytes() for p in inputs)).hexdigest()
    target=ROOT/'data/discovery.json'
    if not force and target.exists() and read('data/discovery.json').get('sourceHash')==fingerprint:
        return {'changed':False}
    data=read('data/andy-watch.json'); letters=read('reports/letters.json')
    generated=datetime.now(timezone.utc).isoformat()
    pages=['','markets','watch','research','learn','about']+['learn/'+g[0] for g in COPY['en']['guides']]
    for lang in LANGS:
        for page in pages:
            write(url(lang,page).strip('/')+'/index.html',render(lang,page,data,letters,generated))
        rss=Element('rss',version='2.0'); channel=SubElement(rss,'channel')
        for key,val in [('title','Tape Lounge'),('link',BASE+url(lang)),('description',COPY[lang]['intro']),('language',lang)]:
            SubElement(channel,key).text=val
        item=SubElement(channel,'item')
        for key,val in [('title',COPY[lang]['radar']+' · '+data['reportAt'][:10]),('link',BASE+url(lang,'watch')),('guid',BASE+'/observations/'+data['reportAt']),('description',COPY[lang]['radarNote']),('pubDate',format_datetime(datetime.fromisoformat(data['reportAt'])))]:
            SubElement(item,key).text=val
        for guide in COPY[lang]['guides']:
            item=SubElement(channel,'item')
            for key,val in [('title',guide[1]),('link',BASE+url(lang,'learn/'+guide[0])),('guid',BASE+url(lang,'learn/'+guide[0])),('description',guide[2]),('pubDate','Thu, 22 Oct 2026 00:00:00 +0000')]:
                SubElement(item,key).text=val
        write(lang+'/feed.xml','<?xml version="1.0" encoding="UTF-8"?>\n'+tostring(rss,encoding='unicode'))
    write('index.html',render('ko','',data,letters,generated,True))
    write('data/discovery.json',json.dumps({'schema':1,'sourceHash':fingerprint,'generatedAt':generated,'reportAt':data['reportAt'],'coverage':data['coverage'],'candidates':data['candidates'],'letters':letters,'copy':COPY,'stages':STAGES},ensure_ascii=False,separators=(',',':'))+'\n')
    sitemap=Element('urlset',xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for lang in LANGS:
        for page in pages:
            entry=SubElement(sitemap,'url');SubElement(entry,'loc').text=BASE+url(lang,page)
            SubElement(entry,'lastmod').text=max('2026-10-22',data['reportAt'][:10] if page in ['','watch'] else '2026-10-22' if page!='research' else letters['updated'][:10])
    for name in ['andy_scan','madam_daily','justin_lab']:
        entry=SubElement(sitemap,'url');SubElement(entry,'loc').text=BASE+'/reports/'+name+'.html'
    write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n'+tostring(sitemap,encoding='unicode'))
    # Reuse the existing, explicitly public publishable key and RPC. No new table/schema.
    source=(ROOT/'terminal/index.html').read_text(encoding='utf-8')
    import re
    supa_url=re.search(r"const SUPA_URL = '([^']+)'",source)[1]
    key=re.search(r"const SUPA_KEY = '([^']+)'",source)[1]
    if not key.startswith('sb_publishable_'):
        raise ValueError('Only a publishable frontend key may be reused')
    template=(ROOT/'scripts/discovery-analytics.template.js').read_text(encoding='utf-8')
    write('discovery-analytics.js',template.replace('__PUBLIC_URL__',supa_url).replace('__PUBLISHABLE_KEY__',key))
    return {'changed':True,'pages':len(LANGS)*len(pages)+1,'reportAt':data['reportAt']}

if __name__=='__main__':
    print(json.dumps(build('--force' in sys.argv)))
