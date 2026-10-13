import type { Codex, GameState, StatKey, Stats } from "./types";

// 편린(2026-10-13): 몬스터를 쓰러뜨리면 아주 드물게(최대 3%) 그 몬스터 힘의 조각이 남는다.
// 흡수하면 능력치가 오르고, 몬스터에 따라 패시브/액티브 능력이 붙는다(능력 없는 편린도 있다).
// 칸은 레벨 1에 1칸, 3레벨마다 1칸씩 늘어난다. 칸이 차면 기존 편린 하나를 깨뜨려야 새로 흡수할 수 있다.
// 흡수하지 않은 편린은 곧 흩어진다(미궁 밖으로 가지고 나갈 수 없다). 숲의 몬스터는 편린을 남기지 않는다.

export const FRAG_MAX_CHANCE = 0.03;

export interface FragmentDef {
  /** 몬스터 id와 같다 */
  id: string;
  name: string;
  /** 1 하급 · 2 중급 · 3 상급 · 4 보스 */
  tier: number;
  /** 쓰러뜨렸을 때 남을 확률(최대 3%) */
  chance: number;
  stats: Partial<Stats>;
  /** skills.ts의 기술 id(없으면 능력치만) */
  skill?: string;
  flavor: string;
}

export const TIER_LABEL = ["", "하급", "중급", "상급", "보스"];

export const FRAGMENTS: Record<string, FragmentDef> = {
  rat: { id: "rat", name: "쥐의 편린", tier: 1, chance: 0.015, stats: { dex: 2 }, flavor: "잿빛 털 한 올 같은 빛. 몸이 조금 재빨라진다." },
  goblin: { id: "goblin", name: "고블린의 편린", tier: 1, chance: 0.012, stats: { dex: 1, luk: 2 }, skill: "fragCoward", flavor: "녹슨 초록빛. 겁이 많아지지만, 그만큼 잘 산다." },
  skeleton: { id: "skeleton", name: "스켈레톤 병사의 편린", tier: 2, chance: 0.01, stats: { con: 3, str: 1 }, flavor: "뼛가루처럼 하얗다. 뼈마디가 단단해진다." },
  goldrat: { id: "goldrat", name: "마석 먹은 쥐의 편린", tier: 3, chance: 0.03, stats: { luk: 4, dex: 2 }, skill: "fragGoldNose", flavor: "금빛으로 번들거린다. 마석 냄새가 코끝에 걸린다." },
  jewelgoblin: { id: "jewelgoblin", name: "보석 박힌 고블린의 편린", tier: 3, chance: 0.03, stats: { dex: 4, luk: 2 }, skill: "fragJewelStab", flavor: "보석 조각이 박힌 듯 반짝인다. 손이 먼저 움직인다." },
  crystalskel: { id: "crystalskel", name: "마석 갑옷 스켈레톤의 편린", tier: 3, chance: 0.03, stats: { con: 4, str: 3 }, skill: "fragCrystalBone", flavor: "투명한 결정이 뼈를 따라 자라난다." },
  boss: { id: "boss", name: "거대한 돌연변이 쥐의 편린", tier: 4, chance: 0.03, stats: { str: 4, con: 4, dex: 1 }, skill: "fragFrenzy", flavor: "붉게 고동친다. 이빨이 근질거린다." },
};

/** 레벨 1에 1칸, 3레벨마다 1칸씩(Lv3 2칸, Lv6 3칸 …) */
export function fragSlots(level: number): number {
  return 1 + Math.floor(level / 3);
}

export function fragStat(s: GameState, key: StatKey): number {
  let t = 0;
  for (const id of s.fragments) t += FRAGMENTS[id]?.stats[key] ?? 0;
  return t;
}

export function fragSkills(s: GameState): string[] {
  return s.fragments.map((id) => FRAGMENTS[id]?.skill).filter((x): x is string => !!x);
}

const STAT_NAME: Record<StatKey, string> = { str: "힘", dex: "민첩", con: "체력", int: "지능", per: "감각", luk: "행운" };

export function fragStatText(id: string): string {
  return (Object.entries(FRAGMENTS[id].stats) as [StatKey, number][]).map(([k, v]) => `${STAT_NAME[k]} +${v}`).join(" · ");
}

export function emptyCodex(): Codex {
  return { seen: [], kills: {}, fragSeen: [], fragKnown: [] };
}

/** 두 도감을 합친다(처치 수는 큰 쪽) */
export function mergeCodex(a: Codex, b: Codex): Codex {
  const kills = { ...a.kills };
  for (const [k, v] of Object.entries(b.kills)) kills[k] = Math.max(kills[k] ?? 0, v);
  const u = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return { seen: u(a.seen, b.seen), kills, fragSeen: u(a.fragSeen, b.fragSeen), fragKnown: u(a.fragKnown, b.fragKnown) };
}

/** 흡수해 본 편린인지(아니면 능력치를 모른다) */
export function fragKnown(s: GameState, id: string): boolean {
  return s.codex.fragKnown.includes(id);
}

/** 봇·자동 결정용 대략 가치 */
export function fragScore(id: string): number {
  const f = FRAGMENTS[id];
  return f.tier * 10 + Object.values(f.stats).reduce((a, b) => a + (b ?? 0), 0) + (f.skill ? 3 : 0);
}
