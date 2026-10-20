import { useState } from "react";
import { STAT_KEYS, STAT_LABEL } from "../game/data";
import { SKILLS } from "../game/skills";
import type { Ctl } from "./App";
import { Card, GameScreen, HeroHeader, SceneBanner } from "./components";
import { WEEK_SCENE } from "./art";
import { t } from "../i18n";

export function WeekResultScreen({ ctl }: { ctl: Ctl }) {
  const { s, dispatch } = ctl;
  const r = s.weekResult!;
  const [revealed, setRevealed] = useState(false);
  const changed = STAT_KEYS.filter((k) => r.statDelta[k]);
  const toDungeon = r.week >= 3;

  return (
    <GameScreen
      ctl={ctl}
      title={t("{m}월 {w}주차 결과", { m: r.month, w: r.week })}
      header={<HeroHeader s={s} onOpen={() => ctl.setSheet(true)} />}
      dock={
        <button className="btn primary wide" onClick={() => dispatch({ t: "closeWeek" })}>
          {toDungeon ? t("4주차 — 미궁 준비로 →") : t("다음 주 →")}
        </button>
      }
      dockClass="dock-cta"
    >
      <Card title={r.title} className="result">
        {WEEK_SCENE[r.title] && <SceneBanner id={WEEK_SCENE[r.title]} />}
        {r.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        {r.goldDelta !== 0 && <p className={r.goldDelta > 0 ? "good" : "hurt"}>{r.goldDelta > 0 ? `+${r.goldDelta}` : r.goldDelta}G</p>}
        {r.levelUp && (
          <p className="levelup">
            LEVEL UP {r.levelUp.from} → {r.levelUp.to}
          </p>
        )}
        {r.learned && (
          <p className="learned">
            {t("새 기술")} — <b>{SKILLS[r.learned].name}</b>
            <span className="dim small"> ({SKILLS[r.learned].kind === "active" ? t("자동 발동") : t("패시브")}) {SKILLS[r.learned].desc}</span>
          </p>
        )}
        {changed.length > 0 && (
          <div className="delta-grid" onClick={() => setRevealed(true)}>
            {changed.map((k) => {
              const after = s.hero.stats[k];
              const d = r.statDelta[k]!;
              return (
                <div key={k} className="delta-row">
                  <span>{STAT_LABEL[k]}</span>
                  <span className="num">{after - d}</span>
                  <span className="dim">→</span>
                  <b className="num">{revealed ? after : "?"}</b>
                  <span className="good num">{revealed ? `+${d}` : ""}</span>
                </div>
              );
            })}
            {!revealed && <p className="dim small center blink">{t("눌러서 성장 확인")}</p>}
          </div>
        )}
      </Card>
      <Card title={t("마을 소문")}>
        {r.feed.map((l, i) => (
          <p key={i} className="feed">
            ♥ {l}
          </p>
        ))}
      </Card>
    </GameScreen>
  );
}
