import { josa } from "./josa";
import { BAL, MONSTERS } from "./data";
import { actionsPerRound, heroAc, isDead, kill, log, maxHp, note, rngOf, rollPenalty, smod } from "./core";
import { FRAGMENTS } from "./fragments";
import { GODS, abyssEdge, faithDmg, faithHit, faithInfectMult, power, pray } from "./faith";
import { HEAD_STUN, INJ, canFlee, infect, injuryHit, lvl, noCrit, wound, type Part } from "./injury";
import { MIND, afflict, comboNow, missPotion, rageDmg, symptom } from "./mind";
import { activeSkills, passive, skillWorks, SKILLS, type SkillDef } from "./skills";
import { GEAR, weaponOf } from "./gear";
import { MARK_FOR_SKILL, SKILL_LEVEL, type ElementKey } from "./elements";

const GEAR_IS_WEAPON = (id: string) => !!GEAR[id]?.weapon;
import type { CombatState, DamageMeter, Enemy, GameState } from "./types";
import { scaleEnemy } from "./endless";
import { afterDungeonCombat, isNight, passTime } from "./dungeon";
import { afterFieldCombat } from "./town";

// 자동 전투(2026-10-13 변경): 플레이어는 공격을 고르지 않는다. 라운드마다
// 플레이어 행동(물약·도주 방침 → 조건부 기술 → 가장 약한 적 공격) → 적 전체 행동을 자동으로 굴리고,
// 결과는 로그로 흘려보낸다. 위치 개념이 없으므로 "포위"는 동시에 살아있는 적 수로 표현한다.

const MAX_ROUNDS = 60;

export function makeEnemies(s: GameState, ids: string[]): Enemy[] {
  const list = ids.map((defId) => ({ uid: s.nextUid++, defId, hp: MONSTERS[defId].hp }));
  // 끝없는 미궁: 층이 깊을수록 강하다
  return s.dungeon?.endless ? list.map((e) => scaleEnemy(e, s.dungeon!.floor)) : list;
}

export function describeGroup(enemies: Enemy[]): string {
  const counts = new Map<string, number>();
  for (const e of enemies) counts.set(e.defId, (counts.get(e.defId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, n]) => (n > 1 ? `${MONSTERS[id].name} ${n}마리` : MONSTERS[id].name))
    .join(", ");
}

/** 적에게 피해를 준다(허수아비 측정 중이면 출처별·라운드별로 기록) */
function dealt(c: CombatState, t: Enemy, dmg: number, src: string): void {
  t.hp -= dmg;
  const m = c.meter;
  if (!m) return;
  m.by[src] = (m.by[src] ?? 0) + dmg;
  const i = m.base + c.round - 1;
  m.rounds[i] = (m.rounds[i] ?? 0) + dmg;
}

export function alive(c: CombatState): Enemy[] {
  return c.enemies.filter((e) => e.hp > 0);
}

interface Strike {
  hit: number;
  dmg: number;
  mult: number;
  autoHit: boolean;
  /** 반드시 치명타(급소 찌르기) */
  crit?: boolean;
  /** 맞으면 n라운드 행동 불가(분쇄 일격) */
  stun?: number;
  /** 피해 출처(허수아비 측정용 기술 id) */
  src?: string;
}

const PLAIN: Strike = { hit: 0, dmg: 0, mult: 1, autoHit: false };

