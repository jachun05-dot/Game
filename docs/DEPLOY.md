# 배포·업데이트 (2026-10-17)

빌드 하나(`dist/`)를 여러 곳에 그대로 올린다. 대상마다 다른 코드는 없고, 실행 중인 환경을 보고(`src/platform/host.ts`) 쓸 수 있는 기능만 켠다.

| 곳 | 주소 | 올리는 법 | 새 버전 알림 | 플레이 기록 수집 |
|---|---|---|---|---|
| GitHub Pages(웹) | https://jachun05-dot.github.io/Game/ | `npm run release:pages` | `version.json` 확인 | 없음 |
| claude.ai 아티팩트 | https://claude.ai/artifact/3hRQb1UtFGqHvFAGstGNdy | `npm run release:artifact -- <스테이징 폴더>` → Artifact 게시 | 게시하면 열린 화면이 저절로 다시 열림 | db `runs/<플레이어>/lives` |
| 웹뷰 앱(앞으로) | — | `npm run build:app` → 포장 도구에 `dist/` | `version.json` 확인(원격으로 열 때) | 수집 서버를 붙이면 |

## 순서
1. `npm run check` — 타입 검사 + 테스트
2. **커밋 먼저**, 그다음 빌드 — 빌드 id(`버전+커밋`)가 커밋을 가리키게(`dist/version.json`)
3. `git fetch origin master && git merge origin/master` 후 `git push origin master`
4. 웹: `npm run release:pages [gh-pages worktree 경로]` — worktree가 없으면 만든다. 바뀐 게 없으면 커밋하지 않는다
5. 아티팩트: `npm run release:artifact -- <스테이징 폴더>`
   - 폴더에 아티팩트용 페이지 조각(`index.html`)을 만들고, `dist/`와 다른 파일만 복사, 없어진 파일은 지운다
   - 게시할 `files` 맵은 `<폴더>/.publish.json` (새·바뀐 파일 → 경로, 지운 파일 → `null`)
   - Artifact publish: `file_path` = `<폴더>/index.html`, `root` = `<폴더>`, `files` = 위 맵. capabilities는 생략(저장된 선언 유지)
   - 스테이징 폴더는 라이브 아티팩트와 같은 파일을 들고 있어야 맵이 맞다(폴더가 새로 생겼거나 의심되면 Artifact `list` scope `files`로 라이브 목록을 보고 맵을 고친다)
   - 처음 올리는 그림은 게시 전에 눈으로 확인한다

## 버전
- `package.json`의 `version`이 화면(타이틀)과 기록에 나온다. 저장 형식이나 큰 콘텐츠가 바뀌면 올린다(0.x 동안은 자유롭게)
- 빌드 정보: `src/platform/build.ts`(`BUILD.version`·`commit`·`builtAt`·`target`), `dist/version.json`
- react 등 라이브러리는 `vendor-*.js`로 따로 묶여서 게임만 고친 업데이트에서는 파일 이름이 바뀌지 않는다(다시 받지 않음)

## 새 버전 알림(웹·앱)
`src/platform/update.ts` + `src/ui/useUpdateNotice.ts`: 열 때·화면으로 돌아올 때·30분마다 `./version.json`을 캐시 없이 읽어, 빌드 시각이 지금과 다르면 화면 위에 "새 버전이 나왔어요 · 새로고침"을 띄운다. 진행은 상태가 바뀔 때마다 저장되므로 새로고침해도 사라지지 않는다. 서비스 워커(오프라인 캐시)는 아직 쓰지 않는다 — 옛 파일이 남아 업데이트가 늦게 닿는 문제가 생기기 쉬워서. 앱 포장 때 정한다.

## 저장과 업데이트 (`src/save/`)
- 키: `ddd-run-v1`(진행 중인 삶), `ddd-meta-v1`(묘지·신앙 해금·도감·조각·엔딩). 저장소는 `src/platform/kv.ts`(지금은 localStorage, 앱에서 갈아 끼울 수 있음)
- **저장 형식 판** `SAVE_REV`(`src/save/migrate.ts`):
  - 새 필드 추가 → `normalize()`에 기본값 한 줄(`s.x ??= …`). 판은 그대로
  - 이름 바꾸기·지운 것 바꿔치기처럼 한 번만 해야 하는 변환 → `MIGRATIONS` 끝에 `{ rev: SAVE_REV + 1, … }`를 붙이고 `SAVE_REV`를 올린다
- 안전장치(`src/save/storage.ts`): 읽을 수 없는 저장은 `<키>.broken`으로 옮겨 둔다(빈 상태로 덮어쓰지 않음), 판이 오를 때 옛 원본은 `<키>.bak-r<판>`에 한 번, 더 새 빌드의 저장을 옛 빌드로 열면 `<키>.newer`. 백업은 1MB까지
- 테스트: `game.test.ts`의 "저장 이전·백업"

## 플레이 기록 (`src/platform/telemetry.ts`, `src/ui/lifeReport.ts`)
- 삶이 끝나면(죽음·엔딩) `lifeReport()`가 요약을 만들고 `sendRecord("life", 묘비 id, 본문)`이 쓸 수 있는 모든 곳(Sink)에 보낸다. 본문에는 빌드 id·환경이 붙는다
- 지금 Sink는 아티팩트 db 하나. 규칙(아티팩트 capabilities): `runs` 주인만 읽기·쓰기, `runs/{self}` Contributor 이상이 자기 것만. 링크로 들어온 외부 보기 전용 사용자는 쓰지 못한다
- 웹·앱에서도 모으려면: `Sink`를 하나 더 만들어(`available()`·`send()`) `SINKS`에 넣는다. 게임 쪽 코드는 그대로. (아티팩트 페이지는 외부 전송이 막혀 있다 — 2026-10-14 시험)

## 앱으로 포장할 때(메모)
- `dist/`가 정적 파일뿐이고 경로가 모두 상대(`base: "./"`)라 Capacitor·Tauri 같은 웹뷰 포장에 그대로 들어간다. `npm run build:app`은 `BUILD.target = "app"`만 다르다
- 웹뷰의 localStorage는 앱 데이터에 남는다. 네이티브 저장소로 바꾸려면 앱 시작 때 `setKv()`(동기 API — 비동기 저장소면 시작 때 한 번 읽어 메모리에 올리는 래퍼)
- 설치 아이콘: `public/manifest.webmanifest`가 지금은 `hero.png`(37×90)를 쓴다. 정사각 192·512 아이콘이 필요하다(비주얼 세션, VISUAL_HANDOFF 46)
