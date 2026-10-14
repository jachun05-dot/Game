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
  /** ★1~3, ★4(3섹터 클리어 후, 신앙심 130), ★5(4섹터 클리어 후, 180) */
  powers: [string, string, string, string, string];
  curse: string;
}

export const GODS: Record<GodKey, GodDef> = {
  war: {
    key: "war", name: FAITH.mob, align: "혼돈-중립",
    likes: "적 여럿과 싸워 이기기", dislikes: "도주",
    powers: ["명중 +1 (적이 2마리 이상이면 +2)", "적을 쓰러뜨릴 때마다 HP +2", "피의 함성: 적이 3마리 이상이면 전투 시작 시 2라운드 동안 적 명중 −2", "최후의 돌격: HP 25% 이하가 되면 그 전투 동안 명중 +2, 피해 +3(미궁마다 1회)", "끝나지 않는 전쟁: 적이 3마리 이상이면 라운드마다 피해 +2씩 쌓인다(최대 +6)"],
    curse: "명중 −1",
  },
  hunger: {
    key: "hunger", name: FAITH.starve, align: "완전 중립(한 몸의 두 얼굴)",
    likes: "배고픈 채 버티기(포만감 30 이하, 굶주리면 두 배)", dislikes: "배부른데 또 먹기(포만감 80 이상)",
    powers: ["포만감 소모 −30%, 말린 고기를 먹으면 HP +3", "굶주림 판정 페널티 없음, 배고플 때(포만감 30 이하) 피해 +2", "한 몸의 두 얼굴: 배고픈 채(포만감 30 이하) 전투에 이기면 포만감 +25, HP +5", "굶주린 자의 식탁: 굶주린(포만감 0) 채 적을 쓰러뜨리면 포만감 +20", "한 몸의 두 얼굴(완성): 미궁에 들어갈 때 포만감 100 + 말린 고기 2, 굶주려도 아사하지 않는다(판정 −2는 그대로), 굶주린 망령·허기의 어미는 먼저 덤비지 않는다"],
    curse: "포만감 소모 +25%",
  },
  trap: {
    key: "trap", name: FAITH.trap, align: "혼돈-악",
    likes: "함정 해체, 함정을 밟고도 살아남기", dislikes: "함정 앞에서 물러나기",
    powers: ["함정 발견·회피·해체 +3", "숨은 고블린 매복을 항상 알아채고, 함정을 해체하면 마석을 줍는다(층 × 10G)", "먼저 오는 경고: 함정 피해 없음, 기습당하지 않는다", "함정 다루기: 함정을 해체하면 다음 전투 시작 때 그 함정을 적 하나에게 터뜨린다(2d6)", "재앙의 주인: 함정방에 들어서면 그 함정을 가방에 넣는다(최대 2, 벼랑길 제외) — 전투가 시작될 때 하나씩 터뜨린다(2d6)"],
    curse: "함정 발견 −3",
  },
  greed: {
    key: "greed", name: FAITH.tax, align: "질서-악",
    likes: "마석을 많이 들고 나와 환전하기", dislikes: "대장간·신전에 돈 쓰기",
    powers: ["마석 가치 +20%, 상점가 물건 반값", "목숨값: 쓰러질 피해를 받으면 들고 있던 마석 절반을 바치고 HP 1로 버틴다(미궁마다 1회, 마석이 있어야)", "빚 문서: 세금이 모자라면 한 번 외상(처형 면제, 다음 달 세금 2배) — 삶마다 1회", "피의 값: 세금을 못 내면 처형 대신 최대 HP −5(영구) — 삶마다 1회", "황금의 몸: 들고 있는 마석 1000G마다 AC +1(최대 +3)"],
    curse: "마석 가치 −15%",
  },
  song: {
    key: "song", name: FAITH.song, align: "완전 중립",
    likes: "기록물 읽기, 탐문", dislikes: "기록물을 지나치기",
    powers: ["탐문 보상 +50%, 기록물을 읽으면 HP +5", "앞방 엿보기 +3, 야영 회복 +3", "끝나지 않은 노래: 쓰러질 피해를 받으면 HP 1로 버틴다(미궁마다 1회)", "영웅담: 기록물을 읽을 때마다 그 미궁이 끝날 때까지 명중·판정 +1(최대 +3)", "노래가 된 이름: 기록물을 읽을 때마다 그 미궁 동안 최대 HP +1(최대 +10)"],
    curse: "앞방 엿보기 −3",
  },
  plague: {
    key: "plague", name: FAITH.plague, align: "중립-악",
    likes: "병을 앓은 채 버티기, 쥐 잡기(신도는 쥐 열병을 품고 시작한다)", dislikes: "탕약·여관으로 병 고치기",
    powers: ["병든 몸: 쥐 열병에 걸려도 HP가 깎이지 않고 판정 페널티도 없다", "전염: 병을 앓는 동안 명중하면 25% 확률로 적도 병든다(라운드마다 1d3)", "역병의 축복: 병을 앓는 동안 최대 HP +4, 피해 +1", "역병의 숙주: 병이 깊으면(중상) 전투 중 모든 적이 라운드마다 1 피해", "역병의 왕관: 병이 깊으면(중상) 명중할 때마다 적이 반드시 병든다"],
    curse: "쥐 열병에 걸릴 확률 3배",
  },
  abyss: {
    key: "abyss", name: FAITH.abyss, align: "혼돈-중립",
    likes: "더 깊이 내려가기, 꺼진 바닥으로 떨어지기, 깊은 층에서 적 쓰러뜨리기", dislikes: "귀환 주문서",
    powers: ["낙하에 익숙한 몸: 추락 피해 절반, 꺼진 바닥으로 일부러 뛰어내릴 수 있다(아래층 지름길, 1d6)", "깊을수록: 2층 명중 +1, 3층 명중 +2", "벼랑 끝: HP 30% 이하일 때 피해 +3, AC +2", "떨어지는 자의 축복: 꺼진 바닥·심연으로 떨어져도 죽지 않는다(HP 1로 버팀)", "바닥을 아는 자: 추락 피해 없음, 붙잡히지 않는다, 3층에서도 뛰어내릴 수 있다(보스방 앞 바위에 내려선다)"],
    curse: "추락 피해 2배",
  },
  oblivion: {
    key: "oblivion", name: FAITH.oblivion, align: "혼돈-악",
    likes: "기록물을 지나치기, 잠(야영)", dislikes: "기록물 읽기",
    powers: ["흐려지는 마음: 정신 상태이상에 걸릴 확률 절반, 미궁을 나오면 모두 사라진다", "이미 내준 머리: 머리를 다치지 않는다(그 부상은 몸통으로)", "망각의 장막: 전투가 시작되면 모든 적이 1라운드 동안 나를 잊는다(행동 불가)", "이름 없는 자: 이단심문관이 나타나지 않는다, 정신 상태이상이 걸리자마자 드러난다", "완전한 망각: 전투가 시작되면 모든 적이 2라운드 동안 나를 잊는다(보스·정예는 1라운드)"],
    curse: "정신 상태이상에 걸릴 확률 2배",
  },
};

