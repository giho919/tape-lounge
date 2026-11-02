#!/usr/bin/env python3
"""Create localized social preview cards for the public lounge home."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


# Bump when the composition or copy changes so social-preview caches refresh.
VERSION = "20261103"
W, H = 1200, 630
BG_TOP = (10, 13, 18)
BG_BOTTOM = (17, 20, 25)
GOLD = (218, 181, 77)
WHITE = (242, 239, 231)
MUTED = (151, 157, 165)
GREEN = (69, 207, 151)
RED = (222, 108, 120)

COPY = {
    "ko": {
        "eyebrow": "TODAY'S ROUND · SAME CHART",
        "headline": ["모두 같은 차트,", "판단은 다르게."],
        "subhead": ["오늘은 모두가 같은 미국 주식 판.", "200거래일 매매 후 보유와 비교해요."],
        "cta": "오늘 판에 도전하기  ↗",
        "note": "실제 과거 차트 · 가상 자금 · 실제 주문 없음",
        "hidden": "종목명 숨김",
        "date": "날짜 숨김",
        "panel": "한 판은 같고, 선택은 다르다",
        "foot": "같은 구간 보유 결과와 비교",
        "alt": "종목과 날짜를 숨긴 같은 오늘의 미국 주식 차트에서 모두가 가상 매매를 겨루고 보유 결과와 비교하는 Tape Lounge",
    },
    "en": {
        "eyebrow": "TODAY'S ROUND · SAME CHART",
        "headline": ["One chart today.", "Every call is yours."],
        "subhead": ["Everyone gets the same U.S. stock chart.", "Trade 200 sessions; compare with holding."],
        "cta": "Take today's round  ↗",
        "note": "Historical charts · virtual funds · no real orders",
        "hidden": "TICKER HIDDEN",
        "date": "DATE HIDDEN",
        "panel": "What would you do here?",
        "foot": "Compare with holding over the same period",
        "alt": "Everyone gets the same daily U.S. stock chart with ticker and date hidden, then compares virtual trades with holding on Tape Lounge",
    },
    "zh": {
        "eyebrow": "TODAY'S ROUND · SAME CHART",
        "headline": ["今日同一张图，", "判断各不同。"],
        "subhead": ["今天所有人挑战同一张美股图表。", "交易200个交易日，再与同期持有比较。"],
        "cta": "挑战今日牌局  ↗",
        "note": "历史图表 · 虚拟资金 · 不会真实下单",
        "hidden": "隐藏标的",
        "date": "隐藏日期",
        "panel": "此刻，你会怎么选？",
        "foot": "与同一时段持有结果比较",
        "alt": "所有人挑战同一张隐藏标的和日期的美股图表，完成模拟交易后与同期持有结果比较",
    },
    "ja": {
        "eyebrow": "TODAY'S ROUND · SAME CHART",
        "headline": ["今日は同じ一枚。", "判断で差がつく。"],
        "subhead": ["今日は全員が同じ米国株に挑戦。", "200営業日売買して保有結果と比較。"],
        "cta": "今日の一局に挑戦  ↗",
        "note": "過去チャート · 仮想資金 · 実注文なし",
        "hidden": "銘柄を非表示",
        "date": "日付を非表示",
        "panel": "ここで、どう判断する？",
        "foot": "同じ期間の保有結果と比較",
        "alt": "全員が銘柄と日付を隠した同じ米国株チャートに挑戦し、模擬売買を同期間の保有と比べるTape Lounge",
    },
}


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def draw_card(lang: str, out_dir: Path) -> Path:
    copy = COPY[lang]
    serif = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    sans_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    cjk = Path.home() / ".fonts" / "NotoSansCJKkr-Regular.otf"
    if not cjk.exists():
        cjk = Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")

    image = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(image)
    for y in range(H):
        t = y / (H - 1)
        color = tuple(round(a * (1 - t) + b * t) for a, b in zip(BG_TOP, BG_BOTTOM))
        draw.line((0, y, W, y), fill=color)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((710, 80, 1320, 690), fill=(77, 58, 24, 55))
    image = Image.alpha_composite(image.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(76)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((28, 28, W - 29, H - 29), radius=20, outline=(74, 62, 35, 255), width=2)

    # Brand bar
    draw.rounded_rectangle((67, 48, 106, 87), radius=12, fill=(27, 29, 30, 255), outline=(92, 76, 37, 255), width=1)
    draw.text((77, 53), "t.", font=load_font(serif, 24), fill=GOLD + (255,))
    draw.text((121, 51), "TAPE LOUNGE", font=load_font(serif, 22), fill=GOLD + (255,))
    draw.text((805, 60), copy["eyebrow"], font=load_font(sans_bold, 12), fill=MUTED + (255,))
    draw.line((67, 109, 1133, 109), fill=(67, 58, 40, 255), width=1)

    # Main invitation
    headline_size = 53 if lang != "en" else 42
    draw.text((76, 149), copy["headline"][0], font=load_font(str(cjk) if lang != "en" else sans_bold, headline_size), fill=WHITE + (255,), stroke_width=1 if lang != "en" else 0, stroke_fill=WHITE + (255,))
    draw.text((76, 218), copy["headline"][1], font=load_font(str(cjk) if lang != "en" else sans_bold, headline_size), fill=GOLD + (255,), stroke_width=1 if lang != "en" else 0, stroke_fill=GOLD + (255,))

    body_font = load_font(str(cjk) if lang != "en" else sans, 20 if lang != "en" else 18)
    draw.multiline_text((79, 322), "\n".join(copy["subhead"]), font=body_font, fill=(189, 193, 198, 255), spacing=13)

    # CTA
    draw.rounded_rectangle((76, 463, 521, 522), radius=11, fill=GOLD + (255,))
    cta_font = load_font(str(cjk) if lang != "en" else sans_bold, 20 if lang != "en" else 18)
    draw.text((98, 480), copy["cta"], font=cta_font, fill=(15, 17, 19, 255), stroke_width=0)
    note_font = load_font(str(cjk) if lang != "en" else sans, 14 if lang != "en" else 13)
    draw.text((80, 548), copy["note"], font=note_font, fill=MUTED + (255,))
    draw.text((80, 580), "tapelounge.com", font=load_font(sans, 14), fill=(157, 133, 70, 255))

    # A stylized chart, clearly marked as a blind practice round.
    panel = (612, 137, 1136, 559)
    draw.rounded_rectangle(panel, radius=16, fill=(13, 18, 24, 255), outline=(78, 66, 39, 255), width=1)
    draw.text((642, 160), "??? / USD", font=load_font(sans_bold, 14), fill=GOLD + (255,))
    chip_font = load_font(str(cjk) if lang != "en" else sans, 13 if lang != "en" else 10)
    hidden_x, date_x = (950, 1030) if lang != "en" else (892, 1018)
    draw.text((hidden_x, 163), copy["hidden"], font=chip_font, fill=MUTED + (255,))
    draw.text((date_x, 163), copy["date"], font=chip_font, fill=MUTED + (255,))
    draw.line((640, 195, 1108, 195), fill=(43, 51, 60, 255), width=1)

    left, top, right, bottom = 646, 216, 1104, 430
    grid = (39, 47, 56, 255)
    for i in range(5):
        y = top + i * (bottom - top) // 4
        draw.line((left, y, right, y), fill=grid, width=1)
    for i in range(9):
        x = left + i * (right - left) // 8
        draw.line((x, top, x, bottom), fill=grid, width=1)

    closes = [62, 58, 61, 59, 64, 60, 63, 61, 57, 61, 59, 64, 62, 58, 62, 65, 61, 63, 59, 64, 61, 66, 62, 63]
    low_value, high_value = min(closes) - 7, max(closes) + 7

    def y_for(value: float) -> int:
        return bottom - round((value - low_value) / (high_value - low_value) * (bottom - top))

    step = (right - left - 18) / len(closes)
    ma_points = []
    for i, close in enumerate(closes):
        open_value = closes[i - 1] if i else close - 2
        upper = max(open_value, close) + (2 + i % 3)
        lower = min(open_value, close) - (2 + (i + 1) % 3)
        x = round(left + 9 + i * step)
        candle_color = GREEN if close >= open_value else RED
        y_high, y_low = y_for(upper), y_for(lower)
        y_open, y_close = y_for(open_value), y_for(close)
        draw.line((x, y_high, x, y_low), fill=candle_color + (255,), width=2)
        draw.rectangle((x - 4, min(y_open, y_close), x + 4, max(min(y_open, y_close) + 3, max(y_open, y_close))), fill=candle_color + (255,))
        volume_height = 6 + ((i * 7) % 21)
        draw.rectangle((x - 4, 452 - volume_height, x + 4, 452), fill=candle_color + (100,))
        if i >= 3:
            avg = sum(closes[i - 3:i + 1]) / 4
            ma_points.append((x, y_for(avg) + 24))
    if len(ma_points) > 1:
        draw.line(ma_points, fill=GOLD + (255,), width=2, joint="curve")

    draw.line((640, 470, 1108, 470), fill=(86, 71, 41, 255), width=1)
    question_font = load_font(str(cjk) if lang != "en" else sans_bold, 16 if lang != "en" else 14)
    foot_font = load_font(str(cjk) if lang != "en" else sans, 14 if lang != "en" else 12)
    draw.text((642, 489), copy["panel"], font=question_font, fill=WHITE + (255,))
    draw.text((642, 521), copy["foot"], font=foot_font, fill=MUTED + (255,))

    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"home-og-{lang}-{VERSION}.png"
    image.convert("RGB").save(path, format="PNG", optimize=True)
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    for language in COPY:
        print(draw_card(language, args.output_dir))


if __name__ == "__main__":
    main()
