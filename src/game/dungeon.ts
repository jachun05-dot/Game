import { josa } from "./josa";
import { BAL, MANA_FLOOR_MULT, MIN_COMBAT_ROOMS, MONSTERS, PLAGUE_RECORDS, RECORDS, ROOM_FLAVOR, SECTOR_ELITES, SECTOR_ENCOUNTERS, SECTOR_FLAVOR, SECTOR_NAME, SECTOR_RARES, TRAP_AMBUSH, TROPHIES, WAR_RECORDS, bossGroup, campAmbush } from "./data";
import { check, isDead, kill, log, maxHp, note, remember, rngOf, smod } from "./core";
import { FRAGMENTS, fragKnown, fragSlots, fragStatText } from "./fragments";
import { INJ, bleedPerMove, canPeek, moveMult, wound } from "./injury";
import { MIND, MIND_KEYS, MIND_NAME, afflict, cure, has, noticeCheck, symptom } from "./mind";
import { FAITH_BAL, GODS, faithFallMult, addPiety, faithPeek, faithTrapSense, god, power, pray } from "./faith";
import { beginSettlement, convert } from "./town";
import { SKILLS } from "./skills";
import { describeGroup, makeEnemies, potionHeal, startCombat } from "./combat";
import { hungerMult } from "./skills";
import { GEAR, equip, gearHas, targetSlot } from "./gear";
import { campHealMult, clearCorrosion, corrode, leaveHazards, paraFires, poisonAfflict, restHazards } from "./hazards";
import { fragSkills } from "./fragments";
import { resetSweeper, sweeperId, sweeperStep, sweeperTick } from "./sweeper";
import { ENDLESS_BOSS_EVERY, ENDLESS_NAME, ENDLESS_SECTOR, LAST_SECTOR, endlessGroup, endlessManaMult, generateEndlessFloor } from "./endless";
import type { Rng } from "./rng";
import type { CombatState, DungeonState, GameState, Pending, Room, RoomType } from "./types";

// DESIGN 11절(텍스트 전환판): 층 = 방 그래프. 필수 경로(방 사슬)를 먼저 만들고
// 갈림길은 그 경로에 덧붙이기만 해서 구조적으로 막힐 수 없게 한다.

export const ROOM_LABEL: Record<RoomType, string> = {
  entrance: "입구",
  empty: "빈 방",
  combat: "적의 기척",
  trap: "함정",
  treasure: "보물",
  record: "기록물",
  shrine: "성소",
  stairs: "계단",
  boss: "보스",
  portal: "차원문",
  relic: "전쟁의 흔적",
  altar: "공양 제단",
};

/** 지도 노드 위 짧은 라벨 */
export const ROOM_SHORT: Record<RoomType, string> = {
  entrance: "입구", empty: "빈방", combat: "적", trap: "함정", treasure: "보물",
  record: "기록", shrine: "성소", stairs: "계단", boss: "보스", portal: "문", relic: "흔적", altar: "제단",
};

export function generateFloor(r: Rng, floor: number, sector = 1): Room[] {
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

  // 1) 필수 경로
  const mainLen = r.int(6, 8);
  const main: Room[] = [add("entrance", 0)];
  for (let i = 1; i < mainLen; i++) {
    const room = add("empty", i);
    link(main[i - 1], room);
    main.push(room);
  }
  const last = main[main.length - 1];
  if (floor < 3) {
    last.type = "stairs";
  } else {
    last.type = "boss";
    const portal = add("portal", last.depth + 1);
    link(last, portal);
  }

  // 2) 갈림길(막다른 곁가지) — 필수 경로에만 덧붙인다
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

  // 3) 방 종류 배치
  const free = r.shuffle(rooms.filter((x) => x.type === "empty" && x.id !== 0));
  const take = (type: RoomType, n: number, prefer?: (x: Room) => boolean) => {
    for (let i = 0; i < n && free.length; i++) {
      let idx = prefer ? free.findIndex(prefer) : -1;
      if (idx < 0) idx = 0;
      free.splice(idx, 1)[0].type = type;
    }
  };
  const isDeadEnd = (x: Room) => x.edges.length === 1;
  take("treasure", 1, isDeadEnd);
  // 전투방을 먼저 확보한다(함정이 많아져도 몬스터가 줄지 않게, DESIGN 11절 "층이 깊을수록 조우 증가")
  take("combat", Math.max(MIN_COMBAT_ROOMS[floor], Math.round(free.length * 0.25)));
  take("trap", 1 + floor); // 함정: 층이 깊을수록 증가
  take("record", r.int(1, 2), isDeadEnd);
  if (sector === 2) take("relic", r.int(1, 2)); // 전쟁의 흔적
  if (sector === 3) take("altar", r.int(1, 2)); // 공양 제단
  if (r.chance(0.35)) take("shrine", 1);

  // 고블린 매복은 1섹터에만(2섹터에는 고블린이 없다)
  const amb = sector === 1 ? TRAP_AMBUSH[floor] : { chance: 0, size: [0, 0] as [number, number] };
  for (const room of rooms) {
    if (room.type === "combat") room.encounter = r.weighted(SECTOR_ENCOUNTERS[sector][floor]);
    if (room.type === "boss") room.encounter = bossGroup(sector, r);
    if (room.type === "trap" && r.chance(amb.chance)) room.ambush = Array(r.int(amb.size[0], amb.size[1])).fill("goblin");
  }
  // 2·3층에는 꺼진 바닥(떨어지면 아래층으로, 3층은 깊은 틈)
  if (floor >= 2) for (const room of rooms) if (room.type === "trap" && r.chance(BAL.pitChance)) room.trapKind = "pit";
  // 희귀 개체: 전투방 하나를 차지한다
  if (r.chance(BAL.rareChance)) {
    const combatRooms = rooms.filter((x) => x.type === "combat");
    if (combatRooms.length) r.pick(combatRooms).encounter = [SECTOR_RARES[sector][floor]];
  }
  // 정예 희귀 개체(하피 여왕 등): 마석 희귀 개체와 따로, 조금 더 자주
  const elite = SECTOR_ELITES[sector];
  if (elite && elite.floors.includes(floor) && r.chance(BAL.eliteChance)) {
    const combatRooms = rooms.filter((x) => x.type === "combat" && !x.encounter?.some((m) => MONSTERS[m].rare));
    if (combatRooms.length) r.pick(combatRooms).encounter = [elite.id, ...elite.escort];
  }
  if (sector === 3) floodFloor(r, rooms, floor);
  return rooms;
}

/** 3섹터: 물에 잠긴 방·깊은 물·공양물. 거머리는 물에 잠긴 방에만 산다 */
function floodFloor(r: Rng, rooms: Room[], floor: number): void {
  for (const room of rooms) {
    if (room.id === 0 || room.type === "stairs" || room.type === "portal") continue;
    if (!r.chance(BAL.floodChance[floor] ?? 0)) continue;
    room.flooded = true;
    if (floor >= 3 && room.type !== "boss" && r.chance(BAL.deepChance)) room.deep = true;
    if (["empty", "combat"].includes(room.type) && r.chance(0.35)) room.offering = true;
  }
  for (const room of rooms) {
    if (room.type !== "combat" || room.flooded || !room.encounter?.includes("leech")) continue;
    room.encounter = room.encounter.map((m) => (m === "leech" ? "plaguerat" : m));
  }
}

