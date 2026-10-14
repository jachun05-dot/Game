import type { StatKey } from "./types";

// 밸런스 수치는 전부 임시(DESIGN 12절 "미정"). 여기 한 곳에 모아 조정한다.
export const BAL = {
  /** 모든 직업 0G로 시작(지급 장비·소모품은 classes.ts) */
  startGold: 0,
  /** 첫 달에는 직업교관이 훈련을 해 주지 않는다 */
  firstTrainMonth: 2,
  startStatSum: 30,
  statMax: 50,
  baseHp: 16,
  /** 레벨당 최소 HP 증가(CON 보정치가 이보다 낮을 때) */
  minHpPerLevel: 2,
  /** 숙련 보너스(공격 굴림). DESIGN에는 없는 임시 보정 — 레벨1이 1층 단독 몬스터를 감당하게 하는 용도 */
  proficiency: 2,
  trainCostPerLevel: 5,
  maxLevel: 16,
  taxBase: 20,
  /** 해가 바뀔 때마다 오르는 세금(1년차 30, 2년차 70, 3년차 110 …) */
  taxPerYear: 40,
  /** 등급(클리어한 섹터 수)에 따라 더 붙는 세금: 이름난 모험가에게 영주가 더 걷는다 */
  taxRank: [0, 120, 250, 250] as number[],
  /** 섹터별 마석 환전 배율(희귀 개체 포함) */
  manaSectorMult: [1, 1, 0.35, 1] as number[],
  /** 0보다 크면 레벨 1~3 훈련비 = trainCostBase + trainCostPerLevel × (레벨 − 1) (첫 훈련 값이 trainCostBase) */
  trainCostBase: 20,
  /** 레벨 4부터의 훈련비(레벨당). 0이면 레벨 1~3과 같은 식 — 초반(1섹터)은 싸게, 뒤로 갈수록 비싸게 */
  trainCostLate: 40,
  /** true면 예전 규칙: 마을에서 한 주를 보내거나 미궁에서 돌아오면 HP가 다 차고, 경상은 체력 판정으로 저절로 낫는다.
   *  false면 HP·부상은 여관(돈)·물약·붕대·야영으로만 회복한다 */
  freeHeal: false,
  /** 현상수배 중 외곽으로 나가면 떠돌이 교관을 만날 확률(그 주에 훈련할 수 있다): 처음 만날 때 / 한 번 만난 뒤 */
  outlawTrainerChance: 0.2,
  outlawTrainerChanceKnown: 0.5,
  /** 미궁의 청소부: 이 층에 도착한 뒤 예고 1·2, 나타남 턴(48 = 하루). 보통 한 층 탐색은 50~100턴 */
  sweeperTurns: [96, 120, 144] as [number, number, number],
  /** 청소부를 쓰러뜨린 보상 마석(섹터별, 섹터 배율 적용 안 함) */
  sweeperMana: [0, 400, 800] as number[],
  /** 매달 상점가 물가가 오르는 폭 [최소, 최대](0.05 = 5%). [0, 0]이면 오르지 않는다 */
  inflation: [0.05, 0.1] as [number, number],
  /** 특수 훈련(이 레벨 → 다음 레벨) 수련비 */
  specialTrainFee: { 6: 600 } as Record<number, number>,
  weekTurns: 336,
  moveTurns: 4,
  campTurns: 16,
  starveLimitTurns: 48,
  peekDc: 12,
  trapDetectDc: 14,
  trapDodgeDc: 12,
  trapDisarmDc: 13,
  fleeDcBase: 10,
  prices: { food: 5, potion: 6, scroll: 45, bandage: 25, herb: 25 },
  /** 치료 물약 회복량 = 2d4 + 이 값 */
  potionBase: 6,
  /** 이 레벨에서 다음 레벨로 가는 훈련은 보스 증표가 있어야 받을 수 있다 */
  heartGateLevel: 3,
  heartName: "거대 쥐의 마석 심장",
  /** 층마다 희귀 개체가 나올 확률 */
  rareChance: 0.008,
  /** 층마다 정예 희귀 개체(하피 여왕 등)가 나올 확률 — 마석 희귀 개체보다 조금 높게 */
  eliteChance: 0.012,
  /** 2섹터부터 낮·밤이 바뀌는 간격(턴, 12시간) */
  dayNightTurns: 24,
  /** 2·3층 함정방이 꺼진 바닥일 확률 */
  pitChance: 0.3,
  /** 리젠: 이 턴(8시간)마다 비운 전투방이 respawnChance 확률로 다시 채워진다. 리젠 몬스터 마석은 respawnManaMult배 */
  respawnEveryTurns: 16,
  respawnChance: 0.3,
  respawnManaMult: 0.15,
  /** 신전에서 편린 하나를 지우는 값 */
  fragEraseCost: 1000,
  /** 함정 발견 후 숨은 고블린을 알아채는 감각 DC */
  ambushSpotDc: 13,
} as const;

