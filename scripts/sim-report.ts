// 밸런스 리포트용 대량 시뮬레이션: 직업 3 × 자동 결정 목표 3 × 신앙 9(없음 포함) = 81조합.
// 조합마다 같은 시드 묶음을 써서(공통 난수) 조합끼리 비교가 공정하다. 12개월까지 돌린다.
// 실행: bun scripts/sim-report.ts [조합당 판수] [샤드 번호] [샤드 수] > out.json
// 여러 샤드를 병렬로 돌린 뒤 결과 JSON 배열을 합쳐 쓴다.
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH } from "../src/game/data";
import { tier } from "../src/game/faith";
import type { ClassId } from "../src/game/classes";
import type { AutoGoal } from "../src/game/types";

const N = Number(process.argv[2] ?? 200);
const SHARD = Number(process.argv[3] ?? 0);
const SHARDS = Number(process.argv[4] ?? 1);
const MONTHS = 12;

const CLASSES: ClassId[] = ["adventurer", "warrior", "mage"];
const GOALS: AutoGoal[] = ["explore", "rush", "farm"];
const GODS: (string | null)[] = [null, FAITH.mob, FAITH.starve, FAITH.trap, FAITH.tax, FAITH.song, FAITH.plague, FAITH.abyss, FAITH.oblivion];

function causeOf(text: string): string {
  if (/세금/.test(text)) return "세금 처형";
  if (/굶어/.test(text)) return "굶주림";
  if (/함정|곰덫|독침/.test(text)) return "함정";
  if (/떨어져/.test(text)) return "추락";
  if (/머리를 잃|몸통을 꿰뚫|피를 너무/.test(text)) return "치명 부상";
  if (/열병|병에/.test(text)) return "질병";
  if (/이단심문관/.test(text)) return "이단심문관";
  if (/둘러싸여/.test(text)) return "무리에게";
  return "단독 전투";
}
function placeOf(reached: string): string {
  if (/2섹터/.test(reached)) return "2섹터";
  if (/1섹터 \d층/.test(reached)) return reached;
  return "마을·숲";
}

type Row = {
  cls: ClassId; goal: AutoGoal; faith: string | null; n: number;
  m1dead: number; clear12: number; s2clear12: number; alive12: number; lv4: number;
  levelSum: number; firstClearMonthSum: number; firstClearN: number;
  aliveByMonth: number[]; causes: Record<string, number>; places: Record<string, number>;
  inquisition: number; star3: number; goldSum: number;
};

const combos: [ClassId, AutoGoal, string | null][] = [];
for (const c of CLASSES) for (const g of GOALS) for (const f of GODS) combos.push([c, g, f]);
const out: Row[] = [];
const t0 = Date.now();
combos.forEach(([cls, goal, faith], idx) => {
  if (idx % SHARDS !== SHARD) return;
  const row: Row = { cls, goal, faith, n: N, m1dead: 0, clear12: 0, s2clear12: 0, alive12: 0, lv4: 0, levelSum: 0, firstClearMonthSum: 0, firstClearN: 0, aliveByMonth: Array(MONTHS + 1).fill(0), causes: {}, places: {}, inquisition: 0, star3: 0, goldSum: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const s = newRun(seed * 7919);
    s.faithsKnown = GODS.filter((x): x is string => !!x);
    apply(s, { t: "pickClass", cls });
    apply(s, { t: "autoGoal", goal });
    apply(s, { t: "create", name: "봇", candidate: 0, faith });
    let firstClear = 0, asked = false, maxTier = 0;
    for (let i = 0; i < 80000 && s.phase !== "dead" && s.month <= MONTHS; i++) {
      if (s.settlement?.inquisition) asked = true;
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
      if (!firstClear && s.rank >= 1) firstClear = s.month;
      if (faith) maxTier = Math.max(maxTier, tier(s));
    }
    const lastMonth = s.phase === "dead" ? s.tomb!.months : MONTHS + 1;
    for (let m = 0; m <= MONTHS; m++) if (lastMonth > m) row.aliveByMonth[m]++;
    if (s.phase === "dead") {
      if (s.tomb!.months === 1) row.m1dead++;
      const c = causeOf(s.tomb!.cause);
      row.causes[c] = (row.causes[c] ?? 0) + 1;
      const p = placeOf(s.tomb!.reached);
      row.places[p] = (row.places[p] ?? 0) + 1;
    } else row.alive12++;
    if (s.rank >= 1) row.clear12++;
    if (s.rank >= 2) row.s2clear12++;
    if (s.hero.level >= 4) row.lv4++;
    row.levelSum += s.hero.level;
    if (firstClear) { row.firstClearMonthSum += firstClear; row.firstClearN++; }
    if (asked) row.inquisition++;
    if (maxTier >= 3) row.star3++;
    if (s.phase !== "dead") row.goldSum += s.gold;
  }
  out.push(row);
  console.error(`[${SHARD}] ${cls}/${goal}/${faith ?? "없음"} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
});
console.log(JSON.stringify(out));