export function enterDungeon(s: GameState): void {
  const r = rngOf(s);
  s.week = 4;
  s.hero.fatigue = 0;
  s.tripUsed = [];
  s.dungeon = {
    sector: 1,
    floor: 1,
    rooms: generateFloor(r, 1, 1),
    clock: 0,
    current: 0,
    prev: null,
    turnsLeft: BAL.weekTurns,
    mana: 0,
    pending: null,
    starvingTurns: 0,
    deepestFloor: 1,
    ...(s.month === 1 ? { first: true } : {}),
  };
  s.phase = "dungeon";
  log(s, `— ${s.month}월 4주차. 미궁 1섹터에 들어섰다. (남은 시간 ${BAL.weekTurns}턴 = 7일)`, "system");
  arrive(s, true);
}

function d(s: GameState): DungeonState {
  return s.dungeon!;
}

export function currentRoom(s: GameState): Room {
  const dg = d(s);
  return dg.rooms[dg.current];
}

/** 시간 경과(1턴 = 30분). 포만감·피로도 소모, 아사 판정 */
export function passTime(s: GameState, turns: number): void {
  const dg = s.dungeon;
  if (!dg || isDead(s)) return;
  dg.turnsLeft -= turns;
  const wasNight = isNight(s);
  const wasHigh = highTide(s);
  dg.clock = (dg.clock ?? 0) + turns;
  if (dg.sector === 2 && isNight(s) !== wasNight) log(s, isNight(s) ? "해가 졌다. 풀숲 너머에서 늑대 울음이 번진다. (밤)" : "동이 튼다. 바람이 풀을 눕힌다. (낮)", "system");
  if (dg.sector === 3 && !dg.endless && highTide(s) !== wasHigh) log(s, highTide(s) ? "물이 차오른다. 잠긴 방들의 수면이 가슴께까지 올라왔다. (밀물)" : "물이 빠져나간다. 잠겨 있던 바닥이 드러난다. (썰물)", "system");
  const h = s.hero;
  const wasFed = h.satiety > 0;
  h.satiety = Math.max(0, h.satiety - turns * 0.5 * hungerMult(s));
  h.fatigue = Math.min(100, h.fatigue + turns / 3);
  // 기아/풍요의 신은 배고픈 채 버티는 것을 좋아한다(포만감 30 이하, 완전히 굶주리면 두 배)
  if (h.satiety <= 30) pray(s, "hunger", (turns / 3) * (h.satiety <= 0 ? 2 : 1));
  if (wasFed && h.satiety <= 0) log(s, "배가 고파 손이 떨린다. (굶주림: 판정 -2)", "hurt");
  dg.respawnClock = (dg.respawnClock ?? 0) + turns;
  while (dg.respawnClock >= BAL.respawnEveryTurns) {
    dg.respawnClock -= BAL.respawnEveryTurns;
    respawn(s);
  }
  if (h.satiety <= 0) {
    dg.starvingTurns += turns;
    if (dg.starvingTurns >= BAL.starveLimitTurns) {
      kill(s, "starve");
      return;
    }
  } else {
    dg.starvingTurns = 0;
  }
  sweeperTick(s, turns);
}

/** 미궁은 스스로 괴물을 낳는다: 비워 둔 전투방이 다시 채워진다(함정·상자·보스방은 그대로) */
function respawn(s: GameState): void {
  const dg = d(s);
  const r = rngOf(s);
  let any = false;
  for (const room of dg.rooms) {
    if (room.type !== "combat" || !room.resolved || room.id === dg.current) continue;
    if (!r.chance(BAL.respawnChance)) continue;
    room.resolved = false;
    room.respawned = true;
    room.remaining = undefined;
    room.encounter = dg.endless ? endlessGroup(r, dg.floor) : r.weighted(SECTOR_ENCOUNTERS[dg.sector][dg.floor]);
    any = true;
  }
  if (any) log(s, "멀리서 무언가 기어 나오는 소리가 들린다. 비워 둔 방에 새로운 기척이 생겼다.", "system");
}

/** 시간이 다 됐으면 강제 귀환. 전투 중이면 전투가 끝난 뒤 판정한다 */
function checkTimeUp(s: GameState): boolean {
  const dg = s.dungeon;
  if (!dg || isDead(s) || s.combat) return false;
  if (dg.turnsLeft <= 0) {
    log(s, "셉터의 마법이 몸을 끌어당긴다. 시간이 다 됐다 — 마을로 강제 귀환.", "system");
    leaveDungeon(s, { cleared: false, forced: true });
    return true;
  }
  return false;
}

export function canMoveTo(s: GameState, id: number): boolean {
  const dg = s.dungeon;
  if (!dg || s.combat || dg.pending || s.phase !== "dungeon") return false;
  return currentRoom(s).edges.includes(id);
}

export function moveTo(s: GameState, id: number): void {
  if (!canMoveTo(s, id)) return;
  const dg = d(s);
  // 혼란: 엉뚱한 길로 샌다
  const others = currentRoom(s).edges.filter((e) => e !== id);
  if (others.length && symptom(s, "confusion", MIND.symptom, "가려던 길이 아닌 다른 통로로 들어섰다!", "정신을 차려 보니 생각했던 통로가 아니다.")) {
    id = others[rngOf(s).int(0, others.length - 1)];
  }
  dg.prev = dg.current;
  dg.current = id;
  // 발 마비: 다리가 말을 듣지 않아 한참 걸린다
  const numb = paraFires(s, "feet");
  if (numb) log(s, "다리가 저려 말을 듣지 않는다. 한참을 끌고 갔다.", "hurt");
  passTime(s, Math.round(BAL.moveTurns * moveMult(s) * waterMult(s, dg.rooms[id]) * (numb ? 2 : 1))); // 발 부상이면 느리다
  if (isDead(s)) return;
  if (dg.rooms[id].deep && !swim(s)) return;
  if (s.disease > 0) pray(s, "plague", 1); // 역병의 신은 병을 앓은 채 버티는 것을 좋아한다
  // 정신 상태이상: 눈치채기 판정, 절망(탈진·굶주림), 주저앉기
  noticeCheck(s, smod(s, "per") + smod(s, "int"));
  if (s.hero.fatigue >= 100) afflict(s, "despair", MIND.despairExhausted, "다리가 무겁다. 이 길 끝에 무엇이 있을지 생각하기도 싫어진다.");
  if (s.hero.satiety <= 0) afflict(s, "despair", MIND.despairStarving, "빈속이 쓰리다. 무엇을 위해 여기 있는지 모르겠다.");
  if (symptom(s, "despair", MIND.symptom, "주저앉아 한참을 움직이지 못했다. (2시간)", "잠깐 앉았다가, 정신을 차려 보니 한참이 지나 있었다. (2시간)")) passTime(s, 4);
  if (isDead(s)) return;
  // 출혈(몸통 부상)·쥐 열병
  const { bleed, disease, poison } = bleedPerMove(s);
  if (bleed + disease + poison > 0) {
    s.hero.hp -= bleed + disease + poison;
    log(s, [bleed ? `상처에서 피가 배어 나온다 (−${bleed})` : "", disease ? `${s.diseaseKind === "mold" ? "기침이 멎지 않는다" : "열에 들떠 비틀거린다"} (−${disease})` : "", poison ? `독이 온몸을 돈다 (−${poison})` : ""].filter(Boolean).join(", "), "hurt");
    if (s.hero.hp <= 0) {
      s.hero.hp = 0;
      if (disease > 0) kill(s, "plague", s.diseaseKind === "mold" ? "곰팡이 폐병에 쓰러졌다" : "쥐 열병에 쓰러졌다");
      else if (poison > 0) kill(s, "plague", "독이 온몸에 퍼져 쓰러졌다");
      else kill(s, "single", "피를 너무 많이 흘려 쓰러졌다");
      if (isDead(s)) return;
    }
  }
  if (checkTimeUp(s)) return;
  // 미궁의 청소부: 내가 한 방 옮기면 한 방 다가온다
  if (sweeperStep(s, 1)) return sweeperFight(s, "move");
  // 현상수배 중이면 성당의 이단심문관이 뒤를 밟는다
  if (s.heretic && !power(s, "oblivion", 4) && rngOf(s).chance(FAITH_BAL.inquisitorChance)) {
    log(s, "등 뒤에서 쇠사슬 끌리는 소리 — 성당의 이단심문관이 길을 막아선다!", "hurt");
    log(s, "\"옛 신의 이름을 입에 올린 자여, 여기가 네 무덤이다.\"", "story");
    startCombat(s, "dungeon", makeEnemies(s, ["inquisitor"]));
    return;
  }
  arrive(s, false);
}

