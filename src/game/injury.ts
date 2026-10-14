import { josa } from "./josa";
import { MIND, afflict } from "./mind";
import { plagueImmune, power } from "./faith";
import type { GameState } from "./types";

// 물리적 상태이상(DESIGN 11절 "상태이상 시스템", 2026-10-13 1차 구현).
// 부위 부상: 머리·몸통·오른손·왼손·발 × 경상(1)·중상(2)·결손(3). 같은 부위를 다시 다치면 한 단계 악화.
// 머리·몸통 결손은 즉사. 손·발 결손은 신전 재생 의식(완전 회복)이나 대장간 의수·의족(중상 성능)으로 대신한다.
// 질병 "쥐 열병": 경상(1)·중상(2). 방을 옮길 때마다 HP가 깎이고 저절로 낫지 않는다.

export type Part = "head" | "body" | "main" | "offhand" | "feet";
export const PARTS: Part[] = ["head", "body", "main", "offhand", "feet"];
export const PART_NAME: Record<Part, string> = { head: "머리", body: "몸통", main: "오른손", offhand: "왼손", feet: "발" };
export const LEVEL_NAME = ["멀쩡함", "경상", "중상", "결손"];
export const DISEASE_NAME = ["", "쥐 열병(경상)", "쥐 열병(중상)"];
const MOLD_NAME = ["", "곰팡이 폐병(경상)", "곰팡이 폐병(중상)"];

/** 지금 앓는 질병 이름(종류별) */
export function diseaseName(s: GameState, stage = s.disease): string {
  return (s.diseaseKind === "mold" ? MOLD_NAME : DISEASE_NAME)[stage] ?? "";
}

/** 질병 종류만(단계 없이) */
export function diseaseKindName(s: GameState): string {
  return s.diseaseKind === "mold" ? "곰팡이 폐병" : "쥐 열병";
}

/** 의수·의족을 달 수 있는 부위 */
export const LIMBS: Part[] = ["main", "offhand", "feet"];

export const INJ = {
  /** 맞았을 때 부상 확률: 치명타 / 최대 HP 30% 이상 한 방 / 그 외 */
  hitCrit: 0.25,
  hitHeavy: 0.1,
  hitNormal: 0.02,
  heavyRatio: 0.3,
  /** 맨손 공격 자기 부상, 단단한 몬스터 타격 자기 부상 */
  fistSelf: 0.1,
  hardSelf: 0.03,
  /** 가시함정에 맞으면 발 부상 */
  spikeFeet: 0.3,
  /** 추락하면 발 부상 */
  fallFeet: 0.5,
  /** 쥐 열병: 쥐 / 보스 쥐에게 물리면 */
  diseaseRat: 0.05,
  diseaseBoss: 0.15,
  /** 미궁에서 나오면 경상 자연 치유 판정(체력) DC */
  healDc: 12,
  innCost: 40,
  regenCost: 2000,
  prostheticCost: 300,
};

export function emptyInjuries(): Record<Part, number> {
  return { head: 0, body: 0, main: 0, offhand: 0, feet: 0 };
}

/** 실제로 적용되는 단계(결손 + 의수·의족 = 중상 성능). 몸통 중상이면 다른 부위도 최소 경상 */
export function lvl(s: GameState, p: Part): number {
  let v = s.injuries[p] ?? 0;
  if (v >= 3 && s.prosthetic?.[p]) v = 2;
  if (p !== "body" && (s.injuries.body ?? 0) >= 2) v = Math.max(v, 1);
  return v;
}

/** 판정 페널티(머리·질병) */
export function injuryRollPenalty(s: GameState): number {
  const h = lvl(s, "head");
  const p = (h >= 2 ? -4 : h === 1 ? -2 : 0) + (s.disease >= 2 && !plagueImmune(s) ? -2 : 0) + ((s.poison ?? 0) >= 2 ? -1 : 0);
  return s.skills.includes("painless") ? Math.trunc(p / 2) : p; // 전사 "고통 무시"
}

export function injuryHit(s: GameState): number {
  const m = lvl(s, "main");
  const p = m === 2 ? -5 : m === 1 ? -2 : 0;
  return s.skills.includes("painless") ? Math.trunc(p / 2) : p;
}

export function injuryAc(s: GameState): number {
  const f = lvl(s, "feet");
  return f >= 2 ? -2 : f === 1 ? -1 : 0;
}

export function injuryMaxHp(s: GameState): number {
  const b = s.injuries.body ?? 0;
  return b >= 2 ? -6 : b === 1 ? -3 : 0;
}

/** 방 하나 이동 시간 배율(발) */
export function moveMult(s: GameState): number {
  const raw = s.injuries.feet ?? 0;
  const m = raw >= 3 && !s.prosthetic?.feet ? 4 : [1, 2, 3, 3][lvl(s, "feet")];
  return s.skills.includes("earthRoot") ? 1 + (m - 1) / 2 : m; // 마법사 "뿌리 내리기": 발 부상 이동 페널티 절반
}

export function canFlee(s: GameState): boolean {
  return lvl(s, "feet") < 2 && !((s.injuries.feet ?? 0) >= 3);
}

export function noCrit(s: GameState): boolean {
  return lvl(s, "main") >= 2;
}

/** 무기를 못 쓴다(오른손 결손, 의수 없음) */
export function mainLost(s: GameState): boolean {
  return (s.injuries.main ?? 0) >= 3 && !s.prosthetic?.main;
}

/** 슬롯 장비 효과: 1 그대로, 0 없음. 왼손 경상이면 AC −1(따로) */
export function slotWorks(s: GameState, slot: string): boolean {
  if (slot === "offhand") return lvl(s, "offhand") < 2;
  if (slot === "feet") return !((s.injuries.feet ?? 0) >= 3 && !s.prosthetic?.feet);
  if (slot === "main") return !mainLost(s);
  return true;
}

