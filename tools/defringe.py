"""마젠타 번짐 정리: 투명과 맞닿은 마젠타 낀 픽셀은 3겹까지 투명, 안쪽에 남은 건 주변(마젠타 아닌) 색 중앙값으로.
사용: python3 tools/defringe.py 입력.png 출력.png [--even]   (--even: 짝수 크기로 패딩 — 절반 등록할 때)
"""
import sys
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
a = np.array(Image.open(src).convert("RGBA")).astype(int)
def tint(a): return (a[..., 3] > 0) & (a[..., 0] > a[..., 1] + 40) & (a[..., 2] > a[..., 1] + 40)
cleared = 0
for _ in range(3):
    t = a[..., 3] == 0
    n = np.zeros_like(t); n[1:] |= t[:-1]; n[:-1] |= t[1:]; n[:, 1:] |= t[:, :-1]; n[:, :-1] |= t[:, 1:]
    m = tint(a) & n; cleared += int(m.sum()); a[m] = 0
fixed = 0
ys, xs = np.where(tint(a))
for y, x in zip(ys, xs):
    nb = [a[yy, xx, :3] for yy in range(max(0, y - 1), min(a.shape[0], y + 2)) for xx in range(max(0, x - 1), min(a.shape[1], x + 2))
          if a[yy, xx, 3] and not (a[yy, xx, 0] > a[yy, xx, 1] + 40 and a[yy, xx, 2] > a[yy, xx, 1] + 40)]
    if nb: a[y, x, :3] = np.median(nb, 0); fixed += 1
im = Image.fromarray(a.astype(np.uint8)); im = im.crop(im.getbbox())
if "--even" in sys.argv:
    w, h = im.size; c = Image.new("RGBA", (w + w % 2, h + h % 2)); c.paste(im, (0, 0)); im = c
im.save(out); print(out, im.size, "cleared", cleared, "fixed", fixed, "left", int(tint(np.array(im).astype(int)).sum()))
