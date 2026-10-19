import { gearBonus, hasShield, offOf } from "./gear";
import { fragSkills } from "./fragments";
import { mindResist } from "./mind";
import { faithHungerMult, pietyCapBonus } from "./faith";
import type { GameState } from "./types";
import { CLASS_TRAIT } from "./classes";
import type { ElementKey, OffKind } from "./elements";

// 기술(DESIGN 7절 "훈련은 기술을 가르쳐준다"): 전투는 자동이므로 플레이어가 누르는 기술은 없다.
// - 액티브: 조건이 맞으면 저절로 발동(전투 시작 시, 대상 HP n% 이하, 내 HP n% 이하 등). 전투당 횟수 제한.
// - 패시브: 항상 적용되는 보정.

export type Trigger =
  | { on: "start"; minEnemies?: number }
  | { on: "targetBelow"; pct: number }
  | { on: "selfBelow"; pct: number }
  | { on: "enemiesAtLeast"; n: number }
  | { on: "lethal" }
  /** 반응형(맞거나 피했을 때 등): combat.ts가 기술 id로 직접 처리 */
  | { on: "react" };

export type SkillEffect =
  | { type: "strike"; hit: number; dmg: number; dmgMult?: number; autoHit?: boolean; stun?: number; crit?: boolean; execute?: boolean }
  /** 로그 독: 대상(가장 강한 적·약한 둘·전원)에 독을 n겹, 명중 −hitDown */
  | { type: "tox"; n: number; to: "strongest" | "two" | "all"; rounds: number; hitDown?: number; text: string }
  /** 로그 약화: 가장 강한 적이 주는 피해 −n (보스·정예는 bossRounds) */
  | { type: "cripple"; n: number; rounds: number; bossRounds?: number; text: string }
  /** 투척 단검: 가장 약한 적에게 확정 명중, 주사위 + 민첩 보정 */
  | { type: "throw"; dice: [number, number]; text: string }
  /** 손쇠뇌 기술 사격(볼트 1발): 가장 강한 적(two면 둘), 확정 명중, 피해 ×mult, stun·flee 부가 */
  | { type: "bolt"; to: "strongest" | "two"; mult: number; crit?: boolean; stun?: number; bossStun?: number; flee?: number; cripple?: { n: number; rounds: number; bossRounds: number }; text: string }
  /** 손버릇: 반드시 맞는 찌르기, 그 적을 쓰러뜨리면 마석 ×1.5 */
  | { type: "steal"; dice: [number, number]; text: string }
  /** 연막: 적 전원 행동 불가 + 그 전투 도주 보너스 */
  | { type: "smoke"; rounds: number; flee: number; text: string }
  | { type: "sweep"; dmgMult: number }
  | { type: "guard"; ac: number; rounds: number }
  | { type: "weaken"; ac: number }
  | { type: "stunAll"; rounds: number }
  | { type: "heal"; dice: [number, number]; plusInt: boolean }
  | { type: "endure" }
  | { type: "stunOne"; rounds: number; text?: string; dice?: [number, number] }
  /** 가장 강한 적에게 바로 한 번 공격(확정 명중, crit면 확정 치명타) */
  | { type: "strikeStrong"; mult: number; crit?: boolean; text: string }
  /** 적 전원 n라운드 행동 불가(보스·정예·히든은 bossRounds), half면 첫 라운드 받는 피해 절반 */
  | { type: "zero"; rounds: number; bossRounds: number; half?: boolean; text: string }
  /** n라운드 동안 받는 피해 절반 */
  | { type: "rampart"; rounds: number; text: string }
  /** n라운드 동안 라운드마다 extra번 더 공격, 그동안 받는 피해 +taken */
  | { type: "fury"; rounds: number; extra: number; taken: number; text: string }
  /** 쓰러질 피해를 받으면 최대 HP pct%로 일어나며 적 전원에게 피해(미궁 1회) */
  | { type: "phoenix"; pct: number; dice: [number, number]; text: string }
  /** 확정 도주 */
  | { type: "blink"; text: string }
  /** 가장 강한 적을 중독시킨다(라운드마다 피해) */
  | { type: "venom"; rounds: number; dice: [number, number]; text: string }
  /** 석상: 이번 라운드 받는 피해 절반 */
  | { type: "stone"; text: string }
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
      /** 맞은 적을 불태운다(라운드) */
      burnRounds?: number;
      /** 얼림 라운드(기본 1) */
      freezeRounds?: number;
      /** 맞은 적이 이 확률로 1라운드 감전 */
      shockChance?: number;
      /** 나머지 적 전원에게 반 피해 */
      splashAll?: boolean;
      /** 무작위로 불탐·얼림·감전 중 하나 */
      rider?: boolean;
    }
  /** 방어 주문: AC +ac, freeze면 나를 때린 적을 얼릴 확률, reduce면 받는 피해 감소 */
  | { type: "eguard"; ac: number; rounds: number; freeze?: number; reduce?: number; counter?: boolean; stunAll?: number; text: string }
  /** 광란: n라운드 동안 라운드마다 한 번 더 공격(ac면 그동안 AC +) */
  | { type: "rampage"; rounds: number; ac?: number; text: string }
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
  /** 모든 판정(능력치 판정) */
  check?: number;
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
  /** 방패를 들고 있어야만 효과가 있다 */
  shield?: boolean;
  /** 로그: 이 왼손 무기를 들고 있어야만 효과가 있다(gear.ts offOf) */
  off?: OffKind;
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
    id: "shieldBash", name: "방패 밀치기", kind: "active", shield: true,
    desc: "🛡 방패 필요. 전투 시작 시 가장 위협적인 적 하나를 1라운드 동안 행동 불가로 만든다",
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

// 편린 능력(3섹터). 거머리·두꺼비·달팽이·곰팡이·균사체·균모는 combat.ts·hazards.ts·dungeon.ts가 id로 처리
Object.assign(SKILLS, {
  fragLeech: { id: "fragLeech", name: "흡혈", kind: "passive", desc: "치명타를 내면 HP +2" },
  fragToadSkin: { id: "fragToadSkin", name: "독 피부", kind: "passive", desc: "독에 걸릴 확률 절반" },
  fragShell: { id: "fragShell", name: "껍질", kind: "passive", desc: "장비가 부식될 확률 절반" },
  fragSporeArmor: { id: "fragSporeArmor", name: "포자 갑옷", kind: "passive", desc: "맞으면 10% 확률로 때린 적이 기침하며 1라운드 행동 불가" },
  fragMimicPrayer: { id: "fragMimicPrayer", name: "흉내 낸 기도", kind: "passive", desc: "성소에서 기도하면 신앙심 +2 더" },
  fragStatue: {
    id: "fragStatue", name: "석상", kind: "active", desc: "내 HP 50% 이하가 되면 그 라운드 받는 피해 절반(전투당 1회)",
    trigger: { on: "selfBelow", pct: 50 }, effect: { type: "stone", text: "몸이 돌처럼 굳는다" }, uses: 1,
  },
  fragChoirBell: {
    id: "fragChoirBell", name: "종소리", kind: "active", desc: "전투 시작 시 가장 강한 적이 1라운드 행동 불가",
    trigger: { on: "start" }, effect: { type: "stunOne", rounds: 1, text: "귓가의 종이 울린다 —" }, uses: 1,
  },
  fragMycelium: { id: "fragMycelium", name: "균사 재생", kind: "passive", desc: "전투 라운드마다 HP +1(병을 앓는 동안 +2)" },
} satisfies Record<string, SkillDef>);

// 편린 능력(4섹터). 화상·냉기·낙반은 fire.ts가 id로 처리
Object.assign(SKILLS, {
  fragFireSkin: { id: "fragFireSkin", name: "불 먹은 피부", kind: "passive", desc: "화상에 걸릴 확률 절반" },
  fragOreShell: { id: "fragOreShell", name: "광석 껍질", kind: "passive", desc: "낙반·광차 피해 −3" },
  fragEmber: { id: "fragEmber", name: "불씨", kind: "passive", desc: "명중하면 10% 확률로 적이 불탄다(2라운드)" },
  fragTremor: { id: "fragTremor", name: "땅울림", kind: "passive", desc: "낙반 함정을 항상 알아챈다" },
  fragColdBlood: { id: "fragColdBlood", name: "찬 피", kind: "passive", desc: "냉기가 쌓이는 속도 절반" },
  fragRegen: { id: "fragRegen", name: "재생", kind: "passive", desc: "전투 라운드마다 HP +1" },
  fragMimic: {
    id: "fragMimic", name: "의태", kind: "active", desc: "전투 시작 시 첫 공격 피해 ×2",
    trigger: { on: "start" }, effect: { type: "strike", hit: 2, dmg: 0, dmgMult: 2 }, uses: 1,
  },
  fragTwoBloods: { id: "fragTwoBloods", name: "두 개의 피", kind: "passive", desc: "화상·동상 부위가 결손까지 가지 않는다(중상에서 멈춤)" },
} satisfies Record<string, SkillDef>);

