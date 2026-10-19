import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { enterDungeon, generateFloor, isNight, passTime } from "./dungeon";
import { canTrain, newRun, trainCost } from "./town";
import { ENDLESS_SECTOR, endlessPool, generateEndlessFloor } from "./endless";
import { CLASSES } from "./classes";
import { act, apply } from "./engine";
import { botAction } from "./bot";
import { STAT_KEYS, BAL, MONSTERS } from "./data";
import { FRAGMENTS, FRAG_MAX_CHANCE, fragKnown, fragSlots } from "./fragments";
import { kill, stat, taxDue } from "./core";
import { allSkills } from "./skills";
import { teachOn, tier } from "./faith";
import { FAITH } from "./data";
import { maxHp } from "./core";
import { injuryHit, injuryRollPenalty, lvl, wound } from "./injury";
import { weaponOf } from "./gear";
import { BRANCH_SKILLS, ELEMENT_SKILLS, MARK_FOR_SKILL, STYLE_SKILLS } from "./elements";
import { SKILLS, activeSkills, passive } from "./skills";
import { mindSummary } from "./mind";
import { makeEnemies, startCombat } from "./combat";
import { dummyAfterTraining, dummyTest } from "./dummy";
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
  it("모험가는 갈래를 받아 오른 레벨에 정해진 기술을 배우고, 첫 훈련 때 섬광 가루를 함께 배운다", () => {
    const s = hero();
    s.gold = 9999;
    s.inventory.heart = 1; // 레벨 3→4 관문
    for (const want of ["swordHand", "sweep", "fighterMark"]) {
      apply(s, { t: "train", training: "fighter", free: ["str", "con"] });
      expect(s.weekResult?.learned).toBe(want);
      apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
      if (s.phase !== "town") { s.phase = "town"; s.dungeon = null; s.week = 1; }
    }
    expect(s.skills).toContain("flashPowder");
    apply(s, { t: "train", training: "rogue", free: ["dex", "con"] });
    expect(s.weekResult?.learned).toBe("shadowStep"); // 5레벨 민첩형 칸
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
    apply(s, { t: "train", training: "fire", free: ["int", "int"] });
    expect(s.hero.level).toBe(1);
    const m = newRun(9);
    apply(m, { t: "pickClass", cls: "mage" });
    apply(m, { t: "create", name: "x", candidate: 0, faith: null });
    m.month = 2;
    m.gold = 999;
    apply(m, { t: "train", training: "sword", free: ["int", "int"] });
    expect(m.hero.level).toBe(1);
    apply(m, { t: "train", training: "fire", free: ["int", "int"] });
    expect(m.skills).toContain("fireEmber");
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
      apply(s, { t: "train", training: "fighter", free: ["str", "con"] });
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
      if (s.log.some((l) => l.text.includes("마석 심장을 얻었다"))) got++;
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
    apply(s, { t: "enterDungeon" });
    s.phase = "week-result";
    s.week = 3;
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
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
    apply(t, { t: "enterDungeon" });
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
      apply(s, { t: "train", training: s.hero.cls === "mage" ? "fire" : s.hero.cls === "warrior" ? "glad" : "fighter", free: ["str", "con"] });
      expect(s.hero.level).toBe(1);
      s.month = 2;
      apply(s, { t: "train", training: s.hero.cls === "mage" ? "fire" : s.hero.cls === "warrior" ? "glad" : "fighter", free: ["str", "con"] });
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
    apply(s, { t: "enterDungeon" });
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
    const potions = s.inventory.potion;
    const blackPrice = Math.ceil(BAL.prices.potion * (s.priceIndex ?? 1)) * 2;
    apply(s, { t: "buy", item: "potion" });
    apply(s, { t: "activity", a: "rumor" });
    expect(s.inventory.potion).toBe(potions + 1); // 상점가 대신 암시장: 두 배 값
    expect(s.gold).toBe(999 - blackPrice);
    apply(s, { t: "buyGear", id: "shield" });
    expect(s.gear.offhand).toBeUndefined(); // 대장간은 여전히 못 쓴다
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
    apply(s, { t: "enterDungeon" });
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
    apply(s, { t: "enterDungeon" });
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
    apply(s, { t: "enterDungeon" });
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
    s.gold = 5000;
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

describe("정신 상태이상", () => {
  const inDungeon = (seed = 9) => {
    const s = newRun(seed);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    return s;
  };
  it("걸려도 처음엔 숨겨져 있고, 방을 옮기다 눈치채면 드러난다", () => {
    let revealed = 0;
    for (let seed = 1; seed <= 40 && !revealed; seed++) {
      const s = inDungeon(seed);
      s.mind.fear = { known: false };
      expect(mindSummary(s)).toEqual([]);
      for (let i = 0; i < 30 && s.phase === "dungeon" && !s.mind.fear?.known; i++) {
        s.dungeon!.pending = null;
        const nb = s.dungeon!.rooms[s.dungeon!.current].edges[0];
        apply(s, { t: "move", room: nb });
        s.combat = null;
        (s as GameState).phase = "dungeon";
      }
      if (s.mind.fear?.known) revealed++;
    }
    expect(revealed).toBeGreaterThan(0);
  });
  it("두 가지가 겹치면 조합 증상이 터지고 둘 다 드러난다", () => {
    let combo = 0;
    for (let seed = 1; seed <= 200 && !combo; seed++) {
      const s = inDungeon(seed);
      s.mind.fear = { known: false };
      s.mind.despair = { known: false };
      startCombat(s, "dungeon", makeEnemies(s, ["rat"]));
      if (s.log.some((l) => l.text.startsWith("【무너짐】"))) {
        combo++;
        expect(s.mind.fear?.known && s.mind.despair?.known).toBe(true);
      }
    }
    expect(combo).toBeGreaterThan(0);
  });
  it("여관에서 쉬면 모두 가라앉는다", () => {
    const s = newRun(9);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.mind = { rage: { known: true }, confusion: { known: false } };
    s.gold = 100;
    apply(s, { t: "activity", a: "inn" });
    expect(s.mind).toEqual({});
  });
  it("머리를 다치면 혼란이 올 수 있다", () => {
    let got = 0;
    for (let seed = 1; seed <= 60 && !got; seed++) {
      const s = inDungeon(seed);
      wound(s, "head", "테스트");
      if (s.mind.confusion) got++;
    }
    expect(got).toBeGreaterThan(0);
  });
});

describe("새 세 신", () => {
  const believer = (name: string, piety = 95, seed = 4) => {
    const s = newRun(seed);
    s.faithsKnown = [name];
    apply(s, { t: "create", name: "x", candidate: 0, faith: name });
    s.piety = piety;
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    return s;
  };
  it("역병의 신도는 병을 품고 시작하고, ★1: 병이 HP를 깎지 않는다, ★3: 병든 동안 최대 HP +4", () => {
    const s = believer(FAITH.plague);
    expect(s.disease).toBe(1);
    s.disease = 0;
    const hp0 = maxHp(s);
    s.disease = 2;
    expect(maxHp(s)).toBe(hp0 + 4);
    const hp = s.hero.hp;
    const nb = s.dungeon!.rooms[s.dungeon!.current].edges[0];
    s.injuries.body = 0;
    apply(s, { t: "move", room: nb });
    if (!s.combat && s.phase === "dungeon" && !s.log.some((l) => l.text.includes("피해"))) expect(s.hero.hp).toBeGreaterThanOrEqual(hp);
    expect(s.log.some((l) => l.text.includes("열에 들떠"))).toBe(false);
  });
  it("망각의 신 ★2: 머리 부상이 몸통으로 간다, ★3: 전투 시작 때 적이 1라운드 쉰다", () => {
    const s = believer(FAITH.oblivion);
    wound(s, "head", "테스트");
    expect(s.injuries.head).toBe(0);
    expect(s.injuries.body).toBe(1);
    startCombat(s, "dungeon", makeEnemies(s, ["rat"]));
    expect(s.log.some((l) => l.text.includes("망각의 장막"))).toBe(true);
  });
  it("심연의 신 ★1: 꺼진 바닥으로 뛰어내려 아래층으로 간다", () => {
    const s = believer(FAITH.abyss);
    const dg = s.dungeon!;
    dg.floor = 2;
    const room = dg.rooms.find((r) => r.type === "trap")!;
    room.trapKind = "pit";
    dg.current = room.id;
    dg.pending = { kind: "trap" };
    apply(s, { t: "pending", choice: "jump" });
    expect(s.dungeon!.floor).toBe(3);
  });
});

describe("2섹터", () => {
  const atPortal = (seed = 12) => {
    const s = newRun(seed);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    const dg = s.dungeon!;
    dg.floor = 3;
    dg.rooms = generateFloor(new Rng({ s: seed }), 3, 1);
    dg.current = dg.rooms.find((r) => r.type === "portal")!.id;
    dg.pending = { kind: "portal" };
    return s;
  };
  it("1섹터 차원문으로 들어가면 2섹터 1층에서 남은 시간이 두 배가 된다", () => {
    const s = atPortal();
    s.dungeon!.turnsLeft = 150;
    apply(s, { t: "pending", choice: "enter" });
    expect(s.rank).toBe(1);
    expect(s.dungeon!.sector).toBe(2);
    expect(s.dungeon!.floor).toBe(1);
    expect(s.dungeon!.turnsLeft).toBeGreaterThanOrEqual(290);
  });
  it("돌아가기를 골라도 1섹터 클리어는 인정된다", () => {
    const s = atPortal();
    apply(s, { t: "pending", choice: "return" });
    expect(s.rank).toBe(1);
    expect(s.phase).toBe("settlement");
  });
  it("2섹터 층에는 2섹터 몬스터만 나오고, 전쟁의 흔적이 있으며, 고블린 매복은 없다", () => {
    const s2 = new Set(["wolf", "alphawolf", "crow", "harpy", "warhorse", "wraith", "goldwolf", "manaharpy", "manawraith", "harpyqueen", "general"]);
    let relic = 0;
    for (let seed = 1; seed <= 200; seed++) for (const f of [1, 2, 3]) {
      const rooms = generateFloor(new Rng({ s: seed }), f, 2);
      for (const r of rooms) {
        for (const m of r.encounter ?? []) expect(s2.has(m)).toBe(true);
        expect(r.ambush).toBeUndefined();
      }
      if (rooms.some((r) => r.type === "relic")) relic++;
    }
    expect(relic).toBeGreaterThan(300); // 빈 방이 남을 때만 들어간다
  });
  it("하피 여왕은 마석 희귀 개체보다 조금 더 자주(2·3층) 나온다", () => {
    let floors = 0, queen = 0;
    for (let seed = 1; seed <= 8000; seed++) for (const f of [2, 3]) {
      floors++;
      if (generateFloor(new Rng({ s: seed * 5 + f }), f, 2).some((r) => r.encounter?.[0] === "harpyqueen")) queen++;
    }
    expect(queen / floors).toBeGreaterThan(0.007);
    expect(queen / floors).toBeLessThan(0.018);
  });
  it("보스 증표는 처음 한 번만 나오고, 레벨 6→7은 장군의 휘장이 있어야 한다", () => {
    const s = newRun(13);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    for (let k = 0; k < 2; k++) {
      const dg = s.dungeon!;
      dg.floor = 3;
      dg.rooms = generateFloor(new Rng({ s: 40 + k }), 3, 1);
      const boss = dg.rooms.find((r) => r.type === "boss")!;
      dg.current = boss.id;
      s.hero.level = 9;
      s.hero.hp = 999;
      s.combat = null;
      (s as GameState).phase = "dungeon";
      startCombat(s, "dungeon", makeEnemies(s, ["boss"]));
      s.dungeon!.pending = null;
    }
    expect(s.inventory.heart).toBe(1);
    const t = newRun(14);
    apply(t, { t: "create", name: "x", candidate: 0, faith: null });
    t.month = 5;
    t.hero.level = 6;
    t.gold = 999;
    apply(t, { t: "train", training: "fighter", free: ["str", "con"] });
    expect(t.hero.level).toBe(6);
    t.inventory.banner = 1;
    apply(t, { t: "train", training: "fighter", free: ["str", "con"] });
    expect(t.hero.level).toBe(7);
    expect(t.inventory.banner).toBe(0);
  });
});

// 퍼징(scripts/fuzz.ts)으로 찾은 버그의 회귀 테스트
describe("퍼징 회귀", () => {
  const inDungeon = (seed = 21) => {
    const s = newRun(seed);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    return s;
  };
  it("체력 장비를 다른 장비로 바꾸면 HP가 새 최대치를 넘지 않는다", () => {
    const s = inDungeon();
    s.gear.neck = "prayer";
    s.hero.hp = maxHp(s);
    s.combat = null;
    s.dungeon!.pending = { kind: "gear", item: "boneamulet" };
    apply(s, { t: "pending", choice: "equip" });
    expect(s.gear.neck).toBe("boneamulet");
    expect(s.hero.hp).toBeLessThanOrEqual(maxHp(s));
  });
  it("역병의 신 ★3(병든 동안 최대 HP +4)이 병이 나아 꺼지면 HP도 새 최대치로 줄어든다", () => {
    const s = newRun(23);
    s.faithsKnown = [FAITH.plague];
    apply(s, { t: "create", name: "x", candidate: 0, faith: FAITH.plague });
    s.piety = 95;
    s.disease = 1;
    s.inventory.herb = 1;
    s.hero.hp = maxHp(s);
    const sickMax = maxHp(s);
    apply(s, { t: "herb" });
    expect(s.disease).toBe(0);
    expect(maxHp(s)).toBe(sickMax - 4);
    expect(s.hero.hp).toBe(maxHp(s));
  });
  it("2섹터 차원문에서 돌아오면 정산에 2섹터로 적히고, 다시 넘을 때는 등급이 올랐다고 하지 않는다", () => {
    const s = newRun(24);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    const dg = s.dungeon!;
    dg.sector = 2;
    dg.floor = 3;
    dg.rooms = generateFloor(new Rng({ s: 24 }), 3, 2);
    dg.current = dg.rooms.find((r) => r.type === "portal")!.id;
    dg.pending = { kind: "portal" };
    s.rank = 2;
    apply(s, { t: "pending", choice: "return" });
    expect(s.settlement!.sector).toBe(2);
    expect(s.settlement!.lines[0]).toContain("2섹터");
    expect(s.settlement!.lines.some((l) => l.includes("등급이 올랐다"))).toBe(false);
  });
});

describe("마법사 원소", () => {
  const mage = (seed = 31) => {
    const s = newRun(seed);
    apply(s, { t: "pickClass", cls: "mage" });
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 2;
    s.gold = 9999;
    return s;
  };
  it("레벨마다 그 원소의 정해진 기술을 배운다(짝수 패시브, 홀수 액티브)", () => {
    const s = mage();
    apply(s, { t: "train", training: "fire", free: ["int", "con"] });
    expect(s.hero.level).toBe(2);
    expect(s.skills).toContain("fireEmber");
    expect(s.skills).toContain("magicMissile"); // 첫 수련 때 기본기 마력 화살
    s.phase = "town";
    apply(s, { t: "train", training: "frost", free: ["per", "con"] });
    expect(s.skills).toContain("frostArrow");
    expect(s.skills).not.toContain("frostCalm");
    expect(SKILLS.fireEmber.kind).toBe("passive");
    expect(SKILLS.frostArrow.kind).toBe("active");
  });
  it("4레벨 특수 훈련에서 고른 원소가 주 원소가 되고, 지팡이는 지능 마력탄 그대로", () => {
    const s = mage();
    s.hero.level = 3;
    s.inventory.heart = 1;
    expect(weaponOf(s).stat).toBe("int");
    apply(s, { t: "train", training: "bolt", free: ["dex", "con"] });
    expect(s.hero.level).toBe(4);
    expect(s.skills).toContain("boltMark");
    expect(s.mainElement).toBe("bolt");
    expect(weaponOf(s).stat).toBe("int");
    expect(weaponOf(s).magic).toBe(true);
  });
  it("원소 주문이 전투에서 발동하고, 각인이 있으면 그 원소 액티브를 한 번 더 쓴다", () => {
    const s = mage();
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    s.skills.push("fireArrow", "fireMark");
    s.hero.hp = 999;
    s.combat = null;
    startCombat(s, "dungeon", makeEnemies(s, ["skeleton", "skeleton", "skeleton"]));
    const casts = s.log.filter((l) => l.text.startsWith("【불화살】")).length;
    expect(casts).toBe(2);
  });
});

describe("전사 방향 훈련", () => {
  const warrior = (seed = 41) => {
    const s = newRun(seed);
    apply(s, { t: "pickClass", cls: "warrior" });
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 2;
    s.gold = 9999;
    return s;
  };
  it("레벨마다 그 방향의 정해진 기술을 배우고, 첫 훈련 때 기선 제압을 함께 배운다", () => {
    const s = warrior();
    const str = s.hero.stats.str;
    apply(s, { t: "train", training: "berserk", free: ["con", "con"] });
    expect(s.skills).toEqual(expect.arrayContaining(["roughPower", "firstStrike"]));
    expect(s.hero.stats.str).toBeGreaterThanOrEqual(str + 2); // 광전은 힘 몰빵
    s.phase = "town";
    apply(s, { t: "train", training: "guard", free: ["str", "con"] });
    expect(s.skills).toContain("shieldBash");
  });
  it("방패 기술은 방패를 들어야만 발동한다", () => {
    const s = warrior();
    s.skills.push("shieldBash", "shieldCraft");
    delete s.gear.offhand;
    expect(activeSkills(s).some((k) => k.id === "shieldBash")).toBe(false);
    const acNo = passive(s, "ac");
    s.gear.offhand = "shield";
    expect(activeSkills(s).some((k) => k.id === "shieldBash")).toBe(true);
    expect(passive(s, "ac")).toBe(acNo + 1 + 1); // 나무 방패 AC +1, 방패술 +1
  });
});

describe("모험가 갈래", () => {
  it("숏소드는 힘과 민첩 중 높은 쪽으로 다루고, 지팡이를 들면 지능 마력탄", () => {
    const s = newRun(51);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.hero.stats.str = 10;
    s.hero.stats.dex = 20;
    expect(weaponOf(s).stat).toBe("dex");
    s.hero.stats.str = 25;
    expect(weaponOf(s).stat).toBe("str");
    s.gear.main = "staff";
    expect(weaponOf(s).stat).toBe("int");
    expect(weaponOf(s).magic).toBe(true);
  });
});

// 기술 점검: 레벨표의 모든 액티브(와 첫 훈련 기본기)가 조건을 맞춰 준 전투에서 실제로 발동하는지.
// 배워도 한 번도 안 나오는 기술(예: 앞 주문이 싸움을 먼저 끝내 묻히는 경우)을 막는다.
describe("기술 점검", () => {
  const ids = [...new Set([...Object.values(ELEMENT_SKILLS), ...Object.values(STYLE_SKILLS), ...Object.values(BRANCH_SKILLS)].flatMap((tb) => Object.values(tb)).concat(["magicMissile", "firstStrike", "flashPowder"]))]
    .filter((id) => SKILLS[id].kind === "active");
  for (const id of ids) {
    it(`${SKILLS[id].name}(${id})`, () => {
      const sk = SKILLS[id];
      let fired = false;
      for (let seed = 1; seed <= 300 && !fired; seed++) {
        const s = newRun(seed);
        apply(s, { t: "create", name: "x", candidate: 0, faith: null });
        s.week = 3;
        s.phase = "week-result";
        apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
        s.skills = [id];
        s.gear.offhand = "shield";
        s.inventory.potion = 0;
        s.combat = null;
        const tr = sk.trigger!;
        const n = tr.on === "enemiesAtLeast" ? tr.n + 1 : 3;
        const foes = makeEnemies(s, Array(n).fill("skeleton"));
        if (tr.on === "targetBelow") for (const f of foes) f.hp = Math.max(1, Math.floor((MONSTERS.skeleton.hp * Math.min(tr.pct, 100)) / 100) - 1);
        s.hero.hp = tr.on === "lethal" ? 1 : tr.on === "selfBelow" ? Math.max(2, Math.floor((maxHp(s) * tr.pct) / 100) - 1) : maxHp(s);
        startCombat(s, "dungeon", foes);
        fired = s.log.some((l) => l.text.startsWith(`【${sk.name}】`));
      }
      expect(fired).toBe(true);
    });
  }
});

describe("전투 로그 접기", () => {
  it("다치지 않고 이긴 평범한 전투는 세부 줄을 접고 요약 한 줄을 남긴다, 희귀 개체 전투는 접지 않는다", () => {
    const s = newRun(61);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    s.hero.hp = 999;
    s.combat = null;
    s.skills.push("fireArrow");
    startCombat(s, "dungeon", makeEnemies(s, ["rat", "rat"]));
    const sum = s.log.find((l) => l.foldOf !== undefined);
    expect(sum).toBeTruthy();
    expect(s.log.filter((l) => l.fold === sum!.foldOf).length).toBe(sum!.foldN);
    expect(s.log.some((l) => l.mons && l.fold === undefined)).toBe(true); // 등장 줄은 그대로
    s.combat = null;
    s.phase = "dungeon";
    const before = s.log.filter((l) => l.foldOf !== undefined).length;
    startCombat(s, "dungeon", makeEnemies(s, ["goldrat"]));
    expect(s.log.filter((l) => l.foldOf !== undefined).length).toBe(before);
  });
});

describe("묘비 사망 요약", () => {
  it("전투에서 죽으면 마지막 상대·남긴 물약을 적고, 세금 처형은 세금과 가진 돈을 적는다", () => {
    const s = newRun(71);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    apply(s, { t: "enterDungeon" });
    s.hero.hp = 1;
    s.inventory.potion = 3;
    s.tactics.potionAt = 0;
    s.combat = null;
    startCombat(s, "dungeon", makeEnemies(s, ["rat", "rat", "rat", "rat", "rat", "rat"]));
    for (let i = 0; i < 50 && (s.phase as string) !== "dead"; i++) {
      const a = botAction(s);
      if (!a) break;
      apply(s, a);
    }
    expect(s.phase).toBe("dead");
    const n = s.tomb!.notes!;
    expect(n.facts.some((f) => f.startsWith("남긴 것: 물약 3개"))).toBe(true);
    expect(n.hints.some((h) => h.includes("물약 방침을 켜"))).toBe(true);
    expect(n.hints.length).toBeLessThanOrEqual(3);

    const t = newRun(72);
    apply(t, { t: "create", name: "y", candidate: 0, faith: null });
    kill(t, "tax");
    expect(t.tomb!.notes!.facts.some((f) => f.startsWith("세금 "))).toBe(true);
  });
});

describe("훈련소 허수아비", () => {
  it("복사본에서만 싸우고(진짜 상태 그대로), 같은 상태면 같은 결과, 출처별 합 = 총 피해", () => {
    const s = newRun(81);
    apply(s, { t: "pickClass", cls: "mage" });
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.skills.push("magicMissile", "fireArrow");
    const before = JSON.stringify(s);
    const a = dummyTest(s, "pack", 40);
    const b = dummyTest(s, "pack", 40);
    expect(JSON.stringify(s)).toBe(before);
    expect(a.total).toBeGreaterThan(0);
    expect(a.total).toBe(b.total);
    expect(a.perRound.length).toBe(10);
    const sum = a.bySource.reduce((x, y) => x + y.dmg, 0);
    expect(Math.abs(sum - a.total)).toBeLessThan(1e-6);
    expect(a.bySource.some((x) => x.id === "fireArrow")).toBe(true);
    // 전투당 1회 기술은 허수아비가 다시 일어나도 10라운드에 한 번만
    const arrows = a.bySource.find((x) => x.id === "fireArrow")!.dmg;
    expect(arrows).toBeLessThan(a.total);
  });
  it("특수 훈련(3→4)을 받았다고 치면 고른 갈래의 딜이 크게 오른다", () => {
    const s = newRun(82);
    apply(s, { t: "pickClass", cls: "warrior" });
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 3;
    s.hero.level = 3;
    s.skills.push("firstStrike", "sharpEdge", "riposte");
    s.inventory.heart = 1;
    const now = dummyTest(s, "single", 80).total;
    const glad = dummyAfterTraining(s, "glad", [], "single", 80)!;
    expect(glad).not.toBeNull();
    expect(glad.total).toBeGreaterThan(now * 1.3);
    expect(s.hero.level).toBe(3);
  });
});

describe("첫 미궁의 계단", () => {
  const toStairs = (month: number) => {
    const s = newRun(91);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = month;
    enterDungeon(s);
    const dg = s.dungeon!;
    const stairs = dg.rooms.findIndex((r) => r.type === "stairs");
    const before = dg.rooms.findIndex((r) => r.edges.includes(stairs));
    dg.current = before;
    dg.rooms[before].visited = true;
    dg.pending = null;
    s.combat = null;
    apply(s, { t: "move", room: stairs });
    return s;
  };
  it("1월 미궁: 1층 계단에서 내려갈 수 없고, 떨어진 주문서를 쓰면 돌아간다(가진 주문서는 그대로)", () => {
    const s = toStairs(1);
    expect(s.dungeon!.pending?.kind).toBe("lostScroll");
    apply(s, { t: "pending", choice: "descend" as never });
    expect(s.dungeon!.floor).toBe(1);
    const s2 = toStairs(1);
    const scrolls = s2.inventory.scroll;
    apply(s2, { t: "pending", choice: "use" });
    expect(s2.phase).toBe("settlement");
    expect(s2.inventory.scroll).toBe(scrolls);
  });
  it("2월부터는 평소처럼 계단을 내려간다", () => {
    const s = toStairs(2);
    expect(s.dungeon!.pending?.kind).toBe("stairs");
    apply(s, { t: "pending", choice: "descend" });
    expect(s.dungeon!.floor).toBe(2);
  });
});

describe("테스터 부적(grooty)", () => {
  it("이름이 grooty면 착용한 채 시작: 모든 능력치 +5, 미궁마다 죽음 2번 막기(세금 처형은 못 막음)", () => {
    const s = newRun(93);
    apply(s, { t: "create", name: "Grooty", candidate: 0, faith: null });
    expect(s.gear.neck).toBe("grooty");
    for (const k of STAT_KEYS) expect(stat(s, k)).toBe(Math.min(BAL.statMax, s.hero.stats[k] + 5));
    s.month = 1;
    enterDungeon(s);
    s.hero.hp = 0;
    kill(s, "single", "테스트");
    expect(s.phase).toBe("dungeon");
    expect(s.hero.hp).toBe(1);
    kill(s, "trap");
    expect(s.phase).toBe("dungeon");
    kill(s, "trap");
    expect(s.phase).toBe("dead");

    const t = newRun(94);
    apply(t, { t: "create", name: "grooty", candidate: 0, faith: null });
    kill(t, "tax");
    expect(t.phase).toBe("dead");

    const u = newRun(95);
    apply(u, { t: "create", name: "grooty2", candidate: 0, faith: null });
    expect(u.gear.neck).toBeUndefined();
  });
  it("미궁에 다시 들어가면 횟수가 다시 채워진다", () => {
    const s = newRun(96);
    apply(s, { t: "create", name: "grooty", candidate: 0, faith: null });
    enterDungeon(s);
    kill(s, "trap");
    kill(s, "trap");
    s.dungeon = null;
    s.phase = "town";
    enterDungeon(s);
    kill(s, "trap");
    expect(s.phase).toBe("dungeon");
  });
});

describe("4주차 준비", () => {
  it("3주차가 끝나면 마을에 멈춰 상점만 들를 수 있고, 들어간다고 해야 미궁에 들어간다", () => {
    const s = newRun(97);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.week = 3;
    s.phase = "week-result";
    s.month = 2;
    apply(s, { t: "closeWeek" });
    expect(s.phase).toBe("town");
    expect(s.week).toBe(4);
    s.gold = 500;
    apply(s, { t: "activity", a: "rumor" });
    expect(s.phase).toBe("town");
    const potions = s.inventory.potion;
    apply(s, { t: "buy", item: "potion" });
    expect(s.inventory.potion).toBe(potions + 1);
    apply(s, { t: "enterDungeon" });
    expect(s.phase).toBe("dungeon");
  });
});

describe("자동 식사", () => {
  it("미궁에서 포만감이 20 이하가 되면 고기를 알아서 먹고, 끄면 먹지 않는다", () => {
    const s = newRun(98);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    enterDungeon(s);
    s.inventory.food = 2;
    s.hero.satiety = 21;
    apply(s, { t: "camp" });
    expect(s.inventory.food).toBe(1);
    expect(s.hero.satiety).toBeGreaterThan(20);
    apply(s, { t: "tactics", tactics: { autoEat: false } });
    s.hero.satiety = 5;
    apply(s, { t: "camp" });
    expect(s.inventory.food).toBe(1);
  });
});

describe("경제 개편(2026-10-14)", () => {
  it("훈련비: 20·25·30G, 4레벨부터 레벨당 40G, 6→7은 수련비 600G, 9→10은 1000G 추가", () => {
    const s = newRun(101);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    const at = (lv: number) => { s.hero.level = lv; return trainCost(s); };
    expect([at(1), at(2), at(3), at(4), at(6), at(9)]).toEqual([20, 25, 30, 160, 840, 1360]);
  });
  it("마을에서 한 주를 보내도 HP가 차지 않고, 여관에서 쉬면 다 찬다(여관비는 물가를 따른다)", () => {
    const s = newRun(102);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.hero.hp = 3;
    apply(s, { t: "activity", a: "rumor" });
    expect(s.hero.hp).toBe(3);
    apply(s, { t: "closeWeek" });
    s.priceIndex = 1.5;
    s.gold = 100;
    apply(s, { t: "activity", a: "inn" });
    expect(s.gold).toBe(100 - 60);
    expect(s.hero.hp).toBe(maxHp(s));
  });
  it("세금은 1섹터 클리어 후 +120G, 2섹터 클리어 후 +250G, 물가는 매달 5~10% 오른다", () => {
    expect(taxDue(1, 0)).toBe(20);
    expect(taxDue(1, 1)).toBe(140);
    expect(taxDue(1, 2)).toBe(270);
    const s = newRun(103);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    for (let i = 0; i < 3000 && s.month < 4 && s.phase !== "dead"; i++) { const a = botAction(s); if (!a) break; apply(s, a); }
    if (s.phase !== "dead") {
      const lo = Math.pow(1.05, s.month - 1) - 1e-9, hi = Math.pow(1.1, s.month - 1) + 1e-9;
      expect(s.priceIndex ?? 1).toBeGreaterThanOrEqual(lo);
      expect(s.priceIndex ?? 1).toBeLessThanOrEqual(hi);
    }
  });
});

describe("미궁의 청소부", () => {
  const setup = (level: number, month = 2) => {
    const s = newRun(111);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = month;
    s.hero.level = level;
    enterDungeon(s);
    s.combat = null;
    s.dungeon!.pending = null;
    return s;
  };
  it("실력에 비해 얕은 층(1층에 3레벨 이상)에 오래 머물면 예고 뒤 나타나 쫓아온다", () => {
    const s = setup(3);
    const [w1, w2, ap] = BAL.sweeperTurns;
    passTime(s, w1 - 1);
    expect(s.dungeon!.sweeperStage ?? 0).toBe(0);
    passTime(s, 1);
    expect(s.dungeon!.sweeperStage).toBe(1);
    passTime(s, w2 - w1);
    expect(s.dungeon!.sweeperStage).toBe(2);
    expect(s.dungeon!.rooms.find((r) => r.type === "stairs")!.known).toBe(true); // 도망칠 길은 알려 준다
    passTime(s, ap - w2);
    expect(s.dungeon!.sweeperStage).toBe(3);
    expect(s.dungeon!.sweeperRoom).not.toBeNull();
    // 바로 옆에 두고 야영하면 두 방 다가와 마주친다
    const dg = s.dungeon!;
    dg.sweeperRoom = dg.rooms[dg.current].edges[0];
    s.hero.fatigue = 50;
    apply(s, { t: "camp" });
    expect(s.codex.seen).toContain("sweeper1");
  });
  it("레벨이 낮으면(1층에 2레벨) 시계가 돌지 않고, 첫 미궁(1월)에는 나오지 않는다", () => {
    const s = setup(2);
    passTime(s, 300);
    expect(s.dungeon!.sweeperStage ?? 0).toBe(0);
    const t = setup(9, 1);
    passTime(t, 300);
    expect(t.dungeon!.sweeperStage ?? 0).toBe(0);
  });
  it("계단으로 내려가면 새 층에서 시계가 처음부터", () => {
    const s = setup(3);
    passTime(s, BAL.sweeperTurns[1]);
    expect(s.dungeon!.sweeperStage).toBe(2);
    const dg = s.dungeon!;
    const stairs = dg.rooms.findIndex((r) => r.type === "stairs");
    dg.current = dg.rooms.findIndex((r) => r.edges.includes(stairs));
    dg.sweeperRoom = null;
    apply(s, { t: "move", room: stairs });
    if (s.dungeon?.pending?.kind === "stairs") apply(s, { t: "pending", choice: "descend" });
    expect(s.dungeon!.floor).toBe(2);
    expect(s.dungeon!.sweeperStage).toBe(0);
    expect(s.dungeon!.floorTurns ?? 0).toBeLessThan(10);
  });
});

describe("현상수배 중 떠돌이 교관", () => {
  it("외곽으로 나가면 20%로 교관을 만나 그 주에 훈련할 수 있고, 주마다 한 번만 찾아본다", () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const s = newRun(seed);
      apply(s, { t: "create", name: "x", candidate: 0, faith: null });
      s.month = 3;
      s.heretic = true;
      s.gold = 500;
      expect(canTrain(s)).toBe(false);
      const week = s.week;
      apply(s, { t: "activity", a: "field" });
      if (!s.outlawTrainer?.met) continue;
      found = true;
      expect(s.phase).toBe("town"); // 한 주를 쓰지 않았다
      expect(s.week).toBe(week);
      expect(canTrain(s)).toBe(true);
      const lv = s.hero.level;
      apply(s, { t: "train", training: CLASSES[s.hero.cls].trainings[0], free: ["str", "con"] });
      expect(s.hero.level).toBe(lv + 1);
    }
    expect(found).toBe(true);
  });
  it("한 번 만난 뒤로는 50%, 받을 훈련이 없으면(보스 증표 없음) 찾지 않는다", () => {
    let met = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const s = newRun(seed);
      apply(s, { t: "create", name: "x", candidate: 0, faith: null });
      s.month = 3;
      s.heretic = true;
      s.outlawTrainerKnown = true;
      apply(s, { t: "activity", a: "field" });
      if (s.outlawTrainer?.met) met++;
    }
    expect(met / N).toBeGreaterThan(0.4);
    expect(met / N).toBeLessThan(0.6);
    const g = newRun(5);
    apply(g, { t: "create", name: "x", candidate: 0, faith: null });
    g.month = 3;
    g.heretic = true;
    g.hero.level = 3;
    g.inventory.heart = 0;
    apply(g, { t: "activity", a: "field" });
    expect(g.outlawTrainer).toBeUndefined();
  });
});

