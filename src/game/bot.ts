
import { GEAR, gearScore, targetSlot } from "./gear";
import { CLASSES } from "./classes";
import { BAL } from "./data";
import { sweeperDistance, sweeperThreat } from "./sweeper";
import { INJ, PARTS } from "./injury";
import { god, power, tier } from "./faith";
import { fragScore, fragSlots } from "./fragments";
import { heroAc, maxHp, smod, taxDue } from "./core";
import { canTrain, innCost, nextSkill, outlawTrainerHere, shopPrice, trainCost } from "./town";
import { anyParalysis, corrodedSlots, paraOf, poisonOf, repairCost } from "./hazards";
import { corrosionOf } from "./gear";
import { burnParts } from "./fire";
import { shortcutSectors } from "./dungeon";
import { clueCount, clueNeed, trueEndingOpen } from "./truth";
import { LAST_SECTOR } from "./endless";
import type { Action } from "./engine";
import { BRANCH_SKILLS, ELEMENTS, ELEMENT_KEYS, type BranchKey, type ElementKey, type RogueKey, type StyleKey } from "./elements";
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
  // 현상수배 중: 3·4주차에 암시장(두 배 값)에서 고기·물약을 챙긴다
  if (s.heretic && s.week >= 3) {
    if (s.inventory.food < 4 && s.gold >= shopPrice(s, "food")) return { t: "buy", item: "food" };
    if (s.inventory.potion < 2 && s.gold >= shopPrice(s, "potion")) return { t: "buy", item: "potion" };
  }
  // 4주차: 준비는 3주차에 마쳤으니 바로 미궁으로
  // 3섹터를 클리어했고 4섹터를 감당할 만하면 숏컷으로 곧장 4섹터
  if (s.week >= 4) {
    // 숏컷: 감당할 만한 가장 깊은 섹터로(4·5·6섹터)
    const to = shortcutSectors(s).filter((k) => readyFor(s, k)).pop();
    return { t: "enterDungeon", ...(to ? { shortcut: true, sector: to } : {}) };
  }
  if (s.heretic) {
    // 외곽에서 떠돌이 교관을 만났으면 이번 주는 훈련(다음 세금 걱정이 없으니 물약 값만 남긴다)
    if (outlawTrainerHere(s) && canTrain(s) && s.gold - trainCost(s) >= shopPrice(s, "potion") * 2) return pickTraining(s);
    return { t: "activity", a: "field" };
  }
  // 부상: 결손된 손·발엔 의수·의족, 중상·질병이면 여관에서 한 주 쉰다
  for (const p of ["main", "offhand", "feet"] as const) {
    if (s.injuries[p] >= 3 && !s.prosthetic[p] && s.gold >= INJ.prostheticCost) return { t: "prosthetic", part: p };
  }
  const keepSick = god(s) === "plague"; // 역병의 신도는 병을 고치지 않는다
  if (!keepSick && s.disease > 0 && s.inventory.herb > 0) return { t: "herb" };
  // 눈치챈 정신 상태이상이 둘 이상이면(조합이 터질 수 있으니) 여관에서 쉰다
  const minds = Object.values(s.mind).filter((m) => m?.known).length;
  if ((PARTS.some((p) => s.injuries[p] === 2) || (s.disease > 0 && !keepSick) || minds >= 2) && s.gold >= innCost(s)) return { t: "activity", a: "inn" };
  // 저절로 회복되지 않는 규칙이면: HP가 60% 아래이거나 경상이 있으면 여관에서 쉰다(4주차 미궁 전에는 장보기만)
  if (!BAL.freeHeal && s.week < 4 && (s.hero.hp < maxHp(s) * 0.6 || PARTS.some((p) => s.injuries[p] === 1)) && s.gold >= innCost(s)) return { t: "activity", a: "inn" };
  // 미궁 준비물(고기 4, 물약 4) 살 돈은 항상 남겨 둔다
  // 2섹터까지 갈 생각이면(1섹터 클리어 + 레벨 4) 고기를 더 챙긴다, 3섹터까지면 더
  const deep3 = s.rank >= 2 && s.hero.level >= 7;
  const deep4 = s.rank >= 3 && s.hero.level >= 11;
  const deep5 = s.rank >= 4 && s.hero.level >= 14;
  const deep6 = s.rank >= 5 && s.hero.level >= 15;
  const foodNeed = deep5 ? 14 : deep3 ? 12 : s.rank >= 1 && s.hero.level >= 4 ? 9 : 4;
  const supply = Math.max(0, foodNeed - s.inventory.food) * shopPrice(s, "food") + Math.max(0, 4 - s.inventory.potion) * shopPrice(s, "potion");
  // 다음 세금도 남겨 둔다(4주차 미궁에서 벌어 오지만, 빈손으로 나올 수도 있다)
  const spare = s.gold - supply - (s.heretic ? 0 : taxDue(s.month + 1, s.rank));
  if (s.week === 3) {
    if (s.inventory.food < foodNeed && s.gold >= shopPrice(s, "food")) return { t: "buy", item: "food" };
    if (s.inventory.potion < 4 && s.gold >= shopPrice(s, "potion")) return { t: "buy", item: "potion" };
    // 3섹터 준비: 해독초 2, 숫돌 1
    if (deep3 && s.inventory.antidote < 2 && s.gold >= shopPrice(s, "antidote")) return { t: "buy", item: "antidote" };
    if (deep3 && s.inventory.whetstone < 1 && s.gold >= shopPrice(s, "whetstone")) return { t: "buy", item: "whetstone" };
    // 3섹터는 시간이 길다(차원문을 두 번 넘으면 남은 시간 ×4): 빠져나올 귀환 주문서 한 장
    if (deep3 && s.inventory.scroll < 1 && s.gold >= shopPrice(s, "scroll") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "scroll" };
    // 4섹터 준비: 화상 연고 2, 장작 2, 물약 5
    if (deep4 && s.inventory.salve < 2 && s.gold >= shopPrice(s, "salve") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "salve" };
    if (deep4 && s.inventory.firewood < 2 && s.gold >= shopPrice(s, "firewood") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "firewood" };
    if (deep4 && s.inventory.potion < 5 && s.gold >= shopPrice(s, "potion") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "potion" };
    // 5섹터 준비: 밧줄 2, 물약 6
    if (deep5 && s.inventory.rope < 2 && s.gold >= shopPrice(s, "rope") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "rope" };
    if (deep5 && s.inventory.potion < 6 && s.gold >= shopPrice(s, "potion") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "potion" };
    // 6섹터 준비: 옛 신의 향 1(신앙이 있을 때), 물약 8
    if (deep6 && s.hero.faith && s.inventory.incense < 1 && s.gold >= shopPrice(s, "incense") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "incense" };
    if (deep6 && s.inventory.potion < 8 && s.gold >= shopPrice(s, "potion") + taxDue(s.month + 1, s.rank)) return { t: "buy", item: "potion" };
  }
  // 삭은 장비: 무기 2단계 이상이거나 방어구 3단계면 대장간에서 고친다
  for (const k of corrodedSlots(s)) {
    if ((k === "main" ? corrosionOf(s, k) >= 2 : corrosionOf(s, k) >= 3) && s.gold - repairCost(s, k) >= taxDue(s.month + 1, s.rank)) return { t: "repair", slot: k };
  }
  // 1) 훈련 2) 몸통·방패 3) 여유가 되면 물약을 더
  if (canTrain(s) && spare >= trainCost(s)) {
    if (s.hero.cls === "adventurer") {
      // 마법사형으로 기울면(지능이 힘·민첩보다 높고 마법사형 기술이 둘 이상) 지팡이를 산다
      const casterSkills = Object.values(BRANCH_SKILLS.caster).filter((id) => s.skills.includes(id)).length;
      const st = s.hero.stats;
      if (s.gear.main !== "staff" && casterSkills >= 2 && st.int > Math.max(st.str, st.dex) + 1 && s.gold >= GEAR.staff.price! + trainCost(s)) return { t: "buyGear", id: "staff" };
    }
    // 전사: 방패가 없으면 먼저 산다(방패 기술은 방패가 있어야)
    if (s.hero.cls === "warrior" && !s.gear.offhand && s.gold >= GEAR.shield.price! + trainCost(s)) return { t: "buyGear", id: "shield" };
    // 로그: 손쇠뇌가 있으면 볼트를 채운다
    if (s.gear.offhand === "rgHandXbow" && s.inventory.bolt < 20 && s.gold >= shopPrice(s, "bolt") + trainCost(s)) return { t: "buy", item: "bolt" };
    return pickTraining(s);
  }
  if (!s.gear.body && spare >= GEAR.leather.price!) return { t: "buyGear", id: "leather" };
  // 2섹터를 클리어했으면 3섹터 장비(등급 2)를 여유가 될 때 산다
  if (s.rank >= 2) {
    for (const id of s.rank >= 5 ? ["sunsteel", "relicstaff", "sundagger", "towershield", "abyssblade", "voidstaff", "abyssdagger", "shadowhide", "pilgrimboots", "lanternhelm"] : s.rank >= 4 ? ["abyssblade", "voidstaff", "abyssdagger", "shadowhide", "clawboots", "lanternhelm", "minerpick", "safetyboots"] : s.rank >= 3 ? ["minerpick", "fireleather", "safetyboots", "minerhelm", "bronzeblade", "bronzedagger"] : ["bronzeblade", "bronzedagger", "oiledleather", "waders"]) {
      const g = GEAR[id];
      const slot = targetSlot(s, id);
      if (g.weapon && !weaponFits(s, id)) continue;
      if (s.gear[slot] !== id && gearScore(id) >= gearScore(s.gear[slot]) && spare >= g.price! + 50) return { t: "buyGear", id };
    }
  }
  // 로그: 1섹터를 넘기면 강철 단검
  if (s.hero.cls === "rogue" && s.rank >= 1 && weaponScore(s.gear.main) < weaponScore("steeldagger") && spare >= GEAR.steeldagger.price! + 30) return { t: "buyGear", id: "steeldagger" };
  if (s.hero.cls === "rogue" && s.gear.offhand === "rgHandXbow" && s.inventory.bolt < 30 && spare >= shopPrice(s, "bolt") + 10) return { t: "buy", item: "bolt" };
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