/** 신앙 수치(시뮬레이션에서 바꿔 볼 수 있게 한곳에) */
export const FAITH_BAL = {
  /** ★1~3, ★4(130)는 3섹터를 클리어해야(등급 3), ★5(180)는 4섹터를 클리어해야(등급 4) 열린다. 신앙심 상한은 3섹터 클리어 뒤 100 → 200 */
  tiers: [30, 60, 90, 130, 180],
  /** ★4가 열리는 등급(클리어한 섹터 수)과 그 뒤의 신앙심 상한 */
  tier4Rank: 3,
  /** ★5가 열리는 등급(4섹터 클리어) */
  tier5Rank: 4,
  cap: 100,
  capHigh: 200,
  /** 이단 심문 확률 상한(★4 × 5% = 20%가 되지 않게) */
  inquisitionCap: 0.15,
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
  const n = FAITH_BAL.tiers.filter((t) => s.piety >= t).length;
  const open = s.rank >= FAITH_BAL.tier5Rank ? n : s.rank >= FAITH_BAL.tier4Rank ? Math.min(4, n) : Math.min(3, n);
  return Math.max(0, open - (s.combat?.sealed ?? 0)); // 6섹터 화신의 삼킴: 이 전투 동안 높은 ★부터 봉인
}

/** 신앙심 상한을 올려 주는 것들(짝 잃은 반지·돌려받은 이름 — gear.ts·skills.ts가 등록) */
export const pietyCapBonus: ((s: GameState) => number)[] = [];

