import { gearBonus } from "./gear";
import type { GameState } from "./types";

// 기술(DESIGN 7절 "훈련은 기술을 가르쳐준다"): 전투는 자동이므로 플레이어가 누르는 기술은 없다.
// - 액티브: 조건이 맞으면 저절로 발동(전투 시작 시, 대상 HP n% 이하, 내 HP n% 이하 등). 전투당 횟수 제한.
// - 패시브: 항상 적용되는 보정.

export type Trigger =
  | { on: "start"; minEnemies?: number }
  | { on: "targetBelow"; pct: number }
  | { on: "selfBelow"; pct: number }
  | { on: "enemiesAtLeast"; n: number }
  | { on: "lethal" };

export type SkillEffect =
  | { type: "strike"; hit: number; dmg: number; dmgMult?: number; autoHit?: boolean }
  | { type: "sweep"; dmgMult: number }
  | { type: "guard"; ac: number; rounds: number }
  | { type: "weaken"; ac: number }
  | { type: "stunAll"; rounds: number }
  | { type: "heal"; dice: [number, number]; plusInt: boolean }
  | { type: "endure" }
  | { type: "stunOne"; rounds: number }
  /** 주문: 반드시 명중, 피해 = 주사위 + 지능 보정. all이면 모든 적 */
  | { type: "spell"; dice: [number, number]; all: boolean; text: string };

export interface Passive {
  hit?: number;
  dmg?: number;
  ac?: number;
  crit?: number;
  flee?: number;
  perception?: number;
  potion?: number;
  hp?: number;
  /** 포만감 소모 배율 */
  hunger?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  kind: "active" | "passive";
  desc: string;
  trigger?: Trigger;
  effect?: SkillEffect;
  /** 전투당 발동 횟수(액티브). endure는 미궁 한 번 들어갈 때 1회 */
  uses?: number;
  passive?: Passive;
}

