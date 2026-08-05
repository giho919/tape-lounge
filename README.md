# Tape Lounge

> A lounge for reading the tape — real-time crypto metrics, living order flow, trading mini-games, and three resident strategists.
> 크립토 시장의 "보는 맛"을 모아둔 라운지 — 실시간 지표, 살아 움직이는 체결, 트레이딩 미니게임, 그리고 세 명의 전략가.

**Live** → https://tapelounge.com

A **single-file static site** running entirely on free public APIs in the browser (no backend; only chat & leaderboard use Supabase). The concept: a members' hideaway for people who like to *read the tape*.
브라우저에서 무료 공개 API만으로 돌아가는 **단일 파일 정적 사이트**입니다 (백엔드 없음, 채팅·리더보드만 Supabase). "시세를 읽는" 사람들의 아지트라는 콘셉트.

---

## 🥂 Lounge · 라운지

Read the market's *now* on a single screen.
한 화면에서 시장의 지금을 읽습니다.

### Top metric strip · 상단 지표 스트립

| Metric | English | 한국어 |
|--------|---------|--------|
| **BTC / KRW·USDT** | Live won & dollar prices | 원화·달러 실시간 가격 |
| **Kimchi Premium · 김치 프리미엄** | Analog gauge — Korean-market premium: Bithumb BTC/KRW ÷ (Binance BTCUSDT × Bithumb USDT/KRW) | 아날로그 게이지 — 빗썸 BTC/KRW ÷ (바이낸스 BTCUSDT × 빗썸 USDT/KRW) |
| **Fear & Greed · 공포·탐욕** | From alternative.me (0 = extreme fear ~ 100 = extreme greed) | alternative.me (0=극단 공포 ~ 100=극단 탐욕) |
| **BTC Dominance · 도미넌스** | Bitcoin's share of total market cap | 전체 시총 중 비트코인 점유율 |
| **Funding Rate · 펀딩비** | Perpetual-futures 8h funding — a gauge of futures-market heat | 무기한 선물 8시간 펀딩 — 선물 시장 과열 온도 |

### Spectator casino · 관전 카지노

The market plays the game; visitors watch the tension build and the result settle.
시장이 스스로 판을 벌이고, 방문자는 긴장과 결과 확정의 순간을 관전합니다.

- **Pit Boss · 핏 보스** — automatically promotes the hottest live scene among tape pressure, whale fills, liquidations, breakouts, and the coin race / 체결 압력·고래·청산·돌파·경마 중 가장 뜨거운 판을 자동으로 메인 무대에 올림
- **Liquidation Tower · 청산 타워** — market-wide long and short liquidations stack as blocks over five-minute rounds; a severe imbalance knocks the tower down / 전 시장 롱·숏 청산이 5분간 블록으로 쌓이고 심한 불균형에서 타워 붕괴
- **Liquidation Jackpot · 청산 잭팟** — a rolling 15-minute market-wide liquidation meter fires at $5M and becomes a special attack in the boss battle / 전 시장 15분 청산 누적이 $5M에 닿으면 잭팟이 발동하고 보스전 특수 공격으로 연결
- **Market Boss Battle · 시장 보스전** — BTC attacks the largest visible sell wall for 60 seconds; only a real price cross counts as a defeat, while canceled walls leave the table / BTC가 실시간 최대 매도벽을 60초 동안 공격하며 실제 가격 돌파만 격파로 판정, 취소된 벽은 퇴장 처리
- **Coin Derby · 코인 경마장** — BTC, ETH, SOL, XRP, BNB, DOGE, ADA, and LINK race by live five-minute return / 8개 주요 코인이 실시간 5분 수익률로 경주
- **Market Highlights · 시장 하이라이트** — major candles, breakouts, whales, tower crashes, and race winners are saved locally as replayable tickets / 장대봉·돌파·고래·타워 붕괴·경마 우승을 기기 안에 다시 볼 수 있는 전표로 보관

### Live charts (swipeable) · 라이브 차트 (넘겨보기)

- **Symbols · 종목** — BTC · ETH · BTC.D (dominance / 도미넌스) · NASDAQ (QQQB, a Nasdaq-100 ETF token / 나스닥100 ETF 토큰)
- **Timeframes · 타임프레임** — 1m · 15m · 60m · 240m · daily · weekly · monthly / 1분·15분·60분·240분·일봉·주봉·월봉
- **Moving averages · 이동평균선** — MA 10 · 20 · 60 · 120 · 200 (live on every chart / 전 차트 실시간)
- **Candle Grade · 캔들 등급** — every closed BTC candle is graded in the HUD; only rare and epic candles receive chart markers / 모든 BTC 확정봉 등급은 HUD에 표시하고 레어·에픽만 차트 마커로 남김
- **Candle Combo · 캔들 콤보** — the HUD always shows the streak, while only 5·8 combos and major breaks receive chart markers / 연속 수는 HUD에 항상 표시하되 5·8콤보와 큰 브레이크만 차트 마커로 남김
- **Price Chests · 가격 보물상자** — rolling 40-candle high/low chests open as bronze, gold, or diamond based on breakout volume / 최근 40개 확정봉 고저점 상자가 돌파 거래량에 따라 브론즈·골드·다이아로 개봉
- **Whale Footprints · 고래 발자국** — $500k+ BTC fills leave minute-aggregated buy/sell markers / $50만 이상 BTC 체결을 분 단위 매수·매도 발자국으로 기록
- Countdown to candle close, split-flap price display / 봉 마감 카운트다운, split-flap 가격

