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
from discovery_content import COPY, DECISION_GUIDE_COPY, KIMCHI_HISTORY_COPY, KIMCHI_LIVE_COPY, KIMCHI_LIVE_INTRO, KIMCHI_TOOL_COPY, LANGS, STAGES
from stage_content import WORDS, stage_body
from blind_daily_stock_rounds import ensure_rounds
from frontend_config import read_public_config

for language in LANGS:
    COPY[language]['guides'].append(DECISION_GUIDE_COPY[language])

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {'.css', '.csv', '.html', '.js', '.json', '.md', '.py', '.sql', '.txt', '.xml'}


def stable_bytes(path):
    """Hash text assets identically on Windows and Linux checkouts."""
    path = Path(path)
    raw = path.read_bytes()
    return raw.replace(b'\r\n', b'\n') if path.suffix.lower() in TEXT_SUFFIXES else raw


def normalize_conflicting_justin_letter(letters):
    """Do not publish opposing current regime labels as a single Justin verdict."""
    for message in letters.get('messages', []):
        if message.get('cls') != 'justin':
            continue
        body = str(message.get('body') or '')
        kpi = message.get('kpi') or {}
        value = str(kpi.get('value') or '')
        note = str(kpi.get('note') or '')
        body_allows, body_blocks = '진입 허용' in body, any(x in body for x in ('진입 차단', '진입 제한'))
        value_allows, value_blocks = '진입 허용' in value, any(x in value for x in ('진입 차단', '진입 제한'))
        note_allows, note_blocks = '판정 허용' in note, any(x in note for x in ('판정 차단', '판정 제한'))
        conflict = (body_allows and (value_blocks or note_blocks)) or (body_blocks and (value_allows or note_allows)) or (value_allows and note_blocks) or (value_blocks and note_allows)
        if conflict:
            message['body'] = '현재 표시된 11월 예측값은 10월 28일까지의 데이터로 계산한 임시값입니다. 데이터가 정상적으로 수집되어 재학습이 완료되면 새 예측값으로 자동 교체됩니다.'
            kpi.update(value='임시 판정', note='10/28 데이터 기준 · 재학습 후 자동 갱신', tone='flat')
            message['kpi'] = kpi
    return letters


BASE = 'https://tapelounge.com'
HOME_OG_VERSION = '20261103'
HOME_OG_ALT = {
    'ko': '모두가 종목과 날짜를 숨긴 같은 오늘의 미국 주식 차트에 도전하고 가상 매매를 보유 결과와 비교하는 Tape Lounge',
    'en': 'Everyone gets the same daily U.S. stock chart with ticker and date hidden, then compares virtual trades with holding at Tape Lounge',
    'zh': 'Tape Lounge 每日同一张美股盲图挑战：隐藏标的和日期，完成模拟交易后与同期持有比较',
    'ja': '全員が銘柄と日付を隠した同じ米国株チャートに挑戦し、模擬売買を同期間保有と比べるTape Lounge',
}
TOOL_OG_ALT = {
    'ko': '검은 배경에 금색 Tape Lounge 로고와 실시간 시세·선물 데스크·온체인·블라인드 차트 게임 안내가 적힌 카드',
    'en': 'Tape Lounge gold wordmark on a dark card, with a Korean tagline for live prices, futures desk, on-chain and blind-chart game',
    'zh': '深色卡片上的金色 Tape Lounge 标志，配有实时行情、合约交易台、链上数据和盲图游戏的韩文标语',
    'ja': '暗いカードに金色の Tape Lounge ロゴ。リアルタイム相場、先物デスク、オンチェーン、ブラインドチャートゲームの韓国語タグライン',
}
# Bump when the localized market index copy or search metadata changes.
MARKET_PAGE_UPDATED = '2026-11-03'
WATCH_PAGE_UPDATED = '2026-11-02'
ASSETS = ['discovery.js', 'discovery.css', 'terminal-nav.js', 'stage.js', 'stage.css', 'stage-community.js', 'site-campaign.js', 'discovery-analytics.js', 'home-language.js', 'lounge-rotation.js', 'kimchi-premium.js', 'kimchi-premium-history.js', 'kimchi-premium.css', 'lounge-app.js']
VERSION = 'd' + sha256(b''.join(stable_bytes(ROOT / p) for p in ASSETS)).hexdigest()[:12]
SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'LINK']
NAMES = ['Bitcoin', 'Ethereum', 'Solana', 'XRP', 'BNB', 'Dogecoin', 'Cardano', 'Chainlink']
TOOL_ASSETS = ['domestic.js', 'domestic-stream.js', 'domestic.css', 'lounge-app.js',
               'chart-analysis-20261101.js', 'chart-analysis.css', 'btc-long-channel.js',
               'chart-share.js', 'chart-share.css', 'blind-daily.js', 'blind-daily-share.js',
               'blind-og-20261101.png',
               'site-campaign.js', 'home-og-ko-20261103.png', 'home-og-en-20261103.png',
               'home-og-zh-20261103.png', 'home-og-ja-20261103.png',
               'decision-og-ko-20261101.png', 'decision-og-en-20261101.png',
               'decision-og-zh-20261101.png', 'decision-og-ja-20261101.png', 'lounge-rotation.js',
               'live-home-locale.js']
