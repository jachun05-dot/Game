import { BAL, FAITH, STAT_KEYS } from "./data";
import { CLASSES } from "./classes";
import { Rng } from "./rng";
import { passive } from "./skills";
import { fragStat } from "./fragments";
import { abyssEdge, faithMaxHp, power, relicAc } from "./faith";
import { rageAc, rollMindPenalty } from "./mind";
import { deathNotes } from "./autopsy";
import { fallenEpilogue } from "./truth";
import { GEAR, gearStat } from "./gear";
import { injuryAc, injuryMaxHp, injuryRollPenalty, offhandAcPenalty } from "./injury";
import type { DeathCause, GameState, LogKind, StatKey, Stats } from "./types";
import { t, tk } from "../i18n/core";

export function rngOf(s: GameState): Rng {
  return new Rng(s.rng);
}

/** 상태 변경 함수 호출 뒤에도 TS 타입 좁히기에 걸리지 않게 함수로 확인한다 */
export function isDead(s: GameState): boolean {
  return s.phase === "dead";
}

/** 실제 능력치 = 타고난/훈련 능력치 + 편린 보정 + 장비 보정(테스터 부적) */
export function stat(s: GameState, key: StatKey): number {
  return Math.min(BAL.statMax, s.hero.stats[key] + fragStat(s, key) + gearStat(s, key));
}

/** 능력치 보정치 */
export function smod(s: GameState, key: StatKey): number {
  return mod(stat(s, key));
}

export function mod(v: number): number {
  return Math.floor(v / 5);
}

export function maxHp(s: GameState): number {
  // DESIGN 7·8절: CON 보정치가 레벨마다 고정 누적. 기본 HP는 미정이라 임시값.
  const cls = CLASSES[s.hero.cls];
  return Math.max(1, BAL.baseHp + cls.hp + (Math.max(BAL.minHpPerLevel, smod(s, "con")) + cls.hpPerLevel) * s.hero.level + passive(s, "hp") + injuryMaxHp(s) + faithMaxHp(s) - (s.bloodPrice ? 5 : 0) + (s.dungeon?.songHp ?? 0));
}

export function heroAc(s: GameState): number {
  return 10 + smod(s, "dex") + passive(s, "ac") + injuryAc(s) + offhandAcPenalty(s) + rageAc(s) + abyssEdge(s, s.hero.hp / maxHp(s)).ac
    + (power(s, "greed", 5) && s.dungeon ? Math.min(3, Math.floor(s.dungeon.mana / 1000)) : 0) // 탐욕의 신 ★5 "황금의 몸"
    + relicAc(s); // 6섹터 유물
}

export function actionsPerRound(s: GameState): number {
  return 1 + (stat(s, "dex") >= 35 ? 1 : 0);
}

/** 굶주림·탈진 판정 페널티 */
export function rollPenalty(s: GameState): number {
  let p = 0;
  if (s.hero.satiety <= 0 && !power(s, "hunger", 2)) p -= 2; // 기아/풍요의 신 ★2
  p += injuryRollPenalty(s); // 머리 부상·질병
  p += rollMindPenalty(s); // 절망
  if (s.hero.fatigue >= 100) p -= 2;
  return p;
}

/** d20 + 보정치 vs DC. 자연 1 자동 실패, 자연 20 자동 성공(DESIGN 8절) */
export function check(s: GameState, stat: StatKey, dc: number, bonus = 0): { ok: boolean; roll: number; total: number } {
  const roll = rngOf(s).die(20);
  const total = roll + bonus + smod(s, stat) + rollPenalty(s) + sagaBonus(s) + passive(s, "check") + (stat === "per" ? passive(s, "perception") : 0);
  const ok = roll === 20 || (roll !== 1 && total >= dc);
  return { ok, roll, total };
}

/** 시와 노래의 신 ★4 "영웅담": 이 미궁에서 읽은 기록물만큼 명중·판정 +(최대 3) */
export function sagaBonus(s: GameState): number {
  return Math.min(3, s.dungeon?.saga ?? 0);
}

export function log(s: GameState, text: string, kind: LogKind = "normal"): void {
  s.log.push({ text, kind });
  s.logCount += 1;
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
}

export function emptyStats(): Stats {
  return { str: 0, dex: 0, con: 0, int: 0, per: 0, luk: 0 };
}

export function addStat(s: GameState, key: StatKey, n: number): void {
  s.hero.stats[key] = Math.min(BAL.statMax, s.hero.stats[key] + n);
}

/** 묘비 요약용 사건 기록(같은 문장은 한 번만) */
export function remember(s: GameState, line: string): void {
  if (!s.history.includes(line)) s.history.push(line);
}

export function note(s: GameState, key: StatKey): void {
  s.behavior[key] += 1;
}

export function topBehavior(s: GameState): StatKey[] {
  return [...STAT_KEYS].sort((a, b) => s.behavior[b] - s.behavior[a]);
}

/** 몇 년차인지(1~12월 = 1년차) */
export function yearOf(month: number): number {
  return Math.floor((month - 1) / 12) + 1;
}

/** 그 달 1주차에 내는 세금. 해가 바뀔 때마다 오르고, 등급(클리어한 섹터 수)이 높을수록 더 붙는다 */
export function taxDue(month: number, rank = 0): number {
  return BAL.taxBase + BAL.taxPerYear * (yearOf(month) - 1) + (BAL.taxRank[Math.min(rank, BAL.taxRank.length - 1)] ?? 0);
}