function flavor(s: GameState, room: Room, key: string): string {
  const list = (s.dungeon && SECTOR_FLAVOR[s.dungeon.sector]?.[key]) || ROOM_FLAVOR[key] || ROOM_FLAVOR.empty;
  return list[room.flavor % list.length];
}

/** 3섹터 물 높이: 12시간마다 밀물·썰물이 바뀐다(2섹터 낮·밤과 같은 주기) */
export function highTide(s: GameState): boolean {
  const dg = s.dungeon;
  if (!dg || dg.sector !== 3 || dg.endless) return false;
  return Math.floor((dg.clock ?? 0) / BAL.dayNightTurns) % 2 === 1;
}

/** 물에 잠긴 방으로 들어가는 이동 시간 배율: 깊은 물 ×2, 밀물 때 침수 방 ×1.5(물장화면 침수 방은 그대로) */
function waterMult(s: GameState, room: Room): number {
  if (room.deep) return 2;
  if (room.flooded && highTide(s) && !gearHas(s, (g) => g.wade).length) return 1.5;
  return 1;
}

/** 깊은 물 헤엄: 무거운 갑옷(도주 −)이면 체력 판정, 실패하면 물을 먹는다. 죽으면 false */
function swim(s: GameState): boolean {
  const body = s.gear.body ? GEAR[s.gear.body] : null;
  const heavy = (body?.bonus.flee ?? 0) < 0;
  const bonus = gearHas(s, (g) => g.swim).reduce((a, g) => a + g.swim!, 0) - (heavy ? 4 : 0);
  const c = check(s, "con", 12, bonus);
  if (c.ok) {
    log(s, "가슴까지 차는 물을 헤엄쳐 건넜다.", "system");
    return true;
  }
  const dmg = rngOf(s).dice(1, 6);
  s.hero.hp -= dmg;
  log(s, `${heavy ? "갑옷이 물을 먹어 가라앉는다 — " : ""}발이 바닥에 닿지 않는다. 물을 잔뜩 먹었다. ${dmg} 피해 (체력 ${c.total} vs 12)`, "hurt");
  if (s.hero.hp <= 0) {
    s.hero.hp = 0;
    kill(s, "abyss", "물에 잠긴 사원에서 익사했다");
    return !isDead(s);
  }
  return true;
}

/** 2섹터부터 낮·밤이 있다(12시간마다 바뀜) */
export function isNight(s: GameState): boolean {
  const dg = s.dungeon;
  if (!dg || dg.sector !== 2) return false; // 낮·밤은 2섹터(초원)에만 — 1섹터와 끝없는 미궁은 땅속
  return Math.floor((dg.clock ?? 0) / BAL.dayNightTurns) % 2 === 1;
}

/** 방에 도착했을 때의 처리 */
function arrive(s: GameState, firstOfFloor: boolean): void {
  const dg = d(s);
  const room = currentRoom(s);
  const firstVisit = !room.visited;
  room.visited = true;

  // 썰물 때 물에 잠긴 방 바닥의 공양물(작은 마석)
  if (room.offering && !highTide(s)) {
    room.offering = false;
    const mana = rngOf(s).int(8, 20) * dg.floor;
    dg.mana += mana;
    log(s, `물이 빠진 바닥에 공양 그릇이 드러났다. 가라앉아 있던 마석 조각을 주웠다. (${mana}G 어치)`, "good");
  } else if (room.offering && firstVisit) log(s, "물 아래에서 무언가 반짝인다. 물이 빠지면 주울 수 있겠다.", "system");
  if (room.type === "entrance") {
    if (firstVisit) log(s, flavor(s, room, dg.floor === 1 && firstOfFloor ? "entrance" : "arrival"), "story");
    room.known = true;
  } else if (room.type === "stairs" && dg.first && dg.sector === 1 && dg.floor === 1) {
    // 첫 미궁: 아래층은 아직 무리다. 대신 누군가 떨어뜨린 귀환 주문서가 있다
    room.known = true;
    if (firstVisit) {
      log(s, flavor(s, room, "stairs"), "story");
      log(s, "계단 아래에서 차가운 바람과 낯선 숨소리가 올라온다. 다리가 굳어 한 발짝도 내려갈 수 없다 — 첫 미궁은 여기까지다.", "story");
      log(s, "계단 옆 돌 틈에 누군가 떨어뜨린 귀환 주문서 한 장이 끼어 있다. 찢으면 곧장 미궁 입구로 돌아간다.", "good");
    } else log(s, "떨어진 귀환 주문서는 그 자리에 그대로 있다.", "story");
    dg.pending = { kind: "lostScroll" };
  } else if (room.type === "stairs" || room.type === "portal") {
    room.known = true;
    log(s, flavor(s, room, room.type), "story");
    dg.pending = { kind: room.type };
  } else if (room.resolved) {
    log(s, `이미 지나온 곳이다. (${ROOM_LABEL[room.type]})`);
  } else {
    switch (room.type) {
      case "empty":
        room.known = true;
        room.resolved = true;
        log(s, flavor(s, room, "empty"), "story");
        break;
      case "combat":
      case "boss": {
        room.known = true;
        log(s, room.respawned ? "비워 두었던 방에 다시 무언가 자리를 잡았다." : flavor(s, room, room.type), "story");
        // 하피는 낮에만 나온다
        let ids = room.encounter ?? ["rat"];
        if (isNight(s) && !room.remaining) {
          const day = ids.filter((m) => !MONSTERS[m].dayOnly);
          if (day.length < ids.length) log(s, "밤이라 하피들은 둥지로 돌아가고 없다.", "system");
          ids = day.length ? day : ["wolf"];
        }
        const enemies = room.remaining ?? makeEnemies(s, ids);
        room.remaining = undefined;
        startCombat(s, "dungeon", enemies);
        return;
      }
      case "trap":
        // 매복 전투가 벌어졌으면 전투 뒤처리(afterDungeonCombat)가 엿보기까지 끝낸다
        if (arriveTrap(s, room) || isDead(s) || dg.pending) return;
        break;
      case "treasure":
      case "record":
      case "shrine":
      case "relic":
      case "altar":
        room.known = true;
        log(s, flavor(s, room, room.type), "story");
        dg.pending = { kind: room.type };
        break;
    }
  }
  peek(s);
}

/** 연결된 미확인 방들을 감각 판정으로 미리 알아낸다(전장의 안개의 텍스트판) */
function peek(s: GameState): void {
  const dg = d(s);
  if (!canPeek(s)) return; // 머리 중상
  for (const id of currentRoom(s).edges) {
    const nb = dg.rooms[id];
    if (nb.known) continue;
    if (check(s, "per", BAL.peekDc, faithPeek(s) - (isNight(s) ? 2 : 0)).ok) {
      nb.known = true;
      note(s, "per");
      log(s, `앞쪽 통로 너머의 낌새를 읽었다 — ${ROOM_LABEL[nb.type]}.`, "system");
    }
  }
}

