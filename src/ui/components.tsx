import { LangPicker } from "./LangPicker";
import { getLang, t, tk } from "../i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { maxHp, heroAc, smod, stat } from "../game/core";
import { FRAGMENTS, TIER_LABEL, fragSlots, fragStat, fragStatText } from "../game/fragments";
import { FAITH_BAL, PIETY_TIERS, TEACHINGS, godOf, pietyCap, tier } from "../game/faith";
import { PARA_NAME, PARA_PARTS, PARA_PART_NAME, POISON_NAME, corrodedSlots, corrosionEffect, paraEffect, paraOf, poisonOf } from "../game/hazards";
import { CORRODE_NAME, corrosionOf } from "../game/gear";
import { MIND_EFFECT, MIND_KEYS, MIND_NAME, known, mindSummary } from "../game/mind";
import { INJ, LEVEL_NAME, PARTS, PART_NAME, diseaseName, injurySummary, partEffect } from "../game/injury";
import { STAT_KEYS, STAT_LABEL } from "../game/data";
import { GEAR } from "../game/gear";
import { CLASSES } from "../game/classes";
import { SKILLS, skillWorks } from "../game/skills";
import { hasLevelTable, levelSkill } from "../game/elements";
import { TRAININGS } from "../game/data";
import { hasShield, offOf, weaponOf } from "../game/gear";
import type { OffKind } from "../game/elements";

/** 로그 왼손 무기 이름(기술 조건 안내) */
export const OFF_NAME: Record<OffKind, string> = { dagger: tk("두 번째 단검"), flask: tk("독병 주머니"), xbow: tk("손쇠뇌") };
const OFF_MARK: Record<OffKind, string> = { dagger: "🗡", flask: "⚗", xbow: "➶" };
import { AUTO_EAT_AT } from "../game/dungeon";
import { BRANCH_SKILLS } from "../game/elements";
import type { AutoGoal, GameState } from "../game/types";
import type { Ctl, Speed } from "./App";
import { CharacterSheet } from "./CharacterSheet";
import { CLASS_ART, FRAG_ICON, GEAR_ICON, LINE_ICON, MONSTER_ART, SCENE_ART } from "./art";
import { TIPS, currentTip } from "./tips";
import { Icon } from "./icons";
import { AGE, ageOf, monthsLeft } from "../game/age";

export function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <main className={`shell${wide ? " wide" : ""}`}>{children}</main>;
}

export function Card({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      {title && <h2 className="card-title">{title}</h2>}
      {children}
    </section>
  );
}

