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
  title: { src: "./scene-title.png", w: 179, h: 160, focus: 0.65 },
};

/** 주간 결과 카드 제목 → 장소 그림 */
export const WEEK_SCENE: Record<string, string> = { 훈련: "training", 탐문: "tavern", "외부 탐험": "forest" };

// 미궁 방 종류 아이콘(원래 도트 크기, 갈림길 버튼에 1배). 위험한 방은 붉은색, 계단·차원문은 보라, 보물은 금색 — 지도 테두리 색 규칙과 같다
export const ROOM_ICON: Record<string, SpriteArt> = {
  entrance: { src: "./room-entrance.png", w: 31, h: 39 },
  empty: { src: "./room-empty.png", w: 31, h: 31 },
  combat: { src: "./room-combat.png", w: 31, h: 31 },
  trap: { src: "./room-trap.png", w: 32, h: 28 },
  treasure: { src: "./room-treasure.png", w: 29, h: 23 },
  record: { src: "./room-record.png", w: 30, h: 26 },
  shrine: { src: "./room-shrine.png", w: 17, h: 32 },
  stairs: { src: "./room-stairs.png", w: 32, h: 33 },
  boss: { src: "./room-boss.png", w: 30, h: 35 },
  portal: { src: "./room-portal.png", w: 26, h: 33 },
};

// 장비 아이콘(원래 도트 크기, 목록 1배 · 장비 발견 카드 2배). 아이콘이 없는 장비는 글자만 나온다
export const GEAR_ICON: Record<string, SpriteArt> = {
  shortsword: { src: "./gear-shortsword.png", w: 22, h: 22 },
  longsword: { src: "./gear-longsword.png", w: 31, h: 31 },
  dagger: { src: "./gear-dagger.png", w: 19, h: 20 },
  staff: { src: "./gear-staff.png", w: 26, h: 27 },
  bonewand: { src: "./gear-bonewand.png", w: 26, h: 30 },
  robe: { src: "./gear-robe.png", w: 29, h: 29 },
  leather: { src: "./gear-leather.png", w: 22, h: 26 },
  chain: { src: "./gear-chain.png", w: 30, h: 27 },
  shield: { src: "./gear-shield.png", w: 26, h: 26 },
  ironshield: { src: "./gear-ironshield.png", w: 28, h: 28 },
  cap: { src: "./gear-cap.png", w: 18, h: 22 },
  helm: { src: "./gear-helm.png", w: 22, h: 25 },
  belt: { src: "./gear-belt.png", w: 28, h: 14 },
  pouchbelt: { src: "./gear-pouchbelt.png", w: 29, h: 19 },
  boots: { src: "./gear-boots.png", w: 26, h: 24 },
  swiftboots: { src: "./gear-swiftboots.png", w: 26, h: 24 },
};