/** 함정방 도착. 매복 전투가 벌어졌으면 true */
function arriveTrap(s: GameState, room: Room): boolean {
  const dg = d(s);
  if (room.known) {
    log(s, "알고 있던 함정이다. 바닥의 어색한 돌이 보인다.", "system");
    spotAmbush(s, room);
    dg.pending = { kind: "trap" };
    return false;
  }
  const c = check(s, "per", BAL.trapDetectDc, faithTrapSense(s));
  room.known = true;
  if (c.ok) {
    note(s, "per");
    log(s, `${flavor(s, room, room.trapKind === "pit" ? "pit" : "trap")} ${room.trapKind === "pit" ? "꺼진 바닥" : "함정"}을 알아챘다! (감각 ${c.total} vs ${BAL.trapDetectDc})`, "system");
    spotAmbush(s, room);
    dg.pending = { kind: "trap" };
    return false;
  }
  return springTrap(s, room);
}

/** 함정을 알아챈 김에 숨은 고블린도 알아채는지 */
function spotAmbush(s: GameState, room: Room): void {
  if (!room.ambush || room.ambushKnown) return;
  if (power(s, "trap", 2) || check(s, "per", BAL.ambushSpotDc, faithTrapSense(s)).ok) {
    room.ambushKnown = true;
    log(s, `벽 틈에서 눈빛이 번뜩인다 — 고블린 ${room.ambush.length}마리가 함정을 밟기를 기다리고 있다.`, "system");
  }
}

/** 꺼진 바닥에 빠졌다: 2d6(3층은 3d6) 피해, 발 부상, 2층이면 3층으로 떨어진다. 추락으로 죽으면 심연의 신 */
function fall(s: GameState): boolean {
  const dg = d(s);
  const r = rngOf(s);
  const deep = dg.floor >= 3;
  const dmg = Math.max(1, Math.round(r.dice(deep ? 3 : 2, 6) * faithFallMult(s)));
  s.hero.hp -= dmg;
  log(s, deep ? `바닥이 꺼졌다 — 끝이 보이지 않는 틈으로 미끄러져 내려갔다! ${dmg} 피해` : `바닥이 꺼졌다 — 아래층으로 곤두박질쳤다! ${dmg} 피해`, "hurt");
  if (s.hero.hp <= 0 && power(s, "abyss", 4)) {
    s.hero.hp = 1;
    log(s, `【${GODS.abyss.name}】 떨어지는 자의 축복 — 바닥에 부딪히기 직전, 몸이 깃털처럼 가벼워졌다. (HP 1)`, "skill");
  }
  if (s.hero.hp <= 0) {
    s.hero.hp = 0;
    kill(s, "abyss", deep ? "바닥 없는 틈으로 떨어져 죽었다" : "꺼진 바닥 아래로 떨어져 죽었다");
    if (isDead(s)) return false;
  }
  if (r.chance(INJ.fallFeet)) wound(s, "feet", "떨어지며 발목이 꺾였다");
  pray(s, "trap", 3);
  pray(s, "abyss", 5);
  if (deep) {
    log(s, "한참을 기어 올라와 원래 층의 다른 통로로 빠져나왔다.", "system");
    passTime(s, 8);
    return false;
  }
  dg.floor += 1;
  dg.deepestFloor = Math.max(dg.deepestFloor, dg.floor);
  dg.rooms = generateFloor(r, dg.floor, dg.sector);
  resetSweeper(dg);
  dg.current = 0;
  dg.prev = null;
  log(s, `— ${dg.floor}층에 떨어졌다. 올라갈 길은 없다.`, "system");
  if (dg.floor === 3) remember(s, "미궁 3층까지 떨어졌다.");
  if (!isDead(s)) arrive(s, true);
  return true;
}

/** 함정 작동. 숨어 있던 고블린이 있으면 덮친다(밟아서 다쳤으면 기습). 매복 전투가 벌어졌으면 true */
function springTrap(s: GameState, room: Room): boolean {
  room.resolved = true;
  const c = check(s, "dex", BAL.trapDodgeDc, (power(s, "trap", 1) ? 3 : 0) + (room.trapKind === "pit" && s.skills.includes("earthLevel") ? 5 : 0)); // 땅 고르기
  let hurt = false;
  if (c.ok) {
    note(s, "dex");
    log(s, `발밑에서 가시가 튀어나왔다 — 아슬아슬하게 피했다! (민첩 ${c.total} vs ${BAL.trapDodgeDc})`, "good");
  } else if (power(s, "trap", 3)) {
    // 재앙의 신 ★3 "먼저 오는 경고"
    log(s, "함정이 발동하기 직전, 귓가에 경고가 울렸다 — 몸이 먼저 비켜섰다. (피해 없음)", "good");
  } else if (room.trapKind === "pit") {
    return fall(s);
  } else {
    const dmg = rngOf(s).dice(1, 6);
    s.hero.hp -= dmg;
    const sec = d(s).sector;
    const name = sec === 3 ? "산성 웅덩이" : sec === 2 ? "녹슨 곰덫" : "가시함정";
    log(s, `${josa(name, "을")} 밟았다! ${dmg} 피해 (민첩 ${c.total} vs ${BAL.trapDodgeDc})`, "hurt");
    if (s.hero.hp <= 0) {
      s.hero.hp = 0;
      kill(s, "trap", sec === 3 ? "산성 웅덩이에 빠져 목숨을 잃었다" : sec === 2 ? "녹슨 곰덫에 걸려 목숨을 잃었다" : "가시함정에 목숨을 잃었다");
      if (isDead(s)) return false;
    }
    note(s, "con");
    hurt = true;
    if (sec === 3) corrode(s, 0.6, "산이 장비에 튀었다");
    else if (rngOf(s).chance(sec === 2 ? 0.6 : INJ.spikeFeet)) wound(s, "feet", sec === 2 ? "녹슨 곰덫이 발목을 물었다" : "가시가 발등을 꿰뚫었다");
  }
  pray(s, "trap", 3); // 재앙을 맞고도 살아남았다
  if (!room.ambush) return false;
  const ids = room.ambush;
  room.ambush = undefined;
  if (hurt) log(s, `킥킥거리는 소리 — 숨어 있던 고블린 ${ids.length}마리가 비틀거리는 틈을 노리고 덮친다!`, "hurt");
  else log(s, `함정을 피하자 숨어 있던 고블린 ${ids.length}마리가 혀를 차며 뛰쳐나온다.`, "hurt");
  startCombat(s, "dungeon", makeEnemies(s, ids), { surprise: hurt });
  return true;
}

export type PendingChoice =
  | "disarm" | "force" | "back"
  | "open" | "leave"
  | "read"
  | "pray"
  | "descend" | "stay"
  /** 첫 미궁 1층 계단: 떨어진 귀환 주문서를 쓴다 */
  | "use"
  /** 심연의 신 ★1: 꺼진 바닥으로 뛰어내리기 */
  | "jump"
  /** 차원문: 돌아가기 / 전쟁의 흔적: 조사 */
  | "return"
  | "search"
  | "enter"
  | "equip"
  /** 성소: 해금된 n번째 신으로 개종 */
  | `convert${number}`
  /** 편린: 빈 칸에 흡수 */
  | "absorb"
  /** 편린: n번째 편린을 깨뜨리고 흡수 */
  | `swap${number}`;

export function resolvePending(s: GameState, choice: PendingChoice): void {
  const dg = s.dungeon;
  if (!dg || !dg.pending || s.phase !== "dungeon") return;
  resolveOne(s, choice);
  // 이어지는 선택(보스 처치 후 편린 → 장비 등)
  if (s.phase === "dungeon" && s.dungeon && !s.dungeon.pending && s.dungeon.queue?.length) {
    s.dungeon.pending = s.dungeon.queue.shift()!;
  }
}

