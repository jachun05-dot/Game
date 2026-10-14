import { autoEat, camp, drinkPotion, eat, enterDungeon, moveTo, resolvePending, useScroll, type PendingChoice } from "./dungeon";
import { answerInquisition, surrender, regen, prosthetic, useBandage, useHerb, buy, buyGear, closeSettlement, closeWeek, createHero, doActivity, eraseFrag, pickClass, rerollCandidates, sell, setTactics, train } from "./town";
import { maxHp } from "./core";
import { repair, useAntidote, useWhetstone } from "./hazards";
import type { CorrodeSlot } from "./gear";
import type { ClassId } from "./classes";
import type { Part } from "./injury";
import type { Activity, AutoGoal, GameState, StatKey, Tactics } from "./types";
import type { BAL } from "./data";

export type ShopItem = keyof typeof BAL.prices;

export type Action =
  | { t: "reroll" }
  | { t: "pickClass"; cls: ClassId }
  | { t: "create"; name: string; candidate: number; faith: string | null }
  | { t: "activity"; a: Activity }
  | { t: "train"; training: string; free: [StatKey, StatKey] }
  | { t: "buy"; item: ShopItem }
  | { t: "sell"; item: ShopItem }
  | { t: "buyGear"; id: string }
  | { t: "closeWeek" }
  /** 4주차: 마을에서 준비를 마치고 미궁에 들어간다 */
  | { t: "enterDungeon" }
  | { t: "move"; room: number }
  | { t: "pending"; choice: PendingChoice }
  | { t: "camp" }
  | { t: "eat" }
  | { t: "potion" }
  | { t: "scroll" }
  | { t: "tactics"; tactics: Partial<Tactics> }
  | { t: "eraseFrag"; index: number }
  | { t: "autoGoal"; goal: AutoGoal }
  /** 이단 심문: true면 신앙 포기, false면 거부(현상수배) */
  | { t: "inquisition"; renounce: boolean }
  /** 현상수배 중 성당에 자수(신앙 포기) */
  | { t: "surrender" }
  | { t: "bandage" }
  | { t: "herb" }
  /** 3섹터: 숫돌(부식 한 단계) / 해독초(독·마비 한 단계) / 대장간 수리 */
  | { t: "whetstone" }
  | { t: "antidote" }
  | { t: "repair"; slot: CorrodeSlot }
  /** 신전 재생 의식(손·발 결손) */
  | { t: "regen"; part: Part }
  /** 대장간 의수·의족 */
  | { t: "prosthetic"; part: Part }
  | { t: "closeSettlement" };

/** 순수 함수: 상태를 복사해서 행동을 적용한 새 상태를 돌려준다 */
export function act(prev: GameState, a: Action): GameState {
  const s = structuredClone(prev);
  apply(s, a);
  return s;
}

/** 복사 없이 제자리에서 적용(시뮬레이션용) */
export function apply(s: GameState, a: Action): void {
  run(s, a);
  autoEat(s);
  // 최대 HP가 줄어드는 길(병이 나아 역병의 신 ★3이 꺼짐, 신앙 포기·하락, 장비 교체 등)이 많아
  // 행동이 끝날 때마다 현재 HP를 새 최대치로 한 번 맞춘다.
  if (s.phase !== "create" && s.phase !== "dead" && s.hero.hp > maxHp(s)) s.hero.hp = maxHp(s);
}

function run(s: GameState, a: Action): void {
  switch (a.t) {
    case "reroll": return rerollCandidates(s);
    case "pickClass": return pickClass(s, a.cls);
    case "create": return createHero(s, a.name, a.candidate, a.faith);
    // 4주차에는 마을 활동을 할 수 없다(상점만 들른 뒤 미궁으로)
    case "activity": return s.week >= 4 ? undefined : doActivity(s, a.a);
    case "train": return s.week >= 4 ? undefined : train(s, a.training, a.free);
    case "buy": return buy(s, a.item);
    case "sell": return sell(s, a.item);
    case "buyGear": return buyGear(s, a.id);
    case "closeWeek":
      closeWeek(s);
      return;
    case "enterDungeon":
      if (s.phase === "town" && s.week >= 4) enterDungeon(s);
      return;
    case "move": return moveTo(s, a.room);
    case "pending": return resolvePending(s, a.choice);
    case "camp": return camp(s);
    case "eat": return eat(s);
    case "potion": return drinkPotion(s);
    case "scroll": return useScroll(s);
    case "tactics": return setTactics(s, a.tactics);
    case "eraseFrag": return eraseFrag(s, a.index);
    case "inquisition": return answerInquisition(s, a.renounce);
    case "surrender": return surrender(s);
    case "bandage": return useBandage(s);
    case "herb": return useHerb(s);
    case "whetstone": return useWhetstone(s);
    case "antidote": return useAntidote(s);
    case "repair": return repair(s, a.slot);
    case "regen": return regen(s, a.part);
    case "prosthetic": return prosthetic(s, a.part);
    case "autoGoal":
      s.autoGoal = a.goal;
      return;
    case "closeSettlement": return closeSettlement(s);
  }
}
