import type { StatKey } from "./types";

// 밸런스 수치는 전부 임시(DESIGN 12절 "미정"). 여기 한 곳에 모아 조정한다.
export const BAL = {
  startGold: 150,
  startStatSum: 30,
  statMax: 50,
  baseHp: 16,
  /** 레벨당 최소 HP 증가(CON 보정치가 이보다 낮을 때) */
  minHpPerLevel: 2,
  /** 숙련 보너스(공격 굴림). DESIGN에는 없는 임시 보정 — 레벨1이 1층 단독 몬스터를 감당하게 하는 용도 */
  proficiency: 2,
  trainCostPerLevel: 20,
  maxLevel: 16,
  taxBase: 50,
  taxPerRank: 40,
  weekTurns: 336,
  moveTurns: 4,
  campTurns: 16,
  starveLimitTurns: 48,
  peekDc: 12,
  trapDetectDc: 14,
  trapDodgeDc: 12,
  trapDisarmDc: 13,
  fleeDcBase: 10,
  prices: { food: 5, potion: 15, scroll: 45 },
} as const;

/** 대장간 장비(DESIGN 10절: 파워가 아니라 생존 최소 기준선). 숏소드는 기본 지급 */
export const GEAR: Record<string, { id: string; name: string; slot: "body" | "offhand" | "head"; ac: number; price: number; desc: string }> = {
  leather: { id: "leather", name: "가죽 갑옷", slot: "body", ac: 2, price: 50, desc: "몸통. AC +2" },
  shield: { id: "shield", name: "나무 방패", slot: "offhand", ac: 1, price: 25, desc: "왼손. AC +1" },
  cap: { id: "cap", name: "가죽 모자", slot: "head", ac: 1, price: 30, desc: "머리. AC +1" },
};

/** 장비 슬롯 9개(DESIGN 10절). 지금 상점에서 파는 건 몸통·왼손·머리뿐 */
export const EQUIP_SLOTS: { key: string; name: string }[] = [
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

/** 층이 깊을수록 마석 가치가 오른다 */
export const MANA_FLOOR_MULT = [0, 1, 1.5, 2];

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
}

// DESIGN 11절 "1섹터 몬스터(확정)" / "1섹터 보스"
export const MONSTERS: Record<string, MonsterDef> = {
  rat: { id: "rat", name: "쥐", hp: 4, ac: 12, atk: 2, dice: [1, 4], mana: 5, attackText: "물어뜯었다" },
  goblin: { id: "goblin", name: "고블린", hp: 7, ac: 12, atk: 3, dice: [1, 6], mana: 9, attackText: "녹슨 단검을 휘둘렀다" },
  skeleton: { id: "skeleton", name: "스켈레톤 병사", hp: 10, ac: 13, atk: 3, dice: [1, 8], mana: 15, attackText: "뼈 검을 내리쳤다" },
  boss: { id: "boss", name: "거대한 돌연변이 쥐", hp: 18, ac: 13, atk: 4, dice: [1, 8], mana: 60, attackText: "거대한 이빨로 물어뜯었다" },
};

/** 층별 조우 구성(DESIGN 11절 표): 1층 단독, 2층 무리+스켈레톤 첫 등장, 3층 다수 */
export const ENCOUNTERS: Record<number, { item: string[]; w: number }[]> = {
  1: [
    { item: ["rat"], w: 3 },
    { item: ["goblin"], w: 2 },
  ],
  2: [
    { item: ["goblin", "goblin"], w: 3 },
    { item: ["goblin"], w: 2 },
    { item: ["rat", "rat"], w: 3 },
    { item: ["rat", "rat", "rat"], w: 1 },
    { item: ["skeleton"], w: 2 },
  ],
  3: [
    { item: ["skeleton", "skeleton"], w: 3 },
    { item: ["goblin", "goblin", "goblin"], w: 2 },
    { item: ["skeleton", "goblin"], w: 2 },
    { item: ["rat", "rat", "rat"], w: 1 },
  ],
};

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
];

export const ARCHETYPES: { name: string; favor: [StatKey, StatKey] }[] = [
  { name: "힘쓰는 소년", favor: ["str", "con"] },
  { name: "날랜 소년", favor: ["dex", "luk"] },
  { name: "눈치 빠른 소년", favor: ["per", "dex"] },
  { name: "글 읽는 소년", favor: ["int", "per"] },
  { name: "질긴 소년", favor: ["con", "str"] },
  { name: "운 좋은 소년", favor: ["luk", "per"] },
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
  treasure: ["벽감 안에 낡은 상자가 놓여 있다.", "무너진 선반 아래 작은 궤짝이 보인다."],
  record: ["벽에 빽빽하게 글자가 새겨져 있다.", "바닥에 가죽 표지의 일지가 떨어져 있다."],
  shrine: ["이름 모를 신의 작은 제단이 있다. 성당의 상징과는 다르다.", "부서진 석상 앞에 누군가 꽃을 두고 갔다."],
  stairs: ["아래로 이어지는 계단이 보인다."],
  boss: ["거대한 그림자가 포탈 앞을 막고 있다. 쥐 떼가 그 주위를 맴돈다."],
  portal: ["보랏빛으로 일렁이는 차원문이 있다. 너머에서 낯선 바람이 분다."],
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
