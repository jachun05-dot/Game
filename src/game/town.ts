import { josa } from "./josa";
import { ELEMENTS, hasLevelTable, isElement, levelSkill } from "./elements";
import { BAL, TROPHIES, FEED, FIELD_ENCOUNTERS, NAMES, RIVAL_NEWS, RIVALS, RUMORS, STAT_KEYS, STAT_LABEL, TRAININGS } from "./data";
import { addStat, check, emptyStats, kill, log, maxHp, rngOf, taxDue, topBehavior, yearOf } from "./core";
import { FRAGMENTS, emptyCodex, fragSlots } from "./fragments";
import { MIND_KEYS, fadeAfterDungeon } from "./mind";
import { INJ, LIMBS, PART_NAME, PARTS, emptyInjuries, treatWorst, type Part } from "./injury";
import { FAITH_BAL, GODS, addPiety, faithManaMult, god, godOf, power, pray, tier } from "./faith";
import { makeEnemies, startCombat } from "./combat";
import { Rng } from "./rng";
import { CLASSES, type ClassId } from "./classes";
import { GEAR, equip, gearEffect, targetSlot } from "./gear";
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
    inventory: { food: 0, potion: 0, scroll: 0, heart: 0, banner: 0, bandage: 0, herb: 0 },
    trophies: [],
    gear: {},
    skills: [],
    fragments: [],
    codex: emptyCodex(),
    piety: 0,
    heretic: false,
    injuries: emptyInjuries(),
    prosthetic: {},
    disease: 0,
    mind: {},
    faithsKnown: [],
    tactics: { potionAt: 35, fleeAt: 0 },
    autoGoal: "explore",
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
  (s.candidatePool ??= {})[s.hero.cls] = s.candidates;
}

/**
 * 직업을 바꾸면 그 직업 성향의 후보를 보여준다. 처음 고른 직업이면 새로 뽑고(다시 뽑기 횟수는 쓰지 않음),
 * 전에 골라 봤던 직업이면 그때 후보를 그대로 돌려준다(직업을 오가며 후보를 새로 뽑는 꼼수도 막힌다).
 */
export function pickClass(s: GameState, cls: ClassId): void {
  if (s.phase !== "create" || !CLASSES[cls] || s.hero.cls === cls) return;
  const pool = (s.candidatePool ??= {});
  pool[s.hero.cls] = s.candidates;
  s.hero.cls = cls;
  s.candidates = pool[cls] ??= makeCandidates(rngOf(s), cls);
}

export function randomName(s: GameState): string {
  return rngOf(s).pick(NAMES);
}

export function createHero(s: GameState, name: string, candidate: number, faith: string | null): void {
  if (s.phase !== "create") return;
  const c = s.candidates[candidate];
  s.hero.name = name.trim() || "이름 없는 소년";
  s.hero.stats = { ...c.stats };
  // 권능이 정해진 신만 섬길 수 있다(역병·심연·망각은 해금만 되고 권능은 준비 중)
  s.hero.faith = faith && godOf(faith) && (s.faithsKnown.includes(faith) || s.faithsKnown.length === 0) ? faith : null;
  s.piety = s.hero.faith ? FAITH_BAL.start : 0;
  if (god(s) === "plague") s.disease = Math.max(s.disease, 1); // 역병의 신도는 병을 품고 시작한다
  const cls = CLASSES[s.hero.cls];
  s.gear = { ...cls.start };
  if (s.hero.name.toLowerCase() === "grooty") s.gear.neck = "grooty"; // 테스터
  s.gold = BAL.startGold;
  s.inventory = { ...s.inventory, ...cls.items };
  s.hero.hp = maxHp(s);
  s.phase = "town";
  const kit = [
    ...Object.values(cls.start).map((id) => GEAR[id!].name),
    ...kitItems(cls.items),
  ].join(", ");
  log(s, `— ${s.hero.name}, ${c.archetype}. ${cls.name}${s.hero.cls === "adventurer" ? "로" : "로"} 등록되었다.`, "system");
  log(s, `${cls.motive} 지급품: ${kit}. 주머니는 비어 있다.`, "story");
  log(s, "직업교관이 말한다. \"훈련은 미궁에서 한 번 살아 돌아온 다음이다.\"", "story");
  if (faith) log(s, `당신은 몰래 ${josa(faith, "을")} 섬기기로 했다.`, "story");
  if (s.gear.neck === "grooty") log(s, `【테스터】 ${GEAR.grooty.name}을 목에 걸었다 — ${gearEffect("grooty")}.`, "skill");
  log(s, `— 1월 1주차. 4주차에 미궁이 열린다.`, "system");
}

