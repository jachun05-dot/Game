// UI 퍼징: 퍼징 중인 게임 상태를 골라 단계별 화면·캐릭터 시트·도감을 서버 렌더링해 예외를 찾는다.
// 실행: bun scripts/fuzz-ui.tsx [판수] [시작 시드]
import { renderToString } from "react-dom/server";
import { createElement as h } from "react";
import { newRun } from "../src/game/town";
import { apply, type Action } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH } from "../src/game/data";
import type { ClassId } from "../src/game/classes";
import type { GameState, Meta } from "../src/game/types";
import type { Ctl } from "../src/ui/App";
import { CreateScreen } from "../src/ui/CreateScreen";
import { TownScreen } from "../src/ui/TownScreen";
import { WeekResultScreen } from "../src/ui/WeekResultScreen";
import { DungeonScreen } from "../src/ui/DungeonScreen";
import { SettlementScreen } from "../src/ui/SettlementScreen";
import { DeadScreen } from "../src/ui/DeadScreen";
import { CodexScreen } from "../src/ui/CodexScreen";
import { GraveyardScreen } from "../src/ui/GraveyardScreen";
import { emptyCodex } from "../src/game/fragments";

const N = Number(process.argv[2] ?? 200);
const START = Number(process.argv[3] ?? 1);
const noop = () => {};
const errors = new Map<string, { n: number; ex: string }>();

function render(s: GameState, sheet: boolean) {
  const meta: Meta = { graveyard: s.tomb ? [s.tomb] : [], faiths: Object.values(FAITH), codex: s.codex };
  const ctl: Ctl = { s, meta, dispatch: noop, busy: false, shown: s.logCount, revealAll: noop, speed: 1, setSpeed: noop, auto: false, setAuto: noop, goTitle: noop, openCodex: noop, sheet, setSheet: noop };
  const screens: Record<string, () => unknown> = {
    create: () => h(CreateScreen, { ctl }),
    town: () => h(TownScreen, { ctl, onGraveyard: noop }),
    "week-result": () => h(WeekResultScreen, { ctl }),
    dungeon: () => h(DungeonScreen, { ctl }),
    settlement: () => h(SettlementScreen, { ctl }),
    dead: () => h(DeadScreen, { ctl, onNew: noop, onGraveyard: noop }),
  };
  const out = renderToString(screens[s.phase]() as never);
  if (/undefined|NaN|\[object/.test(out.replace(/<[^>]+>/g, " "))) throw new Error("화면에 undefined/NaN: " + (out.replace(/<[^>]+>/g, " ").match(/.{0,40}(undefined|NaN|\[object).{0,40}/)?.[0] ?? ""));
  // 미궁에서는 아래 도크에 누를 수 있는 버튼이 꼭 있어야 한다(없으면 진행 불가)
  const dock = out.indexOf('class="dock');
  if (s.phase === "dungeon" && (dock < 0 || !out.slice(dock).includes("<button"))) throw new Error(`누를 버튼이 없음(${s.phase}${s.dungeon?.pending ? " " + s.dungeon.pending.kind : ""})`);
  if (s.phase === "dead" || Math.random() < 0.05) {
    renderToString(h(CodexScreen, { codex: s.codex ?? emptyCodex(), onBack: noop }));
    renderToString(h(GraveyardScreen, { meta, onBack: noop }));
  }
}

let renders = 0;
for (let i = 0; i < N; i++) {
  const seed = START + i;
  const s = newRun(seed * 7919);
  s.faithsKnown = Object.values(FAITH);
  const cls = (["adventurer", "warrior", "mage"] as ClassId[])[i % 3];
  const faith = [null, ...Object.values(FAITH)][i % 9];
  const steps: Action[] = [{ t: "pickClass", cls }, { t: "create", name: "퍼즈", candidate: 0, faith }];
  try {
    render(s, false);
    for (const a of steps) apply(s, a);
    for (let k = 0; k < 30000 && s.phase !== "dead" && s.month <= 14; k++) {
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
      if (k % 7 === 0 || s.phase !== "dungeon") {
        render(s, k % 5 === 0);
        renders++;
      }
    }
    render(s, false);
    renders++;
  } catch (err) {
    const msg = String((err as Error).message).slice(0, 160);
    const key = msg + " @" + s.phase;
    const e = errors.get(key) ?? { n: 0, ex: `seed ${seed} ${cls} ${faith} ${(err as Error).stack?.split("\n").slice(1, 4).join(" | ")}` };
    e.n++;
    errors.set(key, e);
  }
}
console.log(`판 ${N} · 렌더 ${renders} · 오류 종류 ${errors.size}`);
for (const [k, v] of errors) console.log(`  ${v.n}× ${k}\n     ${v.ex}`);
