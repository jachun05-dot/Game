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
  /** 장소 그림: 화면이 좁을 때 남길 가로 위치(0 왼쪽 ~ 1 오른쪽, 기본 0.5) */
  focus?: number;
}

export const MONSTER_ART: Record<string, SpriteArt> = {
  rat: { src: "./mon-rat.png", w: 36, h: 22 },
  goblin: { src: "./mon-goblin.png", w: 63, h: 69 },
  skeleton: { src: "./mon-skeleton.png", w: 62, h: 83 },
  boss: { src: "./mon-boss.png", w: 94, h: 87 },
  goldrat: { src: "./mon-goldrat.png", w: 36, h: 24 },
  jewelgoblin: { src: "./mon-jewelgoblin.png", w: 60, h: 71 },
  crystalskel: { src: "./mon-crystalskel.png", w: 82, h: 92 },
};


// 편린 등급 아이콘(1 하급 · 2 중급 · 3 상급 · 4 보스). 색은 UI 등급 색(--dim/--ok/--accent/--danger)과 같다.
export const FRAG_ICON: SpriteArt[] = [
  { src: "", w: 0, h: 0 },
  { src: "./frag-1.png", w: 12, h: 21 },
  { src: "./frag-2.png", w: 11, h: 24 },
  { src: "./frag-3.png", w: 12, h: 26 },
  { src: "./frag-4.png", w: 12, h: 29 },
];

// 장소 그림(띠 모양, 원래 도트 크기). 화면에서는 2배로 키우고 좁은 화면에서는 focus 쪽을 남기고 잘린다.
export const SCENE_ART: Record<string, SpriteArt> = {
  training: { src: "./scene-training.png", w: 179, h: 80 },
  tavern: { src: "./scene-tavern.png", w: 179, h: 80 },
  forest: { src: "./scene-forest.png", w: 179, h: 80 },
  market: { src: "./scene-market.png", w: 179, h: 80 },
  smithy: { src: "./scene-smithy.png", w: 179, h: 80 },
  temple: { src: "./scene-temple.png", w: 179, h: 110 },
  office: { src: "./scene-office.png", w: 179, h: 100, focus: 0.85 },
  graveyard: { src: "./scene-grave.png", w: 179, h: 80 },
  dungeon1: { src: "./scene-dungeon1.png", w: 179, h: 100 },
};

/** 주간 결과 카드 제목 → 장소 그림 */
export const WEEK_SCENE: Record<string, string> = { 훈련: "training", 탐문: "tavern", "외부 탐험": "forest" };
