import type { GameState, StatKey } from "./types";
import { mainLost, slotWorks } from "./injury";
import { MIND_NAME, mindResist, type MindKey } from "./mind";
import { pietyCapBonus } from "./faith";
import type { OffKind } from "./elements";
import { t, tk } from "../i18n/core";

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
  /** 마력탄(지팡이): 근접 페널티·자기 부상이 없다 */
  magic?: boolean;
  /** 힘과 민첩 중 높은 쪽으로 다룬다(숏소드) */
  finesse?: boolean;
}

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  /** 로그의 왼손 무기(4레벨 각인이 준다, combat.ts 로그 절). 방패로 치지 않는다 */
  rogueOff?: OffKind;
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
  /** 능력치 보정(테스터 장비) */
  stats?: Partial<Record<StatKey, number>>;
  /** 미궁에 들어갈 때마다 죽음을 막아 주는 횟수(테스터 장비) */
  lifeSaves?: number;
  /** 정신 상태이상 저항: 걸릴 확률 배율(0이면 면역) */
  mindRes?: Partial<Record<MindKey, number>>;
  /** 부식 확률 배율(0이면 부식되지 않음) — 몸통은 모든 슬롯 부식 확률에, 무기는 자기 슬롯에 */
  corrodeRes?: number;
  /** 독·마비 걸릴 확률 배율 */
  poisonRes?: number;
  /** 곰팡이 폐병 걸릴 확률 배율 */
  moldRes?: number;
  /** 물장화: 침수 방 이동 배율 무시 */
  wade?: boolean;
  /** 깊은 물 헤엄 판정 보정 */
  swim?: number;
  /** 치명타를 내면 HP + */
  critHeal?: number;
  /** 물이 높을 때 명중 + */
  tideHit?: number;
  // ── 4섹터 ──
  /** 화상 확률 배율 / 냉기 쌓임 배율 */
  burnRes?: number;
  coldRes?: number;
  /** 단단한 적을 쳐도 자기 손을 다치지 않는다 */
  noHardSelf?: boolean;
  /** 함정 발견 + / 광차·얇은 얼음 회피 + */
  trapFind?: number;
  trapDodge?: number;
  /** 가스 주머니를 항상 미리 안다 */
  gasSense?: boolean;
  /** 고임 때 명중 + */
  stagnantHit?: number;
  /** 맞힌 적의 명중 −1(1라운드) */
  chillHit?: boolean;
  /** 낙반·폭발·광차 피해 배율 */
  blastRes?: number;
  // ── 5섹터 ──
  /** 붙잡힐 확률 배율 */
  grabRes?: number;
  /** 들숨(어둠) 페널티 무시 */
  darkSight?: boolean;
  /** 벼랑길 판정 + */
  ledge?: number;
  /** 추락 피해 배율 */
  fallRes?: number;
  /** 두 얼굴의 그릇: 포만감 70 이상이면 방을 옮길 때 HP +1, 30 이하면 피해 +2 */
  twoFace?: boolean;
  // ── 6섹터 ──
  /** 성광(화신·아바타·심판의 눈) 피해 배율 */
  radianceRes?: number;
  /** 정화 무효 */
  purgeImmune?: boolean;
  /** 성광 방에서 신앙심이 깎이지 않는다 */
  noRadiant?: boolean;
  /** 신앙심 상한 + */
  pietyCap?: number;
  flavor: string;
}