/** 층이 깊을수록 마석 가치가 오른다 */
export const MANA_FLOOR_MULT = [0, 1.8, 3, 3.8];

export const STAT_KEYS: StatKey[] = ["str", "dex", "con", "int", "per", "luk"];

export const STAT_LABEL: Record<StatKey, string> = {
  str: "힘",
  dex: "민첩",
  con: "체력",
  int: "지능",
  per: "감각",
  luk: "행운",
};

export interface MonsterDef {
  id: string;
  name: string;
  hp: number;
  ac: number;
  atk: number;
  dice: [number, number];
  /** 쓰러뜨리면 얻는 마석 가치(G) */
  mana: number;
  attackText: string;
  /** 성향 설명(로그·도감용) */
  note?: string;
  /** 맞았을 때 부상 부위 가중치(없으면 고르게). 예: 물어뜯기 = 손·발 */
  wound?: Partial<Record<"head" | "body" | "main" | "offhand" | "feet", number>>;
  /** 단단하다: 때리면 낮은 확률로 자기 손을 다친다 */
  hard?: boolean;
  /** 무리의 우두머리: 함께 있는 같은 무리(packOf)의 명중 +packBuff */
  packBuff?: number;
  packOf?: string;
  /** 공중: 근접 명중 −2(마력탄은 영향 없음) */
  flying?: boolean;
  /** 비명·울음: 명중했을 때 혼란 확률 */
  scream?: number;
  /** 함성: 명중했을 때 공포 확률 */
  fearHit?: number;
  /** 돌진: 전투 첫 공격 피해 2배 */
  charge?: boolean;
  /** 밤에 명중 +1 */
  nocturnal?: boolean;
  /** 낮에만 나온다(밤에는 조우에서 빠진다) */
  dayOnly?: boolean;
  /** 진군 명령: 3라운드마다 아군 명중 +2(최대 +2) */
  rally?: boolean;
  /** 정예 희귀 개체: 마석 보너스·도주 없이 고유 보상을 준다 */
  elite?: boolean;
  /** 사람(이단심문관 등): 도감·편린 없음 */
  human?: boolean;
  /** 희귀 개체: 마석이 층 배율 없이 그대로 들어오고, 몇 라운드 뒤 달아난다 */
  rare?: boolean;
  /** 이 라운드가 끝날 때까지 못 잡으면 달아난다 */
  escapeAfter?: number;
  /** 훈련소 허수아비: 공격하지 않는다(도감·조우에 없음) */
  dummy?: boolean;
  /** 히든: 마주치기 전에는 도감에 실루엣도 나오지 않는다 */
  hidden?: boolean;
}

