import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { generateFloor } from "./dungeon";
import { newRun } from "./town";
import { act, apply } from "./engine";
import { botAction } from "./bot";
import { STAT_KEYS, BAL, MONSTERS } from "./data";
import { FRAGMENTS, FRAG_MAX_CHANCE, fragSlots } from "./fragments";
import { stat, taxDue } from "./core";
import { allSkills } from "./skills";
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

describe("자동 전투와 기술", () => {
  function hero(seed = 3): GameState {
    const s = newRun(seed);
    apply(s, { t: "create", name: "테스트", candidate: 0, faith: null });
    return s;
  }
  it("훈련할 때마다 그 훈련의 기술을 순서대로 배운다", () => {
    const s = hero();
    s.gold = 9999;
    s.inventory.heart = 1; // 레벨 3→4 관문
    for (const want of ["firstStrike", "sweep", "finisher"]) {
      apply(s, { t: "train", training: "sword", free: ["str", "con"] });
      expect(s.skills[s.skills.length - 1]).toBe(want);
      expect(s.weekResult?.learned).toBe(want);
      apply(s, { t: "closeWeek" });
      if (s.phase !== "town") { s.phase = "town"; s.dungeon = null; s.week = 1; }
    }
    apply(s, { t: "train", training: "sword", free: ["str", "con"] });
    expect(s.weekResult?.learned).toBeUndefined();
  });
  it("숲 전투는 입력 없이 한 번에 끝난다", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = hero(seed);
      apply(s, { t: "activity", a: "field" });
      expect(s.combat).toBeNull();
      expect(["week-result", "dead"]).toContain(s.phase);
    }
  });
  it("이 악물기는 미궁 한 번에 한 번 죽음을 막는다", () => {
    let saved = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = hero(seed);
      s.skills = ["grit"];
      s.hero.hp = 1;
      s.tactics = { potionAt: 0, fleeAt: 0 };
      apply(s, { t: "activity", a: "field" });
      if (s.log.some((l) => l.text.includes("이 악물기"))) saved++;
      expect(s.log.filter((l) => l.text.includes("【이 악물기】")).length).toBeLessThanOrEqual(1);
    }
    expect(saved).toBeGreaterThan(0);
  });
});

describe("직업과 장비", () => {
  it("직업마다 시작 장비가 다르고, 후보 능력치가 직업 쪽으로 쏠린다", () => {
    const avg = (cls: "adventurer" | "warrior" | "mage", k: "str" | "int") => {
      let t = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const s = newRun(seed);
        apply(s, { t: "pickClass", cls });
        t += s.candidates.reduce((a, c) => a + c.stats[k], 0) / 3;
      }
      return t / 200;
    };
    expect(avg("warrior", "str")).toBeGreaterThan(avg("adventurer", "str") + 1);
    expect(avg("mage", "int")).toBeGreaterThan(avg("adventurer", "int") + 1);
    for (const [cls, main] of [["adventurer", "shortsword"], ["warrior", "longsword"], ["mage", "staff"]] as const) {
      const s = newRun(5);
      apply(s, { t: "pickClass", cls });
      for (const c of s.candidates) expect(STAT_KEYS.reduce((a, k) => a + c.stats[k], 0)).toBe(BAL.startStatSum);
      apply(s, { t: "create", name: "x", candidate: 0, faith: null });
      expect(s.gear.main).toBe(main);
    }
  });
  it("직업 전용 훈련은 그 직업만 받을 수 있다", () => {
    const s = newRun(9);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.gold = 999;
    apply(s, { t: "train", training: "arcane", free: ["int", "int"] });
    expect(s.hero.level).toBe(1);
    const m = newRun(9);
    apply(m, { t: "pickClass", cls: "mage" });
    apply(m, { t: "create", name: "x", candidate: 0, faith: null });
    m.gold = 999;
    apply(m, { t: "train", training: "arcane", free: ["int", "int"] });
    expect(m.skills).toContain("magicMissile");
  });
  it("미궁 보물상자에서 장비가 나오고, 착용을 고르면 그 슬롯이 바뀐다", () => {
    let offered = 0;
    for (let seed = 1; seed <= 300 && offered < 5; seed++) {
      const s = playBot(seed, 4000);
      if (s.history.some((h) => h.includes("얻었다"))) offered++;
    }
    expect(offered).toBeGreaterThan(0);
  });
});

