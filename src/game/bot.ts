import { BAL } from "./data";
import { GEAR, gearScore, targetSlot } from "./gear";
import { CLASSES } from "./classes";
import { fragScore, fragSlots } from "./fragments";
import { heroAc, maxHp, smod } from "./core";
import { canTrain, nextSkill, trainCost } from "./town";
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
    case "dungeon":
      return dungeonAction(s);
    default:
      return null;
  }
}

function townAction(s: GameState): Action {
  // 미궁 준비물(고기 4, 물약 2) 살 돈은 항상 남겨 둔다
  const supply = Math.max(0, 4 - s.inventory.food) * BAL.prices.food + Math.max(0, 2 - s.inventory.potion) * BAL.prices.potion;
  const spare = s.gold - supply;
  if (s.week === 3) {
    if (s.inventory.food < 4 && s.gold >= BAL.prices.food) return { t: "buy", item: "food" };
    if (s.inventory.potion < 2 && s.gold >= BAL.prices.potion) return { t: "buy", item: "potion" };
  }
  // 1) 훈련 2) 몸통·방패 3) 여유가 되면 물약을 더
  if (canTrain(s) && spare >= trainCost(s)) {
    const order = ["warfare", "arcane", "sword", "endure", "footwork", "scout", "study"].filter((id) => CLASSES[s.hero.cls].trainings.includes(id));
    const training = order.find((id) => nextSkill(s, id)) ?? order[0];
    const main = s.hero.cls === "mage" ? "int" : "str";
    return { t: "train", training, free: [main, "con"] };
  }
  if (!s.gear.body && spare >= GEAR.leather.price!) return { t: "buyGear", id: "leather" };
  if (!s.gear.offhand && spare >= GEAR.shield.price!) return { t: "buyGear", id: "shield" };
  if (s.week === 3 && s.inventory.potion < 4 && spare >= BAL.prices.potion + 20) return { t: "buy", item: "potion" };
  if (s.hero.level >= 2 && s.week !== 3) return { t: "activity", a: "field" };
  return { t: "activity", a: "rumor" };
}

function dungeonAction(s: GameState): Action | null {
  const dg = s.dungeon!;
  const hp = s.hero.hp / maxHp(s);
  if (dg.pending) {
    switch (dg.pending.kind) {
      case "trap":
        if (s.hero.hp <= 4 && dg.prev !== null) return { t: "pending", choice: "back" };
        return { t: "pending", choice: smod(s, "dex") >= 2 ? "disarm" : "force" };
      case "treasure": return { t: "pending", choice: "open" };
      case "record": return { t: "pending", choice: "read" };
      case "shrine": return { t: "pending", choice: "pray" };
      case "stairs":
        if (hp < 0.6 || dg.floor >= comfortFloor(s)) return { t: "pending", choice: "stay" };
        return { t: "pending", choice: "descend" };
      case "portal": return { t: "pending", choice: "enter" };
      case "frag": {
        // 빈 칸이면 흡수, 꽉 찼으면 가장 약한 편린보다 나을 때만 바꾼다
        if (s.fragments.length < fragSlots(s.hero.level)) return { t: "pending", choice: "absorb" };
        const scores = s.fragments.map(fragScore);
        const worst = scores.indexOf(Math.min(...scores));
        return { t: "pending", choice: fragScore(dg.pending.frag) > scores[worst] ? `swap${worst}` : "leave" };
      }
      case "gear": {
        const better = gearScore(dg.pending.item) > gearScore(s.gear[targetSlot(s, dg.pending.item)]);
        const wrongWeapon = GEAR[dg.pending.item].weapon && GEAR[dg.pending.item].weapon!.stat !== (s.hero.cls === "mage" ? "int" : "str");
        return { t: "pending", choice: better && !wrongWeapon ? "equip" : "leave" };
      }
    }
  }
  if (hp < 0.4 && s.inventory.potion > 0) return { t: "potion" };
  if (hp < 0.45 && s.inventory.potion === 0 && s.inventory.scroll > 0) return { t: "scroll" };
  if (s.hero.satiety < 25 && s.inventory.food > 0) return { t: "eat" };
  if (s.hero.fatigue >= 90 || (hp < 0.5 && s.hero.satiety > 30)) return { t: "camp" };
  const step = nextStep(s);
  // 보스방 앞에서는 야영으로 HP를 채우고 들어간다(잘 준비된 플레이어의 행동)
  if (step !== null && dg.rooms[step].type === "boss" && !dg.rooms[step].resolved && hp < 0.9 && dg.turnsLeft > 40) {
    if (s.hero.satiety < 30 && s.inventory.food > 0) return { t: "eat" };
    if (s.hero.satiety >= 15) return { t: "camp" };
  }
  // 더 갈 곳이 없으면(혹은 계단 앞에서 멈췄으면) 시간이 다 될 때까지 야영하며 버틴다
  return step === null ? { t: "camp" } : { t: "move", room: step };
}

/** 이 레벨에서 내려가도 될 만한 층 */
function comfortFloor(s: GameState): number {
  // 3층은 레벨 3 + 물약 2개 + AC 13 이상일 때만(잘 준비된 상태)
  if (s.hero.level >= 3 && s.inventory.potion >= 2 && heroAc(s) >= 13) return 3;
  return s.hero.level >= 2 ? 2 : 1;
}

/** 가장 가까운 미방문 방(없으면 계단/포탈) 쪽으로 한 걸음 */
function nextStep(s: GameState): number | null {
  const dg = s.dungeon!;
  const start = dg.current;
  const prevOf = new Map<number, number>([[start, -1]]);
  const q = [start];
  let goal: number | null = null;
  const exit = (id: number) => ["stairs", "portal"].includes(dg.rooms[id].type);
  // 3층에서는 보스방(또는 차원문)이 보이면 곧장 그쪽으로 간다
  if (dg.floor === 3) {
    const target = dg.rooms.find((r) => (r.type === "boss" && !r.resolved && (r.known || r.visited)) || (r.type === "portal" && (r.known || r.visited)));
    if (target && target.id !== start) {
      const path = route(dg.rooms, start, target.id);
      if (path) return path;
    }
  }
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

/** start → goal 최단 경로의 첫 걸음 */
function route(rooms: { edges: number[] }[], start: number, goal: number): number | null {
  const prev = new Map<number, number>([[start, -1]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    for (const nb of rooms[cur].edges) if (!prev.has(nb)) { prev.set(nb, cur); q.push(nb); }
  }
  if (!prev.has(goal)) return null;
  let step = goal;
  while (prev.get(step) !== start) step = prev.get(step)!;
  return step;
}
