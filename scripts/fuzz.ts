// 버그 사냥용 퍼징: 봇 행동과 무작위 행동(잘못된 행동 포함)을 섞어 수천 판을 돌리며
// 매 행동 뒤 상태 불변식을 검사한다. 예외·멈춤·음수/NaN·말이 안 되는 상태 조합을 찾는다.
// 실행: bun scripts/fuzz.ts [판수] [무작위 비율 0~1] [시작 시드]
// 같은 시드면 같은 결과가 나온다(게임 RNG는 상태 안, 퍼저 RNG는 시드로 고정).
import { newRun } from "../src/game/town";
import { apply, type Action } from "../src/game/engine";
import { botAction } from "../src/game/bot";
import { FAITH, TRAININGS, STAT_KEYS, BAL } from "../src/game/data";
import { GEAR } from "../src/game/gear";
import { maxHp } from "../src/game/core";
import { fragSlots } from "../src/game/fragments";
import type { ClassId } from "../src/game/classes";
import { generateFloor } from "../src/game/dungeon";
import { MONSTERS } from "../src/game/data";
import { FRAGMENTS } from "../src/game/fragments";
import { Rng } from "../src/game/rng";
import type { AutoGoal, GameState, StatKey } from "../src/game/types";

// SCEN=s2(2섹터에서 시작) | heretic(현상수배 상태) | hurt(부상·질병·정신) | strong(고레벨·편린·증표) | mix(판마다 무작위)
const SCEN = process.env.SCEN ?? "";

const N = Number(process.argv[2] ?? 300);
const RAND = Number(process.argv[3] ?? 0.3);
const START = Number(process.argv[4] ?? 1);
const MAX_ACTIONS = Number(process.env.MAX_ACTIONS ?? 40000);
const VERBOSE = !!process.env.VERBOSE;

const CLASSES: ClassId[] = ["adventurer", "warrior", "mage"];
const GOALS: AutoGoal[] = ["explore", "rush", "farm"];
const GODS: (string | null)[] = [null, ...Object.values(FAITH)];
const ITEMS = Object.keys(BAL.prices) as (keyof typeof BAL.prices)[];
const PARTS = ["head", "body", "main", "offhand", "feet"] as const;
const CHOICES = ["disarm", "force", "back", "open", "leave", "read", "pray", "descend", "stay", "jump", "return", "search", "enter", "equip", "absorb", "swap0", "swap1", "swap2", "convert0", "convert1", "convert5"];

// 퍼저 자체 RNG(게임 RNG와 분리)
let fz = 1;
const rnd = () => ((fz = (fz * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];

function randomAction(s: GameState): Action {
  const stat = (): StatKey => pick(STAT_KEYS);
  const k = Math.floor(rnd() * 24);
  switch (k) {
    case 0: return { t: "reroll" };
    case 1: return { t: "pickClass", cls: pick(CLASSES) };
    case 2: return { t: "create", name: "퍼즈", candidate: Math.floor(rnd() * 5) - 1, faith: pick(GODS) };
    case 3: return { t: "activity", a: pick(["train", "rumor", "field", "inn"] as const) };
    case 4: return { t: "train", training: pick(TRAININGS).id, free: [stat(), stat()] };
    case 5: return { t: "buy", item: pick(ITEMS) };
    case 6: return { t: "sell", item: pick(ITEMS) };
    case 7: return { t: "buyGear", id: pick(Object.keys(GEAR)) };
    case 8: return { t: "closeWeek" };
    case 9: case 10: case 11: {
      const dg = s.dungeon;
      const room = dg && rnd() < 0.8 ? pick(dg.rooms[dg.current]?.edges ?? [0]) : Math.floor(rnd() * 40) - 2;
      return { t: "move", room };
    }
    case 12: case 13: return { t: "pending", choice: pick(CHOICES) as never };
    case 14: return { t: "camp" };
    case 15: return { t: "eat" };
    case 16: return { t: "potion" };
    case 17: return { t: "scroll" };
    case 18: return { t: "tactics", tactics: { potionAt: pick([0, 10, 30, 50, 90, 100]), fleeAt: pick([0, 10, 30, 60]) } };
    case 19: return { t: "eraseFrag", index: Math.floor(rnd() * 5) - 1 };
    case 20: return { t: "inquisition", renounce: rnd() < 0.5 };
    case 21: return pick([{ t: "surrender" }, { t: "bandage" }, { t: "herb" }] as Action[]);
    case 22: return { t: rnd() < 0.5 ? "regen" : "prosthetic", part: pick(PARTS) } as Action;
    default: return { t: "closeSettlement" };
  }
}

type Bug = { kind: string; msg: string; seed: number; cls: string; goal: string; faith: string | null; step: number; action: string; phase: string };
const bugs: Bug[] = [];
const seenKinds = new Map<string, number>();

function report(b: Bug) {
  const key = `${b.kind}: ${b.msg}`;
  seenKinds.set(key, (seenKinds.get(key) ?? 0) + 1);
  if (seenKinds.get(key)! <= 3) bugs.push(b);
}

function scanNumbers(o: unknown, path: string, out: string[]) {
  if (typeof o === "number") {
    if (!Number.isFinite(o)) out.push(`${path}=${o}`);
  } else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) if (k !== "log") scanNumbers(v, `${path}.${k}`, out);
  }
}

