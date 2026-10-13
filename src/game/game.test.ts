import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { generateFloor } from "./dungeon";
import { newRun } from "./town";
import { act, apply } from "./engine";
import { botAction } from "./bot";
import { STAT_KEYS, BAL } from "./data";
import type { GameState } from "./types";

function reachable(rooms: ReturnType<typeof generateFloor>): Set<number> {
  const seen = new Set([0]);
  const q = [0];
  while (q.length) for (const nb of rooms[q.shift()!].edges) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  return seen;
}

describe("rng", () => {
  it("같은 시드는 같은 수열", () => {
    const a = new Rng({ s: 42 }), b = new Rng({ s: 42 });
    expect([1, 2, 3, 4].map(() => a.int(1, 100))).toEqual([1, 2, 3, 4].map(() => b.int(1, 100)));
  });
});

describe("층 생성", () => {
  it("모든 방이 입구에서 도달 가능하고 필수 방이 정확히 있다", () => {
    for (let seed = 1; seed <= 500; seed++) {
      for (const floor of [1, 2, 3]) {
        const rooms = generateFloor(new Rng({ s: seed }), floor);
        expect(reachable(rooms).size).toBe(rooms.length);
        const types = rooms.map((r) => r.type);
        expect(types[0]).toBe("entrance");
        if (floor < 3) expect(types.filter((t) => t === "stairs").length).toBe(1);
        else {
          expect(types.filter((t) => t === "boss").length).toBe(1);
          const portal = rooms.find((r) => r.type === "portal")!;
          // 포탈은 보스방을 거쳐야만 갈 수 있다
          expect(portal.edges.map((e) => rooms[e].type)).toEqual(["boss"]);
        }
        for (const r of rooms) if (r.type === "combat" || r.type === "boss") expect(r.encounter?.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("캐릭터 생성", () => {
  it("후보 3장은 합계가 같다", () => {
    const s = newRun(7);
    expect(s.candidates).toHaveLength(3);
    for (const c of s.candidates) expect(STAT_KEYS.reduce((a, k) => a + c.stats[k], 0)).toBe(BAL.startStatSum);
  });
  it("act는 원본 상태를 바꾸지 않는다", () => {
    const s = newRun(7);
    const next = act(s, { t: "create", name: "테스트", candidate: 1, faith: null });
    expect(s.phase).toBe("create");
    expect(next.phase).toBe("town");
    expect(next.hero.name).toBe("테스트");
  });
});

export function playBot(seed: number, maxSteps = 20000): GameState {
  const s = newRun(seed);
  for (let i = 0; i < maxSteps && s.phase !== "dead"; i++) {
    if (s.month > 12) break;
    const a = botAction(s);
    if (!a) break;
    apply(s, a);
  }
  return s;
}

describe("봇 전체 플레이", () => {
  it("멈추거나 예외 없이 끝까지 진행되고, 같은 시드는 같은 결과", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const a = playBot(seed);
      expect(a.phase === "dead" || a.month > 12).toBe(true);
      if (seed <= 5) expect(playBot(seed).log.length).toBe(a.log.length);
    }
  });
});