// 편린 능력(5섹터). 벼랑·추락·허기·절망은 rift.ts·combat.ts가 id로 처리
Object.assign(SKILLS, {
  fragEcho: { id: "fragEcho", name: "반향", kind: "passive", desc: "어둠(들숨) 엿보기 페널티 없음" },
  fragWrap: {
    id: "fragWrap", name: "휘감기", kind: "active", desc: "전투 시작 시 가장 강한 적이 1라운드 행동 불가",
    trigger: { on: "start" }, effect: { type: "stunOne", rounds: 1, text: "그림자가 뻗어 나가 휘감는다 —" }, uses: 1,
  },
  fragEndureHunger: { id: "fragEndureHunger", name: "허기 견디기", kind: "passive", desc: "포만감 소모 −20%", passive: { hunger: 0.8 } },
  fragSpiderFeet: { id: "fragSpiderFeet", name: "거미 발", kind: "passive", desc: "벼랑길 판정 +3" },
  fragFaceVoid: { id: "fragFaceVoid", name: "마주 보기", kind: "passive", desc: "절망에 걸릴 확률 절반" },
  fragRockTooth: { id: "fragRockTooth", name: "바위 이빨", kind: "passive", desc: "단단한 적을 쳐도 자기 손을 다치지 않는다" },
  fragFallen: { id: "fragFallen", name: "떨어진 것들", kind: "passive", desc: "추락 피해 절반" },
  fragDevour: { id: "fragDevour", name: "삼키는 입", kind: "passive", desc: "적을 쓰러뜨리면 포만감 +5" },
  fragEndlessHunger: { id: "fragEndlessHunger", name: "끝없는 허기", kind: "passive", desc: "HP 50% 이하일 때 피해 +3(굶주리면 +5)" },
} satisfies Record<string, SkillDef>);

// 편린 능력(6섹터). 정화·성광·삼킴은 temple.ts·combat.ts가 id로 처리
Object.assign(SKILLS, {
  fragSmoke: { id: "fragSmoke", name: "연기 장막", kind: "passive", desc: "정신 상태이상에 걸릴 확률 −25%" },
  fragChain: {
    id: "fragChain", name: "묶기", kind: "active", desc: "전투 시작 시 가장 강한 적이 1라운드 행동 불가",
    trigger: { on: "start" }, effect: { type: "stunOne", rounds: 1, text: "참회의 사슬이 뻗어 나가 감는다 —" }, uses: 1,
  },
  fragHollow: { id: "fragHollow", name: "빈 껍데기", kind: "passive", desc: "맞았을 때 몸통을 다칠 확률 절반" },
  fragMelt: { id: "fragMelt", name: "녹아내림", kind: "passive", desc: "쓰러질 피해를 받으면 10% 확률로 HP 1로 버틴다" },
  fragFlip: { id: "fragFlip", name: "성물 뒤집기", kind: "passive", desc: "정화를 받으면 깎인 신앙심의 절반을 되찾는다" },
  fragExecute: {
    id: "fragExecute", name: "처형", kind: "active", desc: "HP 20% 이하인 적에게 반드시 맞는 피해 2배 일격(전투당 2회)",
    trigger: { on: "targetBelow", pct: 20 }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 2, autoHit: true }, uses: 2,
  },
  fragManyEyes: { id: "fragManyEyes", name: "많은 눈", kind: "passive", desc: "앞방 엿보기가 반드시 성공한다" },
  fragNameBack: { id: "fragNameBack", name: "돌려받은 이름", kind: "passive", desc: "섬기는 신의 신앙심 상한 +10" },
  fragSermon: {
    id: "fragSermon", name: "빈 설교", kind: "active", desc: "전투 시작 시 적 전원 명중 −2(2라운드)",
    trigger: { on: "start" }, effect: { type: "fog", hit: 2, rounds: 2, text: "속이 빈 설교가 울려 퍼진다" }, uses: 1,
  },
  fragTrial: { id: "fragTrial", name: "돌의 시험", kind: "passive", desc: "모든 능력치 판정 +2", passive: { check: 2 } },
  fragSwallowLight: { id: "fragSwallowLight", name: "빛 삼키기", kind: "passive", desc: "정화·성광이 통하지 않는다" },
} satisfies Record<string, SkillDef>);

// "돌려받은 이름": 신앙심 상한 +10
pietyCapBonus.push((s) => (fragSkills(s).includes("fragNameBack") ? 10 : 0));

// "연기 장막": 정신 상태이상 확률 −25%
mindResist.push((s) => (fragSkills(s).includes("fragSmoke") ? 0.75 : 1));

// "마주 보기": 절망 확률 절반
mindResist.push((s, k) => (k === "despair" && fragSkills(s).includes("fragFaceVoid") ? 0.5 : 1));

