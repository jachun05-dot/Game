import { BUILD, type Target } from "./build";

// 지금 페이지가 어디서 열렸는지. 같은 빌드(dist/)를 GitHub Pages·아티팩트·앱에 그대로 올리므로
// 빌드 대상이 아니라 실행 중인 환경을 보고 판단한다.

type ClaudeUse = (name: string) => Promise<any>;

/** claude.ai 아티팩트 런타임의 capability 진입점(없으면 null) */
export function claudeUse(): ClaudeUse | null {
  if (typeof window === "undefined") return null;
  const c = (window as any).claude;
  return typeof c?.use === "function" ? (c.use.bind(c) as ClaudeUse) : null;
}

/** 웹뷰 앱(Capacitor·Tauri 등)으로 포장됐는지: 빌드 대상이 app이거나 포장 런타임 전역이 있다 */
function isApp(): boolean {
  if (BUILD.target === "app") return true;
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.Capacitor?.isNativePlatform?.() || w.__TAURI__ || w.__TAURI_INTERNALS__);
}

export function detectHost(): Target {
  if (isApp()) return "app";
  if (claudeUse()) return "artifact";
  return "web";
}

export const HOST: Target = detectHost();
