#!/usr/bin/env python3
"""Materialize the safe dialogue library from reviewed, scenario-bound lines."""

from __future__ import annotations

import argparse
import itertools
import json
import random
from pathlib import Path

from generate_dialogue_library import AGENTS, SCENARIOS, normalize, validate


# Each stage has two interchangeable lines. The builder also varies which safe
# stages appear, so a scene can open mid-conversation or end without a neat recap.
PATTERNS = (
    (0, 1, 2, 3),
    (0, 1, 2),
    (0, 1, 3),
    (1, 2, 3),
    (1, 2),
    (1, 3),
)

# Short beats can sit between two factual lines or leave a scene slightly open.
# They are deliberately generic and contain no market claim of their own.
REACTION_BEATS = (
    ("madam", "판이 커 보여도 확인된 것만 들고 가는 게 맞아."),
    ("andy", "한 종목만 보지 말고 시장 폭도 같이 볼게."),
    ("justin", "단일 관측보다 다음 표본이 같은 방향인지 보겠습니다."),
    ("watcher", "아, 그러면 얘기가 좀 다르네."),
    ("watcher", "그건 따로 봐야 하는구나."),
    ("watcher", "생각보다 볼 게 하나 더 있네."),
    ("spot_sister", "응, 그 정도 선에서 보는 게 맞겠네."),
    ("spot_sister", "결론부터 붙이지는 말자."),
    ("spot_sister", "나도 일단 한 번 더 볼래."),
    ("degen", "화면은 화려한데 결론은 아직이네."),
    ("degen", "오, 장면은 큰데 해석은 천천히 가자고."),
    ("wolf", "결국 다음 체결이 답하겠네."),
    ("wolf", "한 번 더 찍히는지 보면 알겠지."),
    ("funding_bear", "한 수치로 결론 내리기엔 아직 이르지."),
    ("funding_bear", "다음 값도 같은 방향인지 봐야 해."),
    ("chart_doryeong", "아직은 열린 장면이야."),
    ("chart_doryeong", "가격이 답을 주기 전엔 선을 긋지 말자."),
    ("hermit", "조금 더 쌓이면 흐름이 보이겠지."),
    ("hermit", "한 번 더 확인하고 얘기하자."),
)


