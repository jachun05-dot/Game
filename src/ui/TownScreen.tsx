import { useState } from "react";
import { BAL, STAT_KEYS, STAT_LABEL, TRAININGS } from "../game/data";
import { GEAR, SLOTS, gearEffect, targetSlot } from "../game/gear";
import { CLASSES } from "../game/classes";
import { canTrain, needsHeart, nextSkill, shopPrice, trainCost } from "../game/town";
import type { GameState } from "../game/types";
import { SKILLS } from "../game/skills";
import { FRAGMENTS, fragStatText } from "../game/fragments";
import { taxDue, yearOf } from "../game/core";
import type { StatKey } from "../game/types";
import type { Ctl } from "./App";
import { josa } from "../game/josa";
import { INJ, LIMBS, PART_NAME, anyInjury } from "../game/injury";
import { Card, GameScreen, GearList, HeroHeader, LogView, FaithCard, InjuryCard, FragList, SceneBanner, SkillList, StatGrid, TacticsBar } from "./components";

const ITEM_INFO = {
  food: { name: "말린 고기", desc: "포만감 +40" },
  potion: { name: "치료 물약", desc: `HP 2d4+${BAL.potionBase} 회복` },
  scroll: { name: "귀환 주문서", desc: "언제든 미궁에서 귀환" },
  bandage: { name: "붕대", desc: "가장 심한 부상 하나를 한 단계 낫게 한다(결손 제외)" },
  herb: { name: "약초 탕약", desc: "쥐 열병을 한 단계 낫게 한다" },
} as const;