// DESIGN 11절 "1섹터 몬스터(확정)" / "1섹터 보스"
export const MONSTERS: Record<string, MonsterDef> = {
  rat: { id: "rat", name: "쥐", wound: { main: 3, offhand: 3, feet: 3, body: 1 }, hp: 4, ac: 12, atk: 2, dice: [1, 4], mana: 5, attackText: "물어뜯었다" },
  goblin: { id: "goblin", name: "고블린", wound: { body: 3, main: 1, offhand: 1, feet: 1, head: 1 }, hp: 7, ac: 12, atk: 3, dice: [1, 6], mana: 9, attackText: "녹슨 단검을 휘둘렀다", note: "비겁하다. 함정 근처에 숨어 있다가 함정을 밟은 상대를 노린다. 함정이 해체되면 달아난다." },
  skeleton: { id: "skeleton", name: "스켈레톤 병사", wound: { head: 3, body: 1, main: 1, offhand: 1, feet: 1 }, hard: true, hp: 10, ac: 13, atk: 3, dice: [1, 8], mana: 15, attackText: "뼈 검을 내리쳤다" },
  // 희귀 개체 — 층마다 BAL.rareChance 확률로 전투방 하나에 단독 출현
  goldrat: { id: "goldrat", name: "마석 먹은 쥐", wound: { main: 3, offhand: 3, feet: 3, body: 1 }, hp: 8, ac: 15, atk: 1, dice: [1, 3], mana: 180, attackText: "번들거리는 이빨로 물었다", rare: true, escapeAfter: 3, note: "마석을 삼켜 배가 빛난다. 겁이 많아 금방 달아난다." },
  jewelgoblin: { id: "jewelgoblin", name: "보석 박힌 고블린", hp: 12, ac: 15, atk: 3, dice: [1, 4], mana: 200, attackText: "보석 박힌 곤봉을 휘둘렀다", rare: true, escapeAfter: 3, note: "훔친 마석을 몸에 박아 넣었다. 불리하면 바로 달아난다." },
  crystalskel: { id: "crystalskel", name: "마석 갑옷 스켈레톤", wound: { head: 3, body: 1, main: 1, offhand: 1, feet: 1 }, hard: true, hp: 16, ac: 16, atk: 4, dice: [1, 6], mana: 220, attackText: "마석 박힌 검을 내리쳤다", rare: true, escapeAfter: 4, note: "갑옷이 통째로 마석이다. 오래 머물지 않고 어둠 속으로 사라진다." },
  // 현상수배된 이단을 쫓는 성당의 사냥꾼. 1섹터 보스 무리와 맞먹는다. 사람이라 마석·편린은 없다
  inquisitor: { id: "inquisitor", name: "이단심문관", wound: { head: 3, body: 2, main: 1, offhand: 1, feet: 1 }, hp: 30, ac: 14, atk: 5, dice: [1, 8], mana: 0, human: true, attackText: "성인의 이름을 외치며 철퇴를 내리쳤다", note: "성당이 보낸 이단 사냥꾼. 이단을 따라 미궁 안까지 들어온다." },
  // ── 2섹터: 잊힌 전쟁터의 초원 ──
  wolf: { id: "wolf", name: "들늑대", wound: { main: 3, offhand: 2, feet: 3, body: 1 }, hp: 9, ac: 13, atk: 3, dice: [1, 6], mana: 14, nocturnal: true, attackText: "이빨을 박아 넣었다", note: "풀숲에서 무리 지어 다닌다. 밤이 되면 더 사나워진다." },
  alphawolf: { id: "alphawolf", name: "우두머리 늑대", wound: { main: 2, offhand: 2, feet: 3, body: 2 }, hp: 16, ac: 14, atk: 4, dice: [1, 8], mana: 26, nocturnal: true, packBuff: 1, packOf: "wolf", attackText: "목덜미를 노리고 덮쳤다", note: "무리를 이끈다. 곁에 있는 늑대들이 더 정확해진다." },
  crow: { id: "crow", name: "까마귀", wound: { head: 4, body: 1, main: 1, offhand: 1, feet: 1 }, hp: 5, ac: 12, atk: 3, dice: [1, 3], mana: 3, attackText: "눈을 노리고 쪼았다", note: "전쟁터의 시체를 먹고 자랐다. 4~6마리씩 떼로 몰려와 눈을 노린다." },
  harpy: { id: "harpy", name: "하피", wound: { head: 2, body: 1, main: 1, offhand: 1, feet: 1 }, hp: 12, ac: 14, atk: 3, dice: [1, 6], mana: 18, flying: true, scream: 0.1, dayOnly: true, attackText: "발톱으로 할퀴었다", note: "하늘에서 내려꽂힌다. 칼이 잘 닿지 않고, 비명은 머리를 어지럽힌다. 밤에는 둥지로 돌아간다." },
  warhorse: { id: "warhorse", name: "유령 군마", wound: { feet: 4, body: 2, main: 1, offhand: 1, head: 1 }, hp: 18, ac: 13, atk: 5, dice: [1, 8], mana: 30, charge: true, attackText: "말굽으로 짓밟았다", note: "주인을 잃고도 전장을 달린다. 첫 돌진이 가장 무섭다." },
  wraith: { id: "wraith", name: "망령 병사", wound: { head: 3, body: 2, main: 1, offhand: 1, feet: 1 }, hard: true, hp: 14, ac: 14, atk: 4, dice: [1, 8], mana: 24, fearHit: 0.1, attackText: "녹슨 창을 찔러 넣었다", note: "끝나지 않은 전쟁을 아직 싸우고 있다. 함성이 등골을 얼린다." },
  goldwolf: { id: "goldwolf", name: "금빛 털 늑대", wound: { main: 3, feet: 3, body: 1 }, hp: 14, ac: 16, atk: 3, dice: [1, 4], mana: 420, rare: true, escapeAfter: 3, attackText: "번쩍이는 이빨로 물었다", note: "털 한 올 한 올이 마석 가루로 빛난다. 겁이 많다." },
  manaharpy: { id: "manaharpy", name: "마석 깃털 하피", wound: { head: 2, body: 1 }, hp: 16, ac: 16, atk: 3, dice: [1, 4], mana: 460, rare: true, escapeAfter: 3, flying: true, attackText: "마석 깃털을 흩뿌렸다", note: "깃털이 마석이다. 금세 하늘로 달아난다." },
  manawraith: { id: "manawraith", name: "마석 갑주 망령", wound: { head: 3, body: 2 }, hard: true, hp: 22, ac: 17, atk: 4, dice: [1, 6], mana: 500, rare: true, escapeAfter: 4, attackText: "마석 갑주로 들이받았다", note: "갑주가 통째로 마석이다. 오래 머물지 않는다." },
  harpyqueen: { id: "harpyqueen", name: "하피 여왕", wound: { head: 3, body: 2, main: 1, offhand: 1, feet: 1 }, hp: 28, ac: 15, atk: 5, dice: [1, 8], mana: 40, flying: true, scream: 0.25, elite: true, attackText: "날카로운 발톱을 내리꽂았다", note: "하피들의 여왕. 비명이 머릿속을 헤집는다. 깃털 망토를 두르고 있다." },
  general: { id: "general", name: "끝나지 않은 전쟁의 장군", wound: { head: 2, body: 3, main: 2, offhand: 2, feet: 2 }, hard: true, hp: 28, ac: 15, atk: 4, dice: [1, 8], mana: 120, charge: true, rally: true, fearHit: 0.2, attackText: "유령 군마 위에서 장검을 내리쳤다", note: "유령 군마를 탄 망령 장군. 3라운드마다 진군 명령을 내린다." },
  // 미궁의 청소부(히든 보스, sweeper.ts): 실력에 비해 얕은 층에 오래 머물면 나타나 쫓아온다. 그 섹터보다 3섹터 위 보스 급
  sweeper1: { id: "sweeper1", name: "미궁의 청소부", hp: 260, ac: 22, atk: 12, dice: [3, 8], mana: 0, hard: true, fearHit: 0.3, hidden: true, wound: { head: 2, body: 3, main: 2, offhand: 2, feet: 2 }, attackText: "녹슨 갈퀴 같은 팔로 쓸어 냈다", note: "미궁은 한곳에 오래 머무는 것을 싫어한다. 층을 치우러 온다. 계단 아래까지는 쫓아오지 않는다." },
  sweeper2: { id: "sweeper2", name: "전쟁터의 청소부", hp: 330, ac: 24, atk: 14, dice: [3, 10], mana: 0, hard: true, fearHit: 0.3, hidden: true, wound: { head: 2, body: 3, main: 2, offhand: 2, feet: 2 }, attackText: "부러진 깃대들을 엮은 팔로 후려쳤다", note: "끝나지 않은 전쟁의 잔해를 치우는 거대한 것. 머무는 자도 잔해로 여긴다." },
  // 훈련소 허수아비(dummy.ts): 복사한 상태에서만 등장한다
  dummy: { id: "dummy", name: "짚 허수아비", hp: 30, ac: 13, atk: 0, dice: [1, 1], mana: 0, dummy: true, attackText: "흔들렸다" },
  dummyPack: { id: "dummyPack", name: "작은 허수아비", hp: 10, ac: 12, atk: 0, dice: [1, 1], mana: 0, dummy: true, attackText: "흔들렸다" },
  dummyArmor: { id: "dummyArmor", name: "갑옷 허수아비", hp: 30, ac: 15, atk: 0, dice: [1, 1], mana: 0, dummy: true, hard: true, attackText: "흔들렸다" },
  boss: { id: "boss", name: "거대한 돌연변이 쥐", wound: { head: 2, body: 2, main: 2, offhand: 2, feet: 2 }, hp: 18, ac: 13, atk: 4, dice: [1, 8], mana: 60, attackText: "거대한 이빨로 물어뜯었다" },
};

