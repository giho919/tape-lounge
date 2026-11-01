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
    '지금 이 페이지를 열어 둔 창의 수 — 같은 사람이 탭을 여러 개 열면 함께 집계됩니다':['Open windows on this page; multiple tabs from one person are counted together.','当前打开此页面的窗口数；同一人的多个标签页会合并统计。','このページを開いているウィンドウ数。同じ人の複数タブはまとめて数えます。'],
    '라운지':['Lounge','大厅','ラウンジ'], '블라인드':['Blind chart','盲图','ブラインドチャート'],
    '국내장':['Korea markets','韩国市场','韓国市場'], '데스크':['Futures desk','合约交易台','先物デスク'],
    '차트 분석':['Chart analysis','图表分析','チャート分析'], '온체인':['On-chain','链上数据','オンチェーン'],
    '발표장':['Calendar','经济日历','経済カレンダー'], '전략가들':['Strategists','策略师','ストラテジスト'],
    '실시간 시세·청산·채팅이 흐르는 메인 화면':['Live prices, liquidations and conversation','实时行情、清算与讨论','価格・清算・会話のライブ画面'],
    '블라인드 — 종목명을 가린 실제 차트 맞히기':['Blind chart practice with the asset hidden','隐藏资产名称的盲图练习','銘柄名を伏せたチャート練習'],
    '국내 시세·김프·관심 코인·Andy 후보':['Korean prices, premium, watchlist and Andy picks','韩国行情、溢价、自选与 Andy 观察','韓国価格・プレミアム・ウォッチリスト・Andy候補'],
    '데스크 — 선물 시장 추세·주요 가격대·펀딩·호가를 한 화면에서':['Futures trend, key levels, funding and order book','合约趋势、关键价位、资金费率与盘口','先物トレンド・重要水準・資金調達率・板情報'],
    '차트 분석 — BTC 장기 빗각과 선형 평행 채널':['BTC long-term channels and chart analysis','BTC 长期通道与图表分析','BTC長期チャネルとチャート分析'],
    '온체인 — 수수료·미결제·고래 이동 등 거래소 밖 지표':['Network fees, open interest and large transfers','网络手续费、持仓量与大额转账','ネットワーク手数料・建玉・大口送金'],
    '발표장 — CPI·고용·FOMC 등 경제지표 발표 일정과 결과':['CPI, jobs and central-bank release calendar','CPI、就业与央行日程','CPI・雇用・中央銀行の発表予定'],
    '전략가들 — 월간 국면 판정·매일 후보 발굴·자동 운용 장부':['Monthly regime notes, daily scans and public ledgers','月度市场判断、每日扫描与公开记录','月次の相場判断・日次スキャン・公開運用記録'],
    '라운지 주요 기록':['Lounge rotation','大厅轮播','ラウンジ表示'], '오늘의 판':['Today’s chart','今日盲图','今日のチャート'],
    '오늘의 판, 200일 버텨볼래?':['Today’s chart: can you last 200 days?','今日盲图：你能坚持 200 天吗？','今日のチャート、200日続けられる？'],
    '오늘의 판 열기 ↗':['Play today’s chart ↗','开始今日盲图 ↗','今日のチャートを始める ↗'],
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
    '오늘 마감':['Closed today','今日收盘','本日終了'], '진행 중':['In progress','进行中','進行中'],
    '변동폭':['Range','波动幅度','値幅'], '한국시간 기준 · 각 세션의 최근 회차':['KST · latest completed or active session','韩国时间 · 各时段最近一轮','KST・各セッションの直近回'],
    '코인 경마장':['Coin race','加密币赛马','コインレース'], '🏁 코인 경마장':['🏁 Coin race','🏁 加密币赛马','🏁 コインレース'],
    '8마리 · 5분 레이스':['8 assets · 5-minute race','8 个币种 · 5 分钟一轮','8銘柄・5分レース'],
    '시세 연결 중':['Connecting to prices','正在连接行情','価格に接続中'], '연결 중':['Connecting','连接中','接続中'],
    '남은 시간':['Time remaining','剩余时间','残り時間'], '캔들 덱':['Candle deck','K线牌组','ローソク足デッキ'],
    '🃏 캔들 덱':['🃏 Candle deck','🃏 K线牌组','🃏 ローソク足デッキ'],
    '마감마다 새 카드 · 장대봉 = 레어':['A new card each close · long candle = rare','每根收盘生成新牌 · 长K线为稀有牌','足の確定ごとに新カード・大陽線はレア'],
    '확대해서 보기':['Expand chart','放大图表','チャートを拡大'], '분석 원본':['Analysis source','分析原文','分析原本'],
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
    '가짜 돈 $10,000':['Virtual funds $10,000','虚拟资金 $10,000','仮想資金 $10,000'], '지갑 잔고':['Wallet balance','钱包余额','口座残高'],
    '포지션':['Position','持仓','ポジション'], '주문하면 시작됩니다':['Place a paper order to begin','下模拟订单后开始','模擬注文で開始'],
    '총자산':['Total equity','总资产','総資産'], '레버리지 · 격리':['Leverage · isolated','杠杆 · 逐仓','レバレッジ・分離'],
    '최대 주문가능':['Maximum order size','最大可下单金额','最大注文可能額'], '주문 비율 · 수수료 0.10%':['Order size · 0.10% fee','下单比例 · 手续费 0.10%','注文比率・手数料 0.10%'],
    '롱 25%':['Long 25%','做多 25%','ロング 25%'], '숏 25%':['Short 25%','做空 25%','ショート 25%'],
    '실제 주문이 아닙니다 · 체결가와 청산은 서버가 바이낸스 시세로 판정합니다':['No real orders · fills and liquidation use Binance prices','不会提交真实订单 · 成交与清算按 Binance 行情判定','実注文はありません・約定と清算はBinance価格で判定'],
    '라운지 채팅':['Lounge chat','大厅聊天','ラウンジチャット'], '🥂 라운지 채팅':['🥂 Lounge chat','🥂 大厅聊天','🥂 ラウンジチャット'],
    '실시간 · 한국시간':['Live · Korea time','实时 · 韩国时间','ライブ・韓国時間'], '닉네임 설정':['Set nickname','设置昵称','ニックネーム設定'],
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
    '아무 곳이나 눌러 시작 →':['Click anywhere to begin →','点击任意位置开始 →','どこかをタップして開始 →'],
    '새 블록이 금고에 착륙했습니다.':['A new block has landed in the vault.','新区块已进入金库。','新しいブロックが保管庫に到着しました。'],
    '지금 이 순간 바이낸스에서 일어나는':['Happening on Binance right now,','此刻在币安发生的','いまBinanceで行われる'],
    '진짜 비트코인 거래':['real Bitcoin trades','真实的比特币成交','実際のビットコイン取引'],
    '가 빗방울로 떨어집니다.':['fall as raindrops.','像雨滴一样落下。','が雨粒となって降り注ぎます。'],
    '방울이 클수록 큰돈이 움직인 것':['Larger drops mean larger trades','水滴越大，成交金额越大','滴が大きいほど取引額も大きく'],
    '초록은 매수':['green means buying','绿色表示买入','緑は買い'], '빨강은 매도':['red means selling','红色表示卖出','赤は売り'],
    '예요.':['.','。','。'], '금테를 두른 방울은':['Gold-rimmed drops mark','带金边的水滴代表','金縁のしずくは'],
    '$50만 이상의 고래':['trades above $500K','超过 50 万美元的大额成交','50万ドル超の大口取引'],
    '퍼지는 파문은 강제 청산.':['; expanding ripples mark liquidations.','；扩散的涟漪代表强制平仓。','、広がる波紋は強制清算です。'],
    '비가 어느 쪽에 많이 내리는지가 곧 지금의 힘싸움입니다.':['The heavier side of the rain shows the current buying-versus-selling flow.','哪一侧的雨点更多，反映当前买卖力量的对比。','雨がどちらに多く降るかで、今の売買の勢いが見えてきます。'],
    '본 사이트는 정보 제공 목적이며 투자 권유가 아닙니다. 모든 투자 판단과 책임은 이용자 본인에게 있습니다. · 데이터: Binance, Bithumb, Frankfurter, mempool.space, BLS, BEA, Federal Reserve, alternative.me, CoinGecko (실시간, 지연 가능) · Tape Lounge Prototype v0.5':['For information only, not investment advice. You are responsible for your investment decisions. · Data: Binance, Bithumb, Frankfurter, mempool.space, BLS, BEA, Federal Reserve, alternative.me and CoinGecko (live; may be delayed) · Tape Lounge Prototype v0.5','本网站仅供信息参考，不构成投资建议。投资决定与责任由用户自行承担。· 数据：Binance、Bithumb、Frankfurter、mempool.space、BLS、BEA、Federal Reserve、alternative.me、CoinGecko（实时，可能延迟）· Tape Lounge Prototype v0.5','本サイトは情報提供を目的とし、投資助言ではありません。投資判断と責任は利用者ご自身にあります。・データ：Binance、Bithumb、Frankfurter、mempool.space、BLS、BEA、Federal Reserve、alternative.me、CoinGecko（リアルタイム、遅延の可能性あり）・Tape Lounge Prototype v0.5'],
  };

  const textMap = new Map(Object.entries(copy).map(([source, translations]) => [source, translations[langIndex] || translations[0]]));
  const liveToolsRoot = document.documentElement.dataset.liveToolsRoot;
  const liveToolPages = new Set(['blind', 'domestic', 'desk', 'analysis', 'onchain', 'calendar', 'strategists']);

  document.addEventListener('click', event => {
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
    const paperSide = value.match(/^(롱|숏)\s+(\d+(?:\.\d+)?)%$/);
    if (paperSide) {
      const side = paperSide[1] === '롱'
        ? ['Long', '做多', 'ロング']
        : ['Short', '做空', 'ショート'];
      return `${side[langIndex]} ${paperSide[2]}%`;
    }
    return null;
  };

  function translateText(node) {
    if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
    const value = node.nodeValue;
    const trimmed = value.trim();
    const replacement = textMap.get(trimmed) || dynamic(trimmed);
    if (replacement) node.nodeValue = value.replace(trimmed, replacement);
  }
  function translateElement(element) {
    for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = element.getAttribute?.(name);
      const replacement = value && (textMap.get(value.trim()) || dynamic(value.trim()));
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
          const replacement = value && (textMap.get(value.trim()) || dynamic(value.trim()));
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
