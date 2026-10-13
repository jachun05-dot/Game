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
  onCodex: () => void;
  onImport: (run: GameState | null, meta: Meta) => void;
}

export function TitleScreen({ run, meta, onNew, onContinue, onGraveyard, onCodex, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const canContinue = run && run.phase !== "dead" && run.phase !== "create";

  const [paste, setPaste] = useState("");

  // 일부 환경(앱 안 미리보기 등)은 파일 다운로드를 막으므로 클립보드 복사로 내보낸다
  const doExport = async () => {
    const text = exportSave(run, meta);
    try {
      await navigator.clipboard.writeText(text);
      setMsg("저장 데이터를 복사했습니다. 메모 앱 등에 붙여넣어 보관하세요.");
    } catch {
      setPaste(text);
      setMsg("자동 복사가 막혀 있습니다. 아래 칸의 글을 직접 복사하세요.");
    }
  };

  const load = (text: string) => {
    const data = importSave(text);
    if (!data) {
      setMsg("저장 데이터를 읽지 못했습니다. 복사한 글 전체를 그대로 붙여넣었는지 확인하세요.");
      return;
    }
    onImport(data.run, data.meta);
    setPaste("");
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
        <button className="btn" onClick={onCodex}>
          몬스터 도감 <span className="dim">— 발견 {meta.codex.seen.length}종</span>
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
        <p className="dim small">기록은 이 브라우저에만 저장됩니다. 다른 기기로 옮기려면 저장 데이터를 복사해 두었다가 붙여넣으세요.</p>
        <div className="row">
          <button className="btn small" onClick={doExport}>
            저장 데이터 복사
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            파일에서 가져오기
          </button>
          <input ref={fileRef} id="import-file" type="file" accept="application/json,.json,.txt" hidden onChange={async (e) => e.target.files?.[0] && load(await e.target.files[0].text())} />
        </div>
        <textarea id="import-text" className="input paste" rows={3} placeholder="복사해 둔 저장 데이터를 여기에 붙여넣기" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <button className="btn small" disabled={!paste.trim()} onClick={() => load(paste)}>
          붙여넣은 데이터 불러오기
        </button>
        {msg && <p className="small">{msg}</p>}
      </Card>
      <p className="dim small center">프로토타입 v0.1 · 1섹터(3층)까지 · 아동 사망·처형 등 무거운 장면이 나옵니다</p>
    </Shell>
  );
}
