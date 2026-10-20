"""Gemini 이미지의 도트 격자 수 찾기. sprite.py --grid 에 넣을 값을 고른다.
사용: python3 tools/gridfit.py 이미지.png [최소 최대]   (기본 90~210)

두 가지 점수를 같이 본다.
- 블록 편차: 후보 격자로 나눈 블록 가운데 색 편차 평균(작을수록 맞음)
- 복원 오차: 후보 격자로 줄였다 늘린 그림과 원본의 차이(작을수록 맞음)
2배수(예: 103과 206)가 함께 높게 나오면 대개 작은 쪽이 실제 도트다. 장면은 거의 200.
흐린 이미지는 점수가 뭉개진다 — 후보 몇 개로 sprite.py를 돌려 눈으로 비교하고,
원하는 월드 크기에 맞는 격자를 고른다(굵은 격자로 복원하면 크기가 줄어든다).
"""
import sys
import numpy as np
from PIL import Image

a = np.array(Image.open(sys.argv[1]).convert("RGB")).astype(float)
lo, hi = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (90, 210)
H, W = a.shape[:2]
img = Image.fromarray(a.astype(np.uint8))
rows = []
for g in range(lo, hi + 1):
    b = W / g
    s = []
    for gy in range(2, int(H / b) - 2, 3):
        for gx in range(2, g - 2, 3):
            y0, y1 = int(gy * b + b * 0.2), int((gy + 1) * b - b * 0.2)
            x0, x1 = int(gx * b + b * 0.2), int((gx + 1) * b - b * 0.2)
            if y1 > y0 and x1 > x0:
                s.append(a[y0:y1, x0:x1].std(axis=(0, 1)).sum())
    up = np.array(img.resize((g, round(g * H / W)), Image.NEAREST).resize((W, H), Image.NEAREST)).astype(float)
    rows.append((g, float(np.mean(s)), float(np.abs(up - a).mean())))
by_block = sorted(rows, key=lambda r: r[1])[:5]
by_recon = sorted(rows, key=lambda r: r[2])[:5]
print("블록 편차 상위:", ", ".join(f"{g}({v:.1f})" for g, v, _ in by_block))
print("복원 오차 상위:", ", ".join(f"{g}({v:.2f})" for g, _, v in by_recon))
