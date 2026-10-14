import type { Codex, GameState, StatKey, Stats } from "./types";

// 편린(2026-10-13): 몬스터를 쓰러뜨리면 아주 드물게(최대 3%) 그 몬스터 힘의 조각이 남는다.
// 흡수하면 능력치가 오르고, 몬스터에 따라 패시브/액티브 능력이 붙는다(능력 없는 편린도 있다).
// 칸은 레벨 1에 1칸, 3레벨마다 1칸씩 늘어난다. 칸이 차면 기존 편린 하나를 깨뜨려야 새로 흡수할 수 있다.
// 흡수하지 않은 편린은 곧 흩어진다(미궁 밖으로 가지고 나갈 수 없다). 숲의 몬스터는 편린을 남기지 않는다.

export const FRAG_MAX_CHANCE = 0.03;

export interface FragmentDef {
  /** 몬스터 id와 같다 */
  id: string;
  name: string;
  /** 1 하급 · 2 중급 · 3 상급 · 4 보스 */
  tier: number;
  /** 쓰러뜨렸을 때 남을 확률(최대 3%) */
  chance: number;
  stats: Partial<Stats>;
  /** skills.ts의 기술 id(없으면 능력치만) */
  skill?: string;
  flavor: string;
}

export const TIER_LABEL = ["", "하급", "중급", "상급", "보스"];

