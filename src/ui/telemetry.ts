import type { GameState } from "../game/types";

// 테스트 결과 수집(2026-10-15): claude.ai 아티팩트로 열었을 때만, 삶이 끝나면(죽음·엔딩) 그 삶의 요약을 아티팩트 db에 남긴다.
// 경로: runs/<플레이어 id>/lives/<묘비 id> — 플레이어는 자기 줄만 쓰고, 전체는 아티팩트 주인만 읽는다(게시할 때 rules).
// GitHub Pages나 로그인하지 않은 보기에서는 claude.use가 없거나 null이라 아무것도 하지 않는다.

/** 이 기록 형식의 버전(필드를 바꾸면 올린다) */
export const REPORT_VERSION = 1;

/** 끝난 삶 하나의 요약(db 문서 본문) */
export function lifeReport(s: GameState): Record<string, unknown> | null {
  const t = s.tomb;
  if (!t) return null;
  const tail = s.log
    .filter((l) => l.fold === undefined)
    .slice(-40)
    .map((l) => l.text);
  return {
    v: REPORT_VERSION,
    at: new Date().toISOString(),
    tomb: t.id,
    name: t.name,
    cls: s.hero.cls,
    level: t.level,
    months: t.months,
    reached: t.reached,
    cause: t.cause,
    ending: t.ending ?? null,
    faith: t.faith,
    piety: s.piety,
    rank: s.rank,
    gold: s.gold,
    heretic: s.heretic,
    relic: s.relic ?? null,
    teaching: s.godTeaching ?? null,
    clues: s.clues?.length ?? 0,
    skills: s.skills,
    fragments: s.fragments,
    gear: s.gear,
    injuries: s.injuries,
    seed: t.seed,
    facts: t.notes?.facts ?? [],
    tail,
  };
}

/** db 경로 한 칸에 쓸 수 없는 글자는 _로 */
export function pathSafe(id: string): string {
  return id.replace(/[^A-Za-z0-9_\-.~:@+]/g, "_").slice(0, 200) || "_";
}

type Use = (name: string) => Promise<any>;

/** 끝난 삶을 db에 남긴다(가능할 때만, 실패는 조용히 무시: 게임에 영향 없음) */
export async function reportLife(s: GameState): Promise<void> {
  const report = lifeReport(s);
  if (!report) return;
  try {
    const use: Use | undefined = (window as any).claude?.use?.bind((window as any).claude);
    if (!use) return;
    const [db, user] = await Promise.all([use("db"), use("user")]);
    if (!db || !user) return;
    const uid: string | null = await user.id();
    if (!uid) return;
    // 같은 묘비는 같은 문서: 다시 불려도 한 줄만 남는다
    await db.collection(`runs/${uid}/lives`).doc(pathSafe(String(report.tomb))).set(report);
  } catch {
    // 권한 없음(보기 전용)·한도 초과 등: 기록만 빠진다
  }
}
