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

## 002 — 전사 전신 (기준 이미지 첨부)

지급 장비: 장검(`longsword`), 가죽 갑옷(`leather`).

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single character, front-facing 3/4 top-down view, classic 16-bit RPG style.
A 16-year-old boy from the same grim dark-fantasy island village who has just become a warrior: sturdier and broader-shouldered than a village boy but still young, short-cropped dark hair, a stern, stubborn expression with a small scar on the chin. He wears a plain, scuffed brown leather cuirass reinforced with stitched cowhide patches over a faded linen shirt, leather bracers, patched trousers and worn leather boots. He holds a plain iron longsword pointed down in his right hand. No helmet, no shield, no cape, no ornaments.
Muted earthy palette of about 16 colors: dark browns, faded ochre, a dull gold accent (#cf9a44) only on the sword's crossguard, desaturated skin tones.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Same pixel size and character height as the reference: realistic proportions, not chibi.
Full body, centered, idle standing pose, feet visible, small margin around the character.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/reference/warrior.png`(35×86) = `public/warrior.png`, 얼굴 `warrior_face.png`(30×30, 전신 (4,0)에서 자름) = `public/warrior-face.png`. 직업별 그림 연결은 `src/ui/art.ts`의 `CLASS_ART`

## 003 — 마법사 전신 (기준 이미지 첨부)

지급 장비: 참나무 지팡이(`staff`), 수습생 로브(`robe`, "주머니가 많다"). 지팡이 돌은 UI 기술 색 `--violet`(#9a7bc0)과 맞춘다.

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single character, front-facing 3/4 top-down view, classic 16-bit RPG style.
A 16-year-old boy from the same grim dark-fantasy island village who has just become an apprentice mage: slim and pale, shoulder-length messy black hair, tired but sharp eyes with faint dark circles. He wears a simple, frayed apprentice robe of dull dark brown wool with the hood down, sewn with many small mismatched pockets, a rope belt, and worn sandals. He holds a plain straight oak staff in his right hand, its tip bound with a thin metal band holding a small dull violet stone (#9a7bc0). No hat, no glowing effects, no magic particles, no jewelry.
Muted earthy palette of about 16 colors: dark browns, faded ochre, a dull gold accent (#cf9a44) only on the staff's metal band, desaturated skin tones.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Same pixel size and character height as the reference: realistic proportions, not chibi.
Full body, centered, idle standing pose, feet visible, small margin around the character.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/reference/mage.png`(44×86, 지팡이 포함) = `public/mage.png`, 얼굴 `mage_face.png`(30×30, 전신 (3,0)에서 자름) = `public/mage-face.png`. 후처리 후 머리 위 마젠타 번짐 2픽셀을 손으로 지움(보석 보라색은 유지). 주머니보다는 기운 천 조각으로 나왔지만 톤이 맞아 채택

## 004 — 쥐 (기준 이미지 첨부)

몬스터는 모두 기준 이미지와 **같은 도트 크기(월드 스케일)** 로 그린다 → 덩치 차이가 그림 크기로 드러난다. 주인공은 정면, 몬스터는 왼쪽을 본다. 도감(`CodexScreen`)에는 카드 위 무대에 **모든 몬스터를 같은 2배**로 세우고(몬스터마다 배율을 다르게 하면 쥐가 고블린만 해 보인다), 안 본 몬스터는 같은 그림의 실루엣(CSS 필터)으로 보여 준다. 연결은 `src/ui/art.ts`의 `MONSTER_ART`.

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, 3/4 side view facing left, classic 16-bit RPG style, same world scale as the reference boy (this rat is only knee-high to him, so it should be small in the frame).
A filthy dungeon rat from a grim dark-fantasy labyrinth: lean, mangy grey-brown fur with bald patches, long scaly pink-grey tail, small beady dark eyes, yellowed front teeth bared, crouched low ready to bite.
Muted earthy palette of about 12 colors: dark browns, ash grey, desaturated pink only on the ears, tail and nose.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Centered, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/monsters/rat.png`(36×22) = `public/mon-rat.png`

## 005 — 고블린 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, front-facing 3/4 view facing left, classic 16-bit RPG style, same world scale as the reference boy (the goblin stands about chest-high to him).
A cowardly dungeon goblin from a grim dark-fantasy labyrinth: scrawny, hunched, sickly olive-green skin, large pointed ears, sly narrow yellow eyes, crooked grin, wearing a filthy torn loincloth and a scrap of hide over one shoulder. It clutches a short rusty dagger low, half hiding it behind its body, in a sneaky crouching pose as if waiting in ambush.
Muted earthy palette of about 14 colors: dark browns, dull olive green, rust orange on the dagger.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, feet visible, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/monsters/goblin.png`(63×69, 웅크려서 소년 가슴 높이) = `public/mon-goblin.png`. 왼손 손가락 사이 마젠타 3픽셀을 투명 처리

## 006 — 스켈레톤 병사 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, front-facing 3/4 view facing left, classic 16-bit RPG style, same world scale as the reference boy (an adult-sized skeleton, a head taller than him).
A skeleton soldier from a grim dark-fantasy labyrinth: yellowed, cracked old bones, empty dark eye sockets with no glow, remnants of a rotten leather jerkin and a dented rusty iron half-helm. It holds a crude sword carved from a large bone, raised in a stiff guard stance.
Muted earthy palette of about 14 colors: bone ivory and dirty yellow, dark browns, rusty iron grey.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, feet visible, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/monsters/skeleton.png`(62×83) = `public/mon-skeleton.png`. 후처리 수정 없음. 단, 몸 높이가 약 75도트로 소년(90)보다 작게 나왔다(요청은 "한 머리 더 큼"). 다시 뽑으면 "the skeleton's skull is clearly higher than the reference boy's head; fill about 95% of the image height"를 넣는다

## 희귀 개체 공통 규칙

희귀 개체(마석 몬스터)는 기본형 그림을 두 번째로 첨부해 같은 종족으로 변형한다. 마석은 팔레트에서 유일한 차가운 색인 탁한 청록 `#5fb3a8`(2~4단 평면 음영, 번짐·발광 효과 없음)으로 그려 한눈에 "돈 되는 놈"으로 읽히게 한다.

## 007 — 마석 먹은 쥐 (기준 이미지 + 쥐 첨부)

```
Match the exact art style, outline, palette and pixel scale of the first attached reference image. Use the second attached image (a dungeon rat) as the base creature.

Pixel art game sprite of the same dungeon rat species, same size, same 3/4 side view facing left, classic 16-bit RPG style.
This rare rat has swallowed a mana stone: its belly is swollen and translucent, with a cold teal-cyan crystal (#5fb3a8) glowing faintly through the stretched skin, a few small crystal shards poking out of its back fur. Its eyes are wide and frightened, body tensed as if about to flee.
Keep the muted earthy palette of the base rat; the teal crystal is the only cold color. The glow is drawn with 2-3 flat pixel shades only, no soft light, no bloom.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Centered, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 채택 → `assets/monsters/goldrat.png`(36×24) = `public/mon-goldrat.png`. 생성본은 기본 쥐에 수정 몇 개를 붙인 정도라, 배 부분에 청록 3단(코어 #9ee2d4 / #5fb3a8 / 털과 반반 섞은 테두리)을 손으로 칠해 "삼킨 마석이 비치는" 느낌을 보강함(외곽선은 유지)
