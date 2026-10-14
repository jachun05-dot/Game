import { useEffect } from "react";
import { FIELD_ENCOUNTERS, MONSTERS, SECTOR_ELITES, SECTOR_ENCOUNTERS, SECTOR_RARES, bossGroup } from "../game/data";
import { FRAGMENTS, TIER_LABEL, fragStatText } from "../game/fragments";
import { SKILLS } from "../game/skills";
import type { Codex } from "../game/types";
import { Card, FragIcon, Shell } from "./components";
import { MONSTER_ART } from "./art";

// 몬스터 도감: 마주친 몬스터만 정보가 열리고, 편린 능력치는 흡수해 본 것만 보인다.
// 도감은 삶을 넘어 이어진다(Meta에 저장).
// 그림은 카드 위 무대에 모든 몬스터를 같은 정수배(CODEX_SCALE)로 세워 덩치 차이가 그대로 보이게 한다.
// 안 본 몬스터는 실루엣만 보여 준다(이름·수치는 ???).

const CODEX_SCALE = 2;

function MonsterFigure({ id, seen }: { id: string; seen: boolean }) {
  const a = MONSTER_ART[id];
  if (!a) return <div className="codex-figure empty">?</div>;
  return (
    <div className={`codex-figure${seen ? "" : " silhouette"}`}>
      <img src={a.src} width={a.w * CODEX_SCALE} height={a.h * CODEX_SCALE} alt="" />
    </div>
  );
}

const ORDER = ["rat", "goblin", "skeleton", "boss", "goldrat", "jewelgoblin", "crystalskel", "wolf", "alphawolf", "crow", "harpy", "warhorse", "wraith", "general", "harpyqueen", "goldwolf", "manaharpy", "manawraith", "plaguerat", "leech", "toad", "snail", "mold", "shroudmold", "gargoyle", "mycomother", "drownedchoir", "pearlleech", "sporecap", "shellsnail", "emberbat", "salamander", "orebeetle", "fireelem", "burrower", "frostwraith", "icetroll", "furnacemother", "cartmimic", "goldbat", "manabeetle", "frostspirit"];

function whereFound(id: string): string {
  const places: string[] = [];
  if (FIELD_ENCOUNTERS.some((e) => e.item.includes(id))) places.push("영지 밖 숲");
  for (const sector of [1, 2, 3, 4]) {
    const boss = bossGroup(sector, { int: (a) => a })[0];
    const elite = SECTOR_ELITES[sector];
    const floors = [1, 2, 3].filter((f) => SECTOR_ENCOUNTERS[sector][f].some((e) => e.item.includes(id)) || SECTOR_RARES[sector][f] === id || (id === boss && f === 3) || (elite && (elite.id === id || elite.escort.includes(id)) && elite.floors.includes(f)));
    if (floors.length) places.push(`${sector}섹터 ${floors.join("·")}층`);
  }
  return places.join(", ");
}

export function CodexScreen({ codex, onBack }: { codex: Codex; onBack: () => void }) {
  const ids = [...ORDER, ...Object.keys(MONSTERS).filter((id) => !ORDER.includes(id) && !MONSTERS[id].human && !MONSTERS[id].dummy && (!MONSTERS[id].hidden || codex.seen.includes(id)))];
  const seen = ids.filter((id) => codex.seen.includes(id)).length;
  useEffect(() => window.scrollTo(0, 0), []); // 아래로 내린 화면에서 열어도 맨 위부터
  return (
    <Shell>
      <div className="topbar sticky">
        <button className="link" onClick={onBack}>
          ← 돌아가기
        </button>
        <span className="topbar-title">몬스터 도감</span>
        <span />
      </div>
      <p className="eyebrow">BESTIARY · 몬스터 도감</p>
      <h1 className="h1">몬스터 도감</h1>
      <p className="dim small">
        발견 {seen}/{ids.length} · 편린 흡수 {codex.fragKnown.length}/{Object.keys(FRAGMENTS).length}. 도감은 죽어도 다음 삶으로 이어진다. 편린의 힘은 직접 흡수해 봐야 알 수 있다.
      </p>
      <div className="stack">
        {ids.map((id, i) => {
          const m = MONSTERS[id];
          const no = `No.${String(i + 1).padStart(3, "0")}`;
          if (!codex.seen.includes(id)) {
            return (
              <Card key={id} title={`${no} ???`} className="codex unseen">
                <MonsterFigure id={id} seen={false} />
                <p className="dim small">아직 마주친 적 없는 몬스터.</p>
              </Card>
            );
          }
          const f = FRAGMENTS[id];
          const known = codex.fragKnown.includes(id);
          const sk = f?.skill ? SKILLS[f.skill] : null;
          return (
            <Card key={id} title={`${no} ${m.name}${m.rare ? " · 희귀" : ""}${id === "boss" ? " · 보스" : ""}`} className="codex">
              <MonsterFigure id={id} seen />
              <p className="small">
                HP {m.hp} · AC {m.ac} · 공격 {m.dice[0]}d{m.dice[1]} · 마석 {m.mana}G 어치
              </p>
              <p className="dim small">
                출현: {whereFound(id) || "알 수 없음"} · 처치 {codex.kills[id] ?? 0}
              </p>
              {m.note && <p className="dim small">{m.note}</p>}
              {f && (
                <div className="codex-frag">
                  {known ? (
                    <>
                      <p className="small">
                        <FragIcon tier={f.tier} />
                        <span className={`skill-kind tier${f.tier}`}>{TIER_LABEL[f.tier]}</span> <b>{f.name}</b> <span className="accent">{fragStatText(id)}</span>
                      </p>
                      <p className="small">
                        {sk ? (
                          <>
                            【{sk.name}】 <span className="dim">{sk.kind === "active" ? "자동 발동 · " : "패시브 · "}{sk.desc}</span>
                          </>
                        ) : (
                          <span className="dim">특별한 능력은 없다.</span>
                        )}
                      </p>
                      <p className="dim small">{f.flavor}</p>
                    </>
                  ) : codex.fragSeen.includes(id) ? (
                    <p className="small">
                      <b>{f.name}</b> <span className="dim">— 본 적은 있다. 흡수해 보기 전에는 무엇을 주는지 알 수 없다.</span>
                    </p>
                  ) : (
                    <p className="dim small">편린: ??? (아직 본 적 없다)</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <button className="btn" onClick={onBack}>
        돌아가기
      </button>
    </Shell>
  );
}
