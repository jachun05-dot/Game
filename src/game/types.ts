import type { RngState } from "./rng";

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
}

export type LogKind = "normal" | "hit" | "crit" | "miss" | "hurt" | "system" | "good" | "story" | "skill";

export interface LogLine {
  text: string;
  kind: LogKind;
}

export interface Enemy {
  uid: number;
  defId: string;
  hp: number;
  /** 남은 행동 불가 라운드(섬광 가루 등) */
  stun?: number;
  /** 약점 간파 등으로 깎인 AC */
  acDown?: number;
}

export interface CombatState {
  context: "field" | "dungeon";
  enemies: Enemy[];
  round: number;
  /** 전투에서 얻은 마석 가치(G) */
  loot: number;
  /** 액티브 기술별 이번 전투 사용 횟수 */
  used: Record<string, number>;
  /** 흘려내기 등 일시 AC 보너스 */
  guard: { ac: number; rounds: number } | null;
}

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
  | "portal";

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
  flavor: number;
}

export type Pending =
  | { kind: "trap" }
  | { kind: "treasure" }
  | { kind: "record" }
  | { kind: "shrine" }
  | { kind: "stairs" }
  | { kind: "portal" };

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
  /** 포만감 0 상태로 지난 턴 수 */
  starvingTurns: number;
  deepestFloor: number;
}

export type Activity = "train" | "rumor" | "field";

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
  manaSold: number;
  tax: number;
  goldAfter: number;
  paid: boolean;
  cleared: boolean;
  forced: boolean;
  lines: string[];
}

export type DeathCause = "mob" | "single" | "trap" | "starve" | "tax";

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
  seed: number;
  diedAt: string;
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
  inventory: { food: number; potion: number; scroll: number };
  /** 착용 장비(슬롯 → GEAR id). 숏소드는 항상 오른손 */
  gear: Partial<Record<"body" | "offhand" | "head", string>>;
  /** 배운 기술 id */
  skills: string[];
  tactics: Tactics;
  /** 미궁 한 번 들어갈 때 1회 쓰는 기술 중 이미 쓴 것 */
  tripUsed: string[];
  /** 클리어한 섹터 수(등급) */
  rank: number;
  recordsRead: number;
  /** 직전 레벨업 이후 행동 집계(행동 기반 스탯 2포인트, DESIGN 7절) */
  behavior: Stats;
  candidates: Candidate[];
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

export interface Meta {
  graveyard: Tomb[];
  faiths: string[];
}
