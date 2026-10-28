# 토스판(앱인토스) 빌드

웹판과 같은 코드에서 글만 바꾼 토스판을 만든다(나이 표현 없음, 처형 → 추방·투옥, 잔혹 묘사 순화 — `docs/APPS_IN_TOSS.md`).

```sh
cd toss
npm install                   # 처음 한 번(@apps-in-toss/web-framework 3.9.0 — Node 24 이상 권장, 22에서도 빌드됨)
npm run build                 # 토스판 빌드(../dist-toss) + ait build → toss/ddd-labyrinth.ait
```

이 클라우드 환경에서는 registry.npmjs.org가 막혀 있어 `toss/.npmrc`가 yarn 미러를 쓴다(저장소 최상위 `.npmrc`와 같은 설정).

- `.ait`는 앱인토스 콘솔에 올리고, 생성된 테스트 앱스킴(`intoss-private://<appName>`)으로 토스 앱에서 확인한다.
- 배포 API 키는 콘솔에서 발급받아 각자 보관한다(저장소에 넣지 않는다).
- 연결된 것(`src/platform/toss.ts`): 토스 저장소에 사용자별 저장(User.getAnonymousKey), 안드로이드 뒤로가기(열린 화면 닫기 → 종료 확인 창 → Screen.close), 안전 영역(SafeArea → CSS 변수). 토스 앱 밖(브라우저)에서는 건너뛰고 웹 저장소로 돈다.
- 실기기에서 볼 것: 토스 내비게이션 바와 게임 상단 바 겹침, 다이내믹 아일랜드, 백버튼, 앱을 껐다 켰을 때 진행 유지.