SHARE_ASSETS = ['article-share.js', 'article-share.css']
SHARE_VERSION = sha256(b''.join(stable_bytes(ROOT / p) for p in SHARE_ASSETS)).hexdigest()[:12]
TOOL_PAGES = [
    ('domestic', 'domestic', '김프 실시간 비교 · 업비트·빗썸 코인 시세 | Tape Lounge',
     '선택한 업비트·빗썸 원화 시세를 해외 거래소 USDT 가격과 비교해 김프·김치프리미엄, 역프와 거래대금을 확인하세요. Andy 관찰 후보도 표시되며 시세는 약 30초마다 갱신됩니다.'),
    ('desk', 'desk', '비트코인 선물 데스크 · Tape Lounge',
     'BTC 무기한 선물의 추세, 주요 가격대, 펀딩비, 미결제약정과 주문 흐름을 한 화면에서 확인합니다.'),
    ('analysis', 'analysis', '비트코인 장기 채널·차트 분석 · Tape Lounge',
     '비트코인의 장기 선형 채널과 주봉 지지·저항을 살펴보는 차트 분석 자료입니다. 고정 자료의 기준일과 한계를 함께 표시합니다.'),
    ('onchain', 'chain', '비트코인 온체인·멤풀 · Tape Lounge',
     '비트코인 멤풀, 전송 수수료, 새 블록과 공개 온체인 지표로 거래소 밖 네트워크 상황을 살펴봅니다.'),
    ('calendar', 'macro', '미국 경제지표 발표 일정 · Tape Lounge',
     'CPI, 고용, GDP와 FOMC의 공식 발표 일정, 확인된 결과와 발표 이후 비트코인 가격 반응을 한국시간으로 확인합니다.'),
    ('blind', 'game', '미국 주식 차트 게임 | 오늘 모두 같은 차트에 도전 · Tape Lounge',
     '로그인 없이 매일 무료로 모두가 같은 미국 주식 차트에 도전하세요. 종목과 날짜를 숨긴 실제 과거 200거래일을 약 4분간 가상 매매하고, 결과를 같은 기간 매수 후 보유와 비교합니다. 실제 주문은 없습니다.'),
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

def scope_chain_source_credit(text, selected):
    """Keep the inactive on-chain placeholder from polluting unrelated route text."""
    if selected == 'chain':
        return text
    placeholder = '<b>Coin Metrics Community</b> 일일 데이터 연결 대기'
    scoped_placeholder = '<b>온체인 스냅샷</b> 일일 데이터 연결 대기'
    text, count = text.replace(placeholder, scoped_placeholder, 1), text.count(placeholder)
    if count != 1:
        raise ValueError('Could not scope the inactive on-chain source placeholder')
    return text

def tool_page(classic, slug, selected, title, description, lang='ko', live_tools=False):
    """Serve one tab from the shared live-app shell, optionally under a locale route."""
    route = live_app_url(lang, slug) if live_tools else ('/' + slug.rstrip('/') + '/' if slug else '/')
    canonical = BASE + route
    text = classic.replace('data-entry-tab="lounge"', f'data-entry-tab="{selected}"', 1)
    text = scope_chain_source_credit(text, selected)
    if live_tools:
        text = localize_live_navigation(text, lang)
        text = text.replace('<html lang="ko">',
                            f'<html lang="{lang}" data-live-tools-root="/{lang}/tools">', 1)
        text = text.replace('<meta name="robots" content="index,follow">',
                            '<meta name="robots" content="noindex,follow">', 1)
        text = re.sub(r'(<summary[^>]*>)🌐\s*KO(</summary>)',
                      lambda m: m.group(1) + '🌐 ' + lang.upper() + m.group(2), text, count=1)
        locale_js_version = sha256(stable_bytes(ROOT / 'live-home-locale.js')).hexdigest()[:12]
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
        # Social shares of translated routes must preview in that route's language.
        # Use the dedicated game card for Korean; other locales keep localized cards.
        if lang == 'ko':
            image = BASE + '/blind-og-20261101.png'
            image_alt = '종목과 날짜를 숨긴 실제 과거 차트 200거래일을 가상 매매하고 보유 결과와 비교하는 Tape Lounge 블라인드 차트 게임'
        else:
            image = BASE + f'/home-og-{lang}-{HOME_OG_VERSION}.png'
            image_alt = HOME_OG_ALT[lang]
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
    text = defer_home_shell_styles(text, selected)
    text = with_open_graph_locale(text, lang)
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
            (r'<meta\s+property=["\']og:image:alt["\'][^>]*>',
             f"<meta property='og:image:alt' content='{e(TOOL_OG_ALT['ko'], quote=True)}'>"),
            (r'<meta\s+name=["\']twitter:card["\'][^>]*>',
             "<meta name='twitter:card' content='summary_large_image'>"),
            (r'<meta\s+name=["\']twitter:image["\'][^>]*>',
             f"<meta name='twitter:image' content='{BASE}/og.png'>"),
            (r'<meta\s+name=["\']twitter:image:alt["\'][^>]*>',
             f"<meta name='twitter:image:alt' content='{e(TOOL_OG_ALT['ko'], quote=True)}'>"),
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
    'ko': ('비트코인 과거 차트 매매 연습 | 그때 나라면? · Tape Lounge', '과거 BTC 차트에서 12번 판단하고 다음 5일을 확인하세요. 1D·4H·1H 봉, 전일 공포·탐욕과 당시 펀딩비를 살펴보고, 직전 7일 안에 FOMC 결정이 있으면 발표된 조치와 목표 금리 범위도 확인합니다. 같은 구간 보유·낙폭·수수료와 비교하는 모의 연습입니다.'),
    'en': ('What Would You Have Done? BTC Decision Practice · Tape Lounge', 'Practice 12 historical BTC decisions with 1D, 4H and 1H candles, prior-day Fear & Greed and historical funding. See an FOMC action and target range when a decision was announced in the preceding seven days; reveal five days, then compare with buy and hold, drawdown and fees. Paper only.'),
    'zh': ('如果当时是你？BTC决策练习 · Tape Lounge', '在比特币历史行情中进行12次判断，查看1D、4H、1H图表、前一日恐惧与贪婪指数及历史资金费率。若此前7天内有FOMC决议，还可查看公布的措施与目标利率区间。揭晓后续五天，并比较收益、同期持有、回撤与手续费。仅为模拟练习。'),
    'ja': ('あの時、自分なら？BTC判断練習ゲーム · Tape Lounge', '過去のBTC相場で12回判断し、1D・4H・1H足、前日のFear & Greed、当時のFundingを確認します。直近7日以内にFOMC決定があれば、その措置と目標レンジも表示。5日後の値動きを開き、同期間保有・最大DD・手数料と比較する模擬練習です。'),
}
DECISION_LANDING_COPY = {
    'ko': ('과거 비트코인 차트, 그때 나라면?', '과거 BTC 차트에서 매수·대기·보유·청산을 고르고 다음 5일을 확인하세요. 1D·4H·1H 봉, 전일 공포·탐욕과 당시 펀딩비를 살펴보고, 직전 7일 안에 FOMC 결정이 있으면 발표된 조치와 목표 금리 범위도 확인합니다.'),
    'en': ('What would you have done?', 'Choose buy, wait, hold or exit on a historical BTC chart, then reveal the next five days. Review 1D, 4H and 1H candles, prior-day Fear & Greed and historical funding, plus any FOMC action and target range announced in the preceding seven days.'),
    'zh': ('如果当时是你，会怎么做？', '在BTC历史行情中选择买入、等待、持有或卖出，再揭晓之后五天。可切换1D、4H、1H图表并查看前一日恐惧与贪婪指数、历史资金费率；若此前7天内有FOMC决议，也会显示公布的措施和目标利率区间。'),
    'ja': ('あの時、自分ならどうした？', '過去のBTCチャートで買う・待つ・保有・決済を選び、その後5日間を確認します。1D・4H・1H足、前日のFear & Greed、当時のFundingに加え、直近7日以内にFOMC決定があれば、その措置と目標レンジも振り返れます。'),
}

