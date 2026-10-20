import { RECORDS, RIFT_RECORDS, RUMORS, WAR_RECORDS } from "./data";
import { log, rngOf } from "./core";
import { CLASSES } from "./classes";
import { god, power } from "./faith";
import type { EndingKind, GameState } from "./types";
import { t, tk } from "../i18n/core";

// 진실 조각(진엔딩 단서, 2026-10-15 SECTOR6_DRAFT "엔딩"): 7개. 삶을 넘어 쌓인다(Meta.clues) — "노래로 전해진 기억".
// 대부분 이미 있는 기록물·소문 문장을 그대로 쓴다. 영주의 칙서(6섹터 고해실)만은 그 삶에서 직접 들어야 진엔딩이 열린다.
// 엔딩(셉터의 제단): 헌납(일반) / 결전 승리(진엔딩) / 결전 패배. 엔딩도 묘비로 남는다(Tomb.ending).

export interface ClueDef {
  id: string;
  name: string;
  /** 어디서 얻는지(캐릭터 시트 안내) */
  where: string;
}

export const CLUES: ClueDef[] = [
  { id: "lostgod", name: "짝 잃은 신", where: "1섹터 기록물" },
  { id: "lock", name: "셉터는 자물쇠", where: "1·2·5섹터 기록물" },
  { id: "ageless", name: "늙지 않는 영주", where: "술집 소문과 기록물을 둘 다" },
  { id: "oldgods", name: "성당 이전의 신들", where: "탐문(2섹터 클리어 뒤)" },
  { id: "westvillage", name: "비어 버린 서쪽 마을", where: "탐문(3섹터 클리어 뒤) 또는 현상수배 중 외곽" },
  { id: "edict", name: "영주의 칙서", where: "6섹터 심문관의 고해실(삶마다 새로)" },
  { id: "name", name: "짝신의 이름", where: "3~5섹터 기록물(드묾) 또는 헌납 엔딩을 본 다음 삶" },
];

export const CLUE_NAME: Record<string, string> = Object.fromEntries(CLUES.map((c) => [c.id, c.name]));

/** 새 문장(소문·기록물) */
export const WEST_RUMOR = "떠돌이 어부가 술잔을 내려놓는다. \"서쪽에 마을이 하나 있었지. 영주님의 의식이 있던 밤, 하룻밤 새 바다에 잠겼어. 아무도 그 이야기를 안 해.\"";
export const WEST_FIELD = "외곽 서쪽 끝, 바닷물에 잠긴 지붕들이 보인다. 버려진 마을 터다. 무너진 문설주에 누군가 새겨 두었다 — \"영주의 의식 뒤, 하룻밤에.\"";
export const OLDGODS_FOLLOW = "노인이 한 번 더 입을 연다. 오래된 기도문이다. \"…여덟 이름이 있었고, 그 위에 짝을 이룬 둘이 있었다. 하나가 다른 하나를 삼켰다.\"";
export const NAME_RECORD = "\"그녀의 이름은 아엘라였다. 삼킨 자가 지운 이름. 그 이름을 부르면, 삼켜진 것도 한 번은 돌아본다.\"";
export const NAME_DREAM = "간밤에 이상한 꿈을 꿨다. 바다에 잠기는 섬, 그리고 누군가 부르는 이름 — \"아엘라.\" 깨어나서도 그 이름이 혀끝에 남아 있다.";
export const EDICT_TEXT = "영주의 친필 칙서다. \"셉터를 가져오는 자에게, 남은 신들의 문을 열 열쇠를 맡기겠다.\" 셉터는 열쇠가 아니라 자물쇠라고 했다. 영주는 그 문을 영영 닫으려는 것이다.";

/** 문장 → 조각(기록물·소문) */
const TEXT_CLUE: [string, string][] = [
  [RECORDS[0], "lostgod"],
  [RECORDS[1], "lock"],
  [WAR_RECORDS[4], "lock"],
  [RIFT_RECORDS[0], "lock"],
  [NAME_RECORD, "name"],
];
/** 늙지 않는 영주: 소문 반쪽 + 기록 반쪽 */
const AGELESS_RUMOR = RUMORS[5];
const AGELESS_RECORDS = [RECORDS[4], RIFT_RECORDS[2]];

export function knowsClue(s: GameState, id: string): boolean {
  return (s.clues ?? []).includes(id);
}

export function clueCount(s: GameState): number {
  return CLUES.filter((c) => knowsClue(s, c.id)).length;
}

/** 진엔딩에 필요한 조각 수(시와 노래의 신 ★5 화신전 특례: 하나 덜) */
export function clueNeed(s: GameState): number {
  return power(s, "song", 5) ? 4 : 5;
}

/** 조각을 얻는다(처음일 때만 알린다). lines가 있으면 그쪽에(주간 결과 카드) */
export function grantClue(s: GameState, id: string, lines?: string[]): void {
  if (id === "edict") s.edict = true;
  if (knowsClue(s, id)) return;
  (s.clues ??= []).push(id);
  const text = t("【진실 조각】 {clue} — 진실 {n}/{total}", { clue: t(CLUE_NAME[id]), n: clueCount(s), total: CLUES.length });
  if (lines) lines.push(text);
  else log(s, text, "crit");
}

