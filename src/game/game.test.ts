import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { enterDungeon, generateFloor, passTime } from "./dungeon";
import { canTrain, newRun, trainCost } from "./town";
import { ENDLESS_SECTOR, endlessPool, generateEndlessFloor } from "./endless";
import { CLASSES } from "./classes";
import { act, apply } from "./engine";
import { botAction } from "./bot";
import { STAT_KEYS, BAL, MONSTERS } from "./data";
import { FRAGMENTS, FRAG_MAX_CHANCE, fragKnown, fragSlots } from "./fragments";
import { kill, stat, taxDue } from "./core";
import { allSkills } from "./skills";
import { tier } from "./faith";
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
    dg.sector = 3;
    dg.floor = 3;
    dg.pending = { kind: "portal" };
    s.combat = null;
    apply(s, { t: "pending", choice: "enter" });
    return s;
  };
  it("2섹터 차원문으로 들어가면 3섹터(물에 잠긴 사원) 1층, 남은 시간 두 배", () => {
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
    expect(s.dungeon!.turnsLeft).toBeGreaterThan(190);
    expect(s.rank).toBe(2);
  });
  it("3섹터 차원문으로 들어가면 끝없는 미궁 1층: 함정·상자·기록물 없이 전투·빈 방·계단뿐", () => {
    const s = toEndless();
    const dg = s.dungeon!;
    expect(dg.endless).toBe(true);
    expect(dg.sector).toBe(ENDLESS_SECTOR);
    expect(dg.floor).toBe(1);
    expect(s.rank).toBe(3);
    expect(dg.rooms.every((r) => ["entrance", "combat", "empty", "stairs"].includes(r.type))).toBe(true);
  });
  it("계단은 끝없이 이어지고, 깊을수록 몬스터가 강하며, 5층마다 보스가 계단 앞을 지킨다", () => {
    const r = new Rng({ s: 7 });
    for (let n = 1; n <= 40; n++) {
      const rooms = generateEndlessFloor(r, n);
      expect(rooms.filter((x) => x.type === "stairs").length).toBe(1);
      expect(rooms.some((x) => x.type === "trap" || x.type === "treasure")).toBe(false);
      const bossy = rooms.some((x) => x.encounter?.some((m) => ["boss", "harpyqueen", "general", "mycomother"].includes(m)));
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
  it("10갈래 모두 2~16레벨이 채워져 있고, 짝수는 패시브·홀수는 액티브", () => {
    for (const tb of tables) {
      for (let lv = 2; lv <= 16; lv++) {
        const id = tb[lv];
        expect(SKILLS[id], `${lv} ${id}`).toBeDefined();
        expect(SKILLS[id].kind).toBe(lv % 2 === 0 ? "passive" : "active");
      }
    }
  });
  it("각인·낙인이 갈래 액티브를 1회씩 더(합쳐 +2), 궁극기는 늘지 않는다", () => {
    expect(MARK_FOR_SKILL.fireLance).toEqual(["fireMark", "fireSeal"]);
    expect(MARK_FOR_SKILL.fireMeteor).toBeUndefined();
    expect(MARK_FOR_SKILL.elemArrow).toContain("casterAvatar");
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