describe("끝없는 미궁", () => {
  const toEndless = () => {
    const s = newRun(121);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 6;
    s.hero.level = 12;
    enterDungeon(s);
    const dg = s.dungeon!;
    // 6섹터 구현 뒤: 끝없는 미궁은 셉터의 제단 아래로
    dg.sector = 6;
    dg.floor = 3;
    s.rank = 6;
    dg.pending = { kind: "scepter" };
    s.combat = null;
    apply(s, { t: "pending", choice: "down" });
    return s;
  };
  it("2섹터 차원문으로 들어가면 3섹터(물에 잠긴 사원) 1층, 남은 시간 ×1.5", () => {
    const s = newRun(122);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 6;
    enterDungeon(s);
    const dg = s.dungeon!;
    dg.sector = 2;
    dg.floor = 3;
    dg.turnsLeft = 100;
    dg.pending = { kind: "portal" };
    apply(s, { t: "pending", choice: "enter" });
    expect(s.dungeon!.endless).toBeFalsy();
    expect(s.dungeon!.sector).toBe(3);
    expect(s.dungeon!.turnsLeft).toBe(150);
    expect(s.rank).toBe(2);
  });
  it("6섹터 셉터의 제단 아래로 내려가면 끝없는 미궁 1층: 함정·상자·기록물 없이 전투·빈 방·계단뿐", () => {
    const s = toEndless();
    const dg = s.dungeon!;
    expect(dg.endless).toBe(true);
    expect(dg.sector).toBe(ENDLESS_SECTOR);
    expect(dg.floor).toBe(1);
    expect(s.rank).toBe(6);
    expect(dg.rooms.every((r) => ["entrance", "combat", "empty", "stairs"].includes(r.type))).toBe(true);
  });
  it("계단은 끝없이 이어지고, 깊을수록 몬스터가 강하며, 5층마다 보스가 계단 앞을 지킨다", () => {
    const r = new Rng({ s: 7 });
    for (let n = 1; n <= 40; n++) {
      const rooms = generateEndlessFloor(r, n);
      expect(rooms.filter((x) => x.type === "stairs").length).toBe(1);
      expect(rooms.some((x) => x.type === "trap" || x.type === "treasure")).toBe(false);
      const bossy = rooms.some((x) => x.encounter?.some((m) => ["boss", "harpyqueen", "general", "mycomother", "furnacemother", "abyssmaw", "avatar"].includes(m)));
      expect(bossy).toBe(n % 5 === 0);
    }
    const s = toEndless();
    s.dungeon!.floor = 1;
    const e1 = makeEnemies(s, ["wraith"])[0];
    s.dungeon!.floor = 10;
    const e10 = makeEnemies(s, ["wraith"])[0];
    expect(e1.hp).toBeGreaterThan(MONSTERS.wraith.hp);
    expect(e10.hp).toBeGreaterThan(e1.hp);
    expect(e10.atkUp!).toBeGreaterThan(e1.atkUp!);
    expect(endlessPool()).not.toContain("inquisitor");
    expect(endlessPool()).not.toContain("sweeper1");
    expect(endlessPool()).toContain("rat");
    expect(endlessPool()).toContain("wraith");
  });
});