function resolveOne(s: GameState, choice: PendingChoice): void {
  const dg = s.dungeon!;
  const room = currentRoom(s);
  const pend = dg.pending!;
  const kind = pend.kind;
  dg.pending = null;
  const r = rngOf(s);

  if (kind === "trap" && choice === "jump" && room.trapKind === "pit" && power(s, "abyss", 1) && dg.floor < 3) {
    // 심연의 신 ★1: 꺼진 바닥으로 일부러 뛰어내린다(아래층 지름길)
    room.resolved = true;
    const dmg = r.dice(1, 6);
    s.hero.hp = Math.max(1, s.hero.hp - dmg);
    log(s, `심연을 향해 스스로 몸을 던졌다. 착지가 거칠다. ${dmg} 피해`, "story");
    pray(s, "abyss", 5);
    dg.floor += 1;
    dg.deepestFloor = Math.max(dg.deepestFloor, dg.floor);
    dg.rooms = generateFloor(r, dg.floor, dg.sector);
    resetSweeper(dg);
    dg.current = 0;
    dg.prev = null;
    log(s, `— ${dg.floor}층에 내려섰다.`, "system");
    arrive(s, true);
    return;
  }

  if (kind === "trap") {
    if (choice === "back" && dg.prev !== null) {
      log(s, "함정을 피해 왔던 길로 물러났다.");
      pray(s, "trap", -2);
      const back = dg.prev;
      dg.prev = dg.current;
      dg.current = back;
      passTime(s, BAL.moveTurns);
      if (!checkTimeUp(s)) peek(s);
      return;
    }
    if (choice === "disarm") {
      passTime(s, 1);
      const c = check(s, "dex", BAL.trapDisarmDc, (power(s, "trap", 1) ? 3 : 0) + (s.skills.includes("earthLevel") || s.skills.includes("trapHand") ? 3 : 0));
      if (c.ok) {
        note(s, "per");
        room.resolved = true;
        log(s, `함정을 해체했다. (민첩 ${c.total} vs ${BAL.trapDisarmDc})`, "good");
        pray(s, "trap", 4);
        if (power(s, "trap", 2)) {
          dg.mana += dg.floor * 10;
          log(s, `함정 장치에 박혀 있던 마석 조각을 빼냈다. (${dg.floor * 10}G 어치)`, "good");
        }
        if (power(s, "trap", 4) && !dg.trapCharge) {
          dg.trapCharge = true;
          log(s, `【${GODS.trap.name}】 함정 다루기 — 해체한 장치를 챙겼다. 다음 전투에서 적에게 터뜨린다.`, "skill");
        }
        if (room.ambush) {
          log(s, `숨어 있던 고블린 ${room.ambush.length}마리가 겁을 먹고 달아났다. 비겁한 놈들이다.`, "system");
          room.ambush = undefined;
        }
      } else {
        log(s, `해체하다 함정이 작동했다! (민첩 ${c.total} vs ${BAL.trapDisarmDc})`, "hurt");
        if (springTrap(s, room)) return;
      }
    } else {
      log(s, "이를 악물고 함정 위를 지나간다.");
      if (springTrap(s, room)) return;
    }
    if (!isDead(s)) peek(s);
    return;
  }

  if (kind === "treasure") {
    if (choice === "leave") {
      log(s, "상자를 그대로 두고 지나쳤다.");
      dg.pending = null;
      return;
    }
    room.resolved = true;
    passTime(s, 1);
    if (r.die(20) + smod(s, "luk") < 6) {
      const dmg = r.dice(1, 4);
      s.hero.hp -= dmg;
      log(s, `상자에 독침이 숨겨져 있었다! ${dmg} 피해`, "hurt");
      if (s.hero.hp <= 0) {
        s.hero.hp = 0;
        kill(s, "trap", "보물상자의 독침에 목숨을 잃었다");
        return;
      }
    }
    let mana = r.int(12, 30) + dg.floor * 6;
    dg.mana += mana;
    const got = [`마석(${mana}G 어치)`];
    if (r.chance(0.4)) {
      s.inventory.potion += 1;
      got.push("치료 물약 1개");
    } else if (r.chance(0.5)) {
      s.inventory.food += 1;
      got.push("말린 고기 1개");
    }
    note(s, "luk");
    log(s, `상자에서 ${got.join(", ")}을 얻었다.`, "good");
    if (r.chance(0.25 + dg.floor * 0.1)) offerGear(s, rollLoot(s));
    return;
  }

  if (kind === "gear" && pend.kind === "gear") {
    const g = GEAR[pend.item];
    if (choice === "equip") {
      clearCorrosion(s, targetSlot(s, pend.item));
      const old = equip(s, pend.item);
      remember(s, `미궁에서 ${josa(g.name, "을")} 얻었다.`);
      log(s, `${josa(g.name, "을")} 착용했다.${old ? ` ${josa(GEAR[old].name, "은")} 여기 두고 간다.` : ""}`, "good");
    } else {
      log(s, `${josa(g.name, "은")} 두고 가기로 했다. (착용하지 않은 물건은 가지고 나갈 수 없다)`);
    }
    return;
  }

  if (kind === "frag" && pend.kind === "frag") {
    resolveFrag(s, pend.frag, choice);
    return;
  }

  if (kind === "relic") {
    room.resolved = true;
    if (choice !== "search") {
      log(s, "죽은 자들의 물건에는 손대지 않기로 했다.");
      return;
    }
    passTime(s, 2);
    const roll = r.float();
    if (roll < 0.4) {
      log(s, "녹슨 무기 더미를 뒤지다 아직 쓸 만한 것을 찾았다.", "good");
      offerGear(s, rollLoot(s));
    } else if (roll < 0.7) {
      log(s, "갑옷 더미가 덜그럭거리며 일어선다 — 잠든 망령을 깨웠다!", "hurt");
      startCombat(s, "dungeon", makeEnemies(s, ["wraith"]));
    } else {
      readRecord(s, room, WAR_RECORDS, "찢어진 군기에 적힌 기록");
    }
    return;
  }

  if (kind === "altar") {
    room.resolved = true;
    if (choice === "pray" && god(s) === "plague") {
      passTime(s, 2);
      addPiety(s, 3);
      log(s, `썩은 공양 그릇 앞에 무릎 꿇었다. 익숙한 열기가 가슴에 번진다. (신앙심 ${s.piety})`, "story");
      return;
    }
    if (choice !== "search") {
      log(s, "썩은 제물에는 손대지 않기로 했다.");
      return;
    }
    passTime(s, 2);
    const roll = r.float();
    if (roll < 0.4) {
      log(s, "썩은 제물 사이에서 아직 쓸 만한 것을 건져 냈다.", "good");
      offerGear(s, rollLoot(s));
    } else if (roll < 0.7) {
      log(s, "제물 그릇에 손을 넣었다가 무언가에 찔렸다.", "hurt");
      poisonAfflict(s, 1, "썩은 제물의 독이 손끝으로 스민다");
    } else {
      readRecord(s, room, PLAGUE_RECORDS, "제단 밑에 깔린 기도문");
    }
    return;
  }

  if (kind === "record") {
    room.resolved = true;
    if (choice === "read") {
      // 3섹터의 경전은 물에 젖어 있어 말리면서 읽는다
      const wet = dg.sector === 3;
      if (wet) log(s, "물에 불은 경전을 한 장씩 펼쳐 말리며 읽었다. (4시간)", "system");
      passTime(s, wet ? BAL.wetReadTurns : 1);
      if (isDead(s) || !s.dungeon) return;
      s.recordsRead += 1;
      note(s, "int");
      log(s, wet ? PLAGUE_RECORDS[(room.flavor + s.recordsRead) % PLAGUE_RECORDS.length] : RECORDS[(room.flavor + s.recordsRead) % RECORDS.length], "story");
      log(s, `(읽은 기록물 ${s.recordsRead}개)`, "system");
      saga(s);
      pray(s, "song", 4);
      pray(s, "oblivion", -5);
      if (power(s, "song", 1)) {
        s.hero.hp = Math.min(maxHp(s), s.hero.hp + 5);
        log(s, "글자를 읽는 동안 어디선가 노랫소리가 들린다. HP +5", "good");
      }
    } else {
      log(s, "글자를 외면하고 지나쳤다.");
      pray(s, "song", -2);
      pray(s, "oblivion", 6);
    }
    return;
  }

  if (kind === "shrine") {
    room.resolved = true;
    if (choice === "pray") {
      passTime(s, 2);
      const heal = r.dice(1, 4) + 1;
      s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
      log(s, `옛 신의 제단 앞에 무릎 꿇었다. 이상하게 마음이 놓인다. HP +${heal}`, "good");
      // 기도하면 마음 하나가 가라앉는다
      const calm = MIND_KEYS.find((k) => has(s, k));
      if (calm) {
        log(s, s.mind[calm]!.known ? `제단 앞에서 ${josa(MIND_NAME[calm], "이")} 조금씩 풀려 나간다.` : "기도하는 동안 가슴을 누르던 무언가가 풀려 나갔다.", "good");
        cure(s, calm);
      }
      if (god(s)) {
        // 2섹터의 제단은 전쟁의 신 것: 전쟁의 신 신도는 기도 효과 두 배
        addPiety(s, (dg.sector === 2 && god(s) === "war" ? 10 : 5) + (fragSkills(s).includes("fragMimicPrayer") ? 2 : 0));
        log(s, `${s.hero.faith}의 기척이 가까이 느껴진다. (신앙심 ${s.piety})`, "story");
      }
    } else if (choice.startsWith("convert")) {
      passTime(s, 2);
      const name = s.faithsKnown[Number(choice.slice(7))];
      if (name) convert(s, name);
    } else {
      log(s, "성당의 눈을 떠올리고, 제단을 지나쳤다.");
    }
    return;
  }

  if (kind === "lostScroll") {
    if (choice !== "use") {
      log(s, "주문서는 그 자리에 두고, 이 층을 더 둘러보기로 했다.");
      return;
    }
    pray(s, "abyss", -5);
    log(s, "주인 잃은 귀환 주문서를 찢었다. 빛과 함께 미궁 입구로 돌아왔다.", "system");
    leaveDungeon(s, { cleared: false, forced: false });
    return;
  }

  if (kind === "stairs") {
    if (choice === "stay") {
      log(s, "조금 더 둘러보기로 했다.");
      return;
    }
    dg.floor += 1;
    dg.deepestFloor = Math.max(dg.deepestFloor, dg.floor);
    dg.rooms = dg.endless ? generateEndlessFloor(r, dg.floor) : generateFloor(r, dg.floor, dg.sector);
    resetSweeper(dg);
    dg.current = 0;
    dg.prev = null;
    passTime(s, 1);
    pray(s, "abyss", 8);
    log(s, dg.endless ? `— ${ENDLESS_NAME} ${dg.floor}층으로 내려간다.${dg.floor % ENDLESS_BOSS_EVERY === 0 ? " 아래에서 거대한 기척이 올라온다. (계단 앞에 보스)" : ""}` : `— ${dg.floor}층으로 내려간다.`, "system");
    if (dg.endless && dg.floor % 5 === 0) remember(s, `${ENDLESS_NAME} ${dg.floor}층까지 내려갔다.`);
    if (!dg.endless && dg.floor === 2) remember(s, "미궁 2층에 발을 디뎠다.");
    if (!dg.endless && dg.floor === 3) remember(s, "미궁 3층까지 내려갔다.");
    if (!isDead(s)) arrive(s, true);
    return;
  }

  if (kind === "portal") {
    if (choice === "stay") {
      log(s, "아직은 차원문을 넘지 않기로 했다.");
      return;
    }
    const first = s.rank < dg.sector;
    s.rank = Math.max(s.rank, dg.sector); // 등급 = 클리어한 섹터 수(같은 섹터를 다시 넘어도 오르지 않음)
    remember(s, `${dg.sector}섹터의 차원문에 도달했다.`);
    if (first) log(s, `차원문에 닿았다 — ${dg.sector}섹터 클리어! (등급 ${s.rank})`, "good");
    if (choice === "return") {
      log(s, "차원문의 빛을 등지고, 마석을 챙겨 돌아가기로 했다.", "system");
      leaveDungeon(s, { cleared: true, forced: false, rankUp: first });
      return;
    }
    // 마지막 섹터 차원문 너머: 끝없는 미궁(남은 시간은 그대로)
    if (dg.sector >= LAST_SECTOR) {
      dg.sector = ENDLESS_SECTOR;
      dg.endless = true;
      dg.floor = 1;
      dg.deepestFloor = 1;
      dg.rooms = generateEndlessFloor(r, 1);
      resetSweeper(dg);
      dg.current = 0;
      dg.prev = null;
      remember(s, `${ENDLESS_NAME}에 발을 디뎠다.`);
      log(s, `차원문을 넘었다. — ${ENDLESS_NAME} 1층. 계단은 끝없이 아래로 이어진다. 함정도 보물도 없고, 깊이 내려갈수록 강한 것들만 기다린다. (돌아가려면 귀환 주문서, 아니면 시간이 다 될 때까지)`, "story");
      arrive(s, true);
      return;
    }
    // 차원문 너머: 다음 섹터. 남은 시간은 2배가 된다(섹터마다 시간 흐름이 다르다)
    const before = dg.turnsLeft;
    dg.sector += 1;
    dg.floor = 1;
    dg.deepestFloor = 1;
    dg.turnsLeft = before * 2;
    dg.clock = 0;
    dg.rooms = generateFloor(r, 1, dg.sector);
    resetSweeper(dg);
    dg.current = 0;
    dg.prev = null;
    remember(s, `${dg.sector}섹터 — ${SECTOR_NAME[dg.sector]}에 발을 디뎠다.`);
    log(s, `차원문을 넘었다. — ${dg.sector}섹터, ${SECTOR_NAME[dg.sector]}. (남은 시간 ${Math.round(before / 2)}시간 → ${before}시간)`, "story");
    arrive(s, true);
  }
}

