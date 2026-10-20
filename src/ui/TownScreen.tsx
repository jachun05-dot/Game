import { useEffect, useMemo, useState } from "react";
import { DUMMY_ROUNDS, DUMMY_SCENARIOS, dummyAfterTraining, dummyTest, type DummyReport, type DummyScenario } from "../game/dummy";
import { BAL, STAT_KEYS, STAT_LABEL, TRAININGS } from "../game/data";
import { CORRODE_NAME, GEAR, SLOTS, corrosionOf, gearEffect, hasShield, offOf, targetSlot } from "../game/gear";
import { OFF_NAME } from "./components";
import { corrodedSlots, corrosionEffect, repairCost } from "../game/hazards";
import { CLASSES } from "../game/classes";
import { hasLevelTable } from "../game/elements";
import { LAST_SECTOR } from "../game/endless";
import { shortcutSectors } from "../game/dungeon";
import { townMaxLevel, BLACK_MARKET_MULT, canTrain, innCost, outlawTrainerHere, gateOf, nextSkill, rogueGearOk, shopPrice, trainCost } from "../game/town";
import type { GameState } from "../game/types";
import { SKILLS } from "../game/skills";
import { FRAGMENTS, fragStatText } from "../game/fragments";
import { maxHp, taxDue, yearOf } from "../game/core";
import type { StatKey } from "../game/types";
import type { Ctl } from "./App";
import { INJ, LIMBS, PART_NAME, anyInjury } from "../game/injury";
import { Card, GameScreen, GearIcon, GearList, HeroHeader, LevelTable, LogView, FaithCard, InjuryCard, FragList, SPECIAL_LEVELS, SceneBanner, buildAdvice, SkillList, StatGrid, TacticsBar } from "./components";
import { Icon, type IconName } from "./icons";
import { t, tk } from "../i18n";

const ITEM_INFO = {
  food: { name: tk("말린 고기"), desc: tk("포만감 +40") },
  // {n}은 그릴 때 BAL.potionBase로 채운다
  potion: { name: tk("치료 물약"), desc: tk("HP 2d4+{n} 회복") },
  scroll: { name: tk("귀환 주문서"), desc: tk("언제든 미궁에서 귀환") },
  bandage: { name: tk("붕대"), desc: tk("가장 심한 부상 하나를 한 단계 낫게 한다(결손 제외)") },
  herb: { name: tk("약초 탕약"), desc: tk("질병(쥐 열병·곰팡이 폐병)을 한 단계 낫게 한다") },
  antidote: { name: tk("해독초"), desc: tk("독 한 단계 + 가장 심한 마비 한 단계 (3섹터)") },
  whetstone: { name: tk("숫돌"), desc: tk("가장 심하게 삭은 장비를 한 단계 손본다 (3섹터)") },
  salve: { name: tk("화상 연고"), desc: tk("화상 입은 부위 하나를 한 단계 (4섹터)") },
  firewood: { name: tk("장작"), desc: tk("야영할 때 불을 피워 냉기 0 + 동상 한 단계 (4섹터)") },
  rope: { name: tk("밧줄"), desc: tk("벼랑길을 반드시 건넌다 (5섹터)") },
  incense: { name: tk("옛 신의 향"), desc: tk("정화(신앙심을 깎는 흰빛)를 3번 막는다 — 외곽 밀수꾼의 물건 (6섹터)") },
  bolt: { name: tk("볼트 10발"), desc: tk("로그 손쇠뇌 탄환. 이긴 전투에서는 쏜 것의 절반을 주워 온다") },
} as const;

