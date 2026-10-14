import { josa } from "./josa";
import { BAL } from "./data";
import { log, rngOf } from "./core";
import { CORRODE_NAME, CORRODE_SLOTS, GEAR, SLOTS, corrosionOf, gearHas, type CorrodeSlot } from "./gear";
import { plagueImmune, pray } from "./faith";
import { fragSkills } from "./fragments";
import { infect } from "./injury";
import type { GameState } from "./types";

// 3섹터 "물에 잠긴 사원"의 새 상태이상(2026-10-14, SECTOR3_DRAFT 2절).
// - 부식(장비 슬롯 0~3): 장비는 부서지지 않고 단계별 패널티만(gear.ts corroded·weaponCorrosion). 대장간 수리·숫돌로 푼다.
// - 마비(오른손·왼손·발 0~2, 결손 없음): 행동할 때 그 부위가 말을 듣지 않는다. 미궁을 나오면 풀린다.
// - 독(0~2): 방을 옮길 때 HP가 깎인다(질병과 별개). 야영·미궁을 나올 때마다 한 단계.
// - 곰팡이 폐병: 질병 칸(disease)을 쓰는 두 번째 질병. 야영 회복 절반.

export type ParaPart = "main" | "offhand" | "feet";
export const PARA_PARTS: ParaPart[] = ["main", "offhand", "feet"];
export const PARA_PART_NAME: Record<ParaPart, string> = { main: "오른손", offhand: "왼손", feet: "발" };
export const PARA_NAME = ["", "저림", "마비"];
export const POISON_NAME = ["", "중독(경상)", "중독(중상)"];

const SLOT_NAME = Object.fromEntries(SLOTS.map((x) => [x.key, x.name])) as Record<string, string>;

// ── 부식 ──

/** 부식 확률 배율: 기름 먹인 갑옷(몸통)·껍질 편린 절반 */
function corrodeMult(s: GameState): number {
  let m = 1;
  const body = s.gear.body ? GEAR[s.gear.body] : null;
  if (body?.corrodeRes !== undefined) m *= body.corrodeRes;
  if (fragSkills(s).includes("fragShell")) m *= 0.5;
  return m;
}

/** 확률 p로 장비 하나를 부식시킨다. heavy(산성 치명타)면 2단계부터 */
export function corrode(s: GameState, p: number, why: string, heavy = false): void {
  const r = rngOf(s);
  if (!r.chance(p * corrodeMult(s))) return;
  const slots = CORRODE_SLOTS.filter((k) => {
    const id = s.gear[k];
    return id && GEAR[id].corrodeRes !== 0 && corrosionOf(s, k) < 3;
  });
  if (!slots.length) return;
  const slot = r.pick(slots);
  const before = corrosionOf(s, slot);
  const after = Math.min(3, heavy ? Math.max(2, before + 1) : before + 1);
  (s.corrosion ??= {})[slot] = after;
  log(s, `【부식】 ${why} — ${josa(GEAR[s.gear[slot]!].name, "이")} ${CORRODE_NAME[after]}! (${corrosionEffect(slot, after)})`, "hurt");
}

export function corrosionEffect(slot: string, stage: number): string {
  if (slot === "main") return ["", "피해 −1", "피해 −1, 명중 −2", "피해 주사위 1d4, 명중 −3"][stage];
  return ["", "보너스 −1", "보너스 절반", "보너스 없음"][stage];
}

/** 부식된 슬롯 목록(심한 순) */
export function corrodedSlots(s: GameState): CorrodeSlot[] {
  return CORRODE_SLOTS.filter((k) => s.gear[k] && corrosionOf(s, k) > 0).sort((a, b) => corrosionOf(s, b) - corrosionOf(s, a));
}

/** 숫돌: 가장 심하게 삭은 장비 하나를 한 단계 */
export function useWhetstone(s: GameState): void {
  if (s.combat || s.inventory.whetstone <= 0 || (s.phase !== "town" && s.phase !== "dungeon")) return;
  const slot = corrodedSlots(s)[0];
  if (!slot) return;
  s.inventory.whetstone -= 1;
  s.corrosion![slot] = corrosionOf(s, slot) - 1;
  log(s, `숫돌로 ${josa(GEAR[s.gear[slot]!].name, "을")} 갈았다. (${SLOT_NAME[slot]}: ${CORRODE_NAME[corrosionOf(s, slot)] || "멀쩡함"})`, "good");
}

/** 대장간 수리비(그 슬롯을 새것처럼) */
export function repairCost(s: GameState, slot: CorrodeSlot): number {
  return Math.ceil((BAL.repairCost[corrosionOf(s, slot)] ?? 0) * (s.priceIndex ?? 1));
}

export function repair(s: GameState, slot: CorrodeSlot): void {
  const cost = repairCost(s, slot);
  if (s.phase !== "town" || s.heretic || !s.gear[slot] || corrosionOf(s, slot) <= 0 || s.gold < cost) return;
  s.gold -= cost;
  s.corrosion![slot] = 0;
  pray(s, "greed", -Math.ceil(cost / 20));
  log(s, `대장간에서 ${josa(GEAR[s.gear[slot]!].name, "을")} 손봤다. (${cost}G) 녹이 말끔히 벗겨졌다.`, "system");
}

/** 장비를 바꾸면 그 슬롯의 부식은 사라진다(새 장비) */
export function clearCorrosion(s: GameState, slot: string): void {
  if (s.corrosion && slot in s.corrosion) delete (s.corrosion as Record<string, number>)[slot];
}

// ── 독·마비 ──

function poisonMult(s: GameState): number {
  return gearHas(s, (g) => g.poisonRes).reduce((m, g) => m * g.poisonRes!, 1);
}

