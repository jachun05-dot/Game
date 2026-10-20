import { BAL } from "../game/data";
import { GEAR, SLOTS, gearBonus, gearEffect, weaponOf } from "../game/gear";
import { CLASSES } from "../game/classes";
import { heroAc, maxHp, smod, stat } from "../game/core";
import { passive } from "../game/skills";
import type { Ctl } from "./App";
import { BuildSummary, Card, FaithCard, GearIcon, InjuryCard, FragList, LevelTable, SkillList, StatGrid, TacticsBar, fmtMod } from "./components";
import { CLASS_ART } from "./art";
import { TEACHINGS, godOf } from "../game/faith";
import { relicDesc, relicName } from "../game/temple";
import { CLUES, clueCount, knowsClue } from "../game/truth";
import { t } from "../i18n";

/** 캐릭터 화면: 장비 9슬롯, 공격·방어 계산 내역, 능력치, 기술, 소지품 */
export function CharacterSheet({ ctl }: { ctl: Ctl }) {
  const { s } = ctl;
  const h = s.hero;
  const dexMod = smod(s, "dex");
  const gearAc = gearBonus(s, "ac");
  const skillAc = passive(s, "ac") - gearAc;
  const w = weaponOf(s);
  const STAT_KO = { str: t("힘"), dex: t("민첩"), con: t("체력"), int: t("지능"), per: t("감각"), luk: t("행운") } as const;
  const strMod = smod(s, w.stat);
  const hitBonus = strMod + BAL.proficiency + passive(s, "hit");
  const dmgBonus = strMod + passive(s, "dmg");
  const crit = 5 + smod(s, "luk") + passive(s, "crit");

  const slotItem = (key: keyof typeof s.gear): { id: string; name: string; effect: string } | null => {
    const id = s.gear[key];
    return id ? { id, name: GEAR[id].name, effect: gearEffect(id) } : null;
  };

  return (
    <div className="sheet-backdrop" onClick={() => ctl.setSheet(false)}>
      <div className="sheet" role="dialog" aria-label={t("캐릭터")} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <img className="portrait big" src={CLASS_ART[h.cls].face} alt="" />
          <div>
            <div className="hero-name">
              <span>{h.name}</span> <span className="lv-badge">Lv {h.level}</span> <span className="dim">{CLASSES[h.cls].name}</span>
              {h.faith && <span className="faith-tag">{h.faith}</span>}
            </div>
            <div className="dim small">
              HP {h.hp}/{maxHp(s)} · AC {heroAc(s)} · {s.gold}G · {t("등급 {rank}", { rank: s.rank })}
            </div>
          </div>
          <button className="btn small ghost close" onClick={() => ctl.setSheet(false)}>
            {t("닫기")}
          </button>
        </div>

        <div className="sheet-body">
          <Card title={t("장비")}>
            <ul className="equip gear">
              {SLOTS.map((sl) => {
                const it = slotItem(sl.key);
                return (
                  <li key={sl.key} className={it ? "" : "empty"}>
                    <GearIcon id={it?.id} />
                    <span className="slot">{sl.name}</span>
                    <span className="item">{it ? it.name : t("비어 있음")}</span>
                    <span className="effect">{it?.effect ?? ""}</span>
                  </li>
                );
              })}
            </ul>
            <p className="dim small">{t("장비는 대장간에서 산다. 강해지는 수단이 아니라 살아남기 위한 최소한이다.")}</p>
          </Card>

          <Card title={t("전투 수치")}>
            <dl className="calc">
              <dt>{t("방어(AC)")}</dt>
              <dd>
                <b>{heroAc(s)}</b> {t("= 10 + 민첩 {dex} + 장비 {gear}", { dex: fmtMod(dexMod), gear: fmtMod(gearAc) })}
                {skillAc ? " + " + t("기술 {n}", { n: fmtMod(skillAc) }) : ""}
              </dd>
              <dt>{t("명중")}</dt>
              <dd>
                d20 <b>{fmtMod(hitBonus)}</b> ({STAT_KO[w.stat]} {fmtMod(strMod)}, {t("숙련 +{n}", { n: BAL.proficiency })}
                {passive(s, "hit") ? ", " + t("기술 {n}", { n: fmtMod(passive(s, "hit")) }) : ""})
              </dd>
              <dt>{t("피해")}</dt>
              <dd>
                {w.dice[0]}d{w.dice[1]} <b>{fmtMod(dmgBonus)}</b>
              </dd>
              <dt>{t("치명타")}</dt>
              <dd>
                <b>{crit}%</b> {t("+ 주사위 20")}
              </dd>
              <dt>{t("턴당 행동")}</dt>
              <dd>{stat(s, "dex") >= 35 ? t("2회 (민첩 35 이상)") : t("1회 (민첩 35부터 2회)")}</dd>
            </dl>
          </Card>

          <Card title={t("능력치")}>
            <StatGrid s={s} />
          </Card>

          <Card title={t("훈련 갈래")}>
            <BuildSummary s={s} />
            <LevelTable s={s} />
          </Card>

          <Card title={t("기술")}>
            <SkillList s={s} />
          </Card>

          <Card title={t("부상 · 질병")}>
            <InjuryCard s={s} />
          </Card>

          <Card title={t("신앙")}>
            <FaithCard s={s} />
            {s.godTeaching && (() => {
              const te = TEACHINGS[s.godTeaching as keyof typeof TEACHINGS];
              const on = godOf(s.hero.faith)?.key === s.godTeaching;
              return (
                <>
                  <p className="small">
                    {t("신의 가르침")} 【{te.name}】 {te.boost}{!on && <span className="dim"> — {t("그 신을 섬기지 않아 꺼져 있다")}</span>}
                  </p>
                  <p className="small">
                    {t("마지막 기술")} 【{te.final}】 {te.finalDesc}
                  </p>
                </>
              );
            })()}
            {s.relic && (
              <p className="small">
                {t("유물")} 【{relicName(s)}】 {relicDesc(s)}
                {godOf(s.hero.faith)?.key !== s.relic && <span className="dim"> — {t("그 신을 섬기지 않아 빛을 잃었다")}</span>}
              </p>
            )}
          </Card>

          <Card title={t("진실 조각 {n}/{total}", { n: clueCount(s), total: CLUES.length })}>
            {CLUES.map((c) => (
              <p key={c.id} className="small">
                {knowsClue(s, c.id) ? <b>{c.name}</b> : <span className="dim">??? — {c.where}</span>}
                {c.id === "edict" && knowsClue(s, c.id) && !s.edict && <span className="dim"> ({t("이번 삶에서 다시 들어야 진엔딩이 열린다")})</span>}
              </p>
            ))}
          </Card>

          <Card title={t("편린")}>
            <FragList s={s} />
            <button className="btn small" onClick={ctl.openCodex}>
              {t("몬스터 도감 보기")}
            </button>
          </Card>

          <Card title={t("소지품")}>
            <p className="small">
              {t("말린 고기")} {s.inventory.food} · {t("치료 물약")} {s.inventory.potion} · {t("귀환 주문서")} {s.inventory.scroll} · {t("붕대")} {s.inventory.bandage} · {t("약초 탕약")} {s.inventory.herb}
              {s.dungeon ? " · " + t("마석 {n}G 어치", { n: s.dungeon.mana }) : ""}
              {s.inventory.heart > 0 ? ` · ${BAL.heartName} ${s.inventory.heart}` : ""}
              {s.inventory.banner > 0 ? ` · ${t("장군의 녹슨 휘장")} ${s.inventory.banner}` : ""}
              {s.inventory.spore > 0 ? ` · ${t("균모의 포자낭")} ${s.inventory.spore}` : ""}
              {s.inventory.antidote > 0 ? ` · ${t("해독초")} ${s.inventory.antidote}` : ""}
              {s.inventory.whetstone > 0 ? ` · ${t("숫돌")} ${s.inventory.whetstone}` : ""}
              {s.inventory.scale > 0 ? ` · ${t("화로 어미의 불씨 비늘")} ${s.inventory.scale}` : ""}
              {s.inventory.fang > 0 ? ` · ${t("아귀의 검은 이빨")} ${s.inventory.fang}` : ""}
              {s.inventory.rope > 0 ? ` · ${t("밧줄")} ${s.inventory.rope}` : ""}
              {s.inventory.incense > 0 ? ` · ${t("옛 신의 향")} ${s.inventory.incense}` : ""}
            </p>
            <p className="dim small">{t("읽은 기록물 {n}개", { n: s.recordsRead })}</p>
          </Card>

          <Card title={t("전투 방침")}>
            <TacticsBar ctl={ctl} />
          </Card>
        </div>
      </div>
    </div>
  );
}