BANKS: dict[str, tuple[tuple[tuple[str, str], ...], ...]] = {
    "quiet_range": (
        (("watcher", "오늘은 라운지가 조용하네. 시장도 쉬어 가는 분위기야?"), ("watcher", "움직임이 잔잔한데 지금 확인할 만한 건 뭐야?")),
        (("chart_doryeong", "변동성과 거래량이 함께 낮아서 아직 방향을 읽을 근거가 적어."), ("chart_doryeong", "지금은 가격보다 거래량이 다시 붙는지를 먼저 볼 구간이야.")),
        (("spot_sister", "조용할수록 작은 움직임을 큰 신호처럼 받아들이지 않는 게 좋아."), ("spot_sister", "확인할 흐름이 생길 때까지 해석을 늘리지 않아도 되겠네.")),
        (("watcher", "좋아, 억지로 의미를 붙이지 말고 변화부터 기다려 보자."), ("watcher", "그럼 거래량과 변동성이 깨어나는지부터 볼게.")),
    ),
    "near_day_high": (
        (("watcher", "오늘 고가가 가까운데 이번에는 뭐를 같이 봐야 해?"), ("watcher", "고가까지 얼마 안 남았네. 바로 의미를 둬도 될까?")),
        (("chart_doryeong", "고가까지 {high_gap_pct} 남았지만 아직 갱신 전이라는 점이 먼저야."), ("chart_doryeong", "거리는 {high_gap_pct}지만 실제 고가 갱신 여부는 아직 열려 있어.")),
        (("wolf", "가까이 갔다는 사실보다 그 자리에서 체결이 이어지는지가 중요해."), ("wolf", "호가가 보이는 것과 실제 거래가 통과하는 건 다른 얘기야.")),
        (("spot_sister", "그럼 고가 갱신과 뒤따르는 거래량을 함께 확인하면 되겠네."), ("spot_sister", "서두르지 말고 가격과 체결이 같이 움직이는지 보자.")),
    ),
    "near_day_low": (
        (("watcher", "오늘 저가가 가까워졌네. 어디부터 확인하면 될까?"), ("watcher", "저가 근처라고 바로 약하다고 봐도 되는 건 아니지?")),
        (("chart_doryeong", "저가까지 {low_gap_pct} 남았고 아직 실제 이탈은 나오지 않았어."), ("chart_doryeong", "거리는 {low_gap_pct}지만 저가 이탈 여부는 따로 확인해야 해.")),
        (("wolf", "보이는 잔량보다 저가 부근 체결이 계속 밀리는지를 보자."), ("wolf", "호가가 버텨 보여도 실제 체결 흐름은 달라질 수 있어.")),
        (("spot_sister", "저가 이탈과 거래량이 함께 나오는지까지 기다려 보면 되겠네."), ("spot_sister", "가격 하나만 보지 말고 체결과 거래량을 같이 확인하자.")),
    ),
    "volume_burst": (
        (("watcher", "갑자기 거래가 많아졌네. 이건 바로 방향 신호야?"), ("watcher", "거래량이 튀었는데 먼저 뭘 확인해야 해?")),
        (("wolf", "거래량은 평소의 {volume_ratio} 수준이지만 방향은 가격 반응을 더 봐야 해."), ("wolf", "평소 대비 {volume_ratio} 거래됐어. 이제 체결이 어느 쪽으로 이어지는지가 핵심이야.")),
        (("degen", "불꽃은 터졌지만 한 번의 폭발만으로 다음 장면을 정하긴 이르지."), ("degen", "소리는 큰데 지속되는 거래인지 한 번 휩쓴 건지는 아직 몰라.")),
        (("spot_sister", "그럼 거래량 유지 여부와 가격 반응을 함께 확인해 보자."), ("spot_sister", "첫 반응보다 다음 구간에서도 거래가 이어지는지 보겠어.")),
    ),
    "long_liquidation": (
        (("watcher", "어, 방금 청산 크게 떴는데 어느 쪽이야?"), ("watcher", "청산이 한꺼번에 몰렸네. 뭐가 터진 거야?")),
        (("degen", "롱 쪽이야. 방금 {liquidation_usd} 터졌어."), ("degen", "이번엔 롱 청산 {liquidation_usd}. 꽤 세게 왔네.")),
        (("funding_bear", "금액은 큰데 이걸 바로 바닥 신호로 보면 안 돼."), ("funding_bear", "크긴 크다. 그래도 청산이 끝났는지는 아직 몰라.")),
        (("wolf", "응. 그 뒤에도 매도가 계속 찍히는지가 중요하지."), ("wolf", "이제 후속 체결이 더 밀리는지만 보면 돼.")),
    ),
    "short_liquidation": (
        (("watcher", "위로 튀면서 청산 떴네. 이번엔 숏 쪽이야?"), ("watcher", "방금 위로 확 움직였는데 뭐가 터진 거야?")),
        (("degen", "응, 숏 청산 {liquidation_usd}. 위쪽이 한 번에 쓸렸어."), ("degen", "숏 쪽이야. {liquidation_usd} 강제로 정리됐네.")),
        (("funding_bear", "그래도 이게 새 수요인지 청산 반응인지는 나눠 봐야 해."), ("funding_bear", "숏이 터졌다고 상승이 계속된다는 뜻은 아니야.")),
        (("wolf", "맞아. 청산 뒤에도 일반 체결이 따라붙는지 봐야지."), ("wolf", "다음 체결이 비면 청산만 휩쓸고 끝난 걸 수도 있어.")),
    ),
    "funding_positive": (
        (("watcher", "펀딩 또 양수네. 좀 붐비는 건가?"), ("watcher", "롱 쪽 비용이 붙었네. 벌써 과열이야?")),
        (("funding_bear", "지금 {funding_pct}. 붐비긴 해도 아직 한 장면이야."), ("funding_bear", "{funding_pct}야. 이전보다 더 벌어지는지는 봐야지.")),
        (("degen", "열기는 있네. 그렇다고 바로 터진다는 얘기는 아니고."), ("degen", "숫자는 뜨거운데 파티 종료 방송은 아직이네.")),
        (("spot_sister", "느낌 말고 다음 펀딩이 더 벌어지는지만 보자."), ("spot_sister", "현물도 같이 따라오는지 보면 좀 더 선명하겠네.")),
    ),
    "funding_negative": (
        (("watcher", "펀딩이 음수면 숏이 많이 몰렸다는 뜻이야?"), ("watcher", "이번에는 숏 쪽이 비용을 내는 상태네. 어떻게 봐야 해?")),
        (("funding_bear", "현재 {funding_pct}지만 한 번의 음수만으로 쏠림을 확정할 순 없어."), ("funding_bear", "펀딩은 {funding_pct}야. 지속 시간과 가격 반응이 더 필요해.")),
        (("degen", "숏이 붐빈 흔적일 수는 있어도 바로 뒤집힌다는 뜻은 아니지."), ("degen", "한쪽으로 기울어 보여도 청산 불꽃은 아직 확인 전이야.")),
        (("spot_sister", "다음 펀딩과 실제 가격 움직임이 같이 바뀌는지 보자."), ("spot_sister", "수치 하나보다 음수 상태가 이어지는지부터 확인하겠어.")),
    ),
    "oi_price_up": (
        (("watcher", "가격과 미결제약정이 같이 늘었네. 참여가 커진 거야?"), ("watcher", "위로 움직이면서 계약도 늘었는데 어떤 점을 봐야 해?")),
        (("funding_bear", "가격 {price_change_pct}, 미결제약정 {oi_change_pct}로 새 레버리지가 붙은 상태야."), ("funding_bear", "가격과 미결제약정이 각각 {price_change_pct}, {oi_change_pct} 변했어.")),
        (("wolf", "참여가 늘어난 건 맞지만 어느 쪽이 끝까지 버틸지는 체결이 말해 줘."), ("wolf", "계약 증가 자체보다 가격을 따라오는 실제 체결을 확인해야 해.")),
        (("spot_sister", "그럼 펀딩과 청산 흐름까지 붙여서 과열 여부를 보자."), ("spot_sister", "레버리지 증가가 이어지는지와 현물 반응을 같이 확인하겠어.")),
    ),
    "oi_price_down": (
        (("watcher", "가격은 밀리는데 미결제약정은 늘었어. 무슨 장면이야?"), ("watcher", "내려가는 동안 계약이 늘었는데 쏠림을 알 수 있어?")),
        (("funding_bear", "가격 {price_change_pct}, 미결제약정 {oi_change_pct}로 하락 중 레버리지가 늘었어."), ("funding_bear", "가격과 미결제약정 변화는 {price_change_pct}, {oi_change_pct}야.")),
        (("degen", "새 포지션이 붙은 건 보여도 어느 쪽이 덫인지는 아직 몰라."), ("degen", "긴장감은 커졌지만 이 숫자만으로 승자를 정할 순 없지.")),
        (("wolf", "후속 체결과 청산이 어느 방향에서 나오는지 확인하자."), ("wolf", "이제 체결이 더 밀리는지 흡수되는지가 다음 단서야.")),
    ),
    "bid_heavy": (
        (("watcher", "아래쪽 매수벽 꽤 두꺼운데, 이거 믿어도 돼?"), ("watcher", "매수 잔량이 많네. 아래가 좀 단단한 건가?")),
        (("wolf", "매수 쪽이 {book_imbalance} 우세하긴 해. 근데 주문은 지우면 끝이야."), ("wolf", "지금은 {book_imbalance} 우세. 걸어둔 거랑 실제로 사는 건 다르지.")),
        (("chart_doryeong", "맞아. 저 벽 앞에서 가격이 어떻게 반응하는지가 먼저야."), ("chart_doryeong", "호가 모양보다 실제 체결이 버티는지를 봐야 해.")),
        (("spot_sister", "결국 보이는 벽보다 체결된 결과가 중요하네."), ("spot_sister", "주문이 남아 있고 실제 거래로 이어지는지 보겠어.")),
    ),
    "ask_heavy": (
        (("watcher", "위에 매도벽 꽤 두껍다. 여기서 막히는 거야?"), ("watcher", "매도 잔량이 확 많아졌네. 바로 저항인 건가?")),
        (("wolf", "매도 쪽이 {book_imbalance} 우세해. 그래도 저 주문 지워지면 끝이야."), ("wolf", "지금은 {book_imbalance} 우세. 보이는 주문만 믿지는 마.")),
        (("chart_doryeong", "근데 저거 지워지면 아무 의미 없어. 실제 체결을 봐야지."), ("chart_doryeong", "벽이 큰 것보다 가격이 진짜 통과하는지가 중요해.")),
        (("spot_sister", "호가창은 볼 때마다 사람 헷갈리게 하네."), ("spot_sister", "그럼 걸어둔 잔량 말고 체결된 결과를 볼게.")),
    ),
    "spread_wide": (
        (("watcher", "매수와 매도 가격 사이가 벌어졌는데 무슨 뜻이야?"), ("watcher", "호가 간격이 평소보다 넓어 보이는데 조심할 점이 있어?")),
        (("wolf", "현재 스프레드는 {spread_usdt}야. 짧은 순간 체결 비용이 커질 수 있어."), ("wolf", "최우선 호가 간격이 {spread_usdt}라 체결 가격이 흔들릴 여지가 있어.")),
        (("degen", "화면은 조용해도 얇은 호가에서는 작은 주문도 크게 보일 수 있지."), ("degen", "간격이 넓을 때 보이는 급한 움직임은 과장될 수도 있어.")),
        (("spot_sister", "스프레드가 다시 좁아지는지부터 확인해 보자."), ("spot_sister", "유동성이 돌아오는지 보고 움직임의 의미를 판단하겠어.")),
    ),
    "fear_extreme": (
        (("watcher", "공포 지수가 많이 낮아졌네. 모두 겁먹은 상태야?"), ("watcher", "극단적 공포 표시는 어떻게 받아들이면 돼?")),
        (("spot_sister", "현재 지수는 {fear_greed}지만 심리 지표만으로 바닥을 정할 순 없어."), ("spot_sister", "{fear_greed}는 위축된 심리를 보여 줄 뿐 가격 반전을 뜻하진 않아.")),
        (("hermit", "심리와 실제 네트워크 활동이 같이 변하는지 천천히 보자."), ("hermit", "사람들의 공포가 데이터 흐름에도 남는지는 별도로 확인해야 해.")),
        (("chart_doryeong", "가격 구조가 달라지기 전에는 지표를 배경 정보로 두는 게 좋아."), ("chart_doryeong", "공포 수치와 실제 가격 반응이 만나는 지점을 기다려 보자.")),
    ),
    "greed_extreme": (
        (("watcher", "탐욕 지수가 높은데 시장이 너무 들뜬 걸까?"), ("watcher", "극단적 탐욕이면 바로 과열 신호로 보면 돼?")),
        (("spot_sister", "현재 지수 {fear_greed}는 낙관 심리를 보여 주지만 시점 신호는 아니야."), ("spot_sister", "{fear_greed}만으로 상승의 끝을 정할 수는 없어.")),
        (("funding_bear", "펀딩과 미결제약정까지 함께 뜨거워지는지 확인해야 해."), ("funding_bear", "심리와 실제 레버리지 쏠림이 같은 방향인지 보자.")),
        (("degen", "파티가 붐빈다는 것과 당장 불이 꺼진다는 건 다른 얘기지."), ("degen", "분위기는 뜨겁지만 종료 방송은 아직 아무도 안 했어.")),
    ),
    "mempool_busy": (
        (("watcher", "멤풀 또 붐비네. 이거 가격에도 바로 영향 있나?"), ("watcher", "대기 거래가 확 늘었네. 무슨 일이지?")),
        (("hermit", "바로 연결하긴 좀 그래. 지금 확인되는 건 수수료 {fee_rate}까지 올라온 거야."), ("hermit", "수수료가 {fee_rate}야. 네트워크 사용이 몰린 건 맞아.")),
        (("spot_sister", "응, 혼잡이랑 가격 방향은 따로 보는 게 좋아."), ("spot_sister", "전송 급한 사람은 답답하겠네. 그래도 가격 원인은 아니야.")),
        (("watcher", "그럼 블록 몇 개 더 지나고 줄어드는지 볼게."), ("watcher", "오케이. 가격 얘기부터 붙이지는 말자.")),
    ),
    "block_settled": (
        (("watcher", "블록 확정 알림은 정확히 무엇이 처리됐다는 뜻이야?"), ("watcher", "새 블록이 잡히면 멤풀 거래들이 바로 줄어드는 거야?")),
        (("hermit", "블록 {block_height}이 확정돼 포함된 거래들이 기록된 상태야."), ("hermit", "현재 확정 블록은 {block_height}이고 선택된 대기 거래가 처리됐어.")),
        (("spot_sister", "한 블록이 처리돼도 혼잡 전체가 끝났다고 볼 수는 없어."), ("spot_sister", "다음 블록과 남은 대기 거래량을 함께 확인해야 해.")),
        (("watcher", "알겠어. 공지 하나보다 이어지는 처리 흐름을 볼게."), ("watcher", "그럼 다음 블록에서도 대기열이 줄어드는지 확인하자.")),
    ),
    "calm_after_shock": (
        (("watcher", "큰 움직임 뒤에 갑자기 조용해졌네. 끝난 걸까?"), ("watcher", "청산이 지나가고 잠잠한데 이제 안정된 거야?")),
        (("degen", "폭발이 멈춘 것과 변동성이 끝난 건 같은 말이 아니야."), ("degen", "불꽃은 잦아들었지만 레버리지 정리가 끝났는지는 더 봐야지.")),
        (("wolf", "체결 속도와 호가 간격이 정상으로 돌아오는지 확인하자."), ("wolf", "후속 체결이 비는지 다시 몰리는지가 다음 장면을 알려 줘.")),
        (("spot_sister", "가격보다 유동성과 청산 흐름이 안정되는지를 먼저 보겠어."), ("spot_sister", "잠깐의 정적을 결론으로 삼지 말고 데이터 회복을 기다리자.")),
    ),
    "btc_dominance_up": (
        (("watcher", "비트코인 도미넌스가 올랐는데 알트가 약해진 거야?"), ("watcher", "도미넌스 상승은 시장 자금이 비트코인으로 간다는 뜻이야?")),
        (("spot_sister", "이전 관측보다 {dominance_change_pct} 변했지만 원인은 다른 지표와 함께 봐야 해."), ("spot_sister", "도미넌스 변화는 {dominance_change_pct}야. 비트코인과 알트 가격을 같이 보자.")),
        (("degen", "비중이 움직였다는 것과 모든 알트가 같은 방향이라는 건 다르지."), ("degen", "알트 전체에 한 장짜리 판정을 내리기엔 종목별 차이가 커.")),
        (("chart_doryeong", "비트코인 상대 강도와 알트 시장 폭을 함께 확인하면 돼."), ("chart_doryeong", "도미넌스 단독보다 양쪽 가격 구조를 나란히 보자.")),
    ),
}


