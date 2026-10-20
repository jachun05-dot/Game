import type { CSSProperties } from "react";
import { maxHp } from "../game/core";
import { ROOM_LABEL, ROOM_SHORT, currentRoom, highTide, isNight } from "../game/dungeon";
import { SECTOR_NAME } from "../game/data";
import { anyParalysis, corrodedSlots, poisonOf } from "../game/hazards";
import { LAST_SECTOR } from "../game/endless";
import { burnParts, stagnant } from "../game/fire";
import type { PendingChoice } from "../game/dungeon";
import type { DungeonState, GameState } from "../game/types";
import { sweeperDistance, sweeperThreat } from "../game/sweeper";
import { BAL } from "../game/data";
import { GEAR, gearEffect, targetSlot } from "../game/gear";
import { FRAGMENTS, TIER_LABEL, fragKnown, fragSlots, fragStatText } from "../game/fragments";
import { SKILLS } from "../game/skills";
import type { Ctl } from "./App";
import { t, tk } from "../i18n";
import { godOf, power } from "../game/faith";
import { SEAL_DOOR, isSealDoor } from "../game/temple";
import { CLUES, clueCount, clueNeed, trueEndingLock, trueEndingOpen } from "../game/truth";
import { Bar, FragIcon, GameScreen, GearIcon, HeroHeader, LogView } from "./components";
import { ROOM_ICON, SCENE_ART } from "./art";
import { Icon } from "./icons";

function fmtTime(turns: number): string {
  const h = Math.max(0, turns) / 2;
  const d = Math.floor(h / 24);
  const hh = Math.floor(h % 24);
  return d > 0 ? t("{d}일 {h}시간", { d, h: hh }) : t("{h}시간", { h: hh });
}

export function DungeonScreen({ ctl }: { ctl: Ctl }) {
  const { s } = ctl;
  const dg = s.dungeon!;
  return (
    <GameScreen
      ctl={ctl}
      title={dg.endless ? t("끝없는 미궁 {f}층", { f: dg.floor }) : t("{s}섹터 {f}층 · {phase}", { s: dg.sector, f: dg.floor, phase: dg.sector === 6 ? (dg.floor >= 3 ? t("성소") : t("성가")) : dg.sector === 5 ? (isNight(s) ? t("들숨") : t("날숨")) : dg.sector === 4 ? (stagnant(s) ? t("고임") : t("바람")) : dg.sector === 3 ? (highTide(s) ? t("밀물") : t("썰물")) : dg.sector === 2 ? (isNight(s) ? t("밤") : t("낮")) : t("미궁") })}
      header={
        <>
          <HeroHeader s={s} onOpen={() => ctl.setSheet(true)} extra={<span className="stat-pill mana" title={t("들고 있는 마석(나가야 돈이 된다)")}><Icon name="gem" />{dg.mana}G</span>} />
          <div className="survival">
            <div>
              <span className="dim small"><Icon name="clock" />{t("시간")} <b className="num">{fmtTime(dg.turnsLeft)}</b></span>
              <Bar value={dg.turnsLeft} max={BAL.weekTurns} tone="tired" />
            </div>
            <div>
              <span className="dim small"><Icon name="meat" />{t("포만감")} <b className="num">{Math.round(s.hero.satiety)}</b></span>
              <Bar value={s.hero.satiety} max={100} tone="food" />
            </div>
            <div>
              <span className="dim small"><Icon name="tired" />{t("피로도")} <b className="num">{Math.round(s.hero.fatigue)}</b></span>
              <Bar value={s.hero.fatigue} max={100} tone="tired" />
            </div>
          </div>
        </>
      }
      dock={<RoomDock ctl={ctl} />}
    >
      <FloorMap dg={dg} night={isNight(s)} />
      <SweeperWarn s={s} />
      <LogView ctl={ctl} fill />
    </GameScreen>
  );
}

