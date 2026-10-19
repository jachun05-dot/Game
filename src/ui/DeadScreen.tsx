import { useState } from "react";
import type { Ctl } from "./App";
import { LogView, Shell } from "./components";
import { TombCard, tombText } from "./TombCard";
import { Icon } from "./icons";

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
      {!t.ending && <p className="eyebrow center dead-title">REST IN PEACE</p>}
      <TombCard t={t} />
      <div className="stack">
        <button className="btn primary wide" onClick={onNew}>
          {t.ending === "true" ? "새 삶 — 이제 모든 신을 고를 수 있다" : "다시 태어나기"}
        </button>
        <div className="row-2">
          <button className="btn" onClick={copy}>
            <Icon name="scroll" />
            {copied ? "복사했습니다" : "묘비 문구 복사"}
          </button>
          <button className="btn" onClick={onGraveyard}>
            <Icon name="grave" />
            묘지 보기
          </button>
        </div>
      </div>
    </Shell>
  );
}
