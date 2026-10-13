import { newRun } from "../src/game/town";
import { apply } from "../src/game/engine";
import { botAction } from "../src/game/bot";
const N = 1000;
const agg = { entered: 0, lvl: 0, gold: 0, potion: 0, scroll: 0, settle: 0, mana: 0, paid: 0, forced: 0, cleared: 0, scrollRet: 0, deadInDungeon: 0, hpAtEntry: 0 };
const deep = [0, 0, 0, 0];
for (let seed = 1; seed <= N; seed++) {
  const s = newRun(seed * 7919);
  let entered = false;
  for (let i = 0; i < 50000 && s.phase !== "dead" && s.month === 1; i++) {
    apply(s, botAction(s)!);
    if (!entered && s.dungeon) { entered = true; agg.entered++; agg.lvl += s.hero.level; agg.gold += s.gold; agg.potion += s.inventory.potion; agg.scroll += s.inventory.scroll; agg.hpAtEntry += s.hero.hp; }
    if (s.phase === "settlement" && s.settlement) {
      const st = s.settlement; agg.settle++; agg.mana += st.manaSold; if (st.paid) agg.paid++; if (st.forced) agg.forced++; if (st.cleared) agg.cleared++; if (!st.forced && !st.cleared) agg.scrollRet++;
      const m = st.lines[1].match(/(\d)층/); if (m) deep[+m[1]]++;
      apply(s, botAction(s)!);
    }
    if (s.phase === "dead" && s.tomb && s.tomb.reached.includes("층")) agg.deadInDungeon++;
  }
}
const e = agg.entered;
console.log(`던전 진입 ${e}/${N} | 진입 시 평균 레벨 ${(agg.lvl / e).toFixed(2)} HP ${(agg.hpAtEntry / e).toFixed(1)} 소지금 ${(agg.gold / e).toFixed(0)} 물약 ${(agg.potion / e).toFixed(2)} 주문서 ${(agg.scroll / e).toFixed(2)}`);
console.log(`던전 사망 ${agg.deadInDungeon} | 귀환 ${agg.settle} (강제 ${agg.forced}, 주문서 ${agg.scrollRet}, 클리어 ${agg.cleared}) | 평균 환전 ${(agg.mana / Math.max(1, agg.settle)).toFixed(0)}G | 세금 납부 ${agg.paid}`);
console.log(`귀환자 최대 도달 층: 1층 ${deep[1]}, 2층 ${deep[2]}, 3층 ${deep[3]}`);