/** 전투를 처음부터 끝까지 자동으로 진행한다 */
export function startCombat(s: GameState, context: CombatState["context"], enemies: Enemy[], opts: { surprise?: boolean; meter?: DamageMeter; limit?: number; used?: Record<string, number> } = {}): void {
  const c: CombatState = { context, enemies, round: 1, loot: 0, bonus: 0, frags: [], used: opts.used ?? {}, guard: null, meter: opts.meter, limit: opts.limit };
  s.combat = c;
  c.logFrom = s.logCount;
  c.hpStart = s.hero.hp;
  log(s, `${josa(describeGroup(enemies), "이")} 나타났다!`, "hurt");
  s.log[s.log.length - 1].mons = enemies.map((e) => e.defId);
  for (const e of enemies) if (!s.codex.seen.includes(e.defId)) s.codex.seen.push(e.defId);
  // 공포: 보스·이단심문관과 마주치면
  if (enemies.some((e) => e.defId === "boss" || e.defId === "inquisitor" || MONSTERS[e.defId].hidden)) afflict(s, "fear", MIND.fearBoss, "그것을 본 순간, 등줄기가 서늘하게 식었다.");
  for (const e of enemies) {
    const def = MONSTERS[e.defId];
    if (def.rare) log(s, `【희귀 개체】 ${def.name} — ${def.note} 놓치기 전에 잡아야 한다! (마석 ${def.mana}G 어치)`, "crit");
  }
  // 기습: 적이 먼저 한 번 행동한다(함정을 밟은 상대를 노리는 고블린 등)
  if (opts.surprise && power(s, "trap", 3)) log(s, `【${GODS.trap.name}】 먼저 온 경고 — 기습을 미리 알아챘다.`, "skill");
  else if (opts.surprise) {
    log(s, "기습! 자세를 잡기도 전에 공격이 들어온다.", "hurt");
    enemyPhase(s, c);
    if (isDead(s)) return;
    if (alive(c).length === 0) return finish(s, "win"); // 기습을 받아치다 다 쓰러뜨렸다
  }

  // 망각의 신 ★3 "망각의 장막"
  if (power(s, "oblivion", 3)) {
    for (const foe of alive(c)) foe.stun = (foe.stun ?? 0) + 1;
    log(s, `【${GODS.oblivion.name}】 망각의 장막 — 적들이 잠시 당신이 거기 있다는 것을 잊었다.`, "skill");
  }
  // 전쟁의 신 ★3 "피의 함성"
  if (power(s, "war", 3) && alive(c).length >= 3) {
    c.cow = 2;
    log(s, `【${GODS.war.name}】 피의 함성 — 적들이 움찔한다 (2라운드 동안 적 명중 −2)`, "skill");
  }

  // 빈틈 읽기(전사 검투 8레벨): 가장 단단한 적의 AC −2
  if (has(s, "readGap") && alive(c).length) {
    const target = [...alive(c)].sort((a, b) => MONSTERS[b.defId].ac - MONSTERS[a.defId].ac || b.hp - a.hp)[0];
    target.acDown = (target.acDown ?? 0) + 2;
    log(s, `【빈틈 읽기】 ${MONSTERS[target.defId].name}의 빈틈이 보인다 (AC -2)`, "skill");
  }
  let opener: Strike | null = null;
  // 전투 시작 기술은 높은 레벨에 배운 것부터(뒤에 배운 강한 주문이 앞 주문에 묻히지 않게).
  // 적이 여럿일 때 쓰는 광역 주문은 전투를 시작할 때의 적 수로 판정해 바로 쏜다.
  const startFoes = alive(c).length;
  const level = (id: string) => SKILL_LEVEL[id] ?? 1;
  const opening = activeSkills(s)
    .filter((sk) => sk.trigger!.on === "start" || (sk.trigger!.on === "enemiesAtLeast" && (sk.effect?.type === "espell" || sk.effect?.type === "spell") && startFoes >= sk.trigger!.n))
    .sort((a, b) => level(b.id) - level(a.id));
  for (const sk of opening) {
    const t = sk.trigger!;
    if (alive(c).length === 0) return finish(s, "win");
    if (!canUse(s, c, sk)) continue;
    if (t.on === "start" && t.minEnemies && alive(c).length < t.minEnemies) continue;
    const e = sk.effect!;
    if (e.type === "strike") {
      // 기선 제압·돌격 등이 겹치면 합친다
      opener = opener
        ? { hit: opener.hit + e.hit, dmg: opener.dmg + e.dmg, mult: Math.max(opener.mult, e.dmgMult ?? 1), autoHit: opener.autoHit || !!e.autoHit }
        : { hit: e.hit, dmg: e.dmg, mult: e.dmgMult ?? 1, autoHit: !!e.autoHit, src: sk.id };
      useSkill(s, c, sk);
    } else if (e.type === "weaken") {
      const target = [...alive(c)].sort((a, b) => MONSTERS[b.defId].ac - MONSTERS[a.defId].ac || b.hp - a.hp)[0];
      target.acDown = (target.acDown ?? 0) + e.ac;
      useSkill(s, c, sk, `${MONSTERS[target.defId].name}의 빈틈을 읽었다 (AC -${e.ac})`);
    } else if (e.type === "stunAll") {
      for (const foe of alive(c)) foe.stun = (foe.stun ?? 0) + e.rounds;
      useSkill(s, c, sk, "눈부신 가루에 적들이 눈을 감싸 쥔다");
    } else if (e.type === "stunOne") {
      const target = strongest(c);
      target.stun = (target.stun ?? 0) + e.rounds;
      useSkill(s, c, sk, `${josa(MONSTERS[target.defId].name, "을")} 방패로 밀쳐 넘어뜨렸다`);
    } else if (e.type === "guard") {
      c.guard = { ac: e.ac, rounds: e.rounds };
      useSkill(s, c, sk, `함성을 지르며 자세를 낮춘다 (AC +${e.ac}, ${e.rounds}라운드)`);
    } else if (e.type === "spell") {
      useSkill(s, c, sk, e.text);
      castSpell(s, c, e.dice, e.all, sk.id);
      if (alive(c).length === 0) return finish(s, "win");
    } else if (e.type === "espell") {
      // 각인으로 늘어난 횟수만큼 전투 시작 때 거듭 쏜다
      while (canUse(s, c, sk) && alive(c).length) {
        useSkill(s, c, sk, e.text);
        castElement(s, c, sk.id);
      }
      if (alive(c).length === 0) return finish(s, "win");
    } else if (e.type === "fog") {
      for (const foe of alive(c)) foe.hitDown = { n: e.hit, rounds: e.rounds };
      useSkill(s, c, sk, `${e.text} (적 명중 −${e.hit}, ${e.rounds}라운드)`);
    } else if (e.type === "bind") {
      const target = strongest(c);
      target.stun = Math.max(target.stun ?? 0, e.rounds);
      if (e.half) c.halfDmg = true;
      useSkill(s, c, sk, `${e.text} — ${josa(MONSTERS[target.defId].name, "이")} 움직이지 못한다`);
    } else if (e.type === "rampage") {
      c.rampage = Math.max(c.rampage ?? 0, e.rounds);
      useSkill(s, c, sk, e.text);
    } else if (e.type === "smoke") {
      for (const foe of alive(c)) foe.stun = Math.max(foe.stun ?? 0, e.rounds);
      c.smoke = e.flee;
      useSkill(s, c, sk, e.text);
    } else if (e.type === "steal") {
      useSkill(s, c, sk, e.text);
      const t = [...alive(c)].sort((a, b) => a.hp - b.hp)[0];
      const def = MONSTERS[t.defId];
      const dmg = Math.max(1, rngOf(s).dice(e.dice[0], e.dice[1]) + Math.max(smod(s, "str"), smod(s, "dex")));
      dealt(c, t, dmg, sk.id);
      t.stolen = true;
      log(s, `${def.name}에게 ${dmg} 피해`, "hit");
      if (t.hp <= 0) {
        gainLoot(s, c, def.id, t.stolen);
        log(s, `${josa(def.name, "을")} 쓰러뜨렸다.`, "good");
      }
      if (alive(c).length === 0) return finish(s, "win");
    } else if (e.type === "burnAll") {
      for (const foe of alive(c)) burn(s, foe, e.rounds);
      useSkill(s, c, sk, e.text);
    }
  }

  for (let round = 0; round < (c.limit ?? MAX_ROUNDS); round++) {
    const outcome = playerPhase(s, c, opener);
    opener = null;
    if (outcome) return finish(s, outcome);
    if (isDead(s)) return;
    enemyPhase(s, c);
    if (isDead(s)) return;
    c.halfDmg = false;
    if (c.rampage) c.rampage -= 1;
    plagueTick(s, c);
    burnTick(s, c);
    for (const foe of alive(c)) if (foe.hitDown && --foe.hitDown.rounds <= 0) foe.hitDown = undefined;
    escapeRares(s, c);
    if (alive(c).length === 0) return finish(s, "win");
    c.round += 1;
    if (c.guard && --c.guard.rounds <= 0) c.guard = null;
    if (c.cow) c.cow -= 1;
    // 진군 명령: 3라운드마다 아군 명중 +2(최대 +2)
    const commander = alive(c).find((x) => MONSTERS[x.defId].rally);
    if (commander && c.round % 3 === 0 && (c.rally ?? 0) < 2) {
      c.rally = (c.rally ?? 0) + 2;
      log(s, `${josa(MONSTERS[commander.defId].name, "이")} 진군 명령을 내린다! (아군 명중 +${c.rally})`, "hurt");
    }
    if (context === "dungeon") {
      passTime(s, 1);
      if (isDead(s)) return;
    }
  }
  log(s, "지쳐 서로 물러났다.", "system");
  finish(s, "fled");
}