export const GEAR: Record<string, GearDef> = {
  // 무기(오른손)
  shortsword: { id: "shortsword", name: "숏소드", slot: "main", bonus: {}, weapon: { dice: [1, 6], stat: "str", verb: "칼을 휘둘러", finesse: true }, price: 20, flavor: "모험가 등록소에서 받는 표준 한손검. 힘이나 민첩 중 나은 쪽으로 다룬다." },
  longsword: { id: "longsword", name: "장검", slot: "main", bonus: {}, weapon: { dice: [1, 8], stat: "str", verb: "장검을 내리쳐" }, price: 70, flavor: "무겁지만 한 번 들어가면 깊다." },
  dagger: { id: "dagger", name: "가는 단검", slot: "main", bonus: { crit: 5 }, weapon: { dice: [1, 4], stat: "dex", verb: "단검을 찔러 넣어" }, loot: 3, flavor: "급소를 노리기 좋다. 민첩으로 다룬다." },
  staff: { id: "staff", name: "참나무 지팡이", slot: "main", bonus: {}, weapon: { dice: [1, 6], stat: "int", verb: "마력탄을 날려" }, price: 40, flavor: "마력을 모아 쏘는 수습생의 지팡이. 지능으로 다룬다." },
  bonewand: { id: "bonewand", name: "뼈 지팡이", slot: "main", bonus: { hit: 1 }, weapon: { dice: [1, 8], stat: "int", verb: "검은 마력을 쏘아" }, loot: 1, flavor: "스켈레톤의 손가락뼈를 엮어 만들었다." },
  // 몸통
  robe: { id: "robe", name: "수습생 로브", slot: "body", bonus: { ac: 1, perception: 1 }, price: 30, flavor: "주머니가 많다. 칼은 못 막는다." },
  leather: { id: "leather", name: "가죽 갑옷", slot: "body", bonus: { ac: 2 }, price: 50, flavor: "질긴 소가죽을 덧댔다." },
  chain: { id: "chain", name: "녹슨 사슬 갑옷", slot: "body", bonus: { ac: 4, flee: -2 }, loot: 2, flavor: "무겁고 시끄럽지만 단단하다." },
  // 왼손
  // 로그 왼손 무기(2026-10-19): 4레벨 각인을 받으면 교관이 준다. 잃으면 각인·낙인을 가진 로그만 대장간에서 다시 산다
  rgOffDagger: { id: "rgOffDagger", name: "왼손 단검", slot: "offhand", rogueOff: "dagger", bonus: { crit: 3 }, price: 30, flavor: "오른손이 시선을 끄는 동안 왼손이 찌른다. 로그 전용(암습)." },
  rgToxFlask: { id: "rgToxFlask", name: "독병 주머니", slot: "offhand", rogueOff: "flask", bonus: {}, price: 30, flavor: "허리에 매단 작은 병들. 깨지면 공기가 썩는다. 로그 전용(독술)." },
  rgHandXbow: { id: "rgHandXbow", name: "손쇠뇌", slot: "offhand", rogueOff: "xbow", bonus: {}, price: 40, flavor: "한 손으로 쏘는 작은 쇠뇌. 한 발 쏘면 장전해야 한다. 볼트가 있어야 쏜다. 로그 전용(쇠뇌)." },
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
  // 테스터용(비매품·드롭 없음): 이름을 grooty로 지으면 착용한 채로 시작한다
  grooty: { id: "grooty", name: "시험자의 부적", slot: "neck", bonus: {}, stats: { str: 5, dex: 5, con: 5, int: 5, per: 5, luk: 5 }, lifeSaves: 2, flavor: "테스터에게 주어진 부적. 미궁에 들어갈 때마다 두 번, 죽음을 비껴가게 해 준다." },
  harpycharm: { id: "harpycharm", name: "하피 깃털 부적", slot: "neck", bonus: { perception: 1 }, mindRes: { confusion: 0.5 }, loot: 2, sector: 2, flavor: "비명을 견딘 깃털. 머릿속을 맑게 붙잡아 준다." },
  horseshoe: { id: "horseshoe", name: "군마의 편자 장화", slot: "feet", bonus: { ac: 1, flee: 3 }, loot: 2, sector: 2, flavor: "유령 군마의 편자를 박았다. 발이 가볍다." },
  battlering: { id: "battlering", name: "전장의 반지", slot: "ring", bonus: { hit: 2 }, loot: 2, sector: 2, flavor: "손가락뼈에 끼워진 채 발견됐다." },
  wolfhide: { id: "wolfhide", name: "늑대 가죽 갑옷", slot: "body", bonus: { ac: 3 }, price: 150, rank: 1, loot: 1, sector: 2, flavor: "들늑대 가죽을 겹겹이 덧댔다. 차원문 너머에서 들여온 물건." },
  steelsword: { id: "steelsword", name: "강철 장검", slot: "main", bonus: {}, weapon: { dice: [1, 10], stat: "str", verb: "강철 장검을 내리쳐" }, price: 160, rank: 1, flavor: "등급을 올린 모험가에게만 파는 칼." },
  steelshield: { id: "steelshield", name: "강철 방패", slot: "offhand", bonus: { ac: 2 }, price: 110, rank: 1, flavor: "가볍고 단단하다." },
  oakstaff: { id: "oakstaff", name: "마력이 깃든 지팡이", slot: "main", bonus: { hit: 1 }, weapon: { dice: [1, 8], stat: "int", verb: "짙은 마력탄을 날려" }, price: 150, rank: 1, flavor: "차원문 너머의 나무로 깎았다." },
  // 로그 단검 사다리(2026-10-19): 전사의 장검·마법사의 지팡이처럼 등급마다 대장간에서 산다. 민첩으로 다루고 치명타가 붙는다
  steeldagger: { id: "steeldagger", name: "강철 단검", slot: "main", bonus: { crit: 3 }, weapon: { dice: [1, 6], stat: "dex", verb: "강철 단검을 찔러 넣어" }, price: 150, rank: 1, flavor: "얇고 단단하다. 갑옷 이음매를 찾아 들어간다." },
  bronzedagger: { id: "bronzedagger", name: "청동 단검", slot: "main", bonus: { crit: 3 }, weapon: { dice: [1, 8], stat: "dex", verb: "청동 단검을 찔러 넣어" }, corrodeRes: 0, price: 250, rank: 2, flavor: "녹슬지 않는다. 물에 잠긴 사원에서도." },
  abyssdagger: { id: "abyssdagger", name: "심연강 단검", slot: "main", bonus: { hit: 1, crit: 4 }, weapon: { dice: [1, 10], stat: "dex", verb: "심연강 단검을 찔러 넣어" }, price: 880, rank: 4, flavor: "빛을 먹는 검은 날. 들어간 자리가 보이지 않는다." },
  sundagger: { id: "sundagger", name: "성광 단검", slot: "main", bonus: { hit: 2, crit: 4 }, weapon: { dice: [2, 6], stat: "dex", verb: "성광 단검을 찔러 넣어" }, price: 1380, rank: 5, flavor: "성인의 이름이 새겨진 단검. 신전이 버린 것을 대장장이가 주워 왔다." },
  // ── 5섹터(바닥없는 균열) ──
  abyssblade: { id: "abyssblade", name: "심연강 장검", slot: "main", bonus: { hit: 1 }, weapon: { dice: [2, 6], stat: "str", verb: "심연강 장검을 내리쳐" }, price: 900, rank: 4, flavor: "균열 바닥에서 건진 검은 쇠로 벼렸다." },
  voidstaff: { id: "voidstaff", name: "공허 수정 지팡이", slot: "main", bonus: { hit: 1 }, weapon: { dice: [2, 6], stat: "int", verb: "공허의 마력을 쏘아" }, price: 900, rank: 4, flavor: "속이 빈 수정. 그 안에서 무언가 끝없이 떨어진다." },
  shadowhide: { id: "shadowhide", name: "그림자 가죽 갑옷", slot: "body", bonus: { ac: 5 }, grabRes: 0.5, price: 1100, rank: 4, flavor: "미끄러운 그림자 가죽. 촉수가 잘 붙잡지 못한다." },
  lanternhelm: { id: "lanternhelm", name: "이끼 등불 투구", slot: "head", bonus: { ac: 2 }, darkSight: true, price: 480, rank: 4, flavor: "빛나는 이끼를 채운 등불. 균열이 숨을 들이쉬어도 앞이 보인다." },
  clawboots: { id: "clawboots", name: "갈고리 장화", slot: "feet", bonus: { flee: 2 }, ledge: 4, price: 360, rank: 4, flavor: "앞코에 갈고리를 달았다. 벼랑길에서 미끄러지지 않는다." },
  batcloak: { id: "batcloak", name: "박쥐 날개 망토", slot: "neck", bonus: { flee: 2 }, fallRes: 0.5, loot: 2, sector: 5, flavor: "떨어질 때 펼치면 바람을 받는다." },
  voidring: { id: "voidring", name: "공허 눈 반지", slot: "ring", bonus: { perception: 1 }, mindRes: { despair: 0.5 }, loot: 2, sector: 5, flavor: "닫힌 눈을 새긴 반지. 바닥을 들여다봐도 덜 무너진다." },
  ghoulfang: { id: "ghoulfang", name: "아귀 이빨 단검", slot: "main", bonus: { crit: 6 }, weapon: { dice: [1, 10], stat: "dex", verb: "아귀 이빨을 찔러 넣어" }, loot: 1, sector: 5, flavor: "아귀의 이빨을 갈아 만들었다. 민첩으로 다룬다." },
  twofacebowl: { id: "twofacebowl", name: "두 얼굴의 그릇", slot: "waist", bonus: {}, twoFace: true, flavor: "한쪽은 넘치고 한쪽은 비어 있는 그릇. 배부르면 몸이 낫고, 굶주리면 손이 거칠어진다." },
  // ── 6섹터(타락한 신전과 차원문의 성소) ──
  sunsteel: { id: "sunsteel", name: "성광 강철 장검", slot: "main", bonus: { hit: 2 }, weapon: { dice: [2, 8], stat: "str", verb: "성광 강철을 내리쳐" }, price: 1400, rank: 5, flavor: "신전의 흰 강철을 훔쳐 와 벼렸다. 빛을 빛으로 벤다." },
  relicstaff: { id: "relicstaff", name: "성인의 뼈 지팡이", slot: "main", bonus: { hit: 2 }, weapon: { dice: [2, 8], stat: "int", verb: "성인의 뼈로 마력을 쏘아" }, price: 1400, rank: 5, flavor: "성물함에서 꺼낸 뼈를 엮었다. 그 안의 이름은 이미 지워졌다." },
  towershield: { id: "towershield", name: "결계석 방패", slot: "offhand", bonus: { ac: 3 }, radianceRes: 0.5, price: 900, rank: 5, flavor: "성소의 결계석을 깎아 덧댔다. 흰빛을 반쯤 받아낸다." },
  pilgrimboots: { id: "pilgrimboots", name: "순례자의 신", slot: "feet", bonus: { ac: 1, flee: 4 }, noRadiant: true, price: 500, rank: 5, flavor: "옛 순례자들이 신던 신. 흰빛 위를 걸어도 옛 신의 기척이 깎이지 않는다." },
  hollowplate: { id: "hollowplate", name: "빈 성갑의 흉갑", slot: "body", bonus: { ac: 6, flee: -2 }, loot: 2, sector: 6, flavor: "속이 빈 성기사 갑옷에서 떼어 냈다. 빛은 빠져나갔다." },
  confessmask: { id: "confessmask", name: "고해의 가면", slot: "head", bonus: { ac: 2 }, mindRes: { fear: 0.5, confusion: 0.5 }, loot: 2, sector: 6, flavor: "고해실에 걸려 있던 가면. 쓰면 마음이 덜 흔들린다." },
  chainbelt: { id: "chainbelt", name: "참회의 사슬 띠", slot: "waist", bonus: { hp: 8, flee: -1 }, loot: 2, sector: 6, flavor: "참회의 사슬을 허리에 감았다. 무겁지만 단단하다." },
  pairring: { id: "pairring", name: "짝 잃은 반지", slot: "ring", bonus: {}, pietyCap: 20, loot: 1, sector: 6, flavor: "한 쌍 중 하나만 남은 반지. 끼고 있으면 신을 향한 마음이 더 깊이 담긴다." },
  oldsigil: { id: "oldsigil", name: "뒤집힌 성표", slot: "neck", bonus: { perception: 1 }, purgeImmune: true, flavor: "주교관이 걸고 있던 성표를 뒤집어 걸었다. 흰빛이 옛 신의 기척을 깎지 못한다." },
  // ── 4섹터(불타는 광산 갱도) ──
  fireleather: { id: "fireleather", name: "내화 가죽 갑옷", slot: "body", bonus: { ac: 4 }, burnRes: 0.5, price: 380, rank: 3, flavor: "불에 그을려도 타지 않게 무두질했다. 화상 확률이 절반." },
  furcoat: { id: "furcoat", name: "털 안감 외투", slot: "body", bonus: { ac: 3 }, coldRes: 0.5, price: 320, rank: 3, flavor: "안쪽에 두꺼운 털을 댔다. 냉기가 절반만 스민다." },
  minerpick: { id: "minerpick", name: "광부 곡괭이", slot: "main", bonus: {}, weapon: { dice: [1, 12], stat: "str", verb: "곡괭이를 내리찍어" }, noHardSelf: true, price: 420, rank: 3, flavor: "바위를 깨던 곡괭이. 단단한 것을 쳐도 손목이 버틴다." },
  minerhelm: { id: "minerhelm", name: "등불 달린 갱도모", slot: "head", bonus: { ac: 2 }, trapFind: 2, price: 180, rank: 3, flavor: "이마의 등불이 발밑을 비춘다. 함정 발견 +2." },
  safetyboots: { id: "safetyboots", name: "징 박은 안전화", slot: "feet", bonus: { ac: 1 }, trapDodge: 3, price: 150, rank: 3, flavor: "밑창에 징을 박았다. 얼음과 레일 위에서도 미끄러지지 않는다." },
  canary: { id: "canary", name: "카나리아 새장", slot: "neck", bonus: { perception: 1 }, gasSense: true, loot: 2, sector: 4, flavor: "작은 새가 먼저 숨을 멈춘다. 가스 주머니를 항상 미리 안다." },
  emberring: { id: "emberring", name: "불씨 반지", slot: "ring", bonus: { hit: 2 }, stagnantHit: 1, loot: 2, sector: 4, flavor: "공기가 고이면 반지가 달아오른다." },
  frostwand: { id: "frostwand", name: "서리 광맥 지팡이", slot: "main", bonus: {}, weapon: { dice: [1, 10], stat: "int", verb: "서리 마력을 쏘아" }, chillHit: true, loot: 1, sector: 4, flavor: "얼음 광맥을 깎아 만들었다. 맞은 것의 손발이 굳는다." },
  hingeshield: { id: "hingeshield", name: "미믹의 경첩 방패", slot: "offhand", bonus: { ac: 3 }, blastRes: 0.5, flavor: "광차 미믹의 경첩 턱을 떼어 만든 방패. 낙반·폭발·광차를 반쯤 받아낸다." },
  // ── 3섹터(물에 잠긴 사원) ──
  oiledleather: { id: "oiledleather", name: "기름 먹인 가죽 갑옷", slot: "body", bonus: { ac: 3 }, corrodeRes: 0.5, price: 200, rank: 2, flavor: "기름을 몇 겹 먹여 물과 산을 흘려낸다. 부식될 확률이 절반." },
  bronzeblade: { id: "bronzeblade", name: "청동 장검", slot: "main", bonus: {}, weapon: { dice: [1, 10], stat: "str", verb: "청동 장검을 내리쳐" }, corrodeRes: 0, price: 260, rank: 2, flavor: "녹슬지 않는 청동. 산성 점액에도 삭지 않는다." },
  corkshield: { id: "corkshield", name: "코르크 방패", slot: "offhand", bonus: { ac: 2 }, swim: 2, price: 120, rank: 2, flavor: "물에 뜬다. 깊은 물에서 붙잡고 헤엄치기 좋다." },
  waders: { id: "waders", name: "물장화", slot: "feet", bonus: {}, wade: true, price: 90, rank: 2, flavor: "허벅지까지 오는 가죽 장화. 물에 잠긴 방도 마른 길처럼 걷는다." },
  antidotering: { id: "antidotering", name: "해독의 반지", slot: "ring", bonus: {}, poisonRes: 0.5, loot: 2, sector: 3, flavor: "푸른 돌이 박힌 반지. 독과 저림이 덜 스민다." },
  sporemask: { id: "sporemask", name: "포자 가면", slot: "head", bonus: { perception: -1 }, moldRes: 0.5, loot: 2, sector: 3, flavor: "사제들이 쓰던 부리 가면. 포자를 덜 들이마신다." },
  leechcharm: { id: "leechcharm", name: "거머리 이빨 부적", slot: "neck", bonus: {}, critHeal: 2, loot: 2, sector: 3, flavor: "거머리 이빨을 엮었다. 깊이 벨 때마다 기운이 돌아온다." },
  tidestaff: { id: "tidestaff", name: "조수의 지팡이", slot: "main", bonus: {}, weapon: { dice: [1, 8], stat: "int", verb: "물결 같은 마력을 날려" }, tideHit: 2, loot: 1, sector: 3, flavor: "물이 차오를 때 더 또렷하게 울린다." },
  choirbell: { id: "choirbell", name: "성가대의 녹청 종", slot: "neck", bonus: { perception: 1 }, mindRes: { fear: 0.5, confusion: 0.5 }, flavor: "익사한 성가대가 품고 있던 작은 종. 흔들면 머릿속의 소음이 가라앉는다." },
  queencloak: { id: "queencloak", name: "하피 여왕의 깃털 망토", slot: "neck", bonus: { ac: 1, flee: 4 }, mindRes: { confusion: 0 }, flavor: "여왕의 비명을 막아 낸 깃털. 두르면 어떤 소리도 머리를 흔들지 못한다." },
};