/** 층별 조우 구성(DESIGN 11절 표): 1층 단독, 2층 무리+스켈레톤 첫 등장, 3층 다수 */
export const ENCOUNTERS: Record<number, { item: string[]; w: number }[]> = {
  1: [
    { item: ["rat"], w: 2 },
    { item: ["goblin"], w: 2 },
  ],
  2: [
    { item: ["goblin", "goblin"], w: 5 },
    { item: ["goblin"], w: 2 },
    { item: ["rat", "rat"], w: 2 },
    { item: ["rat", "rat", "rat"], w: 1 },
    { item: ["skeleton"], w: 3 },
  ],
  3: [
    { item: ["skeleton", "goblin"], w: 2 },
    { item: ["skeleton"], w: 3 },
    { item: ["goblin", "goblin"], w: 2 },
    { item: ["skeleton", "skeleton"], w: 1 },
    { item: ["rat", "rat", "rat"], w: 2 },
  ],
};

/** 층마다 전투방 최소 개수(함정이 많아도 몬스터가 줄지 않게) */
export const MIN_COMBAT_ROOMS = [0, 2, 2, 2];
/** 함정방에 고블린이 숨어 있을 확률과 마릿수 */
export const TRAP_AMBUSH: { chance: number; size: [number, number] }[] = [
  { chance: 0, size: [0, 0] },
  { chance: 0.3, size: [1, 1] },
  { chance: 0.45, size: [1, 2] },
  { chance: 0.15, size: [1, 1] },
];
export const RARE_BY_FLOOR = ["", "goldrat", "jewelgoblin", "crystalskel"];