function strongest(c: CombatState): Enemy {
  return [...alive(c)].sort((a, b) => MONSTERS[b.defId].atk * MONSTERS[b.defId].dice[1] - MONSTERS[a.defId].atk * MONSTERS[a.defId].dice[1] || b.hp - a.hp)[0];
}

/** 주문: 반드시 명중, 피해 = 주사위 + 지능 보정 */
function castSpell(s: GameState, c: CombatState, dice: [number, number], all: boolean, src: string): void {
  const r = rngOf(s);
  const targets = all ? alive(c) : [[...alive(c)].sort((a, b) => a.hp - b.hp)[0]];
  for (const t of targets) {
    const def = MONSTERS[t.defId];
    const dmg = Math.max(1, r.dice(dice[0], dice[1]) + smod(s, "int") + spellBonus(s));
    dealt(c, t, dmg, src);
    note(s, "int");
    log(s, `${def.name}에게 ${dmg} 피해`, "hit");
    if (t.hp <= 0) {
      gainLoot(s, c, def.id, t.stolen);
      log(s, `${josa(def.name, "을")} 쓰러뜨렸다.`, "good");
    }
  }
}

// ── 마법사 원소(elements.ts) ──

function has(s: GameState, id: string): boolean {
  return s.skills.includes(id);
}

/** 적을 불태운다(불의 각인이면 힘 보정이 더해진다) */
function burn(s: GameState, e: Enemy, rounds: number): void {
  const bonus = has(s, "fireMark") ? Math.max(0, smod(s, "str")) : 0;
  e.burn = { rounds: Math.max(e.burn?.rounds ?? 0, rounds), bonus };
}

/** 얼리거나 넘어뜨린다(1라운드 행동 불가) */
function freeze(e: Enemy): void {
  e.stun = Math.max(e.stun ?? 0, 1);
}

/** 서리의 각인: 얼림 확률 +20%p + 감각 보정 ×3%p */
function freezeChance(s: GameState, p: number): number {
  return p + (has(s, "frostMark") ? 0.25 + Math.max(0, smod(s, "per")) * 0.03 : 0);
}

/** 번개 같은 손: 민첩 보정 ×10% 확률로 두 번 굴려 높은 쪽 */
function rollDice(s: GameState, n: number, sides: number): number {
  const r = rngOf(s);
  const a = r.dice(n, sides);
  return has(s, "boltLuck") && r.chance(Math.max(0, smod(s, "dex")) * 0.1) ? Math.max(a, r.dice(n, sides)) : a;
}

/** 모든 주문 공통 추가 피해(모험가 마법사형: 마력 감응 +1, 주문꾼의 각인 +3) */
function spellBonus(s: GameState): number {
  return (has(s, "manaSense") ? 1 : 0) + (has(s, "casterMark") ? 3 : 0);
}

/** 치명타 피해 주사위 배수(행운의 일격 ×3) */
function critMult(s: GameState): number {
  return has(s, "luckyStrike") ? 3 : 2;
}

/** 원소별 추가 피해(열기·불의 각인·타오르는 의지·대지의 각인) */
function elementBonus(s: GameState, el: ElementKey, t: Enemy): number {
  let b = 0;
  if (has(s, "fireHeat")) b += 1 + Math.floor(Math.max(0, smod(s, "str")) / 2);
  if (el === "fire" && has(s, "fireMark")) b += 3;
  if (el === "frost" && has(s, "frostMark")) b += 3;
  if (el === "bolt" && has(s, "boltMark")) b += 2;
  if (has(s, "frostMark") && (t.stun ?? 0) > 0) b += 3; // 깨뜨리기
  if (el === "fire" && has(s, "fireWill") && hpPct(s) <= 30) b += 3;
  if (el === "earth" && has(s, "earthMark") && MONSTERS[t.defId].hard) b += 3;
  return b;
}

/** 원소 주문 한 발: 반드시 명중. 쓰러뜨렸으면 true */
function elementHit(s: GameState, c: CombatState, t: Enemy, sk: SkillDef, half = false): void {
  const e = sk.effect as Extract<SkillDef["effect"], { type: "espell" }>;
  const r = rngOf(s);
  const def = MONSTERS[t.defId];
  const sides = e.vary ? r.pick([4, 6, 8, 10]) : e.dice[1];
  let dmg = rollDice(s, e.dice[0], sides) + smod(s, "int") + spellBonus(s) + elementBonus(s, e.el, t) + (e.hardBonus && def.hard ? e.hardBonus : 0);
  dmg = Math.max(1, half ? Math.floor(dmg / 2) : dmg);
  dealt(c, t, dmg, sk.id);
  note(s, "int");
  const extra: string[] = [];
  if (t.hp > 0) {
    if (e.el === "fire" && has(s, "fireMark")) {
      burn(s, t, 3);
      extra.push("불탄다");
    }
    if (e.freeze && r.chance(freezeChance(s, e.freeze))) {
      freeze(t);
      extra.push("얼었다");
    }
    if (e.knock && r.chance(e.knock)) {
      freeze(t);
      extra.push("넘어졌다");
    }
    if (e.shock) {
      t.shock = Math.max(t.shock ?? 0, e.shock);
      extra.push("감전");
    }
  }
  log(s, `${def.name}에게 ${dmg} 피해${half ? " (튐)" : ""}${extra.length ? ` — ${extra.join(", ")}` : ""}`, "hit");
  if (t.hp <= 0) {
    gainLoot(s, c, def.id, t.stolen);
    log(s, `${josa(def.name, "을")} 쓰러뜨렸다.`, "good");
  }
}

