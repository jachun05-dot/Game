import { t, tk } from "../i18n/core";
import { BAL, MONSTERS } from "./data";
import { check, kill, log, maxHp, remember, rngOf, smod } from "./core";
import { GODS, RELICS, TEACHINGS, addPiety, god, godOf, power, relicOn, tier, type GodKey } from "./faith";
import { FRAGMENTS, activeFragments, fragSkills } from "./fragments";
import { gearHas } from "./gear";
import { afflict } from "./mind";
import { makeEnemies, startCombat } from "./combat";
import { EDICT_TEXT, endLife, grantClue, knowsClue, trueEndingOpen } from "./truth";
import type { CombatState, Enemy, GameState, Room } from "./types";

// 6섹터 "타락한 신전과 차원문의 성소"(최종, SECTOR6_DRAFT — 사용자 결정 2026-10-15: 추천대로 + 제단 유물).
// - 정화: 맞으면 신앙심이 깎인다(★ 문턱 아래로 떨어지면 그 권능이 꺼진다). 옛 신의 향·뒤집힌 성표·빛 삼키기로 막는다.
// - 성광 방(1·2층): 들어서면 신앙심 −3, 그 방 전투에서 신앙 명중·피해 보정 절반. 무신앙이면 절망 10%.
// - 봉인 문(3층): 해석(지능·힘·감각 DC 20) 아니면 봉인의 수호자(지면 HP 1로 문 밖). ★5면 그냥 열린다.
// - 심문관의 고해실(2층), 옛 신들의 제단(3층, 응답·유물), 셉터의 제단(엔딩 선택).
// - 화신: 3라운드마다 성광, 쓰러지면 한 번 다시 일어서서 권능을 삼킨다. ★5 화신전 특례, 옛 신들의 응답.

function hasSkill(s: GameState, id: string): boolean {
  return s.skills.includes(id) || fragSkills(s).includes(id);
}

// ── 정화 ──

/** 정화가 통하지 않는가: 뒤집힌 성표, 빛 삼키기, 이름 없는 가면 */
export function purgeImmune(s: GameState): boolean {
  return gearHas(s, (g) => g.purgeImmune).length > 0 || hasSkill(s, "fragSwallowLight") || relicOn(s, "oblivion");
}

/** 정화: 섬기는 신의 신앙심 −n. 옛 신의 향이 있으면 향이 먼저 막는다 */
export function purge(s: GameState, n: number, who: string): void {
  if (!god(s) || n <= 0 || purgeImmune(s)) return;
  const dg = s.dungeon;
  if (dg && !dg.incense && s.inventory.incense > 0) {
    s.inventory.incense -= 1;
    dg.incense = 3;
    log(s, t("옛 신의 향에 불을 붙였다. 연기가 흰빛을 걸러 낸다. (정화 3번 막기, 남은 향 {n})", { n: s.inventory.incense }), "skill");
  }
  if (dg?.incense) {
    dg.incense -= 1;
    log(s, t("향 연기가 {who}의 흰빛을 걸러 냈다. (남은 {n}번)", { who: t(who), n: dg.incense }), "system");
    return;
  }
  const before = tier(s);
  addPiety(s, -n);
  const back = hasSkill(s, "fragFlip") ? Math.floor(n / 2) : 0;
  if (back) addPiety(s, back);
  log(s, t("{who}의 흰빛이 옛 신의 기척을 깎아 낸다. (정화 −{n} → 신앙심 {p})", { who: t(who), n: n - back, p: Math.floor(s.piety) }), "hurt");
  if (tier(s) < before) log(s, t("★{tier}의 권능이 꺼졌다. ({power})", { tier: before, power: t(GODS[god(s)!].powers[before - 1]).split(/[:：]/)[0] }), "hurt");
}

// ── 성광 방 ──

/** 지금 성광 방에 있는가 */
export function inRadiant(s: GameState): boolean {
  const dg = s.dungeon;
  return !!dg && dg.sector === 6 && !dg.endless && !!dg.rooms[dg.current]?.radiant;
}