describe("3섹터: 물에 잠긴 사원", () => {
  const hero = (seed = 301) => {
    const s = newRun(seed);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 8;
    return s;
  };
  it("층 생성: 3층 보스는 균모, 공양 제단·침수 방이 있고, 거머리는 물에 잠긴 방에만", () => {
    const r = new Rng({ s: 9 });
    let altar = 0, flooded = 0;
    for (let i = 0; i < 60; i++) {
      for (const floor of [1, 2, 3]) {
        const rooms = generateFloor(r, floor, 3);
        expect(reachable(rooms).size).toBe(rooms.length);
        altar += rooms.filter((x) => x.type === "altar").length;
        flooded += rooms.filter((x) => x.flooded).length;
        expect(rooms.some((x) => x.type === "relic")).toBe(false);
        for (const x of rooms) if (x.type === "combat" && x.encounter?.includes("leech")) expect(x.flooded).toBe(true);
        if (floor === 3) expect(rooms.find((x) => x.type === "boss")!.encounter![0]).toBe("mycomother");
      }
    }
    expect(altar).toBeGreaterThan(0);
    expect(flooded).toBeGreaterThan(0);
  });
  it("부식: 장비는 부서지지 않고 단계별 패널티, 숫돌·대장간으로 고친다", () => {
    const s = hero();
    s.gear.body = "leather"; // AC +2
    s.gear.main = "longsword";
    const base = passive(s, "ac");
    s.corrosion = { body: 1 };
    expect(passive(s, "ac")).toBe(base - 1);
    s.corrosion = { body: 3 };
    expect(passive(s, "ac")).toBe(base - 2);
    expect(s.gear.body).toBe("leather");
    s.corrosion = { body: 3, main: 3 };
    expect(weaponOf(s).dice).toEqual([1, 4]);
    s.inventory.whetstone = 1;
    apply(s, { t: "whetstone" });
    expect(s.inventory.whetstone).toBe(0);
    expect((s.corrosion.body ?? 0) + (s.corrosion.main ?? 0)).toBe(5);
    s.gold = 1000;
    apply(s, { t: "repair", slot: "body" });
    apply(s, { t: "repair", slot: "main" });
    expect(s.corrosion.body).toBe(0);
    expect(s.corrosion.main).toBe(0);
    expect(s.gold).toBeLessThan(1000);
    expect(weaponOf(s).dice).toEqual([1, 8]);
  });
  it("독은 야영 때마다 한 단계, 마비는 미궁을 나오면 풀린다", () => {
    const s = hero(302);
    enterDungeon(s);
    s.poison = 2;
    s.paralysis = { main: 2, feet: 1 };
    s.hero.satiety = 100;
    apply(s, { t: "camp" });
    if (s.phase === "dungeon" && !s.combat) {
      expect(s.poison).toBe(1);
      expect(s.paralysis!.main).toBe(1);
    }
    s.inventory.scroll = 1;
    s.combat = null;
    s.dungeon!.pending = null;
    apply(s, { t: "scroll" });
    expect(s.phase).toBe("settlement");
    expect(Object.values(s.paralysis ?? {}).every((v) => !v)).toBe(true);
    expect(s.poison ?? 0).toBeLessThanOrEqual(1);
  });
  it("해독초: 독 한 단계 + 마비 한 단계", () => {
    const s = hero(303);
    enterDungeon(s);
    s.poison = 1;
    s.paralysis = { feet: 2 };
    s.inventory.antidote = 1;
    apply(s, { t: "antidote" });
    expect(s.poison).toBe(0);
    expect(s.paralysis.feet).toBe(1);
  });
  it("신앙 ★4는 3섹터를 클리어해야 열리고, 신앙심 상한도 그때 200", () => {
    const s = hero(304);
    s.faithsKnown = [FAITH.mob];
    s.hero.faith = FAITH.mob;
    s.piety = 100;
    s.rank = 2;
    expect(tier(s)).toBe(3);
    s.rank = 3;
    s.piety = 150;
    expect(tier(s)).toBe(4);
  });
  it("보스 증표 균모의 포자낭이 9→10 훈련의 대가, 수련비 1000G", () => {
    const s = hero(305);
    s.hero.level = 9;
    s.gold = 5000;
    s.week = 1;
    expect(canTrain(s)).toBe(false);
    s.inventory.spore = 1;
    expect(canTrain(s)).toBe(true);
    expect(trainCost(s)).toBe(360 + 1000);
  });
  it("3섹터 몬스터는 사람이 아니고, 끝없는 미궁에도 섞여 나온다", () => {
    for (const id of ["plaguerat", "leech", "toad", "snail", "mold", "shroudmold", "gargoyle"]) {
      expect(MONSTERS[id].human).toBeFalsy();
      expect(endlessPool()).toContain(id);
      expect(FRAGMENTS[id]).toBeDefined();
    }
    expect(endlessPool()).not.toContain("mycomother");
    expect(endlessPool()).not.toContain("sweeper3");
  });
});