/** 원소 주문(액티브)을 쏜다. target이 있으면 그 적에게 */
function castElement(s: GameState, c: CombatState, skillId: string, target?: Enemy): void {
  const sk = SKILLS[skillId];
  const e = sk.effect as Extract<SkillDef["effect"], { type: "espell" }>;
  const r = rngOf(s);
  for (let k = 0; k < (e.casts ?? 1) && alive(c).length; k++) {
    if (e.all) {
      for (const foe of alive(c)) elementHit(s, c, foe, sk);
      continue;
    }
    const foes = alive(c);
    const t = target && target.hp > 0 ? target
      : e.pick === "strongest" ? strongest(c)
      : e.pick === "hard" ? [...foes].sort((a, b) => Number(!!MONSTERS[b.defId].hard) - Number(!!MONSTERS[a.defId].hard) || a.hp - b.hp)[0]
      : [...foes].sort((a, b) => a.hp - b.hp)[0];
    elementHit(s, c, t, sk);
    if (e.bounce) {
      // 번개의 각인: 한 번 더, 행운 보정 ×10%로 또 한 번
      const jumps = 1 + (has(s, "boltMark") ? 1 + (r.chance(Math.max(0, smod(s, "dex")) * 0.1) ? 1 : 0) : 0);
      for (let j = 0; j < jumps; j++) {
        const others = alive(c).filter((x) => x !== t);
        if (!others.length) break;
        elementHit(s, c, r.pick(others), sk, true);
      }
    }
  }
}

/** 불타는 적: 라운드마다 1d3 + bonus */
function burnTick(s: GameState, c: CombatState): void {
  const r = rngOf(s);
  for (const e of alive(c)) {
    if (!e.burn || e.burn.rounds <= 0) continue;
    const def = MONSTERS[e.defId];
    const dmg = r.dice(1, 3) + e.burn.bonus;
    dealt(c, e, dmg, "burn");
    e.burn.rounds -= 1;
    log(s, `${josa(def.name, "이")} 불길 속에서 몸부림친다. ${dmg} 피해`, "hit");
    if (e.hp <= 0) {
      gainLoot(s, c, def.id, e.stolen);
      log(s, `${josa(def.name, "이")} 타 버렸다.`, "good");
    }
  }
}

/** 적의 명중 보정: 무리의 우두머리, 밤의 늑대, 진군 명령 */
function enemyHitBonus(s: GameState, c: CombatState, e: Enemy): number {
  const def = MONSTERS[e.defId];
  let b = 0;
  const leader = alive(c).find((x) => x !== e && MONSTERS[x.defId].packOf === e.defId);
  if (leader) b += MONSTERS[leader.defId].packBuff ?? 0;
  if (def.nocturnal && isNight(s)) b += 1;
  if (!def.rally && c.rally) b += c.rally;
  return b;
}

/** 역병의 신 ★2: 병든 적은 라운드마다 1d3 */
function plagueTick(s: GameState, c: CombatState): void {
  const r = rngOf(s);
  for (const e of alive(c)) {
    if (!e.sick) continue;
    const def = MONSTERS[e.defId];
    const dmg = r.dice(1, 3);
    dealt(c, e, dmg, "plague");
    log(s, `${josa(def.name, "이")} 병으로 몸부림친다. ${dmg} 피해`, "hit");
    if (e.hp <= 0) {
      gainLoot(s, c, def.id, e.stolen);
      log(s, `${josa(def.name, "이")} 병으로 쓰러졌다.`, "good");
    }
  }
}

/** 희귀 개체는 정해진 라운드가 지나면 달아난다 */
function escapeRares(s: GameState, c: CombatState): void {
  for (const e of alive(c)) {
    const def = MONSTERS[e.defId];
    if (def.escapeAfter && c.round >= def.escapeAfter) {
      e.hp = 0;
      e.fled = true;
      log(s, `${josa(def.name, "이")} 벽 틈으로 쏙 빠져 달아났다! 마석이 멀어진다…`, "miss");
    }
  }
}

function gainLoot(s: GameState, c: CombatState, defId: string, stolen = false): void {
  if (c.context === "dummy") return;
  const def = MONSTERS[defId];
  const mana = stolen ? Math.round(def.mana * 1.5) : def.mana; // 손버릇
  if (def.rare) c.bonus += mana;
  else c.loot += mana;
  s.codex.kills[defId] = (s.codex.kills[defId] ?? 0) + 1;
  // 초원의 짐승은 고기를 남긴다(늑대·군마)
  if (["wolf", "alphawolf", "warhorse"].includes(defId) && rngOf(s).chance(0.25)) {
    s.inventory.food += 1;
    log(s, `${josa(def.name, "을")} 손질해 말린 고기 1개를 만들었다. (말린 고기 ${s.inventory.food})`, "good");
  }
  if (["rat", "goldrat", "boss"].includes(defId)) pray(s, "plague", 1);
  if (c.context === "dungeon" && (s.dungeon?.floor ?? 1) >= 2) pray(s, "abyss", s.dungeon!.floor - 1);
  // 편린은 미궁 안에서만 맺힌다
  const f = FRAGMENTS[defId];
  if (c.context === "dungeon" && f && rngOf(s).chance(f.chance)) {
    c.frags.push(defId);
    if (!s.codex.fragSeen.includes(defId)) s.codex.fragSeen.push(defId);
    log(s, `쓰러진 ${def.name}의 몸에서 희미한 빛 조각이 떠오른다 — 편린이다!`, "crit");
  }
}

function canUse(s: GameState, c: CombatState, sk: SkillDef): boolean {
  // 특화(각인): 그 레벨표의 액티브는 전투당 1회 더
  const extra = (MARK_FOR_SKILL[sk.id] ?? []).some((m) => s.skills.includes(m)) ? 1 : 0;
  return (c.used[sk.id] ?? 0) < (sk.uses ?? 1) + extra;
}

