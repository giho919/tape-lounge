"""Reviewed, original multilingual editorial copy. No runtime translation service."""
LANGS = {'ko': '한국어', 'en': 'English', 'zh': '中文', 'ja': '日本語'}
COPY = {
'ko': {
'nav':['오늘','마켓','레이더','읽을거리'], 'tools':'라이브 라운지', 'edition':'시장을 읽는 또 하나의 시선',
'headline':'소음은 덜고,\n흐름은 더 선명하게.', 'intro':'가격이 움직인 이유를 찾고, 다음에 볼 종목을 남겨두세요. 시장 · 추세 · 기록을 연결하는 작은 리서치룸.',
'market':'시장 한눈에', 'marketIntro':'주요 코인의 가격과 거래량, 한국 시장의 가격 차이를 한곳에서 비교합니다.', 'marketSeoTitle':'김프 실시간 시세표: 코인 가격·거래량·김치프리미엄', 'marketSeoDescription':'업비트 원화 가격과 바이낸스 USDT 현물가를 비교해 BTC·ETH 등 주요 코인의 김치 프리미엄을 확인하세요. 24시간 등락·거래대금과 USD/KRW 기준환율을 60초마다 갱신합니다.',
'radar':'Andy의 레이더', 'radarIntro':'돌파보다 중요한 건 그다음. 눌림을 견딘 자리와 이후의 변화를 관찰합니다.',
'research':'세 가지 관점, 하나의 시장', 'researchIntro':'운용의 판단, 종목의 흐름, 국면의 근거를 나누어 읽습니다. 세 전략가는 AI 페르소나입니다.',
'learn':'숫자 너머의 맥락', 'learnIntro':'김프부터 추세 지지까지. 화면의 숫자가 무엇을 말하고, 무엇을 말하지 않는지.',
'all':'전체 보기', 'price':'가격 · USDT', 'change':'24h 등락', 'volume':'24h 거래대금 · USDT', 'premium':'한국 프리미엄', 'asset':'종목', 'save':'관심 종목', 'saved':'저장한 종목',
'find':'종목·주제 검색', 'searchHint':'BTC, ETH, 김프…', 'empty':'해당하는 기록이 없습니다.', 'loading':'자료 연결 중', 'offline':'자료 연결 지연 · 다시 확인해주세요', 'observed':'시세 관측', 'stale':'갱신 지연',
'allStages':'전체', 'confirmed':'지지 확인', 'waiting':'눌림 대기', 'daily':'일봉', 'fourHour':'4시간봉', 'support':'리포트 당시 지지선', 'distance':'지지선과 거리', 'first':'보관 범위 내 첫 관측', 'report':'리포트 기준', 'timeline':'당시 관찰 기록',
'radarNote':'마감봉 관찰이며 매수 지시가 아닙니다. 목록 제외는 매도·손절을 뜻하지 않습니다. 현재 가격과 리포트 당시 가격은 다를 수 있습니다.',
'watchIntro':'별표를 눌러 다음 방문에도 이어서 보세요. 관심 목록은 이 브라우저에만 저장됩니다.', 'returnTitle':'다녀간 사이', 'returnEmpty':'관심 종목을 남겨두면 다음 방문에 실제 관측한 가격 변화를 비교합니다.',
'chart':'시장의 맥박', 'chartNote':'Binance 현물 종가 · 선택 기간 수익률 · 지연 조회', 'openChart':'지표 차트 열기', 'snapshot':'가격 자료는 브라우저에서 조회합니다. 연결 전에는 숫자를 만들지 않습니다.',
'session':'어느 시장에서 움직였나', 'sessionNote':'최근 각 세션의 BTC 수익률 · 진행 중인 세션 포함 · KST 08–16 / 16–22 / 22–08', 'asia':'아시아', 'europe':'유럽', 'us':'미국', 'inProgress':'진행 중', 'closed':'마감',
'fxNote':'Upbit 원화 ÷ (Binance USDT × USD/KRW 기준환율) − 1. 수수료·송금 제약 미반영. USDT와 USD의 차이로 프리미엄이 왜곡될 수 있습니다.', 'fxDate':'USD/KRW 일일 기준환율',
'original':'한국어 원문 리포트', 'read':'자세히 읽기', 'next':'이어서 보기', 'method':'출처와 방법', 'privacy':'개인정보와 언어', 'about':'이곳에 대하여', 'disclaimer':'정보 제공과 시장 관찰을 위한 사이트입니다. 투자 권유나 미래 수익의 보장이 아닙니다.',
'country':'접속 국가에 맞는 언어를 추천합니다.', 'browser':'브라우저 언어를 기준으로 추천합니다.', 'dismiss':'닫기', 'countryPrivacy':'첫 방문의 언어 추천에 country.is 국가 조회를 사용합니다. 이 제공자는 요청 IP를 보게 됩니다. Tape Lounge는 IP나 위치를 저장하지 않습니다. 조회 실패 시 브라우저 언어를 사용하며, 선택한 언어가 우선입니다.',
'aboutText':'Tape Lounge는 암호화폐 시장의 가격, 추세 후보, 공개 리포트를 연결하는 독립적인 관찰 공간입니다. 거래소가 아니며 이 웹사이트에서 실제 주문을 집행하지 않습니다. 가상의 인기 순위나 방문자 수를 만들지 않습니다.',
'sourceText':'해외 가격: Binance 공개 현물 API. 원화 가격: Upbit 공개 API. 테더 원화 시세: Bithumb 공개 API. 환율: Frankfurter 일일 기준환율. 레이더: 당시 게시된 Andy 리포트. 원문과 관측 시각을 함께 확인하세요. API 장애나 거래소별 종목 불일치 시 해당 값을 비워둡니다.',
'dataText':'공개 관찰 JSON과 RSS를 제공합니다. JSON의 reportAt이 관찰 시각이며 웹페이지 생성 시각이 아닙니다. 과거 최초 관측은 보관 범위 안에서의 최초이며 전체 시장의 최초 신호가 아닙니다. 백테스트와 실제 매매 성과를 합치지 않습니다.',
'analyticsText':'기존 익명 방문 통계를 사용합니다. 무작위 브라우저 ID, 화면 종류, 실제 활동 시간, 유입 도메인만 기록하며 IP·기기 지문·검색어를 수집하지 않습니다. 화면이 보이는 상태로 5초 머물거나 처음 조작한 뒤 방문으로 집계합니다. 내부 방문 표시는 유지됩니다. 원본 세션은 14일 뒤 일별 집계만 남깁니다.',
'roles':['정마담 · 운용의 판단','Andy · 추세의 발견','Prof. Justin · 국면의 근거'],
'roleCopy':['공개된 운용 상태와 판단의 맥락을 읽습니다. 개인 계좌의 잔고·진입가는 공개하지 않습니다.','일봉 후보와 4시간봉 눌림 관찰을 나누어 봅니다. 신호가 나온 뒤 무엇이 달라졌는지도 남깁니다.','모형의 시장 국면 판단을 읽습니다. 진입 허용은 확률적 분류이지 수익 약속이 아닙니다.'],
'guides':[
 ['kimchi-premium','김치 프리미엄 계산기·90일 추이: 환율과 테더 기준 비교','업비트 BTC/KRW와 바이낸스 BTC/USDT로 김치 프리미엄을 계산하고 달러 환율·국내 테더 기준을 비교합니다. 30일·90일 과거 추이와 역프 해석을 확인하세요.',['김치 프리미엄(김프)은 국내 원화 가격과 해외 가격을 같은 통화 기준으로 환산해 비교한 차이입니다. 양수면 국내 가격이 더 높고, 음수면 낮습니다. 다만 어떤 환율을 적용했는지에 따라 결과가 달라집니다.','업비트 BTC/KRW, 바이낸스 BTC/USDT, USD/KRW 참고환율로 계산할 때 해외 기준가는 BTC/USDT × USD/KRW입니다. 달러 환산 기준 김프는 (국내 가격 ÷ 해외 기준가 − 1) × 100입니다. 국내 USDT/KRW를 적용한 결과는 테더 시세 영향을 따로 보여주는 비교값입니다.','예를 들어 국내 BTC가 106,500,000원, 해외 BTC가 75,000 USDT, USD/KRW가 1,400원, USDT/KRW가 1,410원이면 달러 기준 해외가는 105,000,000원이고 김프는 +1.43%입니다. 테더 기준 해외가는 105,750,000원이며 국내 가격은 이보다 +0.71% 높습니다. 예시는 계산 설명용이며 현재 시세가 아닙니다.','비교하는 가격의 관측 시각을 맞추세요. 참고 환율은 즉시 체결할 수 있는 환전가가 아니고, 국내 테더 가격도 수급과 호가 차이를 반영합니다. 거래 수수료, 슬리피지, 출금 제한과 전송 시간까지 고려해야 하므로 역프가 곧 무위험 차익거래를 뜻하지 않습니다.','BTC뿐 아니라 ETH 등 여러 종목의 가격 차이와 USDT/KRW 대 USD/KRW 괴리도 함께 보면 코인별 차이와 원화·테더 수급을 구분하는 데 도움이 됩니다. 실시간 국내·해외 가격은 마켓 화면에서 확인할 수 있습니다.'],'2026-11-01','2026-11-03'],
 ['trend-retest','돌파 이후, 어떤 눌림을 지켜볼까?','올라간 폭보다 버틴 자리에 주목하는 관찰법.',['돌파 봉 하나가 추세의 지속을 보장하지는 않습니다. 이후 가격이 추세 지지선 부근으로 돌아왔을 때 어떻게 마감했는지를 별도로 관찰합니다.','레이더의 지지 확인, 눌림 대기, 재출발은 서로 다른 관찰 단계입니다. 같은 종목도 시간봉이 다르면 다른 상태일 수 있습니다. 현재 호가가 아니라 리포트 당시 마감봉 판정입니다.','가격이 지지선에서 멀어지면 방향을 맞혀도 진입 손익비는 나빠질 수 있습니다. 리포트의 거리와 현재 가격을 혼동하지 말고, 최신 차트에서 무효화 지점을 직접 확인하세요.','관찰 목록에서 사라졌다는 사실만으로 지지가 무너졌거나 매도했다고 해석하지 않습니다. 이력은 당시 리포트의 기록이며, 실제 거래 내역이나 검증된 승률이 아닙니다.']],
 ['market-sessions','아시아·유럽·미국, 어느 장에서 움직였을까?','하루 등락을 세션으로 나눠 보면 다른 이야기가 보입니다.',['이 사이트는 비교를 위해 KST 08–16시를 아시아, 16–22시를 유럽, 22–다음날 08시를 미국 구간으로 고정합니다. 각 지역의 공식 거래소 개장 시각과 같지는 않으며 서머타임에 따라 바꾸지 않습니다.','수익률은 구간 첫 봉 시가부터 마지막 관측 종가까지 계산합니다. 변동폭과 수익률은 다릅니다. 큰 폭으로 흔들리고도 제자리로 돌아온 장을 강세 세션으로 부르지 않습니다.','진행 중인 세션과 마감된 세션은 관측 길이가 다릅니다. 최근 각 회차를 비교하므로 모두 같은 달력 날짜의 데이터일 필요도 없습니다. 시각과 진행 상태를 함께 확인하세요.','어느 세션이 올랐는지는 서술적 통계입니다. 그 시간대의 참여자가 원인이라는 증거나 다음 세션도 상승한다는 예측은 아닙니다. 가격·거래량·공식 발표와 교차해서 읽는 용도로 사용하세요.']],
 ['blind-chart-practice','과거 차트로 연습하는 법: 미국주식·비트코인 블라인드 모의투자','종목과 날짜를 숨긴 과거 차트에서 가상 매매를 연습하고, 같은 기간 보유 수익률과 비교하는 방법을 안내합니다.',['블라인드 차트 게임은 실제 과거 일봉을 시간순으로 재생하면서 종목과 날짜를 가립니다. 시작 가격은 100으로 환산되어 가격 수준만으로 정답을 알아맞히기 어렵습니다.','가상 자금으로 롱·숏을 선택하고 주문 비율과 레버리지를 조절할 수 있습니다. 차트는 멈추거나 속도를 바꿔 볼 수 있고, 결과에는 화면에 표시된 모의 매매 수수료와 포지션 평가가 반영됩니다. 실제 거래소 주문은 발생하지 않습니다.','정산하면 종목과 실제 기간이 공개되고, 내 수익률을 같은 구간 매수 후 보유했을 때와 비교할 수 있습니다. 결과를 점수처럼 보기보다 진입·청산과 쉬어간 구간을 되짚는 용도로 사용하세요.','이미 끝난 과거 경로를 보는 연습에는 사후 편향이 있습니다. 한 판의 결과는 실력이나 전략을 검증하지 않으며, 실제 체결 비용과 유동성을 모두 재현하지 않습니다. 미래 수익을 보장하지 않습니다.','오늘의 공통 판은 한국시간 자정에 바뀌며 모든 방문자가 같은 200거래일 차트를 봅니다. 2026년 11월 2일부터 오늘 판은 미국 주식이고, 개인 판에서는 미국 주식과 코인 중 선택할 수 있습니다. 게임 조작은 한국어·영어·중국어·일본어로 제공됩니다.'],'2026-11-01','2026-11-02']
]},
'en': {
'nav':['Today','Markets','Radar','Read'], 'tools':'Live lounge', 'edition':'A clearer view of the market',
'headline':'Less noise.\nMore perspective.', 'intro':'See what moved. Keep an eye on what matters next. One independent reading room for markets, trends and the record behind them.',
'market':'The market, at a glance', 'marketIntro':'Compare crypto prices, trading activity and the gap between Korean and global markets.', 'marketSeoTitle':'Korean Crypto Premium & Live Prices', 'marketSeoDescription':'Compare Upbit KRW prices with Binance USDT spot quotes. Track the Korean premium, 24-hour moves, trading volume and USD/KRW reference rate, refreshed every 60 seconds.',
'radar':"On Andy’s radar", 'radarIntro':'The breakout is only the beginning. Follow the retest, the support and what happened next.',
'research':'Three perspectives. One market.', 'researchIntro':'Separate portfolio decisions, trend observations and regime research. All three strategists are AI personas.',
'learn':'The context behind the numbers', 'learnIntro':'From Korean premiums to trend retests: what the numbers tell you, and what they do not.',
'all':'View all', 'price':'Price · USDT', 'change':'24h change', 'volume':'24h turnover · USDT', 'premium':'Korean premium', 'asset':'Asset', 'save':'Watchlist', 'saved':'Saved',
'find':'Search assets & topics', 'searchHint':'BTC, ETH, premium…', 'empty':'No matching observations.', 'loading':'Connecting to data', 'offline':'Data unavailable · please retry later', 'observed':'Quote observed', 'stale':'Update delayed',
'allStages':'All', 'confirmed':'Support confirmed', 'waiting':'Awaiting retest', 'daily':'Daily', 'fourHour':'4-hour', 'support':'Support in the report', 'distance':'Distance to support', 'first':'First within archive', 'report':'Report as of', 'timeline':'Recorded observations',
'radarNote':'Closed-candle observations, not buy instructions. Removal from a list does not mean a sale or stop-loss. Current prices may differ from the report snapshot.',
'watchIntro':'Save a star to pick up where you left off. Your watchlist stays in this browser.', 'returnTitle':'Since you last looked', 'returnEmpty':'Save assets to compare prices actually observed on your next visit.',
'chart':'The market pulse', 'chartNote':'Binance spot closes · selected-period return · polled data', 'openChart':'Open indicator charts', 'snapshot':'Prices load in your browser. We do not invent values while data is unavailable.',
'session':'Where did the move happen?', 'sessionNote':'BTC returns in the latest session of each region · includes live sessions · KST 08–16 / 16–22 / 22–08', 'asia':'Asia', 'europe':'Europe', 'us':'U.S.', 'inProgress':'In progress', 'closed':'Closed',
'fxNote':'Upbit KRW ÷ (Binance USDT × USD/KRW reference rate) − 1. Excludes fees and transfer restrictions. USDT/USD basis can distort the premium.', 'fxDate':'USD/KRW daily reference',
'original':'Original report · Korean', 'read':'Read more', 'next':'Keep exploring', 'method':'Sources & methodology', 'privacy':'Privacy & language', 'about':'About this room', 'disclaimer':'For information and market observation, not investment advice or a promise of future returns.',
'country':'A language suggestion for your connection country.', 'browser':'A suggestion based on your browser language.', 'dismiss':'Dismiss', 'countryPrivacy':'For a first-visit language suggestion, country.is receives your request IP. Tape Lounge does not store your IP or location. Browser language is the fallback; your explicit language choice always takes priority.',
'aboutText':'Tape Lounge is an independent space connecting crypto prices, trend candidates and public reports. It is not an exchange and this website does not execute real orders. We do not fabricate popularity rankings or visitor counts.',
'sourceText':'Overseas prices: Binance public spot API. Korean BTC quotes: Upbit public API. Korean tether quotes: Bithumb public API. FX: Frankfurter daily reference. Radar: Andy reports as originally published. Check the source and observation time. Missing APIs or unmatched listings are left blank.',
'dataText':'Public observation JSON and RSS are available. reportAt is the observation time, not the page build time. First seen means first within the retained archive, not the first signal in the market. Backtests are not merged into live trading performance.',
'analyticsText':'Existing anonymous analytics record a random browser ID, screen category, active time and referring domain. A visit is counted after the page has remained visible for 5 seconds or a visitor first interacts with it. We do not collect IPs, fingerprints or search terms. Internal traffic flags persist. Raw sessions are retained for 14 days, then only daily aggregates remain.',
'roles':['Madam · Portfolio perspective','Andy · Trend discovery','Prof. Justin · Regime research'],
'roleCopy':['Read the public portfolio state and the reasoning around it. Private account balances and entry prices are not published.','Separate daily candidates from four-hour retest observations, and follow how published observations change.','Read the model’s market-regime assessment. Entry allowed is a probabilistic classification, not a return guarantee.'],
'guides':[
 ['kimchi-premium','Kimchi Premium Calculator & 90-Day History: FX and USDT Compared','Calculate the Korean BTC premium from KRW, BTC/USDT, USD/KRW and USDT/KRW. Compare local tether pricing and explore 30- or 90-day history.',['The Korean, or kimchi, premium compares a Korean won quote with an overseas quote converted into won. A positive value means the Korean quote is higher; a negative value means it is lower. The result depends on the conversion rate used.','Using Upbit BTC/KRW, Binance BTC/USDT and a USD/KRW reference, the overseas benchmark is BTC/USDT × USD/KRW. The dollar-based premium is (Korean quote ÷ benchmark − 1) × 100. The USDT/KRW view below reflects local tether pricing and is a separate comparison; sites may define the displayed premium differently.','For example, if the Korean BTC quote is ₩106,500,000, BTC/USDT is 75,000, USD/KRW is ₩1,400 and USDT/KRW is ₩1,410, the dollar benchmark is ₩105,000,000 and the premium is +1.43%. The tether-based benchmark is ₩105,750,000, leaving the Korean quote +0.71% above it. These are illustrative inputs, not live prices.','Align quote timestamps. A reference FX rate is not an executable conversion price, and local tether pricing also reflects supply and order-book conditions. Fees, slippage, withdrawal restrictions and transfer time matter, so a negative premium alone does not establish risk-free arbitrage.','Compare several assets and the USDT/KRW versus USD/KRW gap. That can help separate a coin-specific price difference from broader won or tether demand. See the market page for live domestic and overseas quotes.'],'2026-11-01','2026-11-03'],
 ['trend-retest','What should you watch after a breakout?','The level that holds can matter more than the size of the first candle.',['One breakout candle does not establish trend persistence. A separate observation is how price closes after returning toward a trend-support level.','Support confirmed, awaiting retest and continuation are different observation stages. The same asset can have different states on different timeframes. These are closed-candle assessments at report time, not the current order book.','A large distance from support can worsen entry reward-to-risk even if direction is right. Do not confuse the report’s distance with today’s price. Check invalidation levels on the latest chart yourself.','Disappearing from the observation list does not prove support failed or a position was sold. The timeline records published reports, not actual trades or an established win rate.']],
 ['market-sessions','Asia, Europe or the U.S.: where did the move happen?','A daily return can hide three very different sessions.',['For consistent comparison, this site fixes Asia at 08–16 KST, Europe at 16–22 and the U.S. at 22–08 the next day. These are not official exchange opening hours and do not change for daylight saving time.','Return runs from the first candle open to the last observed close. Range is different: a session that swings widely and returns to its start is not a strong positive-return session.','Live and completed sessions have different observation lengths. We compare the latest occurrence of each region, which need not fall on the same calendar date. Read the timestamp and live status together.','Session attribution is descriptive. It does not prove which participants caused a move or predict the next session. Cross-check prices, activity and official releases.']],
 ['blind-chart-practice','Practice with a blind chart: historical stocks and Bitcoin','Learn how to trade a hidden historical chart with virtual funds, then compare your result with buy-and-hold over the same period.',['A blind chart replay shows real historical daily candles in sequence while keeping the ticker and dates hidden. Prices start at a normalized value of 100, so the nominal price does not reveal the answer.','Trade with virtual funds, choose simulated long or short positions, and adjust order size and leverage. Pause the replay or change its speed. The game applies its displayed simulated fees and position valuation; it places no real exchange orders.','After settlement, the ticker and historical dates appear beside your return and the buy-and-hold result for the same interval. Review where you entered, exited or stayed out rather than treating one outcome as a score.','This is a known historical path, so hindsight bias is unavoidable. One replay does not validate a strategy or predict future returns, and the simulation does not reproduce every execution cost or liquidity condition.','The shared daily round changes at midnight Korea time, and everyone gets the same 200-trading-day chart. Since Nov 2, 2026, it uses a U.S. stock; solo rounds let you choose U.S. stocks or crypto. The live game controls are available in Korean, English, Simplified Chinese, and Japanese.'],'2026-11-01','2026-11-02']
]},
'zh': {
'nav':['今日','行情','雷达','阅读'], 'tools':'实时行情大厅', 'edition':'换个角度，看清市场',
'headline':'少一点噪音，\n多一分洞察。', 'intro':'看清价格的变化，把值得关注的标的留下。连接行情、趋势与观察记录的独立研究空间。',
'market':'市场一览', 'marketIntro':'比较主要加密资产的价格、交易额，以及韩国市场与海外的价差。', 'marketSeoTitle':'韩国加密货币溢价实时行情表', 'marketSeoDescription':'对比 Upbit 韩元价格与 Binance USDT 现货价，查看 BTC、ETH 等主要币种的韩国溢价、24 小时涨跌、成交额及美元兑韩元参考汇率，每 60 秒更新。', 'radar':'Andy 的观察雷达', 'radarIntro':'突破只是开始。继续观察回踩、支撑以及后续变化。',
'research':'三个视角，一个市场', 'researchIntro':'分别阅读持仓判断、趋势观察和市场状态研究。三位策略师均为 AI 角色。', 'learn':'数字背后的背景', 'learnIntro':'从韩国溢价到趋势回踩：理解数字能说明什么、不能说明什么。',
'all':'查看全部', 'price':'价格 · USDT', 'change':'24小时涨跌', 'volume':'24小时交易额 · USDT', 'premium':'韩国溢价', 'asset':'资产', 'save':'自选', 'saved':'已保存',
'find':'搜索资产与主题', 'searchHint':'BTC、ETH、溢价…', 'empty':'暂无匹配记录。', 'loading':'正在连接数据', 'offline':'数据连接延迟，请稍后重试', 'observed':'报价观测时间', 'stale':'更新延迟',
'allStages':'全部', 'confirmed':'支撑确认', 'waiting':'等待回踩', 'daily':'日线', 'fourHour':'4小时', 'support':'报告时的支撑位', 'distance':'距支撑位', 'first':'存档内首次观察', 'report':'报告截至', 'timeline':'当时的观察记录',
'radarNote':'基于已收盘K线的观察，不是买入指令。移出名单不代表卖出或止损。当前价格可能不同于报告时的快照。',
'watchIntro':'点击星标，下次继续关注。自选列表仅保存在此浏览器。', 'returnTitle':'上次访问之后', 'returnEmpty':'保存关注资产，下次访问时比较实际观测的价格变化。',
'chart':'市场脉搏', 'chartNote':'Binance 现货收盘价 · 所选区间收益率 · 轮询数据', 'openChart':'打开指标图表', 'snapshot':'报价由浏览器查询。数据尚未连接时不填造数值。',
'session':'行情在哪个时段发生？', 'sessionNote':'各地区最近时段的 BTC 涨跌幅，包含进行中时段 · 韩国时间 08–16 / 16–22 / 22–08', 'asia':'亚洲', 'europe':'欧洲', 'us':'美国', 'inProgress':'进行中', 'closed':'已结束',
'fxNote':'Upbit 韩元价 ÷（Binance USDT价 × 美元兑韩元参考汇率）− 1。不含手续费与转账限制。USDT 对美元的偏差会影响结果。', 'fxDate':'USD/KRW 每日参考汇率',
'original':'韩语原始报告', 'read':'阅读全文', 'next':'继续探索', 'method':'来源与方法', 'privacy':'隐私与语言', 'about':'关于这里', 'disclaimer':'仅供信息与市场观察，不构成投资建议，也不保证未来收益。',
'country':'根据连接国家推荐语言。', 'browser':'根据浏览器语言推荐。', 'dismiss':'关闭', 'countryPrivacy':'首次访问的语言推荐使用 country.is，该服务会接收到请求 IP。Tape Lounge 不保存 IP 或位置。查询失败时使用浏览器语言；您的主动选择始终优先。',
'aboutText':'Tape Lounge 是连接加密市场报价、趋势候选和公开报告的独立观察空间，并非交易所，也不会通过此网站执行真实订单。我们不虚构人气排行或访问人数。',
'sourceText':'海外价格来自 Binance 公开现货 API，韩国 BTC/KRW 报价来自 Upbit，韩国 USDT/KRW 报价来自 Bithumb，汇率来自 Frankfurter 每日参考数据，雷达来自当时发布的 Andy 报告。请核对来源与观测时间。接口不可用或交易对不匹配时留空。',
'dataText':'提供公开观察 JSON 与 RSS。reportAt 是观察时间，不是网页构建时间。首次观察仅指保留存档内的首次，不是全市场首次信号。不会将回测与实盘业绩合并。',
'analyticsText':'沿用匿名访问统计，仅记录随机浏览器标识、页面类别、活跃时间和来源域名。页面在前台停留5秒或用户首次操作后，才计为一次访问。不采集 IP、设备指纹或搜索词。保留内部访问标记。原始会话保存14天，之后仅保留每日汇总。',
'roles':['郑女士 · 运用判断','Andy · 趋势发现','Prof. Justin · 市场状态研究'],
'roleCopy':['阅读公开运用状态与判断背景，不公开私人账户余额或入场价格。','区分日线候选与4小时回踩观察，继续追踪发布后的变化。','阅读模型的市场状态判断。允许入场只是概率分类，不是收益保证。'],
'guides':[
 ['kimchi-premium','韩国溢价计算器与90天走势：比较汇率和USDT价差','用韩元、BTC/USDT、美元兑韩元汇率和 USDT/KRW 计算韩国比特币溢价，并比较美元换算、本地泰达币价格及30天或90天历史走势。',['韩国溢价（Kimchi Premium）比较韩国韩元报价与换算成韩元后的海外报价。正值表示韩国报价更高，负值表示更低。采用不同汇率，计算结果也会不同。','使用 Upbit BTC/KRW、Binance BTC/USDT 和 USD/KRW 参考汇率时，海外基准价为 BTC/USDT × USD/KRW。美元换算溢价为（韩国报价 ÷ 基准价 − 1）× 100。下方 USDT/KRW 结果反映本地泰达币价格，是另一种比较口径；不同网站的溢价定义可能不同。','例如，韩国 BTC 报价为 106,500,000 韩元、BTC/USDT 为 75,000、USD/KRW 为 1,400、USDT/KRW 为 1,410 时，美元基准价为 105,000,000 韩元，溢价为 +1.43%。泰达币基准价为 105,750,000 韩元，韩国报价高出 +0.71%。这些只是计算示例，并非实时价格。','请对齐各报价的观测时间。参考汇率不是可立即成交的换汇价格，本地泰达币价格也受供需和盘口影响。手续费、滑点、提币限制和转账时间都会影响结果，因此负溢价本身不代表无风险套利。','同时比较多个币种，以及 USDT/KRW 与 USD/KRW 的差距，有助于区分币种自身价差和韩元、泰达币需求变化。实时国内外报价请查看行情页面。'],'2026-11-01','2026-11-03'],
 ['trend-retest','突破之后，该观察怎样的回踩？','站稳的位置，可能比第一根K线的涨幅更重要。',['单根突破K线不能保证趋势持续。价格回到趋势支撑附近后如何收盘，需要单独观察。','支撑确认、等待回踩、再次启动是不同观察阶段。同一资产在不同周期可能状态不同。这是报告时的收盘判断，不是当前盘口。','价格离支撑过远时，即使方向正确，入场盈亏比也可能变差。不要把报告中的距离当作当前距离，应在最新图表自行检查失效位置。','从观察名单消失，不代表支撑失效或已经卖出。时间线记录的是当时的公开报告，并非真实交易或已验证胜率。']],
 ['market-sessions','亚洲、欧洲还是美国：行情在哪里发生？','一天的涨跌幅，可能掩盖三个不同的时段。',['为统一比较，本网站将亚洲固定为韩国时间08–16点、欧洲16–22点、美国22点至次日08点。这并非官方交易所开盘时间，也不随夏令时调整。','收益率从区间第一根K线开盘到最后观测收盘计算。振幅不同于收益率，大幅波动后回到原点的时段并不算强势上涨。','进行中与已结束时段的观测长度不同。各地区比较的是最近一次时段，不一定属于同一日历日期。请同时阅读时间与状态。','时段归因是描述统计，不能证明哪类参与者导致行情，也不能预测下一时段。应与价格、成交活动及官方发布交叉阅读。']],
 ['blind-chart-practice','用隐藏历史图表练习交易判断','用虚拟资金重放隐藏标的与日期的历史行情，并与同期买入持有收益作比较。',['盲图游戏按时间顺序重放真实历史日K线，但隐藏资产代码和日期。起始价格统一为100，减少单凭名义价格猜出答案的线索。','使用虚拟资金进行多空模拟交易，可调整下单比例与杠杆，也可暂停或调整播放速度。游戏按页面显示的模拟费用与持仓估值规则计算，不会下达真实交易。','结算后会揭晓标的和日期，并展示你的收益率与同期买入持有收益。复盘进出场和观望时机，比把单次结果当作能力评分更有用。','这是一条已经发生的历史路径，存在事后偏差。一次游戏不能验证策略或预测未来收益，模拟也不会完整还原现实中的成交成本与流动性。','每日共同牌局在韩国时间午夜更新，所有访客看到同一条200个交易日的图表。自2026年11月2日起，今日牌局使用美股；单人牌局可选美股或加密货币。游戏界面支持韩语、英语、简体中文和日语。'],'2026-11-01','2026-11-02']
]},
'ja': {
'nav':['今日','マーケット','レーダー','読む'], 'tools':'ライブラウンジ', 'edition':'市場を、もう少しクリアに',
'headline':'ノイズを減らし、\n流れをつかむ。', 'intro':'何が動いたかを知り、次に見る銘柄を残す。相場・トレンド・観察記録をつなぐ、独立したリサーチルーム。',
'market':'マーケットをひと目で', 'marketIntro':'主要暗号資産の価格と売買代金、韓国と海外市場の価格差を比較します。', 'marketSeoTitle':'韓国プレミアム・暗号資産リアルタイム価格', 'marketSeoDescription':'UpbitのKRW価格とBinanceのUSDT現物価格を比較。BTC・ETHなど主要銘柄の韓国プレミアム、24時間騰落率、売買代金、USD/KRW参考レートを60秒ごとに更新します。', 'radar':'Andy の観察レーダー', 'radarIntro':'ブレイクの後こそ大切。押し目の支えと、その後の変化を追います。',
'research':'三つの視点、一つの市場', 'researchIntro':'運用判断、トレンド観察、相場局面の研究を分けて読みます。三人とも AI ペルソナです。', 'learn':'数字の向こうの文脈', 'learnIntro':'韓国プレミアムからトレンドの押し目まで。数字が示すこと、示さないこと。',
'all':'すべて見る', 'price':'価格 · USDT', 'change':'24時間騰落', 'volume':'24時間売買代金 · USDT', 'premium':'韓国プレミアム', 'asset':'銘柄', 'save':'ウォッチリスト', 'saved':'保存済み',
'find':'銘柄・テーマを検索', 'searchHint':'BTC、ETH、プレミアム…', 'empty':'該当する記録はありません。', 'loading':'データに接続中', 'offline':'データ接続が遅れています', 'observed':'価格の観測時刻', 'stale':'更新遅延',
'allStages':'すべて', 'confirmed':'支持を確認', 'waiting':'押し目待ち', 'daily':'日足', 'fourHour':'4時間足', 'support':'レポート時の支持線', 'distance':'支持線との距離', 'first':'保存範囲内の初観測', 'report':'レポート基準', 'timeline':'当時の観察記録',
'radarNote':'確定足の観察であり、買い指示ではありません。一覧からの除外は売却や損切りを意味しません。現在価格はレポート時点と異なる場合があります。',
'watchIntro':'星を付けて次の訪問へ。リストはこのブラウザーだけに保存されます。', 'returnTitle':'前回の訪問から', 'returnEmpty':'銘柄を保存すると、次回に実際に観測した価格の変化を比較します。',
'chart':'市場の鼓動', 'chartNote':'Binance 現物終値 · 選択期間の騰落率 · 定期取得', 'openChart':'指標チャートを開く', 'snapshot':'価格はブラウザーで取得します。接続前に数値を作りません。',
'session':'どの時間帯で動いたか', 'sessionNote':'各地域の直近セッションの BTC 騰落率・進行中を含む · KST 08–16 / 16–22 / 22–08', 'asia':'アジア', 'europe':'欧州', 'us':'米国', 'inProgress':'進行中', 'closed':'終了',
'fxNote':'Upbit KRW ÷（Binance USDT × USD/KRW 参考レート）− 1。手数料・送金制限は未反映。USDT と USD の差で値が歪む場合があります。', 'fxDate':'USD/KRW 日次参考レート',
'original':'韓国語の原文レポート', 'read':'詳しく読む', 'next':'続けて見る', 'method':'出典と方法', 'privacy':'プライバシーと言語', 'about':'この場所について', 'disclaimer':'情報提供と市場観察を目的とし、投資推奨や将来の利益の保証ではありません。',
'country':'接続国に合わせた言語の提案です。', 'browser':'ブラウザー言語をもとに提案しています。', 'dismiss':'閉じる', 'countryPrivacy':'初回の言語提案に country.is を使用し、同サービスにはリクエストIPが伝わります。Tape Lounge は IP や位置を保存しません。失敗時はブラウザー言語を使い、明示的な選択を優先します。',
'aboutText':'Tape Lounge は暗号資産の価格、トレンド候補、公開レポートをつなぐ独立した観察空間です。取引所ではなく、このサイトから実注文を執行しません。人気順位や訪問者数を捏造しません。',
'sourceText':'海外価格は Binance 公開現物 API、韓国の BTC/KRW は Upbit、韓国の USDT/KRW は Bithumb、為替は Frankfurter 日次参考レート、レーダーは当時公開された Andy レポートが出典です。観測時刻と原文を確認してください。障害や銘柄の不一致時は空欄にします。',
'dataText':'公開観察 JSON と RSS を提供します。reportAt は観測時刻でありページ生成時刻ではありません。初観測は保存範囲内の最初で、市場全体の初シグナルではありません。バックテストと実運用成績を合算しません。',
'analyticsText':'従来の匿名統計を使用し、ランダムなブラウザー ID、画面分類、活動時間、流入ドメインのみ記録します。ページが表示された状態で5秒経過するか、最初の操作があった時点で訪問として数えます。IP、端末指紋、検索語は収集しません。内部アクセス設定を維持します。元セッションは14日後に日次集計のみ残します。',
'roles':['鄭マダム · 運用判断','Andy · トレンド発見','Prof. Justin · 相場局面研究'],
'roleCopy':['公開された運用状態と判断の文脈を読みます。個人の残高やエントリー価格は公開しません。','日足候補と4時間足の押し目観察を分け、公開後の変化を追います。','モデルの市場局面判断を読みます。エントリー許容は確率的分類で、利益の約束ではありません。'],
'guides':[
 ['kimchi-premium','韓国プレミアム計算機と90日推移：為替とUSDT基準を比較','KRW、BTC/USDT、USD/KRW、USDT/KRWからビットコインの韓国プレミアムを計算し、ドル換算・現地テザー価格と30日または90日の推移を比較します。',['韓国プレミアム（キムチプレミアム）は、韓国のウォン建て価格と、海外価格をウォンに換算した値を比べた差です。プラスなら韓国価格が高く、マイナスなら低いことを示します。適用する為替レートによって値は変わります。','Upbit BTC/KRW、Binance BTC/USDT、USD/KRWの参考レートを使う場合、海外基準価格はBTC/USDT × USD/KRWです。ドル換算プレミアムは（韓国価格 ÷ 基準価格 − 1）× 100です。下のUSDT/KRW基準値は現地のテザー価格を反映した別の比較であり、各サイトの表示定義と一致するとは限りません。','例として、韓国BTC価格が106,500,000ウォン、BTC/USDTが75,000、USD/KRWが1,400、USDT/KRWが1,410の場合、ドル基準価格は105,000,000ウォンでプレミアムは+1.43%です。テザー基準価格は105,750,000ウォンで、韓国価格は+0.71%高くなります。説明用の数値で、現在の相場ではありません。','比較する価格の観測時刻をそろえてください。参考為替はすぐ約定できる両替レートではなく、韓国のUSDT価格も需給と板の状態を反映します。手数料、スリッページ、出金制限、送金時間も実際の結果に影響するため、逆プレミアムだけで無リスク裁定とは言えません。','複数銘柄の価格差とUSDT/KRW対USD/KRWの乖離も見ると、銘柄固有の差とウォン・テザー需要を分けて考えやすくなります。国内外のリアルタイム価格はマーケット画面で確認できます。'],'2026-11-01','2026-11-03'],
 ['trend-retest','ブレイクの後、どんな押し目を見る？','最初の上昇幅より、支えられた場所に注目する。',['一つのブレイク足はトレンド継続を保証しません。価格がトレンド支持付近へ戻った後、どこで確定したかを別に観察します。','支持確認、押し目待ち、再始動は異なる観察段階です。同じ銘柄でも時間足によって状態は変わります。現在の板ではなくレポート時点の確定足判定です。','支持線から離れすぎると、方向が正しくても新規エントリーの損益比は悪化し得ます。レポートの距離を現在の値と混同せず、最新チャートで無効化水準を確認してください。','一覧から消えたことだけで、支持割れや売却と判断しません。履歴は当時の公開レポートであり、実取引や検証済み勝率ではありません。']],
 ['market-sessions','アジア・欧州・米国、どの時間帯で動いた？','一日の騰落率には、三つの異なる相場が隠れています。',['一貫した比較のため、アジアは KST 08–16時、欧州16–22時、米国22–翌08時で固定します。公式取引所の開場時刻ではなく、夏時間でも変更しません。','騰落率は最初の足の始値から最後の観測終値までです。値幅とは別で、大きく揺れて元に戻った時間帯を上昇の強い相場とは呼びません。','進行中と終了済みの区間は観測の長さが違います。各地域の直近回を比較するので、同じ暦日とは限りません。時刻と進行状態を一緒に確認してください。','時間帯の帰属は記述統計です。どの参加者が原因かの証明でも、次のセッションの予測でもありません。価格、取引活動、公式発表と照らし合わせて読みます。']],
 ['blind-chart-practice','銘柄と日付を伏せた過去チャートで練習する','過去の株式・ビットコイン相場を仮想資金で売買し、同じ期間の保有リターンと比べる方法を紹介します。',['ブラインドチャートは実際の過去の日足を時系列で再生し、銘柄名と日付を隠します。開始価格は100に正規化され、価格水準だけで正解を推測しにくくしています。','仮想資金でロング・ショートを選び、注文比率やレバレッジを調整できます。再生は停止や速度変更が可能です。画面に表示する手数料とポジション評価を適用し、実際の取引所注文は行いません。','精算後に銘柄と期間が明かされ、自分の損益と同じ期間の買い持ちリターンを比較できます。一度の勝敗より、どこで入り、降り、見送ったかを振り返るために使ってください。','すでに終わった相場を見るため、後知恵の偏りがあります。一回の結果で手法を検証したり、将来の利益を予測したりはできません。実際の約定コストや流動性もすべて再現するものではありません。','今日の共通ラウンドは韓国時間の午前0時に更新され、全員が同じ200取引日のチャートを見ます。2026年11月2日から今日のラウンドは米国株です。ソロでは米国株と暗号資産を選べます。ゲーム操作は韓国語・英語・簡体字中国語・日本語に対応しています。'],'2026-11-01','2026-11-02']
]
}
}
COPY['ko'].update({
    'radarSeoTitle':'코인 추세 레이더: 돌파·눌림·지지 관찰',
    'radarSeoDescription':'Andy의 공개 리포트에서 코인 일봉 추세 전환과 4시간봉 눌림·지지 상태를 살펴보고, 종목별 관찰 이력을 확인하세요. 매수 신호가 아닌 추세 관찰 기록입니다.'
})
COPY['en'].update({
    'radarSeoTitle':'Crypto Trend Radar: Breakouts & Retests',
    'radarSeoDescription':'Browse coins from Andy’s published scans: daily trend transitions and 4-hour pullback and support states, with historical observations. Research notes, not buy signals.'
})
COPY['zh'].update({
    'radarSeoTitle':'加密货币趋势雷达：突破与回踩观察',
    'radarSeoDescription':'查看 Andy 公开扫描的币种：日线趋势转换、4小时回踩与支撑状态及历史观察记录。本页面为观察记录，不构成买入信号。'
})
COPY['ja'].update({
    'radarSeoTitle':'暗号資産トレンドレーダー：ブレイク・押し目観察',
    'radarSeoDescription':'Andyの公開スキャンから、日足のトレンド転換や4時間足の押し目・サポート状態、過去の観察記録を確認できます。売買シグナルではありません。'
})
STAGES = {
'지지 확인':['지지 확인','Support confirmed','支撑确认','支持を確認'],
'재출발':['재출발','Continuation','再次启动','再始動'],
'눌림 대기':['눌림 대기','Awaiting retest','等待回踩','押し目待ち'],
'이미 많이 벌어짐':['지지선에서 멀어짐','Extended from support','远离支撑','支持線から乖離'],
'신규 돌파':['신규 돌파','New breakout','新突破','新規ブレイク'],
'추세 진행':['추세 진행','Trend in progress','趋势延续','トレンド継続'],
'바닥 반전':['바닥 반전','Potential base reversal','底部反转观察','底反転の観察'],
'목록 제외':['목록 제외','Removed from list','移出名单','一覧から除外']}

