"""Build crawlable, localized public pages using published data only. No network."""
from datetime import datetime, timezone
from email.utils import format_datetime
from hashlib import sha256
from html import escape as e
import json
import re
from pathlib import Path
import sys
from urllib.parse import urlsplit, urlunsplit
from xml.etree.ElementTree import Element, SubElement, tostring
from zoneinfo import ZoneInfo
from discovery_content import COPY, KIMCHI_LIVE_COPY, KIMCHI_LIVE_INTRO, KIMCHI_TOOL_COPY, LANGS, STAGES
from stage_content import WORDS, stage_body
from blind_daily_stock_rounds import ensure_rounds
from frontend_config import read_public_config

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://tapelounge.com'
HOME_OG_VERSION = '20261102'
HOME_OG_ALT = {
    'ko': '이름과 날짜를 숨긴 과거 미국 주식·비트코인 차트에서 가상 매매를 연습하고 보유 결과와 비교하는 Tape Lounge',
    'en': 'Practice virtual trades on historical US stock and Bitcoin charts with the ticker and date hidden, then compare with holding on Tape Lounge',
    'zh': '在隐藏标的和日期的美股与比特币历史图表上进行虚拟交易练习，并与持有结果比较',
    'ja': '銘柄と日付を隠した米国株・ビットコインの過去チャートで仮想売買を練習し、保有結果と比べるTape Lounge',
}
BLIND_OG_ALT = {
    'ko': HOME_OG_ALT['ko'],
    'en': HOME_OG_ALT['en'],
    'zh': HOME_OG_ALT['zh'],
    'ja': HOME_OG_ALT['ja'],
}
TOOL_OG_ALT = {
    'ko': 'Tape Lounge 실시간 시장 정보와 차트 분석 화면',
    'en': 'Live market information and chart analysis at Tape Lounge',
    'zh': 'Tape Lounge 实时行情与图表分析页面',
    'ja': 'Tape Loungeのリアルタイム相場情報とチャート分析',
}
# Bump when the localized market index copy or search metadata changes.
MARKET_PAGE_UPDATED = '2026-11-02'
WATCH_PAGE_UPDATED = '2026-11-02'
ASSETS = ['discovery.js', 'discovery.css', 'terminal-nav.js', 'stage.js', 'stage.css', 'stage-community.js', 'site-campaign.js', 'discovery-analytics.js', 'home-language.js', 'lounge-rotation.js', 'kimchi-premium.js', 'kimchi-premium.css', 'lounge-app.js']
VERSION = 'd' + sha256(b''.join((ROOT / p).read_bytes() for p in ASSETS)).hexdigest()[:12]
SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'LINK']
NAMES = ['Bitcoin', 'Ethereum', 'Solana', 'XRP', 'BNB', 'Dogecoin', 'Cardano', 'Chainlink']
TOOL_ASSETS = ['domestic.js', 'domestic-stream.js', 'domestic.css', 'lounge-app.js',
               'chart-analysis-20261101.js', 'chart-analysis.css', 'btc-long-channel.js',
               'chart-share.js', 'chart-share.css', 'blind-daily.js', 'blind-daily-share.js',
               'site-campaign.js', 'blind-og-20261101.png', 'lounge-rotation.js',
               'live-home-locale.js']
SHARE_ASSETS = ['article-share.js', 'article-share.css']
SHARE_VERSION = sha256(b''.join((ROOT / p).read_bytes() for p in SHARE_ASSETS)).hexdigest()[:12]
TOOL_PAGES = [
    ('domestic', 'domestic', '김치프리미엄·국내 코인 시세 · Tape Lounge',
     '국내 거래소와 해외 거래소의 코인 시세, 김치프리미엄, 관심 종목과 Andy 관찰 후보를 비교합니다.'),
    ('desk', 'desk', '비트코인 선물 데스크 · Tape Lounge',
     'BTC 무기한 선물의 추세, 주요 가격대, 펀딩비, 미결제약정과 주문 흐름을 한 화면에서 확인합니다.'),
    ('analysis', 'analysis', '비트코인 장기 채널·차트 분석 · Tape Lounge',
     '비트코인의 장기 선형 채널과 주봉 지지·저항을 살펴보는 차트 분석 자료입니다. 고정 자료의 기준일과 한계를 함께 표시합니다.'),
    ('onchain', 'chain', '비트코인 온체인·멤풀 · Tape Lounge',
     '비트코인 멤풀, 전송 수수료, 새 블록과 공개 온체인 지표로 거래소 밖 네트워크 상황을 살펴봅니다.'),
    ('calendar', 'macro', '미국 경제지표 발표 일정 · Tape Lounge',
     'CPI, 고용, GDP와 FOMC의 공식 발표 일정, 확인된 결과와 발표 이후 비트코인 가격 반응을 한국시간으로 확인합니다.'),
    ('blind', 'game', '미국주식·비트코인 블라인드 차트 모의투자 게임 · Tape Lounge',
     '미국주식과 비트코인의 실제 과거 차트로 하는 블라인드 모의투자 게임입니다. 종목과 날짜를 가리고 가상 자금으로 200개 봉을 매매한 뒤 같은 기간 매수 후 보유 수익률과 비교하세요. 혼자 또는 친구와 플레이하며 실제 주문은 없습니다.'),
    ('strategists', 'chars', '크립토 전략가 리포트 · Tape Lounge',
     '정마담의 운용 장부, Andy의 종목 관찰과 Prof. Justin의 월간 시장 국면 판정을 확인하는 AI 전략가 리포트입니다.'),
]
REPORT_METADATA = [
    ('reports/andy_scan.html', 'Andy · 오늘의 스캔 — Tape Lounge',
     'BTC 추세를 기준으로 코인 일봉·4시간봉을 훑어 돌파, 추세 지속, 바닥 반전과 눌림 지지 후보를 정리한 관찰 기록입니다. 실시간 매수 신호가 아닙니다.'),
    ('reports/madam_daily.html', '鄭마담 · 운용 장부 — Tape Lounge',
     'BTC와 금(PAXG)의 운용 기록을 과거 재현과 실제 체결로 구분해 보여줍니다. 가격 마커는 체결가가 아니며 두 구간을 하나의 실거래 성과로 합산하지 않습니다.'),
    ('reports/justin_lab.html', 'Prof. Justin · 월간 소견서 — Tape Lounge',
     'Prof. Justin의 월간 시장 국면 판정과 최근 흐름을 확인하세요. 모형 판정은 단독 매수·매도 신호가 아니며, 판단 수치와 기준값은 공개하지 않습니다.'),
]