/** 이번 훈련으로 받을 갈래와 자유 배분(장비 구매 없이) */
function pickTraining(s: GameState): Action {
  if (s.hero.cls === "mage") return { t: "train", training: (magePlan ?? defaultMagePlan)(s), free: ["int", "con"] };
  if (s.hero.cls === "adventurer") {
    const br = (adventurerPlan ?? defaultAdventurerPlan)(s);
    const main = br === "caster" ? "int" : br === "rogue" ? "dex" : "str";
    return { t: "train", training: br, free: [main, "con"] };
  }
  if (s.hero.cls === "warrior") return { t: "train", training: (warriorPlan ?? defaultWarriorPlan)(s), free: ["str", "con"] };
  if (s.hero.cls === "rogue") return { t: "train", training: (roguePlan ?? defaultRoguePlan)(s), free: ["dex", "con"] };
  const order = ["warfare", "arcane", "sword", "endure", "footwork", "scout", "study"].filter((id) => CLASSES[s.hero.cls].trainings.includes(id));
  const training = order.find((id) => nextSkill(s, id)) ?? order[0];
  return { t: "train", training, free: ["str", "con"] };
}

/** 마법사가 이번 훈련에 고를 원소. 기본: 주 원소가 있으면 그것, 없으면 원소 능력치가 가장 높은 원소 한 가지에 몰아준다 */
export function defaultMagePlan(s: GameState): ElementKey {
  if (s.mainElement) return s.mainElement;
  return [...ELEMENT_KEYS].sort((a, b) => s.hero.stats[ELEMENTS[b].stat] - s.hero.stats[ELEMENTS[a].stat])[0];
}
let magePlan: ((s: GameState) => ElementKey) | null = null;
let warriorPlan: ((s: GameState) => StyleKey) | null = null;
let adventurerPlan: ((s: GameState) => BranchKey) | null = null;
let roguePlan: ((s: GameState) => RogueKey) | null = null;
/** 시뮬레이션용: 마법사 원소·전사 방향 선택 방식을 바꾼다(null이면 기본) */
export function setMagePlan(fn: ((s: GameState) => string) | null): void {
  magePlan = fn as typeof magePlan;
  warriorPlan = fn as typeof warriorPlan;
  adventurerPlan = fn as typeof adventurerPlan;
  roguePlan = fn as typeof roguePlan;
}

