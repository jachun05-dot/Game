import { useRef, useState } from "react";
import type { GameState, Meta } from "../game/types";
import { exportSave, importSave } from "./storage";
import { Card, Shell } from "./components";

interface Props {
  run: GameState | null;
  meta: Meta;
  onNew: () => void;
  onContinue: () => void;
  onGraveyard: () => void;
  onImport: (run: GameState | null, meta: Meta) => void;
}

export function TitleScreen({ run, meta, onNew, onContinue, onGraveyard, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const canContinue = run && run.phase !== "dead" && run.phase !== "create";

  const doExport = () => {
    const blob = new Blob([exportSave(run, meta)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ddd-save.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (f: File) => {
    const data = importSave(await f.text());
    if (!data) {
      setMsg("저장 파일을 읽지 못했습니다.");
      return;
    }
    onImport(data.run, data.meta);
    setMsg("불러왔습니다.");
  };

  return (
    <Shell>
      <div className="title-wrap">
        <img className="title-hero" src="./hero.png" alt="숏소드를 든 열여섯 살 모험가 소년" />
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
      </div>

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

      <Card title="저장">
        <p className="dim small">기록은 이 브라우저에만 저장됩니다. 다른 기기로 옮기려면 파일로 내보내세요.</p>
        <div className="row">
          <button className="btn small" onClick={doExport}>
            내보내기
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            가져오기
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
        {msg && <p className="small">{msg}</p>}
      </Card>
      <p className="dim small center">프로토타입 v0.1 · 1섹터(3층)까지 · 아동 사망·처형 등 무거운 장면이 나옵니다</p>
    </Shell>
  );
}