function invariants(s: GameState): string[] {
  const e: string[] = [];
  const nan: string[] = [];
  scanNumbers(s, "s", nan);
  if (nan.length) e.push(`NaN/Infinity ${nan.slice(0, 3).join(",")}`);
  const h = s.hero;
  if (s.phase !== "create") {
    if (h.hp < 0) e.push("음수 HP");
    if (s.phase !== "dead" && h.hp <= 0) e.push(`살아 있는데 HP ${h.hp} (phase ${s.phase})`);
    if (s.phase !== "dead" && h.hp > maxHp(s)) e.push(`HP가 최대치 초과 ${h.hp}>${maxHp(s)}`);
    if (h.satiety < 0 || h.satiety > 100) e.push(`포만감 범위 ${h.satiety}`);
    if (h.fatigue < 0 || h.fatigue > 100) e.push(`피로 범위 ${h.fatigue}`);
    if (!Number.isInteger(h.hp)) e.push(`HP 정수 아님 ${h.hp}`);
  }
  if (s.gold < 0) e.push(`음수 골드 ${s.gold}`);
  for (const [k, v] of Object.entries(s.inventory)) if (v < 0 || !Number.isInteger(v)) e.push(`인벤토리 ${k}=${v}`);
  if (s.piety < 0 || s.piety > 100) e.push(`신앙 범위 ${s.piety}`);
  if (!h.faith && s.piety !== 0 && s.phase !== "create") e.push(`신앙 없는데 piety ${s.piety}`);
  if (s.heretic && !h.faith) e.push("신앙 없는 이단자");
  for (const [p, v] of Object.entries(s.injuries)) if (v < 0 || v > 3) e.push(`부상 범위 ${p}=${v}`);
  if ((s.injuries.head >= 3 || s.injuries.body >= 3) && s.phase !== "dead") e.push("머리·몸통 결손인데 살아 있음");
  if (s.disease < 0 || s.disease > 2) e.push(`질병 범위 ${s.disease}`);
  if (s.fragments.length > fragSlots(h.level)) e.push(`편린 칸 초과 ${s.fragments.length}>${fragSlots(h.level)}`);
  if (new Set(s.trophies).size !== s.trophies.length) e.push("증표 중복");
  for (const [slot, id] of Object.entries(s.gear)) if (id && !GEAR[id]) e.push(`없는 장비 ${slot}=${id}`);
  // 단계별 상태 조합
  switch (s.phase) {
    case "dungeon": {
      const dg = s.dungeon;
      if (!dg) { e.push("dungeon 단계인데 dungeon 없음"); break; }
      if (!dg.rooms[dg.current]) e.push(`현재 방 없음 ${dg.current}`);
      if (dg.mana < 0) e.push(`음수 마석 ${dg.mana}`);
      if (dg.pending && s.combat) e.push(`선택(${dg.pending.kind})과 전투가 동시에`);
      if (s.combat && s.combat.enemies.every((x) => x.hp <= 0 || x.fled)) e.push("살아 있는 적 없는 전투가 남아 있음");
      break;
    }
    case "settlement": if (!s.settlement) e.push("settlement 단계인데 정산 없음"); break;
    case "week-result": if (!s.weekResult) e.push("week-result 단계인데 결과 없음"); break;
    case "dead": if (!s.tomb) e.push("죽었는데 묘비 없음"); break;
    case "town": if (s.combat && s.combat.context !== "field") e.push("마을인데 미궁 전투"); if (s.dungeon) e.push("마을인데 dungeon 남아 있음"); break;
  }
  if (s.combat) for (const en of s.combat.enemies) {
    if (!Number.isFinite(en.hp)) e.push(`적 HP ${en.hp}`);
    const m = MONSTERS[en.defId];
    if (!m) e.push(`없는 몬스터 ${en.defId}`);
    else if (m.human && (en.defId !== "inquisitor" || !s.heretic)) e.push(`미궁에 사람 ${en.defId}`);
  }
  for (const id of s.fragments) if (!FRAGMENTS[id]) e.push(`없는 편린 ${id}`);
  if (s.dungeon) {
    const dg = s.dungeon;
    if (dg.floor < 1 || dg.floor > 3 || dg.sector < 1 || dg.sector > 2) e.push(`층·섹터 범위 ${dg.sector}-${dg.floor}`);
    for (const room of dg.rooms) {
      for (const nb of room.edges) if (!dg.rooms[nb]?.edges.includes(room.id)) e.push("한쪽 통로");
      for (const id of room.encounter ?? []) if (!MONSTERS[id] || MONSTERS[id].human) e.push(`방 구성 이상 ${id}`);
    }
  }
  if (s.heretic && s.phase === "town" && s.week <= 3) { /* 마을 기능 잠김은 행동 쪽에서 검사 */ }
  if (s.phase !== "dungeon" && s.phase !== "dead" && s.combat?.context === "dungeon") e.push("미궁 밖인데 미궁 전투");
  return e;
}

