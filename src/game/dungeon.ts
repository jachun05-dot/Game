import { BAL, ENCOUNTERS, MANA_FLOOR_MULT, MONSTERS, RECORDS, ROOM_FLAVOR } from "./data";
import { check, isDead, kill, log, maxHp, note, rngOf } from "./core";
import { describeGroup, makeEnemies, startCombat } from "./combat";
import { beginSettlement } from "./town";
import type { Rng } from "./rng";
import type { CombatState, DungeonState, GameState, Room, RoomType } from "./types";

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
  take("trap", 1 + floor); // 함정: 층이 깊을수록 증가(웹 데모 규칙 2+층수를 방 수에 맞춰 축소)
  take("record", r.int(1, 2), isDeadEnd);
  if (r.chance(0.35)) take("shrine", 1);
  const combats = Math.ceil(free.length * 0.4);
  take("combat", combats);

  for (const room of rooms) {
    if (room.type === "combat") room.encounter = r.weighted(ENCOUNTERS[floor]);
    if (room.type === "boss") room.encounter = ["boss", ...Array(r.int(2, 3)).fill("rat")];
  }
  return rooms;
}

export function enterDungeon(s: GameState): void {
  const r = rngOf(s);
  s.week = 4;
  s.hero.fatigue = 0;
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
  h.satiety = Math.max(0, h.satiety - turns * 0.5);
  h.fatigue = Math.min(100, h.fatigue + turns / 3);
  if (wasFed && h.satiety <= 0) log(s, "배가 고파 손이 떨린다. (굶주림: 판정 -2)", "hurt");
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
        log(s, flavor(room, room.type), "story");
        const enemies = room.remaining ?? makeEnemies(s, room.encounter ?? ["rat"]);
        room.remaining = undefined;
        startCombat(s, "dungeon", enemies);
        return;
      }
      case "trap":
        arriveTrap(s, room);
        if (isDead(s) || dg.pending) return;
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

function arriveTrap(s: GameState, room: Room): void {
  const dg = d(s);
  if (room.known) {
    log(s, "알고 있던 함정이다. 바닥의 어색한 돌이 보인다.", "system");
    dg.pending = { kind: "trap" };
    return;
  }
  const c = check(s, "per", BAL.trapDetectDc);
  room.known = true;
  if (c.ok) {
    note(s, "per");
    log(s, `${flavor(room, "trap")} 함정을 알아챘다! (감각 ${c.total} vs ${BAL.trapDetectDc})`, "system");
    dg.pending = { kind: "trap" };
    return;
  }
  springTrap(s, room);
}

function springTrap(s: GameState, room: Room): void {
  room.resolved = true;
  const c = check(s, "dex", BAL.trapDodgeDc);
  if (c.ok) {
    note(s, "dex");
    log(s, `발밑에서 가시가 튀어나왔다 — 아슬아슬하게 피했다! (민첩 ${c.total} vs ${BAL.trapDodgeDc})`, "good");
    return;
  }
  const dmg = rngOf(s).dice(1, 6);
  s.hero.hp -= dmg;
  log(s, `가시함정을 밟았다! ${dmg} 피해 (민첩 ${c.total} vs ${BAL.trapDodgeDc})`, "hurt");
  if (s.hero.hp <= 0) {
    s.hero.hp = 0;
    kill(s, "trap", "가시함정에 목숨을 잃었다");
    return;
  }
  note(s, "con");
}

export type PendingChoice =
  | "disarm" | "force" | "back"
  | "open" | "leave"
  | "read"
  | "pray"
  | "descend" | "stay"
  | "enter";

export function resolvePending(s: GameState, choice: PendingChoice): void {
  const dg = s.dungeon;
  if (!dg || !dg.pending || s.phase !== "dungeon") return;
  const room = currentRoom(s);
  const kind = dg.pending.kind;
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
      } else {
        log(s, `해체하다 함정이 작동했다! (민첩 ${c.total} vs ${BAL.trapDisarmDc})`, "hurt");
        springTrap(s, room);
      }
    } else {
      log(s, "이를 악물고 함정 위를 지나간다.");
      springTrap(s, room);
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
    if (r.die(20) + Math.floor(s.hero.stats.luk / 5) < 6) {
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
    let extra = "";
    if (r.chance(0.4)) {
      s.inventory.potion += 1;
      extra = ", 치료 물약 1개";
    } else if (r.chance(0.5)) {
      s.inventory.food += 1;
      extra = ", 말린 고기 1개";
    }
    note(s, "luk");
    log(s, `상자에서 마석(${mana}G 어치)${extra}을(를) 얻었다.`, "good");
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
    if (dg.floor === 2) s.history.push("미궁 2층에 발을 디뎠다.");
    if (dg.floor === 3) s.history.push("미궁 3층까지 내려갔다.");
    if (!isDead(s)) arrive(s, true);
    return;
  }

  if (kind === "portal") {
    if (choice === "stay") {
      log(s, "아직은 차원문을 넘지 않기로 했다.");
      return;
    }
    s.rank += 1;
    s.history.push(`${dg.sector}섹터의 차원문에 도달했다.`);
    log(s, "차원문에 손을 뻗자 빛이 몸을 감싼다 — 1섹터 클리어!", "good");
    log(s, "(2섹터는 다음 업데이트 예정 — 이번 달 탐험은 여기까지)", "system");
    leaveDungeon(s, { cleared: true, forced: false });
  }
}

export function afterDungeonCombat(s: GameState, outcome: "win" | "fled", c: CombatState): void {
  const dg = d(s);
  const room = currentRoom(s);
  s.phase = "dungeon";
  const roomFight = room.type === "combat" || room.type === "boss";
  const loot = Math.round(c.loot * MANA_FLOOR_MULT[dg.floor]);
  if (outcome === "win") {
    if (roomFight) room.resolved = true; // 야영 중 기습 전투는 방 사건과 무관
    if (loot > 0) {
      dg.mana += loot;
      log(s, `쓰러진 적에게서 마석(${loot}G 어치)을 챙겼다.`, "good");
    }
    if (room.type === "boss") {
      s.history.push("거대한 돌연변이 쥐를 쓰러뜨렸다.");
      log(s, "보스가 쓰러지자 포탈의 빛이 한층 밝아진다.", "story");
    }
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
    log(s, `${describeGroup(left)}을(를) 남겨두고 이전 방으로 물러났다.`);
  }
  passTime(s, 1);
  checkTimeUp(s);
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
  const heal = 4 + Math.max(0, Math.floor(s.hero.stats.con / 5));
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
  const heal = rngOf(s).dice(2, 4) + 2;
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
