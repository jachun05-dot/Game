import { BAL, EQUIP_SLOTS, GEAR } from "../game/data";
import { heroAc, maxHp, mod } from "../game/core";
import { passive } from "../game/skills";
import type { Ctl } from "./App";
import { Card, SkillList, StatGrid, TacticsBar, fmtMod } from "./components";

/** 캐릭터 화면: 장비 9슬롯, 공격·방어 계산 내역, 능력치, 기술, 소지품 */
export function CharacterSheet({ ctl }: { ctl: Ctl }) {
  const { s } = ctl;
  const h = s.hero;
  const dexMod = mod(h.stats.dex);
  const gearAc = Object.values(s.gear).reduce((a, id) => a + (id ? GEAR[id].ac : 0), 0);
  const skillAc = passive(s, "ac");
  const strMod = mod(h.stats.str);
  const hitBonus = strMod + BAL.proficiency + passive(s, "hit");
  const dmgBonus = strMod + passive(s, "dmg");
  const crit = 5 + mod(h.stats.luk) + passive(s, "crit");

  const slotItem = (key: string): { name: string; effect: string } | null => {
    if (key === "main") return { name: "숏소드", effect: "피해 1d6 · 힘 기반" };
    const id = s.gear[key as keyof typeof s.gear];
    return id ? { name: GEAR[id].name, effect: `AC +${GEAR[id].ac}` } : null;
  };

  return (
    <div className="sheet-backdrop" onClick={() => ctl.setSheet(false)}>
      <div className="sheet" role="dialog" aria-label="캐릭터" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <img className="portrait big" src="./hero-face.png" alt="" />
          <div>
            <div className="hero-name">
              {h.name} <span className="dim">Lv.{h.level}</span>
              {h.faith && <span className="faith-tag">{h.faith}</span>}
            </div>
            <div className="dim small">
              HP {h.hp}/{maxHp(s)} · AC {heroAc(s)} · {s.gold}G · 등급 {s.rank}
            </div>
          </div>
          <button className="btn small ghost close" onClick={() => ctl.setSheet(false)}>
            닫기
          </button>
        </div>

        <div className="sheet-body">
          <Card title="장비">
            <ul className="equip">
              {EQUIP_SLOTS.map((sl) => {
                const it = slotItem(sl.key);
                return (
                  <li key={sl.key} className={it ? "" : "empty"}>
                    <span className="slot">{sl.name}</span>
                    <span className="item">{it ? it.name : "비어 있음"}</span>
                    <span className="effect">{it?.effect ?? ""}</span>
                  </li>
                );
              })}
            </ul>
            <p className="dim small">장비는 대장간에서 산다. 강해지는 수단이 아니라 살아남기 위한 최소한이다.</p>
          </Card>

          <Card title="전투 수치">
            <dl className="calc">
              <dt>방어(AC)</dt>
              <dd>
                <b>{heroAc(s)}</b> = 10 + 민첩 {fmtMod(dexMod)} + 장비 {fmtMod(gearAc)}
                {skillAc ? ` + 기술 ${fmtMod(skillAc)}` : ""}
              </dd>
              <dt>명중</dt>
              <dd>
                d20 <b>{fmtMod(hitBonus)}</b> (힘 {fmtMod(strMod)}, 숙련 +{BAL.proficiency}
                {passive(s, "hit") ? `, 기술 ${fmtMod(passive(s, "hit"))}` : ""})
              </dd>
              <dt>피해</dt>
              <dd>
                1d6 <b>{fmtMod(dmgBonus)}</b>
              </dd>
              <dt>치명타</dt>
              <dd>
                <b>{crit}%</b> + 주사위 20
              </dd>
              <dt>턴당 행동</dt>
              <dd>{h.stats.dex >= 35 ? "2회 (민첩 35 이상)" : "1회 (민첩 35부터 2회)"}</dd>
            </dl>
          </Card>

          <Card title="능력치">
            <StatGrid s={s} />
          </Card>

          <Card title="기술">
            <SkillList s={s} />
          </Card>

          <Card title="소지품">
            <p className="small">
              말린 고기 {s.inventory.food} · 치료 물약 {s.inventory.potion} · 귀환 주문서 {s.inventory.scroll}
              {s.dungeon ? ` · 마석 ${s.dungeon.mana}G 어치` : ""}
            </p>
            <p className="dim small">읽은 기록물 {s.recordsRead}개</p>
          </Card>

          <Card title="전투 방침">
            <TacticsBar ctl={ctl} />
          </Card>
        </div>
      </div>
    </div>
  );
}