/** 성광 방에 들어섰다(처음 들어설 때마다) */
export function enterRadiant(s: GameState): void {
  log(s, t("천장에서 흰빛이 쏟아진다. 성가가 귀를 메운다. (성광 방 — 이 방에서는 신앙의 힘이 절반)"), "system");
  if (!god(s)) {
    afflict(s, "despair", 0.1, t("흰빛 아래 서 있자니 내가 아무것도 아닌 것 같다."));
    return;
  }
  if (gearHas(s, (g) => g.noRadiant).length) {
    log(s, t("순례자의 신이 흰빛 위를 조용히 걷는다. 옛 신의 기척은 깎이지 않았다."), "system");
    return;
  }
  purge(s, 3, tk("성광 방"));
}

// ── 봉인 문(3층) ──

export const SEAL_DOOR: Record<"rune" | "weight" | "mirror", { name: string; stat: "int" | "str" | "per"; verb: string; flavor: string }> = {
  rune: { name: "룬의 문", stat: "int", verb: "룬을 해석한다", flavor: "옛 신들의 문자가 빼곡한 돌문. 읽어 내야 열린다." },
  weight: { name: "무게의 문", stat: "str", verb: "돌문을 들어 올린다", flavor: "손잡이도 경첩도 없는 거대한 돌문. 들어 올려야 열린다." },
  mirror: { name: "거울의 문", stat: "per", verb: "거울 속 길을 찾는다", flavor: "문 대신 거울이 서 있다. 비친 길 중 진짜를 찾아야 지난다." },
};

export function isSealDoor(room: Room): room is Room & { trapKind: "rune" | "weight" | "mirror" } {
  return room.trapKind === "rune" || room.trapKind === "weight" || room.trapKind === "mirror";
}

/** 봉인 문 판정 보정: 이단(심문을 거부하고 신앙을 지킴) +3 */
export function sealBonus(s: GameState): number {
  return s.heretic && god(s) ? 3 : 0;
}

/** 봉인 문에 닿았다. ★5면 수호자가 무릎을 꿇고 그냥 열린다(true) */
export function arriveSealDoor(s: GameState, room: Room & { trapKind: "rune" | "weight" | "mirror" }): boolean {
  const door = SEAL_DOOR[room.trapKind];
  room.known = true;
  log(s, t("{door} — {flavor}", { door: t(door.name), flavor: t(door.flavor) }), "story");
  if (tier(s) >= 5) {
    room.resolved = true;
    log(s, t("【{god}】 문 앞의 봉인의 수호자가 당신을 알아보고 무릎을 꿇는다. 문이 저절로 열린다.", { god: t(godOf(s.hero.faith)!.name) }), "skill");
    return true;
  }
  return false;
}

/** 봉인 문 해석. 실패하면 수호자(전투가 시작됐으면 true) */
export function tryOpenSeal(s: GameState, room: Room & { trapKind: "rune" | "weight" | "mirror" }): boolean {
  const door = SEAL_DOOR[room.trapKind];
  const c = check(s, door.stat, BAL.sealDc, sealBonus(s));
  const label = t(door.stat === "int" ? "지능" : door.stat === "str" ? "힘" : "감각");
  if (c.ok) {
    room.resolved = true;
    log(s, t("{verb} — 문이 열렸다. ({stat} {total} vs {dc})", { verb: t(door.verb), stat: label, total: c.total, dc: BAL.sealDc }), "good");
    return false;
  }
  log(s, t("{verb} — 실패했다. ({stat} {total} vs {dc}) 문 옆의 돌 수호자가 눈을 뜬다.", { verb: t(door.verb), stat: label, total: c.total, dc: BAL.sealDc }), "hurt");
  guardianFight(s, room);
  return true;
}

/** 봉인의 수호자와 싸운다(문마다 한 번 — 이미 다친 수호자면 그대로) */
export function guardianFight(s: GameState, room: Room): void {
  log(s, t("\"이 문을 지날 자격을 보여라.\" 봉인의 수호자가 일어선다. (지면 죽지 않고 문 밖에 쓰러진다)"), "story");
  const enemies = room.remaining ?? makeEnemies(s, ["guardian"]);
  room.remaining = undefined;
  startCombat(s, "dungeon", enemies);
}

// ── 옛 신들의 제단(3층) ──