/** 보물상자·보스가 떨어뜨리는 장비(층이 깊을수록 좋은 것이 더 잘 나온다) */
function rollLoot(s: GameState): string {
  const r = rngOf(s);
  const floor = s.dungeon?.floor ?? 1;
  const sector = s.dungeon?.sector ?? 1;
  // 그 섹터까지의 장비가 나오고, 지금 섹터의 장비가 더 잘 나온다
  const pool = Object.values(GEAR)
    .filter((g) => (g.loot ?? 0) > 0 && (g.sector ?? 1) <= sector)
    .map((g) => ({ item: g.id, w: (g.loot ?? 0) + (floor >= 2 && (g.loot ?? 0) <= 2 ? 1 : 0) + (sector > 1 && (g.sector ?? 1) === sector ? 3 : 0) }));
  return r.weighted(pool);
}

function offerGear(s: GameState, id: string): void {
  const g = GEAR[id];
  const slot = targetSlot(s, id);
  const cur = s.gear[slot];
  log(s, `${g.name} — ${g.flavor}`, "story");
  offer(s, { kind: "gear", item: id });
  if (cur) log(s, `(지금 착용: ${GEAR[cur].name})`, "system");
}

/** 선택지를 띄운다. 이미 다른 선택이 떠 있으면 그 뒤에 줄 세운다 */
function offer(s: GameState, p: Pending): void {
  const dg = d(s);
  if (dg.pending) (dg.queue ??= []).push(p);
  else dg.pending = p;
}

