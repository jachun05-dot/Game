// 밸런스 시뮬레이션: 봇으로 N판을 돌려 사망 원인·생존 기간·도달 깊이를 집계한다.
// 실행: bun scripts/sim.ts [판수]
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";

const N = Number(process.argv[2] ?? 1000);
const causes = new Map<string, number>();
const months: number[] = [];
let clears = 0, survived = 0;
const reached = new Map<string, number>();
for (let seed = 1; seed <= N; seed++) {
  const s = newRun(seed * 7919);
  let firstClearMonth = 0;
  for (let i = 0; i < 50000 && s.phase !== "dead" && s.month <= 12; i++) {
    const a = botAction(s);
    if (!a) break;
    apply(s, a);
    if (s.rank > 0 && !firstClearMonth) firstClearMonth = s.month;
  }
  if (s.rank > 0) clears++;
  if (s.phase === "dead") {
    const key = s.tomb!.cause.replace(/[가-힣 ]*에게 (둘러싸여 )?쓰러졌다/, (m) => (m.includes("둘러싸여") ? "다수에게 쓰러짐" : "단독 적에게 쓰러짐"));
    causes.set(key, (causes.get(key) ?? 0) + 1);
    reached.set(s.tomb!.reached, (reached.get(s.tomb!.reached) ?? 0) + 1);
    months.push(s.month);
  } else survived++;
}
const avg = months.reduce((a, b) => a + b, 0) / Math.max(1, months.length);
console.log(`판수 ${N} | 12개월 생존 ${survived} | 1섹터 클리어 경험 ${clears} (${((clears / N) * 100).toFixed(1)}%) | 사망자 평균 생존 ${avg.toFixed(2)}개월`);
console.log("사망 원인:", [...causes.entries()].sort((a, b) => b[1] - a[1]));
console.log("사망 위치:", [...reached.entries()].sort((a, b) => b[1] - a[1]));