export const SKILLS: Record<string, SkillDef> = {
  // 검술 훈련
  firstStrike: {
    id: "firstStrike", name: "기선 제압", kind: "active",
    desc: "전투 시작 시 첫 공격이 명중 +4, 피해 +2",
    trigger: { on: "start" }, effect: { type: "strike", hit: 4, dmg: 2 }, uses: 1,
  },
  sweep: {
    id: "sweep", name: "휩쓸기", kind: "active",
    desc: "적이 3마리 이상이면 모든 적을 한 번에 벤다(피해 ×0.7)",
    trigger: { on: "enemiesAtLeast", n: 3 }, effect: { type: "sweep", dmgMult: 0.7 }, uses: 1,
  },
  finisher: {
    id: "finisher", name: "마무리 일격", kind: "active",
    desc: "대상의 HP가 40% 이하일 때 반드시 명중, 피해 ×2",
    trigger: { on: "targetBelow", pct: 40 }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 2, autoHit: true }, uses: 2,
  },
  // 보법 훈련
  lightFeet: { id: "lightFeet", name: "가벼운 발", kind: "passive", desc: "AC +1", passive: { ac: 1 } },
  parry: {
    id: "parry", name: "흘려내기", kind: "active",
    desc: "내 HP가 50% 이하가 되면 2라운드 동안 AC +3",
    trigger: { on: "selfBelow", pct: 50 }, effect: { type: "guard", ac: 3, rounds: 2 }, uses: 1,
  },
  runner: { id: "runner", name: "도망자의 감", kind: "passive", desc: "도주 판정 +4", passive: { flee: 4 } },
  // 척후 훈련
  sharpEye: { id: "sharpEye", name: "날카로운 눈", kind: "passive", desc: "명중 +1, 치명타 확률 +3%", passive: { hit: 1, crit: 3 } },
  weakSpot: {
    id: "weakSpot", name: "약점 간파", kind: "active",
    desc: "전투 시작 시 가장 단단한 적의 AC -2 (전투 내내)",
    trigger: { on: "start" }, effect: { type: "weaken", ac: 2 }, uses: 1,
  },
  trapSense: { id: "trapSense", name: "함정 감각", kind: "passive", desc: "함정 발견·앞방 엿보기 +3", passive: { perception: 3 } },
  // 학문 수업
  flashPowder: {
    id: "flashPowder", name: "섬광 가루", kind: "active",
    desc: "적이 2마리 이상이면 전투 시작 시 모든 적이 1라운드 동안 행동 불가",
    trigger: { on: "start", minEnemies: 2 }, effect: { type: "stunAll", rounds: 1 }, uses: 1,
  },
  firstAid: { id: "firstAid", name: "응급 처치 지식", kind: "passive", desc: "물약 회복량 +3", passive: { potion: 3 } },
  poultice: {
    id: "poultice", name: "약초 찜질", kind: "active",
    desc: "내 HP가 30% 이하가 되면 1d6 + 지능 보정만큼 회복",
    trigger: { on: "selfBelow", pct: 30 }, effect: { type: "heal", dice: [1, 6], plusInt: true }, uses: 1,
  },
  // 생존 훈련
  tough: { id: "tough", name: "질긴 몸", kind: "passive", desc: "최대 HP +4", passive: { hp: 4 } },
  grit: {
    id: "grit", name: "이 악물기", kind: "active",
    desc: "쓰러질 피해를 받으면 HP 1로 버틴다 (미궁 한 번에 1회)",
    trigger: { on: "lethal" }, effect: { type: "endure" }, uses: 1,
  },
  hungerTrained: { id: "hungerTrained", name: "굶주림 단련", kind: "passive", desc: "포만감이 25% 덜 닳는다", passive: { hunger: 0.75 } },
  // 전장 훈련(전사 전용)
  shieldBash: {
    id: "shieldBash", name: "방패 밀치기", kind: "active",
    desc: "전투 시작 시 가장 위협적인 적 하나를 1라운드 동안 행동 불가로 만든다",
    trigger: { on: "start" }, effect: { type: "stunOne", rounds: 1 }, uses: 1,
  },
  warCry: {
    id: "warCry", name: "전투 함성", kind: "active",
    desc: "적이 2마리 이상이면 전투 시작 시 3라운드 동안 AC +2",
    trigger: { on: "start", minEnemies: 2 }, effect: { type: "guard", ac: 2, rounds: 3 }, uses: 1,
  },
  ironBody: { id: "ironBody", name: "강철 몸", kind: "passive", desc: "최대 HP +6, AC +1", passive: { hp: 6, ac: 1 } },
  // 주문학(마법사 전용)
  magicMissile: {
    id: "magicMissile", name: "마력 화살", kind: "active",
    desc: "전투 시작 시 가장 약한 적에게 반드시 맞는 마력 화살(1d6 + 지능 보정)",
    trigger: { on: "start" }, effect: { type: "spell", dice: [1, 6], all: false, text: "빛나는 화살이 날아간다" }, uses: 1,
  },
  fireBurst: {
    id: "fireBurst", name: "불꽃 폭발", kind: "active",
    desc: "적이 3마리 이상이면 모든 적에게 불꽃(1d4 + 지능 보정)",
    trigger: { on: "enemiesAtLeast", n: 3 }, effect: { type: "spell", dice: [1, 4], all: true, text: "손끝에서 불꽃이 터져 나간다" }, uses: 1,
  },
  arcaneWard: {
    id: "arcaneWard", name: "마력 방벽", kind: "active",
    desc: "내 HP가 50% 이하가 되면 2라운드 동안 AC +4",
    trigger: { on: "selfBelow", pct: 50 }, effect: { type: "guard", ac: 4, rounds: 2 }, uses: 1,
  },
};

export function hasSkill(s: GameState, id: string): boolean {
  return s.skills.includes(id);
}

/** 배운 패시브 + 착용 장비 보정의 합 */
export function passive(s: GameState, key: Exclude<keyof Passive, "hunger">): number {
  let t = gearBonus(s, key);
  for (const id of s.skills) t += SKILLS[id]?.passive?.[key] ?? 0;
  return t;
}

export function hungerMult(s: GameState): number {
  let m = 1;
  for (const id of s.skills) m *= SKILLS[id]?.passive?.hunger ?? 1;
  return m;
}

export function activeSkills(s: GameState): SkillDef[] {
  return s.skills.map((id) => SKILLS[id]).filter((d) => d && d.kind === "active");
}
