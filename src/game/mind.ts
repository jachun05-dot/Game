import { Rng } from "./rng";
import { josa } from "./josa";
import type { GameState } from "./types";

// 정신적 상태이상(DESIGN 11절, 2026-10-13 2차 구현). 부위·단계 없이 개별로 켜지고 꺼진다.
// 핵심 원칙 "1단계는 눈치채지 못하게": 걸려도 화면에 표시되지 않고, 증상도 가끔만 나온다.
// 방을 옮길 때마다 d20 + 감각 보정 + 지능 보정 vs DC 15로 "눈치채기" 판정(행운으로 아주 낮은 추가 기회).
// 성공하면 그때부터 표시된다. 둘이 겹치면 조합 증상(발작·패닉·무너짐)이 터지고, 그 순간 둘 다 드러난다.

export type MindKey = "fear" | "rage" | "confusion" | "despair";
export const MIND_KEYS: MindKey[] = ["fear", "rage", "confusion", "despair"];
export const MIND_NAME: Record<MindKey, string> = { fear: "공포", rage: "분노", confusion: "혼란", despair: "절망" };
export const MIND_EFFECT: Record<MindKey, string> = {
  fear: "행동할 때마다 15% 확률로 몸이 얼어붙는다",
  rage: "피해 +1, AC −1, 15% 확률로 물약 마실 때를 놓친다",
  confusion: "행동할 때마다 15% 확률로 엉뚱한 곳을 친다, 방을 옮길 때 15% 확률로 다른 길로 샌다",
  despair: "모든 판정 −1, 20% 확률로 물약 마실 때를 놓친다, 방을 옮길 때 15% 확률로 주저앉아 2시간을 잃는다",
};

export const MIND = {
  symptom: 0.15,
  despairPotion: 0.2,
  ragePotion: 0.15,
  noticeDc: 15,
  luckNotice: 0.02,
  /** 원인별 확률 */
  fearBoss: 0.4,
  fearLowHp: 0.25,
  rageStreak: 0.3,
  rageStreakHits: 3,
  confusionHead: 0.5,
  despairExhausted: 0.15,
  despairStarving: 0.1,
  /** 조합 증상 확률(라운드마다) */
  combo: 0.2,
  /** 미궁에서 나오면 저절로 가라앉을 확률 */
  fade: 0.4,
};

export const COMBOS: { a: MindKey; b: MindKey; name: string; desc: string }[] = [
  { a: "fear", b: "rage", name: "발작", desc: "격렬하게 날뛰며 두 번 공격(피해 +2)하지만, 그 라운드 방어를 완전히 잊는다(적의 공격이 모두 치명타)" },
  { a: "fear", b: "confusion", name: "패닉", desc: "등을 보이며 아무 데로나 도망친다(전투 중 무작정 도주 시도, 길을 고를 때 25% 엉뚱한 방)" },
  { a: "fear", b: "despair", name: "무너짐", desc: "주저앉아 아무것도 하지 못한다(그 라운드 행동 불가)" },
];

function rng(s: GameState): Rng {
  return new Rng(s.rng);
}

export function has(s: GameState, k: MindKey): boolean {
  return !!s.mind[k];
}

export function known(s: GameState, k: MindKey): boolean {
  return !!s.mind[k]?.known;
}

function say(s: GameState, text: string, kind: "hurt" | "system" | "story" | "skill" | "miss" | "good" = "story"): void {
  s.log.push({ text, kind });
  s.logCount += 1;
}

/** 확률 p로 상태이상을 건다(이미 걸려 있으면 그대로). 걸린 사실은 알리지 않는다 */
export function afflict(s: GameState, k: MindKey, p: number, hint: string): boolean {
  if (has(s, k) || !rng(s).chance(p)) return false;
  s.mind[k] = { known: false };
  say(s, hint, "story"); // 무엇이 걸렸는지는 말하지 않는 분위기 문장
  return true;
}

export function reveal(s: GameState, k: MindKey, why?: string): void {
  const m = s.mind[k];
  if (!m || m.known) return;
  m.known = true;
  say(s, `【${MIND_NAME[k]}】 ${why ?? "자신이 무언가에 사로잡혀 있다는 걸 깨달았다"} — ${MIND_EFFECT[k]}`, "skill");
}

export function cure(s: GameState, k: MindKey): void {
  delete s.mind[k];
}

/** 방을 옮길 때 눈치채기 판정(감각 + 지능 보정은 호출하는 쪽에서) */
export function noticeCheck(s: GameState, bonus: number): void {
  const r = rng(s);
  for (const k of MIND_KEYS) {
    const m = s.mind[k];
    if (!m || m.known) continue;
    if (r.die(20) + bonus >= MIND.noticeDc || r.chance(MIND.luckNotice)) reveal(s, k);
  }
}

/** 증상 한 번(확률). 걸려 있어도 모르면 흐릿한 문장으로 */
export function symptom(s: GameState, k: MindKey, p: number, knownText: string, vagueText: string): boolean {
  if (!has(s, k) || !rng(s).chance(p)) return false;
  say(s, known(s, k) ? `【${MIND_NAME[k]}】 ${knownText}` : vagueText, "miss");
  return true;
}

/** 지금 터질 수 있는 조합(라운드마다 한 번) */
export function comboNow(s: GameState): (typeof COMBOS)[number] | null {
  const c = COMBOS.find((x) => has(s, x.a) && has(s, x.b));
  if (!c || !rng(s).chance(MIND.combo)) return null;
  for (const k of [c.a, c.b]) if (s.mind[k]) s.mind[k]!.known = true;
  say(s, `【${c.name}】 ${josa(MIND_NAME[c.a], "과")} ${josa(MIND_NAME[c.b], "이")} 한꺼번에 덮쳐 온다 — ${c.desc}`, "hurt");
  return c;
}

export function rollMindPenalty(s: GameState): number {
  return has(s, "despair") ? -1 : 0;
}

export function rageDmg(s: GameState): number {
  return has(s, "rage") ? 1 : 0;
}

export function rageAc(s: GameState): number {
  return has(s, "rage") ? -1 : 0;
}

/** 물약 방침을 놓친다(분노·절망) */
export function missPotion(s: GameState): boolean {
  if (has(s, "despair") && rng(s).chance(MIND.despairPotion)) {
    say(s, known(s, "despair") ? "【절망】 물약을 꺼낼 기운조차 나지 않는다." : "물약에 손이 가지 않는다. 왜인지 모르겠다.", "miss");
    return true;
  }
  if (has(s, "rage") && rng(s).chance(MIND.ragePotion)) {
    say(s, known(s, "rage") ? "【분노】 물약 따위 생각할 겨를이 없다!" : "피가 끓어 물약 생각이 나지 않았다.", "miss");
    return true;
  }
  return false;
}

export function mindSummary(s: GameState): string[] {
  return MIND_KEYS.filter((k) => known(s, k)).map((k) => MIND_NAME[k]);
}

/** 미궁에서 나오면 일부는 저절로 가라앉는다 */
export function fadeAfterDungeon(s: GameState, lines: string[]): void {
  const r = rng(s);
  for (const k of MIND_KEYS) {
    if (!has(s, k) || !r.chance(MIND.fade)) continue;
    const was = known(s, k);
    cure(s, k);
    lines.push(was ? `햇빛 아래로 나오자 ${josa(MIND_NAME[k], "이")} 가라앉았다.` : "미궁을 나서자 가슴 한구석이 이상하게 가벼워졌다.");
  }
}