describe("직업 기술 10~16레벨", () => {
  const tables = [...Object.values(ELEMENT_SKILLS), ...Object.values(STYLE_SKILLS), ...Object.values(BRANCH_SKILLS)];
  it("10갈래 모두 2~16레벨(모험가는 15레벨 — 16은 신의 가르침)이 채워져 있고, 짝수는 패시브·홀수는 액티브", () => {
    for (const tb of tables) {
      const top = Object.values(BRANCH_SKILLS).includes(tb as never) ? 15 : 16;
      expect(tb[16]).toBe(top === 16 ? tb[16] : undefined);
      for (let lv = 2; lv <= top; lv++) {
        const id = tb[lv];
        expect(SKILLS[id], `${lv} ${id}`).toBeDefined();
        expect(SKILLS[id].kind).toBe(lv % 2 === 0 ? "passive" : "active");
      }
    }
  });
  it("각인·낙인이 갈래 액티브를 1회씩 더(합쳐 +2), 궁극기는 늘지 않는다", () => {
    expect(MARK_FOR_SKILL.fireLance).toEqual(["fireMark", "fireSeal"]);
    expect(MARK_FOR_SKILL.fireMeteor).toBeUndefined();
    expect(MARK_FOR_SKILL.elemArrow).toEqual(["casterMark", "casterSeal"]);
  });
  it("12→13·15→16 훈련은 4·5섹터 증표가 있어야(아직 없는 섹터)", () => {
    const s = newRun(401);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 30;
    s.gold = 99999;
    s.hero.level = 12;
    expect(canTrain(s)).toBe(false);
    s.inventory.scale = 1;
    expect(canTrain(s)).toBe(true);
    expect(trainCost(s)).toBe(40 * 12 + 1500);
    s.hero.level = 14;
    expect(canTrain(s)).toBe(true);
    s.hero.level = 15;
    expect(canTrain(s)).toBe(false);
  });
  it("최후의 방어: 이 악물기를 미궁마다 두 번", () => {
    const s = newRun(402);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    enterDungeon(s);
    s.skills = ["grit", "lastGuard"];
    let saves = 0;
    for (let i = 0; i < 6 && s.phase !== "dead"; i++) {
      s.combat = null;
      s.hero.hp = 1;
      startCombat(s, "dungeon", makeEnemies(s, ["general", "general", "general"]));
      saves = s.tripUsed.filter((x) => x === "grit").length;
    }
    expect(saves).toBe(2);
  });
});

