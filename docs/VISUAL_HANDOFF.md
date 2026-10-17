# 비주얼 작업 인수인계 (2026-10-13, 최신 갱신 2026-10-14)

게임의 비주얼(그림·UI 모양)은 별도 세션에서 작업한다. 이 문서는 그 세션이 처음 읽을 안내서다.
게임 규칙·수치·로직은 이 세션(게임플레이 세션)이 계속 맡는다. 전체 맥락은 `docs/HANDOFF.md`, 아트 원칙과 프롬프트 기록은 `docs/ART_PROMPTS.md`.

## 1. 한눈에

- 텍스트 기반 던전크롤 로그라이크 "DDD — 열여섯 살, 미궁으로". 참고작: slbcareer.com, kickru.com, 1in8b.life(텍스트+카드, 턴 결과 리포트)
- 모바일 세로 화면 우선(390×844 기준), 어두운 갈색 + 탁한 금색 톤, 16비트 도트 일러스트
- 들어간 그림: 직업 3종(전신·얼굴), 몬스터 13종, 편린 등급 아이콘, 장소 그림 10장, 방 아이콘, 1섹터 장비 아이콘 21종(아래 5절). **할 일은 맨 아래 10절**
- 플레이 링크(비공개 아티팩트): https://claude.ai/artifact/3hRQb1UtFGqHvFAGstGNdy

## 1-1. 지금 작업 방식(2026-10-14부터)

- 비주얼 세션은 **이미지 파일만 넣는다**: 후처리한 PNG를 `public/`·`assets/`에 넣고, `src/ui/art.ts` 목록에 데이터 한 줄만 등록, `docs/ART_PROMPTS.md`에 기록하고 푸시한다
- **빌드·배포는 게임(빌드) 세션이 한다.** 비주얼 세션은 `vite build`·아티팩트 배포를 하지 않는다(타입 검사·테스트로 등록 오타만 확인)
- 화면 코드 변경이 필요한 그림(예: 2섹터 밤 장면)은 파일과 연결 방법 메모만 남긴다

## 2. 작업 분담(충돌 방지)

| 비주얼 세션 | 게임플레이 세션 |
|---|---|
| `src/ui/styles.css`, 이미지 파일(`public/`, `assets/`), `docs/ART_PROMPTS.md`, `tools/sprite.py` | `src/game/**`(규칙·수치·봇), `scripts/`(밸런스 시뮬) |
| 화면 컴포넌트의 마크업·클래스 이름 변경(`src/ui/*.tsx`) | 화면에 새 정보·버튼 추가(`src/ui/*.tsx`) |

- `src/ui/*.tsx`는 양쪽이 다 건드린다. **작업 전 `git pull origin master`, 작은 단위로 자주 커밋·푸시**한다. 같은 파일을 크게 갈아엎는 리팩터링은 상대 세션과 겹치지 않을 때만
- 그림을 게임 데이터에 연결할 때(몬스터별 그림 등)는 `src/game` 쪽 정의에 **필드 하나만 추가**하는 정도로 한다. 예: `MonsterDef`에 `img?: string`, `ClassDef`에 `portrait?: string`. 규칙 로직은 바꾸지 않는다
- 테스트(`npx vitest run`)와 타입 검사(`npx tsc -b`)는 푸시 전에 항상 통과시킨다

## 3. 아트 방향(확정)

`docs/ART_PROMPTS.md`의 공통 규칙이 기준이다. 요약:

- **기준 이미지**: `assets/reference/style_reference.png` (모험가 소년, 37×90 도트). 모든 새 그림은 이 이미지를 Gemini에 같이 첨부하고 프롬프트 맨 앞에 `Match the exact art style, outline, palette and pixel scale of the attached reference image.`를 붙인다
- 정면 3/4 시점, 사실적 비율(SD 아님), 1px 어두운 외곽선, 안티앨리어싱·블러·그라데이션 없음, 16색 내외
- 팔레트: 어두운 갈색, 바랜 황토, 탁한 금색 포인트 `#cf9a44`, 채도 낮은 피부
- 배경은 단색 마젠타 `#FF00FF`(후처리로 투명하게)
- 세계관 톤: 그림다크 판타지. 열여섯 살만 들어갈 수 있는 미궁, 매달 세금, 퍼머데스, 성당(유일신교)이 금지한 옛 신들