export function Bar({ value, max, tone }: { value: number; max: number; tone: "hp" | "food" | "tired" | "enemy" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar bar-${tone}${tone === "hp" && pct <= 30 ? " low" : ""}`}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function fmtMod(v: number): string {
  return (v >= 0 ? "+" : "") + v;
}

/**
 * 게임 화면 공통 틀: 상단 바 + 고정 헤더 + 가운데 스크롤 영역 + 하단 고정 도크.
 * 선택지는 도크에 두고, 로그 연출 중에도 숨기지 않고 흐리게만 해서 위치가 흔들리지 않게 한다.
 */
export function GameScreen({ ctl, title, header, children, dock, dockClass }: { ctl: Ctl; title: ReactNode; header?: ReactNode; children: ReactNode; dock?: ReactNode; dockClass?: string }) {
  return (
    <div className="screen">
      <TopBar ctl={ctl} title={title} />
      {header && <div className="screen-head">{header}</div>}
      <div className="screen-body">
        <TipCard ctl={ctl} />
        {children}
      </div>
      {dock && <div className={`dock ${dockClass ?? ""}${ctl.busy ? " waiting" : ""}`}>{dock}</div>}
      {ctl.sheet && <CharacterSheet ctl={ctl} />}
    </div>
  );
}

export function HeroHeader({ s, extra, onOpen }: { s: GameState; extra?: ReactNode; onOpen?: () => void }) {
  const hp = maxHp(s);
  return (
    <header className={`hero-head${onOpen ? " clickable" : ""}`} onClick={onOpen} role={onOpen ? "button" : undefined} aria-label={onOpen ? t("캐릭터와 장비 보기") : undefined}>
      <img className="portrait" src={CLASS_ART[s.hero.cls].face} alt="" />
      <div className="hero-info">
        <div className="hero-name">
          <span>{t(s.hero.name)}</span> <span className="lv-badge">Lv {s.hero.level}</span> <span className="dim">{t(CLASSES[s.hero.cls].name)}</span>
          {s.hero.faith && <span className="faith-tag">{t(s.hero.faith)} {"★".repeat(tier(s))}</span>}
          {s.heretic && <span className="faith-tag heretic">{t("현상수배")}</span>}
        </div>
        <div className="hp-line">
          <span aria-label="HP"><Icon name="heart" /></span>
          <Bar value={s.hero.hp} max={hp} tone="hp" />
          <span className="num">
            {s.hero.hp}/{hp}
          </span>
        </div>
        <div className="hero-meta">
          <span className="stat-pill gold" title={t("가진 돈")}><Icon name="coin" />{s.gold}G</span>
          <span className="stat-pill ac" title={t("방어도(AC)")}><Icon name="shield" />AC {heroAc(s)}</span>
          <span className="stat-pill rank" title={t("등급(클리어한 섹터 수)")}><Icon name="crest" />{t("등급 {n}", { n: s.rank })}</span>
          <AgePill month={s.month} />
          {extra}
          {onOpen && <span className="more">{t("장비")} <Icon name="chev" /></span>}
        </div>
        <InjuryTags s={s} />
      </div>
    </header>
  );
}

/** 나이와 미궁이 문을 닫기까지 남은 달(age.ts). 6개월 이하면 붉게 */
export function AgePill({ month }: { month: number }) {
  const left = monthsLeft(month);
  const warn = left <= AGE.warnAt[0];
  return (
    <span className={`stat-pill age${warn ? " warn" : ""}`} title={t("미궁은 열일곱 살이 끝날 때까지만 들어갈 수 있다 — 남은 {n}개월", { n: left })}>
      <Icon name="clock" />
      {t("{n}세", { n: ageOf(month) })}{warn ? ` · ${t("{n}개월", { n: left })}` : ""}
    </span>
  );
}

export function StatGrid({ s }: { s: GameState }) {
  return (
    <div className="stat-grid">
      {STAT_KEYS.map((k) => (
        <div key={k} className="stat-cell">
          <span className="dim">{t(STAT_LABEL[k])}</span>
          <b className={fragStat(s, k) > 0 ? "accent" : ""} title={fragStat(s, k) > 0 ? t("편린 +{n}", { n: fragStat(s, k) }) : undefined}>
            {stat(s, k)}
          </b>
          <span className="mod">{fmtMod(smod(s, k))}</span>
        </div>
      ))}
    </div>
  );
}

export function GearList({ s }: { s: GameState }) {
  const items = Object.values(s.gear).map((id) => (id ? t(GEAR[id].name) : "")).filter(Boolean);
  return <div className="dim small">{t("장비: {items}", { items: items.join(" · ") })}</div>;
}

/** 로그 패널: shown 개수까지만 보여주고, 누르면 남은 줄을 한 번에 보여준다 */
export function LogView({ ctl, max = 80, tall, fill }: { ctl: Ctl; max?: number; tall?: boolean; fill?: boolean }) {
  const { s, shown } = ctl;
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number[]>([]); // 펼친 전투(접힌 번호)
  const start = s.logCount - s.log.length; // log[0]의 전역 번호
  const visible = s.log
    .map((l, i) => ({ ...l, n: start + i }))
    .filter((l) => l.n < shown && (l.fold === undefined || open.includes(l.fold)))
    .slice(-max);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [shown]);
  return (
    <div ref={ref} className={`log${tall ? " tall" : ""}${fill ? " fill" : ""}`} onClick={ctl.revealAll} role="log" aria-live="polite">
      {visible.map((l) =>
        l.foldOf !== undefined ? (
          <p key={l.n} className={`log-line ${l.kind} fold-sum`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => (o.includes(l.foldOf!) ? o.filter((x) => x !== l.foldOf) : [...o, l.foldOf!]));
              }}
            >
              {l.text} <span className="dim">({open.includes(l.foldOf) ? t("접기 ▾") : t("{n}줄 펼치기 ▸", { n: l.foldN ?? 0 })})</span>
            </button>
          </p>
        ) : (
          <p key={l.n} className={`log-line ${l.kind}${l.fold !== undefined ? " folded" : ""}`}>
            {l.mons && <EncounterFigures ids={l.mons} />}
            {l.text}
          </p>
        ),
      )}
      {ctl.busy && <p className="log-line dim blink">▼</p>}
    </div>
  );
}

/** 몬스터 등장 줄 위에 나타난 몬스터를 원래 도트 크기(1배)로 나란히 세운다. 그림이 없는 몬스터는 글로만 */
function EncounterFigures({ ids }: { ids: string[] }) {
  const arts = ids.map((id) => MONSTER_ART[id]).filter(Boolean);
  if (!arts.length) return null;
  return (
    <span className="encounter">
      {arts.map((a, i) => (
        <img key={i} src={a.src} width={a.w} height={a.h} alt="" />
      ))}
    </span>
  );
}

const SPEEDS: Speed[] = [1, 2, 4, 8, 0];

export function SpeedBar({ ctl }: { ctl: Ctl }) {
  return (
    <div className="speed-bar">
      {SPEEDS.map((v) => (
        <button key={v} className={`chip${ctl.speed === v ? " on" : ""}`} onClick={() => ctl.setSpeed(v)}>
          {v === 0 ? t("즉시") : `${v}×`}
        </button>
      ))}
      <button className={`chip${ctl.auto ? " on" : ""}`} onClick={() => ctl.setAuto(!ctl.auto)} title={t("중요한 결정도 자동으로 고릅니다. 미궁에서 나오면 저절로 꺼진다")}>
        {t("자동 결정")} {ctl.auto ? "ON" : "OFF"}
      </button>
    </div>
  );
}

export function TopBar({ ctl, title }: { ctl: Ctl; title: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [glossary, setGlossary] = useState(false);
  return (
    <div className="topbar">
      <button className="link" onClick={ctl.goTitle} aria-label={t("타이틀로")}>
        <Icon name="menu" />
      </button>
      <span className="topbar-title">{title}</span>
      <button className="gear-btn" onClick={() => ctl.setSheet(true)} aria-label={t("캐릭터와 장비")}>
        <Icon name="bag" />
        {t("장비")}
      </button>
      <button className={`gear-btn${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t("설정")}>
        <Icon name="gear" /> <span className="small">{ctl.speed === 0 ? t("즉시") : `${ctl.speed}×`}{ctl.auto ? ` · ${t("자동({goal})", { goal: t(GOAL_SHORT[ctl.s.autoGoal] ?? GOAL_SHORT.explore) })}` : ""}</span>
      </button>
      {glossary && <Glossary onClose={() => setGlossary(false)} />}
      {open && <div className="settings-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="settings-sheet" role="dialog" aria-label={t("설정")}>
          <p className="eyebrow">{t("진행 속도")}</p>
          <SpeedBar ctl={ctl} />
          <p className="eyebrow">{t("자동 결정 목표")}</p>
          <GoalBar ctl={ctl} />
          <p className="eyebrow">{t("전투 방침")}</p>
          <TacticsBar ctl={ctl} />
          <p className="eyebrow">{t("처음 안내")}</p>
          <div className="tactics">
            <button className={`chip${ctl.meta.tipsOff ? "" : " on"}`} onClick={() => ctl.setTipsOff(!ctl.meta.tipsOff)}>
              {ctl.meta.tipsOff ? t("꺼짐") : t("켜짐")}
            </button>
            <button className="chip" onClick={() => { setGlossary(true); setOpen(false); }}>
              {t("용어 사전")}
            </button>
          </div>
          <p className="eyebrow">언어 · Language</p> {/* i18n-ok: 어느 언어로든 찾을 수 있게 */}
          <LangPicker />
          <p className="dim small">{t("시드 #{seed}", { seed: (ctl.s.seed >>> 0).toString(36) })}</p>
          <button className="btn small ghost" onClick={() => setOpen(false)}>
            {t("닫기")}
          </button>
        </div>
      )}
    </div>
  );
}

