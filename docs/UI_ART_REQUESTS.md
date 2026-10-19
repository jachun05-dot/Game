# UI 그림 요청서 (2026-10-19)

몬스터·장비·장면 그림은 `docs/VISUAL_TODO.md`에 있다. 이 문서는 **화면 틀(UI)과 출시에 필요한 그림**만 모았다.
지금 UI는 그림 없이 CSS·SVG만으로 완성돼 있다(`src/ui/theme.css`, `src/ui/icons.tsx`). 아래 그림은 넣으면 더 좋아지는 것이고, 없어도 화면이 깨지지 않는다.

만드는 법은 `docs/ART_PROMPTS.md` 공통 규칙과 같다: 기준 이미지 `assets/reference/style_reference.png`를 첨부하고 Gemini로 생성 → 채팅에 첨부 → 후처리(`tools/sprite.py`) → `public/`에 넣고 `src/ui/art.ts`에 등록.
번호는 ART_PROMPTS의 다음 번호(040~)와 겹치지 않게 **U01~**로 매긴다.

## 우선순위 요약

| # | 무엇 | 왜 | 꼭? | 생성 횟수 |
|---|---|---|---|---|
| U01 ✅ | 앱 아이콘 | 홈 화면 설치·앱 스토어·브라우저 탭. 지금은 세로로 긴 소년 그림이라 찌그러진다 | **출시 필수** | 1~2 |
| U02 ✅ | 공유 미리보기 그림(OG 1200×630) | 링크를 메신저·SNS에 붙였을 때 뜨는 카드 | **출시 필수(웹)** | 1 |
| U03 | 스토어 대표 그림(1024×500) | 구글 플레이 그래픽 이미지 | 앱 출시 때 필수 | 1 |
| U04 | 소모품 아이콘 15종 | 상점·미궁 도구 버튼 — 지금은 글자뿐 | 권장 | 2 |
| U05 | 상태 아이콘 14종 | 부상·질병·정신·독·마비·부식·화상·동상·냉기 표시 | 권장 | 2 |
| U06 | 신의 문장 8종 | 신앙 표시·타이틀 해금 카드·제단 | 권장 | 1 |
| U07 | 보스 증표 5종 | 훈련 재료 표시(VISUAL_TODO F와 같은 것) | 권장 | 1 |
| U08 | 로딩·스플래시 그림 | 앱 시작 화면 | 앱 출시 때 | 1 |
| U09 | 넓은 화면용 타이틀 키아트 | PC에서 양옆 빈 곳 채우기 | 선택 | 1 |
| U10 | 엔딩 일러스트 4종(헌납·진엔딩·영주에게 맞선 자·숨겨진 엔딩 "섬을 떠난 자") | 엔딩 묘비 위(VISUAL_TODO E + 2026-10-19 탈출 엔딩) | 선택(출시 전 권장) | 4 |

**출시 최소 세트: U01·U02(웹) / U01·U02·U03·U08(앱).** 합계 약 15회.

---

## U01 — 앱 아이콘 (기준 이미지 첨부)

- 결과물: `public/icon-512.png`(512×512), `public/icon-192.png`(192×192), `public/icon-maskable-512.png`(가장자리 20% 여백 — 안드로이드가 원·둥근 사각으로 자른다), `public/favicon-32.png`
- 연결(게임 세션): `public/manifest.webmanifest`의 `icons`, `index.html`의 `<link rel="icon">`·`apple-touch-icon`
- 도트 그림이지만 아이콘은 **작게 봐도 읽히는 굵은 실루엣**이 먼저다. 소년 얼굴 + 미궁 구멍, 또는 칼 + 구멍.

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