def build(target: int, seed: int) -> list[dict]:
    scenarios = {scenario.key: scenario for scenario in SCENARIOS}
    missing = set(BANKS) - set(scenarios)
    if missing:
        raise ValueError(f"unknown scenarios: {sorted(missing)}")

    candidates_by_scenario: dict[str, list[dict]] = {key: [] for key in BANKS}
    signatures: set[str] = set()
    base_signatures: set[str] = set()
    for key, stages in BANKS.items():
        scenario = scenarios[key]
        for choices in itertools.product(*stages):
            for pattern in PATTERNS:
                raw = {
                    "messages": [
                        {"agent_key": choices[index][0], "body": choices[index][1]}
                        for index in pattern
                    ]
                }
                valid, reason = validate(raw, scenario, [])
                if not valid:
                    raise ValueError(f"invalid reviewed line bank {key}: {reason}")
                signature = normalize(" ".join(item["body"] for item in valid["messages"]))
                if signature in base_signatures:
                    continue
                base_signatures.add(signature)
                variants = [valid]
                for beat_key, beat_body in REACTION_BEATS:
                    if beat_key not in scenario.agents:
                        continue
                    beat = {"agent_key": beat_key, "body": beat_body}
                    messages = valid["messages"]
                    if (
                        beat_key != messages[0]["agent_key"]
                        and beat_key != messages[1]["agent_key"]
                    ):
                        inserted, inserted_reason = validate(
                            {"messages": [messages[0], beat, *messages[1:]]}, scenario, []
                        )
                        if inserted and not inserted_reason:
                            variants.append(inserted)
                    if beat_key != messages[-1]["agent_key"]:
                        appended, appended_reason = validate(
                            {"messages": [*messages, beat]}, scenario, []
                        )
                        if appended and not appended_reason:
                            variants.append(appended)

                for variant in variants:
                    variant_signature = normalize(
                        " ".join(item["body"] for item in variant["messages"])
                    )
                    if variant_signature in signatures:
                        continue
                    signatures.add(variant_signature)
                    variant["source"] = "reviewed-human-combination"
                    variant["status"] = "ready"
                    candidates_by_scenario[key].append(variant)

    available = sum(len(rows) for rows in candidates_by_scenario.values())
    if target > available:
        raise ValueError(f"target {target} exceeds {available} unique reviewed combinations")
    rng = random.Random(seed)
    base, remainder = divmod(target, len(candidates_by_scenario))
    selected: list[dict] = []
    leftovers: list[dict] = []
    for index, rows in enumerate(candidates_by_scenario.values()):
        quota = base + (1 if index < remainder else 0)
        watcher_open = [row for row in rows if row["messages"][0]["agent_key"] == "watcher"]
        direct_open = [row for row in rows if row["messages"][0]["agent_key"] != "watcher"]
        rng.shuffle(watcher_open)
        rng.shuffle(direct_open)
        direct_quota = quota // 2
        chosen = direct_open[:direct_quota] + watcher_open[: quota - direct_quota]
        selected.extend(chosen)
        chosen_ids = {id(row) for row in chosen}
        leftovers.extend(row for row in rows if id(row) not in chosen_ids)
    if len(selected) < target:
        rng.shuffle(leftovers)
        selected.extend(leftovers[: target - len(selected)])
    if len(selected) != target:
        raise ValueError(f"could only select {len(selected)} of {target} dialogue packs")
    rng.shuffle(selected)
    for index, row in enumerate(selected, start=1):
        row["id"] = f"dialogue-{index:05d}"
    return selected


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=300)
    parser.add_argument("--seed", type=int, default=20260822)
    parser.add_argument("--output", type=Path, default=Path("data/ai_dialogue_library.jsonl"))
    args = parser.parse_args()
    rows = build(args.target, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )
    print(f"wrote {len(rows)} reviewed dialogue packs to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
