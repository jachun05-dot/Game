#!/usr/bin/env node
// claude.ai 아티팩트에 올릴 파일 준비: dist/ → <스테이징 폴더>
// 실행: npm run build && node scripts/release/stage-artifact.mjs <스테이징 폴더>
//
// - <폴더>/index.html: 아티팩트용 페이지 조각(제목·스타일·스크립트, 문서 뼈대는 아티팩트가 씌운다)
// - dist의 나머지 파일(assets/·그림·version.json)을 내용이 다를 때만 복사
// - dist에 없는 옛 파일은 지우고, 게시할 때 넘길 files 맵을 <폴더>/.publish.json에 적는다
//   (바뀐·새 파일 → 경로, 지운 파일 → null). 바뀐 게 없으면 맵이 비어 있다.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const out = process.argv[2];
if (!out) {
  console.error("사용법: node scripts/release/stage-artifact.mjs <스테이징 폴더>");
  process.exit(1);
}
const dist = "dist";
if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/index.html이 없습니다. 먼저 npm run build");
  process.exit(1);
}

function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, base) : [relative(base, p).split("\\").join("/")];
  });
}
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
/** 스테이징 폴더에서 게시 대상이 아닌 것 */
const internal = (f) => f === "index.html" || f.startsWith(".");

// 1) 페이지 조각
const html = readFileSync(join(dist, "index.html"), "utf8");
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? "<title>DDD</title>";
const tags = [
  ...pick(/<link[^>]+rel="stylesheet"[^>]*>/g),
  ...pick(/<link[^>]+rel="modulepreload"[^>]*>/g),
].map((t) => t.replace(/ crossorigin/g, "").replace(/href="\.\//, 'href="'));
const scripts = pick(/<script type="module"[^>]*><\/script>/g).map((t) => t.replace(/ crossorigin/g, "").replace(/src="\.\//, 'src="'));
const page = [
  title,
  '<meta name="theme-color" content="#100d0a">',
  "<style>html,body{background:#100d0a;color:#c9b892;color-scheme:dark}</style>",
  ...tags,
  '<div id="root"></div>',
  ...scripts,
  "",
].join("\n");
mkdirSync(out, { recursive: true });
const pagePath = join(out, "index.html");
const pageChanged = !existsSync(pagePath) || readFileSync(pagePath, "utf8") !== page;
writeFileSync(pagePath, page);

// 2) 파일 맞추기
/** 아티팩트에는 필요 없는 것: 웹 설치용 매니페스트(아티팩트 페이지는 참조하지 않는다) */
const webOnly = (f) => f === "manifest.webmanifest";
const want = walk(dist).filter((f) => f !== "index.html" && !webOnly(f));
const have = walk(out).filter((f) => !internal(f));
const files = {};
for (const f of want) {
  const src = join(dist, f);
  const dst = join(out, f);
  if (existsSync(dst) && sha(dst) === sha(src)) continue;
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  files[f] = f;
}
for (const f of have) {
  if (want.includes(f)) continue;
  rmSync(join(out, f));
  files[f] = null;
}
const version = JSON.parse(readFileSync(join(dist, "version.json"), "utf8"));
writeFileSync(join(out, ".publish.json"), JSON.stringify({ build: version.id, pageChanged, files }, null, 2) + "\n");
const changed = Object.entries(files);
console.log(`빌드 ${version.id} · 페이지 ${pageChanged ? "바뀜" : "그대로"} · 파일 ${changed.filter(([, v]) => v).length}개 올림 · ${changed.filter(([, v]) => v === null).length}개 지움`);
console.log(`게시할 files 맵: ${join(out, ".publish.json")}`);
