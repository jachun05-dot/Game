import { useCallback, useEffect, useRef, useState } from "react";
import { act, type Action } from "../game/engine";
import { botAction } from "../game/bot";
import { newRun } from "../game/town";
import type { GameState, Meta } from "../game/types";
import { buryTomb, loadMeta, loadRun, saveMeta, saveRun } from "./storage";
import { TitleScreen } from "./TitleScreen";
import { CreateScreen } from "./CreateScreen";
import { TownScreen } from "./TownScreen";
import { WeekResultScreen } from "./WeekResultScreen";
import { DungeonScreen } from "./DungeonScreen";
import { SettlementScreen } from "./SettlementScreen";
import { DeadScreen } from "./DeadScreen";
import { GraveyardScreen } from "./GraveyardScreen";
import { GameScreen, HeroHeader, LogView } from "./components";

export type Speed = 1 | 2 | 4 | 8 | 0; // 0 = 즉시

export interface Ctl {
  s: GameState;
  meta: Meta;
  dispatch: (a: Action) => void;
  /** 로그 연출이 아직 남아 있으면 true — 이때는 선택지를 숨긴다 */
  busy: boolean;
  shown: number;
  revealAll: () => void;
  speed: Speed;
  setSpeed: (v: Speed) => void;
  auto: boolean;
  setAuto: (v: boolean) => void;
  goTitle: () => void;
  /** 캐릭터(장비) 화면 열기/닫기 */
  sheet: boolean;
  setSheet: (v: boolean) => void;
}

const LINE_MS = 520;

export function App() {
  const [s, setS] = useState<GameState | null>(() => loadRun());
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [view, setView] = useState<"title" | "game" | "graveyard">("title");
  const [shown, setShown] = useState(() => loadRun()?.logCount ?? 0);
  const [speed, setSpeed] = useState<Speed>(2);
  const [auto, setAuto] = useState(false);
  const [sheet, setSheet] = useState(false);
  const autoTimer = useRef<number | null>(null);

  useEffect(() => saveRun(s), [s]);
  useEffect(() => saveMeta(meta), [meta]);

  // 사망하면 묘지에 묻고 신앙 해금을 기록한다
  useEffect(() => {
    if (s?.phase === "dead" && s.tomb) setMeta((m) => buryTomb(m, s.tomb!));
  }, [s?.phase, s?.tomb]);

  const total = s?.logCount ?? 0;
  const busy = shown < total;

  // 로그를 한 줄씩 흘려보낸다(참고작 80억 분의 1의 진행 연출)
  useEffect(() => {
    if (!busy) return;
    if (speed === 0) {
      setShown(total);
      return;
    }
    const t = window.setTimeout(() => setShown((n) => Math.min(total, n + 1)), LINE_MS / speed);
    return () => window.clearTimeout(t);
  }, [busy, shown, total, speed]);

  const dispatch = useCallback((a: Action) => {
    setS((prev) => (prev ? act(prev, a) : prev));
  }, []);

  // 자동 결정: 연출이 끝나면 봇 정책으로 다음 선택을 고른다
  useEffect(() => {
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    if (!auto || !s || busy || view !== "game") return;
    if (s.phase === "dead" || s.phase === "create") return;
    const a = botAction(s);
    if (!a) return;
    autoTimer.current = window.setTimeout(() => dispatch(a), speed === 0 ? 60 : 700 / Math.max(1, speed));
    return () => {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    };
  }, [auto, s, busy, view, speed, dispatch]);

  useEffect(() => {
    if (s?.phase === "dead") setAuto(false);
  }, [s?.phase]);

  const startNew = () => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
    const run = newRun(seed);
    setS(run);
    setShown(0);
    setAuto(false);
    setView("game");
  };

  const goTitle = () => setView("title");

  if (view === "graveyard") return <GraveyardScreen meta={meta} onBack={() => setView(s && s.phase !== "dead" ? "game" : "title")} />;

  if (view === "title" || !s) {
    return (
      <TitleScreen
        run={s}
        meta={meta}
        onNew={startNew}
        onContinue={() => {
          setShown(s?.logCount ?? 0);
          setView("game");
        }}
        onGraveyard={() => setView("graveyard")}
        onImport={(run, m) => {
          setS(run);
          setMeta(m);
          setShown(run?.logCount ?? 0);
        }}
      />
    );
  }

  const ctl: Ctl = {
    s,
    meta,
    dispatch,
    busy,
    shown,
    revealAll: () => setShown(total),
    speed,
    setSpeed,
    auto,
    setAuto,
    goTitle,
    sheet,
    setSheet,
  };

  // 전투·던전이 끝나 결과 화면으로 넘어가도, 남은 로그(마지막 일격 등)는 먼저 다 보여준다
  if (busy && (s.phase === "week-result" || s.phase === "settlement" || s.phase === "dead")) {
    return <CatchUpScreen ctl={ctl} />;
  }

  switch (s.phase) {
    case "create":
      return <CreateScreen ctl={ctl} />;
    case "town":
      return <TownScreen ctl={ctl} onGraveyard={() => setView("graveyard")} />;
    case "week-result":
      return <WeekResultScreen ctl={ctl} />;
    case "dungeon":
      return <DungeonScreen ctl={ctl} />;
    case "settlement":
      return <SettlementScreen ctl={ctl} />;
    case "dead":
      return <DeadScreen ctl={ctl} onNew={startNew} onGraveyard={() => setView("graveyard")} />;
  }
}

function CatchUpScreen({ ctl }: { ctl: Ctl }) {
  return (
    <GameScreen
      ctl={ctl}
      title="…"
      header={<HeroHeader s={ctl.s} />}
      dock={
        <button className="btn wide" onClick={ctl.revealAll}>
          넘기기
        </button>
      }
      dockClass="dock-cta"
    >
      <LogView ctl={ctl} fill />
    </GameScreen>
  );
}