export const FRAGMENTS: Record<string, FragmentDef> = {
  rat: { id: "rat", name: "쥐의 편린", tier: 1, chance: 0.015, stats: { dex: 2 }, flavor: "잿빛 털 한 올 같은 빛. 몸이 조금 재빨라진다." },
  goblin: { id: "goblin", name: "고블린의 편린", tier: 1, chance: 0.012, stats: { dex: 1, luk: 2 }, skill: "fragCoward", flavor: "녹슨 초록빛. 겁이 많아지지만, 그만큼 잘 산다." },
  skeleton: { id: "skeleton", name: "스켈레톤 병사의 편린", tier: 2, chance: 0.01, stats: { con: 3, str: 1 }, flavor: "뼛가루처럼 하얗다. 뼈마디가 단단해진다." },
  goldrat: { id: "goldrat", name: "마석 먹은 쥐의 편린", tier: 3, chance: 0.03, stats: { luk: 4, dex: 2 }, skill: "fragGoldNose", flavor: "금빛으로 번들거린다. 마석 냄새가 코끝에 걸린다." },
  jewelgoblin: { id: "jewelgoblin", name: "보석 박힌 고블린의 편린", tier: 3, chance: 0.03, stats: { dex: 4, luk: 2 }, skill: "fragJewelStab", flavor: "보석 조각이 박힌 듯 반짝인다. 손이 먼저 움직인다." },
  crystalskel: { id: "crystalskel", name: "마석 갑옷 스켈레톤의 편린", tier: 3, chance: 0.03, stats: { con: 4, str: 3 }, skill: "fragCrystalBone", flavor: "투명한 결정이 뼈를 따라 자라난다." },
  // 2섹터
  wolf: { id: "wolf", name: "들늑대의 편린", tier: 1, chance: 0.02, stats: { dex: 2, str: 1 }, flavor: "풀 냄새가 나는 회색 빛. 다리가 가벼워진다." },
  alphawolf: { id: "alphawolf", name: "우두머리 늑대의 편린", tier: 2, chance: 0.015, stats: { str: 2, con: 2 }, skill: "fragPack", flavor: "무리를 이끄는 눈빛이 옮아 온다." },
  crow: { id: "crow", name: "까마귀의 편린", tier: 1, chance: 0.03, stats: { per: 2 }, flavor: "검은 깃털 한 장 같은 빛. 눈이 밝아진다." },
  harpy: { id: "harpy", name: "하피의 편린", tier: 2, chance: 0.02, stats: { dex: 3 }, skill: "fragWing", flavor: "바람이 손끝에 감긴다." },
  warhorse: { id: "warhorse", name: "유령 군마의 편린", tier: 2, chance: 0.015, stats: { con: 3, str: 2 }, skill: "fragCharge", flavor: "말굽 소리가 심장 박동에 섞인다." },
  wraith: { id: "wraith", name: "망령 병사의 편린", tier: 2, chance: 0.015, stats: { con: 4 }, skill: "fragDeadNerve", flavor: "차갑고 무겁다. 두려움이 무엇이었는지 잊는다." },
  goldwolf: { id: "goldwolf", name: "금빛 털 늑대의 편린", tier: 3, chance: 0.03, stats: { luk: 4, dex: 3 }, skill: "fragGoldHunter", flavor: "금빛 털이 피부 아래에서 반짝인다." },
  manaharpy: { id: "manaharpy", name: "마석 깃털 하피의 편린", tier: 3, chance: 0.03, stats: { dex: 4, per: 2 }, skill: "fragManaFeather", flavor: "깃털처럼 가볍고 마석처럼 단단하다." },
  manawraith: { id: "manawraith", name: "마석 갑주 망령의 편린", tier: 3, chance: 0.03, stats: { con: 5, str: 3 }, skill: "fragManaArmor", flavor: "뼈 위로 마석 갑주가 자라난다." },
  harpyqueen: { id: "harpyqueen", name: "하피 여왕의 편린", tier: 3, chance: 0.03, stats: { dex: 5, luk: 2 }, skill: "fragQueenScream", flavor: "목구멍 깊은 곳에 비명이 깃든다." },
  general: { id: "general", name: "끝나지 않은 전쟁의 장군의 편린", tier: 4, chance: 0.03, stats: { str: 5, con: 5 }, skill: "fragVanguard", flavor: "아직 끝나지 않은 전쟁이 핏속에서 울린다." },
  // 미궁의 청소부: 쓰러뜨리면 반드시 남긴다(dungeon.ts 청소부 전투 뒤처리 — 일반 확률 굴림은 쓰지 않는다)
  sweeper1: { id: "sweeper1", name: "미궁의 청소부의 편린", tier: 4, chance: 0.03, stats: { str: 3, con: 3, per: 3 }, flavor: "먼지와 녹이 엉긴 잿빛. 머무는 법이 아니라 지나가는 법을 안다." },
  sweeper2: { id: "sweeper2", name: "전쟁터의 청소부의 편린", tier: 4, chance: 0.03, stats: { str: 4, con: 4, dex: 2, per: 2 }, flavor: "부러진 깃대의 나뭇결. 전쟁터를 끝까지 걸어 나온 자의 다리." },
  // 3섹터
  plaguerat: { id: "plaguerat", name: "역병 쥐떼의 편린", tier: 1, chance: 0.02, stats: { con: 2 }, flavor: "물에 젖은 잿빛. 병에 조금 무뎌진다." },
  leech: { id: "leech", name: "진흙 거머리의 편린", tier: 1, chance: 0.02, stats: { con: 1, dex: 1 }, skill: "fragLeech", flavor: "검붉게 맥동한다. 베어 낸 상처에서 기운을 빨아들인다." },
  toad: { id: "toad", name: "독두꺼비의 편린", tier: 2, chance: 0.015, stats: { con: 2, per: 1 }, skill: "fragToadSkin", flavor: "미끈한 녹색 빛. 피부가 독을 밀어낸다." },
  snail: { id: "snail", name: "산성 달팽이의 편린", tier: 2, chance: 0.015, stats: { con: 4 }, skill: "fragShell", flavor: "나선형으로 감긴 빛. 몸에 두른 쇠가 덜 삭는다." },
  mold: { id: "mold", name: "곰팡이 괴물의 편린", tier: 2, chance: 0.015, stats: { con: 3, str: 1 }, skill: "fragSporeArmor", flavor: "흰 포자가 피부 위로 피어난다. 때린 쪽이 기침을 한다." },
  shroudmold: { id: "shroudmold", name: "사제복 균사체의 편린", tier: 2, chance: 0.015, stats: { int: 3 }, skill: "fragMimicPrayer", flavor: "옛 기도문의 운율이 머릿속에 맴돈다." },
  gargoyle: { id: "gargoyle", name: "잠긴 석상의 편린", tier: 3, chance: 0.02, stats: { con: 4, str: 2 }, skill: "fragStatue", flavor: "차갑고 무거운 회색. 한순간 돌처럼 굳을 수 있다." },
  pearlleech: { id: "pearlleech", name: "진주 먹은 거머리의 편린", tier: 3, chance: 0.03, stats: { luk: 4, con: 3 }, skill: "fragGoldNose", flavor: "진주 빛이 혈관을 따라 흐른다. 마석 냄새가 코끝에 걸린다." },
  sporecap: { id: "sporecap", name: "마석 균모자의 편린", tier: 3, chance: 0.03, stats: { con: 4, int: 3 }, skill: "fragManaArmor", flavor: "마석 포자가 피부 아래에서 단단하게 맺힌다." },
  shellsnail: { id: "shellsnail", name: "마석 껍질 달팽이의 편린", tier: 3, chance: 0.03, stats: { str: 4, con: 4 }, skill: "fragCrystalBone", flavor: "마석 껍질이 뼈를 따라 감긴다." },
  drownedchoir: { id: "drownedchoir", name: "익사한 성가대의 편린", tier: 3, chance: 0.03, stats: { per: 4, int: 2 }, skill: "fragChoirBell", flavor: "귓가에 종소리가 남는다. 울리면 적이 멈칫한다." },
  mycomother: { id: "mycomother", name: "가라앉은 본당의 균모의 편린", tier: 4, chance: 0.03, stats: { con: 6, str: 3 }, skill: "fragMycelium", flavor: "몸속에 균사가 뿌리내린다. 상처가 저절로 메워진다." },
  sweeper3: { id: "sweeper3", name: "사원의 청소부의 편린", tier: 4, chance: 0.03, stats: { str: 4, con: 5, per: 3 }, flavor: "물이끼 낀 촉수의 감촉. 머물지 않는 자는 쓸려 가지 않는다." },
  // 4섹터
  emberbat: { id: "emberbat", name: "불씨 박쥐의 편린", tier: 1, chance: 0.02, stats: { dex: 2, per: 1 }, flavor: "불씨처럼 깜박이는 빛. 어둠 속에서도 눈이 밝다." },
  salamander: { id: "salamander", name: "불도롱뇽의 편린", tier: 2, chance: 0.015, stats: { con: 3, str: 1 }, skill: "fragFireSkin", flavor: "뜨겁고 미끈하다. 불이 살갗을 덜 태운다." },
  orebeetle: { id: "orebeetle", name: "광석 갑충의 편린", tier: 2, chance: 0.015, stats: { con: 5 }, skill: "fragOreShell", flavor: "광석 같은 무게. 무너지는 돌이 덜 아프다." },
  fireelem: { id: "fireelem", name: "화염 정령의 편린", tier: 2, chance: 0.015, stats: { int: 3, str: 1 }, skill: "fragEmber", flavor: "손끝에 불씨가 머문다." },
  burrower: { id: "burrower", name: "굴착 벌레의 편린", tier: 2, chance: 0.015, stats: { str: 3, con: 2 }, skill: "fragTremor", flavor: "발바닥으로 땅의 울림을 듣는다." },
  frostwraith: { id: "frostwraith", name: "서리 망령의 편린", tier: 2, chance: 0.015, stats: { per: 3, con: 2 }, skill: "fragColdBlood", flavor: "피가 차갑게 식는다. 추위가 덜 스민다." },
  icetroll: { id: "icetroll", name: "얼음 트롤의 편린", tier: 3, chance: 0.02, stats: { con: 5, str: 3 }, skill: "fragRegen", flavor: "상처가 얼어붙듯 아문다." },
  goldbat: { id: "goldbat", name: "금맥 박쥐의 편린", tier: 3, chance: 0.03, stats: { luk: 5, dex: 3 }, skill: "fragGoldHunter", flavor: "금가루가 날개처럼 흩날린다." },
  manabeetle: { id: "manabeetle", name: "마석 광석 갑충의 편린", tier: 3, chance: 0.03, stats: { con: 6, str: 3 }, skill: "fragManaArmor", flavor: "마석 광맥이 등뼈를 따라 자란다." },
  frostspirit: { id: "frostspirit", name: "마석 서리 정령의 편린", tier: 3, chance: 0.03, stats: { per: 5, int: 3 }, skill: "fragManaFeather", flavor: "얼음 결정이 마석처럼 빛난다." },
  cartmimic: { id: "cartmimic", name: "광차 미믹의 편린", tier: 3, chance: 0.03, stats: { str: 4, dex: 2 }, skill: "fragMimic", flavor: "무언가인 척하는 법을 안다. 첫 일격은 아무도 모른다." },
  furnacemother: { id: "furnacemother", name: "화로 어미 도롱뇽의 편린", tier: 4, chance: 0.03, stats: { con: 6, str: 4, int: 2 }, skill: "fragTwoBloods", flavor: "한쪽은 타오르고 한쪽은 얼어 있다. 불도 얼음도 몸을 다 가져가지는 못한다." },
  sweeper4: { id: "sweeper4", name: "갱도의 청소부의 편린", tier: 4, chance: 0.03, stats: { str: 5, con: 5, dex: 3 }, flavor: "녹슨 레일의 진동. 멈추지 않고 나아가는 법." },
  // 5섹터
  riftbat: { id: "riftbat", name: "균열 박쥐 떼의 편린", tier: 1, chance: 0.02, stats: { per: 2, dex: 1 }, skill: "fragEcho", flavor: "어둠 속에서 소리가 모양을 그린다." },
  tendril: { id: "tendril", name: "그림자 촉수의 편린", tier: 2, chance: 0.015, stats: { str: 3 }, skill: "fragWrap", flavor: "손끝이 길게 늘어나는 느낌. 붙잡는 법을 안다." },
  hungerwraith: { id: "hungerwraith", name: "굶주린 망령의 편린", tier: 2, chance: 0.015, stats: { con: 3, str: 1 }, skill: "fragEndureHunger", flavor: "배 속이 비어도 덜 괴롭다." },
  ledgespider: { id: "ledgespider", name: "벼랑 거미의 편린", tier: 2, chance: 0.015, stats: { dex: 3 }, skill: "fragSpiderFeet", flavor: "발끝이 벽에 달라붙는다." },
  voideye: { id: "voideye", name: "공허 눈의 편린", tier: 2, chance: 0.015, stats: { int: 2, per: 2 }, skill: "fragFaceVoid", flavor: "바닥을 마주 봐도 눈을 돌리지 않는다." },
  riftworm: { id: "riftworm", name: "균열 벌레의 편린", tier: 3, chance: 0.02, stats: { con: 5, str: 2 }, skill: "fragRockTooth", flavor: "이가 바위처럼 단단해진다. 단단한 것을 쳐도 손이 버틴다." },
  fallenheap: { id: "fallenheap", name: "낙하 잔해 덩어리의 편린", tier: 3, chance: 0.02, stats: { con: 6 }, skill: "fragFallen", flavor: "떨어진 것들의 무게. 떨어져도 덜 부서진다." },
  scalebat: { id: "scalebat", name: "마석 비늘 박쥐의 편린", tier: 3, chance: 0.03, stats: { luk: 6, dex: 3 }, skill: "fragGoldHunter", flavor: "마석 비늘이 피부에 돋는다." },
  manaeye: { id: "manaeye", name: "마석 눈동자의 편린", tier: 3, chance: 0.03, stats: { per: 6, int: 3 }, skill: "fragGoldNose", flavor: "마석 냄새가 눈에 보인다." },
  shellworm: { id: "shellworm", name: "마석 껍질 균열 벌레의 편린", tier: 3, chance: 0.03, stats: { con: 7, str: 2 }, skill: "fragManaArmor", flavor: "마석 껍질이 등을 덮는다." },
  hungermother: { id: "hungermother", name: "허기의 어미의 편린", tier: 3, chance: 0.03, stats: { con: 5, str: 3 }, skill: "fragDevour", flavor: "쓰러뜨린 것의 기운이 배를 채운다." },
  abyssmaw: { id: "abyssmaw", name: "심연의 아귀의 편린", tier: 4, chance: 0.03, stats: { str: 6, con: 6 }, skill: "fragEndlessHunger", flavor: "끝없는 허기가 힘이 된다." },
  sweeper5: { id: "sweeper5", name: "바닥의 청소부의 편린", tier: 4, chance: 0.03, stats: { str: 5, con: 5, dex: 3, per: 3 }, flavor: "떨어진 것들을 쓸어 담던 손. 머물지 않는 법." },
  // 6섹터
  litany: { id: "litany", name: "기도문 떼의 편린", tier: 1, chance: 0.03, stats: { int: 2, per: 1 }, flavor: "종잇조각 같은 빛. 글자들이 머릿속에서 줄을 선다." },
  censer: { id: "censer", name: "떠도는 향로의 편린", tier: 2, chance: 0.02, stats: { per: 3, int: 1 }, skill: "fragSmoke", flavor: "향 연기가 몸을 감싼다. 무엇이 머릿속을 흔들어도 연기가 먼저 받는다." },
  penitchain: { id: "penitchain", name: "참회의 사슬의 편린", tier: 2, chance: 0.02, stats: { str: 3, con: 2 }, skill: "fragChain", flavor: "손목에 가시 사슬의 감촉이 남는다. 먼저 묶는 법을 안다." },
  hollowknight: { id: "hollowknight", name: "빈 성갑의 편린", tier: 2, chance: 0.015, stats: { con: 5 }, skill: "fragHollow", flavor: "속이 빈 갑옷의 울림. 몸통이 갑옷처럼 비어 버린다." },
  waxfaithful: { id: "waxfaithful", name: "밀랍 신도의 편린", tier: 2, chance: 0.015, stats: { con: 3, luk: 2 }, skill: "fragMelt", flavor: "따뜻한 밀랍. 부서질 때 한 번 녹아내려 버틴다." },
  reliquary: { id: "reliquary", name: "저주받은 성물의 편린", tier: 3, chance: 0.02, stats: { int: 4, per: 2 }, skill: "fragFlip", flavor: "뒤집힌 성인의 뼈. 깎인 것을 반쯤 되돌린다." },
  executioner: { id: "executioner", name: "처형인의 갑주의 편린", tier: 3, chance: 0.02, stats: { str: 5, con: 2 }, skill: "fragExecute", flavor: "도끼의 무게가 팔에 남는다. 쓰러지기 직전의 것을 끝내는 법." },
  seraph: { id: "seraph", name: "눈 많은 날개의 편린", tier: 3, chance: 0.02, stats: { dex: 4, per: 3 }, skill: "fragManyEyes", flavor: "등 뒤에 눈이 하나 더 뜬 것 같다." },
  swallowed: { id: "swallowed", name: "삼켜진 것의 편린", tier: 3, chance: 0.02, stats: { con: 6, str: 2 }, skill: "fragNameBack", flavor: "삼켜졌던 이름 하나가 가슴에 내려앉는다." },
  candle: { id: "candle", name: "마석 촛대의 편린", tier: 3, chance: 0.03, stats: { luk: 7, per: 2 }, skill: "fragGoldNose", flavor: "꺼지지 않는 촛불 같은 마석 빛." },
  grail: { id: "grail", name: "마석 성배의 편린", tier: 3, chance: 0.03, stats: { luk: 7, dex: 2 }, skill: "fragGoldHunter", flavor: "비어 있어도 무겁다." },
  wingshard: { id: "wingshard", name: "마석 날개 조각의 편린", tier: 3, chance: 0.03, stats: { dex: 7, per: 2 }, skill: "fragManaFeather", flavor: "마석 깃털 하나가 등에 붙는다." },
  mitre: { id: "mitre", name: "주인 없는 주교관의 편린", tier: 3, chance: 0.03, stats: { int: 5, con: 3 }, skill: "fragSermon", flavor: "속이 빈 설교. 듣는 쪽이 먼저 맥이 빠진다." },
  guardian: { id: "guardian", name: "봉인의 수호자의 편린", tier: 4, chance: 0.03, stats: { con: 6, str: 4 }, skill: "fragTrial", flavor: "돌 시험관의 무게. 무엇이든 한 번 더 버텨 본다." },
  avatar: { id: "avatar", name: "짝을 삼킨 빛의 화신의 편린", tier: 4, chance: 0.03, stats: { str: 3, dex: 3, con: 3, int: 3, per: 3, luk: 3 }, skill: "fragSwallowLight", flavor: "삼켜진 빛을 다시 삼켰다. 흰빛이 더는 몸에 닿지 않는다." },
  judgeeye: { id: "judgeeye", name: "심판의 눈의 편린", tier: 4, chance: 0.03, stats: { str: 5, con: 5, per: 4, dex: 3 }, flavor: "천장에서 내려다보던 눈. 이제 그 눈으로 본다." },
  boss: { id: "boss", name: "거대한 돌연변이 쥐의 편린", tier: 4, chance: 0.03, stats: { str: 4, con: 4, dex: 1 }, skill: "fragFrenzy", flavor: "붉게 고동친다. 이빨이 근질거린다." },
};