## 4. 그림 만드는 흐름

1. Claude가 프롬프트를 쓴다(`docs/ART_PROMPTS.md`에 번호 붙여 기록)
2. 사용자가 Gemini(구독, API 키 없음)에서 생성 → **채팅에 이미지 첨부**. API 키·토큰을 채팅에 붙여 달라고 요청하지 않는다
3. 후처리: `python3 tools/sprite.py 입력.png 출력.png` — 마젠타 배경·Gemini 워터마크 제거, 100×100 도트 격자 복원, 캐릭터 둘레로 자르기. `--grid`로 격자 수 조정, 캐릭터가 오른쪽 아래 모서리에 걸치면 `--keep-watermark`
   - 검증됨: 기준 이미지를 512 캔버스에 키웠다가 다시 돌리면 픽셀 단위로 똑같이 복원된다
4. 원본 도트 크기 PNG를 `assets/reference/`(원본 보관)와 `public/`(게임이 쓰는 파일)에 둔다. 화면에서는 CSS `image-rendering: pixelated`로 정수배 확대
5. 얼굴 초상은 전신에서 머리~어깨를 정사각형으로 잘라 만든다(모험가: 30×30)

## 5. 지금 있는 그림과 쓰는 곳

연결은 모두 `src/ui/art.ts` 한 곳(`CLASS_ART`, `MONSTER_ART`, `FRAG_ICON`, `SCENE_ART`). 원본은 `assets/`, 게임이 쓰는 파일은 `public/`. 프롬프트·후처리 기록은 `docs/ART_PROMPTS.md` 001~021.

| 그림 | 파일(`public/`) | 쓰는 곳 |
|---|---|---|
| 직업 전신 3종 | `hero.png`(모험가 37×90), `warrior.png`(35×86), `mage.png`(44×86) | 타이틀(모험가), 직업 선택 카드 설명(2배) |
| 직업 얼굴 3종 | `hero-face.png`, `warrior-face.png`, `mage-face.png`(30×30) | 헤더 초상(2배 60px), 캐릭터 시트(3배 90px) |
| 몬스터 13종 | `mon-{rat,goblin,skeleton,boss,goldrat,jewelgoblin,crystalskel}.png` + 2섹터 `mon-{wolf,alphawolf,crow,harpy,warhorse,wraith}.png` — 모두 같은 월드 스케일 | 도감 카드 위 무대(모두 2배, 안 본 몬스터는 실루엣), 미궁 로그의 "나타났다" 줄(1배, `LogLine.mons`) |
| 편린 등급 아이콘 4종 | `frag-1~4.png` | 캐릭터 시트 편린 목록·도감(1배), 미궁 편린 획득 카드(2배). 처음 보는 편린은 늘 같은 실루엣 |
| 장소 그림 10장 | `scene-{training,tavern,forest,market,smithy,temple,office,grave,dungeon1,title}.png` — 모두 200격자 장면을 띠로 자른 것 | 훈련 카드·주간 결과 카드(훈련/탐문/외부 탐험), 상점가·대장간·신전 카드, 정산 세금 카드, 묘지 화면, 미궁 지도 칸 배경(`dungeon`+섹터), 타이틀 키아트(소년 2배를 위에 세움). `SceneBanner`, 좁은 화면은 `focus` 쪽을 남기고 자른다 |

## 6. 필요한 그림(우선순위 제안)

