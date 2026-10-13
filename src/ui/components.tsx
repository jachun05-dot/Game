import { useEffect, useRef, useState, type ReactNode } from "react";
import { maxHp, heroAc, smod, stat } from "../game/core";
import { FRAGMENTS, TIER_LABEL, fragSlots, fragStat, fragStatText } from "../game/fragments";
import { PIETY_TIERS, godOf, tier } from "../game/faith";
import { MIND_EFFECT, MIND_KEYS, MIND_NAME, known, mindSummary } from "../game/mind";
import { DISEASE_NAME, INJ, LEVEL_NAME, PARTS, PART_NAME, injurySummary, partEffect } from "../game/injury";
import { STAT_KEYS, STAT_LABEL } from "../game/data";
import { GEAR } from "../game/gear";
import { CLASSES } from "../game/classes";
import { SKILLS } from "../game/skills";
import type { AutoGoal, GameState } from "../game/types";
import type { Ctl, Speed } from "./App";
import { CharacterSheet } from "./CharacterSheet";
import { CLASS_ART, FRAG_ICON, MONSTER_ART, SCENE_ART } from "./art";

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
    <div className={`bar bar-${tone}`}>
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
      <div className="screen-body">{children}</div>
      {dock && <div className={`dock ${dockClass ?? ""}${ctl.busy ? " waiting" : ""}`}>{dock}</div>}
      {ctl.sheet && <CharacterSheet ctl={ctl} />}
    </div>
  );
}

export function HeroHeader({ s, extra, onOpen }: { s: GameState; extra?: ReactNode; onOpen?: () => void }) {
  const hp = maxHp(s);
  return (
    <header className={`hero-head${onOpen ? " clickable" : ""}`} onClick={onOpen} role={onOpen ? "button" : undefined} aria-label={onOpen ? "캐릭터와 장비 보기" : undefined}>
      <img className="portrait" src={CLASS_ART[s.hero.cls].face} alt="" />
      <div className="hero-info">
        <div className="hero-name">
          {s.hero.name} <span className="dim">{CLASSES[s.hero.cls].name} Lv.{s.hero.level}</span>
          {s.hero.faith && <span className="faith-tag">{s.hero.faith} {"★".repeat(tier(s))}</span>}
          {s.heretic && <span className="faith-tag heretic">현상수배</span>}
        </div>
        <div className="hp-line">
          <span>HP</span>
          <Bar value={s.hero.hp} max={hp} tone="hp" />
          <span className="num">
            {s.hero.hp}/{hp}
          </span>
        </div>
        <div className="hero-meta">
          <span>{s.gold}G</span>
          <span>AC {heroAc(s)}</span>
          <span>등급 {s.rank}</span>
          {extra}
          {onOpen && <span className="accent">장비 ›</span>}
        </div>
        <InjuryTags s={s} />
      </div>
    </header>
  );
}

export function StatGrid({ s }: { s: GameState }) {
  return (
    <div className="stat-grid">
      {STAT_KEYS.map((k) => (
        <div key={k} className="stat-cell">
          <span className="dim">{STAT_LABEL[k]}</span>
          <b className={fragStat(s, k) > 0 ? "accent" : ""} title={fragStat(s, k) > 0 ? `편린 +${fragStat(s, k)}` : undefined}>
            {stat(s, k)}
          </b>
          <span className="mod">{fmtMod(smod(s, k))}</span>
        </div>
      ))}
    </div>
  );
}

export function GearList({ s }: { s: GameState }) {
  const items = Object.values(s.gear).map((id) => (id ? GEAR[id].name : "")).filter(Boolean);
  return <div className="dim small">장비: {items.join(" · ")}</div>;
}

/** 로그 패널: shown 개수까지만 보여주고, 누르면 남은 줄을 한 번에 보여준다 */
export function LogView({ ctl, max = 80, tall, fill }: { ctl: Ctl; max?: number; tall?: boolean; fill?: boolean }) {
  const { s, shown } = ctl;
  const ref = useRef<HTMLDivElement>(null);
  const start = s.logCount - s.log.length; // log[0]의 전역 번호
  const visible = s.log
    .map((l, i) => ({ ...l, n: start + i }))
    .filter((l) => l.n < shown)
    .slice(-max);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [shown]);
  return (
    <div ref={ref} className={`log${tall ? " tall" : ""}${fill ? " fill" : ""}`} onClick={ctl.revealAll} role="log" aria-live="polite">
      {visible.map((l) => (
        <p key={l.n} className={`log-line ${l.kind}`}>
          {l.mons && <EncounterFigures ids={l.mons} />}
          {l.text}
        </p>
      ))}
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
          {v === 0 ? "즉시" : `${v}×`}
        </button>
      ))}
      <button className={`chip${ctl.auto ? " on" : ""}`} onClick={() => ctl.setAuto(!ctl.auto)} title="중요한 결정도 자동으로 고릅니다">
        자동 결정 {ctl.auto ? "ON" : "OFF"}
      </button>
    </div>
  );
}