/** 섹터별 조우표(1섹터 = ENCOUNTERS) */
export const SECTOR_ENCOUNTERS: Record<number, Record<number, { item: string[]; w: number }[]>> = {
  1: ENCOUNTERS,
  2: {
    1: [
      { item: ["wolf"], w: 3 },
      { item: ["wolf", "wolf"], w: 2 },
      { item: ["crow", "crow", "crow", "crow"], w: 2 },
    ],
    2: [
      { item: ["wolf", "wolf"], w: 3 },
      { item: ["alphawolf", "wolf"], w: 2 },
      { item: ["harpy"], w: 2 },
      { item: ["harpy", "harpy"], w: 1 },
      { item: ["warhorse"], w: 2 },
    ],
    3: [
      { item: ["wraith", "wraith"], w: 2 },
      { item: ["wraith"], w: 3 },
      { item: ["warhorse", "wraith"], w: 2 },
      { item: ["crow", "crow", "crow", "crow", "crow", "crow"], w: 2 },
      { item: ["alphawolf", "wolf", "wolf"], w: 1 },
    ],
  },
};
/** 섹터별 마석 희귀 개체(층마다 BAL.rareChance) */
export const SECTOR_RARES: Record<number, string[]> = { 1: RARE_BY_FLOOR, 2: ["", "goldwolf", "manaharpy", "manawraith"] };
/** 섹터별 정예 희귀 개체(마석 대신 고유 보상) */
export const SECTOR_ELITES: Record<number, { id: string; escort: string[]; floors: number[]; reward: string }> = {
  2: { id: "harpyqueen", escort: ["harpy", "harpy"], floors: [2, 3], reward: "queencloak" },
};
/** 섹터별 보스 무리 */
export function bossGroup(sector: number, r: { int: (a: number, b: number) => number }): string[] {
  if (sector === 2) return ["general", "wraith", "wraith"];
  return ["boss", ...Array(r.int(2, 3)).fill("rat")];
}
/** 섹터별 보스 증표(처음 쓰러뜨릴 때 한 번만) — 이 레벨에서 다음 레벨로 가는 훈련의 대가 */
export const TROPHIES: { sector: number; item: "heart" | "banner"; name: string; gateLevel: number }[] = [
  { sector: 1, item: "heart", name: "거대 쥐의 마석 심장", gateLevel: 3 },
  { sector: 2, item: "banner", name: "장군의 녹슨 휘장", gateLevel: 6 },
];
/** 야영 중 기습하는 무리 */
export function campAmbush(sector: number, floor: number): string[] {
  if (sector === 2) return floor >= 2 ? ["wolf", "wolf"] : ["wolf"];
  return floor >= 2 ? ["rat", "rat"] : ["rat"];
}

export const FIELD_ENCOUNTERS: { item: string[]; w: number }[] = [
  { item: ["rat"], w: 3 },
  { item: ["goblin"], w: 2 },
  { item: ["rat", "rat"], w: 1 },
];

