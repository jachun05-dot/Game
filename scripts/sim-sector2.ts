// 2섹터 밸런스: 1섹터를 처음 클리어한 뒤 6개월 안에 2섹터를 클리어하는 비율(목표 ~40%)
// 실행: bun scripts/sim-sector2.ts [판수]
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import type { ClassId } from "../src/game/classes";

const N = Number(process.argv[2] ?? 1000);
for (const cls of ["adventurer", "warrior", "mage"] as ClassId[]) {
  let s1 = 0, s2in6 = 0, dead6 = 0, enteredS2 = 0, lv7 = 0;
  const causes = new Map<string, number>();
  for (let seed = 1; seed <= N; seed++) {
    const s = newRun(seed * 7919);
    apply(s, { t: "pickClass", cls });
    let m1 = 0, m2 = 0, entered = false;
    for (let i = 0; i < 200000 && s.phase !== "dead"; i++) {
      if (!m1 && s.rank >= 1) m1 = s.month;
      if (!m2 && s.rank >= 2) m2 = s.month;
      if (s.dungeon?.sector === 2) entered = true;
      if (m1 && s.month > m1 + 6) break;
      if (!m1 && s.month > 18) break;
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
    }
    if (!m1) continue;
    s1++;
    if (entered) enteredS2++;
    if (m2 && m2 - m1 <= 6) s2in6++;
    if (s.hero.level >= 7) lv7++;
    if (s.phase === "dead" && s.month <= m1 + 6) {
      dead6++;
      const c = (s.tomb!.reached.includes("2섹터") ? "2섹터: " : "1섹터·마을: ") + s.tomb!.cause.replace(/.*에게 /, "…에게 ");
      causes.set(c, (causes.get(c) ?? 0) + 1);
    }
  }
  const p = (x: number) => `${((x / Math.max(1, s1)) * 100).toFixed(1)}%`;
  console.log(`${cls.padEnd(10)} 1섹터 클리어 ${s1}명 중 → 6개월 안 2섹터 클리어 ${p(s2in6)} | 2섹터 진입 ${p(enteredS2)} | 6개월 안 사망 ${p(dead6)} | 레벨7 ${p(lv7)}`);
  console.log("   사망 원인 " + [...causes].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, k]) => `${c} ${p(k)}`).join(" · "));
}
