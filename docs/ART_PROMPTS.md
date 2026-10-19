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

## 008 — 보석 박힌 고블린 (기준 이미지 + 고블린 첨부)

```
Match the exact art style, outline, palette and pixel scale of the first attached reference image. Use the second attached image (a goblin) as the base creature.

Pixel art game sprite of the same goblin species, same size, same 3/4 view facing left, classic 16-bit RPG style.
This rare goblin has crudely jammed stolen mana stones into its own flesh: several cold teal-cyan crystals (#5fb3a8) embedded in its shoulders, forehead and forearms, with scarred skin around them. Instead of a dagger it holds a heavy wooden club studded with more teal crystals. Greedy, twitchy expression, glancing sideways as if ready to run.
Keep the muted earthy palette of the base goblin; the teal crystals are the only cold color, drawn with 2-3 flat pixel shades, no soft light, no bloom.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, feet visible, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/monsters/jewelgoblin.png`(60×71) = `public/mon-jewelgoblin.png`. 기본 고블린과 같은 자리(손가락 사이) 마젠타 3픽셀만 투명 처리

## 009 — 마석 갑옷 스켈레톤 (기준 이미지 + 스켈레톤 첨부)

```
Match the exact art style, outline, palette and pixel scale of the first attached reference image. Use the second attached image (a skeleton soldier) as the base creature.

Pixel art game sprite of the same skeleton soldier species, 3/4 view facing left, classic 16-bit RPG style. It is an adult-sized skeleton: its skull is clearly higher than the reference boy's head; fill about 95% of the image height.
This rare skeleton wears armor made entirely of rough, faceted mana stone: a chest plate, pauldrons and a helm of cold teal-cyan crystal (#5fb3a8), and it holds a bone sword with crystal shards grown along the blade. Faint teal light inside the empty eye sockets.
Keep the muted earthy bone palette of the base skeleton; the teal crystal is the only cold color, drawn with 3-4 flat pixel shades, no soft light, no bloom.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, feet visible, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 채택 → `assets/monsters/crystalskel.png`(82×92, 소년보다 머리 하나 큼 — "95% 높이" 지시가 먹혔다) = `public/mon-crystalskel.png`. 이번 생성본은 1024×1024(도트 10.24px, 격자는 똑같이 100)였고 `tools/sprite.py`가 그대로 처리했다. 넓은 청록 갑옷이 팔레트에서 튀어 청록 채도 −30%·명도 −8%, 뼈는 기본 스켈레톤 평균색에 맞춰 채널 보정(R×1.09, G×1.11, B×1.22)

## 010 — 거대한 돌연변이 쥐, 1섹터 보스 (기준 이미지 + 쥐 첨부)

```
Match the exact art style, outline, palette and pixel scale of the first attached reference image. Use the second attached image (a small dungeon rat) as the base species.