// 마법사 원소 기술(elements.ts의 레벨표). 효과 처리는 combat.ts
const E = (el: ElementKey, defs: Record<string, Omit<SkillDef, "el">>) => Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, { ...v, el }]));
Object.assign(SKILLS, E("fire", {
  fireEmber: { id: "fireEmber", name: "불씨", kind: "passive", desc: "마력탄이 맞으면 20% 확률로 적이 불탄다(2라운드, 라운드마다 1d3)" },
  fireArrow: { id: "fireArrow", name: "불화살", kind: "active", desc: "전투 시작 시 가장 약한 적에게 반드시 맞는 불화살(1d6 + 지능 보정)", trigger: { on: "start" }, effect: { type: "espell", el: "fire", dice: [1, 6], text: "손끝에서 불화살이 날아간다" }, uses: 1 },
  fireMark: { id: "fireMark", name: "불의 각인", kind: "passive", desc: "최대 HP +4, 마력탄 피해 +3, 화염 피해 +3, 화염 주문에 맞은 적이 불탄다(3라운드, 1d3 + 힘 보정), 마력탄이 30% 확률로 적을 불태운다, 화염 액티브 전투당 +1회", passive: { hp: 4 } },
  fireBlast: { id: "fireBlast", name: "불꽃 폭발", kind: "active", desc: "적이 3마리 이상이면 모든 적에게 불꽃(1d4 + 지능 보정)", trigger: { on: "enemiesAtLeast", n: 3 }, effect: { type: "espell", el: "fire", dice: [1, 4], all: true, text: "불꽃이 사방으로 터져 나간다" }, uses: 1 },
  fireHeat: { id: "fireHeat", name: "열기", kind: "passive", desc: "모든 주문 피해 +1, 힘 보정의 절반이 더해진다" },
  fireSea: { id: "fireSea", name: "불바다", kind: "active", desc: "전투 시작 시 적 전원을 불태운다(3라운드)", trigger: { on: "start" }, effect: { type: "burnAll", rounds: 3, text: "발밑이 불바다가 된다" }, uses: 1 },
  fireWill: { id: "fireWill", name: "타오르는 의지", kind: "passive", desc: "내 HP 30% 이하면 화염 피해 +3" },
  fireBlaze: { id: "fireBlaze", name: "폭염", kind: "active", desc: "전투 시작 시 가장 강한 적에게 반드시 맞는 화염구(2d6 + 지능 보정)", trigger: { on: "start" }, effect: { type: "espell", el: "fire", dice: [2, 6], pick: "strongest", text: "화염구가 쏟아진다" }, uses: 1 },
}), E("frost", {
  frostCalm: { id: "frostCalm", name: "냉정", kind: "passive", desc: "명중 +1, AC +1, 감각 판정 +2(앞방 엿보기·함정 발견)", passive: { hit: 1, ac: 1, perception: 2 } },
  frostArrow: { id: "frostArrow", name: "얼음 화살", kind: "active", desc: "전투 시작 시 가장 강한 적에게 얼음 화살(1d6 + 지능 보정), 60% 확률로 1라운드 얼린다", trigger: { on: "start" }, effect: { type: "espell", el: "frost", dice: [1, 6], pick: "strongest", freeze: 0.6, text: "얼음 화살이 날아간다" }, uses: 1 },
  frostMark: { id: "frostMark", name: "서리의 각인", kind: "passive", desc: "최대 HP +4, 마력탄 피해 +2, 서리 피해 +3, 얼거나 묶인 적은 모든 주문·마력탄 피해 +3(깨뜨리기), 모든 얼림 확률 +25%p(감각 보정 ×3%p 추가), 마력탄이 25% 확률로 적을 얼린다, 서리 액티브 전투당 +1회", passive: { hp: 4 } },
  frostArmor: { id: "frostArmor", name: "얼음 갑옷", kind: "active", desc: "내 HP 50% 이하면 2라운드 AC +4, 나를 때린 적을 30% 확률로 얼린다", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 4, rounds: 2, freeze: 0.3, text: "몸을 얼음으로 감싼다" }, uses: 1 },
  frostTouch: { id: "frostTouch", name: "서리 손끝", kind: "passive", desc: "마력탄이 맞으면 25% 확률로 1라운드 얼린다" },
  frostPrison: { id: "frostPrison", name: "얼음 감옥", kind: "active", desc: "전투 시작 시 가장 강한 적을 3라운드 얼음에 가둔다", trigger: { on: "start" }, effect: { type: "bind", rounds: 3, text: "얼음 기둥이 솟아 적을 가둔다" }, uses: 1 },
  frostEye: { id: "frostEye", name: "차가운 눈", kind: "passive", desc: "움직이지 못하는 적에게 명중 +3, 치명타 확률 +15%" },
  frostStorm: { id: "frostStorm", name: "서리 폭풍", kind: "active", desc: "적이 2마리 이상이면 모든 적에게 서리(1d8 + 지능 보정), 각자 25% 확률로 얼린다", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "espell", el: "frost", dice: [1, 8], all: true, freeze: 0.25, text: "서리 폭풍이 몰아친다" }, uses: 1 },
}), E("bolt", {
  boltStep: { id: "boltStep", name: "섬광 걸음", kind: "passive", desc: "AC +1, 도주 판정 +3", passive: { ac: 1, flee: 3 } },
  boltArrow: { id: "boltArrow", name: "번개 화살", kind: "active", desc: "전투 시작 시 번개 화살(1d6 + 지능 보정), 다른 적 하나에게 반 피해로 튄다", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [1, 6], bounce: true, text: "번개가 손끝에서 튄다" }, uses: 1 },
  boltMark: { id: "boltMark", name: "번개의 각인", kind: "passive", desc: "최대 HP +4, 마력탄 피해 +2, 번개 피해 +2, 번개가 한 번 더 튄다(민첩 보정 ×10% 확률로 또 한 번), 마력탄이 맞으면 다른 적에게 반 피해로 튄다, 날아다니는 적에게 마력탄 명중 +2, 번개 액티브 전투당 +1회", passive: { hp: 4 } },
  boltChain: { id: "boltChain", name: "연쇄 번개", kind: "active", desc: "적이 3마리 이상이면 모든 적에게 번개(1d4~1d10 출렁임 + 지능 보정)", trigger: { on: "enemiesAtLeast", n: 3 }, effect: { type: "espell", el: "bolt", dice: [1, 6], all: true, vary: true, text: "번개가 적들 사이를 줄줄이 뛰어다닌다" }, uses: 1 },
  boltStatic: { id: "boltStatic", name: "정전기", kind: "passive", desc: "나를 때린 적이 25% 확률로 감전돼 다음 라운드 명중 −2" },
  boltStrike: { id: "boltStrike", name: "뇌격", kind: "active", desc: "전투 시작 시 가장 강한 적에게 벼락(2d6 + 지능 보정), 2라운드 동안 50% 확률로 행동 실패", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [2, 6], pick: "strongest", shock: 2, text: "하늘을 가르는 벼락이 떨어진다" }, uses: 1 },
  boltLuck: { id: "boltLuck", name: "번개 같은 손", kind: "passive", desc: "민첩 보정 ×10% 확률로 주문·마력탄 피해 주사위를 두 번 굴려 높은 쪽을 쓴다" },
  boltOvercharge: { id: "boltOvercharge", name: "과충전", kind: "active", desc: "전투 시작 시 번개 화살을 두 번 쏜다(1d6 + 지능 보정, 튐)", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [1, 6], bounce: true, casts: 2, text: "넘치는 번개를 연달아 쏟아낸다" }, uses: 1 },
}), E("earth", {
  earthSkin: { id: "earthSkin", name: "돌 피부", kind: "passive", desc: "AC +1, 최대 HP +3", passive: { ac: 1, hp: 3 } },
  earthSling: { id: "earthSling", name: "돌팔매", kind: "active", desc: "전투 시작 시 단단한 적을 먼저 노려 돌을 날린다(1d6 + 지능 보정, 단단하면 +3)", trigger: { on: "start" }, effect: { type: "espell", el: "earth", dice: [1, 6], pick: "hard", hardBonus: 3, text: "바닥의 돌이 떠올라 날아간다" }, uses: 1 },
  earthMark: { id: "earthMark", name: "대지의 각인", kind: "passive", desc: "최대 HP +8, 대지 패시브 효과 2배, 마력탄 피해 +2, 단단한 적에게 대지 주문·마력탄 피해 +3 더, 대지 액티브 전투당 +1회", passive: { hp: 8 } },
  earthWall: { id: "earthWall", name: "바위 방벽", kind: "active", desc: "내 HP 50% 이하면 2라운드 AC +3, 받는 피해 −1", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 3, rounds: 2, reduce: 1, text: "바위 벽이 솟아오른다" }, uses: 1 },
  earthLevel: { id: "earthLevel", name: "땅 고르기", kind: "passive", desc: "꺼진 바닥을 피하는 판정 +5, 함정 해체 +3" },
  earthPrison: { id: "earthPrison", name: "바위 감옥", kind: "active", desc: "전투 시작 시 가장 강한 적을 2라운드 묶고, 첫 라운드 받는 피해 절반", trigger: { on: "start" }, effect: { type: "bind", rounds: 2, half: true, text: "바위가 솟아 적을 붙잡는다" }, uses: 1 },
  earthRoot: { id: "earthRoot", name: "뿌리 내리기", kind: "passive", desc: "최대 HP +5, 발 부상 이동 페널티 절반", passive: { hp: 5 } },
  earthQuake: { id: "earthQuake", name: "땅 울림", kind: "active", desc: "적이 2마리 이상이면 모든 적에게 땅 울림(1d4 + 지능 보정), 30% 확률로 1라운드 넘어뜨린다", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "espell", el: "earth", dice: [1, 4], all: true, knock: 0.3, text: "땅이 크게 울린다" }, uses: 1 },
}));

