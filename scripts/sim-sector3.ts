// 3섹터 밸런스: 2섹터를 처음 클리어한 뒤 6개월 안에 3섹터를 클리어하는 비율(목표 ~35%)
// 실행: bun scripts/sim-sector3.ts [판수] [시작 시드]
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import type { ClassId } from "../src/game/classes";

const N = Number(process.argv[2] ?? 1000);
const START = Number(process.argv[3] ?? 1);
for (const cls of ["adventurer", "warrior", "mage"] as ClassId[]) {
  let s2 = 0, s3in6 = 0, dead6 = 0, entered3 = 0, lv10 = 0, repairs = 0, corr = 0;
  const causes = new Map<string, number>();
  for (let seed = START; seed < START + N; seed++) {
    const s = newRun(seed * 7919);
    apply(s, { t: "pickClass", cls });
    let m2 = 0, m3 = 0, entered = false;
    for (let i = 0; i < 400000 && s.phase !== "dead"; i++) {
      if (!m2 && s.rank >= 2) m2 = s.month;
      if (!m3 && s.rank >= 3) m3 = s.month;
      if (s.dungeon?.sector === 3 && !s.dungeon.endless) entered = true;
      if (m2 && s.month > m2 + 6) break;
      if (!m2 && s.month > 30) break;
      const a = botAction(s);
      if (!a) break;
      if (m2 && a.t === "repair") repairs++;
      apply(s, a);
      if (m2 && s.log.length && s.log[s.log.length - 1].text.startsWith("【부식】")) corr++;
    }
    if (!m2) continue;
    s2++;
    if (entered) entered3++;
    if (m3 && m3 - m2 <= 6) s3in6++;
    if (s.hero.level >= 10) lv10++;
    if (s.phase === "dead" && s.month <= m2 + 6) {
      dead6++;
      const c = (s.tomb!.reached.includes("3섹터") ? "3섹터: " : s.tomb!.reached.includes("끝없는") ? "끝없는: " : "그 외: ") + s.tomb!.cause.replace(/.*에게 /, "…에게 ");
      causes.set(c, (causes.get(c) ?? 0) + 1);
    }
  }
  const p = (x: number) => `${((x / Math.max(1, s2)) * 100).toFixed(1)}%`;
  console.log(`${cls.padEnd(10)} 2섹터 클리어 ${s2}명 중 → 6개월 안 3섹터 클리어 ${p(s3in6)} | 3섹터 진입 ${p(entered3)} | 6개월 안 사망 ${p(dead6)} | 레벨10 ${p(lv10)} | 수리 ${repairs} · 부식 ${corr}`);
  console.log("   사망 원인 " + [...causes].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, k]) => `${c} ${p(k)}`).join(" · "));
}
