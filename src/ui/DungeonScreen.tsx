import { maxHp } from "../game/core";
import { ROOM_LABEL, ROOM_SHORT, currentRoom } from "../game/dungeon";
import type { PendingChoice } from "../game/dungeon";
import type { DungeonState } from "../game/types";
import { BAL } from "../game/data";
import type { Ctl } from "./App";
import { Bar, Card, HeroHeader, LogView, Shell, SpeedBar, TacticsBar, TopBar } from "./components";

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
    <Shell>
      <TopBar ctl={ctl} title={`${dg.sector}섹터 ${dg.floor}층 · 미궁`} />
      <HeroHeader s={s} extra={<span>마석 {dg.mana}G</span>} />
      <div className="survival">
        <div>
          <span className="dim small">남은 시간</span>
          <Bar value={dg.turnsLeft} max={BAL.weekTurns} tone="tired" />
          <span className="small num">{fmtTime(dg.turnsLeft)}</span>
        </div>
        <div>
          <span className="dim small">포만감</span>
          <Bar value={s.hero.satiety} max={100} tone="food" />
          <span className="small num">{Math.round(s.hero.satiety)}</span>
        </div>
        <div>
          <span className="dim small">피로도</span>
          <Bar value={s.hero.fatigue} max={100} tone="tired" />
          <span className="small num">{Math.round(s.hero.fatigue)}</span>
        </div>
      </div>
      <FloorMap dg={dg} />
      <RoomPanel ctl={ctl} />
      <LogView ctl={ctl} tall />
      <SpeedBar ctl={ctl} />
    </Shell>
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
  portal: [
    { choice: "enter", label: "차원문으로 들어간다", primary: true },
    { choice: "stay", label: "아직은 아니다" },
  ],
};

function RoomPanel({ ctl }: { ctl: Ctl }) {
  const { s, dispatch, busy } = ctl;
  const dg = s.dungeon!;
  const room = currentRoom(s);
  if (busy) return <Card title={ROOM_LABEL[room.type]}>…</Card>;

  if (dg.pending) {
    return (
      <Card title={ROOM_LABEL[room.type]} className="decision">
        <div className="choices">
          {PENDING_OPTIONS[dg.pending.kind]
            .filter((o) => o.choice !== "back" || dg.prev !== null)
            .map((o) => (
              <button key={o.choice} className={`btn${o.primary ? " primary" : ""}`} onClick={() => dispatch({ t: "pending", choice: o.choice })}>
                {o.label}
              </button>
            ))}
        </div>
      </Card>
    );
  }

  const hpLow = s.hero.hp < maxHp(s) * 0.5;
  return (
    <Card title={`${ROOM_LABEL[room.type]} — 어디로 갈까?`}>
      <div className="choices">
        {room.edges.map((id) => {
          const nb = dg.rooms[id];
          const label = nb.visited || nb.known ? ROOM_LABEL[nb.type] : "???";
          const note = id === dg.prev ? "왔던 길" : nb.visited ? "가 본 곳" : "";
          const danger = (nb.known || nb.visited) && !nb.resolved && ["combat", "trap", "boss"].includes(nb.type);
          return (
            <button key={id} className={`btn path${danger ? " danger" : ""}`} onClick={() => dispatch({ t: "move", room: id })}>
              {label} {note && <span className="dim small">· {note}</span>}
              <span className="dim small"> · 2시간</span>
            </button>
          );
        })}
      </div>
      <div className="util">
        <button className="btn small" onClick={() => dispatch({ t: "camp" })}>
          야영 (8시간)
        </button>
        <button className="btn small" disabled={s.inventory.food <= 0} onClick={() => dispatch({ t: "eat" })}>
          먹기 ({s.inventory.food})
        </button>
        <button className={`btn small${hpLow ? " primary" : ""}`} disabled={s.inventory.potion <= 0} onClick={() => dispatch({ t: "potion" })}>
          물약 ({s.inventory.potion})
        </button>
        <button className="btn small" disabled={s.inventory.scroll <= 0} onClick={() => dispatch({ t: "scroll" })}>
          귀환 ({s.inventory.scroll})
        </button>
      </div>
      <TacticsBar ctl={ctl} />
    </Card>
  );
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
    <svg className="floormap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="층 지도">
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
              {(r.known || r.visited) && <text x={p.x} y={p.y - 9} className="map-label">{ROOM_SHORT[r.type]}</text>}
            </g>
          );
        })}
    </svg>
  );
}

