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
  /** 3섹터 사원의 청소부 등 끝없는 미궁에서 강해진 몬스터: 최대 HP·명중·피해·AC 보정 */
  hpMax?: number;
  atkUp?: number;
  dmgUp?: number;
  acUp?: number;
  /** 독 바른 칼: 남은 라운드와 라운드 피해 주사위 */
  venom?: { rounds: number; dice: [number, number] };
  /** 한 번 쓰러졌다가 다시 일어섰다(화신 2단계) */
  reborn?: boolean;
  /** 빚 독촉(탐욕의 가르침): 남은 라운드 — 받는 피해 2배, 쓰러지면 마석 ×3 */
  debt?: number;
  /** 이름 지우기(망각의 가르침): 행동 불가인 동안 내 공격은 치명타 */
  forgotten?: boolean;
}

/** 허수아비 측정용 피해 기록. rounds의 칸 = 측정 시작부터 센 라운드 */
export interface DamageMeter {
  by: Record<string, number>;
  rounds: number[];
  /** 이번 전투 앞에 이미 지난 라운드 수 */
  base: number;
  swings: number;
  hits: number;
  crits: number;
}

export interface CombatState {
  /** dummy: 훈련소 허수아비(dummy.ts) — 복사한 상태에서만 쓰고 보상·기록이 없다 */
  context: "field" | "dungeon" | "dummy" | "final" | "chase";
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
  /** 허수아비: 이 라운드 수까지만 싸운다 */
  limit?: number;
  /** 허수아비: 준 피해 기록(출처별·라운드별) */
  meter?: DamageMeter;
  /** 전쟁의 신 ★4 "최후의 돌격": 이 전투 동안 명중 +2, 피해 +3 */
  lastStand?: boolean;
  /** 성벽: 남은 라운드 동안 받는 피해 절반 */
  halfRounds?: number;
  /** 광폭화: 남은 라운드·라운드당 추가 공격·받는 피해 증가 */
  fury?: { rounds: number; extra: number; taken: number };
  /** 고통이 힘: 맞은 횟수만큼 피해 +(최대 5) */
  pain?: number;
  /** 화로 어미가 동굴을 무너뜨렸다(한 번) */
  caveIn?: boolean;
  /** 5섹터 붙잡기: 다음 라운드 행동 불가 */
  grabbed?: boolean;
  /** 심연의 아귀: 다시 자란 촉수 수, 다시 자랄 라운드 */
  regrow?: { count: number; at: number[] };
  /** 끝나지 않는 전쟁(전쟁의 신 ★5): 쌓인 피해 보너스 */
  warStack?: number;
  // ── 모험가 신의 가르침(faith.ts TEACHINGS) ──
  /** 전쟁: 이 전투에서 쓰러뜨린 수(피해 +, 최대 5) / 최후의 군세 남은 라운드 */
  teachKills?: number;
  legion?: number;
  /** 영웅의 노래로 일어섰다: 명중 +3·피해 +3 */
  heroSong?: boolean;
  /** 이번 전투에서 쓴 마지막 기술 */
  finalUsed?: boolean;
  // ── 6섹터(temple.ts) ──
  /** 참회의 사슬: 이 전투 도주 DC + */
  fleeLock?: number;
  /** 화신·아바타의 삼킴: 이 전투 동안 봉인된 ★ 수 / 봉인된 편린(무신앙) */
  sealed?: number;
  fragSealed?: string[];
  /** 옛 신들의 응답: 아직 오지 않은 응답(신 이름) */
  answers?: string[];
  /** ★5 화신전 특례를 이미 썼다(탐욕·시와 노래의 한 번 버티기, 망각의 첫 성광 무효) */
  specialUsed?: string[];
  /** 봉인의 수호자에게 져서 문 밖에 쓰러졌다(전투가 끝나고 직전 방으로) */
  ejected?: boolean;
  /** 벼랑에서 끌려 떨어졌다(전투가 끝나고 아래로) */
  dragged?: boolean;
}

/** 자동 결정의 미궁 목표: 구석구석 탐험 / 빠르게 다음 층 / 파밍(전투·상자 위주) */
export type AutoGoal = "explore" | "rush" | "farm";

