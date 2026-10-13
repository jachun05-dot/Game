import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { generateFloor } from "./dungeon";
import { newRun } from "./town";
import { act, apply } from "./engine";
import { botAction } from "./bot";
import { STAT_KEYS, BAL, MONSTERS } from "./data";
import { FRAGMENTS, FRAG_MAX_CHANCE, fragKnown, fragSlots } from "./fragments";
import { stat, taxDue } from "./core";
import { allSkills } from "./skills";
import { tier } from "./faith";
import { FAITH } from "./data";
import { maxHp } from "./core";
import { injuryHit, injuryRollPenalty, lvl, wound } from "./injury";
import { weaponOf } from "./gear";
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
    s.month = 2; // 첫 달에는 훈련 불가
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
    s.month = 2;
    s.gold = 999;
    apply(s, { t: "train", training: "arcane", free: ["int", "int"] });
    expect(s.hero.level).toBe(1);
    const m = newRun(9);
    apply(m, { t: "pickClass", cls: "mage" });
    apply(m, { t: "create", name: "x", candidate: 0, faith: null });
    m.month = 2;
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
    s.month = 2;
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

describe("편린 도감과 신전", () => {
  it("처음 흡수하는 편린은 도감에 기록되고, 전투하면 마주친 몬스터·처치 수가 쌓인다", () => {
    const s = playBot(3, 4000);
    expect(s.codex.seen.length).toBeGreaterThan(0);
    expect(Object.values(s.codex.kills).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    const t = newRun(5);
    apply(t, { t: "create", name: "x", candidate: 0, faith: null });
    t.week = 3;
    t.phase = "week-result";
    apply(t, { t: "closeWeek" });
    expect(fragKnown(t, "rat")).toBe(false);
    t.dungeon!.pending = { kind: "frag", frag: "rat" };
    apply(t, { t: "pending", choice: "absorb" });
    expect(fragKnown(t, "rat")).toBe(true);
  });
  it("신전에서 1000G를 내야 편린을 지울 수 있다", () => {
    const s = newRun(5);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.fragments = ["rat"];
    s.gold = BAL.fragEraseCost - 1;
    apply(s, { t: "eraseFrag", index: 0 });
    expect(s.fragments).toEqual(["rat"]);
    s.gold = BAL.fragEraseCost + 5;
    apply(s, { t: "eraseFrag", index: 0 });
    expect(s.fragments).toEqual([]);
    expect(s.gold).toBe(5);
  });
});

describe("자동 결정 목표", () => {
  const run = (seed: number, goal: "explore" | "rush" | "farm") => {
    const s = newRun(seed);
    apply(s, { t: "autoGoal", goal });
    let rooms = 0, records = 0;
    for (let i = 0; i < 20000 && s.phase !== "dead" && s.month <= 6; i++) {
      const a = botAction(s)!;
      if (a.t === "move") rooms++;
      if (a.t === "pending" && a.choice === "read") records++;
      apply(s, a);
    }
    return { s, rooms, records };
  };
  it("세 목표 모두 멈추지 않고 진행되며, 돌파는 탐험보다 적게 걷고 기록물을 읽지 않는다", () => {
    let exploreRooms = 0, rushRooms = 0, rushRecords = 0;
    for (let seed = 1; seed <= 30; seed++) {
      exploreRooms += run(seed, "explore").rooms;
      const r = run(seed, "rush");
      rushRooms += r.rooms;
      rushRecords += r.records;
      run(seed, "farm");
    }
    expect(rushRecords).toBe(0);
    expect(rushRooms).toBeLessThan(exploreRooms);
  });
});

describe("시작 조건", () => {
  it("모든 직업이 0G로 시작하고, 직업별 지급품을 받으며, 첫 달에는 훈련할 수 없다", () => {
    for (const cls of ["adventurer", "warrior", "mage"] as const) {
      const s = newRun(4);
      apply(s, { t: "pickClass", cls });
      apply(s, { t: "create", name: "x", candidate: 0, faith: null });
      expect(s.gold).toBe(0);
      expect(s.inventory.food + s.inventory.potion).toBeGreaterThan(0);
      s.gold = 999;
      apply(s, { t: "train", training: s.hero.cls === "mage" ? "arcane" : "sword", free: ["str", "con"] });
      expect(s.hero.level).toBe(1);
      s.month = 2;
      apply(s, { t: "train", training: s.hero.cls === "mage" ? "arcane" : "sword", free: ["str", "con"] });
      expect(s.hero.level).toBe(2);
    }
  });
});

describe("캐릭터 생성 후보", () => {
  it("직업을 바꿨다 돌아오면 그 직업의 후보가 그대로 남는다", () => {
    const s = newRun(11);
    const first = JSON.stringify(s.candidates);
    apply(s, { t: "pickClass", cls: "warrior" });
    const warrior = JSON.stringify(s.candidates);
    apply(s, { t: "pickClass", cls: "mage" });
    apply(s, { t: "pickClass", cls: "adventurer" });
    expect(JSON.stringify(s.candidates)).toBe(first);
    apply(s, { t: "pickClass", cls: "warrior" });
    expect(JSON.stringify(s.candidates)).toBe(warrior);
    // 다시 뽑기는 지금 직업의 후보만 바꾸고, 바꾼 후보가 기억된다
    apply(s, { t: "reroll" });
    const rerolled = JSON.stringify(s.candidates);
    apply(s, { t: "pickClass", cls: "mage" });
    apply(s, { t: "pickClass", cls: "warrior" });
    expect(JSON.stringify(s.candidates)).toBe(rerolled);
  });
});

describe("몬스터 리젠", () => {
  it("비운 전투방은 시간이 지나면 다시 채워지고, 함정·상자·보스방은 그대로다", () => {
    const s = newRun(8);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    const dg = s.dungeon!;
    for (const r of dg.rooms) r.resolved = true;
    dg.current = dg.rooms.find((r) => r.type === "entrance")!.id;
    for (let i = 0; i < 20; i++) apply(s, { t: "camp" });
    const combat = dg.rooms.filter((r) => r.type === "combat");
    expect(combat.some((r) => r.respawned && !r.resolved && r.encounter?.length)).toBe(true);
    expect(dg.rooms.filter((r) => r.type !== "combat").every((r) => r.resolved && !r.respawned)).toBe(true);
  });
});

describe("신앙", () => {
  const withFaith = (name: string, seed = 4) => {
    const s = newRun(seed);
    s.faithsKnown = [FAITH.mob, FAITH.starve, FAITH.trap, FAITH.tax, FAITH.song];
    apply(s, { t: "create", name: "x", candidate: 0, faith: name });
    return s;
  };
  it("해금된 신만 고를 수 있고, 신앙심 30(★1)에서 시작해 60·90에 권능이 열린다", () => {
    const s = withFaith(FAITH.mob);
    expect(s.hero.faith).toBe(FAITH.mob);
    expect(s.piety).toBe(30);
    expect(tier(s)).toBe(1);
    s.piety = 60;
    expect(tier(s)).toBe(2);
    const t = newRun(4);
    t.faithsKnown = [FAITH.mob];
    apply(t, { t: "create", name: "x", candidate: 0, faith: FAITH.song });
    expect(t.hero.faith).toBe(null);
  });
  it("이단 심문을 거부하면 현상수배가 되어 마을 시설을 못 쓰고, 자수하면 신앙을 잃고 돌아온다", () => {
    const s = withFaith(FAITH.mob);
    s.phase = "settlement";
    s.settlement = { month: 1, manaSold: 0, tax: 30, goldAfter: 0, paid: false, cleared: false, forced: false, lines: [], inquisition: true };
    apply(s, { t: "closeSettlement" });
    expect(s.phase).toBe("settlement"); // 답하기 전에는 넘어가지 않는다
    apply(s, { t: "inquisition", renounce: false });
    expect(s.heretic).toBe(true);
    apply(s, { t: "closeSettlement" });
    expect(s.phase).toBe("town"); // 세금을 못 내도 처형되지 않는다(관공서에 갈 수 없음)
    s.gold = 999;
    apply(s, { t: "buy", item: "potion" });
    apply(s, { t: "activity", a: "rumor" });
    expect(s.inventory.potion).toBe(0);
    expect(s.phase).toBe("town");
    apply(s, { t: "surrender" });
    expect(s.heretic).toBe(false);
    expect(s.hero.faith).toBe(null);
  });
  it("현상수배 중에는 미궁에서 이단심문관이 나타나고, 쓰러뜨리면 신앙심 +10", () => {
    let met = 0, won = 0;
    for (let seed = 1; seed <= 200 && won === 0; seed++) {
      const s = withFaith(FAITH.mob, seed);
      s.heretic = true;
      s.hero.level = 6;
      s.hero.hp = maxHp(s);
      s.inventory.potion = 5;
      s.week = 3;
      s.phase = "week-result";
      apply(s, { t: "closeWeek" });
      const before = s.piety;
      for (let i = 0; i < 300 && (s.phase as string) === "dungeon"; i++) {
        const a = botAction(s);
        if (!a) break;
        apply(s, a);
        if (s.log.some((l) => l.text.includes("이단심문관이 길을 막아선다"))) met = Math.max(met, 1);
        if (s.log.some((l) => l.text.includes("신앙심 +10"))) { won++; expect(s.piety).toBeGreaterThanOrEqual(before); break; }
      }
    }
    expect(met).toBe(1);
    expect(won).toBeGreaterThan(0);
  });
  it("개종하면 버린 신이 저주를 건다", () => {
    const s = withFaith(FAITH.mob);
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    s.dungeon!.pending = { kind: "shrine" };
    apply(s, { t: "pending", choice: `convert${s.faithsKnown.indexOf(FAITH.song)}` });
    expect(s.hero.faith).toBe(FAITH.song);
    expect(s.curse?.god).toBe(FAITH.mob);
  });
});

describe("부상·질병", () => {
  const inDungeon = (seed = 6) => {
    const s = newRun(seed);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    return s;
  };
  it("같은 부위를 다시 다치면 악화되고, 머리 결손은 즉사하며 망각의 신이 해금된다", () => {
    const s = inDungeon();
    expect(wound(s, "head", "테스트")).toBe(null);
    expect(s.injuries.head).toBe(1);
    expect(injuryRollPenalty(s)).toBe(-2);
    wound(s, "head", "테스트");
    expect(wound(s, "head", "테스트")).toBe("oblivion");
  });
  it("몸통 중상이면 다른 부위도 경상 페널티를 받는다", () => {
    const s = inDungeon();
    s.injuries.body = 2;
    expect(lvl(s, "main")).toBe(1);
    expect(injuryHit(s)).toBe(-2);
  });
  it("쥐 열병으로 HP가 0이 되면 역병의 신이 해금된다", () => {
    const s = inDungeon();
    s.disease = 2;
    s.hero.hp = 1;
    const dg = s.dungeon!;
    const nb = dg.rooms[dg.current].edges[0];
    apply(s, { t: "move", room: nb });
    expect(s.phase).toBe("dead");
    expect(s.tomb!.faithsUnlocked).toContain(FAITH.plague);
  });
  it("꺼진 바닥에 빠지면 아래층으로 떨어지고, 추락사는 심연의 신을 해금한다", () => {
    let fell = 0, died = 0;
    for (let seed = 1; seed <= 300 && (!fell || !died); seed++) {
      const s = inDungeon(seed);
      const dg = s.dungeon!;
      dg.floor = 2;
      const room = dg.rooms.find((r) => r.type === "trap")!;
      room.trapKind = "pit";
      room.known = true;
      room.ambush = undefined;
      dg.current = room.id;
      dg.pending = { kind: "trap" };
      if (seed % 2) s.hero.hp = 1;
      apply(s, { t: "pending", choice: "force" });
      if (s.phase === "dead" && s.tomb!.faithsUnlocked.includes(FAITH.abyss)) died++;
      if (s.phase === "dungeon" && s.dungeon!.floor === 3) fell++;
    }
    expect(fell).toBeGreaterThan(0);
    expect(died).toBeGreaterThan(0);
  });
  it("여관은 부상을 한 단계씩 낫게 하고, 결손된 손은 의수(중상 성능)나 재생 의식(완치)으로 되돌린다", () => {
    const s = newRun(6);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.injuries.feet = 2;
    s.disease = 1;
    s.injuries.main = 3;
    s.gold = 2000;
    expect(weaponOf(s).verb).toBe("주먹을 휘둘러");
    apply(s, { t: "activity", a: "inn" });
    expect(s.injuries.feet).toBe(1);
    expect(s.disease).toBe(0);
    s.phase = "town";
    apply(s, { t: "prosthetic", part: "main" });
    expect(lvl(s, "main")).toBe(2);
    expect(weaponOf(s).verb).not.toBe("주먹을 휘둘러");
    apply(s, { t: "regen", part: "main" });
    expect(s.injuries.main).toBe(0);
    expect(s.prosthetic.main).toBeUndefined();
  });
  it("봇 플레이에서 실제로 부상이 생긴다", () => {
    let hurt = 0;
    for (let seed = 1; seed <= 100 && !hurt; seed++) {
      const s = playBot(seed, 20000);
      if (s.log.some((l) => l.text.startsWith("【부상】"))) hurt++;
    }
    expect(hurt).toBeGreaterThan(0);
  });
});
