import type { GameState, Meta, Tomb } from "../game/types";

const RUN_KEY = "ddd-run-v1";
const META_KEY = "ddd-meta-v1";

// 브라우저 저장소는 사생활 보호 모드 등에서 막힐 수 있어 항상 try/catch.

export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 1 ? s : null;
  } catch {
    return null;
  }
}

export function saveRun(s: GameState | null): void {
  try {
    if (s) localStorage.setItem(RUN_KEY, JSON.stringify(s));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    /* 저장 불가 환경에서는 조용히 넘어간다 */
  }
}

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as Meta;
  } catch {
    /* ignore */
  }
  return { graveyard: [], faiths: [] };
}

export function saveMeta(m: Meta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function buryTomb(m: Meta, t: Tomb): Meta {
  if (m.graveyard.some((x) => x.id === t.id)) return m;
  const faiths = [...new Set([...m.faiths, ...t.faithsUnlocked])];
  return { graveyard: [t, ...m.graveyard].slice(0, 200), faiths };
}

export function exportSave(run: GameState | null, meta: Meta): string {
  return JSON.stringify({ app: "ddd", v: 1, run, meta });
}

export function importSave(text: string): { run: GameState | null; meta: Meta } | null {
  try {
    const d = JSON.parse(text);
    if (d?.app !== "ddd" || d.v !== 1) return null;
    return { run: d.run ?? null, meta: d.meta ?? { graveyard: [], faiths: [] } };
  } catch {
    return null;
  }
}
