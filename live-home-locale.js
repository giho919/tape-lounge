/* Shared live-lounge shell labels for the localized app routes. */
(() => {
  'use strict';
  const lang = document.documentElement.lang;
  const langIndex = { en: 0, zh: 1, ja: 2 }[lang];
  if (langIndex === undefined) return;

  const copy = {
    '언어 선택':['Choose language','选择语言','言語を選択'],
    '다른 언어 페이지 열기':['Open this lounge in another language','以其他语言打开大厅','別の言語でラウンジを開く'],
    '언어별 Tape Lounge 페이지':['Tape Lounge languages','Tape Lounge 语言','Tape Lounge の言語'],
    '라운지 섹션':['Lounge sections','大厅栏目','ラウンジのセクション'],
    '더보기':['More','更多','その他'],
    '추가 라운지 기능':['More lounge tools','更多休息室工具','ラウンジの追加機能'],
    '지금 이 페이지를 열어 둔 창의 수 — 같은 사람이 탭을 여러 개 열면 함께 집계됩니다':['Open windows on this page; multiple tabs from one person are counted together.','当前打开此页面的窗口数；同一人的多个标签页会合并统计。','このページを開いているウィンドウ数。同じ人の複数タブはまとめて数えます。'],
    '라운지':['Lounge','大厅','ラウンジ'], '블라인드':['Blind chart','盲图','ブラインドチャート'],
    '국내장':['Markets','韩国市场','韓国市場'], '데스크':['Futures','合约交易台','先物デスク'],
    '차트 분석':['Charts','图表分析','チャート'], '온체인':['On-chain','链上数据','オンチェーン'],
    '발표장':['Calendar','经济日历','経済カレンダー'], '전략가들':['Strategists','策略师','ストラテジスト'],
    '실시간 시세·청산·채팅이 흐르는 메인 화면':['Live prices, liquidations and conversation','实时行情、清算与讨论','価格・清算・会話のライブ画面'],
    '블라인드 — 종목명을 가린 실제 차트 맞히기':['Blind chart practice with the asset hidden','隐藏资产名称的盲图练习','銘柄名を伏せたチャート練習'],
    '🎴 그때 나라면':['What would you have done?','如果当时是你？','あの時、自分なら？'],
    '선택은 둘, 다음 5일은 직접 확인':['Two choices. Reveal the next five days.','二选一，揭晓之后五天。','選択は二つ。次の5日間を確認。'],
    '판을 시작 →':['Take a seat →','开始这一局 →','ゲームを始める →'],
    '국내 시세·김프·관심 코인·Andy 후보':['Korean prices, premium, watchlist and Andy picks','韩国行情、溢价、自选与 Andy 观察','韓国価格・プレミアム・ウォッチリスト・Andy候補'],
    '국내 원화 가격과 해외 USDT 현물가를 비교합니다. 김프는 선택한 국내 거래소의 USDT/KRW 최근 체결가로 환산합니다.':['Compare Korean won prices with overseas USDT spot prices. The premium is converted using the latest USDT/KRW trade on the selected Korean exchange.','将韩国韩元价格与海外 USDT 现货价格进行比较。溢价使用所选韩国交易所最新的 USDT/KRW 成交价换算。','韓国ウォン建て価格と海外USDT現物価格を比較します。プレミアムは、選択した韓国取引所のUSDT/KRW最新約定価格で換算します。'],
    '계산 방식 ↗':['How it is calculated ↗','计算方式 ↗','計算方法 ↗'],
    '데스크 — 선물 시장 추세·주요 가격대·펀딩·호가를 한 화면에서':['Futures trend, key levels, funding and order book','合约趋势、关键价位、资金费率与盘口','先物トレンド・重要水準・資金調達率・板情報'],
    '차트 분석 — BTC 장기 빗각과 선형 평행 채널':['BTC long-term channels and chart analysis','BTC 长期通道与图表分析','BTC長期チャネルとチャート分析'],
    '온체인 — 수수료·미결제·고래 이동 등 거래소 밖 지표':['Network fees, open interest and large transfers','网络手续费、持仓量与大额转账','ネットワーク手数料・建玉・大口送金'],
    '발표장 — CPI·고용·FOMC 등 경제지표 발표 일정과 결과':['CPI, jobs and central-bank release calendar','CPI、就业与央行日程','CPI・雇用・中央銀行の発表予定'],
    '전략가들 — 월간 국면 판정·매일 후보 발굴·자동 운용 장부':['Monthly regime notes, daily scans and public ledgers','月度市场判断、每日扫描与公开记录','月次の相場判断・日次スキャン・公開運用記録'],
    '전략가들의 장부':['The strategists’ ledger','策略师记录','ストラテジストの記録'],
    '시장의 방향을 읽고, 후보를 찾고, 운용을 기록합니다.':['Read the market regime, find candidates and track portfolio decisions.','判断市场方向、寻找候选标的并记录运用情况。','相場の局面を読み、候補を探し、運用を記録します。'],
    '공식 전략가 · AI':['Official strategists · AI','官方策略师 · AI','公式ストラテジスト · AI'],
    '이달 시장 국면':['This month’s market regime','本月市场状态','今月の市場局面'],
    '오늘 발굴 후보':['Today’s scan candidates','今日扫描候选','本日のスキャン候補'],
    '鄭마담 포지션':['Madam Jeong’s position','郑夫人的持仓','鄭マダムのポジション'],
    '확인 중':['Checking…','读取中…','確認中…'],
    '최신 소견서 불러오는 중':['Loading the latest note…','正在加载最新意见…','最新の所見を読み込み中…'],
    '최신 전보 불러오는 중':['Loading the latest scan…','正在加载最新扫描…','最新のスキャンを読み込み中…'],
    '최신 장부 불러오는 중':['Loading the latest ledger…','正在加载最新记录…','最新の台帳を読み込み中…'],
    '세 가지 시선':['Three perspectives','三个视角','三つの視点'],
    '최근 서신과 전체 리포트':['Recent notes and full reports','最新简报与完整报告','最近の所見と全レポート'],
    'BTC · 금 자동 운용':['Automated BTC · gold allocation','BTC · 黄金自动配置','BTC・金の自動運用'],
    '01 · 운용 장부':['01 · Portfolio ledger','01 · 运用记录','01 · 運用台帳'],
    '지금 무엇을 보유하고 있나':['What is the portfolio holding?','当前持有什么？','現在の保有資産は？'],
    '시장 국면과 추세에 따른 BTC·금 선택, 그리고 과거 운용 결과를 기록합니다.':['Tracks BTC and gold allocation by market regime and trend, with historical results.','记录根据市场状态与趋势配置 BTC 或黄金的运用情况及历史结果。','相場局面とトレンドに応じたBTC・金の配分と、過去の運用結果を記録します。'],
    '최근 서신':['Latest note','最新简报','最新の所見'],
    '운용 장부 읽기 ↗':['Read ledger · Korean original ↗','查看运用记录 · 韩文原文 ↗','運用台帳を読む・韓国語原文 ↗'],
    '02 · 후보 관찰':['02 · Candidate watch','02 · 候选观察','02 · 候補の観察'],
    '다음에 살펴볼 종목은 무엇인가':['Which assets are worth watching next?','接下来值得关注哪些标的？','次に注目する銘柄は？'],
    '일봉 후보와 4시간봉의 돌파 후 지지를 나눠 봅니다. 이미 멀리 오른 종목은 따로 둡니다.':['Separates daily candidates from 4-hour breakout retests, and flags assets that have already run far.','区分日线候选与4小时突破后的回踩支撑，并单独标出涨幅已大的标的。','日足候補と4時間足のブレイク後の押し目を分け、すでに大きく上昇した銘柄も別に示します。'],
    '최근 전보':['Latest scan','最新扫描','最新のスキャン'],
    '최신 전보 확인 중':['Checking the latest scan…','正在读取最新扫描…','最新のスキャンを確認中…'],
    '후보 관찰 목록 ↗':['Candidate watchlist · Korean original ↗','候选观察列表 · 韩文原文 ↗','候補リスト・韓国語原文 ↗'],
    '월간 국면 판정':['Monthly regime research','月度市场状态研究','月次の相場局面分析'],
    '03 · 시장 판정':['03 · Market regime','03 · 市场状态','03 · 市場局面'],
    '이번 달 시장을 어떻게 읽나':['How does the model read this month?','模型如何解读本月市场？','今月の市場をどう読むか'],
    '온체인·심리·거시 흐름으로 시장 국면을 판정하고, 최근 판단의 변화를 살펴봅니다.':['Reviews the model’s regime assessment across on-chain, sentiment and macro signals, and how it has changed.','结合链上、情绪与宏观信息查看模型对市场状态的判断及近期变化。','オンチェーン・センチメント・マクロ指標による相場判定と、その変化を確認します。'],
    '최근 소견서':['Latest monthly note','最新月度意见','最新の月次所見'],
    '최신 소견서 확인 중':['Checking the latest note…','正在读取最新意见…','最新の所見を確認中…'],
    '월간 소견서 읽기 ↗':['Read monthly note · Korean original ↗','查看月度意见 · 韩文原文 ↗','月次所見を読む・韓国語原文 ↗'],
    '금 보유':['Holding gold','持有黄金','金を保有'],
    'BTC 보유':['Holding BTC','持有 BTC','BTC を保有'],
    'PAXG 보유':['Holding PAXG','持有 PAXG','PAXG を保有'],
    '추세 이탈 구간':['Trend invalidation zone','趋势失效区间','トレンド崩れの局面'],
    '임시 판정':['Provisional','临时判断','暫定判定'],
    '라운지 주요 기록':['Lounge rotation','大厅轮播','ラウンジ表示'], '오늘의 판':['Today’s chart','今日盲图','今日のチャート'],
    '오늘의 판, 일봉 200개 버텨볼래?':['Today’s chart: can you make it through 200 candles?','今日盲图：你能坚持走完200根K线吗？','今日のチャート、日足200本を乗り切れる？'],
    '오늘 이어서 도전 ↗':['Continue today’s round ↗','继续今天的牌局 ↗','今日の一局を続ける ↗'],
    '오늘 판 바로 시작 ↗':['Start today’s round ↗','立即开始今日牌局 ↗','今日の一局を始める ↗'],
    '오늘의 판 · 약 4분':['Today’s chart · about 4 min','今日盲图 · 约4分钟','今日のチャート・約4分'],
    '오늘의 미국 주식 판 · 약 4분':['Today’s U.S. stock chart · about 4 min','今日美股盲图 · 约4分钟','今日の米国株チャート・約4分'],
    '종목과 날짜를 가린 실제 과거 차트. 기본 2× 속도로 약 4분이면 끝나고, 같은 기간 보유와 비교합니다.':['A real historical chart with its ticker and dates hidden. A round takes about 4 minutes at the default 2× speed; compare your result with holding.','在隐藏标的和日期的真实历史图表上进行练习。默认2倍速约4分钟；结束后与同期持有比较。','銘柄と日付を伏せた実際の過去チャートで練習。標準の2倍速で約4分、同期間の保有と比べます。'],
    '로그인 없이 종목·날짜를 가린 실제 차트에서 매수·매도를 연습하세요. 200일 후 같은 기간 보유와 비교합니다. 기본 2×로 약 4분.':['No login needed. Practice buy and sell timing on a real chart with its asset and dates hidden. Compare with holding after 200 days; about 4 min at default 2×.','无需登录。在隐藏标的和日期的真实图表上练习买卖，200天后与同期持有比较；默认2倍速约4分钟。','ログイン不要。銘柄と日付を伏せた実チャートで売買を練習し、200日後に同期間の保有と比較。標準2倍速で約4分。'],
    '로그인 없이 무료 4분 한 판. 종목·날짜를 가린 실제 미국주식 차트 200거래일을 매매해 보세요. 그냥 보유했을 때보다 잘할 수 있을까요?':['Free, no-login 4-minute challenge: trade 200 days on a real U.S. stock chart with the ticker and dates hidden. Can your timing beat buy-and-hold?','无需登录，免费挑战一局，约4分钟：在隐藏代码和日期的真实美股图表上交易200个交易日。你的操作能胜过同期持有吗？','ログイン不要、無料で約4分の一局。銘柄名と日付を隠した実際の米国株チャート200営業日を売買し、同期間の保有に勝てるか試せます。'],
    '친구와 한 판 ↗':['Challenge a friend ↗','邀请朋友一起玩 ↗','友だちを誘う ↗'],
    '오늘의 판 초대':['Invite someone to today’s round','邀请朋友参加今日牌局','今日の一局に友だちを招待'],
    '복사할 초대 문구와 링크':['Invitation text and link to copy','可复制的邀请文案和链接','コピーする招待文とリンク'],
    '그때 나라면?':['What would you have done?','如果当时是你？','あの時、自分なら？'],
    '그때 나라면':['Decision practice','决策练习','判断練習'],
    '그때 나라면 한 판 ↗':['Try a decision round ↗','来做一局判断练习 ↗','判断練習を一局 ↗'],
    '그때 나라면, 과거 시장에서 선택 연습하기':['Practice decisions on past markets','在历史行情中练习判断','過去の相場で判断を練習'],
    '매수·대기·보유·청산을 고르고 다음 5일을 확인해요. 1D·4H·1H 차트와 당시 심리·펀딩비도 볼 수 있어요.':['Choose buy, wait, hold or exit, then reveal the next five days. Switch 1D, 4H and 1H charts; check the prior-day Fear & Greed reading and historical funding.','选择买入、等待、持有或卖出，再揭晓之后五天。可切换1D、4H、1H图表，并查看前一日恐惧与贪婪指数和历史资金费率。','買う・待つ・保有・決済を選び、その後5日を確認。1D・4H・1H足を切り替え、前日のFear & Greedと当時のFundingも見られます。'],
    '한 판 시작 ↗':['Play a round ↗','开始一局 ↗','一局始める ↗'],
    '오늘 결과 다시 보기 ↗':['Review today’s result ↗','查看今日结果 ↗','今日の結果を見る ↗'],
    '라운지 정보 선택':['Choose lounge feature','选择大厅内容','ラウンジ表示を選択'],
    '라운지 정보 넘기기':['Lounge feature controls','大厅内容控制','ラウンジ表示の操作'],
    '이전 정보':['Previous feature','上一项','前の項目'], '다음 정보':['Next feature','下一项','次の項目'],
    '자동 넘김 시작':['Start automatic rotation','开始自动轮播','自動切り替えを開始'],
    'Andy 관찰':['Andy watch','Andy 观察','Andy の観察'],
    '세션 관전석':['Session watch','时段观察席','セッション観戦席'],
    '세션 챔피언십':['Session championship','时段冠军赛','セッション・チャンピオンシップ'],
    '🏆 세션 챔피언십':['🏆 Session championship','🏆 时段冠军赛','🏆 セッション・チャンピオンシップ'],
    '아시아 · 유럽 · 미국장 — 최근 한 바퀴 비교':['Asia · Europe · US — latest session comparison','亚洲 · 欧洲 · 美国 — 最近一轮比较','アジア・欧州・米国 — 直近セッション比較'],
    '아시아':['Asia','亚洲','アジア'], '유럽':['Europe','欧洲','欧州'], '미국':['US','美国','米国'],
    '오늘 마감':['Closed today','今日收盘','本日終了'], '어제 마감':['Closed yesterday','昨日收盘','昨日終了'],
    '진행 중':['In progress','进行中','進行中'], '아직 열리지 않음':['Not open yet','尚未开盘','未開始'],
    'LATEST':['LATEST','最新','最新'], 'ASIA LEADS':['Asia leads','亚洲领先','アジアが首位'],
    'EUROPE LEADS':['Europe leads','欧洲领先','欧州が首位'], 'US LEADS':['US leads','美国领先','米国が首位'],
    '최근 5분봉 장부를 읽고 있습니다.':['Reading the latest 5-minute candle record.','正在读取最近的5分钟K线记录。','最新の5分足データを読み込んでいます。'],
    '세션 장부를 기다리고 있습니다.':['Waiting for session data.','正在等待时段数据。','セッションデータを待っています。'],
    '세션 장부를 다시 불러오는 중입니다.':['Reloading session data.','正在重新加载时段数据。','セッションデータを再読み込みしています。'],
    '변동폭':['Range','波动幅度','値幅'], '한국시간 기준 · 각 세션의 최근 회차':['KST · latest completed or active session','韩国时间 · 各时段最近一轮','KST・各セッションの直近回'],
    '코인 경마장':['Coin race','加密币赛马','コインレース'], '🏁 코인 경마장':['🏁 Coin race','🏁 加密币赛马','🏁 コインレース'],
    '8마리 · 5분 레이스':['8 assets · 5-minute race','8 个币种 · 5 分钟一轮','8銘柄・5分レース'],
    '시세 연결 중':['Connecting to prices','正在连接行情','価格に接続中'], '연결 중':['Connecting','连接中','接続中'],
    '남은 시간':['Time remaining','剩余时间','残り時間'], '캔들 덱':['Candle deck','K线牌组','ローソク足デッキ'],
    '🃏 캔들 덱':['🃏 Candle deck','🃏 K线牌组','🃏 ローソク足デッキ'],
    '마감마다 새 카드 · 장대봉 = 레어':['A new card each close · long candle = rare','每根收盘生成新牌 · 长K线为稀有牌','足の確定ごとに新カード・大陽線はレア'],
    '확대해서 보기':['Expand chart','放大图表','チャートを拡大'], '분석 원본':['Analysis source','分析原文','分析原本'],
    '공유':['Share','分享','共有'],
    '1분':['1 min','1 分钟','1分'], '15분':['15 min','15 分钟','15分'],
    '60분':['60 min','60 分钟','60分'], '240분':['4 hr','4 小时','4時間'],
    '일봉':['1 day','日线','日足'], '주봉':['1 week','周线','週足'], '월봉':['1 month','月线','月足'],
    'MACD 지표':['MACD indicator','MACD 指标','MACD 指標'], 'RSI 지표':['RSI indicator','RSI 指标','RSI 指標'],
    '차트 이미지 저장 및 링크 공유':['Save chart image and share a link','保存图表图片并分享链接','チャート画像を保存してリンクを共有'],
    'Supertrend · Wilder ATR 10, 배수 3. 진행 중인 봉의 값은 바뀔 수 있습니다.':['Supertrend · Wilder ATR 10, multiplier 3. The current candle can change.','Supertrend · Wilder ATR 10，系数 3。当前K线数值可能变化。','Supertrend・Wilder ATR 10、係数3。形成中のローソク足の値は変わることがあります。'],
    '상승':['Up','上涨','上昇'], '하락':['Down','下跌','下落'], '점선':['dotted','虚线','点線'], '(점선)':['(dotted)','（虚线）','（点線）'], '마감':['Close','收盘','確定'],
    '현재 봉 · 마감 전 변동 가능':['Current candle · may change before close','当前K线 · 收盘前可能变化','現在の足・確定前に変動する場合があります'],
    '모의투자':['Paper trading','模拟交易','ペーパートレード'], '💵 모의투자':['💵 Paper trading','💵 模拟交易','💵 ペーパートレード'],
    'BTC 무기한 · 격리 마진':['BTC perpetual · isolated margin','BTC 永续 · 逐仓','BTC無期限・分離マージン'],
    '가상 자금 $10,000':['Virtual funds $10,000','虚拟资金 $10,000','仮想資金 $10,000'], '지갑 잔고':['Wallet balance','钱包余额','口座残高'],
    '포지션':['Position','持仓','ポジション'], '주문하면 시작됩니다':['Place a paper order to begin','下模拟订单后开始','模擬注文で開始'],
    '총자산':['Total equity','总资产','総資産'], '레버리지 · 격리':['Leverage · isolated','杠杆 · 逐仓','レバレッジ・分離'],
    '최대 주문가능':['Maximum order size','最大可下单金额','最大注文可能額'], '주문 비율 · 수수료 0.10%':['Order size · 0.10% fee','下单比例 · 手续费 0.10%','注文比率・手数料 0.10%'],
    '주문 비율 (%)':['Order size (%)','下单比例（%）','注文比率（%）'],
    '주문 비율 조정 (%)':['Adjust order size (%)','调整下单比例（%）','注文比率を調整（%）'],
    '롱 25%':['Long 25%','做多 25%','ロング 25%'], '숏 25%':['Short 25%','做空 25%','ショート 25%'],
    '실제 주문이 아닙니다 · 체결가와 청산은 서버가 바이낸스 시세로 판정합니다':['No real orders · fills and liquidation use Binance prices','不会提交真实订单 · 成交与清算按 Binance 行情判定','実注文はありません・約定と清算はBinance価格で判定'],
    '라운지 채팅':['Lounge chat','大厅聊天','ラウンジチャット'], '🥂 라운지 채팅':['🥂 Lounge chat','🥂 大厅聊天','🥂 ラウンジチャット'],
    '실시간 · 한국시간':['Live · Korea time','实时 · 韩国时间','ライブ・韓国時間'],
    '실시간 연결 중':['Connecting to live chat','正在连接实时聊天','リアルタイム接続中'],
    '실시간 연결 지연':['Live chat connection delayed','实时聊天连接延迟','リアルタイム接続が遅れています'],
    '재연결 중':['Reconnecting','正在重新连接','再接続中'],
    '대화 잠시 멈춤':['Chat paused','对话已暂停','チャット一時停止'],
    '접속자 연결 중':['Connecting viewer count','正在连接观众人数','観戦者数を確認中'],
    '접속자 확인 지연':['Viewer count delayed','观众人数更新延迟','観戦者数の確認が遅れています'],
    '자리 비움':['Away','暂时离开','離席中'],
    '닉네임 설정':['Set nickname','设置昵称','ニックネーム設定'],
    '라운지 대화 · 작성 시각은 한국시간':['Lounge conversation · timestamps in Korea time','大厅对话 · 时间为韩国时间','ラウンジの会話・時刻は韓国時間'],
    '크루 이름을 누르면 소개와 최근 발언을 볼 수 있어요.':['Select a crew member to see their profile and recent remarks.','点击成员名称可查看介绍和近期发言。','クルー名を押すと紹介と最近の発言を見られます。'],
    '채팅 메시지':['Chat message','聊天内容','チャットメッセージ'], '전송':['Send','发送','送信'],
    '체결의 비':['Trade-flow rain','成交雨','約定の雨'], '🌧 체결의 비':['🌧 Trade-flow rain','🌧 成交雨','🌧 約定の雨'],
    '실시간 전체 체결 · 왼쪽 매도 / 오른쪽 매수':['Live trades · sells left / buys right','实时成交 · 左侧卖出 / 右侧买入','全約定 · 左が売り / 右が買い'],
    '매수 체결':['Buy trades','买入成交','買い約定'], '매도 체결':['Sell trades','卖出成交','売り約定'],
    '방울 크기 = 체결 금액':['Drop size = trade value','水滴大小 = 成交金额','しずくの大きさ = 約定金額'],
    '금테 = $50만+ 고래':['Gold rim = trades above $500K','金边 = 超过 $50 万的大额成交','金縁 = 50万ドル超の大口'],
    '퍼지는 파문 = 선물 청산':['Ripple = futures liquidation','扩散涟漪 = 合约清算','広がる波紋 = 先物清算'],
    '호가창':['Order book','订单簿','板情報'], '📊 호가창':['📊 Order book','📊 订单簿','📊 板情報'],
    '매도벽·매수벽 · 체결이 벽을 부순다':['Bid and ask walls · trades break through','买卖盘墙 · 成交冲破挂单墙','売買の壁・約定が板を崩す'],
    '확인':['Confirm','确认','確認'], '취소':['Cancel','取消','キャンセル'], '저장':['Save','保存','保存'],
    '기록 보기':['View record','查看记录','記録を見る'], '월간 소견서 읽기 ↗':['Read monthly note ↗','阅读月度观点 ↗','月次ノートを読む ↗'],
    '후보 관찰 목록 ↗':['Candidate watchlist ↗','候选观察列表 ↗','候補ウォッチリスト ↗'],
    '운용 장부 읽기 ↗':['Read the operating ledger ↗','阅读运作记录 ↗','運用記録を読む ↗'],
    '🏆 실시간 포지션':['🏆 Live positions','🏆 实时持仓','🏆 リアルタイムポジション'],
    '미실현 수익률 순':['Ranked by unrealized return','按未实现收益率排序','未実現損益率順'], '게스트':['Guest','访客','ゲスト'],
    'LOUNGE CREW / 크루 명함':['LOUNGE CREW / Crew card','LOUNGE CREW / 成员名片','LOUNGE CREW / クルーカード'],
    '크루 명함 닫기':['Close crew card','关闭成员名片','クルーカードを閉じる'],
    '라운지 크루 · AI 캐릭터':['Lounge crew · AI character','大厅成员 · AI角色','ラウンジクルー・AIキャラクター'],
    '주로 보는 것':['What they follow','关注内容','主に見るもの'], '최근 발언 보기':['Recent remarks','近期发言','最近の発言'],
    '명함을 열 때 불러온 대화 중 최신 3개 · 한국시간 전체 발언 기록은 아니에요.':['The latest three messages loaded when this card opened · Korea time. Not a full history.','打开名片时加载的最新三条对话 · 韩国时间。并非完整发言记录。','カードを開いた際に読み込んだ最新3件・韓国時間。全発言履歴ではありません。'],
    '불러온 대화에 이 크루의 발언이 아직 없어요.':['No remarks from this crew member in the loaded conversation yet.','已加载的对话中暂时没有该成员的发言。','読み込んだ会話に、このメンバーの発言はまだありません。'],
    '공개 자료를 바탕으로 대화하는 AI예요. 실제 투자자나 투자 자문가가 아니며, 발언에 오류가 있을 수 있어요.':['An AI character responding to public information. Not a real investor or adviser; remarks may contain errors.','这是基于公开资料对话的AI角色，并非真实投资者或顾问，发言可能有误。','公開情報をもとに会話するAIキャラクターです。実在の投資家・助言者ではなく、発言に誤りが含まれる場合があります。'],
    '본 사이트는 정보 제공 목적이며 투자 권유가 아닙니다. 모든 투자 판단과 책임은 이용자 본인에게 있습니다.':['For information only, not investment advice. All investment decisions and responsibility remain with you.','本网站仅提供信息，不构成投资建议。投资决定与责任由用户自行承担。','本サイトは情報提供を目的とし、投資助言ではありません。投資判断と責任は利用者ご自身にあります。'],
    '최근 대화가 없어요 오늘 시장에서 눈에 들어온 장면을 먼저 남겨보세요.':['No recent chat. Share a market observation to get the conversation started.','暂无近期聊天。分享你今天注意到的行情，开启讨论。','最近の会話はありません。今日気になった相場の動きを投稿してみましょう。'],
    '최근 대화가 없어요':['No recent chat','暂无近期聊天','最近の会話はありません'],
    '오늘 시장에서 눈에 들어온 장면을 먼저 남겨보세요.':['Share a market observation to get the conversation started.','分享你今天注意到的行情，开启讨论。','今日気になった相場の動きを投稿してみましょう。'],
    '아무 곳이나 눌러 시작 →':['Click anywhere to begin →','点击任意位置开始 →','どこかをタップして開始 →'],
    '새 블록이 금고에 착륙했습니다.':['A new block has landed in the vault.','新区块已进入金库。','新しいブロックが保管庫に到着しました。'],
    '지금 이 순간 바이낸스에서 일어나는':['Happening on Binance right now,','此刻在币安发生的','いまBinanceで行われる'],
    '진짜 비트코인 거래':['real Bitcoin trades','真实的比特币成交','実際のビットコイン取引'],
    '가 빗방울로 떨어집니다.':['fall as raindrops.','像雨滴一样落下。','が雨粒となって降り注ぎます。'],
    '방울이 클수록 큰돈이 움직인 것':['Larger drops mean larger trades','水滴越大，成交金额越大','滴が大きいほど取引額も大きく'],
    '방울이 클수록 큰돈이 움직인 것 —':['Larger drops mean larger trades —','水滴越大，成交金额越大 —','滴が大きいほど取引額も大きく —'],
    '초록은 매수':['green means buying','绿色表示买入','緑は買い'], '빨강은 매도':['red means selling','红色表示卖出','赤は売り'],
    '예요.':['.','。','。'], '금테를 두른 방울은':['Gold-rimmed drops mark','带金边的水滴代表','金縁のしずくは'],
    '$50만 이상의 고래':['trades above $500K','超过 50 万美元的大额成交','50万ドル超の大口取引'],
    '퍼지는 파문은 강제 청산.':['; expanding ripples mark liquidations.','；扩散的涟漪代表强制平仓。','、広がる波紋は強制清算です。'],
    ', 퍼지는 파문은 강제 청산.':['; expanding ripples mark liquidations.','；扩散的涟漪代表强制平仓。','、広がる波紋は強制清算です。'],
    '비가 어느 쪽에 많이 내리는지가 곧 지금의 힘싸움입니다.':['The heavier side of the rain shows the current buying-versus-selling flow.','哪一侧的雨点更多，反映当前买卖力量的对比。','雨がどちらに多く降るかで、今の売買の勢いが見えてきます。'],
    '본 사이트는 정보 제공 목적이며 투자 권유가 아닙니다. 모든 투자 판단과 책임은 이용자 본인에게 있습니다. · 데이터: Binance, Bithumb, Frankfurter, mempool.space, BLS, BEA, Federal Reserve, alternative.me, CoinGecko (실시간, 지연 가능) · TAPE LOUNGE · CRYPTO LOUNGE · EST. 2026':['For information only, not investment advice. You are responsible for your investment decisions. · Data: Binance, Bithumb, Frankfurter, mempool.space, BLS, BEA, Federal Reserve, alternative.me and CoinGecko (live; may be delayed) · TAPE LOUNGE · CRYPTO LOUNGE · EST. 2026','本网站仅供信息参考，不构成投资建议。投资决定与责任由用户自行承担。· 数据：Binance、Bithumb、Frankfurter、mempool.space、BLS、BEA、Federal Reserve、alternative.me、CoinGecko（实时，可能延迟）· TAPE LOUNGE · CRYPTO LOUNGE · EST. 2026','本サイトは情報提供を目的とし、投資助言ではありません。投資判断と責任は利用者ご自身にあります。・データ：Binance、Bithumb、Frankfurter、mempool.space、BLS、BEA、Federal Reserve、alternative.me、CoinGecko（リアルタイム、遅延の可能性あり）・TAPE LOUNGE・CRYPTO LOUNGE・EST. 2026'],
    '자동 넘김 멈추기':['Pause automatic rotation','暂停自动轮播','自動切り替えを停止'],
    '한마디 남기기…':['Leave a message…','留下一句话…','ひと言残す…'],
    'BTC 장기 빗각 차트. 확대 후 좌우로 이동할 수 있습니다.':['BTC long-term channel chart. Zoom in, then scroll horizontally.','BTC长期通道图。放大后可左右滚动。','BTC長期チャネル図。拡大後、左右にスクロールできます。'],
    '2017년 8월부터 2026년 10월까지 BTC 확정 주봉과 진행 중인 주봉, 2018년과 2022년 저점을 잇는 선형 평행 채널 13개.':['BTC weekly candles from August 2017 through October 2026, including the developing week, with 13 linear parallel channels anchored to the 2018 and 2022 lows.','2017年8月至2026年10月的BTC周线（含尚未收盘的本周），以及以2018年和2022年低点为锚的13条线性平行通道。','2017年8月から2026年10月までのBTC週足（未確定の週を含む）と、2018年・2022年の安値を基準にした13本の線形平行チャネル。'],
    '2022년 이후 선형 채널 비교 차트':['Linear channel comparison chart since 2022','2022年以来的线性通道对比图','2022年以降の線形チャネル比較図'],
    '2022년 11월부터 2026년 10월까지 BTC 주봉과 선형 평행 채널 13개.':['BTC weekly candles from November 2022 through October 2026 with 13 linear parallel channels.','2022年11月至2026年10月的BTC周线与13条线性平行通道。','2022年11月から2026年10月までのBTC週足と13本の線形平行チャネル。'],
    '마켓 인텔리전스 화면':['Market intelligence panel','市场情报界面','マーケット情報パネル'],
    '미결제약정 최근 1시간':['Open interest over the past hour','过去1小时未平仓合约','直近1時間の未決済建玉'],
    '누적 체결 델타':['Cumulative volume delta','累计成交量差','累積約定デルタ'],
    '鄭마담':['Madam Jeong','郑夫人','鄭マダム'],
  };

  // Blind chart controls and game copy use the Korean source markup. Keep the
  // same layout and translate both initial text and dynamically-created rounds.
  Object.assign(copy, {
    '🎰 블라인드 차트':['🎰 Blind chart','🎰 盲图挑战','🎰 ブラインドチャート'],
    '랜덤 과거 차트 · 종목·날짜는 정산 때 공개':['Random past chart · ticker and dates revealed at settlement','随机历史图表 · 结算时揭晓代码和日期','ランダムな過去チャート · 銘柄と日付は精算時に公開'],
    '🎲 나만의 판':['🎲 Solo table','🎲 单人牌局','🎲 ソロプレイ'],
    '🎴 오늘의 판':['🎴 Daily table','🎴 今日牌局','🎴 今日の一局'],
    '👥 함께 보는 판':['👥 Shared table','👥 同桌对局','👥 みんなでプレイ'],
    '🎴 그때 나라면':['🎴 What would you have done?','🎴 如果当时是你？','🎴 あの時、自分なら？'],
    '시장 선택':['Choose a market','选择市场','市場を選択'],
    '🪙 코인':['🪙 Crypto','🪙 加密资产','🪙 暗号資産'],
    '📈 미국주식':['📈 U.S. stocks','📈 美股','📈 米国株'],
    '미국 증시':['U.S. market','美国市场','米国市場'],
    '코인 시장':['crypto market','加密市场','暗号資産市場'],
    '오늘 모두 같은 차트 · 200거래일 · 한국시간 자정 교체':['One shared chart today · 200 trading days · resets at midnight KST','今日所有人挑战同一张图 · 200个交易日 · 韩国时间午夜更新','今日の共通チャート · 200取引日 · KST午前0時に更新'],
    '같은 숨은 차트 · 같은 속도로 함께 출발':['Start together with friends on the same hidden chart at the same speed','和朋友用同一张隐藏图表、相同速度一起开始','友だちと同じ非公開チャート・速度で一緒にスタート'],
    '지난 판 재연 · 오늘의 연속 출전 기록과 별도':['Replay a past round · does not count toward today’s streak','重玩历史牌局 · 不计入今日连续挑战','過去の一局を再プレイ · 今日の連続記録には含まれません'],
    '과거의 어느 실제 ':['You land in a real past ','进入真实的历史','実際の過去の'],
    '에 던져집니다. ':['. ','。','に飛び込みます。'],
    '종목도, 날짜도 비밀.':['The asset and date stay hidden.','标的和日期暂不公开。','銘柄も日付も秘密です。'],
    '일봉 200개 뒤 종목·날짜가 공개되고, 같은 구간 보유 수익률과 비교합니다.':['After 200 daily candles, the asset and dates are revealed. Compare your trades with holding over the same period.','200根日K线后揭晓标的和日期，并与同期持有收益率比较。','日足200本後に銘柄と日付を公開し、同期間の保有リターンと比較します。'],
    '오늘의 판 시작':['Start today’s round','开始今日牌局','今日の一局を始める'],
    '오늘의 판 시작 →':['Start today’s round →','开始今日牌局 →','今日の一局を始める →'],
    '처음부터 다시':['Start over','从头开始','最初からやり直す'],
    '지난 판 다시 하기':['Replay this round','重玩本局','この一局を再プレイ'],
    '지난 판 다시 하기 →':['Replay this round →','重玩本局 →','この一局を再プレイ →'],
    '같은 판 다시 연습 →':['Practice this round again →','再次练习本局 →','同じ一局をもう一度練習 →'],
    '친구와 같은 판 하기 ↗':['Play the same round with a friend ↗','和朋友一起玩同一局 ↗','友だちと同じ一局をプレイ ↗'],
    '첫 완주 기록을 이 브라우저에 저장했습니다.':['Your first finish was saved in this browser.','首次完赛记录已保存在此浏览器。','初回完走記録をこのブラウザーに保存しました。'],
    '남아 있는 포지션은 마지막 종가로 평가합니다.':['Open positions are valued at the final closing price.','未平仓位按最后收盘价估值。','残っているポジションは最終終値で評価します。'],
    '시작가는 100으로 환산되어 힌트가 없습니다.':['Prices are rebased to 100, so there are no clues.','价格统一换算为100，不提供额外线索。','開始価格は100に換算し、手掛かりを隠します。'],
    '과거의 어느 실제 미국 증시에 던져집니다.':['You’re dropped into a real U.S. market from the past.','进入一段真实的历史美股行情。','過去の実際の米国市場に入り込みます。'],
    '가상 자금':['Virtual funds','虚拟资金','仮想資金'],
    '으로 매매합니다. 실제 주문은 없습니다.':[' to trade. No real orders are placed.','用于模拟交易，不会下达真实订单。','で売買します。実際の注文は行いません。'],
    '가상 자금 $10,000 · 실제 주문 없음 · 기본 속도 2×로 약 4분. 시작 전이나 진행 중에 속도를 바꾸고 잠시 멈출 수 있어요.':['Virtual $10,000 · no real orders · about 4 minutes at 2× speed. You can change speed or pause before or during the round.','虚拟资金 $10,000 · 不会下达真实订单 · 2×速度下约需4分钟。开始前或进行中都可以调整速度或暂停。','仮想資金 $10,000・実際の注文なし・2倍速で約4分。開始前やプレイ中に速度を変更したり、一時停止したりできます。'],
    '시간이 저절로 흐르며 재생·일시정지·속도를 조절할 수 있습니다.':['Candles advance automatically. You can play, pause, or change the pace.','行情自动推进，可播放、暂停或调整速度。','チャートは自動で進み、再生・一時停止・速度を変更できます。'],
    '일봉 200개 뒤 종목·날짜를 공개하고, 같은 구간 보유 수익률과 비교합니다.':['After 200 daily candles, the asset and dates are revealed. Compare your trades with holding over the same period.','200根日K线后揭晓标的和日期，并与同期持有收益率比较。','日足200本後に銘柄と日付を公開し、同期間の保有リターンと比較します。'],
    '판에 앉는다 →':['Take your seat →','入座 →','席に着く →'],
    '게임 방식과 정산 기준 ↗':['How it works and how results are settled ↗','玩法与结算规则 ↗','遊び方と精算ルール ↗'],
    '💼 내 판돈':['💼 Your bankroll','💼 你的筹码','💼 持ち金'],
    '지갑 잔고':['Wallet balance','钱包余额','ウォレット残高'],
    '포지션':['Position','持仓','ポジション'],
    '없음':['None','无','なし'],
    '진입가':['Entry price','入场价','エントリー価格'],
    '청산가':['Liquidation price','强平价格','清算価格'],
    '명목가':['Notional value','名义价值','想定元本'],
    '증거금':['Margin','保证金','証拠金'],
    '미실현 손익':['Unrealized P&L','未实现盈亏','含み損益'],
    '총자산':['Total equity','总权益','総資産'],
    '수익률':['Return','收益率','リターン'],
    '레버리지 · 격리':['Leverage · isolated','杠杆 · 逐仓','レバレッジ・分離'],
    '최대 주문가능':['Max order size','最大可下单金额','最大注文額'],
    '주문 비율 · 수수료 0.10%':['Order size · 0.10% fee','下单比例 · 手续费 0.10%','注文比率・手数料 0.10%'],
    '증거금 비율 · 수수료 0.10%':['Margin allocation · 0.10% fee','保证金比例 · 手续费 0.10%','証拠金比率・手数料 0.10%'],
    '롱':['Long','做多','ロング'],
    '숏':['Short','做空','ショート'],
    '🏳 여기서 정산':['🏳 Settle here','🏳 在此结算','🏳 ここで精算'],
    '📒 거래 장부':['📒 Trade journal','📒 交易记录','📒 取引履歴'],
    '최고 기록 —':['Best —','最佳 —','最高記録 —'],
    '아직 거래가 없습니다':['No trades yet','尚无交易','まだ取引はありません'],
    '📊 구간 전망':['📊 Segment outlook','📊 区间预测','📊 区間予想'],
    '그룹 대기':['Waiting for group','等待加入牌局','グループ待機中'],
    '함께 보는 판에 입장하면 활성화됩니다.':['Available after you join a shared table.','加入同桌牌局后即可使用。','共有テーブルに参加すると利用できます。'],
    '차트 진행 속도':['Chart speed','图表速度','チャート速度'],
    '일시정지':['Pause','暂停','一時停止'],
    '⏸ 일시정지':['⏸ Pause','⏸ 暂停','⏸ 一時停止'],
    '속도 낮추기':['Decrease speed','降低速度','速度を下げる'],
    '차트 진행 속도 선택':['Choose chart speed','选择图表速度','チャート速度を選択'],
    '차트 속도를 1배로 바로 낮추기':['Set chart speed to 1×','立即将图表速度设为1倍','チャート速度を1倍にする'],
    '속도 높이기':['Increase speed','提高速度','速度を上げる'],
    '− 속도':['− Speed','− 速度','− 速度'],
    '강하게 돌파한 뒤 추세 지지선을 지켜내는 종목을 찾습니다.':['Find assets that break out strongly, then hold their trend support.','寻找强势突破后守住趋势支撑的资产。','強く上抜けた後、トレンドサポートを保つ銘柄を探します。'],
    '연속 출전은 당일 오늘의 판 완주로 기록됩니다.':['A streak advances only when you finish today’s daily round.','只有完成当天的今日牌局，连续挑战天数才会增加。','連続記録は当日の「今日の一局」を完走した場合に更新されます。'],
    '오늘 완주하면 연속 출전 기록이 갱신됩니다.':['Finish today’s round to extend your streak.','完成今日牌局即可延续连续挑战记录。','今日の一局を完走すると連続記録が更新されます。'],
    '오늘 완주하면 연속 출전 기록이 시작됩니다.':['Finish today’s round to start a streak.','完成今日牌局即可开始连续挑战。','今日の一局を完走すると連続記録が始まります。'],
    '완주와 연속 출전 기록은 이 브라우저에만 저장됩니다.':['Completion and streak records are stored only in this browser.','完赛与连续挑战记录仅保存在此浏览器。','完走・連続記録はこのブラウザーにのみ保存されます。'],
    '지난 판 완주 기록은 저장되지만 연속 출전에는 반영되지 않습니다.':['Past-round results are saved, but do not extend your streak.','历史牌局成绩会保存，但不会延长连续挑战记录。','過去の一局の結果は保存されますが、連続記録には加算されません。'],
    '오늘 출전 완료 ·':['Today’s round complete ·','今日已完成 ·','今日の一局完了・'],
    '어제까지 ':['Through yesterday: ','截至昨天已连续','昨日まで'],
    '일 연속 · 오늘 완주하면 이어집니다.':[' days in a row · finish today to keep it going.','天连续 · 完成今天即可延续。','日連続・今日完走で記録が続きます。'],
    '오늘 완주하면 이어집니다.':['Finish today to keep it going.','完成今日牌局即可延续。','今日完走で記録が続きます。'],
    '오늘의 과거 차트를 준비하고 있습니다…':['Preparing today’s past chart…','正在准备今日历史行情…','今日の過去チャートを準備中…'],
    '과거의 판을 뒤지는 중…':['Searching the historical rounds…','正在筛选历史行情…','過去の相場を探しています…'],
    '주식 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.':['Could not load stock data. Please try again shortly.','无法加载股票数据，请稍后重试。','株価データを読み込めませんでした。少し待ってから再試行してください。'],
    '판을 차리지 못했습니다. 잠시 후 다시 시도해 주세요.':['Could not set up the round. Please try again shortly.','无法准备牌局，请稍后重试。','ゲームを準備できませんでした。少し待ってから再試行してください。'],
    '오늘의 미국 주식 차트를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.':['Could not prepare today’s U.S. stock chart. Please try again shortly.','无法准备今日美股行情，请稍后重试。','今日の米国株チャートを準備できませんでした。少し待ってから再試行してください。'],
    '오늘의 차트에 연결하지 못했습니다. 같은 판으로 다시 시도해 주세요.':['Could not load today’s chart. Please retry the same round.','无法加载今日行情，请重试同一局。','今日のチャートを読み込めませんでした。同じ一局を再試行してください。'],
    '같은 판 재시도':['Retry this round','重试本局','同じ一局を再試行'],
    '같은 판 다시 연습':['Practice this round again','再次练习本局','同じ一局をもう一度練習'],
    '지난 판 다시 보기':['Replay a past round','重玩历史牌局','過去の一局を再プレイ'],
    '오늘·지난 날짜 바꾸기':['Choose today or a past date','选择今日或历史日期','今日・過去の日付を選択'],
    '미국 주식':['U.S. stocks','美股','米国株'],
    '거래일':['trading days','个交易日','取引日'],
    '일':['days','天','日'],
    '같은 판으로 다시 시도해 주세요.':['Please retry the same round.','请重试同一局。','同じ一局を再試行してください。'],
    '공유할 앱을 선택했어요.':['Choose an app to share with.','请选择要分享的应用。','共有するアプリを選択してください。'],
    '초대 문구와 판 링크를 복사했어요.':['Invitation and round link copied.','已复制邀请语和牌局链接。','招待文とゲームリンクをコピーしました。'],
    '아래 초대 문구와 링크를 선택해 복사해 주세요.':['Select and copy the invitation and link below.','请选中并复制下方的邀请语和链接。','下の招待文とリンクを選択してコピーしてください。'],
    '결과와 같은 판의 링크를 복사했습니다.':['Copied the result and link to this round.','已复制结果和本局链接。','結果と同じ一局のリンクをコピーしました。'],
    '아래 내용을 선택해 복사해 주세요.':['Select and copy the text below.','请选中并复制下方内容。','下の内容を選択してコピーしてください。'],
    '결과 카드 저장·공유':['Save and share result card','保存并分享结果卡片','結果カードを保存・共有'],
    '결과와 같은 판 링크 복사':['Copy result and round link','复制结果与牌局链接','結果と一局のリンクをコピー'],
    '시장이 수업료를 받아갔습니다.':['The market charged tuition this round.','这局交了市场学费。','今回は市場に授業料を払いました。'],
    '이번엔 존버가 이겼네요. 다음 판이 있습니다.':['Holding won this round. There’s always another.','这局持有策略胜出。下一局还在等你。','今回は保有が勝ちました。次の一局があります。'],
    '시장이 한 수 위였습니다. 판은 늘 다시 열립니다.':['The market had the better hand. The table will reopen.','这局市场技高一筹，牌桌还会再开。','今回は市場の一枚上でした。また次の一局があります。'],
    '가만히 있는 것도 실력이라는 걸 시장이 알려주는군요.':['The market reminds us that doing nothing can be a decision too.','市场提醒我们，有时不动也是一种选择。','動かないことも判断の一つだと、市場が教えてくれます。'],
    '강제청산':['Liquidated','强制平仓','強制清算'],
    '증거금 소멸':['Margin lost','保证金耗尽','証拠金消失'],
    '정리할 수량이 없습니다':['No position size to close','没有可平仓数量','決済できる数量がありません'],
    '주문 가능 금액이 부족합니다':['Insufficient available order value','可下单金额不足','注文可能額が不足しています'],
    '증거금이 부족합니다':['Insufficient margin','保证金不足','証拠金が不足しています'],
    '💀 파산':['💀 Bankrupt','💀 破产','💀 破産'],
    '🏳 중간 정산':['🏳 Early settlement','🏳 提前结算','🏳 途中精算'],
    '🎰 정체 공개':['🎰 Identity revealed','🎰 揭晓标的','🎰 銘柄を公開'],
    '한 판 더 🎲':['Another round 🎲','再来一局 🎲','もう一局 🎲'],
    '그룹을 만들거나 초대 코드로 입장하세요.':['Create a group or join with an invite code.','创建牌局，或使用邀请码加入。','グループを作るか、招待コードで参加してください。'],
    '숨은 차트와 주문 결과는 서버가 판정합니다.':['The server validates the hidden chart and trade results.','隐藏行情与交易结果由服务器判定。','隠されたチャートと取引結果はサーバーが判定します。'],
    '같은 차트 · 같은 시각':['Same chart · same start time','同一行情 · 同一开始时间','同じチャート・同じ開始時刻'],
    '새 그룹':['New group','新建牌局','新しいグループ'],
    '시작 지연':['Delayed start','延迟开始','開始を遅らせる'],
    '모두 READY하면 방장이 판을 엽니다.':['The host starts once everyone is READY.','所有人 READY 后由房主开始。','全員がREADYになるとホストが開始します。'],
    '전원 READY · 방장이 시작할 수 있습니다.':['Everyone is READY · the host can start.','全员 READY · 房主可以开始。','全員READY・ホストが開始できます。'],
    '한 명 이상 더 기다리는 중입니다.':['Waiting for at least one more player.','还需等待至少一位玩家。','あと1人以上の参加を待っています。'],
    'READY를 기다리는 중입니다.':['Waiting for players to be READY.','正在等待玩家 READY。','プレイヤーのREADYを待っています。'],
    '○ 대기':['○ Waiting','○ 等待中','○ 待機中'],
    '· 방장':['· Host','· 房主','・ホスト'],
    '방장':['Host','房主','ホスト'],
    '진행 중인 테이블은 정산 뒤에 나갈 수 있습니다.':['You can leave an active table after settlement.','牌局进行中，结算后才能离开。','進行中のテーブルは精算後に退出できます。'],
    '아직 READY하지 않은 사람이 있습니다.':['Some players are not READY yet.','还有玩家尚未 READY。','まだREADYしていない参加者がいます。'],
    '방장만 이 기능을 사용할 수 있습니다.':['Only the host can use this feature.','只有房主可以使用此功能。','この機能はホストのみ利用できます。'],
    '공동 진행이 시작된 뒤에 조작할 수 있습니다.':['Controls unlock after the shared round starts.','同桌牌局开始后才能操作。','共有ラウンド開始後に操作できます。'],
    '아직 공동 정산 시각이 되지 않았습니다.':['It is not time to settle the shared round yet.','还未到同桌牌局的结算时间。','共有ラウンドの精算時刻にはまだ達していません。'],
    '현재 이 판에서 나갈 수 없습니다.':['You cannot leave this round right now.','现在无法离开本局。','現在この一局から退出できません。'],
    '진행 중인 판에서 나갈까요? 현재 수익률과 판단 기록은 방에서 제거됩니다.':['Leave the active round? Your current return and decision history will be removed from the table.','要离开正在进行的牌局吗？当前收益率和判断记录将从牌桌移除。','進行中の一局から退出しますか？現在のリターンと判断記録はテーブルから削除されます。'],
    '선택한 ':['Selected ','已选择','選択した'],
    ' 시장으로 방을 엽니다.':[' market for the table.','市场创建牌局。','市場でテーブルを開きます。'],
    'READY':['READY','READY','READY'],
    '나':['Me','我','自分'],
    '테이블을 여는 중…':['Opening the table…','正在创建牌桌…','テーブルを開いています…'],
    '손님 확인이 필요합니다.':['Please confirm your guest name.','请确认访客昵称。','ゲスト名を確認してください。'],
    '6자리 코드를 입력해 주세요.':['Enter the 6-digit code.','请输入6位代码。','6桁のコードを入力してください。'],
    '테이블을 찾는 중…':['Finding the table…','正在查找牌桌…','テーブルを探しています…'],
    '테이블 연결에 실패했습니다. 입장 기록을 정리했으니 다시 시도해 주세요.':['Could not connect to the table. Your join attempt was cleared; please try again.','无法连接牌桌，已清理本次加入记录，请重试。','テーブルに接続できませんでした。参加記録を整理したので、もう一度お試しください。'],
    '참가자':['Players','参与者','参加者'],
    '현재 전망 구간':['Current outlook segment','当前预测区间','現在の予想区間'],
    '차트에서 의견 보기':['View decisions on chart','在图表中查看判断','チャートで判断を見る'],
    '방 선택':['Choose a table','选择牌桌','テーブルを選ぶ'],
    '초대 링크 복사':['Copy invite link','复制邀请链接','招待リンクをコピー'],
    '이 구간 전망은 이미 선택했습니다.':['You have already submitted an outlook for this segment.','你已经选择过本区间的预测。','この区間の予想はすでに選択済みです。'],
    '두 명 이상 앉아야 시작할 수 있습니다.':['At least two players are needed to start.','至少需要两名玩家才能开始。','開始には2人以上が必要です。'],
    '그룹 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.':['Could not connect to the group server. Please try again shortly.','无法连接牌局服务器，请稍后重试。','グループサーバーに接続できませんでした。少し待って再試行してください。'],
    '접속 확인이 필요합니다. 새로고침 후 다시 시도해 주세요.':['Connection check required. Refresh and try again.','需要验证连接，请刷新后重试。','接続確認が必要です。更新して再試行してください。'],
    '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.':['Could not process the request. Please try again shortly.','无法处理请求，请稍后重试。','リクエストを処理できませんでした。少し待って再試行してください。'],
  });

  const textMap = new Map(Object.entries(copy).map(([source, translations]) => [source, translations[langIndex] || translations[0]]));
  const liveToolsRoot = document.documentElement.dataset.liveToolsRoot;
  const liveToolPages = new Set(['blind', 'domestic', 'desk', 'analysis', 'onchain', 'calendar', 'strategists']);
  const tabSlugs = {
    lounge: '', game: 'blind', domestic: 'domestic', desk: 'desk',
    analysis: 'analysis', chain: 'onchain', macro: 'calendar', chars: 'strategists',
  };
  const routeTabs = Object.fromEntries(Object.entries(tabSlugs).map(([tab, slug]) => [slug, tab]));
  const preservedQuery = ['internal', 'utm_source', 'utm_medium', 'utm_campaign', 'asset', 'interval', 'tf', 'daily'];

  function selectedTabSlug() {
    const activeTab = document.querySelector('a[data-tab][aria-selected="true"], a[data-tab].on');
    if (activeTab && Object.hasOwn(tabSlugs, activeTab.dataset.tab)) return tabSlugs[activeTab.dataset.tab];
    const path = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '');
    const route = path.replace(/^(?:en|zh|ja)\/tools\/?/, '');
    return Object.hasOwn(routeTabs, route) ? route : '';
  }

  function localizedHref(targetLang) {
    const slug = selectedTabSlug();
    const pathname = targetLang === 'ko'
      ? (slug ? `/${slug}/` : '/')
      : (slug ? `/${targetLang}/tools/${slug}/` : `/${targetLang}/`);
    const target = new URL(pathname, location.origin);
    const current = new URL(location.href);
    for (const key of preservedQuery) {
      if (current.searchParams.has(key)) target.searchParams.set(key, current.searchParams.get(key));
    }
    return target;
  }

  function refreshLanguageLinks() {
    for (const link of document.querySelectorAll('a[data-language]')) {
      if (['ko', 'en', 'zh', 'ja'].includes(link.dataset.language)) {
        const target = localizedHref(link.dataset.language);
        link.setAttribute('href', `${target.pathname}${target.search}`);
      }
    }
  }

  function refreshDecisionLinks() {
    const target = ['en', 'zh', 'ja'].includes(lang) ? `/${lang}/decision/` : '/decision/';
    for (const link of document.querySelectorAll('a[data-decision-link]')) link.setAttribute('href', target);
  }

  function refreshBlindGuideLinks() {
    const target = `/${lang}/learn/blind-chart-practice/`;
    for (const link of document.querySelectorAll('a.bgGuideLink')) link.setAttribute('href', target);
  }

  refreshLanguageLinks();
  refreshDecisionLinks();
  refreshBlindGuideLinks();
  const tabList = document.querySelector('[role="tablist"]');
  if (tabList) new MutationObserver(refreshLanguageLinks).observe(tabList, {
    subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class'],
  });

  document.addEventListener('click', event => {
    const languageLink = event.target.closest?.('a[data-language]');
    if (languageLink && ['ko', 'en', 'zh', 'ja'].includes(languageLink.dataset.language)) {
      const target = localizedHref(languageLink.dataset.language);
      languageLink.setAttribute('href', `${target.pathname}${target.search}`);
      return;
    }
    const link = event.target.closest?.('a[href]');
    if (!link || !liveToolsRoot) return;
    try {
      const target = new URL(link.href, location.origin);
      if (target.origin !== location.origin) return;
      const slug = target.pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '');
      if (!slug) target.pathname = `${liveToolsRoot}/`;
      else if (liveToolPages.has(slug)) target.pathname = `${liveToolsRoot}/${slug}/`;
      else return;
      const current = new URL(location.href);
      for (const key of ['internal', 'utm_source', 'utm_medium', 'utm_campaign', 'asset', 'interval', 'tf', 'daily']) {
        if (current.searchParams.has(key) && !target.searchParams.has(key)) {
          target.searchParams.set(key, current.searchParams.get(key));
        }
      }
      link.href = target.href;
    } catch {}
  }, true);

  const dynamic = value => {
    const scanSchedule = value.match(/^매일 (\d{1,2})시 후보 발굴$/);
    if (scanSchedule) return lang === 'en'
      ? `Daily scan at ${scanSchedule[1]}:00 KST`
      : lang === 'zh' ? `每日韩国时间 ${scanSchedule[1]}:00 扫描` : `毎日KST ${scanSchedule[1]}:00にスキャン`;
    const strategistMeta = value.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (아침 서신|스캔 전보|월간 소견서)$/);
    if (strategistMeta) {
      const labels = {
        '아침 서신':['Morning note','早间简报','朝の所見'],
        '스캔 전보':['Scan note','扫描简报','スキャン速報'],
        '월간 소견서':['Monthly note','月度意见','月次所見'],
      };
      return `${strategistMeta[1]} KST · ${labels[strategistMeta[2]][langIndex]}`;
    }
    const monthlyVerdict = value.match(/^(\d{1,2})월 소견 · 판정 (허용|제한|차단)$/);
    if (monthlyVerdict) {
      const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][Number(monthlyVerdict[1]) - 1];
      const states = {
        '허용':['entry allowed','允许入场','エントリー許容'],
        '제한':['entry restricted','限制入场','エントリー制限'],
        '차단':['entry blocked','禁止入场','エントリー停止'],
      };
      return lang === 'en'
        ? `${monthName} note · ${states[monthlyVerdict[2]][0]}`
        : lang === 'zh' ? `${monthlyVerdict[1]}月意见 · ${states[monthlyVerdict[2]][1]}`
          : `${monthlyVerdict[1]}月所見・${states[monthlyVerdict[2]][2]}`;
    }
    if (value === '오늘의 미국 주식 판 · 약 4분') return lang === 'en'
      ? 'Today’s U.S. stock chart · about 4 min'
      : lang === 'zh' ? '今日美股盲图 · 约4分钟' : '今日の米国株チャート・約4分';
    if (value === '오늘의 판 · 약 4분') return lang === 'en'
      ? 'Today’s chart · about 4 min'
      : lang === 'zh' ? '今日盲图 · 约4分钟' : '今日のチャート・約4分';
    const hiddenMarket = value.startsWith('❓ ??? · ') ? value.slice('❓ ??? · '.length) : null;
    if (hiddenMarket === '미국 증시' || hiddenMarket === '코인 시장') {
      const market = hiddenMarket === '미국 증시'
        ? ['U.S. market', '美国市场', '米国市場']
        : ['Crypto market', '加密市场', '暗号資産市場'];
      return `❓ ??? · ${market[langIndex]}`;
    }
    const blindProgress = value.match(/^D\+(\d+) \/ (\d+)$/);
    if (blindProgress) return lang === 'en'
      ? `Day ${blindProgress[1]} / ${blindProgress[2]}`
      : lang === 'zh' ? `第 ${blindProgress[1]} / ${blindProgress[2]} 天`
        : `${blindProgress[1]}日目 / ${blindProgress[2]}日`;
    const bestRecord = value.match(/^최고 기록 ([+-]?\d+(?:\.\d+)?%)$/);
    if (bestRecord) return lang === 'en' ? `Best ${bestRecord[1]}`
      : lang === 'zh' ? `最佳 ${bestRecord[1]}` : `最高 ${bestRecord[1]}`;
    const dailyStreak = value.match(/^오늘 출전 완료 · (\d+)일 연속$/);
    if (dailyStreak) return lang === 'en' ? `Round complete · ${dailyStreak[1]}-day streak`
      : lang === 'zh' ? `今日完成 · 连续 ${dailyStreak[1]} 天` : `本日完走・${dailyStreak[1]}日連続`;
    const pendingStreak = value.match(/^(♠ )?어제까지 (\d+)일 연속 · 오늘 완주하면 이어집니다\.$/);
    if (pendingStreak) {
      const dayCount = Number(pendingStreak[2]), dayWord = dayCount === 1 ? 'day' : 'days';
      return lang === 'en'
      ? `${pendingStreak[1] || ''}Through yesterday: ${dayCount} ${dayWord} in a row · finish today to keep it going.`
      : lang === 'zh' ? `${pendingStreak[1] || ''}截至昨天已连续 ${pendingStreak[2]} 天 · 完成今天即可延续。`
        : `${pendingStreak[1] || ''}昨日まで${pendingStreak[2]}日連続・今日完走で記録が続きます。`;
    }
    const dailyMarket = value.match(/^(\d{4}-\d{2}-\d{2}) · (미국 주식|코인)$/);
    if (dailyMarket) {
      const market = dailyMarket[2] === '미국 주식'
        ? ['U.S. stocks', '美股', '米国株'] : ['Crypto', '加密资产', '暗号資産'];
      return `${dailyMarket[1]} · ${market[langIndex]}`;
    }
    const dailyIntro = value.match(/^로그인 없이 종목·날짜를 가린 실제 차트에서 매수·매도를 연습하세요\. 200(거래일|일) 후 같은 기간 보유와 비교합니다\. 기본 2×로 약 4분\.(?: 어제까지 (\d+)일 연속 · 오늘 완주하면 이어집니다\.)?$/);
    if (dailyIntro) {
      const period = dailyIntro[1] === '거래일'
        ? ['trading days', '个交易日', '取引日'] : ['days', '天', '日'];
      const translatedIntro = lang === 'en'
        ? `No login needed. Practice buy and sell timing on a real chart with its asset and dates hidden. Compare with holding after 200 ${period[0]}; about 4 min at default 2×.`
        : lang === 'zh'
          ? `无需登录。在隐藏标的和日期的真实图表上练习买卖，200${period[1]}后与同期持有比较；默认2倍速约4分钟。`
          : `ログイン不要。銘柄と日付を伏せた実チャートで売買を練習し、200${period[2]}後に同期間の保有と比較。標準2倍速で約4分。`;
      if (!dailyIntro[2]) return translatedIntro;
      const dayCount = Number(dailyIntro[2]);
      const translatedStreak = lang === 'en'
        ? `Yesterday’s ${dayCount}-day streak continues if you finish today.`
        : lang === 'zh' ? `截至昨天已连续完成 ${dayCount} 天，今天完赛即可延续。`
          : `昨日まで${dayCount}日連続。今日完走すれば記録が続きます。`;
      return `${translatedIntro} ${translatedStreak}`;
    }
    const dailyPanelIntro = value.match(/^종목과 날짜를 가린 같은 차트로 200(거래일|일) 동안 버텨 보세요\. 끝나면 내 매매와 같은 기간 보유 수익률을 비교합니다\.$/);
    if (dailyPanelIntro) {
      const period = dailyPanelIntro[1] === '거래일'
        ? ['trading days', '个交易日', '取引日'] : ['days', '天', '日'];
      return lang === 'en'
        ? `Trade through 200 ${period[0]} on the same chart with the asset and dates hidden. At the end, compare your trades with holding over the same period.`
        : lang === 'zh'
          ? `在隐藏标的和日期的同一张图表上坚持完成200${period[1]}。结束后，将你的交易与同期持有收益进行比较。`
          : `銘柄と日付を伏せた同じチャートで200${period[2]}を体験。最後に、自分の売買と同期間の保有リターンを比べます。`;
    }
    const savedProgress = value.match(/^이 기기에 D\+(\d+)까지 진행을 저장했습니다\. 브라우저를 닫았다 열어도 이어갈 수 있어요\.$/);
    if (savedProgress) return lang === 'en'
      ? `Progress through D+${savedProgress[1]} is saved on this device. Close your browser and come back anytime to continue.`
      : lang === 'zh'
        ? `进度已保存在此设备，当前至 D+${savedProgress[1]}。关闭浏览器后再回来也能继续。`
        : `D+${savedProgress[1]}までの進行状況をこの端末に保存しました。ブラウザーを閉じても、後から続けられます。`;
    const resumeProgress = value.match(/^D\+(\d+)부터 이어하기 →$/);
    if (resumeProgress) return lang === 'en'
      ? `Continue from D+${resumeProgress[1]} →`
      : lang === 'zh' ? `从 D+${resumeProgress[1]} 继续 →` : `D+${resumeProgress[1]}から再開 →`;
    const firstFinish = value.match(/^첫 완주 ([+-]?\d+(?:\.\d+)?%) · 같은 기간 보유 ([+-]?\d+(?:\.\d+)?%)$/);
    if (firstFinish) return lang === 'en'
      ? `First finish ${firstFinish[1]} · hold over the same period ${firstFinish[2]}`
      : lang === 'zh' ? `首次完赛 ${firstFinish[1]} · 同期持有 ${firstFinish[2]}`
        : `初回完走 ${firstFinish[1]}・同期間の保有 ${firstFinish[2]}`;
    const firstReturn = value.match(/^이 브라우저의 첫 완주 ([+-]?\d+(?:\.\d+)?%)$/);
    if (firstReturn) return lang === 'en' ? `This browser’s first finish ${firstReturn[1]}`
      : lang === 'zh' ? `此浏览器首次完赛 ${firstReturn[1]}` : `このブラウザーの初回完走 ${firstReturn[1]}`;
    const replayHeader = value.match(/^🎴 (\d{4}-\d{2}-\d{2}) · 지난 판$/);
    if (replayHeader) return lang === 'en' ? `🎴 ${replayHeader[1]} · Past round`
      : lang === 'zh' ? `🎴 ${replayHeader[1]} · 历史牌局` : `🎴 ${replayHeader[1]}・過去の一局`;
    const archiveChoice = value.match(/^(오늘 · )?(\d{2}\/\d{2}) · (미국주식|코인)$/);
    if (archiveChoice) {
      const today = archiveChoice[1] ? (lang === 'en' ? 'Today · ' : lang === 'zh' ? '今日 · ' : '今日・') : '';
      const market = archiveChoice[3] === '미국주식'
        ? ['U.S. stocks', '美股', '米国株'] : ['Crypto', '加密资产', '暗号資産'];
      return `${today}${archiveChoice[2]} · ${market[langIndex]}`;
    }
    const groupSegment = value.match(/^D\+(\d+) → D\+(\d+)$/);
    if (groupSegment) return `D+${groupSegment[1]} → D+${groupSegment[2]}`;
    const groupStart = value.match(/^동시 출발까지 (\d+)초$/);
    if (groupStart) return lang === 'en' ? `Starting together in ${groupStart[1]} sec`
      : lang === 'zh' ? `${groupStart[1]} 秒后同时开始` : `${groupStart[1]}秒後に同時スタート`;
    const groupProgress = value.match(/^([●⏸]) GROUP (LIVE|PAUSED) · (\d+)명 · D\+(\d+)\/(\d+)$/);
    if (groupProgress) {
      const state = groupProgress[2] === 'LIVE'
        ? ['LIVE', '进行中', '進行中'] : ['PAUSED', '已暂停', '一時停止'];
      const players = lang === 'en' ? `${groupProgress[3]} players` : lang === 'zh' ? `${groupProgress[3]} 人` : `${groupProgress[3]}人`;
      const day = lang === 'en' ? `Day ${groupProgress[4]} / ${groupProgress[5]}`
        : lang === 'zh' ? `第 ${groupProgress[4]} / ${groupProgress[5]} 天` : `${groupProgress[4]}日目 / ${groupProgress[5]}日`;
      return `${groupProgress[1]} ${state[langIndex]} · ${players} · ${day}`;
    }
    const deckTimeframe = value.match(/^([A-Z0-9.]+) · (1분|15분|60분|240분|일봉|주봉|월봉)$/);
    if (deckTimeframe) {
      const intervals = {
        '1분':['1 min','1 分钟','1分'], '15분':['15 min','15 分钟','15分'],
        '60분':['60 min','60 分钟','60分'], '240분':['4 hr','4 小时','4時間'],
        '일봉':['1 day','日线','日足'], '주봉':['1 week','周线','週足'], '월봉':['1 month','月线','月足'],
      };
      return `${deckTimeframe[1]} · ${intervals[deckTimeframe[2]][langIndex]}`;
    }
    const deal = value.match(/^TODAY'S DEAL · (\d{1,2})월 (\d{1,2})일 · (코인|미국 주식)$/);
    if (deal) {
      const month = Number(deal[1]), day = Number(deal[2]);
      const track = deal[3] === '코인' ? ['Crypto','加密货币','暗号資産'] : ['U.S. stocks','美股','米国株'];
      if (lang === 'en') return `TODAY'S DEAL · ${new Date(Date.UTC(2026, month - 1, day)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${day} · ${track[0]}`;
      return lang === 'zh' ? `今日牌局 · ${month}月${day}日 · ${track[1]}` : `今日の一局 · ${month}月${day}日 · ${track[2]}`;
    }
    const streak = value.match(/^오늘 완주했어요\. (\d+)일 연속 출전 기록을 다시 보고 같은 판을 공유해 보세요\.$/);
    if (streak) return lang === 'en'
      ? `You finished today. Review your ${streak[1]}-day streak or share the same round.`
      : lang === 'zh' ? `今天已完成。查看连续参与 ${streak[1]} 天的记录，或分享同一轮。`
        : `今日は完走しました。${streak[1]}日連続の記録を見返すか、同じ回を共有できます。`;
    const range = value.match(/^변동폭 ([0-9.]+%) · (\d+)분$/);
    if (range) return lang === 'en' ? `Range ${range[1]} · ${range[2]} min`
      : lang === 'zh' ? `波幅 ${range[1]} · ${range[2]} 分钟` : `値幅 ${range[1]}・${range[2]}分`;
    const viewers = value.match(/^(\d+)명 관전 중$/);
    if (viewers) return lang === 'en' ? `${viewers[1]} watching`
      : lang === 'zh' ? `${viewers[1]} 人正在观看` : `${viewers[1]}人が観戦中`;
    const raceLead = value.match(/^([A-Z]+) 선두 · 격차 ([+-]?[0-9.]+)%p$/);
    if (raceLead) return lang === 'en' ? `${raceLead[1]} leads · gap ${raceLead[2]} pp`
      : lang === 'zh' ? `${raceLead[1]} 领先 · 差距 ${raceLead[2]} 个百分点` : `${raceLead[1]}が首位・差 ${raceLead[2]}ポイント`;
    const seconds = value.match(/^(\d+)초$/);
    if (seconds) return lang === 'en' ? `${seconds[1]} sec` : lang === 'zh' ? `${seconds[1]} 秒` : `${seconds[1]}秒`;
    const spread = value.match(/^스프레드 ([0-9.]+)$/);
    if (spread) return lang === 'en' ? `Spread ${spread[1]}` : lang === 'zh' ? `价差 ${spread[1]}` : `スプレッド ${spread[1]}`;
    const session = value.match(/^([A-Z]+) 세션이 등락률 ([+-]?[0-9.]+%)로 수익률 선두입니다\. 변동폭은 ([0-9.]+%)입니다\.$/);
    if (session) {
      const names = lang === 'en' ? { ASIA:'Asia', EUROPE:'Europe', US:'US' } : lang === 'zh' ? { ASIA:'亚洲', EUROPE:'欧洲', US:'美国' } : { ASIA:'アジア', EUROPE:'欧州', US:'米国' };
      return lang === 'en'
        ? `${names[session[1]] || session[1]} leads at ${session[2]}. Range: ${session[3]}.`
        : lang === 'zh'
          ? `${names[session[1]] || session[1]}以 ${session[2]} 领先，波动幅度 ${session[3]}。`
          : `${names[session[1]] || session[1]}が ${session[2]} で首位。値幅は ${session[3]}。`;
    }
    const paperSide = value.match(/^(롱|숏)\s+(\d+(?:\.\d+)?)%(\s+\d+×)?$/);
    if (paperSide) {
      const side = paperSide[1] === '롱'
        ? ['Long', '做多', 'ロング']
        : ['Short', '做空', 'ショート'];
      return `${side[langIndex]} ${paperSide[2]}%${paperSide[3] || ''}`;
    }
    const generatedGuestNick = value.match(/게스트 ([0-9a-f]{4})/i);
    if (generatedGuestNick) {
      const guest = lang === 'en' ? 'Guest' : lang === 'zh' ? '访客' : 'ゲスト';
      return value.replace(/게스트 ([0-9a-f]{4})/gi, (_, code) => `${guest} ${code.toUpperCase()}`);
    }
    return null;
  };

  function translateText(node) {
    if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
    const value = node.nodeValue;
    const trimmed = value.trim();
    const normalized = trimmed.replace(/\s+/g, ' ');
    const parent = node.parentElement;
    const kpi = parent?.closest?.('.kpiTile')?.dataset.kpi;
    let replacement = textMap.get(trimmed) || textMap.get(normalized) || dynamic(normalized);
    if (!replacement && kpi === 'andy' && parent?.classList.contains('v')) {
      const count = normalized.match(/^(\d+)건$/);
      if (count) replacement = lang === 'en' ? `${count[1]} candidates`
        : lang === 'zh' ? `${count[1]} 个候选` : `${count[1]}件の候補`;
    }
    if (!replacement && kpi === 'andy' && parent?.classList.contains('d')) {
      const count = normalized.match(/^(\d+)종 스캔$/);
      if (count) replacement = lang === 'en' ? `${count[1]} assets scanned`
        : lang === 'zh' ? `已扫描 ${count[1]} 个币种` : `${count[1]}銘柄をスキャン`;
    }
    const sourceNote = {
      madamRecentText:['Latest portfolio note is in Korean; open the ledger for the full entry.','最新持仓简报为韩文；请打开运用记录查看原文。','最新の運用メモは韓国語です。台帳で全文を確認できます。'],
      andyRecentText:['Latest scan note is in Korean; open the watchlist for the full candidate list.','最新扫描简报为韩文；请打开观察列表查看完整候选。','最新のスキャン速報は韓国語です。候補一覧で全文を確認できます。'],
      justinRecentText:['The full monthly note is in Korean. The current regime status is shown above.','完整月度意见为韩文；当前市场状态见上方。','月次所見の全文は韓国語です。現在の相場局面は上に表示しています。'],
    };
    if (!replacement && sourceNote[parent?.id] && /[\uac00-\ud7a3]/.test(normalized)) replacement = sourceNote[parent.id][langIndex];
    if (replacement) node.nodeValue = value.replace(trimmed, replacement);
  }
  function translateElement(element) {
    for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = element.getAttribute?.(name);
      const normalized = value?.trim().replace(/\s+/g, ' ');
      const replacement = value && (textMap.get(value.trim()) || textMap.get(normalized) || dynamic(normalized));
      if (replacement) element.setAttribute(name, replacement);
    }
    for (const child of element.childNodes || []) {
      if (child.nodeType === Node.TEXT_NODE) translateText(child);
      else if (child.nodeType === Node.ELEMENT_NODE) translateElement(child);
    }
  }

  translateElement(document.documentElement);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') translateText(record.target);
      for (const node of record.addedNodes || []) {
        if (node.nodeType === Node.TEXT_NODE) translateText(node);
        else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node);
      }
      if (record.type === 'attributes' && record.target.nodeType === Node.ELEMENT_NODE) {
        const element = record.target;
        for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
          const value = element.getAttribute(name);
          const normalized = value?.trim().replace(/\s+/g, ' ');
          const replacement = value && (textMap.get(value.trim()) || textMap.get(normalized) || dynamic(normalized));
          if (replacement) element.setAttribute(name, replacement);
        }
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'],
  });
})();