def decision_url(lang):
    return '/decision/' if lang == 'ko' else f'/{lang}/decision/'

def build_decision_pages():
    template=(ROOT/'scripts/decision-template.html').read_text(encoding='utf-8')
    alternates=''.join(f'<link rel="alternate" hreflang="{lang}" href="{BASE+decision_url(lang)}">' for lang in LANGS)
    alternates+=f'<link rel="alternate" hreflang="x-default" href="{BASE}/decision/">'
    image_alt = {
        'ko': 'Tape Lounge 비트코인 과거 차트 판단 연습. 12번 판단하고 선택마다 다음 5일의 움직임을 확인합니다.',
        'en': 'Tape Lounge BTC decision practice: 12 historical chart decisions, revealed five days at a time.',
        'zh': 'Tape Lounge 比特币历史行情决策练习：12 次选择，每次揭晓后续五天走势。',
        'ja': 'Tape LoungeのBTC判断練習。過去チャートで12回判断し、5日後の値動きを確認。',
    }
    for lang in LANGS:
        title,description=DECISION_COPY[lang]
        landing_title,landing_lead=DECISION_LANDING_COPY[lang]
        image=f'{BASE}/decision-og-{lang}-20261101.png?v=20261101a'
        page=(template.replace('__LANG__',lang).replace('__TITLE__',e(title))
              .replace('__DESCRIPTION__',e(description,quote=True))
              .replace('__INITIAL_TITLE__',e(landing_title))
              .replace('__INITIAL_LEAD__',e(landing_lead))
              .replace('__CANONICAL__',BASE+decision_url(lang)).replace('__ALTERNATES__',alternates)
              .replace('__OG_IMAGE__',image).replace('__OG_IMAGE_ALT__',e(image_alt[lang],quote=True))
              .replace('__ANALYTICS_VERSION__',VERSION))
        write(decision_url(lang).strip('/')+'/index.html',page)
    return {'pages':len(LANGS),'routes':[decision_url(lang) for lang in LANGS]}

LIVE_TAB_SLUGS = {
    'lounge':'', 'game':'blind', 'domestic':'domestic', 'desk':'desk',
    'analysis':'analysis', 'chain':'onchain', 'macro':'calendar', 'chars':'strategists',
}
LIVE_NAV_COPY = {
    'en': {
        'aria':'Lounge sections', 'more':'More', 'moreMenu':'More lounge tools',
        'tabs':{
            'lounge':('Lounge','Main screen with live prices, liquidations and chat'),
            'game':('Blind chart','Practice on a real chart with its ticker and date hidden'),
            'domestic':('Korea','Korean exchange prices, premium, watchlist and Andy’s watchlist'),
            'desk':('Desk','Bitcoin futures trends, key levels, funding and order book'),
            'analysis':('Chart analysis','Long-term Bitcoin channels and chart analysis'),
            'chain':('On-chain','Network fees, open interest and whale transfers'),
            'macro':('Calendar','CPI, jobs, GDP and FOMC dates and results'),
            'chars':('Strategists','Monthly regimes, daily watchlists and operating ledgers'),
        },
        'mobile':{'analysis':'Chart analysis','chain':'On-chain','macro':'Calendar','chars':'Strategists'},
    },
    'zh': {
        'aria':'大厅分区', 'more':'更多', 'moreMenu':'更多大厅工具',
        'tabs':{
            'lounge':('大厅','实时价格、清算和聊天的主页面'),
            'game':('盲图练习','隐藏标的和日期的真实历史图表练习'),
            'domestic':('韩国市场','韩国交易所价格、溢价、自选和 Andy 观察名单'),
            'desk':('交易台','比特币期货趋势、关键价位、资金费率和盘口'),
            'analysis':('图表分析','比特币长期通道与图表分析'),
            'chain':('链上','网络手续费、未平仓合约和大额转账'),
            'macro':('经济日历','CPI、就业、GDP 和 FOMC 日程与结果'),
            'chars':('策略师','月度市场判断、每日观察名单和运行记录'),
        },
        'mobile':{'analysis':'图表分析','chain':'链上','macro':'经济日历','chars':'策略师'},
    },
    'ja': {
        'aria':'ラウンジのセクション', 'more':'もっと見る', 'moreMenu':'その他のラウンジ機能',
        'tabs':{
            'lounge':('ラウンジ','リアルタイム価格・清算・チャットのメイン画面'),
            'game':('ブラインドチャート','銘柄名と日付を隠した実際の過去チャートで練習'),
            'domestic':('韓国市場','韓国取引所の価格・プレミアム・ウォッチリスト・Andyの候補'),
            'desk':('デスク','ビットコイン先物のトレンド・価格帯・資金調達率・板情報'),
            'analysis':('チャート分析','ビットコインの長期チャネルとチャート分析'),
            'chain':('オンチェーン','ネットワーク手数料・未決済建玉・大口送金'),
            'macro':('経済指標','CPI・雇用・GDP・FOMCの日程と結果'),
            'chars':('ストラテジスト','月次の相場判断・日々の候補・運用記録'),
        },
        'mobile':{'analysis':'チャート分析','chain':'オンチェーン','macro':'経済指標','chars':'ストラテジスト'},
    },
}

