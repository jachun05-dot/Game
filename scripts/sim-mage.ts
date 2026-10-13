// 마법사 원소 밸런스: 원소를 고르는 방식(한 가지 특화 / 두 가지 / 여럿)마다 봇을 대량으로 돌린다.
// 지표: 첫 달 사망, 12개월 안 1섹터 클리어, 1섹터 첫 클리어 후 6개월 안 2섹터 클리어, 12개월 생존, 레벨, 사망 원인.
// 실행: bun scripts/sim-mage.ts [방식당 판수] [샤드] [샤드 수] > out.json  (GOAL=explore|rush|farm)
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction, setMagePlan } from "../src/game/bot";
import { ELEMENTS, ELEMENT_KEYS, isElement, type ElementKey } from "../src/game/elements";
import type { ClassId } from "../src/game/classes";
import type { AutoGoal, GameState } from "../src/game/types";

const N = Number(process.argv[2] ?? 500);
const SHARD = Number(process.argv[3] ?? 0);
const SHARDS = Number(process.argv[4] ?? 1);
const GOAL = (process.env.GOAL ?? "explore") as AutoGoal;
const NAME: Record<ElementKey, string> = { fire: "화염", frost: "서리", bolt: "번개", earth: "대지" };

// 다음 레벨(훈련 뒤 레벨)로 원소를 고른다
type Plan = { id: string; kind: "단일" | "이원소" | "다원소" | "비교"; label: string; cls: ClassId; pick: (s: GameState, toLevel: number) => ElementKey };
const plans: Plan[] = [];
for (const el of ELEMENT_KEYS) plans.push({ id: `mono-${el}`, kind: "단일", label: `${NAME[el]} 몰빵`, cls: "mage", pick: () => el });
// 이원소: 액티브(홀수 레벨)·특화(4·7)는 A, 패시브(짝수 레벨)는 B
for (const a of ELEMENT_KEYS) for (const b of ELEMENT_KEYS) if (a !== b) {
  plans.push({ id: `dual-${a}-${b}`, kind: "이원소", label: `${NAME[a]} 액티브·특화 + ${NAME[b]} 패시브`, cls: "mage", pick: (_s, lv) => (lv === 4 || lv === 7 || lv % 2 === 1 ? a : b) });
}
plans.push({ id: "rotate", kind: "다원소", label: "네 원소 돌아가며", cls: "mage", pick: (_s, lv) => ELEMENT_KEYS[lv % 4] });
plans.push({ id: "random", kind: "다원소", label: "매번 무작위", cls: "mage", pick: (s) => ELEMENT_KEYS[(s.seed * 31 + s.hero.level * 17) % 4] });
for (const skip of ELEMENT_KEYS) {
  const three = ELEMENT_KEYS.filter((x) => x !== skip);
  plans.push({ id: `tri-no-${skip}`, kind: "다원소", label: `${three.map((x) => NAME[x]).join("·")} 셋`, cls: "mage", pick: (_s, lv) => three[lv % 3] });
}
// 비교용: 다른 직업(같은 시드, 같은 봇)
plans.push({ id: "ref-adventurer", kind: "비교", label: "모험가(비교)", cls: "adventurer", pick: () => "fire" });
plans.push({ id: "ref-warrior", kind: "비교", label: "전사(비교)", cls: "warrior", pick: () => "fire" });

type Row = {
  id: string; kind: string; label: string; n: number;
  m1dead: number; clear12: number; alive12: number; levelSum: number;
  s1: number; s2in6: number; dead6: number;
  causes: Record<string, number>; learned: Record<string, number>; main: Record<string, number>;
};

function causeOf(text: string): string {
  if (/세금/.test(text)) return "세금 처형";
  if (/굶어/.test(text)) return "굶주림";
  if (/함정|곰덫|독침/.test(text)) return "함정";
  if (/떨어져/.test(text)) return "추락";
  if (/머리를 잃|몸통을 꿰뚫|피를 너무/.test(text)) return "치명 부상";
  if (/열병|병에/.test(text)) return "질병";
  if (/둘러싸여/.test(text)) return "무리에게";
  return "단독 전투";
}

const out: Row[] = [];
// PLANS=mono,dual 처럼 구분 접두어로 일부만 돌릴 수 있다
const only = process.env.PLANS?.split(",");
plans.filter((p) => !only || only.some((o) => p.id.startsWith(o))).forEach((plan, idx) => {
  if (idx % SHARDS !== SHARD) return;
  setMagePlan((s) => plan.pick(s, s.hero.level + 1));
  const row: Row = { id: plan.id, kind: plan.kind, label: plan.label, n: N, m1dead: 0, clear12: 0, alive12: 0, levelSum: 0, s1: 0, s2in6: 0, dead6: 0, causes: {}, learned: {}, main: {} };
  for (let seed = 1; seed <= N; seed++) {
    const s = newRun(seed * 7919);
    apply(s, { t: "pickClass", cls: plan.cls });
    apply(s, { t: "autoGoal", goal: GOAL });
    apply(s, { t: "create", name: "봇", candidate: 0, faith: null });
    let m1 = 0, m2 = 0, level12 = 0, alive12 = false, cleared12 = false;
    for (let i = 0; i < 200000 && s.phase !== "dead"; i++) {
      if (!m1 && s.rank >= 1) m1 = s.month;
      if (!m2 && s.rank >= 2) m2 = s.month;
      if (s.month === 13 && !level12) { level12 = s.hero.level; alive12 = true; cleared12 = s.rank >= 1; }
      if (m1 && s.month > m1 + 6 && s.month > 12) break;
      if (!m1 && s.month > 12) break;
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
    }
    if (s.phase === "dead") {
      if (s.tomb!.months === 1) row.m1dead++;
      if (s.tomb!.months <= 12) {
        const c = causeOf(s.tomb!.cause);
        row.causes[c] = (row.causes[c] ?? 0) + 1;
      }
    }
    if (alive12) row.alive12++;
    if (cleared12 || (m1 && m1 <= 12)) row.clear12++;
    row.levelSum += level12 || s.hero.level;
    if (m1) {
      row.s1++;
      if (m2 && m2 - m1 <= 6) row.s2in6++;
      if (s.phase === "dead" && s.tomb!.months <= m1 + 6) row.dead6++;
    }
    // 실제로 배운 원소 기술 수(어느 속성인지)
    if (plan.cls === "mage") {
      for (const id of s.skills) for (const el of ELEMENT_KEYS) if (id.startsWith(el)) row.learned[el] = (row.learned[el] ?? 0) + 1;
      const m = s.mainElement ?? "없음";
      row.main[m] = (row.main[m] ?? 0) + 1;
    }
  }
  out.push(row);
  console.error(`[${SHARD}] ${plan.id} 완료`);
});
setMagePlan(null);
void ELEMENTS;
void isElement;
console.log(JSON.stringify(out));