const BONUS_LABEL: Record<keyof GearBonus, string> = {
  ac: tk("AC"), hit: tk("명중"), dmg: tk("피해"), crit: tk("치명타%"), hp: tk("최대 HP"), flee: tk("도주"), perception: tk("감각 판정"), potion: tk("물약 회복"),
};
const STAT_NAME: Record<StatKey, string> = { str: tk("힘"), dex: tk("민첩"), con: tk("체력"), int: tk("지능"), per: tk("감각"), luk: tk("행운") };

// 짝 잃은 반지: 신앙심 상한 +(faith.ts에 등록)
pietyCapBonus.push((s) => gearHas(s, (g) => g.pietyCap).reduce((a, g) => a + g.pietyCap!, 0));

// 장비의 정신 상태이상 저항을 mind.ts에 알려 준다(순환 참조를 피하려고 등록 방식)
mindResist.push((s, k) => {
  let m = 1;
  for (const [slot, id] of Object.entries(s.gear)) if (id && slotWorks(s, slot)) m *= GEAR[id]?.mindRes?.[k] ?? 1;
  return m;
});

export function gearEffect(id: string): string {
  const g = GEAR[id];
  const parts: string[] = [];
  for (const [k, v] of Object.entries(g.mindRes ?? {}) as [MindKey, number][]) parts.push(v === 0 ? t("{mind} 면역", { mind: t(MIND_NAME[k]) }) : t("{mind} 저항", { mind: t(MIND_NAME[k]) }));
  if (g.weapon) parts.push(t("피해 {a}d{b} · {stat} 기반", { a: g.weapon.dice[0], b: g.weapon.dice[1], stat: t(STAT_NAME[g.weapon.stat]) }));
  for (const [k, v] of Object.entries(g.bonus) as [keyof GearBonus, number][]) {
    if (v) parts.push(`${t(BONUS_LABEL[k])} ${v > 0 ? "+" : ""}${v}`);
  }
  const st = Object.entries(g.stats ?? {}) as [StatKey, number][];
  if (st.length === 6 && st.every(([, v]) => v === st[0][1])) parts.push(t("모든 능력치 +{n}", { n: st[0][1] }));
  else for (const [k, v] of st) parts.push(`${t(STAT_NAME[k])} +${v}`);
  if (g.rogueOff === "dagger") parts.push(t("두 라운드에 한 번 왼손 찌르기 1d3(로그)"));
  if (g.rogueOff === "flask") parts.push(t("4라운드마다 독병 — 적 전원 독·명중 −1(로그)"));
  if (g.rogueOff === "xbow") parts.push(t("볼트 1d6 · AC 2 관통 · 쏘고 나면 장전(로그)"));
  if (g.lifeSaves) parts.push(t("사망 방지 {n}회/미궁", { n: g.lifeSaves }));
  if (g.corrodeRes !== undefined) parts.push(g.corrodeRes === 0 ? t("부식되지 않음") : t("부식 확률 절반"));
  if (g.poisonRes) parts.push(t("독·마비 확률 절반"));
  if (g.moldRes) parts.push(t("곰팡이 폐병 확률 절반"));
  if (g.wade) parts.push(t("침수 방 이동 느려지지 않음"));
  if (g.swim) parts.push(t("헤엄 판정 +{n}", { n: g.swim }));
  if (g.critHeal) parts.push(t("치명타 시 HP +{n}", { n: g.critHeal }));
  if (g.tideHit) parts.push(t("물이 높을 때 명중 +{n}", { n: g.tideHit }));
  if (g.burnRes) parts.push(t("화상 확률 절반"));
  if (g.coldRes) parts.push(t("냉기 절반"));
  if (g.noHardSelf) parts.push(t("단단한 적에 손 안 다침"));
  if (g.trapFind) parts.push(t("함정 발견 +{n}", { n: g.trapFind }));
  if (g.trapDodge) parts.push(t("광차·얼음 회피 +{n}", { n: g.trapDodge }));
  if (g.gasSense) parts.push(t("가스 주머니를 미리 앎"));
  if (g.stagnantHit) parts.push(t("고임 때 명중 +{n}", { n: g.stagnantHit }));
  if (g.chillHit) parts.push(t("맞힌 적 명중 −1"));
  if (g.blastRes) parts.push(t("낙반·폭발·광차 피해 절반"));
  if (g.grabRes) parts.push(t("붙잡힐 확률 절반"));
  if (g.darkSight) parts.push(t("어둠(들숨) 페널티 없음"));
  if (g.ledge) parts.push(t("벼랑길 판정 +{n}", { n: g.ledge }));
  if (g.fallRes) parts.push(t("추락 피해 절반"));
  if (g.twoFace) parts.push(t("배부르면 방마다 HP +1, 굶주리면 피해 +2"));
  if (g.radianceRes) parts.push(t("성광 피해 절반"));
  if (g.purgeImmune) parts.push(t("정화 무효"));
  if (g.noRadiant) parts.push(t("성광 방에서 신앙심 감소 없음"));
  if (g.pietyCap) parts.push(t("신앙심 상한 +{n}", { n: g.pietyCap }));
  return parts.join(" · ");
}

