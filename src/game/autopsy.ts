import { MONSTERS } from "./data";
import { taxDue } from "./core";
import { DISEASE_NAME, LEVEL_NAME, PARTS, PART_NAME } from "./injury";
import { MIND_KEYS, MIND_NAME } from "./mind";
import type { DeathCause, GameState } from "./types";
import { t } from "../i18n/core";

// 묘비의 "무엇이 죽음을 불렀나": 죽은 순간의 상태를 사실대로 적고(facts), 다음 판에 바꿔 볼 만한 것(hints)을 짧게 덧붙인다.
// 규칙·수치는 건드리지 않는다 — 죽을 때의 상태를 읽기만 한다.

export interface DeathNotes {
  facts: string[];
  hints: string[];
}

export function deathNotes(s: GameState, cause: DeathCause): DeathNotes {
  const facts: string[] = [];
  const hints: string[] = [];
  const d = s.dungeon;
  const c = s.combat;
  const inv = s.inventory;

  // 마지막 전투
  if (c) {
    const alive = c.enemies.filter((e) => e.hp > 0);
    const names = countNames(alive.map((e) => MONSTERS[e.defId]?.name ?? "적"));
    if (names) facts.push(c.round > 1 ? t("마지막 상대: {names} ({n}라운드째)", { names, n: c.round }) : t("마지막 상대: {names}", { names }));
    if (alive.length >= 3) hints.push(t("셋 이상에게 둘러싸이면 오래 버티기 어렵다. 범위 기술을 익히거나, 도주 방침을 조금 높여 두자."));
  }

  // 몸 상태
  const hurt = PARTS.filter((p) => s.injuries[p] > 0).map((p) => `${t(PART_NAME[p])} ${t(LEVEL_NAME[Math.min(3, s.injuries[p])])}`);
  if (hurt.length) facts.push(t("부상: {list}", { list: hurt.join(", ") }));
  if (s.disease > 0) facts.push(t("질병: {name}", { name: t(DISEASE_NAME[s.disease]) }));
  const minds = MIND_KEYS.filter((k) => s.mind[k]);
  if (minds.length) {
    const unknown = minds.filter((k) => !s.mind[k]!.known);
    const all = minds.map((k) => t(MIND_NAME[k])).join(", ");
    facts.push(unknown.length ? t("정신: {all} ({unknown|은} 끝내 눈치채지 못했다)", { all, unknown: unknown.map((k) => t(MIND_NAME[k])).join(", ") }) : t("정신: {all}", { all }));
  }
  if (s.hero.satiety <= 0) facts.push(t("굶주린 상태였다"));
  if (s.hero.fatigue >= 100) facts.push(t("탈진한 상태였다"));

  // 남긴 것
  const left: string[] = [];
  if (inv.potion > 0) left.push(t("물약 {n}개", { n: inv.potion }));
  if (inv.bandage > 0) left.push(t("붕대 {n}개", { n: inv.bandage }));
  if (inv.scroll > 0) left.push(t("귀환 주문서 {n}장", { n: inv.scroll }));
  if (d && d.mana > 0) left.push(t("마석 {n}G어치", { n: d.mana }));
  if (left.length) facts.push(t("남긴 것: {list}", { list: left.join(", ") }));

  // 원인별 조언
  const fight = cause === "mob" || cause === "single" || cause === "oblivion";
  if (fight && inv.potion > 0) {
    hints.push(
      s.tactics.potionAt === 0
        ? t("물약을 들고도 마시지 않는 방침이었다. 설정에서 물약 방침을 켜 두자.")
        : t("물약을 남긴 채 쓰러졌다. 물약 방침(지금 HP {n}% 이하)을 조금 더 높여 볼 만하다.", { n: s.tactics.potionAt }),
    );
  }
  if (fight && d && inv.scroll > 0) hints.push(t("귀환 주문서가 있었다. 체력이 많이 깎였을 때 미리 나오는 것도 방법이다."));
  if (fight && PARTS.some((p) => p !== "head" && p !== "body" && s.injuries[p] >= 2)) hints.push(t("중상을 안은 채 싸웠다. 붕대나 여관으로 먼저 치료하자."));
  if (cause === "oblivion" || (cause === "single" && s.injuries.body >= 3)) hints.push(t("머리·몸통이 이미 다친 상태에서 한 번 더 다치면 즉사한다. 머리·몸통 부상은 미궁에 들어가기 전에 치료하자."));
  if (cause === "starve") hints.push(t("미궁 일주일을 버틸 만큼 식량을 챙기자. 남은 시간이 길면 식량이 먼저 떨어진다."));
  if (cause === "tax") {
    facts.push(t("세금 {tax}G, 가진 돈 {gold}G", { tax: taxDue(s.month, s.rank), gold: s.gold }));
    hints.push(t("월말에 세금을 낼 돈을 남겨 두자. 마석은 미궁을 나와야 돈이 된다."));
  }
  if (cause === "trap") hints.push(t("함정은 물러날 수도 있다. 민첩이 낮으면 해체보다 물러나기가 안전하다."));
  if (cause === "abyss") hints.push(t("2층부터는 꺼진 바닥이 섞여 있다. 체력이 낮을 때 모르는 길로 서두르지 말자."));
  if (cause === "plague") hints.push(t("쥐 열병은 저절로 낫지 않는다. 탕약이나 여관으로 고치고 들어가자."));
  if (fight && minds.length >= 2) hints.push(t("정신 상태이상이 겹쳐 있었다. 여관에서 쉬면 모두 가라앉는다."));
  if (d && fight && d.sector === 1 && s.hero.level < d.floor) hints.push(t("레벨 {lv}로 {sector}섹터 {floor}층까지 내려갔다. 조금 더 강해진 뒤 내려가도 늦지 않다.", { lv: s.hero.level, sector: d.sector, floor: d.floor }));

  return { facts, hints: hints.slice(0, 3) };
}

function countNames(names: string[]): string {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m].map(([n, k]) => (k > 1 ? t("{name} {n}마리", { name: t(n), n: k }) : t(n))).join(", ");
}