/** 로그가 이번 훈련에 고를 갈래. 기본: 암습에 몰아준다(시뮬로 고른 기본, docs/ROGUE.md) */
export function defaultRoguePlan(_s: GameState): RogueKey {
  return "assassin";
}

/** 이 직업이 손에 들 만한 무기인가(마법사 = 지능, 로그 = 민첩·숏소드, 나머지 = 지능이 아닌 것) */
function weaponFits(s: GameState, id: string): boolean {
  const w = GEAR[id].weapon;
  if (!w) return true;
  if (s.hero.cls === "mage") return w.stat === "int";
  if (s.hero.cls === "rogue") return w.stat === "dex" || !!w.finesse;
  return w.stat === "str";
}

/** 무기 세기(주사위 평균 + 치명) */
function weaponScore(id: string | undefined): number {
  const w = id ? GEAR[id]?.weapon : undefined;
  return w ? (w.dice[0] * (w.dice[1] + 1)) / 2 + (GEAR[id!].bonus.crit ?? 0) / 5 : 0;
}

/** 모험가가 이번 훈련에 고를 갈래. 기본: 전사형에 몰아준다 */
export function defaultAdventurerPlan(_s: GameState): BranchKey {
  return "fighter";
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
  if (dg && dg.sector === 2 && s.rank >= 2 && s.hero.level >= 7) return "rush";
  if (dg && dg.sector === 3 && s.rank >= 3 && s.hero.level >= 11) return "rush";
  if (dg && dg.sector === 4 && s.rank >= 4 && s.hero.level >= 14) return "rush";
  if (dg && dg.sector === 5 && s.rank >= 5 && s.hero.level >= 15) return "rush";
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
        {
          // 4섹터 함정: 가스는 기다리고, 낙반은 힘·민첩, 광차는 지능, 얇은 얼음은 건너거나 물러난다
          const k = dg.rooms[dg.current].trapKind;
          // 6섹터 봉인 문: 해석해 보고(실패하면 수호자 — 져도 죽지 않는다)
          if (k === "rune" || k === "weight" || k === "mirror") return { t: "pending", choice: "disarm" };
          if (k === "gas") return { t: "pending", choice: "disarm" };
          // 벼랑길: 밧줄이 있으면 밧줄, 서두를 때 심연의 신도는 뛰어내리고, 아니면 조심히
          if (k === "ledge") {
            if (goal === "rush" && power(s, "abyss", 1) && dg.floor < floorLimit(s)) return { t: "pending", choice: "jump" };
            if (s.inventory.rope > 0 && (dg.floor >= 2 || hp < 0.5)) return { t: "pending", choice: "rope" };
            return { t: "pending", choice: sweeperThreat(s) ? "force" : "careful" };
          }
          if (k === "ice") return { t: "pending", choice: hp < 0.4 && dg.prev !== null ? "back" : "force" };
          if (k === "collapse") return { t: "pending", choice: Math.max(smod(s, "str"), smod(s, "dex")) >= 3 ? "disarm" : "force" };
          if (k === "cart") return { t: "pending", choice: smod(s, "int") >= 2 ? "disarm" : "force" };
        }
        return { t: "pending", choice: smod(s, "dex") >= 2 ? "disarm" : "force" };
      case "treasure": return { t: "pending", choice: "open" };
      // 기록물은 탐험할 때만 읽는다(30분)
      case "record": return { t: "pending", choice: goal === "explore" && god(s) !== "oblivion" ? "read" : "leave" };
      case "shrine": return { t: "pending", choice: goal === "rush" && hp >= 0.8 ? "leave" : "pray" };
      case "stairs":
        // 청소부가 오고 있으면 내려간다
        return { t: "pending", choice: wantDescend(s) || sweeperThreat(s) ? "descend" : "stay" };
      // 첫 미궁: 1층을 다 돌았거나 많이 다쳤으면 떨어진 주문서로 돌아간다
      case "lostScroll":
        return { t: "pending", choice: floorDone(s) || hp < 0.5 ? "use" : "stay" };
      case "portal": {
        // 차원문: 다음 섹터를 감당할 만하면 넘어가고, 아니면 마석을 들고 돌아간다(3섹터 너머 끝없는 미궁은 그냥 들어간다)
        // 끝없는 미궁은 식량이 넉넉할 때만(돌아올 길은 주문서뿐)
        if (dg.endless || dg.sector >= LAST_SECTOR) return { t: "pending", choice: s.inventory.food >= 4 || s.inventory.scroll > 0 ? "enter" : "return" };
        if (dg.sector === 3) return { t: "pending", choice: ready4(s) && hp >= 0.6 && dg.turnsLeft >= 96 && s.inventory.food >= 5 ? "enter" : "return" };
        if (dg.sector === 4) return { t: "pending", choice: s.hero.level >= 14 && s.inventory.potion >= 5 && hp >= 0.6 && dg.turnsLeft >= 96 && s.inventory.food >= 6 ? "enter" : "return" };
        if (dg.sector === 5) return { t: "pending", choice: readyFor(s, 6) && hp >= 0.6 && dg.turnsLeft >= 96 && s.inventory.food >= 6 ? "enter" : "return" };
        const need = dg.sector === 2 ? 7 : 4;
        const ready = s.hero.level >= need && s.inventory.potion >= 3 && hp >= 0.6 && dg.turnsLeft >= 96 && (dg.sector === 1 || s.inventory.food >= 5);
        return { t: "pending", choice: ready ? "enter" : "return" };
      }
      case "relic": return { t: "pending", choice: hp >= 0.6 ? "search" : "leave" };
      case "plenty": return { t: "pending", choice: (god(s) === "hunger" || (s.inventory.food >= 4 && s.hero.satiety < 70)) && s.inventory.food > 0 ? "offer" : "leave" };
      case "magazine": return { t: "pending", choice: god(s) === "trap" ? "pray" : hp >= 0.6 ? "search" : "leave" };
      // 6섹터: 봉헌함은 뒤지고, 제단에서는 기도하고, 고해실에서는(보통 사람처럼) 신앙을 부정하거나 캐묻는다
      case "offerbox": return { t: "pending", choice: "search" };
      case "altars": return { t: "pending", choice: "pray" };
      // 진엔딩이 손에 닿으면(조각이 하나 모자라고 칙서만 남았으면) 심문을 거부하고 심문관장과 싸워 칙서를 얻는다
      case "confession": return { t: "pending", choice: !s.hero.faith ? "ask" : clueCount(s) + (s.edict ? 0 : 1) >= clueNeed(s) && hp >= 0.6 ? "refuse" : "renounce" };
      // 셉터: 진엔딩이 열렸으면 두고 가고, 아니면 바친다(이단이면 보류)
      case "scepter": return { t: "pending", choice: trueEndingOpen(s) ? "leave" : !s.heretic ? "take" : "hold" };
      case "altar": return { t: "pending", choice: god(s) === "plague" ? "pray" : hp >= 0.7 && poisonOf(s) === 0 ? "search" : "leave" };
      case "frag": {
        // 빈 칸이면 흡수, 꽉 찼으면 가장 약한 편린보다 나을 때만 바꾼다
        if (s.fragments.length < fragSlots(s.hero.level)) return { t: "pending", choice: "absorb" };
        const scores = s.fragments.map(fragScore);
        const worst = scores.indexOf(Math.min(...scores));
        return { t: "pending", choice: fragScore(dg.pending.frag) > scores[worst] ? `swap${worst}` : "leave" };
      }
      case "gear": {
        const better = gearScore(dg.pending.item) > gearScore(s.gear[targetSlot(s, dg.pending.item)]);
        const wrongWeapon = !!GEAR[dg.pending.item].weapon && !weaponFits(s, dg.pending.item);
        // 로그: 각인이 준 왼손 무기를 방패로 바꾸지 않는다
        if (s.hero.cls === "rogue" && GEAR[dg.pending.item].slot === "offhand" && s.gear.offhand && GEAR[s.gear.offhand].rogueOff) return { t: "pending", choice: "leave" };
        return { t: "pending", choice: better && !wrongWeapon ? "equip" : "leave" };
      }
    }
  }
  if (s.inventory.bandage > 0 && PARTS.some((p) => s.injuries[p] === 2)) return { t: "bandage" };
  if (s.inventory.herb > 0 && s.disease > 0 && god(s) !== "plague") return { t: "herb" };
  if (s.inventory.antidote > 0 && (poisonOf(s) >= 1 || paraOf(s, "main") >= 1 || (anyParalysis(s) && poisonOf(s) + paraOf(s, "feet") >= 2))) return { t: "antidote" };
  if (s.inventory.whetstone > 0 && corrosionOf(s, "main") >= 2) return { t: "whetstone" };
  if (s.inventory.salve > 0 && burnParts(s).some((p) => s.injuries[p] >= 2)) return { t: "salve" };
  if (hp < 0.4 && s.inventory.potion > 0) return { t: "potion" };
  if (hp < 0.45 && s.inventory.potion === 0 && s.inventory.scroll > 0) return { t: "scroll" };
  // 청소부가 바로 옆인데 출구가 옆에 없으면 주문서로 빠진다
  const sd = sweeperDistance(s);
  if (sd !== null && sd <= 1 && s.inventory.scroll > 0 && !dg.rooms[dg.current].edges.some((e) => ["stairs", "portal"].includes(dg.rooms[e].type))) return { t: "scroll" };
  if (s.hero.satiety < 25 && s.inventory.food > 0) return { t: "eat" };
  // 식량이 떨어져 굶주리기 시작했으면 주문서로 빠진다
  if (s.hero.satiety <= 0 && s.inventory.food === 0 && s.inventory.scroll > 0) return { t: "scroll" };
  // 청소부가 오고 있으면 야영하지 않는다(자는 동안 두 방 다가온다) — HP가 아주 낮을 때만 예외
  if ((s.hero.fatigue >= 90 || (hp < 0.5 && s.hero.satiety > 30)) && (!sweeperThreat(s) || hp < 0.2)) return { t: "camp" };
  const step = nextStep(s);
  // 청소부가 오고 있으면 쉬지 않고 출구로(보스방을 지나야 하면 그대로 들어간다). 갈 곳이 없으면 주문서
  if (sweeperThreat(s) && hp >= 0.2) {
    if (step !== null) return { t: "move", room: step };
    if (s.inventory.scroll > 0) return { t: "scroll" };
  }
  // 보스방 앞에서는 야영으로 HP를 채우고 들어간다(잘 준비된 플레이어의 행동)
  if (step !== null && dg.rooms[step].type === "boss" && !dg.rooms[step].resolved && hp < 0.9 && dg.turnsLeft > 40) {
    if (s.hero.satiety < 30 && s.inventory.food > 0) return { t: "eat" };
    if (s.hero.satiety >= 15) return { t: "camp" };
  }
  // 파밍: 전투방에 들어가기 전에 HP를 채운다
  if (goal === "farm" && step !== null && dg.rooms[step].type === "combat" && !dg.rooms[step].resolved && hp < 0.7 && s.hero.satiety > 30 && dg.turnsLeft > 40) return { t: "camp" };
  // 더 갈 곳이 없는데 남은 시간을 버틸 식량이 없으면 주문서로 나간다
  if (step === null && s.inventory.scroll > 0 && s.inventory.food * 40 + s.hero.satiety < dg.turnsLeft * 0.8) return { t: "scroll" };
  // 더 갈 곳이 없으면(혹은 계단 앞에서 멈췄으면) 시간이 다 될 때까지 야영하며 버틴다
  return step === null ? { t: "camp" } : { t: "move", room: step };
}