1. ~~직업 초상~~ (완료): 전사·마법사의 전신 + 얼굴(모험가와 같은 규격). 지급 장비와 맞춘다 — 전사: 장검, 가죽 갑옷 / 마법사: 참나무 지팡이, 수습생 로브
2. ~~몬스터 7종~~ (완료): 쥐, 고블린(비겁, 녹슨 단검), 스켈레톤 병사(뼈 검), 거대한 돌연변이 쥐(1섹터 보스, 소만 한 크기), 희귀 개체 3종 — 마석 먹은 쥐(배가 빛남), 보석 박힌 고블린(보석 박힌 곤봉), 마석 갑옷 스켈레톤(갑옷이 통째로 마석). 설정 문장은 `src/game/data.ts`의 `MONSTERS[].note`
3. ~~편린 아이콘~~ (등급별 4종 완료): 등급별 4종(하급·중급·상급·보스) 또는 몬스터별 7종. 설정 문장은 `src/game/fragments.ts`의 `flavor`. UI 등급 색: 하급 `--dim`, 중급 `--ok`, 상급 `--accent`, 보스 `--danger`
4. **방 종류 아이콘**(미궁 지도·선택지): 입구, 빈 방, 적의 기척, 함정, 보물, 기록물, 성소, 계단, 보스, 차원문(`ROOM_LABEL`, `src/game/dungeon.ts`)
5. ~~마을 장소 그림~~ (8곳 + 미궁 1섹터 + 타이틀 완료): 직업교관(훈련), 술집(탐문), 영지 밖 숲(외부 탐험), 상점가, 대장간, 신전(편린 지우기), 관공서(세금), 묘지. 원 기획의 장소 목록은 `docs/DESIGN.md` 4절
6. **장비 아이콘**: `src/game/gear.ts`의 `GEAR` 21종(9슬롯)
7. 묘비 카드, 정산 카드 장식, 타이틀 배경 등 분위기용

## 7. UI 구조

- 스택: Vite 5 + React 18 + TypeScript. 외부 UI 라이브러리 없음, 스타일은 `src/ui/styles.css` 한 파일
- 폰트: `"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui` (웹폰트를 따로 불러오지 않음 — 아티팩트 배포는 Google Fonts만 허용)
- 색 토큰(`:root`): `--bg #100d0a`, `--panel #1a1510`, `--panel-2 #221b13`, `--border #3a2e1f`, `--text #c9b892`, `--dim #7d6d52`, `--bright #f1e4c4`, `--accent #cf9a44`, `--danger #c0564d`, `--ok #86a865`, `--violet #9a7bc0`(기술). 다크 전용
- 게임 화면 틀(`GameScreen`, `src/ui/components.tsx`): 상단 바(타이틀·장비·⚙ 설정) → 고정 헤더(얼굴·HP·소지금) → **가운데만 스크롤** → 하단 고정 도크(선택지 또는 로그). 로그가 한 줄씩 흐르는 동안에도 선택지 위치가 흔들리지 않게 하려고 이렇게 고정했다(사용자 요청). 이 원칙은 유지할 것
- 로그 줄 종류별 색: `.log-line.{normal|hit|crit|miss|hurt|system|good|story|skill}`

| 화면 | 파일 | 비고 |
|---|---|---|
| 타이틀 | `TitleScreen.tsx` | 전신 그림, 이어하기·새 인생·묘지·도감, 저장 내보내기 |
| 인트로·캐릭터 생성 | `CreateScreen.tsx` | 직업 카드, 후보 3장 뒤집기(`.cand`), 스카우트 리포트 |
| 마을 | `TownScreen.tsx` | 탭 3개(이번 주 할 일 / 상점가·대장간·신전 / 모험가), 하단 도크는 로그 |
| 주간 결과 카드 | `WeekResultScreen.tsx` | 참고작 스타일 결과 리포트 |
| 미궁 | `DungeonScreen.tsx` | 생존 게이지 3개, SVG 방 지도(`FloorMap`), 로그, 도크에 길 선택·함정/상자/편린/장비 선택(`.loot-card`) |
| 월말 정산 | `SettlementScreen.tsx` | 환전·세금 |
| 사망·묘비 | `DeadScreen.tsx`, `TombCard.tsx`, `GraveyardScreen.tsx` | |
| 캐릭터 시트 | `CharacterSheet.tsx` | 바텀시트 모달: 장비 9슬롯, 전투 수치, 능력치, **훈련 갈래(레벨표)**, 기술, 편린, 소지품 |
| 몬스터 도감 | `CodexScreen.tsx` | 안 본 몬스터는 `???`, 편린은 흡수해 본 것만 공개 |

`styles.css`는 주석 머리말로 구역이 나뉘어 있다(카드·버튼 / 타이틀 / 인트로·생성 / 헤더·상태 / 결과 카드 / 로그 / 던전 / 묘비 / 고정 화면 틀 / 얼굴 초상 / 캐릭터 화면 / 직업 선택·장비 발견 / 편린 / 몬스터 도감).

