import { josa } from "./josa";
import { BAL, FEED, FIELD_ENCOUNTERS, NAMES, RIVAL_NEWS, RIVALS, RUMORS, STAT_KEYS, STAT_LABEL, TRAININGS } from "./data";
import { addStat, emptyStats, kill, log, maxHp, rngOf, taxDue, topBehavior } from "./core";
import { makeEnemies, startCombat } from "./combat";
import { Rng } from "./rng";
import { CLASSES, type ClassId } from "./classes";
import { GEAR, equip, targetSlot } from "./gear";
import type { Activity, Candidate, CombatState, GameState, StatKey, Stats, Tactics, WeekResult } from "./types";

// DESIGN 14.1 런 시작 / 14.2 마을(1주=1턴) / 14.4 월말 정산

export function newRun(seed: number): GameState {
  const s: GameState = {
    version: 1,
    seed,
    rng: { s: seed },
    phase: "create",
    hero: { name: "", stats: emptyStats(), level: 1, hp: 1, satiety: 100, fatigue: 0, faith: null, cls: "adventurer" },
    month: 1,
    week: 1,
    gold: BAL.startGold,
    inventory: { food: 0, potion: 0, scroll: 0 },
    gear: {},
    skills: [],
    tactics: { potionAt: 35, fleeAt: 0 },
    tripUsed: [],
    rank: 0,
    recordsRead: 0,
    behavior: emptyStats(),
    candidates: [],
    rerollsLeft: 2,
    log: [],
    logCount: 0,
    combat: null,
    dungeon: null,
    weekResult: null,
    settlement: null,
    tomb: null,
    history: [],
    nextUid: 1,
  };
  s.candidates = makeCandidates(new Rng(s.rng), "adventurer");
  return s;
}

/**
 * 합계가 같고 분포만 다른 후보 3장(DESIGN 14.1). 직업마다 성향(archetype)과 공통 성향(lean)이 달라
 * 전사는 힘·체력, 마법사는 지능 쪽으로 쏠린 후보가 나온다.
 */
export function makeCandidates(r: Rng, cls: ClassId): Candidate[] {
  const def = CLASSES[cls];
  const types = r.shuffle([...def.archetypes]).slice(0, 3);
  return types.map((t) => {
    const stats = emptyStats();
    for (const k of STAT_KEYS) stats[k] = 2;
    let left = BAL.startStatSum - 12;
    const weight = (key: StatKey) => (t.favor[0] === key ? 4 : t.favor.includes(key) ? 3 : 1) + (def.lean.includes(key) ? 1 : 0);
    while (left > 0) {
      const k = r.weighted(STAT_KEYS.map((key) => ({ item: key, w: weight(key) })));
      if (stats[k] >= 11) continue;
      stats[k] += 1;
      left -= 1;
    }
    return { archetype: t.name, stats };
  });
}

export function rerollCandidates(s: GameState): void {
  if (s.phase !== "create" || s.rerollsLeft <= 0) return;
  s.rerollsLeft -= 1;
  s.candidates = makeCandidates(rngOf(s), s.hero.cls);
}

/** 직업을 바꾸면 그 직업 성향의 후보를 새로 뽑는다(다시 뽑기 횟수는 쓰지 않음) */
export function pickClass(s: GameState, cls: ClassId): void {
  if (s.phase !== "create" || !CLASSES[cls] || s.hero.cls === cls) return;
  s.hero.cls = cls;
  s.candidates = makeCandidates(rngOf(s), cls);
}

export function randomName(s: GameState): string {
  return rngOf(s).pick(NAMES);
}

export function createHero(s: GameState, name: string, candidate: number, faith: string | null): void {
  if (s.phase !== "create") return;
  const c = s.candidates[candidate];
  s.hero.name = name.trim() || "이름 없는 소년";
  s.hero.stats = { ...c.stats };
  s.hero.faith = faith;
  const cls = CLASSES[s.hero.cls];
  s.gear = { ...cls.start };
  s.gold = cls.gold;
  s.hero.hp = maxHp(s);
  s.phase = "town";
  const kit = Object.values(cls.start).map((id) => GEAR[id!].name).join(", ");
  log(s, `— ${s.hero.name}, ${c.archetype}. ${cls.name}${s.hero.cls === "adventurer" ? "로" : "로"} 등록되었다.`, "system");
  log(s, `${cls.motive} 지급품: ${kit}. 소지금 ${s.gold}G.`, "story");
  if (faith) log(s, `당신은 몰래 ${josa(faith, "을")} 섬기기로 했다.`, "story");
  log(s, `— 1월 1주차. 4주차에 미궁이 열린다.`, "system");
}

