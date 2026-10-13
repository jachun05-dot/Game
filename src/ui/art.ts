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

// 몬스터 도트 그림(public/mon-*.png). 모두 기준 이미지와 같은 도트 크기라 크기 차이가 곧 덩치 차이다.
// 그림이 아직 없는 몬스터는 목록에서 빠지고, 화면은 글자만으로도 읽힌다.
export interface SpriteArt {
  src: string;
  w: number;
  h: number;
}

export const MONSTER_ART: Record<string, SpriteArt> = {
  rat: { src: "./mon-rat.png", w: 36, h: 22 },
  goblin: { src: "./mon-goblin.png", w: 63, h: 69 },
  skeleton: { src: "./mon-skeleton.png", w: 62, h: 83 },
  goldrat: { src: "./mon-goldrat.png", w: 36, h: 24 },
  jewelgoblin: { src: "./mon-jewelgoblin.png", w: 60, h: 71 },
};

