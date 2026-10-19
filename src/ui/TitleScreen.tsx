import type { GameState, Meta } from "../game/types";
import { Card, SceneBanner, Shell } from "./components";
import { BUILD } from "../platform/build";
import { Icon } from "./icons";

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
          <img className="title-hero" src="./hero.png" width={74} height={180} alt="숏소드를 든 열여섯 살 모험가 소년" />
        </SceneBanner>
        <div className="logo-block">
          <h1 className="logo">DDD</h1>
          <div className="logo-rule">◆</div>
          <p className="tagline">열여섯 살, 미궁으로</p>
          <p className="title-sub">섬의 영지 · 미궁 · 매달의 세금 · 단 한 번의 삶</p>
        </div>
      </div>

      <nav className="menu" aria-label="메뉴">
        {canContinue && (
          <button className="btn primary" onClick={onContinue}>
            <Icon name="flame" />
            <span className="menu-text">
              <b>이어하기</b>
              <small>
                {run!.hero.name} · {run!.month}월 {run!.week}주차 · Lv {run!.hero.level}
              </small>
            </span>
            <Icon name="chev" className="chev" />
          </button>
        )}
        <button className={`btn ${canContinue ? "" : "primary"}`} onClick={onNew}>
          <Icon name="sword" />
          <span className="menu-text">
            <b>새로운 인생 시작</b>
            <small>열여섯 살, 처음 미궁에 들어서는 날부터</small>
          </span>
          <Icon name="chev" className="chev" />
        </button>
        <button className="btn" onClick={onGraveyard}>
          <Icon name="grave" />
          <span className="menu-text">
            <b>묘지</b>
            <small>잠든 모험가 {meta.graveyard.length}명</small>
          </span>
          <Icon name="chev" className="chev" />
        </button>
        <button className="btn" onClick={onCodex}>
          <Icon name="book" />
          <span className="menu-text">
            <b>몬스터 도감</b>
            <small>발견 {meta.codex.seen.length}종</small>
          </span>
          <Icon name="chev" className="chev" />
        </button>
      </nav>

      {((meta.clues?.length ?? 0) > 0 || (meta.endings?.length ?? 0) > 0) && (
        <Card title={meta.endings?.includes("true") ? "옛 신들이 돌아왔다" : "진실 조각"}>
          <p className="small">
            진실 {meta.clues?.length ?? 0}/7
            {meta.endings?.includes("offering") && " · 헌납 엔딩"}
            {meta.endings?.includes("fallen") && " · 영주에게 맞선 자"}
            {meta.endings?.includes("escape") && " · 섬을 떠난 자"}
            {meta.endings?.includes("true") && " · 진엔딩 — 이제 모든 신을 시작 신앙으로 고를 수 있다"}
          </p>
        </Card>
      )}

      {meta.faiths.length > 0 && (
        <Card title="해금된 옛 신">
          <div className="chips">
            {meta.faiths.map((f) => (
              <span key={f} className="faith-tag">
                {f}
              </span>
            ))}
          </div>
        </Card>
      )}

      <footer className="title-foot">
        <p className="dim small center">기록은 이 기기에만 저장됩니다</p>
        <p className="dim small center">아동 사망·처형 등 무거운 장면이 나옵니다</p>
        <p className="dim small center">v{BUILD.version} · {BUILD.commit}</p>
      </footer>
    </Shell>
  );
}
