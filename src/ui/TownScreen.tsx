import { useEffect, useMemo, useState } from "react";
import { DUMMY_ROUNDS, DUMMY_SCENARIOS, dummyAfterTraining, dummyTest, type DummyReport, type DummyScenario } from "../game/dummy";
import { BAL, STAT_KEYS, STAT_LABEL, TRAININGS } from "../game/data";
import { CORRODE_NAME, GEAR, SLOTS, corrosionOf, gearEffect, hasShield, targetSlot } from "../game/gear";
import { corrodedSlots, corrosionEffect, repairCost } from "../game/hazards";
import { CLASSES } from "../game/classes";
import { hasLevelTable } from "../game/elements";
import { LAST_SECTOR } from "../game/endless";
import { canShortcut } from "../game/dungeon";
import { BLACK_MARKET_MULT, canTrain, innCost, outlawTrainerHere, gateOf, nextSkill, shopPrice, trainCost } from "../game/town";
import type { GameState } from "../game/types";
import { SKILLS } from "../game/skills";
import { FRAGMENTS, fragStatText } from "../game/fragments";
import { maxHp, taxDue, yearOf } from "../game/core";
import type { StatKey } from "../game/types";
import type { Ctl } from "./App";
import { josa } from "../game/josa";
import { INJ, LIMBS, PART_NAME, anyInjury } from "../game/injury";
import { Card, GameScreen, GearIcon, GearList, HeroHeader, LevelTable, LogView, FaithCard, InjuryCard, FragList, SPECIAL_LEVELS, SceneBanner, buildAdvice, SkillList, StatGrid, TacticsBar } from "./components";

const ITEM_INFO = {
  food: { name: "말린 고기", desc: "포만감 +40" },
  potion: { name: "치료 물약", desc: `HP 2d4+${BAL.potionBase} 회복` },
  scroll: { name: "귀환 주문서", desc: "언제든 미궁에서 귀환" },
  bandage: { name: "붕대", desc: "가장 심한 부상 하나를 한 단계 낫게 한다(결손 제외)" },
  herb: { name: "약초 탕약", desc: "질병(쥐 열병·곰팡이 폐병)을 한 단계 낫게 한다" },
  antidote: { name: "해독초", desc: "독 한 단계 + 가장 심한 마비 한 단계 (3섹터)" },
  whetstone: { name: "숫돌", desc: "가장 심하게 삭은 장비를 한 단계 손본다 (3섹터)" },
  salve: { name: "화상 연고", desc: "화상 입은 부위 하나를 한 단계 (4섹터)" },
  firewood: { name: "장작", desc: "야영할 때 불을 피워 냉기 0 + 동상 한 단계 (4섹터)" },
} as const;

/** 3섹터 소모품은 2섹터를 클리어했거나 가지고 있을 때만 보여 준다 */
function shopItems(s: GameState): (keyof typeof ITEM_INFO)[] {
  const need: Partial<Record<keyof typeof ITEM_INFO, number>> = { antidote: 2, whetstone: 2, salve: 3, firewood: 3 };
  return (Object.keys(ITEM_INFO) as (keyof typeof ITEM_INFO)[]).filter((k) => s.rank >= (need[k] ?? 0) || s.inventory[k] > 0);
}