/** 제단에서 기도: 섬기는 신은 신앙심 +10과 유물(삶마다 하나), 다른 해금 신은 응답 하나씩 */
export function prayAltars(s: GameState): void {
  const dg = s.dungeon!;
  const mine = god(s);
  const others = s.faithsKnown.filter((f) => godOf(f) && f !== s.hero.faith);
  dg.prayedAltars = true;
  log(s, t("여덟 개의 부서진 제단 앞을 하나씩 지나며 무릎을 꿇었다."), "story");
  s.hero.hp = Math.min(maxHp(s), s.hero.hp + 10);
  if (mine) {
    addPiety(s, 10);
    log(s, t("{faith|이} 가까이 있다. (신앙심 +10 → {p}, HP +10)", { faith: t(s.hero.faith!), p: Math.floor(s.piety) }), "good");
    if (s.hero.cls === "adventurer") godTeaching(s, mine);
    else if (!s.relic) {
      s.relic = mine;
      const rel = RELIC_TEXT[mine];
      log(s, t("제단 아래 돌 틈에서 무언가 빛난다 — {relic}", { relic: t(rel) }), "story");
      log(s, t("【{name}】 {desc} (그 신을 섬기는 동안)", { name: t(relicName(s)), desc: t(relicDesc(s)) }), "crit");
      remember(s, t("{relic|을} 받았다.", { relic: t(relicName(s)) }));
    }
  } else log(s, t("제단들은 조용하다. 섬기는 신이 없는 자의 기도에도 HP +10만큼의 온기는 돌아온다."), "good");
  dg.answers = others;
  if (others.length) log(s, t("{gods} — 대답이 돌아온다. 화신과 싸울 때 한 번씩 돕겠다고. (응답 {n})", { gods: others.map((o) => t(o)).join(", "), n: others.length }), "skill");
  else log(s, t("다른 제단들은 비어 있다. 아직 이름을 아는 신이 없다. (죽음으로 신을 해금할수록 응답이 늘어난다)"), "system");
}

/** 모험가 히든 16레벨: 섬기는 신이 직접 가르친다(레벨 15, ★1 이상, 아귀의 검은 이빨을 바침). 모험가는 유물 대신 가르침 */
function godTeaching(s: GameState, key: GodKey): void {
  if (s.godTeaching) return;
  const g = GODS[key];
  if (s.hero.level < BAL.maxLevel - 1) {
    log(s, t("{god|이} 당신을 내려다본다. 아직 이르다 — 사람에게서 더 배워 와라. (레벨 {lv}부터)", { god: t(g.name), lv: BAL.maxLevel - 1 }), "story");
    return;
  }
  if (s.dungeon?.converted) {
    log(s, t("{god|이} 당신을 낯설게 본다. 이 미궁에서 갓 섬기기 시작한 신은 아직 당신을 가르치지 않는다. (미궁에 들어오기 전부터 섬긴 신이어야)", { god: t(g.name) }), "story");
    return;
  }
  if (tier(s) < 1) {
    log(s, t("{god|이} 당신을 알아보지 못한다. 기척이 너무 옅다. (신앙심 ★1부터)", { god: t(g.name) }), "story");
    return;
  }
  if (s.inventory.fang <= 0) {
    log(s, t("{god|이} 무언가를 기다린다. 바닥에서 가져온 것 — 아귀의 검은 이빨을 바쳐야 한다.", { god: t(g.name) }), "story");
    return;
  }
  s.inventory.fang -= 1;
  s.godTeaching = key;
  s.hero.level = BAL.maxLevel;
  for (const k of ["str", "dex", "con", "int", "per", "luk"] as const) s.hero.stats[k] = Math.min(BAL.statMax, s.hero.stats[k] + 1);
  if (!s.skills.includes("godTaught")) s.skills.push("godTaught");
  s.hero.hp = maxHp(s);
  const te = TEACHINGS[key];
  log(s, t("아귀의 검은 이빨을 제단에 올렸다. 교관이 가르칠 수 없던 마지막 한 걸음 — {god|이} 직접 손을 뻗는다.", { god: t(g.name) }), "story");
  log(s, t("【히든】 신에게 배운 자 — 레벨 {lv}! (모든 능력치 +1, 최대 HP +30, 명중 +3, 피해 +5, AC +2)", { lv: BAL.maxLevel }), "crit");
  log(s, `【${t(te.name)}】 ${t(te.boost)}`, "skill");
  log(s, `【${t(te.final)}】 ${t(te.finalDesc)}`, "skill");
  remember(s, t("{god}에게 직접 배워 {lv}레벨이 되었다.", { god: t(g.name), lv: BAL.maxLevel }));
}