/** 읽은 기록물·들은 소문 문장으로 조각을 얻는다 */
export function clueFromText(s: GameState, text: string, lines?: string[]): void {
  for (const [t, id] of TEXT_CLUE) if (t === text) grantClue(s, id, lines);
  const half = text === AGELESS_RUMOR ? "ageless-rumor" : AGELESS_RECORDS.includes(text) ? "ageless-record" : null;
  if (half && !knowsClue(s, "ageless")) {
    const bits = (s.clueBits ??= []);
    if (!bits.includes(half)) bits.push(half);
    if (bits.includes("ageless-rumor") && bits.includes("ageless-record")) grantClue(s, "ageless", lines);
    else (lines ? lines.push.bind(lines) : (x: string) => log(s, x, "system"))(t("(어딘가에서 들은 이야기와 맞물린다. 반쪽이 더 있을 것 같다.)"));
  }
}

/** 기록물 한 편 고르기: 아직 모르는 조각 문장이 목록에 있으면 35%로 그것을(모르는 단서가 더 잘 나온다) */
export function pickRecord(s: GameState, list: string[], idx: number): string {
  const r = rngOf(s);
  const unknown = list.filter((t) => TEXT_CLUE.some(([x, id]) => x === t && !knowsClue(s, id)) || (AGELESS_RECORDS.includes(t) && !knowsClue(s, "ageless") && !(s.clueBits ?? []).includes("ageless-record")));
  if (unknown.length && r.chance(0.35)) return r.pick(unknown);
  return list[idx % list.length];
}

/** 3~5섹터 기록물을 읽을 때 드물게(5%) 짝신의 이름 */
export function nameRecordChance(s: GameState, sector: number): boolean {
  return sector >= 3 && sector <= 5 && !knowsClue(s, "name") && rngOf(s).chance(0.05);
}

/** 탐문 소문: 등급에 따라 조각 소문이 섞이고, 모르는 것이 잘 나온다. lines에 소문과 조각을 적는다 */
export function rumorWithClues(s: GameState, lines: string[]): void {
  const r = rngOf(s);
  // 헌납 엔딩을 본 다음 삶: 첫 탐문에서 짝신의 이름 꿈
  if ((s.clueBits ?? []).includes("dream") && !knowsClue(s, "name")) {
    s.clueBits = s.clueBits!.filter((x) => x !== "dream");
    lines.push(t(NAME_DREAM));
    grantClue(s, "name", lines);
    return;
  }
  const pool: string[] = [];
  if (s.rank >= 1 && !knowsClue(s, "ageless") && !(s.clueBits ?? []).includes("ageless-rumor")) pool.push(AGELESS_RUMOR);
  if (s.rank >= 2 && !knowsClue(s, "oldgods")) pool.push(RUMORS[0]);
  if (s.rank >= 3 && !knowsClue(s, "westvillage")) pool.push(WEST_RUMOR);
  const line = pool.length && r.chance(0.35) ? r.pick(pool) : r.pick(RUMORS);
  lines.push(t(line));
  if (line === RUMORS[0] && s.rank >= 2 && !knowsClue(s, "oldgods")) {
    lines.push(t(OLDGODS_FOLLOW));
    grantClue(s, "oldgods", lines);
  }
  if (line === WEST_RUMOR) grantClue(s, "westvillage", lines);
  clueFromText(s, line, lines);
}

/** 진엔딩(셉터를 두고 나옴)이 열렸나: 조각 5개(시와 노래 ★5면 4개) + 이번 삶의 칙서 + 옛 신을 섬기는 중 */
export function trueEndingOpen(s: GameState): boolean {
  return !!god(s) && !!s.edict && clueCount(s) >= clueNeed(s);
}

/** 진엔딩 잠김 이유(화면 안내) */
export function trueEndingLock(s: GameState): string[] {
  const out: string[] = [];
  if (clueCount(s) < clueNeed(s)) out.push(t("진실 조각 {n}/{need}", { n: clueCount(s), need: clueNeed(s) }));
  if (!s.edict) out.push(t("이번 삶에서 영주의 칙서를 듣지 못했다"));
  if (!god(s)) out.push(t("섬기는 옛 신이 없다"));
  return out;
}

// ── 엔딩 ──

