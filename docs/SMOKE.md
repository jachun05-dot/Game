# 사이버 흡연실 (2026-11)

비 오는 밤 네온 간판 아래, 재떨이 하나를 같이 쓰며 담배를 피우는 웹 페이지. 로그인 없이 링크로 들어온다.

- 주소: https://jachun05-dot.github.io/Game/smoke/ (GitHub Pages), https://smoke-a96dd.web.app/ (Firebase 호스팅)
- Firebase 프로젝트: `smoke-a96dd` (`.firebaserc`, `firebase.json`)
- 코드: `public/smoke/index.html` (한 파일, 빌드 없이 그대로 올라감), 연결 설정: `public/smoke/firebase-config.js`
- 실시간 연결: Firebase Realtime Database + 익명 로그인. 보안 규칙: `docs/smoke/database.rules.json`
- `firebase-config.js`가 `null`이면 혼자 모드로 열린다(아래 "연결 안 됨 · 혼자 보는 중")

## 데이터 구조
- `lobby/<key>`: 누가 어디 앉았나 `{tb, since, q, qs, nick}` — 모두가 읽는다(테이블 인원, 대기 줄)
- `seats/<테이블>/<key>`: 그 테이블 사람들의 담배 상태 `{lit, d, b, a, lt, ex, exA, mid, msg, v}` — 같은 테이블만 듣는다
- `<key>` = `<익명 uid>_<탭 id>`. 규칙상 자기 줄만 쓸 수 있다. 창을 닫으면 서버가 지운다(onDisconnect)

## Firebase 준비(한 번)
1. https://console.firebase.google.com → 프로젝트 추가
2. Authentication → 시작하기 → 로그인 방법 → 익명 → 사용
3. Realtime Database → 데이터베이스 만들기 → 잠금 모드 → 규칙 탭에 `docs/smoke/database.rules.json` 붙여넣고 게시
4. 프로젝트 설정 → 내 앱 → 웹 앱 추가 → `firebaseConfig`를 `public/smoke/firebase-config.js`의 `window.SMOKE_FIREBASE`에 넣는다(공개돼도 되는 값)

## 올리기
- Firebase 호스팅 + 보안 규칙: 저장소 루트에서 `npx firebase-tools deploy` (처음 한 번 `npx firebase-tools login`)
- 흡연실만: gh-pages 브랜치의 `smoke/`에 `public/smoke/`를 복사해 커밋·푸시
- 게임과 같이: `npm run release:pages` (public/ 아래라 dist에 함께 들어간다)

## 로컬 시험
Firebase 에뮬레이터(`firebase emulators:start --project demo-smoke --only auth,database`)를 띄우고 설정에 `emulator: true`, `databaseURL: "http://127.0.0.1:9000?ns=demo-smoke"`를 주면 브라우저 여러 개로 시험할 수 있다.
