// 게임 데이터에서 번역할 원문을 뽑는다(다국어 2단계, docs/I18N.md).
// src/game 모듈이 내보내는 표(함수 제외)를 훑어 한글이 든 문자열을 모두 모은다 → src/i18n/keys/game.json {원문: "파일:표"}
// 데이터 글을 고치거나 더하면: bun scripts/i18n-keys.ts && npm run i18n:check
import { readdirSync, writeFileSync } from "node:fs";

const dir = new URL("../src/game/", import.meta.url).pathname;
const HANGUL = /[가-힣]/;
/** 화면에 나오지 않는 표(내부 조회용 등) */
const SKIP = new Set<string>([]);

const keys: Record<string, string> = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).sort()) {
  const m = await import(dir + f);
  for (const [name, v] of Object.entries(m)) {
    const origin = `${f.replace(".ts", "")}:${name}`;
    if (typeof v === "function" || SKIP.has(origin)) continue;
    const seen = new Set<unknown>();
    const walk = (x: unknown) => {
      if (typeof x === "string") {
        if (HANGUL.test(x) && !(x in keys)) keys[x] = origin;
        return;
      }
      if (!x || typeof x !== "object" || seen.has(x)) return;
      seen.add(x);
      for (const y of Object.values(x)) walk(y);
    };
    walk(v);
  }
}
const sorted = Object.fromEntries(Object.entries(keys).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])));
writeFileSync(new URL("../src/i18n/keys/game.json", import.meta.url), JSON.stringify(sorted, null, 1) + "\n");
console.log(`게임 데이터 원문 ${Object.keys(sorted).length}개 → src/i18n/keys/game.json`);