/** 3섹터 소모품은 2섹터를 클리어했거나 가지고 있을 때만 보여 준다 */
function shopItems(s: GameState): (keyof typeof ITEM_INFO)[] {
  const need: Partial<Record<keyof typeof ITEM_INFO, number>> = { antidote: 2, whetstone: 2, salve: 3, firewood: 3, rope: 4, incense: 5 };
  return (Object.keys(ITEM_INFO) as (keyof typeof ITEM_INFO)[]).filter((k) => (k === "bolt" ? rogueGearOk(s, "rgHandXbow") : s.rank >= (need[k] ?? 0) || s.inventory[k] > 0));
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
      title={t("{m}월 {w}주차 · 영지", { m: s.month, w: s.week })}
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
          {t("이번 주 할 일")}
        </button>
        <button className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}>
          {s.heretic ? t("암시장") : t("상점가 · 대장간 · 신전")}
        </button>
        <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}>
          {t("모험가")}
        </button>
      </div>

      {tab === "act" && s.week >= 4 && <DungeonPrep s={s} busy={busy} onShop={() => setTab("shop")} onEnter={(shortcut, sector) => dispatch({ t: "enterDungeon", shortcut, sector })} />}

      {tab === "act" && s.week < 4 && s.heretic && !training && (
        <div className="stack">
          <Card title={t("현상수배 중")} className="warn">
            <p className="small">{t("성당 문에 당신의 얼굴이 그려진 수배서가 붙어 있다. 마을 안으로는 들어갈 수 없다 — 영지 외곽만 다닐 수 있다.")}</p>
            <p className="dim small">{t("숲의 마석은 밀수꾼에게 반값에 넘기고, 사냥한 짐승으로 말린 고기를 만든다. 고기·물약은 외곽의 암시장에서 {mult}배 값에 살 수 있다(암시장 탭). 세금은 걷히지 않는다. 미궁에서는 이단심문관이 뒤를 쫓는다.", { mult: BLACK_MARKET_MULT })}</p>
          </Card>
          {outlawTrainerHere(s) && (
            <ActivityButton title={tk("떠돌이 교관에게 훈련")} sub={`${t("이번 주만")} · ${trainSub(s)}`} disabled={busy || !canTrain(s)} onClick={() => setTraining(true)} />
          )}
          <ActivityButton
            title={tk("외부 탐험")}
            sub={`${t("영지 밖 숲 · 작은 전투, 마석(반값)과 말린 고기")}${s.outlawTrainer?.week === `${s.month}-${s.week}` ? "" : ` · ${t("외곽에서 떠돌이 교관을 찾아본다({pct}%, 받을 훈련이 남아 있을 때)", { pct: Math.round((s.outlawTrainerKnown ? BAL.outlawTrainerChanceKnown : BAL.outlawTrainerChance) * 100) })}`}`}
            disabled={busy}
            onClick={() => dispatch({ t: "activity", a: "field" })}
          />
          <ActivityButton title={tk("성당에 자수한다")} sub={t("{faith|을} 부정하고 마을로 돌아간다 (신앙을 잃는다, 시간은 들지 않는다)", { faith: s.hero.faith ?? t("옛 신") })} disabled={busy} onClick={() => dispatch({ t: "surrender" })} />
        </div>
      )}

      {tab === "act" && s.week < 4 && !training && !dummy && !s.heretic && (
        <div className="stack">
          <p className="dim small">{t("한 주에 한 가지 일을 합니다. 쇼핑은 시간이 들지 않습니다.")}{s.week === 3 && ` ${t("다음 주는 미궁이 열립니다 — 준비물을 챙기세요.")}`}</p>
          <ActivityButton title={tk("훈련")} sub={trainSub(s)} disabled={busy || !canTrain(s)} onClick={() => setTraining(true)} />
          <ActivityButton title={tk("탐문")} sub={t("술집 · 소문을 듣고 잔일을 구한다")} disabled={busy} onClick={() => dispatch({ t: "activity", a: "rumor" })} />
          <ActivityButton title={tk("외부 탐험")} sub={t("영지 밖 숲 · 작은 전투, 마석 획득 (위험)")} disabled={busy} onClick={() => dispatch({ t: "activity", a: "field" })} />
          <ActivityButton
            title={tk("여관에서 쉬기")}
            sub={`${innCost(s)}G · ${t("HP를 모두 회복하고 모든 부상·질병이 한 단계 낫는다 (결손 제외)")}${anyInjury(s) ? "" : ` — ${t("지금은 다친 데가 없다")}`}`}
            disabled={busy || s.gold < innCost(s)}
            onClick={() => dispatch({ t: "activity", a: "inn" })}
          />
          <ActivityButton title={tk("훈련소 허수아비")} sub={t("시간이 들지 않는다 · {n}라운드 동안 준 피해를 잰다", { n: DUMMY_ROUNDS })} disabled={busy} onClick={() => setDummy(true)} />
          <p className="dim small">{t("{y}년차 · 다음 달 세금: {tax}G (미납 시 처형 · 해가 바뀔 때마다 {inc}G, 섹터를 클리어해 이름이 알려지면 더 오른다) · 상점가 물가 ×{price}", { y: yearOf(s.month), tax: taxDue(s.month + 1, s.rank), inc: BAL.taxPerYear, price: (s.priceIndex ?? 1).toFixed(2) })}</p>
          <div className="row">
            <button className="btn ghost small" onClick={onGraveyard}>
              {t("묘지 들르기")}
            </button>
            <button className="btn ghost small" onClick={ctl.openCodex}>
              {t("몬스터 도감")}
            </button>
          </div>
        </div>
      )}

      {tab === "act" && s.week < 4 && training && <TrainingPanel ctl={ctl} onClose={() => setTraining(false)} />}
      {tab === "act" && s.week < 4 && dummy && !s.heretic && <DummyPanel s={s} onClose={() => setDummy(false)} />}

      {tab === "shop" && s.heretic && (
        <div className="stack">
          <Card title={t("암시장")}>
            <p className="dim small">{t("현상수배 중이라 상점가·대장간·신전에는 들어갈 수 없다. 영지 외곽의 밀수꾼이 같은 물건을 {mult}배 값에 넘겨준다.", { mult: BLACK_MARKET_MULT })}</p>
            {shopItems(s).map((k) => (
              <div key={k} className="shop-row">
                <div>
                  <b>{t(ITEM_INFO[k].name)}</b> <span className="dim small">{t(ITEM_INFO[k].desc, { n: BAL.potionBase })}</span>
                  <div className="dim small">{t("보유 {n}개", { n: s.inventory[k] })}</div>
                </div>
                <button className="btn small" disabled={s.gold < shopPrice(s, k)} onClick={() => dispatch({ t: "buy", item: k })}>
                  {shopPrice(s, k)}G
                </button>
              </div>
            ))}
          </Card>
          {s.week >= 4 && (
            <button className="btn primary wide" disabled={busy} onClick={() => dispatch({ t: "enterDungeon" })}>
              {t("준비 끝 — 미궁으로 들어간다 →")}
            </button>
          )}
        </div>
      )}

      {tab === "shop" && !s.heretic && (
        <div className="stack">
          <Card title={t("상점가")}>
            <SceneBanner id="market" />
            {shopItems(s).map((k) => (
              <div key={k} className="shop-row">
                <div>
                  <b>{t(ITEM_INFO[k].name)}</b> <span className="dim small">{t(ITEM_INFO[k].desc, { n: BAL.potionBase })}</span>
                  <div className="dim small">{t("보유 {n}개", { n: s.inventory[k] })}</div>
                </div>
                <button className="btn small" disabled={s.gold < shopPrice(s, k)} onClick={() => dispatch({ t: "buy", item: k })}>
                  {shopPrice(s, k)}G
                </button>
              </div>
            ))}
          </Card>
          <Card title={t("대장간")}>
            <SceneBanner id="smithy" />
            <p className="dim small">{t("장비는 강해지는 수단이 아니라 살아남기 위한 최소한이다.")}</p>
            {Object.values(GEAR)
              .filter((g) => g.price !== undefined && (!g.rogueOff || rogueGearOk(s, g.id)))
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
                      {!owned && cur && <div className="dim small">{t("지금: {name} (교체하면 넘긴다)", { name: GEAR[cur].name })}</div>}
                    </div>
                    <button className="btn small" disabled={owned || s.gold < g.price! || (g.rank ?? 0) > s.rank} onClick={() => dispatch({ t: "buyGear", id: g.id })}>
                      {owned ? t("착용 중") : (g.rank ?? 0) > s.rank ? t("등급 {n} 필요", { n: g.rank ?? 0 }) : `${g.price}G`}
                    </button>
                  </div>
                );
              })}
            <p className="dim small">{t("반지·목걸이와 좋은 장비는 미궁 보물상자에서만 나온다.")}</p>
            {corrodedSlots(s).map((k) => (
              <div key={k} className="shop-row">
                <div>
                  <b>{t("수리 — {name}", { name: GEAR[s.gear[k]!].name })}</b>
                  <div className="dim small">{CORRODE_NAME[corrosionOf(s, k)]} · {corrosionEffect(k, corrosionOf(s, k))} → {t("새것처럼")}</div>
                </div>
                <button className="btn small" disabled={busy || s.gold < repairCost(s, k)} onClick={() => dispatch({ t: "repair", slot: k })}>
                  {repairCost(s, k)}G
                </button>
              </div>
            ))}
            {LIMBS.filter((p) => s.injuries[p] >= 3 && !s.prosthetic[p]).map((p) => (
              <div key={p} className="shop-row">
                <div>
                  <b>{p === "feet" ? t("의족") : t("의수 ({part})", { part: PART_NAME[p] })}</b>
                  <div className="dim small">{t("잃은 {part|을} 대신한다 — 중상 정도로는 쓸 수 있다", { part: PART_NAME[p] })}</div>
                </div>
                <button className="btn small" disabled={busy || s.gold < INJ.prostheticCost} onClick={() => dispatch({ t: "prosthetic", part: p })}>
                  {INJ.prostheticCost}G
                </button>
              </div>
            ))}
          </Card>
          <Card title={t("신전")}>
            <SceneBanner id="temple" />
            {LIMBS.filter((p) => s.injuries[p] >= 3).map((p) => (
              <div key={p} className="shop-row">
                <div>
                  <b>{t("재생 의식 — {part}", { part: PART_NAME[p] })}</b>
                  <div className="dim small">{t("잃은 {part|을} 완전히 되살린다", { part: PART_NAME[p] })}</div>
                </div>
                <button className="btn small" disabled={busy || s.gold < INJ.regenCost} onClick={() => dispatch({ t: "regen", part: p })}>
                  {INJ.regenCost}G
                </button>
              </div>
            ))}
            <p className="dim small">{t("사제에게 큰돈을 바치면 몸에 새긴 편린 하나를 지워 준다. 지운 편린은 돌아오지 않는다.")}</p>
            {s.fragments.length === 0 && <p className="dim small">{t("지울 편린이 없다.")}</p>}
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
                  {erase === i ? t("정말 지운다") : t("지우기 {n}G", { n: BAL.fragEraseCost })}
                </button>
              </div>
            ))}
          </Card>
          {s.week >= 4 && (
            <button className="btn primary wide" disabled={busy} onClick={() => dispatch({ t: "enterDungeon" })}>
              {t("준비 끝 — 미궁으로 들어간다 →")}
            </button>
          )}
        </div>
      )}

      {tab === "me" && (
        <div className="stack">
          <button className="btn primary wide" onClick={() => ctl.setSheet(true)}>
            {t("장비 · 전투 수치 자세히 보기")}
          </button>
          <Card title={t("모험가 상태")}>
            <StatGrid s={s} />
            <GearList s={s} />
            <p className="dim small">
              {t("소지품: 말린 고기 {food} · 물약 {potion} · 귀환 주문서 {scroll} · 읽은 기록물 {records}", { food: s.inventory.food, potion: s.inventory.potion, scroll: s.inventory.scroll, records: s.recordsRead })}
            </p>
          </Card>
          <Card title={t("기술")}>
            <SkillList s={s} />
          </Card>
          <Card title={t("부상 · 질병")}>
            <InjuryCard s={s} />
          </Card>
          <Card title={t("신앙")}>
            <FaithCard s={s} />
          </Card>
          <Card title={t("편린")}>
            <FragList s={s} />
          </Card>
          <Card title={t("전투는 자동으로 진행됩니다")}>
            <p className="dim small">{t("가장 약한 적부터 노리고, 기술은 조건이 맞으면 저절로 발동합니다. 정할 수 있는 건 물약과 도주 시점뿐입니다.")}</p>
            <TacticsBar ctl={ctl} />
          </Card>
        </div>
      )}

    </GameScreen>
  );
}