function setup(s: GameState, scen: string) {
  const r = new Rng({ s: s.seed + 99 });
  if (scen === "strong" || scen === "s2") {
    s.hero.level = scen === "s2" ? 6 : 5;
    s.rank = 1;
    s.month = 4;
    s.trophies = ["heart"];
    for (const k of STAT_KEYS) s.hero.stats[k] += 6;
    s.inventory.potion += 5;
    s.inventory.food += 6;
    s.gold = 400;
    const ids = Object.keys(FRAGMENTS);
    s.fragments = [pick(ids), pick(ids)];
    s.hero.hp = maxHp(s);
  }
  if (scen === "s2") {
    // 미궁으로 바로 들어가 2섹터 1층에 세운다
    s.week = 3;
    s.phase = "week-result";
    apply(s, { t: "closeWeek" });
    const dg = s.dungeon!;
    dg.sector = 2;
    dg.floor = 1;
    dg.rooms = generateFloor(r, 1, 2);
    dg.current = 0;
    dg.prev = null;
    dg.turnsLeft = 300;
  }
  if (scen === "heretic" && s.hero.faith) s.heretic = true;
  if (scen === "hurt") {
    for (const p of PARTS) if (p !== "head" && p !== "body") s.injuries[p] = r.int(0, 3);
    s.injuries.head = r.int(0, 2);
    s.injuries.body = r.int(0, 2);
    s.disease = r.int(0, 2);
    s.mind = { fear: { known: false }, despair: { known: r.chance(0.5) } };
    s.hero.hp = Math.min(s.hero.hp, maxHp(s));
  }
}

/** 진행 지표: 이게 오래 안 바뀌면 멈춘 것 */
function progressKey(s: GameState): string {
  return `${s.phase}|${s.month}|${s.week}|${s.dungeon?.turnsLeft}|${s.dungeon?.current}|${s.combat?.round}|${s.logCount}|${s.dungeon?.pending?.kind}`;
}