const RELIC_TEXT: Record<string, string> = {
  war: tk("녹슨 깃대에 감긴 첫 전쟁의 군기다."),
  hunger: tk("한쪽은 넘치고 한쪽은 빈 작은 접시다."),
  trap: tk("녹슨 덫의 쇠이빨 하나다. 아직 물 것을 찾는다."),
  greed: tk("세상에서 처음 주고받은 동전이다."),
  song: tk("끊어지지 않은 현 하나다. 손대지 않아도 운다."),
  plague: tk("금 간 작은 종이다. 울릴 때마다 무언가 앓는다."),
  abyss: tk("바닥에서 올라온 검은 돌이다. 손에 쥐면 무겁게 가라앉는다."),
  oblivion: tk("이름이 지워진 가면이다."),
};

export function relicName(s: GameState): string {
  return s.relic ? RELICS[s.relic as keyof typeof RELICS]?.name ?? "" : "";
}
export function relicDesc(s: GameState): string {
  return s.relic ? RELICS[s.relic as keyof typeof RELICS]?.desc ?? "" : "";
}

// ── 심문관의 고해실(2층) ──

/** 고해실 도착: 현상수배 중이면 심문관장이 곧장 덤빈다(전투가 시작됐으면 true) */
export function arriveConfession(s: GameState, room: Room): boolean {
  room.known = true;
  if (s.heretic) {
    log(s, t("고해실의 휘장이 걷힌다. \"여기까지 쫓아왔다, 이단.\" 심문관들의 우두머리가 철퇴를 든다."), "hurt");
    startCombat(s, "dungeon", room.remaining ?? makeEnemies(s, ["grandinquisitor"]));
    room.remaining = undefined;
    return true;
  }
  if (god(s)) log(s, t("심문관이 기도를 멈추고 돌아본다. \"여기까지 옛 신의 냄새를 묻혀 왔군. 이 자리에서 심문하겠다.\""), "story");
  else log(s, t("심문관이 기도를 멈추고 당신을 축복한다. \"셉터를 찾거든 영주님께 바쳐라. 그것이 신의 뜻이다.\""), "story");
  return false;
}

/** 고해실 선택: 신앙 포기 / 거부(현상수배 + 심문관장) / 캐묻기(무신앙) / 지나치기. 전투가 시작됐으면 true */
export function resolveConfession(s: GameState, room: Room, choice: string): boolean {
  if (god(s)) {
    if (choice === "renounce") {
      room.resolved = true;
      log(s, t("심문관 앞에서 {faith|을} 부정했다. 목에 걸고 있던 것을 내려놓았다. 심문관은 만족한 얼굴로 다시 기도로 돌아갔다.", { faith: t(s.hero.faith!) }), "system");
      s.hero.faith = null;
      s.piety = 0;
      return false;
    }
    log(s, t("{faith|을} 부정하지 않았다. \"그렇다면 여기가 네 무덤이다.\" 심문관이 철퇴를 든다. 이제 영지의 이단자다.", { faith: t(s.hero.faith!) }), "hurt");
    s.heretic = true;
    startCombat(s, "dungeon", room.remaining ?? makeEnemies(s, ["grandinquisitor"]));
    room.remaining = undefined;
    return true;
  }
  room.resolved = true;
  if (choice !== "ask") {
    log(s, t("고개를 숙이고 고해실을 지나쳤다."));
    return false;
  }
  const stat = smod(s, "int") >= smod(s, "per") ? "int" : "per";
  const c = check(s, stat, 18);
  if (c.ok) {
    log(s, t("셉터를 왜 영주에게 바쳐야 하는지 캐물었다. 심문관이 무심코 품에서 문서를 꺼내 보인다. ({stat} {total} vs 18)", { stat: t(stat === "int" ? "지능" : "감각"), total: c.total }), "good");
    log(s, t(EDICT_TEXT), "story");
    grantClue(s, "edict");
  } else log(s, t("심문관은 더 말하지 않았다. \"신의 뜻을 묻지 마라.\" ({stat} {total} vs 18)", { stat: t(stat === "int" ? "지능" : "감각"), total: c.total }), "system");
  return false;
}

