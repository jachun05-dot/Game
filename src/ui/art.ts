import type { ClassId } from "../game/classes";

// 직업별 도트 그림(public/). 원본 도트 크기라 화면에서는 정수배로만 키운다.
// 프롬프트 기록은 docs/ART_PROMPTS.md.
export interface ClassArt {
  /** 전신 */
  full: string;
  w: number;
  h: number;
  /** 얼굴 초상(30×30) */
  face: string;
}

export const CLASS_ART: Record<ClassId, ClassArt> = {
  adventurer: { full: "./hero.png", w: 37, h: 90, face: "./hero-face.png" },
  warrior: { full: "./warrior.png", w: 35, h: 86, face: "./warrior-face.png" },
  mage: { full: "./mage.png", w: 44, h: 86, face: "./mage-face.png" },
};
