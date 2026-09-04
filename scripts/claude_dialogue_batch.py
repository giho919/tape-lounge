#!/usr/bin/env python3
"""Claude가 직접 쓴 라운지 크루 대사를 검증 후 라이브러리에 추가한다.

■ 왜 필요한가
기존 라이브러리(10,000팩)는 조합 생성물이라 문장 결이 반복되고, 최근 24시간 중복
필터에 걸리면 특정 장면 후보가 통째로 고갈돼 `no_valid_dialogue` 로 침묵한다.
로컬 Qwen 폴백은 서버 메모리 확보를 위해 내렸고 서비스도 `--no-llm` 이라 대안이 없다.

그래서 Claude 가 시황을 읽고 쓴 고품질 대사를 **라이브러리에 채워 넣는다**.
발행은 기존 서명 경로(`lounge_crew.py` → RSA-SHA256 → Edge Function)를 그대로 쓴다.
새 비밀정보가 생기지 않고, 10분 타이머는 내 세션과 무관하게 계속 돈다.

■ 지켜야 할 제약 (전부 이 스크립트가 자동 검증)
- agent_key 는 AGENT_NAMES 의 10개만, nick 은 그 매핑과 정확히 일치해야 한다
  (Edge Function 이 고정 인물-닉 매핑을 재검증하므로 틀리면 401/거부).
- 본문 길이 8~300자. 라이브러리 규약상 한 팩은 3~5개 메시지, 화자 2명 이상.
- BANNED 문구 금지 — 매매 지시·단정·포지션 인증 표현.
- 플레이스홀더는 그 장면이 실제로 제공하는 것만 사용한다. 없는 키를 쓰면
  render_pack 이 조용히 실패해 그 팩이 영영 안 쓰인다.
- 계좌 잔고·수익률·proba·임계값은 절대 쓰지 않는다(공개 채널 원칙).

실행:
  python3 scripts/claude_dialogue_batch.py            # 검증만
  python3 scripts/claude_dialogue_batch.py --append   # 검증 후 라이브러리에 추가
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
LIBRARY = BASE_DIR / "data" / "ai_dialogue_library.jsonl"
SOURCE_TAG = "claude-authored"

AGENT_NAMES = {
    "madam": "鄭마담",
    "andy": "Andy",
    "justin": "Prof. Justin",
    "watcher": "관망이",
    "chart_doryeong": "차트도령",
    "funding_bear": "펀딩곰",
    "spot_sister": "현물누나",
    "degen": "디젠",
    "hermit": "허밋",
    "wolf": "울프",
}
OFFICIAL = {"madam", "andy", "justin"}

BANNED = (
    "무조건", "확실", "보장", "풀매수", "풀숏", "사라", "팔아",
    "롱 가자", "숏 가자", "진입해", "손절해", "익절해", "내 포지션",
    "수익 인증", "세력이다", "지지 확인", "저항 확인", "안착",
)

# 장면이 실제로 제공하는 플레이스홀더 (lounge_crew.detect_scenes 의 facts 기준)
SCENE_FACTS = {
    "ask_heavy": {"book_imbalance"},
    "bid_heavy": {"book_imbalance"},
    "block_settled": {"block_height"},
    "btc_dominance_up": {"dominance_change_pct"},
    "calm_after_shock": set(),
    "fear_extreme": {"fear_greed"},
    "funding_negative": {"funding_pct"},
    "funding_positive": {"funding_pct"},
    "greed_extreme": {"fear_greed"},
    "long_liquidation": {"liquidation_usd"},
    "mempool_busy": {"fee_rate"},
    "near_day_high": {"high_gap_pct"},
    "near_day_low": {"low_gap_pct"},
    "oi_price_down": {"oi_change_pct", "price_change_pct"},
    "oi_price_up": {"oi_change_pct", "price_change_pct"},
    "quiet_range": set(),
    "short_liquidation": {"liquidation_usd"},
    "spread_wide": {"spread_usdt"},
    "volume_burst": {"volume_ratio"},
}


def m(agent: str, body: str) -> dict[str, str]:
    return {"agent_key": agent, "nick": AGENT_NAMES[agent], "body": body}


# ── Claude가 쓴 대사 ─────────────────────────────────────────────
# 인물 결: 관망이=조심스러운 질문자 / 차트도령=구조·레벨 / 펀딩곰=파생·과열 경계
#          현물누나=현물 수급·차분 / 디젠=활기차지만 단정 안 함 / 허밋=온체인·긴 호흡
#          울프=호가·미시구조
PACKS: list[tuple[str, list[dict[str, str]]]] = [
    # ── near_day_high ──
    ("near_day_high", [
        m("watcher", "고점까지 {high_gap_pct} 남았네. 이럴 때 다들 뭘 보고 있어?"),
        m("wolf", "나는 위쪽 호가가 실제로 걷히는지를 봐. 숫자보다 잔량 변화가 먼저 움직이더라."),
        m("chart_doryeong", "직전 고점 부근은 거래가 몰렸던 구간이라 반응이 나오는 게 자연스러워."),
        m("spot_sister", "현물 쪽은 아직 조급해 보이지 않아. 천천히 봐도 될 것 같네."),
    ]),
    ("near_day_high", [
        m("degen", "고점 {high_gap_pct} 앞이라니까 괜히 손이 근질거리는데."),
        m("funding_bear", "그 근질거림이 파생 쪽에 먼저 쌓이면 되돌림이 매워질 수 있어."),
        m("watcher", "그럼 지금은 뭘 확인하면 될까?"),
        m("funding_bear", "가격보다 미결제가 같이 늘고 있는지를 나는 먼저 봐."),
    ]),
    ("near_day_high", [
        m("hermit", "고점 근처라는 건 결국 누군가는 오래 들고 있었다는 뜻이기도 해."),
        m("chart_doryeong", "{high_gap_pct} 거리는 숫자일 뿐이고, 거기서 거래가 실리는지가 관건이지."),
        m("spot_sister", "체결이 얇게 올라온 거라면 되돌림도 얇을 수 있어."),
    ]),

    # ── near_day_low ──
    ("near_day_low", [
        m("watcher", "저가랑 {low_gap_pct} 차이면 가까운 편인가?"),
        m("chart_doryeong", "가깝다 멀다보다, 저가를 만들 때 거래량이 어땠는지가 더 중요해."),
        m("spot_sister", "현물 매수가 조용히 받쳐주는 구간이면 모양이 달라지긴 하더라."),
        m("wolf", "아래 호가가 두꺼워지는지도 같이 보면 그림이 조금 선명해져."),
    ]),
    ("near_day_low", [
        m("hermit", "저가 근처에서는 다들 조용해지는데, 나는 그 정적을 오히려 관찰해."),
        m("degen", "{low_gap_pct}면 심장은 뛰는데 머리는 식히려고 하는 중이야."),
        m("watcher", "그 균형 맞추는 게 제일 어렵지."),
    ]),

    # ── funding_positive ──
    ("funding_positive", [
        m("funding_bear", "펀딩이 {funding_pct}야. 롱이 비용을 내면서 버티는 구간이라는 뜻이지."),
        m("watcher", "그게 나쁜 신호야?"),
        m("funding_bear", "나쁘다기보다, 비용이 길어지면 견디는 쪽이 먼저 지친다는 이야기야."),
        m("spot_sister", "현물은 그 비용이 없으니 호흡이 좀 다르긴 해."),
    ]),
    ("funding_positive", [
        m("degen", "펀딩 {funding_pct}면 아직 과열까진 아닌 느낌인데?"),
        m("chart_doryeong", "수치 자체보다 얼마나 오래 유지되는지가 더 말해주더라."),
        m("funding_bear", "맞아. 하루 만에 튄 건 금방 식고, 며칠 눌러앉은 건 흔적을 남겨."),
    ]),

    # ── funding_negative ──
    ("funding_negative", [
        m("funding_bear", "펀딩이 {funding_pct}로 내려왔어. 숏이 비용을 내는 쪽으로 바뀐 거야."),
        m("wolf", "그러면 급하게 되돌릴 때 위쪽이 얇아질 수 있겠네."),
        m("watcher", "그건 어떻게 확인해?"),
        m("wolf", "호가 잔량이 걷히는 속도를 보면 어느 정도 느낌이 와."),
    ]),
    ("funding_negative", [
        m("spot_sister", "펀딩 {funding_pct}인데 현물 쪽은 크게 흔들리지 않고 있어."),
        m("hermit", "파생과 현물이 다른 이야기를 할 때가 종종 있지. 나는 그 간극을 기록해 둬."),
        m("degen", "그 간극이 좁혀질 때가 재밌더라고."),
    ]),

    # ── greed_extreme ──
    ("greed_extreme", [
        m("watcher", "탐욕 지수가 {fear_greed}까지 왔네."),
        m("funding_bear", "이 구간에서는 좋은 소식이 이미 값에 들어가 있는 경우가 많아."),
        m("hermit", "나는 이럴 때 오히려 기록을 더 꼼꼼히 남겨. 나중에 되짚기 좋더라."),
        m("spot_sister", "분위기가 좋을수록 내 호흡을 유지하는 게 어려워지긴 해."),
    ]),
    ("greed_extreme", [
        m("degen", "{fear_greed}면 분위기 좋다는 거잖아. 다들 왜 이렇게 차분해."),
        m("chart_doryeong", "차분한 게 아니라, 분위기랑 구조를 분리해서 보려는 거야."),
        m("wolf", "체결창은 생각보다 담담해. 화면 온도랑 실제 온도가 다를 때가 있어."),
    ]),

    # ── fear_extreme ──
    ("fear_extreme", [
        m("watcher", "공포 지수 {fear_greed}. 화면 보기가 좀 힘들어지네."),
        m("hermit", "이런 구간은 길게 보면 몇 번 반복돼. 나는 그 사실만 기억하려고 해."),
        m("spot_sister", "현물 쪽은 오히려 조용히 물량이 옮겨가는 때이기도 하고."),
        m("chart_doryeong", "구조가 무너졌는지 눌린 건지는 시간이 좀 지나야 갈리더라."),
    ]),
    ("fear_extreme", [
        m("degen", "{fear_greed}면 다들 도망가는 분위기인데."),
        m("funding_bear", "그 도망이 파생에서 먼저 정리되면 오히려 가벼워지기도 해."),
        m("watcher", "가벼워진다는 게 어떤 의미야?"),
        m("funding_bear", "버티던 물량이 줄어서 다음 움직임이 수월해진다는 뜻이야."),
    ]),

    # ── oi_price_up ──
    ("oi_price_up", [
        m("chart_doryeong", "가격 {price_change_pct}에 미결제 {oi_change_pct}. 같은 방향으로 붙고 있네."),
        m("funding_bear", "새 포지션이 따라 들어온 모양이야. 그만큼 되돌림도 재료가 생긴 거고."),
        m("watcher", "그럼 좋은 거야 나쁜 거야?"),
        m("chart_doryeong", "둘 다 될 수 있어서, 나는 다음 봉에서 유지되는지를 봐."),
    ]),
    ("oi_price_up", [
        m("degen", "가격도 {price_change_pct}, 미결제도 {oi_change_pct}. 분위기 붙는데."),
        m("wolf", "붙을 때일수록 호가가 얇아지는지 같이 보면 좋아."),
        m("hermit", "빠르게 쌓인 건 빠르게 풀리기도 하니까 기록만 해둘게."),
    ]),

    # ── oi_price_down ──
    ("oi_price_down", [
        m("funding_bear", "가격은 {price_change_pct}인데 미결제는 {oi_change_pct}야. 방향이 엇갈렸네."),
        m("watcher", "이런 조합은 어떻게 읽어?"),
        m("funding_bear", "누군가는 반대편에 자리를 잡고 있다는 뜻일 수 있어. 단정은 못 하지만."),
        m("chart_doryeong", "그래서 나는 이럴 때 한 봉 더 기다리는 편이야."),
    ]),
    ("oi_price_down", [
        m("wolf", "체결은 {price_change_pct} 쪽인데 미결제가 {oi_change_pct}로 남아 있어."),
        m("spot_sister", "현물에서 나온 물량이 아니라면 파생 안에서 도는 이야기겠네."),
        m("hermit", "그 차이를 구분해두면 나중에 되짚을 때 도움이 되더라."),
    ]),

    # ── long_liquidation ──
    ("long_liquidation", [
        m("wolf", "롱 청산이 {liquidation_usd} 규모로 지나갔어."),
        m("funding_bear", "쌓여 있던 쪽이 한 번 정리된 셈이지."),
        m("watcher", "이러면 다음은 가벼워지는 거야?"),
        m("funding_bear", "가벼워질 수도, 더 나올 수도 있어. 한 번에 끝났는지가 관건이야."),
    ]),
    ("long_liquidation", [
        m("degen", "{liquidation_usd}어치 날아갔네. 화면이 붉었겠다."),
        m("spot_sister", "현물 체결은 그 사이에 오히려 담담했어."),
        m("chart_doryeong", "청산이 지나간 자리는 한동안 흔적으로 남더라."),
    ]),

    # ── short_liquidation ──
    ("short_liquidation", [
        m("wolf", "숏 청산 {liquidation_usd}. 위로 밀리는 구간에서 나온 거야."),
        m("funding_bear", "숏이 정리되면 위쪽 저항이 일시적으로 얇아 보이기도 해."),
        m("chart_doryeong", "그게 추세인지 청산이 만든 그림인지는 좀 지나야 갈려."),
        m("watcher", "그래서 다들 바로 안 움직이는구나."),
    ]),
    ("short_liquidation", [
        m("degen", "숏 {liquidation_usd} 털렸네. 이런 날은 화면이 빠르다."),
        m("hermit", "빠른 날일수록 나는 기록만 남기고 판단은 미뤄."),
        m("spot_sister", "현물 수급이 따라오는지가 다음 이야기일 것 같아."),
    ]),

    # ── volume_burst ──
    ("volume_burst", [
        m("wolf", "거래량이 평소의 {volume_ratio} 수준이야. 체결창이 눈에 띄게 바빠졌어."),
        m("chart_doryeong", "거래가 실린 자리는 나중에 기준점이 되기도 해."),
        m("watcher", "지금 방향은 어느 쪽으로 보여?"),
        m("wolf", "방향보다 이 속도가 유지되는지를 나는 먼저 봐."),
    ]),
    ("volume_burst", [
        m("degen", "{volume_ratio}이면 확 붙은 거 아니야?"),
        m("spot_sister", "붙긴 했는데 현물이랑 파생 중 어디서 나온 건지 나눠 봐야지."),
        m("funding_bear", "파생에서만 나온 거래량은 오래 못 가는 경우도 있더라."),
    ]),

    # ── bid_heavy ──
    ("bid_heavy", [
        m("wolf", "호가 불균형이 {book_imbalance}야. 아래쪽이 두꺼워."),
        m("watcher", "받쳐준다는 뜻으로 봐도 돼?"),
        m("wolf", "보이는 잔량은 언제든 걷힐 수 있어서, 실제 체결까지 봐야 알아."),
        m("spot_sister", "그래도 얇을 때보다는 마음이 좀 편하긴 해."),
    ]),
    ("bid_heavy", [
        m("chart_doryeong", "{book_imbalance} 상태면 아래가 단단해 보이는 그림이네."),
        m("funding_bear", "다만 두꺼운 벽이 진짜 매수인지 표시용인지는 구분이 어려워."),
        m("degen", "그래서 호가만 보고 움직이면 자주 속더라고."),
    ]),

    # ── ask_heavy ──
    ("ask_heavy", [
        m("wolf", "위쪽 잔량이 무거워. 불균형이 {book_imbalance} 정도야."),
        m("chart_doryeong", "그 벽을 소화하면서 올라가는지가 관전 포인트겠네."),
        m("watcher", "소화한다는 게 뭘 보면 알 수 있어?"),
        m("wolf", "잔량이 줄면서 체결이 붙는지를 보면 어느 정도 구분돼."),
    ]),
    ("ask_heavy", [
        m("spot_sister", "{book_imbalance}면 위가 꽤 무겁게 쌓인 편이지."),
        m("degen", "무거우면 뚫을 때 시원하긴 한데, 못 뚫으면 지치고."),
        m("hermit", "나는 그 지치는 구간을 더 오래 관찰하는 편이야."),
    ]),

    # ── spread_wide ──
    ("spread_wide", [
        m("wolf", "스프레드가 {spread_usdt}까지 벌어졌어. 유동성이 얇아진 신호야."),
        m("spot_sister", "이럴 때는 같은 주문도 체결 가격이 달라질 수 있어."),
        m("watcher", "그럼 좀 기다리는 게 나은 거네."),
        m("wolf", "서두르지 않는 것 자체가 비용을 아끼는 방법이기도 해."),
    ]),
    ("spread_wide", [
        m("degen", "{spread_usdt}면 체감이 꽤 큰데."),
        m("chart_doryeong", "얇은 구간에서는 작은 주문도 차트를 크게 흔들어 보이게 해."),
        m("funding_bear", "그 흔들림을 신호로 착각하지 않는 게 중요하고."),
    ]),

    # ── btc_dominance_up ──
    ("btc_dominance_up", [
        m("hermit", "도미넌스가 {dominance_change_pct} 움직였어."),
        m("watcher", "이게 알트 쪽엔 어떤 의미야?"),
        m("hermit", "자금이 어디에 머무는지를 보여주는 정도로 나는 읽어."),
        m("spot_sister", "한 방향으로 오래 가면 체감이 꽤 달라지긴 해."),
    ]),
    ("btc_dominance_up", [
        m("chart_doryeong", "{dominance_change_pct} 변화면 아직 추세라고 부르긴 이르지."),
        m("degen", "그래도 알트 화면은 조용해진 느낌이야."),
        m("hermit", "조용한 구간이 길어지는지만 기록해두면 될 것 같아."),
    ]),

    # ── mempool_busy ──
    ("mempool_busy", [
        m("hermit", "수수료가 {fee_rate} 수준이야. 멤풀이 붐비고 있어."),
        m("watcher", "이건 가격이랑 관련이 있어?"),
        m("hermit", "직접적이진 않아. 다만 체인 위에서 뭔가 움직이고 있다는 흔적이지."),
        m("wolf", "거래소 밖 움직임은 늦게 반영될 때가 많더라."),
    ]),
    ("mempool_busy", [
        m("degen", "{fee_rate}면 보낼 때 좀 아깝겠는데."),
        m("hermit", "급하지 않으면 기다리는 게 낫지. 붐빔은 대개 지나가니까."),
        m("spot_sister", "그 사이에 거래소 쪽은 평소랑 비슷해 보여."),
    ]),

    # ── block_settled ──
    ("block_settled", [
        m("hermit", "{block_height} 블록이 방금 자리를 잡았어."),
        m("watcher", "블록 하나가 그렇게 의미가 있어?"),
        m("hermit", "하나로는 아니고, 쌓이는 리듬이 느려지거나 빨라질 때 눈여겨봐."),
        m("spot_sister", "그 리듬은 화면 가격이랑은 또 다른 시간대의 이야기지."),
    ]),
    ("block_settled", [
        m("degen", "{block_height}. 숫자가 계속 올라가는 거 보면 묘하게 안심돼."),
        m("hermit", "그 꾸준함이 이 판에서 몇 안 되는 일정한 것이긴 해."),
        m("chart_doryeong", "차트는 요동쳐도 블록은 자기 속도로 가니까."),
    ]),

    # ── quiet_range (플레이스홀더 없음) ──
    ("quiet_range", [
        m("watcher", "오늘은 화면이 조용하네."),
        m("chart_doryeong", "좁은 구간이 길어지면 다음 움직임이 커지는 경우가 있어."),
        m("wolf", "체결도 뜸해. 양쪽 다 기다리는 분위기야."),
        m("spot_sister", "이럴 때 쉬는 것도 나쁘지 않더라."),
    ]),
    ("quiet_range", [
        m("degen", "조용하면 오히려 좀이 쑤신단 말이지."),
        m("hermit", "그 좀이 쑤시는 시간을 견디는 게 대부분의 구간이야."),
        m("funding_bear", "조용할 때 비용만 새는 자리도 있고."),
    ]),

    # ── calm_after_shock (플레이스홀더 없음) ──
    ("calm_after_shock", [
        m("wolf", "흔들린 뒤라 체결이 다시 잦아들었어."),
        m("chart_doryeong", "충격 직후의 첫 되돌림은 방향보다 폭을 먼저 보는 편이야."),
        m("watcher", "지금 판단하기엔 이른 느낌이네."),
        m("spot_sister", "응, 조금 지나고 봐도 늦지 않을 것 같아."),
    ]),
    ("calm_after_shock", [
        m("hermit", "큰 움직임 뒤의 정적은 늘 비슷한 얼굴을 하고 있어."),
        m("funding_bear", "정리될 게 정리됐는지는 며칠 지나야 알겠지."),
        m("degen", "그 며칠이 제일 길게 느껴진다니까."),
    ]),
]


def validate(scene: str, msgs: list[dict[str, str]], seen_bodies: set[str]) -> list[str]:
    errs: list[str] = []
    if scene not in SCENE_FACTS:
        errs.append(f"알 수 없는 장면: {scene}")
        return errs
    if not 3 <= len(msgs) <= 5:
        errs.append(f"메시지 수 {len(msgs)} (3~5 이어야 함)")
    if len({x["agent_key"] for x in msgs}) < 2:
        errs.append("화자가 2명 미만")
    allowed = SCENE_FACTS[scene]
    for x in msgs:
        key, body = x["agent_key"], x["body"]
        if key not in AGENT_NAMES:
            errs.append(f"알 수 없는 agent_key: {key}")
            continue
        if x["nick"] != AGENT_NAMES[key]:
            errs.append(f"닉 불일치: {key} → {x['nick']}")
        if not 8 <= len(body) <= 300:
            errs.append(f"본문 길이 {len(body)}: {body[:24]}…")
        for bad in BANNED:
            if bad in body:
                errs.append(f"금지어 '{bad}': {body[:24]}…")
        used = set(re.findall(r"\{([a-z_]+)\}", body))
        for ph in used - allowed:
            errs.append(f"{scene}에 없는 플레이스홀더 {{{ph}}}: {body[:24]}…")
        norm = re.sub(r"\s+", " ", body).strip()
        if norm in seen_bodies:
            errs.append(f"배치 내 중복 문장: {body[:24]}…")
        seen_bodies.add(norm)
    return errs


def next_index(path: Path) -> int:
    mx = 0
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            pid = json.loads(line).get("id", "")
            mo = re.match(r"dialogue-(\d+)$", pid or "")
            if mo:
                mx = max(mx, int(mo.group(1)))
    return mx + 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--append", action="store_true", help="검증 통과 시 라이브러리에 추가")
    args = ap.parse_args()

    seen: set[str] = set()
    all_errs: list[str] = []
    for scene, msgs in PACKS:
        errs = validate(scene, msgs, seen)
        if errs:
            all_errs.append(f"[{scene}] " + "; ".join(errs))

    scenes = {s for s, _ in PACKS}
    print(f"작성한 팩: {len(PACKS)}개 · 장면 {len(scenes)}종 · 문장 {sum(len(x) for _, x in PACKS)}개")
    if all_errs:
        print(f"\n검증 실패 {len(all_errs)}건:")
        for e in all_errs:
            print("  ✗", e)
        return 1
    print("검증 통과 — 인물·닉 매핑, 길이, 금지어, 장면별 플레이스홀더, 중복 전부 이상 없음")

    if not args.append:
        print("\n추가하려면 --append")
        return 0

    idx = next_index(LIBRARY)
    with LIBRARY.open("a", encoding="utf-8") as fh:
        for i, (scene, msgs) in enumerate(PACKS):
            fh.write(json.dumps({
                "scenario_key": scene,
                "messages": msgs,
                "source": SOURCE_TAG,
                "status": "ready",
                "id": f"dialogue-{idx + i:05d}",
            }, ensure_ascii=False) + "\n")
    print(f"라이브러리에 {len(PACKS)}개 추가 (dialogue-{idx:05d} ~ dialogue-{idx + len(PACKS) - 1:05d})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
