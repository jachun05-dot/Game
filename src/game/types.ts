import type { RngState } from "./rng";
import type { ClassId } from "./classes";
import type { SlotKey } from "./gear";

export type StatKey = "str" | "dex" | "con" | "int" | "per" | "luk";
export type Stats = Record<StatKey, number>;

export interface Hero {
  name: string;
  stats: Stats;
  level: number;
  hp: number;
  /** 0~100. 0이 되면 굶주림(판정 -2), 그 상태로 오래 버티면 아사 */
  satiety: number;
  /** 0~100. 100이면 탈진(판정 -2) */
  fatigue: number;
  faith: string | null;
  cls: ClassId;
}

export type LogKind = "normal" | "hit" | "crit" | "miss" | "hurt" | "system" | "good" | "story" | "skill";

export interface LogLine {
  text: string;
  kind: LogKind;
  /** 몬스터 등장 줄: 나타난 몬스터 id(화면에서 그림으로 보여 준다) */
  mons?: string[];
  /** 접힌 전투의 세부 줄(이 번호의 요약 줄을 누르면 펼쳐진다) */
  fold?: number;
  /** 접힌 전투의 요약 줄: 접힌 번호와 줄 수 */
  foldOf?: number;
  foldN?: number;
}

export interface Enemy {
  uid: number;
  defId: string;
  hp: number;
  /** 남은 행동 불가 라운드(섬광 가루 등) */
  stun?: number;
  /** 약점 간파 등으로 깎인 AC */
  acDown?: number;
  /** 희귀 개체가 달아났음 */
  fled?: boolean;
  /** 역병의 신 ★2 "전염"으로 병들었다(라운드마다 1d3) */
  sick?: boolean;
  /** 마법사 원소: 불탐(남은 라운드, 라운드마다 1d3 + bonus) */
  burn?: { rounds: number; bonus: number };
  /** 명중 감소(서리 안개·정전기) */
  hitDown?: { n: number; rounds: number };
  /** 감전(뇌격): 남은 라운드 동안 50% 확률로 행동 실패 */
  shock?: number;
  /** 손버릇으로 찔렀다(쓰러뜨리면 마석 ×1.5) */
  stolen?: boolean;
}

export interface CombatState {
  context: "field" | "dungeon";
  enemies: Enemy[];
  round: number;
  /** 전투에서 얻은 마석 가치(G, 층 배율 적용 전) */
  loot: number;
  /** 희귀 개체 마석(층 배율 없이 그대로) */
  bonus: number;
  /** 액티브 기술별 이번 전투 사용 횟수 */
  used: Record<string, number>;
  /** 이번 전투에서 남은 편린(몬스터 id) */
  frags: string[];
  /** 진군 명령으로 쌓인 아군 명중 보너스 */
  rally?: number;
  /** 돌진을 이미 쓴 적 uid */
  charged?: number[];
  /** 연속으로 맞은 횟수(분노) */
  streak?: number;
  /** 이번 전투에서 HP 20% 이하 공포 판정을 했다 */
  fearRolled?: boolean;
  /** 발작: 이번 라운드 적 공격이 모두 치명타 */
  frenzy?: boolean;
  /** 전쟁의 신 ★3 "피의 함성": 남은 라운드 동안 적 명중 −2 */
  cow?: number;
  /** 흘려내기 등 일시 AC 보너스 */
  guard: { ac: number; rounds: number; freeze?: number; reduce?: number; counter?: boolean } | null;
  /** 바위 감옥: 이번 라운드 받는 피해 절반 */
  halfDmg?: boolean;
  /** 광란: 남은 라운드 동안 라운드마다 한 번 더 공격 */
  rampage?: number;
  /** 연막: 이 전투의 도주 보너스 */
  smoke?: number;
  /** 로그 접기: 이 전투가 시작된 로그 번호(등장 줄)와 시작 HP */
  logFrom?: number;
  hpStart?: number;
}

/** 자동 결정의 미궁 목표: 구석구석 탐험 / 빠르게 다음 층 / 파밍(전투·상자 위주) */
export type AutoGoal = "explore" | "rush" | "farm";

/** 자동 전투 방침(플레이어가 고르는 유일한 전투 설정) */
export interface Tactics {
  /** HP가 이 %이하면 물약을 마신다(0 = 안 마심) */
  potionAt: number;
  /** HP가 이 %이하면 도주를 시도한다(0 = 끝까지 싸움) */
  fleeAt: number;
}

