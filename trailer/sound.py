# 트레일러 배경음(docs/TRAILER.md): 낮은 울림 + 바람 + 컷마다 타격음 + 심장 소리 + 로고 종소리. 장면 시각은 trailer.html과 같다.
# 실행: python3 trailer/sound.py <출력.wav>
import sys, wave
import numpy as np

SR, DUR = 48000, 30.0
n = int(SR * DUR)
t = np.arange(n) / SR
rng = np.random.default_rng(16)

def env(a, d, s=0.0, length=None):
    """a초에 걸쳐 올라가고 d초 동안 지수 감쇠"""
    L = int(SR * (length or (a + d * 5)))
    x = np.arange(L) / SR
    e = np.where(x < a, x / max(a, 1e-4), np.exp(-(x - a) / d))
    return e

def lowpass(x, k):
    # 간단한 1차 저역 통과(k: 0~1, 작을수록 어둡다)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += k * (x[i] - acc)
        y[i] = acc
    return y

out = np.zeros((n, 2))

def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    j = min(n, i + len(sig))
    if j <= i:
        return
    l, r = gain * (1 - max(0, pan)), gain * (1 + min(0, pan))
    out[i:j, 0] += sig[: j - i] * l
    out[i:j, 1] += sig[: j - i] * r

# 1) 낮은 울림(드론): 전체에 깔리고 몽타주에서 커진다
lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t)
drone = (np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 82.4 * t) * 0.25 + np.sin(2 * np.pi * 110.3 * t) * 0.12) * lfo
shape = np.interp(t, [0, 3, 11, 12, 21, 22, 25.3, 28, 30], [0, 0.5, 0.5, 0.85, 0.85, 0.45, 0.6, 0.5, 0])
out[:, 0] += drone * shape * 0.32
out[:, 1] += np.roll(drone, 240) * shape * 0.32

# 2) 바람(걸러 낸 잡음): 섬·묘지 장면
wind = lowpass(rng.standard_normal(n) * 0.5, 0.02)
wshape = np.interp(t, [0, 1, 5, 5.5, 21.3, 22, 25, 25.5, 30], [0, 0.9, 0.9, 0.2, 0.2, 0.9, 0.9, 0.2, 0.1])
out[:, 0] += wind * wshape * 0.5
out[:, 1] += np.roll(wind, 900) * wshape * 0.5

# 3) 컷 타격음: 낮게 떨어지는 사인 + 짧은 잡음
def boom(f0=90, f1=38, d=0.9, noise=0.35):
    e = env(0.004, d)
    x = np.arange(len(e)) / SR
    f = f1 + (f0 - f1) * np.exp(-x * 6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    nz = lowpass(rng.standard_normal(len(e)), 0.08) * np.exp(-x * 18) * noise
    return (np.sin(ph) + nz) * e

for at in [5.0, 8.3, 21.3]:
    add(boom(), at, 0.55)
for k, at in enumerate([11.3, 13.3, 15.3, 17.3, 19.3]):
    add(boom(110, 40, 0.7, 0.6), at, 0.7, pan=(-0.3 if k % 2 else 0.3))

# 4) 심장 소리: 주인공 장면
for k in range(4):
    at = 8.6 + k * 0.72
    add(boom(70, 45, 0.12, 0.1), at, 0.5)
    add(boom(65, 42, 0.1, 0.1), at + 0.22, 0.35)

# 5) 로고: 큰 울림 + 종소리(배음이 엇나간 종)
add(boom(70, 30, 2.2, 0.5), 25.6, 0.9)
bell_e = env(0.005, 1.6, length=4.5)
bx = np.arange(len(bell_e)) / SR
bell = sum(np.sin(2 * np.pi * 220 * r * bx) * a for r, a in [(1, 0.6), (2.01, 0.3), (2.76, 0.22), (5.4, 0.1), (8.9, 0.05)]) * bell_e
add(bell, 25.65, 0.35, pan=0.1)

# 정리: 끝 페이드, 정규화, 부드러운 클리핑
fade = np.interp(t, [0, 0.4, 29.2, 30], [0, 1, 1, 0])
out *= fade[:, None]
out /= np.max(np.abs(out)) + 1e-9
out = np.tanh(out * 1.2) * 0.85
pcm = (out * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", sys.argv[1])