def tool_page(classic, slug, selected, title, description, lang='ko', live_tools=False):
    """Serve one tab from the shared live-app shell, optionally under a locale route."""
    route = live_app_url(lang, slug) if live_tools else ('/' + slug.rstrip('/') + '/' if slug else '/')
    canonical = BASE + route
    text = classic.replace('data-entry-tab="lounge"', f'data-entry-tab="{selected}"', 1)
    if live_tools:
        text = text.replace('<html lang="ko">',
                            f'<html lang="{lang}" data-live-tools-root="/{lang}/tools">', 1)
        text = text.replace('<meta name="robots" content="index,follow">',
                            '<meta name="robots" content="noindex,follow">', 1)
        text = re.sub(r'(<summary[^>]*>)🌐\s*KO(</summary>)',
                      lambda m: m.group(1) + '🌐 ' + lang.upper() + m.group(2), text, count=1)
        locale_js_version = sha256((ROOT / 'live-home-locale.js').read_bytes()).hexdigest()[:12]
        text = text.replace('</head>',
                            f'<script defer src="/live-home-locale.js?v={locale_js_version}"></script>\n</head>', 1)
    text = re.sub(r'<title>[^<]*</title>', f'<title>{e(title)}</title>', text, count=1)
    for attr, name, value in [('name', 'description', description),
                              ('property', 'og:title', title),
                              ('property', 'og:description', description),
                              ('property', 'og:url', canonical)]:
        text = re.sub(r'<meta '+attr+'="'+name+r'" content="[^"]*">',
                      lambda _: f'<meta {attr}="{name}" content="{e(value, quote=True)}">', text, count=1)
    if slug == 'blind':
        image = BASE + '/blind-og-20261101.png?v=20261101a'
        image_alt = BLIND_OG_ALT[lang]
    elif live_tools and not slug:
        image = BASE + f'/home-og-{lang}-{HOME_OG_VERSION}.png'
        image_alt = HOME_OG_ALT[lang]
    elif slug:
        image = BASE + '/og.png'
        image_alt = TOOL_OG_ALT[lang]
    else:
        image = None
        image_alt = None
    if image:
        text = re.sub(r'<meta property="og:image" content="[^"]*">',
                      f'<meta property="og:image" content="{image}">', text, count=1)
        text = re.sub(r'<meta property="og:image:alt" content="[^"]*">',
                      lambda _: f'<meta property="og:image:alt" content="{e(image_alt, quote=True)}">',
                      text, count=1)
        text = re.sub(r'<meta name="twitter:image" content="[^"]*">',
                      f'<meta name="twitter:image" content="{image}">', text, count=1)
        text = re.sub(r'<meta name="twitter:image:alt" content="[^"]*">',
                      lambda _: f'<meta name="twitter:image:alt" content="{e(image_alt, quote=True)}">',
                      text, count=1)
    text = text.replace(f'<link rel="canonical" href="{BASE}/">',
                        f'<link rel="canonical" href="{canonical}">', 1)

    selected_slug = LIVE_TAB_SLUGS.get(selected, '')
    def language_link(match):
        tag = match.group(0)
        target_lang = match.group(1)
        target_url = locale_home_url(target_lang) if not selected_slug else live_app_url(target_lang, selected_slug)
        tag = re.sub(r'href="[^"]*"',
                     f'href="{e(target_url, quote=True)}"', tag, count=1)
        tag = re.sub(r'\s+aria-current="[^"]*"', '', tag)
        if target_lang == lang:
            tag = tag[:-1] + ' aria-current="page">'
        return tag
    text = re.sub(r'<a\b[^>]*\bdata-language="(ko|en|zh|ja)"[^>]*>',
                  language_link, text)

    route_slugs = {slug for slug in LIVE_TAB_SLUGS.values() if slug}
    def localized_anchor(match):
        tag = match.group(0)
        if 'data-language=' in tag:
            return tag
        href = re.search(r'href="([^"]*)"', tag)
        if not href:
            return tag
        parts = urlsplit(href.group(1))
        if parts.scheme or parts.netloc:
            return tag
        path = parts.path.rstrip('/') or '/'
        if path == '/':
            new_path = locale_home_url(lang)
        elif path == '/decision':
            new_path = decision_url(lang)
        elif path.strip('/') in route_slugs:
            new_path = live_app_url(lang, path.strip('/'))
        elif live_tools and lang != 'ko' and path.startswith('/ko/'):
            new_path = f'/{lang}/' + path[len('/ko/'):]
        else:
            return tag
        replacement = urlunsplit(('', '', new_path, parts.query, parts.fragment))
        return tag[:href.start(1)] + replacement + tag[href.end(1):]
    text = re.sub(r'<a\b[^>]*>', localized_anchor, text)

    def panel(match):
        tag, key, attrs = match.groups()
        attrs = re.sub(r'\sclass="hidden"', '', attrs)
        if key != selected:
            attrs += ' class="hidden"'
        return f'<{tag} id="tab-{key}"{attrs}>'

    def nav(match):
        attrs, key = match.groups()
        active = key == selected
        attrs = re.sub(r'class="tab(?: on)?"', 'class="tab'+(' on' if active else '')+'"', attrs)
        attrs = re.sub(r'aria-selected="(?:true|false)"', f'aria-selected="{str(active).lower()}"', attrs)
        return '<a'+attrs+'>'

    text = re.sub(r'<(div|section) id="tab-([a-z]+)"([^>]*)>', panel, text)
    text = re.sub(r'<a([^>]*\bdata-tab="([a-z]+)"[^>]*)>', nav, text)
    return text

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

