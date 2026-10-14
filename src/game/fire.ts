import { josa } from "./josa";
import { BAL } from "./data";
import { check, log, rngOf } from "./core";
import { gearHas } from "./gear";
import { allSkills } from "./skills";
import { LEVEL_NAME, PART_NAME, partEffect, type Part } from "./injury";
import type { GameState } from "./types";

// 4섹터 "불타는 광산 갱도"의 화상·동상·냉기·환기(2026-10-14, SECTOR4_DRAFT 2절).
// 화상·동상은 부상 칸(injuries)을 그대로 올리는 새 원인이다 — 페널티·결손·치료(붕대·여관·의수·재생)는 부상 그대로.
// - 화상: 한 번에 크게(중상부터 올 수 있다). 중상인 채 치료 없이 전투를 3번 더 하면 결손 판정(체력 DC 13).
//   화상·동상은 머리·몸통을 결손까지 몰지 않는다(중상에서 멈춤 — 즉사 경로를 줄인다). 손·발은 결손까지 간다.
//   지하수 웅덩이·화상 연고로 한 단계 낫는다.
// - 동상: 냉기(0~4)가 쌓여 4가 되면 손·발 하나가 한 단계. 장작을 때고 야영하면 냉기 0 + 동상 한 단계.
// - 환기: 12시간마다 바람 ↔ 고임(2섹터 낮·밤과 같은 주기).

const BURN_PARTS: { item: Part; w: number }[] = [
  { item: "main", w: 3 },
  { item: "offhand", w: 3 },
  { item: "body", w: 3 },
  { item: "feet", w: 1 },
  { item: "head", w: 0.5 },
];
const FROST_PARTS: Part[] = ["main", "offhand", "feet"];

function hasSkill(s: GameState, id: string): boolean {
  return allSkills(s).includes(id);
}

// ── 환기 ──

/** 4섹터 환기: 고임(공기가 고여 1·2층이 끓는다)인가. 아니면 바람(3층이 언다) */
export function stagnant(s: GameState): boolean {
  const dg = s.dungeon;
  if (!dg || dg.sector !== 4 || dg.endless) return false;
  return Math.floor((dg.clock ?? 0) / BAL.dayNightTurns) % 2 === 1;
}

export function windy(s: GameState): boolean {
  const dg = s.dungeon;
  return !!dg && dg.sector === 4 && !dg.endless && !stagnant(s);
}

// ── 화상 ──

/** 화상 확률 배율: 내화 가죽 갑옷·불 먹은 몸·불타는 피·불 먹은 피부 각각 절반 */
export function burnMult(s: GameState): number {
  let m = gearHas(s, (g) => g.burnRes).reduce((x, g) => x * g.burnRes!, 1);
  for (const id of ["fireBody", "burningBlood", "fragFireSkin"]) if (hasSkill(s, id)) m *= 0.5;
  return m;
}

/** 확률 p로 화상. heavy면 중상부터. parts가 있으면 그 부위 중에서. 죽었으면 true */
export function burnWound(s: GameState, p: number, why: string, opts: { heavy?: boolean; parts?: Part[] } = {}): boolean {
  const r = rngOf(s);
  if (!r.chance(p * burnMult(s))) return false;
  const pool = opts.parts ? BURN_PARTS.filter((x) => opts.parts!.includes(x.item)) : BURN_PARTS;
  return hurtBy(s, r.weighted(pool), "burn", why, opts.heavy);
}

/** 화상·동상으로 부위 단계를 올린다(부상과 같은 칸). 머리·몸통이 결손이 되면 죽음. 죽었으면 true */
function hurtBy(s: GameState, p: Part, cause: "burn" | "frost", why: string, heavy = false): boolean {
  const before = s.injuries[p] ?? 0;
  if (before >= 3) return false;
  let v = Math.min(3, heavy ? Math.max(2, before + 1) : before + 1);
  if (v >= 3 && hasSkill(s, "fragTwoBloods")) v = 2; // 두 개의 피: 결손까지 가지 않는다
  if (v >= 3 && (p === "head" || p === "body")) v = 2; // 화상·동상으로는 머리·몸통을 잃지 않는다(즉사 경로를 줄인다)
  if (v === before) return false;
  s.injuries[p] = v;
  (s.injuryCause ??= {})[p] = cause;
  if (cause === "burn" && v >= 2) (s.burnFights ??= {})[p] = 0;
  const name = cause === "burn" ? "화상" : "동상";
  log(s, `【${name}】 ${why} — ${josa(PART_NAME[p], "이")} ${LEVEL_NAME[v]}! (${partEffect(s, p)})`, "hurt");
  return false;
}

/** 전투가 끝날 때마다: 화상 중상인 부위는 치료 없이 3번 넘게 싸우면 결손 판정(체력 DC 13) */
export function burnAfterFight(s: GameState): void {
  if (!s.burnFights) return;
  for (const p of Object.keys(s.burnFights) as Part[]) {
    if (s.injuryCause?.[p] !== "burn" || (s.injuries[p] ?? 0) !== 2) {
      delete s.burnFights[p];
      continue;
    }
    s.burnFights[p] = (s.burnFights[p] ?? 0) + 1;
    if (s.burnFights[p]! <= 3) continue;
    const c = check(s, "con", 13);
    if (c.ok) {
      log(s, `${PART_NAME[p]}의 화상이 곪아 간다. 이를 악물고 버텼다. (체력 ${c.total} vs 13 — 연고나 지하수가 필요하다)`, "hurt");
      continue;
    }
    delete s.burnFights[p];
    if (hurtBy(s, p, "burn", "치료하지 못한 화상이 깊이 번졌다")) return;
  }
}

