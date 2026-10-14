// sim-report.ts 샤드 출력(JSON 배열들)을 밸런스 대시보드용 파일 3개로 바꾼다.
// 실행: bun scripts/report-json.ts <출력 폴더> shard0.json shard1.json …
// 만드는 것: combos.json(조합별 지표 %), causes.json(사망 원인), survival.json(월별 생존율)
import { readFileSync, writeFileSync } from "node:fs";
import { FAITH } from "../src/game/data";

const [outDir, ...files] = process.argv.slice(2);
type Row = {
  cls: string; goal: string; faith: string | null; n: number;
  m1dead: number; clear12: number; s2clear12: number; alive12: number; lv4: number;
  levelSum: number; firstClearMonthSum: number; firstClearN: number;
  aliveByMonth: number[]; causes: Record<string, number>; inquisition: number; star3: number;
};
const rows: Row[] = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
const CLS: Record<string, string> = { adventurer: "모험가", warrior: "전사", mage: "마법사" };
const GOAL: Record<string, string> = { explore: "탐험", rush: "돌파", farm: "파밍" };
const short = (f: string | null) => (f ? f.replace(/의 신$/, "") : "없음");
const pct = (x: number, n: number) => Math.round((x / n) * 1000) / 10;
const order = (r: Row) => ["adventurer", "warrior", "mage"].indexOf(r.cls) * 100 + ["explore", "rush", "farm"].indexOf(r.goal) * 10 + [null, ...Object.values(FAITH)].indexOf(r.faith);
rows.sort((a, b) => order(a) - order(b));
const key = (r: Row) => ({ class: CLS[r.cls], goal: GOAL[r.goal], faith: short(r.faith) });
const combos = rows.map((r) => ({
  ...key(r), runs: r.n,
  month1_death_pct: pct(r.m1dead, r.n), clear_s1_12m_pct: pct(r.clear12, r.n), clear_s2_12m_pct: pct(r.s2clear12, r.n),
  alive_12m_pct: pct(r.alive12, r.n), level4_pct: pct(r.lv4, r.n), avg_level: Math.round((r.levelSum / r.n) * 10) / 10,
  avg_first_clear_month: r.firstClearN ? Math.round((r.firstClearMonthSum / r.firstClearN) * 10) / 10 : null,
  inquisition_pct: r.faith ? pct(r.inquisition, r.n) : null, star3_pct: r.faith ? pct(r.star3, r.n) : null,
}));
const causes = rows.flatMap((r) => Object.entries(r.causes).sort((a, b) => b[1] - a[1]).map(([cause, deaths]) => ({ ...key(r), cause, deaths, pct_of_runs: pct(deaths, r.n) })));
const survival = rows.flatMap((r) => r.aliveByMonth.map((a, month) => ({ ...key(r), month, alive_pct: pct(a, r.n) })));
writeFileSync(`${outDir}/combos.json`, JSON.stringify(combos));
writeFileSync(`${outDir}/causes.json`, JSON.stringify(causes));
writeFileSync(`${outDir}/survival.json`, JSON.stringify(survival));
console.log(`조합 ${combos.length} · 사망 원인 ${causes.length}줄 · 생존 ${survival.length}줄`);
