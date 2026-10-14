// 5섹터 밸런스: 4섹터를 처음 클리어한 뒤 6개월 안에 5섹터를 클리어하는 비율(목표 ~30%), 5섹터 첫 진입 달 사망
// 실행: bun scripts/sim-sector5.ts [판수] [시작 시드] [직업(쉼표)]
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import type { ClassId } from "../src/game/classes";

const N = Number(process.argv[2] ?? 1000);
const START = Number(process.argv[3] ?? 1);
const CLS = (process.argv[4]?.split(",") ?? ["adventurer", "warrior", "mage"]) as ClassId[];
for (const cls of CLS) {
  let s3 = 0, s4in6 = 0, dead6 = 0, entered4 = 0, firstDeath = 0, shortcuts = 0, lv12 = 0;
  const causes = new Map<string, number>();
  for (let seed = START; seed < START + N; seed++) {
    const s = newRun(seed * 7919);
    apply(s, { t: "pickClass", cls });
    let m3 = 0, m4 = 0, firstMonth = 0;
    for (let i = 0; i < 800000 && s.phase !== "dead"; i++) {
      if (!m3 && s.rank >= 4) m3 = s.month;
      if (!m4 && s.rank >= 5) m4 = s.month;
      if (!firstMonth && s.dungeon?.sector === 5 && !s.dungeon.endless) firstMonth = s.month;
      if (m3 && s.month > m3 + 6) break;
      if (!m3 && s.month > 60) break;
      const a = botAction(s);
      if (!a) break;
      if (a.t === "enterDungeon" && a.shortcut) shortcuts++;
      apply(s, a);
    }
    if (!m3) continue;
    s3++;
    if (firstMonth) entered4++;
    if (m4 && m4 - m3 <= 6) s4in6++;
    if (s.hero.level >= 15) lv12++;
    if (s.phase === "dead" && firstMonth && s.month === firstMonth) firstDeath++;
    if (s.phase === "dead" && s.month <= m3 + 6) {
      dead6++;
      const c = (s.tomb!.reached.includes("5섹터") ? "5섹터: " : s.tomb!.reached.includes("끝없는") ? "끝없는: " : "그 외: ") + s.tomb!.cause.replace(/(, [^,]+)+에게 둘러싸여/, " 등에게 둘러싸여");
      causes.set(c, (causes.get(c) ?? 0) + 1);
    }
  }
  const p = (x: number, of = s3) => `${((x / Math.max(1, of)) * 100).toFixed(1)}%`;
  console.log(`${cls.padEnd(10)} 4섹터 클리어 ${s3}명 → 6개월 안 5섹터 클리어 ${p(s4in6)} | 5섹터 진입 ${p(entered4)} | 첫 진입 달 사망 ${p(firstDeath, entered4)} | 6개월 안 사망 ${p(dead6)} | 레벨15 ${p(lv12)} | 숏컷 ${shortcuts}`);
  console.log("   사망 원인 " + [...causes].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, k]) => `${c} ${p(k)}`).join(" · "));
}
