import type { GameState, Meta } from "../game/types";
import { FRAGMENTS, emptyCodex, mergeCodex } from "../game/fragments";
import { SKILLS } from "../game/skills";

// 저장 데이터 이전(업데이트해도 옛 저장이 깨지지 않게).
//
// 두 단계로 나눈다.
// 1) MIGRATIONS — 저장 형식 판(saveRev)을 한 칸씩 올리는 한 번짜리 변환. 이름이 바뀐 필드·지운 기술 바꿔치기처럼
//    "한 번만 해야 하는" 일. 새로 추가할 때는 맨 끝에 { rev: SAVE_REV + 1, ... }를 붙이고 SAVE_REV를 올린다.
// 2) normalize — 매번 불러올 때 도는 보정. 새 필드 기본값 채우기(??=), 사라진 id 빼기처럼 몇 번 돌아도 같은 일.
//    새 필드를 추가하면 여기에 기본값 한 줄을 더한다(판을 올릴 필요 없음).
//
// 저장 형식 판이 이 빌드보다 높은 저장(더 새 빌드에서 저장한 것)은 storage.ts가 따로 백업해 둔다.

/** 지금 빌드의 저장 형식 판 */
export const SAVE_REV = 1;

interface Migration {
  /** 이 변환을 마치면 저장이 이 판이 된다 */
  rev: number;
  note: string;
  run(s: GameState): void;
}

/** 2026-10-15 지운 모험가 16레벨 기술(마을 화신) */
const OLD_ADV_AVATARS = ["fighterAvatar", "casterAvatar", "rogueAvatar"];

const MIGRATIONS: Migration[] = [
  {
    rev: 1,
    note: "2026-10-17 저장 형식 판 도입. 옛 모험가 16레벨 화신 기술은 '신에게 배운 자'(영구 보너스)로",
    run(s) {
      if (s.skills.some((id) => OLD_ADV_AVATARS.includes(id)) && !s.skills.includes("godTaught")) s.skills.push("godTaught");
    },
  },
];

/** 매번 도는 보정: 판 표시 이전부터 쌓인 기본값 채우기와 사라진 id 정리 */
function normalize(s: GameState): void {
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
  s.inventory.spore ??= 0;
  s.inventory.scale ??= 0;
  s.inventory.fang ??= 0;
  s.inventory.salve ??= 0;
  s.inventory.firewood ??= 0;
  s.inventory.powder ??= 0;
  s.inventory.rope ??= 0;
  s.inventory.incense ??= 0;
  s.clues ??= [];
  s.inventory.whetstone ??= 0;
  s.inventory.antidote ??= 0;
  s.inventory.bolt ??= 0;
  s.faithsKnown ??= s.hero.faith ? [s.hero.faith] : [];
  // 없는 기술·편린 id는 뺀다(화면이 깨지지 않게)
  s.skills = s.skills.filter((id) => !!SKILLS[id]);
  s.fragments = s.fragments.filter((id) => !!FRAGMENTS[id]);
  s.codex = mergeCodex(s.codex ?? emptyCodex(), { ...emptyCodex(), fragKnown: s.fragments });
}

/** 불러온 진행 중인 삶을 지금 빌드 형식으로. 쓸 수 없는 저장이면 null */
export function fixRun(s: GameState | null): GameState | null {
  if (!s || typeof s !== "object" || s.version !== 1 || !s.hero || !s.inventory) return null;
  const from = s.saveRev ?? 0;
  for (const m of MIGRATIONS) if (m.rev > from) m.run(s);
  normalize(s);
  s.saveRev = Math.max(from, SAVE_REV);
  return s;
}

/** 삶을 넘어 이어지는 기록(묘지·신앙 해금·도감·조각·엔딩) */
export function fixMeta(m: Partial<Meta> | null | undefined): Meta {
  return {
    graveyard: m?.graveyard ?? [],
    faiths: m?.faiths ?? [],
    codex: m?.codex ? mergeCodex(emptyCodex(), m.codex) : emptyCodex(),
    tipsSeen: m?.tipsSeen ?? [],
    tipsOff: m?.tipsOff ?? false,
    clues: m?.clues ?? [],
    endings: m?.endings ?? [],
    saveRev: Math.max(m?.saveRev ?? 0, SAVE_REV),
  };
}

/** 이 빌드보다 새 형식의 저장인지(옛 빌드로 열었을 때) */
export function isNewerSave(raw: { saveRev?: number } | null | undefined): boolean {
  return (raw?.saveRev ?? 0) > SAVE_REV;
}