function trainSub(s: GameState): string {
  if (s.hero.level >= BAL.maxLevel) return t("최대 레벨");
  // 모험가: 교관이 가르칠 수 있는 건 15레벨까지(16은 히든 — 섬기는 신에게서)
  if (s.hero.level >= townMaxLevel(s)) return t("\"내가 가르칠 건 여기까지다. 더는 네 신에게 물어라.\" — 교관");
  if (s.month < BAL.firstTrainMonth) return t("첫 달에는 훈련을 받을 수 없다 — 미궁에서 살아 돌아오면 교관이 받아 준다");
  const base = t("직업교관 · {cost}G · 레벨 {lv} → {next}", { cost: trainCost(s), lv: s.hero.level, next: s.hero.level + 1 });
  const gate = gateOf(s);
  if (gate) {
    if (s.inventory[gate.item] <= 0) return gate.sector > LAST_SECTOR ? t("{item|이} 필요하다 — {sector}섹터 보스가 지니고 있다(아직 열리지 않은 섹터 — 지금은 레벨 {lv}이 끝이다)", { item: gate.name, sector: gate.sector, lv: s.hero.level }) : t("{item|이} 필요하다 — {sector}섹터 3층 보스가 지니고 있다(처음 쓰러뜨릴 때 한 번만 나온다)", { item: gate.name, sector: gate.sector });
    if (s.gold < trainCost(s)) return t("돈이 모자라다 ({cost}G + {item})", { cost: trainCost(s), item: gate.name });
    return `${base} + ${gate.name}`;
  }
  return canTrain(s) ? base : t("돈이 모자라다 ({cost}G)", { cost: trainCost(s) });
}