function useSkill(s: GameState, c: CombatState, sk: SkillDef, text?: string): void {
  c.used[sk.id] = (c.used[sk.id] ?? 0) + 1;
  log(s, `【${sk.name}】${text ? " " + text : ""}`, "skill");
}

function hpPct(s: GameState): number {
  return (s.hero.hp / maxHp(s)) * 100;
}

/** 내 HP 조건 기술(행동을 쓰지 않는 반사 행동) */
function selfTriggers(s: GameState, c: CombatState): void {
  for (const sk of activeSkills(s)) {
    const t = sk.trigger!;
    if (t.on !== "selfBelow" || hpPct(s) > t.pct || !canUse(s, c, sk)) continue;
    const e = sk.effect!;
    if (e.type === "guard") {
      c.guard = { ac: e.ac, rounds: e.rounds };
      useSkill(s, c, sk, `몸을 지킨다 (AC +${e.ac}, ${e.rounds}라운드)`);
    } else if (e.type === "rampage") {
      c.rampage = e.rounds;
      useSkill(s, c, sk, `${e.text} (${e.rounds}라운드 동안 한 번 더 공격)`);
    } else if (e.type === "eguard") {
      c.guard = { ac: e.ac, rounds: e.rounds, freeze: e.freeze, reduce: e.reduce, counter: e.counter };
      useSkill(s, c, sk, `${e.text} (AC +${e.ac}, ${e.rounds}라운드)`);
    } else if (e.type === "heal") {
      const heal = rngOf(s).dice(e.dice[0], e.dice[1]) + (e.plusInt ? Math.max(0, smod(s, "int")) : 0);
      s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
      useSkill(s, c, sk, `상처에 약초를 짓눌렀다 (HP +${heal})`);
    }
  }
}

function playerPhase(s: GameState, c: CombatState, opener: Strike | null): "win" | "fled" | null {
  // 머리 중상: 라운드마다 기절
  if (lvl(s, "head") >= 2 && rngOf(s).chance(HEAD_STUN)) {
    log(s, "머리가 울려 눈앞이 하얘졌다 — 몸이 움직이지 않는다.", "miss");
    return null;
  }
  // 정신 상태이상 조합
  c.frenzy = false;
  const combo = comboNow(s);
  if (combo?.name === "무너짐") return null;
  if (combo?.name === "패닉") return tryFlee(s, c) ? "fled" : null;
  if (combo?.name === "발작") {
    c.frenzy = true;
    for (let k = 0; k < 2 && alive(c).length; k++) {
      const t = alive(c)[rngOf(s).int(0, alive(c).length - 1)];
      attack(s, c, t, { ...PLAIN, dmg: 2 });
    }
    return alive(c).length === 0 ? "win" : null;
  }
  for (let a = 0; a < actionsPerRound(s) + (c.rampage ? 1 : 0); a++) {
    selfTriggers(s, c);
    const pct = hpPct(s);
    const { potionAt, fleeAt } = s.tactics;
    if (potionAt > 0 && pct <= potionAt && s.inventory.potion > 0 && !missPotion(s)) {
      drink(s, "전투 중에");
      continue;
    }
    if (symptom(s, "fear", MIND.symptom, "몸이 얼어붙어 움직이지 않는다!", "손이 떨려 무기를 제대로 쥐지 못했다.")) continue;
    if (symptom(s, "confusion", MIND.symptom, "엉뚱한 곳을 내리쳤다!", "어디를 노렸는지 순간 헷갈렸다.")) continue;
    if (fleeAt > 0 && pct <= fleeAt) {
      return tryFlee(s, c) ? "fled" : null;
    }
    const foes = alive(c);
    const sweep = activeSkills(s).find((sk) => sk.trigger!.on === "enemiesAtLeast" && foes.length >= (sk.trigger as { n: number }).n && canUse(s, c, sk));
    if (sweep && sweep.effect!.type === "sweep") {
      useSkill(s, c, sweep, "칼을 크게 휘둘러 모두를 벤다");
      for (const foe of foes) attack(s, c, foe, { ...PLAIN, mult: sweep.effect!.dmgMult, src: sweep.id });
    } else if (sweep && sweep.effect!.type === "spell") {
      useSkill(s, c, sweep, sweep.effect!.text);
      castSpell(s, c, sweep.effect!.dice, sweep.effect!.all, sweep.id);
    } else if (sweep && sweep.effect!.type === "espell") {
      useSkill(s, c, sweep, sweep.effect!.text);
      castElement(s, c, sweep.id);
    } else {
      const target = [...foes].sort((x, y) => x.hp - y.hp)[0];
      let strike = opener && a === 0 ? opener : PLAIN;
      const def = MONSTERS[target.defId];
      const fin = activeSkills(s).find((sk) => sk.trigger!.on === "targetBelow" && (target.hp / (target.hpMax ?? def.hp)) * 100 <= (sk.trigger as { pct: number }).pct && canUse(s, c, sk));
      if (fin && fin.effect!.type === "espell") {
        useSkill(s, c, fin, fin.effect!.text);
        castElement(s, c, fin.id, target);
        if (alive(c).length === 0) return "win";
        continue;
      }
      if (fin && fin.effect!.type === "strike") {
        const e = fin.effect!;
        useSkill(s, c, fin, `${josa(def.name, "을")} 노린다`);
        strike = { hit: e.hit, dmg: e.dmg, mult: e.dmgMult ?? 1, autoHit: !!e.autoHit, stun: e.stun, crit: e.crit, src: fin.id };
      }
      attack(s, c, target, strike);
    }
    if (alive(c).length === 0) return "win";
  }
  return null;
}

