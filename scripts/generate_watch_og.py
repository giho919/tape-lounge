#!/usr/bin/env python3
"""Create localized social cards for the public crypto trend radar.

The diagram is illustrative, has no prices or symbols, and is explicitly labeled
as an observation framework rather than live market data or a trading signal.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VERSION = "20261110"
W, H = 1200, 630
BG_TOP = (10, 13, 18)
BG_BOTTOM = (17, 20, 25)
GOLD = (218, 181, 77)
WHITE = (242, 239, 231)
MUTED = (151, 157, 165)
GREEN = (69, 207, 151)
RED = (222, 108, 120)
GRID = (43, 50, 59)

COPY = {
    "ko": {
        "eyebrow": "ANDY'S PUBLIC TREND RADAR",
        "headline": ["돌파보다,", "그 다음을 봅니다."],
        "subhead": ["일봉 전환 · 4시간봉 눌림과 지지", "후보와 관찰 이력을 공개합니다."],
        "panel": "관찰의 흐름",
        "stages": ["전환", "눌림", "지지"],
        "note": "관찰 프레임 예시 · 매수 신호 아님",
        "cta": "공개 관찰 기록  ↗",
    },
    "en": {
        "eyebrow": "ANDY'S PUBLIC TREND RADAR",
        "headline": ["The breakout", "is just step one."],
        "subhead": ["Daily shifts · 4h retests and support", "Public candidates and observation history."],
        "panel": "OBSERVATION FLOW",
        "stages": ["SHIFT", "RETEST", "HOLD"],
        "note": "Illustrative framework · Not a trading signal",
        "cta": "Public observation log  ↗",
    },
    "zh": {
        "eyebrow": "ANDY'S PUBLIC TREND RADAR",
        "headline": ["突破之后，", "才是重点。"],
        "subhead": ["日线趋势转换 · 4小时回踩与支撑", "公开候选与观察记录。"],
        "panel": "观察流程",
        "stages": ["转势", "回踩", "支撑"],
        "note": "观察框架示例 · 非买入信号",
        "cta": "查看公开观察记录  ↗",
    },
    "ja": {
        "eyebrow": "ANDY'S PUBLIC TREND RADAR",
        "headline": ["ブレイクの後を、", "見届ける。"],
        "subhead": ["日足の転換 · 4時間足の押し目と支持", "候補と観察履歴を公開。"],
        "panel": "観察の流れ",
        "stages": ["転換", "押し目", "支持"],
        "note": "観察例 · 売買シグナルではありません",
        "cta": "公開観察ログ  ↗",
    },
}


def font_paths():
    serif = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    cjk = Path.home() / ".fonts" / "NotoSansCJKkr-Regular.otf"
    if not cjk.exists():
        cjk = Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")
    return serif, sans, bold, str(cjk)


def draw_card(lang: str) -> Path:
    copy = COPY[lang]
    serif, sans, bold, cjk = font_paths()
    font = lambda path, size: ImageFont.truetype(path, size)
    image = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(image)
    for y in range(H):
        t = y / (H - 1)
        color = tuple(round(a * (1 - t) + b * t) for a, b in zip(BG_TOP, BG_BOTTOM))
        draw.line((0, y, W, y), fill=color)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((740, 80, 1300, 650), fill=(77, 58, 24, 48))
    image = Image.alpha_composite(image.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(72)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((28, 28, W - 29, H - 29), radius=20, outline=(74, 62, 35, 255), width=2)

    draw.rounded_rectangle((67, 48, 106, 87), radius=12, fill=(27, 29, 30, 255), outline=(92, 76, 37, 255), width=1)
    draw.text((77, 53), "t.", font=font(serif, 24), fill=GOLD + (255,))
    draw.text((121, 51), "TAPE LOUNGE", font=font(serif, 22), fill=GOLD + (255,))
    draw.text((770, 60), copy["eyebrow"], font=font(bold, 12), fill=MUTED + (255,))
    draw.line((67, 109, 1133, 109), fill=(67, 58, 40, 255), width=1)

    is_en = lang == "en"
    title_font = font(bold if is_en else cjk, 49 if not is_en else 43)
    draw.text((76, 164), copy["headline"][0], font=title_font, fill=WHITE + (255,), stroke_width=0 if is_en else 1, stroke_fill=WHITE + (255,))
    draw.text((76, 229), copy["headline"][1], font=title_font, fill=GOLD + (255,), stroke_width=0 if is_en else 1, stroke_fill=GOLD + (255,))
    body_font = font(sans if is_en else cjk, 18 if is_en else 19)
    draw.multiline_text((80, 330), "\n".join(copy["subhead"]), font=body_font, fill=(189, 193, 198, 255), spacing=13)

    draw.rounded_rectangle((76, 455, 498, 515), radius=11, fill=GOLD + (255,))
    cta_font = font(bold if is_en else cjk, 17 if is_en else 19)
    draw.text((97, 474), copy["cta"], font=cta_font, fill=(15, 17, 19, 255))
    note_font = font(sans if is_en else cjk, 12 if is_en else 14)
    draw.text((80, 548), "tapelounge.com/" + lang + "/watch/", font=font(sans, 14), fill=(157, 133, 70, 255))

    panel = (586, 137, 1136, 559)
    draw.rounded_rectangle(panel, radius=16, fill=(13, 18, 24, 255), outline=(78, 66, 39, 255), width=1)
    panel_font = font(bold if is_en else cjk, 15 if is_en else 17)
    draw.text((616, 158), copy["panel"], font=panel_font, fill=GOLD + (255,))
    draw.text((905, 162), "ILLUSTRATIVE", font=font(bold, 10), fill=MUTED + (255,))
    draw.line((616, 193, 1106, 193), fill=(43, 51, 60, 255), width=1)

    left, top, right, bottom = 626, 220, 1096, 424
    for i in range(4):
        y = top + i * (bottom - top) // 3
        draw.line((left, y, right, y), fill=GRID + (255,), width=1)
    for i in range(7):
        x = left + i * (right - left) // 6
        draw.line((x, top, x, bottom), fill=GRID + (255,), width=1)

    points = [(638, 389), (684, 372), (730, 347), (776, 355), (822, 319),
              (868, 278), (914, 296), (960, 334), (1006, 343), (1052, 315), (1082, 288)]
    support_y = 346
    draw.line((left, support_y, right, support_y), fill=GOLD + (170,), width=2)
    for i in range(len(points) - 1):
        color = RED if i in (6, 7) else GREEN
        draw.line((points[i], points[i + 1]), fill=color + (255,), width=4, joint="curve")
    for index, color in [(4, GOLD), (8, GREEN), (10, GREEN)]:
        x, y = points[index]
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=(13, 18, 24, 255), outline=color + (255,), width=3)
    draw.text((1002, support_y + 8), "RETEST AREA", font=font(bold, 9), fill=GOLD + (220,))

    stage_y = 451
    stage_x = [645, 808, 971]
    for i, (x, label) in enumerate(zip(stage_x, copy["stages"])):
        color = GOLD if i == 0 else GREEN
        draw.ellipse((x, stage_y + 2, x + 10, stage_y + 12), fill=color + (255,))
        draw.text((x + 18, stage_y - 2), label, font=font(bold if is_en else cjk, 14 if is_en else 15), fill=WHITE + (255,))
        if i < 2:
            draw.line((x + 90, stage_y + 7, x + 145, stage_y + 7), fill=(94, 84, 59, 255), width=2)
    draw.line((616, 486, 1106, 486), fill=(86, 71, 41, 255), width=1)
    draw.text((617, 505), copy["note"], font=note_font, fill=MUTED + (255,))

    path = ROOT / f"watch-og-{lang}-{VERSION}.png"
    image.convert("RGB").save(path, format="PNG", optimize=True)
    return path


def main() -> None:
    paths = [draw_card(lang) for lang in COPY]
    print("Generated:", ", ".join(path.name for path in paths))


if __name__ == "__main__":
    main()
