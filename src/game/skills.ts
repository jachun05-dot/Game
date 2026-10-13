import { gearBonus } from "./gear";
import { fragSkills } from "./fragments";
import { mindResist } from "./mind";
import { faithHungerMult } from "./faith";
import type { GameState } from "./types";
import type { ElementKey } from "./elements";

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
  | { type: "spell"; dice: [number, number]; all: boolean; text: string }
  /** 원소 주문: 반드시 명중, 피해 = 주사위 + 원소 주 능력치 보정 */
  | {
      type: "espell"; el: ElementKey; dice: [number, number]; text: string;
      all?: boolean;
      /** 단일 대상 고르기(기본 가장 약한 적) */
      pick?: "weakest" | "strongest" | "hard";
      /** 단단한 적에게 추가 피해 */
      hardBonus?: number;
      /** 다른 적 하나에게 반 피해로 튐 */
      bounce?: boolean;
      /** 얼림·넘어뜨림 확률(1라운드 행동 불가) */
      freeze?: number;
      knock?: number;
      /** 감전 라운드(50% 행동 실패) */
      shock?: number;
      /** 같은 주문을 몇 번 쏘나 */
      casts?: number;
      /** 피해 주사위 크기가 출렁인다(번개) */
      vary?: boolean;
    }
  /** 방어 주문: AC +ac, freeze면 나를 때린 적을 얼릴 확률, reduce면 받는 피해 감소 */
  | { type: "eguard"; ac: number; rounds: number; freeze?: number; reduce?: number; text: string }
  /** 서리 안개: 적 전원 명중 감소 */
  | { type: "fog"; hit: number; rounds: number; text: string }
  /** 가장 강한 적을 묶는다. half면 그 라운드 받는 피해 절반 */
  | { type: "bind"; rounds: number; half?: boolean; text: string }
  /** 적 전원을 불태운다 */
  | { type: "burnAll"; rounds: number; text: string };

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
  /** 마법사 원소 기술 */
  el?: ElementKey;
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
  // 편린 능력(fragments.ts) — 훈련으로는 배울 수 없다
  fragCoward: { id: "fragCoward", name: "비겁자의 감", kind: "passive", desc: "도주 판정 +3, 치명타 확률 +2%", passive: { flee: 3, crit: 2 } },
  fragGoldNose: { id: "fragGoldNose", name: "마석 냄새", kind: "passive", desc: "감각 판정 +3, 치명타 확률 +3%", passive: { perception: 3, crit: 3 } },
  fragJewelStab: {
    id: "fragJewelStab", name: "훔친 손놀림", kind: "active",
    desc: "전투 시작 시 첫 공격이 명중 +3, 피해 +4",
    trigger: { on: "start" }, effect: { type: "strike", hit: 3, dmg: 4 }, uses: 1,
  },
  fragCrystalBone: { id: "fragCrystalBone", name: "결정 골격", kind: "passive", desc: "AC +2, 최대 HP +5", passive: { ac: 2, hp: 5 } },
  fragFrenzy: {
    id: "fragFrenzy", name: "광폭한 이빨", kind: "active",
    desc: "대상의 HP가 50% 이하일 때 반드시 명중, 피해 ×1.5 (전투당 2회)",
    trigger: { on: "targetBelow", pct: 50 }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 1.5, autoHit: true }, uses: 2,
  },
};

