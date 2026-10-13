import { josa } from "./josa";
import { BAL, MONSTERS } from "./data";
import { actionsPerRound, heroAc, isDead, kill, log, maxHp, mod, note, rngOf, rollPenalty } from "./core";
import { activeSkills, passive, SKILLS, type SkillDef } from "./skills";
import type { CombatState, Enemy, GameState } from "./types";
import { afterDungeonCombat, passTime } from "./dungeon";
import { afterFieldCombat } from "./town";

// 자동 전투(2026-10-13 변경): 플레이어는 공격을 고르지 않는다. 라운드마다
// 플레이어 행동(물약·도주 방침 → 조건부 기술 → 가장 약한 적 공격) → 적 전체 행동을 자동으로 굴리고,
// 결과는 로그로 흘려보낸다. 위치 개념이 없으므로 "포위"는 동시에 살아있는 적 수로 표현한다.

const WEAPON: [number, number] = [1, 6]; // 숏소드
const MAX_ROUNDS = 60;

export function makeEnemies(s: GameState, ids: string[]): Enemy[] {
  return ids.map((defId) => ({ uid: s.nextUid++, defId, hp: MONSTERS[defId].hp }));
}

export function describeGroup(enemies: Enemy[]): string {
  const counts = new Map<string, number>();
  for (const e of enemies) counts.set(e.defId, (counts.get(e.defId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, n]) => (n > 1 ? `${MONSTERS[id].name} ${n}마리` : MONSTERS[id].name))
    .join(", ");
}

export function alive(c: CombatState): Enemy[] {
  return c.enemies.filter((e) => e.hp > 0);
}

interface Strike {
  hit: number;
  dmg: number;
  mult: number;
  autoHit: boolean;
}

const PLAIN: Strike = { hit: 0, dmg: 0, mult: 1, autoHit: false };

/** 전투를 처음부터 끝까지 자동으로 진행한다 */
export function startCombat(s: GameState, context: CombatState["context"], enemies: Enemy[]): void {
  const c: CombatState = { context, enemies, round: 1, loot: 0, used: {}, guard: null };
  s.combat = c;
  log(s, `${josa(describeGroup(enemies), "이")} 나타났다!`, "hurt");

  let opener: Strike | null = null;
  for (const sk of activeSkills(s)) {
    const t = sk.trigger!;
    if (t.on !== "start" || !canUse(c, sk)) continue;
    if (t.minEnemies && alive(c).length < t.minEnemies) continue;
    const e = sk.effect!;
    if (e.type === "strike") {
      opener = { hit: e.hit, dmg: e.dmg, mult: e.dmgMult ?? 1, autoHit: !!e.autoHit };
      useSkill(s, c, sk);
    } else if (e.type === "weaken") {
      const target = [...alive(c)].sort((a, b) => MONSTERS[b.defId].ac - MONSTERS[a.defId].ac || b.hp - a.hp)[0];
      target.acDown = (target.acDown ?? 0) + e.ac;
      useSkill(s, c, sk, `${MONSTERS[target.defId].name}의 빈틈을 읽었다 (AC -${e.ac})`);
    } else if (e.type === "stunAll") {
      for (const foe of alive(c)) foe.stun = (foe.stun ?? 0) + e.rounds;
      useSkill(s, c, sk, "눈부신 가루에 적들이 눈을 감싸 쥔다");
    }
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const outcome = playerPhase(s, c, opener);
    opener = null;
    if (outcome) return finish(s, outcome);
    if (isDead(s)) return;
    enemyPhase(s, c);
    if (isDead(s)) return;
    c.round += 1;
    if (c.guard && --c.guard.rounds <= 0) c.guard = null;
    if (context === "dungeon") {
      passTime(s, 1);
      if (isDead(s)) return;
    }
  }
  log(s, "지쳐 서로 물러났다.", "system");
  finish(s, "fled");
}

function canUse(c: CombatState, sk: SkillDef): boolean {
  return (c.used[sk.id] ?? 0) < (sk.uses ?? 1);
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
    if (t.on !== "selfBelow" || hpPct(s) > t.pct || !canUse(c, sk)) continue;
    const e = sk.effect!;
    if (e.type === "guard") {
      c.guard = { ac: e.ac, rounds: e.rounds };
      useSkill(s, c, sk, `칼날을 흘려낸다 (AC +${e.ac}, ${e.rounds}라운드)`);
    } else if (e.type === "heal") {
      const heal = rngOf(s).dice(e.dice[0], e.dice[1]) + (e.plusInt ? Math.max(0, mod(s.hero.stats.int)) : 0);
      s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
      useSkill(s, c, sk, `상처에 약초를 짓눌렀다 (HP +${heal})`);
    }
  }
}

