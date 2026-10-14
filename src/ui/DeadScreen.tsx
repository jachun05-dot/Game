import { useState } from "react";
import type { Ctl } from "./App";
import { LogView, Shell } from "./components";
import { TombCard, tombText } from "./TombCard";

export function DeadScreen({ ctl, onNew, onGraveyard }: { ctl: Ctl; onNew: () => void; onGraveyard: () => void }) {
  const { s } = ctl;
  const [copied, setCopied] = useState(false);
  const t = s.tomb!;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tombText(t));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Shell>
      <LogView ctl={ctl} max={6} />
      {!t.ending && <p className="eyebrow center">REST IN PEACE</p>}
      <TombCard t={t} />
      <div className="stack">
        <button className="btn" onClick={copy}>
          {copied ? "복사했습니다" : "묘비 문구 복사"}
        </button>
        <button className="btn" onClick={onGraveyard}>
          묘지 보기
        </button>
        <button className="btn primary" onClick={onNew}>
          {t.ending === "true" ? "새 삶 — 이제 모든 신을 고를 수 있다 →" : "다시 태어나기 →"}
        </button>
      </div>
    </Shell>
  );
}