Pixel art app icon for a grim dark-fantasy text roguelike called "DDD", classic 16-bit RPG style, square composition that reads clearly at 48x48 pixels.
A bold, simple emblem: a dark stone pit-entrance to an underground labyrinth seen from above at an angle, a black void inside, with a plain iron short sword standing upright in front of it, its crossguard in dull gold (#cf9a44). Behind it a deep dark-brown background with a subtle round vignette of dull gold light around the pit's rim.
The design fills the square edge to edge as a full-bleed background (no transparent corners), with the emblem centered and occupying the middle 70%.
Muted palette of about 16 colors: very dark browns, stone greys, black, dull gold accents only.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering.
No text, no letters, no logo type, no frame, no rounded corners drawn in. Square 1:1 image.
```

후처리: 마젠타 제거 없음(꽉 찬 배경). 200격자로 복원 → nearest-neighbor로 512·192·32 크기, maskable은 512 캔버스 가운데 80%에 앉힌다.

## U02 — 공유 미리보기 그림 1200×630 (기준 이미지 + 타이틀 키아트 첨부)

- 결과물: `public/og.png`(1200×630, 2배 도트 그대로 확대 + 글자는 게임 세션이 얹는다)
- 연결(게임 세션): `index.html`의 `og:image`·`twitter:card`
- 그림에는 글자를 넣지 않는다(한글이 깨진다). 오른쪽 40%를 비워 두면 게임 세션이 로고·한 줄 소개를 얹는다.

```
Match the exact art style, outline, palette and pixel scale of the attached images; the second image is the game's title illustration — reuse its island, castle and labyrinth pit.

Wide pixel art banner illustration, classic 16-bit RPG style, landscape composition about 1.9:1.
At dusk on the bleak island: the 16-year-old boy from the reference image stands small on the left third, seen from behind, holding his short sword, looking at the huge dark stone labyrinth pit in the middle of the village; the lord's castle with its gold sun emblem rises on a cliff in the background. Heavy low clouds, a thin band of dying gold light on the horizon.
Keep the right 40% of the image calm and dark (sky and sea only) so a title can be placed there.
Muted palette of about 24 colors: slate greys, dark sea blue-grey, dark browns; dull gold (#cf9a44) only on the sun emblem, a few windows and the horizon.
Crisp hard pixel edges, 1-pixel dark outlines, no anti-aliasing, no blur, no gradients, no noisy dithering.
No text, no logo, no UI, no frame or border.
```

## U03 — 스토어 대표 그림 1024×500 (U02와 같은 방식)

U02 프롬프트에서 비율만 "about 2:1"로. 구글 플레이는 가운데에 재생 버튼이 얹히므로 **가운데 1/3에 중요한 것을 두지 않는다**("keep the exact center of the image free of important details" 추가).

## U04 — 소모품 아이콘 15종 (기준 이미지 첨부, 2장으로 나눠)

- 결과물: `public/item-<id>.png`(1배 약 16~20도트), `src/ui/art.ts`에 `ITEM_ICON` 새 목록
- 연결(게임 세션): 상점 줄(`.shop-row`) 왼쪽, 미궁 도구 버튼(`.dock .util`)의 SVG 아이콘 대신
- id: food 말린 고기 · potion 물약 · scroll 귀환 주문서 · bandage 붕대 · herb 탕약 · antidote 해독초 · salve 화상 연고 · firewood 장작 · powder 화약통 · rope 밧줄 · incense 옛 신의 향 · whetstone 숫돌 · heart 마석 심장(증표, U07과 겹치면 생략) · gold 금화 더미 · mana 마석 조각

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

A sheet of eight small pixel art inventory item icons for a dungeon crawler, classic 16-bit RPG style, arranged in a neat grid of two rows of four, evenly spaced with clear magenta gaps, all drawn at the same small scale, each a simple bold silhouette readable at 20x20 pixels.
Top row, left to right:
1. a strip of dark dried meat tied with string;
2. a small round glass flask of dull red healing potion with a cork;
3. a rolled parchment scroll sealed with a dull gold wax seal (#cf9a44);
4. a rolled linen bandage, slightly frayed;
Bottom row, left to right:
5. a small clay bowl of dark herbal medicine;
6. a sprig of bitter green herb leaves;
7. a small round tin of burn salve with the lid ajar;
8. a small bundle of firewood tied with cord.
Muted earthy palette: dark browns, bone, dull greens and reds; dull gold accents only where noted.
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering, no soft glow.
Solid flat magenta background (#FF00FF). No text, no numbers, no frame or border. Square 1:1 image.
```

두 번째 장(7종): 9 a small black powder keg with a short fuse · 10 a coil of hemp rope · 11 three thin sticks of incense with a thin line of smoke drawn as flat pixels · 12 a grey whetstone · 13 a small pile of dull gold coins (#cf9a44) · 14 a glowing cyan-blue raw mana crystal shard (flat shades) · 15 (빈칸 — 생략 가능)

## U05 — 상태 아이콘 14종 (기준 이미지 첨부, 2장)

- 결과물: `public/status-<id>.png`(1배 약 12~14도트), `src/ui/art.ts`에 `STATUS_ICON`
- 연결(게임 세션): 헤더 부상 태그(`.injury-tag`) 앞, 캐릭터 시트 부상 줄
- id: wound 경상 · grave 중상 · lost 결손 · disease 쥐 열병 · mold 곰팡이 폐병 · fear 공포 · rage 분노 · confusion 혼란 · despair 절망 · poison 독 · paralysis 마비 · corrosion 부식 · burn 화상 · frost 동상(냉기 겸용)
- 프롬프트는 U04와 같은 틀에 "tiny status effect icons, each a single bold symbol inside no frame" + 목록: a small red slash wound / a deep bleeding gash / a broken bone / a sick rat head / grey-green mold spores / a pale wide-eyed face (fear) / a red clenched fist (rage) / a purple spiral (confusion) / a drooping dark-blue teardrop (despair) / a green poison drop with a skull / a stiff yellow lightning-bent limb (paralysis) / a rust-orange corroded metal flake / an orange flame on skin / a pale-blue ice crystal

## U06 — 신의 문장 8종 (기준 이미지 첨부, 1장)

- 결과물: `public/sigil-<god>.png`(1배 약 16도트), `src/ui/art.ts`에 `SIGIL_ICON`(키는 `src/game/data.ts` FAITH의 이름)
- 연결(게임 세션): `.faith-tag` 앞, 타이틀 "해금된 옛 신" 카드, 옛 신들의 제단 선택지
- 신: 전쟁 · 기아/풍요 · 재앙 · 탐욕 · 시와 노래 · 역병 · 심연 · 망각 (이름·성격은 `src/game/data.ts` FAITH, `src/game/faith.ts`)

```
Match the exact art style, outline, palette and pixel scale of the attached reference image.

A sheet of eight small pixel art holy sigils of forgotten old gods, classic 16-bit RPG style, two rows of four, evenly spaced with clear magenta gaps, same size, each an emblem carved in weathered stone with a single accent color, readable at 16x16 pixels.
Top row: 1. war — two crossed rusty swords (dull red accent); 2. famine and plenty — a two-faced bowl, one half full one half empty (ochre accent); 3. calamity — an open bear trap with a cracked sun (orange accent); 4. greed — a single old coin with an eye (dull gold #cf9a44).
Bottom row: 5. poetry and song — a lyre with one broken string (pale blue accent); 6. plague — a bell with drips (sickly green accent); 7. abyss — a bottomless spiral pit (deep violet accent); 8. oblivion — a blank faceless mask (bone white, no accent).
Crisp hard pixel edges, 1-pixel dark outline, no anti-aliasing, no blur, no gradients, no noisy dithering, no glow.
Solid flat magenta background (#FF00FF). No text, no frame or border. Square 1:1 image.
```

## U07 — 보스 증표 5종

VISUAL_TODO F의 "보스 증표 5"와 같다(마석 심장·녹슨 휘장·포자낭·불씨 비늘·검은 이빨, 한 장 시트). 연결(게임 세션): 훈련 레벨표의 4·7·10·13·16 줄, 캐릭터 시트.

## U08 — 로딩·스플래시 그림

- 결과물: `public/splash.png`(세로 9:16, 200격자 복원 후 2배)
- 앱 포장 때(Capacitor 등) 시작 화면. 웹에서는 쓰지 않는다
- 프롬프트: U02와 같은 장면을 **세로 9:16**으로, 가운데 위쪽 1/3을 비워 둠("keep the upper-middle third calm and dark for a logo")

## U09 — 넓은 화면용 타이틀 키아트 (선택)

PC 브라우저에서 가운데 기둥(560px) 양옆이 비어 있다(지금은 어두운 그라데이션). 타이틀 키아트(021)를 **가로 16:9**로 다시 뽑아 화면 전체 배경에 아주 어둡게 깔 수 있다. 연결(게임 세션): `body` 배경.

## U10 — 엔딩 일러스트 3종

VISUAL_TODO E의 엔딩 3장(헌납·진엔딩·영주에게 맞선 자) + 숨겨진 엔딩 "섬을 떠난 자"(밤안개 속 밀수꾼의 작은 배, 멀어지는 섬과 성당 첨탑). 연결(게임 세션): `TombCard`의 `.tomb-ending` 위에 장면 띠(`SceneBanner`)로.

---

## 그림 없이 이미 해 둔 것 (참고)

- 화면 전체 스킨: 금박 모서리 패널, 입체 버튼, 광택 게이지, 주차 표시, 분할 탭, 묘비, 아래에서 올라오는 시트 — `src/ui/theme.css`
- UI 아이콘 30여 종(메뉴·장비·돈·AC·등급·HP·포만감·피로·시간·마석·야영·물약·주문서·할 일 아이콘 등) — `src/ui/icons.tsx`(SVG). U04·U05·U06 도트 아이콘이 오면 그 자리만 바꾼다
- 글꼴: 제목·이야기 Gowun Batang, 본문 Noto Sans KR, 로고 Cinzel(Google Fonts)