/** 훈련 종류 — 고정 2포인트가 오르는 스탯(DESIGN 7절). 패시브 스킬은 미정 */
/** 훈련 종류 — 고정 2포인트가 오르는 스탯과, 받을 때마다 차례로 배우는 기술 사다리(skills.ts) */
export const TRAININGS: { id: string; name: string; desc: string; stats: [StatKey, StatKey]; skills: string[] }[] = [
  { id: "sword", name: "검술 훈련", desc: "검을 휘두르는 법", stats: ["str", "con"], skills: ["firstStrike", "sweep", "finisher"] },
  { id: "footwork", name: "보법 훈련", desc: "피하고, 빠져나가는 법", stats: ["dex", "luk"], skills: ["lightFeet", "parry", "runner"] },
  { id: "scout", name: "척후 훈련", desc: "보고, 듣고, 알아채는 법", stats: ["per", "dex"], skills: ["sharpEye", "weakSpot", "trapSense"] },
  { id: "study", name: "학문 수업", desc: "옛 기록과 약초를 다루는 법", stats: ["int", "per"], skills: ["flashPowder", "firstAid", "poultice"] },
  { id: "endure", name: "생존 훈련", desc: "굶주림과 상처를 견디는 법", stats: ["con", "str"], skills: ["tough", "grit", "hungerTrained"] },
  { id: "warfare", name: "전장 훈련", desc: "전사 전용. 방패와 함성으로 싸우는 법", stats: ["str", "con"], skills: ["shieldBash", "warCry", "ironBody"] },
  { id: "arcane", name: "주문학", desc: "마법사 전용. 마력을 다루는 법", stats: ["int", "per"], skills: ["magicMissile", "fireBurst", "arcaneWard"] },
  // 마법사 원소 수련(elements.ts): 배우는 기술은 레벨마다 정해져 있다
  { id: "fire", name: "화염 수련", desc: "마법사 전용. 머리로 피우고 기세로 태운다", stats: ["int", "str"], skills: [] },
  { id: "frost", name: "서리 수련", desc: "마법사 전용. 묶어 두고 맞기 전에 끝낸다", stats: ["int", "per"], skills: [] },
  { id: "bolt", name: "번개 수련", desc: "마법사 전용. 빠르고 변덕스럽다", stats: ["int", "dex"], skills: [] },
  { id: "earth", name: "대지 수련", desc: "마법사 전용. 맞으면서 버틴다", stats: ["int", "con"], skills: [] },
  // 전사 방향 훈련(elements.ts STYLE_SKILLS): 배우는 기술은 레벨마다 정해져 있다
  { id: "guard", name: "수호 훈련", desc: "전사 전용. 방패를 들고 버티는 법", stats: ["str", "con"], skills: [] },
  { id: "glad", name: "검투 훈련", desc: "전사 전용. 빈틈을 찌르고 받아치는 법", stats: ["str", "dex"], skills: [] },
  // 모험가 갈래(elements.ts BRANCH_SKILLS)
  { id: "fighter", name: "전사형 훈련", desc: "모험가. 칼로 싸우는 법", stats: ["str", "con"], skills: [] },
  { id: "caster", name: "마법사형 훈련", desc: "모험가. 여러 원소의 잡다한 주문", stats: ["int", "per"], skills: [] },
  { id: "rogue", name: "민첩형 훈련", desc: "모험가. 먼저 찌르고 급소를 노리는 법", stats: ["dex", "luk"], skills: [] },
  { id: "berserk", name: "광전 훈련", desc: "전사 전용. 피를 보면 더 세게 휘두르는 법", stats: ["str", "str"], skills: [] },
];

export const NAMES = [
  "한결", "도윤", "시우", "태오", "은호", "이안", "준서", "하람", "로운", "새벽",
  "다온", "건우", "류하", "무진", "선우", "지환", "율", "찬", "겨울", "솔",
];

export const FAITH = {
  mob: "전쟁의 신",
  starve: "기아/풍요의 신",
  trap: "재앙(함정)의 신",
  tax: "탐욕/채무의 신",
  plague: "역병의 신",
  abyss: "심연의 신",
  oblivion: "망각의 신",
  song: "시와 노래의 신",
} as const;

export const INTRO = [
  "섬의 영지에는 미궁이 있다.",
  "미궁 깊은 곳 차원문 너머에 마법 셉터가 잠들어 있다는 소문이 돈다.",
  "셉터의 마법 때문에 미궁에는 열여섯 살 인간만 들어갈 수 있다.",
  "영주는 조건을 걸었다. 셉터를 찾으면 바칠 것. 그리고 매달 세금을 낼 것.",
  "올해 열여섯이 된 당신은, 모험가 등록소의 문을 열었다.",
];