/** 전투에서 남은 편린 — 한 전투에 여러 개가 남으면 가장 좋은 것 하나만 붙잡을 수 있다 */
function offerFrag(s: GameState, frags: string[]): void {
  if (frags.length === 0) return;
  const best = [...frags].sort((a, b) => FRAGMENTS[b].tier - FRAGMENTS[a].tier)[0];
  const f = FRAGMENTS[best];
  log(s, fragKnown(s, best) ? `${f.name} — ${f.flavor}` : `${f.name} — 처음 보는 빛이다. 흡수해 보기 전에는 무엇을 줄지 알 수 없다.`, "story");
  if (frags.length > 1) log(s, "편린이 여럿 떠올랐지만, 손에 잡히는 것은 하나뿐이다.", "system");
  offer(s, { kind: "frag", frag: best });
}

function resolveFrag(s: GameState, id: string, choice: PendingChoice): void {
  const f = FRAGMENTS[id];
  const slots = fragSlots(s.hero.level);
  if (choice === "absorb" && s.fragments.length < slots) {
    s.fragments.push(id);
  } else if (choice.startsWith("swap")) {
    const i = Number(choice.slice(4));
    const old = s.fragments[i];
    if (old === undefined) return;
    s.fragments[i] = id;
    log(s, `${josa(FRAGMENTS[old].name, "을")} 깨뜨렸다. 몸에서 빛이 빠져나간다.`, "system");
    s.hero.hp = Math.min(s.hero.hp, maxHp(s));
  } else {
    log(s, `${josa(f.name, "은")} 손가락 사이로 흩어져 사라졌다.`);
    return;
  }
  const skill = f.skill ? SKILLS[f.skill] : null;
  if (!fragKnown(s, id)) {
    s.codex.fragKnown.push(id);
    log(s, `처음 흡수한 편린이다 — ${f.flavor} (도감에 기록되었다)`, "story");
  }
  remember(s, `${josa(f.name, "을")} 흡수했다.`);
  log(s, `${josa(f.name, "을")} 흡수했다! ${fragStatText(id)}${skill ? ` · 능력 【${skill.name}】 ${skill.desc}` : ""}`, "good");
}

/** 미궁의 청소부와 마주쳤다 */
function sweeperFight(s: GameState, from: "move" | "camp"): void {
  const dg = d(s);
  dg.sweeperFrom = from;
  const id = sweeperId(dg.sector);
  log(s, from === "camp" ? "잠결에 공기가 무거워진다 — 눈을 뜨자 그것이 방을 가득 메우고 있다!" : "방에 들어서자 그것이 기다리고 있었다 — 미궁의 청소부!", "hurt");
  startCombat(s, "dungeon", makeEnemies(s, [id]));
}

export function afterDungeonCombat(s: GameState, outcome: "win" | "fled", c: CombatState): void {
  const dg = d(s);
  const room = currentRoom(s);
  s.phase = "dungeon";
  // 미궁의 청소부: 방의 사건과 별개. 이기면 큰 보상, 도망치면 직전 방으로(청소부는 그 방에 남아 계속 쫓는다)
  const sw = c.enemies.find((e) => MONSTERS[e.defId]?.hidden);
  if (sw) {
    const from = dg.sweeperFrom;
    dg.sweeperFrom = undefined;
    if (outcome === "win") {
      dg.sweeperDown = true;
      dg.sweeperRoom = null;
      const mana = BAL.sweeperMana[dg.endless ? LAST_SECTOR : dg.sector] ?? 0;
      dg.mana += mana;
      remember(s, `${josa(MONSTERS[sw.defId].name, "을")} 쓰러뜨렸다.`);
      log(s, `${josa(MONSTERS[sw.defId].name, "이")} 무너져 내린다. 녹과 먼지 속에서 커다란 마석(${mana}G 어치)이 굴러 나왔다.`, "crit");
      if (!s.codex.fragSeen.includes(sw.defId)) s.codex.fragSeen.push(sw.defId);
      offerFrag(s, [sw.defId]);
      if (from === "move" && !dg.pending) arrive(s, false);
    } else {
      const back = dg.prev !== null && dg.prev !== dg.current ? dg.prev : currentRoom(s).edges.find((e) => e !== dg.sweeperRoom);
      if (back !== undefined) {
        dg.prev = dg.current;
        dg.current = back;
        log(s, "청소부의 팔을 피해 옆 통로로 굴러 나왔다. 그것은 아직 뒤에 있다.", "hurt");
        passTime(s, 1);
        checkTimeUp(s);
      }
    }
    return;
  }
  // 이단심문관: 방의 사건과 별개. 이기면 신앙심 +10 후 그 방에 원래대로 들어서고, 도망치면 직전 방으로
  if (c.enemies.some((e) => e.defId === "inquisitor")) {
    if (outcome === "win") {
      remember(s, "이단심문관을 쓰러뜨렸다.");
      log(s, "심문관이 쓰러졌다. 품에서 떨어진 현상수배서에 당신의 이름이 적혀 있다.", "good");
      if (god(s)) {
        addPiety(s, FAITH_BAL.inquisitorPiety);
        log(s, `${josa(s.hero.faith!, "이")} 기뻐한다. (신앙심 +${FAITH_BAL.inquisitorPiety} → ${s.piety})`, "story");
      }
      arrive(s, false);
    } else if (dg.prev !== null) {
      dg.current = dg.prev;
      dg.prev = room.id;
      log(s, "심문관을 따돌리고 왔던 길로 물러났다.");
      passTime(s, 1);
      checkTimeUp(s);
    }
    return;
  }
  const roomFight = room.type === "combat" || room.type === "boss";
  // 리젠된 몬스터의 마석은 절반(희귀 개체 보너스는 그대로)
  const sm = dg.endless ? BAL.endlessManaSectorMult : BAL.manaSectorMult[dg.sector] ?? 1;
  const rm = dg.endless ? BAL.endlessManaSectorMult : BAL.rareSectorMult[dg.sector] ?? sm;
  const floorMult = dg.endless ? endlessManaMult(dg.floor) : MANA_FLOOR_MULT[dg.floor];
  const loot = Math.round(c.loot * floorMult * sm * (roomFight && room.respawned ? BAL.respawnManaMult : 1)) + Math.round(c.bonus * rm);
  if (c.bonus > 0) remember(s, `희귀 개체를 잡아 마석 ${Math.round(c.bonus * rm)}G 어치를 얻었다.`);
  if (outcome === "win") {
    if (roomFight) {
      room.resolved = true; // 야영 중 기습 전투는 방 사건과 무관
      room.respawned = false;
    }
    if (loot > 0) {
      dg.mana += loot;
      log(s, `쓰러진 적에게서 마석(${loot}G 어치)을 챙겼다.`, "good");
    }
    offerFrag(s, c.frags);
    // 정예 희귀 개체(하피 여왕): 고유 보상
    const elite = SECTOR_ELITES[dg.sector];
    if (elite && c.enemies.some((e) => e.defId === elite.id && !e.fled)) {
      remember(s, `${josa(MONSTERS[elite.id].name, "을")} 쓰러뜨렸다.`);
      log(s, `${josa(MONSTERS[elite.id].name, "이")} 쓰러지며 두르고 있던 것이 땅에 떨어진다.`, "good");
      offerGear(s, elite.reward);
    }
    if (room.type === "boss") {
      const bossId = room.encounter?.[0] ?? "boss";
      remember(s, `${josa(MONSTERS[bossId].name, "을")} 쓰러뜨렸다.`);
      log(s, "보스가 쓰러지자 차원문의 빛이 한층 밝아진다.", "story");
      // 보스 증표는 섹터마다 처음 한 번만
      const t = TROPHIES.find((x) => x.sector === dg.sector);
      if (t && !s.trophies.includes(t.item)) {
        s.trophies.push(t.item);
        s.inventory[t.item] += 1;
        log(s, `${josa(t.name, "을")} 얻었다. 직업교관이 레벨 ${t.gateLevel + 1} 훈련의 대가로 요구하는 물건이다.`, "good");
      } else if (t) {
        log(s, `이번에는 ${t.name} 같은 것은 남지 않았다.`, "system");
      }
      if (dg.sector === 2 || dg.sector === 3) {
        s.recordsRead += 1;
        const list = dg.sector === 3 ? PLAGUE_RECORDS : WAR_RECORDS;
        log(s, list[(s.recordsRead + room.flavor) % list.length], "story");
        log(s, `(${dg.sector === 3 ? "균모의 뿌리에 감겨 있던 기도문" : "장군의 안장 주머니에서 나온 기록"} — 읽은 기록물 ${s.recordsRead}개)`, "system");
      }
      log(s, "보스가 지키던 자리에서 무언가 반짝인다.", "system");
      offerGear(s, rollLoot(s));
      return;
    }
    if (dg.pending) return;
    if (!checkTimeUp(s)) peek(s);
    return;
  }
  // 도주: 남은 적은 그 방에 그대로 남고, 직전 방으로 물러난다
  const left = c.enemies.filter((e) => e.hp > 0);
  if (roomFight) room.remaining = left;
  dg.mana += loot;
  if (dg.prev !== null) {
    const back = dg.prev;
    dg.prev = dg.current;
    dg.current = back;
    log(s, `${josa(describeGroup(left), "을")} 남겨두고 이전 방으로 물러났다.`);
  }
  passTime(s, 1);
  if (!checkTimeUp(s)) offerFrag(s, c.frags);
}

