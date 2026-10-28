// 빌드 정보: vite.config.ts의 define이 빌드할 때 채운다(테스트·시뮬처럼 vite 밖에서 돌면 기본값).
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;
declare const __APP_TARGET__: string;

/** 배포 대상: web(GitHub Pages 등 정적 호스팅) · artifact(claude.ai 아티팩트) · app(웹뷰 앱 포장) · toss(앱인토스 미니앱 — 표현을 바꾼 토스판, docs/APPS_IN_TOSS.md) */
export type Target = "web" | "artifact" | "app" | "toss";

export const BUILD = {
  /** package.json version */
  version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev",
  /** git 짧은 커밋 */
  commit: typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "local",
  /** 빌드 시각(ISO) */
  builtAt: typeof __APP_BUILT_AT__ === "string" ? __APP_BUILT_AT__ : "",
  /** 빌드할 때 정한 대상(VITE_TARGET, 기본 web). 실제로 어디서 열렸는지는 host.ts */
  target: (typeof __APP_TARGET__ === "string" ? __APP_TARGET__ : "web") as Target,
};

/** 이 빌드를 가리키는 한 줄 id(업데이트 확인·결과 기록에 쓴다) */
export const BUILD_ID = `${BUILD.version}+${BUILD.commit}`;
