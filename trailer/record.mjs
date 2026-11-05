// 트레일러 녹화(docs/TRAILER.md): trailer.html의 render(t)를 프레임마다 불러 JPEG로 저장한다. 그다음 ffmpeg로 묶는다.
// 실행(저장소 최상위를 정적 서버로 띄운 뒤): node trailer/record.mjs <프레임 폴더> [주소]
// playwright가 필요하다(이 환경에서는 /opt/node-tools에서 실행).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [, , out, url = "http://localhost:4180/trailer/trailer.html?record"] = process.argv;
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
page.on("pageerror", (e) => console.error("pageerror", e));
await page.goto(url);
await page.evaluate(() => window.TRAILER.ready);
const { FPS, DURATION } = await page.evaluate(() => ({ FPS: window.TRAILER.FPS, DURATION: window.TRAILER.DURATION }));
const total = Math.round(FPS * DURATION);
for (let f = 0; f < total; f++) {
  const data = await page.evaluate((t) => {
    window.TRAILER.render(t);
    return document.getElementById("c").toDataURL("image/jpeg", 0.93);
  }, f / FPS);
  writeFileSync(`${out}/f${String(f).padStart(5, "0")}.jpg`, Buffer.from(data.split(",")[1], "base64"));
  if (f % 150 === 0) console.log(`frame ${f}/${total}`);
}
await b.close();
console.log("done", total);
