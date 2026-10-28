// 앱인토스 설정(docs/APPS_IN_TOSS.md). SDK 설치 뒤 이 폴더에서 `npx ait build`로 .ait를 만든다.
// appName은 앱인토스 콘솔에 등록한 이름과 같아야 업로드된다 — 콘솔 등록 후 바꾼다.
import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "ddd-labyrinth", // TODO: 콘솔에 등록한 appName으로
  brand: {
    displayName: "DDD — 수습 모험가, 미궁으로",
    primaryColor: "#DCAA52", // 게임의 금색 버튼(theme.css --gold-grad 중간색)
  },
  webView: {},
  permissions: [], // 기기 권한을 쓰지 않는다
  webBundleDir: "../dist-toss", // npm run build:toss 결과
});
