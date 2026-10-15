// 전체 여정: 새 삶 하나를 처음부터 엔딩·죽음까지(최대 10년) 돌려, 섹터별 첫 클리어 시점과 엔딩·죽은 곳을 센다.
// 실행: bun scripts/sim-journey.ts <판수> <시작 시드> <직업> <none|faith> [출력 JSON]
import { writeFileSync } from "node:fs";
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH } from "../src/game/data";
import type { ClassId } from "../src/game/classes";

const N = Number(process.argv[2] ?? 1000);
const START = Number(process.argv[3] ?? 1);
const cls = (process.argv[4] ?? "warrior") as ClassId;
const mode = process.argv[5] ?? "none";
const out = process.argv[6];
const MAX_MONTH = 120;
const gods = Object.values(FAITH);

type Life = { clear: (number | null)[]; ending: string | null; endMonth: number | null; dead: boolean; deathMonth: number | null; deathStage: number; cause: string; taught: boolean };
const lives: Life[] = [];
for (let seed = START; seed < START + N; seed++) {
  const s = newRun(seed * 7919 + 17);
  apply(s, { t: "pickClass", cls });
  if (mode === "faith") s.faithsKnown = [...gods];
  apply(s, { t: "create", name: "봇", candidate: 0, faith: mode === "faith" ? gods[seed % gods.length] : null });
  const clear: (number | null)[] = [null, null, null, null, null, null, null];
  for (let i = 0; i < 6000000 && s.phase !== "dead" && s.month <= MAX_MONTH; i++) {
    for (let k = 1; k <= 6; k++) if (clear[k] === null && s.rank >= k) clear[k] = s.month;
    const a = botAction(s);
    if (!a) break;
    apply(s, a);
  }
  for (let k = 1; k <= 6; k++) if (clear[k] === null && s.rank >= k) clear[k] = s.month;
  const ending = s.tomb?.ending && s.tomb.ending !== "fallen" ? s.tomb.ending : null;
  const dead = s.phase === "dead" && !ending;
  // 죽은 단계: 그때까지 클리어한 섹터 수 + 1(= 도전 중이던 섹터)
  lives.push({ clear, ending, endMonth: ending ? s.month : null, dead, deathMonth: dead ? s.month : null, deathStage: dead ? s.rank + 1 : 0, cause: dead ? s.tomb!.cause : "", taught: !!s.godTeaching });
  if ((seed - START) % 250 === 249) console.error(`${cls}/${mode} ${seed - START + 1}/${N}`);
}

const pct = (x: number) => Math.round((x / N) * 1000) / 10;
const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
const rows = [1, 2, 3, 4, 5, 6].map((k) => ({ sector: k, reached_pct: pct(lives.filter((l) => l.clear[k] !== null).length), median_month: med(lives.filter((l) => l.clear[k] !== null).map((l) => l.clear[k]!)) }));
const endings = lives.filter((l) => l.ending);
const deathsByStage = [1, 2, 3, 4, 5, 6, 7].map((k) => ({ stage: k, dead_pct: pct(lives.filter((l) => l.dead && l.deathStage === k).length) }));
const causes = new Map<string, number>();
for (const l of lives) if (l.dead) {
  const c = l.cause.replace(/(, [^,]+)+에게 둘러싸여/, " 등에게 둘러싸여").replace(/.*에게 (몸통을 꿰뚫려 )?쓰러졌다/, "전투(단독)").replace(/.*등에게 둘러싸여 쓰러졌다/, "전투(무리)").replace(/.*에게 둘러싸여 쓰러졌다/, "전투(무리)").replace(/.*의 일격에 머리를 잃었다/, "머리 부상");
  causes.set(c, (causes.get(c) ?? 0) + 1);
}
const summary = {
  class: cls, mode, n: N,
  sectors: rows,
  ending_pct: pct(endings.length), offering: endings.filter((l) => l.ending === "offering").length, true_ending: endings.filter((l) => l.ending === "true").length,
  ending_median_month: med(endings.map((l) => l.endMonth!)),
  alive_at_end_pct: pct(lives.filter((l) => !l.dead && !l.ending).length),
  deaths_by_stage: deathsByStage,
  causes: [...causes].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cause, n]) => ({ cause, pct: pct(n) })),
  taught_pct: pct(lives.filter((l) => l.taught).length),
  // 단계별 경제 사망(세금 처형·굶주림): 그 단계에서 죽은 사람 중 비율
  economy_by_stage: [1, 2, 3, 4, 5, 6].map((k) => {
    const d = lives.filter((l) => l.dead && l.deathStage === k);
    return { stage: k, tax_pct: pct(d.filter((l) => l.cause.includes("세금")).length), starve_pct: pct(d.filter((l) => l.cause.includes("굶어")).length) };
  }),
  death_month_median: med(lives.filter((l) => l.dead).map((l) => l.deathMonth!)),
};
console.log(JSON.stringify(summary));
if (out) writeFileSync(out, JSON.stringify(summary));
