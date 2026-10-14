import { josa } from "./josa";
import { BAL, MONSTERS } from "./data";
import { actionsPerRound, check, heroAc, isDead, kill, log, maxHp, note, rngOf, rollPenalty, sagaBonus, smod } from "./core";
import { FRAGMENTS } from "./fragments";
import { GODS, abyssEdge, faithDmg, faithHit, faithInfectMult, power, pray } from "./faith";
import { HEAD_STUN, INJ, canFlee, infect, injuryHit, lvl, noCrit, wound, type Part } from "./injury";
import { MIND, afflict, comboNow, missPotion, rageDmg, symptom } from "./mind";
import { activeSkills, passive, skillWorks, SKILLS, type SkillDef } from "./skills";
import { GEAR, gearHas, hasShield, weaponCorrosion, weaponOf } from "./gear";
import { corrode, moldAfflict, paraFires, paralyze, poisonAfflict, poisonOf } from "./hazards";
import { blastDamage, burnWound, chill, stagnant, windy } from "./fire";
import { MARK_FOR_SKILL, SKILL_LEVEL, type ElementKey } from "./elements";

const GEAR_IS_WEAPON = (id: string) => !!GEAR[id]?.weapon;
import type { CombatState, DamageMeter, Enemy, GameState } from "./types";
import { scaleEnemy } from "./endless";
import { afterDungeonCombat, highTide, isNight, passTime } from "./dungeon";
import { afterFieldCombat } from "./town";

// 자동 전투(2026-10-13 변경): 플레이어는 공격을 고르지 않는다. 라운드마다
// 플레이어 행동(물약·도주 방침 → 조건부 기술 → 가장 약한 적 공격) → 적 전체 행동을 자동으로 굴리고,
// 결과는 로그로 흘려보낸다. 위치 개념이 없으므로 "포위"는 동시에 살아있는 적 수로 표현한다.

const MAX_ROUNDS = 60;