/** 이 레벨에서 내려가도 될 만한 층 */
function comfortFloor(s: GameState): number {
  // 끝없는 미궁: 레벨 − 9층까지(물약 3개 이상이면 한 층 더)
  if (s.dungeon?.endless) return Math.max(1, s.hero.level - 9 + (s.inventory.potion >= 3 ? 1 : 0));
  // 6섹터: 3층(성소)은 레벨 15 + 물약 5개 + AC 21 이상, 2층은 레벨 15 + 물약 4개부터
  if ((s.dungeon?.sector ?? 1) === 6) {
    if (s.hero.level >= 15 && s.inventory.potion >= 5 && heroAc(s) >= 21) return 3;
    return s.hero.level >= 15 && s.inventory.potion >= 4 ? 2 : 1;
  }
  // 5섹터: 3층은 레벨 15 + 물약 5개 + AC 20 이상, 2층은 레벨 14부터
  if ((s.dungeon?.sector ?? 1) === 5) {
    if (s.hero.level >= 15 && s.inventory.potion >= 5 && heroAc(s) >= 20) return 3;
    return s.hero.level >= 14 ? 2 : 1;
  }
  // 4섹터: 3층은 레벨 12 + 물약 4개 + AC 19 이상, 2층은 레벨 11부터
  if ((s.dungeon?.sector ?? 1) === 4) {
    if (s.hero.level >= 12 && s.inventory.potion >= 4 && heroAc(s) >= 19) return 3;
    return s.hero.level >= 11 ? 2 : 1;
  }
  // 3섹터: 3층은 레벨 9 + 물약 3개 + AC 16 이상, 2층은 레벨 8부터
  if ((s.dungeon?.sector ?? 1) === 3) {
    if (s.hero.level >= 9 && s.inventory.potion >= 3 && heroAc(s) >= 16) return 3;
    return s.hero.level >= 8 ? 2 : 1;
  }
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
  const exitOk = dg.floor < floorLimit(s) || dg.rooms.some((r) => r.type === "portal") || !!dg.first;
  const exitRoom = () => first((id) => ["stairs", "portal"].includes(dg.rooms[id].type) && seen(id));
  const boss = () => first((id) => (dg.rooms[id].type === "boss" && !dg.rooms[id].resolved && seen(id)) || (dg.rooms[id].type === "portal" && seen(id)));

  let target: number | null = null;
  // 청소부가 오고 있으면 무엇보다 출구(계단·차원문)로
  if (sweeperThreat(s)) target = exitRoom();
  if (target !== null) { /* 출구로 */ }
  else if (goal === "rush") {
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

/** 4섹터를 감당할 만한가(레벨 11 + 물약 4) */
function ready4(s: GameState): boolean {
  return s.hero.level >= 11 && s.inventory.potion >= 4;
}

/** 이 섹터(숏컷·차원문 너머)를 감당할 만한가: 4섹터 레벨 11 + 물약 4, 5섹터 레벨 14 + 물약 5, 6섹터 레벨 15 + 물약 6 */
function readyFor(s: GameState, sector: number): boolean {
  // 모험가는 16레벨을 6섹터 제단에서 섬기는 신에게 받으니 15레벨에 들어간다(무신앙 모험가는 16에 닿지 못해 들어가지 않는다)
  if (sector >= 6 && s.hero.cls === "adventurer") return (s.hero.level >= 16 || (s.hero.level >= 15 && tier(s) >= 1 && s.inventory.fang > 0)) && s.inventory.potion >= 6;
  if (sector >= 6) return s.hero.level >= 16 && s.inventory.potion >= 6;
  if (sector === 5) return s.hero.level >= 14 && s.inventory.potion >= 5;
  return ready4(s);
}