export function TopBar({ ctl, title }: { ctl: Ctl; title: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="topbar">
      <button className="link" onClick={ctl.goTitle} aria-label="타이틀로">
        ≡
      </button>
      <span className="topbar-title">{title}</span>
      <button className="gear-btn" onClick={() => ctl.setSheet(true)} aria-label="캐릭터와 장비">
        장비
      </button>
      <button className={`gear-btn${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="설정">
        ⚙ <span className="small">{ctl.speed === 0 ? "즉시" : `${ctl.speed}×`}{ctl.auto ? ` · 자동(${GOAL_SHORT[ctl.s.autoGoal] ?? "탐험"})` : ""}</span>
      </button>
      {open && <div className="settings-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="settings-sheet" role="dialog" aria-label="설정">
          <p className="eyebrow">진행 속도</p>
          <SpeedBar ctl={ctl} />
          <p className="eyebrow">자동 결정 목표</p>
          <GoalBar ctl={ctl} />
          <p className="eyebrow">전투 방침</p>
          <TacticsBar ctl={ctl} />
          <p className="dim small">시드 #{(ctl.s.seed >>> 0).toString(36)}</p>
          <button className="btn small ghost" onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
      )}
    </div>
  );
}

const GOAL_SHORT: Record<string, string> = { explore: "탐험", rush: "돌파", farm: "파밍" };

const GOALS: { id: AutoGoal; name: string; desc: string }[] = [
  { id: "explore", name: "구석구석 탐험", desc: "층의 모든 방을 돌고 기록물도 읽은 뒤 내려간다." },
  { id: "rush", name: "빠르게 다음 층", desc: "계단이 보이면 곧장 내려간다. 기록물은 건너뛰고, HP 절반만 있어도 내려간다. 그래도 준비 안 된 층까지는 가지 않는다." },
  { id: "farm", name: "파밍", desc: "전투방과 보물상자 위주로 털고, 싸우기 전에 HP를 채운다. 무리해서 내려가지 않는다." },
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
            {g.name}
          </button>
        ))}
      </div>
      <p className="dim small">
        {cur.desc}
        {!ctl.auto && " (자동 결정을 켜야 적용된다)"}
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
        물약: {potionAt ? `HP ${potionAt}% 이하` : "안 마심"}
      </button>
      <button className="chip" onClick={() => dispatch({ t: "tactics", tactics: { fleeAt: next(FLEE_STEPS, fleeAt) } })}>
        도주: {fleeAt ? `HP ${fleeAt}% 이하` : "끝까지 싸움"}
      </button>
    </div>
  );
}

export function SkillList({ s, empty }: { s: GameState; empty?: string }) {
  if (s.skills.length === 0) return <p className="dim small">{empty ?? "아직 배운 기술이 없다. 직업교관에게 훈련을 받으면 배운다."}</p>;
  return (
    <ul className="skills">
      {s.skills.map((id) => {
        const sk = SKILLS[id];
        return (
          <li key={id}>
            <span className={`skill-kind ${sk.kind}`}>{sk.kind === "active" ? "자동 발동" : "패시브"}</span>
            <b>{sk.name}</b>
            <span className="dim small">{sk.desc}</span>
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
                <span className="skill-kind">빈 칸</span>
                <span className="dim small">미궁의 몬스터를 쓰러뜨리면 아주 드물게 편린이 남는다.</span>
              </li>
            );
          }
          const f = FRAGMENTS[id];
          const sk = f.skill ? SKILLS[f.skill] : null;
          return (
            <li key={i}>
              <FragIcon tier={f.tier} />
              <span className={`skill-kind tier${f.tier}`}>{TIER_LABEL[f.tier]}</span>
              <b>{f.name}</b>
              <span className="accent small">{fragStatText(id)}</span>
              {sk && (
                <span className="small">
                  【{sk.name}】 <span className="dim">{sk.kind === "active" ? "자동 발동 · " : "패시브 · "}{sk.desc}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="dim small">
        편린 칸 {s.fragments.length}/{slots} · 레벨 {nextAt}에 한 칸 더 생긴다. 편린으로 오른 능력치는 노란색으로 표시된다.
      </p>
    </>
  );
}

/** 섬기는 신·신앙심·권능·저주·현상수배 */
export function FaithCard({ s }: { s: GameState }) {
  const g = godOf(s.hero.faith);
  const t = tier(s);
  return (
    <>
      {s.heretic && <p className="hurt small">현상수배 중 — 마을에 들어갈 수 없다. 미궁에서는 이단심문관이 뒤를 쫓는다. 마을의 성당에 자수하면 신앙을 버리고 돌아갈 수 있다.</p>}
      {!g ? (
        <p className="dim small">섬기는 신이 없다. 해금된 옛 신은 새 삶을 시작할 때나 미궁의 성소에서 섬길 수 있다.</p>
      ) : (
        <>
          <p className="small">
            <b>{g.name}</b> <span className="dim">· {g.align}</span> <span className="accent">{"★".repeat(t)}{"☆".repeat(3 - t)}</span>
          </p>
          <div className="faith-line">
            <span className="small dim">신앙심</span>
            <Bar value={s.piety} max={100} tone="food" />
            <span className="num small">{Math.floor(s.piety)}</span>
          </div>
          <ul className="skills">
            {g.powers.map((p, i) => (
              <li key={i} className={t > i ? "" : "empty"}>
                <span className={`skill-kind${t > i ? " active" : ""}`}>★{i + 1} · {PIETY_TIERS[i]}</span>
                <span className={`small${t > i ? "" : " dim"}`}>{p}</span>
              </li>
            ))}
          </ul>
          <p className="dim small">
            좋아함: {g.likes} · 싫어함: {g.dislikes}. 신앙심은 매달 5씩 줄고, ★이 높을수록 성당의 이단 심문에 걸리기 쉽다(★당 5%).
          </p>
        </>
      )}
      {s.curse && s.curse.months > 0 && (
        <p className="hurt small">
          {s.curse.god}의 저주: {godOf(s.curse.god)?.curse} (남은 {s.curse.months}개월)
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
              <span className="slot">{PART_NAME[p]}</span>
              <span className="item">
                {LEVEL_NAME[raw]}
                {raw >= 3 && s.prosthetic[p] ? (p === "feet" ? " · 의족" : " · 의수") : ""}
              </span>
              <span className="effect">{eff}</span>
            </li>
          );
        })}
        <li className={s.disease ? "hurt-row" : "empty"}>
          <span className="slot">질병</span>
          <span className="item">{s.disease ? DISEASE_NAME[s.disease] : "없음"}</span>
          <span className="effect">{s.disease === 2 ? "방을 옮길 때마다 HP −2, 판정 −2" : s.disease === 1 ? "방을 옮길 때마다 HP −1" : ""}</span>
        </li>
      </ul>
      <p className="eyebrow">정신</p>
      {MIND_KEYS.some((k) => known(s, k)) ? (
        <ul className="skills">
          {MIND_KEYS.filter((k) => known(s, k)).map((k) => (
            <li key={k}>
              <span className="skill-kind mind">{MIND_NAME[k]}</span>
              <span className="small dim">{MIND_EFFECT[k]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim small">알아챈 이상은 없다.</p>
      )}
      <p className="dim small">
        정신 상태이상은 걸려도 바로 알 수 없다 — 방을 옮길 때마다 감각·지능으로 눈치채야 보인다. 둘이 겹치면 발작·패닉·무너짐이 터진다. 여관에서 쉬거나 성소에서 기도하면 가라앉고, 미궁을 나오면 저절로 가라앉기도 한다.
      </p>
      <p className="dim small">
        경상은 미궁에서 나오면 체력 판정으로 저절로 낫는다. 중상·질병은 붕대·탕약·여관이 필요하다. 손·발 결손은 신전 재생 의식({INJ.regenCost}G)이나 대장간 의수·의족({INJ.prostheticCost}G). 머리·몸통 결손은 즉사.
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
      {minds.map((t) => <span key={t} className="injury-tag mind">{t}</span>)}
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
export function SceneBanner({ id }: { id: string }) {
  const a = SCENE_ART[id];
  if (!a) return null;
  return (
    <div
      className="scene"
      aria-hidden="true"
      style={{ height: a.h * 2, backgroundImage: `url(${a.src})`, backgroundSize: `${a.w * 2}px ${a.h * 2}px`, backgroundPosition: `${(a.focus ?? 0.5) * 100}% 0` }}
    />
  );
}