/** 화상 연고·지하수: 화상 입은 부위 하나를 한 단계 */
export function easeBurn(s: GameState, why: string): boolean {
  const p = burnParts(s)[0];
  if (!p) return false;
  s.injuries[p] -= 1;
  if (s.burnFights) delete s.burnFights[p];
  if (s.injuries[p] <= 0) delete s.injuryCause![p];
  log(s, `${why} ${PART_NAME[p]}: ${LEVEL_NAME[s.injuries[p]]}`, "good");
  return true;
}

/** 화상 입은 부위(심한 순, 결손 제외) */
export function burnParts(s: GameState): Part[] {
  return (Object.keys(s.injuryCause ?? {}) as Part[])
    .filter((p) => s.injuryCause![p] === "burn" && s.injuries[p] > 0 && s.injuries[p] < 3)
    .sort((a, b) => s.injuries[b] - s.injuries[a]);
}

export function useSalve(s: GameState): void {
  if (s.combat || s.inventory.salve <= 0 || (s.phase !== "town" && s.phase !== "dungeon")) return;
  if (!burnParts(s).length) return;
  s.inventory.salve -= 1;
  easeBurn(s, "화상 연고를 두껍게 발랐다.");
}

// ── 동상·냉기 ──

/** 냉기 쌓임 배율: 털 안감 외투·서리 피·불타는 피·찬 피 각각 절반 */
export function coldMult(s: GameState): number {
  let m = gearHas(s, (g) => g.coldRes).reduce((x, g) => x * g.coldRes!, 1);
  for (const id of ["frostBlood", "burningBlood", "fragColdBlood"]) if (hasSkill(s, id)) m *= 0.5;
  return m;
}

/** 냉기를 쌓는다. 4가 되면 0으로 돌리고 손·발 하나 동상. 죽었으면 true */
export function chill(s: GameState, n: number, why: string): boolean {
  if (n <= 0) return false;
  const before = s.cold ?? 0;
  s.cold = Math.min(4, before + n * coldMult(s));
  if (Math.floor(s.cold) > Math.floor(before) && s.cold < 4) log(s, `${why} — 몸이 식는다. (냉기 ${Math.floor(s.cold)}/4)`, "hurt");
  if (s.cold < 4) return false;
  s.cold = 0;
  return hurtBy(s, rngOf(s).pick(FROST_PARTS), "frost", `${why} — 손발 끝이 감각을 잃었다`);
}

export function warm(s: GameState, n: number): void {
  if ((s.cold ?? 0) > 0) s.cold = Math.max(0, (s.cold ?? 0) - n);
}

/** 동상 입은 부위(심한 순, 결손 제외) */
export function frostParts(s: GameState): Part[] {
  return (Object.keys(s.injuryCause ?? {}) as Part[])
    .filter((p) => s.injuryCause![p] === "frost" && s.injuries[p] > 0 && s.injuries[p] < 3)
    .sort((a, b) => s.injuries[b] - s.injuries[a]);
}

/** 야영: 장작이 있고 냉기·동상이 있으면 불을 피운다(냉기 0 + 동상 한 단계), 없으면 냉기 −2 */
export function campWarmth(s: GameState): void {
  const frozen = frostParts(s)[0];
  if (s.inventory.firewood > 0 && ((s.cold ?? 0) > 0 || frozen)) {
    s.inventory.firewood -= 1;
    s.cold = 0;
    let line = "장작으로 불을 피웠다. 언 몸이 녹는다.";
    if (frozen) {
      s.injuries[frozen] -= 1;
      if (s.injuries[frozen] <= 0) delete s.injuryCause![frozen];
      line += ` ${PART_NAME[frozen]}: ${LEVEL_NAME[s.injuries[frozen]]}`;
    }
    log(s, line, "good");
  } else if ((s.cold ?? 0) > 0) warm(s, 2);
}

/** 원인 표시 정리: 다 나은 부위는 표시를 지운다(붕대·여관·재생으로 나은 경우) */
export function syncCauses(s: GameState): void {
  if (!s.injuryCause) return;
  for (const p of Object.keys(s.injuryCause) as Part[]) {
    if ((s.injuries[p] ?? 0) <= 0) {
      delete s.injuryCause[p];
      if (s.burnFights) delete s.burnFights[p];
    }
  }
}

/** 낙반·폭발·광차 피해 배율과 감소(미믹의 경첩 방패 절반, 광석 껍질 −3) */
export function blastDamage(s: GameState, dmg: number): number {
  const m = gearHas(s, (g) => g.blastRes).reduce((x, g) => x * g.blastRes!, 1);
  return Math.max(1, Math.round(dmg * m) - (hasSkill(s, "fragOreShell") ? 3 : 0));
}