export function trainCost(s: GameState): number {
  return BAL.trainCostPerLevel * s.hero.level;
}

export function canTrain(s: GameState): boolean {
  return s.phase === "town" && s.hero.level < BAL.maxLevel && s.gold >= trainCost(s);
}

function feedLines(r: Rng, good: boolean): string[] {
  const out: string[] = [];
  const rival = r.pick(RIVALS);
  out.push(r.pick(RIVAL_NEWS).replace("%s이(가)", josa(rival, "이")).replace("%s", rival));
  out.push(r.pick(good ? FEED.good : FEED.bad));
  if (r.chance(0.5)) out.push(r.pick(RUMORS));
  return out;
}

function finishWeek(s: GameState, res: Omit<WeekResult, "month" | "week" | "feed">, good: boolean): void {
  const r = rngOf(s);
  s.weekResult = { ...res, month: s.month, week: s.week, feed: feedLines(r, good) };
  s.hero.hp = maxHp(s); // 마을에서 일주일이면 회복된다(부상 시스템은 아직 미구현)
  s.phase = "week-result";
}

/**
 * 훈련 = 레벨업(DESIGN 7절): 고정 2(훈련 종류) + 자유 2 + 행동 기반 2
 */
export function train(s: GameState, trainingId: string, free: [StatKey, StatKey]): void {
  if (!canTrain(s)) return;
  const t = TRAININGS.find((x) => x.id === trainingId);
  if (!t || !canTrainAt(s, t.id)) return;
  const cost = trainCost(s);
  s.gold -= cost;
  const delta: Partial<Stats> = {};
  const bump = (k: StatKey) => {
    addStat(s, k, 1);
    delta[k] = (delta[k] ?? 0) + 1;
  };
  t.stats.forEach(bump);
  free.forEach(bump);
  const top = topBehavior(s);
  const noBehavior = s.behavior[top[0]] === 0;
  const r = rngOf(s);
  const behaviorPicks: StatKey[] = noBehavior ? [r.pick(STAT_KEYS), r.pick(STAT_KEYS)] : [top[0], s.behavior[top[1]] > 0 ? top[1] : top[0]];
  behaviorPicks.forEach(bump);
  s.behavior = emptyStats();
  const from = s.hero.level;
  s.hero.level += 1;
  const learned = nextSkill(s, t.id);
  if (learned) s.skills.push(learned);
  const lines = [
    `${t.name} — ${t.desc}. (${cost}G)`,
    `고정: ${t.stats.map((k) => STAT_LABEL[k]).join(", ")} / 자유: ${free.map((k) => STAT_LABEL[k]).join(", ")} / ${noBehavior ? "몸이 기억한 것(무작위)" : "몸이 기억한 것"}: ${behaviorPicks.map((k) => STAT_LABEL[k]).join(", ")}`,
  ];
  if (!learned) lines.push("이 훈련에서 더 배울 기술은 없다. (히든 트레이닝은 준비 중)");
  finishWeek(s, { title: "훈련", lines, statDelta: delta, levelUp: { from, to: s.hero.level }, learned: learned ?? undefined, goldDelta: -cost }, true);
}

/** 이 훈련을 받으면 다음에 배울 기술(사다리 순서) */
export function nextSkill(s: GameState, trainingId: string): string | null {
  const t = TRAININGS.find((x) => x.id === trainingId);
  return t?.skills.find((id) => !s.skills.includes(id)) ?? null;
}

export function setTactics(s: GameState, t: Partial<Tactics>): void {
  s.tactics = { ...s.tactics, ...t };
}

export function rumor(s: GameState): void {
  if (s.phase !== "town") return;
  const r = rngOf(s);
  const lines = [r.pick(RUMORS)];
  let gold = 0;
  if (r.chance(0.55)) {
    gold = r.int(10, 30);
    lines.push(r.pick([
      `술집 주인의 잔심부름을 해주고 ${gold}G를 받았다.`,
      `잃어버린 염소를 찾아주고 ${gold}G를 받았다.`,
      `묘지기의 무덤 파기를 도와 ${gold}G를 받았다.`,
      `대장간에서 풀무질을 하고 ${gold}G를 받았다.`,
    ]));
  } else {
    lines.push("일거리는 찾지 못했다.");
  }
  s.gold += gold;
  finishWeek(s, { title: "탐문", lines, statDelta: {}, goldDelta: gold }, gold > 0);
}

