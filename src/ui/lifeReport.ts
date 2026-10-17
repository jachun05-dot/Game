import type { GameState } from "../game/types";
import { sendRecord } from "../platform/telemetry";

// 테스트 결과 수집(2026-10-15): 삶이 끝나면(죽음·엔딩) 그 삶의 요약을 기록으로 보낸다.
// 어디로 보낼지는 platform/telemetry.ts가 정한다(지금은 claude.ai 아티팩트 db만, 다른 곳에선 아무것도 안 함).

/** 이 기록 형식의 버전(필드를 바꾸면 올린다) */
export const REPORT_VERSION = 1;

/** 끝난 삶 하나의 요약(기록 본문) */
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

/** 끝난 삶을 보낸다(같은 묘비는 같은 기록: 다시 불려도 하나만 남는다) */
export async function reportLife(s: GameState): Promise<void> {
  const report = lifeReport(s);
  if (report) await sendRecord("life", String(report.tomb), report);
}