const GOAL_SHORT: Record<string, string> = { explore: tk("탐험"), rush: tk("돌파"), farm: tk("파밍") };

const GOALS: { id: AutoGoal; name: string; desc: string }[] = [
  { id: "explore", name: tk("구석구석 탐험"), desc: tk("층의 모든 방을 돌고 기록물도 읽은 뒤 내려간다.") },
  { id: "rush", name: tk("빠르게 다음 층"), desc: tk("계단이 보이면 곧장 내려간다. 기록물은 건너뛰고, HP 절반만 있어도 내려간다. 그래도 준비 안 된 층까지는 가지 않는다.") },
  { id: "farm", name: tk("파밍"), desc: tk("전투방과 보물상자 위주로 털고, 싸우기 전에 HP를 채운다. 무리해서 내려가지 않는다.") },
];

/** 자동 결정이 미궁에서 노리는 목표(자동 결정 OFF일 때는 영향 없음) */
export function GoalBar({ ctl }: { ctl: Ctl }) {
  const { s, dispatch } = ctl;
  const cur = GOALS.find((g) => g.id === s.autoGoal) ?? GOALS[0];
  return (
    <>
      <div className="tactics">
        {GOALS.map((g) => (
          <button key={g.id} className={`chip${s.autoGoal === g.id ? " on" : ""}`} onClick={() => dispatch({ t: "autoGoal", goal: g.id })}>
            {t(g.name)}
          </button>
        ))}
      </div>
      <p className="dim small">
        {t(cur.desc)}
        {!ctl.auto && ` ${t("(자동 결정을 켜야 적용된다)")}`}
      </p>
    </>
  );
}