### Candle Deck 🃏 · 캔들 덱

Each closed candle is dealt as a card; body size sets its rarity (common → uncommon → rare → **epic / big candle**). The deck follows your selected chart & timeframe, with a `?` card holding the next slot.
마감된 캔들이 한 장씩 카드로 딜립니다. 몸통 크기에 따라 등급이 갈립니다 (일반 → 언커먼 → 레어 → **에픽/장대봉**). 선택한 차트·타임프레임을 따라가며, 맨 오른쪽 `?` 카드가 다음 봉 자리를 지킵니다.

### Rain of Fills 🌧 · 체결의 비

Every **real trade** happening on Binance right now falls as a raindrop.
지금 이 순간 바이낸스에서 일어나는 **실제 체결**이 빗방울로 떨어집니다.

- Left = sell, right = buy / 왼쪽 = 매도, 오른쪽 = 매수
- Drop size = trade value / 방울 크기 = 체결 금액
- Gold ring = $500k+ whale / 금테 = $50만+ 고래
- Spreading ripples = futures liquidations / 퍼지는 파문 = 선물 강제 청산
- Bottom bar = buy/sell pressure / 하단 수급 바 = 매수·매도 압력
- Adaptive FX quality batches dense fills and scales particles only under load / 체결 폭주 시 연출을 합산하고 파티클 품질만 자동 조절

### Order Book 📊 · 호가창

Live bid/sell walls beside the rain; a market-order fill **shatters** the wall level it hits (shards fly, bigger trades break more rows).
체결의 비 옆에 실시간 매수·매도벽. 시장가 체결이 닿는 가격대의 벽을 **부숩니다** (파편이 튀고, 큰 체결일수록 여러 줄이 깨짐).

### Full-screen reactions · 전면 연출

Big bullish/bearish candle bursts · 60-minute breakout / breakdown · neon flicker · spotlight — the whole screen responds when the market moves hard.
장대양봉 분출 · 장대음봉 낙하 · 60분 고점 돌파 / 저점 붕괴 · 네온 점멸 · 스포트라이트 — 시장이 크게 움직이는 순간을 화면 전체로 반응합니다.

### Interactive · 참여 요소

- **Lounge Chat · 라운지 채팅** — Live visitor chat (nickname-based); the strategists' letters flow in alongside / 방문자 실시간 채팅(닉네임 기반) + 전략가 서신·소식이 함께 흐름
- **Next-Candle Prediction · 다음 캔들 예측** — Call the next BTC 1-minute candle (UP/DOWN) in advance; locked when the candle opens, judged at close. The target candle is marked right on the live chart — a colored `?` ghost at the next slot, 🔒 on the candle being judged / BTC 1분봉의 다음 방향을 미리 걸고 연승 도전 (봉 열릴 때 잠금 → 마감 판정). 예측 대상 봉이 라이브 차트에 표시됨 — 다음 자리에 색깔 `?` 유령캔들, 판정 중인 봉엔 🔒
- **Leaderboard · 리더보드** — Self-standing ranking by best streak & record / 예측 최고 연승·전적 기반 자율 순위

---

## ⚔️ Futures Colosseum · 선물 콜로세움

BTC futures data becomes a five-minute bout with a bell, a winner, reversals, and a persistent match ledger.
BTC 선물 데이터를 5분짜리 경기로 구성해 종이 울리고 승자·역전·연승·경기 장부가 남습니다.

- **Bull vs Bear bout · 황소 vs 곰 경기** — power combines taker flow, price, retail/top-trader positioning, and live liquidations / 테이커·가격·개미/고래 포지션·실시간 청산을 전투력으로 합산
- **Final Bell · 파이널 벨** — the last 30 seconds enter a closing phase; every round settles with a winner and streak / 마지막 30초 정산 모드, 승자와 연승 기록
- **Trap cards · 함정 카드** — short/long squeeze, long/short trap, crowded positioning, and dead-table states from price, open interest, positioning, and liquidations / 가격·미결제약정·포지션·청산 조합으로 스퀴즈·함정·과밀·죽은 판 판정
- **Spectator vs VIP seats · 관중석 vs VIP석** — global accounts and top traders compared side by side / 글로벌 계정과 상위 트레이더 방향 비교
- **Reversal & match ledger · 역전과 경기 장부** — lead changes trigger a live event; the last five round results stay on the device / 주도권 역전 이벤트와 최근 5경기 기기 보관

