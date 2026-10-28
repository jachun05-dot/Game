import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";
import "./ui/theme.css";
import { initLang } from "./i18n";
import { isToss } from "./platform/variant";

// 고른 언어의 번역을 먼저 받은 뒤 그린다(src/i18n)
// 토스판은 토스 저장소·뒤로가기·안전 영역을 먼저 연결한다(src/platform/toss.ts — 웹판은 내려받지 않는다)
const ready = isToss() ? import("./platform/toss").then((m) => m.setupToss()).catch(() => {}) : Promise.resolve();
void ready.then(initLang).then(() =>
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
  ),
);
