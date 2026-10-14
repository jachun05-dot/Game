import { MONSTERS } from "./data";
import { josa } from "./josa";
import { taxDue } from "./core";
import { DISEASE_NAME, LEVEL_NAME, PARTS, PART_NAME } from "./injury";
import { MIND_KEYS, MIND_NAME } from "./mind";
import type { DeathCause, GameState } from "./types";

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
    if (names) facts.push(`마지막 상대: ${names}${c.round > 1 ? ` (${c.round}라운드째)` : ""}`);
    if (alive.length >= 3) hints.push("셋 이상에게 둘러싸이면 오래 버티기 어렵다. 범위 기술을 익히거나, 도주 방침을 조금 높여 두자.");
  }

  // 몸 상태
  const hurt = PARTS.filter((p) => s.injuries[p] > 0).map((p) => `${PART_NAME[p]} ${LEVEL_NAME[Math.min(3, s.injuries[p])]}`);
  if (hurt.length) facts.push(`부상: ${hurt.join(", ")}`);
  if (s.disease > 0) facts.push(`질병: ${DISEASE_NAME[s.disease]}`);
  const minds = MIND_KEYS.filter((k) => s.mind[k]);
  if (minds.length) {
    const unknown = minds.filter((k) => !s.mind[k]!.known);
    facts.push(`정신: ${minds.map((k) => MIND_NAME[k]).join(", ")}${unknown.length ? ` (${josa(unknown.map((k) => MIND_NAME[k]).join(", "), "은")} 끝내 눈치채지 못했다)` : ""}`);
  }
  if (s.hero.satiety <= 0) facts.push("굶주린 상태였다");
  if (s.hero.fatigue >= 100) facts.push("탈진한 상태였다");

  // 남긴 것
  const left: string[] = [];
  if (inv.potion > 0) left.push(`물약 ${inv.potion}개`);
  if (inv.bandage > 0) left.push(`붕대 ${inv.bandage}개`);
  if (inv.scroll > 0) left.push(`귀환 주문서 ${inv.scroll}장`);
  if (d && d.mana > 0) left.push(`마석 ${d.mana}G어치`);
  if (left.length) facts.push(`남긴 것: ${left.join(", ")}`);

  // 원인별 조언
  const fight = cause === "mob" || cause === "single" || cause === "oblivion";
  if (fight && inv.potion > 0) {
    hints.push(
      s.tactics.potionAt === 0
        ? "물약을 들고도 마시지 않는 방침이었다. 설정에서 물약 방침을 켜 두자."
        : `물약을 남긴 채 쓰러졌다. 물약 방침(지금 HP ${s.tactics.potionAt}% 이하)을 조금 더 높여 볼 만하다.`,
    );
  }
  if (fight && d && inv.scroll > 0) hints.push("귀환 주문서가 있었다. 체력이 많이 깎였을 때 미리 나오는 것도 방법이다.");
  if (fight && PARTS.some((p) => p !== "head" && p !== "body" && s.injuries[p] >= 2)) hints.push("중상을 안은 채 싸웠다. 붕대나 여관으로 먼저 치료하자.");
  if (cause === "oblivion" || (cause === "single" && s.injuries.body >= 3)) hints.push("머리·몸통이 이미 다친 상태에서 한 번 더 다치면 즉사한다. 머리·몸통 부상은 미궁에 들어가기 전에 치료하자.");
  if (cause === "starve") hints.push("미궁 일주일을 버틸 만큼 식량을 챙기자. 남은 시간이 길면 식량이 먼저 떨어진다.");
  if (cause === "tax") {
    facts.push(`세금 ${taxDue(s.month)}G, 가진 돈 ${s.gold}G`);
    hints.push("월말에 세금을 낼 돈을 남겨 두자. 마석은 미궁을 나와야 돈이 된다.");
  }
  if (cause === "trap") hints.push("함정은 물러날 수도 있다. 민첩이 낮으면 해체보다 물러나기가 안전하다.");
  if (cause === "abyss") hints.push("2층부터는 꺼진 바닥이 섞여 있다. 체력이 낮을 때 모르는 길로 서두르지 말자.");
  if (cause === "plague") hints.push("쥐 열병은 저절로 낫지 않는다. 탕약이나 여관으로 고치고 들어가자.");
  if (fight && minds.length >= 2) hints.push("정신 상태이상이 겹쳐 있었다. 여관에서 쉬면 모두 가라앉는다.");
  if (d && fight && d.sector === 1 && s.hero.level < d.floor) hints.push(`레벨 ${s.hero.level}로 ${d.sector}섹터 ${d.floor}층까지 내려갔다. 조금 더 강해진 뒤 내려가도 늦지 않다.`);

  return { facts, hints: hints.slice(0, 3) };
}

function countNames(names: string[]): string {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m].map(([n, k]) => (k > 1 ? `${n} ${k}마리` : n)).join(", ");
}