---

## ⛓ Block Vault · 블록 금고

Bitcoin settlement becomes a quiet underground casino floor built from public mempool.space data.
비트코인 정산 과정을 공개 mempool.space 데이터로 구성한 조용한 지하 카지노 구역입니다.

- **Next-block roulette · 다음 블록 룰렛** — fee tiers compete for seats until the next block lands / 수수료 구간별 승선 경쟁과 다음 블록 예상 시간
- **Mempool elevator · 멤풀 엘리베이터** — waiting, lobby, VIP, and penthouse floors show how close transactions are to settlement / 대기·로비·VIP·펜트하우스 층으로 정산 우선순위 표현
- **Whale vault · 고래 금고** — recent large mempool transfers shown without owner or exchange attribution / 소유자·거래소 추정 없이 최근 대형 전송 전시
- **Block landing ceremony · 블록 착륙식** — a new block stops the wheel and opens a settlement ticket / 새 블록이 룰렛을 멈추고 정산 전표 공개
- **Chain signal board · 체인 전광판** — fee surge, block drought, mempool flood, whale parade, and clear-floor events / 수수료 급등·블록 지연·멤풀 범람·고래 행렬·바닥 정리 감지

---

## 📣 Economic Wire · 거시 발표장

Major U.S. releases become a watchable sequence: countdown, official settlement, then BTC aftershock.
미국 주요 지표를 카운트다운 → 공식 숫자 확정 → BTC 여진으로 이어지는 관전형 발표 테이블로 구성합니다.

- **Official countdown · 공식 카운트다운** — BLS, BEA, and Federal Reserve schedules rendered in KST / BLS·BEA·Fed 일정을 한국시간으로 표시
- **Previous → actual · 이전 → 실제** — BLS actuals are confirmed only after the official series updates; no paid consensus data / BLS 공식 시계열 갱신 후에만 실제치 확정, 유료 컨센서스 미사용
- **BTC aftershock · BTC 여진계** — 5, 15, and 60-minute BTC returns from the scheduled release minute / 발표 예정 시각 기준 BTC 5·15·60분 반응
- **Pit Boss integration · 핏 보스 연동** — 30-minute and 5-minute warnings, settlement ticket, and market highlight / 30분·5분 전 예고와 발표 확정 전표·하이라이트
- **Static data pipeline · 정적 데이터 파이프라인** — `econ_calendar_report.py` builds `reports/econ_calendar.json`; server cron may publish it without exposing any secret key / 스크립트가 정적 JSON을 만들며 시크릿 키 없이 자동 발행 가능

Official free sources do not provide a market-consensus estimate, so the Lounge intentionally shows previous versus actual instead of scraping a commercial calendar.
공식 무료 소스에는 시장 컨센서스가 없으므로 상업 캘린더를 긁지 않고 이전치와 실제치만 보여줍니다.

---

## 🎰 Blind Chart · 블라인드 차트

You're dropped into a **real past market** with its identity hidden — no symbol, no dates (start price indexed to 100, time axis removed). Pick a track — **🪙 crypto or 📈 US stocks** — then trade a $10,000 stake as the chart **advances by itself over time** (⏸ pause / ▶ play / speed 1×·2×·4×). After 200 days the identity is revealed and you're judged against **buy & hold over the same window**. Moving averages and volume included.
정체를 숨긴 **과거의 실제 시장**에 던져집니다. 종목도 날짜도 비밀 (시작가 100 기준 지수화, 시간축 숨김). **🪙 코인 / 📈 미국주식** 트랙을 고른 뒤, 밑천 $10,000으로 매매하는데 캔들이 **시간에 따라 저절로 진행**됩니다 (⏸ 일시정지 / ▶ 재생 / 속도 1×·2×·4×). 200일 뒤 정체가 공개되며 **같은 기간 존버 대비 성적**으로 판정받습니다. 이동평균선·거래량도 함께 표시됩니다.