/** 심문관장을 쓰러뜨렸다: 신앙심 +20, 영주의 칙서 */
export function grandInquisitorDown(s: GameState): void {
  remember(s, t("심문관장을 쓰러뜨렸다."));
  log(s, t("심문관장이 쓰러졌다. 품에서 봉인된 문서 한 장이 떨어진다."), "good");
  log(s, t(EDICT_TEXT), "story");
  grantClue(s, "edict");
  if (god(s)) {
    addPiety(s, 20);
    log(s, t("{faith|이} 기뻐한다. (신앙심 +20 → {p})", { faith: t(s.hero.faith!), p: Math.floor(s.piety) }), "story");
  }
}

// ── 화신·아바타 전투 ──

/** 이 전투에 화신·아바타가 있는가 */
export function avatarFight(c: CombatState): boolean {
  return c.enemies.some((e) => MONSTERS[e.defId].avatar);
}

/** 전투 시작: 옛 신들의 응답 준비, ★5 화신전 특례(전쟁·재앙·망각), 짝신의 이름(아바타 AC −3) */
export function avatarOpening(s: GameState, c: CombatState): void {
  const answers = c.context === "final" ? s.finalAnswers ?? [] : s.dungeon?.answers ?? [];
  if (answers.length && (avatarFight(c) || c.context === "final")) c.answers = [...answers];
  if (!avatarFight(c)) return;
  const av = c.enemies.find((e) => MONSTERS[e.defId].avatar)!;
  const g = god(s);
  if (g && tier(s) >= 5) {
    const name = t(GODS[g].name);
    if (g === "war") {
      const wings = c.enemies.filter((e) => e !== av && e.hp > 0);
      for (const w of wings) w.stun = Math.max(w.stun ?? 0, 2);
      if (wings.length) log(s, t("【{god}】 망령 군세가 함성과 함께 몰려와 날개 호위를 묶는다. (호위 2라운드 행동 불가)", { god: name }), "skill");
    }
    if (g === "trap") {
      const dmg = Math.round((av.hpMax ?? MONSTERS[av.defId].hp) * 0.1);
      av.hp -= dmg;
      log(s, t("【{god}】 화신이 디딘 자리가 무너진다. 첫 함정이 먼저 물었다. ({dmg} 피해)", { god: name, dmg }), "skill");
    }
    if (g === "oblivion") {
      av.stun = Math.max(av.stun ?? 0, 2);
      log(s, t("【{god}】 화신이 당신이 누구였는지 잊었다. (2라운드 행동 불가)", { god: name }), "skill");
    }
  }
  if (av.defId === "godavatar" && knowsClue(s, "name")) {
    av.acDown = (av.acDown ?? 0) + 3;
    log(s, t("짝신의 이름을 불렀다 — 아엘라. 흰빛이 움찔하며 빈틈을 드러낸다. (AC −3)"), "crit");
  }
}

/** 라운드 시작: 옛 신들의 응답(라운드마다 하나, 2d6) */
export function answerTick(s: GameState, c: CombatState, deal: (t: Enemy, dmg: number, src: string) => void): void {
  if (!c.answers?.length) return;
  const foes = c.enemies.filter((e) => e.hp > 0);
  if (!foes.length) return;
  const tg = foes.find((e) => MONSTERS[e.defId].avatar || e.defId === "lord") ?? foes[0];
  const name = c.answers.shift()!;
  const dmg = rngOf(s).dice(2, 6);
  deal(tg, dmg, "answer");
  log(s, t("【{god}의 응답】 결계 너머에서 옛 신이 손을 뻗는다. {target}에게 {dmg} 피해", { god: t(name), target: t(MONSTERS[tg.defId].name), dmg }), "skill");
}

/** 성광 피해 배율: 결계석 방패·이름 없는 가면 절반, 빛 삼키기 0 */
export function radianceMult(s: GameState): number {
  if (hasSkill(s, "fragSwallowLight")) return 0;
  return gearHas(s, (g) => g.radianceRes).reduce((m, g) => m * g.radianceRes!, 1) * (relicOn(s, "oblivion") ? 0.5 : 1);
}

