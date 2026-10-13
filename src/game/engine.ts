import { combatAttack, combatFlee, combatPotion } from "./combat";
import { camp, drinkPotion, eat, enterDungeon, moveTo, resolvePending, useScroll, type PendingChoice } from "./dungeon";
import { buy, buyGear, closeSettlement, closeWeek, createHero, doActivity, rerollCandidates, sell, train } from "./town";
import type { Activity, GameState, StatKey } from "./types";
import type { BAL } from "./data";

export type ShopItem = keyof typeof BAL.prices;

export type Action =
  | { t: "reroll" }
  | { t: "create"; name: string; candidate: number; faith: string | null }
  | { t: "activity"; a: Activity }
  | { t: "train"; training: string; free: [StatKey, StatKey] }
  | { t: "buy"; item: ShopItem }
  | { t: "sell"; item: ShopItem }
  | { t: "buyGear"; id: string }
  | { t: "closeWeek" }
  | { t: "move"; room: number }
  | { t: "pending"; choice: PendingChoice }
  | { t: "camp" }
  | { t: "eat" }
  | { t: "potion" }
  | { t: "scroll" }
  | { t: "attack"; target: number }
  | { t: "combatPotion" }
  | { t: "flee" }
  | { t: "closeSettlement" };

/** 순수 함수: 상태를 복사해서 행동을 적용한 새 상태를 돌려준다 */
export function act(prev: GameState, a: Action): GameState {
  const s = structuredClone(prev);
  apply(s, a);
  return s;
}

/** 복사 없이 제자리에서 적용(시뮬레이션용) */
export function apply(s: GameState, a: Action): void {
  switch (a.t) {
    case "reroll": return rerollCandidates(s);
    case "create": return createHero(s, a.name, a.candidate, a.faith);
    case "activity": return doActivity(s, a.a);
    case "train": return train(s, a.training, a.free);
    case "buy": return buy(s, a.item);
    case "sell": return sell(s, a.item);
    case "buyGear": return buyGear(s, a.id);
    case "closeWeek":
      if (closeWeek(s) === "dungeon") enterDungeon(s);
      return;
    case "move": return moveTo(s, a.room);
    case "pending": return resolvePending(s, a.choice);
    case "camp": return camp(s);
    case "eat": return eat(s);
    case "potion": return drinkPotion(s);
    case "scroll": return useScroll(s);
    case "attack": return combatAttack(s, a.target);
    case "combatPotion": return combatPotion(s);
    case "flee": return combatFlee(s);
    case "closeSettlement": return closeSettlement(s);
  }
}
