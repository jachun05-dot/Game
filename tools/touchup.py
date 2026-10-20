"""스프라이트 손질 모음. 한 번에 하나씩 쓴다.
사용:
  python3 tools/touchup.py unpink 입력 출력      반투명 연기·거미줄 등이 마젠타와 섞인 분홍(R≈B, G 낮음)을 회색으로.
                                                  보라 강조색(B가 R보다 큼)은 건드리지 않는다
  python3 tools/touchup.py specks 입력 출력 [N]  N픽셀(기본 4) 미만 떨어진 점 제거 후 다시 자르기
  python3 tools/touchup.py wm 입력 출력 x0 y0 x1 y1
                                                  상자 안의 워터마크(채도 낮은 회색) 픽셀을 주변색 중앙값으로 메움.
                                                  좌표는 복원본 기준, 먼저 확대해서 눈으로 확인할 것
  python3 tools/touchup.py mana 입력 출력        쨍한 청록(마석)을 채도 −30%·명도 −8%로 (희귀 몬스터 공통 보정)
  python3 tools/touchup.py even 입력 출력        짝수 크기로 패딩(art.ts에 절반 크기로 등록할 때)
"""
import colorsys
import sys
from collections import deque
import numpy as np
from PIL import Image

if len(sys.argv) < 4 or sys.argv[1] not in ("unpink", "specks", "wm", "mana", "even"):
    raise SystemExit(__doc__)
cmd, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
a = np.array(Image.open(src).convert("RGBA")).astype(int)
R, G, B, A = (a[..., i] for i in range(4))
H, W = A.shape

if cmd == "unpink":
    m = (A > 0) & (R - G > 25) & (B - G > 25) & (abs(R - B) < 25)
    v = (R + G + B) // 3
    a[m, 0] = v[m] - 4; a[m, 1] = v[m] - 4; a[m, 2] = v[m] + 6
    print("분홍→회색", int(m.sum()))
elif cmd == "specks":
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 4
    seen = np.zeros((H, W), bool); k = 0
    for y in range(H):
        for x in range(W):
            if A[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True; comp = []
                while q:
                    cy, cx = q.popleft(); comp.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < H and 0 <= nx < W and A[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True; q.append((ny, nx))
                if len(comp) < n:
                    for cy, cx in comp: a[cy, cx] = 0
                    k += 1
    print("떨어진 점", k)
elif cmd == "wm":
    x0, y0, x1, y1 = map(int, sys.argv[4:8])
    pts = {(x, y) for y in range(y0, y1) for x in range(x0, x1)
           if A[y, x] and max(a[y, x, :3]) - min(a[y, x, :3]) < 28 and 90 < max(a[y, x, :3]) < 210}
    for x, y in pts:
        nb = [a[yy, xx, :3] for yy in range(y - 2, y + 3) for xx in range(x - 2, x + 3)
              if 0 <= yy < H and 0 <= xx < W and (xx, yy) not in pts and A[yy, xx]]
        if nb: a[y, x, :3] = np.median(nb, axis=0).astype(int)
    print("워터마크 픽셀", sorted(pts))
elif cmd == "mana":
    k = 0
    for y in range(H):
        for x in range(W):
            if not A[y, x]: continue
            h, s, v = colorsys.rgb_to_hsv(*(a[y, x, :3] / 255))
            if 0.40 < h < 0.55 and s > 0.25:
                a[y, x, :3] = [round(c * 255) for c in colorsys.hsv_to_rgb(h, s * 0.7, v * 0.92)]; k += 1
    print("청록 보정", k)

im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
if cmd in ("specks",):
    im = im.crop(im.getbbox())
if cmd == "even":
    w, h = im.size; c = Image.new("RGBA", (w + w % 2, h + h % 2)); c.paste(im, (0, 0)); im = c
im.save(out); print(out, im.size)