export function trainCost(s: GameState): number {
  const lv = s.hero.level;
  const base =
    lv >= 4 && BAL.trainCostLate > 0 ? BAL.trainCostLate * lv
    : BAL.trainCostBase > 0 ? BAL.trainCostBase + BAL.trainCostPerLevel * (lv - 1)
    : BAL.trainCostPerLevel * lv;
  return base + (BAL.specialTrainFee[lv] ?? 0);
}

/** 레벨 3→4 훈련은 1섹터 보스의 마석 심장이 있어야 한다 */
/** 이 레벨에서 다음 레벨로 가는 훈련에 필요한 보스 증표(3→4 마석 심장, 6→7 장군의 휘장) */
export function gateOf(s: GameState): (typeof TROPHIES)[number] | null {
  return TROPHIES.find((t) => t.gateLevel === s.hero.level) ?? null;
}

export function needsHeart(s: GameState): boolean {
  return gateOf(s) !== null;
}

/** 시작 소모품을 글로 */
export function kitItems(items: { food: number; potion: number; scroll: number }): string[] {
  const out: string[] = [];
  if (items.food) out.push(`말린 고기 ${items.food}`);
  if (items.potion) out.push(`치료 물약 ${items.potion}`);
  if (items.scroll) out.push(`귀환 주문서 ${items.scroll}`);
  return out;
}

export function canTrain(s: GameState): boolean {
  if (s.phase !== "town" || s.week >= 4 || (s.heretic && !outlawTrainerHere(s)) || s.month < BAL.firstTrainMonth || s.hero.level >= BAL.maxLevel || s.gold < trainCost(s)) return false;
  const g = gateOf(s);
  return !g || s.inventory[g.item] > 0;
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
  if (BAL.freeHeal) s.hero.hp = maxHp(s); // 예전 규칙: 마을에서 일주일이면 회복된다
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
  const gate = gateOf(s);
  const paidHeart = !!gate;
  if (gate) s.inventory[gate.item] -= 1;
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
  const learned = nextSkill(s, t.id);
  s.hero.level += 1;
  if (learned) s.skills.push(learned);
  // 첫 훈련의 기본기(마법사: 어느 원소를 수련하든 마력 화살을 함께 배운다)
  const basic = CLASSES[s.hero.cls].firstSkill;
  if (basic && !s.skills.includes(basic)) {
    s.skills.push(basic);
  }
  // 마법사: 처음 특화한 원소가 주 원소(지팡이 마력탄이 이 원소를 따른다)
  if (isElement(t.id) && learned === ELEMENTS[t.id].mark && !s.mainElement) s.mainElement = t.id;
  const lines = [
    `${t.name} — ${t.desc}. (${cost}G)`,
    `고정: ${t.stats.map((k) => STAT_LABEL[k]).join(", ")} / 자유: ${free.map((k) => STAT_LABEL[k]).join(", ")} / ${noBehavior ? "몸이 기억한 것(무작위)" : "몸이 기억한 것"}: ${behaviorPicks.map((k) => STAT_LABEL[k]).join(", ")}`,
  ];
  if (paidHeart) lines.unshift(`교관이 ${josa(gate!.name, "을")} 받아 들고 고개를 끄덕였다. "${gate!.item === "heart" ? "이제야 진짜 훈련을 시작할 수 있겠군." : "차원문 너머에서 살아 돌아왔군. 다음 단계로 가자."}"`);
  if (!learned) lines.push(hasLevelTable(t.id) ? "이 레벨에서 이 훈련으로 배울 기술은 없다." : "이 훈련에서 더 배울 기술은 없다. (히든 트레이닝은 준비 중)");
  if (fragSlots(s.hero.level) > fragSlots(from)) lines.push(`몸에 편린을 담을 자리가 하나 더 생겼다. (편린 칸 ${fragSlots(s.hero.level)})`);
  finishWeek(s, { title: "훈련", lines, statDelta: delta, levelUp: { from, to: s.hero.level }, learned: learned ?? undefined, goldDelta: -cost }, true);
}