## 8. 확인·배포

- 개발: `npm install`(npm 기본 레지스트리가 막혀 `.npmrc`로 yarn 미러 사용) → `npx vite`
- **화면 스크린샷 한 번에 찍기**:
  ```
  npx vite build && npx vite preview --port 4173 &
  bun tools/make-states.ts          # 봇으로 마을·주간 결과·미궁·편린/장비 선택·정산 상태를 shots/states/*.json으로
  NODE_PATH=$(npm root -g) node tools/screenshots.cjs   # shots/*.png (390×844)
  ```
  타이틀·인트로·생성·마을·주간 결과·미궁·편린 선택·장비 선택·정산·캐릭터 시트·도감이 찍힌다(`shots/`는 git 제외). 그림·스타일을 바꾼 뒤 이걸로 전후 비교한다
- Playwright는 전역 설치(`NODE_PATH=$(npm root -g)`), 크로미움은 `/opt/pw-browsers`에 있다. `playwright install`은 하지 않는다
- 배포: `npx vite build` → `dist/assets/*`를 아티팩트 폴더 `assets/`로 복사, 아티팩트 `index.html`의 js/css 해시 파일명 교체 → Artifact publish(이전 해시 파일은 `null`로 제거). 그림을 추가하면 `hero.png`처럼 아티팩트 `files`에도 같이 올린다. 다른 세션에서 같은 링크를 갱신하려면 위 URL을 `url`로 넘기고 먼저 read 한다
- 아티팩트 제약: 외부 스크립트는 cdnjs 등 허용 CDN만, 스타일시트는 Google Fonts만, 나머지는 인라인/동봉. 전체 16MB 이하

## 9. 지켜야 할 것

- 텍스트 게임이다: 그림은 분위기와 식별을 돕는 정도. 그림이 없어도 모든 정보가 글로 읽혀야 한다(접근성, 로딩 실패 대비)
- 모바일 폭 390px에서 가로 스크롤이 생기지 않게, 터치 대상은 충분히 크게
- 도감의 "모르는 것은 ???" 규칙(안 본 몬스터, 흡수 안 한 편린의 능력치)을 그림으로 누설하지 않는다 — 안 본 몬스터는 실루엣이나 물음표로
- 도트 그림은 정수배 확대 + `image-rendering: pixelated`만. 부드럽게 늘리지 않는다

## 10. 할 일 (게임플레이 세션 요청 — 최신이 위)

게임플레이 세션이 새 기능을 넣을 때마다 여기에 그림·모양 작업을 적는다. 끝낸 항목은 ~~취소선~~으로 남겨 두면 된다.

### 2026-10-15 — 5섹터 "바닥없는 균열"
5섹터가 들어갔다(기획 `docs/SECTOR5_DRAFT.md`, 이름·설명은 `src/game/data.ts`·`gear.ts`). 그림이 없으면 글자만 나온다.

