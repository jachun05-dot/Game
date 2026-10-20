import { tk } from "../i18n/core";
import { maxHp } from "./core";
import { makeEnemies, startCombat } from "./combat";
import { SKILLS } from "./skills";
import { TRAININGS } from "./data";
import { gateOf, train } from "./town";
import type { DamageMeter, GameState, StatKey } from "./types";

// 훈련소 허수아비: 지금 상태를 복사해 허수아비와 10라운드를 싸워 보고, 준 피해를 잰다.
// 진짜 상태(난수·로그·기록·부상)는 건드리지 않는다. 허수아비는 공격하지 않고, 다 쓰러지면 다시 일어선다.
// 10라운드는 한 번의 긴 싸움으로 친다 — 허수아비가 다시 일어나도 전투당 횟수가 정해진 기술은 다시 채워지지 않는다.
// 같은 상태면 항상 같은 결과가 나오게 측정용 난수 시드를 고정한다.

export type DummyScenario = "single" | "pack" | "armor";

export const DUMMY_SCENARIOS: Record<DummyScenario, { name: string; ids: string[]; desc: string }> = {
  single: { name: "허수아비 1개", ids: ["dummy"], desc: "HP 30 · AC 13 — 보스 하나를 상대할 때" },
  pack: { name: "허수아비 3개", ids: ["dummyPack", "dummyPack", "dummyPack"], desc: "HP 10 · AC 12 × 3 — 무리를 상대할 때" },
  armor: { name: "갑옷 허수아비", ids: ["dummyArmor"], desc: "HP 30 · AC 15 · 단단함 — 스켈레톤·망령처럼 단단한 적" },
};

export const DUMMY_ROUNDS = 10;

export interface DummyReport {
  runs: number;
  /** 10라운드 평균 총 피해 */
  total: number;
  /** 라운드별 평균 피해 */
  perRound: number[];
  /** 출처별 평균 피해(큰 순) */
  bySource: { id: string; name: string; dmg: number }[];
  /** 평균 처치 수(허수아비가 쓰러진 횟수) */
  kills: number;
  hitRate: number;
  critRate: number;
}

const SOURCE_NAME: Record<string, string> = { attack: tk("기본 공격"), burn: tk("불탐(지속)"), plague: tk("역병"), counter: tk("반격"), boltMark: tk("번개의 각인(튐)") };

export function sourceName(id: string): string {
  return SOURCE_NAME[id] ?? SKILLS[id]?.name ?? id;
}

/** 측정용 복사본: 로그·전투를 비우고 HP를 채운다 */
function cloneForDummy(s: GameState): GameState {
  const t: GameState = JSON.parse(JSON.stringify({ ...s, log: [], combat: null }));
  return t;
}

export function dummyTest(s: GameState, scen: DummyScenario, runs = 200): DummyReport {
  return measure(cloneForDummy(s), scen, runs);
}

function measure(base: GameState, scen: DummyScenario, runs: number): DummyReport {
  const by: Record<string, number> = {};
  const perRound = Array(DUMMY_ROUNDS).fill(0);
  let kills = 0, swings = 0, hits = 0, crits = 0;
  const ids = DUMMY_SCENARIOS[scen].ids;
  for (let i = 0; i < runs; i++) {
    const t: GameState = structuredClone(base);
    t.rng = { s: 0x5eed + i * 7919 };
    t.hero.hp = maxHp(t);
    const m: DamageMeter = { by: {}, rounds: [], base: 0, swings: 0, hits: 0, crits: 0 };
    const uses: Record<string, number> = {};
    // 허수아비가 다 쓰러지면 남은 라운드만큼 새 전투
    for (let guard = 0; m.base < DUMMY_ROUNDS && guard < DUMMY_ROUNDS; guard++) {
      const foes = makeEnemies(t, ids);
      startCombat(t, "dummy", foes, { meter: m, limit: DUMMY_ROUNDS - m.base, used: uses });
      if (t.phase === "dead") break;
      kills += foes.filter((f) => f.hp <= 0).length;
      // 이번 전투가 쓴 라운드: 다 쓰러뜨렸으면 그 라운드까지, 아니면 남은 라운드 전부
      const used = foes.every((f) => f.hp <= 0) ? lastRound(m) - m.base + 1 : DUMMY_ROUNDS - m.base;
      m.base += Math.max(1, used);
      t.log = [];
    }
    for (const [k, v] of Object.entries(m.by)) by[k] = (by[k] ?? 0) + v;
    for (let r = 0; r < DUMMY_ROUNDS; r++) perRound[r] += m.rounds[r] ?? 0;
    swings += m.swings;
    hits += m.hits;
    crits += m.crits;
  }
  const total = perRound.reduce((a, b) => a + b, 0) / runs;
  return {
    runs,
    total,
    perRound: perRound.map((x) => x / runs),
    bySource: Object.entries(by)
      .map(([id, dmg]) => ({ id, name: sourceName(id), dmg: dmg / runs }))
      .sort((a, b) => b.dmg - a.dmg),
    kills: kills / runs,
    hitRate: swings ? hits / swings : 0,
    critRate: hits ? crits / hits : 0,
  };
}

/** 마지막으로 피해가 기록된 라운드(측정 시작부터) */
function lastRound(m: DamageMeter): number {
  for (let i = m.rounds.length - 1; i >= 0; i--) if (m.rounds[i] !== undefined) return i;
  return m.base;
}

/**
 * 이 훈련을 받았다고 치고 허수아비 딜을 잰다(훈련 화면 비교용).
 * 자유 배분이 덜 골라졌으면 훈련의 첫 능력치로 채운다. 훈련비·재료는 복사본에 채워 넣는다.
 */
export function dummyAfterTraining(s: GameState, trainingId: string, free: StatKey[], scen: DummyScenario, runs = 120): DummyReport | null {
  const t = cloneForDummy(s);
  const tr = TRAININGS.find((x) => x.id === trainingId);
  if (!tr) return null;
  t.gold = 1e6;
  const g = gateOf(t);
  if (g) t.inventory[g.item] = Math.max(1, t.inventory[g.item]);
  const lv = t.hero.level;
  const f: [StatKey, StatKey] = [free[0] ?? tr.stats[0], free[1] ?? free[0] ?? tr.stats[0]];
  train(t, trainingId, f);
  if (t.hero.level === lv) return null;
  t.combat = null;
  t.log = [];
  return measure(t, scen, runs);
}