def ensure_report_metadata():
    changed = False
    for path, title, description in REPORT_METADATA:
        target = ROOT / path
        text = target.read_text(encoding='utf-8')
        original = text
        canonical = BASE + '/' + path
        tags = [
            (r'<meta\s+name=["\']description["\'][^>]*>',
             f"<meta name='description' content='{e(description, quote=True)}'>"),
            (r'<meta\s+name=["\']robots["\'][^>]*>',
             "<meta name='robots' content='index,follow'>"),
            (r'<meta\s+property=["\']og:type["\'][^>]*>',
             "<meta property='og:type' content='article'>"),
            (r'<meta\s+property=["\']og:title["\'][^>]*>',
             f"<meta property='og:title' content='{e(title, quote=True)}'>"),
            (r'<meta\s+property=["\']og:description["\'][^>]*>',
             f"<meta property='og:description' content='{e(description, quote=True)}'>"),
            (r'<meta\s+property=["\']og:url["\'][^>]*>',
             f"<meta property='og:url' content='{canonical}'>"),
            (r'<meta\s+property=["\']og:image["\'][^>]*>',
             f"<meta property='og:image' content='{BASE}/og.png'>"),
            (r'<meta\s+name=["\']twitter:card["\'][^>]*>',
             "<meta name='twitter:card' content='summary_large_image'>"),
            (r'<link\s+rel=["\']canonical["\'][^>]*>',
             f"<link rel='canonical' href='{canonical}'>"),
        ]
        missing = []
        for pattern, tag in tags:
            if re.search(pattern, text, flags=re.IGNORECASE):
                text = re.sub(pattern, lambda _: tag, text, count=1, flags=re.IGNORECASE)
            else:
                missing.append(tag)
        if missing:
            if '</head>' not in text:
                raise ValueError(f'Report has no closing head tag: {path}')
            text = text.replace('</head>', '\n' + '\n'.join(missing) + '\n</head>', 1)
        write(path, text)
        changed |= text != original
    return changed

def url(lang, page=''):
    return f'/{lang}/' + (page.rstrip('/') + '/' if page else '')

def locale_url(lang, page=''):
    # The legacy Korean lounge exists at both / and /ko/, with / as canonical.
    # Localized editorial homepages must point back to that canonical URL.
    if lang == 'ko' and not page:
        return '/'
    return url(lang, page)

DECISION_COPY = {
    'ko': ('비트코인 과거 차트 매매 연습 | 그때 나라면? · Tape Lounge', '과거 비트코인 차트에서 매수·대기·보유·청산을 12번 선택해 보세요. 다음 5일의 흐름과 같은 기간 보유, 최대 낙폭·수수료를 비교하는 무료 모의 연습입니다. 실전 주문은 없습니다.'),
    'en': ('What Would You Have Done? BTC Decision Practice · Tape Lounge', 'Practice historical Bitcoin decisions with multiple chart timeframes, the prior-day Fear & Greed Index and historical funding, then review the outcome and fees.'),
    'zh': ('如果当时是你？BTC决策练习 · Tape Lounge', '在比特币历史行情中查看多个周期、前一日恐惧与贪婪指数及历史资金费率，练习买入、等待、持有和卖出，并回顾后续走势与手续费。'),
    'ja': ('あの時、自分なら？BTC判断練習ゲーム · Tape Lounge', 'ビットコインの過去チャートを複数時間軸で見て、前日のFear & Greed指数とFundingを参考に判断し、その後の値動きや手数料を振り返ります。'),
}

def decision_url(lang):
    return '/decision/' if lang == 'ko' else f'/{lang}/decision/'

def build_decision_pages():
    template=(ROOT/'scripts/decision-template.html').read_text(encoding='utf-8')
    alternates=''.join(f'<link rel="alternate" hreflang="{lang}" href="{BASE+decision_url(lang)}">' for lang in LANGS)
    alternates+=f'<link rel="alternate" hreflang="x-default" href="{BASE}/decision/">'
    image_alt = {
        'ko': 'Tape Lounge BTC decision practice: 12 historical chart decisions, revealed five days at a time.',
        'en': 'Tape Lounge BTC decision practice: 12 historical chart decisions, revealed five days at a time.',
        'zh': 'Tape Lounge 比特币历史行情决策练习：12 次选择，每次揭晓后续五天走势。',
        'ja': 'Tape LoungeのBTC判断練習。過去チャートで12回判断し、5日後の値動きを確認。',
    }
    for lang in LANGS:
        title,description=DECISION_COPY[lang]
        image=f'{BASE}/decision-og-{lang}-20261101.png?v=20261101a'
        page=(template.replace('__LANG__',lang).replace('__TITLE__',e(title))
              .replace('__DESCRIPTION__',e(description,quote=True))
              .replace('__CANONICAL__',BASE+decision_url(lang)).replace('__ALTERNATES__',alternates)
              .replace('__OG_IMAGE__',image).replace('__OG_IMAGE_ALT__',e(image_alt[lang],quote=True))
              .replace('__ANALYTICS_VERSION__',VERSION))
        write(decision_url(lang).strip('/')+'/index.html',page)
    return {'pages':len(LANGS),'routes':[decision_url(lang) for lang in LANGS]}

LIVE_TAB_SLUGS = {
    'lounge':'', 'game':'blind', 'domestic':'domestic', 'desk':'desk',
    'analysis':'analysis', 'chain':'onchain', 'macro':'calendar', 'chars':'strategists',
}
LIVE_PAGE_COPY = {
    'en': {
        '': ('Live market lounge | Tape Lounge', 'A live market lounge with price action, chart practice, market data and trader conversations.'),
        'blind': ('Blind chart practice | Tape Lounge', 'Practice on historical stock and crypto charts with the same live lounge layout.'),
        'domestic': ('Korean Crypto Prices & Kimchi Premium | Tape Lounge', 'Compare live Upbit and Bithumb KRW prices with overseas USDT spot markets; the premium uses the selected exchange’s latest USDT/KRW trade.'),
        'desk': ('Bitcoin futures desk | Tape Lounge', 'Review Bitcoin futures context, funding, open interest and order flow.'),
        'analysis': ('Bitcoin chart analysis | Tape Lounge', 'Explore Bitcoin long-term channels and chart indicators.'),
        'onchain': ('On-chain market view | Tape Lounge', 'Follow Bitcoin network activity and public on-chain indicators.'),
        'calendar': ('Economic calendar | Tape Lounge', 'Review major economic releases and market context.'),
        'strategists': ('Strategist reports | Tape Lounge', 'Read the public market observations and research notes.'),
    },
    'zh': {
        '': ('实时行情大厅 | Tape Lounge', '在同一大厅查看行情、历史图表练习、市场数据与交易讨论。'),
        'blind': ('盲图练习 | Tape Lounge', '在统一的大厅界面中，用历史美股和加密货币图表练习。'),
        'domestic': ('韩国加密货币行情与溢价 | Tape Lounge', '比较 Upbit、Bithumb 的韩元实时价格与海外 USDT 现货价格，并说明溢价换算基准。'),
        'desk': ('比特币合约行情台 | Tape Lounge', '查看比特币合约背景、资金费率、持仓量与订单流。'),
        'analysis': ('比特币图表分析 | Tape Lounge', '查看比特币长期通道与图表指标。'),
        'onchain': ('链上市场观察 | Tape Lounge', '查看比特币网络活动和公开链上指标。'),
        'calendar': ('经济日历 | Tape Lounge', '查看重要经济数据发布与市场背景。'),
        'strategists': ('策略师报告 | Tape Lounge', '阅读公开市场观察与研究记录。'),
    },
    'ja': {
        '': ('ライブマーケットラウンジ | Tape Lounge', '相場、過去チャート練習、市場データ、トレーダーの会話を一つのラウンジで確認できます。'),
        'blind': ('ブラインドチャート練習 | Tape Lounge', '同じラウンジ画面で、株式と暗号資産の過去チャートを練習できます。'),
        'domestic': ('韓国暗号資産価格・プレミアム | Tape Lounge', 'Upbit・Bithumbのウォン建て価格と海外USDT現物価格を比較し、換算基準も確認できます。'),
        'desk': ('ビットコイン先物デスク | Tape Lounge', 'ビットコイン先物の背景、資金調達率、建玉、注文フローを確認します。'),
        'analysis': ('ビットコインチャート分析 | Tape Lounge', 'ビットコインの長期チャネルとチャート指標を確認します。'),
        'onchain': ('オンチェーン市場ビュー | Tape Lounge', 'ビットコインネットワークの動きと公開オンチェーン指標を確認します。'),
        'calendar': ('経済カレンダー | Tape Lounge', '主な経済指標の発表と市場の背景を確認します。'),
        'strategists': ('ストラテジストレポート | Tape Lounge', '公開されている市場観察とリサーチ記録を読めます。'),
    },
}

