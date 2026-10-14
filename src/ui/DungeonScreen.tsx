import type { CSSProperties } from "react";
import { maxHp } from "../game/core";
import { ROOM_LABEL, ROOM_SHORT, currentRoom, isNight } from "../game/dungeon";
import type { PendingChoice } from "../game/dungeon";
import type { DungeonState, GameState } from "../game/types";
import { sweeperDistance, sweeperThreat } from "../game/sweeper";
import { BAL } from "../game/data";
import { GEAR, gearEffect, targetSlot } from "../game/gear";
import { FRAGMENTS, TIER_LABEL, fragKnown, fragSlots, fragStatText } from "../game/fragments";
import { SKILLS } from "../game/skills";
import type { Ctl } from "./App";
import { josa } from "../game/josa";
import { godOf, power } from "../game/faith";
import { Bar, FragIcon, GameScreen, GearIcon, HeroHeader, LogView } from "./components";
import { ROOM_ICON, SCENE_ART } from "./art";

function fmtTime(turns: number): string {
  const h = Math.max(0, turns) / 2;
  const d = Math.floor(h / 24);
  const hh = Math.floor(h % 24);
  return d > 0 ? `${d}일 ${hh}시간` : `${hh}시간`;
}

export function DungeonScreen({ ctl }: { ctl: Ctl }) {
  const { s } = ctl;
  const dg = s.dungeon!;
  return (
    <GameScreen
      ctl={ctl}
      title={dg.endless ? `끝없는 미궁 ${dg.floor}층` : `${dg.sector}섹터 ${dg.floor}층 · ${dg.sector >= 2 ? (isNight(s) ? "밤" : "낮") : "미궁"}`}
      header={
        <>
          <HeroHeader s={s} onOpen={() => ctl.setSheet(true)} extra={<span>마석 {dg.mana}G</span>} />
          <div className="survival">
            <div>
              <span className="dim small">시간 <b className="num">{fmtTime(dg.turnsLeft)}</b></span>
              <Bar value={dg.turnsLeft} max={BAL.weekTurns} tone="tired" />
            </div>
            <div>
              <span className="dim small">포만감 <b className="num">{Math.round(s.hero.satiety)}</b></span>
              <Bar value={s.hero.satiety} max={100} tone="food" />
            </div>
            <div>
              <span className="dim small">피로도 <b className="num">{Math.round(s.hero.fatigue)}</b></span>
              <Bar value={s.hero.fatigue} max={100} tone="tired" />
            </div>
          </div>
        </>
      }
      dock={<RoomDock ctl={ctl} />}
    >
      <FloorMap dg={dg} />
      <SweeperWarn s={s} />
      <LogView ctl={ctl} fill />
    </GameScreen>
  );
}

const PENDING_OPTIONS: Record<string, { choice: PendingChoice; label: string; primary?: boolean }[]> = {
  trap: [
    { choice: "disarm", label: `해체한다 (민첩 DC ${BAL.trapDisarmDc})`, primary: true },
    { choice: "force", label: `조심해서 지나간다 (민첩 DC ${BAL.trapDodgeDc}로 회피)` },
    { choice: "back", label: "왔던 길로 물러난다" },
  ],
  treasure: [
    { choice: "open", label: "상자를 연다", primary: true },
    { choice: "leave", label: "그냥 둔다" },
  ],
  record: [
    { choice: "read", label: "읽는다 (30분)", primary: true },
    { choice: "leave", label: "지나친다" },
  ],
  shrine: [
    { choice: "pray", label: "무릎 꿇고 기도한다 (1시간)", primary: true },
    { choice: "leave", label: "지나친다" },
  ],
  stairs: [
    { choice: "descend", label: "아래층으로 내려간다", primary: true },
    { choice: "stay", label: "이 층을 더 둘러본다" },
  ],
  lostScroll: [
    { choice: "use", label: "주문서를 찢고 돌아간다 (마석을 챙겨 귀환)", primary: true },
    { choice: "stay", label: "두고, 1층을 더 둘러본다" },
  ],
  portal: [
    { choice: "enter", label: "차원문으로 들어간다", primary: true },
    { choice: "return", label: "여기까지 — 마석을 챙겨 돌아간다" },
    { choice: "stay", label: "아직은 아니다" },
  ],
  relic: [
    { choice: "search", label: "녹슨 무기 더미를 뒤진다 (1시간)", primary: true },
    { choice: "leave", label: "죽은 자들의 물건은 건드리지 않는다" },
  ],
};