export type RoomType =
  | "entrance"
  | "empty"
  | "combat"
  | "trap"
  | "treasure"
  | "record"
  | "shrine"
  | "stairs"
  | "boss"
  | "portal"
  /** 2섹터: 전쟁의 흔적(조사하면 낡은 장비·망령·기록물) */
  | "relic";

export interface Room {
  id: number;
  type: RoomType;
  edges: number[];
  /** 입구에서의 거리(지도 배치용) */
  depth: number;
  visited: boolean;
  /** 종류가 드러났는지(들어가 봤거나 감각 판정으로 미리 알아냄) */
  known: boolean;
  /** 방의 사건이 끝났는지(전투 승리, 함정 처리, 상자 열기 등) */
  resolved: boolean;
  /** 전투방·보스방의 적 구성(몬스터 id 목록) */
  encounter?: string[];
  /** 전투에서 도망쳤을 때 남은 적 상태 */
  remaining?: Enemy[];
  /** 함정방에 숨어 있는 고블린(함정을 밟으면 덮친다) */
  ambush?: string[];
  /** 함정 종류(기본 가시함정, pit = 꺼진 바닥: 떨어지면 아래층으로) */
  trapKind?: "spike" | "pit";
  /** 숨은 고블린을 알아챘는지 */
  ambushKnown?: boolean;
  /** 비웠던 전투방에 몬스터가 다시 들어왔다(마석 절반) */
  respawned?: boolean;
  flavor: number;
}

export type Pending =
  | { kind: "trap" }
  | { kind: "treasure" }
  | { kind: "record" }
  | { kind: "shrine" }
  | { kind: "relic" }
  | { kind: "stairs" }
  | { kind: "portal" }
  | { kind: "gear"; item: string }
  /** 편린(fragments.ts) — 흡수하거나, 칸이 차 있으면 하나를 깨뜨리고 흡수하거나, 흩어지게 둔다 */
  | { kind: "frag"; frag: string };

export interface DungeonState {
  sector: number;
  floor: number;
  rooms: Room[];
  current: number;
  prev: number | null;
  turnsLeft: number;
  /** 들고 있는 마석 가치(G). 귀환해야 환전된다 */
  mana: number;
  pending: Pending | null;
  /** 지금 선택이 끝나면 이어서 띄울 선택(보스 처치 후 편린 → 장비 등) */
  queue?: Pending[];
  /** 포만감 0 상태로 지난 턴 수 */
  starvingTurns: number;
  deepestFloor: number;
  /** 이 섹터에 들어온 뒤 흐른 턴(낮·밤 계산) */
  clock?: number;
  /** 리젠 판정까지 쌓인 턴 */
  respawnClock?: number;
}

export type Activity = "train" | "rumor" | "field" | "inn";

export interface WeekResult {
  month: number;
  week: number;
  title: string;
  lines: string[];
  statDelta: Partial<Stats>;
  levelUp?: { from: number; to: number };
  /** 이번 훈련으로 배운 기술 id */
  learned?: string;
  goldDelta: number;
  feed: string[];
}

export interface Settlement {
  month: number;
  /** 이단 심문에 걸렸다(신앙 포기 / 거부를 골라야 정산이 끝난다) */
  inquisition?: boolean;
  /** 탐욕의 신 ★3 "빚 문서"로 이번 세금을 외상으로 넘겼다 */
  debt?: boolean;
  manaSold: number;
  tax: number;
  goldAfter: number;
  paid: boolean;
  cleared: boolean;
  /** 차원문에 닿은 섹터(cleared일 때) */
  sector?: number;
  forced: boolean;
  lines: string[];
}

export type DeathCause = "mob" | "single" | "trap" | "starve" | "tax" | "plague" | "abyss" | "oblivion";

export interface Tomb {
  id: string;
  name: string;
  level: number;
  months: number;
  reached: string;
  cause: string;
  faithsUnlocked: string[];
  epitaph: string;
  faith: string | null;
  className?: string;
  seed: number;
  diedAt: string;
  /** 죽은 순간의 상태와 다음 판 조언(autopsy.ts). 옛 묘비에는 없다 */
  notes?: { facts: string[]; hints: string[] };
}

export interface Candidate {
  archetype: string;
  stats: Stats;
}

export type Phase = "create" | "town" | "week-result" | "dungeon" | "settlement" | "dead";