function playerPhase(s: GameState, c: CombatState, opener: Strike | null): "win" | "fled" | null {
  const actions = actionsPerRound(s);
  for (let a = 0; a < actions; a++) {
    selfTriggers(s, c);
    const pct = hpPct(s);
    const { potionAt, fleeAt } = s.tactics;
    if (potionAt > 0 && pct <= potionAt && s.inventory.potion > 0) {
      drink(s, "전투 중에");
      continue;
    }
    if (fleeAt > 0 && pct <= fleeAt) {
      return tryFlee(s, c) ? "fled" : null;
    }
    const foes = alive(c);
    const sweep = activeSkills(s).find((sk) => sk.trigger!.on === "enemiesAtLeast" && foes.length >= (sk.trigger as { n: number }).n && canUse(c, sk));
    if (sweep && sweep.effect!.type === "sweep") {
      useSkill(s, c, sweep, "칼을 크게 휘둘러 모두를 벤다");
      for (const foe of foes) attack(s, c, foe, { ...PLAIN, mult: sweep.effect!.dmgMult });
    } else {
      const target = [...foes].sort((x, y) => x.hp - y.hp)[0];
      let strike = opener && a === 0 ? opener : PLAIN;
      const def = MONSTERS[target.defId];
      const fin = activeSkills(s).find((sk) => sk.trigger!.on === "targetBelow" && (target.hp / def.hp) * 100 <= (sk.trigger as { pct: number }).pct && canUse(c, sk));
      if (fin && fin.effect!.type === "strike") {
        const e = fin.effect!;
        useSkill(s, c, fin, `${josa(def.name, "을")} 노린다`);
        strike = { hit: e.hit, dmg: e.dmg, mult: e.dmgMult ?? 1, autoHit: !!e.autoHit };
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
  const ac = def.ac - (target.acDown ?? 0);
  const roll = r.die(20);
  const bonus = mod(s.hero.stats.str) + BAL.proficiency + passive(s, "hit") + st.hit + rollPenalty(s);
  if (!st.autoHit && roll === 1) {
    log(s, `칼이 손에서 미끄러질 뻔했다! (주사위 1)`, "miss");
    return;
  }
  if (!st.autoHit && roll !== 20 && roll + bonus < ac) {
    log(s, `${def.name}에게 휘두른 칼이 빗나갔다. (${roll}+${bonus} vs AC ${ac})`, "miss");
    return;
  }
  const crit = roll === 20 || r.float() * 100 < 5 + mod(s.hero.stats.luk) + passive(s, "crit");
  const base = r.dice(WEAPON[0] * (crit ? 2 : 1), WEAPON[1]) + mod(s.hero.stats.str) + passive(s, "dmg") + st.dmg;
  const dmg = Math.max(1, Math.round(base * st.mult));
  target.hp -= dmg;
  if (crit) note(s, "luk");
  log(s, `${def.name}에게 명중! ${dmg} 피해${crit ? " (치명타!)" : ""}`, crit ? "crit" : "hit");
  if (target.hp <= 0) {
    note(s, "str");
    c.loot += def.mana;
    log(s, `${josa(def.name, "을")} 쓰러뜨렸다.`, "good");
  }
}

export function potionHeal(s: GameState): number {
  return rngOf(s).dice(2, 4) + 2 + passive(s, "potion");
}

function drink(s: GameState, when: string): void {
  s.inventory.potion -= 1;
  const heal = potionHeal(s);
  s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
  log(s, `${when} 치료 물약을 마셨다. HP +${heal} (남은 물약 ${s.inventory.potion})`, "good");
}

function tryFlee(s: GameState, c: CombatState): boolean {
  const dc = BAL.fleeDcBase + alive(c).length * 2;
  const roll = rngOf(s).die(20);
  const bonus = mod(s.hero.stats.dex) + passive(s, "flee") + rollPenalty(s);
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
    if (e.stun && e.stun > 0) {
      e.stun -= 1;
      log(s, `${josa(def.name, "이")} 비틀거리며 공격하지 못한다.`, "miss");
      continue;
    }
    const roll = r.die(20);
    if (roll === 1 || (roll !== 20 && roll + def.atk < ac)) {
      note(s, "dex");
      log(s, `${def.name}의 공격을 피했다.`, "miss");
      continue;
    }
    const crit = roll === 20;
    const dmg = Math.max(1, r.dice(def.dice[0] * (crit ? 2 : 1), def.dice[1]));
    s.hero.hp -= dmg;
    log(s, `${josa(def.name, "이")} ${def.attackText}! ${dmg} 피해${crit ? " (치명타!)" : ""}`, "hurt");
    if (s.hero.hp <= 0) {
      const grit = activeSkills(s).find((sk) => sk.trigger!.on === "lethal" && !s.tripUsed.includes(sk.id));
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
  if (c.context === "field") afterFieldCombat(s, outcome, c);
  else afterDungeonCombat(s, outcome, c);
}
