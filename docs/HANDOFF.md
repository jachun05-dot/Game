# 작업 인수인계 (2026-10-14 갱신)

새 세션이나 대화 요약 뒤에 이어서 작업할 때 이 파일부터 읽는다. 날짜별 상세는 `docs/NIGHT_LOG.md`, 결정은 `docs/DECISIONS.md`.

## 프로젝트
- 레포 `jachun05-dot/Game`, 브랜치 `master`. 텍스트 기반 던전크롤 로그라이크 웹게임 "DDD — 열여섯 살, 미궁으로"
- 플레이 링크(아티팩트, 링크가 있으면 누구나): https://claude.ai/artifact/3hRQb1UtFGqHvFAGstGNdy
  - 배포: `npx vite build` → `dist/assets/index-*.js/css`를 스크래치패드 `artifact/assets`로 복사, `artifact/index.html`의 파일명 교체 → 라이브 페이지와 이전 파일을 먼저 읽어 내 사본과 같은지 확인 → Artifact publish(`files`: 새 파일 경로, 이전 해시 파일은 `null`). 비주얼 세션이 올린 새 PNG(`public/*.png`)는 확인한 뒤 함께 올린다
- 외부 웹 페이지(GitHub Pages, 공개): https://jachun05-dot.github.io/Game/ — `gh-pages` 브랜치에 `dist/` 결과물 + `.nojekyll`을 올리면 자동 배포. 아티팩트와 달리 외부 전송이 막히지 않아 테스터 기록 자동 수집용(2026-10-14 시험: 아티팩트는 connect-src·img-src로 모든 외부 전송 차단)
- 밸런스 대시보드: https://claude.ai/artifact/EdnPKEXh8AyH3kpxd8nL42 (데이터 `docs/balance/*.json`)
- 참고작: slbcareer.com(이번 생은 야구다), kickru.com(벤치에서 발롱까지), 1in8b.life(80억 분의 1) — 텍스트+카드, 턴 결과 리포트, 성장

## 세션 분담
- **비주얼 세션**: 그림(PNG)과 `src/ui/art.ts` 데이터 줄만 master에 푸시한다. 빌드·배포는 하지 않는다
- **게임플레이 세션(이쪽)**: 규칙·UI·빌드·배포. 비주얼이 할 일은 `docs/VISUAL_HANDOFF.md` 10절에 날짜별로 적고, 끝난 항목은 취소선
- 아트: 사용자가 Gemini(구독, API 키 없음)로 생성 → 채팅에 첨부 → 마젠타 배경·워터마크 제거, 도트 복원(`docs/ART_PROMPTS.md`)

## 사용자 방침(지켜야 할 것)
- 버그 수정만 할 때는 규칙·수치를 바꾸지 않는다
- 난이도는 더 올리지 않는다(전체적으로 조금 쉬운 쪽). 2섹터는 쉬어 가는 곳이라 지금 정도가 적당
- 몬스터 내성은 아직 넣지 않는다
- 미궁에 사람은 나오지 않는다(이단심문관만 예외)
- API 키·토큰을 요구하지 않는다. PR은 요청할 때만
- 푸시 전 `git fetch origin master && git merge`

## 문서
- `docs/DESIGN.md` 기획(14절 = 텍스트 진행 구조), `docs/DECISIONS.md` 결정 기록(시간순), `docs/NIGHT_LOG.md` 작업 일지
- 직업 기술표: `docs/MAGE.md`, `docs/WARRIOR.md`, `docs/ADVENTURER.md` / 최신 밸런스 `docs/CLASS_BALANCE.md`
- `docs/PROTOTYPE.md` 시스템별 구현 기록(절마다 날짜, 옛 절은 표시해 둠)
- `docs/SKILLS_10_16_DRAFT.md` 직업 기술 10~16레벨(구현 완료, 13·16레벨 훈련은 4·5섹터 증표가 있어야)
- `docs/SECTOR3_DRAFT.md`·`SECTOR4_DRAFT.md` 3·4섹터 기획(구현 완료), `SECTOR5_DRAFT.md`·`SECTOR6_DRAFT.md` 5·6섹터 초안
- `docs/VISUAL_HANDOFF.md` 비주얼 세션 전달(분담 규칙, 아트 방향, UI 구조, 할 일 10절)

## 환경 메모
- npm 기본 레지스트리 차단 → `.npmrc`로 `registry.yarnpkg.com` 사용
- 테스트 `npx vitest run`(164개), 타입 `npx tsc -b`, 시뮬은 `bun`
- 브라우저 확인: Playwright(`NODE_PATH=$(npm root -g)`), `npx vite preview --port 4173`. `pkill`을 명령 체인에 섞지 않는다
- 시뮬레이션
  - `bun scripts/sim-report.ts [판수] [샤드] [샤드 수]` 직업 3 × 목표 3 × 신앙 9 = 81조합(대시보드 데이터)
  - `bun scripts/sim-mage.ts …` 직업·갈래별 방식(`scripts/plans.ts`, `PLANS=` 접두어 필터, `GOAL=`)
  - `bun scripts/sim-gate.ts …` 같은 영웅의 레벨 3 vs 3→4 특수 훈련 후 비교
  - `bun scripts/sim-sector2.ts`·`sim-sector3.ts`·`sim-sector4.ts`, 퍼저(SCEN=s3·s4·late 추가) `scripts/fuzz.ts`(SCEN=mix)·`fuzz-ui.tsx`·`fuzz-determinism.ts`
  - 옛 스크립트 `sim-all/sim-boss/sim-month1/sim.ts`는 2026-10-13 기준선용