export interface GameState {
  version: 1;
  seed: number;
  rng: RngState;
  phase: Phase;
  hero: Hero;
  month: number;
  /** 1~3 마을, 4 던전 */
  week: number;
  gold: number;
  /** heart: 1섹터 보스가 남기는 "거대 쥐의 마석 심장"(레벨 3→4 훈련 대가) */
  inventory: { food: number; potion: number; scroll: number; heart: number; banner: number; bandage: number; herb: number };
  /** 이미 얻은 보스 증표(섹터마다 한 번만 나온다) */
  trophies: string[];
  /** 착용 장비(슬롯 → gear.ts의 GEAR id) */
  gear: Partial<Record<SlotKey, string>>;
  /** 배운 기술 id */
  skills: string[];
  /** 마법사: 4레벨 특수 훈련에서 처음 특화한 원소(지팡이 마력탄이 이 원소의 주 능력치를 따른다) */
  mainElement?: "fire" | "frost" | "bolt" | "earth";
  /** 흡수한 편린(fragments.ts의 id). 칸 수는 fragSlots(level) */
  fragments: string[];
  /** 부위 부상 단계(injury.ts): 0 멀쩡함 · 1 경상 · 2 중상 · 3 결손 */
  injuries: Record<"head" | "body" | "main" | "offhand" | "feet", number>;
  /** 결손 부위에 단 의수·의족 */
  prosthetic: Partial<Record<"head" | "body" | "main" | "offhand" | "feet", boolean>>;
  /** 쥐 열병 단계(0~2) */
  disease: number;
  /** 정신 상태이상(mind.ts). 있으면 걸린 것, known이면 눈치채서 화면에 보인다 */
  mind: Partial<Record<"fear" | "rage" | "confusion" | "despair", { known: boolean }>>;
  /** 섬기는 신의 신앙심(0~100, faith.ts) */
  piety: number;
  /** 개종으로 버린 신의 저주 */
  curse?: { god: string; months: number };
  /** 이단 심문을 거부해 현상수배 중: 마을은 외곽만, 미궁에 이단심문관이 나타난다 */
  heretic: boolean;
  /** 탐욕의 신 "빚 문서"를 이미 썼다(삶마다 1회) */
  debtUsed?: boolean;
  /** 다음 세금에 더해질 외상 */
  debt?: number;
  /** 이번 삶에서 고를 수 있는 신(새 삶 시작 때 Meta에서 복사) */
  faithsKnown: string[];
  /** 몬스터 도감. 새 삶을 시작할 때 Meta의 도감을 복사해 오고, 바뀌면 다시 Meta에 합친다 */
  codex: Codex;
  tactics: Tactics;
  /** 자동 결정이 미궁에서 노리는 목표(bot.ts) */
  autoGoal: AutoGoal;
  /** 미궁 한 번 들어갈 때 1회 쓰는 기술 중 이미 쓴 것 */
  tripUsed: string[];
  /** 클리어한 섹터 수(등급) */
  rank: number;
  recordsRead: number;
  /** 직전 레벨업 이후 행동 집계(행동 기반 스탯 2포인트, DESIGN 7절) */
  behavior: Stats;
  candidates: Candidate[];
  /** 직업별로 이미 뽑은 후보(직업을 바꿨다 돌아와도 같은 후보가 남는다) */
  candidatePool?: Partial<Record<ClassId, Candidate[]>>;
  rerollsLeft: number;
  log: LogLine[];
  /** 지금까지 쌓인 로그 총 개수(오래된 줄이 잘려도 화면 표시 위치 계산용) */
  logCount: number;
  combat: CombatState | null;
  dungeon: DungeonState | null;
  weekResult: WeekResult | null;
  settlement: Settlement | null;
  tomb: Tomb | null;
  /** 묘비 요약용 주요 사건 */
  history: string[];
  nextUid: number;
}

/** 몬스터 도감(삶을 넘어 이어진다 — Meta에 합쳐 저장) */
export interface Codex {
  /** 마주친 몬스터 id */
  seen: string[];
  /** 몬스터별 처치 수 */
  kills: Record<string, number>;
  /** 떨어지는 걸 본 편린 */
  fragSeen: string[];
  /** 흡수해 본 편린(이것만 능력치를 안다) */
  fragKnown: string[];
}

export interface Meta {
  graveyard: Tomb[];
  faiths: string[];
  codex: Codex;
  /** 이미 본 처음 안내(src/ui/tips.ts) */
  tipsSeen?: string[];
  /** 처음 안내 끄기 */
  tipsOff?: boolean;
}