function attack(s: GameState, c: CombatState, target: Enemy, st: Strike): void {
  const def = MONSTERS[target.defId];
  const r = rngOf(s);
  const ac = def.ac + (target.acUp ?? 0) - (target.acDown ?? 0);
  const w = weaponOf(s);
  const statMod = smod(s, w.stat);
  const roll = r.die(20);
  const held = (target.stun ?? 0) > 0;
  const magicHit = w.magic ? (held && has(s, "frostEye") ? 3 : 0) + (def.flying && has(s, "boltMark") ? 2 : 0) : 0;
  if (c.meter) c.meter.swings++;
  const bonus = statMod + BAL.proficiency + passive(s, "hit") + st.hit + rollPenalty(s) + faithHit(s, alive(c).length) + injuryHit(s) + (def.flying && !w.magic ? -2 : 0) + magicHit;
  if (!st.autoHit && roll === 1) {
    log(s, `손이 미끄러졌다! (주사위 1)`, "miss");
    return;
  }
  if (!st.autoHit && roll !== 20 && roll + bonus < ac) {
    log(s, `${josa(def.name, "을")} 노렸지만 빗나갔다. (${roll}+${bonus} vs AC ${ac})`, "miss");
    return;
  }
  const crit = !noCrit(s) && (!!st.crit || roll === 20 || r.float() * 100 < 5 + smod(s, "luk") + passive(s, "crit") + (w.magic && held && has(s, "frostEye") ? 15 : 0));
  if (c.meter) {
    c.meter.hits++;
    if (crit) c.meter.crits++;
  }
  if (c.context !== "dummy") selfInjury(s, def.id, w.magic);
  // 각인: 마력탄 강화(불 +3, 서리 +2, 번개 +2, 대지 +2·단단한 적 +3)
  const magicDmg = w.magic
    ? (has(s, "casterMark") ? 2 : 0) + (has(s, "earthMark") ? 2 + (def.hard ? 3 : 0) : 0) + (has(s, "fireMark") ? 3 : 0) + (has(s, "frostMark") ? 2 + (held ? 3 : 0) : 0) + (has(s, "boltMark") ? 2 : 0)
    : 0;
  const fury = has(s, "berserkMark") && hpPct(s) <= 50 ? 3 : 0; // 광전의 각인
  const base = (w.magic ? rollDice(s, w.dice[0] * (crit ? critMult(s) : 1), w.dice[1]) : r.dice(w.dice[0] * (crit ? critMult(s) : 1), w.dice[1])) + magicDmg + fury + statMod + passive(s, "dmg") + st.dmg + faithDmg(s) + rageDmg(s) + abyssEdge(s, s.hero.hp / maxHp(s)).dmg;
  const dmg = Math.max(1, Math.round(base * st.mult));
  dealt(c, target, dmg, st.src ?? "attack");
  if (crit) note(s, "luk");
  log(s, `${def.name}에게 ${w.verb} 명중! ${dmg} 피해${crit ? " (치명타!)" : ""}`, crit ? "crit" : "hit");
  // 역병의 신 ★2 "전염"
  if (target.hp > 0 && !target.sick && s.disease > 0 && power(s, "plague", 2) && r.chance(0.25)) {
    target.sick = true;
    log(s, `【${GODS.plague.name}】 ${josa(def.name, "이")} 병에 옮았다.`, "skill");
  }
  if (st.stun && target.hp > 0) target.stun = Math.max(target.stun ?? 0, st.stun);
  // 마력탄의 원소: 불씨·불의 각인(불탐), 서리 손끝·서리의 각인(얼림), 번개의 각인(튐)
  if (w.magic && target.hp > 0) {
    if ((has(s, "fireEmber") && r.chance(0.2)) || (has(s, "fireMark") && r.chance(0.3))) {
      burn(s, target, 2);
      log(s, `【불씨】 ${def.name}에게 불이 옮겨붙었다.`, "skill");
    }
    if ((has(s, "frostTouch") && r.chance(freezeChance(s, 0.25))) || (has(s, "frostMark") && r.chance(0.25))) {
      freeze(target);
      log(s, `【서리】 ${josa(def.name, "이")} 얼어붙었다.`, "skill");
    }
  }
  if (w.magic && has(s, "boltMark")) {
    const others = alive(c).filter((x) => x !== target);
    if (others.length) {
      const o = r.pick(others);
      const half = Math.max(1, Math.floor(dmg / 2));
      dealt(c, o, half, "boltMark");
      log(s, `【번개의 각인】 마력탄이 ${MONSTERS[o.defId].name}에게 튀었다. ${half} 피해`, "hit");
      if (o.hp <= 0) {
        gainLoot(s, c, o.defId, o.stolen);
        log(s, `${josa(MONSTERS[o.defId].name, "을")} 쓰러뜨렸다.`, "good");
      }
    }
  }
  if (target.hp <= 0) {
    note(s, w.magic ? w.stat : w.stat === "dex" ? "dex" : "str");
    gainLoot(s, c, def.id, target.stolen);
    log(s, `${josa(def.name, "을")} 쓰러뜨렸다.`, "good");
    if (power(s, "war", 2)) s.hero.hp = Math.min(maxHp(s), s.hero.hp + 2); // 전쟁의 신 ★2
    if (has(s, "bloodThirst")) {
      s.hero.hp = Math.min(maxHp(s), s.hero.hp + 3);
      log(s, "【피의 갈증】 HP +3", "skill");
    }
    // 연속 베기: 같은 라운드에 다른 적을 한 번 더
    const chain = SKILLS.chainSlash;
    if (has(s, "chainSlash") && canUse(s, c, chain) && alive(c).length) {
      useSkill(s, c, chain, "멈추지 않고 다음 적을 벤다");
      attack(s, c, [...alive(c)].sort((a, b) => a.hp - b.hp)[0], { ...PLAIN, src: "chainSlash" });
    }
  }
}

/**
 * 로그 접기: 피해 없이 이긴 평범한 전투는 등장 줄만 남기고 세부를 접어 요약 한 줄로 보여 준다
 * (화면에서 요약 줄을 누르면 펼쳐진다). 희귀·정예·보스·이단심문관·편린이 나온 전투는 접지 않는다.
 */