/** 레벨 1에 1칸, 3레벨마다 1칸씩(Lv3 2칸, Lv6 3칸 …) */
export function fragSlots(level: number): number {
  return 1 + Math.floor(level / 3);
}

/** 지금 힘을 내는 편린(6섹터 화신의 삼킴으로 이 전투 동안 봉인된 것은 빼고) */
export function activeFragments(s: GameState): string[] {
  const sealed = s.combat?.fragSealed;
  return sealed?.length ? s.fragments.filter((id) => !sealed.includes(id)) : s.fragments;
}

export function fragStat(s: GameState, key: StatKey): number {
  let t = 0;
  for (const id of activeFragments(s)) t += FRAGMENTS[id]?.stats[key] ?? 0;
  return t;
}

export function fragSkills(s: GameState): string[] {
  return activeFragments(s).map((id) => FRAGMENTS[id]?.skill).filter((x): x is string => !!x);
}

const STAT_NAME: Record<StatKey, string> = { str: "힘", dex: "민첩", con: "체력", int: "지능", per: "감각", luk: "행운" };

export function fragStatText(id: string): string {
  return (Object.entries(FRAGMENTS[id].stats) as [StatKey, number][]).map(([k, v]) => `${STAT_NAME[k]} +${v}`).join(" · ");
}

export function emptyCodex(): Codex {
  return { seen: [], kills: {}, fragSeen: [], fragKnown: [] };
}

/** 두 도감을 합친다(처치 수는 큰 쪽) */
export function mergeCodex(a: Codex, b: Codex): Codex {
  const kills = { ...a.kills };
  for (const [k, v] of Object.entries(b.kills)) kills[k] = Math.max(kills[k] ?? 0, v);
  const u = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return { seen: u(a.seen, b.seen), kills, fragSeen: u(a.fragSeen, b.fragSeen), fragKnown: u(a.fragKnown, b.fragKnown) };
}

/** 흡수해 본 편린인지(아니면 능력치를 모른다) */
export function fragKnown(s: GameState, id: string): boolean {
  return s.codex.fragKnown.includes(id);
}

/** 봇·자동 결정용 대략 가치 */
export function fragScore(id: string): number {
  const f = FRAGMENTS[id];
  return f.tier * 10 + Object.values(f.stats).reduce((a, b) => a + (b ?? 0), 0) + (f.skill ? 3 : 0);
}