/** 미궁의 청소부 예고·추적 */
function SweeperWarn({ s }: { s: GameState }) {
  const dg = s.dungeon!;
  if (!sweeperThreat(s)) return null;
  const dist = sweeperDistance(s);
  return (
    <p className="sweeper-warn">
      {dist === null
        ? "이 층에 너무 오래 머물렀다 — 무언가 오고 있다. 계단으로 내려가거나 미궁을 나가면 피할 수 있다."
        : `미궁의 청소부가 쫓아온다 — ${dist}방 거리. 방을 옮길 때마다 한 방, 야영하면 두 방 다가온다.`}
      {dg.sweeperStage === 3 && dist !== null && dist <= 1 && " 바로 옆이다!"}
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
        <p className="dock-title">장비를 발견했다</p>
        <div className="loot-card has-gear">
          <GearIcon id={id} scale={2} />
          <b>{g.name}</b>
          <span className="accent small">{gearEffect(id)}</span>
          <span className="dim small">{g.flavor}</span>
          <span className="small">지금 착용: {cur ? `${GEAR[cur].name} (${gearEffect(cur) || "효과 없음"})` : "없음"}</span>
        </div>
        <div className="choices">
          <button className="btn primary" disabled={busy} onClick={() => go({ t: "pending", choice: "equip" })}>
            {cur ? `착용한다 — ${GEAR[cur].name}은 두고 간다` : "착용한다"}
          </button>
          <button className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: "leave" })}>
            두고 간다
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
        <p className="dock-title">편린이 남았다 — 흡수할까? <span className="dim small">(칸 {s.fragments.length}/{slots})</span></p>
        {known ? (
          <div className="loot-card has-icon">
            <FragIcon tier={f.tier} scale={2} />
            <b>
              {f.name} <span className="dim small">{TIER_LABEL[f.tier]}</span>
            </b>
            <span className="accent small">{fragStatText(id)}</span>
            {sk ? (
              <span className="small">
                【{sk.name}】 {sk.kind === "active" ? "자동 발동" : "패시브"} · {sk.desc}
              </span>
            ) : (
              <span className="dim small">특별한 능력은 없다.</span>
            )}
            <span className="dim small">{f.flavor}</span>
          </div>
        ) : (
          <div className="loot-card has-icon">
            <FragIcon tier={f.tier} scale={2} hidden />
            <b>
              {f.name} <span className="dim small">처음 보는 편린</span>
            </b>
            <span className="accent small">능력치 ???</span>
            <span className="small">능력 ???</span>
            <span className="dim small">흡수해 보기 전에는 무엇을 줄지 알 수 없다. 흡수하면 도감에 기록된다.</span>
          </div>
        )}
        <div className="choices">
          {!full && (
            <button className="btn primary" disabled={busy} onClick={() => go({ t: "pending", choice: "absorb" })}>
              흡수한다
            </button>
          )}
          {full &&
            s.fragments.map((old, i) => (
              <button key={i} className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: `swap${i}` })}>
                {josa(FRAGMENTS[old].name, "을")} 깨뜨리고 흡수 <span className="dim small">· {fragStatText(old)}</span>
              </button>
            ))}
          <button className="btn ghost" disabled={busy} onClick={() => go({ t: "pending", choice: "leave" })}>
            흩어지게 둔다
          </button>
        </div>
      </>
    );
  }

  if (dg.pending) {
    return (
      <>
        <p className="dock-title">{ROOM_LABEL[room.type]} — 어떻게 할까?</p>
        {dg.pending.kind === "lostScroll" && (
          <p className="dim small">첫 미궁에서는 2층으로 내려갈 수 없다. 주문서는 여기 그대로 있으니, 1층을 더 돌다가 다시 와서 써도 된다. 쓰지 않으면 시간이 다 될 때까지 1층에 머문다.</p>
        )}
        {dg.pending.kind === "portal" && dg.sector === 2 && (
          <p className="dim small">2섹터 클리어. 들어가면 끝없는 미궁 — 함정 없이 몬스터만, 층마다 더 강해지고 계단은 끝없이 이어진다. 돌아오는 길은 귀환 주문서뿐(아니면 시간이 다 될 때까지). 남은 시간은 그대로다.</p>
        )}
        {dg.pending.kind === "portal" && dg.sector === 1 && (
          <p className="dim small">들어가면 2섹터 — 잊힌 전쟁터의 초원. 남은 시간이 두 배가 된다({fmtTime(dg.turnsLeft)} → {fmtTime(dg.turnsLeft * 2)}). 돌아가도 1섹터 클리어는 인정된다.</p>
        )}
        {dg.pending.kind === "shrine" && (
          <p className="dim small">
            {s.hero.faith ? `섬기는 신: ${s.hero.faith} (신앙심 ${Math.floor(s.piety)}) — 기도하면 신앙심 +5.` : "섬기는 신이 없다."}
            {s.faithsKnown.some((f) => f !== s.hero.faith) && " 다른 옛 신으로 개종할 수 있다" + (s.hero.faith ? ` — 버린 신은 1개월 동안 저주를 건다.` : ".")}
          </p>
        )}
        {dg.pending.kind === "trap" && room.ambushKnown && room.ambush && (
          <p className="dim small">고블린 {room.ambush.length}마리가 숨어 있다. 해체하면 달아나고, 밟고 다치면 기습당한다.</p>
        )}
        <div className="choices">
          {PENDING_OPTIONS[dg.pending.kind]
            .filter((o) => o.choice !== "back" || dg.prev !== null)
            .map((o) => (
              <button key={o.choice} className={`btn${o.primary ? " primary" : ""}`} disabled={busy} onClick={() => go({ t: "pending", choice: o.choice })}>
                {o.label}
              </button>
            ))}
          {dg.pending.kind === "trap" && room.trapKind === "pit" && power(s, "abyss", 1) && dg.floor < 3 && (
            <button className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: "jump" })}>
              심연으로 뛰어내린다 <span className="dim small">· 아래층 지름길 (1d6 피해)</span>
            </button>
          )}
          {dg.pending.kind === "shrine" &&
            s.faithsKnown.map((f, i) =>
              f === s.hero.faith || !godOf(f) ? null : (
                <button key={f} className="btn" disabled={busy} onClick={() => go({ t: "pending", choice: `convert${i}` })}>
                  {josa(f, "을")} 섬긴다 <span className="dim small">· 개종 (1시간)</span>
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
          야영 8h
        </button>
        <button className="btn small" disabled={busy || s.inventory.food <= 0} onClick={() => go({ t: "eat" })}>
          먹기 {s.inventory.food}
        </button>
        <button className={`btn small${hpLow ? " primary" : ""}`} disabled={busy || s.inventory.potion <= 0} onClick={() => go({ t: "potion" })}>
          물약 {s.inventory.potion}
        </button>
        <button className="btn small" disabled={busy || s.inventory.scroll <= 0} onClick={() => go({ t: "scroll" })}>
          귀환 {s.inventory.scroll}
        </button>
        {s.inventory.bandage > 0 && (
          <button className="btn small" disabled={busy} onClick={() => go({ t: "bandage" })}>
            붕대 {s.inventory.bandage}
          </button>
        )}
        {s.inventory.herb > 0 && s.disease > 0 && (
          <button className="btn small" disabled={busy} onClick={() => go({ t: "herb" })}>
            탕약 {s.inventory.herb}
          </button>
        )}
      </div>
      <p className="dock-title">{ROOM_LABEL[room.type]} — 어디로 갈까? <span className="dim small">(한 방 2시간)</span></p>
      <div className="choices">
        {room.edges.map((id) => {
          const nb = dg.rooms[id];
          const label = nb.visited || nb.known ? (nb.respawned && !nb.resolved ? "새로운 기척" : ROOM_LABEL[nb.type]) + (nb.ambushKnown && nb.ambush ? " · 고블린 매복" : "") : "???";
          const note = id === dg.prev ? "왔던 길" : nb.visited ? "가 본 곳" : "";
          const danger = (nb.known || nb.visited) && !nb.resolved && ["combat", "trap", "boss"].includes(nb.type);
          return (
            <button key={id} className={`btn path${danger ? " risky" : ""}`} disabled={busy} onClick={() => go({ t: "move", room: id })}>
              <RoomIcon type={nb.visited || nb.known ? (nb.respawned && !nb.resolved ? "combat" : nb.type) : null} />
              {label} {note && <span className="dim small">· {note}</span>}
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
function mapBackdrop(dg: DungeonState): CSSProperties | undefined {
  const a = SCENE_ART[`dungeon${dg.sector}`];
  if (!a) return undefined;
  return {
    backgroundImage: `linear-gradient(rgba(12, 10, 7, 0.62), rgba(12, 10, 7, 0.62)), url(${a.src})`,
    backgroundSize: `auto, ${a.w * 2}px ${a.h * 2}px`,
    backgroundPosition: "center, center 40%",
    backgroundRepeat: "no-repeat",
  };
}

/** 방 그래프 지도: 입구에서의 거리로 가로 배치. 가 본 방과 그 이웃만 그린다 */
function FloorMap({ dg }: { dg: DungeonState }) {
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
    <svg className="floormap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="층 지도" style={mapBackdrop(dg)}>
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
              <circle cx={p.x} cy={p.y} r={r.id === dg.current ? 7 : 5} className={`map-node ${cls} t-${r.type}`} />
              {dg.sweeperRoom === r.id && !dg.sweeperDown && <circle cx={p.x} cy={p.y} r={10} className="map-sweeper" />}
              {(r.known || r.visited) && <text x={p.x} y={p.y - 9} className="map-label">{ROOM_SHORT[r.type]}</text>}
            </g>
          );
        })}
    </svg>
  );
}

