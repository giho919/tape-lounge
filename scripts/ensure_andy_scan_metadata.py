#!/usr/bin/env python3
"""Keep the generated Andy scan independently indexable when republished."""
from pathlib import Path
import re

REPORT = Path("reports/andy_scan.html")
DESCRIPTION = (
    "Andy의 가상자산 스캔 결과와 추세·돌파·눌림 관찰 목록을 확인하세요. "
    "매매 권유가 아닌 시장 관찰 자료입니다."
)
CANONICAL = "https://tapelounge.com/reports/andy_scan.html"
html = REPORT.read_text(encoding="utf-8")
if not re.search(r'<meta\s+[^>]*name=["\']description["\']', html, re.I):
    tag = f'<meta name="description" content="{DESCRIPTION}">'
    if not re.search(r"</title\s*>", html, re.I):
        raise SystemExit("Andy scan report has no title element")
    html = re.sub(r"(</title\s*>)", lambda m: m.group(1) + tag, html, count=1, flags=re.I)
if not re.search(r'<link\s+[^>]*rel=["\']canonical["\']', html, re.I):
    tag = f'<link rel="canonical" href="{CANONICAL}">'
    html = re.sub(r"(</title\s*>)", lambda m: m.group(1) + tag, html, count=1, flags=re.I)
REPORT.write_text(html, encoding="utf-8")
