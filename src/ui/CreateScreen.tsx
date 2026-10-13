import { useState } from "react";
import { INTRO, NAMES, STAT_KEYS, STAT_LABEL, BAL } from "../game/data";
import { mod } from "../game/core";
import { CLASSES, CLASS_IDS, type ClassId } from "../game/classes";
import { GEAR } from "../game/gear";
import { TRAININGS } from "../game/data";
import { kitItems } from "../game/town";
import type { Ctl } from "./App";
import { Bar, Card, Shell, fmtMod } from "./components";

export function CreateScreen({ ctl }: { ctl: Ctl }) {
  const { s, meta, dispatch } = ctl;
  const [intro, setIntro] = useState(0);
  const [name, setName] = useState("");
  // 카드 뒤집기·선택 상태는 직업별로 기억한다(직업을 바꿨다 돌아와도 열어 둔 카드가 그대로)
  const cls = s.hero.cls;
  const [openBy, setOpenBy] = useState<Partial<Record<ClassId, boolean[]>>>({});
  const [pickBy, setPickBy] = useState<Partial<Record<ClassId, number | null>>>({});
  const open = openBy[cls] ?? [false, false, false];
  const pick = pickBy[cls] ?? null;
  const setOpen = (v: boolean[] | ((o: boolean[]) => boolean[])) => setOpenBy((m) => ({ ...m, [cls]: typeof v === "function" ? v(m[cls] ?? [false, false, false]) : v }));
  const setPick = (v: number | null) => setPickBy((m) => ({ ...m, [cls]: v }));
  const [faith, setFaith] = useState<string | null>(null);

  if (intro < INTRO.length) {
    return (
      <Shell>
        <div className="intro" onClick={() => setIntro((i) => i + 1)}>
          {INTRO.slice(0, intro + 1).map((l, i) => (
            <p key={i} className="intro-line">
              {l}
            </p>
          ))}
          <p className="dim small blink">화면을 누르세요</p>
        </div>
        <button className="btn ghost" onClick={() => setIntro(INTRO.length)}>
          건너뛰기
        </button>
      </Shell>
    );
  }

  const flip = (i: number) => {
    setOpen((o) => o.map((v, j) => (j === i ? true : v)));
    setPick(i);
  };

  const reroll = () => {
    dispatch({ t: "reroll" });
    setOpen([false, false, false]);
    setPick(null);
  };

  const randomName = () => setName(NAMES[Math.floor(Math.random() * NAMES.length)]);

  return (
    <Shell>
      <p className="eyebrow">CHAPTER 01 · 모험가 등록</p>
      <h1 className="h1">어떤 소년으로 살아볼까요?</h1>

      <Card title="직업">
        <div className="class-row">
          {CLASS_IDS.map((id) => {
            const c = CLASSES[id];
            return (
              <button
                key={id}
                className={`class-card${s.hero.cls === id ? " on" : ""}`}
                onClick={() => dispatch({ t: "pickClass", cls: id })}
              >
                <b>{c.name}</b>
                <span className="dim small">{c.motive}</span>
              </button>
            );
          })}
        </div>
        {(() => {
          const c = CLASSES[s.hero.cls];
          return (
            <div className="class-detail">
              <p className="small">{c.desc}</p>
              <p className="small">
                <span className="dim">시작 장비</span> {Object.values(c.start).map((g) => GEAR[g!].name).join(", ")} · <span className="dim">소모품</span> {kitItems(c.items).join(", ")} ·{" "}
                <span className="dim">HP</span> {c.hp >= 0 ? `+${c.hp}` : c.hp}
              </p>
              <p className="small">
                <span className="dim">받을 수 있는 훈련</span> {c.trainings.map((t) => TRAININGS.find((x) => x.id === t)!.name).join(", ")} <span className="dim">(첫 달에는 훈련 불가 · 소지금은 모두 0G)</span>
              </p>
            </div>
          );
        })()}
      </Card>

      <Card title="이름">
        <div className="row">
          <input className="input" value={name} maxLength={12} placeholder="이름을 입력하세요" onChange={(e) => setName(e.target.value)} />
          <button className="btn small" onClick={randomName}>
            랜덤
          </button>
        </div>
      </Card>

      <Card title={`타고난 몸 — 후보 3명`}>
        <p className="dim small">세 후보 모두 능력치 합은 {BAL.startStatSum}이고, 분포만 다릅니다. 카드를 뒤집어 고르세요.</p>
        <div className="cand-row">
          {s.candidates.map((c, i) => (
            <button key={i} className={`cand${open[i] ? " open" : ""}${pick === i ? " picked" : ""}`} onClick={() => flip(i)}>
              <span className="cand-num">0{i + 1}</span>
              <span className="cand-face">{open[i] ? c.archetype : "?"}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setOpen([true, true, true])}>
            모두 오픈
          </button>
          <button className="btn small" disabled={s.rerollsLeft <= 0} onClick={reroll}>
            다른 후보 보기 ({s.rerollsLeft})
          </button>
        </div>
        {pick !== null && (
          <div className="scout">
            <p className="eyebrow">SCOUT REPORT · {s.candidates[pick].archetype}</p>
            {STAT_KEYS.map((k) => {
              const v = s.candidates[pick].stats[k];
              return (
                <div key={k} className="scout-row">
                  <span>{STAT_LABEL[k]}</span>
                  <Bar value={v} max={12} tone="food" />
                  <b className="num">{v}</b>
                  <span className="mod">{fmtMod(mod(v))}</span>
                </div>
              );
            })}
            <p className="dim small">보정치 = 능력치 ÷ 5 (내림). 판정은 d20 + 보정치.</p>
          </div>
        )}
      </Card>

      <Card title="섬길 옛 신">
        {meta.faiths.length === 0 ? (
          <p className="dim small">아직 해금된 신이 없습니다. 죽는 방식에 따라 다음 삶에서 섬길 수 있는 옛 신이 해금됩니다.</p>
        ) : (
          <div className="chips">
            <button className={`chip${faith === null ? " on" : ""}`} onClick={() => setFaith(null)}>
              섬기지 않음
            </button>
            {meta.faiths.map((f) => (
              <button key={f} className={`chip${faith === f ? " on" : ""}`} onClick={() => setFaith(f)}>
                {f}
              </button>
            ))}
          </div>
        )}
        {faith && <p className="dim small">신앙의 효과(신앙심·권능)는 아직 준비 중입니다. 묘비에 기록됩니다.</p>}
      </Card>

      <button className="btn primary" disabled={pick === null} onClick={() => pick !== null && dispatch({ t: "create", name: name || NAMES[Math.floor(Math.random() * NAMES.length)], candidate: pick, faith })}>
        {CLASSES[s.hero.cls].name}로 등록하기 →
      </button>
    </Shell>
  );
}
