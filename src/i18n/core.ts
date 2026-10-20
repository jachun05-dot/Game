import { josa } from "../game/josa";
import { kv } from "../platform/kv";

// 다국어 핵심(React 없음 — src/game도 쓴다). 화면 훅은 index.ts.
// 다국어(2026-10-20, 사용자 요청: 영어·일본어·간체 중국어).
// 한국어 원문 자체가 키다: t("묘지") → 영어면 "Graveyard". 번역이 없으면 한국어 원문이 그대로 나온다.
// - 번역은 src/i18n/locales/<언어>/<영역>.json ({"한국어 원문": "번역"}), 고른 언어만 내려받는다
// - 끼워 넣기: t("{n}명", { n: 3 }). 한국어 조사는 {name|을}처럼 쓴다(한국어일 때만 붙는다, 번역문에서는 {name})
// - 모듈 최상단 배열처럼 화면 밖에서 정해 두는 글은 tk("…")로 표시만 하고, 그릴 때 t(값)으로 바꾼다
// - 빠진 번역은 npm run i18n:check 로 찾는다(docs/I18N.md)

export type Lang = "ko" | "en" | "ja" | "zh";

export const LANGS: { id: Lang; name: string }[] = [
  { id: "ko", name: "한국어" },
  { id: "en", name: "English" },
  { id: "ja", name: "日本語" },
  { id: "zh", name: "简体中文" },
];

const KEY = "ddd-lang";

let lang: Lang = "ko";
let dict: Record<string, string> = {};
const listeners = new Set<() => void>();

// vite가 빌드 때 바꿔 넣는다. bun으로 도는 시뮬레이션에는 없으므로(한국어만 쓴다) 감싼다
let loaders: Record<string, () => Promise<Record<string, string>>> = {};
try {
  loaders = import.meta.glob<Record<string, string>>("./locales/*/*.json", { import: "default" });
} catch {
  /* bun 등 vite 밖 */
}

function isLang(v: unknown): v is Lang {
  return v === "ko" || v === "en" || v === "ja" || v === "zh";
}

/** 저장된 언어 → 없으면 기기 언어(한·일·중이 아니면 영어) */
export function detectLang(): Lang {
  const saved = kv().get(KEY);
  if (isLang(saved)) return saved;
  const nav = typeof navigator !== "undefined" ? (navigator.languages?.[0] ?? navigator.language ?? "") : "";
  const l = nav.toLowerCase();
  if (l.startsWith("ko")) return "ko";
  if (l.startsWith("ja")) return "ja";
  if (l.startsWith("zh")) return "zh";
  return l ? "en" : "ko";
}

async function load(l: Lang): Promise<Record<string, string>> {
  if (l === "ko") return {};
  const parts = await Promise.all(
    Object.entries(loaders)
      .filter(([p]) => p.startsWith(`./locales/${l}/`))
      .map(([, f]) => f()),
  );
  return Object.assign({}, ...parts);
}

const FONTS: Partial<Record<Lang, string>> = {
  ja: "family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;700",
  zh: "family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;700",
};

/** 화면에 언어를 알린다: <html lang>(글꼴 CSS가 따른다)과 일·중 글꼴 */
function applyDocument(l: Lang): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = l === "zh" ? "zh-Hans" : l;
  document.title = `DDD — ${t("열여섯 살, 미궁으로")}`;
  const f = FONTS[l];
  if (f && !document.getElementById(`font-${l}`)) {
    const link = document.createElement("link");
    link.id = `font-${l}`;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${f}&display=swap`;
    document.head.appendChild(link);
  }
}

/** 언어 바꾸기(번역을 내려받은 뒤 화면을 다시 그린다). 실패하면 한국어로 */
export async function setLang(l: Lang): Promise<void> {
  try {
    dict = await load(l);
    lang = l;
  } catch {
    dict = {};
    lang = "ko";
  }
  kv().set(KEY, lang);
  applyDocument(lang);
  listeners.forEach((f) => f());
}

/** 시작할 때 한 번: 저장된(또는 기기) 언어를 불러온다 */
export async function initLang(): Promise<void> {
  const l = detectLang();
  try {
    dict = await load(l);
    lang = l;
  } catch {
    dict = {};
    lang = "ko";
  }
  applyDocument(lang);
}

export function getLang(): Lang {
  return lang;
}

/** 언어가 바뀌면 알림(React 훅은 index.ts의 useLang) */
export function subscribeLang(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

type Vars = Record<string, string | number>;

const SLOT = /\{(\w+)(?:\|([이가을를은는과와]))?\}/g;

function fill(text: string, vars: Vars | undefined, korean: boolean): string {
  if (!vars) return text;
  return text.replace(SLOT, (m, k: string, p?: string) => {
    if (!(k in vars)) return m;
    const v = String(vars[k]);
    return p && korean ? josa(v, p as "을") : v;
  });
}

/** 번역. src는 한국어 원문(정적 문자열이어야 i18n:check가 찾는다) */
export function t(src: string, vars?: Vars): string {
  const tr = lang === "ko" ? undefined : dict[src];
  return tr === undefined ? fill(src, vars, true) : fill(tr, vars, false);
}

/** 번역할 글이라고 표시만 한다(화면에 그릴 때 t(값)으로 바꾼다) */
export function tk<T extends string>(src: T): T {
  return src;
}

/** 테스트용: 사전을 직접 넣는다 */
export function _setDict(l: Lang, d: Record<string, string>): void {
  lang = l;
  dict = d;
}