// 전사 방향 기술(elements.ts의 STYLE_SKILLS). 질긴 몸·방패 밀치기·강철 몸·이 악물기·마무리 일격은 위의 기존 기술을 쓴다
Object.assign(SKILLS, {
  // 수호(힘·체력)
  guardMark: { id: "guardMark", name: "수호의 각인", kind: "passive", desc: "AC +2, 최대 HP +8, 받는 피해 −2(최소 1), 맞았을 때 부상 확률 절반, 수호 액티브 전투당 +1회", passive: { ac: 2, hp: 8 } },
  holdFast: { id: "holdFast", name: "굳건히 버티기", kind: "active", desc: "내 HP 50% 이하면 2라운드 AC +4", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "guard", ac: 4, rounds: 2 }, uses: 1 },
  shieldCraft: { id: "shieldCraft", name: "방패술", kind: "passive", shield: true, desc: "🛡 방패 필요. AC +1, 왼손 부상 확률 절반", passive: { ac: 1 } },
  shieldCounter: { id: "shieldCounter", name: "방패 반격", kind: "active", shield: true, desc: "🛡 방패 필요. 적의 공격이 빗나가면 30% 확률로 반격(전투당 3회)", trigger: { on: "react" }, uses: 3 },
  // 검투(힘·민첩)
  sharpEdge: { id: "sharpEdge", name: "날카로운 검끝", kind: "passive", desc: "명중 +1, 치명타 확률 +3%", passive: { hit: 1, crit: 3 } },
  riposte: { id: "riposte", name: "맞받아치기", kind: "active", desc: "치명타를 맞으면 즉시 반격(피해 +2, 전투당 2회)", trigger: { on: "react" }, uses: 2 },
  gladMark: { id: "gladMark", name: "검투의 각인", kind: "passive", desc: "최대 HP +4, 명중 +2, 피해 +3, 치명타 확률 +10%, 검투 액티브 전투당 +1회", passive: { hp: 4, hit: 2, dmg: 3, crit: 10 } },
  parryCounter: { id: "parryCounter", name: "흘려내기", kind: "active", desc: "내 HP 50% 이하면 2라운드 AC +3, 그동안 빗나간 공격마다 반격", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 3, rounds: 2, counter: true, text: "칼끝으로 공격을 흘려낸다" }, uses: 1 },
  lightStep: { id: "lightStep", name: "가벼운 발", kind: "passive", desc: "AC +1, 도주 판정 +3", passive: { ac: 1, flee: 3 } },
  chainSlash: { id: "chainSlash", name: "연속 베기", kind: "active", desc: "적을 쓰러뜨리면 같은 라운드에 다른 적을 한 번 더 공격(전투당 3회)", trigger: { on: "react" }, uses: 3 },
  readGap: { id: "readGap", name: "빈틈 읽기", kind: "passive", desc: "전투 시작 시 가장 단단한 적의 AC −2" },
  // 광전(힘·힘)
  roughPower: { id: "roughPower", name: "거친 힘", kind: "passive", desc: "피해 +1", passive: { dmg: 1 } },
  wideSweep: { id: "wideSweep", name: "휩쓸기", kind: "active", desc: "적이 2마리 이상이면 모든 적을 한 번에 벤다(피해 ×0.7)", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "sweep", dmgMult: 0.7 }, uses: 1 },
  berserkMark: { id: "berserkMark", name: "광전의 각인", kind: "passive", desc: "최대 HP +4, 피해 +5, 내 HP 50% 이하면 피해 +3 더, 분노에 걸리면 AC −1 대신 피해 +2. 대가: AC −1, 도주 −4. 광전 액티브 전투당 +1회", passive: { hp: 4, dmg: 5, ac: -1, flee: -4 } },
  charge: { id: "charge", name: "돌격", kind: "active", desc: "전투 시작 시 첫 공격이 반드시 맞고 피해 ×1.5", trigger: { on: "start" }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 1.5, autoHit: true }, uses: 1 },
  bloodThirst: { id: "bloodThirst", name: "피의 갈증", kind: "passive", desc: "적을 쓰러뜨릴 때마다 HP +3" },
  frenzy: { id: "frenzy", name: "광란", kind: "active", desc: "내 HP 75% 이하가 되면 3라운드 동안 라운드마다 한 번 더 공격", trigger: { on: "selfBelow", pct: 75 }, effect: { type: "rampage", rounds: 3, text: "피를 보자 눈이 뒤집힌다" }, uses: 1 },
  painless: { id: "painless", name: "고통 무시", kind: "passive", desc: "부상의 명중·판정 페널티 절반, 공포에 걸리지 않는다" },
  smash: { id: "smash", name: "분쇄 일격", kind: "active", desc: "전투당 1회, 반드시 맞는 일격(피해 ×2), 1라운드 넘어뜨린다", trigger: { on: "targetBelow", pct: 100 }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 2, autoHit: true, stun: 1 }, uses: 1 },
} satisfies Record<string, SkillDef>);
// 모험가 갈래 기술(elements.ts의 BRANCH_SKILLS). 휩쓸기·흘려내기·질긴 몸·마무리 일격·마력 화살·불꽃 폭발·
// 응급 처치 지식·얼음 감옥·연쇄 번개·가벼운 발은 위의 기존 기술을 쓴다
Object.assign(SKILLS, {
  swordHand: { id: "swordHand", name: "검 다루기", kind: "passive", desc: "명중 +1, 피해 +1", passive: { hit: 1, dmg: 1 } },
  fighterMark: { id: "fighterMark", name: "칼잡이의 각인", kind: "passive", desc: "최대 HP +6, 명중 +2, 피해 +3, 전사형 액티브 전투당 +1회", passive: { hp: 6, hit: 2, dmg: 3 } },
  doubleSlash: { id: "doubleSlash", name: "이중 베기", kind: "active", desc: "전투당 1회, 첫 라운드에 두 번 공격", trigger: { on: "start" }, effect: { type: "rampage", rounds: 1, text: "칼을 두 번 연달아 휘두른다" }, uses: 1 },
  toughMuscle: { id: "toughMuscle", name: "강인함", kind: "passive", desc: "최대 HP +4, 피해 +1", passive: { hp: 4, dmg: 1 } },
  manaSense: { id: "manaSense", name: "마력 감응", kind: "passive", desc: "주문 피해 +1, 감각 판정 +2", passive: { perception: 2 } },
  casterMark: { id: "casterMark", name: "주문꾼의 각인", kind: "passive", desc: "최대 HP +5, 주문 피해 +3, 지팡이 마력탄 피해 +2, 마법사형 액티브 전투당 +1회", passive: { hp: 5 } },
  keenSense: { id: "keenSense", name: "예리한 감각", kind: "passive", desc: "명중 +1, 치명타 확률 +3%, 함정 발견 +2", passive: { hit: 1, crit: 3, perception: 2 } },
  pickpocket: { id: "pickpocket", name: "손버릇", kind: "active", desc: "전투 시작 시 가장 약한 적에게 반드시 맞는 찌르기(1d6 + 힘·민첩 중 높은 보정), 그 적을 쓰러뜨리면 마석 ×1.5", trigger: { on: "start" }, effect: { type: "steal", dice: [1, 6], text: "슬쩍 다가가 찌른다" }, uses: 1 },
  shadowMark: { id: "shadowMark", name: "그림자의 각인", kind: "passive", desc: "최대 HP +5, AC +2, 치명타 확률 +10%, 민첩형 액티브 전투당 +1회", passive: { hp: 5, ac: 2, crit: 10 } },
  shadowStep: { id: "shadowStep", name: "그림자 걸음", kind: "active", desc: "전투 시작 시 첫 공격이 반드시 맞고 피해 ×1.5", trigger: { on: "start" }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 1.5, autoHit: true }, uses: 1 },
  trapHand: { id: "trapHand", name: "함정 감각", kind: "passive", desc: "함정 발견·앞방 엿보기 +3, 함정 해체 +3", passive: { perception: 3 } },
  smoke: { id: "smoke", name: "연막", kind: "active", desc: "전투 시작 시 적 전원 1라운드 행동 불가, 그 전투 도주 +5", trigger: { on: "start" }, effect: { type: "smoke", rounds: 1, flee: 5, text: "연기 속으로 몸을 감춘다" }, uses: 1 },
  luckyStrike: { id: "luckyStrike", name: "행운의 일격", kind: "passive", desc: "치명타 피해 주사위 ×3(원래 ×2)" },
  vitalStab: { id: "vitalStab", name: "급소 찌르기", kind: "active", desc: "HP 50% 이하인 적에게 반드시 맞는 치명타(전투당 1회)", trigger: { on: "targetBelow", pct: 50 }, effect: { type: "strike", hit: 0, dmg: 0, autoHit: true, crit: true }, uses: 1 },
} satisfies Record<string, SkillDef>);


