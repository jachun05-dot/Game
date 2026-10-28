import { BUILD } from "./build";

// 판본: web(원래 판) · toss(앱인토스판 — 2026-10-28 사용자 결정: 나이 표현을 없애고 "수습 1·2년차"로,
// 처형은 추방·투옥으로, 잔혹한 묘사는 순화). 규칙·수치는 같고 글만 다르다.
// 글은 src/i18n/variants/toss/<언어>/*.json 덮어쓰기 사전으로, 숫자가 바뀌는 곳(나이 → 연차)만 코드에서 isToss()로 가른다.
export type Variant = "web" | "toss";

let variant: Variant = BUILD.target === "toss" ? "toss" : "web";

export function isToss(): boolean {
  return variant === "toss";
}

export function getVariant(): Variant {
  return variant;
}

/** 테스트·점검 스크립트용 */
export function _setVariant(v: Variant): void {
  variant = v;
}