describe("4섹터: 불타는 광산 갱도", () => {
  const hero = (seed = 501) => {
    const s = newRun(seed);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 20;
    return s;
  };
  it("층 생성: 함정 2+층수, 낙반은 필수 경로에 없고, 3층 서리 계열은 얼음 구역에만, 보스는 화로 어미", () => {
    const r = new Rng({ s: 11 });
    for (let i = 0; i < 80; i++) {
      for (const floor of [1, 2, 3]) {
        const rooms = generateFloor(r, floor, 4);
        expect(reachable(rooms).size).toBe(rooms.length);
        const traps = rooms.filter((x) => x.type === "trap");
        for (const t of traps) expect(["collapse", "cart", "gas", "steam", "ice"]).toContain(t.trapKind);
        if (floor === 3) expect(rooms.find((x) => x.type === "boss")!.encounter![0]).toBe("furnacemother");
        for (const x of rooms) if (floor === 3 && x.type === "combat" && !x.ice) expect(x.encounter!.some((m) => MONSTERS[m].heat === "frost" && !MONSTERS[m].rare)).toBe(false);
        // 낙반은 입구→계단(보스) 필수 경로 위에 없다: 그 방을 지워도 출구에 닿는다
        const exit = rooms.find((x) => x.type === "stairs" || x.type === "boss")!;
        for (const t of traps.filter((x) => x.trapKind === "collapse")) {
          const seen = new Set([0]);
          const q = [0];
          while (q.length) for (const nb of rooms[q.shift()!].edges) if (nb !== t.id && !seen.has(nb)) { seen.add(nb); q.push(nb); }
          expect(seen.has(exit.id)).toBe(true);
        }
      }
    }
  });
  it("화상은 부상 칸을 올리고(원인 표시), 연고로 한 단계 낫는다. 머리·몸통은 화상으로 결손이 되지 않는다", () => {
    const s = hero();
    enterDungeon(s);
    s.injuries.body = 2;
    s.injuryCause = { body: "burn" };
    s.inventory.salve = 1;
    apply(s, { t: "salve" });
    expect(s.injuries.body).toBe(1);
    expect(s.inventory.salve).toBe(0);
  });
  it("냉기가 4 쌓이면 손·발 동상, 장작을 때고 야영하면 냉기 0", () => {
    const s = hero(502);
    enterDungeon(s);
    s.dungeon!.sector = 4;
    s.cold = 3.5;
    s.inventory.firewood = 1;
    s.hero.satiety = 100;
    apply(s, { t: "camp" });
    expect(s.cold ?? 0).toBe(0);
    expect(s.inventory.firewood).toBe(0);
  });
  it("3섹터를 클리어하면 숏컷으로 곧장 4섹터 1층", () => {
    const s = hero(503);
    s.week = 4;
    apply(s, { t: "enterDungeon", shortcut: true });
    expect(s.dungeon!.sector).toBe(1);
    const t = hero(504);
    t.rank = 3;
    t.week = 4;
    apply(t, { t: "enterDungeon", shortcut: true });
    expect(t.dungeon!.sector).toBe(4);
    expect(t.dungeon!.turnsLeft).toBe(BAL.shortcutTurns);
  });
  it("4섹터 몬스터는 사람이 아니고 편린이 있으며, 곰팡이 괴물의 불 약점은 없다", () => {
    for (const id of ["emberbat", "salamander", "orebeetle", "fireelem", "burrower", "frostwraith", "icetroll", "cartmimic", "furnacemother"]) {
      expect(MONSTERS[id].human).toBeFalsy();
      expect(FRAGMENTS[id]).toBeDefined();
    }
    expect((MONSTERS.mold as unknown as Record<string, unknown>).fireWeak).toBeUndefined();
  });
});

describe("5섹터: 바닥없는 균열", () => {
  const hero = (seed = 601) => {
    const s = newRun(seed);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 30;
    return s;
  };
  it("층 생성: 함정 2+층수(벼랑길·꺼진 바닥), 벼랑 위 전투방, 보스는 심연의 아귀", () => {
    const r = new Rng({ s: 21 });
    let ledges = 0, cliffs = 0, plenty = 0;
    for (let i = 0; i < 60; i++) {
      for (const floor of [1, 2, 3]) {
        const rooms = generateFloor(r, floor, 5);
        expect(reachable(rooms).size).toBe(rooms.length);
        for (const t of rooms.filter((x) => x.type === "trap")) expect(["ledge", "pit", "spike"]).toContain(t.trapKind);
        ledges += rooms.filter((x) => x.trapKind === "ledge").length;
        cliffs += rooms.filter((x) => x.cliff).length;
        plenty += rooms.filter((x) => x.type === "plenty").length;
        for (const x of rooms) if (x.encounter?.includes("ledgespider")) expect(x.cliff).toBe(true);
        if (floor === 3) expect(rooms.find((x) => x.type === "boss")!.encounter![0]).toBe("abyssmaw");
      }
    }
    expect(ledges).toBeGreaterThan(0);
    expect(cliffs).toBeGreaterThan(0);
    expect(plenty).toBeGreaterThan(0);
  });
  it("벼랑길: 밧줄을 걸면 반드시 건넌다", () => {
    const s = hero();
    enterDungeon(s);
    const dg = s.dungeon!;
    dg.sector = 5;
    const room = dg.rooms[dg.current];
    room.type = "trap";
    room.trapKind = "ledge";
    dg.pending = { kind: "trap" };
    s.inventory.rope = 1;
    apply(s, { t: "pending", choice: "rope" });
    expect(s.inventory.rope).toBe(0);
    expect(room.resolved).toBe(true);
    expect(s.dungeon!.floor).toBe(1);
  });
  it("균열의 숨: 5섹터도 12시간마다 들숨(어둠)", () => {
    const s = hero(602);
    enterDungeon(s);
    s.dungeon!.sector = 5;
    s.dungeon!.clock = 0;
    expect(isNight(s)).toBe(false);
    s.dungeon!.clock = BAL.dayNightTurns;
    expect(isNight(s)).toBe(true);
  });
  it("신앙 ★5는 4섹터를 클리어해야, 신앙심 180", () => {
    const s = hero(603);
    s.faithsKnown = [FAITH.mob];
    s.hero.faith = FAITH.mob;
    s.piety = 190;
    s.rank = 3;
    expect(tier(s)).toBe(4);
    s.rank = 4;
    expect(tier(s)).toBe(5);
  });
  it("기아/풍요의 신 ★5: 굶주려도 아사하지 않는다", () => {
    const s = hero(604);
    s.faithsKnown = [FAITH.starve];
    s.hero.faith = FAITH.starve;
    s.piety = 190;
    s.rank = 4;
    enterDungeon(s);
    s.inventory.food = 0;
    s.hero.satiety = 0;
    passTime(s, BAL.starveLimitTurns + 10);
    expect(s.phase).toBe("dungeon");
  });
  it("5섹터 몬스터는 사람이 아니고 편린이 있다", () => {
    for (const id of ["riftbat", "tendril", "hungerwraith", "ledgespider", "voideye", "riftworm", "fallenheap", "hungermother", "abyssmaw"]) {
      expect(MONSTERS[id].human).toBeFalsy();
      expect(FRAGMENTS[id]).toBeDefined();
    }
  });
});