function WeekTrack({ month, week }: { month: number; week: number }) {
  return (
    <div className="week-track">
      {[1, 2, 3, 4].map((w) => (
        <div key={w} className={`wk${w === week ? " now" : ""}${w < week ? " done" : ""}${w === 4 ? " dungeon" : ""}`}>
          {w === 4 ? t("미궁") : t("{w}주", { w })}
        </div>
      ))}
      <span className="dim small">{t("{m}월", { m: month })}</span>
    </div>
  );
}

/** 4주차: 미궁에 들어가기 전에 상점에 들를 기회 */
function DungeonPrep({ s, busy, onShop, onEnter }: { s: GameState; busy: boolean; onShop: () => void; onEnter: (shortcut: boolean, sector?: number) => void }) {
  const inv = s.inventory;
  return (
    <div className="stack">
      <Card title={t("4주차 — 미궁이 열렸다")}>
        <p className="small">
          {t("들어가면 7일 동안 나올 수 없다(귀환 주문서 제외).")} {s.heretic ? t("현상수배 중이라 상점가 대신 외곽의 암시장({mult}배 값)에 들를 수 있다.", { mult: BLACK_MARKET_MULT }) : t("모자란 것이 있으면 상점가·대장간에 먼저 들르자. 쇼핑은 시간이 들지 않는다.")}
        </p>
        <p className="small">
          {t("챙긴 것:")} {t("말린 고기")} <b>{inv.food}</b> · {t("치료 물약")} <b>{inv.potion}</b> · {t("귀환 주문서")} <b>{inv.scroll}</b>
          {inv.bandage > 0 && <> · {t("붕대")} <b>{inv.bandage}</b></>}
          {inv.herb > 0 && <> · {t("약초 탕약")} <b>{inv.herb}</b></>}
          {inv.antidote > 0 && <> · {t("해독초")} <b>{inv.antidote}</b></>}
          {inv.whetstone > 0 && <> · {t("숫돌")} <b>{inv.whetstone}</b></>}
          {inv.salve > 0 && <> · {t("화상 연고")} <b>{inv.salve}</b></>}
          {inv.firewood > 0 && <> · {t("장작")} <b>{inv.firewood}</b></>}
          {inv.powder > 0 && <> · {t("화약통")} <b>{inv.powder}</b></>}
          {inv.rope > 0 && <> · {t("밧줄")} <b>{inv.rope}</b></>}
          {inv.incense > 0 && <> · {t("옛 신의 향")} <b>{inv.incense}</b></>}
          {s.gear.offhand === "rgHandXbow" && <> · {t("볼트")} <b>{inv.bolt}</b></>} · {t("소지금")} <b>{s.gold}G</b>
        </p>
        {inv.food < 3 && <p className="small warn">{t("말린 고기가 적다 — 일주일을 버티기 어렵다.")}</p>}
        {s.hero.hp < maxHp(s) && <p className="small warn">{t("HP {hp}/{max} — 다 차지 않은 채 들어간다. (여관은 1~3주에만 쓸 수 있다. 물약을 넉넉히 챙기자)", { hp: s.hero.hp, max: maxHp(s) })}</p>}
      </Card>
      <button className="btn" disabled={busy} onClick={onShop}>
        {s.heretic ? t("암시장 들르기") : t("상점가 · 대장간 들르기")}
      </button>
      <button className="btn primary wide" disabled={busy} onClick={() => onEnter(false)}>
        {t("미궁으로 들어간다 →")}
      </button>
      {shortcutSectors(s).map((k) => (
        <button key={k} className="btn wide" disabled={busy} onClick={() => onEnter(true, k)}>
          {t("숏컷 — 곧장 {k}섹터로", { k })} <span className="dim small">· {t("1~{prev}섹터를 건너뛴다 (남은 시간 {h}시간)", { prev: k - 1, h: Math.round(BAL.shortcutTurns / 2) })}</span>
        </button>
      ))}
    </div>
  );
}