/** 라운드 끝: 성광(3라운드마다), 삼킴(다시 일어선 뒤), 주교관의 부름. 죽었으면 true */
export function templeRoundEnd(s: GameState, c: CombatState): boolean {
  const r = rngOf(s);
  const special = (c.specialUsed ??= []);
  for (const e of c.enemies.filter((x) => x.hp > 0)) {
    const def = MONSTERS[e.defId];
    if (def.radiance && c.round % 3 === 0 && (e.stun ?? 0) <= 0) {
      if (power(s, "oblivion", 5) && !special.includes("oblivionRadiance")) {
        special.push("oblivionRadiance");
        log(s, t("【{god}】 {foe|이} 성광을 쏟았지만, 빛이 당신을 찾지 못했다.", { god: t(GODS.oblivion.name), foe: t(def.name) }), "skill");
        continue;
      }
      const m = radianceMult(s);
      const dmg = Math.round(r.dice(2, 8) * m);
      s.hero.hp -= dmg;
      log(s, m === 0 ? t("{foe|이} 성광을 쏟았다 — 삼킨 빛이 흰빛을 먹어 치운다. (피해 없음)", { foe: t(def.name) }) : t("{foe|이} 성광을 쏟았다! 온 방이 하얗게 탄다. {dmg} 피해", { foe: t(def.name), dmg }), "hurt");
      if (s.hero.hp <= 0 && !lastStandFaith(s, c)) {
        s.hero.hp = 0;
        kill(s, "single", t("빛에 삼켜졌다"));
        return true;
      }
      purge(s, 10, def.name);
    }
    if (def.swallow && (e.reborn || !def.rebirth) && r.chance(def.swallow)) swallowPower(s, c, def.name);
    if (def.summon && c.round % 3 === 0 && c.enemies.filter((x) => x.hp > 0 && x.defId === def.summon).length < 4) {
      const add: Enemy = { uid: s.nextUid++, defId: def.summon, hp: MONSTERS[def.summon].hp };
      c.enemies.push(add);
      log(s, t("{foe|이} 빈 설교를 읊는다. 밀랍이 녹아 흘러 새 신도가 일어선다!", { foe: t(def.name) }), "hurt");
    }
  }
  return false;
}

/** 삼킴: 섬기는 신의 가장 높은 ★ 권능 하나를 이 전투 동안 봉인(무신앙이면 가장 센 편린 능력). 기아/풍요 ★5·짝신의 이름이면 무효 */
function swallowPower(s: GameState, c: CombatState, who: string): void {
  if (power(s, "hunger", 5)) {
    log(s, t("【{god}】 {foe|이} 삼키려 입을 벌렸지만, 굶주림이 먼저 그것을 삼켰다. (삼킴 무효)", { god: t(GODS.hunger.name), foe: t(who) }), "skill");
    return;
  }
  if ((c.specialUsed ?? []).includes("nameCalled")) return;
  if (god(s)) {
    const tr = tier(s);
    if (tr <= 0) return;
    c.sealed = (c.sealed ?? 0) + 1;
    log(s, t("{foe|이} 빛을 들이마신다 — ★{tier}의 권능이 삼켜졌다. (이 전투 동안)", { foe: t(who), tier: tr }), "hurt");
    return;
  }
  const frags = activeFragments(s).filter((id) => FRAGMENTS[id]?.skill);
  if (!frags.length) return;
  const best = [...frags].sort((a, b) => FRAGMENTS[b].tier - FRAGMENTS[a].tier)[0];
  (c.fragSealed ??= []).push(best);
  log(s, t("{foe|이} 빛을 들이마신다 — {frag|이} 빛을 잃었다. (이 전투 동안)", { foe: t(who), frag: t(FRAGMENTS[best].name) }), "hurt");
}

/** 화신이 쓰러졌다가 다시 일어선다(한 번). 날개 호위는 타 버린다. dealt()에서 부른다 */
export function rebirth(s: GameState, c: CombatState, e: Enemy): boolean {
  const def = MONSTERS[e.defId];
  if (!def.rebirth || e.reborn || e.fled) return false;
  e.reborn = true;
  const hp = power(s, "plague", 5) ? Math.round(def.rebirth / 2) : def.rebirth;
  e.hp = hp;
  e.hpMax = hp;
  e.stun = 0;
  for (const o of c.enemies) if (o !== e && o.hp > 0) {
    o.hp = 0;
    o.fled = true;
  }
  log(s, t("{foe|이} 무너졌다 — 아니다. 날개가 타 버리며 흰빛이 다시 일어선다! (2단계, HP {hp})", { foe: t(def.name), hp }) + (power(s, "plague", 5) ? t(" 【{god}】 병든 빛은 다 메워지지 못했다.", { god: t(GODS.plague.name) }) : ""), "crit");
  if (knowsClue(s, "name")) {
    (c.specialUsed ??= []).push("nameCalled");
    log(s, t("짝신의 이름을 불렀다 — 아엘라. 얼굴 자리에 비친 얼굴이 돌아본다. 삼킴이 멈춘다."), "crit");
  }
  return true;
}