export function TownScreen({ ctl, onGraveyard }: { ctl: Ctl; onGraveyard: () => void }) {
  const { s, dispatch, busy } = ctl;
  const [training, setTraining] = useState(false);
  const [tab, setTab] = useState<"act" | "shop" | "me">("act");
  const [erase, setErase] = useState<number | null>(null);

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
          상점가 · 대장간 · 신전
        </button>
        <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}>
          모험가
        </button>
      </div>

      {tab === "act" && s.heretic && (
        <div className="stack">
          <Card title="현상수배 중" className="warn">
            <p className="small">성당 문에 당신의 얼굴이 그려진 수배서가 붙어 있다. 마을 안으로는 들어갈 수 없다 — 영지 외곽만 다닐 수 있다.</p>
            <p className="dim small">숲의 마석은 밀수꾼에게 반값에 넘기고, 사냥한 짐승으로 말린 고기를 만든다. 세금은 걷히지 않는다. 미궁에서는 이단심문관이 뒤를 쫓는다.</p>
          </Card>
          <ActivityButton title="외부 탐험" sub="영지 밖 숲 · 작은 전투, 마석(반값)과 말린 고기" disabled={busy} onClick={() => dispatch({ t: "activity", a: "field" })} />
          <ActivityButton title="성당에 자수한다" sub={`${josa(s.hero.faith ?? "옛 신", "을")} 부정하고 마을로 돌아간다 (신앙을 잃는다, 시간은 들지 않는다)`} disabled={busy} onClick={() => dispatch({ t: "surrender" })} />
        </div>
      )}

      {tab === "act" && !training && !s.heretic && (
        <div className="stack">
          <p className="dim small">한 주에 한 가지 일을 합니다. 쇼핑은 시간이 들지 않습니다.{s.week === 3 && " 다음 주는 미궁이 열립니다 — 준비물을 챙기세요."}</p>
          <ActivityButton title="훈련" sub={trainSub(s)} disabled={busy || !canTrain(s)} onClick={() => setTraining(true)} />
          <ActivityButton title="탐문" sub="술집 · 소문을 듣고 잔일을 구한다" disabled={busy} onClick={() => dispatch({ t: "activity", a: "rumor" })} />
          <ActivityButton title="외부 탐험" sub="영지 밖 숲 · 작은 전투, 마석 획득 (위험)" disabled={busy} onClick={() => dispatch({ t: "activity", a: "field" })} />
          <ActivityButton
            title="여관에서 쉬기"
            sub={`${INJ.innCost}G · 모든 부상·질병이 한 단계 낫는다 (결손 제외)${anyInjury(s) ? "" : " — 지금은 다친 데가 없다"}`}
            disabled={busy || s.gold < INJ.innCost}
            onClick={() => dispatch({ t: "activity", a: "inn" })}
          />
          <p className="dim small">{yearOf(s.month)}년차 · 다음 달 세금: {taxDue(s.month + 1)}G (미납 시 처형 · 해가 바뀔 때마다 {BAL.taxPerYear}G씩 오른다)</p>
          <div className="row">
            <button className="btn ghost small" onClick={onGraveyard}>
              묘지 들르기
            </button>
            <button className="btn ghost small" onClick={ctl.openCodex}>
              몬스터 도감
            </button>
          </div>
        </div>
      )}

      {tab === "act" && training && <TrainingPanel ctl={ctl} onClose={() => setTraining(false)} />}

      {tab === "shop" && s.heretic && <p className="hurt small">현상수배 중이라 상점가·대장간·신전에 들어갈 수 없다.</p>}

      {tab === "shop" && !s.heretic && (
        <div className="stack">
          <Card title="상점가">
            <SceneBanner id="market" />
            {(Object.keys(ITEM_INFO) as (keyof typeof ITEM_INFO)[]).map((k) => (
              <div key={k} className="shop-row">
                <div>
                  <b>{ITEM_INFO[k].name}</b> <span className="dim small">{ITEM_INFO[k].desc}</span>
                  <div className="dim small">보유 {s.inventory[k]}개</div>
                </div>
                <button className="btn small" disabled={s.gold < shopPrice(s, k)} onClick={() => dispatch({ t: "buy", item: k })}>
                  {shopPrice(s, k)}G
                </button>
              </div>
            ))}
          </Card>
          <Card title="대장간">
            <SceneBanner id="smithy" />
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
            {LIMBS.filter((p) => s.injuries[p] >= 3 && !s.prosthetic[p]).map((p) => (
              <div key={p} className="shop-row">
                <div>
                  <b>{p === "feet" ? "의족" : `의수 (${PART_NAME[p]})`}</b>
                  <div className="dim small">잃은 {PART_NAME[p]}을 대신한다 — 중상 정도로는 쓸 수 있다</div>
                </div>
                <button className="btn small" disabled={busy || s.gold < INJ.prostheticCost} onClick={() => dispatch({ t: "prosthetic", part: p })}>
                  {INJ.prostheticCost}G
                </button>
              </div>
            ))}
          </Card>
          <Card title="신전">
            <SceneBanner id="temple" />
            {LIMBS.filter((p) => s.injuries[p] >= 3).map((p) => (
              <div key={p} className="shop-row">
                <div>
                  <b>재생 의식 — {PART_NAME[p]}</b>
                  <div className="dim small">잃은 {PART_NAME[p]}을 완전히 되살린다</div>
                </div>
                <button className="btn small" disabled={busy || s.gold < INJ.regenCost} onClick={() => dispatch({ t: "regen", part: p })}>
                  {INJ.regenCost}G
                </button>
              </div>
            ))}
            <p className="dim small">사제에게 큰돈을 바치면 몸에 새긴 편린 하나를 지워 준다. 지운 편린은 돌아오지 않는다.</p>
            {s.fragments.length === 0 && <p className="dim small">지울 편린이 없다.</p>}
            {s.fragments.map((id, i) => (
              <div key={i} className="shop-row">
                <div>
                  <b>{FRAGMENTS[id].name}</b>
                  <div className="accent small">{fragStatText(id)}</div>
                </div>
                {/* 미리보기 등에서 confirm 창이 막힐 수 있어 버튼을 두 번 누르게 한다 */}
                <button
                  className={`btn small${erase === i ? " danger" : ""}`}
                  disabled={busy || s.gold < BAL.fragEraseCost}
                  onClick={() => {
                    if (erase === i) {
                      dispatch({ t: "eraseFrag", index: i });
                      setErase(null);
                    } else setErase(i);
                  }}
                >
                  {erase === i ? "정말 지운다" : `지우기 ${BAL.fragEraseCost}G`}
                </button>
              </div>
            ))}
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
          <Card title="부상 · 질병">
            <InjuryCard s={s} />
          </Card>
          <Card title="신앙">
            <FaithCard s={s} />
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
  if (s.month < BAL.firstTrainMonth) return "첫 달에는 훈련을 받을 수 없다 — 미궁에서 살아 돌아오면 교관이 받아 준다";
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
      <SceneBanner id="training" />
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
