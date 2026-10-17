import type { GameState, Meta } from "../game/types";
import { Card, SceneBanner, Shell } from "./components";
import { BUILD } from "../platform/build";

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
      <div className="title-wrap">
        <SceneBanner id="title" className="title-art">
          <img className="title-hero" src="./hero.png" width={74} height={180} alt="숏소드를 든 열여섯 살 모험가 소년" />
        </SceneBanner>
        <h1 className="logo">
          <span className="accent">D</span>DD
        </h1>
        <p className="tagline">열여섯 살, 미궁으로</p>
        <p className="dim small center">섬의 영지 · 미궁 · 매달의 세금 · 단 한 번의 삶</p>
      </div>

      <div className="stack">
        {canContinue && (
          <button className="btn primary" onClick={onContinue}>
            이어하기 <span className="dim">— {run!.hero.name}, {run!.month}월 {run!.week}주차</span>
          </button>
        )}
        <button className={`btn ${canContinue ? "" : "primary"}`} onClick={onNew}>
          새로운 인생 시작 →
        </button>
        <button className="btn" onClick={onGraveyard}>
          묘지 <span className="dim">— 잠든 모험가 {meta.graveyard.length}명</span>
        </button>
        <button className="btn" onClick={onCodex}>
          몬스터 도감 <span className="dim">— 발견 {meta.codex.seen.length}종</span>
        </button>
      </div>

      {((meta.clues?.length ?? 0) > 0 || (meta.endings?.length ?? 0) > 0) && (
        <Card title={meta.endings?.includes("true") ? "옛 신들이 돌아왔다" : "진실 조각"}>
          <p className="small">
            진실 {meta.clues?.length ?? 0}/7
            {meta.endings?.includes("offering") && " · 헌납 엔딩"}
            {meta.endings?.includes("fallen") && " · 영주에게 맞선 자"}
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

      <p className="dim small center">기록은 이 브라우저에만 저장됩니다(다른 기기로 옮길 수 없고, 브라우저 데이터를 지우면 사라집니다).</p>
      <p className="dim small center">프로토타입 v{BUILD.version} · 6섹터 · 엔딩 + 끝없는 미궁 · 아동 사망·처형 등 무거운 장면이 나옵니다</p>
      <p className="dim small center">빌드 {BUILD.commit}</p>
    </Shell>
  );
}