/** 대충의 장비 가치(봇·자동 결정이 교체 여부를 판단할 때) */
export function gearScore(id: string | undefined): number {
  if (!id) return 0;
  const g = GEAR[id];
  const b = g.bonus;
  let v = (b.ac ?? 0) * 3 + (b.hit ?? 0) * 2 + (b.dmg ?? 0) * 2 + (b.crit ?? 0) * 0.5 + (b.hp ?? 0) * 0.7 + (b.flee ?? 0) * 0.3 + (b.perception ?? 0) * 0.5 + (b.potion ?? 0) * 0.5;
  if (g.weapon) v += g.weapon.dice[1] * g.weapon.dice[0];
  v += Object.values(g.stats ?? {}).reduce((a, x) => a + x, 0) * 2 + (g.lifeSaves ?? 0) * 20;
  v += (g.corrodeRes !== undefined ? 1 : 0) + (g.poisonRes ? 2 : 0) + (g.moldRes ? 2 : 0) + (g.wade ? 2 : 0) + (g.swim ? 1 : 0) + (g.critHeal ? 2 : 0) + (g.tideHit ? 1 : 0)
    + (g.burnRes ? 2 : 0) + (g.coldRes ? 2 : 0) + (g.noHardSelf ? 1 : 0) + (g.trapFind ? 1 : 0) + (g.trapDodge ? 1 : 0) + (g.gasSense ? 1 : 0) + (g.stagnantHit ? 1 : 0) + (g.chillHit ? 1 : 0) + (g.blastRes ? 2 : 0)
    + (g.grabRes ? 2 : 0) + (g.darkSight ? 1 : 0) + (g.ledge ? 2 : 0) + (g.fallRes ? 2 : 0) + (g.twoFace ? 3 : 0)
    + (g.radianceRes ? 3 : 0) + (g.purgeImmune ? 4 : 0) + (g.noRadiant ? 1 : 0) + (g.pietyCap ? 3 : 0);
  return v;
}

