import type { CapacitorConfig } from "@capacitor/cli";

// 구글플레이용 안드로이드 앱(docs/GOOGLE_PLAY.md). 웹판 빌드(npm run build:app → dist)를 앱 안에 통째로 넣는다(오프라인 동작).
// appId는 구글플레이에 처음 올린 뒤에는 바꿀 수 없다.
const config: CapacitorConfig = {
  appId: "io.github.jachun05.ddd",
  appName: "DDD",
  webDir: "dist",
  android: {
    backgroundColor: "#120d08",
  },
};

export default config;