// ── 10~16레벨(2026-10-14, docs/SKILLS_10_16_DRAFT.md): 10 낙인 · 13 궁극기 · 16 화신. 효과 처리는 combat.ts(id로) ──
Object.assign(SKILLS, E("fire", {
  fireSeal: { id: "fireSeal", name: "불의 낙인", kind: "passive", desc: "최대 HP +6, 화염 피해 +3, 불탐 피해 1d3 → 1d6, 화염 액티브 전투당 +1회", passive: { hp: 6 } },
  fireLance: { id: "fireLance", name: "화염 창", kind: "active", desc: "전투 시작 시 가장 강한 적에게 화염 창(3d6 + 지능 보정)", trigger: { on: "start" }, effect: { type: "espell", el: "fire", dice: [3, 6], pick: "strongest", text: "불꽃이 창처럼 뻗어 나간다" }, uses: 1 },
  fireBody: { id: "fireBody", name: "불 먹은 몸", kind: "passive", desc: "최대 HP +4, 화상에 걸릴 확률 절반(4섹터)", passive: { hp: 4 } },
  fireMeteor: { id: "fireMeteor", name: "유성", kind: "active", desc: "궁극기. 전투 시작 시 적 전원에게 유성(2d6 + 지능 보정), 모두 3라운드 불탄다", trigger: { on: "start" }, effect: { type: "espell", el: "fire", dice: [2, 6], all: true, burnRounds: 3, text: "하늘이 갈라지며 유성이 쏟아진다" }, uses: 1 },
  fireBlood: { id: "fireBlood", name: "타오르는 피", kind: "passive", desc: "내 HP 50% 이하면 모든 주문 피해 +4" },
  firePhoenix: { id: "firePhoenix", name: "불사조의 숨", kind: "active", desc: "쓰러질 피해를 받으면 최대 HP 30%로 일어나며 적 전원에게 2d6 화염(미궁마다 1회)", trigger: { on: "lethal" }, effect: { type: "phoenix", pct: 30, dice: [2, 6], text: "재 속에서 불길이 다시 솟는다" }, uses: 1 },
  fireAvatar: { id: "fireAvatar", name: "불의 화신", kind: "passive", desc: "최대 HP +10, 모든 주문·마력탄 피해 +4, 불탐 피해 2배", passive: { hp: 10 } },
}), E("frost", {
  frostSeal: { id: "frostSeal", name: "서리의 낙인", kind: "passive", desc: "최대 HP +6, 얼림 확률 +15%p, 얼거나 묶인 적이 받는 피해 +3 더, 서리 액티브 전투당 +1회", passive: { hp: 6 } },
  frostLance: { id: "frostLance", name: "빙결 창", kind: "active", desc: "전투 시작 시 가장 강한 적에게 빙결 창(2d8 + 지능 보정), 2라운드 얼린다", trigger: { on: "start" }, effect: { type: "espell", el: "frost", dice: [2, 8], pick: "strongest", freeze: 1, freezeRounds: 2, text: "얼음 창이 꽂힌다" }, uses: 1 },
  frostBlood: { id: "frostBlood", name: "서리 피", kind: "passive", desc: "AC +1, 냉기가 쌓이는 속도 절반(4섹터)", passive: { ac: 1 } },
  frostZero: { id: "frostZero", name: "절대 영도", kind: "active", desc: "궁극기. 전투 시작 시 적 전원을 2라운드 얼린다(보스·정예는 1라운드), 첫 라운드 받는 피해 절반", trigger: { on: "start" }, effect: { type: "zero", rounds: 2, bossRounds: 1, half: true, text: "공기마저 얼어붙는다" }, uses: 1 },
  frostCool: { id: "frostCool", name: "냉철", kind: "passive", desc: "명중 +2, 치명타 확률 +5%", passive: { hit: 2, crit: 5 } },
  frostWard: { id: "frostWard", name: "서리 방벽", kind: "active", desc: "내 HP 50% 이하가 되면 적 전원 1라운드 얼림 + 2라운드 AC +4", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 4, rounds: 2, stunAll: 1, text: "서리 벽이 사방으로 터진다" }, uses: 1 },
  frostAvatar: { id: "frostAvatar", name: "겨울의 화신", kind: "passive", desc: "최대 HP +10, 모든 공격·주문이 25% 확률로 얼린다, 얼어 있는 적을 쓰러뜨리면 다른 적 하나를 얼린다", passive: { hp: 10 } },
}), E("bolt", {
  boltSeal: { id: "boltSeal", name: "번개의 낙인", kind: "passive", desc: "최대 HP +6, 번개 피해 +2, 번개가 한 번 더 튄다, 번개 주문이 20% 확률로 감전, 번개 액티브 전투당 +1회", passive: { hp: 6 } },
  boltThunder: { id: "boltThunder", name: "천둥", kind: "active", desc: "적이 2마리 이상이면 모든 적에게 천둥(2d4 + 지능 보정), 각자 30% 감전", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "espell", el: "bolt", dice: [2, 4], all: true, shockChance: 0.3, text: "천둥이 동굴을 울린다" }, uses: 1 },
  boltSense: { id: "boltSense", name: "전류 감각", kind: "passive", desc: "도주 +4, 함정 회피 판정 +3", passive: { flee: 4 } },
  boltFall: { id: "boltFall", name: "낙뢰", kind: "active", desc: "궁극기. 전투 시작 시 가장 강한 적에게 낙뢰(4d6 + 지능 보정), 나머지 적 전원 반 피해", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [4, 6], pick: "strongest", splashAll: true, text: "하늘에서 낙뢰가 꽂힌다" }, uses: 1 },
  boltReflect: { id: "boltReflect", name: "번개 반사", kind: "passive", desc: "나를 때린 적이 25% 확률로 1d6 번개 피해" },
  boltStorm: { id: "boltStorm", name: "폭풍 걸음", kind: "active", desc: "내 HP 50% 이하가 되면 2라운드 동안 한 번 더 행동, AC +3", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "rampage", rounds: 2, ac: 3, text: "번개처럼 몸이 빨라진다" }, uses: 1 },
  boltAvatar: { id: "boltAvatar", name: "뇌신", kind: "passive", desc: "최대 HP +10, 매 라운드 시작 시 무작위 적 하나에게 번개(1d8 + 지능 보정)", passive: { hp: 10 } },
}), E("earth", {
  earthSeal: { id: "earthSeal", name: "대지의 낙인", kind: "passive", desc: "최대 HP +12, 받는 피해 −1, 대지 액티브 전투당 +1회", passive: { hp: 12 } },
  earthLance: { id: "earthLance", name: "지각 창", kind: "active", desc: "전투 시작 시 단단한 적을 먼저 노려 바위 창(3d6 + 지능 보정), 50% 넘어뜨린다", trigger: { on: "start" }, effect: { type: "espell", el: "earth", dice: [3, 6], pick: "hard", knock: 0.5, text: "바닥에서 바위 창이 솟구친다" }, uses: 1 },
  earthBone: { id: "earthBone", name: "산의 뼈", kind: "passive", desc: "맞았을 때 부상 확률 절반, 낙반 피해 절반(4섹터)" },
  earthWrath: { id: "earthWrath", name: "대지의 분노", kind: "active", desc: "궁극기. 전투 시작 시 적 전원에게 대지의 분노(2d6 + 지능 보정), 50% 넘어뜨린다", trigger: { on: "start" }, effect: { type: "espell", el: "earth", dice: [2, 6], all: true, knock: 0.5, text: "땅이 갈라지며 솟구친다" }, uses: 1 },
  earthHeart: { id: "earthHeart", name: "바위 심장", kind: "passive", desc: "전투 라운드마다 HP +2" },
  earthSlide: { id: "earthSlide", name: "산사태 방벽", kind: "active", desc: "내 HP 50% 이하가 되면 3라운드 AC +5, 받는 피해 −3", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 5, rounds: 3, reduce: 3, text: "무너진 바위가 벽을 이룬다" }, uses: 1 },
  earthAvatar: { id: "earthAvatar", name: "대지의 화신", kind: "passive", desc: "최대 HP +20, AC +2, 받는 피해 −2", passive: { hp: 20, ac: 2 } },
}));