def localize_live_navigation(text, lang):
    """Keep the shared live-app navigation structure while translating its visible labels."""
    copy = LIVE_NAV_COPY.get(lang)
    if not copy:
        return text

    text, count = re.subn(
        r'(<div\b(?=[^>]*\bclass="tabs")[^>]*\baria-label=")[^"]*(")',
        lambda m: m.group(1) + copy['aria'] + m.group(2), text, count=1)
    if count != 1:
        raise ValueError(f'Could not localize the {lang} live tab-list label')

    found = set()
    def localize_tab(match):
        key = match.group(1)
        if key not in copy['tabs']:
            return match.group(0)
        label, title = copy['tabs'][key]
        opening, body, closing = match.group(0)[:match.group(0).find('>') + 1], match.group(2), '</a>'
        opening, changed = re.subn(r'\btitle="[^"]*"',
                                   lambda _: f'title="{e(title, quote=True)}"',
                                   opening, count=1)
        if changed != 1:
            raise ValueError(f'Could not localize the {lang} {key} tab tooltip')
        body, changed = re.subn(r'(<span class="nm">).*?(</span>)',
                                lambda m: m.group(1) + e(label) + m.group(2),
                                body, count=1, flags=re.S)
        if changed != 1:
            raise ValueError(f'Could not localize the {lang} {key} tab label')
        found.add(key)
        return opening + body + closing

    text = re.sub(r'<a\b[^>]*\bdata-tab="([^"]+)"[^>]*>(.*?)</a>',
                  localize_tab, text, flags=re.S)
    if found != set(copy['tabs']):
        raise ValueError(f'Incomplete {lang} tab set: {sorted(found)}')

    text, count = re.subn(r'(<button\b[^>]*\bid="mobileMoreToggle"[^>]*\baria-label=")[^"]*(")',
                          lambda m: m.group(1) + e(copy['more'], quote=True) + m.group(2),
                          text, count=1)
    if count != 1:
        raise ValueError(f'Could not localize the {lang} mobile more button')
    text, count = re.subn(r'(<span class="nm">)더보기(</span>)',
                          lambda m: m.group(1) + e(copy['more']) + m.group(2),
                          text, count=1)
    if count != 1:
        raise ValueError(f'Could not localize the {lang} mobile more label')
    text, count = re.subn(r'(<nav\b[^>]*\bid="mobileMoreMenu"[^>]*\baria-label=")[^"]*(")',
                          lambda m: m.group(1) + e(copy['moreMenu'], quote=True) + m.group(2),
                          text, count=1)
    if count != 1:
        raise ValueError(f'Could not localize the {lang} mobile menu label')

    mobile_found = set()
    def localize_mobile_item(match):
        key = match.group(1)
        label = copy['mobile'].get(key)
        if label is None:
            return match.group(0)
        body, changed = re.subn(r'(<span>).*?(</span>)',
                                lambda m: m.group(1) + e(label) + m.group(2),
                                match.group(2), count=1, flags=re.S)
        if changed != 1:
            raise ValueError(f'Could not localize the {lang} mobile {key} label')
        mobile_found.add(key)
        return match.group(0)[:match.group(0).find('>') + 1] + body + '</a>'

    text = re.sub(r'<a\b[^>]*\bdata-mobile-nav="([^"]+)"[^>]*>(.*?)</a>',
                  localize_mobile_item, text, flags=re.S)
    if mobile_found != set(copy['mobile']):
        raise ValueError(f'Incomplete {lang} mobile menu: {sorted(mobile_found)}')
    return text

LIVE_PAGE_COPY = {
    'en': {
        '': ('U.S. Stock Chart Game & Live Crypto Data | Tape Lounge', 'No login needed: play a free daily U.S. stock chart game with ticker and dates hidden. Trade 200 real daily candles, then compare with buy-and-hold. Live crypto markets, too.'),
        'blind': ('Same chart, daily challenge | Tape Lounge', 'Everyone gets the same U.S. stock chart each day. Trade 200 hidden sessions in about four minutes, then compare with buy-and-hold. Play solo or with a friend; no real orders.'),
        'domestic': ('Korean Crypto Prices & Kimchi Premium | Tape Lounge', 'Compare live Upbit and Bithumb KRW prices with overseas USDT spot markets; the premium uses the selected exchange’s latest USDT/KRW trade.'),
        'desk': ('Bitcoin futures desk | Tape Lounge', 'Review Bitcoin futures context, funding, open interest and order flow.'),
        'analysis': ('Bitcoin chart analysis | Tape Lounge', 'Explore Bitcoin long-term channels and chart indicators.'),
        'onchain': ('On-chain market view | Tape Lounge', 'Follow Bitcoin network activity and public on-chain indicators.'),
        'calendar': ('Economic calendar | Tape Lounge', 'Review major economic releases and market context.'),
        'strategists': ('Strategist reports | Tape Lounge', 'Read the public market observations and research notes.'),
    },
    'zh': {
        '': ('美股历史图表练习游戏与实时行情 | Tape Lounge', '无需登录，免费挑战每日美股图表。隐藏代码和日期，在真实历史日K线上完成200步交易，再与同期持有比较；另有实时加密行情。'),
        'blind': ('每日同一张盲图 | Tape Lounge', '每天所有人挑战同一张美股图表。隐藏标的和日期，约4分钟交易200个历史交易日，再与同期持有比较。可独自或与朋友游玩，不会真实下单。'),
        'domestic': ('韩国加密货币行情与溢价 | Tape Lounge', '比较 Upbit、Bithumb 的韩元实时价格与海外 USDT 现货价格，并说明溢价换算基准。'),
        'desk': ('比特币合约行情台 | Tape Lounge', '查看比特币合约背景、资金费率、持仓量与订单流。'),
        'analysis': ('比特币图表分析 | Tape Lounge', '查看比特币长期通道与图表指标。'),
        'onchain': ('链上市场观察 | Tape Lounge', '查看比特币网络活动和公开链上指标。'),
        'calendar': ('经济日历 | Tape Lounge', '查看重要经济数据发布与市场背景。'),
        'strategists': ('策略师报告 | Tape Lounge', '阅读公开市场观察与研究记录。'),
    },
    'ja': {
        '': ('米国株チャート売買練習ゲームとリアルタイム相場 | Tape Lounge', 'ログイン不要の無料・毎日チャートゲーム。銘柄名と日付を隠した実際の米国株の日足200本で売買し、同期間の保有結果と比較できます。暗号資産の相場も確認できます。'),
        'blind': ('毎日同じチャートに挑戦 | Tape Lounge', '毎日全員が同じ米国株チャートに挑戦。銘柄と日付を伏せた過去200営業日を約4分で売買し、同期間の買い持ちと比較。ひとりでも友人とでも遊べ、実注文はありません。'),
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

OG_LOCALES = {'ko': 'ko_KR', 'en': 'en_US', 'zh': 'zh_CN', 'ja': 'ja_JP'}

def with_open_graph_locale(text, lang):
    """Keep social previews aligned with the page language and its alternates."""
    text = re.sub(r'\s*<meta property="og:locale(?::alternate)?" content="[^"]*">', '', text)
    tags = [f'<meta property="og:locale" content="{OG_LOCALES[lang]}">']
    tags.extend(
        f'<meta property="og:locale:alternate" content="{OG_LOCALES[code]}">'
        for code in LANGS if code != lang
    )
    return text.replace('</head>', ''.join(tags) + '\n</head>', 1)

def prepare_classic_home():
    """Prepare the shared lounge shell for the public root and tool entries."""
    classic=(ROOT/'classic-home.html').read_text(encoding='utf-8')
    app_version=sha256(stable_bytes(ROOT/'lounge-app.js')).hexdigest()[:12]
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
    for asset in ['blind-daily.js','blind-daily-share.js','domestic.js']:
        asset_version=sha256(stable_bytes(ROOT/asset)).hexdigest()[:12]
        pattern=rf'(<script\b[^>]*\bsrc="/?{re.escape(asset)}\?v=)[^"]+("[^>]*></script>)'
        classic, asset_count = re.subn(pattern,lambda m:m.group(1)+asset_version+m.group(2),classic,count=1)
        if asset_count != 1:
            raise ValueError(f'Could not refresh the {asset} script version in the lounge template')
    write('classic-home.html', classic)

    viewport='<meta name="viewport" content="width=device-width, initial-scale=1">'
    if '<head>' not in classic or viewport not in classic:
        raise ValueError('The archived pre-redesign homepage is missing its expected head metadata')
    classic=classic.replace('<head>','<head>\n<base href="/">',1)
    home_language_version=sha256(stable_bytes(ROOT/'home-language.js')).hexdigest()[:12]
    classic=classic.replace('</head>',f'<script defer src="/home-language.js?v={home_language_version}"></script>\n</head>',1)
    classic=classic.replace('<meta name="robots" content="noindex,follow">','<meta name="robots" content="index,follow">',1)
    classic=classic.replace(viewport,viewport+'\n<link rel="canonical" href="https://tapelounge.com/">',1)
    return classic

def website_schema():
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'Tape Lounge',
        'alternateName': ['테이프라운지', 'tapelounge.com'],
        'url': BASE + '/',
    }

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
    page_schema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': title,
        'description': description,
        'url': public_canonical,
        'inLanguage': lang,
        'isPartOf': {'@type': 'WebSite', 'url': BASE + '/'},
    }
    structured_data = json.dumps([website_schema(), page_schema], ensure_ascii=False,
                                 separators=(',', ':'))
    schema_tag = f'<script type="application/ld+json">{structured_data}</script>'
    return text.replace('</head>', alternates + schema_tag + '\n</head>', 1)