## 코드 구조
- `src/game/` 순수 로직. `engine.ts`의 `act/apply(action)`가 진입점, 시드 RNG(`rng.ts`)로 결정론적. 행동마다 HP를 최대치로 자른다
  - `town.ts` 생성·직업·주간 활동·상점·훈련·정산, `dungeon.ts` 층 생성·이동·함정·보물·야영·귀환, `combat.ts` 자동 전투(한 행동 안에서 끝남, 일방적인 전투는 로그 접기)
  - `elements.ts` 훈련 레벨표(마법사 원소·전사 방향·모험가 갈래), `skills.ts` 기술 정의·패시브, `classes.ts` 직업, `gear.ts` 장비, `data.ts` 수치(BAL)·몬스터·조우표·훈련
  - `faith.ts` 신앙, `fragments.ts` 편린, `injury.ts` 부상·질병, `hazards.ts` 3섹터 부식·마비·독·곰팡이 폐병, `fire.ts` 4섹터 화상·동상·냉기·환기, `endless.ts` 끝없는 미궁, `sweeper.ts` 청소부, `mind.ts` 정신 상태이상, `autopsy.ts` 묘비 사망 요약, `bot.ts` 자동 결정 겸 시뮬 봇(`setMagePlan`으로 갈래 계획 주입), `josa.ts` 조사
- `src/ui/` React. 고정 레이아웃(헤더/스크롤/하단 도크), ⚙ 설정(속도·자동 결정·전투 방침·처음 안내·용어 사전), 캐릭터 시트, 안내 카드(`tips.ts`), 저장은 localStorage에만(텍스트 내보내기·가져오기 없음), 구 저장 보정 `storage.ts`, 그림 연결 `art.ts`

## 지금 규칙(요약)
- 한 달 = 마을 1~3주(주마다 활동 1개) + 4주차 미궁(336턴=7일) → 월말 정산·세금(미납 시 처형, 해마다 +40G). 첫 달 훈련 불가
- 미궁: 섹터당 3층 방 그래프, 3층 보스 → 차원문(넘으면 남은 시간 ×2). 1섹터(쥐·고블린·스켈레톤), 2섹터 "잊힌 전쟁터의 초원"(낮·밤, 하피 여왕, 장군), 3섹터 "물에 잠긴 사원"(밀물·썰물, 침수 방, 부식·마비·독, 익사한 성가대, 균모), 4섹터 "불타는 광산 갱도"(바람·고임, 화상·동상·냉기, 함정 5종, 광차 미믹, 화로 어미 — 3섹터 클리어 뒤 숏컷). 차원문 시간 1→2 ×2, 그다음 ×1.5. 4섹터 차원문 너머는 끝없는 미궁(LAST_SECTOR, 몬스터만, 층마다 강해짐). 전체는 6섹터 예정
- 전투 완전 자동. 플레이어는 전투 방침(물약/도주 HP 기준)만 고른다
- **훈련 = 레벨표**: 훈련 갈래마다 레벨별로 배우는 기술이 정해져 있다(짝수 패시브, 홀수 액티브). 4·7·10레벨은 보스 재료(마석 심장·장군의 휘장·3섹터 전리품)가 드는 특수 훈련 → 그 갈래의 특화(액티브 전투당 +1회). 훈련마다 직업 기본 능력치 +1과 갈래 능력치 +1
  - 마법사: 화염(지능·힘)·서리(지능·감각)·번개(지능·민첩)·대지(지능·체력), 첫 기술 마력 화살
  - 전사: 수호(힘·체력, 방패 기술은 방패가 있어야)·검투(힘·민첩)·광전(힘·힘), 첫 기술 기선 제압
  - 모험가: 전사형(힘·체력)·마법사형(지능·감각)·민첩형(민첩·행운), 숏소드는 힘·민첩 중 높은 쪽, 첫 기술 섬광 가루
- 장비 9슬롯, 대장간 + 보물상자/보스 드롭. 편린(능력치·능력, 칸 = 1 + 레벨/3), 몬스터 도감·신앙 해금은 삶을 넘어 유지
- 신앙 8신(★1~3, ★4는 3섹터 클리어 후·신앙심 130), 성소 개종, 이단 심문·현상수배·이단심문관
- 부상(부위 5곳 × 경상·중상·결손)·쥐 열병, 정신 상태이상(공포·분노·혼란·절망, 숨김·눈치채기·조합)
- 지금 밸런스(탐험·신앙 없음): 12개월 1섹터 클리어 약 56~73%, 첫 달 사망 14~17%(`docs/CLASS_BALANCE.md`)

## 다음 후보
- 5·6섹터(초안 있음, 신앙 ★5는 4섹터 클리어 후 열고 권능은 5섹터와 함께), 4섹터 결정 15개(`SECTOR4_DRAFT.md` 끝 — 2026-10-14 채팅에서 갱신된 목록)
- 민첩 직업(모험가 민첩형이 미리보기), 성직자, 히든 트레이닝, 탐문 단서·진엔딩
- 비주얼: `docs/VISUAL_HANDOFF.md` 10절
