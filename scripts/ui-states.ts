// 화면 점검용 저장 상태 만들기: 봇으로 진행해 단계별(마을·주간 결과·미궁·전투·정산·사망) 상태를 JSON으로 남긴다.
// 실행: bun scripts/ui-states.ts <출력 폴더>  → <폴더>/<이름>.json (localStorage "ddd-run-v1"에 넣으면 그 화면)
import { mkdirSync, writeFileSync } from "node:fs";
import { newRun } from "../src/game/town";
import { act } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import type { GameState } from "../src/game/types";

const out = process.argv[2] ?? "ui-states";
// I18N=en|ja|zh: 그 언어로 진행한 상태를 만든다(로그는 쓰인 순간의 언어로 남는다)
if (process.env.I18N) {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { _setDict } = await import("../src/i18n/core");
  const dir = new URL(`../src/i18n/locales/${process.env.I18N}/`, import.meta.url).pathname;
  const d: Record<string, string> = {};
  for (const f of readdirSync(dir)) Object.assign(d, JSON.parse(readFileSync(dir + f, "utf8")));
  _setDict(process.env.I18N as "en", d);
}
mkdirSync(out, { recursive: true });
const want = new Map<string, (s: GameState) => boolean>([
  ["create", (s) => s.phase === "create"],
  ["town", (s) => s.phase === "town" && s.month >= 2],
  ["week-result", (s) => s.phase === "week-result"],
  ["dungeon", (s) => s.phase === "dungeon" && !s.combat && !s.dungeon?.pending],
  ["dungeon-pending", (s) => s.phase === "dungeon" && !!s.dungeon?.pending],
  ["settlement", (s) => s.phase === "settlement"],
  ["dead", (s) => s.phase === "dead"],
]);
const got = new Set<string>();
for (let seed = 1; seed < 400 && got.size < want.size; seed++) {
  let s = newRun(seed);
  for (let i = 0; i < 20000; i++) {
    for (const [name, ok] of want) {
      if (!got.has(name) && ok(s)) {
        got.add(name);
        writeFileSync(`${out}/${name}.json`, JSON.stringify(s));
      }
    }
    if (s.phase === "dead") break;
    const a = botAction(s);
    if (!a) break;
    s = act(s, a);
  }
}
console.log([...got].join(", "));
