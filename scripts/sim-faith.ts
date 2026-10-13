// 신별 효과: 신앙 없이(기준) vs 각 신을 섬기고 시작했을 때. 봇은 이단 심문에서 신앙을 포기한다.
// 실행: bun scripts/sim-faith.ts [판수] [신 이름(생략 시 전부)]
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH } from "../src/game/data";
import { FAITH_BAL, tier } from "../src/game/faith";

// NO_INQ=1 이면 이단 심문 없이(권능의 순수한 세기)
if (process.env.NO_INQ) FAITH_BAL.inquisitionPerTier = 0;
import type { ClassId } from "../src/game/classes";

const N = Number(process.argv[2] ?? 1000);
const only = process.argv[3];
const ALL = [FAITH.mob, FAITH.starve, FAITH.trap, FAITH.tax, FAITH.song];
const gods: (string | null)[] = only ? [only === "none" ? null : only] : [null, ...ALL];
for (const faith of gods) {
  let m1dead = 0, clear = 0, alive12 = 0, star = 0, inq = 0, total = 0;
  for (const cls of ["adventurer", "warrior", "mage"] as ClassId[]) {
    for (let seed = 1; seed <= N; seed++) {
      const s = newRun(seed * 7919);
      s.faithsKnown = [...ALL];
      apply(s, { t: "pickClass", cls });
      apply(s, { t: "create", name: "봇", candidate: 0, faith });
      let maxTier = 0, asked = false;
      for (let i = 0; i < 60000 && s.phase !== "dead" && s.month <= 12; i++) {
        if (s.settlement?.inquisition) asked = true;
        const a = botAction(s);
        if (!a) break;
        apply(s, a);
        maxTier = Math.max(maxTier, tier(s));
      }
      total++;
      if (s.phase === "dead" && s.tomb!.months === 1) m1dead++;
      if (s.rank > 0 || (s.tomb && s.tomb.reached.includes("클리어"))) clear++;
      if (s.phase !== "dead") alive12++;
      if (maxTier >= 3) star++;
      if (asked) inq++;
    }
  }
  const p = (x: number) => `${((x / total) * 100).toFixed(1)}%`;
  console.log(`${(faith ?? "신앙 없음").padEnd(10)} 첫 달 사망 ${p(m1dead)} | 12개월 클리어 ${p(clear)} | 12개월 생존 ${p(alive12)} | ★3 도달 ${p(star)} | 심문 ${p(inq)}`);
}
