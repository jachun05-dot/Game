import type { StatKey } from "./types";

// 마법사 원소(2026-10-14): 마법사의 훈련은 화염·서리·번개·대지 수련 네 가지뿐이다.
// 어느 레벨에서 어느 원소를 수련했는지에 따라 배우는 기술이 정해진다(짝수 레벨 패시브, 홀수 레벨 액티브).
// 4·7·10레벨은 보스 재료가 드는 특수 훈련 — 그때 고른 원소의 특화 기술을 얻는다.
// 주문의 명중·피해는 그 원소의 주 능력치를 따른다. 지팡이 마력탄은 4레벨에 처음 특화한 원소(주 원소)를 따른다.
// 데이터만 둔다(효과 처리는 combat.ts, 기술 정의는 skills.ts).

export type ElementKey = "fire" | "frost" | "bolt" | "earth";
export const ELEMENT_KEYS: ElementKey[] = ["fire", "frost", "bolt", "earth"];

export const ELEMENTS: Record<ElementKey, { name: string; main: StatKey; sub: StatKey; mark: string }> = {
  fire: { name: "화염", main: "int", sub: "str", mark: "fireMark" },
  frost: { name: "서리", main: "per", sub: "int", mark: "frostMark" },
  bolt: { name: "번개", main: "dex", sub: "luk", mark: "boltMark" },
  earth: { name: "대지", main: "con", sub: "per", mark: "earthMark" },
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
