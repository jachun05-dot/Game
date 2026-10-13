import { FAITH } from "./data";
import type { GameState } from "./types";

// 신앙(DESIGN 5절, 2026-10-13 확정): 죽음으로 해금한 옛 신을 섬기면 신앙심(0~100)이 쌓이고
// ★1(30)·★2(60)·★3(90)마다 권능이 열린다. 매달 정산 때 −5. 미궁 성소에서 기도·개종, 개종하면 버린 신의 저주 1개월.
// 성당이 이단을 감시한다: 매달 정산 때 ★당 5% 확률로 심문 → 신앙 포기 / 거부(현상수배: 마을은 외곽만, 미궁에 이단심문관).

export type GodKey = "war" | "hunger" | "trap" | "greed" | "song" | "plague" | "abyss" | "oblivion";

export interface GodDef {
  key: GodKey;
  name: string;
  /** 성향(9분면) */
  align: string;
  likes: string;
  dislikes: string;
  powers: [string, string, string];
  curse: string;
}

export const GODS: Record<GodKey, GodDef> = {
  war: {
    key: "war", name: FAITH.mob, align: "혼돈-중립",
    likes: "적 여럿과 싸워 이기기", dislikes: "도주",
    powers: ["명중 +1 (적이 2마리 이상이면 +2)", "적을 쓰러뜨릴 때마다 HP +2", "피의 함성: 적이 3마리 이상이면 전투 시작 시 2라운드 동안 적 명중 −2"],
    curse: "명중 −1",
  },
  hunger: {
    key: "hunger", name: FAITH.starve, align: "완전 중립(한 몸의 두 얼굴)",
    likes: "배고픈 채 버티기(포만감 30 이하, 굶주리면 두 배)", dislikes: "배부른데 또 먹기(포만감 80 이상)",
    powers: ["포만감 소모 −30%, 말린 고기를 먹으면 HP +3", "굶주림 판정 페널티 없음, 배고플 때(포만감 30 이하) 피해 +2", "한 몸의 두 얼굴: 배고픈 채(포만감 30 이하) 전투에 이기면 포만감 +25, HP +5"],
    curse: "포만감 소모 +25%",
  },
  trap: {
    key: "trap", name: FAITH.trap, align: "혼돈-악",
    likes: "함정 해체, 함정을 밟고도 살아남기", dislikes: "함정 앞에서 물러나기",
    powers: ["함정 발견·회피·해체 +3", "숨은 고블린 매복을 항상 알아채고, 함정을 해체하면 마석을 줍는다(층 × 10G)", "먼저 오는 경고: 함정 피해 없음, 기습당하지 않는다"],
    curse: "함정 발견 −3",
  },
  greed: {
    key: "greed", name: FAITH.tax, align: "질서-악",
    likes: "마석을 많이 들고 나와 환전하기", dislikes: "대장간·신전에 돈 쓰기",
    powers: ["마석 가치 +20%, 상점가 물건 반값", "목숨값: 쓰러질 피해를 받으면 들고 있던 마석 절반을 바치고 HP 1로 버틴다(미궁마다 1회, 마석이 있어야)", "빚 문서: 세금이 모자라면 한 번 외상(처형 면제, 다음 달 세금 2배) — 삶마다 1회"],
    curse: "마석 가치 −15%",
  },
  song: {
    key: "song", name: FAITH.song, align: "완전 중립",
    likes: "기록물 읽기, 탐문", dislikes: "기록물을 지나치기",
    powers: ["탐문 보상 +50%, 기록물을 읽으면 HP +5", "앞방 엿보기 +3, 야영 회복 +3", "끝나지 않은 노래: 쓰러질 피해를 받으면 HP 1로 버틴다(미궁마다 1회)"],
    curse: "앞방 엿보기 −3",
  },
  plague: {
    key: "plague", name: FAITH.plague, align: "중립-악",
    likes: "병을 앓은 채 버티기, 쥐 잡기(신도는 쥐 열병을 품고 시작한다)", dislikes: "탕약·여관으로 병 고치기",
    powers: ["병든 몸: 쥐 열병에 걸려도 HP가 깎이지 않고 판정 페널티도 없다", "전염: 병을 앓는 동안 명중하면 25% 확률로 적도 병든다(라운드마다 1d3)", "역병의 축복: 병을 앓는 동안 최대 HP +4, 피해 +1"],
    curse: "쥐 열병에 걸릴 확률 3배",
  },
  abyss: {
    key: "abyss", name: FAITH.abyss, align: "혼돈-중립",
    likes: "더 깊이 내려가기, 꺼진 바닥으로 떨어지기, 깊은 층에서 적 쓰러뜨리기", dislikes: "귀환 주문서",
    powers: ["낙하에 익숙한 몸: 추락 피해 절반, 꺼진 바닥으로 일부러 뛰어내릴 수 있다(아래층 지름길, 1d6)", "깊을수록: 2층 명중 +1, 3층 명중 +2", "벼랑 끝: HP 30% 이하일 때 피해 +3, AC +2"],
    curse: "추락 피해 2배",
  },
  oblivion: {
    key: "oblivion", name: FAITH.oblivion, align: "혼돈-악",
    likes: "기록물을 지나치기, 잠(야영)", dislikes: "기록물 읽기",
    powers: ["흐려지는 마음: 정신 상태이상에 걸릴 확률 절반, 미궁을 나오면 모두 사라진다", "이미 내준 머리: 머리를 다치지 않는다(그 부상은 몸통으로)", "망각의 장막: 전투가 시작되면 모든 적이 1라운드 동안 나를 잊는다(행동 불가)"],
    curse: "정신 상태이상에 걸릴 확률 2배",
  },
};

