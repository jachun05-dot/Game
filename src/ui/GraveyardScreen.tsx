import type { Meta } from "../game/types";
import { SceneBanner, Shell } from "./components";
import { TombCard } from "./TombCard";

export function GraveyardScreen({ meta, onBack }: { meta: Meta; onBack: () => void }) {
  return (
    <Shell>
      <div className="topbar">
        <button className="link" onClick={onBack}>
          ← 돌아가기
        </button>
        <span className="topbar-title">영지 묘지</span>
        <span />
      </div>
      <SceneBanner id="graveyard" />
      <p className="dim small">묘지기가 말한다. "묘비는 많은데, 이름을 기억하는 사람은 적지."</p>
      {meta.graveyard.length === 0 && <p className="center dim">아직 아무도 잠들지 않았다.</p>}
      <div className="stack">
        {meta.graveyard.map((t) => (
          <TombCard key={t.id} t={t} />
        ))}
      </div>
    </Shell>
  );
}
