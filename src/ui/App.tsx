import { useCallback, useEffect, useRef, useState } from "react";
import { act, type Action } from "../game/engine";
import { botAction } from "../game/bot";
import { newRun } from "../game/town";
import type { GameState, Meta } from "../game/types";
import { buryTomb, loadMeta, loadRun, saveMeta, saveRun } from "../save";
import { reportLife } from "./lifeReport";
import { useUpdateNotice } from "./useUpdateNotice";
import { TitleScreen } from "./TitleScreen";
import { CreateScreen } from "./CreateScreen";
import { TownScreen } from "./TownScreen";
import { WeekResultScreen } from "./WeekResultScreen";
import { DungeonScreen } from "./DungeonScreen";
import { SettlementScreen } from "./SettlementScreen";
import { DeadScreen } from "./DeadScreen";
import { GraveyardScreen } from "./GraveyardScreen";
import { CodexScreen } from "./CodexScreen";
import { mergeCodex } from "../game/fragments";
import { FAITH } from "../game/data";
import { GameScreen, HeroHeader, LogView } from "./components";
import { useLang } from "../i18n";
import { ALL_ENDINGS, ALL_FAITHS, META_CLUES, fullCodex, isUnlockTester } from "../game/tester";

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
  /** 몬스터 도감 열기 */
  openCodex: () => void;
  /** 캐릭터(장비) 화면 열기/닫기 */
  sheet: boolean;
  setSheet: (v: boolean) => void;
  /** 처음 안내를 봤다고 기록 / 안내 끄기·켜기 */
  dismissTip: (id: string) => void;
  setTipsOff: (off: boolean) => void;
}

const LINE_MS = 520;

export function App() {
  const newer = useUpdateNotice();
  useLang(); // 언어를 바꾸면 화면 전체를 다시 그린다
  return (
    <>
      {newer && <UpdateBanner />}
      <Game />
    </>
  );
}

/** 새 버전 알림: 진행은 상태가 바뀔 때마다 저장되므로 바로 새로고침해도 된다 */
function UpdateBanner() {
  return (
    <div className="update-banner" role="status">
      새 버전이 나왔어요
      <button className="btn small" onClick={() => window.location.reload()}>
        새로고침
      </button>
    </div>
  );
}

