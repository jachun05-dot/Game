// 주요 화면 스크린샷(모바일 390×844). 먼저 `npx vite build && npx vite preview --port 4173`, `bun tools/make-states.ts`
// 실행: NODE_PATH=$(npm root -g) node tools/screenshots.cjs [states 폴더=shots/states] [출력=shots]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const states = process.argv[2] ?? "shots/states";
const out = process.argv[3] ?? "shots";
const URL = "http://localhost:4173/";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const snap = (name) => p.screenshot({ path: path.join(out, `${name}.png`) });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await snap("01-title");
  await p.locator("button", { hasText: "새로운 인생" }).click();
  await snap("02-intro");
  await p.locator("button", { hasText: "건너뛰기" }).click();
  await p.locator(".cand").first().click();
  await snap("03-create");
  for (const f of fs.readdirSync(states).filter((x) => x.endsWith(".json")).sort()) {
    const name = f.replace(".json", "");
    await p.evaluate((st) => { localStorage.clear(); localStorage.setItem("ddd-run-v1", st); }, fs.readFileSync(path.join(states, f), "utf8"));
    await p.reload();
    await p.locator("button", { hasText: "이어" }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.locator(".log").first().click().catch(() => {}); // 로그 연출 건너뛰기
    await p.waitForTimeout(200);
    await snap(`10-${name}`);
    if (name === "town") {
      await p.locator(".hero-head").click();
      await snap("11-character-sheet");
      await p.locator("button", { hasText: "몬스터 도감 보기" }).click();
      await snap("12-codex");
    }
  }
  await b.close();
  console.log("saved to", out);
})();
