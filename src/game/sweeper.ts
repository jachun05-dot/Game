import { BAL } from "./data";
import { log } from "./core";
import { ENDLESS_SECTOR, LAST_SECTOR } from "./endless";
import type { DungeonState, GameState } from "./types";

// 미궁의 청소부(히든 보스): 실력에 비해 얕은 층에 오래 머물면 예고 → 나타남 → 추적.
// 레벨이 "이 층 다음 층의 권장 레벨" 이상일 때만 시계가 돈다(내려갈 수 있는데 안 내려가는 사람만 밀어낸다).
// 계단으로 내려가거나 미궁을 나가면 피할 수 있다(층을 따라 내려오지 않는다). 첫 미궁(1월)에는 없다.
// 전투는 dungeon.ts가 시작하고 끝낸다(여기는 시계·위치만).

/** 이 층에서 다음 층으로 내려가도 될 만한 레벨: 1섹터 1·2·3층 = 3·5·7, 2섹터 = 6·8·10, 3섹터 = 9·11·13.
 *  끝없는 미궁은 마지막 섹터 다음 섹터로 친다 */
export function nextFloorLevel(sector: number, floor: number): number {
  const sec = sector === ENDLESS_SECTOR ? LAST_SECTOR + 1 : sector;
  return Math.min(BAL.maxLevel, (sec - 1) * 3 + floor * 2 + 1); // 최대 레벨(16)에서 자른다 — 5섹터 2·3층에서도 머무르면 밀어낸다
}

export function sweeperId(sector: number): string {
  return sector === 6 ? "judgeeye" : sector >= 5 ? "sweeper5" : sector === 4 ? "sweeper4" : sector === 3 ? "sweeper3" : sector === 2 ? "sweeper2" : "sweeper1";
}

/** 이 층에서 청소부 시계가 도는가 */
export function sweeperEligible(s: GameState): boolean {
  const dg = s.dungeon;
  if (!dg || dg.first || dg.sweeperDown) return false;
  // 6섹터 심판의 눈: 1·2층에서는 레벨과 상관없이 시계가 돈다(권장 레벨이 최대 레벨을 넘어 청소부가 사라지는 구멍을 메운다). 3층 성소에는 시선이 닿지 않는다
  if (dg.sector === 6 && !dg.endless) return dg.floor <= 2;
  return s.hero.level >= nextFloorLevel(dg.sector, dg.floor);
}

/** 새 층에 들어설 때 시계를 처음부터 */
export function resetSweeper(dg: DungeonState): void {
  dg.floorTurns = 0;
  dg.sweeperStage = 0;
  dg.sweeperRoom = null;
  dg.sweeperDown = false;
}

/** 청소부가 쫓아오는 중인가(예고 포함) */
export function sweeperThreat(s: GameState): boolean {
  const dg = s.dungeon;
  return !!dg && !dg.sweeperDown && (dg.sweeperStage ?? 0) > 0;
}

/** 시간이 흐를 때(passTime): 예고와 나타남 */
export function sweeperTick(s: GameState, turns: number): void {
  const dg = s.dungeon;
  if (!dg) return;
  dg.floorTurns = (dg.floorTurns ?? 0) + turns;
  if (!sweeperEligible(s)) return;
  const [warn1, warn2, appear] = BAL.sweeperTurns;
  const stage = dg.sweeperStage ?? 0;
  const t = dg.floorTurns;
  if (stage < 1 && t >= warn1) {
    dg.sweeperStage = 1;
    log(s, "멀리서 무언가 바닥을 긁는 소리가 난다. 이 층에 너무 오래 있었다 — 계단을 찾자.", "hurt");
  }
  if ((dg.sweeperStage ?? 0) < 2 && t >= warn2) {
    dg.sweeperStage = 2;
    log(s, "벽 너머로 거대한 숨소리가 지나간다. 무언가 이 층을 치우러 오고 있다.", "hurt");
    // 도망칠 길은 알려 준다: 계단·차원문 쪽으로 바람이 빠져나간다
    const exits = dg.rooms.filter((r) => r.type === "stairs" || r.type === "portal");
    if (exits.some((r) => !r.known && !r.visited)) {
      for (const r of exits) r.known = true;
      log(s, "바람이 한쪽으로 빨려 나간다 — 출구가 어디인지 알 것 같다. (지도에 표시)", "system");
    }
  }
  if ((dg.sweeperStage ?? 0) < 3 && t >= appear) {
    dg.sweeperStage = 3;
    dg.sweeperRoom = spawnRoom(dg);
    log(s, dg.sector === 6 && !dg.endless ? "【심판의 눈】 천장이 열리고 거대한 눈이 내려왔다. 방을 하나씩 훑으며 이쪽으로 온다. (계단으로 내려가거나 미궁을 나가면 피할 수 있다)" : `【미궁의 청소부】 그것이 나타났다. 멀리서 방을 하나씩 비우며 이쪽으로 온다. (계단으로 내려가거나 미궁을 나가면 피할 수 있다)`, "crit");
  }
}

