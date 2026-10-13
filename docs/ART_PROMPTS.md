# 아트 프롬프트 가이드 (Gemini)

이미지는 Claude가 프롬프트를 만들고 → 사용자가 Gemini에서 생성 → 채팅에 첨부 → Claude가 후처리(`python3 tools/sprite.py`: 마젠타 배경·Gemini 워터마크 제거, 도트 격자 복원) 후 `assets/`에 넣는 방식으로 만든다. 비주얼 작업 전반은 `docs/VISUAL_HANDOFF.md`.

## 공통 규칙

- **배경**: 단색 마젠타 `#FF00FF` (후처리에서 투명으로 제거)
- **해상도**: 512×512 이미지에 **100×100 도트 격자**(도트 1개 ≈ 5.12px)로 생성됨 → 후처리에서 격자를 복원해 원래 도트 크기로 저장 (캐릭터 전신 ≈ 37×90px). 그리드 칸 제약 없음 — 텍스트 게임 UI에 초상/일러스트로 쓴다
- **선/색**: 1px 어두운 외곽선, 안티앨리어싱·블러·그라데이션 없음, 16색 내외
- **팔레트**: 어두운 갈색, 바랜 황토색, 탁한 금색 포인트(`#cf9a44`), 채도 낮은 피부 — 웹 데모 UI 톤과 맞춤
- **시점**: 정면 3/4 (16비트 RPG 스타일), 사실적인 비율(등신 축소 안 함)
- **일관성**: 기준 이미지 `assets/reference/style_reference.png`(001번 A안, 2026-10-13 확정). 모든 요청에 기준 이미지를 첨부하고 "Match the exact art style, outline, palette and pixel scale of the attached reference image." 문장을 앞에 붙인다

## 001 — 스타일 기준 이미지: 모험가 소년

```
Pixel art game sprite of a single character, front-facing 3/4 top-down view, classic 16-bit RPG style.
A 16-year-old village boy who has just become an adventurer in a grim dark-fantasy world: thin, nervous but determined expression, messy brown hair, worn linen tunic and patched trousers, simple leather belt, cloth wraps on his feet. He holds a plain iron short sword in his right hand. No armor, no shield, no cape.
Muted earthy palette of about 16 colors: dark browns, faded ochre, a dull gold accent (#cf9a44), desaturated skin tones.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Drawn as if on a 48x48 pixel grid and scaled up with nearest-neighbor so every pixel is a clean square block.
Full body, centered, idle standing pose, feet visible, small margin around the character.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과: A안 확정 → `assets/reference/style_reference.png`

결과물 파생: 얼굴 초상 `assets/reference/hero_face.png`(= `public/hero-face.png`, 기준 이미지에서 머리~어깨 30×30 잘라냄) — 게임 화면 헤더에 사용