/** 자동 전투 방침(플레이어가 고르는 유일한 전투 설정) */
export interface Tactics {
  /** HP가 이 %이하면 물약을 마신다(0 = 안 마심) */
  potionAt: number;
  /** HP가 이 %이하면 도주를 시도한다(0 = 끝까지 싸움) */
  fleeAt: number;
  /** 미궁에서 배가 고프면 식량을 알아서 먹는다(없으면 켜짐) */
  autoEat?: boolean;
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
  | "relic"
  /** 3섹터: 공양 제단(조사하면 낡은 장비·독·역병의 신 기록물, 역병의 신도는 기도) */
  | "altar"
  /** 4섹터: 버려진 화약고(조사하면 화약통·낡은 장비·재앙의 신 기록물, 재앙의 신도는 기도) */
  | "magazine"
  /** 5섹터: 풍요의 제단(고기를 바치면 풍요 또는 기아의 얼굴) */
  | "plenty"
  /** 6섹터: 봉헌함(조사하면 마석·성물·불탄 문서) / 심문관의 고해실(2층) / 옛 신들의 제단(3층) / 셉터의 제단(3층 끝) */
  | "offerbox"
  | "confession"
  | "altars"
  | "scepter";

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
  /** 함정 종류(기본 가시함정, pit = 꺼진 바닥: 떨어지면 아래층으로). 4섹터: collapse 낙반·cart 폭주 광차·gas 가스 주머니·steam 증기 분출·ice 얇은 얼음 */
  trapKind?: "spike" | "pit" | "collapse" | "cart" | "gas" | "steam" | "ice" | "ledge" | "rune" | "weight" | "mirror";
  /** 숨은 고블린을 알아챘는지 */
  ambushKnown?: boolean;
  /** 비웠던 전투방에 몬스터가 다시 들어왔다(마석 절반) */
  respawned?: boolean;
  /** 3섹터: 물에 잠긴 방(물이 높을 때 이동 시간 ×1.5) / 깊은 물(헤엄, 이동 ×2) */
  flooded?: boolean;
  deep?: boolean;
  /** 3섹터: 물이 낮을 때 바닥의 공양물(작은 마석)을 주울 수 있다 */
  offering?: boolean;
  /** 4섹터: 뜨거운 방(고임 때 발 화상) / 얼음 구역(냉기) / 지하수 웅덩이(화상 회복, 한 번) */
  hot?: boolean;
  ice?: boolean;
  pool?: boolean;
  /** 5섹터: 벼랑 위 전투방(벼랑 거미가 살고, 붙잡히거나 밀리면 아래로 떨어진다) */
  cliff?: boolean;
  /** 6섹터: 성광 방(들어서면 신앙심 −3, 이 방 전투에서 신앙 명중·피해 보정 절반) */
  radiant?: boolean;
  flavor: number;
}

export type Pending =
  | { kind: "trap" }
  | { kind: "treasure" }
  | { kind: "record" }
  | { kind: "shrine" }
  | { kind: "relic" }
  | { kind: "altar" }
  | { kind: "magazine" }
  | { kind: "plenty" }
  | { kind: "offerbox" }
  | { kind: "confession" }
  | { kind: "altars" }
  | { kind: "scepter" }
  | { kind: "stairs" }
  /** 첫 미궁의 1층 계단: 내려갈 수 없고, 떨어진 귀환 주문서를 쓸지 고른다 */
  | { kind: "lostScroll" }
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
  /** 끝없는 미궁(마지막 섹터 차원문 너머, endless.ts): floor = 끝없는 미궁 몇 층 */
  endless?: boolean;
  /** 이번 삶의 첫 미궁(1월): 2층으로 내려갈 수 없다 */
  first?: boolean;
  /** 이 층에 도착한 뒤 흐른 턴(미궁의 청소부 시계) */
  floorTurns?: number;
  /** 청소부 예고 단계(0 없음, 1·2 예고, 3 나타남) */
  sweeperStage?: number;
  /** 청소부가 있는 방(나타난 뒤) */
  sweeperRoom?: number | null;
  /** 이 층의 청소부를 쓰러뜨렸다 */
  sweeperDown?: boolean;
  /** 청소부 전투가 어디서 시작됐나(방 이동 / 야영) */
  sweeperFrom?: "move" | "camp";
  /** 시와 노래의 신 ★4 "영웅담": 이 미궁에서 읽은 기록물만큼 명중·판정 +(최대 3) */
  saga?: number;
  /** 재앙의 신 ★4 "함정 다루기": 해체한 함정을 다음 전투 시작 때 터뜨린다 */
  trapCharge?: boolean;
  /** 4섹터 폭주 광차: 전철기를 돌려 다음 전투의 첫 적에게 굴러간다(피해 주사위 수) */
  cartCharge?: number;
  /** 3섹터 클리어 뒤 숏컷으로 곧장 4섹터에 들어왔다 */
  shortcut?: boolean;
  /** 5섹터 풍요의 제단 "기아의 얼굴": 이 층(번호)에서 피해 +2 */
  famineFloor?: number;
  /** 재앙의 신 ★5 "재앙의 주인": 가방에 넣은 함정(최대 2) */
  trapStock?: number;
  /** 시와 노래의 신 ★5 "노래가 된 이름": 이 미궁 동안 최대 HP +(최대 10) */
  songHp?: number;
  /** 6섹터 옛 신의 향: 지금 피운 향으로 남은 정화 막기 횟수 */
  incense?: number;
  /** 6섹터 3층 옛 신들의 제단에서 기도해 등록한 응답(신 이름) — 화신전에서 한 번씩 돕는다 */
  answers?: string[];
  /** 이 미궁에서 옛 신들의 제단에 이미 기도했다 */
  prayedAltars?: boolean;
  /** 이 미궁 안에서 개종했다(갓 섬긴 신은 모험가에게 16레벨을 가르치지 않는다) */
  converted?: boolean;
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
  /** 탐욕의 신 ★4 "피의 값"으로 처형을 면했다(최대 HP −5) */
  blood?: boolean;
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