Object.assign(SKILLS, {
  // 수호
  guardSeal: { id: "guardSeal", name: "수호의 낙인", kind: "passive", desc: "최대 HP +10, AC +1, 받는 피해 −2 더(각인과 합쳐 −4), 수호 액티브 전투당 +1회", passive: { hp: 10, ac: 1 } },
  shieldCharge: { id: "shieldCharge", name: "방패 돌진", kind: "active", shield: true, desc: "🛡 방패 필요. 전투 시작 시 가장 강한 적에게 1d8 피해 + 2라운드 행동 불가", trigger: { on: "start" }, effect: { type: "stunOne", rounds: 2, dice: [1, 8], text: "방패를 앞세워 돌진한다 —" }, uses: 1 },
  unshaken: { id: "unshaken", name: "흔들리지 않는 자", kind: "passive", desc: "맞았을 때 부상 확률 절반(각인과 곱한다), 낙반 피해 절반(4섹터)" },
  rampart: { id: "rampart", name: "성벽", kind: "active", shield: true, desc: "궁극기. 🛡 방패 필요. 전투 시작 시 3라운드 동안 받는 피해 절반", trigger: { on: "start" }, effect: { type: "rampart", rounds: 3, text: "방패가 성벽처럼 버틴다" }, uses: 1 },
  steelWill: { id: "steelWill", name: "강철 의지", kind: "passive", desc: "최대 HP +8, 모든 판정 +1", passive: { hp: 8, check: 1 } },
  lastGuard: { id: "lastGuard", name: "최후의 방어", kind: "active", desc: "이 악물기를 미궁마다 한 번 더 쓴다(없으면 1회), 버틴 뒤 3라운드 AC +5", trigger: { on: "react" }, uses: 1 },
  guardAvatar: { id: "guardAvatar", name: "불굴", kind: "passive", desc: "최대 HP +15, 내 HP 25% 이하면 받는 피해 절반", passive: { hp: 15 } },
  // 검투
  gladSeal: { id: "gladSeal", name: "검투의 낙인", kind: "passive", desc: "최대 HP +6, 치명타 확률 +10%, 치명타 피해 주사위 ×3, 검투 액티브 전투당 +1회", passive: { hp: 6, crit: 10 } },
  swordDance: { id: "swordDance", name: "검무", kind: "active", desc: "전투 시작 시 적 전원을 한 번씩 벤다", trigger: { on: "start" }, effect: { type: "sweep", dmgMult: 1 }, uses: 1 },
  arenaSense: { id: "arenaSense", name: "투기장의 감", kind: "passive", desc: "명중 +2, AC +1, 함정 회피 판정 +3", passive: { hit: 2, ac: 1 } },
  oneFlash: { id: "oneFlash", name: "일섬", kind: "active", desc: "궁극기. 전투 시작 시 가장 강한 적에게 확정 치명타, 피해 ×2", trigger: { on: "start" }, effect: { type: "strikeStrong", mult: 2, crit: true, text: "한 줄기 빛처럼 벤다" }, uses: 1 },
  flowWater: { id: "flowWater", name: "물 흐르듯", kind: "passive", desc: "적의 공격이 빗나가면 20% 확률로 반격(횟수 제한 없음)" },
  deathDance: { id: "deathDance", name: "죽음의 춤", kind: "active", desc: "내 HP 50% 이하가 되면 3라운드 동안 한 번 더 공격, AC +2", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "rampage", rounds: 3, ac: 2, text: "칼끝이 춤추기 시작한다" }, uses: 1 },
  gladAvatar: { id: "gladAvatar", name: "검성", kind: "passive", desc: "매 라운드 첫 공격이 반드시 맞는다, 치명타 확률 +10%, 피해 +4", passive: { crit: 10, dmg: 4 } },
  // 광전
  berserkSeal: { id: "berserkSeal", name: "광전의 낙인", kind: "passive", desc: "최대 HP +8, 피해 +5, 내 HP 50% 이하면 피해 +5 더, 광전 액티브 전투당 +1회. 대가: AC −1", passive: { hp: 8, dmg: 5, ac: -1 } },
  greatCleave: { id: "greatCleave", name: "대참격", kind: "active", desc: "적이 2마리 이상이면 모든 적을 온 힘으로 벤다(피해 ×1.0)", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "sweep", dmgMult: 1 }, uses: 1 },
  burningBlood: { id: "burningBlood", name: "불타는 피", kind: "passive", desc: "피해 +1, 화상·동상에 걸릴 확률 절반(4섹터)", passive: { dmg: 1 } },
  berserkFury: { id: "berserkFury", name: "광폭화", kind: "active", desc: "궁극기. 전투 시작 시 3라운드 동안 매 라운드 두 번 더 공격, 그동안 받는 피해 +2", trigger: { on: "start" }, effect: { type: "fury", rounds: 3, extra: 2, taken: 2, text: "이성이 끊어진다" }, uses: 1 },
  painPower: { id: "painPower", name: "고통이 힘", kind: "passive", desc: "맞을 때마다 그 전투 동안 피해 +1(최대 +5)" },
  doomStrike: { id: "doomStrike", name: "파멸의 일격", kind: "active", desc: "HP 30% 이하인 적에게 반드시 맞는 일격(피해 ×3, 전투당 1회)", trigger: { on: "targetBelow", pct: 30 }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 3, autoHit: true }, uses: 1 },
  berserkAvatar: { id: "berserkAvatar", name: "전쟁광", kind: "passive", desc: "매 라운드 한 번 더 공격. 대가: AC −2", passive: { ac: -2 } },
  // 모험가 전사형
  fighterSeal: { id: "fighterSeal", name: "칼잡이의 낙인", kind: "passive", desc: "최대 HP +8, 명중 +2, 피해 +3, 전사형 액티브 전투당 +1회", passive: { hp: 8, hit: 2, dmg: 3 } },
  spinSlash: { id: "spinSlash", name: "회전 베기", kind: "active", desc: "적이 2마리 이상이면 모든 적을 벤다(피해 ×0.8)", trigger: { on: "enemiesAtLeast", n: 2 }, effect: { type: "sweep", dmgMult: 0.8 }, uses: 1 },
  veteran: { id: "veteran", name: "노련함", kind: "passive", desc: "AC +1, 최대 HP +4, 맞았을 때 부상 확률 −25%", passive: { ac: 1, hp: 4 } },
  duel: { id: "duel", name: "결전", kind: "active", desc: "궁극기. 전투 시작 시 2라운드 동안 매 라운드 한 번 더 공격", trigger: { on: "start" }, effect: { type: "rampage", rounds: 2, text: "숨을 고르고 결전에 나선다" }, uses: 1 },
  battleSense: { id: "battleSense", name: "전장 감각", kind: "passive", desc: "명중 +1, 치명타 확률 +5%", passive: { hit: 1, crit: 5 } },
  counterStance: { id: "counterStance", name: "반격 자세", kind: "active", desc: "내 HP 50% 이하가 되면 2라운드 AC +3, 그동안 빗나간 공격마다 반격", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "eguard", ac: 3, rounds: 2, counter: true, text: "칼을 낮추고 받아칠 자세를 잡는다" }, uses: 1 },
  // 모험가 마법사형
  casterSeal: { id: "casterSeal", name: "주문꾼의 낙인", kind: "passive", desc: "최대 HP +6, 주문 피해 +3, 마법사형 액티브 전투당 +1회", passive: { hp: 6 } },
  elemArrow: { id: "elemArrow", name: "원소 화살", kind: "active", desc: "전투 시작 시 가장 강한 적에게 원소 화살(2d6 + 지능 보정), 무작위로 불탐·얼림·감전", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [2, 6], pick: "strongest", rider: true, text: "손끝에서 원소가 뒤섞여 날아간다" }, uses: 1 },
  scholar: { id: "scholar", name: "박식", kind: "passive", desc: "물약 회복 +3, 해독초가 두 단계씩 듣는다", passive: { potion: 3 } },
  elemStorm: { id: "elemStorm", name: "원소 폭풍", kind: "active", desc: "궁극기. 전투 시작 시 적 전원에게 원소 폭풍(2d4 + 지능 보정), 각자 무작위로 불탐·얼림·감전", trigger: { on: "start" }, effect: { type: "espell", el: "bolt", dice: [2, 4], all: true, rider: true, text: "불·얼음·번개가 한꺼번에 휘몰아친다" }, uses: 1 },
  manaShield: { id: "manaShield", name: "마력 방패", kind: "passive", desc: "AC +2", passive: { ac: 2 } },
  blink: { id: "blink", name: "순간 이동", kind: "active", desc: "내 HP 30% 이하가 되면 반드시 도주한다(전투당 1회)", trigger: { on: "selfBelow", pct: 30 }, effect: { type: "blink", text: "공간이 접히며 몸이 사라진다" }, uses: 1 },
  // 모험가 민첩형
  shadowSeal: { id: "shadowSeal", name: "그림자의 낙인", kind: "passive", desc: "최대 HP +6, AC +2, 치명타 확률 +10%, 민첩형 액티브 전투당 +1회", passive: { hp: 6, ac: 2, crit: 10 } },
  poisonBlade: { id: "poisonBlade", name: "독 바른 칼", kind: "active", desc: "전투 시작 시 가장 강한 적을 3라운드 중독시킨다(라운드마다 1d6)", trigger: { on: "start" }, effect: { type: "venom", rounds: 3, dice: [1, 6], text: "칼날에 독을 바른다" }, uses: 1 },
  trapMaster: { id: "trapMaster", name: "함정 장인", kind: "passive", desc: "함정 해체 +5, 함정에 받는 피해 절반" },
  assassinate: { id: "assassinate", name: "암살", kind: "active", desc: "궁극기. 전투 시작 시 가장 강한 적에게 확정 치명타, 피해 ×2", trigger: { on: "start" }, effect: { type: "strikeStrong", mult: 2, crit: true, text: "그림자 속에서 급소를 꿰뚫는다" }, uses: 1 },
  shadowBody: { id: "shadowBody", name: "그림자 몸", kind: "passive", desc: "도주 +5, 적의 명중 −1", passive: { flee: 5 } },
  vanish: { id: "vanish", name: "사라지기", kind: "active", desc: "내 HP 30% 이하가 되면 적 전원 2라운드 행동 불가", trigger: { on: "selfBelow", pct: 30 }, effect: { type: "stunAll", rounds: 2 }, uses: 1 },
} satisfies Record<string, SkillDef>);