33. **몬스터 13종** (우선) — `MONSTER_ART`: 균열 박쥐 떼 `riftbat`, 그림자 촉수 `tendril`, 굶주린 망령 `hungerwraith`(사람 아님 — 굶주림이 형체를 얻은 것), 벼랑 거미 `ledgespider`, 공허 눈 `voideye`, 균열 벌레 `riftworm`, 낙하 잔해 덩어리 `fallenheap`(1~4섹터 몬스터의 잔해가 엉긴 것), 희귀 마석 비늘 박쥐 `scalebat`·마석 눈동자 `manaeye`·마석 껍질 균열 벌레 `shellworm`(색 바꾸기 가능), 정예 허기의 어미 `hungermother`, 보스 심연의 아귀 `abyssmaw`(큰 그림 — 틈 위 바위에 뿌리박은 거대한 입과 촉수), 히든 바닥의 청소부 `sweeper5`
34. **미궁 5섹터 장면** `scene-dungeon5.png` — 바닥 없는 균열(벼랑길·뿌리와 쇠사슬 다리·아래는 검게). 날숨/들숨 두 톤이면 좋다. `SCENE_ART`에 `dungeon5`
35. **풍요의 제단 방 아이콘** `plenty` — `ROOM_ICON`(지도 노드 `.map-node.t-plenty`)
36. **5섹터 장비 아이콘 9종**: abyssblade, voidstaff, shadowhide, lanternhelm, clawboots, batcloak, voidring, ghoulfang, twofacebowl / 소모품 밧줄 `rope`, 증표 "아귀의 검은 이빨"
37. (선택) 상태: 미궁 제목의 "들숨·날숨", 갈림길 버튼의 "벼랑 위", 벼랑길 선택 카드(밧줄·조심히·그냥·뛰어내리기)가 지금은 글자뿐
38. **6섹터 몬스터 13종** (우선) — `MONSTER_ART`: 기도문 떼 `litany`, 떠도는 향로 `censer`, 빈 성갑 `hollowknight`(속이 빈 성기사 갑옷에 빛), 참회의 사슬 `penitchain`, 처형인의 갑주 `executioner`(머리 없는 갑옷과 도끼 — 사람 아님), 저주받은 성물 `reliquary`, 밀랍 신도 `waxfaithful`(기도가 굳은 밀랍 인형 — 사람 아님), 눈 많은 날개 `seraph`, 삼켜진 것 `swallowed`, 희귀 마석 촛대 `candle`·마석 성배 `grail`·마석 날개 조각 `wingshard`, 정예 주인 없는 주교관 `mitre`(속이 빈 주교관과 제의)
39. **6섹터 보스급 4종** — 봉인의 수호자 `guardian`(옛 신들의 돌 시험관), 짝을 삼킨 빛의 화신 `avatar`(얼굴 없는 빛, 얼굴 자리에 다른 얼굴이 비침 — 2단계는 날개가 타 버린 모습이면 좋다), 심판의 눈 `judgeeye`(천장에서 내려오는 거대한 눈과 날개), 심문관장 `grandinquisitor`(기존 이단심문관 변형)
40. **결전** — 늙지 않는 영주 `lord`(사람 — 마을 영주성), 유일신의 아바타 `godavatar`
41. **6섹터 장면** `scene-dungeon6.png`(흰 회랑 — 섬의 성당과 같은 대리석) / `scene-sanctum.png`(3층 차원문의 성소 — 여덟 개의 부서진 제단, 결계에 박힌 셉터). `SCENE_ART`에 `dungeon6`
42. **방 아이콘** — 봉헌함 `offerbox`, 고해실 `confession`, 옛 신들의 제단 `altars`, 셉터의 제단 `scepter`, 성광 방 표시(지도 노드 `.map-node.t-…`, 갈림길 버튼의 "성광 방" 글자)
43. **엔딩 일러스트** — 헌납 2장(영주에게 셉터를 바침 / 떠나는 배와 가라앉는 섬), 진엔딩 3장(영주성 결전 / 멈춘 성당 종 / 돌아온 여덟 신), 결전 패배 1장(꽃 놓인 묘비). 지금은 엔딩 묘비 카드(`.tomb-ending`, `.end-true`·`.end-offering`)에 글만 나온다
44. **6섹터 장비 아이콘 9종**: sunsteel, relicstaff, towershield, pilgrimboots, hollowplate, confessmask, chainbelt, pairring, oldsigil / 소모품 옛 신의 향 `incense` / 유물 8종(신마다 하나 — 캐릭터 시트 신앙 카드에 이름만)
45. (선택) 타이틀 화면: 진엔딩을 본 뒤에는 성당 대신 여덟 제단(지금은 "옛 신들이 돌아왔다" 카드만), 셉터의 제단 선택 카드(잠긴 진엔딩은 ??? 버튼)
46. (2026-10-17) **앱 아이콘** — 정사각 `icon-192.png`·`icon-512.png`(홈 화면 설치·앱 포장용, 배경 꽉 채움). `public/manifest.webmanifest`의 `icons`에 두 줄. 지금은 `hero.png`(37×90)라 설치 아이콘이 찌그러진다 / 새 버전 알림 띠 `.update-banner`(지금은 기본 색만)

### 2026-10-14 — 4섹터 "불타는 광산 갱도"
4섹터가 들어갔다(기획 `docs/SECTOR4_DRAFT.md`, 이름·설명은 `src/game/data.ts`·`gear.ts`). 그림이 없으면 글자만 나온다.

