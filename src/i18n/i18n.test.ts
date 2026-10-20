import { afterEach, describe, expect, it } from "vitest";
import { _setDict, t, tk } from "./index";

describe("i18n t()", () => {
  afterEach(() => _setDict("ko", {}));

  it("한국어는 원문 그대로, 조사를 붙인다", () => {
    expect(t("잠든 모험가 {n}명", { n: 3 })).toBe("잠든 모험가 3명");
    expect(t("{faith|을} 부정한다", { faith: "역병의 신" })).toBe("역병의 신을 부정한다");
    expect(t("{who|이} 왔다", { who: "고블린" })).toBe("고블린이 왔다");
  });

  it("번역이 있으면 번역, 없으면 한국어로 돌아간다", () => {
    _setDict("en", { "묘지": "Graveyard", "{faith|을} 부정한다": "Renounce {faith}" });
    expect(t("묘지")).toBe("Graveyard");
    expect(t("{faith|을} 부정한다", { faith: "X" })).toBe("Renounce X");
    expect(t("없는 문장 {n}", { n: 1 })).toBe("없는 문장 1");
  });

  it("tk는 표시만 한다", () => {
    expect(tk("구석구석 탐험")).toBe("구석구석 탐험");
  });
});
