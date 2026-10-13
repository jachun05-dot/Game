"""아이콘 시트를 연결된 픽셀 덩어리로 나눠 위→아래, 왼→오 순서로 이름 붙여 저장(tools/sprite.py로 복원한 뒤 쓴다).
사용: python3 tools/split_sheet.py 시트.png 출력폴더 접두사 이름1,이름2,...  (아주 작은 조각은 가장 가까운 덩어리에 합친다)"""
import sys
from collections import deque
import numpy as np
from PIL import Image
src, out, prefix, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(",")
im = Image.open(src).convert("RGBA"); a = np.array(im); al = a[..., 3] > 0
H, W = al.shape
lab = np.zeros((H, W), int); n = 0
for y in range(H):
    for x in range(W):
        if al[y, x] and not lab[y, x]:
            n += 1; q = deque([(y, x)]); lab[y, x] = n
            while q:
                cy, cx = q.popleft()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and al[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
comps = []
for i in range(1, n + 1):
    ys, xs = np.where(lab == i)
    comps.append(dict(ids=[i], y0=ys.min(), y1=ys.max() + 1, x0=xs.min(), x1=xs.max() + 1, size=len(ys)))
big = [c for c in comps if c["size"] >= 12]
for c in comps:
    if c["size"] >= 12: continue
    cy, cx = (c["y0"] + c["y1"]) / 2, (c["x0"] + c["x1"]) / 2
    t = min(big, key=lambda b: max(b["y0"] - cy, 0, cy - b["y1"]) + max(b["x0"] - cx, 0, cx - b["x1"]))
    t["ids"] += c["ids"]; t["y0"] = min(t["y0"], c["y0"]); t["y1"] = max(t["y1"], c["y1"]); t["x0"] = min(t["x0"], c["x0"]); t["x1"] = max(t["x1"], c["x1"])
# 행으로 묶기: 세로 중심이 가까운 것끼리
big.sort(key=lambda c: (c["y0"] + c["y1"]) / 2)
rows = []
for c in big:
    cy = (c["y0"] + c["y1"]) / 2
    if rows and abs(cy - rows[-1][0]) < 12: rows[-1][1].append(c)
    else: rows.append([cy, [c]])
order = [c for _, r in rows for c in sorted(r, key=lambda c: c["x0"])]
print("pieces", len(order), "expected", len(names))
for name, c in zip(names, order):
    m = np.isin(lab, c["ids"])
    piece = np.zeros_like(a); piece[m] = a[m]
    img = Image.fromarray(piece).crop((c["x0"], c["y0"], c["x1"], c["y1"]))
    img.save(f"{out}/{prefix}{name}.png"); print(name, img.size)