// 커버리지: 실제로 상태를 바꾼 행동 종류, 죽음 원인
const cover = new Map<string, number>();
const hit = (k: string) => cover.set(k, (cover.get(k) ?? 0) + 1);
const t0 = Date.now();
let total = 0, stalls = 0, botNull = 0, exceptions = 0, deaths = 0, cleared = 0, steps = 0;
for (let i = 0; i < N; i++) {
  const seed = START + i;
  fz = seed * 2654435761 % 0x7fffffff || 1;
  const cls = CLASSES[i % 3];
  const goal = GOALS[Math.floor(i / 3) % 3];
  const faith = GODS[Math.floor(i / 9) % GODS.length];
  const s = newRun(seed * 7919);
  s.faithsKnown = Object.values(FAITH);
  const ctx = { seed, cls, goal, faith };
  let last = "", same = 0, step = 0;
  try {
    apply(s, { t: "pickClass", cls });
    apply(s, { t: "autoGoal", goal });
    apply(s, { t: "create", name: "퍼즈", candidate: 0, faith });
    const scen = SCEN === "mix" ? pick(["", "s2", "heretic", "hurt", "strong"]) : SCEN;
    setup(s, scen);
    let prevLevel = s.hero.level, prevRank = s.rank;
    for (; step < MAX_ACTIONS && s.phase !== "dead" && s.month <= 24; step++) {
      let a: Action | null;
      if (rnd() < RAND) a = randomAction(s);
      else {
        a = botAction(s);
        if (!a) { botNull++; report({ kind: "봇 행동 없음", msg: `phase ${s.phase} pending ${s.dungeon?.pending?.kind ?? "-"}`, ...ctx, step, action: "-", phase: s.phase }); a = randomAction(s); }
      }
      const before = s.phase;
      const logBefore = s.logCount;
      const lockedBefore = s.heretic && s.phase === "town" ? JSON.stringify([s.gold, s.inventory, s.gear, s.hero.level, s.fragments, s.injuries, s.prosthetic]) : null;
      try {
        apply(s, a);
      } catch (err) {
        exceptions++;
        report({ kind: "예외", msg: String((err as Error).stack?.split("\n").slice(0, 3).join(" | ")), ...ctx, step, action: JSON.stringify(a), phase: before });
        break;
      }
      if (s.logCount !== logBefore || s.phase !== before) hit(a.t === "pending" ? `pending:${a.choice.replace(/\d+$/, "N")}` : a.t === "activity" ? `activity:${a.a}` : a.t);
      if (s.combat === null && s.log.slice(-6).some((l) => l.mons?.includes("inquisitor"))) hit("이단심문관 조우");
      const extra: string[] = [];
      const fresh = [...s.log.slice(Math.max(0, s.log.length - (s.logCount - logBefore))).map((l) => l.text), ...(s.weekResult?.lines ?? []), ...(s.settlement?.lines ?? []), ...(s.weekResult?.feed ?? [])];
      for (const line of fresh) if (/undefined|NaN|\[object|null|이\(가\)|을\(를\)|은\(는\)|%s|\$\{/.test(line)) extra.push(`이상한 문장: ${line.slice(0, 80)}`);
      if (s.hero.level < prevLevel) extra.push(`레벨 역행 ${prevLevel}→${s.hero.level}`);
      if (s.rank < prevRank) extra.push(`등급 역행`);
      if (a.t === "train" && s.month < BAL.firstTrainMonth && s.hero.level > prevLevel) extra.push("첫 달 훈련으로 레벨업");
      prevLevel = s.hero.level; prevRank = s.rank;
      // 현상수배 중 buy는 암시장(두 배 값)으로 허용: 산 만큼 정확히 두 배 값이 빠져야 한다
      if (lockedBefore && a.t === "buy") {
        const was = JSON.parse(lockedBefore)[0] as number;
        if (s.gold !== was && was - s.gold !== BAL.prices[a.item] * 2 && was - s.gold !== Math.ceil(BAL.prices[a.item] / 2) * 2) extra.push(`암시장 값이 두 배가 아님 ${a.item}`);
      }
      const townOnly = ["sell", "buyGear", "train", "eraseFrag", "regen", "prosthetic"].includes(a.t) || (a.t === "activity" && a.a !== "field");
      if (lockedBefore && townOnly && JSON.stringify([s.gold, s.inventory, s.gear, s.hero.level, s.fragments, s.injuries, s.prosthetic]) !== lockedBefore) extra.push(`현상수배 중 마을 시설 이용 ${a.t}`);
      for (const m of [...invariants(s), ...extra]) report({ kind: "불변식", msg: m.replace(/-?\d+(\.\d+)?/g, "#") + ` ← ${a.t}${a.t === "pending" ? ":" + a.choice : ""}`, ...ctx, step, action: JSON.stringify(a) + ` (${m})`, phase: before });
      const k = progressKey(s);
      if (k === last) same++;
      else { same = 0; last = k; }
      if (same > 400) { stalls++; report({ kind: "멈춤", msg: `phase ${s.phase} pending ${s.dungeon?.pending?.kind ?? "-"} combat ${!!s.combat}`, ...ctx, step, action: JSON.stringify(a), phase: s.phase }); break; }
    }
    // JSON 왕복(저장) 가능해야 한다
    const back = JSON.parse(JSON.stringify(s));
    if (JSON.stringify(back) !== JSON.stringify(s)) report({ kind: "저장", msg: "JSON 왕복 불일치", ...ctx, step, action: "-", phase: s.phase });
  } catch (err) {
    exceptions++;
    report({ kind: "예외(시작)", msg: String(err), ...ctx, step, action: "-", phase: s.phase });
  }
  total++;
  steps += step;
  if (s.phase === "dead") { deaths++; hit(`죽음:${s.tomb?.cause}`); }
  if (s.dungeon?.sector === 2 || s.rank >= 2) hit("2섹터 도달");
  if (s.rank > 0) cleared++;
  if (VERBOSE && i % 100 === 0) console.error(`${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

console.log(`판 ${total} · 행동 ${steps} · 사망 ${deaths} · 클리어 ${cleared} · 예외 ${exceptions} · 멈춤 ${stalls} · 봇 null ${botNull} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`버그 종류 ${seenKinds.size}`);
for (const [k, n] of [...seenKinds].sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${k}`);
if (process.env.COVER) console.log("커버리지 " + [...cover].sort().map(([k, n]) => `${k}=${n}`).join(" · "));
console.log("--- 예시 ---");
const shown = new Set<string>();
for (const b of bugs) {
  const key = `${b.kind}: ${b.msg}`;
  if (shown.has(key)) continue;
  shown.add(key);
  console.log(JSON.stringify(b));
}
