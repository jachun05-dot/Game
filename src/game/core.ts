import { BAL, FAITH, GEAR, STAT_KEYS } from "./data";
import { Rng } from "./rng";
import type { DeathCause, GameState, LogKind, StatKey, Stats } from "./types";

export function rngOf(s: GameState): Rng {
  return new Rng(s.rng);
}

/** 상태 변경 함수 호출 뒤에도 TS 타입 좁히기에 걸리지 않게 함수로 확인한다 */
export function isDead(s: GameState): boolean {
  return s.phase === "dead";
}

export function mod(v: number): number {
  return Math.floor(v / 5);
}

export function maxHp(s: GameState): number {
  // DESIGN 7·8절: CON 보정치가 레벨마다 고정 누적. 기본 HP는 미정이라 임시값.
  return BAL.baseHp + Math.max(BAL.minHpPerLevel, mod(s.hero.stats.con)) * s.hero.level;
}

export function heroAc(s: GameState): number {
  const gearAc = Object.values(s.gear).reduce((a, id) => a + (id ? GEAR[id].ac : 0), 0);
  return 10 + mod(s.hero.stats.dex) + gearAc;
}

export function actionsPerRound(s: GameState): number {
  return 1 + (s.hero.stats.dex >= 35 ? 1 : 0);
}

/** 굶주림·탈진 판정 페널티 */
export function rollPenalty(s: GameState): number {
  let p = 0;
  if (s.hero.satiety <= 0) p -= 2;
  if (s.hero.fatigue >= 100) p -= 2;
  return p;
}

/** d20 + 보정치 vs DC. 자연 1 자동 실패, 자연 20 자동 성공(DESIGN 8절) */
export function check(s: GameState, stat: StatKey, dc: number): { ok: boolean; roll: number; total: number } {
  const roll = rngOf(s).die(20);
  const total = roll + mod(s.hero.stats[stat]) + rollPenalty(s);
  const ok = roll === 20 || (roll !== 1 && total >= dc);
  return { ok, roll, total };
}

export function log(s: GameState, text: string, kind: LogKind = "normal"): void {
  s.log.push({ text, kind });
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
}

export function emptyStats(): Stats {
  return { str: 0, dex: 0, con: 0, int: 0, per: 0, luk: 0 };
}

export function addStat(s: GameState, key: StatKey, n: number): void {
  s.hero.stats[key] = Math.min(BAL.statMax, s.hero.stats[key] + n);
}

export function note(s: GameState, key: StatKey): void {
  s.behavior[key] += 1;
}

export function topBehavior(s: GameState): StatKey[] {
  return [...STAT_KEYS].sort((a, b) => s.behavior[b] - s.behavior[a]);
}

export function taxDue(s: GameState): number {
  return BAL.taxBase + BAL.taxPerRank * s.rank;
}

const CAUSE_TEXT: Record<DeathCause, string> = {
  mob: "여러 적에게 둘러싸여 쓰러졌다",
  single: "싸우다 쓰러졌다",
  trap: "함정에 목숨을 잃었다",
  starve: "굶어 죽었다",
  tax: "세금을 내지 못해 처형당했다",
};

const CAUSE_FAITH: Partial<Record<DeathCause, string>> = {
  mob: FAITH.mob,
  trap: FAITH.trap,
  starve: FAITH.starve,
  tax: FAITH.tax,
};

export function kill(s: GameState, cause: DeathCause, detail?: string): void {
  const faiths: string[] = [];
  const f = CAUSE_FAITH[cause];
  if (f) faiths.push(f);
  if (s.recordsRead >= 10) faiths.push(FAITH.song);

  const d = s.dungeon;
  const reached = d ? `${d.sector}섹터 ${d.floor}층` : s.rank > 0 ? `${s.rank}섹터 클리어` : "마을";
  const months = s.month;
  const epitaph = buildEpitaph(s, cause);

  s.tomb = {
    id: `${s.seed}-${s.month}-${s.week}-${s.log.length}`,
    name: s.hero.name,
    level: s.hero.level,
    months,
    reached,
    cause: detail ?? CAUSE_TEXT[cause],
    faithsUnlocked: faiths,
    epitaph,
    faith: s.hero.faith,
    seed: s.seed,
    diedAt: new Date().toISOString(),
  };
  s.combat = null;
  s.phase = "dead";
  log(s, `${s.hero.name}은(는) ${detail ?? CAUSE_TEXT[cause]}.`, "hurt");
  for (const fa of faiths) log(s, `— ${fa}의 신앙이 해금되었다.`, "story");
}

function buildEpitaph(s: GameState, cause: DeathCause): string {
  const parts: string[] = [`영지의 열여섯 살 소년, 모험가가 되었다.`];
  if (s.hero.level > 1) parts.push(`${s.hero.level}레벨까지 훈련받았다.`);
  parts.push(...s.history.slice(-3));
  if (s.recordsRead > 0) parts.push(`미궁의 기록물 ${s.recordsRead}개를 읽었다.`);
  parts.push(`${s.month}번째 달에 ${CAUSE_TEXT[cause]}.`);
  return parts.join(" ");
}