26. **몬스터 13종** (우선) — `MONSTER_ART`: 불씨 박쥐 `emberbat`, 불도롱뇽 `salamander`, 광석 갑충 `orebeetle`, 화염 정령 `fireelem`, 굴착 벌레 `burrower`, 서리 망령 `frostwraith`, 얼음 트롤 `icetroll`, 희귀 금맥 박쥐 `goldbat`·마석 광석 갑충 `manabeetle`·마석 서리 정령 `frostspirit`(색 바꾸기 가능), 정예 광차 미믹 `cartmimic`, 보스 화로 어미 도롱뇽 `furnacemother`(반쪽 불·반쪽 얼음), 히든 갱도의 청소부 `sweeper4`(이어 붙인 광차)
27. **미궁 4섹터 장면** `scene-dungeon4.png` — 갱도(버팀목·녹슨 레일·벽 틈의 용암, 깊은 쪽은 푸른 얼음). `SCENE_ART`에 `dungeon4`
28. **버려진 화약고 방 아이콘** `magazine` — `ROOM_ICON`(지도 노드 `.map-node.t-magazine`)
29. **4섹터 장비 아이콘 9종**: fireleather, furcoat, minerpick, minerhelm, safetyboots, canary, emberring, frostwand, hingeshield
30. (선택) 소모품 아이콘 화상 연고 `salve`·장작 `firewood`·화약통 `powder` / 상태: 부상 카드의 "· 화상"·"· 동상" 표시와 냉기 줄(`.hurt-row`), 미궁 제목의 "바람·고임", 갈림길 버튼의 "뜨거운 방·얼음 구역·지하수"가 지금은 글자뿐
31. (선택) **함정 그림** 낙반·폭주 광차·가스 주머니·증기·얇은 얼음
32. **숏컷 버튼** — 4주차 준비 화면의 "숏컷 — 곧장 4섹터로"(`.btn.wide`). 지금은 보통 버튼

### 2026-10-14 — 직업 기술 10~16레벨
훈련 레벨표(`LevelTable`)가 16레벨까지 길어졌다(기본 접힘 그대로). 특수 칸 이름이 각인·특화·낙인·궁극기·화신으로 나뉜다(`.lv-kind`).

24. **레벨표 특수 줄 구분** — `tr.special`이 4·7·10·13·16 다섯 줄. 13(궁극기)·16(화신) 줄은 한 단계 더 눈에 띄면 좋다(예: 테두리 금색). 390px 폭에서 표가 세로로 길어지니 머리 줄 고정(`position: sticky`)을 검토
25. (선택) **궁극기·화신 아이콘** — 10갈래 × 2(13·16). `SKILL_ICON`(새 목록)에 등록하면 게임플레이 세션이 기술 목록에 연결

### 2026-10-14 — 3섹터 "물에 잠긴 사원"
3섹터가 들어갔다(기획 `docs/SECTOR3_DRAFT.md`, 이름·설명은 `src/game/data.ts`·`gear.ts`). 그림이 없으면 글자만 나온다.

19. **몬스터 13종** (우선) — `MONSTER_ART`에 id 한 줄씩: 역병 쥐떼 `plaguerat`, 진흙 거머리 `leech`, 독두꺼비 `toad`, 산성 달팽이 `snail`, 곰팡이 괴물 `mold`, 사제복 균사체 `shroudmold`(사람 아님 — 썩은 사제복 안의 균사), 잠긴 석상 `gargoyle`, 희귀 진주 먹은 거머리 `pearlleech`·마석 균모자 `sporecap`·마석 껍질 달팽이 `shellsnail`, 정예 익사한 성가대 `drownedchoir`(종에 붙은 따개비 군체), 보스 가라앉은 본당의 균모 `mycomother`(신상을 뒤덮은 곰팡이 군체), 히든 사원의 청소부 `sweeper3`
20. **미궁 3섹터 장면** `scene-dungeon3.png` — 물에 잠긴 사원(이끼 낀 기둥·물 위 공양 그릇·흰 균사). `SCENE_ART`에 `dungeon3` 한 줄
21. **공양 제단 방 아이콘** `altar` — `ROOM_ICON`에 한 줄(지도·갈림길 버튼). 지도 노드 색은 `.map-node.t-altar`
22. **3섹터 장비 아이콘 9종**: oiledleather(기름 먹인 가죽 갑옷), bronzeblade(청동 장검), corkshield(코르크 방패), waders(물장화), antidotering(해독의 반지), sporemask(포자 가면), leechcharm(거머리 이빨 부적), tidestaff(조수의 지팡이), choirbell(성가대의 녹청 종)
23. (선택) **소모품 아이콘** 숫돌 `whetstone`, 해독초 `antidote` / 상태 표시 — 부상 카드에 부식·마비·독 줄이 `.hurt-row`로 붙는다. 미궁 제목에 "밀물·썰물", 갈림길 버튼에 "물에 잠김·깊은 물" 표시가 글자로만 있다

