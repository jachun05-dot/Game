import { josa } from "./josa";
import { BAL, ENCOUNTERS, MANA_FLOOR_MULT, MIN_COMBAT_ROOMS, MONSTERS, RARE_BY_FLOOR, RECORDS, ROOM_FLAVOR, TRAP_AMBUSH } from "./data";
import { check, isDead, kill, log, maxHp, note, remember, rngOf, smod } from "./core";
import { FRAGMENTS, fragKnown, fragSlots, fragStatText } from "./fragments";
import { SKILLS } from "./skills";
import { describeGroup, makeEnemies, potionHeal, startCombat } from "./combat";
import { hungerMult } from "./skills";
import { GEAR, equip, targetSlot } from "./gear";
import { beginSettlement } from "./town";
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
};

/** 지도 노드 위 짧은 라벨 */
export const ROOM_SHORT: Record<RoomType, string> = {
  entrance: "입구", empty: "빈방", combat: "적", trap: "함정", treasure: "보물",
  record: "기록", shrine: "성소", stairs: "계단", boss: "보스", portal: "문",
};

export function generateFloor(r: Rng, floor: number): Room[] {
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
  if (r.chance(0.35)) take("shrine", 1);

  const amb = TRAP_AMBUSH[floor];
  for (const room of rooms) {
    if (room.type === "combat") room.encounter = r.weighted(ENCOUNTERS[floor]);
    if (room.type === "boss") room.encounter = ["boss", ...Array(r.int(2, 3)).fill("rat")];
    if (room.type === "trap" && r.chance(amb.chance)) room.ambush = Array(r.int(amb.size[0], amb.size[1])).fill("goblin");
  }
  // 희귀 개체: 전투방 하나를 차지한다
  if (r.chance(BAL.rareChance)) {
    const combatRooms = rooms.filter((x) => x.type === "combat");
    if (combatRooms.length) r.pick(combatRooms).encounter = [RARE_BY_FLOOR[floor]];
  }
  return rooms;
}

