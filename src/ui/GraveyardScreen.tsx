import type { Meta } from "../game/types";
import { SceneBanner, Shell } from "./components";
import { TombCard } from "./TombCard";
import { Icon } from "./icons";
import { t } from "../i18n";

export function GraveyardScreen({ meta, onBack }: { meta: Meta; onBack: () => void }) {
  return (
    <Shell>
      <div className="topbar">
        <button className="link" onClick={onBack} aria-label={t("돌아가기")}>
          <Icon name="back" />
        </button>
        <span className="topbar-title">{t("영지 묘지")}</span>
        <span className="link-spacer" />
      </div>
      <SceneBanner id="graveyard" />
      <p className="dim small">{t("묘지기가 말한다. \"묘비는 많은데, 이름을 기억하는 사람은 적지.\"")}</p>
      {meta.graveyard.length === 0 && <p className="center dim">{t("아직 아무도 잠들지 않았다.")}</p>}
      <div className="stack">
        {meta.graveyard.map((tb) => (
          <TombCard key={tb.id} t={tb} />
        ))}
      </div>
    </Shell>
  );
}
