import type { GameState, Meta } from "../game/types";
import { Card, SceneBanner, Shell } from "./components";
import { BUILD } from "../platform/build";
import { Icon } from "./icons";
import { t } from "../i18n";
import { LangPicker } from "./LangPicker";

interface Props {
  run: GameState | null;
  meta: Meta;
  onNew: () => void;
  onContinue: () => void;
  onGraveyard: () => void;
  onCodex: () => void;
}

export function TitleScreen({ run, meta, onNew, onContinue, onGraveyard, onCodex }: Props) {
  const canContinue = run && run.phase !== "dead" && run.phase !== "create";

  return (
    <Shell>
      <div className="title-wrap title-screen">
        <SceneBanner id="title" className="title-art">
          <img className="title-hero" src="./hero.png" width={74} height={180} alt={t("숏소드를 든 열여섯 살 모험가 소년")} />
        </SceneBanner>
        <div className="logo-block">
          <h1 className="logo">DDD</h1>
          <div className="logo-rule">◆</div>
          <p className="tagline">{t("열여섯 살, 미궁으로")}</p>
          <p className="title-sub">{t("섬의 영지 · 미궁 · 매달의 세금 · 단 한 번의 삶")}</p>
        </div>
      </div>

      <nav className="menu" aria-label={t("메뉴")}>
        {canContinue && (
          <button className="btn primary" onClick={onContinue}>
            <Icon name="flame" />
            <span className="menu-text">
              <b>{t("이어하기")}</b>
              <small>
                {t(run!.hero.name)} ·
 {t("{m}월 {w}주차", { m: run!.month, w: run!.week })} · Lv {run!.hero.level}
              </small>
            </span>
            <Icon name="chev" className="chev" />
          </button>
        )}
        <button className={`btn ${canContinue ? "" : "primary"}`} onClick={onNew}>
          <Icon name="sword" />
          <span className="menu-text">
            <b>{t("새로운 인생 시작")}</b>
            <small>{t("열여섯 살, 처음 미궁에 들어서는 날부터")}</small>
          </span>
          <Icon name="chev" className="chev" />
        </button>
        <button className="btn" onClick={onGraveyard}>
          <Icon name="grave" />
          <span className="menu-text">
            <b>{t("묘지")}</b>
            <small>{t("잠든 모험가 {n}명", { n: meta.graveyard.length })}</small>
          </span>
          <Icon name="chev" className="chev" />
        </button>
        <button className="btn" onClick={onCodex}>
          <Icon name="book" />
          <span className="menu-text">
            <b>{t("몬스터 도감")}</b>
            <small>{t("발견 {n}종", { n: meta.codex.seen.length })}</small>
          </span>
          <Icon name="chev" className="chev" />
        </button>
      </nav>

      {((meta.clues?.length ?? 0) > 0 || (meta.endings?.length ?? 0) > 0) && (
        <Card title={meta.endings?.includes("true") ? t("옛 신들이 돌아왔다") : t("진실 조각")}>
          <p className="small">
            {t("진실 {n}/7", { n: meta.clues?.length ?? 0 })}
            {meta.endings?.includes("offering") && ` · ${t("헌납 엔딩")}`}
            {meta.endings?.includes("fallen") && ` · ${t("영주에게 맞선 자")}`}
            {meta.endings?.includes("escape") && ` · ${t("섬을 떠난 자")}`}
            {meta.endings?.includes("true") && ` · ${t("진엔딩 — 이제 모든 신을 시작 신앙으로 고를 수 있다")}`}
          </p>
        </Card>
      )}

      {meta.faiths.length > 0 && (
        <Card title={t("해금된 옛 신")}>
          <div className="chips">
            {meta.faiths.map((f) => (
              <span key={f} className="faith-tag">
                {t(f)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <footer className="title-foot">
        <LangPicker />
        <p className="dim small center">{t("기록은 이 기기에만 저장됩니다")}</p>
        <p className="dim small center">{t("아동 사망·처형 등 무거운 장면이 나옵니다")}</p>
        <p className="dim small center">v{BUILD.version} · {BUILD.commit}</p>
      </footer>
    </Shell>
  );
}