for language, label in zip(LANGS, ['과거 관찰','Past observations','历史观察','過去の観察']):
    COPY[language]['archive'] = label

KIMCHI_LIVE_COPY = {
    'ko': {'button':'최신 시세 불러와 계산','loading':'공개 시세와 환율을 불러오는 중…','success':'시세 조회 완료 · KST {time} · USD/KRW 기준일 {date}','error':'시세를 모두 불러오지 못했습니다. 잠시 뒤 다시 시도하거나 직접 입력해 주세요.','sources':'시세 출처: BTC/KRW Upbit · BTC/USDT Binance · USDT/KRW Bithumb · USD/KRW Frankfurter','disclaimer':'거래소 최근 체결가와 일일 기준환율을 이용한 참고값입니다. 관측 시각 차이, 호가 간격, 수수료·슬리피지·입출금 제한은 반영하지 않아 실제 체결이나 차익을 보장하지 않습니다.'},
    'en': {'button':'Load current quotes','loading':'Fetching public market quotes and reference FX…','success':'Quotes loaded · KST {time} · USD/KRW reference date {date}','error':'Could not retrieve all quotes. Try again or enter the values manually.','sources':'Sources: BTC/KRW Upbit · BTC/USDT Binance · USDT/KRW Bithumb · USD/KRW Frankfurter.','disclaimer':'Indicative calculation using recent exchange trades and a daily FX reference. Quote times and order-book spreads may differ; fees, slippage, and transfer limits are excluded. This does not guarantee an executable price or arbitrage.'},
    'zh': {'button':'读取最新报价并计算','loading':'正在读取公开行情与参考汇率…','success':'报价已载入 · KST {time} · USD/KRW 汇率日期 {date}','error':'未能取得全部报价。请稍后重试，或手动输入数值。','sources':'数据来源：BTC/KRW Upbit · BTC/USDT Binance · USDT/KRW Bithumb · USD/KRW Frankfurter。','disclaimer':'使用交易所近期成交价和每日参考汇率进行估算。报价时间及盘口价差可能不同，且未计入手续费、滑点和转账限制；不保证可成交价格或套利机会。'},
    'ja': {'button':'最新価格を読み込んで計算','loading':'公開価格と参考為替を取得中…','success':'価格を取得しました · KST {time} · USD/KRW 参考日 {date}','error':'すべての価格を取得できませんでした。再試行するか、手動で入力してください。','sources':'データ出典：BTC/KRW Upbit · BTC/USDT Binance · USDT/KRW Bithumb · USD/KRW Frankfurter。','disclaimer':'取引所の直近約定値と日次参考為替による概算です。観測時刻や板のスプレッドは異なる場合があり、手数料・スリッページ・送金制限も含みません。約定価格や裁定機会を保証しません。'}
}