def live_app_url(lang, slug=''):
    if lang == 'ko':
        return '/' + (slug.rstrip('/') + '/' if slug else '')
    return f'/{lang}/tools/' + (slug.rstrip('/') + '/' if slug else '')

def locale_home_url(lang):
    return '/' if lang == 'ko' else f'/{lang}/'

def prepare_classic_home():
    """Prepare the shared lounge shell for the public root and tool entries."""
    classic=(ROOT/'classic-home.html').read_text(encoding='utf-8')
    app_version=sha256((ROOT/'lounge-app.js').read_bytes()).hexdigest()[:12]
    classic, app_script_count = re.subn(
        r'(<script defer src="/lounge-app\.js\?v=)[^"]+("></script>)',
        lambda m: m.group(1) + app_version + m.group(2),
        classic, count=1)
    if app_script_count != 1:
        raise ValueError('Could not refresh the shared lounge app script version')
    classic, campaign_script_count = re.subn(
        r'<script(?: defer)? src="/?site-campaign\.js\?v=[^"]+"></script>',
        f'<script defer src="/site-campaign.js?v={VERSION}"></script>',
        classic, count=1)
    if campaign_script_count != 1:
        raise ValueError('Could not refresh the social campaign script version in the lounge template')
    classic, rotation_script_count = re.subn(
        r'<script defer src="/?lounge-rotation\.js\?v=[^"]+"></script>',
        f'<script defer src="/lounge-rotation.js?v={VERSION}"></script>',
        classic, count=1)
    if rotation_script_count != 1:
        raise ValueError('Could not refresh the lounge rotation script version in the lounge template')
    write('classic-home.html', classic)

    viewport='<meta name="viewport" content="width=device-width, initial-scale=1">'
    if '<head>' not in classic or viewport not in classic:
        raise ValueError('The archived pre-redesign homepage is missing its expected head metadata')
    classic=classic.replace('<head>','<head>\n<base href="/">',1)
    home_language_version=sha256((ROOT/'home-language.js').read_bytes()).hexdigest()[:12]
    classic=classic.replace('</head>',f'<script defer src="/home-language.js?v={home_language_version}"></script>\n</head>',1)
    classic=classic.replace('<meta name="robots" content="noindex,follow">','<meta name="robots" content="index,follow">',1)
    classic=classic.replace(viewport,viewport+'\n<link rel="canonical" href="https://tapelounge.com/">',1)
    return classic

def localized_live_home(classic, lang):
    """Render the same lounge home in each language; keep the shell and features identical."""
    title, description = LIVE_PAGE_COPY[lang]['']
    text = tool_page(classic, '', 'lounge', title, description, lang=lang, live_tools=True)
    app_canonical = BASE + live_app_url(lang, '')
    public_canonical = BASE + locale_home_url(lang)
    text = text.replace(f'<link rel="canonical" href="{app_canonical}">',
                        f'<link rel="canonical" href="{public_canonical}">', 1)
    text = text.replace(f'<meta property="og:url" content="{app_canonical}">',
                        f'<meta property="og:url" content="{public_canonical}">', 1)
    text = text.replace('<meta name="robots" content="noindex,follow">',
                        '<meta name="robots" content="index,follow,max-image-preview:large">', 1)
    alternates = ''.join(
        f'<link rel="alternate" hreflang="{code}" href="{BASE + locale_home_url(code)}">'
        for code in LANGS
    ) + f'<link rel="alternate" hreflang="x-default" href="{BASE}/">'
    return text.replace('</head>', alternates + '\n</head>', 1)

def write_live_home_pages(classic):
    """Write the canonical shared lounge home for Korean and all translated locales."""
    alternates = ''.join(
        f'<link rel="alternate" hreflang="{lang}" href="{BASE + locale_home_url(lang)}">'
        for lang in LANGS
    ) + f'<link rel="alternate" hreflang="x-default" href="{BASE}/">'
    site_schema = json.dumps({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'Tape Lounge',
        'alternateName': ['테이프라운지', 'tapelounge.com'],
        'url': BASE + '/',
    }, ensure_ascii=False, separators=(',', ':'))
    site_schema_tag = f'<script type="application/ld+json">{site_schema}</script>'
    korean_home = classic.replace('</head>', alternates + site_schema_tag + '\n</head>', 1)
    write('index.html', korean_home)
    write('ko/index.html', korean_home)
    for lang in LIVE_PAGE_COPY:
        write(f'{lang}/index.html', localized_live_home(classic, lang))

def build_live_tools_only():
    """Regenerate the shared Korean live-lounge shell and its localized entries."""
    classic=prepare_classic_home()
    build_decision_pages()
    write_live_home_pages(classic)
    for lang, pages_copy in LIVE_PAGE_COPY.items():
        title, description = pages_copy['']
        write(f'{lang}/tools/index.html',
              tool_page(classic, '', 'lounge', title, description, lang=lang, live_tools=True))
        for slug, selected, _, _ in TOOL_PAGES:
            title, description = pages_copy[slug]
            write(f'{lang}/tools/{slug}/index.html',
                  tool_page(classic, slug, selected, title, description, lang=lang, live_tools=True))
    return {'changed':True,'liveToolEntries':1+len(LIVE_PAGE_COPY)*(1+len(TOOL_PAGES))}

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

