import { BAL, GEAR } from "./data";
import { maxHp, mod } from "./core";
import { alive } from "./combat";
import { canTrain, trainCost } from "./town";
import type { Action } from "./engine";
import type { GameState } from "./types";

// "자동 결정" 옵션과 밸런스 시뮬레이션이 같이 쓰는 단순한 정책.

export function botAction(s: GameState): Action | null {
  switch (s.phase) {
    case "create":
      return { t: "create", name: "봇", candidate: 0, faith: null };
    case "week-result":
      return { t: "closeWeek" };
    case "settlement":
      return { t: "closeSettlement" };
    case "town":
      return townAction(s);
    case "combat":
      return combatAction(s);
    case "dungeon":
      return s.combat ? combatAction(s) : dungeonAction(s);
    default:
      return null;
  }
}

function townAction(s: GameState): Action {
  if (!s.gear.body && s.gold >= GEAR.leather.price) return { t: "buyGear", id: "leather" };
  if (!s.gear.offhand && s.gold >= GEAR.shield.price + 40) return { t: "buyGear", id: "shield" };
  if (s.week === 3) {
    if (s.inventory.food < 5 && s.gold >= BAL.prices.food) return { t: "buy", item: "food" };
    if (s.inventory.scroll < 1 && s.gold >= BAL.prices.scroll) return { t: "buy", item: "scroll" };
    if (s.inventory.potion < 2 && s.gold >= BAL.prices.potion) return { t: "buy", item: "potion" };
  }
  if (canTrain(s) && s.gold - trainCost(s) >= 40) return { t: "train", training: "sword", free: ["con", "dex"] };
  if (s.hero.level >= 2 && s.week !== 3) return { t: "activity", a: "field" };
  return { t: "activity", a: "rumor" };
}

function combatAction(s: GameState): Action {
  const c = s.combat!;
  const hp = s.hero.hp / maxHp(s);
  const foes = alive(c);
  if (hp < 0.35 && s.inventory.potion > 0) return { t: "combatPotion" };
  if (hp < 0.25 && foes.length >= 2) return { t: "flee" };
  const target = [...foes].sort((a, b) => a.hp - b.hp)[0];
  return { t: "attack", target: target.uid };
}

function dungeonAction(s: GameState): Action | null {
  const dg = s.dungeon!;
  const hp = s.hero.hp / maxHp(s);
  if (dg.pending) {
    switch (dg.pending.kind) {
      case "trap":
        if (s.hero.hp <= 4 && dg.prev !== null) return { t: "pending", choice: "back" };
        return { t: "pending", choice: mod(s.hero.stats.dex) >= 2 ? "disarm" : "force" };
      case "treasure": return { t: "pending", choice: "open" };
      case "record": return { t: "pending", choice: "read" };
      case "shrine": return { t: "pending", choice: "pray" };
      case "stairs":
        if (hp < 0.6 || dg.floor >= comfortFloor(s)) return { t: "pending", choice: "stay" };
        return { t: "pending", choice: "descend" };
      case "portal": return { t: "pending", choice: "enter" };
    }
  }
  if (hp < 0.4 && s.inventory.potion > 0) return { t: "potion" };
  if (hp < 0.45 && s.inventory.potion === 0 && s.inventory.scroll > 0) return { t: "scroll" };
  if (s.hero.satiety < 25 && s.inventory.food > 0) return { t: "eat" };
  if (s.hero.fatigue >= 90 || (hp < 0.5 && s.hero.satiety > 30)) return { t: "camp" };
  const step = nextStep(s);
  // 더 갈 곳이 없으면(혹은 계단 앞에서 멈췄으면) 시간이 다 될 때까지 야영하며 버틴다
  return step === null ? { t: "camp" } : { t: "move", room: step };
}

/** 이 레벨에서 내려가도 될 만한 층 */
function comfortFloor(s: GameState): number {
  return s.hero.level >= 4 ? 3 : s.hero.level >= 2 ? 2 : 1;
}

/** 가장 가까운 미방문 방(없으면 계단/포탈) 쪽으로 한 걸음 */
function nextStep(s: GameState): number | null {
  const dg = s.dungeon!;
  const start = dg.current;
  const prevOf = new Map<number, number>([[start, -1]]);
  const q = [start];
  let goal: number | null = null;
  const exit = (id: number) => ["stairs", "portal"].includes(dg.rooms[id].type);
  while (q.length) {
    const cur = q.shift()!;
    if (cur !== start && !dg.rooms[cur].visited) {
      goal = cur;
      break;
    }
    for (const nb of dg.rooms[cur].edges) {
      if (!prevOf.has(nb)) {
        prevOf.set(nb, cur);
        q.push(nb);
      }
    }
  }
  if (goal === null) {
    if (dg.floor < comfortFloor(s) || dg.rooms.some((r) => r.type === "portal")) goal = dg.rooms.find((r) => exit(r.id))?.id ?? null;
    if (goal === null || goal === start) return null;
  }
  let step = goal;
  while (prevOf.get(step) !== start) {
    const p = prevOf.get(step);
    if (p === undefined || p === -1) return null;
    step = p;
  }
  return step;
}