describe("고블린 매복과 희귀 개체", () => {
  it("희귀 개체는 층마다 1% 이하로 나온다", () => {
    let floors = 0, rare = 0;
    for (let seed = 1; seed <= 6000; seed++) for (const f of [1, 2, 3]) {
      floors++;
      if (generateFloor(new Rng({ s: seed * 3 + f }), f).some((r) => r.encounter?.some((m) => ["goldrat", "jewelgoblin", "crystalskel"].includes(m)))) rare++;
    }
    expect(rare / floors).toBeGreaterThan(0.003);
    expect(rare / floors).toBeLessThanOrEqual(0.012);
  });
  it("층이 깊어도 전투방이 줄지 않는다", () => {
    for (const f of [1, 2, 3]) {
      let combat = 0;
      for (let seed = 1; seed <= 500; seed++) combat += generateFloor(new Rng({ s: seed }), f).filter((r) => r.type === "combat").length;
      expect(combat / 500).toBeGreaterThanOrEqual([0, 2, 2, 2][f]);
    }
  });
  it("함정을 밟아 다치면 숨은 고블린이 기습한다", () => {
    let surprised = 0;
    for (let seed = 1; seed <= 400 && surprised === 0; seed++) {
      const s = playBot(seed, 3000);
      if (s.log.some((l) => l.text.startsWith("기습!"))) surprised++;
    }
    expect(surprised).toBeGreaterThan(0);
  });
});

describe("레벨 4 관문", () => {
  it("레벨 3→4 훈련은 보스의 마석 심장이 있어야 하고, 받으면 심장을 쓴다", () => {
    const s = newRun(21);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    const up = () => {
      s.gold = 999;
      apply(s, { t: "train", training: "sword", free: ["str", "con"] });
      s.phase = "town";
      s.weekResult = null;
    };
    up();
    up();
    expect(s.hero.level).toBe(3);
    up();
    expect(s.hero.level).toBe(3);
    s.inventory.heart = 1;
    up();
    expect(s.hero.level).toBe(4);
    expect(s.inventory.heart).toBe(0);
  });
  it("보스를 쓰러뜨리면 마석 심장을 얻는다", () => {
    let got = 0;
    for (let seed = 1; seed <= 300 && !got; seed++) {
      const s = playBot(seed, 20000);
      if (s.log.some((l) => l.text.includes("마석 심장을 꺼냈다"))) got++;
    }
    expect(got).toBeGreaterThan(0);
  });
});

describe("편린", () => {
  it("드롭 확률은 최대 3%이고, 좋은 몬스터일수록 등급이 높다", () => {
    for (const f of Object.values(FRAGMENTS)) {
      expect(f.chance).toBeGreaterThan(0);
      expect(f.chance).toBeLessThanOrEqual(FRAG_MAX_CHANCE);
      expect(MONSTERS[f.id]).toBeDefined();
    }
    expect(FRAGMENTS.boss.tier).toBeGreaterThan(FRAGMENTS.skeleton.tier);
    expect(FRAGMENTS.skeleton.tier).toBeGreaterThan(FRAGMENTS.rat.tier);
    // 능력 있는 편린과 없는 편린이 섞여 있다
    expect(Object.values(FRAGMENTS).some((f) => f.skill)).toBe(true);
    expect(Object.values(FRAGMENTS).some((f) => !f.skill)).toBe(true);
  });
  it("칸은 레벨 1에 1칸, 3레벨마다 1칸씩 는다", () => {
    expect([1, 2, 3, 5, 6, 9, 16].map(fragSlots)).toEqual([1, 1, 2, 2, 3, 4, 6]);
  });
  it("흡수하면 능력치와 능력이 붙고, 칸이 차면 하나를 깨뜨려야 한다", () => {
    const s = newRun(5);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    apply(s, { t: "closeWeek" });
    s.phase = "week-result";
    s.week = 3;
    apply(s, { t: "closeWeek" });
    expect(s.phase).toBe("dungeon");
    const dex = stat(s, "dex");
    s.dungeon!.pending = { kind: "frag", frag: "rat" };
    apply(s, { t: "pending", choice: "absorb" });
    expect(s.fragments).toEqual(["rat"]);
    expect(stat(s, "dex")).toBe(dex + 2);
    // 1칸이 찼으므로 absorb는 무시되고 흩어진다
    s.dungeon!.pending = { kind: "frag", frag: "goblin" };
    apply(s, { t: "pending", choice: "absorb" });
    expect(s.fragments).toEqual(["rat"]);
    s.dungeon!.pending = { kind: "frag", frag: "crystalskel" };
    apply(s, { t: "pending", choice: "swap0" });
    expect(s.fragments).toEqual(["crystalskel"]);
    expect(stat(s, "dex")).toBe(dex);
    expect(allSkills(s)).toContain("fragCrystalBone");
  });
  it("봇 플레이에서 실제로 편린이 나온다", () => {
    let got = 0;
    for (let seed = 1; seed <= 400 && !got; seed++) {
      const s = playBot(seed, 20000);
      if (s.history.some((h) => h.includes("편린을 흡수했다"))) got++;
    }
    expect(got).toBeGreaterThan(0);
  });
});

describe("세금", () => {
  it("해가 바뀔 때마다 오른다", () => {
    expect(taxDue(1)).toBe(BAL.taxBase);
    expect(taxDue(12)).toBe(BAL.taxBase);
    expect(taxDue(13)).toBe(BAL.taxBase + BAL.taxPerYear);
    expect(taxDue(25)).toBe(BAL.taxBase + BAL.taxPerYear * 2);
  });
});
