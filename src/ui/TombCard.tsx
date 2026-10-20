import type { Tomb } from "../game/types";
import { t, tk } from "../i18n";

export function TombCard({ t: tb }: { t: Tomb }) {
  return (
    <article className={`tomb${tb.ending ? ` tomb-ending end-${tb.ending}` : ""}`}>
      <div className="tomb-cross">{tb.ending === "true" ? "✦" : tb.ending === "offering" ? "⚓" : tb.ending === "escape" ? "☾" : "✝"}</div>
      {tb.ending && <p className="eyebrow center">{t(ENDING_TITLE[tb.ending])}</p>}
      <h3 className="tomb-name">{t(tb.name)}</h3>
      <p className="dim small">
        {tb.className ? t(tb.className) : t("모험가")} Lv.{tb.level} · {t("{n}개월", { n: tb.months })} · {tb.reached}
      </p>
      <p className="tomb-cause">{tb.cause}</p>
      <p className="tomb-epitaph">{tb.epitaph}</p>
      {tb.faith && <p className="small">{t("섬긴 신: {faith}", { faith: t(tb.faith) })}</p>}
      {tb.epilogue && (
        <div className="tomb-epilogue">
          {tb.epilogue.map((l, i) => (
            <p key={i} className="small">
              {l}
            </p>
          ))}
        </div>
      )}
      {tb.notes && !tb.ending && (tb.notes.facts.length > 0 || tb.notes.hints.length > 0) && (
        <div className="tomb-notes">
          <p className="tomb-notes-title">{t("무엇이 죽음을 불렀나")}</p>
          {tb.notes.facts.map((f) => (
            <p key={f} className="small">
              · {f}
            </p>
          ))}
          {tb.notes.hints.map((h) => (
            <p key={h} className="small accent">
              → {h}
            </p>
          ))}
        </div>
      )}
      {tb.faithsUnlocked.length > 0 && (
        <div className="chips center">
          {tb.faithsUnlocked.map((f) => (
            <span key={f} className="faith-tag">
              {t("{faith} 해금", { faith: t(f) })}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export const ENDING_TITLE: Record<NonNullable<Tomb["ending"]>, string> = {
  offering: tk("ENDING — 헌납"),
  true: tk("TRUE ENDING — 돌아온 신들"),
  fallen: tk("ENDING — 영주에게 맞선 자"),
  escape: tk("HIDDEN ENDING — 섬을 떠난 자"),
};

export function tombText(tb: Tomb): string {
  return [
    `${tb.ending ? t(ENDING_TITLE[tb.ending]) + " · " : "✝ "}${t(tb.name)} (Lv.${tb.level}, ${t("{n}개월", { n: tb.months })}, ${tb.reached})`,
    tb.cause,
    tb.epitaph,
    tb.faithsUnlocked.length ? t("해금: {list}", { list: tb.faithsUnlocked.map((f) => t(f)).join(", ") }
) : "",
    "— DDD: " + t("열여섯 살, 미궁으로"),
  ]
    .filter(Boolean)
    .join("\n");
}
