import type { GameState, Meta, Tomb } from "../game/types";
import { emptyCodex, mergeCodex } from "../game/fragments";

const RUN_KEY = "ddd-run-v1";
const META_KEY = "ddd-meta-v1";

// 브라우저 저장소는 사생활 보호 모드 등에서 막힐 수 있어 항상 try/catch.

export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    return fixRun(JSON.parse(raw) as GameState);
  } catch {
    return null;
  }
}

/** 예전 저장 데이터 보정 */
function fixRun(s: GameState | null): GameState | null {
  if (!s || s.version !== 1) return null;
  // 기술·자동 전투·편린 이전 저장 데이터 보정
  s.skills ??= [];
  s.tactics ??= { potionAt: 35, fleeAt: 0 };
  s.tripUsed ??= [];
  s.hero.cls ??= "adventurer";
  s.inventory.heart ??= 0;
  if (s.phase !== "create") s.gear.main ??= "shortsword";
  if ((s.phase as string) === "combat") s.phase = "town";
  s.combat = null;
  s.fragments ??= [];
  s.autoGoal ??= "explore";
  s.piety ??= s.hero.faith ? 15 : 0;
  s.heretic ??= false;
  s.injuries ??= { head: 0, body: 0, main: 0, offhand: 0, feet: 0 };
  s.prosthetic ??= {};
  s.disease ??= 0;
  s.mind ??= {};
  s.inventory.banner ??= 0;
  s.trophies ??= s.inventory.heart > 0 || s.hero.level > 3 ? ["heart"] : [];
  s.inventory.bandage ??= 0;
  s.inventory.herb ??= 0;
  s.faithsKnown ??= s.hero.faith ? [s.hero.faith] : [];
  s.codex = mergeCodex(s.codex ?? emptyCodex(), { ...emptyCodex(), fragKnown: s.fragments });
  return s;
}

function fixMeta(m: Partial<Meta> | null | undefined): Meta {
  return { graveyard: m?.graveyard ?? [], faiths: m?.faiths ?? [], codex: m?.codex ? mergeCodex(emptyCodex(), m.codex) : emptyCodex() };
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
    if (raw) return fixMeta(JSON.parse(raw) as Meta);
  } catch {
    /* ignore */
  }
  return fixMeta(null);
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
  return { ...m, graveyard: [t, ...m.graveyard].slice(0, 200), faiths };
}

export function exportSave(run: GameState | null, meta: Meta): string {
  return JSON.stringify({ app: "ddd", v: 1, run, meta });
}

export function importSave(text: string): { run: GameState | null; meta: Meta } | null {
  try {
    const d = JSON.parse(text);
    if (d?.app !== "ddd" || d.v !== 1) return null;
    return { run: fixRun(d.run ?? null), meta: fixMeta(d.meta) };
  } catch {
    return null;
  }
}