function foldEasyFight(s: GameState, c: CombatState): void {
  if (c.logFrom === undefined || s.hero.hp < (c.hpStart ?? 0) || c.frags.length) return;
  if (c.enemies.some((e) => { const d = MONSTERS[e.defId]; return d.rare || d.elite || d.human || d.hidden || e.defId === "boss" || e.defId === "general"; })) return;
  const n = s.logCount - c.logFrom; // 등장 줄 포함
  if (n < 4 || n > s.log.length) return; // 세부가 3줄 이상일 때만 접는다
  const lines = s.log.slice(s.log.length - n + 1);
  for (const l of lines) l.fold = c.logFrom;
  const used = Object.keys(c.used).map((id) => SKILLS[id]?.name).filter(Boolean);
  log(s, `→ 다치지 않고 정리했다${used.length ? ` — ${used.join(" · ")}` : ""}`, "good");
  const sum = s.log[s.log.length - 1];
  sum.foldOf = c.logFrom;
  sum.foldN = lines.length;
}

/** 반응 기술(맞받아치기·흘려내기·방패 반격)의 반격 한 번 */
function counter(s: GameState, c: CombatState, e: Enemy, skillId: string | null, text: string, bonus = 0): void {
  if (e.hp <= 0 || isDead(s)) return;
  if (skillId) useSkill(s, c, SKILLS[skillId], text);
  else log(s, text, "skill");
  attack(s, c, e, { ...PLAIN, dmg: bonus, src: skillId ?? "counter" });
}

/** 때리다 자기 손을 다친다: 맨손이면 중간 확률, 단단한 몬스터면 낮은 확률(마력탄은 제외) */
function selfInjury(s: GameState, defId: string, magic?: boolean): void {
  if (magic || isDead(s)) return;
  const r = rngOf(s);
  const fists = weaponOf(s).verb === "주먹을 휘둘러";
  if (fists && r.chance(INJ.fistSelf)) wound(s, "main", "맨주먹으로 내리치다 손을 다쳤다");
  else if (MONSTERS[defId]?.hard && r.chance(INJ.hardSelf)) wound(s, "main", `${MONSTERS[defId].name}의 단단한 몸을 치다 손목이 꺾였다`);
}

/** 맞았을 때 부상·질병 */
function hitInjury(s: GameState, defId: string, dmg: number, crit: boolean): void {
  const def = MONSTERS[defId];
  const r = rngOf(s);
  const p = (crit ? INJ.hitCrit : dmg >= maxHp(s) * INJ.heavyRatio ? INJ.hitHeavy : INJ.hitNormal) * (has(s, "guardMark") ? 0.5 : 1); // 수호의 각인
  if (r.chance(p)) {
    const w: Partial<Record<Part, number>> = { head: 1, body: 1, main: 1, offhand: 1, feet: 1, ...(def.wound ?? {}) };
    // 방패(무기가 아닌 왼손 장비)는 왼손을 지킨다
    const shield = s.gear.offhand && !GEAR_IS_WEAPON(s.gear.offhand);
    if (shield) w.offhand = (w.offhand ?? 1) / (skillWorks(s, "shieldCraft") ? 4 : 2); // 방패술이면 더
    const part = r.weighted((Object.entries(w) as [Part, number][]).map(([item, wt]) => ({ item, w: wt })));
    const dead = wound(s, part, `${def.name}의 공격`);
    s.hero.hp = Math.min(s.hero.hp, maxHp(s)); // 몸통 부상은 최대 HP를 깎는다
    if (dead === "oblivion") kill(s, "oblivion", `${def.name}의 일격에 머리를 잃었다`);
    else if (dead === "body") kill(s, "single", `${def.name}에게 몸통을 꿰뚫려 쓰러졌다`);
    if (isDead(s)) return;
  }
  const dz = defId === "boss" ? INJ.diseaseBoss : ["rat", "goldrat"].includes(defId) ? INJ.diseaseRat : 0;
  if (dz && r.chance(dz * faithInfectMult(s))) infect(s);
}

export function potionHeal(s: GameState): number {
  return rngOf(s).dice(2, 4) + BAL.potionBase + passive(s, "potion");
}

function drink(s: GameState, when: string): void {
  s.inventory.potion -= 1;
  const heal = potionHeal(s);
  s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
  log(s, `${when} 치료 물약을 마셨다. HP +${heal} (남은 물약 ${s.inventory.potion})`, "good");
}

function tryFlee(s: GameState, c: CombatState): boolean {
  if (!canFlee(s)) {
    log(s, "다친 다리로는 도망칠 수 없다!", "miss");
    return false;
  }
  const dc = BAL.fleeDcBase + alive(c).length * 2;
  const roll = rngOf(s).die(20);
  const bonus = smod(s, "dex") + passive(s, "flee") + rollPenalty(s) + (c.smoke ?? 0);
  if (roll === 20 || (roll !== 1 && roll + bonus >= dc)) {
    note(s, "dex");
    log(s, `등을 돌려 달아났다! (${roll}+${bonus} vs ${dc})`, "system");
    return true;
  }
  log(s, `도망치려 했지만 막혔다! (${roll}+${bonus} vs ${dc})`, "miss");
  return false;
}