def write_live_home_pages(classic):
    """Write the canonical shared lounge home for Korean and all translated locales."""
    home_shell = defer_home_shell_styles(classic)
    alternates = ''.join(
        f'<link rel="alternate" hreflang="{lang}" href="{BASE + locale_home_url(lang)}">'
        for lang in LANGS
    ) + f'<link rel="alternate" hreflang="x-default" href="{BASE}/">'
    site_schema = json.dumps(website_schema(), ensure_ascii=False, separators=(',', ':'))
    site_schema_tag = f'<script type="application/ld+json">{site_schema}</script>'
    korean_home = home_shell.replace('</head>', alternates + site_schema_tag + '\n</head>', 1)
    korean_home = with_open_graph_locale(korean_home, 'ko')
    korean_home = scope_chain_source_credit(korean_home, 'lounge')
    write('index.html', korean_home)
    write('ko/index.html', korean_home)
    for lang in LIVE_PAGE_COPY:
        write(f'{lang}/index.html', localized_live_home(home_shell, lang))

def defer_home_shell_styles(home, selected='lounge'):
    """Keep the selected feature styled immediately; preload other panel styles without blocking first paint."""
    critical = {
        'domestic': 'domestic.css',
        'analysis': 'chart-analysis.css',
        'chars': 'strategists.css',
    }.get(selected)
    for asset in ('domestic.css', 'chart-analysis.css', 'chart-share.css', 'strategists.css'):
        if asset == critical:
            continue
        preload_pattern = rf'<link rel="preload" as="style" href="{re.escape(asset)}\?v=[^"]+"'
        if re.search(preload_pattern, home):
            continue
        pattern = rf'<link rel="stylesheet" href="({re.escape(asset)}\?v=[^"]+)">'
        def replace(match):
            href = match.group(1)
            return (
                f'<link rel="preload" as="style" href="{href}" '
                "onload=\"this.onload=null;this.rel='stylesheet'\">"
                f'<noscript><link rel="stylesheet" href="{href}"></noscript>'
            )
        home, count = re.subn(pattern, replace, home, count=1)
        if count != 1:
            raise ValueError(f'Could not defer the {asset} stylesheet in the lounge home')
    return home

def build_live_tools_only():
    """Regenerate the shared Korean live-lounge shell and its localized entries."""
    classic=prepare_classic_home()
    build_decision_pages()
    write_live_home_pages(classic)
    terminal=classic.replace('<meta name="robots" content="index,follow">','<meta name="robots" content="noindex,follow">',1)
    write('terminal/index.html', defer_home_shell_styles(terminal))
    for slug, selected, title, description in TOOL_PAGES:
        write(f'{slug}/index.html', tool_page(classic, slug, selected, title, description))
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

def kimchi_history_chart(lang):
    t=KIMCHI_HISTORY_COPY[lang]
    labels=e(json.dumps(t,ensure_ascii=False,separators=(',',':')),quote=True)
    sources=(f'<a href="https://apidocs.bithumb.com/reference/%EC%9D%BCday-%EC%BA%94%EB%93%A4-%EC%A1%B0%ED%9A%8C" rel="noopener">Bithumb</a> · '
             f'<a href="https://developers.binance.com/en/docs/products/spot/rest-api" rel="noopener">Binance</a> · '
             f'<a href="https://frankfurter.dev/" rel="noopener">Frankfurter</a>')
    return f'''<section class="kp-history" data-kp-history data-copy="{labels}" aria-labelledby="kp-history-title"><header class="kp-head"><p class="eyebrow">{e(t['kicker'])}</p><h2 id="kp-history-title">{e(t['title'])}</h2><p>{e(t['intro'])}</p></header><div class="kp-history-controls" role="group" aria-label="{e(t['rangeLabel'],quote=True)}"><button type="button" data-kp-days="30" aria-pressed="false">{e(t['range30'])}</button><button type="button" data-kp-days="90" aria-pressed="true">{e(t['range90'])}</button></div><div class="kp-history-summary"><article><span>{e(t['seriesUsd'])}</span><strong data-kp-latest-usd>—</strong></article><article><span>{e(t['seriesUsdt'])}</span><strong data-kp-latest-usdt>—</strong></article><p data-kp-asof></p></div><div class="kp-chart-wrap"><svg class="kp-history-chart" data-kp-chart viewBox="0 0 760 330" role="img" aria-label="{e(t['chartDescription'],quote=True)}"><title>{e(t['chartDescription'])}</title></svg></div><div class="kp-history-legend"><span><i class="kp-legend-usd"></i>{e(t['seriesUsd'])}</span><span><i class="kp-legend-usdt"></i>{e(t['seriesUsdt'])}</span></div><p class="kp-history-status" data-kp-status role="status" aria-live="polite">{e(t['pending'])}</p><details class="kp-history-method"><summary>{e(t['sourceTitle'])}</summary><p>{e(t['method'])}</p><p>{e(t['disclaimer'])}</p><p class="kp-sources">{sources}</p></details><ul class="sr-only" data-kp-table aria-label="{e(t['tableCaption'],quote=True)}"></ul></section>'''

