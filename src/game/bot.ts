
import { GEAR, gearScore, targetSlot } from "./gear";
import { CLASSES } from "./classes";
import { INJ, PARTS } from "./injury";
import { god, power } from "./faith";
import { fragScore, fragSlots } from "./fragments";
import { heroAc, maxHp, smod } from "./core";
import { canTrain, nextSkill, shopPrice, trainCost } from "./town";
import type { Action } from "./engine";
import { ELEMENTS, ELEMENT_KEYS, type ElementKey, type StyleKey } from "./elements";
import type { GameState } from "./types";

// "자동 결정" 옵션과 밸런스 시뮬레이션이 같이 쓰는 단순한 정책.

export function botAction(s: GameState): Action | null {
  switch (s.phase) {
    case "create":
      return { t: "create", name: "봇", candidate: 0, faith: null };
    case "week-result":
      return { t: "closeWeek" };
    case "settlement":
      // 보통 사람은 이단 심문에서 신앙을 포기한다
      if (s.settlement?.inquisition) return { t: "inquisition", renounce: true };
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
  if (s.heretic) return { t: "activity", a: "field" };
  // 부상: 결손된 손·발엔 의수·의족, 중상·질병이면 여관에서 한 주 쉰다
  for (const p of ["main", "offhand", "feet"] as const) {
    if (s.injuries[p] >= 3 && !s.prosthetic[p] && s.gold >= INJ.prostheticCost) return { t: "prosthetic", part: p };
  }
  const keepSick = god(s) === "plague"; // 역병의 신도는 병을 고치지 않는다
  if (!keepSick && s.disease > 0 && s.inventory.herb > 0) return { t: "herb" };
  // 눈치챈 정신 상태이상이 둘 이상이면(조합이 터질 수 있으니) 여관에서 쉰다
  const minds = Object.values(s.mind).filter((m) => m?.known).length;
  if ((PARTS.some((p) => s.injuries[p] === 2) || (s.disease > 0 && !keepSick) || minds >= 2) && s.gold >= INJ.innCost) return { t: "activity", a: "inn" };
  // 미궁 준비물(고기 4, 물약 4) 살 돈은 항상 남겨 둔다
  // 2섹터까지 갈 생각이면(1섹터 클리어 + 레벨 4) 고기를 더 챙긴다
  const foodNeed = s.rank >= 1 && s.hero.level >= 4 ? 9 : 4;
  const supply = Math.max(0, foodNeed - s.inventory.food) * shopPrice(s, "food") + Math.max(0, 4 - s.inventory.potion) * shopPrice(s, "potion");
  const spare = s.gold - supply;
  if (s.week === 3) {
    if (s.inventory.food < foodNeed && s.gold >= shopPrice(s, "food")) return { t: "buy", item: "food" };
    if (s.inventory.potion < 4 && s.gold >= shopPrice(s, "potion")) return { t: "buy", item: "potion" };
  }
  // 1) 훈련 2) 몸통·방패 3) 여유가 되면 물약을 더
  if (canTrain(s) && spare >= trainCost(s)) {
    if (s.hero.cls === "mage") {
      const el = (magePlan ?? defaultMagePlan)(s);
      return { t: "train", training: el, free: ["int", "con"] };
    }
    if (s.hero.cls === "warrior") {
      // 방패가 없으면 먼저 산다(방패 기술은 방패가 있어야)
      if (!s.gear.offhand && s.gold >= GEAR.shield.price! + trainCost(s)) return { t: "buyGear", id: "shield" };
      return { t: "train", training: (warriorPlan ?? defaultWarriorPlan)(s), free: ["str", "con"] };
    }
    const order = ["warfare", "arcane", "sword", "endure", "footwork", "scout", "study"].filter((id) => CLASSES[s.hero.cls].trainings.includes(id));
    const training = order.find((id) => nextSkill(s, id)) ?? order[0];
    return { t: "train", training, free: ["str", "con"] };
  }
  if (!s.gear.body && spare >= GEAR.leather.price!) return { t: "buyGear", id: "leather" };
  if (!s.gear.offhand && spare >= GEAR.shield.price!) return { t: "buyGear", id: "shield" };
  // 돈이 넉넉하면(여윳돈 30G 이상 남길 때) 나머지 방어구도 산다
  for (const id of ["cap", "belt", "boots"]) {
    const g = GEAR[id];
    if (!s.gear[g.slot as "head" | "waist" | "feet"] && spare >= g.price! + 30) return { t: "buyGear", id };
  }
  if (s.week === 3 && s.inventory.bandage < 1 && spare >= shopPrice(s, "bandage") + 10) return { t: "buy", item: "bandage" };
  if (s.week === 3 && s.inventory.potion < 6 && spare >= shopPrice(s, "potion") + 20) return { t: "buy", item: "potion" };
  if (s.hero.level >= 2 && s.week !== 3) return { t: "activity", a: "field" };
  return { t: "activity", a: "rumor" };
}

/** 마법사가 이번 훈련에 고를 원소. 기본: 주 원소가 있으면 그것, 없으면 원소 능력치가 가장 높은 원소 한 가지에 몰아준다 */
export function defaultMagePlan(s: GameState): ElementKey {
  if (s.mainElement) return s.mainElement;
  return [...ELEMENT_KEYS].sort((a, b) => s.hero.stats[ELEMENTS[b].stat] - s.hero.stats[ELEMENTS[a].stat])[0];
}
let magePlan: ((s: GameState) => ElementKey) | null = null;
let warriorPlan: ((s: GameState) => StyleKey) | null = null;
/** 시뮬레이션용: 마법사 원소·전사 방향 선택 방식을 바꾼다(null이면 기본) */
export function setMagePlan(fn: ((s: GameState) => string) | null): void {
  magePlan = fn as typeof magePlan;
  warriorPlan = fn as typeof warriorPlan;
}

/** 전사가 이번 훈련에 고를 방향. 기본: 검투(공방 균형)에 몰아준다 */
export function defaultWarriorPlan(_s: GameState): StyleKey {
  return "glad";
}

/** 이미 클리어한 1섹터를 2섹터로 가려고 다시 지날 때는 서둘러 지나간다 */
function goalOf(s: GameState): "explore" | "rush" | "farm" {
  const dg = s.dungeon;
  if (dg && dg.sector === 1 && s.rank >= 1 && s.hero.level >= 4) return "rush";
  // 2섹터는 시간이 빠듯하다: 남은 시간이 4일 아래로 떨어지면 서두른다
  if (dg && dg.sector >= 2 && (s.autoGoal ?? "explore") === "explore") return "rush";
  return s.autoGoal ?? "explore";
}

function dungeonAction(s: GameState): Action | null {
  const dg = s.dungeon!;
  const hp = s.hero.hp / maxHp(s);
  const goal = goalOf(s);
  if (dg.pending) {
    switch (dg.pending.kind) {
      case "trap":
        // 돌파 목표 + 심연의 신: 꺼진 바닥으로 뛰어내려 지름길
        if (goal === "rush" && power(s, "abyss", 1) && dg.rooms[dg.current].trapKind === "pit" && dg.floor < floorLimit(s) && s.hero.hp > 8) return { t: "pending", choice: "jump" };
        if (s.hero.hp <= 4 && dg.prev !== null) return { t: "pending", choice: "back" };
        return { t: "pending", choice: smod(s, "dex") >= 2 ? "disarm" : "force" };
      case "treasure": return { t: "pending", choice: "open" };
      // 기록물은 탐험할 때만 읽는다(30분)
      case "record": return { t: "pending", choice: goal === "explore" && god(s) !== "oblivion" ? "read" : "leave" };
      case "shrine": return { t: "pending", choice: goal === "rush" && hp >= 0.8 ? "leave" : "pray" };
      case "stairs":
        return { t: "pending", choice: wantDescend(s) ? "descend" : "stay" };
      case "portal": {
        // 1섹터 차원문: 2섹터를 감당할 만하면 넘어가고, 아니면 마석을 들고 돌아간다
        if (dg.sector >= 2) return { t: "pending", choice: "enter" };
        const ready = s.hero.level >= 4 && s.inventory.potion >= 3 && hp >= 0.6 && dg.turnsLeft >= 96;
        return { t: "pending", choice: ready ? "enter" : "return" };
      }
      case "relic": return { t: "pending", choice: hp >= 0.6 ? "search" : "leave" };
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
  if (s.inventory.bandage > 0 && PARTS.some((p) => s.injuries[p] === 2)) return { t: "bandage" };
  if (s.inventory.herb > 0 && s.disease > 0 && god(s) !== "plague") return { t: "herb" };
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
  // 파밍: 전투방에 들어가기 전에 HP를 채운다
  if (goal === "farm" && step !== null && dg.rooms[step].type === "combat" && !dg.rooms[step].resolved && hp < 0.7 && s.hero.satiety > 30 && dg.turnsLeft > 40) return { t: "camp" };
  // 더 갈 곳이 없으면(혹은 계단 앞에서 멈췄으면) 시간이 다 될 때까지 야영하며 버틴다
  return step === null ? { t: "camp" } : { t: "move", room: step };
}

/** 이 레벨에서 내려가도 될 만한 층 */
function comfortFloor(s: GameState): number {
  // 2섹터: 3층은 레벨 6 + 물약 3개 + AC 15 이상, 2층은 레벨 5부터
  if ((s.dungeon?.sector ?? 1) >= 2) {
    if (s.hero.level >= 6 && s.inventory.potion >= 3 && heroAc(s) >= 15) return 3;
    return s.hero.level >= 5 ? 2 : 1;
  }
  // 3층은 레벨 3 + 물약 2개 + AC 13 이상일 때만(잘 준비된 상태)
  if (s.hero.level >= 3 && s.inventory.potion >= 2 && heroAc(s) >= 13) return 3;
  return s.hero.level >= 2 ? 2 : 1;
}

/** 내려갈 수 있는 가장 깊은 층(목표와 상관없이 같다 — 돌파도 무모하게 내려가진 않는다) */
function floorLimit(s: GameState): number {
  return comfortFloor(s);
}

/** 이 층에 아직 할 일이 남았는지(목표 기준) */
function floorDone(s: GameState): boolean {
  const dg = s.dungeon!;
  if (goalOf(s) === "rush") return true;
  // 리젠된 방은 "남은 일"로 치지 않는다(아니면 파밍이 영영 내려가지 않는다)
  if (goalOf(s) === "farm") return !dg.rooms.some((r) => !r.visited || (!r.resolved && !r.respawned && ["combat", "treasure"].includes(r.type)));
  return dg.rooms.every((r) => r.visited || ["stairs", "portal", "boss"].includes(r.type));
}

function wantDescend(s: GameState): boolean {
  const dg = s.dungeon!;
  const hp = s.hero.hp / maxHp(s);
  if (dg.floor >= floorLimit(s)) return false;
  if (goalOf(s) === "rush") return hp >= 0.5;
  return hp >= 0.6 && floorDone(s);
}

/** 목표에 따라 다음에 갈 방 쪽으로 한 걸음 */
function nextStep(s: GameState): number | null {
  const dg = s.dungeon!;
  const start = dg.current;
  const { prev, order } = bfs(dg.rooms, start);
  const seen = (id: number) => dg.rooms[id].known || dg.rooms[id].visited;
  const first = (pred: (id: number) => boolean) => order.find((id) => id !== start && pred(id)) ?? null;
  const goal = goalOf(s);
  const exitOk = dg.floor < floorLimit(s) || dg.rooms.some((r) => r.type === "portal");
  const exitRoom = () => first((id) => ["stairs", "portal"].includes(dg.rooms[id].type) && seen(id));
  const boss = () => first((id) => (dg.rooms[id].type === "boss" && !dg.rooms[id].resolved && seen(id)) || (dg.rooms[id].type === "portal" && seen(id)));

  let target: number | null = null;
  if (goal === "rush") {
    // 출구가 보이면 곧장, 아니면 가장 가까운 미방문 방(알려진 함정은 피해서)
    if (dg.floor === 3) target = boss();
    if (target === null && exitOk && wantDescend(s)) target = exitRoom();
    if (target === null) target = first((id) => !dg.rooms[id].visited && !(dg.rooms[id].type === "trap" && seen(id)));
    if (target === null) target = first((id) => !dg.rooms[id].visited);
  } else if (goal === "farm") {
    // 알려진 전투방·상자 → 모르는 방 → 다 털었으면 출구/보스 → 더 못 내려가면 리젠된 방을 계속 사냥
    target = first((id) => seen(id) && !dg.rooms[id].resolved && !dg.rooms[id].respawned && ["combat", "treasure"].includes(dg.rooms[id].type));
    if (target === null) target = first((id) => !dg.rooms[id].visited && !(seen(id) && ["trap", "record", "shrine", "empty"].includes(dg.rooms[id].type)));
    if (target === null && dg.floor === 3 && comfortFloor(s) >= 3) target = boss();
    if (target === null && exitOk) target = exitRoom();
    if (target === null) target = first((id) => dg.rooms[id].respawned === true && !dg.rooms[id].resolved);
  } else {
    // 구석구석: 3층에서는 보스(차원문)가 보이면 그쪽, 아니면 가장 가까운 미방문 방, 다 돌면 출구
    if (dg.floor === 3) target = boss();
    if (target === null) target = first((id) => !dg.rooms[id].visited);
    if (target === null && exitOk) target = exitRoom();
    // 더 내려갈 수 없으면 야영만 하지 않고 다시 채워진 방을 정리한다
    if (target === null && s.hero.hp / maxHp(s) >= 0.7) target = first((id) => dg.rooms[id].respawned === true && !dg.rooms[id].resolved);
  }
  if (target === null) return null;
  let step = target;
  while (prev.get(step) !== start) {
    const p = prev.get(step);
    if (p === undefined || p === -1) return null;
    step = p;
  }
  return step;
}

/** start에서 가까운 순서의 방 목록과 경로 */
function bfs(rooms: { edges: number[] }[], start: number): { prev: Map<number, number>; order: number[] } {
  const prev = new Map<number, number>([[start, -1]]);
  const order = [start];
  for (let i = 0; i < order.length; i++) {
    for (const nb of rooms[order[i]].edges) {
      if (!prev.has(nb)) {
        prev.set(nb, order[i]);
        order.push(nb);
      }
    }
  }
  return { prev, order };
}