export function enterDungeon(s: GameState): void {
  const r = rngOf(s);
  s.week = 4;
  s.hero.fatigue = 0;
  s.tripUsed = [];
  s.dungeon = {
    sector: 1,
    floor: 1,
    rooms: generateFloor(r, 1),
    current: 0,
    prev: null,
    turnsLeft: BAL.weekTurns,
    mana: 0,
    pending: null,
    starvingTurns: 0,
    deepestFloor: 1,
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
  const h = s.hero;
  const wasFed = h.satiety > 0;
  h.satiety = Math.max(0, h.satiety - turns * 0.5 * hungerMult(s));
  h.fatigue = Math.min(100, h.fatigue + turns / 3);
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
    room.encounter = r.weighted(ENCOUNTERS[dg.floor]);
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
  dg.prev = dg.current;
  dg.current = id;
  passTime(s, BAL.moveTurns);
  if (isDead(s)) return;
  if (checkTimeUp(s)) return;
  arrive(s, false);
}

function flavor(room: Room, key: string): string {
  const list = ROOM_FLAVOR[key];
  return list[room.flavor % list.length];
}

/** 방에 도착했을 때의 처리 */
function arrive(s: GameState, firstOfFloor: boolean): void {
  const dg = d(s);
  const room = currentRoom(s);
  const firstVisit = !room.visited;
  room.visited = true;

  if (room.type === "entrance") {
    if (firstVisit) log(s, flavor(room, dg.floor === 1 && firstOfFloor ? "entrance" : "arrival"), "story");
    room.known = true;
  } else if (room.type === "stairs" || room.type === "portal") {
    room.known = true;
    log(s, flavor(room, room.type), "story");
    dg.pending = { kind: room.type };
  } else if (room.resolved) {
    log(s, `이미 지나온 곳이다. (${ROOM_LABEL[room.type]})`);
  } else {
    switch (room.type) {
      case "empty":
        room.known = true;
        room.resolved = true;
        log(s, flavor(room, "empty"), "story");
        break;
      case "combat":
      case "boss": {
        room.known = true;
        log(s, room.respawned ? "비워 두었던 방에 다시 무언가 자리를 잡았다." : flavor(room, room.type), "story");
        const enemies = room.remaining ?? makeEnemies(s, room.encounter ?? ["rat"]);
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
        room.known = true;
        log(s, flavor(room, room.type), "story");
        dg.pending = { kind: room.type };
        break;
    }
  }
  peek(s);
}

/** 연결된 미확인 방들을 감각 판정으로 미리 알아낸다(전장의 안개의 텍스트판) */
function peek(s: GameState): void {
  const dg = d(s);
  for (const id of currentRoom(s).edges) {
    const nb = dg.rooms[id];
    if (nb.known) continue;
    if (check(s, "per", BAL.peekDc).ok) {
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
  const c = check(s, "per", BAL.trapDetectDc);
  room.known = true;
  if (c.ok) {
    note(s, "per");
    log(s, `${flavor(room, "trap")} 함정을 알아챘다! (감각 ${c.total} vs ${BAL.trapDetectDc})`, "system");
    spotAmbush(s, room);
    dg.pending = { kind: "trap" };
    return false;
  }
  return springTrap(s, room);
}

/** 함정을 알아챈 김에 숨은 고블린도 알아채는지 */
function spotAmbush(s: GameState, room: Room): void {
  if (!room.ambush || room.ambushKnown) return;
  if (check(s, "per", BAL.ambushSpotDc).ok) {
    room.ambushKnown = true;
    log(s, `벽 틈에서 눈빛이 번뜩인다 — 고블린 ${room.ambush.length}마리가 함정을 밟기를 기다리고 있다.`, "system");
  }
}

/** 함정 작동. 숨어 있던 고블린이 있으면 덮친다(밟아서 다쳤으면 기습). 매복 전투가 벌어졌으면 true */
function springTrap(s: GameState, room: Room): boolean {
  room.resolved = true;
  const c = check(s, "dex", BAL.trapDodgeDc);
  let hurt = false;
  if (c.ok) {
    note(s, "dex");
    log(s, `발밑에서 가시가 튀어나왔다 — 아슬아슬하게 피했다! (민첩 ${c.total} vs ${BAL.trapDodgeDc})`, "good");
  } else {
    const dmg = rngOf(s).dice(1, 6);
    s.hero.hp -= dmg;
    log(s, `가시함정을 밟았다! ${dmg} 피해 (민첩 ${c.total} vs ${BAL.trapDodgeDc})`, "hurt");
    if (s.hero.hp <= 0) {
      s.hero.hp = 0;
      kill(s, "trap", "가시함정에 목숨을 잃었다");
      return false;
    }
    note(s, "con");
    hurt = true;
  }
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
  | "enter"
  | "equip"
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

  if (kind === "trap") {
    if (choice === "back" && dg.prev !== null) {
      log(s, "함정을 피해 왔던 길로 물러났다.");
      const back = dg.prev;
      dg.prev = dg.current;
      dg.current = back;
      passTime(s, BAL.moveTurns);
      if (!checkTimeUp(s)) peek(s);
      return;
    }
    if (choice === "disarm") {
      passTime(s, 1);
      const c = check(s, "dex", BAL.trapDisarmDc);
      if (c.ok) {
        note(s, "per");
        room.resolved = true;
        log(s, `함정을 해체했다. (민첩 ${c.total} vs ${BAL.trapDisarmDc})`, "good");
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
    const mana = r.int(12, 30) + dg.floor * 6;
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

  if (kind === "record") {
    room.resolved = true;
    if (choice === "read") {
      passTime(s, 1);
      s.recordsRead += 1;
      note(s, "int");
      log(s, RECORDS[(room.flavor + s.recordsRead) % RECORDS.length], "story");
      log(s, `(읽은 기록물 ${s.recordsRead}개)`, "system");
    } else {
      log(s, "글자를 외면하고 지나쳤다.");
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
      log(s, "(신앙 변경은 아직 준비 중)", "system");
    } else {
      log(s, "성당의 눈을 떠올리고, 제단을 지나쳤다.");
    }
    return;
  }

  if (kind === "stairs") {
    if (choice === "stay") {
      log(s, "조금 더 둘러보기로 했다.");
      return;
    }
    dg.floor += 1;
    dg.deepestFloor = Math.max(dg.deepestFloor, dg.floor);
    dg.rooms = generateFloor(r, dg.floor);
    dg.current = 0;
    dg.prev = null;
    passTime(s, 1);
    log(s, `— ${dg.floor}층으로 내려간다.`, "system");
    if (dg.floor === 2) remember(s, "미궁 2층에 발을 디뎠다.");
    if (dg.floor === 3) remember(s, "미궁 3층까지 내려갔다.");
    if (!isDead(s)) arrive(s, true);
    return;
  }

  if (kind === "portal") {
    if (choice === "stay") {
      log(s, "아직은 차원문을 넘지 않기로 했다.");
      return;
    }
    s.rank = Math.max(s.rank, dg.sector); // 등급 = 클리어한 섹터 수(같은 섹터를 다시 넘어도 오르지 않음)
    remember(s, `${dg.sector}섹터의 차원문에 도달했다.`);
    log(s, "차원문에 손을 뻗자 빛이 몸을 감싼다 — 1섹터 클리어!", "good");
    log(s, "(2섹터는 다음 업데이트 예정 — 이번 달 탐험은 여기까지)", "system");
    leaveDungeon(s, { cleared: true, forced: false });
  }
}

/** 보물상자·보스가 떨어뜨리는 장비(층이 깊을수록 좋은 것이 더 잘 나온다) */
function rollLoot(s: GameState): string {
  const r = rngOf(s);
  const floor = s.dungeon?.floor ?? 1;
  const pool = Object.values(GEAR)
    .filter((g) => (g.loot ?? 0) > 0)
    .map((g) => ({ item: g.id, w: (g.loot ?? 0) + (floor >= 2 && (g.loot ?? 0) <= 2 ? 1 : 0) }));
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

export function afterDungeonCombat(s: GameState, outcome: "win" | "fled", c: CombatState): void {
  const dg = d(s);
  const room = currentRoom(s);
  s.phase = "dungeon";
  const roomFight = room.type === "combat" || room.type === "boss";
  // 리젠된 몬스터의 마석은 절반(희귀 개체 보너스는 그대로)
  const loot = Math.round(c.loot * MANA_FLOOR_MULT[dg.floor] * (roomFight && room.respawned ? BAL.respawnManaMult : 1)) + c.bonus;
  if (c.bonus > 0) remember(s, `희귀 개체를 잡아 마석 ${c.bonus}G 어치를 얻었다.`);
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
    if (room.type === "boss") {
      remember(s, "거대한 돌연변이 쥐를 쓰러뜨렸다.");
      log(s, "보스가 쓰러지자 포탈의 빛이 한층 밝아진다.", "story");
      s.inventory.heart += 1;
      log(s, `보스의 가슴에서 ${BAL.heartName}을 꺼냈다. 직업교관이 레벨 4 훈련의 대가로 요구하는 물건이다.`, "good");
      log(s, "쥐의 둥지에서 무언가 반짝인다.", "system");
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
  passTime(s, BAL.campTurns);
  if (isDead(s)) return;
  s.hero.satiety = Math.max(0, s.hero.satiety - 6); // 휴식하면 포만감이 더 빨리 닳는다(DESIGN 11절 트레이드오프)
  s.hero.fatigue = Math.max(0, s.hero.fatigue - 60);
  const heal = 4 + Math.max(0, smod(s, "con"));
  s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
  log(s, `피로가 풀렸다. HP +${heal}`, "good");
  if (r.chance(0.15)) {
    log(s, "잠결에 무언가 다가오는 소리!", "hurt");
    const ids = dg.floor >= 2 ? ["rat", "rat"] : ["rat"];
    startCombat(s, "dungeon", makeEnemies(s, ids));
    return;
  }
  checkTimeUp(s);
}

export function eat(s: GameState): void {
  if (!s.dungeon || s.inventory.food <= 0 || s.combat) return;
  s.inventory.food -= 1;
  s.hero.satiety = Math.min(100, s.hero.satiety + 40);
  passTime(s, 1);
  log(s, "말린 고기를 씹었다. 포만감 +40", "good");
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
  log(s, "귀환 주문서를 찢었다. 빛과 함께 미궁 입구로 돌아왔다.", "system");
  leaveDungeon(s, { cleared: false, forced: false });
}

function leaveDungeon(s: GameState, opts: { cleared: boolean; forced: boolean }): void {
  const dg = d(s);
  const mana = dg.mana;
  const deepest = dg.deepestFloor;
  s.dungeon = null;
  s.hero.hp = Math.max(1, s.hero.hp);
  beginSettlement(s, { mana, cleared: opts.cleared, forced: opts.forced, deepest });
}

export function monsterName(id: string): string {
  return MONSTERS[id]?.name ?? id;
}