// 편린 능력(2섹터)
Object.assign(SKILLS, {
  fragPack: { id: "fragPack", name: "무리의 감각", kind: "passive", desc: "명중 +1", passive: { hit: 1 } },
  fragWing: { id: "fragWing", name: "날개 바람", kind: "passive", desc: "도주 판정 +4", passive: { flee: 4 } },
  fragCharge: {
    id: "fragCharge", name: "돌진", kind: "active", desc: "전투 시작 시 첫 공격 피해 ×1.5",
    trigger: { on: "start" }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 1.5 }, uses: 1,
  },
  fragDeadNerve: { id: "fragDeadNerve", name: "죽은 자의 담력", kind: "passive", desc: "공포에 걸리지 않는다" },
  fragGoldHunter: { id: "fragGoldHunter", name: "황금 사냥꾼", kind: "passive", desc: "치명타 확률 +5%, 명중 +1", passive: { crit: 5, hit: 1 } },
  fragManaFeather: { id: "fragManaFeather", name: "마석 깃털", kind: "passive", desc: "AC +1, 도주 +3, 감각 판정 +2", passive: { ac: 1, flee: 3, perception: 2 } },
  fragManaArmor: { id: "fragManaArmor", name: "마석 갑주", kind: "passive", desc: "AC +2, 최대 HP +6", passive: { ac: 2, hp: 6 } },
  fragQueenScream: {
    id: "fragQueenScream", name: "여왕의 비명", kind: "active", desc: "적이 2마리 이상이면 전투 시작 시 모든 적이 1라운드 동안 행동 불가",
    trigger: { on: "start", minEnemies: 2 }, effect: { type: "stunAll", rounds: 1 }, uses: 1,
  },
  fragVanguard: {
    id: "fragVanguard", name: "선봉의 일격", kind: "active", desc: "전투 시작 시 첫 공격 명중 +4, 피해 +4",
    trigger: { on: "start" }, effect: { type: "strike", hit: 4, dmg: 4 }, uses: 1,
  },
} satisfies Record<string, SkillDef>);

