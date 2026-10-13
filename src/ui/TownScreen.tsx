import { useState } from "react";
import { BAL, STAT_KEYS, STAT_LABEL, TRAININGS } from "../game/data";
import { GEAR, SLOTS, gearEffect, targetSlot } from "../game/gear";
import { CLASSES } from "../game/classes";
import { canTrain, needsHeart, nextSkill, trainCost } from "../game/town";
import type { GameState } from "../game/types";
import { SKILLS } from "../game/skills";
import { taxDue, yearOf } from "../game/core";
import type { StatKey } from "../game/types";
import type { Ctl } from "./App";
import { Card, GameScreen, GearList, HeroHeader, LogView, FragList, SkillList, StatGrid, TacticsBar } from "./components";

const ITEM_INFO = {
  food: { name: "말린 고기", desc: "포만감 +40" },
  potion: { name: "치료 물약", desc: "HP 2d4+2 회복" },
  scroll: { name: "귀환 주문서", desc: "언제든 미궁에서 귀환" },
} as const;

export function TownScreen({ ctl, onGraveyard }: { ctl: Ctl; onGraveyard: () => void }) {
  const { s, dispatch, busy } = ctl;
  const [training, setTraining] = useState(false);
  const [tab, setTab] = useState<"act" | "shop" | "me">("act");

  return (
    <GameScreen
      ctl={ctl}
      title={`${s.month}월 ${s.week}주차 · 영지`}
      header={
        <>
          <HeroHeader s={s} onOpen={() => ctl.setSheet(true)} />
          <WeekTrack month={s.month} week={s.week} />
        </>
      }
      dock={<LogView ctl={ctl} max={20} fill />}
      dockClass="dock-log"
    >
      <div className="tabs">
        <button className={tab === "act" ? "on" : ""} onClick={() => setTab("act")}>
          이번 주 할 일
        </button>
        <button className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}>
          상점가 · 대장간
        </button>
        <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}>
          모험가
        </button>
      </div>

      {tab === "act" && !training && (
        <div className="stack">
          <p className="dim small">한 주에 한 가지 일을 합니다. 쇼핑은 시간이 들지 않습니다.{s.week === 3 && " 다음 주는 미궁이 열립니다 — 준비물을 챙기세요."}</p>
          <ActivityButton title="훈련" sub={trainSub(s)} disabled={busy || !canTrain(s)} onClick={() => setTraining(true)} />
          <ActivityButton title="탐문" sub="술집 · 소문을 듣고 잔일을 구한다" disabled={busy} onClick={() => dispatch({ t: "activity", a: "rumor" })} />
          <ActivityButton title="외부 탐험" sub="영지 밖 숲 · 작은 전투, 마석 획득 (위험)" disabled={busy} onClick={() => dispatch({ t: "activity", a: "field" })} />
          <p className="dim small">{yearOf(s.month)}년차 · 다음 달 세금: {taxDue(s.month + 1)}G (미납 시 처형 · 해가 바뀔 때마다 {BAL.taxPerYear}G씩 오른다)</p>
          <button className="btn ghost small" onClick={onGraveyard}>
            묘지 들르기
          </button>
        </div>
      )}

      {tab === "act" && training && <TrainingPanel ctl={ctl} onClose={() => setTraining(false)} />}

      {tab === "shop" && (
        <div className="stack">
          <Card title="상점가">
            {(Object.keys(ITEM_INFO) as (keyof typeof ITEM_INFO)[]).map((k) => (
              <div key={k} className="shop-row">
                <div>
                  <b>{ITEM_INFO[k].name}</b> <span className="dim small">{ITEM_INFO[k].desc}</span>
                  <div className="dim small">보유 {s.inventory[k]}개</div>
                </div>
                <button className="btn small" disabled={s.gold < BAL.prices[k]} onClick={() => dispatch({ t: "buy", item: k })}>
                  {BAL.prices[k]}G
                </button>
              </div>
            ))}
          </Card>
          <Card title="대장간">
            <p className="dim small">장비는 강해지는 수단이 아니라 살아남기 위한 최소한이다.</p>
            {Object.values(GEAR)
              .filter((g) => g.price !== undefined)
              .map((g) => {
                const owned = Object.values(s.gear).includes(g.id);
                const slot = targetSlot(s, g.id);
                const cur = s.gear[slot];
                return (
                  <div key={g.id} className="shop-row">
                    <div>
                      <b>{g.name}</b> <span className="dim small">{SLOTS.find((x) => x.key === slot)!.name}</span>
                      <div className="accent small">{gearEffect(g.id)}</div>
                      {!owned && cur && <div className="dim small">지금: {GEAR[cur].name} (교체하면 넘긴다)</div>}
                    </div>
                    <button className="btn small" disabled={owned || s.gold < g.price!} onClick={() => dispatch({ t: "buyGear", id: g.id })}>
                      {owned ? "착용 중" : `${g.price}G`}
                    </button>
                  </div>
                );
              })}
            <p className="dim small">반지·목걸이와 좋은 장비는 미궁 보물상자에서만 나온다.</p>
          </Card>
        </div>
      )}

      {tab === "me" && (
        <div className="stack">
          <button className="btn primary wide" onClick={() => ctl.setSheet(true)}>
            장비 · 전투 수치 자세히 보기
          </button>
          <Card title="모험가 상태">
            <StatGrid s={s} />
            <GearList s={s} />
            <p className="dim small">
              소지품: 말린 고기 {s.inventory.food} · 물약 {s.inventory.potion} · 귀환 주문서 {s.inventory.scroll} · 읽은 기록물 {s.recordsRead}
            </p>
          </Card>
          <Card title="기술">
            <SkillList s={s} />
          </Card>
          <Card title="편린">
            <FragList s={s} />
          </Card>
          <Card title="전투는 자동으로 진행됩니다">
            <p className="dim small">가장 약한 적부터 노리고, 기술은 조건이 맞으면 저절로 발동합니다. 정할 수 있는 건 물약과 도주 시점뿐입니다.</p>
            <TacticsBar ctl={ctl} />
          </Card>
        </div>
      )}

    </GameScreen>
  );
}

