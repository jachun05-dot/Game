import { useState } from "react";
import { MONSTERS, BAL } from "../game/data";
import { alive } from "../game/combat";
import type { Ctl } from "./App";
import { Bar, Card } from "./components";

export function CombatPanel({ ctl }: { ctl: Ctl }) {
  const { s, dispatch, busy } = ctl;
  const c = s.combat!;
  const foes = alive(c);
  const [target, setTarget] = useState<number | null>(null);
  const tgt = foes.find((e) => e.uid === target) ?? foes[0];
  const fleeDc = BAL.fleeDcBase + foes.length * 2;

  return (
    <Card title={`전투 — ${c.round}라운드${c.actionsLeft > 1 ? ` · 남은 행동 ${c.actionsLeft}` : ""}`} className="combat">
      <div className="foes">
        {c.enemies.map((e) => {
          const def = MONSTERS[e.defId];
          const dead = e.hp <= 0;
          return (
            <button key={e.uid} className={`foe${dead ? " dead" : ""}${tgt?.uid === e.uid ? " target" : ""}`} disabled={dead} onClick={() => setTarget(e.uid)}>
              <span>{def.name}</span>
              <Bar value={Math.max(0, e.hp)} max={def.hp} tone="enemy" />
              <span className="dim small">{dead ? "쓰러짐" : `AC ${def.ac}`}</span>
            </button>
          );
        })}
      </div>
      {!busy && (
        <div className="choices">
          <button className="btn primary" onClick={() => tgt && dispatch({ t: "attack", target: tgt.uid })}>
            공격 — {tgt ? MONSTERS[tgt.defId].name : ""}
          </button>
          <div className="row">
            <button className="btn" disabled={s.inventory.potion <= 0} onClick={() => dispatch({ t: "combatPotion" })}>
              물약 ({s.inventory.potion})
            </button>
            <button className="btn" onClick={() => dispatch({ t: "flee" })}>
              도주 (DC {fleeDc})
            </button>
          </div>
          {foes.length >= 2 && <p className="dim small">둘러싸인 채 쓰러지면 '전쟁의 신'이 당신을 기억합니다.</p>}
        </div>
      )}
    </Card>
  );
}
