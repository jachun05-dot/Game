# 사이버 흡연실 (2026-11)

비 오는 밤 네온 간판 아래, 재떨이 하나를 같이 쓰며 담배를 피우는 웹 페이지. 로그인 없이 링크로 들어온다.

- 주소: https://jachun05-dot.github.io/Game/smoke/ (GitHub Pages), https://smoke-a96dd.web.app/ (Firebase 호스팅)
- Firebase 프로젝트: `smoke-a96dd` (`.firebaserc`, `firebase.json`)
- 코드: `public/smoke/index.html` (한 파일, 빌드 없이 그대로 올라감), 연결 설정: `public/smoke/firebase-config.js`
- 실시간 연결: Firebase Realtime Database + 익명 로그인. 보안 규칙: `docs/smoke/database.rules.json`
- `firebase-config.js`가 `null`이면 혼자 모드로 열린다(아래 "연결 안 됨 · 혼자 보는 중")

## 데이터 구조
- `rtc/<테이블>/<받는 key>/<메시지>`: 음성 연결 신호(offer·answer·ice). 받는 사람만 읽고 읽으면 지운다
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

## 음성대화
- 같은 테이블 사람끼리 브라우저 대 브라우저(WebRTC, 그물형). key가 작은 쪽이 먼저 건다. 끊기면 8초 뒤 다시 건다
- 듣기는 권한이 필요 없고, 마이크는 켤 때만 브라우저 권한을 묻는다. 끄면 마이크 장치를 놓는다
- 오른쪽 위 버튼: 소리(효과음) / 마이크 / 음성 소리. 이름 앞 점 = 마이크 켬, 초록으로 빛나면 말하는 중
- STUN만 쓴다(구글 공개 서버). 회사·학교 망이나 일부 모바일 망에서는 연결이 안 될 수 있다 — 필요하면 TURN 서버를 ICE 목록에 더한다
