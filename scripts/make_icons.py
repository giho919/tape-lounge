# -*- coding: utf-8 -*-
"""Tape Lounge 아이콘 생성기 — favicon / apple-touch-icon / OG 이미지.

실크햇 마크: 위가 넓은 사다리꼴 크라운 + 넓고 얇은 챙, 13° 기울임.
  · 사다리꼴 = 직사각형 크라운이 주던 형태 오해를 없앤다
  · 기울기   = 좌우대칭을 깨고 16px 에서도 '모자'로 읽히게 한다
이모지 폰트에 의존하지 않으므로 렌더링 환경을 타지 않는다.

실행: python scripts/make_icons.py   (저장소 루트에 파일 생성)
아이콘을 수정하면 반드시 16px 렌더를 눈으로 확인할 것.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG   = (10, 12, 16, 255)      # --bg   #0a0c10
GOLD = (212, 175, 55, 255)    # --gold #d4af37
DIM  = (122, 128, 140, 255)
TILT = 13                     # 기울기(도)

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
KR    = str(Path.home() / ".fonts" / "NotoSansCJKkr-Regular.otf")


def _hat(d, cx, cy, S, col=GOLD):
    """크라운(사다리꼴) + 챙. cy 는 크라운 밑변 기준선."""
    ch   = S * 0.42          # 크라운 높이
    tw   = S * 0.34          # 크라운 윗변
    bw   = S * 0.285         # 크라운 아랫변 (윗변보다 좁게 → 사다리꼴)
    top  = cy - ch
    d.polygon([(cx - tw/2, top), (cx + tw/2, top),
               (cx + bw/2, cy),  (cx - bw/2, cy)], fill=col)
    d.rounded_rectangle([cx - tw/2, top - S*0.018, cx + tw/2, top + S*0.02],
                        radius=S*0.018, fill=col)
    brim_w, brim_h = S * 0.76, S * 0.092
    d.rounded_rectangle([cx - brim_w/2, cy - brim_h*0.30,
                         cx + brim_w/2, cy + brim_h*0.70],
                        radius=brim_h/2, fill=col)


def icon(size, rounded=True):
    """앱 아이콘 한 장. 8배로 그린 뒤 축소해 안티에일리어싱."""
    S = size * 8
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, S-1, S-1], radius=int(S*0.22), fill=BG)
    else:
        d.rectangle([0, 0, S-1, S-1], fill=BG)

    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    _hat(ImageDraw.Draw(layer), S*0.5, S*0.60, S)
    layer = layer.rotate(-TILT, resample=Image.BICUBIC, center=(S*0.5, S*0.60))
    im.alpha_composite(layer)
    return im.resize((size, size), Image.LANCZOS)


def build_icons():
    sizes = [16, 24, 32, 48, 64, 128, 256]
    icon(256).save(ROOT / "favicon.ico", format="ICO", sizes=[(s, s) for s in sizes])
    icon(32).save(ROOT / "favicon-32.png")
    icon(16).save(ROOT / "favicon-16.png")
    icon(512).save(ROOT / "icon-512.png")
    # apple-touch-icon 은 iOS 가 모서리를 깎으므로 배경을 꽉 채운다
    at = Image.new("RGBA", (180, 180), BG)
    h = icon(180, rounded=False)
    at.paste(h, (0, 0), h)
    at.convert("RGB").save(ROOT / "apple-touch-icon.png")


def _tracked(d, text, font, cx, y, track, fill):
    ws = [d.textlength(c, font=font) for c in text]
    x = cx - (sum(ws) + track*(len(text)-1)) / 2
    for c, w in zip(text, ws):
        d.text((x, y), c, font=font, fill=fill)
        x += w + track


def build_og():
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BG[:3])
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([28, 28, W-29, H-29], radius=20, outline=(64, 54, 26), width=2)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    _hat(ImageDraw.Draw(layer), W/2, 300, 330)
    layer = layer.rotate(-TILT, resample=Image.BICUBIC, center=(W/2, 300))
    im.paste(layer, (0, 0), layer)

    _tracked(d, "TAPE LOUNGE", ImageFont.truetype(SERIF, 74), W/2, 352, 14, GOLD)
    f2 = ImageFont.truetype(KR, 27)
    t2 = "실시간 시세 · 선물 데스크 · 온체인 · 블라인드 차트 게임"
    d.text(((W - d.textlength(t2, font=f2))/2, 458), t2, font=f2, fill=DIM)
    f3 = ImageFont.truetype(KR, 23)
    t3 = "tapelounge.com"
    d.text(((W - d.textlength(t3, font=f3))/2, 514), t3, font=f3, fill=(150, 125, 55))
    im.save(ROOT / "og.png")


def build_check_sheet(out):
    """16/32/64px 를 6배 확대한 확인 시트 — 작은 크기 가독성 점검용."""
    sizes, pad = [16, 32, 64], 16
    sheet = Image.new("RGB", (sum(s*6+pad for s in sizes)+pad, 64*6+pad*2), (30, 32, 38))
    x = pad
    for s in sizes:
        big = icon(s).resize((s*6, s*6), Image.NEAREST)
        sheet.paste(big, (x, pad), big)
        x += s*6 + pad
    sheet.save(out)


if __name__ == "__main__":
    build_icons()
    build_og()
    print("생성 완료:", ", ".join(
        f.name for f in [ROOT/"favicon.ico", ROOT/"favicon-32.png", ROOT/"favicon-16.png",
                         ROOT/"apple-touch-icon.png", ROOT/"icon-512.png", ROOT/"og.png"]))