export function TownScreen({ ctl, onGraveyard }: { ctl: Ctl; onGraveyard: () => void }) {
  const { s, dispatch, busy } = ctl;
  const [training, setTraining] = useState(false);
  const [dummy, setDummy] = useState(false);
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
          {s.heretic ? "암시장" : "상점가 · 대장간 · 신전"}
        </button>
        <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}>
          모험가
        </button>
      </div>

      {tab === "act" && s.week >= 4 && <DungeonPrep s={s} busy={busy} onShop={() => setTab("shop")} onEnter={(shortcut) => dispatch({ t: "enterDungeon", shortcut })} />}

      {tab === "act" && s.week < 4 && s.heretic && !training && (
        <div className="stack">
          <Card title="현상수배 중" className="warn">
            <p className="small">성당 문에 당신의 얼굴이 그려진 수배서가 붙어 있다. 마을 안으로는 들어갈 수 없다 — 영지 외곽만 다닐 수 있다.</p>
            <p className="dim small">숲의 마석은 밀수꾼에게 반값에 넘기고, 사냥한 짐승으로 말린 고기를 만든다. 고기·물약은 외곽의 암시장에서 {BLACK_MARKET_MULT}배 값에 살 수 있다(암시장 탭). 세금은 걷히지 않는다. 미궁에서는 이단심문관이 뒤를 쫓는다.</p>
          </Card>
          {outlawTrainerHere(s) && (
            <ActivityButton title="떠돌이 교관에게 훈련" sub={`이번 주만 · ${trainSub(s)}`} disabled={busy || !canTrain(s)} onClick={() => setTraining(true)} />
          )}
          <ActivityButton
            title="외부 탐험"
            sub={`영지 밖 숲 · 작은 전투, 마석(반값)과 말린 고기${s.outlawTrainer?.week === `${s.month}-${s.week}` ? "" : ` · 외곽에서 떠돌이 교관을 찾아본다(${Math.round((s.outlawTrainerKnown ? BAL.outlawTrainerChanceKnown : BAL.outlawTrainerChance) * 100)}%, 받을 훈련이 남아 있을 때)`}`}
            disabled={busy}
            onClick={() => dispatch({ t: "activity", a: "field" })}
          />
          <ActivityButton title="성당에 자수한다" sub={`${josa(s.hero.faith ?? "옛 신", "을")} 부정하고 마을로 돌아간다 (신앙을 잃는다, 시간은 들지 않는다)`} disabled={busy} onClick={() => dispatch({ t: "surrender" })} />
        </div>
      )}

      {tab === "act" && s.week < 4 && !training && !dummy && !s.heretic && (
        <div className="stack">
          <p className="dim small">한 주에 한 가지 일을 합니다. 쇼핑은 시간이 들지 않습니다.{s.week === 3 && " 다음 주는 미궁이 열립니다 — 준비물을 챙기세요."}</p>
          <ActivityButton title="훈련" sub={trainSub(s)} disabled={busy || !canTrain(s)} onClick={() => setTraining(true)} />
          <ActivityButton title="탐문" sub="술집 · 소문을 듣고 잔일을 구한다" disabled={busy} onClick={() => dispatch({ t: "activity", a: "rumor" })} />
          <ActivityButton title="외부 탐험" sub="영지 밖 숲 · 작은 전투, 마석 획득 (위험)" disabled={busy} onClick={() => dispatch({ t: "activity", a: "field" })} />
          <ActivityButton
            title="여관에서 쉬기"
            sub={`${innCost(s)}G · HP를 모두 회복하고 모든 부상·질병이 한 단계 낫는다 (결손 제외)${anyInjury(s) ? "" : " — 지금은 다친 데가 없다"}`}
            disabled={busy || s.gold < innCost(s)}
            onClick={() => dispatch({ t: "activity", a: "inn" })}
          />
          <ActivityButton title="훈련소 허수아비" sub={`시간이 들지 않는다 · ${DUMMY_ROUNDS}라운드 동안 준 피해를 잰다`} disabled={busy} onClick={() => setDummy(true)} />
          <p className="dim small">{yearOf(s.month)}년차 · 다음 달 세금: {taxDue(s.month + 1, s.rank)}G (미납 시 처형 · 해가 바뀔 때마다 {BAL.taxPerYear}G, 섹터를 클리어해 이름이 알려지면 더 오른다) · 상점가 물가 ×{(s.priceIndex ?? 1).toFixed(2)}</p>
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

      {tab === "act" && s.week < 4 && training && <TrainingPanel ctl={ctl} onClose={() => setTraining(false)} />}
      {tab === "act" && s.week < 4 && dummy && !s.heretic && <DummyPanel s={s} onClose={() => setDummy(false)} />}

      {tab === "shop" && s.heretic && (
        <div className="stack">
          <Card title="암시장">
            <p className="dim small">현상수배 중이라 상점가·대장간·신전에는 들어갈 수 없다. 영지 외곽의 밀수꾼이 같은 물건을 {BLACK_MARKET_MULT}배 값에 넘겨준다.</p>
            {shopItems(s).map((k) => (
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
          {s.week >= 4 && (
            <button className="btn primary wide" disabled={busy} onClick={() => dispatch({ t: "enterDungeon" })}>
              준비 끝 — 미궁으로 들어간다 →
            </button>
          )}
        </div>
      )}

      {tab === "shop" && !s.heretic && (
        <div className="stack">
          <Card title="상점가">
            <SceneBanner id="market" />
            {shopItems(s).map((k) => (
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
                    <GearIcon id={g.id} />
                    <div className="grow">
                      <b>{g.name}</b> <span className="dim small">{SLOTS.find((x) => x.key === slot)!.name}</span>
                      <div className="accent small">{gearEffect(g.id)}</div>
                      {!owned && cur && <div className="dim small">지금: {GEAR[cur].name} (교체하면 넘긴다)</div>}
                    </div>
                    <button className="btn small" disabled={owned || s.gold < g.price! || (g.rank ?? 0) > s.rank} onClick={() => dispatch({ t: "buyGear", id: g.id })}>
                      {owned ? "착용 중" : (g.rank ?? 0) > s.rank ? `등급 ${g.rank} 필요` : `${g.price}G`}
                    </button>
                  </div>
                );
              })}
            <p className="dim small">반지·목걸이와 좋은 장비는 미궁 보물상자에서만 나온다.</p>
            {corrodedSlots(s).map((k) => (
              <div key={k} className="shop-row">
                <div>
                  <b>수리 — {GEAR[s.gear[k]!].name}</b>
                  <div className="dim small">{CORRODE_NAME[corrosionOf(s, k)]} · {corrosionEffect(k, corrosionOf(s, k))} → 새것처럼</div>
                </div>
                <button className="btn small" disabled={busy || s.gold < repairCost(s, k)} onClick={() => dispatch({ t: "repair", slot: k })}>
                  {repairCost(s, k)}G
                </button>
              </div>
            ))}
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
          {s.week >= 4 && (
            <button className="btn primary wide" disabled={busy} onClick={() => dispatch({ t: "enterDungeon" })}>
              준비 끝 — 미궁으로 들어간다 →
            </button>
          )}
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
  const gate = gateOf(s);
  if (gate) {
    if (s.inventory[gate.item] <= 0) return gate.sector > LAST_SECTOR ? `${josa(gate.name, "이")} 필요하다 — ${gate.sector}섹터 보스가 지니고 있다(아직 열리지 않은 섹터 — 지금은 레벨 ${s.hero.level}이 끝이다)` : `${josa(gate.name, "이")} 필요하다 — ${gate.sector}섹터 3층 보스가 지니고 있다(처음 쓰러뜨릴 때 한 번만 나온다)`;
    if (s.gold < trainCost(s)) return `돈이 모자라다 (${trainCost(s)}G + ${gate.name})`;
    return `${base} + ${gate.name}`;
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

/** 4주차: 미궁에 들어가기 전에 상점에 들를 기회 */
function DungeonPrep({ s, busy, onShop, onEnter }: { s: GameState; busy: boolean; onShop: () => void; onEnter: (shortcut: boolean) => void }) {
  const inv = s.inventory;
  return (
    <div className="stack">
      <Card title="4주차 — 미궁이 열렸다">
        <p className="small">들어가면 7일 동안 나올 수 없다(귀환 주문서 제외). {s.heretic ? `현상수배 중이라 상점가 대신 외곽의 암시장(${BLACK_MARKET_MULT}배 값)에 들를 수 있다.` : "모자란 것이 있으면 상점가·대장간에 먼저 들르자. 쇼핑은 시간이 들지 않는다."}</p>
        <p className="small">
          챙긴 것: 말린 고기 <b>{inv.food}</b> · 치료 물약 <b>{inv.potion}</b> · 귀환 주문서 <b>{inv.scroll}</b>
          {inv.bandage > 0 && <> · 붕대 <b>{inv.bandage}</b></>}
          {inv.herb > 0 && <> · 약초 탕약 <b>{inv.herb}</b></>}
          {inv.antidote > 0 && <> · 해독초 <b>{inv.antidote}</b></>}
          {inv.whetstone > 0 && <> · 숫돌 <b>{inv.whetstone}</b></>}
          {inv.salve > 0 && <> · 화상 연고 <b>{inv.salve}</b></>}
          {inv.firewood > 0 && <> · 장작 <b>{inv.firewood}</b></>}
          {inv.powder > 0 && <> · 화약통 <b>{inv.powder}</b></>} · 소지금 <b>{s.gold}G</b>
        </p>
        {inv.food < 3 && <p className="small warn">말린 고기가 적다 — 일주일을 버티기 어렵다.</p>}
        {s.hero.hp < maxHp(s) && <p className="small warn">HP {s.hero.hp}/{maxHp(s)} — 다 차지 않은 채 들어간다. (여관은 1~3주에만 쓸 수 있다. 물약을 넉넉히 챙기자)</p>}
      </Card>
      <button className="btn" disabled={busy} onClick={onShop}>
        {s.heretic ? "암시장 들르기" : "상점가 · 대장간 들르기"}
      </button>
      <button className="btn primary wide" disabled={busy} onClick={() => onEnter(false)}>
        미궁으로 들어간다 →
      </button>
      {canShortcut(s) && (
        <button className="btn wide" disabled={busy} onClick={() => onEnter(true)}>
          숏컷 — 곧장 4섹터로 <span className="dim small">· 1~3섹터를 건너뛴다 (남은 시간 {Math.round(BAL.shortcutTurns / 2)}시간)</span>
        </button>
      )}
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

/** 훈련소 허수아비: 지금 상태로 10라운드 동안 준 피해(복사본에서 200번 평균) */
function DummyPanel({ s, onClose }: { s: GameState; onClose: () => void }) {
  const [scen, setScen] = useState<DummyScenario>("single");
  const r = useMemo(() => dummyTest(s, scen), [s, scen]);
  return (
    <Card title="훈련소 허수아비">
      <p className="dim small">허수아비를 {DUMMY_ROUNDS}라운드 동안 친다. 쓰러지면 바로 다시 일어서지만, 전투마다 쓸 수 있는 횟수가 정해진 기술은 다시 채워지지 않는다. {r.runs}번 쳐 본 평균이다(실제 게임에는 아무 영향이 없다).</p>
      <div className="chips">
        {(Object.keys(DUMMY_SCENARIOS) as DummyScenario[]).map((k) => (
          <button key={k} className={`chip${scen === k ? " on" : ""}`} onClick={() => setScen(k)}>
            {DUMMY_SCENARIOS[k].name}
          </button>
        ))}
      </div>
      <p className="dim small">{DUMMY_SCENARIOS[scen].desc}</p>
      <DummyResult r={r} />
      <p className="dim small">허수아비는 반격하지 않는다 — 맞아야 발동하는 기술(맞받아치기·방패 반격 등)과 HP가 깎여야 강해지는 기술은 여기서 잡히지 않는다.</p>
      <button className="btn ghost small" onClick={onClose}>
        돌아가기
      </button>
    </Card>
  );
}

function DummyResult({ r }: { r: DummyReport }) {
  const top = Math.max(1, ...r.perRound);
  return (
    <div className="dummy">
      <div className="dummy-head">
        <div>
          <span className="dim small">{DUMMY_ROUNDS}라운드 총 피해</span>
          <b className="dummy-total num">{Math.round(r.total)}</b>
        </div>
        <div className="small">
          <div>
            첫 라운드 <b className="num">{Math.round(r.perRound[0])}</b>
          </div>
          <div className="dim">
            쓰러뜨림 {r.kills.toFixed(1)} · 명중 {Math.round(r.hitRate * 100)}% · 치명타 {Math.round(r.critRate * 100)}%
          </div>
        </div>
      </div>
      <div className="dummy-rounds" aria-label="라운드별 피해">
        {r.perRound.map((v, i) => (
          <div key={i} className="dummy-round">
            <span className="dim">{i + 1}R</span>
            <span className="dummy-bar">
              <span style={{ width: `${(v / top) * 100}%` }} />
            </span>
            <span className="num">{v.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <p className="eyebrow">어디서 나온 피해인가</p>
      <div className="dummy-rounds">
        {r.bySource.map((x) => (
          <div key={x.id} className="dummy-src">
            <span>{x.name}</span>
            <span className="dummy-bar">
              <span style={{ width: `${(x.dmg / Math.max(1, r.total)) * 100}%` }} />
            </span>
            <span className="num">{Math.round((x.dmg / Math.max(1, r.total)) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 훈련 화면: 각 훈련을 받았다고 치고 허수아비 딜이 얼마나 달라지는지(열 때 한 번 잰다) */
function useTrainingPreview(s: GameState, ids: string[]): Record<string, { single: string; pack: string }> | null {
  const [out, setOut] = useState<Record<string, { single: string; pack: string }> | null>(null);
  useEffect(() => {
    setOut(null);
    const timer = setTimeout(() => {
      const runs = 120;
      const base = { single: dummyTest(s, "single", runs).total, pack: dummyTest(s, "pack", runs).total };
      const fmt = (now: number, after: DummyReport | null) => {
        if (!after) return "";
        const d = Math.round(((after.total - now) / Math.max(1, now)) * 100);
        return `${Math.round(now)}→${Math.round(after.total)} (${d >= 0 ? "+" : ""}${d}%)`;
      };
      const res: Record<string, { single: string; pack: string }> = {};
      for (const id of ids) res[id] = { single: fmt(base.single, dummyAfterTraining(s, id, [], "single", runs)), pack: fmt(base.pack, dummyAfterTraining(s, id, [], "pack", runs)) };
      setOut(res);
    }, 30);
    return () => clearTimeout(timer);
  }, [s, ids.join(",")]);
  return out;
}

function TrainingPanel({ ctl, onClose }: { ctl: Ctl; onClose: () => void }) {
  const { s, dispatch } = ctl;
  const allowed = TRAININGS.filter((x) => CLASSES[s.hero.cls].trainings.includes(x.id));
  const [tid, setTid] = useState(allowed[0].id);
  const [free, setFree] = useState<StatKey[]>([]);
  const [showTable, setShowTable] = useState(false);
  const preview = useTrainingPreview(s, allowed.map((x) => x.id));
  const t = TRAININGS.find((x) => x.id === tid)!;
  const sk = nextSkill(s, tid);
  const gate = gateOf(s);
  const next = s.hero.level + 1;
  const basic = CLASSES[s.hero.cls].firstSkill;
  const needShield = sk && SKILLS[sk].shield && !hasShield(s);

  const toggle = (k: StatKey) => {
    setFree((f) => (f.length < 2 ? [...f, k] : [f[1], k]));
  };

  return (
    <Card title={`훈련 — ${trainCost(s)}G`}>
      <SceneBanner id="training" />
      <p className="dim small">훈련마다 6포인트: 훈련 종류로 정해지는 2 + 자유 2 + 지난 행동으로 정해지는 2. 어느 레벨에서 어느 훈련을 받았는지에 따라 배우는 기술이 정해진다 — 그 레벨에 다른 훈련을 고르면 그 칸은 놓친다.</p>
      {SPECIAL_LEVELS.includes(next) && (
        <div className="special-note">
          <b>특수 훈련 — 레벨 {next}</b>
          <span className="small">{gate ? `재료: ${gate.name}. ` : ""}고른 훈련의 <b>특화</b>를 얻는다. 특화를 얻으면 그 갈래의 액티브를 전투마다 한 번 더 쓰고, 확 강해진다.</span>
        </div>
      )}
      {basic && !s.skills.includes(basic) && (
        <p className="small accent">첫 훈련: 어느 훈련을 받든 기본기 【{SKILLS[basic].name}】을(를) 함께 배운다 — {SKILLS[basic].desc}</p>
      )}
      <button className="fold-toggle" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
        {showTable ? "▾" : "▸"} 훈련 레벨표 {showTable ? "접기" : "펼치기"}
      </button>
      {showTable && <LevelTable s={s} selected={tid} onPick={setTid} />}
      <div className="stack tight">
        {allowed.map((x) => {
          const xs = nextSkill(s, x.id);
          return (
            <button key={x.id} className={`option${tid === x.id ? " on" : ""}`} onClick={() => setTid(x.id)}>
              <b>{x.name}</b> <span className="dim small">{x.desc}</span>
              <span className="small accent">
                {" "}
                {x.stats[0] === x.stats[1] ? `${STAT_LABEL[x.stats[0]]} +2` : `${x.stats.map((k) => STAT_LABEL[k]).join(" · ")} +1`}
              </span>
              <span className="option-skill small">
                {xs ? (
                  <>
                    레벨 {next} 기술: <b>{SKILLS[xs].name}</b> <span className="dim">({SPECIAL_LEVELS.includes(next) ? "특화" : SKILLS[xs].kind === "active" ? "자동 발동" : "패시브"}) {SKILLS[xs].desc}</span>
                  </>
                ) : (
                  <span className="dim">{hasLevelTable(x.id) ? (next >= 10 ? "10레벨 이후 기술은 3섹터와 함께 열린다" : "이 레벨에는 이 훈련으로 배울 기술이 없다") : "이 훈련의 기술은 모두 배웠다"}</span>
                )}
              </span>
              <span className="option-skill small dim">
                허수아비 {DUMMY_ROUNDS}라운드 딜:{" "}
                {!preview ? "재는 중…" : preview[x.id]?.single ? <>1개 <b className="accent">{preview[x.id].single}</b> · 3개 <b className="accent">{preview[x.id].pack}</b></> : "—"}
              </span>
            </button>
          );
        })}
      </div>
      {buildAdvice(s).map((a) => (
        <p key={a} className="small accent">
          → {a}
        </p>
      ))}
      {needShield && <p className="small warn">🛡 지금 방패가 없어 【{SKILLS[sk!].name}】을(를) 배워도 쓸 수 없다. 대장간에서 나무 방패({GEAR.shield.price}G)를 먼저 사 두자.</p>}
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
