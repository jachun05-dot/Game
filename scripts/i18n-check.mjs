#!/usr/bin/env node
// 번역 점검(docs/I18N.md): node scripts/i18n-check.mjs [--strict 폴더...]
// - 코드의 t("…")/tk("…") 원문이 en·ja·zh 사전에 다 있는지, 끼워 넣기 {이름}이 같은지
// - 아직 t()로 감싸지 않은 한국어가 파일마다 몇 개인지(--strict로 준 폴더에 남아 있으면 실패)
// 한국어를 일부러 두는 줄은 끝에 // i18n-ok
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const LOC = join(SRC, "i18n", "locales");
const LANGS = ["en", "ja", "zh"];
const strict = process.argv.includes("--strict") ? process.argv.slice(process.argv.indexOf("--strict") + 1) : [];
const HANGUL = /[가-힣]/;

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (p !== join(SRC, "i18n")) walk(p, out);
    } else if (/\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

const CALL = /\b(?:t|tk)\(\s*"((?:[^"\\\n]|\\.)*)"/g;
const keys = new Map(); // key -> first file
const unwrapped = [];
for (const f of walk(SRC)) {
  const rel = relative(ROOT, f);
  const raw = readFileSync(f, "utf8");
  for (const m of raw.matchAll(CALL)) {
    const k = JSON.parse(`"${m[1]}"`);
    if (!keys.has(k)) keys.set(k, rel);
  }
  // 감싸지 않은 한국어: 주석·t("…")를 지우고 남은 한글 덩어리
  let n = 0;
  const lines = raw.split("\n");
  let inBlock = false;
  lines.forEach((line, i) => {
    if (line.includes("i18n-ok")) return;
    let l = line;
    if (inBlock) {
      const e = l.indexOf("*/");
      if (e < 0) return;
      l = l.slice(e + 2);
      inBlock = false;
    }
    l = l.replace(/\/\*.*?\*\//g, "");
    const b = l.indexOf("/*");
    if (b >= 0) {
      inBlock = true;
      l = l.slice(0, b);
    }
    l = l.replace(/(^|[^:"'`])\/\/.*$/, "$1").replace(/\{\s*\/\*.*?\*\/\s*\}/g, "");
    l = l.replace(CALL, "");
    if (HANGUL.test(l)) {
      n++;
      if (strict.some((s) => rel.startsWith(s)) && unwrapped.length < 400) unwrapped.push(`${rel}:${i + 1}: ${line.trim().slice(0, 110)}`);
    }
  });
  if (n) unwrapped.push({ rel, n });
}

const slots = (s) => [...s.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]).sort().join(",");

let bad = 0;
const report = [];
for (const lang of LANGS) {
  const dict = new Map();
  let files = [];
  try {
    files = readdirSync(join(LOC, lang)).filter((f) => f.endsWith(".json"));
  } catch {}
  for (const f of files) {
    let d;
    try {
      d = JSON.parse(readFileSync(join(LOC, lang, f), "utf8"));
    } catch (e) {
      report.push(`✗ ${lang}/${f}: JSON 오류 ${e.message}`);
      bad++;
      continue;
    }
    for (const [k, v] of Object.entries(d)) {
      if (dict.has(k) && dict.get(k).v !== v) report.push(`· ${lang}: 같은 원문이 다르게 번역됨 (${dict.get(k).f} / ${f}): ${k.slice(0, 50)}`);
      dict.set(k, { v, f });
      if (typeof v !== "string" || !v.trim()) {
        report.push(`✗ ${lang}/${f}: 빈 번역: ${k.slice(0, 60)}`);
        bad++;
      } else if (slots(k) !== slots(v)) {
        report.push(`✗ ${lang}/${f}: 끼워 넣기가 다름 {${slots(k)}} → {${slots(v)}}: ${k.slice(0, 60)}`);
        bad++;
      }
    }
  }
  const missing = [...keys.keys()].filter((k) => !dict.has(k));
  const unused = [...dict.keys()].filter((k) => !keys.has(k));
  for (const k of missing.slice(0, 30)) report.push(`✗ ${lang}: 번역 없음 (${keys.get(k)}): ${k.slice(0, 70)}`);
  if (missing.length > 30) report.push(`✗ ${lang}: … 그 밖에 ${missing.length - 30}개`);
  bad += missing.length;
  report.push(`${lang}: 원문 ${keys.size}개 중 번역 ${keys.size - missing.length}개, 안 쓰는 번역 ${unused.length}개`);
}

const counts = unwrapped.filter((u) => typeof u === "object");
const lines = unwrapped.filter((u) => typeof u === "string");
console.log(report.join("\n"));
console.log(`\n아직 감싸지 않은 한국어 줄: ${counts.reduce((a, c) => a + c.n, 0)}`);
for (const c of counts.sort((a, b) => b.n - a.n)) console.log(`  ${String(c.n).padStart(4)}  ${c.rel}`);
if (lines.length) {
  console.log(`\n--strict ${strict.join(" ")} 에 남은 한국어:`);
  console.log(lines.join("\n"));
  bad += lines.length;
}
process.exit(bad ? 1 : 0);
