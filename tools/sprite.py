"""Gemini 도트 이미지 후처리: 마젠타 배경·워터마크 제거 → 도트 격자 복원 → 원래 도트 크기 PNG.

사용: python3 tools/sprite.py 입력.png 출력.png [--grid 100] [--keep-watermark]
- Gemini는 512×512 이미지에 약 100×100 도트 격자로 그린다(도트 1개 ≈ 5.12px). --grid로 격자 수를 바꿀 수 있다.
- 배경은 단색 마젠타 #FF00FF로 생성하게 한다(ART_PROMPTS.md). 마젠타 계열 픽셀은 투명이 된다.
- 오른쪽 아래 Gemini 반짝이 워터마크 영역은 기본으로 지운다(캐릭터가 그 자리에 걸치면 --keep-watermark).
- 결과는 캐릭터 둘레에 맞게 잘린 원래 도트 크기 이미지(예: 전신 ≈ 37×90). 화면에서는 image-rendering: pixelated로 키운다.
"""
import argparse
from collections import Counter

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("out")
ap.add_argument("--grid", type=int, default=100, help="이미지 한 변의 도트 수")
ap.add_argument("--keep-watermark", action="store_true")
args = ap.parse_args()

img = Image.open(args.src).convert("RGB")
a = np.array(img).astype(int)
H, W = a.shape[:2]
R, G, B = a[..., 0], a[..., 1], a[..., 2]
bg = (R > 180) & (B > 180) & (G < 140) & (abs(R - B) < 50)  # 마젠타 키
if not args.keep_watermark:
    bg[int(H * 0.82):, int(W * 0.76):] = True  # Gemini 워터마크 모서리

block = W / args.grid
gw, gh = args.grid, round(H / block)
out = np.zeros((gh, gw, 4), dtype=np.uint8)
for gy in range(gh):
    for gx in range(gw):
        y0, y1 = int(gy * block), max(int(gy * block) + 1, int((gy + 1) * block))
        x0, x1 = int(gx * block), max(int(gx * block) + 1, int((gx + 1) * block))
        # 경계 번짐을 피하려고 블록 가운데만 본다
        m = max(1, int(block * 0.25))
        ys, xs = slice(min(y0 + m, y1 - 1), max(y1 - m, y0 + 1)), slice(min(x0 + m, x1 - 1), max(x1 - m, x0 + 1))
        if bg[ys, xs].mean() > 0.5:
            continue
        cells = [tuple(c) for c, b in zip(a[ys, xs].reshape(-1, 3), bg[ys, xs].reshape(-1)) if not b]
        r, g, b = Counter(cells).most_common(1)[0][0]
        out[gy, gx] = (r, g, b, 255)

ys, xs = np.where(out[..., 3] > 0)
if len(ys) == 0:
    raise SystemExit("캐릭터 픽셀을 찾지 못했다 — 배경이 마젠타인지 확인")
res = Image.fromarray(out, "RGBA").crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
res.save(args.out)
print(f"{args.out}: {res.size[0]}x{res.size[1]} (도트 {block:.2f}px)")