export function gearBonus(s: GameState, key: keyof GearBonus): number {
  let t = 0;
  for (const [slot, id] of Object.entries(s.gear)) if (id && slotWorks(s, slot)) t += corroded(GEAR[id]?.bonus[key] ?? 0, slot === "main" ? 0 : corrosionOf(s, slot));
  return t;
}

/** 부식될 수 있는 슬롯(3섹터, hazards.ts) */
export const CORRODE_SLOTS = ["main", "body", "offhand", "head"] as const;
export type CorrodeSlot = (typeof CORRODE_SLOTS)[number];
export const CORRODE_NAME = ["", "녹슮", "삭음", "못 쓸 지경"];

export function corrosionOf(s: GameState, slot: string): number {
  return (s.corrosion as Record<string, number> | undefined)?.[slot] ?? 0;
}

/** 부식된 방어구·장신구의 보너스: 1단계 −1, 2단계 절반(내림), 3단계 0. 마이너스 보정은 그대로 */
export function corroded(v: number, stage: number): number {
  if (v <= 0 || stage <= 0) return v;
  return stage === 1 ? v - 1 : stage === 2 ? Math.floor(v / 2) : 0;
}

/** 부식된 무기: 1단계 피해 −1, 2단계 피해 −1·명중 −2, 3단계 주사위 1d4·명중 −3 */
export function weaponCorrosion(s: GameState): { hit: number; dmg: number } {
  const st = s.gear.main && !mainLost(s) ? corrosionOf(s, "main") : 0;
  return st >= 3 ? { hit: -3, dmg: 0 } : st === 2 ? { hit: -2, dmg: -1 } : st === 1 ? { hit: 0, dmg: -1 } : { hit: 0, dmg: 0 };
}

