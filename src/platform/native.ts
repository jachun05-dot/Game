// 안드로이드 앱(Capacitor, docs/GOOGLE_PLAY.md) 연결 — main.tsx가 앱 빌드일 때만 불러온다.
// 뒤로가기 버튼은 토스판과 같이 "ddd:back"으로 넘기고(App이 열린 화면을 닫거나 종료 확인 창을 띄운다), 종료는 App.exitApp.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { setCloser } from "./exit";

export async function setupNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // 브라우저에서 앱 빌드를 열었을 때
  setCloser(() => void App.exitApp());
  await App.addListener("backButton", () => window.dispatchEvent(new Event("ddd:back")));
}