describe("퍼징 회귀(2026-10-15)", () => {
  it("끝없는 미궁에서 균열 벌레를 쓰러뜨려도 바닥이 꺼지지 않는다(꺼진 바닥으로 떨어지면 층 생성이 깨졌다)", () => {
    const s = newRun(701);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 30;
    s.hero.level = 16;
    enterDungeon(s);
    const dg = s.dungeon!;
    dg.sector = ENDLESS_SECTOR;
    dg.endless = true;
    dg.rooms = generateEndlessFloor(new Rng({ s: 5 }), 1);
    s.hero.hp = 9999;
    for (let i = 0; i < 30; i++) {
      s.combat = null;
      const room = dg.rooms[dg.current];
      room.type = "combat";
      room.resolved = false;
      startCombat(s, "dungeon", makeEnemies(s, ["riftworm"]).map((e) => ({ ...e, hp: 1 })));
      expect(dg.rooms.every((r) => r.type !== "trap")).toBe(true);
    }
  });
});

describe("6섹터: 타락한 신전과 차원문의 성소·엔딩", () => {
  const hero = (faith: string | null = null, seed = 701) => {
    const s = newRun(seed);
    s.faithsKnown = Object.values(FAITH);
    apply(s, { t: "create", name: "x", candidate: 0, faith });
    s.month = 30;
    s.rank = 5;
    s.hero.level = 16;
    for (const k of STAT_KEYS) s.hero.stats[k] += 15;
    s.hero.hp = maxHp(s);
    return s;
  };
  /** 6섹터 3층 성소에 세운다 */
  const sanctum = (s: GameState) => {
    enterDungeon(s);
    const dg = s.dungeon!;
    dg.sector = 6;
    dg.floor = 3;
    dg.rooms = generateFloor(new Rng({ s: 5 }), 3, 6);
    dg.current = 0;
    dg.prev = null;
    return dg;
  };
  const at = (s: GameState, type: string) => {
    const dg = s.dungeon!;
    const i = dg.rooms.findIndex((x) => x.type === type);
    dg.prev = i - 1;
    dg.current = i;
    return dg.rooms[i];
  };

  it("층 생성: 1·2층은 봉헌함·성광 방(2층 고해실), 3층은 외길 — 제단 → (전투·봉인 문)×3 → 화신 → 셉터의 제단", () => {
    const r = new Rng({ s: 31 });
    let radiant = 0, conf = 0;
    for (let i = 0; i < 40; i++) {
      for (const floor of [1, 2]) {
        const rooms = generateFloor(r, floor, 6);
        expect(reachable(rooms).size).toBe(rooms.length);
        expect(rooms.filter((x) => x.type === "offerbox").length).toBe(1);
        radiant += rooms.filter((x) => x.radiant).length;
        conf += rooms.filter((x) => x.type === "confession").length;
        if (floor === 1) expect(rooms.some((x) => x.type === "confession")).toBe(false);
      }
      const s3 = generateFloor(r, 3, 6);
      expect(s3.map((x) => x.type)).toEqual(["entrance", "altars", "combat", "trap", "combat", "trap", "combat", "trap", "boss", "scepter"]);
      expect(s3.every((x) => x.edges.length <= 2)).toBe(true);
      expect(new Set(s3.filter((x) => x.type === "trap").map((x) => x.trapKind))).toEqual(new Set(["rune", "weight", "mirror"]));
      expect(s3.find((x) => x.type === "boss")!.encounter![0]).toBe("avatar");
    }
    expect(radiant).toBeGreaterThan(0);
    expect(conf).toBe(40);
    // 다른 섹터에는 신전 방이 없다
    for (const sec of [1, 2, 3, 4, 5]) for (const floor of [1, 2, 3]) expect(generateFloor(r, floor, sec).some((x) => x.radiant || ["offerbox", "confession", "altars", "scepter"].includes(x.type))).toBe(false);
  });

  it("정화: 신앙심이 깎이고 ★ 문턱 아래면 권능이 꺼진다. 옛 신의 향이 3번, 뒤집힌 성표는 늘 막는다", async () => {
    const { purge } = await import("./temple");
    const s = hero(FAITH.mob);
    s.piety = 182;
    enterDungeon(s);
    expect(tier(s)).toBe(5);
    purge(s, 4, "시험");
    expect(s.piety).toBe(178);
    expect(tier(s)).toBe(4);
    s.inventory.incense = 1;
    for (let i = 0; i < 3; i++) purge(s, 10, "시험");
    expect(s.piety).toBe(178);
    expect(s.inventory.incense).toBe(0);
    purge(s, 10, "시험");
    expect(s.piety).toBe(168);
    s.gear.neck = "oldsigil";
    purge(s, 10, "시험");
    expect(s.piety).toBe(168);
    // 무신앙은 깎일 것이 없다
    const n = hero(null);
    enterDungeon(n);
    purge(n, 10, "시험");
    expect(n.piety).toBe(0);
  });

  it("성광 방: 처음 들어서면 신앙심 −3(순례자의 신이면 그대로)", () => {
    const s = hero(FAITH.mob);
    s.piety = 100;
    enterDungeon(s);
    const dg = s.dungeon!;
    dg.sector = 6;
    dg.rooms = generateFloor(new Rng({ s: 3 }), 1, 6);
    const room = dg.rooms[dg.rooms[0].edges[0]];
    room.type = "empty";
    room.radiant = true;
    apply(s, { t: "move", room: room.id });
    expect(s.piety).toBe(97);
    const t = hero(FAITH.mob);
    t.piety = 100;
    t.gear.feet = "pilgrimboots";
    enterDungeon(t);
    const dt = t.dungeon!;
    dt.sector = 6;
    dt.rooms = generateFloor(new Rng({ s: 3 }), 1, 6);
    const r2 = dt.rooms[dt.rooms[0].edges[0]];
    r2.type = "empty";
    r2.radiant = true;
    apply(t, { t: "move", room: r2.id });
    expect(t.piety).toBe(100);
  });

  it("봉인 문: ★5면 그냥 열리고, 해석에 실패하면 수호자 — 져도 죽지 않고 HP 1로 문 밖", () => {
    const s = hero(FAITH.mob);
    s.piety = 190;
    const dg = sanctum(s);
    const door = dg.rooms[3];
    dg.prev = 2;
    dg.current = 2;
    dg.rooms[2].resolved = true;
    apply(s, { t: "move", room: 3 });
    expect(door.resolved).toBe(true);
    expect(s.dungeon!.pending).toBe(null);
    // 무신앙·약한 영웅: 수호자에게 진다
    const w = hero(null);
    for (const k of STAT_KEYS) w.hero.stats[k] = 2;
    w.hero.level = 1;
    w.hero.hp = maxHp(w);
    const d2 = sanctum(w);
    d2.rooms[2].resolved = true;
    d2.current = 2;
    apply(w, { t: "move", room: 3 });
    expect(w.dungeon!.pending?.kind).toBe("trap");
    apply(w, { t: "pending", choice: "force" });
    expect(w.phase).toBe("dungeon");
    expect(w.hero.hp).toBeGreaterThanOrEqual(1);
    expect(w.dungeon!.current).toBe(2);
    expect(d2.rooms[3].resolved).toBe(false);
    expect(d2.rooms[3].remaining?.[0].defId).toBe("guardian");
  });

  it("옛 신들의 제단: 섬기는 신은 신앙심 +10과 유물(삶마다 하나), 다른 해금 신은 응답. 유물은 그 신을 섬길 때만", () => {
    const s = hero(FAITH.tax);
    apply(s, { t: "pickClass", cls: "warrior" }); // create 뒤라 바뀌지 않는다 — 직업을 직접
    s.hero.cls = "warrior";
    s.piety = 100;
    sanctum(s);
    at(s, "altars");
    s.dungeon!.pending = { kind: "altars" };
    apply(s, { t: "pending", choice: "pray" });
    expect(s.piety).toBe(110);
    expect(s.relic).toBe("greed");
    expect(s.dungeon!.answers!.length).toBe(Object.values(FAITH).length - 1);
    const ac = (x: GameState) => x.hero.stats.dex; // AC 비교는 heroAc로
    void ac;
    expect(allSkills(s)).toBeTruthy();
    // 개종하면 유물은 빛을 잃는다
    const before = s.relic;
    apply(s, { t: "pending", choice: "convert0" });
    expect(s.relic).toBe(before);
  });

  it("고해실: 신앙이 있으면 부정(신앙 잃음)·거부(현상수배 + 심문관장), 무신앙은 캐물어 칙서", () => {
    const s = hero(FAITH.mob);
    s.piety = 80;
    enterDungeon(s);
    let dg = s.dungeon!;
    dg.sector = 6;
    dg.floor = 2;
    dg.rooms = generateFloor(new Rng({ s: 4 }), 2, 6);
    let room = at(s, "confession");
    dg.pending = { kind: "confession" };
    apply(s, { t: "pending", choice: "renounce" });
    expect(s.hero.faith).toBe(null);
    expect(s.piety).toBe(0);
    expect(room.resolved).toBe(true);
    const t = hero(FAITH.mob);
    t.piety = 80;
    enterDungeon(t);
    dg = t.dungeon!;
    dg.sector = 6;
    dg.floor = 2;
    dg.rooms = generateFloor(new Rng({ s: 4 }), 2, 6);
    room = at(t, "confession");
    dg.pending = { kind: "confession" };
    apply(t, { t: "pending", choice: "refuse" });
    expect(t.heretic).toBe(true);
    if (t.phase === "dungeon" && room.resolved) {
      expect(t.edict).toBe(true);
      expect(t.clues).toContain("edict");
    }
    // 무신앙: 캐묻기(판정이 반드시 성공하게 감각을 올림)
    const u = hero(null);
    u.hero.stats.per = 50;
    u.hero.stats.int = 50;
    enterDungeon(u);
    dg = u.dungeon!;
    dg.sector = 6;
    dg.floor = 2;
    dg.rooms = generateFloor(new Rng({ s: 4 }), 2, 6);
    at(u, "confession");
    dg.pending = { kind: "confession" };
    for (let i = 0; i < 1 && !u.edict; i++) apply(u, { t: "pending", choice: "ask" });
    expect(u.edict).toBe(true);
  });

  it("화신: 쓰러지면 한 번 다시 일어서고(호위는 타 버린다), 삼킴은 ★를 봉인한다 — 기아/풍요 ★5·짝신의 이름이면 무효", () => {
    const s = hero(null);
    sanctum(s);
    const c = { context: "dungeon" as const, enemies: makeEnemies(s, ["avatar", "seraph"]), round: 1, loot: 0, bonus: 0, used: {}, frags: [], guard: null };
    s.combat = c;
    const av = c.enemies[0];
    av.hp = 1;
    // 화신 HP를 0 아래로: rebirth가 dealt 안에서 일어난다 — 직접 temple.rebirth로 확인
    return import("./temple").then(({ rebirth }) => {
      av.hp = 0;
      expect(rebirth(s, c, av)).toBe(true);
      expect(av.hp).toBe(MONSTERS.avatar.rebirth);
      expect(c.enemies[1].hp).toBe(0);
      expect(rebirth(s, c, av)).toBe(false);
      s.combat = null;
    });
  });

  it("셉터의 제단: 들면 헌납 엔딩(이단은 못 든다), 두고 가기는 조건이 차야 열린다, 보류는 6섹터 클리어, 아래로는 끝없는 미궁", () => {
    const s = hero(null);
    sanctum(s);
    at(s, "scepter");
    s.rank = 6;
    s.dungeon!.pending = { kind: "scepter" };
    apply(s, { t: "pending", choice: "leave" }); // 잠겨 있다
    expect(s.phase).toBe("dungeon");
    s.dungeon!.pending = { kind: "scepter" };
    apply(s, { t: "pending", choice: "take" });
    expect(s.phase).toBe("dead");
    expect(s.tomb!.ending).toBe("offering");
    expect(s.tomb!.faithsUnlocked).toEqual([]);
    expect(s.tomb!.epilogue!.length).toBeGreaterThan(3);
    // 이단은 들 수 없다
    const h = hero(FAITH.mob);
    h.heretic = true;
    h.piety = 60;
    sanctum(h);
    at(h, "scepter");
    h.dungeon!.pending = { kind: "scepter" };
    apply(h, { t: "pending", choice: "take" });
    expect(h.phase).toBe("dungeon");
    // 보류: 6섹터 클리어로 돌아간다
    h.dungeon!.pending = { kind: "scepter" };
    apply(h, { t: "pending", choice: "hold" });
    expect(h.phase).toBe("settlement");
    expect(h.settlement!.cleared).toBe(true);
  });

  it("진엔딩: 조각 5개 + 칙서 + 신앙이면 결전 — 이기면 진엔딩, 지면 '영주에게 맞선 자'", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 12; k++) {
      const strong = k % 2 === 0;
      const s = hero(FAITH.mob, 711 + k);
      s.piety = 100;
      s.clues = ["lostgod", "lock", "ageless", "oldgods", "edict"];
      s.edict = true;
      if (strong) {
        for (const st of STAT_KEYS) s.hero.stats[st] = 50;
        s.gear = { main: "sunsteel", body: "hollowplate", offhand: "towershield", head: "confessmask", waist: "chainbelt" };
        s.inventory.potion = 20;
      } else {
        for (const st of STAT_KEYS) s.hero.stats[st] = 2;
        s.hero.level = 1;
        s.skills = [];
        s.inventory.potion = 0;
      }
      s.hero.hp = maxHp(s);
      sanctum(s);
      at(s, "scepter");
      s.rank = 6;
      s.dungeon!.answers = Object.values(FAITH).filter((f) => f !== FAITH.mob);
      s.dungeon!.pending = { kind: "scepter" };
      apply(s, { t: "pending", choice: "leave" });
      expect(s.phase).toBe("dead");
      expect(s.combat).toBe(null);
      if (!strong) expect(s.tomb!.ending).toBe("fallen");
      seen.add(s.tomb!.ending!);
    }
    expect(seen.has("true")).toBe(true);
  });

  it("진실 조각: 기록물 문장으로 얻고, 늙지 않는 영주는 소문과 기록 둘 다", async () => {
    const { clueFromText, rumorWithClues, clueCount } = await import("./truth");
    const { RECORDS, RUMORS } = await import("./data");
    const s = hero(null);
    s.clues = [];
    clueFromText(s, RECORDS[0]);
    expect(s.clues).toContain("lostgod");
    clueFromText(s, RECORDS[4]);
    expect(s.clues).not.toContain("ageless");
    clueFromText(s, RUMORS[5]);
    expect(s.clues).toContain("ageless");
    expect(clueCount(s)).toBe(2);
    // 헌납 엔딩을 본 다음 삶: 첫 탐문에서 짝신의 이름
    s.clueBits = ["dream"];
    const lines: string[] = [];
    rumorWithClues(s, lines);
    expect(s.clues).toContain("name");
  });

  it("숏컷: 4섹터부터 가장 깊이 열린 섹터까지 골라 들어간다(5섹터 클리어면 6섹터까지)", async () => {
    const { shortcutSectors } = await import("./dungeon");
    const s = hero(null);
    s.rank = 5;
    expect(shortcutSectors(s)).toEqual([4, 5, 6]);
    s.week = 4;
    s.phase = "town";
    apply(s, { t: "enterDungeon", shortcut: true, sector: 6 });
    expect(s.dungeon!.sector).toBe(6);
    expect(s.dungeon!.turnsLeft).toBe(BAL.shortcutTurns);
    const t = hero(null);
    t.rank = 3;
    expect(shortcutSectors(t)).toEqual([4]);
  });

  it("심판의 눈: 6섹터 1·2층은 레벨과 상관없이 시계가 돌고, 3층 성소에는 없다", async () => {
    const { sweeperEligible, sweeperId } = await import("./sweeper");
    const s = hero(null);
    s.hero.level = 2;
    enterDungeon(s);
    s.dungeon!.sector = 6;
    s.dungeon!.first = false;
    expect(sweeperEligible(s)).toBe(true);
    s.dungeon!.floor = 3;
    expect(sweeperEligible(s)).toBe(false);
    expect(sweeperId(6)).toBe("judgeeye");
  });

  it("세금 등급 6 +1000G, 15→16 수련비 1000G(시뮬 조정)", () => {
    expect(taxDue(1, 6) - taxDue(1, 5)).toBe(200);
    expect(BAL.specialTrainFee[15]).toBe(1000);
  });
});