def kimchi_faq(lang):
    t=KIMCHI_TOOL_COPY[lang]
    items=''.join(f'<details><summary>{e(question)}</summary><p>{e(answer)}</p></details>' for question,answer in t['faqs'])
    return f'<section class="kp-faq"><h2>{e(t["faqTitle"])}</h2>{items}</section>'

def guide_date(guide):
    return guide[4] if len(guide)>4 else '2026-10-22'

def guide_modified(guide):
    return guide[5] if len(guide)>5 else guide_date(guide)

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
    if guide and guide[0]=='blind-chart-practice':
        social_image=f'{BASE}/home-og-{lang}-{HOME_OG_VERSION}.png'
        social_image_alt=HOME_OG_ALT[lang]
        social_image_tags=(f'<meta property="og:image" content="{social_image}"><meta property="og:image:alt" content="{e(social_image_alt,quote=True)}">'
                           f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
                           f'<meta name="twitter:image" content="{social_image}"><meta name="twitter:image:alt" content="{e(social_image_alt,quote=True)}">')
    elif guide and guide[0]=='bitcoin-decision-practice':
        social_image=f'{BASE}/decision-og-{lang}-20261101.png?v=20261101a'
        social_image_alt={
            'ko':'과거 비트코인 차트에서 12번 판단하고 5일 뒤를 확인하는 Tape Lounge 모의 연습',
            'en':'Tape Lounge BTC decision practice: 12 historical chart decisions, with five days revealed after each choice.',
            'zh':'Tape Lounge比特币历史行情判断练习：进行12次选择，每次揭晓之后五天走势。',
            'ja':'Tape LoungeのBTC過去チャート判断練習。12回判断し、その後5日間の値動きを確認します。',
        }[lang]
        social_image_tags=(f'<meta property="og:image" content="{social_image}"><meta property="og:image:alt" content="{e(social_image_alt,quote=True)}">'
                           f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
                           f'<meta name="twitter:image" content="{social_image}"><meta name="twitter:image:alt" content="{e(social_image_alt,quote=True)}">')
    else:
        social_image_alt=TOOL_OG_ALT[lang]
        social_image_tags=(f'<meta property="og:image" content="{BASE}/og.png"><meta property="og:image:alt" content="{e(social_image_alt,quote=True)}">'
                           f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
                           f'<meta name="twitter:image" content="{BASE}/og.png"><meta name="twitter:image:alt" content="{e(social_image_alt,quote=True)}">')
    nav=''.join(link(url(lang,p),c['nav'][i], 'selected' if page==p or (p=='learn' and guide) else '') for i,p in enumerate(['','markets','watch','learn']))
    languages=''.join(f'<a href="{locale_url(l,page)}" lang="{l}" hreflang="{l}" data-language="{l}" '+('aria-current="true"' if l==lang else '')+f'>{label}</a>' for l,label in LANGS.items())
    alts=''.join(f'<link rel="alternate" hreflang="{l}" href="{BASE+locale_url(l,page)}">' for l in LANGS)+f'<link rel="alternate" hreflang="x-default" href="{BASE+locale_url("ko",page)}">'
    schema=[{'@context':'https://schema.org','@type':'WebSite','name':'Tape Lounge','url':BASE+'/'}, {'@context':'https://schema.org','@type':'WebPage','name':search_title,'description':search_desc,'url':current,'inLanguage':lang,'isPartOf':{'@type':'WebSite','url':BASE+'/'}}]
    if guide:
        schema.append({
            '@context':'https://schema.org',
            '@type':'BreadcrumbList',
            'itemListElement':[
                {'@type':'ListItem','position':1,'name':c['nav'][3],
                 'item':BASE+url(lang,'learn')},
                {'@type':'ListItem','position':2,'name':title},
            ],
        })
        schema.append({'@context':'https://schema.org','@type':'Article','headline':title,'description':desc,'inLanguage':lang,'datePublished':article_date,'dateModified':guide_modified(guide),'author':{'@type':'Organization','name':'Tape Lounge','url':BASE+'/ko/about/'},'mainEntityOfPage':current})
        if guide[0]=='kimchi-premium':
            schema.append({'@context':'https://schema.org','@type':'FAQPage','mainEntity':[{'@type':'Question','name':question,'acceptedAnswer':{'@type':'Answer','text':answer}} for question,answer in KIMCHI_TOOL_COPY[lang]['faqs']]})
    stamp=f'<span class="report-stamp">{e(c["report"])} <time datetime="{data["reportAt"]}">{data["reportAt"][:16]} UTC</time></span>'
    filters=f'<div class="filter-row" role="group" aria-label="{e(c["radar"])}">'+''.join(f'<button data-filter="{value}" aria-pressed="{"true" if value=="all" else "false"}">{e(c[key])}</button>' for value,key in [('all','allStages'),('지지 확인','confirmed'),('눌림 대기','waiting'),('1d','daily'),('saved','saved'),('archive','archive')])+'</div>'
    pulse=f'<section class="pulse"><header><span class="eyebrow">01 / {e(c["chart"])}</span><div class="chart-assets">'+''.join(f'<button data-chart-symbol="{s}" aria-pressed="{"true" if s=="BTC" else "false"}">{s}</button>' for s in SYMBOLS[:4])+f'</div></header><div class="pulse-price"><strong id="pulse-price">—</strong><span id="pulse-change"></span></div><div id="pulse-chart" role="img" aria-label="{e(c["chart"])}"><p>{e(c["loading"])}</p></div><div class="pulse-bottom"><div class="chart-ranges">'+''.join(f'<button data-range="{r}" aria-pressed="{"true" if r=="7d" else "false"}">{r.upper()}</button>' for r in ['1d','7d','30d'])+f'</div>{link("/terminal/#desk",c["openChart"]+" ↗")}</div><p class="data-note" id="chart-status">{e(c["chartNote"])}</p></section>'
    sidebar=f'<aside class="briefing"><span class="eyebrow">THE READING ROOM</span><h2>{e(c["research"])}</h2>'+''.join(f'<a class="brief-row" href="{url(lang,"research")}"><span>0{i+1}</span><div><b>{e(c["roles"][i])}</b><p>{e(c["roleCopy"][i])}</p></div><span>↗</span></a>' for i in range(3))+'</aside>'
    if page=='':
        body=f'<section class="opening"><div><p class="eyebrow">THE MARKET, WITHOUT THE NOISE.</p><h1>{e(c["headline"]).replace(chr(10),"<br>")}</h1></div><div class="opening-aside"><p>{e(c["intro"])}</p>{link(url(lang,"markets"),c["market"]+" ↗","text-link")}</div></section><div class="lead-grid">{pulse}{sidebar}</div>'
        body+=f'<section class="return-band"><span>↳</span><div><h2>{e(c["returnTitle"])}</h2><p id="return-copy">{e(c["returnEmpty"])}</p></div>{link(url(lang,"watch")+"?saved=1",c["saved"]+" ↗")}</section>'
        body+=f'<section>{section_head(c["market"],c["all"],url(lang,"markets"))}{market_table(lang,True)}<p class="data-note">{link(url(lang,"learn/kimchi-premium")+"#kp-history-title",c["guides"][0][1]+" ↗")}</p></section>'
        body+=f'<div class="lower-grid"><section>{section_head(c["radar"],c["all"],url(lang,"watch"))}{stamp}<div id="radar-rows">{radar_rows(data,lang,6)}</div><p class="data-note">{e(c["radarNote"])}</p></section><aside class="watch-panel"><span class="eyebrow">YOUR CORNER</span><h2>{e(c["save"])}</h2><p>{e(c["watchIntro"])}</p><div id="saved-rows"></div>{link(url(lang,"watch"),c["all"]+" ↗")}</aside></div>'
        body+=f'<section class="session-section">{section_head(c["session"])}<div class="session-grid" id="session-rows"><p>{e(c["loading"])}</p></div><p class="data-note">{e(c["sessionNote"])}</p></section><section>{section_head(c["learn"],c["all"],url(lang,"learn"))}{guide_cards(lang)}</section>'
    elif page=='markets':
        body=f'<div class="page-opening"><p class="eyebrow">MARKET INDEX</p><h1>{e(title)}</h1><p>{e(desc)}</p></div><div class="market-controls"><label>{e(c["find"])}<input id="market-search" type="search" placeholder="BTC, ETH…"></label><div class="filter-row"><button id="market-saved" aria-pressed="false">☆ {e(c["saved"])}</button><select id="market-sort" aria-label="{e(c["volume"])}"><option value="volume">{e(c["volume"])}</option><option value="change">{e(c["change"])}</option><option value="premium">{e(c["premium"])}</option></select></div></div>{market_table(lang)}<button id="market-more" hidden>{e(c["all"])}</button><div class="method-inline"><p>{e(c["fxNote"])}</p><p id="fx-status">{e(c["fxDate"])}: —</p>{link(url(lang,"learn/kimchi-premium")+"#kp-history-title",c["guides"][0][1]+" ↗")}</div>'
    elif page=='watch':
        body=f'<div class="page-opening"><p class="eyebrow">THE OBSERVATION DESK</p><h1>{e(title)}</h1><p>{e(desc)}</p></div><div id="watch-asset" hidden><h2 id="watch-asset-title"></h2>{pulse}</div><div class="radar-toolbar"><label>{e(c["find"])}<input type="search" id="radar-search" placeholder="BTC, ETH…"></label>{stamp}</div>{filters}<div id="radar-rows">{radar_rows(data,lang)}</div><p id="radar-empty" hidden>{e(c["empty"])}</p><p class="method-inline">{e(c["radarNote"])}</p>{link("/reports/andy_scan.html",c["original"]+" ↗")}<section>{section_head(c["next"])}{guide_cards(lang)}</section>'
    elif page=='research':
        body=f'<div class="page-opening"><p class="eyebrow">RESEARCH ROOM / AI PERSONAS</p><h1>{e(title)}</h1><p>{e(desc)}</p></div>{reports(lang)}<section>{section_head(c["next"])}<div class="tool-links">{link(url(lang,"watch"),c["radar"]+" ↗")}{link("/terminal/#onchain","On-chain ↗")}{link("/terminal/#calendar","Calendar ↗")}{link("/terminal/#analysis","BTC channels ↗")}</div></section>'
    elif guide:
        practice_cta=''
        if guide[0]=='blind-chart-practice':
            game_labels={'ko':'오늘의 판 플레이하기 ↗','en':'Play today’s market replay ↗','zh':'开始今天的行情回放 ↗','ja':'今日の相場リプレイを始める ↗'}
            game_path='/blind/' if lang=='ko' else f'/{lang}/tools/blind/'
            practice_cta=f'<p>{link(game_path+"?daily=1",game_labels[lang])}</p>'
        elif guide[0]=='bitcoin-decision-practice':
            decision_labels={'ko':'과거 BTC 판단 연습 시작하기 ↗','en':'Try the BTC decision round ↗','zh':'开始BTC历史判断练习 ↗','ja':'BTCの過去チャート判断を始める ↗'}
            decision_paths={'ko':'/decision/','en':'/en/decision/','zh':'/zh/decision/','ja':'/ja/decision/'}
            practice_cta=f'<p>{link(decision_paths[lang],decision_labels[lang])}</p>'
        decision_copy={
            'ko':('한 판 더, 다른 방식으로 판단하기','1D·4H·1H 차트와 전일 공포·탐욕, 당시 펀딩비를 살펴보고 매수·대기·보유·청산을 선택합니다. 뉴스 원문이나 커뮤니티 게시물은 포함하지 않습니다.','그때 나라면? 시작 ↗'),
            'en':('Try a different kind of market decision','Review 1D, 4H and 1H candles, prior-day Fear & Greed and historical funding before choosing to buy, wait, hold or exit. Historical headlines and community posts are not included.','Play “What would you have done?” ↗'),
            'zh':('换一种方式练习市场判断','查看1D、4H、1H K线、前一日恐惧与贪婪指数及当时的资金费率，再选择买入、等待、持有或退出。不包含历史新闻原文或社区帖子。','开始“如果当时是你？” ↗'),
            'ja':('別の形で相場判断を練習する','1D・4H・1H足、前日の恐怖・強欲指数、当時の資金調達率を見て、買い・待機・保有・決済を選びます。過去のニュース記事やコミュニティ投稿は含みません。','「あの時、自分なら？」を始める ↗'),
        }[lang]
        decision_path={'ko':'/decision/','en':'/en/decision/','zh':'/zh/decision/','ja':'/ja/decision/'}[lang]
        decision_callout=(f'<section class="learn-callout" aria-labelledby="decision-game-title"><p class="eyebrow">ANOTHER TABLE</p><h2 id="decision-game-title">{e(decision_copy[0])}</h2><p>{e(decision_copy[1])}</p>{link(decision_path,decision_copy[2])}</section>' if guide[0]=='blind-chart-practice' else '')
        kimchi=guide[0]=='kimchi-premium'
        market_cta_copy={
            'ko':('실시간 김프 시세표','업비트 원화 시세를 해외 USDT 가격과 USD/KRW 참고환율로 비교하고, 거래대금과 테더 기준 차이도 함께 확인하세요.','실시간 시세표 보기 ↗'),
            'en':('Compare the live Korean premium','Compare Upbit KRW prices with overseas USDT quotes using the USD/KRW reference rate, alongside turnover and the separate USDT/KRW comparison.','Open the live table ↗'),
            'zh':('查看实时韩元市场溢价','按 USD/KRW 参考汇率比较 Upbit 韩元报价与海外 USDT 价格，并查看成交额及 USDT/KRW 的单独差异。','打开实时行情表 ↗'),
            'ja':('韓国市場のプレミアムをリアルタイムで比較','UpbitのKRW価格を海外USDT価格とUSD/KRW参考レートで比較し、売買代金とUSDT/KRW基準の差も確認できます。','リアルタイムの一覧を見る ↗'),
        }[lang]
        market_cta=(f'<section class="learn-callout" aria-labelledby="kimchi-live-title"><p class="eyebrow">LIVE MARKET</p><h2 id="kimchi-live-title">{e(market_cta_copy[0])}</h2><p>{e(market_cta_copy[1])}</p>{link(url(lang,"markets"),market_cta_copy[2])}</section>' if kimchi else '')
        tool=kimchi_calculator(lang) if kimchi else ''
        history=kimchi_history_chart(lang) if kimchi else ''
        faq=kimchi_faq(lang) if kimchi else ''
        body=f'<article class="guide"><nav class="breadcrumbs">{link(url(lang,"learn"),c["nav"][3])} / FIELD NOTES</nav><p class="eyebrow">TAPE LOUNGE / EDITORIAL</p><h1>{e(title)}</h1><p class="standfirst">{e(desc)}</p><p class="byline">Tape Lounge · <time datetime="{article_date}">{article_date}</time></p>{practice_cta}{tool}{history}'+''.join(f'<section><span class="paragraph-number">0{i+1}</span><p>{e(p)}</p></section>' for i,p in enumerate(guide[3]))+decision_callout+faq+market_cta+f'<aside class="article-end">{practice_cta}{e(c["disclaimer"])}<p>{link(url(lang,"about"),c["method"]+" ↗")}</p>{guide_share(lang)}</aside></article><section>{section_head(c["next"])}{guide_cards(lang, exclude=guide[0])}</section>'
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
        app_scripts+=f'<script defer src="/kimchi-premium-history.js?v={VERSION}"></script>'
    if page=='':
        nav=''.join(link(url(lang,p),WORDS[lang]['home'] if i==0 else c['nav'][i], 'selected' if i==0 else '') for i,p in enumerate(['','markets','watch','learn']))
    app_scripts=f'<script src="/site-campaign.js?v={VERSION}"></script>'+app_scripts
    return f'''<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(search_title)} — Tape Lounge</title><meta name="description" content="{e(search_desc,quote=True)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{current}">{alts}
<meta property="og:type" content="{'article' if guide else 'website'}"><meta property="og:title" content="{e(search_title,quote=True)} — Tape Lounge"><meta property="og:description" content="{e(search_desc,quote=True)}"><meta property="og:url" content="{current}">{social_image_tags}<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0d1114"><meta name="referrer" content="strict-origin-when-cross-origin">
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
    fingerprint=sha256(b''.join(stable_bytes(ROOT/p) for p in inputs)).hexdigest()
    target=ROOT/'data/discovery.json'
    if not force and not daily_changed and not report_metadata_changed and target.exists() and read('data/discovery.json').get('sourceHash')==fingerprint:
        return {'changed':False}
    data=read('data/andy-watch.json'); letters=normalize_conflicting_justin_letter(read('reports/letters.json'))
    generated=datetime.now(timezone.utc).isoformat()
    generated_kst=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
    tool_hash=sha256(stable_bytes(ROOT/'classic-home.html')+json.dumps(TOOL_PAGES,ensure_ascii=False).encode()+b''.join(stable_bytes(ROOT/p) for p in TOOL_ASSETS)).hexdigest()
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
    terminal=defer_home_shell_styles(terminal)
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
                lastmod=guide_modified(guide) if guide else '2026-10-22'
            else:
                lastmod='2026-10-22'
            SubElement(entry,'lastmod').text=lastmod
    for name in ['andy_scan','madam_daily','justin_lab']:
        report_html=(ROOT/'reports'/f'{name}.html').read_text(encoding='utf-8')
        report_date=re.search(r'(\d{4}-\d{2}-\d{2}) \d{2}:\d{2} KST',report_html)
        if not report_date:
            raise ValueError(f'Could not find the visible publication date for reports/{name}.html')
        entry=SubElement(sitemap,'url');SubElement(entry,'loc').text=BASE+'/reports/'+name+'.html'
        SubElement(entry,'lastmod').text=report_date.group(1)
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
    ensure_report_metadata()
    data=read('data/discovery.json')
    letters=normalize_conflicting_justin_letter(read('reports/letters.json'))
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
        for guide in COPY[lang]['guides']:
            loc=BASE+url(lang,'learn/'+guide[0])
            pattern=rf'(<loc>{re.escape(loc)}</loc><lastmod>)[^<]*(</lastmod>)'
            sitemap,count=re.subn(pattern,lambda m:m.group(1)+guide_modified(guide)+m.group(2),sitemap,count=1)
            if count==0:
                closing=sitemap.rfind('</urlset>')
                if closing<0:
                    raise ValueError('Could not find the closing sitemap urlset element')
                entry=f'<url><loc>{loc}</loc><lastmod>{guide_modified(guide)}</lastmod></url>'
                sitemap=sitemap[:closing]+entry+sitemap[closing:]
            elif count!=1:
                raise ValueError(f'Could not update sitemap lastmod for {loc}')
    write('sitemap.xml',sitemap)

    data['copy']=COPY
    data['generatedAt']=generated
    inputs=['scripts/build_discovery.py','scripts/frontend_config.py','scripts/decision-template.html','scripts/discovery_content.py','scripts/stage_content.py','scripts/blind_daily_stock_rounds.py','scripts/discovery-analytics.template.js','data/andy-watch.json','reports/letters.json','classic-home.html']+[item[0] for item in REPORT_METADATA]+ASSETS+TOOL_ASSETS+SHARE_ASSETS
    data['sourceHash']=sha256(b''.join(stable_bytes(ROOT/p) for p in inputs)).hexdigest()
    write('data/discovery.json',json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    return {'changed':True,'scope':'localized editorial pages, feeds, sitemap and discovery copy','reportAt':data['reportAt'],'generatedAt':generated}

if __name__=='__main__':
    if '--live-tools-only' in sys.argv:
        print(json.dumps(build_live_tools_only()))
    elif '--editorial-only' in sys.argv:
        print(json.dumps(build_editorial_only()))
    else:
        print(json.dumps(build('--force' in sys.argv)))