- **Group Study · 그룹 스터디** — create or join with a six-character code, change your room nickname, ready up, and share a server-synchronized clock; only the host can pause, change speed, or settle / 6자리 코드로 방 생성·참가 후 방 안에서 닉네임을 바꾸고 READY, 서버 동기화 시계를 공유하며 일시정지·속도·정산은 방장만 제어
- **Persistent portfolio · 장부 복원** — each player's cash, holdings, and trades are saved after every order and restored after refresh / 주문마다 개인 현금·보유량·거래 장부를 저장해 새로고침 뒤에도 그대로 복원
- **Segment outlook · 구간 전망** — every 20-day segment accepts one bullish, neutral, or bearish outlook; classmates' choices are grouped into chart markers after the reveal / 20일 구간마다 강세·중립·약세 전망을 한 번 선택하며 공개 뒤 다른 사람의 선택을 차트 마커로 묶어 표시
- **Shared settlement · 공동 정산** — returns, buy-and-hold comparison, trade count, and the opinion chart are revealed together / 수익률·존버 비교·매매 횟수와 의견 차트를 함께 공개
- **Mobile layout · 모바일 화면** — the blind chart, controls, lobby, and shared panels collapse into a single-column touch layout on small screens / 작은 화면에서는 블라인드 차트·주문·로비·공용 패널을 한 열 터치 레이아웃으로 재배치

> Crypto data streams live from Binance; US-stock history (100+ S&P 500 / Nasdaq-100 large caps) is served as a static bundle the server refreshes weekly.
> 코인은 바이낸스 실시간, 미국주식(S&P500·나스닥100 대형주 100+종목)은 서버가 주 1회 갱신하는 정적 번들로 제공됩니다.

---

## 🎩 The Strategists · 전략가들

Three resident characters, each with an avatar, a style radar, an activity journal, and a daily-refreshed report.
라운지에 상주하는 세 캐릭터. 각자 아바타·성향 레이더·활동 일지를 갖고, 매일 갱신되는 리포트를 발행합니다.

| Strategist · 전략가 | Beat · 무대 | Publishes · 발행물 |
|---------------------|-------------|--------------------|
| **Madam Jeong · 鄭마담** | Yeouido · 여의도 | Morning system-status letter + today's ledger / 매일 아침 현황 서신 + 오늘의 장부 (포지션 방향·시장 국면·지표 차트) |
| **Andy** | Chicago | Evening altcoin-scan wire / 매일 저녁 알트코인 스캔 전보 (돌파·추세·바닥반전 3종) |
| **Prof. Justin** | The Lab · 연구실 | Monthly regime-model opinion + verdict-history dashboard / 매월 시장 국면 판정 소견 + 판정의 역사 대시보드 |

Reports are auto-generated daily and pushed to this repo's `reports/`.
리포트는 서버가 매일 자동 생성해 이 저장소의 `reports/`로 push합니다.

> ⚠️ Public reports **never include sensitive figures** — no account balance, P&L amounts, or entry prices. Only informational content (market indicators, position direction, regime verdicts).
> ⚠️ 공개 리포트에는 **계좌 잔고·수익 금액·진입가 등 민감 정보를 일절 담지 않습니다.** 시장 지표·포지션 방향·국면 판정 등 정보 제공 목적의 내용만 게재합니다.

---

## Data sources · 데이터 출처

All public & free APIs, called directly from the browser.
전부 공개·무료 API, 브라우저에서 직접 호출.

- **Binance** — spot/futures WebSocket (trades, candles, liquidations, dominance index, long/short ratios) + REST history / 현물·선물 WebSocket (체결·캔들·강제청산·도미넌스 지수·롱숏 비율) + REST 과거 캔들
- **Bithumb** — REST, BTC/KRW and USDT/KRW prices for the kimchi-premium calc / 김치 프리미엄 산출용 BTC·USDT 원화 시세
- **alternative.me** — Fear & Greed / 공포·탐욕 지수
- **CoinGecko** — global dominance / 글로벌 도미넌스
- **mempool.space** — Bitcoin mempool, recommended fees, projected blocks, recent transfers, and block settlement / 비트코인 멤풀·권장 수수료·예상 블록·최근 전송·블록 정산
- **BLS · BEA · Federal Reserve** — official U.S. release schedules and available BLS actuals / 미국 공식 발표 일정과 BLS 실제치
- **US stocks** — historical daily bars fetched server-side (Yahoo Finance) and served as a static bundle in `reports/stocks.json` / 미국주식 일봉은 서버가 받아(Yahoo Finance) `reports/stocks.json` 정적 번들로 제공

## Tech · 기술

- Single HTML file (`index.html`); only external deps are lightweight-charts & Supabase JS via CDN / 단일 HTML 파일, 외부 의존성은 lightweight-charts·Supabase JS(CDN)뿐
- **Supabase** — live chat, leaderboard, and synchronized blind-study rooms over anonymous auth; room membership and row ownership are enforced with RLS / 익명 인증 기반 채팅·리더보드·블라인드 스터디방, RLS로 방 멤버십과 본인 기록 권한 적용
- **Hosting · 호스팅** — GitHub Pages

## Disclaimer · 면책

This site is for informational purposes only and is not investment advice. All decisions and their consequences are the user's own.
본 사이트는 정보 제공 목적이며 투자 권유가 아닙니다. 모든 투자 판단과 책임은 이용자 본인에게 있습니다.