/** 이 훈련을 받으면 다음에 배울 기술(사다리 순서) */
export function nextSkill(s: GameState, trainingId: string): string | null {
  // 마법사 원소·전사 방향 훈련: 이번 훈련으로 오를 레벨에 정해진 기술
  if (hasLevelTable(trainingId)) {
    const id = levelSkill(trainingId, s.hero.level + 1);
    return id && !s.skills.includes(id) ? id : null;
  }
  const t = TRAININGS.find((x) => x.id === trainingId);
  return t?.skills.find((id) => !s.skills.includes(id)) ?? null;
}

export function setTactics(s: GameState, t: Partial<Tactics>): void {
  s.tactics = { ...s.tactics, ...t };
}

export function rumor(s: GameState): void {
  if (s.phase !== "town" || s.heretic) return;
  const r = rngOf(s);
  const lines = [r.pick(RUMORS)];
  let gold = 0;
  pray(s, "song", 2);
  if (r.chance(0.55)) {
    gold = r.int(10, 30);
    if (power(s, "song", 1)) gold = Math.round(gold * 1.5);
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

/** 돈 말고는 다음 훈련을 받을 수 있나(첫 달·최대 레벨·보스 증표) */
function trainingLeft(s: GameState): boolean {
  if (s.month < BAL.firstTrainMonth || s.hero.level >= BAL.maxLevel) return false;
  const g = gateOf(s);
  return !g || s.inventory[g.item] > 0;
}

/** 현상수배 중 이번 주에 떠돌이 교관을 만났나 */
export function outlawTrainerHere(s: GameState): boolean {
  return !!s.heretic && s.outlawTrainer?.week === `${s.month}-${s.week}` && s.outlawTrainer.met;
}

export function goField(s: GameState): void {
  if (s.phase !== "town") return;
  const r = rngOf(s);
  // 현상수배 중: 외곽으로 나서면 주마다 한 번, 떠돌이 교관을 찾아본다(받을 훈련이 남아 있을 때만).
  // 처음엔 20%, 한 번 만난 뒤로는 어디 있는지 알아 50%. 만나면 이번 주에 훈련 가능(숲으로는 아직 가지 않음)
  const wk = `${s.month}-${s.week}`;
  if (s.heretic && s.outlawTrainer?.week !== wk && trainingLeft(s)) {
    const known = !!s.outlawTrainerKnown;
    const met = r.chance(known ? BAL.outlawTrainerChanceKnown : BAL.outlawTrainerChance);
    s.outlawTrainer = { week: wk, met };
    if (met) {
      s.outlawTrainerKnown = true;
      if (known) log(s, "외곽의 폐가 뒤에서 그 노인이 목검을 휘두르고 있다. \"또 왔나. 이번 주도 봐 주마.\"", "story");
      else log(s, "외곽의 폐가 뒤에서 낡은 목검을 휘두르는 노인을 만났다. 성당을 떠난 교관이라고 한다. \"쫓기는 몸이라도 칼은 늘어야지. 이번 주라면 봐 주마.\"", "story");
      log(s, "이번 주에 떠돌이 교관에게 훈련받을 수 있다. (숲으로 가려면 외부 탐험을 한 번 더)", "good");
      return;
    }
    if (known) log(s, "폐가 뒤를 둘러봤지만 노인은 보이지 않는다. 숲으로 향한다.", "system");
  }
  log(s, "영지 밖 숲으로 나섰다.", "system");
  s.tripUsed = [];
  startCombat(s, "field", makeEnemies(s, r.weighted(FIELD_ENCOUNTERS)));
}

export function afterFieldCombat(s: GameState, outcome: "win" | "fled", c: CombatState): void {
  if (outcome === "win") {
    // 현상수배 중에는 관공서 대신 밀수꾼에게 반값에 넘기고, 숲에서 사냥한 고기를 챙긴다
    const gold = s.heretic ? Math.floor(c.loot / 2) : c.loot;
    s.gold += gold;
    const lines = ["숲에서 적을 물리쳤다.", s.heretic ? `마석을 외곽의 밀수꾼에게 ${gold}G에 넘겼다.` : `얻은 마석을 관공서에서 ${gold}G로 바꿨다.`];
    if (s.heretic) {
      const meat = rngOf(s).int(1, 2);
      s.inventory.food += meat;
      lines.push(`덫에 걸린 짐승으로 말린 고기 ${meat}개를 만들었다.`);
    }
    finishWeek(s, { title: "외부 탐험", lines, statDelta: {}, goldDelta: gold }, true);
  } else {
    finishWeek(s, { title: "외부 탐험", lines: ["숲에서 도망쳐 돌아왔다.", "빈손이다."], statDelta: {}, goldDelta: 0 }, false);
  }
}

export function doActivity(s: GameState, a: Activity): void {
  if (a === "rumor") rumor(s);
  else if (a === "field") goField(s);
  else if (a === "inn") inn(s);
}

/** 여관: 한 주와 INJ.innCost(G)를 들여 모든 부상·질병을 한 단계 낫게 한다(결손은 그대로) */
/** 여관비: 상점가 물가를 따라 매달 오른다 */
export function innCost(s: GameState): number {
  return Math.ceil(INJ.innCost * (s.priceIndex ?? 1));
}

export function inn(s: GameState): void {
  const cost = innCost(s);
  if (s.phase !== "town" || s.heretic || s.gold < cost) return;
  s.gold -= cost;
  const lines = [`여관 다락방에 일주일을 묵었다. (${cost}G) HP가 모두 회복됐다.`];
  let healed = 0;
  for (const p of PARTS) {
    const v = s.injuries[p];
    if (v > 0 && v < 3) {
      s.injuries[p] = v - 1;
      healed++;
      lines.push(`${PART_NAME[p]}: ${["멀쩡함", "경상", "중상"][v - 1]}으로 나아졌다.`);
    }
  }
  if (s.disease > 0) {
    s.disease -= 1;
    pray(s, "plague", -5);
    lines.push(s.disease ? "열이 조금 내렸다. (쥐 열병 경상)" : "열이 내렸다. 쥐 열병이 나았다.");
    healed++;
  }
  if (MIND_KEYS.some((k) => s.mind[k])) {
    s.mind = {};
    lines.push("며칠 푹 자고 나니 머릿속이 맑아졌다. (정신 상태이상 해제)");
    healed++;
  }
  if (!healed) lines.push("푹 쉬었다. 딱히 나을 데는 없었다.");
  s.hero.hp = maxHp(s);
  finishWeek(s, { title: "여관", lines, statDelta: {}, goldDelta: -cost }, healed > 0);
}

/** 신전 재생 의식: 결손된 손·발을 완전히 되살린다 */
export function regen(s: GameState, p: Part): void {
  if (s.phase !== "town" || s.heretic || !LIMBS.includes(p) || s.injuries[p] < 3 || s.gold < INJ.regenCost) return;
  s.gold -= INJ.regenCost;
  s.injuries[p] = 0;
  delete s.prosthetic[p];
  pray(s, "greed", -Math.ceil(INJ.regenCost / 20));
  log(s, `신전 사제가 ${INJ.regenCost}G를 받고 긴 의식을 치렀다. 잃었던 ${PART_NAME[p]}에 감각이 돌아온다.`, "good");
}

/** 대장간 의수·의족: 결손 부위를 중상 성능으로 대신한다 */
export function prosthetic(s: GameState, p: Part): void {
  if (s.phase !== "town" || s.heretic || !LIMBS.includes(p) || s.injuries[p] < 3 || s.prosthetic[p] || s.gold < INJ.prostheticCost) return;
  s.gold -= INJ.prostheticCost;
  s.prosthetic[p] = true;
  pray(s, "greed", -Math.ceil(INJ.prostheticCost / 20));
  log(s, `대장간에서 ${p === "feet" ? "의족" : "의수"}을 맞췄다. (${INJ.prostheticCost}G) 서툴지만 없는 것보다 낫다.`, "system");
}

/** 붕대: 가장 심한 부상 하나를 한 단계(결손 제외) */
export function useBandage(s: GameState): void {
  if (s.combat || s.inventory.bandage <= 0 || (s.phase !== "town" && s.phase !== "dungeon")) return;
  const p = treatWorst(s);
  if (!p) return;
  s.inventory.bandage -= 1;
  log(s, `붕대를 단단히 감았다. ${PART_NAME[p]}: ${["멀쩡함", "경상", "중상"][s.injuries[p]]}`, "good");
}

/** 약초 탕약: 쥐 열병 한 단계 */
export function useHerb(s: GameState): void {
  if (s.combat || s.inventory.herb <= 0 || s.disease <= 0 || (s.phase !== "town" && s.phase !== "dungeon")) return;
  s.inventory.herb -= 1;
  s.disease -= 1;
  pray(s, "plague", -5);
  log(s, s.disease ? "쓴 탕약을 삼켰다. 열이 조금 내렸다." : "쓴 탕약을 삼켰다. 열이 내렸다.", "good");
}

/** 상점가 가격(탐욕/채무의 신 ★1: 반값) */
/** 상점가 값: 탐욕의 신 ★1이면 반값, 현상수배 중이면 암시장이라 두 배 */
export function shopPrice(s: GameState, item: keyof typeof BAL.prices): number {
  const listed = Math.ceil(BAL.prices[item] * (s.priceIndex ?? 1));
  const base = power(s, "greed", 1) ? Math.ceil(listed / 2) : listed;
  return s.heretic ? base * BLACK_MARKET_MULT : base;
}

/** 현상수배 중 암시장 값 배율 */
export const BLACK_MARKET_MULT = 2;

export function buy(s: GameState, item: keyof typeof BAL.prices): void {
  if (s.phase !== "town") return;
  const price = shopPrice(s, item);
  if (s.gold < price) return;
  s.gold -= price;
  s.inventory[item] += 1;
}

export function buyGear(s: GameState, id: string): void {
  const g = GEAR[id];
  if (s.phase !== "town" || s.heretic || !g || g.price === undefined || s.gold < g.price || (g.rank ?? 0) > s.rank) return;
  if (Object.values(s.gear).includes(id) && g.slot !== "ring") return;
  s.gold -= g.price;
  pray(s, "greed", -Math.ceil(g.price / 20));
  const old = equip(s, id);
  log(s, `대장간에서 ${josa(g.name, "을")} 샀다. (${g.price}G)${old ? ` ${josa(GEAR[old].name, "은")} 대장간에 넘겼다.` : ""}`, "system");
}

export function canTrainAt(s: GameState, trainingId: string): boolean {
  return CLASSES[s.hero.cls].trainings.includes(trainingId);
}

export { targetSlot };

export function sell(s: GameState, item: keyof typeof BAL.prices): void {
  if (s.phase !== "town" || s.heretic || s.inventory[item] <= 0) return;
  s.gold += Math.floor((BAL.prices[item] * (s.priceIndex ?? 1)) / 2);
  s.inventory[item] -= 1;
}

/** 신전: 큰돈을 내고 편린 하나를 지운다(시간은 들지 않는다) */
export function eraseFrag(s: GameState, index: number): void {
  const id = s.fragments[index];
  if (s.phase !== "town" || s.heretic || id === undefined || s.gold < BAL.fragEraseCost) return;
  s.gold -= BAL.fragEraseCost;
  pray(s, "greed", -Math.ceil(BAL.fragEraseCost / 20));
  s.fragments.splice(index, 1);
  s.hero.hp = Math.min(s.hero.hp, maxHp(s));
  log(s, `신전 사제가 ${BAL.fragEraseCost}G를 받고 주문을 외웠다. ${josa(FRAGMENTS[id].name, "이")} 몸에서 빠져나가 흩어졌다.`, "system");
}

/** 주간 결과 카드를 닫고 다음 주로. 3주차가 끝나면 던전 */
export function closeWeek(s: GameState): "town" | "dungeon" {
  if (s.phase !== "week-result") return "town";
  s.weekResult = null;
  s.week += 1;
  s.phase = "town";
  if (s.week >= 4) {
    log(s, `— ${s.month}월 4주차. 미궁이 열렸다 — 상점가·대장간에 들러 준비를 마치고 들어가자.`, "system");
    return "dungeon";
  }
  log(s, `— ${s.month}월 ${s.week}주차.`, "system");
  return "town";
}

export function beginSettlement(s: GameState, o: { mana: number; cleared: boolean; forced: boolean; deepest: number; sector?: number; rankUp?: boolean }): void {
  const lines: string[] = [];
  lines.push(o.cleared ? `${o.sector ?? 1}섹터의 차원문에 도달하고 돌아왔다.` : o.forced ? "시간이 다 되어 마을로 끌려 나왔다." : "귀환 주문서로 돌아왔다.");
  lines.push(`가장 깊이 내려간 곳: ${o.deepest}층`);
  // 환전: 탐욕의 신 보정, 현상수배 중이면 밀수꾼에게 반값
  let gold = Math.round(o.mana * faithManaMult(s));
  if (s.heretic) gold = Math.floor(gold / 2);
  s.gold += gold;
  if (gold > 0) lines.push(s.heretic ? `관공서에 갈 수 없어 마석을 외곽의 밀수꾼에게 ${gold}G에 넘겼다.` : `마석을 관공서에서 ${gold}G로 환전했다.`);
  else lines.push("가지고 나온 마석이 없다.");
  pray(s, "greed", Math.min(15, Math.floor(gold / 10)));
  if (o.cleared && o.rankUp) lines.push(`등급이 올랐다 — 클리어한 섹터 ${s.rank}개.`);
  faithMonthEnd(s, lines);
  fadeAfterDungeon(s, lines);
  // 예전 규칙: 경상은 미궁 밖으로 나오면 체력 판정으로 저절로 낫는다
  for (const p of PARTS) {
    if (!BAL.freeHeal) break;
    if (s.injuries[p] !== 1) continue;
    if (check(s, "con", INJ.healDc).ok) {
      s.injuries[p] = 0;
      lines.push(`${PART_NAME[p]}의 가벼운 상처가 아물었다.`);
    } else lines.push(`${PART_NAME[p]}의 상처가 아직 욱신거린다. (경상)`);
  }
  for (const p of PARTS) if (s.injuries[p] === 2 || (!BAL.freeHeal && s.injuries[p] === 1)) lines.push(`${PART_NAME[p]} ${s.injuries[p] === 2 ? "중상" : "경상"}은 저절로 낫지 않는다 — 여관이나 붕대가 필요하다.`);
  if (!BAL.freeHeal && s.hero.hp < maxHp(s)) lines.push(`HP ${s.hero.hp}/${maxHp(s)} — 여관에서 쉬어야 회복된다.`);
  if (s.disease > 0) lines.push("쥐 열병은 저절로 낫지 않는다 — 탕약이나 여관이 필요하다.");
  // 세금은 다음 달 1주차에 낸다. 해가 바뀌면 오른다. 현상수배 중에는 관공서가 세금 대신 목에 현상금을 건다
  let tax = s.heretic ? 0 : taxDue(s.month + 1, s.rank) + (s.debt ?? 0);
  if (!s.heretic && yearOf(s.month + 1) > yearOf(s.month)) lines.push(`해가 바뀐다. 영주가 세금을 올렸다 — ${taxDue(s.month, s.rank)}G → ${taxDue(s.month + 1, s.rank)}G.`);
  if (s.debt) lines.push(`지난달 외상 ${s.debt}G가 세금에 붙었다.`);
  let debt = false;
  if (!s.heretic && s.gold < tax && power(s, "greed", 3) && !s.debtUsed) {
    // 탐욕의 신 ★3 "빚 문서": 한 번 외상으로 넘긴다
    debt = true;
    lines.push(`【${GODS.greed.name}】 빚 문서가 서기의 손에 쥐어졌다. 이번 세금 ${tax}G는 외상 — 다음 달에 두 배로 갚아야 한다.`);
  }
  const paid = debt || s.gold >= tax;
  const inquisition = !s.heretic && tier(s) > 0 && rngOf(s).chance(FAITH_BAL.inquisitionPerTier * tier(s));
  if (inquisition) lines.push("성당의 사제가 당신을 오래 바라본다. 옛 신의 냄새를 맡은 것이다 — 이단 심문에 불려 간다.");
  s.settlement = { month: s.month, manaSold: gold, tax, goldAfter: paid && !debt ? s.gold - tax : s.gold, paid, cleared: o.cleared, sector: o.sector, forced: o.forced, lines, inquisition, debt };
  s.phase = "settlement";
  s.hero.satiety = 100;
  s.hero.fatigue = 0;
}

/** 달이 끝날 때 신앙심 감소·저주 기간 */
function faithMonthEnd(s: GameState, lines: string[]): void {
  if (god(s)) addPiety(s, -FAITH_BAL.monthlyDecay);
  if (s.curse && s.curse.months > 0) {
    s.curse.months -= 1;
    if (s.curse.months <= 0) {
      lines.push(`${s.curse.god}의 저주가 풀렸다.`);
      s.curse = undefined;
    }
  }
}

/** 이단 심문: 신앙을 포기하거나, 거부하고 현상수배가 된다 */
export function answerInquisition(s: GameState, renounce: boolean): void {
  const st = s.settlement;
  if (s.phase !== "settlement" || !st?.inquisition) return;
  st.inquisition = false;
  if (renounce) {
    log(s, `심문관 앞에서 ${josa(s.hero.faith ?? "옛 신", "을")} 부정했다. 목에 걸고 있던 것을 내려놓았다.`, "system");
    s.hero.faith = null;
    s.piety = 0;
    return;
  }
  log(s, `심문관의 눈을 똑바로 보며 ${josa(s.hero.faith ?? "옛 신", "을")} 부정하지 않았다. 이제 영지의 이단자다 — 마을에는 발을 들일 수 없다.`, "hurt");
  s.heretic = true;
  st.tax = 0;
  st.paid = true;
  st.goldAfter = s.gold;
  st.lines.push("관공서 장부에서 이름이 지워지고, 성당 문에 현상수배서가 붙었다.");
}

/** 현상수배 중 성당에 자수: 신앙을 포기하고 마을로 돌아온다 */
export function surrender(s: GameState): void {
  if (s.phase !== "town" || !s.heretic) return;
  log(s, `성당에 자수했다. 심문관 앞에서 ${josa(s.hero.faith ?? "옛 신", "을")} 부정하고, 이름이 다시 장부에 올랐다.`, "system");
  s.heretic = false;
  s.hero.faith = null;
  s.piety = 0;
}

/** 미궁 성소에서 개종: 버린 신이 1개월 저주를 건다 */
export function convert(s: GameState, name: string): void {
  if (!s.faithsKnown.includes(name) || s.hero.faith === name || !godOf(name)) return;
  const old = s.hero.faith;
  if (old) {
    s.curse = { god: old, months: FAITH_BAL.curseMonths };
    log(s, `${josa(old, "이")} 등을 돌린다. 저주가 내려앉는다 — ${godOf(old)!.curse} (${FAITH_BAL.curseMonths}개월)`, "hurt");
  }
  s.hero.faith = name;
  s.piety = FAITH_BAL.start;
  if (god(s) === "plague") s.disease = Math.max(s.disease, 1);
  log(s, `${name} 앞에 무릎 꿇었다. 새로운 신앙이 시작된다.`, "story");
}

/** 정산 카드 확인 → 다음 달 1주차에 세금 납부 */
export function closeSettlement(s: GameState): void {
  const st = s.settlement;
  if (s.phase !== "settlement" || !st || st.inquisition) return;
  s.settlement = null;
  s.month += 1;
  // 물가: 매달 상점가 값이 조금씩 오른다
  const [lo, hi] = BAL.inflation;
  if (hi > 0) {
    const up = lo + rngOf(s).float() * (hi - lo);
    s.priceIndex = (s.priceIndex ?? 1) * (1 + up);
    log(s, `상점가 물가가 ${Math.round(up * 100)}% 올랐다. (처음보다 ×${s.priceIndex.toFixed(2)})`, "system");
  }
  s.week = 1;
  if (!st.paid) {
    kill(s, "tax");
    return;
  }
  if (st.debt) {
    s.debtUsed = true;
    s.debt = st.tax;
  } else {
    s.gold -= st.tax;
    s.debt = 0;
  }
  if (BAL.freeHeal) s.hero.hp = maxHp(s); // 예전 규칙: 미궁에서 돌아오면 다 회복
  s.phase = "town";
  if (s.heretic) log(s, `— ${s.month}월 1주차. 현상수배 중이다. 영지 외곽의 폐가에 몸을 숨겼다.`, "system");
  else log(s, `— ${s.month}월 1주차. ${st.debt ? `세금은 빚 문서로 미뤘다(다음 달 ${st.tax * 2}G).` : `세금 ${st.tax}G를 냈다.`} 남은 돈 ${s.gold}G.`, "system");
}