/** 엔딩(6섹터 셉터의 제단): 헌납(일반) / 결전 승리(진엔딩) / 결전 패배 */
export type EndingKind = "offering" | "true" | "fallen" | "escape";

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
  /** 엔딩 묘비(죽음이 아니라 엔딩으로 끝난 삶) */
  ending?: EndingKind;
  /** 엔딩 글(엔딩 화면) */
  epilogue?: string[];
}

export interface Candidate {
  archetype: string;
  stats: Stats;
}

export type Phase = "create" | "town" | "week-result" | "dungeon" | "settlement" | "dead";

export interface GameState {
  version: 1;
  /** 저장 형식 판(src/save/migrate.ts SAVE_REV). 없으면 0(판 표시 이전 저장) */
  saveRev?: number;
  seed: number;
  rng: RngState;
  phase: Phase;
  hero: Hero;
  month: number;
  /** 1~3 마을, 4 던전 */
  week: number;
  gold: number;
  /** heart: 1섹터 보스가 남기는 "거대 쥐의 마석 심장"(레벨 3→4 훈련 대가) */
  /** banner: 2섹터 "장군의 녹슨 휘장", spore: 3섹터 "균모의 포자낭". whetstone 숫돌(부식), antidote 해독초(독·마비) */
  inventory: { food: number; potion: number; scroll: number; heart: number; banner: number; spore: number; scale: number; fang: number; salve: number; firewood: number; powder: number; rope: number; incense: number; bandage: number; herb: number; whetstone: number; antidote: number };
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
  /** 질병 단계(0~2) */
  disease: number;
  /** 질병 종류(없으면 쥐 열병). mold = 곰팡이 폐병(3섹터, 야영 회복 절반) */
  diseaseKind?: "rat" | "mold";
  /** 3섹터 부식(hazards.ts): 장비 슬롯별 0~3. 장비는 부서지지 않고 단계별 패널티만 */
  corrosion?: Partial<Record<"main" | "body" | "offhand" | "head", number>>;
  /** 3섹터 마비: 부위별 0~2(결손 없음). 미궁을 나오면 풀린다 */
  paralysis?: Partial<Record<"main" | "offhand" | "feet", number>>;
  /** 3섹터 독(중독): 0~2. 야영·미궁을 나올 때마다 한 단계 */
  poison?: number;
  /** 탐욕의 신 ★4 "피의 값"을 썼다(삶마다 1회): 최대 HP −5 */
  bloodPrice?: boolean;
  /** 4섹터 화상·동상(fire.ts): 부상 단계를 올린 원인 표시(부위별) */
  injuryCause?: Partial<Record<"head" | "body" | "main" | "offhand" | "feet", "burn" | "frost">>;
  /** 화상 중상 뒤 치료 없이 치른 전투 수(부위별, 3번 넘으면 결손 판정) */
  burnFights?: Partial<Record<"head" | "body" | "main" | "offhand" | "feet", number>>;
  /** 냉기(0~4): 4가 되면 손·발 하나에 동상 */
  cold?: number;
  /** 정신 상태이상(mind.ts). 있으면 걸린 것, known이면 눈치채서 화면에 보인다 */
  mind: Partial<Record<"fear" | "rage" | "confusion" | "despair", { known: boolean }>>;
  /** 섬기는 신의 신앙심(0~100, faith.ts) */
  piety: number;
  /** 6섹터 옛 신들의 제단에서 받은 섬기는 신의 유물(삶마다 하나, 그 신을 섬기는 동안만 힘을 낸다) */
  relic?: string;
  /** 모험가 히든 16레벨: 가르침을 준 신(faith.ts TEACHINGS) */
  godTeaching?: string;
  /** 진실 조각(truth.ts) — 삶을 넘어 쌓인다(새 삶 시작 때 Meta에서 복사, 바뀌면 다시 Meta에 합친다) */
  clues?: string[];
  /** 조각의 반쪽(늙지 않는 영주: 소문과 기록을 둘 다 봐야 한다) */
  clueBits?: string[];
  /** 이번 삶에서 영주의 칙서를 직접 얻었다(진엔딩 필수) */
  edict?: boolean;
  /** 진엔딩 결전: 옛 신들의 응답(셉터를 두고 나올 때 제단에서 등록한 응답의 두 배) */
  finalAnswers?: string[];
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
  /** 현상수배 중 외곽에서 떠돌이 교관을 찾아본 주("월-주")와 만났는지 */
  outlawTrainer?: { week: string; met: boolean };
  /** 떠돌이 교관을 한 번이라도 만났다(그다음부터는 찾기 쉽다) */
  outlawTrainerKnown?: boolean;
  /** 상점가 물가 배율(매달 오른다, 없으면 1) */
  priceIndex?: number;
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
  /** 진실 조각(삶을 넘어 쌓인다) */
  clues?: string[];
  /** 본 엔딩 */
  endings?: string[];
  /** 저장 형식 판(src/save/migrate.ts SAVE_REV) */
  saveRev?: number;
}
