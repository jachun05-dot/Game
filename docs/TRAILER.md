# 트레일러(30초, 웹판)

코드로 그린 장면을 프레임마다 캡처해 영상으로 묶는다. 게임의 도트 그림(`public/`)을 그대로 쓴다.

- `trailer/trailer.html` — 장면(`render(t)`가 시각 t의 한 프레임을 그린다. 같은 t면 같은 그림). 브라우저로 열면 미리 재생된다(저장소 최상위를 정적 서버로)
- `trailer/record.mjs` — 900프레임(30fps × 30초)을 JPEG로 저장(playwright 필요)
- `trailer/sound.py` — 배경음(드론·바람·컷 타격음·심장·로고 종소리, numpy)

```sh
python3 -m http.server 4180 --bind 127.0.0.1 &          # 저장소 최상위에서
node trailer/record.mjs /tmp/frames                       # → f00000.jpg …
python3 trailer/sound.py /tmp/sound.wav
ffmpeg -framerate 30 -i /tmp/frames/f%05d.jpg -i /tmp/sound.wav -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest ddd-trailer-30s.mp4
```

| 시각 | 장면 | 자막 |
|---|---|---|
| 0–5.0 | 섬 전경(성 → 미궁 구덩이) | 섬의 영지에는 미궁이 있다. |
| 5.0–8.3 | 관공서 | 매달 세금을 내라. / 못 내면 — 처형이다. |
| 8.3–11.3 | 어둠 속 주인공·횃불 | 미궁은 열여섯 살만 받아들인다. |
| 11.3–21.3 | 1~5섹터 몽타주(2초씩, 보스·몬스터) | 섹터 이름 |
| 21.3–25.3 | 묘지 | 죽는 방식이 다음 삶의 신이 된다. |
| 25.3–30 | 로고 | DDD · 열여섯 살, 미궁으로 · 주소 |

토스판 트레일러가 필요하면 자막(나이·처형)을 토스판 문구로 바꿔 다시 뽑는다.
