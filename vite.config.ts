/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// 빌드 하나(dist/)를 GitHub Pages·claude.ai 아티팩트·웹뷰 앱에 그대로 올린다. 그래서
// - base "./": 어느 경로에 올려도 상대 경로로 열린다
// - 빌드 정보(버전·커밋·시각·대상)를 코드에 심고(src/platform/build.ts) dist/version.json으로도 낸다(새 버전 알림, src/platform/update.ts)
// - react는 따로 묶는다: 게임만 고친 업데이트에서 react 파일은 이름이 그대로라 다시 받지 않는다
// 대상은 VITE_TARGET=web|artifact|app (기본 web). 지금은 대상별로 다른 점이 없고, 표시·기록에만 쓴다.

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

const info = {
  version: pkg.version,
  commit: process.env.APP_COMMIT || gitCommit(),
  builtAt: new Date().toISOString(),
  target: process.env.VITE_TARGET || "web",
};
const id = `${info.version}+${info.commit}`;

/** dist/version.json: 열려 있는 페이지가 새 빌드를 알아채는 데 쓴다 */
function versionFile(): Plugin {
  return {
    name: "ddd-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ id, ...info }, null, 2) + "\n" });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  base: "./",
  // 에이전트 작업 폴더(.claude/worktrees)의 사본 테스트는 돌리지 않는다
  test: { exclude: ["**/node_modules/**", "**/dist/**", ".claude/**"] },
  define: {
    __APP_VERSION__: JSON.stringify(info.version),
    __APP_COMMIT__: JSON.stringify(info.commit),
    __APP_BUILT_AT__: JSON.stringify(info.builtAt),
    __APP_TARGET__: JSON.stringify(info.target),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(path) {
          if (path.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
