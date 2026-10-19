// UI 아이콘(2026-10-19): 그림 파일 없이 SVG로 그린 작은 선 아이콘. 글자 크기(1em)를 따르고 색은 currentColor.
// 몬스터·장비 같은 도트 그림은 art.ts, 이건 화면 틀(헤더·버튼·자원 표시)용이다.

type IconName =
  | "menu" | "gear" | "bag" | "coin" | "shield" | "crest" | "heart" | "food" | "tired" | "clock" | "gem"
  | "star" | "skull" | "potion" | "camp" | "scroll" | "meat" | "back" | "arrow" | "sword" | "book"
  | "grave" | "tomb" | "map" | "flame" | "eye" | "bandage" | "leaf" | "drop" | "stone" | "chev";

const P: Record<IconName, JSX.Element> = {
  menu: <path d="M3 5h14M3 10h14M3 15h14" />,
  gear: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" />
    </>
  ),
  bag: (
    <>
      <path d="M6.5 7V5.5a3.5 3.5 0 0 1 7 0V7" />
      <path d="M4 7h12l-1 10H5z" />
      <path d="M7.5 11h5" />
    </>
  ),
  coin: (
    <>
      <ellipse cx="10" cy="10" rx="6.5" ry="6.5" />
      <path d="M10 6.5v7M8 8.2c0-1 4-1 4 .3 0 1.4-4 1.2-4 2.8 0 1.3 4 1.3 4 .3" />
    </>
  ),
  shield: <path d="M10 2.8 16 5v5c0 3.6-2.6 6.2-6 7.3C6.6 16.2 4 13.6 4 10V5z" />,
  crest: (
    <>
      <path d="M10 2.5 12 7l4.8.4-3.7 3.1 1.2 4.7L10 12.6 5.7 15.2l1.2-4.7L3.2 7.4 8 7z" />
    </>
  ),
  heart: <path d="M10 16.5S3.5 12.6 3.5 7.8A3.3 3.3 0 0 1 10 6.3a3.3 3.3 0 0 1 6.5 1.5c0 4.8-6.5 8.7-6.5 8.7z" />,
  food: (
    <>
      <path d="M12.8 3.6a4.2 4.2 0 0 1 2.3 7.1l-4 4-5.8-5.8 4-4a4.2 4.2 0 0 1 3.5-1.3z" />
      <path d="M5.3 8.9 3.4 15a1 1 0 0 0 1.3 1.3l6.1-1.9" />
    </>
  ),
  tired: (
    <>
      <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" />
      <path d="M12 3.5h3l-3 3h3" />
    </>
  ),
  clock: (
    <>
      <path d="M5.5 3h9M5.5 17h9" />
      <path d="M6.5 3c0 4 7 4 7 7s-7 3-7 7M13.5 3c0 4-7 4-7 7s7 3 7 7" />
    </>
  ),
  gem: (
    <>
      <path d="M6 3.5h8l3 4-7 9.5-7-9.5z" />
      <path d="M3 7.5h14M8 3.5 7 7.5l3 9.5 3-9.5-1-4" />
    </>
  ),
  star: <path d="M10 2.8 12.2 7.6l5.2.5-3.9 3.5 1.1 5.1L10 14.1l-4.6 2.6 1.1-5.1-3.9-3.5 5.2-.5z" />,
  skull: (
    <>
      <path d="M10 2.8c-3.8 0-6.3 2.6-6.3 6 0 2 1 3.3 2.3 4.1V16h8v-3.1c1.3-.8 2.3-2.1 2.3-4.1 0-3.4-2.5-6-6.3-6z" />
      <circle cx="7.6" cy="9.2" r="1.2" />
      <circle cx="12.4" cy="9.2" r="1.2" />
      <path d="M9 16v-2M11 16v-2" />
    </>
  ),
  potion: (
    <>
      <path d="M8 2.8h4M8.5 2.8v4L4.6 13a3 3 0 0 0 2.6 4.4h5.6a3 3 0 0 0 2.6-4.4L11.5 6.8v-4" />
      <path d="M5.8 12h8.4" />
    </>
  ),
  camp: (
    <>
      <path d="M2.5 16.5 10 4l7.5 12.5z" />
      <path d="M10 4v12.5M7.5 16.5 10 12l2.5 4.5" />
    </>
  ),
  scroll: (
    <>
      <path d="M5 4h9a2 2 0 0 1 2 2v0H7" />
      <path d="M7 6v9a2 2 0 0 1-4 0v-1h2" />
      <path d="M7 15a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
    </>
  ),
  meat: (
    <>
      <path d="M12.8 3.6a4.2 4.2 0 0 1 2.3 7.1l-4 4-5.8-5.8 4-4a4.2 4.2 0 0 1 3.5-1.3z" />
      <path d="M5.3 8.9 3.4 15a1 1 0 0 0 1.3 1.3l6.1-1.9" />
    </>
  ),
  back: <path d="M12.5 4.5 7 10l5.5 5.5" />,
  arrow: <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />,
  chev: <path d="M7.5 4.5 13 10l-5.5 5.5" />,
  sword: (
    <>
      <path d="M15.5 2.8 16.9 4.2 8.5 12.6 7.1 11.2z" />
      <path d="m5.2 10.6 4.2 4.2M6 14l-2.6 2.6" />
    </>
  ),
  book: (
    <>
      <path d="M10 5.2C8.3 4 5.8 3.6 3.5 4v11.5c2.3-.4 4.8 0 6.5 1.2 1.7-1.2 4.2-1.6 6.5-1.2V4c-2.3-.4-4.8 0-6.5 1.2z" />
      <path d="M10 5.2v11.5" />
    </>
  ),
  grave: (
    <>
      <path d="M5.5 17V8a4.5 4.5 0 0 1 9 0v9" />
      <path d="M3 17h14M10 7.5v5M8 9.5h4" />
    </>
  ),
  tomb: (
    <>
      <path d="M5.5 17V8a4.5 4.5 0 0 1 9 0v9" />
      <path d="M3 17h14" />
    </>
  ),
  map: (
    <>
      <path d="M3 5.5 7.5 3.5l5 2 4.5-2v11l-4.5 2-5-2-4.5 2z" />
      <path d="M7.5 3.5v11M12.5 5.5v11" />
    </>
  ),
  flame: <path d="M10 17.2c-3 0-5-2-5-4.8 0-3 2.6-4.4 2.6-7.2 1.8 1 2.6 2.5 2.6 3.8.8-.6 1.3-1.6 1.3-2.8 2 1.3 3.5 3.5 3.5 6.2 0 2.8-2 4.8-5 4.8z" />,
  eye: (
    <>
      <path d="M2.5 10S5.3 4.8 10 4.8 17.5 10 17.5 10 14.7 15.2 10 15.2 2.5 10 2.5 10z" />
      <circle cx="10" cy="10" r="2.4" />
    </>
  ),
  bandage: (
    <>
      <rect x="2.6" y="7.2" width="14.8" height="5.6" rx="2.8" transform="rotate(-45 10 10)" />
      <path d="M9 9h.01M11 11h.01M11 9h.01M9 11h.01" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 16c0-7 4.5-11.5 12-12-0.5 7.5-5 12-12 12z" />
      <path d="M4 16 11 9" />
    </>
  ),
  drop: <path d="M10 3s5 5.4 5 8.8A5 5 0 0 1 5 11.8C5 8.4 10 3 10 3z" />,
  stone: (
    <>
      <path d="M3 13.5 6 6h8l3 7.5-3 2.5H6z" />
      <path d="M6 6l2 4h4l2-4M8 10l-2 6M12 10l2 6" />
    </>
  ),
};

export function Icon({ name, className, title }: { name: IconName; className?: string; title?: string }) {
  return (
    <svg
      className={`icon${className ? " " + className : ""}`}
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}

export type { IconName };