Pixel art game sprite of a single boss creature, 3/4 side view facing left, classic 16-bit RPG style, same pixel size as the reference. A monstrous mutated rat the size of a calf, so large it fills about 95% of the image width; the reference boy would only reach its shoulder.
Hunched and bloated, patchy grey-brown fur over swollen tumorous lumps, bald scarred skin, a split ear, too many crooked yellow teeth in a jaw that hangs open, small mad red eyes, thick scaly tail curling behind it, claws like hooks. A dull reddish mana stone heart pulses faintly through a tear in its chest.
Muted earthy palette of about 16 colors: dark browns, ash grey, desaturated pink on the skin, dull blood red (#c0564d) only on the eyes and the heart.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/monsters/boss.png`(94×87, 소년과 키가 비슷하고 폭은 두 배 이상) = `public/mon-boss.png`. 꼬리가 워터마크 모서리에 걸쳐 `--keep-watermark`로 처리(워터마크는 마젠타 계열이라 배경과 함께 빠짐), 등 위 마젠타 1픽셀 제거. 가슴 상처의 붉은 마석 심장 = 게임의 "거대 쥐의 마석 심장"(레벨 4 훈련 재료)

## 011 — 편린 등급 아이콘 4종 (기준 이미지 첨부)

한 장에 4개를 가로로 그리게 하고 후처리에서 세로 빈 줄로 나눈다. 색은 UI 등급 색과 1:1.

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game item icons, classic 16-bit RPG style: four small soul-fragment shards arranged in one horizontal row, evenly spaced, same size, each about one fifth of the image width.
A "fragment" is a jagged splinter of a dead monster's essence, like a shard of cloudy glass with a faint inner light. From left to right they rise in rank:
1. a dull, chipped, dusty grey-brown shard (#7d6d52), almost lifeless;
2. a cleaner shard with a faint muted green core (#86a865);
3. a sharp, well-formed shard with a dull gold core (#cf9a44) and a thin gold rim;
4. a large, menacing dark shard with a blood-red core (#c0564d) and tiny cracks, clearly the most powerful.
Each shard drawn with 3-4 flat pixel shades, no soft glow, no bloom, no particles.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Solid flat magenta background (#FF00FF). No ground shadow, no text, no numbers, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/icons/frag-1~4.png`(12×21, 11×24, 12×26, 12×29 — 등급이 오를수록 커진다) = `public/frag-1~4.png`. 캐릭터 시트 편린 목록·도감(1배), 미궁 편린 획득 카드(2배)에 쓴다(`FragIcon`). 처음 보는 편린은 크기로 등급이 새지 않게 늘 하급 모양의 실루엣

## 장소 그림 공통 규칙

배경이 있는 장면이라 마젠타를 쓰지 않는다. Gemini는 장면을 **200격자**로 그려 준다(1024 이미지면 도트 5.12px, 512 이미지면 2.56px). 그래서 `python3 tools/sprite.py 입력 출력 --grid 200 --keep-watermark`로 복원한다(장면에는 마젠타가 없고, 워터마크 모서리를 지우면 구멍이 나므로 남긴다). 복원본 전체는 `assets/scenes/*_full.png`에 보관하고, 가운데를 **179×80 띠**로 잘라 `public/scene-*.png`로 쓴다(워터마크는 잘리는 아래 모서리에 있어 자연히 빠진다). 화면에서는 2배(358×160)로 띠의 배경 이미지로 깔고, 좁은 화면에서는 `focus`(0 왼쪽 ~ 1 오른쪽, 기본 0.5) 쪽을 남기고 잘린다(`SceneBanner`, `SCENE_ART`). 앱 안 폭이 보통 328px이라 2배 띠(358px)의 양옆 15도트쯤이 잘린다는 걸 감안해 핵심이 가장자리에 있으면 focus를 준다. 장면 속 인물은 원경이라 캐릭터 스프라이트의 절반쯤(약 50도트) 크기로 나온다 — 장면끼리만 맞추면 된다. 프롬프트에 "중요한 요소는 가운데 60% 높이 안에"를 넣는다.

## 012 — 훈련장 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game location illustration, classic 16-bit RPG style, wide establishing view of a small scene, slightly elevated 3/4 view.
A grim, poor training yard on a remote island fief in a dark-fantasy world: a muddy fenced yard behind a crude timber hall, battered wooden practice dummies wrapped in straw and rope, a weapon rack with dull wooden swords and a few chipped iron blades, a scarred old veteran instructor with a grey beard and a missing eye standing by the rack with his arms crossed. Overcast grey sky, puddles, a crow on the fence. No other people.
Muted earthy palette of about 20 colors: dark browns, faded ochre, wet grey stone, dull gold accent (#cf9a44) only on small details like a buckle or a lantern.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering. Same pixel size as the reference: the instructor is about the same height as the reference boy.
The composition must read clearly when cropped to a wide horizontal strip through the middle (keep the important elements in the middle 60% of the height).
No text, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택 → `assets/scenes/training_full.png`(200×200) → 띠 `(14,46)~(193,126)` = `public/scene-training.png`(179×80). 훈련 카드(`TrainingPanel`) 맨 위에 건다

## 013 — 술집 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide view of a small interior, slightly elevated 3/4 view.
A cramped, smoky tavern on a remote island fief in a grim dark-fantasy world, where adventurers trade rumors: low timber beams, a long scarred wooden counter with a tired bald barkeep wiping a mug, a few rough tables with hunched patrons in hoods whispering, a notice board crowded with torn paper notices and a wanted poster, a small hearth fire giving dim warm light, candle stubs on the tables.
Muted earthy palette of about 20 colors: dark browns, smoky grey, faded ochre; warm dull gold light (#cf9a44) only from the hearth and candles.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the barkeep, counter and notice board within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No readable text on the notices, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택(512 이미지, 200격자) → `assets/scenes/tavern_full.png` → 띠 `(12,62)~(191,142)` = `public/scene-tavern.png`. 주간 결과 카드(제목 "탐문")에 건다. 결과 카드 제목 → 장면은 `WEEK_SCENE`(훈련 → 훈련장도 같이). 이 이미지에서 `tools/sprite.py`가 도트 3px 이하일 때 빈 칸을 읽는 버그가 드러나 고침(기존 결과는 픽셀 단위로 그대로)

## 014 — 영지 밖 숲 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide establishing view, slightly elevated 3/4 view.
The dark forest just outside a remote island fief in a grim dark-fantasy world: a narrow muddy path leading between twisted bare trees and dense dark undergrowth, moss-covered stones, a broken wooden boundary marker at the edge of the path, thick grey mist between the trunks, and two small glints of eyes watching from the shadows. No people.
Muted earthy palette of about 20 colors: dark browns, deep moss green, cold grey mist; a tiny dull gold accent (#cf9a44) only on the watching eyes.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the path, the boundary marker and the watching eyes within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No text, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 생성본 채택(512, 200격자) → `assets/scenes/forest_full.png` → 띠 `(10,70)~(189,150)` = `public/scene-forest.png`. 주간 결과 카드(제목 "외부 탐험")에 건다

## 015 — 상점가 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide establishing view, slightly elevated 3/4 view.
A narrow, poor market street on a remote island fief in a grim dark-fantasy world: a few crooked timber stalls under patched canvas awnings, one selling hard bread and strips of dried meat, one with small corked potion bottles and rolled paper scrolls, a wary old woman merchant behind the potion stall, muddy cobblestones, hanging lanterns not yet lit, grey overcast sky. One or two cloaked passers-by in the background.
Muted earthy palette of about 20 colors: dark browns, faded ochre, wet grey stone; dull gold (#cf9a44) only on coins and lantern frames, a tiny touch of dull red on the potion bottles.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the stalls and the merchant within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No readable text or signs, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택(512, 200격자) → 띠 `(6,66)~(185,146)` = `public/scene-market.png`. 상점가 카드 위

## 016 — 대장간 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide view, slightly elevated 3/4 view.
A cramped village smithy on a remote island fief in a grim dark-fantasy world: an open-fronted stone and timber workshop, a glowing forge with coals, a heavy anvil, a broad-shouldered blacksmith with a leather apron and soot-covered arms hammering a blade, plain iron swords, shields and leather armor hanging on the back wall, a water barrel, sparks kept to a few single pixels.
Muted earthy palette of about 20 colors: dark browns, soot black, iron grey; warm orange-gold glow (#cf9a44 and a slightly brighter orange) only from the forge and the hot metal.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering, no soft glow.
Keep the forge, anvil and blacksmith within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No text, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택(512, 200격자) → 띠 `(10,56)~(189,136)` = `public/scene-smithy.png`. 대장간 카드 위

## 017 — 신전 (기준 이미지 + 훈련장 첨부)

제단 문양 "달을 삼키는 태양" = 유일신이 짝신을 잡아먹었다는 숨은 설정(DESIGN 2절)의 복선.

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide view of an interior, slightly elevated 3/4 view.
The cold stone temple of the island's single official god in a grim dark-fantasy world: tall grey stone pillars, rows of hard wooden benches, a raised altar under a large stone emblem of a sun swallowing a crescent moon, a gaunt priest in pale grey robes with a heavy offering box at his feet, cold grey light falling from a narrow high window. It should feel austere, rich and quietly threatening rather than welcoming. No crosses or real-world religious symbols.
Muted palette of about 20 colors: cold greys, pale stone, dark browns; dull gold (#cf9a44) only on the sun emblem and the offering box.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the altar, emblem and priest within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No text, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택(512, 200격자) → 문양과 사제가 위아래로 멀어 띠를 **179×110**으로 키움 `(14,24)~(193,134)` = `public/scene-temple.png`. 신전 카드 위

## 018 — 관공서 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide view of an interior, slightly elevated 3/4 view.
The lord's tax office on a remote island fief in a grim dark-fantasy world: a heavy dark wooden desk with an open ledger, a set of brass scales and neat stacks of coins, a thin pale tax clerk in black with a quill, looking down without pity, two armored guards with halberds standing behind him, a tall window with iron bars, and on the stone wall a faded banner bearing the lord's sun emblem. A coiled rope noose hangs from a hook in the shadowed corner, a quiet reminder of what happens to those who cannot pay.
Muted palette of about 20 colors: dark browns, cold grey stone, black; dull gold (#cf9a44) only on the coins, the scales and the sun emblem.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the desk, the clerk and the guards within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No readable text, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택(512, 200격자) → 띠 179×100 `(18,38)~(197,138)` = `public/scene-office.png`, `focus: 0.85`(오른쪽 구석 올가미를 좁은 화면에서도 남긴다). 월말 정산의 세금 카드 위

## 019 — 묘지 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide establishing view, slightly elevated 3/4 view.
A small, crowded graveyard for young adventurers on a remote island fief in a grim dark-fantasy world, on a windy hill under a grey sky: many small crooked wooden grave markers and a few rough stones, far too many of them, some fresh mounds of dirt, a rusty short sword planted in one grave, a worn leather boot left on another, a few wilted wildflowers, a low broken stone wall, a single bare tree, crows. No people.
Muted palette of about 20 colors: dark browns, cold grey, faded grass green; dull gold (#cf9a44) only on a few wildflowers.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the dense rows of grave markers within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No readable text on the markers, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택(512, 200격자) → 띠 `(10,50)~(189,130)` = `public/scene-grave.png`. 묘지 화면 맨 위. 나무 묘표가 십자 모양으로 나왔지만 묘표의 흔한 관습 모양이라 그대로 둠(신전 문양과는 무관)

## 020 — 미궁 1섹터 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game location illustration, classic 16-bit RPG style, wide view, slightly elevated 3/4 view.
The first sector of an ancient underground labyrinth beneath a remote island in a grim dark-fantasy world: a damp stone corridor of huge old blocks opening into a small chamber, a single guttering torch on the wall, rubble and old bones on the floor, a rusty iron gate half open, rat droppings and gnawed scraps, faint scratch marks on the walls left by earlier adventurers counting days, and darkness swallowing the far end of the corridor.
Muted palette of about 20 colors: cold dark grey stone, black, dirty browns; warm dull gold (#cf9a44) light only from the single torch, fading quickly into the dark.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the torch, the gate and the dark corridor within the middle 60% of the height so it reads when cropped to a wide horizontal strip.
No people, no monsters, no text, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택. Gemini가 가로 이미지(512×286)로 줬지만 도트는 같은 2.56px → 200×112로 복원. 워터마크가 바닥 위라 밝은 16픽셀을 주변 평균으로 메움(`assets/scenes/dungeon1_clean.png`). 띠 179×100 `(10,8)~(189,108)` = `public/scene-dungeon1.png`. 미궁 화면은 자리가 빠듯해 띠 대신 **지도 칸 배경**으로 깐다(2배, 62% 어둡게 눌러 지도 점·선이 먼저 읽히게, `SCENE_ART["dungeon"+섹터]`). 벽의 날짜 긁은 자국은 안 나옴

## 021 — 타이틀 키아트 (기준 이미지 + 훈련장 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image (a training yard) shows the scene scale and level of detail to follow.

Pixel art game title illustration, classic 16-bit RPG style, wide establishing view from a slightly elevated angle at dusk.
A small, bleak island in a cold grey sea in a grim dark-fantasy world. In the center of the island a huge ancient stone pit-entrance to an underground labyrinth gapes open like a mouth, with crumbling stone steps leading down into total darkness. Around it huddles a poor village of crooked timber houses with a few lit windows, a tiny graveyard on a hill full of small grave markers, and a narrow muddy road leading to the pit. On a high cliff above everything stands the lord's dark stone castle, its tallest tower crowned with a gold sun emblem catching the last light. Heavy low clouds, a thin band of dying light on the horizon, crows circling over the pit.
Muted palette of about 24 colors: cold slate greys, dark sea blue-grey, dark browns, black; dull gold (#cf9a44) only on the sun emblem, a few lit windows and the thin horizon light.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
Keep the labyrinth pit, the village and the castle within the middle 60% of the height so it reads when cropped to a wide horizontal strip. Leave the bottom fifth of the image as calm dark ground so a character and a title can be placed over it.
No people, no text, no logo, no UI, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택(512, 200격자) → 179×160 `(10,10)~(189,170)` = `public/scene-title.png`(`focus: 0.65`로 좁은 화면에서도 미궁 구멍을 남김). 타이틀 화면에서 2배로 깔고 그 위 왼쪽 아래에 모험가 소년 스프라이트를 2배로 세운다(`.title-art`)

## 022 — 방 종류 아이콘 10종 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

A sheet of ten small pixel art map icons for a dungeon crawler, classic 16-bit RPG style, arranged in a neat grid of two rows of five, evenly spaced with clear magenta gaps between them, all the same size, each icon a simple bold silhouette readable at a tiny size.
Top row, left to right:
1. entrance: a stone archway with a faint gold light inside;
2. empty room: a plain cracked stone floor tile;
3. enemy presence: a pair of glaring red eyes (#c0564d) in darkness;
4. trap: a rusty open bear trap with jagged teeth;
5. treasure: a small iron-banded wooden chest with a dull gold lock (#cf9a44).
Bottom row, left to right:
6. record: a rolled, torn parchment scroll;
7. shrine: a small stone altar with a single candle flame;
8. stairs: stone steps descending into darkness;
9. boss: a large cracked monster skull with a dull red glow in the eye sockets;
10. portal: a swirling oval gate of dull violet light (#9a7bc0), drawn with flat pixel shades.
Muted earthy palette: dark browns, stone greys, bone; accent colors only as noted.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering, no soft glow.
Solid flat magenta background (#FF00FF). No text, no numbers, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택. 아이콘 시트인데도 **200격자**(2.56px)였다 — 100격자로 복원하면 뭉개진다. 경계가 마젠타와 섞여 있어 투명과 맞닿은 마젠타 계열 픽셀을 3겹 걷어내고, 남은 진한 마젠타만 추가로 지움(차원문 보라는 r−g가 작아 보존). 빈 줄·칸으로 10개로 나눠 `public/room-*.png`(약 30도트). 지도 점(지름 10~14px)에 넣기엔 커서 **갈림길 버튼 왼쪽**에 1배로 쓴다(`RoomIcon`, 모르는 방은 빈칸, 다시 생긴 기척은 적 아이콘)

## 장비 아이콘 공통 규칙

21종을 시트 셋(023 무기·방패 7, 024 방어구 9, 025 장신구 5)으로 나눠 뽑는다. 순서는 `src/game/gear.ts`의 `GEAR` 순서. 시트는 연결 성분으로 나눈다(대각선 무기는 빈 줄로 안 나뉜다) — 분할 스크립트는 아래 023 분할은 `tools/split_sheet.py 시트.png 출력폴더 gear- 이름1,이름2,...`. `public/gear-<id>.png`, `GEAR_ICON`(art.ts), `GearIcon`(32×32 칸 1배): 캐릭터 시트 장비 9칸, 대장간 목록, 미궁 장비 발견 카드(2배). 아이콘 없는 장비는 빈칸.

## 023 — 무기·방패 7종 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

A sheet of seven pixel art equipment icons for a grim dark-fantasy RPG, classic 16-bit style, in one neat horizontal row (or two rows of four and three), evenly spaced with clear magenta gaps, all drawn at the same scale, each a clean single object shown diagonally:
1. a plain iron short sword with a dull gold crossguard (#cf9a44);
2. a longer, heavier iron longsword with a leather-wrapped grip;
3. a thin, narrow dagger with a worn handle;
4. a plain straight oak staff with a thin metal band and a small dull violet stone (#9a7bc0) at the tip;
5. a crooked wand carved from a yellowed bone, bound with dark cord;
6. a round, battered wooden shield with simple planks;
7. a round wooden shield reinforced with a rusty iron rim and a central iron boss.
Muted earthy palette: dark browns, iron grey, bone, leather; accents only as noted. Everything looks used, cheap and worn.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Solid flat magenta background (#FF00FF). No text, no numbers, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택. 이번 시트는 **100격자**(5.12px)였다 — 시트마다 도트 크기를 재고(가로 색 변화 간격의 최빈값) 격자를 고른다. 방패가 워터마크 모서리에 걸쳐 `--keep-watermark`. 연결 성분(8방향)으로 7개 분할, 12픽셀 미만 조각은 가까운 덩어리에 합침 → `assets/icons/gear-*.png`(19~31도트)

## 024 — 방어구 9종 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

A sheet of nine pixel art equipment icons for a grim dark-fantasy RPG, classic 16-bit style, in a neat grid of three rows of three, evenly spaced with clear magenta gaps, all drawn at the same scale, each a clean single object:
1. a frayed dark brown wool apprentice robe with many small mismatched pockets;
2. a scuffed brown leather cuirass with stitched cowhide patches;
3. a rusty, patched chain mail shirt;
4. a simple soft leather cap;
5. a dented iron half-helm;
6. a sturdy plain leather belt with an iron buckle;
7. a leather belt hung with small herb pouches and a dried sprig;
8. a pair of worn leather boots;
9. a pair of light, laced leather boots with a faint green-grey tint, built for running.
Muted earthy palette: dark browns, iron grey, faded ochre, wool; dull gold (#cf9a44) only on small buckles. Everything looks used, cheap and worn.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Solid flat magenta background (#FF00FF). No text, no numbers, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택(100격자). 워터마크가 날랜 장화 위에 찍혀 `--keep-watermark` 후, 장화 색(파랑이 낮은 올리브)과 다른 회백색 픽셀 6개를 장화 중간색으로 메움 → `assets/icons/gear_sheet2.png` → `split_sheet.py`로 9개

## 025 — 장신구 5종 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

A sheet of five small pixel art trinket icons for a grim dark-fantasy RPG, classic 16-bit style, in one neat horizontal row, evenly spaced with clear magenta gaps, all drawn at the same scale:
1. a crude amulet of small carved bones and teeth on a dark cord;
2. a string of plain wooden prayer beads with a tiny dull gold sun charm (#cf9a44);
3. a plain rusty iron ring;
4. a thin dull gold ring set with a tiny four-leaf pattern;
5. a dark silver ring set with a small dull red stone (#c0564d).
Muted palette: dark browns, bone, iron grey, tarnished silver; accents only as noted.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Solid flat magenta background (#FF00FF). No text, no numbers, no frame or border. Square 1:1 image.
```

결과(2026-10-13): 1차 채택. 이 시트만 **200격자**라 목걸이가 다른 아이콘의 두 배(35×52, 28×56)로 나왔다. 얇은 끈이 마젠타와 섞여 있어 지우면 끈이 사라지므로, 마젠타 낀 어두운 픽셀은 초록값 기준 어두운 갈색으로 **색만 되돌리고**(172개) 배경에 가까운 밝은 것만 투명(109개). 절반 축소(어두운 선 우선)도 해 봤지만 염주 알·태양 부적이 뭉개져 원래 크기를 쓴다 → 장비 아이콘 칸은 최소 32×32에서 늘어나고, 장비 목록 아이콘 열은 36px

## 2섹터 몬스터 공통 규칙

2섹터 "잊힌 전쟁터의 초원". 1섹터와 같은 월드 스케일, 왼쪽을 본다. 짐승(늑대·까마귀·하피)은 금색 눈, 망령 계열(유령 군마·망령 병사·장군)은 차가운 회청색 눈빛 `#9fb4c0`(1섹터 마석 청록과 섞이지 않게). 희귀 개체는 기본형을 두 번째로 첨부해 변형한다.

**200격자로 온 스프라이트**: Gemini가 가끔 도트 2.56px(200격자)로 그린다. 100격자로 줄이면 점무늬로 뭉개지므로 200격자 원본을 쓰고, 짝수 크기로 맞춘 뒤 `art.ts`에는 **크기를 절반으로** 적는다(화면 코드 그대로 월드 스케일, 고해상도 화면에서 도트가 더 촘촘). 번짐은 `defringe`(투명과 맞닿은 마젠타 낀 픽셀 3겹 제거 + 안쪽은 주변색 중앙값).

## 026 — 들늑대 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, 3/4 side view facing left, classic 16-bit RPG style, same world scale as the reference boy (the wolf's back reaches about the boy's waist).
A lean, hungry grassland wolf from an old forgotten battlefield in a grim dark-fantasy world: shaggy dusty grey-brown fur, ribs showing, a torn ear, yellow eyes, lips pulled back over yellowed fangs, head low and stalking forward.
Muted earthy palette of about 14 colors: dusty grey, dark brown, dry straw ochre; dull gold (#cf9a44) only on the eyes.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

## 027 — 우두머리 늑대 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, 3/4 side view facing left, classic 16-bit RPG style, same world scale as the reference boy (a big wolf whose shoulder reaches the boy's chest, clearly larger than a normal wolf).
The alpha of a grassland wolf pack on an old forgotten battlefield in a grim dark-fantasy world: massive, thick dark grey mane, many old scars across the muzzle, one milky blind eye, a broken arrow shaft still stuck in its shoulder, standing tall and howling a command with its head raised.
Muted earthy palette of about 14 colors: dark grey, dusty brown, bone; dull gold (#cf9a44) only on the one good eye.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

## 028 — 까마귀 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single small creature, 3/4 side view facing left, classic 16-bit RPG style, same world scale as the reference boy (a crow is tiny, only about the size of the boy's head, so it is small in the frame).
A carrion crow that grew fat on the dead of an old battlefield in a grim dark-fantasy world: ragged black feathers with a faint blue-grey sheen, wings half spread as it swoops in to peck, sharp grey beak open, a small beady eye.
Muted palette of about 10 colors: black, blue-grey, dark grey; dull gold (#cf9a44) only on the eye.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Centered, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

## 029 — 하피 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, front-facing 3/4 view facing left, classic 16-bit RPG style, same world scale as the reference boy (a harpy's body is about the boy's height, with wide wings).
A harpy of the forgotten battlefield in a grim dark-fantasy world: a gaunt, monstrous bird-woman with a hollow-cheeked grey face, wild matted dark hair, mouth open in a shriek, large ragged brown-grey wings spread as she hovers in the air, scaly bird legs with long hooked talons reaching forward. Monstrous and frightening, not attractive; no exposed chest, the torso is covered in dark feathers.
Muted palette of about 16 colors: dusty brown, ash grey, sickly pale grey skin, black; dull gold (#cf9a44) only on the eyes.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, wings fully inside the frame, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

## 030 — 유령 군마 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, 3/4 side view facing left, classic 16-bit RPG style, same world scale as the reference boy (a full-size warhorse, its back is higher than the boy's head; fill about 90% of the image width).
A ghost warhorse that still charges across an old forgotten battlefield in a grim dark-fantasy world: a gaunt, half-rotted horse with patches of bone showing through, a torn and rusty barding of chain and faded cloth, a broken saddle with no rider, empty dark eye sockets with a faint cold pale-blue light, rearing slightly as if about to charge.
Muted palette of about 16 colors: ash grey, bone, rusty iron, dark brown, faded dark red cloth; a cold pale blue-grey (#9fb4c0) only in the eye sockets, drawn with 2 flat shades, no soft glow.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, hooves visible, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

## 031 — 망령 병사 (기준 이미지 첨부)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art game sprite of a single creature, front-facing 3/4 view facing left, classic 16-bit RPG style, same world scale as the reference boy (an adult soldier, a head taller than the boy; fill about 95% of the image height).
A wraith soldier still fighting a war that never ended, on an old forgotten battlefield in a grim dark-fantasy world: a gaunt translucent grey figure in dented, rusted plate and torn faded tabard, a cracked open-faced helmet showing a hollow, skull-like face with a faint cold pale-blue light in the eyes, holding a notched old sword raised, mouth open in a silent war cry.
Muted palette of about 16 colors: ash grey, rusty iron, faded dark red cloth, bone; a cold pale blue-grey (#9fb4c0) only in the eyes, drawn with 2 flat shades, no soft glow.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
Full body, centered, feet visible, small margin around it.
Solid flat magenta background (#FF00FF). No ground shadow, no scenery, no text, no frame or border. Square 1:1 image.
```

결과(2026-10-14, 026~031): 모두 1차 채택.
- 들늑대 80×48, 우두머리 늑대 78×62(어깨에 부러진 화살, 하울링), 까마귀 37×35(요청보다 조금 크지만 날개를 편 크기로 자연스러움), 하피 93×85 — 100격자
- 유령 군마 170×190 → 85×95, 망령 병사 150×190 → 75×95 — 200격자 원본, 마젠타 번짐 494·460픽셀 제거
- `public/mon-{wolf,alphawolf,crow,harpy,warhorse,wraith}.png`, `MONSTER_ART`에 등록(도감·전투 로그에 자동 반영 — 빌드는 게임 세션에서)

## 032~037 — 2섹터 희귀·정예·보스, 이단심문관

프롬프트는 채팅 기록(2026-10-14) 그대로: 032 금빛 털 늑대(기준+들늑대), 033 마석 깃털 하피(기준+하피), 034 마석 갑주 망령(기준+망령 병사), 035 하피 여왕(기준+하피, 보상 "깃털 망토"를 두름), 036 끝나지 않은 전쟁의 장군(기준+유령 군마+망령 병사, 등에 찢어진 군기 = 보상 "녹슨 휘장"), 037 이단심문관(기준만, 허리에 달을 삼키는 태양 문양). 희귀 개체의 마석은 1섹터와 같은 청록 `#5fb3a8`.

결과(2026-10-14): 모두 1차 채택.
- 금빛 털 늑대 73×48, 마석 깃털 하피 88×85, 하피 여왕 100×97 — 100격자, 수정 없음
- 마석 갑주 망령 91×95 — 넓은 청록 갑옷이 튀어 마석 갑옷 스켈레톤과 같은 보정(청록 채도 −30%·명도 −8%)
- 장군 184×198 → 92×99, 이단심문관 122×186 → 61×93 — 200격자 원본, 번짐 521·221픽셀 제거
- 이단심문관 허리 문양이 **초승달만** 나와(달 = 잡아먹힌 짝신 → 이단 상징이 됨) 초승달 안쪽을 금빛 원반(반지름 3)·어두운 테두리·햇살 8개로 손으로 그려 "달을 품은 태양"으로 고침
- 장군은 월드 스케일상 유령 군마와 거의 같은 크기(말+기수가 100도트 틀에 갇힘). 보스 위압감을 더 주려면 화면 쪽에서 보스만 키우는 방법이 있음(게임 세션 판단)

## 038 — 2섹터 초원 전쟁터, 낮 (기준 이미지 + 훈련장 첨부)

프롬프트는 채팅 기록(2026-10-15) 그대로. 결과: 1차 채택(512, 200격자). 쓰러진 옛 신 석상, 언덕 위 차원문 고리, 무덤과 꽂힌 칼·찢긴 군기. 띠 179×100 `(10,14)~(189,114)` = `public/scene-dungeon2.png` → 지도 배경(`dungeon2`, 섹터 번호로 자동). **039 밤 그림도 같은 좌표로 자를 것**(낮밤 교체 시 구도 유지)

## 039 — 2섹터 초원 전쟁터, 밤 (기준 이미지 + 038 낮 그림 첨부)

결과(2026-10-15): 1차 채택(200격자). 같은 구도를 요청했지만 석상이 상반신으로 일어선 모양 등 세부가 달라졌다 — 석상(왼쪽)·차원문(오른쪽 위)·길·군기 위치는 같아 낮밤 교체가 어색하지 않아 채택. 낮과 같은 좌표 `(10,14)~(189,114)` = `public/scene-dungeon2night.png`(`dungeon2night`). 아주 어두운 그림이라 지도 배경으로 깔 때 덧칠 어둡기를 낮보다 약하게(예: 0.62 → 0.35) 하는 게 좋다

## 040~044 (2026-10-19) — 여관, 전쟁의 흔적, 2섹터 장비 10, 로그

프롬프트는 채팅 기록 그대로(VISUAL_TODO A·G). 결과: 모두 1차 채택.
- 040 여관 다락방: 1024 이미지·200격자 → 띠 179×80 `(10,52)~(189,132)` = `public/scene-inn.png`(`inn`, 주간 결과 "여관")
- 041 전쟁의 흔적: 1024 이미지에 200격자로 그려져 기존 방 아이콘(약 30도트)의 1.6배였다 → `--grid 128`로 복원해 31×38(덫 아이콘과 같은 크기) = `public/room-relic.png`
- 042·043 장비 시트: 1024 이미지·100격자(지시가 먹힘), 연결 성분으로 5개씩 → `public/gear-{wraithspear,warbanner,steelsword,steelshield,oakstaff,wolfhide,horseshoe,harpycharm,battlering,queencloak}.png`(11~24도트 — 기존 장비보다 조금 작다)
- 044 로그: 100격자 54×91(후드는 등 뒤로 넘어간 망토 깃, 역수 단검), 얼굴 `(17,0)`에서 30×30 → `public/rogue.png`·`rogue-face.png`, `CLASS_ART.rogue`

## U01 — 앱 아이콘 (ref_boy 첨부, UI_ART_REQUESTS 프롬프트 + "중요한 것은 가운데 80% 원 안에")

결과(2026-10-19): 1차 채택. 우물 같은 미궁 구멍 앞에 금빛 날밑 칼, 금빛 후광. 1024 이미지, 도트 약 9.75px → 격자 100~108을 원본과 비교해 **105격자**가 가장 잘 맞음. 워터마크(회색) 8픽셀만 주변 중앙값으로 메움(금빛 후광은 빨강≫파랑이라 색으로 구분). 원본 `assets/ui/app_icon_105.png`.
- `public/icon-512.png`(×5=525에서 가운데 512), `icon-192.png`(×2=210에서 가운데 192), `icon-maskable-512.png`(×4=420을 배경색 #110801 512 캔버스 가운데, 원형 안전영역 확인), `favicon-32.png`(BOX 축소)
- 연결은 게임 세션: `manifest.webmanifest` icons, `index.html` icon·apple-touch-icon

## U02 — 공유 미리보기

오른쪽 40%를 비우라는 지시를 단색 사각형 덧붙이기로 처리 — 섬이 x=672에서 수직으로 잘리고 오른쪽 아래가 무늬 없는 판. 해안선·바다를 자연스럽게 잇도록 지시를 보강해 다시 뽑는다

결과(2026-10-19, 2차): 해안선·바다를 이어 그리라는 지시 보강 후 채택(소년은 망토 차림으로 나옴). 1024×572 이미지인데 도트 격자가 이미 흐트러져(200격자 복원 오차 4.5, 오두막이 점무늬로 뭉개짐) **격자 복원 없이 원본 해상도로** 처리: 바다 위 워터마크를 주변색으로 메움(`assets/ui/og_source_1024.png`) → 세로 16~553 자르고 1200×630으로 nearest = `public/og.png`. 오른쪽 40%는 바다·하늘만(로고·소개 글은 게임 세션이 얹음)

## 045~052 (2026-10-19) — 3섹터 장면 + 기본 몬스터 7

3섹터 규칙: 탁한 물빛 회녹·균사 흰색, 강조색 병든 황록 `#a3b05a`(청록은 마석 전용). 몬스터 프롬프트에 "100격자" 지시. 첨부는 `assets/prompt_refs/`(ref_boy, ref_scene_training, ref_mon_rat). 프롬프트는 채팅 기록 그대로.

결과: 모두 1차 채택. 1024 이미지라 장마다 블록 색 편차로 격자를 찾았다(쥐·거머리·두꺼비 100, 달팽이·곰팡이 102, 사제복 101, 석상 103, 장면 200).
- 045 장면: 띠 179×100 `(10,40)~(189,140)` = `public/scene-dungeon3.png`(`dungeon3`) — 물에 잠긴 신상과 공양 그릇
- **크기**: Gemini가 "작게"를 무시하고 꽉 채운 장 — 역병 쥐 74×50(무릎 높이여야 함), 산성 달팽이 100×90(소년 키만 함) → 짝수로 맞추고 `art.ts`에 **절반 크기**로 등록(37×25, 50×45). 나머지는 원래 크기: 거머리 35×16, 두꺼비 76×62, 곰팡이 괴물 94×94, 사제복 균사체 44×95, 잠긴 석상 86×101
- 워터마크: 곰팡이 괴물 오른손 위에 겹쳐 9픽셀(푸른 회색)을 주변색으로. 나머지는 배경 위라 자동 제거

## 053~057 (2026-10-19) — 3섹터 희귀 3·정예·보스

프롬프트는 채팅 기록 그대로(첨부: ref_s3_leech/snail/mold/shroudmold/scene). 결과: 모두 1차 채택.
- 진주 먹은 거머리 36×16(100격자, 크기 지시가 먹힘)
- 마석 껍질 달팽이 94×72·마석 균모자 76×78 — 또 두 배로 그려 **절반 등록**(47×36, 38×39), 쨍한 청록은 마석 스켈레톤과 같은 보정(채도 −30%·명도 −8%)
- 익사한 성가대 84×98(103격자) — 녹청 청동 종 군체, 얼굴들이 노래함. 녹청은 의도한 색이라 보정 안 함
- 가라앉은 본당의 균모 200×198(200격자) → **절반 등록** 100×99. 장면의 신상이 곰팡이에 뚫린 상반신(아래가 화면 밖으로 잘림 — 물에서 솟은 모습으로 읽혀 그대로). 뿌리 위 워터마크 18픽셀(저채도 회색)을 주변색으로
- 058·059 장비 시트, 060 공양 제단 아이콘은 생성 대기

## 058~060 (2026-10-19) — 3섹터 장비 9·공양 제단

결과: 모두 채택. 시트 둘 다 100격자. 058 시트에 코르크 방패가 하나 더 그려져(6개) 중복 1개 버림. 물장화 아래 워터마크 4픽셀을 주변색으로. 공양 제단은 작게 그려져 **180격자**로 복원해 30×29(다른 방 아이콘 크기). `public/gear-{bronzeblade,corkshield,tidestaff,oiledleather,waders,sporemask,leechcharm,antidotering,choirbell}.png`, `public/room-altar.png`

## 061~068 (2026-10-19) — 4섹터 장면 + 기본 몬스터 7

4섹터 "불타는 광산 갱도" 규칙: 석탄 검정·녹슨 쇠·그을린 갱목. 1~2층은 불(강조색 불씨 주황 `#d9632b`), 3층은 얼음(강조색 서리 흰청 `#cfe3ea`, 2섹터 망령 회청 `#9fb4c0`보다 밝고 하얗게). 청록은 여전히 마석 전용. 몬스터 프롬프트에 "100격자"와 화면 차지 비율을 함께 지시. 첨부는 `assets/prompt_refs/`(장면: ref_scene_training + ref_s3_scene, 몬스터: ref_boy). 프롬프트는 채팅 기록 그대로.
- 061 장면 `dungeon4` · 062 불씨 박쥐 · 063 불도롱뇽 · 064 광석 갑충 · 065 화염 정령 · 066 굴착 벌레 · 067 서리 망령 · 068 얼음 트롤

결과: 모두 1차 채택. 1024 이미지, 몬스터는 102~103격자(장면 200).
- 061 장면: 띠 179×100 `(10,50)~(189,150)` = `public/scene-dungeon4.png`(`dungeon4`) — 왼쪽 용암 균열, 가운데 넘어진 광차와 레일, 오른쪽 얼음 광맥(1~2층 불 → 3층 얼음이 한 장에)
- 불씨 박쥐 82×46: 또 두 배로 그려 **절반 등록** 41×23. 2배 축소를 직접 해 보니 눈과 불씨가 뭉개져 원본을 둠
- 나머지 원래 크기: 불도롱뇽 95×44, 광석 갑충 98×70(가슴 높이 — 크지만 단단한 갑충이라 그대로), 화염 정령 90×98, 굴착 벌레 81×97, 서리 망령 75×95, 얼음 트롤 94×93(1.5배를 바랐지만 웅크린 덩치라 그대로)
- 워터마크는 모두 배경 위라 자동 제거(트롤 사슬 옆, 벌레 돌무더기 옆)
- 다음 첨부용 기준 이미지 `assets/prompt_refs/ref_s4_{emberbat,salamander,orebeetle,frostwraith,scene}.png`

## 069~073 (2026-10-19) — 4섹터 희귀 3·정예·보스

첨부: 069 ref_boy+ref_s4_emberbat, 070 ref_boy+ref_s4_orebeetle, 071 ref_boy+ref_s4_frostwraith, 072 ref_boy+ref_s4_scene, 073 ref_boy+ref_s4_salamander. 마석 청록 `#5fb3a8`은 희귀 3종에만. 보스는 몸 반쪽이 불, 반쪽이 얼음(설명 "반쪽은 얼어 있다"). 프롬프트는 채팅 기록 그대로.

결과: 모두 1차 채택. 금맥 박쥐 103격자, 광석 갑충 102, 서리 정령 103, 미믹·보스 100(보스는 200격자 지시를 무시).
- 금맥 박쥐 82×44 → 불씨 박쥐처럼 **절반 등록** 41×22
- 마석 광석 갑충 96×68 → 또 크게 그려 **절반 등록** 48×34(무릎 높이), 청록은 마석 보정(채도 −30%·명도 −8%)
- 마석 서리 정령 55×63 — 오른쪽 아래 외곽선 없는 흐릿한 김 덩어리(61픽셀)와 마젠타 낀 연보라 점 7개를 지움
- 광차 미믹 87×70, 화로 어미 도롱뇽 88×95(꼬리 위 워터마크 6픽셀을 주변색으로)

## 074~076 (2026-10-19) — 4섹터 장비 9·버려진 화약고 (생성 대기)

074 시트 A(곡괭이·지팡이·경첩 방패·내화 갑옷·털 외투), 075 시트 B(갱도모·안전화·카나리아 새장·불씨 반지), 076 방 아이콘 magazine. 첨부: ref_boy + ref_icons_weapons(074·075), ref_boy + ref_icons_rooms(076). 경첩 방패는 072 광차 미믹의 턱과 같은 디자인(ref_s4 미믹은 원본 없음 → 설명으로). 프롬프트는 채팅 기록 그대로.