### 2026-10-14 — 끝없는 미궁
2섹터 차원문 너머, 끝없이 내려가는 미궁(`src/game/endless.ts`). 함정 없이 몬스터만, 층마다 강해진다. 지금은 1섹터 미궁 그림을 같이 쓴다.

17. **끝없는 미궁 장면** `scene-endless.png` — 아래로 끝없이 이어지는 나선 계단과 어둠(여러 섹터 몬스터가 뒤섞여 올라오는 느낌). `SCENE_ART`에 `endless` 한 줄이면 미궁 지도 배경에 나온다 (2026-10-14 변경: 3섹터가 생겨 `dungeon3`은 물에 잠긴 사원 장면이 됐다)
18. (선택) **강해진 몬스터 표시** — 깊은 층 몬스터에 붉은 기운 같은 덧칠(지금은 그림 그대로)

### 2026-10-14 — 히든 보스 "미궁의 청소부"
한 층에 너무 오래 머물면 나타나 쫓아오는 히든 보스(`src/game/sweeper.ts`). 지금은 그림이 없어 이름만 나온다.

14. **청소부 몬스터 그림 2종** — `sweeper1` 미궁의 청소부(녹슨 갈퀴 같은 팔, 먼지와 녹이 엉긴 거대한 형체, 1섹터 지하 미궁), `sweeper2` 전쟁터의 청소부(부러진 깃대를 엮은 팔, 2섹터 초원). 보스보다 크게(다른 몬스터의 1.5~2배). `MONSTER_ART`에 id 한 줄씩
15. (선택) **청소부 편린 아이콘** `FRAG_ICON`의 `sweeper1`·`sweeper2`
16. **지도 위 청소부 표시** `.map-sweeper`(지금은 붉은 점선 원), 경고 줄 `.sweeper-warn`

### 2026-10-14 — 훈련소 허수아비·레벨표 접기
마을 "이번 주 할 일"에 **훈련소 허수아비**(시간 없이 10라운드 딜 측정, `DummyPanel` — `src/ui/TownScreen.tsx`)가 생겼다. 훈련 화면의 레벨표는 기본으로 접혀 있다(`.fold-toggle`).

11. **허수아비 그림 3종** — 짚 허수아비(`dummy`), 작은 허수아비(`dummyPack`), 갑옷 허수아비(`dummyArmor`). 몬스터와 같은 규칙으로 `MONSTER_ART`에 id 한 줄씩 등록하면 된다(지금은 패널에 그림 자리가 없으니, 등록해 주면 게임플레이 세션이 패널 위에 붙인다)
12. **허수아비 결과 모양** — `.dummy-total`(큰 숫자), `.dummy-round`·`.dummy-src`(라운드별·출처별 막대), `.dummy-bar`. 막대는 지금 강조색 하나
13. **레벨표 접기 버튼** `.fold-toggle`(▸/▾ 글자 버튼)

### 2026-10-14 — 안내 카드·용어 사전·전투 로그 접기
처음 하는 사람용 안내(`src/ui/tips.ts`, `TipCard`/`Glossary` — `src/ui/components.tsx`)와 일방적인 전투 접기(`LogView`)가 들어갔다. 지금은 기본 글자 상자 모양이다.