const PENDING_OPTIONS: Record<string, { choice: PendingChoice; label: string; dc?: number; primary?: boolean }[]> = {
  trap: [
    { choice: "disarm", label: tk("해체한다 (민첩 DC {dc})"), dc: BAL.trapDisarmDc, primary: true },
    { choice: "force", label: tk("조심해서 지나간다 (민첩 DC {dc}로 회피)"), dc: BAL.trapDodgeDc },
    { choice: "back", label: tk("왔던 길로 물러난다") },
  ],
  treasure: [
    { choice: "open", label: tk("상자를 연다"), primary: true },
    { choice: "leave", label: tk("그냥 둔다") },
  ],
  record: [
    { choice: "read", label: tk("읽는다 (30분)"), primary: true },
    { choice: "leave", label: tk("지나친다") },
  ],
  shrine: [
    { choice: "pray", label: tk("무릎 꿇고 기도한다 (1시간)"), primary: true },
    { choice: "leave", label: tk("지나친다") },
  ],
  stairs: [
    { choice: "descend", label: tk("아래층으로 내려간다"), primary: true },
    { choice: "stay", label: tk("이 층을 더 둘러본다") },
  ],
  lostScroll: [
    { choice: "use", label: tk("주문서를 찢고 돌아간다 (마석을 챙겨 귀환)"), primary: true },
    { choice: "stay", label: tk("두고, 1층을 더 둘러본다") },
  ],
  portal: [
    { choice: "enter", label: tk("차원문으로 들어간다"), primary: true },
    { choice: "return", label: tk("여기까지 — 마석을 챙겨 돌아간다") },
    { choice: "stay", label: tk("아직은 아니다") },
  ],
  relic: [
    { choice: "search", label: tk("녹슨 무기 더미를 뒤진다 (1시간)"), primary: true },
    { choice: "leave", label: tk("죽은 자들의 물건은 건드리지 않는다") },
  ],
  plenty: [
    { choice: "offer", label: tk("말린 고기 하나를 바친다"), primary: true },
    { choice: "leave", label: tk("그냥 지나간다") },
  ],
  ledge: [
    { choice: "careful", label: tk("벽에 붙어 조심히 건넌다 (2시간 더, 민첩 DC 10)"), primary: true },
    { choice: "force", label: tk("그냥 건넌다 (민첩 DC 14)") },
    { choice: "back", label: tk("왔던 길로 물러난다") },
  ],
  magazine: [
    { choice: "search", label: tk("화약고를 뒤진다 (1시간)"), primary: true },
    { choice: "pray", label: tk("재앙의 신에게 기도한다 (1시간)") },
    { choice: "leave", label: tk("건드리지 않는다") },
  ],
  offerbox: [
    { choice: "search", label: tk("봉헌함을 뒤진다 (1시간)"), primary: true },
    { choice: "leave", label: tk("건드리지 않는다") },
  ],
  seal: [
    { choice: "disarm", label: "", primary: true },
    { choice: "force", label: tk("봉인의 수호자에게 도전한다 (지면 HP 1로 문 밖)") },
    { choice: "back", label: tk("왔던 길로 물러난다") },
  ],
  altars: [
    { choice: "pray", label: tk("제단마다 무릎 꿇고 기도한다 (1시간)"), primary: true },
    { choice: "leave", label: tk("지나친다") },
  ],
  confessionFaith: [
    { choice: "renounce", label: tk("섬기는 신을 부정한다 (신앙을 잃는다)") },
    { choice: "refuse", label: tk("부정하지 않는다 (현상수배 — 심문관장과 싸운다)"), primary: true },
  ],
  confessionNone: [
    { choice: "ask", label: tk("셉터에 대해 캐묻는다 (지능·감각 DC 18)"), primary: true },
    { choice: "leave", label: tk("고개를 숙이고 지나친다") },
  ],
  altar: [
    { choice: "search", label: tk("썩은 제물을 뒤진다 (1시간)"), primary: true },
    { choice: "pray", label: tk("역병의 신에게 기도한다 (1시간)") },
    { choice: "leave", label: tk("제단을 지나친다") },
  ],
};