// ── 로그(2026-10-19, docs/ROGUE.md): 암습 = 치명타 화력, 독술 = 지속 피해 + 서서히 약화, 쇠뇌 = 적당한 화력 + 즉시 제압.
// off가 붙은 기술은 그 왼손 무기(4레벨 각인이 준다)를 들고 있어야 효과가 있다. 효과 처리는 combat.ts "로그" 절.
Object.assign(SKILLS, {
  rgBackstab: { id: "rgBackstab", name: "뒤잡기", kind: "passive", desc: "로그 기본기. 전투의 첫 공격은 치명타 확률 +15%" },
  // 암습(민첩·행운): 치명타
  rgEye: { id: "rgEye", name: "그림자 눈", kind: "passive", desc: "명중 +1, 치명타 확률 +4%", passive: { hit: 1, crit: 4 } },
  rgThroat: { id: "rgThroat", name: "목 긋기", kind: "active", desc: "전투 시작 시 가장 약한 적에게 첫 공격이 반드시 명중, 피해 ×1.5", trigger: { on: "start" }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 1.5, autoHit: true }, uses: 1 },
  rgAssassinMark: { id: "rgAssassinMark", name: "암습의 각인", kind: "passive", desc: "왼손에 두 번째 단검(두 라운드에 한 번 왼손 찌르기). 최대 HP +4, 치명타 확률 +5%, 치명타 피해 +2, 암습 액티브 전투당 +1회", passive: { hp: 4, crit: 5 } },
  rgShade: { id: "rgShade", name: "그림자 숨기", kind: "active", desc: "내 HP 50% 이하가 되면 2라운드 동안 적 명중 −2", trigger: { on: "selfBelow", pct: 50 }, effect: { type: "fog", hit: 2, rounds: 2, text: "그림자 속으로 몸을 낮췄다" }, uses: 1 },
  rgDualHands: { id: "rgDualHands", name: "양손 놀림", kind: "passive", desc: "왼손 찌르기 피해 1d3 → 1d4", off: "dagger" },
  rgVital: { id: "rgVital", name: "급소 연타", kind: "active", desc: "치명타가 터지면 같은 적을 한 번 더 찌른다(전투당 1회)", trigger: { on: "react" }, uses: 1 },
  rgWeakSpot: { id: "rgWeakSpot", name: "약점 간파", kind: "passive", desc: "보스·정예에게 치명타 확률 +8%" },
  rgExecute: { id: "rgExecute", name: "처형", kind: "active", desc: "HP 20% 이하인 적에게 반드시 명중, 피해 ×2(보스·정예는 ×1.5)", trigger: { on: "targetBelow", pct: 20 }, effect: { type: "strike", hit: 0, dmg: 0, dmgMult: 1.5, autoHit: true, execute: true }, uses: 1 },
  rgAssassinSeal: { id: "rgAssassinSeal", name: "암습의 낙인", kind: "passive", desc: "치명타 확률 +5%, 첫 라운드 피해 +5, 암습 액티브 전투당 +1회. 왼손이 다른 무기면 두 번째 단검으로 바꾼다", passive: { crit: 5 } },
  rgBladeDance: { id: "rgBladeDance", name: "칼춤", kind: "active", desc: "전투 시작 시 1라운드 동안 한 번 더 공격", trigger: { on: "start" }, effect: { type: "rampage", rounds: 1, text: "두 자루가 번갈아 춤춘다" }, uses: 1 },
  rgDeathSense: { id: "rgDeathSense", name: "죽음의 감각", kind: "passive", desc: "치명타 피해 +3, 치명타를 낼 때마다 HP +1" },
  rgOneKill: { id: "rgOneKill", name: "일격필살", kind: "active", desc: "궁극기. 전투 시작 시 가장 강한 적에게 확정 치명타, 피해 ×3", trigger: { on: "start" }, effect: { type: "strikeStrong", mult: 3, crit: true, text: "숨을 멈추고, 한 번에 끝낸다" }, uses: 1 },
  rgShadowBody: { id: "rgShadowBody", name: "그림자의 몸", kind: "passive", desc: "AC +2, 전투마다 나를 노린 첫 공격은 50% 확률로 빗나간다", passive: { ac: 2 } },
  rgVanish: { id: "rgVanish", name: "사라지기", kind: "active", desc: "내 HP 30% 이하가 되면 그림자에 녹아 적 전원 1라운드 행동 불가(전투당 1회)", trigger: { on: "selfBelow", pct: 30 }, effect: { type: "stunAll", rounds: 1 }, uses: 1 },
  rgAssassinAvatar: { id: "rgAssassinAvatar", name: "그림자의 화신", kind: "passive", desc: "최대 HP +10, 치명타 확률 +10%, 왼손 찌르기가 라운드마다 두 번", passive: { hp: 10, crit: 10 } },
  // 독술(민첩·지능): 지속 피해 + 서서히 약화
  rgToxEdge: { id: "rgToxEdge", name: "독 바른 칼날", kind: "passive", desc: "단검이 맞힐 때마다 15% 확률로 독 1겹(3라운드, 겹마다 라운드당 1d2)" },
  rgToxThrow: { id: "rgToxThrow", name: "독 단검 투척", kind: "active", desc: "전투 시작 시 가장 약한 적 둘에게 독 1겹(3라운드)", trigger: { on: "start" }, effect: { type: "tox", n: 1, to: "two", rounds: 3, text: "독 묻은 단검 두 자루를 던졌다" }, uses: 1 },
  rgVenomMark: { id: "rgVenomMark", name: "독술의 각인", kind: "passive", desc: "왼손에 독병 주머니(4라운드마다 적 전원에게 독병). 최대 HP +5, 독 피해 +1, 독 지속 +1라운드, 중독된 적 명중 −1, 독술 액티브 전투당 +1회", passive: { hp: 5 } },
  rgWither: { id: "rgWither", name: "쇠약 독", kind: "active", desc: "전투 시작 시 가장 강한 적이 주는 피해 −2(4라운드)", trigger: { on: "start" }, effect: { type: "cripple", n: 2, rounds: 4, text: "팔다리를 녹이는 독을 먹였다" }, uses: 1 },
  rgAntidote: { id: "rgAntidote", name: "해독 지식", kind: "passive", desc: "독·마비에 걸릴 확률 절반, 해독초가 두 단계씩 듣는다" },
  rgToxFog: { id: "rgToxFog", name: "독안개", kind: "active", desc: "전투 시작 시 독병을 깨뜨려 적 전원에게 독 1겹 + 명중 −1(3라운드)", trigger: { on: "start" }, effect: { type: "tox", n: 1, to: "all", rounds: 3, hitDown: 1, text: "독병이 깨지며 푸른 안개가 번진다" }, uses: 1, off: "flask" },
  rgToxStack: { id: "rgToxStack", name: "맹독", kind: "passive", desc: "독이 3겹까지 쌓인다(없으면 2겹)" },
  rgRot: { id: "rgRot", name: "부패", kind: "active", desc: "중독된 적이 셋 이상이거나 보스가 중독되면 그 적들이 2라운드 동안 받는 피해 ×1.2", trigger: { on: "react" }, uses: 1 },
  rgVenomSeal: { id: "rgVenomSeal", name: "독술의 낙인", kind: "passive", desc: "독 피해 +1, 중독된 적 AC −1, 독술 액티브 전투당 +1회. 왼손이 다른 무기면 독병 주머니로 바꾼다" },
  rgToxBurst: { id: "rgToxBurst", name: "독 폭발", kind: "active", desc: "독이 2겹 이상 쌓인 적의 남은 독 피해를 한 번에 터뜨린다(전투당 1회)", trigger: { on: "react" }, uses: 1 },
  rgRotBlood: { id: "rgRotBlood", name: "썩은 피", kind: "passive", desc: "중독된 적을 쓰러뜨리면 HP +4" },
  rgPlagueBlade: { id: "rgPlagueBlade", name: "역병의 칼", kind: "active", desc: "궁극기. 전투 시작 시 적 전원에게 독 2겹(4라운드) + 명중 −1", trigger: { on: "start" }, effect: { type: "tox", n: 2, to: "all", rounds: 4, hitDown: 1, text: "칼끝에서 역병이 번진다" }, uses: 1 },
  rgToxBody: { id: "rgToxBody", name: "독의 몸", kind: "passive", desc: "받는 피해 −1, 독에 걸리지 않는다" },
  rgLastToxin: { id: "rgLastToxin", name: "궁지의 독", kind: "active", desc: "내 HP 30% 이하가 되면 남은 독병을 모두 던진다 — 적 전원 독 2겹 + 명중 −3(2라운드)", trigger: { on: "selfBelow", pct: 30 }, effect: { type: "tox", n: 2, to: "all", rounds: 3, hitDown: 3, text: "허리의 독병을 모두 깨뜨렸다" }, uses: 1, off: "flask" },
  rgVenomAvatar: { id: "rgVenomAvatar", name: "독의 화신", kind: "passive", desc: "최대 HP +10, 독 피해 ×1.5, 독병을 2라운드마다", passive: { hp: 10 } },
  // 쇠뇌(민첩·감각): 적당한 화력 + 즉시 제압
  rgSight: { id: "rgSight", name: "가늠쇠", kind: "passive", desc: "명중 +1, 앞방 엿보기·함정 발견 +2", passive: { hit: 1, perception: 2 } },
  rgKnife: { id: "rgKnife", name: "투척 단검", kind: "active", desc: "전투 시작 시 가장 약한 적에게 단검을 던진다(확정 명중, 1d6 + 민첩 보정)", trigger: { on: "start" }, effect: { type: "throw", dice: [1, 6], text: "허리춤의 단검을 던졌다" }, uses: 1 },
  rgXbowMark: { id: "rgXbowMark", name: "쇠뇌의 각인", kind: "passive", desc: "왼손에 손쇠뇌(볼트 20발과 함께). 최대 HP +4, 볼트 피해 +1, 볼트에 맞은 적은 표식(AC·명중 −1), 날아다니는 적에게 볼트 명중 +2, 쇠뇌 액티브 전투당 +1회", passive: { hp: 4 } },
  rgAnkle: { id: "rgAnkle", name: "발목 꿰기", kind: "active", desc: "전투 시작 시 가장 강한 적의 발목을 쏜다 — 1라운드 행동 불가, 이 전투 도주 +3", trigger: { on: "start" }, effect: { type: "bolt", to: "strongest", mult: 0.5, stun: 1, bossStun: 1, flee: 3, text: "발목을 노려 볼트를 날렸다" }, uses: 1, off: "xbow" },
  rgQuickLoad: { id: "rgQuickLoad", name: "빠른 장전", kind: "passive", desc: "손쇠뇌를 라운드마다 쏜다(장전에 라운드를 쓰지 않는다)", off: "xbow" },
  rgWrist: { id: "rgWrist", name: "손목 꿰기", kind: "active", desc: "전투 시작 시 가장 강한 적의 손목을 쏜다 — 주는 피해 −4(3라운드, 보스·정예 2라운드)", trigger: { on: "start" }, effect: { type: "bolt", to: "strongest", mult: 0.5, cripple: { n: 4, rounds: 3, bossRounds: 2 }, text: "무기 쥔 손목을 꿰뚫었다" }, uses: 1, off: "xbow" },
  rgTarget: { id: "rgTarget", name: "표적 지정", kind: "passive", desc: "표식이 붙은 적에게 단검 치명타 확률 +10%", off: "xbow" },
  rgSnipe: { id: "rgSnipe", name: "저격", kind: "active", desc: "전투 시작 시 가장 강한 적에게 확정 명중 볼트, 피해 ×2.5", trigger: { on: "start" }, effect: { type: "bolt", to: "strongest", mult: 2.5, text: "숨을 참고 방아쇠를 당겼다" }, uses: 1, off: "xbow" },
  rgXbowSeal: { id: "rgXbowSeal", name: "쇠뇌의 낙인", kind: "passive", desc: "볼트 피해 +3, 표식이 AC·명중 −2, 쇠뇌 액티브 전투당 +1회. 왼손이 다른 무기면 손쇠뇌로 바꾼다" },
  rgPierce: { id: "rgPierce", name: "꿰뚫는 볼트", kind: "active", desc: "적이 둘 이상이면 전투 시작 시 볼트 한 발로 가장 강한 둘을 꿰뚫는다", trigger: { on: "start", minEnemies: 2 }, effect: { type: "bolt", to: "two", mult: 1, text: "볼트가 둘을 한 번에 꿰었다" }, uses: 1, off: "xbow" },
  rgWind: { id: "rgWind", name: "바람 읽기", kind: "passive", desc: "볼트 명중 +2, 날아다니는 적에게 볼트 피해 +3" },
  rgNail: { id: "rgNail", name: "못박기", kind: "active", desc: "궁극기. 전투 시작 시 가장 강한 적을 2라운드 묶고(보스도) 확정 치명타 볼트", trigger: { on: "start" }, effect: { type: "bolt", to: "strongest", mult: 1, crit: true, stun: 2, bossStun: 2, text: "볼트가 그것을 바닥에 박아 버렸다" }, uses: 1, off: "xbow" },
  rgHunterStep: { id: "rgHunterStep", name: "사냥꾼의 발", kind: "passive", desc: "AC +2, 도주 +3", passive: { ac: 2, flee: 3 } },
  rgLastBolt: { id: "rgLastBolt", name: "마지막 볼트", kind: "active", desc: "내 HP 30% 이하가 되면 가장 강한 적에게 확정 치명타 볼트(전투당 1회)", trigger: { on: "selfBelow", pct: 30 }, effect: { type: "bolt", to: "strongest", mult: 1, crit: true, text: "마지막 숨으로 쇠뇌를 겨눴다" }, uses: 1, off: "xbow" },
  rgXbowAvatar: { id: "rgXbowAvatar", name: "사냥꾼의 화신", kind: "passive", desc: "최대 HP +10, 손쇠뇌를 라운드마다 두 발", passive: { hp: 10 } },
} satisfies Record<string, SkillDef>);