/** 신앙 수치(시뮬레이션에서 바꿔 볼 수 있게 한곳에) */
export const FAITH_BAL = {
  tiers: [30, 60, 90],
  start: 30,
  monthlyDecay: 5,
  /** ★마다 이단 심문 확률 */
  inquisitionPerTier: 0.05,
  /** 현상수배 중 방을 옮길 때 이단심문관이 나타날 확률 */
  inquisitorChance: 0.05,
  inquisitorPiety: 10,
  curseMonths: 1,
};
export const PIETY_TIERS = FAITH_BAL.tiers;

export function godOf(name: string | null | undefined): GodDef | null {
  if (!name) return null;
  return Object.values(GODS).find((g) => g.name === name) ?? null;
}

/** 지금 섬기는 신 */
export function god(s: GameState): GodKey | null {
  return godOf(s.hero.faith)?.key ?? null;
}

export function tier(s: GameState): number {
  if (!god(s)) return 0;
  return FAITH_BAL.tiers.filter((t) => s.piety >= t).length;
}

/** 섬기는 신의 n단계 권능이 열렸는지 */
export function power(s: GameState, key: GodKey, n: number): boolean {
  return god(s) === key && tier(s) >= n;
}

/** 저주를 건 신 */
export function cursed(s: GameState, key: GodKey): boolean {
  return s.curse?.god === key && s.curse.months > 0;
}

/** 신앙심 증감(섬기는 신이 key일 때만) */
export function pray(s: GameState, key: GodKey, n: number): void {
  if (god(s) !== key) return;
  addPiety(s, n);
}

export function addPiety(s: GameState, n: number): void {
  if (!god(s)) return;
  const before = tier(s);
  s.piety = Math.max(0, Math.min(100, s.piety + n));
  const after = tier(s);
  if (after > before) {
    const g = godOf(s.hero.faith)!;
    s.log.push({ text: `【${g.name}】 신앙이 깊어졌다 — ★${after}: ${g.powers[after - 1]}`, kind: "story" });
    s.logCount += 1;
  }
}

/** 숫자 보정 모음(전투·판정·경제에서 쓴다) */
export function faithHit(s: GameState, enemies: number): number {
  const deep = s.dungeon && power(s, "abyss", 2) ? s.dungeon.floor - 1 : 0; // 심연 ★2
  return (power(s, "war", 1) ? (enemies >= 2 ? 2 : 1) : 0) - (cursed(s, "war") ? 1 : 0) + deep;
}

/** 병을 앓는 중인가(역병의 신 권능 조건) */
function sick(s: GameState): boolean {
  return s.disease > 0;
}

/** 역병 ★1: 병이 몸을 해치지 않는다 */
export function plagueImmune(s: GameState): boolean {
  return power(s, "plague", 1);
}

export function faithMaxHp(s: GameState): number {
  return power(s, "plague", 3) && sick(s) ? 4 : 0;
}

/** 쥐 열병 감염 확률 배율 */
export function faithInfectMult(s: GameState): number {
  return cursed(s, "plague") ? 3 : 1;
}

/** 추락 피해 배율 */
export function faithFallMult(s: GameState): number {
  return (power(s, "abyss", 1) ? 0.5 : 1) * (cursed(s, "abyss") ? 2 : 1);
}

/** 심연 ★3 "벼랑 끝": HP 비율을 받아 피해·AC 보정 */
export function abyssEdge(s: GameState, hpRatio: number): { dmg: number; ac: number } {
  return power(s, "abyss", 3) && hpRatio <= 0.3 ? { dmg: 3, ac: 2 } : { dmg: 0, ac: 0 };
}

/** 정신 상태이상 걸릴 확률 배율 */
export function faithMindMult(s: GameState): number {
  return (power(s, "oblivion", 1) ? 0.5 : 1) * (cursed(s, "oblivion") ? 2 : 1);
}

export function faithHungerMult(s: GameState): number {
  return (power(s, "hunger", 1) ? 0.7 : 1) * (cursed(s, "hunger") ? 1.25 : 1);
}

export function faithTrapSense(s: GameState): number {
  return (power(s, "trap", 1) ? 3 : 0) - (cursed(s, "trap") ? 3 : 0);
}

/** 기아/풍요의 신 ★2: 배고플 때 피해 +2 */
export function faithDmg(s: GameState): number {
  return (power(s, "hunger", 2) && s.hero.satiety <= 30 ? 2 : 0) + (power(s, "plague", 3) && sick(s) ? 1 : 0);
}

export function faithPeek(s: GameState): number {
  return (power(s, "song", 2) ? 3 : 0) - (cursed(s, "song") ? 3 : 0);
}

export function faithManaMult(s: GameState): number {
  return (power(s, "greed", 1) ? 1.2 : 1) * (cursed(s, "greed") ? 0.85 : 1);
}