const ENDING_TEXT: Record<EndingKind, { cause: string; lines: string[] }> = {
  offering: {
    cause: tk("셉터를 바치고 섬을 떠났다"),
    lines: [
      tk("셉터를 들어 올리자 미궁이 무너지듯 몸을 밀어냈다. 눈을 뜨니 미궁 입구였다."),
      tk("영주성의 문이 처음으로 열렸다. 영주는 셉터를 받아 들고 오래 바라보았다. 그 눈은 늙지 않았다."),
      tk("남은 세금은 모두 면제되었고, 평생 써도 남을 돈이 주어졌다."),
      tk("다음 날 새벽, 섬을 떠나는 배에 올랐다. 등 뒤에서 성당의 종이 길게 울렸다."),
      tk("며칠 뒤 항구에서 소식을 들었다. 섬이 바다에 가라앉았고, 살아남은 사람은 없다고."),
      tk("그날 밤 꿈에서, 누군가 낯선 이름을 불렀다."),
    ],
  },
  true: {
    cause: tk("영주를 쓰러뜨리고 옛 신들을 돌려보냈다"),
    lines: [
      tk("셉터를 결계에 박힌 그대로 두고 돌아섰다. 성소의 빛이 등을 떠밀어 마을로 돌려보냈다."),
      tk("영주성에서 영주가 기다리고 있었다. 늙지 않는 눈이 처음으로 떨렸다."),
      tk("영주의 껍질이 벗겨지고 흰빛이 드러났다. 짝을 삼킨 자의 손이었다."),
      tk("옛 신들의 이름을 하나씩 불렀다. 대답이 돌아왔다."),
      tk("흰빛이 꺼지자 성당의 종이 멈췄다. 결계 너머에서 문이 열리는 소리가 섬 전체에 울렸다."),
      tk("옛 신들이 돌아왔다. 열여섯 살에 미궁에 들어간 아이들의 이름이 노래로 불리기 시작했다."),
    ],
  },
  escape: {
    cause: tk("추적자를 뿌리치고 섬을 떠났다"),
    lines: [
      tk("마지막 추적자가 진흙 위에 쓰러졌다. 숨을 고를 틈도 없이 항구로 달렸다."),
      tk("밀수꾼의 작은 배가 밧줄을 풀었다. 등 뒤에서 관공서의 종이 미친 듯이 울렸다."),
      tk("안개 속으로 섬이 멀어졌다. 성당의 첨탑도, 미궁의 입도, 영주성의 금빛 문장도."),
      tk("셉터는 끝내 손에 넣지 못했다. 옛 신들의 이야기도 섬에 두고 왔다."),
      tk("다만 살아남았다. 열여덟 살에 미궁에서 걸어 나온 아이는, 아무도 기억하지 못하는 바다 건너에서 늙어 갔다."),
    ],
  },
  fallen: {
    cause: tk("영주에게 맞서다 쓰러졌다"),
    lines: [
      tk("셉터를 두고 돌아와 영주성에 들어섰다."),
      tk("끝내 흰빛을 넘지 못했다."),
      tk("성당은 그를 반역자로 기록했다. 묘지기만이 그 묘비에 꽃을 두었다."),
    ],
  },
};

/** 결전에서 쓰러졌을 때 묘비에 붙는 엔딩 글(core.kill이 붙인다) */
export function fallenEpilogue(): string[] {
  return ENDING_TEXT.fallen.lines.map((l) => t(l));
}

/** 삶을 엔딩으로 끝낸다(묘비 + 엔딩 글) */
export function endLife(s: GameState, kind: EndingKind): void {
  const e = ENDING_TEXT[kind];
  const lines = e.lines.map((l) => t(l));
  if (kind === "true") for (const f of s.faithsKnown) lines.push(t("— {god|이} 돌아와 인사한다.", { god: t(f) }));
  const d = s.dungeon;
  s.tomb = {
    id: `${s.seed}-${s.month}-${s.week}-${s.log.length}-${kind}`,
    name: s.hero.name,
    level: s.hero.level,
    months: s.month,
    reached: kind === "fallen" ? t("영주성") : kind === "escape" ? t("섬 밖의 바다") : d ? t("{n}섹터 셉터의 제단", { n: d.sector }) : t("셉터의 제단"),
    cause: t(e.cause),
    faithsUnlocked: [],
    epitaph: epitaph(s, kind),
    faith: s.hero.faith,
    className: CLASSES[s.hero.cls].name,
    seed: s.seed,
    diedAt: new Date().toISOString(),
    ending: kind,
    epilogue: lines,
  };
  s.combat = null;
  s.dungeon = null;
  s.phase = "dead";
  for (const l of lines) log(s, l, "story");
}

function epitaph(s: GameState, kind: EndingKind): string {
  const cls = t(CLASSES[s.hero.cls].name);
  const parts = [s.hero.cls === "adventurer" ? t("영지의 열여섯 살 소년, {cls}가 미궁에 섰다.", { cls }) : t("영지의 열여섯 살 소년, {cls}로 미궁에 섰다.", { cls }), t("{n}레벨까지 훈련받았다.", { n: s.hero.level })];
  parts.push(...s.history.slice(-2));
  parts.push(t("진실 조각 {n}/{total}을 알았다.", { n: clueCount(s), total: CLUES.length }));
  const n = s.month;
  parts.push(kind === "escape" ? t("열여덟 살, {n}번째 달에 영주의 추적자를 뿌리치고 섬을 떠났다.", { n }) : kind === "offering" ? t("{n}번째 달에 셉터를 바치고 섬을 떠났다.", { n }) : kind === "true" ? t("{n}번째 달에 영주를 쓰러뜨렸다. 옛 신들이 돌아왔다.", { n }) : t("{n}번째 달에 영주에게 맞서다 쓰러졌다.", { n }));
  return parts.join(" ");
}
