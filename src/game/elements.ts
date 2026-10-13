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