/** 4섹터 함정 해체 버튼 글 */
const MINE_DISARM: Record<string, string> = {
  collapse: tk("버팀목을 세운다 (힘·민첩 중 높은 쪽 DC 14)"),
  cart: tk("전철기를 돌린다 (지능 DC 13 — 성공하면 광차가 다음 적에게)"),
  gas: tk("가스가 빠질 때까지 기다린다 (2시간)"),
  steam: tk("밸브를 잠근다 (민첩 DC 13)"),
};
const MINE_TRAP_NOTE: Record<string, string> = {
  collapse: tk("무너지는 갱도 — 밟으면 2d6에 머리·몸통 부상 위험, 안쪽 통로가 막힌다."),
  cart: tk("폭주 광차 — 피하지 못하면 2d6에 발 부상 위험. 전철기를 돌리면 광차를 적에게 보낼 수 있다."),
  gas: tk("가스 주머니 — 터지면 2d8에 화상(고임 때 더 크게). 기다리면 시간만 든다."),
  steam: tk("증기 분출 — 1d8에 손·몸통 화상."),
  ice: tk("얇은 얼음 — 해체할 수 없다. 건너다 빠지면 1d6에 냉기 +3."),
};

/** 미궁의 청소부 예고·추적 */
function SweeperWarn({ s }: { s: GameState }) {
  const dg = s.dungeon!;
  if (!sweeperThreat(s)) return null;
  const dist = sweeperDistance(s);
  return (
    <p className="sweeper-warn">
      {dist === null
        ? t("이 층에 너무 오래 머물렀다 — 무언가 오고 있다. 계단으로 내려가거나 미궁을 나가면 피할 수 있다.")
        : t("미궁의 청소부가 쫓아온다 — {n}방 거리. 방을 옮길 때마다 한 방, 야영하면 두 방 다가온다.", { n: dist })}
      {dg.sweeperStage === 3 && dist !== null && dist <= 1 && t(" 바로 옆이다!")}
    </p>
  );
}