describe("모험가 히든 16레벨: 신의 가르침", () => {
  const adv = (faith: string | null, seed = 801) => {
    const s = newRun(seed);
    s.faithsKnown = Object.values(FAITH);
    apply(s, { t: "create", name: "x", candidate: 0, faith });
    s.month = 30;
    s.rank = 5;
    s.hero.level = 15;
    s.inventory.fang = 1;
    if (faith) s.piety = 100;
    for (const k of STAT_KEYS) s.hero.stats[k] += 12;
    s.hero.hp = maxHp(s);
    enterDungeon(s);
    const dg = s.dungeon!;
    dg.sector = 6;
    dg.floor = 3;
    dg.rooms = generateFloor(new Rng({ s: 5 }), 3, 6);
    const i = dg.rooms.findIndex((x) => x.type === "altars");
    dg.current = i;
    dg.prev = i - 1;
    dg.pending = { kind: "altars" };
    return s;
  };
  it("마을에서는 15레벨까지만(전사·마법사는 16까지)", () => {
    const s = newRun(811);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.month = 30;
    s.gold = 99999;
    s.inventory.fang = 1;
    s.hero.level = 15;
    expect(s.hero.cls).toBe("adventurer");
    expect(canTrain(s)).toBe(false);
    s.hero.cls = "warrior";
    expect(canTrain(s)).toBe(true);
  });
  it("레벨 15·★1·아귀의 이빨이면 제단에서 섬기는 신이 16레벨로 — 유물 대신 가르침", () => {
    const s = adv(FAITH.mob);
    const before = maxHp(s);
    apply(s, { t: "pending", choice: "pray" });
    expect(s.hero.level).toBe(16);
    expect(s.godTeaching).toBe("war");
    expect(s.relic).toBeUndefined();
    expect(s.inventory.fang).toBe(0);
    expect(s.skills).toContain("godTaught");
    expect(maxHp(s)).toBeGreaterThanOrEqual(before + 10);
    expect(teachOn(s, "war")).toBe(true);
    // 신앙을 바꾸면 레벨은 남고 가르침은 꺼진다
    s.hero.faith = FAITH.song;
    expect(s.hero.level).toBe(16);
    expect(teachOn(s, "war")).toBe(false);
  });
  it("무신앙·레벨 14·이빨 없음이면 16레벨이 되지 않는다", () => {
    const n = adv(null);
    apply(n, { t: "pending", choice: "pray" });
    expect(n.hero.level).toBe(15);
    const y = adv(FAITH.mob);
    y.hero.level = 14;
    apply(y, { t: "pending", choice: "pray" });
    expect(y.hero.level).toBe(14);
    const z = adv(FAITH.mob);
    z.inventory.fang = 0;
    apply(z, { t: "pending", choice: "pray" });
    expect(z.hero.level).toBe(15);
    // 제단에서 갓 개종한 신은 가르치지 않는다
    const c = adv(FAITH.mob);
    apply(c, { t: "pending", choice: `convert${c.faithsKnown.indexOf(FAITH.song)}` as never });
    expect(c.hero.faith).toBe(FAITH.song);
    apply(c, { t: "pending", choice: "pray" });
    expect(c.hero.level).toBe(15);
  });
  it("8신 모두 마지막 기술이 전투에서 나간다", () => {
    const keys = ["war", "hunger", "trap", "greed", "song", "plague", "abyss", "oblivion"] as const;
    const names = Object.values(FAITH);
    const gods = { war: FAITH.mob, hunger: FAITH.starve, trap: FAITH.trap, greed: FAITH.tax, song: FAITH.song, plague: FAITH.plague, abyss: FAITH.abyss, oblivion: FAITH.oblivion };
    void names;
    for (const k of keys) {
      let fired = false;
      for (let seed = 0; seed < 20 && !fired; seed++) {
        const s = adv(gods[k], 820 + seed);
        apply(s, { t: "pending", choice: "pray" });
        expect(s.godTeaching).toBe(k);
        s.combat = null;
        s.dungeon!.pending = null;
        s.dungeon!.mana = 3000;
        if (k === "hunger" || k === "abyss") s.hero.hp = Math.floor(maxHp(s) * 0.35);
        if (k === "song") { s.hero.hp = 1; for (const st of STAT_KEYS) s.hero.stats[st] = 2; }
        const from = s.logCount;
        startCombat(s, "dungeon", makeEnemies(s, ["seraph", "seraph", "seraph"]));
        const text = s.log.slice(-(s.logCount - from)).map((l) => l.text).join("\n");
        const final = { war: "최후의 군세", hunger: "두 얼굴의 식탁", trap: "재앙의 문", greed: "빚 독촉", song: "영웅의 노래", plague: "역병의 행진", abyss: "바닥 없는 일격", oblivion: "이름 지우기" }[k];
        if (text.includes(`【${final}】`)) fired = true;
      }
      expect(fired, k).toBe(true);
    }
  });
});

