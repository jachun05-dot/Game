import type { GameState, StatKey } from "./types";
import { mainLost, slotWorks } from "./injury";
import { MIND_NAME, mindResist, type MindKey } from "./mind";

// 장비(DESIGN 10절): 슬롯 9개. 장비는 파워 스케일링이 아니라 생존 최소 기준선이고,
// 미궁에서 주운 장비는 착용해야만 가지고 나올 수 있다(DESIGN 6절).

export type SlotKey = "head" | "body" | "main" | "offhand" | "waist" | "feet" | "neck" | "ring1" | "ring2";
export type GearSlot = Exclude<SlotKey, "ring1" | "ring2"> | "ring";

export const SLOTS: { key: SlotKey; name: string }[] = [
  { key: "head", name: "머리" },
  { key: "body", name: "몸통" },
  { key: "main", name: "오른손" },
  { key: "offhand", name: "왼손" },
  { key: "waist", name: "허리" },
  { key: "feet", name: "발" },
  { key: "neck", name: "목걸이" },
  { key: "ring1", name: "반지 1" },
  { key: "ring2", name: "반지 2" },
];

/** 장비가 주는 보정(기술 패시브와 같은 키를 쓴다) */
export interface GearBonus {
  ac?: number;
  hit?: number;
  dmg?: number;
  crit?: number;
  hp?: number;
  flee?: number;
  perception?: number;
  potion?: number;
}

export interface Weapon {
  dice: [number, number];
  /** 명중·피해에 쓰는 능력치 */
  stat: StatKey;
  /** 로그 문장: "{대상}에게 {verb}" */
  verb: string;
}

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  bonus: GearBonus;
  weapon?: Weapon;
  /** 대장간 판매가(없으면 비매품 — 미궁에서만 나온다) */
  price?: number;
  /** 보물상자에서 나오는 가중치(0이면 안 나옴) */
  loot?: number;
  /** 이 섹터부터 보물상자에서 나온다(기본 1) */
  sector?: number;
  /** 대장간에서 사려면 필요한 등급(클리어한 섹터 수) */
  rank?: number;
  /** 정신 상태이상 저항: 걸릴 확률 배율(0이면 면역) */
  mindRes?: Partial<Record<MindKey, number>>;
  flavor: string;
}