export function camp(s: GameState): void {
  const dg = s.dungeon;
  if (!dg || s.combat || dg.pending || s.phase !== "dungeon") return;
  const r = rngOf(s);
  log(s, "벽에 등을 기대고 야영한다. (8시간)", "system");
  pray(s, "oblivion", 1); // 잠은 망각이다
  passTime(s, BAL.campTurns);
  if (isDead(s)) return;
  s.hero.satiety = Math.max(0, s.hero.satiety - 6); // 휴식하면 포만감이 더 빨리 닳는다(DESIGN 11절 트레이드오프)
  s.hero.fatigue = Math.max(0, s.hero.fatigue - 60);
  const heal = Math.max(1, Math.floor((4 + Math.max(0, smod(s, "con")) + (power(s, "song", 2) ? 3 : 0)) * campHealMult(s)));
  s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
  log(s, `피로가 풀렸다. HP +${heal}${campHealMult(s) < 1 ? " (기침 때문에 깊이 잠들지 못했다)" : ""}`, "good");
  restHazards(s);
  // 미궁의 청소부: 8시간 자는 동안 두 방 다가온다
  if (sweeperStep(s, 2)) return sweeperFight(s, "camp");
  // 물에 잠긴 방 옆에서 자면 거머리가 더 잘 꼬인다
  const wet = dg.sector === 3 && dg.floor >= 2 && (currentRoom(s).flooded || currentRoom(s).edges.some((e) => dg.rooms[e].flooded));
  if (r.chance(isNight(s) || wet ? 0.3 : 0.15)) {
    log(s, "잠결에 무언가 다가오는 소리!", "hurt");
    let ids = dg.endless ? endlessGroup(r, dg.floor).slice(0, 2) : campAmbush(dg.sector, dg.floor);
    if (ids.includes("leech") && !currentRoom(s).flooded) ids = ["plaguerat", "plaguerat", "plaguerat"]; // 거머리는 물에 잠긴 방에만
    startCombat(s, "dungeon", makeEnemies(s, ids));
    return;
  }
  checkTimeUp(s);
}

/** 미궁에서 배가 고프면 알아서 먹는다(행동이 끝날 때마다, 전투 중 제외). 기아/풍요의 신도는 굶주림이 오고서야 */
export const AUTO_EAT_AT = 20;
export function autoEat(s: GameState): void {
  if (s.phase !== "dungeon" || !s.dungeon || s.combat || s.inventory.food <= 0 || s.tactics.autoEat === false) return;
  const at = god(s) === "hunger" ? 0 : AUTO_EAT_AT;
  if (s.hero.satiety > at) return;
  log(s, "배가 고파 말린 고기를 꺼냈다.", "system");
  eat(s);
}

export function eat(s: GameState): void {
  if (!s.dungeon || s.inventory.food <= 0 || s.combat) return;
  if (s.hero.satiety >= 80) pray(s, "hunger", -3);
  s.inventory.food -= 1;
  s.hero.satiety = Math.min(100, s.hero.satiety + 40);
  passTime(s, 1);
  log(s, "말린 고기를 씹었다. 포만감 +40", "good");
  if (power(s, "hunger", 1)) {
    s.hero.hp = Math.min(maxHp(s), s.hero.hp + 3);
    log(s, "배 속이 따뜻해진다. HP +3", "good");
  }
}

export function drinkPotion(s: GameState): void {
  if (!s.dungeon || s.inventory.potion <= 0 || s.combat) return;
  s.inventory.potion -= 1;
  const heal = potionHeal(s);
  s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
  log(s, `치료 물약을 마셨다. HP +${heal}`, "good");
}

export function useScroll(s: GameState): void {
  if (!s.dungeon || s.inventory.scroll <= 0 || s.combat || s.phase !== "dungeon") return;
  s.inventory.scroll -= 1;
  pray(s, "abyss", -5);
  log(s, "귀환 주문서를 찢었다. 빛과 함께 미궁 입구로 돌아왔다.", "system");
  leaveDungeon(s, { cleared: false, forced: false });
}

function leaveDungeon(s: GameState, opts: { cleared: boolean; forced: boolean; rankUp?: boolean }): void {
  const dg = d(s);
  const sector = dg.sector;
  const mana = dg.mana;
  const deepest = dg.deepestFloor;
  s.dungeon = null;
  s.hero.hp = Math.max(1, s.hero.hp);
  const lines: string[] = [];
  leaveHazards(s, lines);
  beginSettlement(s, { mana, cleared: opts.cleared, forced: opts.forced, deepest, sector, rankUp: !!opts.rankUp, extra: lines });
}

/** 기록물 한 편 읽기(전쟁의 흔적·공양 제단에서 나온 것) */
function readRecord(s: GameState, room: Room, list: string[], where: string): void {
  s.recordsRead += 1;
  note(s, "int");
  pray(s, "song", 4);
  pray(s, "oblivion", -5);
  log(s, list[(room.flavor + s.recordsRead) % list.length], "story");
  log(s, `(${where} — 읽은 기록물 ${s.recordsRead}개)`, "system");
  saga(s);
}

/** 시와 노래의 신 ★4 "영웅담": 기록물을 읽을 때마다 이 미궁 동안 명중·판정 +1(최대 3) */
function saga(s: GameState): void {
  const dg = s.dungeon;
  if (!dg || !power(s, "song", 4) || (dg.saga ?? 0) >= 3) return;
  dg.saga = (dg.saga ?? 0) + 1;
  log(s, `【${GODS.song.name}】 영웅담 — 읽은 이야기가 몸에 붙는다. (이 미궁 동안 명중·판정 +${dg.saga})`, "skill");
}

export function monsterName(id: string): string {
  return MONSTERS[id]?.name ?? id;
}