/** 청소부가 steps 방만큼 다가온다. 내 방에 닿으면 true */
export function sweeperStep(s: GameState, steps: number): boolean {
  const dg = s.dungeon;
  if (!dg || dg.sweeperDown || dg.sweeperRoom == null) return false;
  for (let i = 0; i < steps && dg.sweeperRoom !== dg.current; i++) {
    const path = pathTo(dg, dg.sweeperRoom, dg.current);
    if (path.length < 2) break;
    dg.sweeperRoom = path[1];
  }
  if (dg.sweeperRoom === dg.current) return true;
  const dist = sweeperDistance(s);
  if (dist !== null && dist <= 2) log(s, dist === 1 ? "바로 옆 방에서 무언가 벽을 긁는다. 청소부가 코앞이다!" : "청소부의 발소리가 가까워진다. (두 방 거리)", "hurt");
  return false;
}

/** 청소부까지의 방 거리(나타나지 않았으면 null) */
export function sweeperDistance(s: GameState): number | null {
  const dg = s.dungeon;
  if (!dg || dg.sweeperDown || dg.sweeperRoom == null) return null;
  const p = pathTo(dg, dg.sweeperRoom, dg.current);
  return p.length ? p.length - 1 : null;
}

function pathTo(dg: DungeonState, from: number, to: number): number[] {
  const prev = new Map<number, number>([[from, -1]]);
  const q = [from];
  while (q.length) {
    const x = q.shift()!;
    if (x === to) break;
    for (const e of dg.rooms[x].edges) if (!prev.has(e)) { prev.set(e, x); q.push(e); }
  }
  if (!prev.has(to)) return [];
  const out = [to];
  let x = to;
  while (prev.get(x)! !== -1) { x = prev.get(x)!; out.unshift(x); }
  return out;
}

/** 나타날 방: 출구에서 가장 먼 쪽(뒤에서 따라온다), 나와는 두 방 이상 떨어진 곳.
 *  출구를 막아서지 않게 — 곧장 출구로 가면 언제나 먼저 닿는다 */
function spawnRoom(dg: DungeonState): number {
  const exits = dg.rooms.filter((r) => r.type === "stairs" || r.type === "portal").map((r) => r.id);
  const dist = (a: number, b: number) => { const p = pathTo(dg, a, b); return p.length ? p.length - 1 : 99; };
  const toExit = (id: number) => (exits.length ? Math.min(...exits.map((e) => dist(id, e))) : 0);
  let best = -1, bestKey = -1;
  for (const r of dg.rooms) {
    if (exits.includes(r.id)) continue;
    const fromMe = dist(r.id, dg.current);
    if (fromMe < 2 || fromMe === 99) continue;
    const key = toExit(r.id) * 100 + fromMe;
    if (key > bestKey) { best = r.id; bestKey = key; }
  }
  return best >= 0 ? best : dg.rooms.find((r) => r.id !== dg.current && !exits.includes(r.id))?.id ?? 0;
}
