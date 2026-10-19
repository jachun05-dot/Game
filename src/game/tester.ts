import { FAITH, MONSTERS } from "./data";
import { FRAGMENTS, emptyCodex, mergeCodex } from "./fragments";
import { CLUES } from "./truth";
import type { Codex, EndingKind, GameState } from "./types";

// 테스트용 이름(2026-10-19, 사용자 요청): 이름을 Dabong으로 지으면(대소문자 무관) 잠긴 것이 모두 열린다 —
// 도감(모든 몬스터·편린), 옛 신 여덟 모두, 진실 조각 6개(영주의 칙서는 삶마다라 제외), 엔딩 기록 넷.
// 이번 삶과 Meta(다음 삶) 둘 다에 적용된다(App.tsx가 Meta에 합친다). 게임 규칙·능력치는 그대로.
// (grooty는 따로: 시험자의 부적 — town.ts)

export const UNLOCK_NAME = "dabong";

export function isUnlockTester(name: string | undefined | null): boolean {
  return (name ?? "").trim().toLowerCase() === UNLOCK_NAME;
}

/** 모든 몬스터(사람·허수아비 제외)를 보고, 모든 편린을 흡수해 본 도감 */
export function fullCodex(): Codex {
  const seen = Object.values(MONSTERS).filter((m) => !m.human && !m.dummy).map((m) => m.id);
  const frags = Object.keys(FRAGMENTS);
  return { ...emptyCodex(), seen, fragSeen: frags, fragKnown: frags };
}

export const ALL_FAITHS: string[] = [...new Set(Object.values(FAITH))];
/** 삶을 넘어 이어지는 조각(칙서는 삶마다 새로) */
export const META_CLUES: string[] = CLUES.map((c) => c.id).filter((id) => id !== "edict");
export const ALL_ENDINGS: EndingKind[] = ["offering", "true", "fallen", "escape"];

/** 이번 삶에 모두 연다(캐릭터 생성 때) */
export function unlockAll(s: GameState): void {
  s.faithsKnown = [...new Set([...s.faithsKnown, ...ALL_FAITHS])];
  s.codex = mergeCodex(s.codex ?? emptyCodex(), fullCodex());
  s.clues = [...new Set([...(s.clues ?? []), ...META_CLUES])];
}