def guide_cards(lang, exclude=None):
    c=COPY[lang]
    guides=(guide for guide in c['guides'] if guide[0]!=exclude)
    return '<div class="reading-grid">'+''.join(f'<article class="reading-card"><span class="reading-no">0{i+1} / FIELD NOTES</span><h3>{link(url(lang,"learn/"+g[0]),g[1])}</h3><p>{e(g[2])}</p>{link(url(lang,"learn/"+g[0]),c["read"]+" ↗")}</article>' for i,g in enumerate(guides))+'</div>'

def guide_share(lang):
    labels={'ko':('글 공유','공유 링크'),'en':('Share this note','Share link'),'zh':('分享这篇笔记','分享链接'),'ja':('この記事を共有','共有リンク')}[lang]
    return f'<div class="guide-share"><button type="button" data-article-share>{e(labels[0])} ↗</button><span data-article-share-status role="status" aria-live="polite"></span><input type="url" data-article-share-url aria-label="{e(labels[1],quote=True)}" readonly hidden></div>'

def kimchi_calculator(lang):
    t=KIMCHI_TOOL_COPY[lang].copy()
    live=KIMCHI_LIVE_COPY[lang]
    t['intro']=KIMCHI_LIVE_INTRO[lang]
    fields=[('kp-local',t['local'],t['hintLocal']),('kp-binance',t['binance'],t['hintBinance']),('kp-usd',t['usd'],t['hintUsd']),('kp-usdt',t['usdt'],t['hintUsdt'])]
    inputs=''.join(f'<label class="kp-field" for="{ident}"><span>{e(label)}</span><input id="{ident}" type="text" inputmode="decimal" autocomplete="off" placeholder="{e(hint,quote=True)}" required></label>' for ident,label,hint in fields)
    return f'''<section class="kp-calculator" id="kimchi-calculator" aria-labelledby="kp-title"><header class="kp-head"><p class="eyebrow">{e(t['kicker'])}</p><h2 id="kp-title">{e(t['title'])}</h2><p>{e(t['intro'])}</p></header><form id="kp-form" novalidate><div class="kp-fields">{inputs}</div><div class="kp-actions"><button type="button" id="kp-live-quotes">{e(live['button'])}</button><button type="button" id="kp-example">{e(t['example'])}</button><button type="reset" class="kp-clear">{e(t['clear'])}</button></div><p class="kp-sources">{e(live['sources'])}</p><div class="kp-results" id="kp-results" aria-live="polite"><article class="kp-result"><span>{e(t['usdResult'])}</span><strong id="kp-usd-value">—</strong><small>{e(t['usdNote'])}: <b id="kp-usd-premium">—</b></small></article><article class="kp-result"><span>{e(t['usdtResult'])}</span><strong id="kp-usdt-value">—</strong><small>{e(t['usdtNote'])}: <b id="kp-usdt-gap">—</b></small></article><article class="kp-result"><span>{e(t['basisResult'])}</span><strong id="kp-basis-value">—</strong><small>USD/KRW {e('↔')} USDT/KRW</small></article></div><p class="kp-status" id="kp-status" role="status">{e(t['pending'])}</p><p class="kp-note" id="kp-note">{e(live['disclaimer'])}</p><p class="kp-live">{link(url(lang,'markets'),t['live']+' ↗')}</p></form></section>'''

def kimchi_faq(lang):
    t=KIMCHI_TOOL_COPY[lang]
    items=''.join(f'<details><summary>{e(question)}</summary><p>{e(answer)}</p></details>' for question,answer in t['faqs'])
    return f'<section class="kp-faq"><h2>{e(t["faqTitle"])}</h2>{items}</section>'