const CAUSE_TEXT: Record<DeathCause, string> = {
  mob: tk("여러 적에게 둘러싸여 쓰러졌다"),
  single: tk("싸우다 쓰러졌다"),
  trap: tk("함정에 목숨을 잃었다"),
  starve: tk("굶어 죽었다"),
  tax: tk("세금을 내지 못해 처형당했다"),
  plague: tk("병에 걸려 쓰러졌다"),
  abyss: tk("깊은 곳으로 떨어져 죽었다"),
  oblivion: tk("머리를 잃었다"),
};

const CAUSE_FAITH: Partial<Record<DeathCause, string>> = {
  mob: FAITH.mob,
  trap: FAITH.trap,
  starve: FAITH.starve,
  tax: FAITH.tax,
  plague: FAITH.plague,
  abyss: FAITH.abyss,
  oblivion: FAITH.oblivion,
};

export function kill(s: GameState, cause: DeathCause, detail?: string): void {
  if (cause !== "tax" && lifeSave(s, detail ?? t(CAUSE_TEXT[cause]))) return;
  const faiths: string[] = [];
  const f = CAUSE_FAITH[cause];
  if (f) faiths.push(f);
  if (s.recordsRead >= 10) faiths.push(FAITH.song);

  const d = s.dungeon;
  // 진엔딩 결전(영주성)에서 쓰러졌다: 일반 사망이 아니라 "영주에게 맞선 자" 묘비
  const fallen = s.combat?.context === "final";
  const reached = fallen ? t("영주성") : s.combat?.context === "chase" ? t("영지의 골목") : d ? (d.endless ? t("끝없는 미궁 {floor}층", { floor: d.floor }) : t("{sector}섹터 {floor}층", { sector: d.sector, floor: d.floor })) : s.rank > 0 ? t("{n}섹터 클리어", { n: s.rank }) : t("마을");
  const months = s.month;
  const epitaph = buildEpitaph(s, cause);

  s.tomb = {
    id: `${s.seed}-${s.month}-${s.week}-${s.log.length}`,
    name: s.hero.name,
    level: s.hero.level,
    months,
    reached,
    cause: detail ?? t(CAUSE_TEXT[cause]),
    faithsUnlocked: faiths,
    epitaph,
    faith: s.hero.faith,
    className: CLASSES[s.hero.cls].name,
    seed: s.seed,
    diedAt: new Date().toISOString(),
    notes: deathNotes(s, cause),
    ...(fallen ? { ending: "fallen" as const, epilogue: fallenEpilogue() } : {}),
  };
  s.combat = null;
  s.phase = "dead";
  log(s, t("{name|은} {cause}.", { name: t(s.hero.name), cause: detail ?? t(CAUSE_TEXT[cause]) }), "hurt");
  for (const fa of faiths) log(s, t("— {faith}의 신앙이 해금되었다.", { faith: t(fa) }), "story");
}

/** 테스터 부적: 미궁에 들어갈 때마다 정해진 횟수만큼 죽음을 막는다(세금 처형은 막지 못한다) */
function lifeSave(s: GameState, what: string): boolean {
  const id = Object.values(s.gear).find((g) => g && GEAR[g]?.lifeSaves);
  if (!id) return false;
  const used = s.tripUsed.filter((x) => x === "lifeSave").length;
  const max = GEAR[id].lifeSaves!;
  if (used >= max) return false;
  s.tripUsed.push("lifeSave");
  s.hero.hp = Math.max(1, s.hero.hp);
  // 죽음의 원인이 그대로 남아 곧바로 다시 죽지 않게: 머리·몸통 결손은 중상으로, 굶주림은 조금 채운다
  if (s.injuries.head >= 3) s.injuries.head = 2;
  if (s.injuries.body >= 3) s.injuries.body = 2;
  if (s.hero.satiety <= 0) {
    s.hero.satiety = 30;
    if (s.dungeon) s.dungeon.starvingTurns = 0;
  }
  log(s, t("【{gear}】 {what} — 그 순간 부적이 깨질 듯 빛나며 죽음을 비껴갔다. (HP {hp}, 남은 횟수 {n})", { gear: t(GEAR[id].name), what, hp: s.hero.hp, n: max - used - 1 }), "skill");
  return true;
}

function buildEpitaph(s: GameState, cause: DeathCause): string {
  const cls = t(CLASSES[s.hero.cls].name);
  const parts: string[] = [s.hero.cls === "adventurer" ? t("영지의 열여섯 살 소년, {cls}가 미궁에 섰다.", { cls }) : t("영지의 열여섯 살 소년, {cls}로 미궁에 섰다.", { cls })];
  if (s.hero.level > 1) parts.push(t("{n}레벨까지 훈련받았다.", { n: s.hero.level }));
  parts.push(...s.history.slice(-3));
  if (s.rank > 0) parts.push(t("차원문에 {n}번 닿았다.", { n: s.rank }));
  if (s.recordsRead > 0) parts.push(t("미궁의 기록물 {n}개를 읽었다.", { n: s.recordsRead }));
  parts.push(t("{n}번째 달에 {cause}.", { n: s.month, cause: t(CAUSE_TEXT[cause]) }));
  return parts.join(" ");
}