// 마법사 원소 기술(elements.ts의 레벨표). 효과 처리는 combat.ts
const E = (el: ElementKey, defs: Record<string, Omit<SkillDef, "el">>) => Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, { ...v, el }]));
Object.assign(SKILLS, E("fire", {
  fireEmber: { id: "fireEmber", name: "불씨", kind: "passive", desc: "마력탄이 맞으면 20% 확률로 적이 불탄다(2라운드, 라운드마다 1d3)" },
  fireArrow: { id: "fireArrow", name: "불화살", kind: "active", desc: "전투 시작 시 가장 약한 적에게 반드시 맞는 불화살(1d6 + 지능 보정)", trigger: { on: "start" }, effect: { type: "espell", el: "fire", dice: [1, 6], text: "손끝에서 불화살이 날아간다" }, uses: 1 },
  fireMark: { id: "fireMark", name: "불의 각인", kind: "passive", desc: "화염 피해 +2, 화염 주문에 맞은 적이 불탄다(3라운드, 1d3 + 힘 보정), 화염 액티브 전투당 +1회" },
  fireBlast: { id: "fireBlast", name: "불꽃 폭발", kind: "active", desc: "적이 3마리 이상이면 모든 적에게 불꽃(1d4 + 지능 보정)", trigger: { on: "enemiesAtLeast", n: 3 }, effect: { type: "espell", el: "fire", dice: [1, 4], all: true, text: "불꽃이 사방으로 터져 나간다" }, uses: 1 },
  fireHeat: { id: "fireHeat", name: "열기", kind: "passive", desc: "모든 주문 피해 +1, 힘 보정의 절반이 더해진다" },
  fireSea: { id: "fireSea", name: "불바다", kind: "active", desc: "전투 시작 시 적 전원을 불태운다(3라운드)", trigger: { on: "start" }, effect: { type: "burnAll", rounds: 3, text: "발밑이 불바다가 된다" }, uses: 1 },
  fireWill: { id: "fireWill", name: "타오르는 의지", kind: "passive", desc: "내 HP 30% 이하면 화염 피해 +3" },
  fireBlaze: { id: "fireBlaze", name: "폭염", kind: "active", desc: "HP 50% 이하인 적에게 반드시 맞는 화염구(2d6 + 지능 보정)", trigger: { on: "targetBelow", pct: 50 }, effect: { type: "espell", el: "fire", dice: [2, 6], text: "화염구가 쏟아진다" }, uses: 1 },
}), E("frost", {
  frostCalm: { id: "frostCalm", name: "냉정", kind: "passive", desc: "명중 +1, 감각 판정 +2(앞방 엿보기·함정 발견)", passive: { hit: 1, perception: 2 } },
  frostArrow: { id: "frostArrow", name: "얼음 화살", kind: "active", desc: "전투 시작 시 가장 강한 적에게 얼음 화살(1d6 + 감각 보정), 40% 확률로 1라운드 얼린다", trigger: { on: "start" }, effect: { type: "espell", el: "frost", dice: [1, 6], pick: "strongest", freeze: 0.4, text: "얼음 화살이 날아간다" }, uses: 1 },
  frostMark: { id: "frostMark", name: "서리의 각인", kind: "passive", desc: "모든 얼림 확률 +20%p(지능 보정 ×3%p 추가), 서리 액티브 전투당 +1회" },
  frostArmor: { id: "frostArmor", name: "얼음 갑옷", kind: "active", desc: "내 HP 50% 이하면 2라운드 AC +4, 나를 때린 적을 20% 확률로 얼린다", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 4, rounds: 2, freeze: 0.2, text: "몸을 얼음으로 감싼다" }, uses: 1 },
  frostTouch: { id: "frostTouch", name: "서리 손끝", kind: "passive", desc: "마력탄이 맞으면 15% 확률로 1라운드 얼린다" },
  frostPrison: { id: "frostPrison", name: "얼음 감옥", kind: "active", desc: "전투 시작 시 가장 강한 적을 2라운드 얼음에 가둔다", trigger: { on: "start" }, effect: { type: "bind", rounds: 2, text: "얼음 기둥이 솟아 적을 가둔다" }, uses: 1 },
  frostEye: { id: "frostEye", name: "차가운 눈", kind: "passive", desc: "움직이지 못하는 적에게 명중 +2, 치명타 확률 +10%" },
  frostStorm: { id: "frostStorm", name: "서리 폭풍", kind: "active", desc: "적이 2마리 이상이면 모든 적에게 서리(1d6 + 감각 보정), 각자 25% 확률로 얼린다", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "espell", el: "frost", dice: [1, 6], all: true, freeze: 0.25, text: "서리 폭풍이 몰아친다" }, uses: 1 },
}), E("bolt", {
  boltStep: { id: "boltStep", name: "섬광 걸음", kind: "passive", desc: "AC +1, 도주 판정 +3", passive: { ac: 1, flee: 3 } },
  boltArrow: { id: "boltArrow", name: "번개 화살", kind: "active", desc: "전투 시작 시 번개 화살(1d6 + 민첩 보정), 다른 적 하나에게 반 피해로 튄다", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [1, 6], bounce: true, text: "번개가 손끝에서 튄다" }, uses: 1 },
  boltMark: { id: "boltMark", name: "번개의 각인", kind: "passive", desc: "번개가 한 번 더 튄다(행운 보정 ×10% 확률로 또 한 번), 날아다니는 적에게 마력탄 명중 +2, 번개 액티브 전투당 +1회" },
  boltChain: { id: "boltChain", name: "연쇄 번개", kind: "active", desc: "적이 3마리 이상이면 모든 적에게 번개(1d4~1d10 출렁임 + 민첩 보정)", trigger: { on: "enemiesAtLeast", n: 3 }, effect: { type: "espell", el: "bolt", dice: [1, 6], all: true, vary: true, text: "번개가 적들 사이를 줄줄이 뛰어다닌다" }, uses: 1 },
  boltStatic: { id: "boltStatic", name: "정전기", kind: "passive", desc: "나를 때린 적이 25% 확률로 감전돼 다음 라운드 명중 −2" },
  boltStrike: { id: "boltStrike", name: "뇌격", kind: "active", desc: "전투 시작 시 가장 강한 적에게 벼락(2d6 + 민첩 보정), 2라운드 동안 50% 확률로 행동 실패", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [2, 6], pick: "strongest", shock: 2, text: "하늘을 가르는 벼락이 떨어진다" }, uses: 1 },
  boltLuck: { id: "boltLuck", name: "행운의 낙뢰", kind: "passive", desc: "행운 보정 ×10% 확률로 주문·마력탄 피해 주사위를 두 번 굴려 높은 쪽을 쓴다" },
  boltOvercharge: { id: "boltOvercharge", name: "과충전", kind: "active", desc: "전투 시작 시 번개 화살을 두 번 쏜다(1d6 + 민첩 보정, 튐)", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [1, 6], bounce: true, casts: 2, text: "넘치는 번개를 연달아 쏟아낸다" }, uses: 1 },
}), E("earth", {
  earthSkin: { id: "earthSkin", name: "돌 피부", kind: "passive", desc: "AC +1, 최대 HP +3", passive: { ac: 1, hp: 3 } },
  earthSling: { id: "earthSling", name: "돌팔매", kind: "active", desc: "전투 시작 시 단단한 적을 먼저 노려 돌을 날린다(1d6 + 체력 보정, 단단하면 +3)", trigger: { on: "start" }, effect: { type: "espell", el: "earth", dice: [1, 6], pick: "hard", hardBonus: 3, text: "바닥의 돌이 떠올라 날아간다" }, uses: 1 },
  earthMark: { id: "earthMark", name: "대지의 각인", kind: "passive", desc: "대지 패시브 효과 1.5배, 단단한 적에게 대지 주문·마력탄 피해 +3, 대지 액티브 전투당 +1회" },
  earthWall: { id: "earthWall", name: "바위 방벽", kind: "active", desc: "내 HP 50% 이하면 2라운드 AC +3, 받는 피해 −1", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 3, rounds: 2, reduce: 1, text: "바위 벽이 솟아오른다" }, uses: 1 },
  earthLevel: { id: "earthLevel", name: "땅 고르기", kind: "passive", desc: "꺼진 바닥을 피하는 판정 +5, 함정 해체 +3" },
  earthPrison: { id: "earthPrison", name: "바위 감옥", kind: "active", desc: "전투 시작 시 가장 강한 적을 2라운드 묶고, 첫 라운드 받는 피해 절반", trigger: { on: "start" }, effect: { type: "bind", rounds: 2, half: true, text: "바위가 솟아 적을 붙잡는다" }, uses: 1 },
  earthRoot: { id: "earthRoot", name: "뿌리 내리기", kind: "passive", desc: "최대 HP +5, 발 부상 이동 페널티 절반", passive: { hp: 5 } },
  earthQuake: { id: "earthQuake", name: "땅 울림", kind: "active", desc: "적이 2마리 이상이면 모든 적에게 땅 울림(1d4 + 체력 보정), 30% 확률로 1라운드 넘어뜨린다", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "espell", el: "earth", dice: [1, 4], all: true, knock: 0.3, text: "땅이 크게 울린다" }, uses: 1 },
}));