// 모험가 히든 16레벨: 신에게 배운 자(영구 — 최대 HP +10). 강화·마지막 기술은 faith.ts TEACHINGS, 효과는 combat.ts가 teachOn으로
Object.assign(SKILLS, {
  godTaught: { id: "godTaught", name: "신에게 배운 자", kind: "passive", desc: "섬기는 신이 직접 16레벨로 이끌었다. 최대 HP +30, 명중 +3, 피해 +5, AC +2 (그 신의 가르침은 그 신을 섬기는 동안)", passive: { hp: 30, hit: 3, dmg: 5, ac: 2 } },
} satisfies Record<string, SkillDef>);

// "고통 무시": 공포 면역
mindResist.push((s, k) => (k === "fear" && s.skills.includes("painless") ? 0 : 1));

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
/** 이 기술의 장비 조건(방패·로그 왼손 무기)이 맞나 */
function gearOk(s: GameState, d: SkillDef | undefined): boolean {
  if (!d) return false;
  if (d.shield && !hasShield(s)) return false;
  if (d.off && offOf(s) !== d.off) return false;
  return true;
}

export function passive(s: GameState, key: Exclude<keyof Passive, "hunger">): number {
  let t = key === "check" ? 0 : gearBonus(s, key);
  if (key === "flee") t += CLASS_TRAIT[s.hero.cls]?.flee ?? 0; // 로그: 도주 +3
  const earthMark = s.skills.includes("earthMark");
  for (const id of allSkills(s)) {
    if (!gearOk(s, SKILLS[id])) continue; // 방패·왼손 무기 기술은 그 장비가 있어야
    const v = SKILLS[id]?.passive?.[key] ?? 0;
    t += earthMark && SKILLS[id]?.el === "earth" && !["earthMark", "earthSeal", "earthAvatar"].includes(id) ? v * 2 : v; // 대지의 각인: 대지 패시브 2배(낙인·화신 제외)
  }
  return t;
}

export function hungerMult(s: GameState): number {
  let m = faithHungerMult(s);
  for (const id of allSkills(s)) m *= SKILLS[id]?.passive?.hunger ?? 1;
  return m;
}

export function activeSkills(s: GameState): SkillDef[] {
  return allSkills(s).map((id) => SKILLS[id]).filter((d) => d && d.kind === "active" && gearOk(s, d));
}

/** 기술을 지금 쓸 수 있나(방패 기술은 방패가, 로그 왼손 기술은 그 무기가 있어야) */
export function skillWorks(s: GameState, id: string): boolean {
  return s.skills.includes(id) && gearOk(s, SKILLS[id]);
}