function Game() {
  const [s, setS] = useState<GameState | null>(() => loadRun());
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  // ?view=game 이면 타이틀을 건너뛰고 저장된 화면으로(화면 점검용 — 스크린샷 스크립트)
  const [view, setView] = useState<"title" | "game" | "graveyard" | "codex">(() =>
    typeof location !== "undefined" && new URLSearchParams(location.search).get("view") === "game" && loadRun() ? "game" : "title",
  );
  const [shown, setShown] = useState(() => loadRun()?.logCount ?? 0);
  const [speed, setSpeed] = useState<Speed>(2);
  const [auto, setAuto] = useState(false);
  const [sheet, setSheet] = useState(false);
  const autoTimer = useRef<number | null>(null);
  const codexFrom = useRef<"title" | "game">("title");

  useEffect(() => saveRun(s), [s]);
  useEffect(() => saveMeta(meta), [meta]);

  // 사망하면 묘지에 묻고 신앙 해금을 기록한다
  useEffect(() => {
    if (s?.phase === "dead" && s.tomb) setMeta((m) => buryTomb(m, s.tomb!));
  }, [s?.phase, s?.tomb]);

  // 테스트 결과: 아티팩트로 열었으면 끝난 삶을 db에 남긴다(lifeReport.ts)
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (s?.phase !== "dead" || !s.tomb || reported.current === s.tomb.id) return;
    reported.current = s.tomb.id;
    void reportLife(s);
  }, [s?.phase, s?.tomb]);

  // 도감은 삶을 넘어 이어진다: 진행 중인 삶의 도감을 Meta에 합친다
  useEffect(() => {
    if (!s?.codex) return;
    setMeta((m) => {
      const c = mergeCodex(m.codex, s.codex);
      return JSON.stringify(c) === JSON.stringify(m.codex) ? m : { ...m, codex: c };
    });
  }, [s?.codex]);

  // 테스터 Dabong: 다음 삶에도 모두 열려 있게 Meta에 신앙·엔딩·조각·도감을 합친다(tester.ts)
  useEffect(() => {
    if (!s || s.phase === "create" || !isUnlockTester(s.hero.name)) return;
    setMeta((m) => {
      const faiths = [...new Set([...m.faiths, ...ALL_FAITHS])];
      const endings = [...new Set([...(m.endings ?? []), ...ALL_ENDINGS])];
      const clues = [...new Set([...(m.clues ?? []), ...META_CLUES])];
      const codex = mergeCodex(m.codex, fullCodex());
      const same = faiths.length === m.faiths.length && endings.length === (m.endings ?? []).length && clues.length === (m.clues ?? []).length && JSON.stringify(codex) === JSON.stringify(m.codex);
      return same ? m : { ...m, faiths, endings, clues, codex };
    });
  }, [s?.hero.name, s?.phase]);

  // 진실 조각도 삶을 넘어 이어진다(영주의 칙서만은 진엔딩에 그 삶에서 다시 들어야 한다)
  useEffect(() => {
    if (!s?.clues?.length) return;
    setMeta((m) => {
      const clues = [...new Set([...(m.clues ?? []), ...s.clues!])];
      return clues.length === (m.clues ?? []).length ? m : { ...m, clues };
    });
  }, [s?.clues]);

  const total = s?.logCount ?? 0;
  const busy = shown < total;

  // 로그를 한 줄씩 흘려보낸다(참고작 80억 분의 1의 진행 연출)
  useEffect(() => {
    if (!busy) return;
    if (speed === 0) {
      setShown(total);
      return;
    }
    // 접힌 전투의 세부 줄은 기다리지 않고 건너뛴다
    const start = (s?.logCount ?? 0) - (s?.log.length ?? 0);
    const folded = (k: number) => s?.log[k - start]?.fold !== undefined;
    const t = window.setTimeout(() => setShown((n) => {
      let k = n + 1;
      while (k < total && folded(k)) k++;
      return Math.min(total, k);
    }), LINE_MS / speed);
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

  // 자동 결정은 미궁 한 번까지: 죽거나 미궁에서 나오면(정산·마을로 돌아오면) 꺼진다
  const prevPhase = useRef(s?.phase);
  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = s?.phase;
    if (s?.phase === "dead" || (was === "dungeon" && s?.phase !== "dungeon")) setAuto(false);
  }, [s?.phase]);

  const startNew = () => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
    const run = newRun(seed);
    run.codex = structuredClone(meta.codex);
    // 진엔딩을 본 뒤로는 해금하지 않은 신도 시작 신앙으로 고를 수 있다
    run.faithsKnown = meta.endings?.includes("true") ? [...new Set([...meta.faiths, ...Object.values(FAITH)])] : [...meta.faiths];
    run.clues = [...(meta.clues ?? [])];
    // 헌납 엔딩을 본 다음 삶: 첫 탐문에서 짝신의 이름을 꿈에서 듣는다
    if (meta.endings?.includes("offering") && !run.clues.includes("name")) run.clueBits = ["dream"];
    setS(run);
    setShown(0);
    setAuto(false);
    setView("game");
  };

  const goTitle = () => setView("title");

  if (view === "codex") return <CodexScreen codex={s ? mergeCodex(meta.codex, s.codex) : meta.codex} onBack={() => setView(s && s.phase !== "dead" && s.phase !== "create" && codexFrom.current === "game" ? "game" : "title")} />;

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
        onCodex={() => {
          codexFrom.current = "title";
          setView("codex");
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
    openCodex: () => {
      codexFrom.current = "game";
      setSheet(false);
      setView("codex");
    },
    sheet,
    setSheet,
    dismissTip: (id) => setMeta((m) => ({ ...m, tipsSeen: [...new Set([...(m.tipsSeen ?? []), id])] })),
    setTipsOff: (off) => setMeta((m) => ({ ...m, tipsOff: off })),
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