def guide_date(guide):
    return guide[4] if len(guide)>4 else '2026-10-22'

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
    search_title=c.get('marketSeoTitle',title) if page=='markets' else c.get('radarSeoTitle',title) if page=='watch' else title
    search_desc=c.get('marketSeoDescription',desc) if page=='markets' else c.get('radarSeoDescription',desc) if page=='watch' else desc
    article_date=guide_date(guide) if guide else None
    current=BASE+url(lang,page)
    nav=''.join(link(url(lang,p),c['nav'][i], 'selected' if page==p or (p=='learn' and guide) else '') for i,p in enumerate(['','markets','watch','learn']))
    languages=''.join(f'<a href="{locale_url(l,page)}" lang="{l}" hreflang="{l}" data-language="{l}" '+('aria-current="true"' if l==lang else '')+f'>{label}</a>' for l,label in LANGS.items())
    alts=''.join(f'<link rel="alternate" hreflang="{l}" href="{BASE+locale_url(l,page)}">' for l in LANGS)+f'<link rel="alternate" hreflang="x-default" href="{BASE+locale_url("ko",page)}">'
    schema=[{'@context':'https://schema.org','@type':'WebSite','name':'Tape Lounge','url':BASE+'/'}, {'@context':'https://schema.org','@type':'WebPage','name':search_title,'description':search_desc,'url':current,'inLanguage':lang,'isPartOf':{'@type':'WebSite','url':BASE+'/'}}]
    if guide:
        schema.append({'@context':'https://schema.org','@type':'Article','headline':title,'description':desc,'inLanguage':lang,'datePublished':article_date,'dateModified':article_date,'author':{'@type':'Organization','name':'Tape Lounge','url':BASE+'/ko/about/'},'mainEntityOfPage':current})
        if guide[0]=='kimchi-premium':
            schema.append({'@context':'https://schema.org','@type':'FAQPage','mainEntity':[{'@type':'Question','name':question,'acceptedAnswer':{'@type':'Answer','text':answer}} for question,answer in KIMCHI_TOOL_COPY[lang]['faqs']]})
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
        game_labels={'ko':'오늘의 판 플레이하기 ↗','en':'Try today’s chart game (Korean UI) ↗','zh':'开始今天的盲图游戏（韩文界面）↗','ja':'今日のチャートゲームへ（韓国語 UI）↗'}
        game_cta=f'<p>{link("/blind/?daily=1",game_labels[lang])}</p>' if guide[0]=='blind-chart-practice' else ''
        kimchi=guide[0]=='kimchi-premium'
        tool=kimchi_calculator(lang) if kimchi else ''
        faq=kimchi_faq(lang) if kimchi else ''
        body=f'<article class="guide"><nav class="breadcrumbs">{link(url(lang,"learn"),c["nav"][3])} / FIELD NOTES</nav><p class="eyebrow">TAPE LOUNGE / EDITORIAL</p><h1>{e(title)}</h1><p class="standfirst">{e(desc)}</p><p class="byline">Tape Lounge · <time datetime="{article_date}">{article_date}</time></p>{tool}'+''.join(f'<section><span class="paragraph-number">0{i+1}</span><p>{e(p)}</p></section>' for i,p in enumerate(guide[3]))+faq+f'<aside class="article-end">{game_cta}{e(c["disclaimer"])}<p>{link(url(lang,"about"),c["method"]+" ↗")}</p>{guide_share(lang)}</aside></article><section>{section_head(c["next"])}{guide_cards(lang, exclude=guide[0])}</section>'
    elif page=='learn':
        body=f'<div class="page-opening"><p class="eyebrow">FIELD NOTES</p><h1>{e(title)}</h1><p>{e(desc)}</p></div>{guide_cards(lang)}<section class="learn-callout"><h2>{e(c["radar"])}</h2><p>{e(c["radarIntro"])}</p>{link(url(lang,"watch"),c["all"]+" ↗")}</section>'
    else:
        body=f'<article class="guide"><p class="eyebrow">THE COLOPHON</p><h1>{e(title)}</h1><p class="standfirst">{e(c["aboutText"])}</p><section><h2>{e(c["method"])}</h2><p>{e(c["sourceText"])}</p><p>{e(c["dataText"])}</p><p><a href="https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints" rel="noopener">Binance API</a> · <a href="https://global-docs.upbit.com/reference/list-tickers" rel="noopener">Upbit API</a> · <a href="https://frankfurter.dev/" rel="noopener">Frankfurter</a></p><p><a href="/data/andy-watch.json">Observation JSON</a> · <a href="/data/discovery.json">Public summary JSON</a> · <a href="/{lang}/feed.xml">RSS</a></p></section><section><h2>{e(c["privacy"])}</h2><p>{e(c["analyticsText"])}</p><p>{e(c["countryPrivacy"])}</p></section><section><h2>AI</h2><p>{e(c["researchIntro"])}</p><p>{e(c["disclaimer"])}</p></section></article>'
    if page=='':
        body=stage_body(lang,data)
        title={'ko':'실시간 시장과 관찰 기록','en':'Live market scenes and observations','zh':'实时行情与观察记录','ja':'ライブ相場と観察記録'}[lang]
        desc={'ko':'실제 시장 장면을 보고 되돌려 보며 관찰을 남기는 라운지. 가격·체결·청산·후보의 이후 기록을 함께 확인합니다.','en':'Watch real market scenes, replay what happened and leave observations. Spot prices, trade flow, liquidations and published candidate histories.','zh':'观看真实市场片段，回放行情并留下观察。结合价格、成交、清算及已发布候选的后续记录。','ja':'実際の市場の場面を観察し、リプレイし、記録を残すラウンジ。価格・約定・清算・公開候補の履歴をつなぎます。'}[lang]
        schema[1].update(name=title,description=desc)
    schema_json=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')
    app_scripts=(f'<script defer src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js" integrity="sha384-OK7vELvjHdhUFi31JYioPIcRHTROLdcDa6ZsNWgvgLaKj+9JqhU0Ad8g4wz3CXjA" crossorigin="anonymous"></script><script defer src="/stage.js?v={VERSION}"></script><script defer src="/stage-community.js?v={VERSION}"></script>' if page=='' else f'<script defer src="/discovery.js?v={VERSION}"></script>')
    article_share_assets=(f'<link rel="stylesheet" href="/article-share.css?v={SHARE_VERSION}"><script defer src="/article-share.js?v={SHARE_VERSION}"></script>' if guide else '')
    kimchi_assets=''
    if guide and guide[0]=='kimchi-premium':
        kimchi_assets=f'<link rel="stylesheet" href="/kimchi-premium.css?v={VERSION}">'
        app_scripts+=f'<script defer src="/kimchi-premium.js?v={VERSION}"></script>'
    if page=='':
        nav=''.join(link(url(lang,p),WORDS[lang]['home'] if i==0 else c['nav'][i], 'selected' if i==0 else '') for i,p in enumerate(['','markets','watch','learn']))
    app_scripts=f'<script src="/site-campaign.js?v={VERSION}"></script>'+app_scripts
    return f'''<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(search_title)} — Tape Lounge</title><meta name="description" content="{e(search_desc,quote=True)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{current}">{alts}
<meta property="og:type" content="{'article' if guide else 'website'}"><meta property="og:title" content="{e(search_title,quote=True)} — Tape Lounge"><meta property="og:description" content="{e(search_desc,quote=True)}"><meta property="og:url" content="{current}"><meta property="og:image" content="{BASE}/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0d1114"><meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://challenges.cloudflare.com; connect-src 'self' https://data-api.binance.vision https://api.upbit.com https://api.bithumb.com https://api.frankfurter.dev https://api.country.is https://*.supabase.co wss://stream.binance.com:9443; frame-src https://challenges.cloudflare.com">
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/discovery.css?v={VERSION}"><link rel="stylesheet" href="/stage.css?v={VERSION}">{kimchi_assets}<link rel="alternate" type="application/rss+xml" href="/{lang}/feed.xml" title="Tape Lounge"><script type="application/ld+json">{schema_json}</script>{app_scripts}{article_share_assets}<script defer src="/discovery-analytics.js?v={VERSION}"></script></head>
<body class="{'market-stage' if page=='' else ''}" data-page="{page}" data-entry="{'root' if root else 'locale'}"><a class="skip" href="#content">Skip to content</a><div class="edition-bar"><span>{e(c['edition'])}</span><span>INDEPENDENT / CRYPTO / OBSERVATION</span></div>
<header class="masthead"><a class="wordmark" href="{url(lang)}" aria-label="Tape Lounge"><span class="brand-icon">t.</span><span>TAPE<span class="wordmark-light">LOUNGE</span><small>A PLACE TO READ THE MARKET.</small></span></a><nav class="primary-nav" aria-label="Navigation">{nav}</nav><div class="header-actions"><a class="terminal-link" href="{live_app_url(lang)}">{e(c['tools'])} ↗</a><details class="languages"><summary aria-label="Language">◎ {lang.upper()}</summary><div>{languages}</div></details></div></header>
<div id="locale-suggestion" hidden role="status"></div><main id="content"><div class="site-search"><label for="site-search">⌕ <span class="sr-only">{e(c['find'])}</span></label><input id="site-search" type="search" placeholder="{e(c['searchHint'])}" autocomplete="off" aria-controls="search-results"><span class="search-caption">MARKETS / IDEAS / PERSPECTIVES</span><div id="search-results" hidden></div></div>{body}</main>
<footer><div class="footer-top"><a class="footer-brand" href="{url(lang)}">TAPE LOUNGE<span>{e(c['edition'])}</span></a><div>{link(url(lang,'research'),c['research'])}{link(url(lang,'about'),c['method'])}<a href="/{lang}/feed.xml">RSS ↗</a><a href="/data/discovery.json">Open data ↗</a></div></div><p>{e(c['disclaimer'])}</p><div class="footer-bottom"><span>© 2026 Tape Lounge</span><nav aria-label="Languages">{languages}</nav></div></footer></body></html>'''