export function goField(s: GameState): void {
  if (s.phase !== "town") return;
  const r = rngOf(s);
  log(s, "영지 밖 숲으로 나섰다.", "system");
  s.tripUsed = [];
  startCombat(s, "field", makeEnemies(s, r.weighted(FIELD_ENCOUNTERS)));
}

export function afterFieldCombat(s: GameState, outcome: "win" | "fled", c: CombatState): void {
  if (outcome === "win") {
    s.gold += c.loot;
    finishWeek(s, {
      title: "외부 탐험",
      lines: ["숲에서 적을 물리쳤다.", `얻은 마석을 관공서에서 ${c.loot}G로 바꿨다.`],
      statDelta: {},
      goldDelta: c.loot,
    }, true);
  } else {
    finishWeek(s, { title: "외부 탐험", lines: ["숲에서 도망쳐 돌아왔다.", "빈손이다."], statDelta: {}, goldDelta: 0 }, false);
  }
}

export function doActivity(s: GameState, a: Activity): void {
  if (a === "rumor") rumor(s);
  else if (a === "field") goField(s);
}

export function buy(s: GameState, item: keyof typeof BAL.prices): void {
  if (s.phase !== "town") return;
  const price = BAL.prices[item];
  if (s.gold < price) return;
  s.gold -= price;
  s.inventory[item] += 1;
}

export function buyGear(s: GameState, id: string): void {
  const g = GEAR[id];
  if (s.phase !== "town" || !g || g.price === undefined || s.gold < g.price) return;
  if (Object.values(s.gear).includes(id) && g.slot !== "ring") return;
  s.gold -= g.price;
  const old = equip(s, id);
  log(s, `대장간에서 ${josa(g.name, "을")} 샀다. (${g.price}G)${old ? ` ${josa(GEAR[old].name, "은")} 대장간에 넘겼다.` : ""}`, "system");
}

export function canTrainAt(s: GameState, trainingId: string): boolean {
  return CLASSES[s.hero.cls].trainings.includes(trainingId);
}

export { targetSlot };

export function sell(s: GameState, item: keyof typeof BAL.prices): void {
  if (s.phase !== "town" || s.inventory[item] <= 0) return;
  s.gold += Math.floor(BAL.prices[item] / 2);
  s.inventory[item] -= 1;
}

/** 주간 결과 카드를 닫고 다음 주로. 3주차가 끝나면 던전 */
export function closeWeek(s: GameState): "town" | "dungeon" {
  if (s.phase !== "week-result") return "town";
  s.weekResult = null;
  s.week += 1;
  s.phase = "town";
  if (s.week >= 4) return "dungeon";
  log(s, `— ${s.month}월 ${s.week}주차.`, "system");
  return "town";
}

export function beginSettlement(s: GameState, o: { mana: number; cleared: boolean; forced: boolean; deepest: number }): void {
  const lines: string[] = [];
  lines.push(o.cleared ? "1섹터의 차원문에 도달하고 돌아왔다." : o.forced ? "시간이 다 되어 마을로 끌려 나왔다." : "귀환 주문서로 돌아왔다.");
  lines.push(`가장 깊이 내려간 곳: ${o.deepest}층`);
  s.gold += o.mana;
  if (o.mana > 0) lines.push(`마석을 관공서에서 ${o.mana}G로 환전했다.`);
  else lines.push("가지고 나온 마석이 없다.");
  if (o.cleared) lines.push(`등급이 올랐다 — 클리어한 섹터 ${s.rank}개.`);
  const tax = taxDue(s);
  const paid = s.gold >= tax;
  s.settlement = { month: s.month, manaSold: o.mana, tax, goldAfter: paid ? s.gold - tax : s.gold, paid, cleared: o.cleared, forced: o.forced, lines };
  s.phase = "settlement";
  s.hero.satiety = 100;
  s.hero.fatigue = 0;
}

/** 정산 카드 확인 → 다음 달 1주차에 세금 납부 */
export function closeSettlement(s: GameState): void {
  const st = s.settlement;
  if (s.phase !== "settlement" || !st) return;
  s.settlement = null;
  s.month += 1;
  s.week = 1;
  if (!st.paid) {
    kill(s, "tax");
    return;
  }
  s.gold -= st.tax;
  s.hero.hp = maxHp(s);
  s.phase = "town";
  log(s, `— ${s.month}월 1주차. 세금 ${st.tax}G를 냈다. 남은 돈 ${s.gold}G.`, "system");
}