const POTION_STEPS = [0, 25, 35, 50];
const FLEE_STEPS = [0, 15, 25];

/** 자동 전투 방침 — 누를 때마다 다음 값으로 바뀐다 */
export function TacticsBar({ ctl }: { ctl: Ctl }) {
  const { s, dispatch } = ctl;
  const { potionAt, fleeAt } = s.tactics;
  const next = (steps: number[], v: number) => steps[(steps.indexOf(v) + 1) % steps.length];
  return (
    <div className="tactics">
      <button className="chip" onClick={() => dispatch({ t: "tactics", tactics: { potionAt: next(POTION_STEPS, potionAt) } })}>
        {t("물약: {v}", { v: potionAt ? t("HP {n}% 이하", { n: potionAt }) : t("안 마심") })}
      </button>
      <button className="chip" onClick={() => dispatch({ t: "tactics", tactics: { fleeAt: next(FLEE_STEPS, fleeAt) } })}>
        {t("도주: {v}", { v: fleeAt ? t("HP {n}% 이하", { n: fleeAt }) : t("끝까지 싸움") })}
      </button>
      <button className={`chip${s.tactics.autoEat !== false ? " on" : ""}`} onClick={() => dispatch({ t: "tactics", tactics: { autoEat: s.tactics.autoEat === false } })} title={t("미궁에서 포만감이 {n} 이하가 되면 말린 고기를 알아서 먹는다", { n: AUTO_EAT_AT })}>
        {t("식사: {v}", { v: s.tactics.autoEat !== false ? t("배고프면 알아서") : t("직접") })}
      </button>
    </div>
  );
}

