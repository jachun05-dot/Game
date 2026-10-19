import type { SlotKey } from "./gear";
import type { StatKey } from "./types";

// 직업(DESIGN 9절). 모험가는 모든 일반 훈련을 받을 수 있는 대신 전용 훈련이 없고,
// 전사·마법사는 일반 훈련 일부와 전용 훈련을 받는다. 히든 트레이닝은 아직 없다.

export type ClassId = "adventurer" | "warrior" | "mage" | "rogue";

export interface ClassDef {
  id: ClassId;
  name: string;
  motive: string;
  desc: string;
  /** 기본 HP 보정 */
  hp: number;
  /** 레벨마다 추가로 오르는 HP */
  hpPerLevel: number;
  /** 시작 장비(소지금은 모든 직업 0G — 대신 장비·소모품으로 직업 차이를 둔다) */
  start: Partial<Record<SlotKey, string>>;
  /** 시작 소모품 */
  items: { food: number; potion: number; scroll: number };
  /** 직업 특성(로그: 도주·함정 해체) */
  trait?: { flee?: number; disarm?: number };
  /** 첫 훈련 때 함께 배우는 기본기(마법사: 마력 화살) */
  firstSkill?: string;
  /** 받을 수 있는 훈련 id */
  trainings: string[];
  /** 후보 카드 성향: 이름과 많이 오르는 능력치(앞쪽일수록 더) */
  archetypes: { name: string; favor: StatKey[] }[];
  /** 직업 전체가 공통으로 조금 더 받는 능력치 */
  lean: StatKey[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
  adventurer: {
    id: "adventurer",
    name: "모험가",
    motive: "영지에서 나고 자란 소년. 거창한 이유는 없다.",
    desc: "무엇이든 할 수 있다. 전사형(힘)·마법사형(지능)·민첩형(민첩) 훈련을 자유롭게 섞는다. 대신 전문 직업보다 좁고 얕다.",
    hp: -2,
    hpPerLevel: 3,
    start: { main: "shortsword", body: "leather" },
    items: { food: 3, potion: 1, scroll: 0 },
    firstSkill: "flashPowder",
    trainings: ["fighter", "caster", "rogue"],
    archetypes: [
      { name: "힘쓰는 소년", favor: ["str", "con"] },
      { name: "날랜 소년", favor: ["dex", "luk"] },
      { name: "눈치 빠른 소년", favor: ["per", "dex"] },
      { name: "글 읽는 소년", favor: ["int", "per"] },
      { name: "질긴 소년", favor: ["con", "str"] },
      { name: "운 좋은 소년", favor: ["luk", "per"] },
    ],
    lean: [],
  },
  warrior: {
    id: "warrior",
    name: "전사",
    motive: "강해지기 위해 미궁에 왔다.",
    desc: "장검과 가죽 갑옷으로 시작한다. 훈련은 수호·검투·광전 세 가지뿐 — 레벨마다 고른 방향의 기술을 배운다.",
    hp: -5,
    hpPerLevel: 3,
    start: { main: "longsword", body: "leather" },
    items: { food: 3, potion: 3, scroll: 0 },
    firstSkill: "firstStrike",
    trainings: ["guard", "glad", "berserk"],
    archetypes: [
      { name: "타고난 장사", favor: ["str", "con"] },
      { name: "버티는 방패", favor: ["con", "str"] },
      { name: "날쌘 칼잡이", favor: ["str", "dex"] },
      { name: "싸움꾼의 감", favor: ["str", "per"] },
    ],
    lean: ["str", "con"],
  },
  mage: {
    id: "mage",
    name: "마법사",
    motive: "차원문과 그 너머를 연구하러 왔다.",
    desc: "지팡이로 마력탄을 쏜다. 몸이 약하다. 훈련은 화염·서리·번개·대지 수련뿐 — 레벨마다 고른 원소의 기술을 배운다.",
    hp: -2,
    hpPerLevel: 0,
    start: { main: "staff", body: "robe" },
    items: { food: 3, potion: 4, scroll: 0 },
    firstSkill: "magicMissile",
    trainings: ["fire", "frost", "bolt", "earth"],
    archetypes: [
      { name: "책벌레", favor: ["int", "per"] },
      { name: "예민한 감응자", favor: ["per", "int"] },
      { name: "운명을 읽는 자", favor: ["int", "luk"] },
      { name: "약초상의 제자", favor: ["int", "con"] },
    ],
    lean: ["int"],
  },
  // 로그(2026-10-19, docs/ROGUE.md): 단검 한 자루로 시작해 4레벨 각인이 왼손 무기를 정한다
  // (암습 = 두 번째 단검, 독술 = 독병 주머니, 쇠뇌 = 손쇠뇌). 모든 훈련이 민첩을 올린다.
  rogue: {
    id: "rogue",
    name: "로그",
    motive: "뒷골목에서 자랐다. 훔치는 법은 알아도 갚는 법은 모른다.",
    desc: "단검 한 자루로 시작한다. 빠르고 약하다. 훈련은 암습·독술·쇠뇌 세 가지뿐 — 4레벨 특수 훈련에서 고른 갈래가 왼손 무기(두 번째 단검·독병·손쇠뇌)를 정한다. 도주 +2, 함정 해체 +2.",
    hp: 0,
    hpPerLevel: 1,
    start: { main: "dagger", body: "leather" },
    items: { food: 3, potion: 2, scroll: 1 },
    firstSkill: "rgBackstab",
    trait: { flee: 2, disarm: 2 },
    trainings: ["assassin", "venom", "xbow"],
    archetypes: [
      { name: "날랜 손", favor: ["dex", "luk"] },
      { name: "그림자", favor: ["dex", "per"] },
      { name: "뒷골목 약장수", favor: ["dex", "int"] },
      { name: "질긴 들쥐", favor: ["dex", "con"] },
    ],
    lean: ["dex"],
  },
};

export const CLASS_IDS: ClassId[] = ["adventurer", "warrior", "mage", "rogue"];

/** 직업 특성(skills.ts passive·dungeon.ts 함정 해체가 읽는다) */
export const CLASS_TRAIT: Partial<Record<ClassId, { flee?: number; disarm?: number }>> = Object.fromEntries(
  Object.values(CLASSES).filter((c) => c.trait).map((c) => [c.id, c.trait!]),
);