/** 할 일 이름으로 고른 아이콘(없으면 칼) */
const ACTIVITY_ICON: [RegExp, IconName][] = [
  [/훈련|교관/, "sword"], // i18n-ok: 한국어 키(번역 전 title)로 아이콘을 고른다
  [/탐문/, "eye"], // i18n-ok
  [/외부 탐험/, "map"], // i18n-ok
  [/여관/, "camp"], // i18n-ok
  [/허수아비/, "stone"], // i18n-ok
  [/자수/, "grave"], // i18n-ok
  [/사냥|숲/, "leaf"], // i18n-ok
  [/밀수/, "coin"], // i18n-ok
];

/** title은 tk()로 표시한 한국어 원문 — 아이콘은 원문으로 고르고, 그릴 때 번역한다 */
function ActivityButton({ title, sub, disabled, onClick }: { title: string; sub: string; disabled?: boolean; onClick: () => void }) {
  const icon = ACTIVITY_ICON.find(([re]) => re.test(title))?.[1] ?? "sword";
  return (
    <button className="activity" disabled={disabled} onClick={onClick}>
      <span className="act-icon"><Icon name={icon} /></span>
      <b>{t(title)}</b>
      <span className="dim small">{sub}</span>
      <span className="arrow"><Icon name="arrow" /></span>
    </button>
  );
}