export function offhandAcPenalty(s: GameState): number {
  return lvl(s, "offhand") === 1 && s.gear.offhand ? -1 : 0;
}

/** 머리 중상: 라운드마다 기절 확률 */
export const HEAD_STUN = 0.1;

export function canPeek(s: GameState): boolean {
  return lvl(s, "head") < 2;
}

/** 방을 옮길 때 깎이는 HP(출혈 + 질병)와 그 원인 */
export function bleedPerMove(s: GameState): { bleed: number; disease: number; poison: number } {
  const b = s.injuries.body ?? 0;
  const dz = plagueImmune(s) ? 0 : s.disease >= 2 ? 2 : s.disease === 1 ? 1 : 0; // 역병의 신 ★1(질병만, 독은 막지 않는다)
  return { bleed: b >= 2 ? 2 : b === 1 ? 1 : 0, disease: dz, poison: [0, 1, 2][s.poison ?? 0] ?? 0 };
}

export function anyInjury(s: GameState): boolean {
  return PARTS.some((p) => (s.injuries[p] ?? 0) > 0) || s.disease > 0 || (s.poison ?? 0) > 0 || Object.values(s.paralysis ?? {}).some((v) => (v ?? 0) > 0);
}

/** 지금 상태 요약(헤더·로그용) */
export function injurySummary(s: GameState): string[] {
  const out: string[] = [];
  for (const p of PARTS) {
    const v = s.injuries[p] ?? 0;
    if (v > 0) out.push(`${PART_NAME[p]} ${LEVEL_NAME[v]}${v >= 3 && s.prosthetic?.[p] ? (p === "feet" ? "(의족)" : "(의수)") : ""}`);
  }
  if (s.disease > 0) out.push(diseaseName(s));
  if ((s.poison ?? 0) > 0) out.push(["", "중독(경상)", "중독(중상)"][s.poison!]);
  for (const [p, v] of Object.entries(s.paralysis ?? {})) if (v) out.push(`${PART_NAME[p as Part]} ${v >= 2 ? "마비" : "저림"}`);
  return out;
}

/** 단계별 효과 설명(캐릭터 시트) */
export function partEffect(s: GameState, p: Part): string {
  const raw = s.injuries[p] ?? 0;
  const v = lvl(s, p);
  if (raw === 0 && v === 0) return "";
  const pros = raw >= 3 && s.prosthetic?.[p];
  const by = raw === 0 && v > 0 ? " (몸통 중상의 여파)" : pros ? " (의수·의족으로 중상 성능)" : "";
  const E: Record<Part, string[]> = {
    head: ["", "모든 판정 −2", "모든 판정 −4, 라운드마다 10% 기절, 앞방 엿보기 불가", "즉사"],
    body: ["", "최대 HP −3, 방을 옮길 때마다 출혈 1", "최대 HP −6, 출혈 2, 다른 부위 경상 페널티", "즉사"],
    main: ["", "명중 −2", "명중 −5, 치명타 불가", "무기 사용 불가(맨손)"],
    offhand: ["", "왼손 장비 AC −1", "왼손 장비 효과 없음", "왼손 장비 효과 없음"],
    feet: ["", "AC −1, 이동 시간 2배", "AC −2, 도주 불가, 이동 3배", "기어서 이동(4배), 도주 불가, 발 장비 효과 없음"],
  };
  return E[p][pros ? 2 : Math.max(v, raw)] + by;
}

/** 부위를 다치게 한다. 머리·몸통이 결손이 되면 죽음 원인을 돌려준다 */
export function wound(s: GameState, p: Part, why: string): "oblivion" | "body" | null {
  if (p === "head" && power(s, "oblivion", 2)) p = "body"; // 망각의 신 ★2 "이미 내준 머리"
  const before = s.injuries[p] ?? 0;
  if (before >= 3) return null;
  const v = before + 1;
  s.injuries[p] = v;
  s.log.push({ text: `【부상】 ${why} — ${josa(PART_NAME[p], "이")} ${LEVEL_NAME[v]}! (${partEffect(s, p)})`, kind: "hurt" });
  s.logCount += 1;
  if (p === "head" && v < 3) afflict(s, "confusion", MIND.confusionHead, "머리를 맞은 뒤로 생각이 자꾸 흩어진다.");
  if (v >= 3 && p === "head") return "oblivion";
  if (v >= 3 && p === "body") return "body";
  return null;
}

/** 질병에 걸린다(이미 앓고 있으면 그 병이 한 단계 깊어진다) */
export function infect(s: GameState, kind: "rat" | "mold" = "rat"): void {
  if (s.disease >= 2) return;
  if (s.disease === 0) s.diseaseKind = kind;
  s.disease += 1;
  const how = s.diseaseKind === "mold" ? "포자를 들이마셨다. 가슴이 답답하다" : "상처가 화끈거린다";
  s.log.push({ text: `【질병】 ${how} — ${diseaseName(s)}. 방을 옮길 때마다 HP가 깎인다.${s.diseaseKind === "mold" ? " (야영 회복 절반)" : ""}`, kind: "hurt" });
  s.logCount += 1;
}

/** 치료: 가장 심한 (결손이 아닌) 부상 하나를 한 단계 낫게 한다 */
export function treatWorst(s: GameState): Part | null {
  const p = [...PARTS].filter((x) => (s.injuries[x] ?? 0) > 0 && (s.injuries[x] ?? 0) < 3).sort((a, b) => s.injuries[b] - s.injuries[a])[0];
  if (!p) return null;
  s.injuries[p] -= 1;
  return p;
}