export const RUMORS = [
  "술집 구석의 노인이 중얼거린다. \"성당이 생기기 전엔, 이 섬에 신이 여럿이었지.\"",
  "\"3층 포탈 근처에서 소만 한 쥐를 봤다\"는 이야기가 돈다.",
  "관공서 서기가 투덜댄다. \"세금 못 낸 녀석이 또 끌려갔어.\"",
  "\"함정은 발밑만 봐서는 못 피해. 벽 틈의 녹을 봐.\" 늙은 모험가의 충고다.",
  "성당 사제가 이단 심문 이야기를 하자 술집이 조용해진다.",
  "\"영주님은 늙지를 않아.\" 누군가 작게 말하고, 아무도 대꾸하지 않는다.",
  "묘지기가 말한다. \"묘비는 많은데, 이름을 기억하는 사람은 적지.\"",
  "\"미궁 안 기록물을 읽다 보면 노랫소리가 들린대.\" 음유시인의 이야기다.",
  "\"굶은 채로 미궁에 들어가면 쥐들이 먼저 냄새를 맡아.\"",
  "\"스켈레톤은 겁을 먹지 않아. 이미 죽었으니까.\"",
];

export const RIVALS = ["철수", "마리", "고든", "세라", "칼", "에단", "유나", "보리스"];

export const RIVAL_NEWS = [
  "%s 일행이 2층에서 돌아오지 않았다는 소문이 돈다.",
  "%s이(가) 고블린 무리를 혼자 해치웠다며 술값을 냈다.",
  "%s이(가) 세금을 못 내 관공서에 끌려갔다.",
  "%s이(가) 1섹터 포탈을 봤다고 떠벌린다.",
  "%s의 묘비가 새로 세워졌다.",
  "%s이(가) 대장간에서 새 칼을 샀다.",
];

export const ROOM_FLAVOR: Record<string, string[]> = {
  entrance: ["축축한 돌계단 아래, 횃불 몇 개가 겨우 어둠을 밀어낸다.", "찬 공기가 미궁 안쪽에서 불어온다."],
  arrival: ["계단을 내려오자 공기가 한층 무거워진다.", "위층보다 어둡다. 어디선가 물 떨어지는 소리가 난다."],
  empty: [
    "부서진 나무 상자들이 뒹구는 빈 방이다.",
    "벽에 긁힌 자국이 가득한 좁은 통로다.",
    "누군가 남긴 꺼진 모닥불 자국이 있다.",
    "천장에서 흙가루가 떨어진다. 조용하다.",
    "녹슨 쇠사슬이 벽에 걸려 있다. 아무도 없다.",
    "발밑에서 뼈 조각이 바스러진다.",
  ],
  combat: ["어둠 속에서 무언가 움직인다!", "날카로운 소리와 함께 그림자가 덤벼든다!", "숨소리가 들린다. 혼자가 아니다."],
  trap: ["바닥 돌의 결이 어딘가 어색하다.", "좁은 통로, 벽 틈에 녹슨 금속이 번뜩인다."],
  pit: ["바닥 한가운데가 새로 덮은 흙처럼 푸석하다.", "발밑에서 찬바람이 올라온다. 아래가 비어 있다."],
  treasure: ["벽감 안에 낡은 상자가 놓여 있다.", "무너진 선반 아래 작은 궤짝이 보인다."],
  record: ["벽에 빽빽하게 글자가 새겨져 있다.", "바닥에 가죽 표지의 일지가 떨어져 있다."],
  shrine: ["이름 모를 신의 작은 제단이 있다. 성당의 상징과는 다르다.", "부서진 석상 앞에 누군가 꽃을 두고 갔다."],
  stairs: ["아래로 이어지는 계단이 보인다."],
  boss: ["거대한 그림자가 포탈 앞을 막고 있다. 쥐 떼가 그 주위를 맴돈다."],
  portal: ["보랏빛으로 일렁이는 차원문이 있다. 너머에서 낯선 바람이 분다."],
  relic: ["녹슨 무기가 잔뜩 묻혀 있다."],
};

