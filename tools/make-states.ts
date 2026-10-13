// 화면 확인용 저장 데이터 만들기(봇으로 진행해 각 화면 상태를 JSON으로 남긴다)
// 실행: bun tools/make-states.ts [출력 폴더=shots/states]
import { mkdirSync, writeFileSync } from "node:fs";
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import type { GameState } from "../src/game/types";

const dir = process.argv[2] ?? "shots/states";
mkdirSync(dir, { recursive: true });
const want: Record<string, (s: GameState) => boolean> = {
  town: (s) => s.phase === "town" && s.month >= 2,
  "week-result": (s) => s.phase === "week-result",
  dungeon: (s) => s.phase === "dungeon" && !s.dungeon!.pending && s.dungeon!.floor >= 2,
  "dungeon-frag": (s) => s.phase === "dungeon" && s.dungeon!.pending?.kind === "frag",
  "dungeon-gear": (s) => s.phase === "dungeon" && s.dungeon!.pending?.kind === "gear",
  settlement: (s) => s.phase === "settlement",
};
const found: Record<string, GameState> = {};
for (let seed = 1; seed < 3000 && Object.keys(found).length < Object.keys(want).length; seed++) {
  const s = newRun(seed * 97);
  for (let i = 0; i < 60000 && s.month <= 12; i++) {
    for (const [k, f] of Object.entries(want)) if (!found[k] && f(s)) found[k] = structuredClone(s);
    if (s.phase === "dead") break;
    const a = botAction(s);
    if (!a) break;
    apply(s, a);
  }
}
for (const [k, s] of Object.entries(found)) writeFileSync(`${dir}/${k}.json`, JSON.stringify(s));
console.log(`${dir}: ${Object.keys(found).join(", ")}`);