7. **안내 카드** `.tip-card` — 화면 맨 위에 뜨는 한 장짜리 안내(제목·본문·"알겠다"·"안내 끄기"). 양피지 쪽지 느낌이면 좋다. 장면 그림을 가리지 않게 높이는 낮게
8. **용어 사전 창** — 설정 → "용어 사전". 안내 전체 목록(본 것/안 본 것 구분이 색만이 아니게)
9. **접힌 전투** `.fold-sum`(요약 줄 버튼, 누르면 펼침), `.log-line.folded`(펼친 뒤의 세부 줄). 요약 줄은 다른 로그보다 한 단계 흐리게, 펼칠 수 있다는 표시(▸/▾)는 유지
10. **묘비 사망 요약** `.tomb-notes`(묘비 아래쪽 "무엇이 죽음을 불렀나" — 사실 줄 `·`, 조언 줄 `→` 강조색). 묘비 그림 안쪽 글씨처럼 보이면 좋다

### 2026-10-14 — 직업 훈련 재설계(레벨표)
세 직업의 훈련이 "레벨마다 정해진 기술" 구조로 바뀌었다(기술표: `docs/MAGE.md`, `docs/WARRIOR.md`, `docs/ADVENTURER.md`).
훈련 화면과 캐릭터 시트에 **훈련 레벨표**가 새로 들어갔다(`LevelTable`, `BuildSummary` — `src/ui/components.tsx`).

1. **훈련 갈래 아이콘 10종** (우선) — 레벨표 머리 칸에 글자 위에 뜬다. 16×16 또는 20×20 도트, 1배로 쓴다.
   - 마법사 원소: 화염 `fire`, 서리 `frost`, 번개 `bolt`, 대지 `earth`
   - 전사 방향: 수호 `guard`(방패), 검투 `glad`(검), 광전 `berserk`(도끼·핏자국)
   - 모험가 갈래: 전사형 `fighter`, 마법사형 `caster`, 민첩형 `rogue`
   - 연결: `public/line-<id>.png`, `src/ui/art.ts`의 `LINE_ICON`에 `<id>: { src: "./line-<id>.png", w, h }` 한 줄씩. 코드는 이미 연결돼 있다(없으면 글자만)
2. **레벨표 모양 다듬기** — 클래스: `.lvtable`(표), `tr.special`(4·7·10레벨 특화 줄), `tr.now`(이번 레벨 줄), `td.lt-learned`(배움, ✓), `td.lt-next`(이번에 고를 수 있음, 버튼), `td.lt-next.sel`(선택), `td.lt-missed`(놓침, 취소선), `td.lt-future`, `.lv-legend`, `.special-note`(특수 훈련 안내 상자), `.skill-kind.warn`(방패 없음 경고), `.line-icon`.
   - 상태는 색만으로 구분하지 않는다(✓·취소선·버튼 밑줄 유지). 390px 폭에서 마법사 4칸이 한 화면에 들어가야 한다
   - 지금 화면: 훈련 패널(마을 → 이번 주 할 일 → 훈련), 캐릭터 시트 "훈련 갈래" 카드
3. (선택) **특화 각인 아이콘** — 4레벨 특화 10종(불의 각인·서리의 각인·번개의 각인·대지의 각인, 수호의 각인·검투의 각인·광전의 각인, 칼잡이의 각인·주문꾼의 각인·그림자의 각인). 기술 목록에서 쓸 수 있게 `SKILL_ICON`(새 목록)으로 등록하면 게임플레이 세션이 화면에 연결한다

### 2섹터에서 아직 그림이 없는 것
4. ~~**몬스터 6종**~~ (완료 2026-10-14, 플레이 링크에 배포함)
5. **미궁 2섹터 장면** `scene-dungeon2.png` — 잊힌 전쟁터의 초원(무너진 참호·녹슨 깃발). `SCENE_ART`에 `dungeon2` 한 줄이면 미궁 지도 배경에 바로 나온다(코드가 `dungeon${섹터}`를 찾음)
6. **2섹터 장비 아이콘 10종**: wraithspear(망령의 녹슨 창), warbanner(녹슨 군기 방패), harpycharm(하피 깃털 부적), horseshoe(군마의 편자 장화), battlering(전장의 반지), wolfhide(늑대 가죽 갑옷), steelsword(강철 장검), steelshield(강철 방패), oakstaff(마력이 깃든 지팡이), queencloak(하피 여왕의 깃털 망토). 이름·설명은 `src/game/gear.ts`
