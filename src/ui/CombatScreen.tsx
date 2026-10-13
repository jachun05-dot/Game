import type { Ctl } from "./App";
import { CombatPanel } from "./CombatPanel";
import { HeroHeader, LogView, Shell, SpeedBar, TopBar } from "./components";

/** 마을 밖(숲) 전투 */
export function CombatScreen({ ctl }: { ctl: Ctl }) {
  const { s } = ctl;
  return (
    <Shell>
      <TopBar ctl={ctl} title={`${s.month}월 ${s.week}주차 · 영지 밖 숲`} />
      <HeroHeader s={s} />
      {s.combat && <CombatPanel ctl={ctl} />}
      <LogView ctl={ctl} tall />
      <SpeedBar ctl={ctl} />
    </Shell>
  );
}