function RoomDock({ ctl }: { ctl: Ctl }) {
  const { s, dispatch, busy } = ctl;
  const dg = s.dungeon!;
  const room = currentRoom(s);
  const go = (a: Parameters<typeof dispatch>[0]) => !busy && dispatch(a);

  if (dg.pending?.kind === "gear") {
    const id = dg.pending.item;
    const g = GEAR[id];
    const cur = s.gear[targetSlot(s, id)];
    return (
      <>
        <p className="dock-title">{t("장비를 발견했다")}</p>
        <div className="loot-card has-gear">
          <GearIcon id={id} scale={2} />
          <b>{g.name}</b>
          <span className="accent small">{gearEffect(id)}</span>
          <span className="dim small">{g.flavor}</span>
          <span className="small">{t("지금 착용: {gear}", { gear: cur ? `${GEAR[cur].name} (${gearEffect(cur) || t("효과 없음")})` : t("없음") })}</span>
        </div>
        <div className="choices">
          <button className="btn primary" disabled={busy} onClick={() => go({ t: "pending", choice: "equip" })}>
            {cur ? t("착용한다 — {name}은 두고 간다", { name: GEAR[cur].name }) : t("착용한다")}
          </button>
          <button className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: "leave" })}>
            {t("두고 간다")}
          </button>
        </div>
      </>
    );
  }

  if (dg.pending?.kind === "frag") {
    const id = dg.pending.frag;
    const f = FRAGMENTS[id];
    const sk = f.skill ? SKILLS[f.skill] : null;
    const slots = fragSlots(s.hero.level);
    const full = s.fragments.length >= slots;
    const known = fragKnown(s, id);
    return (
      <>
        <p className="dock-title">{t("편린이 남았다 — 흡수할까?")} <span className="dim small">{t("(칸 {n}/{max})", { n: s.fragments.length, max: slots })}</span></p>
        {known ? (
          <div className="loot-card has-icon">
            <FragIcon tier={f.tier} scale={2} />
            <b>
              {f.name} <span className="dim small">{TIER_LABEL[f.tier]}</span>
            </b>
            <span className="accent small">{fragStatText(id)}</span>
            {sk ? (
              <span className="small">
                【{sk.name}】 {sk.kind === "active" ? t("자동 발동") : t("패시브")} · {sk.desc}
              </span>
            ) : (
              <span className="dim small">{t("특별한 능력은 없다.")}</span>
            )}
            <span className="dim small">{f.flavor}</span>
          </div>
        ) : (
          <div className="loot-card has-icon">
            <FragIcon tier={f.tier} scale={2} hidden />
            <b>
              {f.name} <span className="dim small">{t("처음 보는 편린")}</span>
            </b>
            <span className="accent small">{t("능력치 ???")}</span>
            <span className="small">{t("능력 ???")}</span>
            <span className="dim small">{t("흡수해 보기 전에는 무엇을 줄지 알 수 없다. 흡수하면 도감에 기록된다.")}</span>
          </div>
        )}
        <div className="choices">
          {!full && (
            <button className="btn primary" disabled={busy} onClick={() => go({ t: "pending", choice: "absorb" })}>
              {t("흡수한다")}
            </button>
          )}
          {full &&
            s.fragments.map((old, i) => (
              <button key={i} className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: `swap${i}` })}>
                {t("{name|을} 깨뜨리고 흡수", { name: FRAGMENTS[old].name })} <span className="dim small">· {fragStatText(old)}</span>
              </button>
            ))}
          <button className="btn ghost" disabled={busy} onClick={() => go({ t: "pending", choice: "leave" })}>
            {t("흩어지게 둔다")}
          </button>
        </div>
      </>
    );
  }

  if (dg.pending?.kind === "scepter") {
    const open = trueEndingOpen(s);
    const lock = trueEndingLock(s);
    return (
      <>
        <p className="dock-title">{t("셉터의 제단 — 무엇을 할까?")}</p>
        <p className="dim small">{t("6섹터 클리어. 진실 조각 {n}/{total} (진엔딩에 {need}개 + 이번 삶의 영주의 칙서 + 옛 신을 섬기는 중).", { n: clueCount(s), total: CLUES.length, need: clueNeed(s) })}</p>
        <div className="choices">
          <button className="btn primary" disabled={busy || s.heretic} onClick={() => go({ t: "pending", choice: "take" })}>
            {t("셉터를 든다")} <span className="dim small">· {s.heretic ? t("이단은 영주성에 들어갈 수 없다") : t("영주에게 바친다 — 일반 엔딩, 삶이 끝난다")}</span>
          </button>
          <button className="btn" disabled={busy || !open} onClick={() => go({ t: "pending", choice: "leave" })}>
            {open ? <>{t("셉터를 두고 간다")} <span className="dim small">· {t("영주성 결전 — 진엔딩 도전(지면 그대로 끝)")}</span></> : <>??? <span className="dim small">· {lock.join(" · ")}</span></>}
          </button>
          <button className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: "hold" })}>
            {t("보류하고 돌아간다")} <span className="dim small">· {t("6섹터 클리어 인정, 삶이 이어진다(다음엔 화신과 다시 싸운다)")}</span>
          </button>
          <button className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: "down" })}>
            {t("제단 아래로")} <span className="dim small">· {t("끝없는 미궁(남은 시간 그대로)")}</span>
          </button>
        </div>
      </>
    );
  }

  if (dg.pending) {
    const seal = dg.pending.kind === "trap" && isSealDoor(room) ? SEAL_DOOR[room.trapKind as "rune"] : null;
    const optKey = seal ? "seal" : dg.pending.kind === "confession" ? (s.hero.faith ? "confessionFaith" : "confessionNone") : dg.pending.kind === "trap" && room.trapKind === "ledge" ? "ledge" : dg.pending.kind;
    return (
      <>
        <p className="dock-title">{t("{name} — 어떻게 할까?", { name: seal ? seal.name : ROOM_LABEL[room.type] })}</p>
        {seal && <p className="dim small">{seal.flavor} {t("실패하거나 강행하면 봉인의 수호자(HP 150)와 싸워야 지난다. 지면 죽지 않고 HP 1로 문 밖에 쓰러진다.")}{s.heretic && s.hero.faith ? t(" 이단의 고집: 판정 +3.") : ""}</p>}
        {dg.pending.kind === "altars" && (
          <p className="dim small">
            {s.hero.faith ? t("섬기는 신({god})의 제단: 신앙심 +10{extra}. ", { god: s.hero.faith, extra: s.hero.cls === "adventurer" ? (s.godTeaching ? "" : t(" — 무언가 더 기다리는 기척이 있다")) : s.relic ? "" : t(", 그 신의 유물 하나(삶마다 하나)") }) : ""}
            {t("다른 해금된 신의 제단마다 응답 하나 — 화신과 싸울 때 한 번씩 돕는다(2d6). HP +10.")} {s.faithsKnown.some((f) => f !== s.hero.faith) && t("여기서 개종할 수도 있다.")}
          </p>
        )}
        {dg.pending.kind === "confession" && <p className="dim small">{s.hero.faith ? t("그 자리에서 이단 심문이다. 부정하면 신앙을 잃고, 거부하면 현상수배가 되어 심문관장(HP 140)과 싸운다 — 이기면 신앙심 +20과 영주의 칙서.") : t("무신앙이라 심문당하지 않는다. 캐물으면 영주의 칙서를 볼 수 있을지도 모른다.")}</p>}
        {dg.pending.kind === "offerbox" && <p className="dim small">{t("마석이나 성물(정화 1번 막기), 불탄 문서(기록물)가 나온다.")}</p>}
        {dg.pending.kind === "lostScroll" && (
          <p className="dim small">{t("첫 미궁에서는 2층으로 내려갈 수 없다. 주문서는 여기 그대로 있으니, 1층을 더 돌다가 다시 와서 써도 된다. 쓰지 않으면 시간이 다 될 때까지 1층에 머문다.")}</p>
        )}
        {dg.pending.kind === "portal" && dg.sector >= LAST_SECTOR && (
          <p className="dim small">{t("{n}섹터 클리어. 들어가면 끝없는 미궁 — 함정 없이 몬스터만, 층마다 더 강해지고 계단은 끝없이 이어진다. 돌아오는 길은 귀환 주문서뿐(아니면 시간이 다 될 때까지). 남은 시간은 그대로다.", { n: dg.sector })}</p>
        )}
        {dg.pending.kind === "portal" && dg.sector < LAST_SECTOR && (
          <p className="dim small">{t("들어가면 {next}섹터 — {name}. 남은 시간이 두 배가 된다({a} → {b}). 돌아가도 {n}섹터 클리어는 인정된다.", { next: dg.sector + 1, name: SECTOR_NAME[dg.sector + 1], a: fmtTime(dg.turnsLeft), b: fmtTime(dg.turnsLeft * 2), n: dg.sector })}</p>
        )}
        {dg.pending.kind === "record" && dg.sector === 3 && <p className="dim small">{t("물에 불은 경전이다. 말리면서 읽어야 해서 4시간이 걸린다.")}</p>}
        {dg.pending.kind === "trap" && MINE_TRAP_NOTE[room.trapKind ?? ""] && <p className="dim small">{t(MINE_TRAP_NOTE[room.trapKind!])}</p>}
        {dg.pending.kind === "trap" && room.trapKind === "ledge" && (
          <p className="dim small">{t("발 하나 디딜 만한 벼랑길. 떨어지면 아래층으로(3층이면 바닥 없는 틈으로) 떨어진다.")}{isNight(s) ? t(" 들숨이라 어둡다(판정 −2).") : ""}</p>
        )}
        {dg.pending.kind === "plenty" && (
          <p className="dim small">{t("고기를 바치면 반반: 풍요의 얼굴(포만감 100, HP +10) 또는 기아의 얼굴(포만감 −30, 이 층에서 피해 +2).")}{godOf(s.hero.faith)?.key === "hunger" ? t(" 기아/풍요의 신도는 원하는 얼굴을 고른다(풍요, 신앙심 +3).") : ""}{t(" 가진 고기 {n}개.", { n: s.inventory.food })}</p>
        )}
        {dg.pending.kind === "magazine" && (
          <p className="dim small">{t("화약통(큰 전투가 시작될 때 알아서 던진다)이나 장비·장부가 나온다. 공기가 고여 있을 때 뒤지면 폭발할 수 있다.")}{godOf(s.hero.faith)?.key === "trap" ? t(" 재앙의 신도는 기도할 수 있다(신앙심 +3).") : ""}</p>
        )}
        {dg.pending.kind === "altar" && (
          <p className="dim small">{t("뒤지면 낡은 장비나 기도문이 나오기도 하지만, 썩은 제물에 독이 있을 수 있다.")}{s.hero.faith && godOf(s.hero.faith)?.key === "plague" ? t(" 역병의 신도는 기도할 수 있다(신앙심 +3).") : ""}</p>
        )}
        {dg.pending.kind === "shrine" && (
          <p className="dim small">
            {s.hero.faith ? t("섬기는 신: {god} (신앙심 {n}) — 기도하면 신앙심 +5.", { god: s.hero.faith, n: Math.floor(s.piety) }) : t("섬기는 신이 없다.")}
            {s.faithsKnown.some((f) => f !== s.hero.faith) && (s.hero.faith ? t(" 다른 옛 신으로 개종할 수 있다 — 버린 신은 1개월 동안 저주를 건다.") : t(" 다른 옛 신으로 개종할 수 있다."))}
          </p>
        )}
        {dg.pending.kind === "trap" && room.ambushKnown && room.ambush && (
          <p className="dim small">{t("고블린 {n}마리가 숨어 있다. 해체하면 달아나고, 밟고 다치면 기습당한다.", { n: room.ambush.length })}</p>
        )}
        <div className="choices">
          {dg.pending.kind === "trap" && room.trapKind === "ledge" && s.inventory.rope > 0 && (
            <button className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: "rope" })}>
              {t("밧줄을 건다")} <span className="dim small">· {t("반드시 건넌다 (남은 밧줄 {n})", { n: s.inventory.rope })}</span>
            </button>
          )}
          {PENDING_OPTIONS[optKey]
            .filter((o) => o.choice !== "back" || dg.prev !== null)
            .filter((o) => dg.pending!.kind !== "altar" || o.choice !== "pray" || godOf(s.hero.faith)?.key === "plague")
            .filter((o) => dg.pending!.kind !== "magazine" || o.choice !== "pray" || godOf(s.hero.faith)?.key === "trap")
            .filter((o) => dg.pending!.kind !== "trap" || o.choice !== "disarm" || room.trapKind !== "ice")
            .map((o) => (
              <button key={o.choice} className={`btn${o.primary ? " primary" : ""}`} disabled={busy} onClick={() => go({ t: "pending", choice: o.choice })}>
                {seal && o.choice === "disarm" ? `${seal.verb} (${seal.stat === "int" ? t("지능") : seal.stat === "str" ? t("힘") : t("감각")} DC ${BAL.sealDc})` : dg.pending!.kind === "record" && o.choice === "read" && dg.sector === 3 ? t("말리며 읽는다 (4시간)") : dg.pending!.kind === "trap" && o.choice === "disarm" && MINE_DISARM[room.trapKind ?? ""] ? t(MINE_DISARM[room.trapKind!]) : o.label && t(o.label, o.dc === undefined ? undefined : { dc: o.dc })}
              </button>
            ))}
          {dg.pending.kind === "trap" && (room.trapKind === "pit" || room.trapKind === "ledge") && power(s, "abyss", 1) && (dg.floor < 3 || power(s, "abyss", 5)) && (
            <button className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: "jump" })}>
              {t("심연으로 뛰어내린다")} <span className="dim small">· {t("아래층 지름길 (1d6 피해)")}</span>
            </button>
          )}
          {(dg.pending.kind === "shrine" || dg.pending.kind === "altars") &&
            s.faithsKnown.map((f, i) =>
              f === s.hero.faith || !godOf(f) ? null : (
                <button key={f} className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: `convert${i}` })}>
                  {t("{god|을} 섬긴다", { god: f })} <span className="dim small">· {t("개종 (1시간)")}</span>
                </button>
              ),
            )}
        </div>
      </>
    );
  }

  const hpLow = s.hero.hp < maxHp(s) * 0.5;
  return (
    <>
      <div className="util">
        <button className="btn small" disabled={busy} onClick={() => go({ t: "camp" })}>
          <Icon name="camp" />{t("야영 8h")}
        </button>
        <button className="btn small" disabled={busy || s.inventory.food <= 0} onClick={() => go({ t: "eat" })}>
          <Icon name="meat" />{t("먹기")} {s.inventory.food}
        </button>
        <button className={`btn small${hpLow ? " primary" : ""}`} disabled={busy || s.inventory.potion <= 0} onClick={() => go({ t: "potion" })}>
          <Icon name="potion" />{t("물약")} {s.inventory.potion}
        </button>
        <button className="btn small" disabled={busy || s.inventory.scroll <= 0} onClick={() => go({ t: "scroll" })}>
          <Icon name="scroll" />{t("귀환")} {s.inventory.scroll}
        </button>
        {s.gear.offhand === "rgHandXbow" && (
          <span className="btn small util-count" title={t("손쇠뇌 볼트(이긴 전투에서 쏜 것의 절반을 주워 온다)")}>
            {t("볼트")} {s.inventory.bolt}
          </span>
        )}
        {s.inventory.bandage > 0 && (
          <button className="btn small" disabled={busy} onClick={() => go({ t: "bandage" })}>
            {t("붕대")} {s.inventory.bandage}
          </button>
        )}
        {s.inventory.herb > 0 && s.disease > 0 && (
          <button className="btn small" disabled={busy} onClick={() => go({ t: "herb" })}>
            {t("탕약")} {s.inventory.herb}
          </button>
        )}
        {s.inventory.antidote > 0 && (poisonOf(s) > 0 || anyParalysis(s)) && (
          <button className="btn small" disabled={busy} onClick={() => go({ t: "antidote" })}>
            {t("해독초")} {s.inventory.antidote}
          </button>
        )}
        {s.inventory.salve > 0 && burnParts(s).length > 0 && (
          <button className="btn small" disabled={busy} onClick={() => go({ t: "salve" })}>
            {t("연고")} {s.inventory.salve}
          </button>
        )}
        {s.inventory.whetstone > 0 && corrodedSlots(s).length > 0 && (
          <button className="btn small" disabled={busy} onClick={() => go({ t: "whetstone" })}>
            {t("숫돌")} {s.inventory.whetstone}
          </button>
        )}
      </div>
      <p className="dock-title">{t("{room} — 어디로 갈까?", { room: ROOM_LABEL[room.type] })} <span className="dim small">{t("(한 방 2시간)")}</span></p>
      <div className="choices">
        {room.edges.map((id) => {
          const nb = dg.rooms[id];
          const label = nb.visited || nb.known ? (nb.respawned && !nb.resolved ? t("새로운 기척") : ROOM_LABEL[nb.type]) + (nb.ambushKnown && nb.ambush ? ` · ${t("고블린 매복")}` : "") : "???";
          const seen = nb.visited || nb.known;
          const water = seen && nb.radiant ? t("성광 방(신앙심 −3)") : seen && nb.flooded ? (nb.deep ? t("깊은 물") : highTide(s) ? t("물에 잠김(느림)") : t("물에 잠김")) : seen && nb.ice ? t("얼음 구역(냉기)") : seen && nb.hot ? (stagnant(s) ? t("뜨거운 방(화상 위험)") : t("뜨거운 방")) : seen && nb.pool ? t("지하수") : seen && nb.cliff ? t("벼랑 위") : "";
          const note = [id === dg.prev ? t("왔던 길") : nb.visited ? t("가 본 곳") : "", water].filter(Boolean).join(" · ");
          const danger = (nb.known || nb.visited) && !nb.resolved && ["combat", "trap", "boss"].includes(nb.type);
          return (
            <button key={id} className={`btn path${danger ? " risky" : ""}`} disabled={busy} onClick={() => go({ t: "move", room: id })}>
              <RoomIcon type={nb.visited || nb.known ? (nb.respawned && !nb.resolved ? "combat" : nb.type) : null} />
              <span>{label} {note && <span className="dim small">· {note}</span>}</span>
              <span className="path-go"><Icon name="chev" /></span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** 갈림길 버튼 앞 방 아이콘. 모르는 방은 빈 자리(물음표 글자로 이미 읽힌다) */
function RoomIcon({ type }: { type: string | null }) {
  const a = type ? ROOM_ICON[type] : null;
  return <span className="room-icon">{a && <img src={a.src} width={a.w} height={a.h} alt="" />}</span>;
}

/** 지도 칸 배경: 섹터 장소 그림을 2배로 깔고 어둡게 눌러 지도 점·선이 먼저 읽히게 한다 */
function mapBackdrop(dg: DungeonState, night: boolean): CSSProperties | undefined {
  // 밤 그림이 있는 섹터는 밤에 바꿔 깐다(이미 어두운 그림이라 덧칠을 옅게)
  const nightArt = night && !dg.endless ? SCENE_ART[`dungeon${dg.sector}night`] : undefined;
  const a = nightArt ?? SCENE_ART[dg.endless ? "endless" : `dungeon${dg.sector}`];
  if (!a) return undefined;
  const shade = nightArt ? 0.35 : 0.62;
  return {
    backgroundImage: `linear-gradient(rgba(12, 10, 7, ${shade}), rgba(12, 10, 7, ${shade})), url(${a.src})`,
    backgroundSize: `auto, ${a.w * 2}px ${a.h * 2}px`,
    backgroundPosition: "center, center 40%",
    backgroundRepeat: "no-repeat",
  };
}

/** 방 그래프 지도: 입구에서의 거리로 가로 배치. 가 본 방과 그 이웃만 그린다 */
function FloorMap({ dg, night }: { dg: DungeonState; night: boolean }) {
  const visible = new Set<number>();
  for (const r of dg.rooms) {
    if (r.visited) {
      visible.add(r.id);
      r.edges.forEach((e) => visible.add(e));
    }
  }
  const cols = new Map<number, number[]>();
  for (const r of dg.rooms) {
    const list = cols.get(r.depth) ?? [];
    list.push(r.id);
    cols.set(r.depth, list);
  }
  const maxDepth = Math.max(...dg.rooms.map((r) => r.depth));
  const W = 320;
  const H = 120;
  const pos = new Map<number, { x: number; y: number }>();
  for (const [depth, ids] of cols) {
    ids.forEach((id, i) => {
      pos.set(id, { x: 16 + (depth / Math.max(1, maxDepth)) * (W - 32), y: ((i + 1) / (ids.length + 1)) * H });
    });
  }
  return (
    <svg className="floormap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("층 지도")} style={mapBackdrop(dg, night)}>
      {dg.rooms.map((r) =>
        r.edges
          .filter((e) => e > r.id && visible.has(e) && visible.has(r.id) && (r.visited || dg.rooms[e].visited))
          .map((e) => {
            const a = pos.get(r.id)!;
            const b = pos.get(e)!;
            return <line key={`${r.id}-${e}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="map-edge" />;
          }),
      )}
      {dg.rooms
        .filter((r) => visible.has(r.id))
        .map((r) => {
          const p = pos.get(r.id)!;
          const cls = r.id === dg.current ? "here" : r.visited ? "visited" : r.known ? "known" : "unknown";
          return (
            <g key={r.id}>
              {r.id === dg.current && <circle cx={p.x} cy={p.y} r={7} className="map-here-ring" />}
              <circle cx={p.x} cy={p.y} r={r.id === dg.current ? 7 : 5} className={`map-node ${cls} t-${r.type}`} />
              {dg.sweeperRoom === r.id && !dg.sweeperDown && <circle cx={p.x} cy={p.y} r={10} className="map-sweeper" />}
              {(r.known || r.visited) && <text x={p.x} y={p.y - 9} className="map-label">{ROOM_SHORT[r.type]}</text>}
            </g>
          );
        })}
    </svg>
  );
}

