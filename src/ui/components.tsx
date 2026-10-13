import { useEffect, useRef, useState, type ReactNode } from "react";
import { maxHp, heroAc, mod } from "../game/core";
import { GEAR, STAT_KEYS, STAT_LABEL } from "../game/data";
import { SKILLS } from "../game/skills";
import type { GameState } from "../game/types";
import type { Ctl, Speed } from "./App";

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
    </div>
  );
}

export function HeroHeader({ s, extra }: { s: GameState; extra?: ReactNode }) {
  const hp = maxHp(s);
  return (
    <header className="hero-head">
      <img className="portrait" src="./hero-face.png" alt="" />
      <div className="hero-info">
        <div className="hero-name">
          {s.hero.name} <span className="dim">Lv.{s.hero.level}</span>
          {s.hero.faith && <span className="faith-tag">{s.hero.faith}</span>}
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
        </div>
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
          <b>{s.hero.stats[k]}</b>
          <span className="mod">{fmtMod(mod(s.hero.stats[k]))}</span>
        </div>
      ))}
    </div>
  );
}

export function GearList({ s }: { s: GameState }) {
  const items = ["숏소드(1d6)", ...Object.values(s.gear).map((id) => (id ? GEAR[id].name : ""))].filter(Boolean);
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
          {l.text}
        </p>
      ))}
      {ctl.busy && <p className="log-line dim blink">▼</p>}
    </div>
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
      <button className={`gear-btn${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="설정">
        ⚙ <span className="small">{ctl.speed === 0 ? "즉시" : `${ctl.speed}×`}{ctl.auto ? " · 자동" : ""}</span>
      </button>
      {open && (
        <div className="settings-sheet" role="dialog" aria-label="설정">
          <p className="eyebrow">진행 속도</p>
          <SpeedBar ctl={ctl} />
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
