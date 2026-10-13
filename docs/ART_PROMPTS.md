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
