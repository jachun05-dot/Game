// 토스판 표현 점검(docs/APPS_IN_TOSS.md): 토스판으로 보이는 모든 글(사전 전체 + 봇 게임 로그)에서
// 나이·미성년·처형·잔혹 표현이 남았는지 언어별로 찾는다.
// 실행: bun scripts/toss-scan.ts [ko|en|ja|zh|all] [판수]
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { _setDict, t, type Lang } from "../src/i18n/core";
import { _setVariant } from "../src/platform/variant";
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH } from "../src/game/data";
import type { ClassId } from "../src/game/classes";

const ROOT = new URL("../", import.meta.url).pathname;
const which = process.argv[2] ?? "all";
const N = Number(process.argv[3] ?? 20);
const langs: Lang[] = which === "all" ? ["ko", "en", "ja", "zh"] : [which as Lang];

/** 토스판에 남으면 안 되는 표현(언어별). 메커니즘 이름(피로도·출혈 등)은 예외로 둔다 */
export const SENSITIVE: Record<Lang, RegExp> = {
  ko: /열여섯|열일곱|열여덟|1[678] ?세|1[678] ?살|\d+번째 생일|소년|소녀|아이들|어린|아동|미성년|꼬마|처형|(?<![법전])사형|참수|교수형|목을 베|머리를 잃|몸통을 꿰뚫|피를 너무|피투성|유혈|선혈|내장|시체|학살|고문|살해|화형/,
  en: /sixteen|seventeen|eighteen|\bage[ds]? \d|birthday|\bboys?\b|\bgirls?\b|\bchild|\bkids?\b|\bminors?\b|\bteens?\b|teenager|execut|behead|\bhanged\b|gallows|lost (a|his) head|run through the torso|gore|corpse|torture|slaughter|murder|burned at the stake/i,
  ja: /十六|十七|十八|1[678]歳|誕生日|少年|少女|子ども|子供|ガキ|未成年|処刑|斬首|絞首|首を刎|頭を失|胴を貫|血まみれ|死体|拷問|虐殺|殺害|火刑/,
  zh: /十六|十七|十八|1[678]岁|生日|少年|少女|孩子|小鬼|儿童|未成年|处刑|处决|斩首|绞刑|砍头|失去了头|贯穿躯干|血淋淋|尸体|酷刑|屠杀|谋杀|火刑/,
};

/** 웹판에서만 쓰는 키(토스판 코드는 isToss()로 다른 키를 쓴다) — 점검에서 뺀다 */
const WEB_ONLY = new Set(["— {age}번째 생일. 미궁이 문을 열어 주는 것도 이제 1년 남았다.", "{n}세"]);

function loadDir(dir: string): Record<string, string> {
  const d: Record<string, string> = {};
  if (!existsSync(dir)) return d;
  for (const f of readdirSync(dir)) if (f.endsWith(".json")) Object.assign(d, JSON.parse(readFileSync(dir + f, "utf8")));
  return d;
}

// 코드가 쓰는 모든 원문 키(i18n-check와 같은 방식)
function allKeys(): string[] {
  const keys = new Set<string>(Object.keys(JSON.parse(readFileSync(ROOT + "src/i18n/keys/game.json", "utf8"))));
  const walk = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = d + f.name;
      if (f.isDirectory()) { if (!p.endsWith("/i18n")) walk(p + "/"); continue; }
      if (!/\.tsx?$/.test(f.name) || f.name.endsWith(".test.ts")) continue;
      for (const m of readFileSync(p, "utf8").matchAll(/\b(?:t|tk)\(\s*"((?:[^"\\\n]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
    }
  };
  walk(ROOT + "src/");
  return [...keys];
}

_setVariant("toss");
const keys = allKeys();
const classes: ClassId[] = ["adventurer", "warrior", "mage", "rogue"];
const gods = [null, ...Object.values(FAITH)];
let total = 0;
for (const lang of langs) {
  const base = lang === "ko" ? {} : loadDir(`${ROOT}src/i18n/locales/${lang}/`);
  const over = loadDir(`${ROOT}src/i18n/variants/toss/${lang}/`);
  _setDict(lang, base, over);
  const rx = SENSITIVE[lang];
  const hits = new Map<string, string>();
  // 1) 사전 전체(화면 글·데이터 글)
  for (const k of keys) {
    if (WEB_ONLY.has(k)) continue;
    const v = t(k);
    if (rx.test(v)) hits.set(k, v);
  }
  // 2) 봇 게임 로그(조합된 문장)
  const logHits = new Set<string>();
  for (let i = 0; i < N; i++) {
    const s = newRun(i * 7919 + 11);
    s.faithsKnown = Object.values(FAITH);
    apply(s, { t: "pickClass", cls: classes[i % 4] });
    apply(s, { t: "create", name: "Bot", candidate: 0, faith: gods[i % gods.length] });
    for (let step = 0; step < 30000 && s.phase !== "dead"; step++) {
      const before = s.logCount;
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
      for (const l of s.log.slice(Math.max(0, s.log.length - (s.logCount - before)))) if (rx.test(l.text)) logHits.add(l.text.slice(0, 140));
    }
    if (s.tomb) for (const v of [s.tomb.cause, s.tomb.epitaph]) if (rx.test(v)) logHits.add(v.slice(0, 140));
  }
  console.log(`== ${lang}: 사전 ${hits.size}개 · 로그 ${logHits.size}개`);
  for (const [k, v] of hits) console.log(`  [사전] ${k.slice(0, 70)}  →  ${v.slice(0, 110)}`);
  for (const l of [...logHits].slice(0, 30)) console.log(`  [로그] ${l}`);
  total += hits.size + logHits.size;
}
process.exit(total ? 1 : 0);