/** 착용 장비 중 하나라도 가진 특성(슬롯이 제 기능을 할 때만) */
export function gearHas(s: GameState, pick: (g: GearDef) => number | boolean | undefined): GearDef[] {
  return Object.entries(s.gear).filter(([slot, id]) => id && slotWorks(s, slot) && pick(GEAR[id])).map(([, id]) => GEAR[id!]);
}

const FISTS: Weapon = { dice: [1, 2], stat: "str", verb: "주먹을 휘둘러" };

export function weaponOf(s: GameState): Weapon {
  const id = s.gear.main;
  if (mainLost(s)) return FISTS; // 오른손 결손(의수 없음)
  let w = (id && GEAR[id]?.weapon) || FISTS;
  if (w !== FISTS && corrosionOf(s, "main") >= 3 && w.dice[0] * w.dice[1] > 4) w = { ...w, dice: [1, 4] }; // 못 쓸 지경으로 삭았다
  // 마법사의 지팡이(지능 마력탄): 근접 페널티·자기 부상이 없다
  if (w.stat === "int") return { ...w, magic: true };
  if (w.finesse && s.hero.stats.dex > s.hero.stats.str) return { ...w, stat: "dex" };
  return w;
}

/** 쓸 수 있는 방패를 들고 있나(무기가 아닌 왼손 장비, 왼손 중상·결손이면 못 씀) */
export function hasShield(s: GameState): boolean {
  const id = s.gear.offhand;
  return !!id && !GEAR[id]?.weapon && !GEAR[id]?.rogueOff && slotWorks(s, "offhand");
}

/** 로그가 쓸 수 있는 왼손 무기(로그가 아니거나, 왼손을 못 쓰면 null) */
export function offOf(s: GameState): OffKind | null {
  const id = s.gear.offhand;
  if (s.hero.cls !== "rogue" || !id || !slotWorks(s, "offhand")) return null;
  return GEAR[id]?.rogueOff ?? null;
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

/** 장비가 주는 능력치 보정 */
export function gearStat(s: GameState, key: StatKey): number {
  let t = 0;
  for (const id of Object.values(s.gear)) if (id) t += GEAR[id]?.stats?.[key] ?? 0;
  return t;
}