/** 훈련소 허수아비: 지금 상태로 10라운드 동안 준 피해(복사본에서 200번 평균) */
function DummyPanel({ s, onClose }: { s: GameState; onClose: () => void }) {
  const [scen, setScen] = useState<DummyScenario>("single");
  const r = useMemo(() => dummyTest(s, scen), [s, scen]);
  return (
    <Card title={t("훈련소 허수아비")}>
      <p className="dim small">{t("허수아비를 {n}라운드 동안 친다. 쓰러지면 바로 다시 일어서지만, 전투마다 쓸 수 있는 횟수가 정해진 기술은 다시 채워지지 않는다. {runs}번 쳐 본 평균이다(실제 게임에는 아무 영향이 없다).", { n: DUMMY_ROUNDS, runs: r.runs })}</p>
      <div className="chips">
        {(Object.keys(DUMMY_SCENARIOS) as DummyScenario[]).map((k) => (
          <button key={k} className={`chip${scen === k ? " on" : ""}`} onClick={() => setScen(k)}>
            {DUMMY_SCENARIOS[k].name}
          </button>
        ))}
      </div>
      <p className="dim small">{DUMMY_SCENARIOS[scen].desc}</p>
      <DummyResult r={r} />
      <p className="dim small">{t("허수아비는 반격하지 않는다 — 맞아야 발동하는 기술(맞받아치기·방패 반격 등)과 HP가 깎여야 강해지는 기술은 여기서 잡히지 않는다.")}</p>
      <button className="btn ghost small" onClick={onClose}>
        {t("돌아가기")}
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
          <span className="dim small">{t("{n}라운드 총 피해", { n: DUMMY_ROUNDS })}</span>
          <b className="dummy-total num">{Math.round(r.total)}</b>
        </div>
        <div className="small">
          <div>
            {t("첫 라운드")} <b className="num">{Math.round(r.perRound[0])}</b>
          </div>
          <div className="dim">
            {t("쓰러뜨림 {kills} · 명중 {hit}% · 치명타 {crit}%", { kills: r.kills.toFixed(1), hit: Math.round(r.hitRate * 100), crit: Math.round(r.critRate * 100) })}
          </div>
        </div>
      </div>
      <div className="dummy-rounds" aria-label={t("라운드별 피해")}>
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
      <p className="eyebrow">{t("어디서 나온 피해인가")}</p>
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
  const tr = TRAININGS.find((x) => x.id === tid)!;
  const sk = nextSkill(s, tid);
  const gate = gateOf(s);
  const next = s.hero.level + 1;
  const basic = CLASSES[s.hero.cls].firstSkill;
  const needShield = sk && SKILLS[sk].shield && !hasShield(s);
  const needOff = sk && SKILLS[sk].off && offOf(s) !== SKILLS[sk].off ? SKILLS[sk].off : null;

  const toggle = (k: StatKey) => {
    setFree((f) => (f.length < 2 ? [...f, k] : [f[1], k]));
  };

  // 굵은 "특화"를 문장 가운데 끼우려고 {spec} 자리에서 나눈다
  const specParts = t("고른 훈련의 {spec}를 얻는다. 특화를 얻으면 그 갈래의 액티브를 전투마다 한 번 더 쓰고, 확 강해진다.").split("{spec}");

  return (
    <Card title={t("훈련 — {cost}G", { cost: trainCost(s) })}>
      <SceneBanner id="training" />
      <p className="dim small">{t("훈련마다 6포인트: 훈련 종류로 정해지는 2 + 자유 2 + 지난 행동으로 정해지는 2. 어느 레벨에서 어느 훈련을 받았는지에 따라 배우는 기술이 정해진다 — 그 레벨에 다른 훈련을 고르면 그 칸은 놓친다.")}</p>
      {SPECIAL_LEVELS.includes(next) && (
        <div className="special-note">
          <b>{t("특수 훈련 — 레벨 {n}", { n: next })}</b>
          <span className="small">
            {gate ? `${t("재료: {item}.", { item: gate.name })} ` : ""}
            {specParts[0]}
            <b>{t("특화")}</b>
            {specParts[1]}
          </span>
        </div>
      )}
      {basic && !s.skills.includes(basic) && (
        <p className="small accent">{t("첫 훈련: 어느 훈련을 받든 기본기 【{skill}】을(를) 함께 배운다 — {desc}", { skill: SKILLS[basic].name, desc: SKILLS[basic].desc })}</p>
      )}
      <button className="fold-toggle" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
        {showTable ? "▾" : "▸"} {showTable ? t("훈련 레벨표 접기") : t("훈련 레벨표 펼치기")}
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
                    {t("레벨 {n} 기술:", { n: next })} <b>{SKILLS[xs].name}</b> <span className="dim">({SPECIAL_LEVELS.includes(next) ? t("특화") : SKILLS[xs].kind === "active" ? t("자동 발동") : t("패시브")}) {SKILLS[xs].desc}</span>
                  </>
                ) : (
                  <span className="dim">{hasLevelTable(x.id) ? (next >= 10 ? t("10레벨 이후 기술은 3섹터와 함께 열린다") : t("이 레벨에는 이 훈련으로 배울 기술이 없다")) : t("이 훈련의 기술은 모두 배웠다")}</span>
                )}
              </span>
              <span className="option-skill small dim">
                {t("허수아비 {n}라운드 딜:", { n: DUMMY_ROUNDS })}{" "}
                {!preview ? t("재는 중…") : preview[x.id]?.single ? <>{t("1개")} <b className="accent">{preview[x.id].single}</b> · {t("3개")} <b className="accent">{preview[x.id].pack}</b></> : "—"}
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
      {needOff && <p className="small warn">{t("【{skill}】은(는) 왼손에 {off}이(가) 있어야 쓸 수 있다 — 그 갈래의 4레벨 각인이나 10레벨 낙인을 받아야 한다.", { skill: SKILLS[sk!].name, off: t(OFF_NAME[needOff]) })}</p>}
      {needShield && <p className="small warn">{t("🛡 지금 방패가 없어 【{skill}】을(를) 배워도 쓸 수 없다. 대장간에서 나무 방패({price}G)를 먼저 사 두자.", { skill: SKILLS[sk!].name, price: GEAR.shield.price ?? 0 })}</p>}
      <p className="eyebrow">{t("자유 배분 2포인트 (같은 능력치에 두 번도 가능)")}</p>
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
            {t("초기화")}
          </button>
        )}
      </div>
      <div className="row">
        <button className="btn ghost small" onClick={onClose}>
          {t("취소")}
        </button>
        <button
          className="btn primary small"
          disabled={free.length < 2}
          onClick={() => {
            dispatch({ t: "train", training: tr.id, free: [free[0], free[1]] });
            onClose();
          }}
        >
          {t("{name} 받기", { name: tr.name })}
        </button>
      </div>
    </Card>
  );
}
