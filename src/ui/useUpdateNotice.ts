import { useEffect, useState } from "react";
import { fetchNewerBuild, updateCheckEnabled, type VersionInfo } from "../platform/update";

/** 처음 열 때, 화면으로 돌아올 때, 그리고 30분마다 새 빌드가 올라왔는지 본다 */
const EVERY_MS = 30 * 60 * 1000;

export function useUpdateNotice(): VersionInfo | null {
  const [newer, setNewer] = useState<VersionInfo | null>(null);
  useEffect(() => {
    if (!updateCheckEnabled()) return;
    let alive = true;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      void fetchNewerBuild().then((v) => alive && v && setNewer(v));
    };
    check();
    const t = window.setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return newer;
}
