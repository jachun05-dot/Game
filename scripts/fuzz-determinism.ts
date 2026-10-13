// 결정성 검사: 같은 시드를 같은 프로세스에서 두 번(사이에 다른 판을 끼워) 돌려 결과가 같은지 본다.
// 모듈 전역 상태가 새면(캐시·상수 변형) 결과가 달라진다. 실행: bun scripts/fuzz-determinism.ts [판수]
import { newRun } from "../src/game/town";
import { act, apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH } from "../src/game/data";
import type { ClassId } from "../src/game/classes";
import type { GameState } from "../src/game/types";

const N = Number(process.argv[2] ?? 200);
function play(seed: number, pure: boolean): GameState {
  let s = newRun(seed * 7919);
  s.faithsKnown = Object.values(FAITH);
  const cls = (["adventurer", "warrior", "mage"] as ClassId[])[seed % 3];
  const faith = [null, ...Object.values(FAITH)][seed % 9];
  apply(s, { t: "pickClass", cls });
  apply(s, { t: "create", name: "퍼즈", candidate: 0, faith });
  for (let i = 0; i < 30000 && s.phase !== "dead" && s.month <= 12; i++) {
    const a = botAction(s);
    if (!a) break;
    if (pure) {
      const before = JSON.stringify(s);
      const next = act(s, a);
      if (JSON.stringify(s) !== before) throw new Error(`act가 이전 상태를 바꿈 seed ${seed} ${JSON.stringify(a)}`);
      s = next;
    } else apply(s, a);
  }
  return s;
}
/** 묘비의 사망 시각(실제 시계)은 빼고 비교 */
const key = (s: GameState) => JSON.stringify({ ...s, tomb: s.tomb && { ...s.tomb, diedAt: "" } });
let bad = 0;
const first = new Map<number, string>();
for (let seed = 1; seed <= N; seed++) first.set(seed, key(play(seed, false)));
for (let seed = N; seed >= 1; seed--) {
  const again = key(play(seed, seed % 10 === 0));
  if (again !== first.get(seed)) { bad++; if (bad <= 5) console.log(`seed ${seed} 결과가 다름`); }
}
console.log(`판 ${N} · 불일치 ${bad}`);