function trainSub(s: GameState): string {
  if (s.hero.level >= BAL.maxLevel) return "최대 레벨";
  const base = `직업교관 · ${trainCost(s)}G · 레벨 ${s.hero.level} → ${s.hero.level + 1}`;
  if (needsHeart(s)) {
    if (s.inventory.heart <= 0) return `${BAL.heartName}이 필요하다 — 1섹터 3층 보스가 지니고 있다`;
    if (s.gold < trainCost(s)) return `돈이 모자라다 (${trainCost(s)}G + ${BAL.heartName})`;
    return `${base} + ${BAL.heartName}`;
  }
  return canTrain(s) ? base : `돈이 모자라다 (${trainCost(s)}G)`;
}

function WeekTrack({ month, week }: { month: number; week: number }) {
  return (
    <div className="week-track">
      {[1, 2, 3, 4].map((w) => (
        <div key={w} className={`wk${w === week ? " now" : ""}${w < week ? " done" : ""}${w === 4 ? " dungeon" : ""}`}>
          {w === 4 ? "미궁" : `${w}주`}
        </div>
      ))}
      <span className="dim small">{month}월</span>
    </div>
  );
}

function ActivityButton({ title, sub, disabled, onClick }: { title: string; sub: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="activity" disabled={disabled} onClick={onClick}>
      <b>{title}</b>
      <span className="dim small">{sub}</span>
      <span className="arrow">→</span>
    </button>
  );
}

function TrainingPanel({ ctl, onClose }: { ctl: Ctl; onClose: () => void }) {
  const { s, dispatch } = ctl;
  const allowed = TRAININGS.filter((x) => CLASSES[s.hero.cls].trainings.includes(x.id));
  const [tid, setTid] = useState(allowed[0].id);
  const [free, setFree] = useState<StatKey[]>([]);
  const t = TRAININGS.find((x) => x.id === tid)!;

  const toggle = (k: StatKey) => {
    setFree((f) => (f.length < 2 ? [...f, k] : [f[1], k]));
  };

  return (
    <Card title={`훈련 — ${trainCost(s)}G`}>
      <p className="dim small">훈련마다 6포인트: 훈련 종류로 정해지는 2 + 자유 2 + 지난 행동으로 정해지는 2.</p>
      <div className="stack tight">
        {allowed.map((x) => {
          const sk = nextSkill(s, x.id);
          return (
            <button key={x.id} className={`option${tid === x.id ? " on" : ""}`} onClick={() => setTid(x.id)}>
              <b>{x.name}</b> <span className="dim small">{x.desc}</span>
              <span className="small accent">
                {" "}
                {x.stats.map((k) => STAT_LABEL[k]).join(" · ")} +1
              </span>
              <span className="option-skill small">
                {sk ? (
                  <>
                    배울 기술: <b>{SKILLS[sk].name}</b> <span className="dim">({SKILLS[sk].kind === "active" ? "자동 발동" : "패시브"}) {SKILLS[sk].desc}</span>
                  </>
                ) : (
                  <span className="dim">이 훈련의 기술은 모두 배웠다</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="eyebrow">자유 배분 2포인트 (같은 능력치에 두 번도 가능)</p>
      <div className="chips">
        {STAT_KEYS.map((k) => {
          const n = free.filter((f) => f === k).length;
          return (
            <button key={k} className={`chip${n ? " on" : ""}`} onClick={() => toggle(k)}>
              {STAT_LABEL[k]} {s.hero.stats[k]}
              {n ? ` +${n}` : ""}
            </button>
          );
        })}
        {free.length > 0 && (
          <button className="chip" onClick={() => setFree([])}>
            초기화
          </button>
        )}
      </div>
      <div className="row">
        <button className="btn ghost small" onClick={onClose}>
          취소
        </button>
        <button
          className="btn primary small"
          disabled={free.length < 2}
          onClick={() => {
            dispatch({ t: "train", training: t.id, free: [free[0], free[1]] });
            onClose();
          }}
        >
          {t.name} 받기
        </button>
      </div>
    </Card>
  );
}
