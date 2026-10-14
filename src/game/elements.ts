import type { StatKey } from "./types";

// 마법사 원소(2026-10-14): 마법사의 훈련은 화염·서리·번개·대지 수련 네 가지뿐이다.
// 어느 레벨에서 어느 원소를 수련했는지에 따라 배우는 기술이 정해진다(짝수 레벨 패시브, 홀수 레벨 액티브).
// 4·7·10레벨은 보스 재료가 드는 특수 훈련 — 그때 고른 원소의 특화 기술을 얻는다.
// 훈련의 고정 능력치는 지능(마법사 기본) + 그 원소의 능력치. 주문·지팡이 피해는 지능을 따르고,
// 원소 능력치는 그 원소의 부가 효과를 키운다(화염 힘: 불탐, 서리 감각: 얼림, 번개 민첩: 튐, 대지 체력: HP).
// 데이터만 둔다(효과 처리는 combat.ts, 기술 정의는 skills.ts).

export type ElementKey = "fire" | "frost" | "bolt" | "earth";
export const ELEMENT_KEYS: ElementKey[] = ["fire", "frost", "bolt", "earth"];

/** stat: 그 원소 수련이 지능과 함께 올리는 능력치(부가 효과에 쓰인다) */
export const ELEMENTS: Record<ElementKey, { name: string; stat: StatKey; mark: string }> = {
  fire: { name: "화염", stat: "str", mark: "fireMark" },
  frost: { name: "서리", stat: "per", mark: "frostMark" },
  bolt: { name: "번개", stat: "dex", mark: "boltMark" },
  earth: { name: "대지", stat: "con", mark: "earthMark" },
};

/** 원소 수련을 받아 이 레벨이 되면 배우는 기술(10레벨은 3섹터와 함께 예정) */
export const ELEMENT_SKILLS: Record<ElementKey, Record<number, string>> = {
  fire: { 2: "fireEmber", 3: "fireArrow", 4: "fireMark", 5: "fireBlast", 6: "fireHeat", 7: "fireSea", 8: "fireWill", 9: "fireBlaze" },
  frost: { 2: "frostCalm", 3: "frostArrow", 4: "frostMark", 5: "frostArmor", 6: "frostTouch", 7: "frostPrison", 8: "frostEye", 9: "frostStorm" },
  bolt: { 2: "boltStep", 3: "boltArrow", 4: "boltMark", 5: "boltChain", 6: "boltStatic", 7: "boltStrike", 8: "boltLuck", 9: "boltOvercharge" },
  earth: { 2: "earthSkin", 3: "earthSling", 4: "earthMark", 5: "earthWall", 6: "earthLevel", 7: "earthPrison", 8: "earthRoot", 9: "earthQuake" },
};

export function isElement(id: string): id is ElementKey {
  return id in ELEMENTS;
}

/** 이 원소 수련으로 toLevel이 될 때 배우는 기술 */
export function elementSkill(el: ElementKey, toLevel: number): string | null {
  return ELEMENT_SKILLS[el][toLevel] ?? null;
}

// ── 전사 훈련(2026-10-14): 수호·검투·광전. 모든 훈련이 힘 + 방향 능력치. 마법사와 같은 레벨표 규칙 ──
export type StyleKey = "guard" | "glad" | "berserk";
export const STYLE_KEYS: StyleKey[] = ["guard", "glad", "berserk"];
export const STYLES: Record<StyleKey, { name: string; mark: string }> = {
  guard: { name: "수호", mark: "guardMark" },
  glad: { name: "검투", mark: "gladMark" },
  berserk: { name: "광전", mark: "berserkMark" },
};
export const STYLE_SKILLS: Record<StyleKey, Record<number, string>> = {
  guard: { 2: "tough", 3: "shieldBash", 4: "guardMark", 5: "holdFast", 6: "shieldCraft", 7: "shieldCounter", 8: "ironBody", 9: "grit" },
  glad: { 2: "sharpEdge", 3: "riposte", 4: "gladMark", 5: "parryCounter", 6: "lightStep", 7: "chainSlash", 8: "readGap", 9: "finisher" },
  berserk: { 2: "roughPower", 3: "wideSweep", 4: "berserkMark", 5: "charge", 6: "bloodThirst", 7: "frenzy", 8: "painless", 9: "smash" },
};

// ── 모험가 훈련(2026-10-14): 전사형(힘·체력)·마법사형(지능·감각)·민첩형(민첩·행운). 전문 직업보다 좁고 얕다 ──
export type BranchKey = "fighter" | "caster" | "rogue";
export const BRANCH_KEYS: BranchKey[] = ["fighter", "caster", "rogue"];
export const BRANCHES: Record<BranchKey, { name: string; mark: string }> = {
  fighter: { name: "전사형", mark: "fighterMark" },
  caster: { name: "마법사형", mark: "casterMark" },
  rogue: { name: "민첩형", mark: "shadowMark" },
};
export const BRANCH_SKILLS: Record<BranchKey, Record<number, string>> = {
  fighter: { 2: "swordHand", 3: "sweep", 4: "fighterMark", 5: "parry", 6: "tough", 7: "doubleSlash", 8: "toughMuscle", 9: "finisher" },
  caster: { 2: "manaSense", 3: "magicMissile", 4: "casterMark", 5: "fireBurst", 6: "firstAid", 7: "frostPrison", 8: "keenSense", 9: "boltChain" },
  rogue: { 2: "lightStep", 3: "pickpocket", 4: "shadowMark", 5: "shadowStep", 6: "trapHand", 7: "smoke", 8: "luckyStrike", 9: "vitalStab" },
};

/** 레벨표가 있는 훈련(마법사 원소·전사 방향·모험가 갈래) */
const LEVEL_TABLES: Record<string, Record<number, string>> = { ...ELEMENT_SKILLS, ...STYLE_SKILLS, ...BRANCH_SKILLS };
const MARK_OF_LINE: Record<string, string> = {
  ...Object.fromEntries(ELEMENT_KEYS.map((k) => [k, ELEMENTS[k].mark])),
  ...Object.fromEntries(STYLE_KEYS.map((k) => [k, STYLES[k].mark])),
  ...Object.fromEntries(BRANCH_KEYS.map((k) => [k, BRANCHES[k].mark])),
};

export function hasLevelTable(trainingId: string): boolean {
  return trainingId in LEVEL_TABLES;
}

/** 이 훈련으로 toLevel이 될 때 배우는 기술 */
export function levelSkill(trainingId: string, toLevel: number): string | null {
  return LEVEL_TABLES[trainingId]?.[toLevel] ?? null;
}

/** 이 기술을 전투당 1회 더 쓰게 해 주는 각인들(그 기술이 들어 있는 레벨표의 특화 패시브) */
export const MARK_FOR_SKILL: Record<string, string[]> = {};
for (const [line, table] of Object.entries(LEVEL_TABLES)) {
  for (const id of Object.values(table)) if (id !== MARK_OF_LINE[line]) (MARK_FOR_SKILL[id] ??= []).push(MARK_OF_LINE[line]);
}