/** 신앙심 상한(3섹터 클리어 뒤 200) */
export function pietyCap(s: GameState): number {
  return (s.rank >= FAITH_BAL.tier4Rank ? FAITH_BAL.capHigh : FAITH_BAL.cap) + pietyCapBonus.reduce((a, f) => a + f(s), 0);
}

// ── 6섹터 옛 신들의 제단: 섬기는 신의 유물(사용자 제안 2026-10-15) ──
// 섬기는 신의 제단에서 기도하면 그 신의 유물 하나(삶마다 하나). 그 신을 섬기는 동안만 힘을 낸다.

export const RELICS: Record<GodKey, { name: string; desc: string }> = {
  war: { name: "첫 전쟁의 군기", desc: "피해 +2" },
  hunger: { name: "두 얼굴의 첫 접시", desc: "전투에 이기면 HP +4, 포만감 소모 −20%" },
  trap: { name: "첫 함정의 쇠이빨", desc: "전투가 시작되면 가장 강한 적의 발밑에서 터진다(2d6)" },
  greed: { name: "첫 동전", desc: "마석 가치 +20%, AC +1" },
  song: { name: "첫 노래의 현", desc: "최대 HP +8, 정신 상태이상에 걸릴 확률 절반" },
  plague: { name: "첫 역병의 종", desc: "전투 라운드마다 적 전원 1 피해" },
  abyss: { name: "바닥의 돌", desc: "AC +2" },
  oblivion: { name: "이름 없는 가면", desc: "정화가 통하지 않고, 성광 피해 절반" },
};

/** 그 신의 유물이 힘을 내는가(유물을 받았고, 지금 그 신을 섬긴다) */
export function relicOn(s: GameState, key: GodKey): boolean {
  return s.relic === key && god(s) === key;
}

/** 이번 달 이단 심문 확률 */
export function inquisitionChance(s: GameState): number {
  return Math.min(FAITH_BAL.inquisitionCap, FAITH_BAL.inquisitionPerTier * tier(s));
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
  s.piety = Math.max(0, Math.min(pietyCap(s), s.piety + n));
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
  return (power(s, "plague", 3) && sick(s) ? 4 : 0) + (relicOn(s, "song") ? 8 : 0);
}

/** 유물 AC(첫 동전 +1, 바닥의 돌 +2) */
export function relicAc(s: GameState): number {
  return (relicOn(s, "greed") ? 1 : 0) + (relicOn(s, "abyss") ? 2 : 0);
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
  return (power(s, "oblivion", 1) ? 0.5 : 1) * (cursed(s, "oblivion") ? 2 : 1) * (relicOn(s, "song") ? 0.5 : 1);
}

export function faithHungerMult(s: GameState): number {
  return (power(s, "hunger", 1) ? 0.7 : 1) * (cursed(s, "hunger") ? 1.25 : 1) * (relicOn(s, "hunger") ? 0.8 : 1);
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
  return (power(s, "greed", 1) ? 1.2 : 1) * (cursed(s, "greed") ? 0.85 : 1) * (relicOn(s, "greed") ? 1.2 : 1);
}
