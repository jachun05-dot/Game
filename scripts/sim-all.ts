// 직업별 요약: 첫 달 미궁 사망률, 12개월 안에 1섹터 클리어율, 레벨 4 이상 도달률
// 실행: bun scripts/sim-all.ts [판수]
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import type { ClassId } from "../src/game/classes";
import { FRAGMENTS } from "../src/game/fragments";

// FRAG_OFF=1 이면 편린 없이 비교
if (process.env.FRAG_OFF) for (const f of Object.values(FRAGMENTS)) f.chance = 0;

const N = Number(process.argv[2] ?? 1000);
for (const cls of ["adventurer", "warrior", "mage"] as ClassId[]) {
  let m1dead = 0, clear = 0, lv4 = 0, alive12 = 0, frag = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = newRun(seed * 7919);
    apply(s, { t: "pickClass", cls });
    for (let i = 0; i < 60000 && s.phase !== "dead" && s.month <= 12; i++) {
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
    }
    if (s.phase === "dead" && s.tomb!.months === 1) m1dead++;
    if (s.rank > 0 || (s.tomb && s.tomb.reached.includes("클리어"))) clear++;
    if (s.hero.level >= 4) lv4++;
    if (s.phase !== "dead") alive12++;
    if (s.fragments.length > 0) frag++;
  }
  const p = (x: number) => `${((x / N) * 100).toFixed(1)}%`;
  console.log(`${cls.padEnd(10)} 첫 달 사망 ${p(m1dead)} | 12개월 내 1섹터 클리어 ${p(clear)} | 레벨4 도달 ${p(lv4)} | 12개월 생존 ${p(alive12)} | 편린 보유 ${p(frag)}`);
}