def build(force=False):
    daily_changed=ensure_rounds(ROOT)
    report_metadata_changed=ensure_report_metadata()
    classic=prepare_classic_home()
    inputs=['scripts/build_discovery.py','scripts/frontend_config.py','scripts/decision-template.html','scripts/discovery_content.py','scripts/stage_content.py','scripts/blind_daily_stock_rounds.py','scripts/discovery-analytics.template.js','data/andy-watch.json','reports/letters.json','classic-home.html'] + [item[0] for item in REPORT_METADATA] + ASSETS + TOOL_ASSETS + SHARE_ASSETS
    fingerprint=sha256(b''.join((ROOT/p).read_bytes() for p in inputs)).hexdigest()
    target=ROOT/'data/discovery.json'
    if not force and not daily_changed and not report_metadata_changed and target.exists() and read('data/discovery.json').get('sourceHash')==fingerprint:
        return {'changed':False}
    data=read('data/andy-watch.json'); letters=read('reports/letters.json')
    generated=datetime.now(timezone.utc).isoformat()
    generated_kst=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
    tool_hash=sha256((ROOT/'classic-home.html').read_bytes()+json.dumps(TOOL_PAGES,ensure_ascii=False).encode()+b''.join((ROOT/p).read_bytes() for p in TOOL_ASSETS)).hexdigest()
    previous=read('data/discovery.json') if target.exists() else {}
    tool_updated=previous.get('toolUpdatedAt',generated_kst) if previous.get('toolSourceHash')==tool_hash else generated_kst
    pages=['','markets','watch','research','learn','about']+['learn/'+g[0] for g in COPY['en']['guides']]
    for lang in LANGS:
        for page in pages:
            if lang=='ko' and page=='':continue
            write(url(lang,page).strip('/')+'/index.html',render(lang,page,data,letters,generated))
        rss=Element('rss',version='2.0'); channel=SubElement(rss,'channel')
        for key,val in [('title','Tape Lounge'),('link',BASE+url(lang)),('description',COPY[lang]['intro']),('language',lang)]:
            SubElement(channel,key).text=val
        item=SubElement(channel,'item')
        for key,val in [('title',COPY[lang]['radar']+' · '+data['reportAt'][:10]),('link',BASE+url(lang,'watch')),('guid',BASE+'/observations/'+data['reportAt']),('description',COPY[lang]['radarNote']),('pubDate',format_datetime(datetime.fromisoformat(data['reportAt'])))]:
            SubElement(item,key).text=val
        for guide in COPY[lang]['guides']:
            item=SubElement(channel,'item')
            published=datetime.fromisoformat(guide_date(guide)).replace(tzinfo=timezone.utc)
            for key,val in [('title',guide[1]),('link',BASE+url(lang,'learn/'+guide[0])),('guid',BASE+url(lang,'learn/'+guide[0])),('description',guide[2]),('pubDate',format_datetime(published))]:
                SubElement(item,key).text=val
        write(lang+'/feed.xml','<?xml version="1.0" encoding="UTF-8"?>\n'+tostring(rss,encoding='unicode'))
    # Keep the Korean lounge as the base shell and use it for every language home.
    write_live_home_pages(classic)
    terminal=classic.replace('<meta name="robots" content="index,follow">','<meta name="robots" content="noindex,follow">',1)
    write('terminal/index.html',terminal)
    for slug, selected, title, description in TOOL_PAGES:
        write(slug+'/index.html', tool_page(classic, slug, selected, title, description))
    for lang, pages_copy in LIVE_PAGE_COPY.items():
        title, description = pages_copy['']
        write(f'{lang}/tools/index.html',
              tool_page(classic, '', 'lounge', title, description, lang=lang, live_tools=True))
        for slug, selected, _, _ in TOOL_PAGES:
            title, description = pages_copy[slug]
            write(f'{lang}/tools/{slug}/index.html',
                  tool_page(classic, slug, selected, title, description, lang=lang, live_tools=True))
    build_decision_pages()
    write('data/discovery.json',json.dumps({'schema':1,'sourceHash':fingerprint,'toolSourceHash':tool_hash,'toolUpdatedAt':tool_updated,'generatedAt':generated,'reportAt':data['reportAt'],'coverage':data['coverage'],'candidates':data['candidates'],'letters':letters,'copy':COPY,'stages':STAGES},ensure_ascii=False,separators=(',',':'))+'\n')
    sitemap=Element('urlset',xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    root_entry=SubElement(sitemap,'url');SubElement(root_entry,'loc').text=BASE+'/'
    SubElement(root_entry,'lastmod').text=tool_updated
    for slug, *_ in TOOL_PAGES:
        entry=SubElement(sitemap,'url');SubElement(entry,'loc').text=BASE+'/'+slug+'/'
        SubElement(entry,'lastmod').text=tool_updated
    for lang in LANGS:
        entry=SubElement(sitemap,'url');SubElement(entry,'loc').text=BASE+decision_url(lang)
        SubElement(entry,'lastmod').text=generated_kst
    for lang in LANGS:
        for page in pages:
            if lang=='ko' and page=='':continue
            entry=SubElement(sitemap,'url');SubElement(entry,'loc').text=BASE+url(lang,page)
            if page=='':
                lastmod=tool_updated
            elif page=='watch':
                lastmod=max(WATCH_PAGE_UPDATED,data['reportAt'][:10])
            elif page=='markets':
                lastmod=MARKET_PAGE_UPDATED
            elif page=='research':
                lastmod=max('2026-10-22',letters['updated'][:10])
            elif page.startswith('learn/'):
                guide=next((g for g in COPY[lang]['guides'] if g[0]==page.split('/',1)[1]),None)
                lastmod=guide_date(guide) if guide else '2026-10-22'
            else:
                lastmod='2026-10-22'
            SubElement(entry,'lastmod').text=lastmod
    for name in ['andy_scan','madam_daily','justin_lab']:
        entry=SubElement(sitemap,'url');SubElement(entry,'loc').text=BASE+'/reports/'+name+'.html'
    write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n'+tostring(sitemap,encoding='unicode'))
    # Reuse the existing, explicitly public publishable key and RPC. No new table/schema.
    source=(ROOT/'terminal/index.html').read_text(encoding='utf-8')
    public_config=read_public_config(ROOT)
    supa_url=public_config['url']
    key=public_config['key']
    if not key.startswith('sb_publishable_'):
        raise ValueError('Only a publishable frontend key may be reused')
    template=(ROOT/'scripts/discovery-analytics.template.js').read_text(encoding='utf-8')
    write('discovery-analytics.js',template.replace('__PUBLIC_URL__',supa_url).replace('__PUBLISHABLE_KEY__',key))
    turnstile=public_config['turnstile']
    sdk=re.search(r'<script\b[^>]*\bsrc="([^"]+@supabase/supabase-js@[^"]+)"[^>]*\bintegrity="([^"]+)"',source)
    if not sdk:
        raise ValueError('Could not find the pinned Supabase browser SDK URL and integrity in terminal/index.html')
    write('data/stage-config.json',json.dumps({'schema':1,'url':supa_url,'key':key,'turnstile':turnstile,'sdk':{'url':sdk[1],'integrity':sdk[2]},'words':WORDS},ensure_ascii=False,separators=(',',':'))+'\n')
    return {'changed':True,'pages':len(LANGS)*len(pages)+1+len(TOOL_PAGES),'reportAt':data['reportAt']}

def build_editorial_only():
    """Refresh localized discovery/editorial pages without generating blind-game rounds."""
    data=read('data/discovery.json')
    letters=read('reports/letters.json')
    generated=datetime.now(timezone.utc).isoformat()
    pages=['','markets','watch','research','learn','about']+['learn/'+g[0] for g in COPY['en']['guides']]
    for lang in LANGS:
        for page in pages:
            if lang=='ko' and page=='':
                continue
            write(url(lang,page).strip('/')+'/index.html',render(lang,page,data,letters,generated))
        rss=Element('rss',version='2.0')
        channel=SubElement(rss,'channel')
        for key,val in [('title','Tape Lounge'),('link',BASE+url(lang)),('description',COPY[lang]['intro']),('language',lang)]:
            SubElement(channel,key).text=val
        item=SubElement(channel,'item')
        for key,val in [('title',COPY[lang]['radar']+' · '+data['reportAt'][:10]),('link',BASE+url(lang,'watch')),('guid',BASE+'/observations/'+data['reportAt']),('description',COPY[lang]['radarNote']),('pubDate',format_datetime(datetime.fromisoformat(data['reportAt'])) )]:
            SubElement(item,key).text=val
        for guide in COPY[lang]['guides']:
            item=SubElement(channel,'item')
            published=datetime.fromisoformat(guide_date(guide)).replace(tzinfo=timezone.utc)
            for key,val in [('title',guide[1]),('link',BASE+url(lang,'learn/'+guide[0])),('guid',BASE+url(lang,'learn/'+guide[0])),('description',guide[2]),('pubDate',format_datetime(published))]:
                SubElement(item,key).text=val
        write(lang+'/feed.xml','<?xml version="1.0" encoding="UTF-8"?>\n'+tostring(rss,encoding='unicode'))

    # The locale root is the shared translated lounge. Editorial and guide
    # pages remain available at their own routes underneath each locale.
    write_live_home_pages(prepare_classic_home())

    sitemap=(ROOT/'sitemap.xml').read_text(encoding='utf-8')
    for lang in LANGS:
        loc=BASE+url(lang,'watch')
        pattern=rf'(<loc>{re.escape(loc)}</loc><lastmod>)[^<]*(</lastmod>)'
        sitemap,count=re.subn(pattern,lambda m:m.group(1)+WATCH_PAGE_UPDATED+m.group(2),sitemap,count=1)
        if count!=1:
            raise ValueError(f'Could not update sitemap lastmod for {loc}')
    for lang in LANGS:
        loc=BASE+url(lang,'markets')
        pattern=rf'(<loc>{re.escape(loc)}</loc><lastmod>)[^<]*(</lastmod>)'
        sitemap,count=re.subn(pattern,lambda m:m.group(1)+MARKET_PAGE_UPDATED+m.group(2),sitemap,count=1)
        if count!=1:
            raise ValueError(f'Could not update sitemap lastmod for {loc}')
    for lang in LANGS:
        guide=next(g for g in COPY[lang]['guides'] if g[0]=='kimchi-premium')
        loc=BASE+url(lang,'learn/kimchi-premium')
        pattern=rf'(<loc>{re.escape(loc)}</loc><lastmod>)[^<]*(</lastmod>)'
        sitemap,count=re.subn(pattern,lambda m:m.group(1)+guide_date(guide)+m.group(2),sitemap,count=1)
        if count!=1:
            raise ValueError(f'Could not update sitemap lastmod for {loc}')
    write('sitemap.xml',sitemap)

    data['copy']=COPY
    data['generatedAt']=generated
    inputs=['scripts/build_discovery.py','scripts/frontend_config.py','scripts/decision-template.html','scripts/discovery_content.py','scripts/stage_content.py','scripts/blind_daily_stock_rounds.py','scripts/discovery-analytics.template.js','data/andy-watch.json','reports/letters.json','classic-home.html']+[item[0] for item in REPORT_METADATA]+ASSETS+TOOL_ASSETS+SHARE_ASSETS
    data['sourceHash']=sha256(b''.join((ROOT/p).read_bytes() for p in inputs)).hexdigest()
    write('data/discovery.json',json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    return {'changed':True,'scope':'localized editorial pages, feeds, sitemap and discovery copy','reportAt':data['reportAt'],'generatedAt':generated}

if __name__=='__main__':
    if '--live-tools-only' in sys.argv:
        print(json.dumps(build_live_tools_only()))
    elif '--editorial-only' in sys.argv:
        print(json.dumps(build_editorial_only()))
    else:
        print(json.dumps(build('--force' in sys.argv)))
