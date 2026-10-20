import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";
import "./ui/theme.css";
import { initLang } from "./i18n";

// 고른 언어의 번역을 먼저 받은 뒤 그린다(src/i18n)
void initLang().then(() =>
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
  ),
);
