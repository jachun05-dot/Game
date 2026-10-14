import { MONSTERS } from "./data";
import type { Rng } from "./rng";
import type { DungeonState, Enemy, Room, RoomType } from "./types";

// 끝없는 미궁(2026-10-14): 마지막으로 만든 섹터(LAST_SECTOR)의 차원문 너머. 층은 끝없이 이어지고, 함정·상자·기록물 없이 몬스터만 나온다.
// 지금까지 만든 몬스터가 무작위로 섞여 나오고(사람·허수아비·히든 청소부·희귀 개체 제외),
// 5층마다 보스(거대 쥐·하피 여왕·장군·균모·화로 어미·아귀·화신) 중 하나가 계단 앞을 지킨다. 층이 깊을수록 몬스터가 강해진다.
// 던전 상태는 sector ENDLESS_SECTOR + endless 플래그로 표시한다(층 번호 = 끝없는 미궁 몇 층).
// 섹터 번호는 실제 섹터와 겹치지 않게 큰 수를 쓰고, 섹터별 표(조우·마석 배율 등)는 endless 플래그로 따로 고른다.

/** 지금까지 만든 마지막 섹터: 이 섹터의 차원문 너머가 끝없는 미궁 */
export const LAST_SECTOR = 6;
export const ENDLESS_SECTOR = 99;
export const ENDLESS_NAME = "끝없는 미궁";

/** 보스는 5층마다 */
export const ENDLESS_BOSS_EVERY = 5;
const BOSSES = ["boss", "harpyqueen", "general", "mycomother", "furnacemother", "abyssmaw", "avatar"];

/** 끝없는 미궁에 나오는 보통 몬스터(지금까지 만든 몬스터 전부, 특수한 것 제외) */
export function endlessPool(): string[] {
  return Object.values(MONSTERS)
    .filter((m) => !m.human && !m.dummy && !m.hidden && !m.rare && !m.elite && !m.trial && !m.avatar && !BOSSES.includes(m.id))
    .map((m) => m.id);
}

/** n층 강화치: HP 배율, 명중·피해·AC 보정 */
export function endlessScale(n: number): { hp: number; atk: number; dmg: number; ac: number } {
  return {
    hp: 1.5 + 0.25 * n,
    atk: 2 + Math.floor(n / 2),
    dmg: 1 + Math.floor(n / 2),
    ac: 1 + Math.floor(n / 3),
  };
}

/** n층 마석 배율(섹터 배율과 곱한다) */
export function endlessManaMult(n: number): number {
  return 2 + 0.3 * n;
}

/** 무리 크기: 깊을수록 커진다(최대 4) */
export function endlessGroup(r: Rng, n: number): string[] {
  const pool = endlessPool();
  const size = r.int(1, Math.min(4, 1 + Math.floor(n / 3)));
  return Array.from({ length: size }, () => r.pick(pool));
}

/** 이 층의 몬스터를 강하게: makeEnemies가 끝없는 미궁에서 부른다(히든 청소부는 제외) */
export function scaleEnemy(e: Enemy, n: number): Enemy {
  if (MONSTERS[e.defId].hidden) return e;
  const k = endlessScale(n);
  const hp = Math.round(MONSTERS[e.defId].hp * k.hp);
  return { ...e, hp, hpMax: hp, atkUp: k.atk, dmgUp: k.dmg, acUp: k.ac };
}

/** n층 지도: 입구 → 방들(전투 약 60%, 나머지 빈 방) → 아래 계단. 5층마다 계단 앞 방에 보스 */
export function generateEndlessFloor(r: Rng, n: number): Room[] {
  const rooms: Room[] = [];
  const add = (type: RoomType, depth: number): Room => {
    const room: Room = { id: rooms.length, type, edges: [], depth, visited: false, known: false, resolved: false, flavor: r.int(0, 99) };
    rooms.push(room);
    return room;
  };
  const link = (a: Room, b: Room) => {
    a.edges.push(b.id);
    b.edges.push(a.id);
  };
  const mainLen = r.int(6, 8);
  const main: Room[] = [add("entrance", 0)];
  for (let i = 1; i < mainLen; i++) {
    const room = add("empty", i);
    link(main[i - 1], room);
    main.push(room);
  }
  main[main.length - 1].type = "stairs";
  const branches = r.int(2, 3);
  for (let b = 0; b < branches; b++) {
    let anchor = main[r.int(1, main.length - 2)];
    const len = r.int(1, 2);
    for (let k = 0; k < len; k++) {
      const room = add("empty", anchor.depth + 1);
      link(anchor, room);
      anchor = room;
    }
  }
  for (const room of rooms) {
    if (room.type !== "empty") continue;
    if (r.chance(0.6)) {
      room.type = "combat";
      room.encounter = endlessGroup(r, n);
    }
  }
  // 5층마다: 계단 바로 앞 방에 보스(+ 호위)
  if (n % ENDLESS_BOSS_EVERY === 0) {
    const guard = main[main.length - 2];
    guard.type = "combat";
    guard.encounter = [r.pick(BOSSES), ...endlessGroup(r, Math.max(1, n - 3)).slice(0, 2)];
  }
  return rooms;
}

export function isEndless(dg: DungeonState | null | undefined): boolean {
  return !!dg?.endless;
}
