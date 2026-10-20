import { MONSTERS } from "./data";
import { log, maxHp } from "./core";
import { makeEnemies, startCombat } from "./combat";
import { endLife } from "./truth";
import { t } from "../i18n/core";
import type { CombatState, GameState } from "./types";

// 나이 제한(2026-10-19, 사용자 결정): 미궁은 열여섯·열일곱 살만 받아들인다.
// 1~12월 = 16세, 13~24월 = 17세. 25월(18세)이 되는 아침, 미궁은 문을 닫고 쓸모없어진 모험가에게
// 영주의 추적자 셋(6섹터 심문관장급)이 온다. 도주 불가, 지면 처형. 이기면 숨겨진 엔딩 "섬을 떠난 자".
// 엔딩(셉터를 바치거나 영주를 쓰러뜨림)을 보지 못했다면 6섹터를 클리어했어도(보류·끝없는 미궁) 피할 수 없다.

export const AGE = {
  start: 16,
  /** 미궁에 들어갈 수 있는 마지막 달(17세의 끝) */
  lastMonth: 24,
  /** 남은 달이 이만큼이면 알린다 */
  warnAt: [6, 3, 1],
  /** 추적자 수 */
  chasers: 3,
};

export function ageOf(month: number): number {
  return AGE.start + Math.floor((month - 1) / 12);
}

/** 이번 달을 포함해 미궁에 들어갈 수 있는 남은 달 */
export function monthsLeft(month: number): number {
  return Math.max(0, AGE.lastMonth - month + 1);
}

/** 새 달이 시작될 때(정산 뒤): 생일·남은 달 알림. 18세가 되면 true(추적이 시작된다) */
export function ageMonthStart(s: GameState): boolean {
  if (s.month > AGE.lastMonth) return true;
  if (s.month > 1 && (s.month - 1) % 12 === 0) log(s, t("— {age}번째 생일. 미궁이 문을 열어 주는 것도 이제 1년 남았다.", { age: ageOf(s.month) }), "story");
  const left = monthsLeft(s.month);
  if (AGE.warnAt.includes(left))
    log(s, left === 1 ? t("— 이번 달이 마지막이다. 다음 달이면 열여덟, 미궁은 문을 닫고 영주는 쓸모없어진 모험가를 살려 두지 않는다.") : t("— 열여덟까지 {left}개월. 미궁이 문을 닫기 전에 셉터에 닿아야 한다.", { left }), "hurt");
  return false;
}

/** 정산 카드에 붙일 줄(다음 달이 18세면) */
export function ageSettlementLines(s: GameState): string[] {
  if (s.month + 1 <= AGE.lastMonth) return [];
  return [t("내일이면 열여덟이다. 미궁 입구의 문장이 벌써 흐려지고 있다."), t("관공서 앞에 영주의 추적자들이 모여 있다는 소문이 돈다.")];
}

/** 18세가 되는 아침: 추적자 셋과의 싸움(도주 불가). HP는 다 채우고, 들고 있는 물약은 쓴다 */
export function startChase(s: GameState): void {
  s.dungeon = null;
  s.hero.hp = maxHp(s);
  const who = s.heretic ? "grandinquisitor" : "pursuer";
  log(s, t("— 열여덟 번째 생일 아침. 미궁 입구의 문장이 빛을 잃었다. 미궁은 더는 당신을 부르지 않는다."), "story");
  log(s, s.heretic ? t("성당의 종이 울린다. 심문관장 셋이 숨어 있던 폐가의 문을 부수고 들어온다.") : t("관공서의 종이 울린다. 영주의 추적자 셋이 골목 양쪽을 막아선다. \"쓸모가 다한 자는 영지에 둘 수 없다.\""), "hurt");
  log(s, t("도망칠 곳은 없다. 항구까지 가려면 이들을 넘어야 한다."), "story");
  startCombat(s, "chase", makeEnemies(s, Array.from({ length: AGE.chasers }, () => who)));
}

/** 추적이 끝났다: 이기면 섬을 떠나는 엔딩, 결판이 나지 않으면(라운드 한도) 붙잡힌다 */
export function afterChaseCombat(s: GameState, outcome: "win" | "fled", _c: CombatState): boolean {
  if (outcome !== "win") return false;
  endLife(s, "escape");
  return true;
}

export const CHASE_DEATH = "열여덟 살 — 영주의 추적자들에게 붙잡혀 처형당했다";

/** 추적자 이름(로그·도감 밖) */
export function chaserName(s: GameState): string {
  return MONSTERS[s.heretic ? "grandinquisitor" : "pursuer"].name;
}
