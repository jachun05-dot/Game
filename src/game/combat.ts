import { josa } from "./josa";
import { BAL, MONSTERS } from "./data";
import { actionsPerRound, heroAc, kill, log, maxHp, mod, note, rngOf, rollPenalty } from "./core";
import type { CombatState, Enemy, GameState } from "./types";
import { afterDungeonCombat, passTime } from "./dungeon";
import { afterFieldCombat } from "./town";

// DESIGN 8절: 메뉴식 라운드 전투. 플레이어 행동 → 적 전체 행동.
// 위치 개념이 없으므로 "포위"는 동시에 살아있는 적 수로 표현한다.

const WEAPON: [number, number] = [1, 6]; // 숏소드

export function makeEnemies(s: GameState, ids: string[]): Enemy[] {
  return ids.map((defId) => ({ uid: s.nextUid++, defId, hp: MONSTERS[defId].hp }));
}

export function startCombat(s: GameState, context: CombatState["context"], enemies: Enemy[]): void {
  s.combat = { context, enemies, round: 1, actionsLeft: actionsPerRound(s), loot: 0 };
  s.phase = context === "field" ? "combat" : "dungeon";
  const names = describeGroup(enemies);
  log(s, `${josa(names, "이")} 나타났다!`, "hurt");
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

export function combatAttack(s: GameState, targetUid: number): void {
  const c = s.combat;
  if (!c) return;
  const target = c.enemies.find((e) => e.uid === targetUid && e.hp > 0) ?? alive(c)[0];
  if (!target) return;
  const def = MONSTERS[target.defId];
  const r = rngOf(s);
  const roll = r.die(20);
  const bonus = mod(s.hero.stats.str) + BAL.proficiency + rollPenalty(s);
  if (roll === 1) {
    log(s, `공격이 크게 빗나갔다! (주사위 1)`, "miss");
  } else if (roll !== 20 && roll + bonus < def.ac) {
    log(s, `${def.name}에게 휘두른 칼이 빗나갔다. (${roll}+${bonus} vs AC ${def.ac})`, "miss");
  } else {
    const crit = roll === 20 || r.float() * 100 < 5 + mod(s.hero.stats.luk);
    const dmg = Math.max(1, r.dice(WEAPON[0] * (crit ? 2 : 1), WEAPON[1]) + mod(s.hero.stats.str));
    target.hp -= dmg;
    if (crit) note(s, "luk");
    log(s, `${def.name}에게 명중! ${dmg} 피해${crit ? " (치명타!)" : ""}`, crit ? "crit" : "hit");
    if (target.hp <= 0) {
      note(s, "str");
      c.loot += def.mana;
      log(s, `${josa(def.name, "을")} 쓰러뜨렸다.`, "good");
    }
  }
  endPlayerAction(s);
}

export function combatPotion(s: GameState): void {
  if (!s.combat || s.inventory.potion <= 0) return;
  s.inventory.potion -= 1;
  const heal = rngOf(s).dice(2, 4) + 2;
  s.hero.hp = Math.min(maxHp(s), s.hero.hp + heal);
  log(s, `치료 물약을 마셨다. HP +${heal}`, "good");
  endPlayerAction(s);
}

export function combatFlee(s: GameState): void {
  const c = s.combat;
  if (!c) return;
  const dc = BAL.fleeDcBase + alive(c).length * 2;
  const r = rngOf(s).die(20);
  const total = r + mod(s.hero.stats.dex) + rollPenalty(s);
  if (r === 20 || (r !== 1 && total >= dc)) {
    note(s, "dex");
    log(s, `등을 돌려 달아났다! (${r}+${total - r} vs ${dc})`, "system");
    finishCombat(s, "fled");
    return;
  }
  log(s, `도망치지 못했다! (${r}+${total - r} vs ${dc})`, "miss");
  c.actionsLeft = 0;
  enemyTurn(s);
}

function endPlayerAction(s: GameState): void {
  const c = s.combat!;
  if (alive(c).length === 0) {
    finishCombat(s, "win");
    return;
  }
  c.actionsLeft -= 1;
  if (c.actionsLeft <= 0) enemyTurn(s);
}

function enemyTurn(s: GameState): void {
  const c = s.combat!;
  const r = rngOf(s);
  const attackers = alive(c);
  const ac = heroAc(s);
  for (const e of attackers) {
    const def = MONSTERS[e.defId];
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
      s.hero.hp = 0;
      const cause = attackers.length >= 2 ? "mob" : "single";
      kill(s, cause, cause === "mob" ? `${describeGroup(attackers)}에게 둘러싸여 쓰러졌다` : `${def.name}에게 쓰러졌다`);
      return;
    }
    note(s, "con");
  }
  c.round += 1;
  c.actionsLeft = actionsPerRound(s);
  if (c.context === "dungeon") {
    passTime(s, 1);
  }
}

function finishCombat(s: GameState, outcome: "win" | "fled"): void {
  const c = s.combat!;
  s.combat = null;
  if (c.context === "field") afterFieldCombat(s, outcome, c);
  else afterDungeonCombat(s, outcome, c);
}