function enemyPhase(s: GameState, c: CombatState): void {
  const r = rngOf(s);
  const attackers = alive(c);
  const ac = heroAc(s) + (c.guard?.ac ?? 0);
  for (const e of attackers) {
    const def = MONSTERS[e.defId];
    if (def.dummy) continue;
    if (e.stun && e.stun > 0) {
      e.stun -= 1;
      log(s, `${josa(def.name, "이")} 비틀거리며 공격하지 못한다.`, "miss");
      continue;
    }
    if (e.shock && e.shock > 0) {
      e.shock -= 1;
      if (r.chance(0.5)) {
        log(s, `${josa(def.name, "이")} 감전돼 몸이 말을 듣지 않는다.`, "miss");
        continue;
      }
    }
    const roll = r.die(20);
    const atk = def.atk + (e.atkUp ?? 0) + enemyHitBonus(s, c, e) - (e.hitDown?.n ?? 0);
    if (!c.frenzy && (roll === 1 || (roll !== 20 && roll + atk - (c.cow ? 2 : 0) < ac))) {
      note(s, "dex");
      log(s, `${def.name}의 공격을 피했다.`, "miss");
      c.streak = 0;
      // 흘려내기(빗나가면 반격), 방패 반격(30%)
      if (c.guard?.counter) counter(s, c, e, null, "【흘려내기】 흘려낸 칼끝이 그대로 파고든다");
      else if (activeSkills(s).some((k) => k.id === "shieldCounter") && canUse(s, c, SKILLS.shieldCounter) && r.chance(0.3)) counter(s, c, e, "shieldCounter", "방패로 받아내고 되받아친다");
      if (alive(c).length === 0) return;
      continue;
    }
    const crit = roll === 20 || !!c.frenzy; // 발작 중에는 방어를 잊는다
    c.streak = (c.streak ?? 0) + 1;
    let dmg = Math.max(1, r.dice(def.dice[0] * (crit ? 2 : 1), def.dice[1]) + (e.dmgUp ?? 0));
    // 돌진: 전투 첫 공격 피해 2배
    const charge = def.charge && !(c.charged ?? []).includes(e.uid);
    if (def.charge) (c.charged ??= []).push(e.uid);
    if (charge) dmg *= 2;
    if (c.guard?.reduce) dmg = Math.max(1, dmg - c.guard.reduce);
    if (has(s, "guardMark")) dmg = Math.max(1, dmg - 2); // 수호의 각인
    if (c.halfDmg) dmg = Math.max(1, Math.ceil(dmg / 2));
    s.hero.hp -= dmg;
    // 얼음 갑옷(때린 적을 얼림), 정전기(때린 적 명중 −2)
    if (c.guard?.freeze && r.chance(freezeChance(s, c.guard.freeze))) freeze(e);
    if (has(s, "boltStatic") && r.chance(0.25)) e.hitDown = { n: 2, rounds: 2 }; // 이번 라운드 끝에 1 줄어 다음 라운드에 적용
    log(s, `${josa(def.name, "이")} ${charge ? "돌진해 " : ""}${def.attackText}! ${dmg} 피해${crit ? " (치명타!)" : ""}`, "hurt");
    if (s.hero.hp > 0) {
      hitInjury(s, def.id, dmg, crit);
      if (isDead(s)) return;
      // 비명(혼란)·함성(공포)
      if (def.scream) afflict(s, "confusion", def.scream, `${def.name}의 비명이 머릿속을 긁고 지나간다.`);
      if (def.fearHit) afflict(s, "fear", def.fearHit, `${def.name}의 함성이 등골을 얼린다.`);
      // 분노(연속으로 맞음), 공포(HP 20% 이하)
      if (c.streak >= MIND.rageStreakHits) afflict(s, "rage", MIND.rageStreak, "이를 악물었다. 머리끝까지 피가 몰린다.");
      if (!c.fearRolled && s.hero.hp <= maxHp(s) * 0.2) {
        c.fearRolled = true;
        afflict(s, "fear", MIND.fearLowHp, "죽음이 바로 옆에 와 있다는 걸 알았다.");
      }
      // 맞받아치기: 치명타를 맞으면 즉시 반격
      if (crit && has(s, "riposte") && canUse(s, c, SKILLS.riposte)) {
        counter(s, c, e, "riposte", "이를 악물고 되받아친다", 2);
        if (alive(c).length === 0) return;
      }
    }
    if (s.hero.hp <= 0) {
      const grit = activeSkills(s).find((sk) => sk.trigger!.on === "lethal" && !s.tripUsed.includes(sk.id));
      // 시와 노래의 신 ★3 "끝나지 않은 노래"(미궁마다 1회)
      // 탐욕/채무의 신 ★2 "목숨값"(미궁마다 1회, 들고 있는 마석이 있어야)
      if (!grit && c.context === "dungeon" && power(s, "greed", 2) && !s.tripUsed.includes("faithGreed") && (s.dungeon?.mana ?? 0) > 0) {
        s.tripUsed.push("faithGreed");
        const paid = Math.ceil(s.dungeon!.mana / 2);
        s.dungeon!.mana -= paid;
        s.hero.hp = 1;
        log(s, `【${GODS.greed.name}】 목숨값 — 마석 ${paid}G 어치가 손에서 녹아 사라지고, 숨이 붙어 있다. (HP 1)`, "skill");
        continue;
      }
      if (!grit && power(s, "song", 3) && !s.tripUsed.includes("faithSong")) {
        s.tripUsed.push("faithSong");
        s.hero.hp = 1;
        log(s, `【${GODS.song.name}】 끝나지 않은 노래 — 아직 이 이야기는 끝나지 않았다. (HP 1)`, "skill");
        continue;
      }
      if (grit) {
        s.tripUsed.push(grit.id);
        s.hero.hp = 1;
        log(s, `【${SKILLS[grit.id].name}】 무릎이 꺾이기 직전, 이를 악물고 버텼다. (HP 1)`, "skill");
        continue;
      }
      s.hero.hp = 0;
      const cause = attackers.length >= 2 ? "mob" : "single";
      kill(s, cause, cause === "mob" ? `${describeGroup(attackers)}에게 둘러싸여 쓰러졌다` : `${def.name}에게 쓰러졌다`);
      return;
    }
    note(s, "con");
  }
}

function finish(s: GameState, outcome: "win" | "fled"): void {
  const c = s.combat!;
  s.combat = null;
  if (c.context === "dummy") return; // 허수아비: 보상·신앙·기록 없음
  if (outcome === "win") foldEasyFight(s, c);
  // 신앙심: 전쟁의 신은 여럿과 싸워 이기는 것을 좋아하고 도주를 싫어한다
  if (outcome === "win" && c.enemies.length >= 2) pray(s, "war", 3);
  if (outcome === "fled") pray(s, "war", -3);
  // 기아/풍요의 신 ★3 "한 몸의 두 얼굴"
  if (outcome === "win" && s.hero.satiety <= 30 && power(s, "hunger", 3)) {
    s.hero.satiety = Math.min(100, s.hero.satiety + 25);
    s.hero.hp = Math.min(maxHp(s), s.hero.hp + 5);
    log(s, `【${GODS.hunger.name}】 굶주림이 풍요로 뒤집힌다 — 포만감 +25, HP +5`, "skill");
  }
  if (c.context === "field") afterFieldCombat(s, outcome, c);
  else afterDungeonCombat(s, outcome, c);
}
