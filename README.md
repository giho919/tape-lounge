# Tape Lounge

> A lounge for reading the tape — real-time crypto metrics, living order flow, trading mini-games, and three resident strategists.
> 크립토 시장의 "보는 맛"을 모아둔 라운지 — 실시간 지표, 살아 움직이는 체결, 트레이딩 미니게임, 그리고 세 명의 전략가.

**Live** → https://tapelounge.com *(coming soon)* · https://giho919.github.io/tape-lounge/

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
| **Kimchi Premium · 김치 프리미엄** | Analog gauge — Korean-market premium: Upbit KRW-BTC ÷ (Binance BTCUSDT × KRW-USDT) | 아날로그 게이지 — 업비트 KRW-BTC ÷ (바이낸스 BTCUSDT × KRW-USDT) |
| **Fear & Greed · 공포·탐욕** | From alternative.me (0 = extreme fear ~ 100 = extreme greed) | alternative.me (0=극단 공포 ~ 100=극단 탐욕) |
| **BTC Dominance · 도미넌스** | Bitcoin's share of total market cap | 전체 시총 중 비트코인 점유율 |
| **Funding Rate · 펀딩비** | Perpetual-futures 8h funding — a gauge of futures-market heat | 무기한 선물 8시간 펀딩 — 선물 시장 과열 온도 |

### Live charts (swipeable) · 라이브 차트 (넘겨보기)

- **Symbols · 종목** — BTC · ETH · BTC.D (dominance / 도미넌스) · NASDAQ (QQQB, a Nasdaq-100 ETF token / 나스닥100 ETF 토큰)
- **Timeframes · 타임프레임** — 1m · 15m · 60m · 240m · daily · weekly · monthly / 1분·15분·60분·240분·일봉·주봉·월봉
- **Moving averages · 이동평균선** — MA 10 · 20 · 60 · 120 · 200 (live on every chart / 전 차트 실시간)
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

## ⚔️ Arena · 투기장

Long/short positioning of Binance-futures participants, visualized as a game — not a plain ratio.
바이낸스 선물 참여자들의 롱/숏 방향을 단순 비율이 아니라 게임처럼 시각화.

- **Bull vs Bear tug-of-war · 황소 vs 곰 줄다리기** — the rope knot is pulled toward whichever side is winning / 밧줄 매듭이 이기는 쪽으로 끌려감
- **Ants vs Whales · 개미 vs 고래** — retail (global accounts) vs top-trader positions side by side; when they diverge, a contrarian verdict pops / 개미(글로벌 계정) vs 고래(상위 트레이더) 나란히 — 방향 갈리면 역발상 판정
- **Taker pulse · 테이커 맥박** — which side is hitting the market right now, as a heartbeat / 지금 시장가로 때리는 방향을 심장 박동으로
- Recent long-share sparkline / 최근 롱 비중 스파크라인

---

## 🎰 Blind Chart · 블라인드 차트

You're dropped into a **real past market** with its identity hidden — no symbol, no dates (start price indexed to 100, time axis removed). Pick a track — **🪙 crypto or 📈 US stocks** — then trade a $10,000 stake as the chart **advances by itself over time** (⏸ pause / ▶ play / speed 1×·2×·4×). After 200 days the identity is revealed and you're judged against **buy & hold over the same window**. Moving averages and volume included.
정체를 숨긴 **과거의 실제 시장**에 던져집니다. 종목도 날짜도 비밀 (시작가 100 기준 지수화, 시간축 숨김). **🪙 코인 / 📈 미국주식** 트랙을 고른 뒤, 밑천 $10,000으로 매매하는데 캔들이 **시간에 따라 저절로 진행**됩니다 (⏸ 일시정지 / ▶ 재생 / 속도 1×·2×·4×). 200일 뒤 정체가 공개되며 **같은 기간 존버 대비 성적**으로 판정받습니다. 이동평균선·거래량도 함께 표시됩니다.

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
- **Upbit** — REST, KRW prices for the kimchi-premium calc / 김치 프리미엄 산출용 KRW 시세
- **alternative.me** — Fear & Greed / 공포·탐욕 지수
- **CoinGecko** — global dominance / 글로벌 도미넌스
- **US stocks** — historical daily bars fetched server-side (Yahoo Finance) and served as a static bundle in `reports/stocks.json` / 미국주식 일봉은 서버가 받아(Yahoo Finance) `reports/stocks.json` 정적 번들로 제공

## Tech · 기술

- Single HTML file (`index.html`); only external deps are lightweight-charts & Supabase JS via CDN / 단일 HTML 파일, 외부 의존성은 lightweight-charts·Supabase JS(CDN)뿐
- **Supabase** — live chat & leaderboard over anonymous auth; Row Level Security so anyone can read but only edit their own row / 익명 인증 기반 라이브 채팅·리더보드, RLS로 읽기는 전체·수정은 본인 행만
- **Hosting · 호스팅** — GitHub Pages

## Disclaimer · 면책

This site is for informational purposes only and is not investment advice. All decisions and their consequences are the user's own.
본 사이트는 정보 제공 목적이며 투자 권유가 아닙니다. 모든 투자 판단과 책임은 이용자 본인에게 있습니다.