KIMCHI_LIVE_INTRO = {
    'ko':'네 가격을 직접 입력하거나 최신 공개 시세를 불러와 달러 환율 기준과 테더 시세 기준을 비교합니다. 입력과 계산은 이 브라우저에서 처리됩니다.',
    'en':'Enter four quotes or load current public prices to compare the USD-converted premium with the local tether basis. Inputs and calculations stay in this browser.',
    'zh':'手动输入四个报价，或读取最新公开行情，对比美元换算溢价与本地泰达币价差。输入和计算均在当前浏览器中完成。',
    'ja':'4つの価格を手入力するか最新の公開価格を読み込み、ドル換算のプレミアムと現地テザー価格の差を比較します。入力と計算はこのブラウザー内で行います。'
}

KIMCHI_TOOL_COPY = {
    'ko': {'kicker':'PRICE GAP / QUICK CALC','title':'김치 프리미엄 계산기','intro':'같은 시점의 네 가지 값을 입력하면 달러 환율 기준과 테더 시세 기준을 나눠 계산합니다. 입력한 값은 이 브라우저에서만 계산하며 서버로 보내지 않습니다.','local':'국내 BTC/KRW','binance':'해외 BTC/USDT','usd':'USD/KRW 참고환율','usdt':'국내 USDT/KRW','hintLocal':'예: 106,500,000','hintBinance':'예: 75,000','hintUsd':'예: 1,400','hintUsdt':'예: 1,410','example':'계산 예시 보기','clear':'초기화','usdResult':'USD/KRW 기준 해외환산가','usdNote':'달러 환산 김프','usdtResult':'USDT/KRW 기준 해외환산가','usdtNote':'테더 시세 반영 차이','basisResult':'USDT의 원화 괴리','pending':'네 값을 입력하면 계산 결과가 표시됩니다.','invalid':'네 값 모두 0보다 큰 숫자로 입력해 주세요.','disclaimer':'직접 입력한 호가를 이용한 참고 계산입니다. 실시간 시세·체결 가능 가격이 아니며 거래 비용은 포함하지 않습니다.','live':'실시간 국내·해외 시세 보기','faqTitle':'자주 묻는 질문','faqs':[('김치 프리미엄은 어떻게 계산하나요?','국내 BTC/KRW를 해외 BTC/USDT에 USD/KRW 참고환율을 곱한 값과 비교합니다. 이 페이지는 국내 USDT/KRW를 적용한 별도 비교값도 함께 보여줍니다.'),('역프리미엄은 무슨 뜻인가요?','같은 기준으로 환산했을 때 국내 가격이 해외 기준가보다 낮은 상태를 말합니다. 거래소와 환율 기준, 관측 시각에 따라 수치가 달라질 수 있습니다.'),('역프면 해외에서 사서 국내에서 팔면 되나요?','그 숫자만으로 실행 가능한 차익거래라고 볼 수 없습니다. 양쪽 호가와 수수료, 슬리피지, 입출금 제한, 송금 시간과 환율을 함께 확인해야 합니다.')]},
    'en': {'kicker':'PRICE GAP / QUICK CALC','title':'Kimchi Premium Calculator','intro':'Enter four quotes observed at roughly the same time to compare the USD-converted gap with local tether pricing. Values are calculated in this browser and are not sent to the server.','local':'Korean BTC/KRW','binance':'Overseas BTC/USDT','usd':'USD/KRW reference','usdt':'Local USDT/KRW','hintLocal':'e.g. 106,500,000','hintBinance':'e.g. 75,000','hintUsd':'e.g. 1,400','hintUsdt':'e.g. 1,410','example':'Load example','clear':'Clear','usdResult':'Overseas value at USD/KRW','usdNote':'USD-based Korean premium','usdtResult':'Overseas value at USDT/KRW','usdtNote':'Gap adjusted for local tether','basisResult':'USDT vs USD in won','pending':'Enter all four values to see the comparison.','invalid':'Enter a number greater than zero in every field.','disclaimer':'A reference calculation from quotes you enter. It is not a live or executable price and excludes trading costs.','live':'See live Korean and overseas quotes','faqTitle':'Common questions','faqs':[('How is the Korean premium calculated?','Compare BTC/KRW in Korea with BTC/USDT multiplied by a USD/KRW reference rate. This page also shows a separate comparison using local USDT/KRW.'),('What does a negative premium mean?','After conversion on the same basis, the Korean quote is below the overseas benchmark. The figure can vary with venues, FX assumptions and observation times.'),('Does a negative premium guarantee arbitrage?','No. Check executable quotes on both venues, fees, slippage, deposit or withdrawal limits, transfer time and FX before drawing that conclusion.')]},
    'zh': {'kicker':'价差 / 快速计算','title':'韩国溢价计算器','intro':'输入大致同一时刻的四个报价，分别比较美元换算价差与本地泰达币价格。计算只在当前浏览器完成，不会发送到服务器。','local':'韩国 BTC/KRW','binance':'海外 BTC/USDT','usd':'USD/KRW 参考汇率','usdt':'本地 USDT/KRW','hintLocal':'例如：106,500,000','hintBinance':'例如：75,000','hintUsd':'例如：1,400','hintUsdt':'例如：1,410','example':'载入计算示例','clear':'清空','usdResult':'按 USD/KRW 换算的海外价格','usdNote':'美元口径的韩国溢价','usdtResult':'按 USDT/KRW 换算的海外价格','usdtNote':'计入本地泰达币价格的差值','basisResult':'USDT 对美元的韩元价差','pending':'输入四个数值后显示结果。','invalid':'每个输入框都需要填写大于零的数字。','disclaimer':'根据手动输入报价进行参考计算，不是实时或可成交价格，也未计入交易成本。','live':'查看实时国内外报价','faqTitle':'常见问题','faqs':[('韩国溢价如何计算？','将韩国 BTC/KRW 与 BTC/USDT 乘以 USD/KRW 参考汇率后的价格进行比较。本页还提供按本地 USDT/KRW 计算的另一种比较。'),('负溢价是什么意思？','按同一口径换算后，韩国报价低于海外基准价。交易所、汇率假设和观测时点不同，结果也会变化。'),('负溢价就能保证套利吗？','不能。还要核对两边可成交报价、手续费、滑点、充提限制、转账时间和汇率。')]},
    'ja': {'kicker':'価格差 / クイック計算','title':'韓国プレミアム計算機','intro':'ほぼ同じ時刻の4つの価格を入力し、ドル換算と現地テザー価格を分けて比較します。入力値はこのブラウザー内で計算され、サーバーへ送信されません。','local':'韓国 BTC/KRW','binance':'海外 BTC/USDT','usd':'USD/KRW 参考レート','usdt':'韓国 USDT/KRW','hintLocal':'例：106,500,000','hintBinance':'例：75,000','hintUsd':'例：1,400','hintUsdt':'例：1,410','example':'計算例を入力','clear':'クリア','usdResult':'USD/KRW換算の海外価格','usdNote':'ドル基準の韓国プレミアム','usdtResult':'USDT/KRW換算の海外価格','usdtNote':'現地テザー価格を反映した差','basisResult':'USDTとUSDのウォン価格差','pending':'4つの値を入力すると結果を表示します。','invalid':'すべての欄に0より大きい数値を入力してください。','disclaimer':'入力した価格による参考計算です。リアルタイム価格・約定可能価格ではなく、取引コストも含みません。','live':'国内外のリアルタイム価格を見る','faqTitle':'よくある質問','faqs':[('韓国プレミアムはどう計算しますか？','韓国のBTC/KRWと、BTC/USDTにUSD/KRW参考レートを掛けた値を比較します。このページでは韓国のUSDT/KRWを使った別の比較も表示します。'),('逆プレミアムとは何ですか？','同じ基準で換算したとき、韓国価格が海外基準価格を下回る状態です。取引所、為替の前提、観測時刻によって数値は変わります。'),('逆プレミアムなら裁定取引できますか？','それだけでは判断できません。両市場の約定可能価格、手数料、スリッページ、入出金制限、送金時間、為替を確認してください。')]}
}