export const RECORDS = [
  "\"…짝을 잃은 신은 홀로 하늘에 앉았고, 다른 신들은 문 너머로 달아났다…\"",
  "\"셉터는 열쇠가 아니라 자물쇠다. 누구도 그것을 들어 올려서는 안 된다.\"",
  "\"나는 세 번째 달에 여기서 죽는다. 이 글을 읽는 너는 네 번째 달까지 살아라.\"",
  "\"굶주림의 신과 풍요의 신은 한 몸의 두 얼굴이었다.\"",
  "\"영주의 눈은 늙지 않는다. 그 눈은 사람의 것이 아니다.\"",
  "\"노래가 남는 한, 죽은 자는 완전히 잊히지 않는다.\"",
  "\"함정의 신은 경고를 먼저 보낸다. 다만 듣는 자가 드물 뿐.\"",
  "\"문 너머의 신들은 아직 기다리고 있다.\"",
];

export const FEED = {
  good: [
    "술집에서 당신 이름이 몇 번 오르내렸다.",
    "\"저 꼬마, 생각보다 오래 버티네.\"",
    "대장간 주인이 처음으로 고개를 끄덕였다.",
  ],
  bad: [
    "\"저 애도 다음 달이면 묘지에 있겠지.\"",
    "관공서 서기가 당신 이름을 장부에서 찾느라 한참 걸렸다.",
    "아무도 당신을 눈여겨보지 않는다.",
  ],
};

/** 섹터별 방 묘사(없는 키는 ROOM_FLAVOR) */
export const SECTOR_FLAVOR: Record<number, Partial<Record<string, string[]>>> = {
  2: {
    arrival: ["차원문을 빠져나오자 하늘이 있다. 끝없는 풀밭 위로 바람이 지나간다.", "풀이 허리까지 자란 구릉이다. 멀리서 까마귀가 운다."],
    empty: [
      "바람에 눕는 풀밭. 아무것도 없다.",
      "무너진 초소의 돌담이 반쯤 풀에 묻혀 있다.",
      "작은 개울이 흐른다. 물이 차갑다.",
      "부러진 창이 땅에 꽂힌 채 녹슬어 있다.",
      "풀숲에 짐승이 쉬었다 간 자국이 있다.",
      "하늘이 너무 넓어서 오히려 숨이 막힌다.",
    ],
    combat: ["풀숲이 흔들린다. 바람이 아니다.", "낮게 으르렁거리는 소리가 사방에서 좁혀 온다.", "바람에 실려 오던 함성이 갑자기 가까워졌다."],
    trap: ["풀 사이로 녹슨 쇠붙이가 언뜻 보인다.", "땅이 이상하게 무르다. 무언가 묻혀 있다."],
    pit: ["오래된 참호 위를 풀이 덮었다. 발밑이 비어 있다.", "땅이 꺼진 자국이 길게 이어진다. 옛 참호다."],
    treasure: ["쓰러진 군마의 안장 주머니가 그대로 남아 있다.", "무너진 막사 안에 녹슨 상자가 있다."],
    record: ["바위에 누군가 칼끝으로 긁어 쓴 글이 있다.", "찢어진 군기 안쪽에 빼곡한 글씨가 남아 있다."],
    shrine: ["창과 방패를 쌓아 만든 제단. 전쟁의 신에게 바친 것이다.", "피로 얼룩진 돌기둥 앞에 녹슨 투구가 놓여 있다."],
    relic: ["녹슨 무기와 찢어진 깃발이 풀 속에 잔뜩 묻혀 있다.", "옛 전투가 끝난 그 자리 그대로다. 뼈와 갑옷이 뒤엉켜 있다."],
    stairs: ["구릉 아래로 이어지는 비탈길이 보인다."],
    boss: ["말 탄 그림자가 차원문 앞을 막고 섰다. 망령 병사들이 그 곁에 줄을 맞춘다."],
    portal: ["풀밭 한가운데, 하늘이 찢어진 듯 차원문이 일렁인다."],
  },
};

/** 2섹터 기록물: 신들의 전쟁 */
export const WAR_RECORDS = [
  "\"우리는 짝을 잃은 신을 위해 싸웠다. 아무도 이기지 못했다.\"",
  "\"전쟁의 신은 승리를 주지 않는다. 다만 싸울 이유를 준다.\"",
  "\"유일한 자가 문을 닫기 전에, 우리 신들은 이 들판을 건너 달아났다.\"",
  "\"장군은 아직도 진군 명령을 기다린다. 명령을 내릴 이는 이미 없다.\"",
  "\"셉터가 있는 한 문은 열리지 않는다. 그것이 우리가 지킨 전부다.\"",
];
