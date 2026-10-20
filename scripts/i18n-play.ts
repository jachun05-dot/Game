// 번역된 언어로 봇 게임을 돌려 로그에 남은 한국어·안 채운 {자리}·undefined를 찾는다(다국어 3단계 점검)
// 실행: bun scripts/i18n-play.ts <en|ja|zh> [판수]
import { readdirSync, readFileSync } from "node:fs";
import { _setDict, type Lang } from "../src/i18n/core";
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH } from "../src/game/data";
import type { ClassId } from "../src/game/classes";

const lang = (process.argv[2] ?? "en") as Lang;
const N = Number(process.argv[3] ?? 40);
const dir = new URL(`../src/i18n/locales/${lang}/`, import.meta.url).pathname;
const dict: Record<string, string> = {};
for (const f of readdirSync(dir)) Object.assign(dict, JSON.parse(readFileSync(dir + f, "utf8")));
_setDict(lang, dict);

const bad = new Map<string, number>();
const note = (kind: string, line: string) => {
  const k = `${kind}: ${line.slice(0, 120)}`;
  bad.set(k, (bad.get(k) ?? 0) + 1);
};
const classes: ClassId[] = ["adventurer", "warrior", "mage", "rogue"];
const gods = [null, ...Object.values(FAITH)];
let lines = 0;
for (let i = 0; i < N; i++) {
  const s = newRun(i * 7919 + 3);
  s.faithsKnown = Object.values(FAITH);
  apply(s, { t: "pickClass", cls: classes[i % 4] });
  apply(s, { t: "create", name: "Bot", candidate: 0, faith: gods[i % gods.length] });
  for (let step = 0; step < 30000 && s.phase !== "dead"; step++) {
    const before = s.logCount;
    const a = botAction(s);
    if (!a) break;
    apply(s, a);
    const fresh = [...s.log.slice(Math.max(0, s.log.length - (s.logCount - before))).map((l) => l.text), ...(s.weekResult?.lines ?? []), ...(s.weekResult ? [s.weekResult.title] : []), ...(s.settlement?.lines ?? [])];
    for (const l of fresh) {
      lines++;
      if (/[가-힣]/.test(l)) note("한국어", l);
      if (/\{\w+(\|.)?\}|undefined|NaN|\[object/.test(l)) note("자리", l);
    }
  }
  if (s.tomb) for (const v of [s.tomb.cause, s.tomb.epitaph, s.tomb.reached]) if (/[가-힣]/.test(String(v))) note("묘비", String(v));
}
console.log(`${lang}: ${N}판, 로그 ${lines}줄, 문제 ${bad.size}종`);
for (const [k, n] of [...bad].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${String(n).padStart(5)}× ${k}`);