/** ★5 화신전 특례: 쓰러질 피해를 한 번 버틴다(탐욕: 마석 전부 바치고 HP 50%, 시와 노래: HP 50%) */
export function lastStandFaith(s: GameState, c: CombatState): boolean {
  if (!avatarFight(c) && c.context !== "final") return false;
  const special = (c.specialUsed ??= []);
  const half = Math.max(1, Math.round(maxHp(s) / 2));
  if (power(s, "greed", 5) && !special.includes("greed")) {
    special.push("greed");
    const dg = s.dungeon;
    const paid = dg ? dg.mana : s.gold;
    if (dg) dg.mana = 0;
    else s.gold = 0;
    s.hero.hp = half;
    log(s, t("【{god}】 가진 것을 전부 바쳤다({paid}G). 목숨값으로 충분하다. (HP {hp})", { god: t(GODS.greed.name), paid, hp: half }), "skill");
    return true;
  }
  if (power(s, "song", 5) && !special.includes("song")) {
    special.push("song");
    s.hero.hp = half;
    log(s, t("【{god}】 노래가 끝나지 않았다. 다시 일어선다. (HP {hp})", { god: t(GODS.song.name), hp: half }), "skill");
    return true;
  }
  return false;
}

/** 심연 ★5 화신전 특례: 화신 HP 30% 이하에서 내 피해 2배 */
export function abyssFinisher(s: GameState, t: Enemy): number {
  const def = MONSTERS[t.defId];
  return def.avatar && power(s, "abyss", 5) && t.hp <= (t.hpMax ?? def.hp) * 0.3 ? 2 : 1;
}

// ── 셉터의 제단·엔딩 ──

/** 셉터의 제단에 닿았다: 6섹터 클리어(등급 6) */
export function arriveScepter(s: GameState): void {
  const first = s.rank < 6;
  s.rank = Math.max(s.rank, 6);
  remember(s, t("셉터의 제단에 닿았다."));
  if (first) log(s, t("셉터의 제단에 닿았다 — 6섹터 클리어! (등급 6)"), "good");
}

/** 셉터를 든다: 헌납 엔딩(이단은 영주성에 들어갈 수 없다) */
export function takeScepter(s: GameState): void {
  if (s.heretic) return;
  endLife(s, "offering");
}

/** 셉터를 두고 나온다: 진엔딩 결전(영주 → 유일신의 아바타). 옛 신들의 응답은 두 배 */
export function leaveScepter(s: GameState): void {
  if (!trueEndingOpen(s)) return;
  const answers = s.dungeon?.answers ?? [];
  s.finalAnswers = [...answers, ...answers];
  s.dungeon = null;
  s.hero.hp = maxHp(s);
  remember(s, t("셉터를 두고 영주성으로 갔다."));
  log(s, t("셉터를 결계에 박힌 그대로 두고 돌아섰다. 성소의 빛이 등을 떠밀어 마을로 돌려보낸다. 몸의 상처가 모두 아물었다."), "story");
  log(s, t("영주성의 문이 열려 있다. 늙지 않는 영주가 옥좌에서 일어선다. \"셉터는 어디 있느냐.\""), "story");
  startCombat(s, "final", makeEnemies(s, ["lord"]));
}

/** 결전 전투가 끝났다 */
export function afterFinalCombat(s: GameState, outcome: "win" | "fled", c: CombatState): void {
  if (outcome !== "win") {
    // 결판이 나지 않았다(60라운드) — 결전에서 물러설 곳은 없다
    kill(s, "single", t("영주에게 맞서다 쓰러졌다"));
    return;
  }
  if (c.enemies.some((e) => e.defId === "lord")) {
    log(s, t("영주가 무릎을 꿇는다 — 그 껍질이 갈라지며 흰빛이 새어 나온다. 짝을 삼킨 자가 직접 손을 내민다!"), "crit");
    startCombat(s, "final", makeEnemies(s, ["godavatar"]));
    return;
  }
  endLife(s, "true");
}
