// 6섹터 밸런스: 5섹터를 처음 클리어한 뒤 6개월 안에 엔딩(헌납·진엔딩)에 닿는 비율(목표 ~30%), 6섹터 사망 25% 이하
// 5섹터 첫 클리어까지는 오래 걸려서 그 순간의 상태를 한 번 저장해 두고(snap), 그 뒤 6개월만 다시 돌린다(run).
// 실행: bun scripts/sim-sector6.ts snap <판수> <시작 시드> <직업> <저장 파일>
//       bun scripts/sim-sector6.ts run <저장 파일…>
import { readFileSync, writeFileSync } from "node:fs";
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import type { ClassId } from "../src/game/classes";
import type { GameState } from "../src/game/types";

const mode = process.argv[2];
if (mode === "snap") {
  const N = Number(process.argv[3] ?? 1000);
  const START = Number(process.argv[4] ?? 1);
  const cls = (process.argv[5] ?? "warrior") as ClassId;
  const out = process.argv[6] ?? `snap-${cls}.json`;
  const snaps: { m5: number; s: GameState }[] = [];
  for (let seed = START; seed < START + N; seed++) {
    const s = newRun(seed * 7919);
    apply(s, { t: "pickClass", cls });
    for (let i = 0; i < 2000000 && s.phase !== "dead" && s.month <= 72; i++) {
      // 5섹터 첫 클리어: 정산 화면에서(마을로 돌아오기 직전) 저장
      if (s.rank >= 5 && s.phase === "settlement") {
        s.log = [];
        snaps.push({ m5: s.month, s: structuredClone(s) });
        break;
      }
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
    }
    if ((seed - START) % 100 === 99) console.error(`${cls} ${seed - START + 1}/${N} 저장 ${snaps.length}`);
  }
  writeFileSync(out, JSON.stringify({ cls, n: N, snaps }));
  console.log(`${cls}: ${N}판 중 5섹터 클리어 ${snaps.length}명 → ${out}`);
} else {
  for (const file of process.argv.slice(3)) {
    const { cls, n, snaps } = JSON.parse(readFileSync(file, "utf8")) as { cls: string; n: number; snaps: { m5: number; s: GameState }[] };
    let ending = 0, offering = 0, trueEnd = 0, fallen = 0, entered = 0, dead6 = 0, firstDeath = 0, sector6Death = 0, avatarSeen = 0, avatarWin = 0;
    const causes = new Map<string, number>();
    let si = 0;
    for (const { m5, s } of snaps) {
      let firstMonth = 0, sawAvatar = false;
      // FAITHFUL=1: 옛 신을 섬기고(★4, 모든 신 해금) 진실 조각 4개를 아는 사람으로 바꿔 진엔딩 결전까지 재 본다
      if (process.env.FAITHFUL) {
        const gods = ["전쟁의 신", "기아/풍요의 신", "재앙(함정)의 신", "탐욕/채무의 신", "시와 노래의 신", "역병의 신", "심연의 신", "망각의 신"];
        s.faithsKnown = gods;
        s.hero.faith = process.env.GOD ? gods[Number(process.env.GOD)] : gods[si++ % gods.length];
        s.piety = 140;
        s.clues = ["lostgod", "lock", "ageless", "oldgods"];
      }
      for (let i = 0; i < 800000 && s.phase !== "dead" && s.month <= m5 + 6; i++) {
        if (!firstMonth && s.dungeon?.sector === 6 && !s.dungeon.endless) firstMonth = s.month;
        if (s.combat === null && s.dungeon?.sector === 6 && s.dungeon.rooms[s.dungeon.current]?.type === "boss") sawAvatar = true;
        const a = botAction(s);
        if (!a) break;
        apply(s, a);
      }
      if (firstMonth) entered++;
      if (sawAvatar) avatarSeen++;
      if (s.rank >= 6) avatarWin++;
      const e = s.tomb?.ending;
      if (e === "offering" || e === "true") {
        ending++;
        if (e === "offering") offering++;
        else trueEnd++;
        continue;
      }
      if (e === "fallen") fallen++;
      if (s.phase === "dead") {
        dead6++;
        if (firstMonth && s.month === firstMonth) firstDeath++;
        const where = s.tomb!.reached.includes("6섹터") ? "6섹터: " : s.tomb!.reached.includes("끝없는") ? "끝없는: " : s.tomb!.reached.includes("5섹터") ? "5섹터: " : "그 외: ";
        if (where === "6섹터: ") sector6Death++;
        const c = where + s.tomb!.cause.replace(/(, [^,]+)+에게 둘러싸여/, " 등에게 둘러싸여");
        causes.set(c, (causes.get(c) ?? 0) + 1);
      }
    }
    const k = snaps.length;
    const p = (x: number, of = k) => `${((x / Math.max(1, of)) * 100).toFixed(1)}%`;
    const taught = snaps.filter(({ s }) => s.godTeaching).length;
    const taughtWin = snaps.filter(({ s }) => s.godTeaching && s.rank >= 6).length;
    const lv16 = snaps.filter(({ s }) => s.hero.level >= 16 && s.dungeon === null).length;
    if (cls === "adventurer") console.log(`   신의 가르침(16레벨) ${taught}명 → 셉터까지 ${taughtWin}명 (${((taughtWin / Math.max(1, taught)) * 100).toFixed(0)}%)`);
    void lv16;
    console.log(`${cls.padEnd(10)}${process.env.GOD ? ` [${process.env.GOD}]` : ""} ${n}판 중 5섹터 클리어 ${k}명 → 6개월 안 엔딩 ${p(ending)} (헌납 ${offering} · 진엔딩 ${trueEnd}) | 6섹터 진입 ${p(entered)} | 첫 진입 달 사망 ${p(firstDeath, entered)} | 6섹터 사망 ${p(sector6Death)} | 6개월 안 사망 ${p(dead6)} | 화신 앞 ${avatarSeen} → 셉터 ${avatarWin} | 결전 패배 ${fallen}`);
    console.log("   사망 원인 " + [...causes].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, x]) => `${c} ${p(x)}`).join(" · "));
  }
}