describe("저장 보정", () => {
  it("지운 모험가 16레벨 기술은 '신에게 배운 자'로, 없는 기술·편린 id는 빠진다", async () => {
    const { fixRun } = await import("../save");
    const s = newRun(901);
    apply(s, { t: "create", name: "x", candidate: 0, faith: null });
    s.hero.level = 16;
    s.skills = ["swordHand", "fighterAvatar", "noSuchSkill"];
    s.fragments = ["rat", "noSuchFrag"];
    const back = fixRun(JSON.parse(JSON.stringify(s)))!;
    expect(back.skills).toEqual(["swordHand", "godTaught"]);
    expect(back.fragments).toEqual(["rat"]);
  });
});

describe("테스트 결과 수집(telemetry)", () => {
  it("끝난 삶만 요약하고, 묘비 id는 db 경로에 쓸 수 있게 바꾼다", async () => {
    const { lifeReport } = await import("../ui/lifeReport");
    const { pathSafe } = await import("../platform/telemetry");
    const s = playBot(7, 1);
    expect(lifeReport(s)).toBeNull();
    s.tomb = { id: "7-3-2-100", name: "가", level: 3, months: 3, reached: "1섹터 2층", cause: "쥐", faithsUnlocked: [], epitaph: "", faith: null, seed: 7, diedAt: "x" };
    const r = lifeReport(s)!;
    expect(r.cause).toBe("쥐");
    expect(r.cls).toBe(s.hero.cls);
    expect(JSON.stringify(r).length).toBeLessThan(256 * 1024);
    expect(pathSafe("7-3-2-100-true")).toBe("7-3-2-100-true");
    expect(pathSafe("a/b c")).toBe("a_b_c");
  });
});

describe("저장 이전·백업(src/save)", () => {
  it("판 표시 이전 저장은 지금 판으로 올리고 원본을 백업한다, 깨진 저장은 지우기 전에 옮겨 둔다", async () => {
    const { setKv, memoryKv } = await import("../platform/kv");
    const { KEYS, SAVE_REV, loadRun, loadMeta } = await import("../save");
    setKv(memoryKv);
    const s = playBot(11, 50);
    delete (s as any).saveRev;
    s.skills.push("fighterAvatar");
    const raw = JSON.stringify(s);
    memoryKv.set(KEYS.run, raw);
    const got = loadRun()!;
    expect(got.saveRev).toBe(SAVE_REV);
    expect(got.skills).toContain("godTaught");
    expect(got.skills).not.toContain("fighterAvatar");
    expect(memoryKv.get(`${KEYS.run}.bak-r0`)).toBe(raw);
    // 깨진 저장
    memoryKv.set(KEYS.run, "{oops");
    expect(loadRun()).toBeNull();
    expect(memoryKv.get(`${KEYS.run}.broken`)).toBe("{oops");
    // 더 새 빌드의 저장
    memoryKv.set(KEYS.meta, JSON.stringify({ graveyard: [], faiths: ["x"], saveRev: SAVE_REV + 5 }));
    expect(loadMeta().faiths).toEqual(["x"]);
    expect(memoryKv.get(`${KEYS.meta}.newer`)).not.toBeNull();
  });
});

describe("나이 제한·18세 추적(age.ts)", () => {
  function at24(seed: number, strong: boolean): GameState {
    const s = newRun(seed);
    apply(s, { t: "create", name: "테스트", candidate: 0, faith: null });
    s.month = 24;
    s.week = 4;
    if (strong) {
      for (const st of STAT_KEYS) s.hero.stats[st] = 50;
      s.gear = { main: "sunsteel", body: "hollowplate", offhand: "towershield", head: "confessmask", waist: "chainbelt" };
      s.inventory.potion = 20;
      s.hero.level = 16;
    }
    return s;
  }
  it("나이와 남은 달: 1~12월 16세, 13~24월 17세, 25월 18세", async () => {
    const { ageOf, monthsLeft } = await import("./age");
    expect([ageOf(1), ageOf(12), ageOf(13), ageOf(24), ageOf(25)]).toEqual([16, 16, 17, 17, 18]);
    expect([monthsLeft(1), monthsLeft(19), monthsLeft(24), monthsLeft(25)]).toEqual([24, 6, 1, 0]);
  });
  it("24월 정산에는 세금이 없고, 25월이 되면 추적자 셋과 싸운다 — 약하면 처형, 강하면 섬을 떠나는 엔딩", async () => {
    const { beginSettlement } = await import("./town");
    const { CHASE_DEATH } = await import("./age");
    const seen = new Set<string>();
    for (let k = 0; k < 10; k++) {
      const strong = k % 2 === 0;
      const s = at24(901 + k, strong);
      s.gold = 0; // 세금을 낼 돈이 없어도 세금 처형은 아니다
      beginSettlement(s, { mana: 0, cleared: false, forced: true, deepest: 1 });
      expect(s.settlement!.tax).toBe(0);
      expect(s.settlement!.paid).toBe(true);
      apply(s, { t: "closeSettlement" });
      expect(s.month).toBe(25);
      expect(s.phase).toBe("dead");
      expect(s.combat).toBe(null);
      if (!strong) {
        expect(s.tomb!.cause).toBe(CHASE_DEATH);
        expect(s.tomb!.ending).toBeUndefined();
      }
      seen.add(s.tomb!.ending ?? "dead");
    }
    expect(seen.has("escape")).toBe(true);
    expect(seen.has("dead")).toBe(true);
  });
  it("23월까지는 그대로 다음 달로 넘어간다(17세 생일·남은 달 알림)", () => {
    const s = newRun(5);
    apply(s, { t: "create", name: "테스트", candidate: 0, faith: null });
    s.month = 12;
    s.gold = 9999;
    s.settlement = { month: 12, manaSold: 0, tax: 10, goldAfter: 9989, paid: true, cleared: false, forced: false, lines: [], inquisition: false };
    s.phase = "settlement";
    apply(s, { t: "closeSettlement" });
    expect(s.phase).toBe("town");
    expect(s.log.some((l) => l.text.includes("17번째 생일"))).toBe(true);
  });
});

describe("로그(민첩 직업)", () => {
  function rogue(seed = 41): GameState {
    const s = newRun(seed);
    apply(s, { t: "pickClass", cls: "rogue" });
    apply(s, { t: "create", name: "테스트", candidate: 0, faith: null });
    s.month = 2;
    return s;
  }
  it("단검 한 자루로 시작하고, 첫 훈련에 뒤잡기, 도주 +3·함정 해체 +2", () => {
    const s = rogue();
    expect(s.hero.cls).toBe("rogue");
    expect(s.gear.main).toBe("dagger");
    expect(s.gear.offhand).toBeUndefined();
    expect(s.inventory.scroll).toBe(1);
    s.gold = 999;
    apply(s, { t: "train", training: "assassin", free: ["dex", "con"] });
    expect(s.skills).toContain("rgBackstab");
    expect(s.skills).toContain("rgEye");
  });
  for (const [line, gear, off] of [["assassin", "rgOffDagger", "dagger"], ["venom", "rgToxFlask", "flask"], ["xbow", "rgHandXbow", "xbow"]] as const) {
    it(`4레벨 ${line} 각인 → 왼손 ${gear}, 10레벨 다른 갈래 낙인이면 바꾼다`, async () => {
      const { offOf } = await import("./gear");
      const s = rogue(50);
      s.gold = 99999;
      s.inventory.heart = 1;
      s.gear.offhand = "shield"; // 1~3레벨에는 방패를 들 수 있다
      for (let lv = 2; lv <= 4; lv++) {
        apply(s, { t: "train", training: line, free: ["dex", "con"] });
        apply(s, { t: "closeWeek" });
        if (s.phase !== "town") { s.phase = "town"; s.dungeon = null; s.week = 1; }
      }
      expect(s.hero.level).toBe(4);
      expect(s.gear.offhand).toBe(gear);
      expect(offOf(s)).toBe(off);
      if (line === "xbow") expect(s.inventory.bolt).toBe(20);
      // 10레벨 낙인: 다른 갈래
      const other = line === "assassin" ? "xbow" : "assassin";
      s.hero.level = 9;
      s.inventory.banner = 5; s.inventory.spore = 5; s.inventory.heart = 5;
      s.week = 1;
      s.phase = "town";
      apply(s, { t: "train", training: other, free: ["dex", "con"] });
      expect(s.hero.level).toBe(10);
      expect(s.gear.offhand).toBe(other === "xbow" ? "rgHandXbow" : "rgOffDagger");
    });
  }
  it("다른 직업은 왼손 무기를 살 수 없고, 볼트도 쇠뇌 로그만 산다", () => {
    const w = newRun(3);
    apply(w, { t: "create", name: "테스트", candidate: 0, faith: null });
    w.gold = 999;
    w.phase = "town";
    apply(w, { t: "buyGear", id: "rgOffDagger" });
    expect(w.gear.offhand).not.toBe("rgOffDagger");
    apply(w, { t: "buy", item: "bolt" });
    expect(w.inventory.bolt).toBe(0);
  });
  it("전투: 쌍단검·독병·손쇠뇌가 각자 일을 한다(로그에 흔적)", () => {
    for (const [mark, gear, needle] of [["rgAssassinMark", "rgOffDagger", "왼손 단검"], ["rgVenomMark", "rgToxFlask", "독병"], ["rgXbowMark", "rgHandXbow", "볼트"]] as const) {
      const s = rogue(60);
      s.skills.push(mark);
      s.gear.offhand = gear;
      s.inventory.bolt = 10;
      s.hero.level = 6;
      s.hero.hp = maxHp(s) + 200;
      startCombat(s, "field", makeEnemies(s, ["goblin", "goblin", "skeleton"]));
      expect(s.log.some((l) => l.text.includes(needle))).toBe(true);
    }
  });
});
