/* Public quotation-only domestic desk. No orders, credentials or server writes. */
(function(root){
'use strict';
const MAX_AGE=120000;
const num=x=>x!==null&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const positive=x=>num(x)!==null&&num(x)>0;
const fresh=(at,now=Date.now())=>positive(at)&&now-at>=-30000&&now-at<=MAX_AGE;
const safeSymbol=s=>typeof s==='string'&&/^[A-Z0-9]{1,24}$/.test(s);
const premium=(local,foreign,rate)=>[local,foreign,rate].every(positive)?(local/(foreign*rate)-1)*100:null;
/* 빗썸 REST는 trade_timestamp를 KST 벽시계로 만들어 9시간 미래로 보낸다. 같은 응답의
   trade_date/trade_time(UTC)이 정답이며, 이 UTC 쌍은 _kst 쌍이 함께 오는 REST 스키마에만 있다.
   빗썸 WebSocket은 반대로 trade_timestamp가 정확하고 trade_date/trade_time이 KST라 손대지 않는다. */
function stamped(x){
 const reported=num(x?.trade_timestamp),d=x?.trade_date,t=x?.trade_time;
 if(reported===null||!x?.trade_date_kst||!/^\d{8}$/.test(d||'')||!/^\d{6}$/.test(t||''))return x;
 const utc=Date.parse(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}T${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4)}Z`);
 return Number.isFinite(utc)&&Math.abs(utc-reported)>5000?{...x,trade_timestamp:utc}:x;
}
function rowsFor(tickers,global,now=Date.now()){
 const tether=tickers.find(x=>x.market==='KRW-USDT');
 const rate=fresh(tether?.trade_timestamp,now)?num(tether?.trade_price):null;
 return tickers.filter(t=>t.market?.startsWith('KRW-')&&safeSymbol(t.market.slice(4))).map(t=>{
  const symbol=t.market.slice(4),g=global[symbol],at=num(t.trade_timestamp);
  const current=fresh(at,now),remote=!!g&&fresh(g.closeTime,now);
  const price=num(t.trade_price),foreign=g?num(g.lastPrice):null,high=num(t.high_price);
  const p=current&&remote?premium(price,foreign,rate):null,valid=p!==null&&Math.abs(p)<=50;
  const converted=remote&&positive(foreign)&&positive(rate)?foreign*rate:null,open=remote?num(g.openPrice):null;
  const fv=remote?num(g.quoteVolume):null;
  return {symbol,price,volume:num(t.acc_trade_price_24h),change:num(t.signed_change_rate)===null?null:num(t.signed_change_rate)*100,changeKrw:num(t.signed_change_price),at,current,
   high,low:num(t.low_price),fromHigh:positive(high)&&positive(price)?(price/high-1)*100:null,
   foreign,foreignKrw:converted,foreignChange:positive(open)&&positive(foreign)?(foreign/open-1)*100:null,foreignVolume:fv,foreignVolumeKrw:fv!==null&&positive(rate)?fv*rate:null,
   premium:valid?p:null,gap:valid&&converted!==null?price-converted:null,
   reason:!current?'체결 지연':!g?'해외 비교 없음':!remote?'해외 시세 지연':!rate?'국내 USDT 시세 없음':p!==null&&Math.abs(p)>50?'가격차 재확인':'',market:t.market};
 });
}
/* 해외 현물 USDT 마켓. 모두 브라우저에서 직접 부를 수 있는 공개 시세이며(CORS 확인), 한 번에 전 종목을 준다.
   closeTime 은 거래소가 주는 시각이고, 주지 않는 게이트만 응답을 받은 시각을 쓴다. */
const FOREIGN={
 binance:{label:'바이낸스',url:'https://data-api.binance.vision/api/v3/ticker/24hr?type=MINI',stream:true,
  parse:d=>Array.isArray(d)?d.map(x=>x.symbol?.endsWith('USDT')?{symbol:x.symbol.slice(0,-4),lastPrice:x.lastPrice,openPrice:x.openPrice,quoteVolume:x.quoteVolume,closeTime:num(x.closeTime)}:null):null},
 bybit:{label:'바이비트',url:'https://api.bybit.com/v5/market/tickers?category=spot',
  parse:d=>{const at=num(d?.time),l=d?.result?.list;return Array.isArray(l)?l.map(x=>x.symbol?.endsWith('USDT')?{symbol:x.symbol.slice(0,-4),lastPrice:x.lastPrice,openPrice:x.prevPrice24h,quoteVolume:x.turnover24h,closeTime:at}:null):null;}},
 okx:{label:'OKX',url:'https://www.okx.com/api/v5/market/tickers?instType=SPOT',
  parse:d=>Array.isArray(d?.data)?d.data.map(x=>x.instId?.endsWith('-USDT')?{symbol:x.instId.slice(0,-5),lastPrice:x.last,openPrice:x.open24h,quoteVolume:x.volCcy24h,closeTime:num(x.ts)}:null):null},
 gate:{label:'게이트',url:'https://api.gateio.ws/api/v4/spot/tickers',
  parse:(d,at)=>Array.isArray(d)?d.map(x=>{if(!x.currency_pair?.endsWith('_USDT'))return null;const last=num(x.last),c=num(x.change_percentage);
   return {symbol:x.currency_pair.slice(0,-5),lastPrice:last,openPrice:last!==null&&c!==null&&c>-100?last/(1+c/100):null,quoteVolume:x.quote_volume,closeTime:at};}):null},
 bitget:{label:'비트겟',url:'https://api.bitget.com/api/v2/spot/market/tickers',
  parse:d=>Array.isArray(d?.data)?d.data.map(x=>x.symbol?.endsWith('USDT')?{symbol:x.symbol.slice(0,-4),lastPrice:x.lastPr,openPrice:x.open,quoteVolume:x.quoteVolume,closeTime:num(x.ts)}:null):null}
};
function foreignRows(key,payload,at){const rows=FOREIGN[key]?.parse(payload,at);if(!Array.isArray(rows))return null;
 const out={};for(const r of rows){if(!r||!safeSymbol(r.symbol)||!positive(r.lastPrice))continue;const old=out[r.symbol];
  if(!old||num(r.quoteVolume)>num(old.quoteVolume))out[r.symbol]=r;}
 return Object.keys(out).length?out:null;}
const api={premium,fresh,rowsFor,stamped,FOREIGN,foreignRows};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document)return;
const el=document.getElementById('tab-domestic');if(!el)return;
const lang=document.documentElement?.lang||'ko',langIndex={ko:0,en:1,zh:2,ja:3}[lang]??0;
const COPY={
 title:['김치 프리미엄','Korean Crypto Premium','韩国加密货币溢价','韓国の暗号資産プレミアム'],watch:['후보 관찰 · 리서치 ↗','Watchlist · research ↗','观察名单 · 研究 ↗','候補ウォッチ · リサーチ ↗'],
 intro:['업비트·빗썸의 원화 시세와 해외 USDT 시세를 비교합니다. 김치 프리미엄은 선택한 국내 거래소의 USDT/KRW 최근 체결가로 환산합니다.','Compare Korean won prices with overseas USDT spot prices. The premium uses the latest USDT/KRW trade on the selected Korean exchange.','比较韩国韩元价格与海外 USDT 现货价格。溢价按所选韩国交易所最新的 USDT/KRW 成交价换算。','韓国ウォン建て価格と海外USDT現物価格を比較します。プレミアムは選択した韓国取引所のUSDT/KRW最新約定価格で換算します。'],
 guide:['계산 방식 ↗','How it is calculated ↗','计算方式 ↗','計算方法 ↗'],base:['기준 거래소','Korean exchange','韩国交易所','韓国取引所'],compare:['비교 거래소','Compare exchange','比较交易所','比較取引所'],
 upbit:['업비트','Upbit','Upbit','Upbit'],bithumb:['빗썸','Bithumb','Bithumb','Bithumb'],binance:['바이낸스','Binance','Binance','Binance'],bybit:['바이비트','Bybit','Bybit','Bybit'],okx:['OKX','OKX','OKX','OKX'],gate:['게이트','Gate.io','Gate.io','Gate.io'],bitget:['비트겟','Bitget','Bitget','Bitget'],
 watchOnly:['관심 코인만 보기','Watchlist only','仅看自选','ウォッチリストのみ'],andyOnly:['Andy 후보만 보기','Andy picks only','仅看 Andy 观察标的','Andy候補のみ'],search:['BTC, 비트코인…','BTC, Bitcoin…','BTC、比特币…','BTC、ビットコイン…'],searchLabel:['종목 찾기','Search assets','搜索币种','銘柄を検索'],
 notes:['계산 기준과 데이터 주의사항','Method and data notes','计算方法与数据说明','計算方法とデータについて'],readTable:['표 읽는 법: 큰 숫자는 국내 기준 거래소 가격, 작은 숫자는 대응하는 해외 값입니다. 현재가 아래는 해외 환산가, 김프 아래는 국내 가격과 환산가의 차이, 전일대비 아래는 변동 금액, 거래액 아래는 해외 24시간 거래대금을 원화로 환산한 값입니다. 비교할 수 없는 종목은 김프를 비우고 이유를 표시합니다. 표 머리글로 정렬하고 종목 이름을 눌러 상세 정보를 확인하세요.','Reading the table: the larger value is the Korean exchange price; the smaller value is the matching overseas figure. Below the price is the converted overseas price, below the premium is the KRW gap, below the daily change is the KRW move, and below volume is overseas 24-hour turnover converted to KRW. Unmatched or stale prices show a reason instead of a premium. Select a column to sort or an asset name for details.','表格说明：较大的数字是韩国交易所价格，较小的数字是对应的海外数据。现价下方为换算后的海外价格，溢价下方为韩元价差，涨跌下方为韩元变动额，成交额下方为换算为韩元的海外24小时成交额。无法比较或行情过期时会显示原因而不显示溢价。点击表头排序，点击币种查看详情。','表の見方：大きい数字は韓国取引所の価格、小さい数字は対応する海外価格です。現在値の下は換算後の海外価格、プレミアムの下はウォン差、前日比の下はウォンでの変動額、出来高の下はウォン換算した海外24時間出来高です。比較できない、または価格が古い場合は理由を表示し、プレミアムは空欄になります。見出しで並べ替え、銘柄名で詳細を開けます。'],
 formula:['김프 = (국내 원화 가격 ÷ (해외 USDT 가격 × 기준 거래소의 USDT/KRW 가격) − 1) × 100. 원달러 환율 대신 국내에서 실제로 거래되는 USDT 가격으로 환산하므로 테더의 달러 가격차는 김프에 섞이지 않습니다. 양쪽 모두 최근 체결가입니다.','Premium = (Korean KRW price ÷ (overseas USDT price × Korean exchange USDT/KRW price) − 1) × 100. This uses the locally traded USDT price, not the USD/KRW FX rate, so the USDT-to-dollar deviation is not included. Both sides use recent trades.','溢价 =（韩国韩元价格 ÷（海外 USDT 价格 × 韩国交易所 USDT/KRW 价格）− 1）× 100。这里使用韩国市场实际成交的 USDT 价格，而非美元兑韩元汇率，因此不会把 USDT 对美元的偏差混入溢价。两边均为最新成交价。','プレミアム =（韓国ウォン価格 ÷（海外USDT価格 × 韓国取引所のUSDT/KRW価格）− 1）× 100。ドル/ウォン為替ではなく、韓国市場で実際に取引されるUSDT価格を使うため、USDT自体のドル乖離は含みません。両市場とも直近約定価格です。'],
 dataNotes:['해외 거래소는 USDT 현물이며 같은 티커끼리 비교합니다. 바이낸스만 실시간 수신하고 나머지는 30초마다 조회합니다. 가격이 2분보다 오래되면 김프 계산에서 제외합니다.','Overseas venues use USDT spot markets and matching tickers. Binance streams live; other exchanges are polled every 30 seconds. Prices older than two minutes are excluded from premium calculations.','海外市场均为 USDT 现货，只按相同代码匹配。Binance 使用实时推送，其他交易所每30秒查询一次。超过两分钟的价格不参与溢价计算。','海外取引所はUSDT現物で、同じティッカー同士を比較します。Binanceはリアルタイム、その他は30秒ごとに取得します。2分より古い価格はプレミアム計算から除外します。'],
 caution:['티커 일치만으로 토큰·네트워크 동일성이나 입출금 가능 여부를 보증하지 않습니다. 수수료·슬리피지·송금 지연을 반영한 차익거래 수익이 아닙니다.','Matching tickers does not verify token or network identity or deposit and withdrawal availability. The displayed gap is not an arbitrage return; fees, slippage and transfer delays are excluded.','代码相同不代表代币或网络相同，也不代表可以充提。显示价差不是套利收益，未计手续费、滑点和转账延迟。','同じティッカーでもトークンやネットワークの同一性、入出金可否は未確認です。表示値は手数料・スリッページ・送金遅延を含む裁定利益ではありません。'],
 sources:['출처: Upbit·Bithumb 공개 시세, Binance·Bybit·OKX·Gate·Bitget 현물, Tape Lounge Andy 리포트. 관심 코인은 이 브라우저에만 저장됩니다.','Sources: public Upbit and Bithumb prices; Binance, Bybit, OKX, Gate.io and Bitget spot markets; Tape Lounge Andy report. Watchlist choices stay in this browser.','来源：Upbit、Bithumb公开行情，Binance、Bybit、OKX、Gate.io、Bitget现货，以及 Tape Lounge Andy 报告。自选列表仅保存在此浏览器。','出典：Upbit・Bithumbの公開価格、Binance・Bybit・OKX・Gate.io・Bitget現物、Tape Lounge Andyレポート。ウォッチリストはこのブラウザー内に保存されます。'],
 name:['이름','Asset','币种','銘柄'],price:['현재가','Price','现价','現在値'],premium:['김프','Premium','溢价','プレミアム'],change:['전일대비','24h change','24小时涨跌','前日比'],volume:['거래액(일)','24h volume','24小时成交额','24時間出来高'],venuePrice:['{0} 현재가','{0} price','{0}现价','{0}価格'],converted:['{0} 환산가','{0} converted','{0}换算价','{0}換算価格'],tetherBasis:['환산 기준 {0} USDT/KRW {1} · 해외 {2} 현물 {3} USDT','Conversion: {0} USDT/KRW {1} · overseas {2} spot {3} USDT','换算基准：{0} USDT/KRW {1} · 海外 {2} 现货 {3} USDT','換算基準：{0} USDT/KRW {1}・海外 {2}現物 {3} USDT'],premiumHidden:['현재 {0} 상태라 김프를 숨겼습니다.','{0}; premium hidden.','当前{0}，暂不显示溢价。','現在{0}のためプレミアムを非表示にしています。'],andyStage:['Andy 관찰 기록: {0} ({1})','Andy watch: {0} ({1})','Andy观察记录：{0}（{1}）','Andyの観察記録：{0}（{1}）'],
 volumeUnit:['거래액(일)','24h volume','24小时成交额','24時間出来高'],sortTitle:['{0} 기준 정렬','Sort by {0}','按{0}排序','{0}で並べ替え'],favoriteAria:['{0} 관심 코인','Add {0} to watchlist','将 {0} 加入自选','{0}をウォッチリストに追加'],marketsCount:['{0}종','{0} pairs','{0} 个交易对','{0}銘柄'],
 count:['암호화폐 총 {0}개','{0} crypto assets','共 {0} 种加密货币','全{0}銘柄'],numbers:['숫자','Numbers','数据','数値'],reference:['참고','Reference','参考','参考'],prev:['전일 대비','24h change','24小时涨跌','前日比'],hiLow:['24시간 고 / 저','24h high / low','24小时高 / 低','24時間高値 / 安値'],fromHigh:['고가 대비','From 24h high','较24小时高点','24時間高値から'],foreignChange:['해외 등락','Overseas change','海外涨跌','海外変動'],dailyVolume:['거래액 · 국내 / 해외','24h volume · KR / overseas','24小时成交额 · 韩国 / 海外','24時間出来高・韓国 / 海外'],
 latest:['최근 체결','Latest trade','最新成交','最新約定'],stale:['체결 지연·미확인','Stale / unconfirmed','成交延迟 / 未确认','約定遅延・未確認'],statusLive:['실시간 수신','Live','实时','ライブ'],statusWait:['연결 대기·30초 조회','Waiting · 30s polling','等待连接 · 每30秒查询','接続待ち・30秒ごとに取得'],statusPoll:['30초 조회','30s polling','每30秒查询','30秒ごとに取得'],screen:['화면 1초 반영','Screen refresh: 1s','画面每秒更新','画面は1秒ごとに更新'],
 delayed:['체결 지연','Trade delayed','成交延迟','約定遅延'],noMatch:['해외 비교 없음','No overseas match','无海外匹配','海外比較なし'],foreignDelayed:['해외 시세 지연','Overseas price delayed','海外行情延迟','海外価格遅延'],noUsdt:['국내 USDT 시세 없음','Korean USDT price unavailable','韩国USDT价格不可用','韓国USDT価格なし'],recheck:['가격차 재확인','Premium needs review','价差需复核','価格差を再確認'],foreignWait:['해외 시세 대기','Waiting for overseas price','等待海外行情','海外価格待ち'],
 close:['닫기 ✕','Close ✕','关闭 ✕','閉じる ✕'],chartHeader:['{0} 원화 차트','{0} KRW chart','{0} KRW 图表','{0} KRWチャート'],chartTitle:['차트','Chart','图表','チャート'],chartNote:['차트는 TradingView가 표시하며 이 페이지 시세와 별도로 제공됩니다. TradingView에 없는 종목은 차트가 비어 있을 수 있습니다.','TradingView provides this chart independently of prices on this page. Assets unavailable on TradingView may show a blank chart.','图表由 TradingView 独立提供，与本页行情分开。TradingView 未收录的币种可能显示空白。','チャートはTradingViewが表示し、このページの価格とは別に配信されます。TradingViewにない銘柄は空欄になる場合があります。'],
 loading:['국내 시세를 불러오는 중입니다.','Loading Korean prices.','正在加载韩国行情。','韓国価格を読み込み中です。'],loadingVenue:['{0} 시세를 불러오는 중입니다.','Loading {0} prices.','正在加载 {0} 行情。','{0}の価格を読み込み中です。'],retryVenue:['{0} 시세를 못 불러와 다시 시도 중입니다. 계속되면 위에서 거래소를 바꿔 보세요({1}).','Couldn’t load {0}; retrying. If it keeps happening, select {1} above.','无法加载{0}行情，正在重试。如果持续发生，请在上方选择{1}。','{0}の価格を取得できず再試行しています。続く場合は上で{1}を選んでください。'],retryList:['다시 시도 중: {0}','Retrying: {0}','重试中：{0}','再試行中：{0}'],favoritesHint:['관심 코인의 별표를 눌러 나만의 목록을 만들어 보세요.','Star assets to build your watchlist.','点击星标，将币种加入自选列表。','星を押してウォッチリストを作成できます。'],noResults:['검색 결과가 없습니다.','No matching assets.','没有找到匹配的币种。','一致する銘柄がありません。'],storageWarning:['브라우저 저장이 차단되어 관심 목록은 이번 방문 동안만 유지됩니다.','Browser storage is blocked; your watchlist lasts only for this visit.','浏览器存储不可用，自选列表仅在本次访问期间保留。','ブラウザー保存が無効なため、ウォッチリストは今回の訪問中のみ保持されます。'],
 interval1:['1시간','1h','1小时','1時間'],interval4:['4시간','4h','4小时','4時間'],intervalD:['1일','1d','1天','1日'],fourHoursPrefix:['4h','4h','4小时','4時間'],dailyPrefix:['일봉','1d','日线','日足'],andyDaily:['매일 20시 갱신','Updated daily at 20:00 KST','每日韩国时间20:00更新','毎日20:00 KST更新'],notCurrent:['현재 신호 아님','Not a current signal','非当前信号','現在のシグナルではありません'],staleReport:['오래된 리포트, 후보 표시는 보류','Report is stale; picks are hidden','报告已过期，暂不显示观察标的','レポートが古いため候補を非表示'],reportFail:['리포트를 확인하지 못했습니다. 원본 장부에서 확인해 주세요.','Could not load the report. Check the original ledger.','无法读取报告，请查看原始记录。','レポートを読み込めません。元の記録をご確認ください。'],reportLoading:['Andy 장부 확인 중…','Loading Andy report…','正在读取 Andy 报告…','Andyレポートを確認中…'],
 stageSupport:['지지 확인','Support held','支撑确认','サポート確認'],stageRestart:['재출발','Restarting','重新启动','再始動'],stageWait:['눌림 대기','Waiting for pullback','等待回踩','押し目待ち'],stageExtended:['이미 많이 벌어짐','Extended','涨幅已大','すでに大きく上昇'],stageBreakout:['신규 돌파','Fresh breakout','新突破','新規ブレイク'],stageTrend:['추세 진행','Trend in progress','趋势延续','トレンド継続'],stageReversal:['바닥 반전','Bottom reversal','底部反转','底打ち反転'],notCandidate:['현재 연결된 Andy 후보는 아닙니다.','Not currently on Andy’s watchlist.','目前不在 Andy 观察名单中。','現在Andyの候補ではありません。'],
 detailCaution:['같은 티커만 비교하며 토큰·네트워크 동일성이나 입출금 가능 여부는 확인하지 않았습니다. 수수료·슬리피지·송금 지연도 반영하지 않았습니다.','Matching tickers do not confirm token or network identity or deposit and withdrawal availability. Fees, slippage and transfer delays are excluded.','代码相同不代表代币或网络相同，也不代表可以充提。未计手续费、滑点或转账延迟。','同じティッカーでもトークンやネットワークの同一性、入出金可否は未確認です。手数料・スリッページ・送金遅延も含みません。'],chartLink:['해외 현물 차트 ↗','Overseas spot chart ↗','海外现货图表 ↗','海外現物チャート ↗'],ledger:['장부 ↗','Ledger ↗','记录 ↗','記録 ↗'],talk:['라운지에서 이야기하기 →','Discuss in the lounge →','到大厅讨论 →','ラウンジで話す →']
};
const tr=(key,...args)=>String(COPY[key]?.[langIndex]??key).replace(/\{(\d+)\}/g,(_,i)=>String(args[Number(i)]??''));
const numberLocale={ko:'ko-KR',en:'en-US',zh:'zh-CN',ja:'ja-JP'}[lang]||'ko-KR';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=0)=>num(x)===null?'—':Number(x).toLocaleString(numberLocale,{maximumFractionDigits:d});
const pct=x=>num(x)===null?'—':(x>0?'+':'')+Number(x).toFixed(2)+'%';
const color=x=>num(x)===null?'dm-muted':x>=0?'dm-up':'dm-down';
const krw=x=>num(x)===null?'—':'₩'+fmt(x,x<100?4:x<1000?2:0);
const won=x=>num(x)===null?'':fmt(x,x<100?4:x<1000?2:0);
/* 보조줄은 좁은 화면에서도 가로 스크롤 없이 들어가야 해 만·억으로 줄인다. 정확한 금액은 상세에 남는다. */
const compact=(n)=>{const a=Math.abs(n);if(langIndex===0){if(a>=1e12)return fmt(n/1e12,1)+'조';if(a>=1e8)return fmt(n/1e8,a>=1e9?0:1)+'억';if(a>=1e4)return fmt(n/1e4,a>=1e5?0:1)+'만';return fmt(n,n<1?4:n<100?2:0);}if(langIndex===1){if(a>=1e12)return fmt(n/1e12,1)+'T';if(a>=1e9)return fmt(n/1e9,1)+'B';if(a>=1e6)return fmt(n/1e6,1)+'M';if(a>=1e3)return fmt(n/1e3,1)+'K';return fmt(n,n<1?4:n<100?2:0);}if(langIndex===2){if(a>=1e12)return fmt(n/1e12,1)+'万亿';if(a>=1e8)return fmt(n/1e8,1)+'亿';if(a>=1e4)return fmt(n/1e4,1)+'万';return fmt(n,n<1?4:n<100?2:0);}if(a>=1e12)return fmt(n/1e12,1)+'兆';if(a>=1e8)return fmt(n/1e8,1)+'億';if(a>=1e4)return fmt(n/1e4,1)+'万';return fmt(n,n<1?4:n<100?2:0);};
const shortWon=x=>{const n=num(x);if(n===null)return '';const sign=n>0?'+':n<0?'-':'';return sign+compact(Math.abs(n));};
const eok=x=>{const n=num(x);if(n===null)return '';if(langIndex===0){if(n<1e8)return fmt(n/1e4)+'만';const e=Math.round(n/1e8);return e<1e4?fmt(e)+'억':fmt(Math.floor(e/1e4))+'조 '+fmt(e%1e4)+'억';}return compact(n);};
const signedKrw=x=>num(x)===null?'—':(x>0?'+':x<0?'-':'')+krw(Math.abs(x));
const usdt=x=>num(x)===null?'—':x>=1e9?fmt(x/1e9,2)+'B':x>=1e6?fmt(x/1e6,1)+'M':fmt(x);
const time=x=>new Date(x).toLocaleTimeString(numberLocale,{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
let storageWarning=false;
let favorites=new Set();try{const a=JSON.parse(localStorage.getItem('tl_domestic_favorites')||'[]');if(Array.isArray(a))favorites=new Set(a.filter(safeSymbol).slice(0,500));}catch{storageWarning=true;}
const state={venue:'upbit',foreign:'binance',interval:'60',only:false,andyOnly:false,query:'',sort:'volume',dir:1,selected:null,tickers:{upbit:[],bithumb:[]},global:{},meta:[],andy:null,andyStatus:'loading',errors:{},tries:{},at:{},busy:false,again:false,timer:null,paint:null,controllers:new Set(),epoch:0,lastAttempt:0};
const guidePath={en:'/en/learn/kimchi-premium/',zh:'/zh/learn/kimchi-premium/',ja:'/ja/learn/kimchi-premium/'}[lang]||'/ko/learn/kimchi-premium/';
el.innerHTML=`<div class="dm-top"><h1>${tr('title')}</h1><a href="#research">${tr('watch')}</a></div>
<p class="dm-intro"><span>${tr('intro')}</span> <a href="${guidePath}">${tr('guide')}</a></p>
<div class="dm-pair"><label class="dm-card"><span>${tr('base')}</span><select id="dm-venue"><option value="upbit">${tr('upbit')} KRW</option><option value="bithumb">${tr('bithumb')} KRW</option></select></label><span class="dm-swap" aria-hidden="true">⇄</span><label class="dm-card"><span>${tr('compare')}</span><select id="dm-foreign">${Object.keys(FOREIGN).map(k=>`<option value="${k}">${tr(k)} USDT</option>`).join('')}</select></label></div>
<div class="dm-find"><button id="dm-favorites" aria-pressed="false" title="${tr('watchOnly')}">☆</button><button id="dm-andy-only" aria-pressed="false" title="${tr('andyOnly')}">Andy</button><input id="dm-search" type="search" placeholder="${tr('search')}" maxlength="40" aria-label="${tr('searchLabel')}"><span id="dm-count"></span></div>
<div class="dm-scroll"><table><thead><tr id="dm-head"></tr></thead><tbody id="dm-table"></tbody><tbody id="dm-chart"></tbody><tbody id="dm-rest"></tbody></table></div>
<div class="dm-foot"><p id="dm-status" role="status" aria-live="polite">${tr('loading')}</p><p class="dm-strip" id="dm-rates"></p><p class="dm-strip"><span id="dm-andy-at">${tr('reportLoading')}</span> <a href="reports/andy_scan.html#andy-retest" target="_blank" rel="noopener">${tr('ledger')}</a></p></div>
<details><summary>${tr('notes')}</summary><p>${tr('readTable')}</p><p>${tr('formula')}</p><p>${tr('dataNotes')}</p><p>${tr('caution')}</p><p>${tr('sources')}</p></details>`;
const $=id=>document.getElementById(id);
const names={BTC:['비트코인','Bitcoin','比特币','ビットコイン'],ETH:['이더리움','Ethereum','以太坊','イーサリアム'],XRP:['리플','XRP','XRP','XRP'],SOL:['솔라나','Solana','Solana','Solana'],DOGE:['도지코인','Dogecoin','狗狗币','ドージコイン'],USDT:['테더','Tether','泰达币','テザー'],ETC:['이더리움클래식','Ethereum Classic','以太坊经典','イーサリアムクラシック']};
function name(s){const meta=state.venue==='bithumb'?state.meta.find(m=>m.market==='KRW-'+s):null;return langIndex===0?(meta?.korean_name||names[s]?.[0]||s):langIndex===1?(meta?.english_name||names[s]?.[1]||s):(names[s]?.[langIndex]||s);}
function visible(){return !el.classList.contains('hidden')&&!document.hidden;}
function venueName(){return tr(state.venue);}
function foreignName(){return tr(state.foreign);}
const TV={upbit:'UPBIT',bithumb:'BITHUMB'};
const INTERVALS={'60':tr('interval1'),'240':tr('interval4'),'D':tr('intervalD')};
const stageText=s=>({ '지지 확인':tr('stageSupport'),'재출발':tr('stageRestart'),'눌림 대기':tr('stageWait'),'이미 많이 벌어짐':tr('stageExtended'),'신규 돌파':tr('stageBreakout'),'추세 진행':tr('stageTrend'),'바닥 반전':tr('stageReversal') }[s]||s);
const reasonText=s=>({ '체결 지연':tr('delayed'),'해외 비교 없음':tr('noMatch'),'해외 시세 지연':tr('foreignDelayed'),'국내 USDT 시세 없음':tr('noUsdt'),'가격차 재확인':tr('recheck') }[s]||s);
let mounted='';
function chartKey(symbol){return `${state.venue}|${symbol}|${state.interval}`;}
/* TradingView 임베드는 iframe 으로만 넣는다 — 위젯 로더 스크립트를 이 페이지에서 실행시키지 않기 위해서다.
   iframe 은 DOM 에서 옮기거나 다시 그리면 통째로 새로 읽으므로, 이 줄만 별도 tbody 에 두고
   시세 갱신 때 건드리지 않는다(render 참고). */
function chartUrl(symbol){
 const q=new URLSearchParams({symbol:`${TV[state.venue]}:${symbol}KRW`,interval:state.interval,theme:'dark',style:'1',
  locale:({ko:'kr',en:'en',zh:'zh_CN',ja:'ja'}[lang]||'kr'),timezone:'Asia/Seoul',hide_side_toolbar:'1',allow_symbol_change:'0',save_image:'0',withdateranges:'0',
  utm_source:'tapelounge.com'});
 return 'https://s.tradingview.com/widgetembed/?'+q;
}
function chartRow(symbol){
 const tabs=Object.entries(INTERVALS).map(([k,v])=>`<button data-interval="${k}" aria-pressed="${k===state.interval}">${v}</button>`).join('');
 return `<tr class="dm-open dm-open-chart"><td colspan="5">
<div class="dm-openhead"><b>${esc(name(symbol))} <span>${symbol}</span></b><button data-select="${symbol}">${tr('close')}</button></div>
<section><h3>${tr('chartHeader',esc(venueName()))} <small>TradingView · ${esc(TV[state.venue])}:${esc(symbol)}KRW</small><span class="dm-periods">${tabs}</span></h3>
<iframe class="dm-chart" src="${esc(chartUrl(symbol))}" title="${esc(name(symbol))} ${symbol}/KRW ${tr('chartTitle')}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
<p class="dm-note">${tr('chartNote')}</p></section></td></tr>`;
}
function fact(label,value,cls){return `<div><span>${label}</span><b${cls?` class="${cls}"`:''}>${value}</b></div>`;}
function detail(r,stages){
 const tether=state.tickers[state.venue].find(t=>t.market==='KRW-USDT'),far=foreignName();
 return `<tr class="dm-open"><td colspan="5">
<section><h3>${tr('numbers')}</h3><div class="dm-facts">
${fact(esc(tr('venuePrice',venueName())),krw(r.price))}
${fact(tr('prev'),pct(r.change)+(num(r.changeKrw)===null?'':` <em>${signedKrw(r.changeKrw)}</em>`),color(r.change))}
${fact(tr('converted',far),krw(r.foreignKrw))}
${fact(tr('premium'),(r.premium===null?'—':pct(r.premium))+(r.gap===null?'':` <em>${signedKrw(r.gap)}</em>`),color(r.premium))}
${fact(tr('hiLow'),krw(r.high)+' / '+krw(r.low))}
${fact(tr('fromHigh'),pct(r.fromHigh),color(r.fromHigh))}
${fact(tr('foreignChange'),pct(r.foreignChange),color(r.foreignChange))}
${fact(tr('dailyVolume'),(eok(r.volume)||'—')+' / '+(eok(r.foreignVolumeKrw)||'—'))}
</div></section>
<section><h3>${tr('reference')}</h3>
<p class="dm-note">${tr('tetherBasis',venueName(),krw(tether?.trade_price),far,fmt(r.foreign,6))}${r.reason?` ${tr('premiumHidden',reasonText(r.reason))}`:''}</p>
<p class="dm-note">${stages[r.symbol]?tr('andyStage',esc(stages[r.symbol]),esc(state.andy.label)):tr('notCandidate')} ${tr('detailCaution')}</p>
<p><a href="https://www.binance.com/en/trade/${r.symbol}_USDT?type=spot" target="_blank" rel="noopener noreferrer">${tr('chartLink')}</a> · <a href="reports/andy_scan.html#andy-retest" target="_blank" rel="noopener">${tr('ledger')}</a> · <a href="#">${tr('talk')}</a></p></section>
</td></tr>`;
}
const COLUMNS=[{key:'symbol',label:tr('name'),first:-1},{key:'price',label:tr('price')},{key:'premium',label:tr('premium')},{key:'change',label:tr('change')},{key:'volume',label:tr('volume')}];
function order(a,b){const k=state.sort,d=state.dir;if(k==='symbol')return d===1?b.symbol.localeCompare(a.symbol):a.symbol.localeCompare(b.symbol);const x=num(a[k]),y=num(b[k]);if(x===null&&y===null)return a.symbol.localeCompare(b.symbol);if(x===null)return 1;if(y===null)return -1;return (d===1?y-x:x-y)||a.symbol.localeCompare(b.symbol);}
function render(){
 const focused=document.activeElement;
 const restore=focused?.dataset?.star?['star',focused.dataset.star]:focused?.dataset?.select?['select',focused.dataset.select]:null;
 const now=Date.now(),rows=rowsFor(state.tickers[state.venue],state.global,now);
 const andyFresh=state.andy&&now-state.andy.at<=36*3600000&&now-state.andy.at>=-300000;
 const stages=andyFresh?state.andy.stages:{};
 const u=state.tickers[state.venue].find(t=>t.market==='KRW-USDT');
 $('dm-rates').innerHTML=`<span>${tr('base')}: ${venueName()} USDT/KRW <b>${krw(u?.trade_price)}</b> ${fresh(u?.trade_timestamp)?tr('latest'):tr('stale')}</span><span>${tr('compare')}: <b>${esc(foreignName())} USDT ${langIndex===0?'현물':langIndex===1?'spot':langIndex===2?'现货':'現物'}</b> ${tr('marketsCount',Object.keys(state.global).length)}</span>`;
 const relevant=[state.venue,'foreign'];
 const failures=relevant.filter(k=>(state.tries[k]||0)>=2);
 const domesticState=live[state.venue]?tr('statusLive'):tr('statusWait'),foreignState=FOREIGN[state.foreign].stream?(live.binance?tr('statusLive'):tr('statusWait')):tr('statusPoll');
 $('dm-status').textContent=`${tr('base')}: ${domesticState} · ${tr('compare')}: ${foreignName()} ${foreignState} · ${tr('screen')}`+(state.at[state.venue]?` · ${time(state.at[state.venue])} KST`:'')+(failures.length?' · '+tr('retryList',failures.map(k=>k==='foreign'?foreignName():venueName()).join(', ')):'')+(storageWarning?' · '+tr('storageWarning'):'');
 $('dm-head').innerHTML=COLUMNS.map(c=>{const t=esc(c.label),on=state.sort===c.key;return `<th${on?` aria-sort="${state.dir===1?'descending':'ascending'}"`:''}><button data-sort="${c.key}" title="${esc(tr('sortTitle',c.label))}">${t}<span aria-hidden="true">${on?(state.dir===1?'▼':'▲'):'⇅'}</span></button></th>`;}).join('');
 $('dm-andy-at').textContent=state.andy?`${state.andy.label} · ${tr('andyDaily')}${andyFresh?' · '+tr('notCurrent'):' · '+tr('staleReport')}`:tr(state.andyStatus==='loading'?'reportLoading':'reportFail');
 const filtered=rows.filter(r=>(!state.only||favorites.has(r.symbol))&&(!state.andyOnly||stages[r.symbol])&&(!state.query||(r.symbol+' '+name(r.symbol)).toLowerCase().includes(state.query))).sort(order);
 $('dm-count').textContent=tr('count',filtered.length);
 const pending=!state.at.foreign;
 const row=r=>`<tr${r.symbol===state.selected?' class="dm-sel"':''}><td class="dm-name"><button data-select="${r.symbol}" aria-expanded="${r.symbol===state.selected}">${esc(name(r.symbol))}</button><small><button data-star="${r.symbol}" aria-label="${esc(tr('favoriteAria',r.symbol))}" aria-pressed="${favorites.has(r.symbol)}">${favorites.has(r.symbol)?'★':'☆'}</button><span class="dm-sym">${r.symbol}</span>${stages[r.symbol]?` <span class="dm-badge" title="Andy · ${esc(stages[r.symbol])}">${esc(stages[r.symbol])}</span>`:''}</small></td><td><b>${won(r.price)||'—'}</b><small>${won(r.foreignKrw)}</small></td><td><b class="${color(r.premium)}">${r.premium===null?'':pct(r.premium)}</b><small${r.gap===null?' class="dm-warn"':''}>${r.gap===null?esc(pending&&r.foreign===null?tr('foreignWait'):reasonText(r.reason)):shortWon(r.gap)}</small></td><td><b class="${color(r.change)}">${pct(r.change)}</b><small>${shortWon(r.changeKrw)}</small></td><td><b>${eok(r.volume)||'—'}</b><small>${eok(r.foreignVolumeKrw)}</small></td></tr>`;
 /* 차트 줄만 따로 그린다. iframe 은 다시 그리면 처음부터 읽으므로 시세 갱신에 딸려가면 안 된다. */
 const at=state.selected?filtered.findIndex(r=>r.symbol===state.selected):-1,open=at>=0?filtered[at]:null;
 $('dm-table').innerHTML=filtered.length?(at>=0?filtered.slice(0,at+1):filtered).map(row).join(''):`<tr><td colspan="5">${!state.tickers[state.venue].length?((state.tries[state.venue]||0)>=3?tr('retryVenue',venueName(),tr(state.venue==='upbit'?'bithumb':'upbit')):tr('loadingVenue',venueName())):state.only?tr('favoritesHint'):tr('noResults')}</td></tr>`;
 const key=open?chartKey(open.symbol):'';
 if(mounted!==key){$('dm-chart').innerHTML=open?chartRow(open.symbol):'';mounted=key;}
 $('dm-rest').innerHTML=(open?detail(open,stages):'')+(at>=0?filtered.slice(at+1).map(row).join(''):'');
 if(restore&&safeSymbol(restore[1]))el.querySelector(`[data-${restore[0]}="${restore[1]}"]`)?.focus({preventScroll:true});
}
async function get(url,epoch,asText=false){
 const c=new AbortController();state.controllers.add(c);let timedOut=false;const t=setTimeout(()=>{timedOut=true;c.abort();},12000);
 try{const r=await fetch(url,{signal:c.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);const data=asText?await r.text():await r.json();if(epoch!==state.epoch)throw Error('Cancelled');return data;}
 catch(e){if(timedOut)throw Error('Request timed out');throw e;}
 finally{clearTimeout(t);state.controllers.delete(c);}
}
async function job(key,fn){try{await fn();delete state.errors[key];state.tries[key]=0;if(key==='andy')state.andyStatus='ready';}catch(e){if(e.name!=='AbortError'&&e.message!=='Cancelled'){state.errors[key]=true;state.tries[key]=(state.tries[key]||0)+1;if(key==='andy')state.andyStatus='failed';}}}
async function domestic(venue,epoch){
 let ticks;
 if(venue==='upbit')ticks=await get('https://api.upbit.com/v1/ticker/all?quote_currencies=KRW',epoch);
 else{
  if(!state.meta.length||Date.now()-(state.at.meta||0)>3600000){const m=await get('https://api.bithumb.com/v1/market/all?isDetails=true',epoch);if(!Array.isArray(m))throw Error('Invalid markets');state.meta=m.filter(x=>/^KRW-[A-Z0-9]+$/.test(x.market));state.at.meta=Date.now();}
  const urls=[];for(let i=0;i<state.meta.length;i+=80)urls.push('https://api.bithumb.com/v1/ticker?markets='+state.meta.slice(i,i+80).map(x=>x.market).join(','));
  const batches=await Promise.all(urls.map(u=>get(u,epoch)));
  if(batches.some(b=>!Array.isArray(b)))throw Error('Invalid ticks');
  ticks=batches.flat();
 }
 if(!Array.isArray(ticks)||!ticks.length)throw Error('Empty market');
 ticks=ticks.map(stamped);
 const previous=new Map(state.tickers[venue].map(x=>[x.market,x]));state.tickers[venue]=ticks.map(x=>{const old=previous.get(x.market);return old&&old.trade_timestamp>x.trade_timestamp?old:x;});state.at[venue]=Date.now();
}
async function loadAndy(epoch){
 state.andyStatus='loading';
 try{
  const data=await get('data/andy-watch.json',epoch),at=Date.parse(data.reportAt);
  if(data.schema!==1||!Number.isFinite(at)||!Array.isArray(data.candidates))throw Error('Invalid ledger');
  const stages={};for(const x of data.candidates){if(!safeSymbol(x.symbol)||!['4h','1d'].includes(x.timeframe)||typeof x.stage!=='string')continue;
   const label=tr(x.timeframe==='4h'?'fourHoursPrefix':'dailyPrefix')+' · '+stageText(x.stage);stages[x.symbol]=stages[x.symbol]?stages[x.symbol]+' / '+label:label;}
  state.andy={label:new Date(at).toLocaleString(numberLocale,{timeZone:'Asia/Seoul',hour12:false})+' KST',at,stages};state.at.andy=Date.now();return;
 }catch(e){if(e.name==='AbortError'||e.message==='Cancelled')throw e;}
 const html=await get('reports/andy_scan.html',epoch,true),doc=new DOMParser().parseFromString(html,'text/html');
 const label=doc.querySelector('.hdr .ts')?.textContent?.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST/);
 if(!label||!doc.querySelector('#andy-retest'))throw Error('Invalid report');
 const stages={};doc.querySelectorAll('#andy-retest table tr').forEach(rowEl=>{const t=rowEl.querySelectorAll('td');if(t.length<2)return;const s=t[0].textContent.trim().replace(/\/USDT$/,''),stage=t[1].textContent.trim();if(safeSymbol(s)&&['지지 확인','재출발','눌림 대기','이미 많이 벌어짐'].includes(stage))stages[s]=tr('fourHoursPrefix')+' · '+stageText(stage);});
 doc.querySelectorAll('table tr').forEach(rowEl=>{if(rowEl.closest?.('#andy-retest'))return;const t=rowEl.querySelectorAll('td');if(t.length<3)return;const s=t[1].textContent.trim(),m=t[2].textContent.trim().match(/^[ABC] · (신규 돌파|추세 진행|바닥 반전)$/);if(safeSymbol(s)&&m)stages[s]=(stages[s]?stages[s]+' / ':'')+tr('dailyPrefix')+' · '+stageText(m[1]);});
 const reportAt=Date.parse(`${label[1]}T${label[2]}:00+09:00`);state.andy={label:new Date(reportAt).toLocaleString(numberLocale,{timeZone:'Asia/Seoul',hour12:false})+' KST',at:reportAt,stages};state.at.andy=Date.now();
}
/* 아직 한 줄도 못 받은 상태에서는 30초를 기다리지 않고 짧게 다시 시도한다.
   한 번 실패했다고 표를 비우거나 실패라고 단정하지 않는다 — 이미 받아 둔 시세는 그대로 두고 조용히 재시도한다. */
function starving(){return !state.tickers[state.venue].length||!Object.keys(state.global).length;}
function wait(){return starving()?Math.min(3000*2**Math.min(Math.max((state.tries[state.venue]||0),(state.tries.foreign||0))-1,3),30000):30000;}
async function refresh(force){
 if(!visible())return;
 /* 조회 중에 거래소를 바꾸면 그 요청을 버리지 말고, 지금 조회가 끝나는 대로 이어서 한다. */
 if(state.busy){if(force)state.again=true;return;}
 if(!force&&Date.now()-state.lastAttempt<wait()){schedule();return;}
 const epoch=state.epoch;state.busy=true;state.lastAttempt=Date.now();render();
 /* 조회가 끝나는 대로 그린다. 국내 시세는 100ms 면 오는데 예전에는 해외 전 종목과 Andy 리포트까지
    다 받은 뒤에야 표가 나왔다. 국내가 도착하면 실시간 연결도 바로 연다. */
 const paintNow=()=>{if(visible()&&epoch===state.epoch)render();};
 await Promise.all([job(state.venue,async()=>{
  /* 받아 둔 시세가 없으면 웹소켓 연결 간격 때문에 조회를 거르지 않는다 — 거르면 빈 표가 그대로 남는다. */
  if(state.tickers[state.venue].length&&(streams?.healthy(state.venue)||streams?.canPoll(state.venue)===false))return;
  await domestic(state.venue,epoch);}).then(()=>{
  if(visible()&&epoch===state.epoch&&state.tickers[state.venue].length)streams?.start(state.venue,state.tickers[state.venue].map(x=>x.market),!!FOREIGN[state.foreign].stream);
  paintNow();}).then(()=>job('andy',async()=>{if(Date.now()-(state.at.andy||0)<300000)return;await loadAndy(epoch);})).then(paintNow),job('foreign',async()=>{const key=state.foreign;if(Object.keys(state.global).length&&FOREIGN[key].stream&&streams?.healthy('binance'))return;
  const payload=await get(FOREIGN[key].url,epoch);const rows=foreignRows(key,payload,Date.now());
  if(!rows)throw Error('Invalid global');if(key!==state.foreign||epoch!==state.epoch)return;
  state.global=rows;state.at.foreign=Date.now();}).then(paintNow)]);
 state.busy=false;
 if(visible()){streams?.start(state.venue,state.tickers[state.venue].map(x=>x.market),!!FOREIGN[state.foreign].stream);render();}
 if(state.again){state.again=false;if(visible())return refresh(true);}
 schedule();
}
function schedule(){clearTimeout(state.timer);if(visible())state.timer=setTimeout(refresh,Math.max(1000,wait()-(Date.now()-state.lastAttempt)));}
function sync(){if(!visible()){clearTimeout(state.timer);clearTimeout(state.paint);state.paint=null;streams?.stop();state.epoch++;state.controllers.forEach(c=>c.abort());}else{render();refresh();}}
el.addEventListener('click',e=>{const star=e.target.closest('[data-star]'),select=e.target.closest('[data-select]'),sort=e.target.closest('[data-sort]'),interval=e.target.closest('[data-interval]');
 if(interval){const k=interval.dataset.interval;if(INTERVALS[k]&&k!==state.interval){state.interval=k;render();}return;}if(sort){const k=sort.dataset.sort;state.dir=state.sort===k?-state.dir:(COLUMNS.find(c=>c.key===k)?.first??1);state.sort=k;render();}if(star){const s=star.dataset.star;favorites.has(s)?favorites.delete(s):favorites.add(s);try{localStorage.setItem('tl_domestic_favorites',JSON.stringify([...favorites]));}catch{storageWarning=true;}window.dispatchEvent(new CustomEvent('tl:favorites',{detail:{symbols:[...favorites]}}));render();}if(select){const s=select.dataset.select;state.selected=state.selected===s?null:s;render();}});
$('dm-venue').onchange=e=>{state.venue=e.target.value;state.selected=null;render();refresh(true);};
$('dm-foreign').onchange=e=>{if(!FOREIGN[e.target.value])return;state.foreign=e.target.value;state.global={};delete state.errors.foreign;render();refresh(true);};
$('dm-search').oninput=e=>{state.query=e.target.value.trim().toLowerCase();render();};
$('dm-favorites').onclick=e=>{state.only=!state.only;e.currentTarget.setAttribute('aria-pressed',String(state.only));render();};
$('dm-andy-only').onclick=e=>{state.andyOnly=!state.andyOnly;e.currentTarget.setAttribute('aria-pressed',String(state.andyOnly));render();};
const live={};
function paint(){if(!visible()||state.paint)return;state.paint=setTimeout(()=>{state.paint=null;if(visible())render();},1000);}
const streams=root.DomesticStreams?.createStreams({onState:(kind,on)=>{live[kind]=on;paint();},onData:(kind,updates)=>{
 if(kind==='binance'){if(state.foreign!=='binance')return;for(const x of updates){if(!state.global[x.symbol]||x.closeTime>=state.global[x.symbol].closeTime)state.global[x.symbol]={...state.global[x.symbol],...x};}}
 else {const map=new Map(state.tickers[kind].map(x=>[x.market,x]));for(const x of updates){const old=map.get(x.market);if(!old||x.trade_timestamp>=old.trade_timestamp)map.set(x.market,{...old,...x});}state.tickers[kind]=[...map.values()];state.at[kind]=Date.now();}
 delete state.errors[kind==='binance'?'foreign':kind];paint();}});
root.TapeMarket={open(symbol){if(!safeSymbol(symbol))return;state.query=symbol.toLowerCase();state.selected=symbol;state.only=state.andyOnly=false;$('dm-search').value=symbol;$('dm-favorites').setAttribute('aria-pressed','false');$('dm-andy-only').setAttribute('aria-pressed','false');render();refresh(true);}};
window.addEventListener?.('tl:favorites',e=>{if(!Array.isArray(e.detail?.symbols))return;favorites=new Set(e.detail.symbols.filter(safeSymbol).slice(0,500));if(visible())render();});
window.addEventListener?.('storage',e=>{if(e.key!=='tl_domestic_favorites')return;try{const s=JSON.parse(e.newValue||'[]');if(Array.isArray(s))favorites=new Set(s.filter(safeSymbol).slice(0,500));}catch{}if(visible())render();});
new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']});document.addEventListener('visibilitychange',sync);sync();
})(typeof window!=='undefined'?window:globalThis);
