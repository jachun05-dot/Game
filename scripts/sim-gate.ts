// 특화 패시브(3→4 특수 훈련)의 체감: 같은 영웅을 같은 순간에 둘로 나눠
// A는 레벨 3 그대로, B는 3→4 특수 훈련을 받고 첫 1섹터 도전 미궁에 들어간다.
// 그 미궁에서 1섹터 차원문에 닿을 확률과 죽을 확률을 비교한다.
// 실행: bun scripts/sim-gate.ts [방식당 판수] [샤드] [샤드 수]  (PLANS=접두어 필터)
import { newRun, trainCost } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction, setMagePlan } from "../src/game/bot";
import { PLANS } from "./plans";
import type { GameState } from "../src/game/types";

const N = Number(process.argv[2] ?? 1000);
const SHARD = Number(process.argv[3] ?? 0);
const SHARDS = Number(process.argv[4] ?? 1);
const only = process.env.PLANS?.split(",");

function runTrip(s: GameState): { portal: boolean; dead: boolean } {
  let portal = false;
  for (let i = 0; i < 50000; i++) {
    if (s.phase === "dungeon" && s.dungeon?.pending?.kind === "portal" && s.dungeon.sector === 1) portal = true;
    if (s.phase !== "dungeon" && s.phase !== "week-result") break;
    const a = botAction(s);
    if (!a) break;
    apply(s, a);
  }
  return { portal, dead: s.phase === "dead" };
}

const out: unknown[] = [];
PLANS.filter((p) => !only || only.some((o) => p.id.startsWith(o))).forEach((plan, idx) => {
  if (idx % SHARDS !== SHARD) return;
  setMagePlan((s) => plan.pick(s, s.hero.level + 1) as never);
  const row = { id: plan.id, label: plan.label, n: 0, a: { portal: 0, dead: 0 }, b: { portal: 0, dead: 0 } };
  for (let seed = 1; seed <= N; seed++) {
    const s = newRun(seed * 7919);
    apply(s, { t: "pickClass", cls: plan.cls });
    apply(s, { t: "create", name: "봇", candidate: 0, faith: null });
    let snap: GameState | null = null;
    for (let i = 0; i < 200000 && s.phase !== "dead" && s.month <= 12; i++) {
      // 레벨 3, 아직 1섹터 미클리어, 이번 주가 끝나면 미궁에 들어가는 순간
      if (s.phase === "week-result" && s.week === 3 && s.hero.level === 3 && s.rank === 0 && s.inventory.heart === 0) {
        snap = structuredClone(s);
        break;
      }
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
      if (plan.noShield && s.gear.offhand === "shield") delete s.gear.offhand;
    }
    if (!snap) continue;
    const A = structuredClone(snap);
    apply(A, { t: "closeWeek" });
    const ra = runTrip(A);
    const B = structuredClone(snap);
    B.phase = "town";
    B.weekResult = null;
    B.gold += trainCost(B);
    B.inventory.heart = 1;
    const train = botAction(B);
    if (train?.t !== "train") apply(B, { t: "train", training: plan.pick(B, 4) as string, free: ["str", "con"] });
    else apply(B, train);
    if (B.hero.level !== 4) continue;
    apply(B, { t: "closeWeek" });
    const rb = runTrip(B);
    row.n++;
    if (ra.portal) row.a.portal++;
    if (ra.dead) row.a.dead++;
    if (rb.portal) row.b.portal++;
    if (rb.dead) row.b.dead++;
  }
  out.push(row);
  console.error(`[${SHARD}] ${plan.id} ${row.n}`);
});
setMagePlan(null);
console.log(JSON.stringify(out));
