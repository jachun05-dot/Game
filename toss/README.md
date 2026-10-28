# 토스판(앱인토스) 빌드

웹판과 같은 코드에서 글만 바꾼 토스판을 만든다(나이 표현 없음, 처형 → 추방·투옥, 잔혹 묘사 순화 — `docs/APPS_IN_TOSS.md`).

```sh
npm run build:toss            # → dist-toss/ (토스판 글, 바깥 글꼴 없음)
cd toss
npm install @apps-in-toss/web-framework   # 처음 한 번(2026-10 기준 3.9.0)
npx ait build                 # → .ait 묶음
```

- `.ait`는 앱인토스 콘솔에 올리고, 생성된 테스트 앱스킴(`intoss-private://<appName>`)으로 토스 앱에서 확인한다.
- 배포 API 키는 콘솔에서 발급받아 각자 보관한다(저장소에 넣지 않는다).
- 아직 남은 일: 사용자 식별키로 진행 저장, 안드로이드 뒤로가기·종료 확인 창, 토스 내비게이션 바와 상단 바 겹침 확인(실기기) — SDK 설치 뒤 진행.
