import { gearHas } from "./gear";
import { allSkills } from "./skills";
import { lvl } from "./injury";
import { GEAR } from "./gear";
import { power } from "./faith";
import { smod } from "./core";
import type { GameState } from "./types";

// 5섹터 "바닥없는 균열"(2026-10-14, SECTOR5_DRAFT): 새 상태이상 없이 있는 규칙(꺼진 바닥 추락·낮밤 주기·정신 상태이상·포만감)을 다시 쓴다.
// - 균열의 숨: 2섹터 낮·밤과 같은 12시간 주기. 들숨(어둠) = isNight()가 참.
// - 벼랑길: 보이는 위험. 조심히(이동 ×2, 민첩 DC 10) / 그냥(DC 14) / 밧줄(자동 성공) / 심연 신도는 뛰어내리기. 실패하면 fall().
// - 붙잡기·밀쳐 떨어뜨리기·허기 공격·응시는 combat.ts.

function hasSkill(s: GameState, id: string): boolean {
  return allSkills(s).includes(id);
}

/** 어둠(들숨·밤) 페널티를 무시하는가: 이끼 등불 투구·반향 편린 */
export function darkSight(s: GameState): boolean {
  return gearHas(s, (g) => g.darkSight).length > 0 || hasSkill(s, "fragEcho");
}

/** 벼랑길 판정 보정: 들숨 −2, 발 부상 −2/−4, 무거운 갑옷 −2, 갈고리 장화 +4, 거미 발 +3 */
export function ledgeBonus(s: GameState, dark: boolean): number {
  const feet = lvl(s, "feet");
  const body = s.gear.body ? GEAR[s.gear.body] : null;
  return (dark && !darkSight(s) ? -2 : 0) + (feet >= 2 ? -4 : feet === 1 ? -2 : 0) + ((body?.bonus.flee ?? 0) < 0 ? -2 : 0)
    + gearHas(s, (g) => g.ledge).reduce((a, g) => a + g.ledge!, 0) + (hasSkill(s, "fragSpiderFeet") ? 3 : 0);
}

/** 추락 피해 배율: 박쥐 날개 망토·떨어진 것들 편린 절반, 심연의 신 ★5면 0 */
export function fallGearMult(s: GameState): number {
  if (power(s, "abyss", 5)) return 0;
  return gearHas(s, (g) => g.fallRes).reduce((m, g) => m * g.fallRes!, 1) * (hasSkill(s, "fragFallen") ? 0.5 : 1);
}

/** 붙잡힐 확률 배율: 그림자 가죽 갑옷·힘 보정 3 이상 각각 절반, 심연의 신 ★5 면역(보스에겐 ★2부터 절반) */
export function grabMult(s: GameState, boss: boolean): number {
  if (power(s, "abyss", 5)) return 0;
  return gearHas(s, (g) => g.grabRes).reduce((m, g) => m * g.grabRes!, 1) * (smod(s, "str") >= 3 ? 0.5 : 1) * (boss && power(s, "abyss", 2) ? 0.5 : 1);
}
