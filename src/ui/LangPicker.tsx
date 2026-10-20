import { LANGS, setLang, useLang } from "../i18n";

/** 언어 고르기(타이틀·설정). 언어 이름은 각 언어로 쓴다 */
export function LangPicker() {
  const lang = useLang();
  return (
    <div className="tactics lang-picker" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.id} className={`chip${lang === l.id ? " on" : ""}`} lang={l.id === "zh" ? "zh-Hans" : l.id} onClick={() => void setLang(l.id)}>
          {l.name}
        </button>
      ))}
    </div>
  );
}