export function makeEnemies(s: GameState, ids: string[]): Enemy[] {
  const list: Enemy[] = ids.map((defId) => ({ uid: s.nextUid++, defId, hp: MONSTERS[defId].hp }));
  // 화염 정령: 공기가 고이면 더 커진다
  if (stagnant(s)) for (const e of list) if (MONSTERS[e.defId].stagnantHp) e.hp = e.hpMax = MONSTERS[e.defId].hp + MONSTERS[e.defId].stagnantHp!;
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
  // 잠긴 석상(석상인 척)·불도롱뇽(지하수 곁에 숨음): 감각 판정에 실패하면 기습
  const dgNow = s.dungeon;
  const nearPool = !!dgNow && (dgNow.rooms[dgNow.current]?.pool || dgNow.rooms[dgNow.current]?.edges.some((x) => dgNow.rooms[x].pool));
  if (!opts.surprise && context === "dungeon" && enemies.some((e) => MONSTERS[e.defId].statue || (MONSTERS[e.defId].lurk && nearPool))) {
    const c2 = check(s, "per", 14);
    if (c2.ok) log(s, `석상의 눈이 움직이는 것을 먼저 알아챘다. (감각 ${c2.total} vs 14)`, "system");
    else {
      log(s, `그냥 석상인 줄 알았다 — 돌 주먹이 먼저 날아온다! (감각 ${c2.total} vs 14)`, "hurt");
      opts = { ...opts, surprise: true };
    }
  }
  // 기습: 적이 먼저 한 번 행동한다(함정을 밟은 상대를 노리는 고블린 등)
  if (opts.surprise && power(s, "trap", 3)) log(s, `【${GODS.trap.name}】 먼저 온 경고 — 기습을 미리 알아챘다.`, "skill");
  else if (opts.surprise) {
    log(s, "기습! 자세를 잡기도 전에 공격이 들어온다.", "hurt");
    enemyPhase(s, c);
    if (isDead(s)) return;
    if (alive(c).length === 0) return finish(s, "win"); // 기습을 받아치다 다 쓰러뜨렸다
  }

  if (context === "dungeon" && s.dungeon?.sector === 4) {
    if (mineOpening(s, c)) return;
    if (alive(c).length === 0) return finish(s, "win");
  }
  // 재앙의 신 ★4 "함정 다루기": 챙겨 둔 함정을 적 하나에게 터뜨린다
  if (context === "dungeon" && s.dungeon?.trapCharge && alive(c).length) {
    s.dungeon.trapCharge = false;
    const t = strongest(c);
    const dmg = rngOf(s).dice(2, 6);
    dealt(c, t, dmg, "trap4");
    log(s, `【${GODS.trap.name}】 함정 다루기 — 챙겨 둔 함정이 ${MONSTERS[t.defId].name}의 발밑에서 터졌다. ${dmg} 피해`, "skill");
    if (t.hp <= 0) {
      gainLoot(s, c, t.defId, t.stolen);
      log(s, `${josa(MONSTERS[t.defId].name, "을")} 쓰러뜨렸다.`, "good");
    }
    if (alive(c).length === 0) return finish(s, "win");
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
      if (e.dice) {
        const dmg = rngOf(s).dice(e.dice[0], e.dice[1]) + Math.max(0, smod(s, "str"));
        dealt(c, target, dmg, sk.id);
        log(s, `${MONSTERS[target.defId].name}에게 ${dmg} 피해`, "hit");
        if (target.hp <= 0) killed(s, c, target);
      }
      useSkill(s, c, sk, e.text ? `${e.text} ${josa(MONSTERS[target.defId].name, "이")} 멈칫한다` : `${josa(MONSTERS[target.defId].name, "을")} 방패로 밀쳐 넘어뜨렸다`);
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
      if (e.ac) c.guard = { ac: e.ac, rounds: e.rounds };
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
    } else if (e.type === "sweep") {
      // 검무: 시작하자마자 적 전원을 한 번씩
      useSkill(s, c, sk, "칼끝이 적들 사이를 돈다");
      for (const foe of alive(c)) attack(s, c, foe, { ...PLAIN, mult: e.dmgMult, src: sk.id });
    } else if (e.type === "strikeStrong") {
      useSkill(s, c, sk, e.text);
      attack(s, c, strongest(c), { hit: 0, dmg: 0, mult: e.mult, autoHit: true, crit: e.crit, src: sk.id });
    } else if (e.type === "zero") {
      for (const foe of alive(c)) foe.stun = Math.max(foe.stun ?? 0, bossy(foe) ? e.bossRounds : e.rounds);
      if (e.half) c.halfDmg = true;
      useSkill(s, c, sk, `${e.text} — 적들이 얼어붙었다`);
    } else if (e.type === "rampart") {
      c.halfRounds = Math.max(c.halfRounds ?? 0, e.rounds);
      useSkill(s, c, sk, `${e.text} (${e.rounds}라운드 동안 받는 피해 절반)`);
    } else if (e.type === "fury") {
      c.fury = { rounds: e.rounds, extra: e.extra, taken: e.taken };
      useSkill(s, c, sk, `${e.text} (${e.rounds}라운드 동안 매 라운드 ${e.extra}번 더 공격, 받는 피해 +${e.taken})`);
    } else if (e.type === "venom") {
      const t = strongest(c);
      t.venom = { rounds: e.rounds, dice: e.dice };
      useSkill(s, c, sk, `${e.text} — ${josa(MONSTERS[t.defId].name, "이")} 중독됐다`);
    }
    if (alive(c).length === 0) return finish(s, "win");
  }

  for (let round = 0; round < (c.limit ?? MAX_ROUNDS); round++) {
    roundStart(s, c);
    if (alive(c).length === 0) return finish(s, "win");
    const outcome = playerPhase(s, c, opener);
    opener = null;
    if (outcome) return finish(s, outcome);
    if (isDead(s)) return;
    enemyPhase(s, c);
    if (isDead(s)) return;
    c.halfDmg = false;
    if (c.rampage) c.rampage -= 1;
    if (c.halfRounds) c.halfRounds -= 1;
    if (c.fury && --c.fury.rounds <= 0) c.fury = undefined;
    plagueTick(s, c);
    burnTick(s, c);
    roundEnd(s, c);
    if (isDead(s)) return;
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

/** 4섹터 전투 시작: 굴착 벌레의 낙반, 굴려 보낸 광차, 화약통. 죽었으면 true */
function mineOpening(s: GameState, c: CombatState): boolean {
  const r = rngOf(s);
  const dg = s.dungeon!;
  if (alive(c).some((e) => MONSTERS[e.defId].burrow)) {
    const ck = check(s, "dex", 13);
    if (ck.ok) log(s, `벽을 뚫고 나오는 소리에 먼저 몸을 뺐다. (민첩 ${ck.total} vs 13)`, "system");
    else {
      const dmg = blastDamage(s, r.dice(1, 6));
      s.hero.hp -= dmg;
      log(s, `벽이 터지며 돌무더기가 쏟아졌다! ${dmg} 피해 (민첩 ${ck.total} vs 13)`, "hurt");
      if (s.hero.hp <= 0) {
        s.hero.hp = 0;
        kill(s, "trap", "무너진 벽에 깔려 쓰러졌다");
        if (isDead(s)) return true;
      }
    }
  }
  if (dg.cartCharge && alive(c).length) {
    const t = alive(c)[0];
    const dmg = r.dice(dg.cartCharge, 6);
    dg.cartCharge = undefined;
    dealt(c, t, dmg, "cart");
    log(s, `레일을 타고 내려온 광차가 ${MONSTERS[t.defId].name}을 들이받았다! ${dmg} 피해`, "skill");
    if (t.hp <= 0) killed(s, c, t);
  }
  // 화약통: 적이 셋 이상이거나 강한 적이 있으면 알아서 던진다
  if (s.inventory.powder > 0 && alive(c).length && (alive(c).length >= 3 || alive(c).some(bossy))) {
    s.inventory.powder -= 1;
    log(s, `화약통에 불을 붙여 던졌다! (남은 화약통 ${s.inventory.powder})`, "skill");
    for (const e of alive(c)) {
      const dmg = r.dice(2, 6);
      dealt(c, e, dmg, "powder");
      log(s, `${MONSTERS[e.defId].name}에게 ${dmg} 피해`, "hit");
      if (e.hp <= 0) killed(s, c, e);
    }
    if (burnWound(s, 0.1, "튄 불똥에 데었다")) return true;
  }
  return false;
}

/** 보스·정예·히든(절대 영도가 짧게 듣는다) */
function bossy(e: Enemy): boolean {
  const d = MONSTERS[e.defId];
  return !!(d.elite || d.hidden || d.human || ["boss", "general", "mycomother"].includes(e.defId));
}

/** 적을 쓰러뜨린 뒤처리(마석·편린·겨울의 화신) */
function killed(s: GameState, c: CombatState, t: Enemy): void {
  const def = MONSTERS[t.defId];
  gainLoot(s, c, def.id, t.stolen);
  log(s, `${josa(def.name, "을")} 쓰러뜨렸다.`, "good");
  // 겨울의 화신: 얼어 있던 적을 쓰러뜨리면 다른 적 하나가 언다
  if (has(s, "frostAvatar") && (t.stun ?? 0) > 0) {
    const o = alive(c)[0];
    if (o) {
      freeze(o);
      log(s, `【겨울의 화신】 부서진 얼음이 ${josa(MONSTERS[o.defId].name, "을")} 얼렸다.`, "skill");
    }
  }
}

/** 라운드 시작: 뇌신(무작위 적에게 번개), 독 바른 칼(중독), 바위 심장(재생) */
function roundStart(s: GameState, c: CombatState): void {
  const r = rngOf(s);
  if (has(s, "boltAvatar") && alive(c).length) {
    const t = r.pick(alive(c));
    const dmg = Math.max(1, r.dice(1, 8) + smod(s, "int"));
    dealt(c, t, dmg, "boltAvatar");
    log(s, `【뇌신】 ${MONSTERS[t.defId].name}에게 번개가 떨어진다. ${dmg} 피해`, "skill");
    if (t.hp <= 0) killed(s, c, t);
  }
  for (const e of alive(c)) {
    if (!e.venom || e.venom.rounds <= 0) continue;
    const dmg = r.dice(e.venom.dice[0], e.venom.dice[1]);
    dealt(c, e, dmg, "poisonBlade");
    e.venom.rounds -= 1;
    log(s, `${josa(MONSTERS[e.defId].name, "이")} 독에 몸을 떤다. ${dmg} 피해`, "hit");
    if (e.hp <= 0) killed(s, c, e);
  }
  if (has(s, "earthHeart") && s.hero.hp < maxHp(s)) s.hero.hp = Math.min(maxHp(s), s.hero.hp + 2);
}

/** 적을 불태운다(불의 각인이면 힘 보정이 더해진다) */
function burn(s: GameState, e: Enemy, rounds: number): void {
  const bonus = has(s, "fireMark") ? Math.max(0, smod(s, "str")) : 0;
  e.burn = { rounds: Math.max(e.burn?.rounds ?? 0, rounds), bonus };
}

/** 얼리거나 넘어뜨린다(기본 1라운드 행동 불가) */
function freeze(e: Enemy, rounds = 1): void {
  e.stun = Math.max(e.stun ?? 0, rounds);
}

/** 서리의 각인: 얼림 확률 +20%p + 감각 보정 ×3%p, 서리의 낙인 +15%p */
function freezeChance(s: GameState, p: number): number {
  return p + (has(s, "frostMark") ? 0.25 + Math.max(0, smod(s, "per")) * 0.03 : 0) + (has(s, "frostSeal") ? 0.15 : 0);
}

/** 번개 같은 손: 민첩 보정 ×10% 확률로 두 번 굴려 높은 쪽 */
function rollDice(s: GameState, n: number, sides: number): number {
  const r = rngOf(s);
  const a = r.dice(n, sides);
  return has(s, "boltLuck") && r.chance(Math.max(0, smod(s, "dex")) * 0.1) ? Math.max(a, r.dice(n, sides)) : a;
}

/** 모든 주문 공통 추가 피해(모험가 마법사형: 마력 감응 +1, 주문꾼의 각인 +3) */
function spellBonus(s: GameState): number {
  return (has(s, "manaSense") ? 1 : 0) + (has(s, "casterMark") ? 3 : 0) + (has(s, "casterSeal") ? 3 : 0) + (has(s, "casterAvatar") ? 4 : 0)
    + (has(s, "fireAvatar") ? 4 : 0) + (has(s, "fireBlood") && hpPct(s) <= 50 ? 4 : 0);
}

/** 치명타 피해 주사위 배수(행운의 일격·검투의 낙인 ×3, 그림자 군주 ×4) */
function critMult(s: GameState): number {
  return has(s, "rogueAvatar") ? 4 : has(s, "luckyStrike") || has(s, "gladSeal") ? 3 : 2;
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
  if (el === "fire" && has(s, "fireSeal")) b += 3;
  if (el === "bolt" && has(s, "boltSeal")) b += 2;
  if (has(s, "frostSeal") && (t.stun ?? 0) > 0) b += 3; // 깨뜨리기(낙인)
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
      freeze(t, e.freezeRounds ?? 1);
      extra.push("얼었다");
    }
    if (e.burnRounds) {
      burn(s, t, e.burnRounds);
      if (!extra.includes("불탄다")) extra.push("불탄다");
    }
    if ((e.shockChance && r.chance(e.shockChance)) || (e.el === "bolt" && has(s, "boltSeal") && r.chance(0.2))) {
      t.shock = Math.max(t.shock ?? 0, 1);
      if (!extra.includes("감전")) extra.push("감전");
    }
    if (e.rider) {
      const k = r.int(0, 2);
      if (k === 0) burn(s, t, 2);
      else if (k === 1) freeze(t);
      else t.shock = Math.max(t.shock ?? 0, 1);
      extra.push(["불탄다", "얼었다", "감전"][k]);
    }
    if (has(s, "frostAvatar") && !extra.includes("얼었다") && r.chance(0.25)) {
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
  if (t.hp <= 0) killed(s, c, t);
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
    if (e.splashAll) for (const o of alive(c).filter((x) => x !== t)) elementHit(s, c, o, sk, true);
    if (e.bounce) {
      // 번개의 각인: 한 번 더, 행운 보정 ×10%로 또 한 번. 번개의 낙인이면 한 번 더
      const jumps = 1 + (has(s, "boltMark") ? 1 + (r.chance(Math.max(0, smod(s, "dex")) * 0.1) ? 1 : 0) : 0) + (has(s, "boltSeal") ? 1 : 0);
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
    const dmg = (r.dice(1, has(s, "fireSeal") ? 6 : 3) + e.burn.bonus) * (has(s, "fireAvatar") ? 2 : 1);
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
  if (def.water && inWater(s)) b += 1; // 물이 높을 때 잠긴 방의 물짐승
  if (has2(s, "shadowBody")) b -= 1; // 그림자 몸
  if ((def.heat === "fire" && stagnant(s)) || (def.heat === "frost" && windy(s))) b += 1; // 4섹터 환기
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

/** 지금 물이 높은 침수 방에서 싸우는가 */
function inWater(s: GameState): boolean {
  const dg = s.dungeon;
  return !!dg && !!dg.rooms[dg.current]?.flooded && highTide(s);
}

/** 3섹터 라운드 끝 처리: 독, 기도 흉내·뿌리 재생·포자 폭발·종소리, 균사 재생, 역병의 숙주 */
function roundEnd(s: GameState, c: CombatState): void {
  const r = rngOf(s);
  const foes = alive(c);
  // 역병의 신 ★4 "역병의 숙주": 병이 깊으면 모든 적이 라운드마다 1 피해
  if (s.disease >= 2 && power(s, "plague", 4) && foes.length) {
    for (const e of foes) dealt(c, e, 1, "plague4");
    log(s, `【${GODS.plague.name}】 역병의 숙주 — 몸에서 번진 병이 적들을 갉아먹는다. (모두 1 피해)`, "skill");
    for (const e of foes) if (e.hp <= 0) {
      gainLoot(s, c, e.defId, e.stolen);
      log(s, `${josa(MONSTERS[e.defId].name, "이")} 병으로 쓰러졌다.`, "good");
    }
  }
  for (const e of alive(c)) {
    const def = MONSTERS[e.defId];
    const max = (x: Enemy) => x.hpMax ?? MONSTERS[x.defId].hp;
    // 기도 흉내: 곰팡이 동족을 되살린다
    if (def.mimicPrayer && (e.stun ?? 0) <= 0 && r.chance(def.mimicPrayer)) {
      const kin = alive(c).filter((x) => MONSTERS[x.defId].fungus && x.hp < max(x));
      if (kin.length) {
        for (const x of kin) x.hp = Math.min(max(x), x.hp + 3);
        log(s, `${josa(def.name, "이")} 옛 기도를 웅얼거린다. 곰팡이들이 되살아난다. (HP +3)`, "hurt");
      }
    }
    // 뿌리 재생: 곰팡이 동족이 곁에 있으면
    if (def.rootRegen && e.hp < max(e) && alive(c).some((x) => x !== e && MONSTERS[x.defId].fungus)) {
      e.hp = Math.min(max(e), e.hp + def.rootRegen);
      log(s, `${josa(def.name, "이")} 곰팡이들에게서 뿌리로 양분을 빨아올린다. (HP +${def.rootRegen})`, "hurt");
    }
    // 포자 폭발: 3라운드마다
    if (def.spores && c.round % 3 === 0) {
      const dmg = r.dice(1, 4);
      s.hero.hp -= dmg;
      log(s, `${josa(def.name, "이")} 포자를 터뜨렸다! 숨이 막힌다. ${dmg} 피해`, "hurt");
      const ck = check(s, "con", 13);
      if (!ck.ok) moldAfflict(s, 1);
      if (s.hero.hp <= 0) {
        s.hero.hp = 0;
        kill(s, "plague", `${def.name}의 포자에 쓰러졌다`);
        if (isDead(s)) return;
      }
    }
    // 종소리: 공포 또는 혼란
    if (def.bell && r.chance(def.bell)) {
      const k = r.chance(0.5) ? "fear" : "confusion";
      log(s, `${def.name}의 종소리가 물 위로 번진다.`, "hurt");
      afflict(s, k, 1, k === "fear" ? "종소리가 뼛속까지 울린다. 등이 서늘하다." : "종소리가 머릿속에서 맴돈다. 생각이 흩어진다.");
    }
  }
  // 독: 라운드마다 10% 확률로 1 피해
  if (poisonOf(s) > 0 && r.chance(0.1)) {
    s.hero.hp -= 1;
    log(s, "독이 핏줄을 타고 돈다. 1 피해", "hurt");
    if (s.hero.hp <= 0) {
      s.hero.hp = 0;
      kill(s, "plague", "독이 온몸에 퍼져 쓰러졌다");
      if (isDead(s)) return;
    }
  }
  // 4섹터: 얼음 트롤 재생(불탄 라운드엔 멈춤), 화로 어미의 불꽃 숨·동굴 무너뜨리기
  for (const e of alive(c)) {
    const def = MONSTERS[e.defId];
    const max = e.hpMax ?? def.hp;
    if (def.regen && e.hp < max) {
      if ((e.burn?.rounds ?? 0) > 0) log(s, `${josa(def.name, "이")} 불에 덴 자리가 아물지 않는다.`, "system");
      else e.hp = Math.min(max, e.hp + def.regen);
    }
    if (def.furnace && c.round % 3 === 0) {
      const dmg = r.dice(2, 6);
      s.hero.hp -= dmg;
      log(s, `${josa(def.name, "이")} 불꽃을 뿜었다! ${dmg} 피해`, "hurt");
      if (s.hero.hp <= 0) {
        s.hero.hp = 0;
        kill(s, "single", `${def.name}의 불꽃에 타 버렸다`);
        if (isDead(s)) return;
      }
      const ck = check(s, "con", 14);
      if (!ck.ok && burnWound(s, 1, "불꽃이 살갗을 휘감았다")) return;
    }
    if (def.furnace && !c.caveIn && e.hp <= max / 2) {
      c.caveIn = true;
      log(s, `${josa(def.name, "이")} 꼬리로 천장을 내리쳤다 — 동굴이 무너진다!`, "hurt");
      if (power(s, "trap", 2)) log(s, `【${GODS.trap.name}】 무너질 자리를 미리 알고 비켜섰다.`, "skill");
      else {
        const ck = check(s, "dex", 14);
        if (ck.ok) log(s, `떨어지는 바위 사이로 몸을 굴렸다. (민첩 ${ck.total} vs 14)`, "system");
        else {
          const dmg = blastDamage(s, r.dice(2, 6));
          s.hero.hp -= dmg;
          log(s, `바위에 깔렸다! ${dmg} 피해 (민첩 ${ck.total} vs 14)`, "hurt");
          if (s.hero.hp <= 0) {
            s.hero.hp = 0;
            kill(s, "trap", "무너진 동굴에 깔려 쓰러졌다");
            if (isDead(s)) return;
          }
          if (r.chance(0.25) && wound(s, r.pick(["head", "body"] as const), "떨어진 바위에 맞았다")) {
            kill(s, "trap", "무너진 동굴에 깔려 쓰러졌다");
            if (isDead(s)) return;
          }
        }
      }
      log(s, `${def.name}의 불타던 반쪽이 식어 간다. 이제 얼음 반쪽으로 덤빈다.`, "system");
    }
  }
  if (has2(s, "fragRegen") && s.hero.hp < maxHp(s)) s.hero.hp = Math.min(maxHp(s), s.hero.hp + 1);
  // 균모의 편린 "균사 재생"
  if (has2(s, "fragMycelium") && s.hero.hp < maxHp(s)) s.hero.hp = Math.min(maxHp(s), s.hero.hp + (s.disease > 0 ? 2 : 1));
}

function has2(s: GameState, id: string): boolean {
  return s.skills.includes(id) || s.fragments.some((f) => FRAGMENTS[f]?.skill === id);
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
  const mana = stolen ? Math.round(def.mana * (has(s, "rogueAvatar") ? 2 : 1.5)) : def.mana; // 손버릇(그림자 군주 ×2)
  if (def.rare) c.bonus += mana;
  else c.loot += mana;
  s.codex.kills[defId] = (s.codex.kills[defId] ?? 0) + 1;
  // 초원의 짐승은 고기를 남긴다(늑대·군마)
  if (["wolf", "alphawolf", "warhorse"].includes(defId) && rngOf(s).chance(0.25)) {
    s.inventory.food += 1;
    log(s, `${josa(def.name, "을")} 손질해 말린 고기 1개를 만들었다. (말린 고기 ${s.inventory.food})`, "good");
  }
  if (["rat", "goldrat", "boss", "plaguerat"].includes(defId)) pray(s, "plague", 1);
  // 기아/풍요의 신 ★4 "굶주린 자의 식탁"
  if (s.hero.satiety <= 0 && power(s, "hunger", 4)) {
    s.hero.satiety = 20;
    log(s, `【${GODS.hunger.name}】 굶주린 자의 식탁 — 쓰러진 것의 기운으로 허기를 달랬다. (포만감 +20)`, "skill");
  }
  // 광차 미믹: 쓰러지면 배 속 화약이 터진다
  if (def.deathBlast) {
    const ck = check(s, "dex", 14);
    if (ck.ok) log(s, `${josa(def.name, "이")} 쓰러지며 배 속 화약이 터졌다 — 몸을 던져 피했다. (민첩 ${ck.total} vs 14)`, "system");
    else {
      const dmg = blastDamage(s, rngOf(s).dice(2, 6));
      s.hero.hp = Math.max(1, s.hero.hp - dmg); // 이긴 전투의 폭발로는 죽지 않는다(1에서 멈춤)
      log(s, `${josa(def.name, "이")} 쓰러지며 배 속 화약이 터졌다! ${dmg} 피해`, "hurt");
      burnWound(s, 1, "폭발의 불길");
    }
  }
  // 독두꺼비: 죽을 때 점액이 튄다
  if (def.deathSplash && rngOf(s).chance(def.deathSplash)) {
    const ck = check(s, "dex", 12);
    if (ck.ok) log(s, `${def.name}이 터지며 점액이 튀었지만 몸을 피했다. (민첩 ${ck.total} vs 12)`, "system");
    else paralyze(s, 1, `${def.name}의 점액이 살갗에 튀었다`);
  }
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
      if (e.ac) c.guard = { ac: e.ac, rounds: e.rounds };
      useSkill(s, c, sk, `${e.text} (${e.rounds}라운드 동안 한 번 더 공격${e.ac ? `, AC +${e.ac}` : ""})`);
    } else if (e.type === "eguard") {
      c.guard = { ac: e.ac, rounds: e.rounds, freeze: e.freeze, reduce: e.reduce, counter: e.counter };
      if (e.stunAll) for (const foe of alive(c)) foe.stun = Math.max(foe.stun ?? 0, e.stunAll);
      useSkill(s, c, sk, `${e.text} (AC +${e.ac}, ${e.rounds}라운드${e.stunAll ? `, 적 전원 ${e.stunAll}라운드 행동 불가` : ""})`);
    } else if (e.type === "stunAll") {
      for (const foe of alive(c)) foe.stun = Math.max(foe.stun ?? 0, e.rounds);
      useSkill(s, c, sk, `그림자 속으로 사라졌다 — 적들이 나를 놓쳤다 (${e.rounds}라운드)`);
    } else if (e.type === "stone") {
      c.halfDmg = true;
      useSkill(s, c, sk, `${e.text} (이번 라운드 받는 피해 절반)`);
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
  // 전쟁의 신 ★4 "최후의 돌격"(미궁마다 1회)
  if (!c.lastStand && c.context !== "dummy" && hpPct(s) <= 25 && power(s, "war", 4) && !s.tripUsed.includes("war4")) {
    c.lastStand = true;
    s.tripUsed.push("war4");
    log(s, `【${GODS.war.name}】 최후의 돌격 — 피 냄새가 머리를 맑게 한다. (이 전투 동안 명중 +2, 피해 +3)`, "skill");
  }
  const actions = actionsPerRound(s) + (c.rampage ? 1 : 0) + (c.fury?.extra ?? 0) + (has(s, "berserkAvatar") ? 1 : 0);
  for (let a = 0; a < actions; a++) {
    selfTriggers(s, c);
    // 순간 이동: HP 30% 이하면 반드시 빠져나간다
    const blink = activeSkills(s).find((sk) => sk.effect?.type === "blink" && hpPct(s) <= (sk.trigger as { pct: number }).pct && canUse(s, c, sk));
    if (blink && c.context !== "dummy") {
      useSkill(s, c, blink, (blink.effect as { text: string }).text);
      return "fled";
    }
    const pct = hpPct(s);
    const { potionAt, fleeAt } = s.tactics;
    if (potionAt > 0 && pct <= potionAt && s.inventory.potion > 0 && !missPotion(s)) {
      drink(s, "전투 중에");
      continue;
    }
    if (symptom(s, "fear", MIND.symptom, "몸이 얼어붙어 움직이지 않는다!", "손이 떨려 무기를 제대로 쥐지 못했다.")) continue;
    if (symptom(s, "confusion", MIND.symptom, "엉뚱한 곳을 내리쳤다!", "어디를 노렸는지 순간 헷갈렸다.")) continue;
    if (paraFires(s, "main")) {
      log(s, "오른손이 저려 무기를 제대로 쥐지 못했다.", "miss");
      continue;
    }
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
      if (a === 0 && has(s, "gladAvatar")) strike = { ...strike, autoHit: true }; // 검성
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
  const wc = weaponCorrosion(s);
  const tide = (highTide(s) ? gearHas(s, (g) => g.tideHit).reduce((a, g) => a + (g.tideHit ?? 0), 0) : 0)
    + (stagnant(s) ? gearHas(s, (g) => g.stagnantHit).reduce((a, g) => a + (g.stagnantHit ?? 0), 0) : 0); // 조수의 지팡이·불씨 반지
  const bonus = statMod + BAL.proficiency + passive(s, "hit") + st.hit + rollPenalty(s) + faithHit(s, alive(c).length) + injuryHit(s) + (def.flying && !w.magic ? -2 : 0) + magicHit + wc.hit + sagaBonus(s) + tide + (c.lastStand ? 2 : 0);
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
  const base = (w.magic ? rollDice(s, w.dice[0] * (crit ? critMult(s) : 1), w.dice[1]) : r.dice(w.dice[0] * (crit ? critMult(s) : 1), w.dice[1])) + magicDmg + fury + statMod + passive(s, "dmg") + st.dmg + faithDmg(s) + rageDmg(s) + abyssEdge(s, s.hero.hp / maxHp(s)).dmg + wc.dmg + (c.lastStand ? 3 : 0)
    + (c.pain ?? 0) + (has(s, "berserkSeal") && hpPct(s) <= 50 ? 5 : 0) + (w.magic && has(s, "fireAvatar") ? 4 : 0);
  const dmg = Math.max(1, Math.round(base * st.mult));
  dealt(c, target, dmg, st.src ?? "attack");
  if (crit) note(s, "luk");
  log(s, `${def.name}에게 ${w.verb} 명중! ${dmg} 피해${crit ? " (치명타!)" : ""}`, crit ? "crit" : "hit");
  // 치명타 흡혈(거머리 이빨 부적·거머리의 편린)
  if (crit && c.context !== "dummy") {
    const heal = gearHas(s, (g) => g.critHeal).reduce((a, g) => a + (g.critHeal ?? 0), 0) + (has2(s, "fragLeech") ? 2 : 0);
    if (heal > 0 && s.hero.hp < maxHp(s)) {
      s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
      log(s, `베어 낸 상처에서 기운을 빨아들였다. HP +${heal}`, "good");
    }
  }
  // 역병의 신 ★2 "전염"
  if (target.hp > 0 && !target.sick && s.disease > 0 && power(s, "plague", 2) && r.chance(0.25)) {
    target.sick = true;
    log(s, `【${GODS.plague.name}】 ${josa(def.name, "이")} 병에 옮았다.`, "skill");
  }
  if (st.stun && target.hp > 0) target.stun = Math.max(target.stun ?? 0, st.stun);
  // 서리 광맥 지팡이(맞힌 적 명중 −1), 불씨 편린(10% 불탐)
  if (target.hp > 0 && gearHas(s, (g) => g.chillHit).length) target.hitDown = { n: 1, rounds: 1 };
  if (target.hp > 0 && has2(s, "fragEmber") && r.chance(0.1)) burn(s, target, 2);
  if (has(s, "frostAvatar") && target.hp > 0 && r.chance(0.25)) {
    freeze(target);
    log(s, `【겨울의 화신】 ${josa(def.name, "이")} 얼어붙었다.`, "skill");
  }
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
    killed(s, c, target);
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
  else if (MONSTERS[defId]?.hard && !gearHas(s, (g) => g.noHardSelf).length && r.chance(INJ.hardSelf)) wound(s, "main", `${MONSTERS[defId].name}의 단단한 몸을 치다 손목이 꺾였다`);
}

/** 맞았을 때 부상 확률 배율: 수호의 각인·흔들리지 않는 자·산의 뼈·백전노장 절반, 노련함 −25% */
function injuryResist(s: GameState): number {
  return (has(s, "guardMark") ? 0.5 : 1) * (has(s, "unshaken") ? 0.5 : 1) * (has(s, "earthBone") ? 0.5 : 1) * (has(s, "fighterAvatar") ? 0.5 : 1) * (has(s, "veteran") ? 0.75 : 1);
}

/** 맞았을 때 부상·질병 */
function hitInjury(s: GameState, defId: string, dmg: number, crit: boolean, e?: Enemy): void {
  const def = MONSTERS[defId];
  const r = rngOf(s);
  const p = (crit ? INJ.hitCrit : dmg >= maxHp(s) * INJ.heavyRatio ? INJ.hitHeavy : INJ.hitNormal) * injuryResist(s); // 수호의 각인 등
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
  const dz = def.fever ?? (defId === "boss" ? INJ.diseaseBoss : ["rat", "goldrat"].includes(defId) ? INJ.diseaseRat : 0);
  if (dz && r.chance(dz * faithInfectMult(s))) infect(s, "rat");
  // 3섹터: 부식·독·마비·곰팡이 폐병·절망
  if (def.corrode) corrode(s, def.corrode, `${def.name}의 산성 점액`, crit);
  if (def.poison) poisonAfflict(s, def.poison, `${def.name}의 독`);
  if (def.paralyze) paralyze(s, def.paralyze, `${def.name}의 침`);
  if (def.mold) moldAfflict(s, def.mold * faithInfectMult(s));
  if (def.despairHit) afflict(s, "despair", def.despairHit, `${def.name}의 기도 소리가 귓가에 남는다. 다 부질없다는 생각이 든다.`);
  // 4섹터: 화상(치명타면 중상부터)·냉기. 화로 어미는 HP 절반 아래부터 얼음 반쪽(냉기 +2)
  const iceHalf = def.furnace && e && e.hp <= (e.hpMax ?? def.hp) / 2;
  if (iceHalf) {
    chill(s, 2, `${def.name}의 얼음 반쪽`);
  } else if (def.burn && burnWound(s, def.burn, `${def.name}의 불길`, { heavy: crit })) return;
  if (def.chill && !isDead(s)) chill(s, def.chill, `${def.name}의 냉기`);
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
  if (paraFires(s, "feet")) {
    log(s, "다리가 저려 한 발짝도 떼지 못했다!", "miss");
    return false;
  }
  // 물에 잠긴 방에서는 헤엄치는 짐승을 따돌리기 어렵다
  const swimmers = s.dungeon?.rooms[s.dungeon.current]?.flooded && alive(c).some((e) => MONSTERS[e.defId].water) ? 2 : 0;
  const dc = BAL.fleeDcBase + alive(c).length * 2 + swimmers;
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
  let ac = heroAc(s) + (c.guard?.ac ?? 0);
  // 왼손 마비: 이번 라운드 방패를 들지 못한다
  if (hasShield(s) && paraFires(s, "offhand")) {
    const shieldAc = GEAR[s.gear.offhand!].bonus.ac ?? 0;
    ac -= shieldAc;
    if (shieldAc > 0) log(s, "왼손이 저려 방패가 처진다.", "miss");
  }
  for (const e of attackers) {
    const def = MONSTERS[e.defId];
    if (def.dummy) continue;
    if (def.slow && c.round % 2 === 0) {
      log(s, `${josa(def.name, "이")} 느릿느릿 기어 온다.`, "miss");
      continue;
    }
    if (def.plaguePeace && c.round === 1 && power(s, "plague", 2)) {
      log(s, `${josa(def.name, "이")} 당신에게서 같은 신의 냄새를 맡았다. 잠시 공격하지 않는다.`, "story");
      continue;
    }
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
      else if (has(s, "flowWater") && r.chance(0.2)) counter(s, c, e, null, "【물 흐르듯】 흘려보낸 칼끝이 되돌아온다");
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
    const less = (has(s, "guardSeal") ? 2 : 0) + (has(s, "earthSeal") ? 1 : 0) + (has(s, "earthAvatar") ? 2 : 0);
    if (less) dmg = Math.max(1, dmg - less); // 수호의 낙인·대지의 낙인·대지의 화신
    if (c.fury) dmg += c.fury.taken; // 광폭화 대가
    if (c.halfDmg || (c.halfRounds ?? 0) > 0 || (has(s, "guardAvatar") && hpPct(s) <= 25)) dmg = Math.max(1, Math.ceil(dmg / 2)); // 성벽·불굴
    if (def.drain) dmg += 1; // 피를 빤다
    s.hero.hp -= dmg;
    // 포자 갑옷(때린 적이 기침)
    if (has2(s, "fragSporeArmor") && r.chance(0.1)) e.stun = Math.max(e.stun ?? 0, 1);
    // 고통이 힘(맞을 때마다 피해 +1, 최대 +5)
    if (has(s, "painPower")) c.pain = Math.min(5, (c.pain ?? 0) + 1);
    // 번개 반사(25% 1d6)
    if (has(s, "boltReflect") && r.chance(0.25)) {
      const back = r.dice(1, 6);
      dealt(c, e, back, "boltReflect");
      log(s, `【번개 반사】 ${MONSTERS[e.defId].name}에게 번개가 되튄다. ${back} 피해`, "skill");
      if (e.hp <= 0) killed(s, c, e);
    }
    // 얼음 갑옷(때린 적을 얼림), 정전기(때린 적 명중 −2)
    if (c.guard?.freeze && r.chance(freezeChance(s, c.guard.freeze))) freeze(e);
    if (has(s, "boltStatic") && r.chance(0.25)) e.hitDown = { n: 2, rounds: 2 }; // 이번 라운드 끝에 1 줄어 다음 라운드에 적용
    log(s, `${josa(def.name, "이")} ${charge ? "돌진해 " : ""}${def.attackText}! ${dmg} 피해${crit ? " (치명타!)" : ""}`, "hurt");
    if (s.hero.hp > 0) {
      hitInjury(s, def.id, dmg, crit, e);
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
      // 불사조의 숨(미궁 1회): 최대 HP 30%로 일어나며 적 전원 화염
      const phoenix = activeSkills(s).find((sk) => sk.effect?.type === "phoenix" && !s.tripUsed.includes(sk.id));
      if (phoenix && c.context !== "dummy") {
        const ef = phoenix.effect as Extract<SkillDef["effect"], { type: "phoenix" }>;
        s.tripUsed.push(phoenix.id);
        s.hero.hp = Math.max(1, Math.round((maxHp(s) * ef.pct) / 100));
        log(s, `【${phoenix.name}】 ${ef.text} (HP ${s.hero.hp})`, "skill");
        for (const foe of alive(c)) {
          const d = rngOf(s).dice(ef.dice[0], ef.dice[1]);
          dealt(c, foe, d, phoenix.id);
          log(s, `${MONSTERS[foe.defId].name}에게 ${d} 피해`, "hit");
          if (foe.hp <= 0) killed(s, c, foe);
        }
        if (alive(c).length === 0) return;
        continue;
      }
      // 이 악물기(미궁 1회) — 최후의 방어가 있으면 한 번 더(없으면 1회), 버틴 뒤 3라운드 AC +5
      const gritMax = (activeSkills(s).some((sk) => sk.id === "grit") ? 1 : 0) + (has(s, "lastGuard") ? 1 : 0);
      const grit = s.tripUsed.filter((x) => x === "grit").length < gritMax && c.context !== "dummy" ? SKILLS.grit : undefined;
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
        s.tripUsed.push("grit");
        s.hero.hp = 1;
        log(s, `【${SKILLS.grit.name}】 무릎이 꺾이기 직전, 이를 악물고 버텼다. (HP 1)`, "skill");
        if (has(s, "lastGuard")) {
          c.guard = { ac: 5, rounds: 3 };
          log(s, "【최후의 방어】 버틴 자리에서 방패를 세운다 (3라운드 AC +5)", "skill");
        }
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
