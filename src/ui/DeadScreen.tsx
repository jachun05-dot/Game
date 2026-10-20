import { useState } from "react";
import type { Ctl } from "./App";
import { LogView, Shell } from "./components";
import { TombCard, tombText } from "./TombCard";
import { Icon } from "./icons";
import { t } from "../i18n";

export function DeadScreen({ ctl, onNew, onGraveyard }: { ctl: Ctl; onNew: () => void; onGraveyard: () => void }) {
  const { s } = ctl;
  const [copied, setCopied] = useState(false);
  const tomb = s.tomb!;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tombText(tomb));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Shell>
      <LogView ctl={ctl} max={6} />
      {!tomb.ending && <p className="eyebrow center dead-title">REST IN PEACE</p>}
      <TombCard t={tomb} />
      <div className="stack">
        <button className="btn primary wide" onClick={onNew}>
          {tomb.ending === "true" ? t("새 삶 — 이제 모든 신을 고를 수 있다") : t("다시 태어나기")}
        </button>
        <div className="row-2">
          <button className="btn" onClick={copy}>
            <Icon name="scroll" />
            {copied ? t("복사했습니다") : t("묘비 문구 복사")}
          </button>
          <button className="btn" onClick={onGraveyard}>
            <Icon name="grave" />
            {t("묘지 보기")}
          </button>
        </div>
      </div>
    </Shell>
  );
}
