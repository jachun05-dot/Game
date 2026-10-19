// 직업별 테스트 봇의 성장 방식(훈련 선택). sim-mage.ts·sim-gate.ts가 같이 쓴다.
import { BRANCH_KEYS, ELEMENT_KEYS, ROGUE_KEYS, STYLE_KEYS, type BranchKey, type ElementKey, type RogueKey, type StyleKey } from "../src/game/elements";
import type { ClassId } from "../src/game/classes";
import type { GameState } from "../src/game/types";

const NAME: Record<ElementKey, string> = { fire: "화염", frost: "서리", bolt: "번개", earth: "대지" };
// 다음 레벨(훈련 뒤 레벨)로 원소를 고른다
export type Plan = { id: string; kind: string; label: string; cls: ClassId; pick: (s: GameState, toLevel: number) => string; noShield?: boolean };
export const PLANS: Plan[] = [];
const plans = PLANS;
for (const el of ELEMENT_KEYS) plans.push({ id: `mono-${el}`, kind: "단일", label: `${NAME[el]} 몰빵`, cls: "mage", pick: () => el });
// 이원소: 액티브(홀수 레벨)·특화(4·7)는 A, 패시브(짝수 레벨)는 B
for (const a of ELEMENT_KEYS) for (const b of ELEMENT_KEYS) if (a !== b) {
  plans.push({ id: `dual-${a}-${b}`, kind: "이원소", label: `${NAME[a]} 액티브·특화 + ${NAME[b]} 패시브`, cls: "mage", pick: (_s, lv) => (lv === 4 || lv === 7 || lv % 2 === 1 ? a : b) });
}
plans.push({ id: "rotate", kind: "다원소", label: "네 원소 돌아가며", cls: "mage", pick: (_s, lv) => ELEMENT_KEYS[lv % 4] });
plans.push({ id: "random", kind: "다원소", label: "매번 무작위", cls: "mage", pick: (s) => ELEMENT_KEYS[(s.seed * 31 + s.hero.level * 17) % 4] });
for (const skip of ELEMENT_KEYS) {
  const three = ELEMENT_KEYS.filter((x) => x !== skip);
  plans.push({ id: `tri-no-${skip}`, kind: "다원소", label: `${three.map((x) => NAME[x]).join("·")} 셋`, cls: "mage", pick: (_s, lv) => three[lv % 3] });
}
// 비교용: 다른 직업(같은 시드, 같은 봇)

// ── 전사: 수호·검투·광전 ──
const SN: Record<StyleKey, string> = { guard: "수호", glad: "검투", berserk: "광전" };
for (const st of STYLE_KEYS) plans.push({ id: `w-mono-${st}`, kind: "전사 단일", label: `${SN[st]} 몰빵`, cls: "warrior", pick: () => st });
plans.push({ id: "w-mono-guard-noshield", kind: "전사 단일", label: "수호 몰빵(방패 없음)", cls: "warrior", pick: () => "guard", noShield: true });
for (const a of STYLE_KEYS) for (const b of STYLE_KEYS) if (a !== b) {
  plans.push({ id: `w-dual-${a}-${b}`, kind: "전사 두 방향", label: `${SN[a]} 액티브·특화 + ${SN[b]} 패시브`, cls: "warrior", pick: (_s, lv) => (lv === 4 || lv === 7 || lv % 2 === 1 ? a : b) });
}
plans.push({ id: "w-rotate", kind: "전사 셋", label: "세 방향 돌아가며", cls: "warrior", pick: (_s, lv) => STYLE_KEYS[lv % 3] });
plans.push({ id: "w-random", kind: "전사 셋", label: "매번 무작위", cls: "warrior", pick: (s) => STYLE_KEYS[(s.seed * 31 + s.hero.level * 17) % 3] });

// ── 모험가: 전사형·마법사형·민첩형 ──
const BN: Record<BranchKey, string> = { fighter: "전사형", caster: "마법사형", rogue: "민첩형" };
for (const b of BRANCH_KEYS) plans.push({ id: `a-mono-${b}`, kind: "모험가 단일", label: `${BN[b]} 몰빵`, cls: "adventurer", pick: () => b });
for (const a of BRANCH_KEYS) for (const b of BRANCH_KEYS) if (a !== b) {
  plans.push({ id: `a-dual-${a}-${b}`, kind: "모험가 두 갈래", label: `${BN[a]} 액티브·특화 + ${BN[b]} 패시브`, cls: "adventurer", pick: (_s, lv) => (lv === 4 || lv === 7 || lv % 2 === 1 ? a : b) });
}
plans.push({ id: "a-rotate", kind: "모험가 셋", label: "세 갈래 돌아가며", cls: "adventurer", pick: (_s, lv) => BRANCH_KEYS[lv % 3] });
plans.push({ id: "a-random", kind: "모험가 셋", label: "매번 무작위", cls: "adventurer", pick: (s) => BRANCH_KEYS[(s.seed * 31 + s.hero.level * 17) % 3] });

// ── 로그: 암습·독술·쇠뇌(4레벨 각인이 왼손 무기를 정한다) ──
const RN: Record<RogueKey, string> = { assassin: "암습", venom: "독술", xbow: "쇠뇌" };
for (const k of ROGUE_KEYS) plans.push({ id: `r-mono-${k}`, kind: "로그 단일", label: `${RN[k]} 몰빵`, cls: "rogue", pick: () => k });
for (const a of ROGUE_KEYS) for (const b of ROGUE_KEYS) if (a !== b) {
  plans.push({ id: `r-dual-${a}-${b}`, kind: "로그 두 갈래", label: `${RN[a]} 액티브·특화 + ${RN[b]} 패시브`, cls: "rogue", pick: (_s, lv) => (lv === 4 || lv === 7 || lv % 2 === 1 ? a : b) });
}
plans.push({ id: "r-random", kind: "로그 셋", label: "매번 무작위", cls: "rogue", pick: (s) => ROGUE_KEYS[(s.seed * 31 + s.hero.level * 17) % 3] });