export const GEAR: Record<string, GearDef> = {
  // 무기(오른손)
  shortsword: { id: "shortsword", name: "숏소드", slot: "main", bonus: {}, weapon: { dice: [1, 6], stat: "str", verb: "칼을 휘둘러" }, price: 20, flavor: "모험가 등록소에서 받는 표준 한손검." },
  longsword: { id: "longsword", name: "장검", slot: "main", bonus: {}, weapon: { dice: [1, 8], stat: "str", verb: "장검을 내리쳐" }, price: 70, flavor: "무겁지만 한 번 들어가면 깊다." },
  dagger: { id: "dagger", name: "가는 단검", slot: "main", bonus: { crit: 5 }, weapon: { dice: [1, 4], stat: "dex", verb: "단검을 찔러 넣어" }, loot: 3, flavor: "급소를 노리기 좋다. 민첩으로 다룬다." },
  staff: { id: "staff", name: "참나무 지팡이", slot: "main", bonus: {}, weapon: { dice: [1, 4], stat: "int", verb: "마력탄을 날려" }, price: 40, flavor: "마력을 모아 쏘는 수습생의 지팡이. 지능으로 다룬다." },
  bonewand: { id: "bonewand", name: "뼈 지팡이", slot: "main", bonus: { hit: 1 }, weapon: { dice: [1, 8], stat: "int", verb: "검은 마력을 쏘아" }, loot: 1, flavor: "스켈레톤의 손가락뼈를 엮어 만들었다." },
  // 몸통
  robe: { id: "robe", name: "수습생 로브", slot: "body", bonus: { ac: 1, perception: 1 }, price: 30, flavor: "주머니가 많다. 칼은 못 막는다." },
  leather: { id: "leather", name: "가죽 갑옷", slot: "body", bonus: { ac: 2 }, price: 50, flavor: "질긴 소가죽을 덧댔다." },
  chain: { id: "chain", name: "녹슨 사슬 갑옷", slot: "body", bonus: { ac: 4, flee: -2 }, loot: 2, flavor: "무겁고 시끄럽지만 단단하다." },
  // 왼손
  shield: { id: "shield", name: "나무 방패", slot: "offhand", bonus: { ac: 1 }, price: 25, flavor: "몇 번은 막아 준다." },
  ironshield: { id: "ironshield", name: "쇠테 방패", slot: "offhand", bonus: { ac: 2 }, loot: 2, flavor: "누군가의 이름이 긁혀 지워져 있다." },
  // 머리
  cap: { id: "cap", name: "가죽 모자", slot: "head", bonus: { ac: 1 }, price: 30, flavor: "없는 것보단 낫다." },
  helm: { id: "helm", name: "찌그러진 철투구", slot: "head", bonus: { ac: 2, perception: -1 }, loot: 2, flavor: "시야가 좁아진다." },
  // 허리
  belt: { id: "belt", name: "질긴 허리띠", slot: "waist", bonus: { hp: 3 }, price: 35, flavor: "배를 단단히 조이면 버틸 만하다." },
  pouchbelt: { id: "pouchbelt", name: "약초 주머니 띠", slot: "waist", bonus: { potion: 2 }, loot: 3, flavor: "물약을 마실 때 약초를 같이 씹는다." },
  // 발
  boots: { id: "boots", name: "가죽 장화", slot: "feet", bonus: { flee: 2 }, price: 25, flavor: "발목을 잡아 준다." },
  swiftboots: { id: "swiftboots", name: "날랜 장화", slot: "feet", bonus: { ac: 1, flee: 3 }, loot: 2, flavor: "밑창이 거의 닳지 않았다. 주인은 어디 갔을까." },
  // 목걸이
  boneamulet: { id: "boneamulet", name: "뼈 부적", slot: "neck", bonus: { crit: 3 }, loot: 3, flavor: "옛 신의 문양이 새겨져 있다. 성당에 들키면 곤란하다." },
  prayer: { id: "prayer", name: "기도 목걸이", slot: "neck", bonus: { hp: 2, potion: 1 }, loot: 2, flavor: "알 수 없는 이름이 적힌 쪽지가 들어 있다." },
  // 반지
  rustring: { id: "rustring", name: "녹슨 반지", slot: "ring", bonus: { hit: 1 }, loot: 3, flavor: "손가락에 꼭 맞는다." },
  luckring: { id: "luckring", name: "행운의 반지", slot: "ring", bonus: { crit: 4 }, loot: 2, flavor: "주사위 눈이 새겨져 있다." },
  vigorring: { id: "vigorring", name: "활력의 반지", slot: "ring", bonus: { hp: 4 }, loot: 2, flavor: "끼면 손끝이 따뜻해진다." },
  // ── 2섹터(잊힌 전쟁터의 초원) ──
  wraithspear: { id: "wraithspear", name: "망령의 녹슨 창", slot: "main", bonus: { hit: 1 }, weapon: { dice: [1, 10], stat: "str", verb: "녹슨 창을 꽂아" }, loot: 2, sector: 2, flavor: "끝나지 않은 전쟁의 창. 아직도 찌를 곳을 찾는다." },
  warbanner: { id: "warbanner", name: "녹슨 군기 방패", slot: "offhand", bonus: { ac: 2 }, mindRes: { fear: 0.5 }, loot: 2, sector: 2, flavor: "찢어진 군기를 덧댄 방패. 들고 있으면 겁이 덜 난다." },
  harpycharm: { id: "harpycharm", name: "하피 깃털 부적", slot: "neck", bonus: { perception: 1 }, mindRes: { confusion: 0.5 }, loot: 2, sector: 2, flavor: "비명을 견딘 깃털. 머릿속을 맑게 붙잡아 준다." },
  horseshoe: { id: "horseshoe", name: "군마의 편자 장화", slot: "feet", bonus: { ac: 1, flee: 3 }, loot: 2, sector: 2, flavor: "유령 군마의 편자를 박았다. 발이 가볍다." },
  battlering: { id: "battlering", name: "전장의 반지", slot: "ring", bonus: { hit: 2 }, loot: 2, sector: 2, flavor: "손가락뼈에 끼워진 채 발견됐다." },
  wolfhide: { id: "wolfhide", name: "늑대 가죽 갑옷", slot: "body", bonus: { ac: 3 }, price: 150, rank: 1, loot: 1, sector: 2, flavor: "들늑대 가죽을 겹겹이 덧댔다. 차원문 너머에서 들여온 물건." },
  steelsword: { id: "steelsword", name: "강철 장검", slot: "main", bonus: {}, weapon: { dice: [1, 10], stat: "str", verb: "강철 장검을 내리쳐" }, price: 160, rank: 1, flavor: "등급을 올린 모험가에게만 파는 칼." },
  steelshield: { id: "steelshield", name: "강철 방패", slot: "offhand", bonus: { ac: 2 }, price: 110, rank: 1, flavor: "가볍고 단단하다." },
  oakstaff: { id: "oakstaff", name: "마력이 깃든 지팡이", slot: "main", bonus: { hit: 1 }, weapon: { dice: [1, 8], stat: "int", verb: "짙은 마력탄을 날려" }, price: 150, rank: 1, flavor: "차원문 너머의 나무로 깎았다." },
  queencloak: { id: "queencloak", name: "하피 여왕의 깃털 망토", slot: "neck", bonus: { ac: 1, flee: 4 }, mindRes: { confusion: 0 }, flavor: "여왕의 비명을 막아 낸 깃털. 두르면 어떤 소리도 머리를 흔들지 못한다." },
};

