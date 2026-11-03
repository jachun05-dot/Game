# 구글플레이 출시 (안드로이드 앱)

웹판을 Capacitor 8로 감싼 안드로이드 앱. 게임 파일을 앱 안에 넣어 인터넷 없이 돈다(글꼴만 온라인일 때 Google Fonts).

## 빌드

```sh
# 처음 한 번: Android SDK(cmdline-tools → platform-tools, platforms;android-36, build-tools;36.0.0), JDK 21
export ANDROID_HOME=/opt/android-sdk
export DDD_KEYSTORE_PROPS=/경로/keystore.properties   # 업로드 서명 키(저장소에 넣지 않는다)
npm run build:android    # build:app → cap sync → gradlew bundleRelease
# 결과: android/app/build/outputs/bundle/release/app-release.aab
```

- 패키지 이름 `io.github.jachun05.ddd` (`capacitor.config.ts`, `android/app/build.gradle`) — 첫 업로드 뒤에는 못 바꾼다
- 버전: `android/app/build.gradle`의 `versionCode`를 올릴 때마다 +1, `versionName`은 표시용
- 대상 SDK 36(Android 16), 최소 24
- 서명: 업로드 키(`ddd-upload.jks`, alias `upload`). 구글플레이 앱 서명(Play App Signing)을 쓰면 업로드 키를 잃어도 콘솔에서 재설정할 수 있다
- 이 클라우드 환경에서는 Maven 저장소가 가끔 429/끊김을 내서 `./gradlew bundleRelease --max-workers=1`로 몇 번 다시 돌리면 된다(받은 건 캐시에 남는다)
- 뒤로가기: `src/platform/native.ts` — 열린 화면 닫기 → 종료 확인 창 → 앱 종료(토스판과 같은 `ddd:back`)
- 아이콘: `public/icon-512.png`(일반·둥근), `public/icon-maskable-512.png`(적응형 전경), 배경 #110801. 시작 화면도 같은 아이콘

## 콘솔에서 준비할 것

| 항목 | 상태 |
|---|---|
| 개발자 계정(개인 가능, 1회 25달러) | 사용자 |
| 개인 계정: 공개 출시 전 비공개 테스트(테스터 수·기간은 콘솔 안내 확인) | 사용자 |
| 개인정보처리방침 URL | `public/privacy.html` → GitHub Pages `/privacy.html` |
| 앱 아이콘 512×512 | `public/icon-512.png` |
| 그래픽 이미지 1024×500 | 만들어야 함 |
| 휴대전화 스크린샷 2장 이상 | 만들어야 함(Playwright로 찍을 수 있다) |
| 콘텐츠 등급 설문(IARC) | 사용자 — 폭력·죽음·처형(미성년 주인공) 사실대로 |
| 타깃 연령 | 13세 미만 제외 권장 |
| 데이터 보안(Data safety) | 수집 없음(진행은 기기에만). 글꼴 요청은 Google |