export function SkillList({ s, empty }: { s: GameState; empty?: string }) {
  if (s.skills.length === 0) return <p className="dim small">{empty ?? t("아직 배운 기술이 없다. 직업교관에게 훈련을 받으면 배운다.")}</p>;
  return (
    <ul className="skills">
      {s.skills.map((id) => {
        const sk = SKILLS[id];
        const off = !skillWorks(s, id);
        return (
          <li key={id} className={off ? "off" : ""}>
            <span className={`skill-kind ${sk.kind}`}>{sk.kind === "active" ? t("자동 발동") : t("패시브")}</span>
            <b>{t(sk.name)}</b>
            {off && <span className="skill-kind warn">{t("{what} — 쓸 수 없다", { what: sk.off ? t("{name} 없음", { name: t(OFF_NAME[sk.off]) }) : t("방패 없음") })}</span>}
            <span className="dim small">{t(sk.desc)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 흡수한 편린과 남은 칸 */
export function FragList({ s }: { s: GameState }) {
  const slots = fragSlots(s.hero.level);
  const nextAt = (Math.floor(s.hero.level / 3) + 1) * 3;
  return (
    <>
      <ul className="skills frags">
        {Array.from({ length: slots }, (_, i) => {
          const id = s.fragments[i];
          if (!id) {
            return (
              <li key={i} className="empty">
                <span className="skill-kind">{t("빈 칸")}</span>
                <span className="dim small">{t("미궁의 몬스터를 쓰러뜨리면 아주 드물게 편린이 남는다.")}</span>
              </li>
            );
          }
          const f = FRAGMENTS[id];
          const sk = f.skill ? SKILLS[f.skill] : null;
          return (
            <li key={i}>
              <FragIcon tier={f.tier} />
              <span className={`skill-kind tier${f.tier}`}>{t(TIER_LABEL[f.tier])}</span>
              <b>{t(f.name)}</b>
              <span className="accent small">{fragStatText(id)}</span>
              {sk && (
                <span className="small">
                  【{t(sk.name)}】 <span className="dim">{sk.kind === "active" ? t("자동 발동") : t("패시브")} · {t(sk.desc)}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="dim small">
        {t("편린 칸 {n}/{max} · 레벨 {lv}에 한 칸 더 생긴다. 편린으로 오른 능력치는 노란색으로 표시된다.", { n: s.fragments.length, max: slots, lv: nextAt })}
      </p>
    </>
  );
}

/** 섬기는 신·신앙심·권능·저주·현상수배 */
export function FaithCard({ s }: { s: GameState }) {
  const g = godOf(s.hero.faith);
  const tr = tier(s);
  return (
    <>
      {s.heretic && <p className="hurt small">{t("현상수배 중 — 마을에 들어갈 수 없다. 미궁에서는 이단심문관이 뒤를 쫓는다. 마을의 성당에 자수하면 신앙을 버리고 돌아갈 수 있다.")}</p>}
      {!g ? (
        <p className="dim small">{t("섬기는 신이 없다. 해금된 옛 신은 새 삶을 시작할 때나 미궁의 성소에서 섬길 수 있다.")}</p>
      ) : (
        <>
          <p className="small">
            <b>{t(g.name)}</b> <span className="dim">· {t(g.align)}</span> <span className="accent">{"★".repeat(tr)}{"☆".repeat(Math.max(0, (s.rank >= FAITH_BAL.tier5Rank ? 5 : s.rank >= FAITH_BAL.tier4Rank ? 4 : 3) - tr))}</span>
          </p>
          <div className="faith-line">
            <span className="small dim">{t("신앙심")}</span>
            <Bar value={s.piety} max={pietyCap(s)} tone="food" />
            <span className="num small">{Math.floor(s.piety)}</span>
          </div>
          <ul className="skills">
            {g.powers.map((p, i) => (
              <li key={i} className={tr > i ? "" : "empty"}>
                <span className={`skill-kind${tr > i ? " active" : ""}`}>★{i + 1} · {PIETY_TIERS[i]}</span>
                <span className={`small${tr > i ? "" : " dim"}`}>{t(p)}{i === 3 && s.rank < FAITH_BAL.tier4Rank ? ` ${t("(3섹터를 클리어하면 열린다 — 신앙심 상한도 200으로)")}` : i === 4 && s.rank < FAITH_BAL.tier5Rank ? ` ${t("(4섹터를 클리어하면 열린다)")}` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="dim small">
            {t("좋아함: {likes} · 싫어함: {dislikes}. 신앙심은 매달 5씩 줄고, ★이 높을수록 성당의 이단 심문에 걸리기 쉽다(★당 5%, 최대 15%).", { likes: t(g.likes), dislikes: t(g.dislikes) })}
          </p>
        </>
      )}
      {s.curse && s.curse.months > 0 && (
        <p className="hurt small">
          {t("{god}의 저주: {curse} (남은 {n}개월)", { god: t(s.curse.god), curse: t(godOf(s.curse.god)?.curse ?? ""), n: s.curse.months })}
        </p>
      )}
    </>
  );
}

/** 부위 부상·질병 */
export function InjuryCard({ s }: { s: GameState }) {
  return (
    <>
      <ul className="equip injuries">
        {PARTS.map((p) => {
          const raw = s.injuries[p] ?? 0;
          const eff = partEffect(s, p);
          return (
            <li key={p} className={raw || eff ? "hurt-row" : "empty"}>
              <span className="slot">{t(PART_NAME[p])}</span>
              <span className="item">
                {t(LEVEL_NAME[raw])}
                {raw >= 3 && s.prosthetic[p] ? (p === "feet" ? ` · ${t("의족")}` : ` · ${t("의수")}`) : ""}
                {raw > 0 && s.injuryCause?.[p] ? (s.injuryCause[p] === "burn" ? ` · ${t("화상")}` : ` · ${t("동상")}`) : ""}
              </span>
              <span className="effect">{eff}</span>
            </li>
          );
        })}
        <li className={s.disease ? "hurt-row" : "empty"}>
          <span className="slot">{t("질병")}</span>
          <span className="item">{s.disease ? t(diseaseName(s)) : t("없음")}</span>
          <span className="effect">{s.disease === 2 ? t("방을 옮길 때마다 HP −2, 판정 −2") : s.disease === 1 ? t("방을 옮길 때마다 HP −1") : ""}{s.disease && s.diseaseKind === "mold" ? t(", 야영 회복 절반") : ""}</span>
        </li>
        {(s.cold ?? 0) > 0 && (
          <li className="hurt-row">
            <span className="slot">{t("냉기")}</span>
            <span className="item">{Math.floor(s.cold ?? 0)}/4</span>
            <span className="effect">{t("4가 되면 손·발 하나에 동상 · 장작을 때고 야영, 얼음 구역 밖에선 방마다 −1")}</span>
          </li>
        )}
        {poisonOf(s) > 0 && (
          <li className="hurt-row">
            <span className="slot">{t("독")}</span>
            <span className="item">{t(POISON_NAME[poisonOf(s)])}</span>
            <span className="effect">{poisonOf(s) >= 2 ? t("방을 옮길 때마다 HP −2, 판정 −1") : t("방을 옮길 때마다 HP −1")} · {t("야영·미궁을 나올 때 한 단계")}</span>
          </li>
        )}
        {PARA_PARTS.filter((p) => paraOf(s, p) > 0).map((p) => (
          <li key={`para-${p}`} className="hurt-row">
            <span className="slot">{t("마비")}</span>
            <span className="item">{t(PARA_PART_NAME[p])} {t(PARA_NAME[paraOf(s, p)])}</span>
            <span className="effect">{paraEffect(p, paraOf(s, p))} · {t("미궁을 나오면 풀린다")}</span>
          </li>
        ))}
        {corrodedSlots(s).map((k) => (
          <li key={`cor-${k}`} className="hurt-row">
            <span className="slot">{t("부식")}</span>
            <span className="item">{t(CORRODE_NAME[corrosionOf(s, k)])}</span>
            <span className="effect">{corrosionEffect(k, corrosionOf(s, k))} · {t("대장간 수리·숫돌")}</span>
          </li>
        ))}
      </ul>
      <p className="eyebrow">{t("정신")}</p>
      {MIND_KEYS.some((k) => known(s, k)) ? (
        <ul className="skills">
          {MIND_KEYS.filter((k) => known(s, k)).map((k) => (
            <li key={k}>
              <span className="skill-kind mind">{t(MIND_NAME[k])}</span>
              <span className="small dim">{t(MIND_EFFECT[k])}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim small">{t("알아챈 이상은 없다.")}</p>
      )}
      <p className="dim small">
        {t("정신 상태이상은 걸려도 바로 알 수 없다 — 방을 옮길 때마다 감각·지능으로 눈치채야 보인다. 둘이 겹치면 발작·패닉·무너짐이 터진다. 여관에서 쉬거나 성소에서 기도하면 가라앉고, 미궁을 나오면 저절로 가라앉기도 한다.")}
      </p>
      <p className="dim small">
        {t("부상·질병과 HP는 저절로 낫지 않는다 — 여관(매달 값이 오른다)에서 쉬거나 붕대·탕약·물약을 써야 한다. 손·발 결손은 신전 재생 의식({regen}G)이나 대장간 의수·의족({prosthetic}G). 머리·몸통 결손은 즉사.", { regen: INJ.regenCost, prosthetic: INJ.prostheticCost })}
      </p>
    </>
  );
}

/** 헤더용 부상 요약 */
export function InjuryTags({ s }: { s: GameState }) {
  const list = injurySummary(s);
  const minds = mindSummary(s);
  if (!list.length && !minds.length) return null;
  return (
    <div className="injury-tags">
      {list.map((t) => <span key={t} className="injury-tag">{t}</span>)}
      {minds.map((m) => <span key={m} className="injury-tag mind">{m}</span>)}
    </div>
  );
}

/** 편린 등급 아이콘. 등급을 아직 모르는 편린은 hidden으로 — 모양 크기로도 등급이 새지 않게 늘 같은 실루엣을 쓴다. */
export function FragIcon({ tier, scale = 1, hidden }: { tier: number; scale?: number; hidden?: boolean }) {
  const a = FRAG_ICON[hidden ? 1 : tier];
  if (!a?.src) return null;
  return <img className={`frag-icon${hidden ? " silhouette" : ""}`} src={a.src} width={a.w * scale} height={a.h * scale} alt="" />;
}

/** 장소 그림 띠. 2배 정수 확대. 화면이 좁으면 focus 쪽을 남기고 나머지를 자른다(배경 위치 %라 빈틈이 생기지 않는다). 장식이라 글로 읽히지 않는다 */
export function SceneBanner({ id, className, children }: { id: string; className?: string; children?: ReactNode }) {
  const a = SCENE_ART[id];
  if (!a) return <>{children}</>;
  return (
    <div
      className={`scene${className ? " " + className : ""}`}
      aria-hidden={children ? undefined : true}
      style={{ height: a.h * 2, backgroundImage: `url(${a.src})`, backgroundSize: `${a.w * 2}px ${a.h * 2}px`, backgroundPosition: `${(a.focus ?? 0.5) * 100}% 0` }}
    >
      {children}
    </div>
  );
}

/** 장비 아이콘 칸(최소 32×32, 가운데 정렬. 목걸이처럼 큰 아이콘은 칸이 늘어난다). 아이콘이 없거나 빈 칸이면 빈 자리만 지킨다 */
export function GearIcon({ id, scale = 1 }: { id?: string | null; scale?: number }) {
  const a = id ? GEAR_ICON[id] : null;
  return (
    <span className="gear-icon" style={scale !== 1 ? { minWidth: 32 * scale, minHeight: 32 * scale } : undefined}>
      {a && <img src={a.src} width={a.w * scale} height={a.h * scale} alt="" />}
    </span>
  );
}

/** 특수 훈련 레벨(보스 재료가 드는 훈련) */
export { SPECIAL_LEVELS } from "../game/elements";
import { SPECIAL_LEVELS, ULTIMATE_LEVEL } from "../game/elements";
const LEVELS_2_16 = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
/**
 * 훈련 갈래의 짧은 이름: 한국어 이름에서 " 수련/훈련"을 떼고 번역한다.
 * 뗀 이름(예: "검투")이 번역돼 있으면 그것을, 아니면 전체 이름(예: "검술 훈련")의 번역을 쓴다. 한국어면 뗀 이름 그대로.
 */
export function lineName(name: string): string {
  const short = name.replace(/ (수련|훈련)$/, ""); // i18n-ok: 접미사 정규식
  const tr = t(short);
  if (tr !== short || getLang() === "ko") return tr;
  return t(name);
}
/** 특수 훈련 칸 이름 */

const SPECIAL_KIND: Record<number, string> = { 4: tk("각인"), 7: tk("특화"), 10: tk("낙인"), 13: tk("궁극기"), 16: tk("화신") };

/**
 * 직업 훈련 레벨표: 줄은 레벨, 칸은 훈련. 배운 칸 · 이번에 고를 수 있는 칸 · 놓친 칸 · 앞으로의 칸을 구분한다.
 * onPick이 있으면 이번 레벨 칸을 눌러 훈련을 고른다.
 */
export function LevelTable({ s, selected, onPick }: { s: GameState; selected?: string; onPick?: (trainingId: string) => void }) {
  const lines = CLASSES[s.hero.cls].trainings.filter(hasLevelTable);
  if (lines.length === 0) return null;
  const next = s.hero.level + 1;
  const shield = hasShield(s);
  const off = offOf(s);
  return (
    <div className="lvtable-wrap">
      <table className="lvtable">
        <thead>
          <tr>
            <th>Lv</th>
            {lines.map((id) => (
              <th key={id} className={selected === id ? "sel" : ""}>
                {LINE_ICON[id] && <img className="line-icon" src={LINE_ICON[id].src} width={LINE_ICON[id].w} height={LINE_ICON[id].h} alt="" />}
                {lineName(TRAININGS.find((x) => x.id === id)!.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEVELS_2_16.map((lv) => {
            const special = SPECIAL_LEVELS.includes(lv);
            return (
              <tr key={lv} className={`${special ? "special" : ""}${lv === next ? " now" : ""}`}>
                <th>
                  {lv}
                  <span className="lv-kind">{special ? t(SPECIAL_KIND[lv]) : lv % 2 === 0 ? t("패시브") : t("액티브")}</span>
                </th>
                {lines.map((line) => {
                  const id = levelSkill(line, lv);
                  // 모험가 16레벨: 레벨표가 아니라 섬기는 신의 가르침(히든)
                  if (!id && lv === 16 && s.hero.cls === "adventurer") {
                    const te = s.godTeaching ? TEACHINGS[s.godTeaching as keyof typeof TEACHINGS] : null;
                    return <td key={line} className={te ? "lt-learned" : "lt-future dim"} title={te ? `${t(te.boost)} / ${t(te.final)}: ${t(te.finalDesc)}` : t("교관에게서는 배울 수 없다")}>{te ? t(te.name) : "???"}</td>;
                  }
                  if (!id) return <td key={line} className="lt-future dim">—</td>;
                  const sk = SKILLS[id];
                  const learned = s.skills.includes(id);
                  const state = learned ? "lt-learned" : lv === next ? "lt-next" : lv <= s.hero.level ? "lt-missed" : "lt-future";
                  const pick = state === "lt-next" && onPick ? () => onPick(line) : undefined;
                  return (
                    <td key={line} className={`${state}${selected === line && lv === next ? " sel" : ""}`} title={t(sk.desc)}>
                      {pick ? (
                        <button type="button" onClick={pick}>
                          {t(sk.name)}
                        </button>
                      ) : (
                        <span>{t(sk.name)}</span>
                      )}
                      {learned && <span className="mark-ok"> ✓</span>}
                      {sk.shield && <span className={shield ? "dim" : "warn"}> 🛡</span>}
                      {sk.off && <span className={off === sk.off ? "dim" : "warn"} title={t("왼손에 {name|이} 있어야 발동", { name: t(OFF_NAME[sk.off]) })}> {OFF_MARK[sk.off]}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="dim small lv-legend">
        <span className="lg-learned">✓ {t("배움")}</span> · <span className="lg-next">{t("이번 훈련")}</span> · <span className="lg-missed">{t("놓침")}</span> · {s.hero.cls === "rogue" ? t("🗡·⚗·➶ 왼손에 두 번째 단검·독병 주머니·손쇠뇌가 있어야 발동(4레벨 각인이 왼손 무기를 정하고, 10레벨 낙인을 다른 갈래로 찍으면 바꾼다).") : t("🛡 방패가 있어야 발동.")} {t("짝수 레벨은 패시브, 홀수 레벨은 액티브, 4·7·10·13·16레벨은 보스 증표가 드는 특화(각인·낙인은 그 갈래 액티브를 전투당 1회씩 더, {lv}레벨 궁극기는 전투당 1회).", { lv: ULTIMATE_LEVEL })}
      </p>
    </div>
  );
}

/** 갈래별 배운 기술 수와 각인(캐릭터 시트용) */
export function BuildSummary({ s }: { s: GameState }) {
  const lines = CLASSES[s.hero.cls].trainings.filter(hasLevelTable);
  const parts = lines
    .map((line) => {
      const ids = LEVELS_2_16.map((lv) => levelSkill(line, lv)).filter((x): x is string => !!x);
      const n = ids.filter((id) => s.skills.includes(id)).length;
      const marked = SPECIAL_LEVELS.some((lv) => {
        const id = levelSkill(line, lv);
        return !!id && s.skills.includes(id);
      });
      return { name: lineName(TRAININGS.find((x) => x.id === line)!.name), n, marked };
    })
    .filter((p) => p.n > 0);
  if (!parts.length) return <p className="dim small">{t("아직 갈래를 정하지 않았다.")}</p>;
  const advice = buildAdvice(s);
  return (
    <>
      <p className="small">
        {parts.map((p, i) => (
          <span key={p.name}>
            {i ? " · " : ""}
            <b>{p.name}</b> {t("{n}개", { n: p.n })}{p.marked ? ` (${t("특화")})` : ""}
          </span>
        ))}
      </p>
      {advice.map((a) => (
        <p key={a} className="small accent">
          → {a}
        </p>
      ))}
    </>
  );
}

/** 모험가: 고른 갈래와 손에 든 무기가 엇갈릴 때의 조언(규칙은 그대로, 안내만) */
export function buildAdvice(s: GameState): string[] {
  if (s.hero.cls !== "adventurer") return [];
  const out: string[] = [];
  const has = (line: "fighter" | "caster") => Object.values(BRANCH_SKILLS[line]).filter((id) => s.skills.includes(id)).length;
  const fighter = has("fighter");
  const caster = has("caster");
  const int = stat(s, "int");
  const melee = Math.max(stat(s, "str"), stat(s, "dex"));
  const w = weaponOf(s);
  if (w.magic && melee > int + 1) out.push(t("지팡이는 지능({int})으로 싸운다. 힘·민첩({melee})이 더 높으니 숏소드처럼 힘·민첩을 따르는 무기가 낫다.", { int, melee }));
  else if (!w.magic && caster >= 2 && int > melee + 1) out.push(t("지능({int})이 힘·민첩({melee})보다 높다. 대장간의 지팡이({price}G)를 들면 기본 공격도 지능을 따른다.", { int, melee, price: GEAR.staff.price ?? 0 }));
  if (fighter >= 1 && caster >= 1)
    out.push(t("전사형 기술은 무기 공격(힘·민첩)을, 마법사형 주문은 지능을 따른다. 두 갈래를 섞으면 능력치가 나뉘니, 특수 훈련 전에 주력 하나를 정해 두자."));
  return out;
}

/** 처음 안내 카드: 지금 상황에 맞는, 아직 안 본 안내 하나 */
export function TipCard({ ctl }: { ctl: Ctl }) {
  const tip = currentTip(ctl.s, ctl.meta.tipsSeen ?? [], !!ctl.meta.tipsOff);
  if (!tip) return null;
  return (
    <div className="tip-card" role="note">
      <p className="eyebrow">{t("처음 안내")} · {tip.title}</p>
      <p className="small">{tip.text}</p>
      <div className="row">
        <button className="btn small primary" onClick={() => ctl.dismissTip(tip.id)}>
          {t("알겠다")}
        </button>
        <button className="btn small ghost" onClick={() => ctl.setTipsOff(true)}>
          {t("안내 끄기")}
        </button>
      </div>
    </div>
  );
}

/** 용어 사전: 모든 처음 안내를 다시 본다 */
export function Glossary({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={t("용어 사전")} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b className="hero-name">{t("용어 사전")}</b>
          <button className="btn small ghost close" onClick={onClose}>
            {t("닫기")}
          </button>
        </div>
        <div className="sheet-body">
          {[...TIPS].reverse().map((t) => (
            <Card key={t.id} title={t.title}>
              <p className="small">{t.text}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
