import type { GameState, Meta, Tomb } from "../game/types";
import { kv } from "../platform/kv";
import { SAVE_REV, fixMeta, fixRun, isNewerSave } from "./migrate";

// 저장소: 진행 중인 삶(run)과 삶을 넘어 이어지는 기록(meta). 기기 안(localStorage 등, platform/kv.ts)에만 저장한다.
// 업데이트 안전장치:
// - 읽을 수 없는 저장(깨진 JSON·알 수 없는 형식)은 지우기 전에 .broken 키로 옮겨 둔다(빈 상태로 덮어쓰지 않게)
// - 저장 형식 판이 오르면 이전 판 원본을 .bak-r<판> 키에 한 번 남긴다
// - 더 새 빌드의 저장을 옛 빌드로 열면 원본을 .newer 키에 남긴다(새 빌드로 돌아가면 복구할 수 있게)

export const KEYS = {
  run: "ddd-run-v1",
  meta: "ddd-meta-v1",
} as const;

/** 백업은 이 크기까지만(저장소 용량을 백업이 다 먹지 않게) */
const BACKUP_MAX = 1_000_000;

function keep(key: string, suffix: string, raw: string): void {
  if (!raw || raw.length > BACKUP_MAX) return;
  if (kv().get(`${key}.${suffix}`) === null) kv().set(`${key}.${suffix}`, raw);
}

/** 원본을 읽어 파싱. 형식 판이 다르면 백업을 남긴다 */
function readRaw<T extends { saveRev?: number }>(key: string): T | null | "broken" {
  const raw = kv().get(key);
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as T;
    if (!v || typeof v !== "object") throw new Error("not an object");
    if (isNewerSave(v)) keep(key, "newer", raw);
    else if ((v.saveRev ?? 0) < SAVE_REV) keep(key, `bak-r${v.saveRev ?? 0}`, raw);
    return v;
  } catch {
    keep(key, "broken", raw);
    return "broken";
  }
}

export function loadRun(): GameState | null {
  const v = readRaw<GameState>(KEYS.run);
  if (v === null || v === "broken") return null;
  try {
    const s = fixRun(v);
    if (!s) keep(KEYS.run, "broken", kv().get(KEYS.run) ?? "");
    return s;
  } catch {
    keep(KEYS.run, "broken", kv().get(KEYS.run) ?? "");
    return null;
  }
}

export function saveRun(s: GameState | null): void {
  if (s) kv().set(KEYS.run, JSON.stringify(s));
  else kv().remove(KEYS.run);
}

export function loadMeta(): Meta {
  const v = readRaw<Meta>(KEYS.meta);
  if (v === null || v === "broken") return fixMeta(null);
  try {
    return fixMeta(v);
  } catch {
    keep(KEYS.meta, "broken", kv().get(KEYS.meta) ?? "");
    return fixMeta(null);
  }
}

export function saveMeta(m: Meta): void {
  kv().set(KEYS.meta, JSON.stringify(m));
}

/** 끝난 삶을 묘지에 묻는다(같은 묘비는 한 번만) — 신앙 해금·엔딩 기록도 함께 */
export function buryTomb(m: Meta, t: Tomb): Meta {
  if (m.graveyard.some((x) => x.id === t.id)) return m;
  const faiths = [...new Set([...m.faiths, ...t.faithsUnlocked])];
  const endings = t.ending ? [...new Set([...(m.endings ?? []), t.ending])] : m.endings ?? [];
  return { ...m, graveyard: [t, ...m.graveyard].slice(0, 200), faiths, endings };
}
