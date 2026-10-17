import { BUILD } from "./build";
import { HOST } from "./host";

// 새 버전 알림(웹·앱). 빌드할 때 dist/version.json에 빌드 정보를 적어 두고(vite.config.ts),
// 열려 있는 페이지가 가끔 그 파일을 다시 읽어 자기 빌드 id와 다르면 "새 버전" 알림을 띄운다.
// 저장은 상태가 바뀔 때마다 되므로 새로고침해도 진행이 사라지지 않는다.
// 아티팩트는 새 버전을 게시하면 열린 화면이 알아서 다시 열리므로 확인하지 않는다.

export interface VersionInfo {
  id: string;
  version: string;
  commit: string;
  builtAt: string;
}

export function updateCheckEnabled(): boolean {
  return HOST !== "artifact" && typeof fetch === "function" && BUILD.builtAt !== "";
}

/** 서버에 올라간 빌드가 지금 빌드와 다르면 그 정보를, 같거나 확인할 수 없으면 null */
export async function fetchNewerBuild(): Promise<VersionInfo | null> {
  if (!updateCheckEnabled()) return null;
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const info = (await res.json()) as VersionInfo;
    // 빌드 시각으로 비교한다(같은 커밋을 다시 빌드해도 새 파일이면 알린다)
    return info?.builtAt && info.builtAt !== BUILD.builtAt ? info : null;
  } catch {
    return null;
  }
}
