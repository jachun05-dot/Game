// 앱인토스 설정(docs/APPS_IN_TOSS.md). 항목은 @apps-in-toss/web-framework 3.9.0의 config.d.ts 기준. SDK 설치 뒤 이 폴더에서 `npx ait build`로 .ait를 만든다.
// appName은 앱인토스 콘솔에 등록한 이름과 같아야 업로드된다 — 콘솔 등록 후 바꾼다.
import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "ddd-labyrinth", // TODO: 콘솔에 등록한 appName으로
  brand: {
    primaryColor: "#DCAA52", // 게임의 금색 버튼(theme.css --gold-grad 중간색)
  },
  // 어두운 화면이라 토스 내비게이션 바도 어둡게(닫기 버튼은 토스가 그린다)
  navigationBar: { theme: "dark", withBackButton: true },
  // 게임 화면이 당겨지거나 새로 고쳐지지 않게
  webView: { bounces: false, pullToRefreshEnabled: false, overScrollMode: "never" },
  permissions: [], // 기기 권한을 쓰지 않는다
  webBundleDir: "../dist-toss", // npm run build:toss 결과
});