// "죽은 자의 담력": 공포 면역
mindResist.push((s, k) => (k === "fear" && fragSkills(s).includes("fragDeadNerve") ? 0 : 1));

/** 배운 기술 + 흡수한 편린의 능력 */
export function allSkills(s: GameState): string[] {
  return [...s.skills, ...fragSkills(s)];
}

export function hasSkill(s: GameState, id: string): boolean {
  return s.skills.includes(id);
}

/** 배운 패시브 + 편린 능력 + 착용 장비 보정의 합 */
export function passive(s: GameState, key: Exclude<keyof Passive, "hunger">): number {
  let t = gearBonus(s, key);
  const earthMark = s.skills.includes("earthMark");
  for (const id of allSkills(s)) {
    const v = SKILLS[id]?.passive?.[key] ?? 0;
    t += earthMark && SKILLS[id]?.el === "earth" ? Math.ceil(v * 1.5) : v; // 대지의 각인: 대지 패시브 1.5배
  }
  return t;
}

export function hungerMult(s: GameState): number {
  let m = faithHungerMult(s);
  for (const id of allSkills(s)) m *= SKILLS[id]?.passive?.hunger ?? 1;
  return m;
}

export function activeSkills(s: GameState): SkillDef[] {
  return allSkills(s).map((id) => SKILLS[id]).filter((d) => d && d.kind === "active");
}