export function poisonOf(s: GameState): number {
  return s.poison ?? 0;
}

export function poisonAfflict(s: GameState, p: number, why: string): void {
  if (poisonOf(s) >= 2) return;
  const m = poisonMult(s) * (fragSkills(s).includes("fragToadSkin") ? 0.5 : 1);
  if (!rngOf(s).chance(p * m)) return;
  s.poison = poisonOf(s) + 1;
  log(s, `【독】 ${why} — ${POISON_NAME[s.poison]}. ${s.poison >= 2 ? "방을 옮길 때마다 HP −2, 판정 −1" : "방을 옮길 때마다 HP −1"}`, "hurt");
}

export function paraOf(s: GameState, p: ParaPart): number {
  return s.paralysis?.[p] ?? 0;
}

export function anyParalysis(s: GameState): boolean {
  return PARA_PARTS.some((p) => paraOf(s, p) > 0);
}

export function paralyze(s: GameState, chance: number, why: string, part?: ParaPart): void {
  const r = rngOf(s);
  if (!r.chance(chance * poisonMult(s))) return;
  const p = part ?? r.pick(PARA_PARTS);
  const before = paraOf(s, p);
  if (before >= 2) return;
  (s.paralysis ??= {})[p] = before + 1;
  log(s, `【마비】 ${why} — ${josa(PARA_PART_NAME[p], "이")} ${PARA_NAME[before + 1]}! (${paraEffect(p, before + 1)})`, "hurt");
}

export function paraEffect(p: ParaPart, v: number): string {
  const what = { main: "공격하지 못할", offhand: "방패를 들지 못할", feet: "도망치지 못할" }[p];
  return v >= 2 ? `행동할 때 50% 확률로 ${what} 수 있다, 다른 부위도 10%` : `행동할 때 20% 확률로 ${what} 수 있다`;
}

/** 이번 행동에서 이 부위가 말을 듣지 않는가 */
export function paraFires(s: GameState, p: ParaPart): boolean {
  const own = paraOf(s, p);
  const other = PARA_PARTS.some((x) => x !== p && paraOf(s, x) >= 2) ? 0.1 : 0;
  const chance = (own >= 2 ? 0.5 : own === 1 ? 0.2 : 0) + other;
  return chance > 0 && rngOf(s).chance(chance);
}

/** 해독초: 독 한 단계 + 가장 심한 마비 한 단계 */
export function useAntidote(s: GameState): void {
  if (s.combat || s.inventory.antidote <= 0 || (s.phase !== "town" && s.phase !== "dungeon")) return;
  const worst = [...PARA_PARTS].sort((a, b) => paraOf(s, b) - paraOf(s, a))[0];
  if (poisonOf(s) <= 0 && paraOf(s, worst) <= 0) return;
  s.inventory.antidote -= 1;
  const out: string[] = [];
  if (poisonOf(s) > 0) {
    s.poison = poisonOf(s) - 1;
    out.push(s.poison ? "독이 조금 빠졌다" : "독이 빠졌다");
  }
  if (paraOf(s, worst) > 0) {
    s.paralysis![worst] = paraOf(s, worst) - 1;
    out.push(`${PARA_PART_NAME[worst]}에 감각이 돌아온다`);
  }
  log(s, `해독초를 씹었다. ${out.join(", ")}.`, "good");
}

/** 야영 한 번: 독·마비가 한 단계씩 */
export function restHazards(s: GameState): void {
  const out: string[] = [];
  if (poisonOf(s) > 0) {
    s.poison = poisonOf(s) - 1;
    out.push(s.poison ? "독이 조금 빠졌다" : "독이 빠졌다");
  }
  if (anyParalysis(s)) {
    for (const p of PARA_PARTS) if (paraOf(s, p) > 0) s.paralysis![p] = paraOf(s, p) - 1;
    out.push("저린 몸이 조금 풀렸다");
  }
  if (out.length) log(s, `${out.join(", ")}.`, "good");
}

/** 미궁을 나올 때: 마비는 사라지고 독은 한 단계 */
export function leaveHazards(s: GameState, lines: string[]): void {
  if (anyParalysis(s)) {
    s.paralysis = {};
    lines.push("미궁을 나오자 저렸던 몸이 풀렸다. (마비 해제)");
  }
  if (poisonOf(s) > 0) {
    s.poison = poisonOf(s) - 1;
    lines.push(s.poison ? "독이 조금 빠졌다. (중독 경상 — 해독초·여관)" : "바깥 공기를 마시자 독이 빠졌다.");
  }
  const cs = corrodedSlots(s);
  if (cs.length) lines.push(`삭은 장비: ${cs.map((k) => `${GEAR[s.gear[k]!].name}(${CORRODE_NAME[corrosionOf(s, k)]})`).join(", ")} — 대장간에서 고칠 수 있다.`);
}

/** 방을 옮길 때 독으로 깎이는 HP */
export function poisonPerMove(s: GameState): number {
  return [0, 1, 2][poisonOf(s)] ?? 0;
}

// ── 곰팡이 폐병 ──

export function moldAfflict(s: GameState, p: number): void {
  const m = gearHas(s, (g) => g.moldRes).reduce((x, g) => x * g.moldRes!, 1);
  if (rngOf(s).chance(p * m)) infect(s, "mold");
}

/** 곰팡이 폐병이면 야영 회복 절반(역병의 신 ★1이면 멀쩡) */
export function campHealMult(s: GameState): number {
  return s.disease > 0 && s.diseaseKind === "mold" && !plagueImmune(s) ? 0.5 : 1;
}
