// 잘 준비된 레벨 3 캐릭터가 1섹터 보스를 이길 수 있는지 측정한다.
// A) 보스 무리와 HP 가득 찬 상태로 바로 싸울 때 승률  B) 3층 입구부터 봇으로 진행해 차원문까지 갈 확률
// 실행: bun scripts/sim-boss.ts [판수]
import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { enterDungeon, generateFloor } from "../src/game/dungeon";
import { makeEnemies, startCombat } from "../src/game/combat";
import { maxHp } from "../src/game/core";
import { Rng } from "../src/game/rng";
import type { GameState } from "../src/game/types";
import type { ClassId } from "../src/game/classes";

const N = Number(process.argv[2] ?? 2000);
const KIT: Record<ClassId, string[]> = {
  adventurer: ["leather", "shield", "cap", "belt", "boots"],
  warrior: ["shield", "cap", "belt", "boots"],
  mage: ["shield", "cap", "belt", "boots"],
};
const TRAIN: Record<ClassId, string[]> = { adventurer: ["sword", "endure"], warrior: ["warfare", "sword"], mage: ["arcane", "arcane"] };

export function prepared(seed: number, cls: ClassId): GameState {
  const s = newRun(seed);
  apply(s, { t: "pickClass", cls });
  apply(s, { t: "create", name: "준비된", candidate: 0, faith: null });
  s.month = 2; // 첫 달에는 훈련 불가
  for (const tr of TRAIN[cls]) {
    s.gold += 999;
    apply(s, { t: "train", training: tr, free: cls === "mage" ? ["int", "con"] : ["str", "con"] });
    s.phase = "town";
    s.weekResult = null;
  }
  s.gold = 999;
  for (const g of KIT[cls]) apply(s, { t: "buyGear", id: g });
  s.inventory = { food: 5, potion: 3, scroll: 1, heart: 0 };
  s.hero.hp = maxHp(s);
  return s;
}

if (import.meta.main) for (const cls of ["adventurer", "warrior", "mage"] as ClassId[]) {
  let bossWin = 0, floorClear = 0, hpSum = 0, inqWin = 0;
  for (let i = 1; i <= N; i++) {
    // A) 보스 무리 단독
    const a = prepared(i * 31, cls);
    hpSum += maxHp(a);
    enterDungeon(a);
    a.dungeon!.floor = 3;
    a.dungeon!.rooms = generateFloor(new Rng({ s: i }), 3);
    a.dungeon!.current = a.dungeon!.rooms.find((r) => r.type === "boss")!.id;
    a.dungeon!.prev = a.dungeon!.rooms[a.dungeon!.current].edges[0];
    startCombat(a, "dungeon", makeEnemies(a, ["boss", "rat", ...(i % 2 ? ["rat"] : []), "rat"]));
    if (a.phase !== "dead" && a.rank === 0 && a.inventory.heart > 0) bossWin++;
    // A2) 이단심문관 단독(보스 무리와 비슷해야 한다)
    const q = prepared(i * 31, cls);
    enterDungeon(q);
    startCombat(q, "dungeon", makeEnemies(q, ["inquisitor"]));
    if (q.phase !== "dead" && !q.log.some((l) => l.text.includes("물러났다") || l.text.includes("달아났다!"))) inqWin++;
    // B) 3층 입구부터 끝까지
    const b = prepared(i * 31, cls);
    enterDungeon(b);
    b.dungeon!.floor = 3;
    b.dungeon!.deepestFloor = 3;
    b.dungeon!.rooms = generateFloor(new Rng({ s: i + 777 }), 3);
    b.dungeon!.current = 0;
    for (let k = 0; k < 3000 && b.phase === "dungeon"; k++) {
      const act = botAction(b);
      if (!act) break;
      apply(b, act);
    }
    if (b.rank > 0) floorClear++;
  }
  console.log(`${cls}: 레벨3 최대HP ${(hpSum / N).toFixed(1)} | 보스 무리 단독 승률 ${((bossWin / N) * 100).toFixed(1)}% | 이단심문관 승률 ${((inqWin / N) * 100).toFixed(1)}% | 3층 입구→차원문 ${((floorClear / N) * 100).toFixed(1)}%`);
}
