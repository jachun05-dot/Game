import type { Tomb } from "../game/types";

export function TombCard({ t }: { t: Tomb }) {
  return (
    <article className="tomb">
      <div className="tomb-cross">✝</div>
      <h3 className="tomb-name">{t.name}</h3>
      <p className="dim small">
        {t.className ?? "모험가"} Lv.{t.level} · {t.months}개월 · {t.reached}
      </p>
      <p className="tomb-cause">{t.cause}</p>
      <p className="tomb-epitaph">{t.epitaph}</p>
      {t.faith && <p className="small">섬긴 신: {t.faith}</p>}
      {t.notes && (t.notes.facts.length > 0 || t.notes.hints.length > 0) && (
        <div className="tomb-notes">
          <p className="tomb-notes-title">무엇이 죽음을 불렀나</p>
          {t.notes.facts.map((f) => (
            <p key={f} className="small">
              · {f}
            </p>
          ))}
          {t.notes.hints.map((h) => (
            <p key={h} className="small accent">
              → {h}
            </p>
          ))}
        </div>
      )}
      {t.faithsUnlocked.length > 0 && (
        <div className="chips center">
          {t.faithsUnlocked.map((f) => (
            <span key={f} className="faith-tag">
              {f} 해금
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function tombText(t: Tomb): string {
  return [
    `✝ ${t.name} (Lv.${t.level}, ${t.months}개월, ${t.reached})`,
    t.cause,
    t.epitaph,
    t.faithsUnlocked.length ? `해금: ${t.faithsUnlocked.join(", ")}` : "",
    "— DDD: 열여섯 살, 미궁으로",
  ]
    .filter(Boolean)
    .join("\n");
}