const BONUS_LABEL: Record<keyof GearBonus, string> = {
  ac: "AC", hit: "명중", dmg: "피해", crit: "치명타%", hp: "최대 HP", flee: "도주", perception: "감각 판정", potion: "물약 회복",
};
const STAT_NAME: Record<StatKey, string> = { str: "힘", dex: "민첩", con: "체력", int: "지능", per: "감각", luk: "행운" };

// 장비의 정신 상태이상 저항을 mind.ts에 알려 준다(순환 참조를 피하려고 등록 방식)
mindResist.push((s, k) => {
  let m = 1;
  for (const [slot, id] of Object.entries(s.gear)) if (id && slotWorks(s, slot)) m *= GEAR[id]?.mindRes?.[k] ?? 1;
  return m;
});

export function gearEffect(id: string): string {
  const g = GEAR[id];
  const parts: string[] = [];
  for (const [k, v] of Object.entries(g.mindRes ?? {}) as [MindKey, number][]) parts.push(v === 0 ? `${MIND_NAME[k]} 면역` : `${MIND_NAME[k]} 저항`);
  if (g.weapon) parts.push(`피해 ${g.weapon.dice[0]}d${g.weapon.dice[1]} · ${STAT_NAME[g.weapon.stat]} 기반`);
  for (const [k, v] of Object.entries(g.bonus) as [keyof GearBonus, number][]) {
    if (v) parts.push(`${BONUS_LABEL[k]} ${v > 0 ? "+" : ""}${v}`);
  }
  return parts.join(" · ");
}

/** 대충의 장비 가치(봇·자동 결정이 교체 여부를 판단할 때) */
export function gearScore(id: string | undefined): number {
  if (!id) return 0;
  const g = GEAR[id];
  const b = g.bonus;
  let v = (b.ac ?? 0) * 3 + (b.hit ?? 0) * 2 + (b.dmg ?? 0) * 2 + (b.crit ?? 0) * 0.5 + (b.hp ?? 0) * 0.7 + (b.flee ?? 0) * 0.3 + (b.perception ?? 0) * 0.5 + (b.potion ?? 0) * 0.5;
  if (g.weapon) v += g.weapon.dice[1] * g.weapon.dice[0];
  return v;
}

export function gearBonus(s: GameState, key: keyof GearBonus): number {
  let t = 0;
  for (const [slot, id] of Object.entries(s.gear)) if (id && slotWorks(s, slot)) t += GEAR[id]?.bonus[key] ?? 0;
  return t;
}

const FISTS: Weapon = { dice: [1, 2], stat: "str", verb: "주먹을 휘둘러" };

export function weaponOf(s: GameState): Weapon {
  const id = s.gear.main;
  if (mainLost(s)) return FISTS; // 오른손 결손(의수 없음)
  return (id && GEAR[id]?.weapon) || FISTS;
}

/** 이 장비가 들어갈 슬롯(반지는 빈 쪽, 둘 다 차 있으면 약한 쪽) */
export function targetSlot(s: GameState, id: string): SlotKey {
  const g = GEAR[id];
  if (g.slot !== "ring") return g.slot;
  if (!s.gear.ring1) return "ring1";
  if (!s.gear.ring2) return "ring2";
  return gearScore(s.gear.ring1) <= gearScore(s.gear.ring2) ? "ring1" : "ring2";
}

export function equip(s: GameState, id: string): string | undefined {
  const slot = targetSlot(s, id);
  const old = s.gear[slot];
  s.gear[slot] = id;
  return old;
}