KIMCHI_HISTORY_COPY = {
    'ko': {
        'kicker':'90-DAY PREMIUM HISTORY','title':'김치 프리미엄, 흐름으로 보기',
        'intro':'계산기에서 나눈 달러 환산 기준과 국내 테더 기준의 변화를 30일·90일로 살펴봅니다.',
        'rangeLabel':'표시 기간','range30':'30일','range90':'90일',
        'seriesUsd':'달러 환산 기준','seriesUsdt':'국내 테더 기준 차이',
        'chartDescription':'비트코인 김치 프리미엄 과거 추이 그래프','tableCaption':'최근 김치 프리미엄 값',
        'dateLabel':'한국 날짜','pending':'그래프가 화면에 가까워지면 공개 과거 시세를 불러옵니다.',
        'loading':'거래소 캔들과 참고 환율을 맞추는 중…','cached':'최근 저장한 자료를 표시하고 있어요.',
        'updated':'과거 시세를 불러왔어요.','stale':'새 자료를 불러오지 못해 이 기기에 저장된 과거 값을 표시합니다.',
        'error':'과거 시세를 불러오지 못했습니다. 연결을 확인한 뒤 30일 또는 90일 버튼을 눌러 다시 시도하세요.',
        'partial':'자료가 충분하지 않아 {count}일만 표시합니다. 90일 선택은 자료가 채워지면 제공됩니다.',
        'asof':'기준: {date} KST · 표시 {count}일',
        'sourceTitle':'출처와 계산 방법',
        'method':'Bithumb BTC/KRW·USDT/KRW 한국시간 일봉 종가, Binance BTC/USDT의 한국시간 23시 마감 1시간봉, Frankfurter USD/KRW 일일 참고환율을 날짜별로 맞춥니다. 환율이 없는 날은 직전 발표일 값을 사용합니다. 필요한 자료가 모두 있는 날짜만 계산합니다.',
        'disclaimer':'서로 다른 시장의 일별 종가를 맞춰 본 과거 참고값입니다. 체결 가능한 호가나 차익거래 기회가 아니며, 수수료·스프레드·송금 제약을 반영하지 않습니다.'
    },
    'en': {
        'kicker':'90-DAY PREMIUM HISTORY','title':'See how the Korean premium moved',
        'intro':'Compare the dollar-converted benchmark and local tether-based gap from the calculator over 30 or 90 days.',
        'rangeLabel':'Display period','range30':'30 days','range90':'90 days',
        'seriesUsd':'USD-converted benchmark','seriesUsdt':'Local tether-based gap',
        'chartDescription':'Historical Bitcoin Korean premium chart','tableCaption':'Recent Korean premium values',
        'dateLabel':'Korea date','pending':'Public historical quotes load when this chart is near view.',
        'loading':'Aligning exchange candles and reference FX…','cached':'Showing recently saved data on this device.',
        'updated':'Historical quotes loaded.','stale':'Fresh data was unavailable; showing the historical values saved on this device.',
        'error':'Historical quotes could not be loaded. Check your connection, then select 30 or 90 days to retry.',
        'partial':'Only {count} aligned days are available. The 90-day view appears when enough data is available.',
        'asof':'As of {date} KST · {count} days shown',
        'sourceTitle':'Sources and method',
        'method':'Dates are aligned using Bithumb BTC/KRW and USDT/KRW daily closes in Korea time, the Binance BTC/USDT hourly candle ending at midnight Korea time, and Frankfurter daily USD/KRW reference rates. On dates without a published FX rate, the latest earlier rate is carried forward. Only dates with all required data are calculated.',
        'disclaimer':'A historical comparison of daily closes across separate markets. It is not an executable quote or an arbitrage opportunity, and does not account for fees, spreads or transfer limits.'
    },
    'zh': {
        'kicker':'90天溢价历史','title':'查看韩国溢价的变化',
        'intro':'按30天或90天比较计算器中的美元换算基准与本地泰达币价差。',
        'rangeLabel':'显示期间','range30':'30天','range90':'90天',
        'seriesUsd':'美元换算基准','seriesUsdt':'本地泰达币价差',
        'chartDescription':'比特币韩国溢价历史走势图','tableCaption':'近期韩国溢价值',
        'dateLabel':'韩国日期','pending':'图表接近屏幕时才会读取公开历史行情。',
        'loading':'正在对齐交易所K线与参考汇率…','cached':'正在显示保存在此设备上的近期数据。',
        'updated':'历史行情已载入。','stale':'无法取得最新数据；正在显示保存在此设备上的历史数值。',
        'error':'无法载入历史行情。请检查网络，然后点击30天或90天重试。',
        'partial':'目前只有 {count} 天的数据已对齐。数据充足后会开放90天视图。',
        'asof':'截至：{date} 韩国时间 · 显示 {count} 天',
        'sourceTitle':'数据来源与计算方法',
        'method':'按日期对齐 Bithumb 的 BTC/KRW、USDT/KRW 韩国时间日线收盘价、Binance BTC/USDT 韩国时间午夜收盘的1小时K线，以及 Frankfurter 每日 USD/KRW 参考汇率。若当天没有发布汇率，则沿用此前最近一次汇率。仅计算所需数据齐全的日期。',
        'disclaimer':'这是对不同市场每日收盘价的历史比较，不是可成交报价或套利机会，也未计入手续费、价差和转账限制。'
    },
    'ja': {
        'kicker':'90日間のプレミアム推移','title':'韓国プレミアムの動きを見る',
        'intro':'計算機で分けたドル換算基準と現地テザー基準の差を、30日・90日で比較します。',
        'rangeLabel':'表示期間','range30':'30日','range90':'90日',
        'seriesUsd':'ドル換算基準','seriesUsdt':'現地テザー基準の差',
        'chartDescription':'ビットコイン韓国プレミアムの過去推移チャート','tableCaption':'最近の韓国プレミアム値',
        'dateLabel':'韓国の日付','pending':'チャートが画面に近づくと公開履歴データを読み込みます。',
        'loading':'取引所の足と参考為替を照合中…','cached':'この端末に保存された新しいデータを表示しています。',
        'updated':'過去価格を読み込みました。','stale':'最新データを取得できず、この端末に保存された過去の値を表示しています。',
        'error':'過去価格を読み込めませんでした。接続を確認し、30日または90日を選んで再試行してください。',
        'partial':'照合できたデータは{count}日分です。90日表示はデータが揃うと利用できます。',
        'asof':'基準日：{date} KST · {count}日表示',
        'sourceTitle':'出典と計算方法',
        'method':'BithumbのBTC/KRW・USDT/KRWの韓国時間日足終値、Binance BTC/USDTの韓国時間0時に終わる1時間足、Frankfurterの日次USD/KRW参考レートを日付で照合します。為替レートがない日は直近の過去公表値を使います。必要なデータが揃った日だけ計算します。',
        'disclaimer':'異なる市場の日次終値を使った過去の比較です。約定可能な価格や裁定機会ではなく、手数料・スプレッド・送金制限も含みません。'
    }
}
