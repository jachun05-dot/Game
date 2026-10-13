import type { Ctl } from "./App";
import { Card, GameScreen, HeroHeader } from "./components";

export function SettlementScreen({ ctl }: { ctl: Ctl }) {
  const { s, dispatch } = ctl;
  const st = s.settlement!;
  return (
    <GameScreen
      ctl={ctl}
      title={`${st.month}월 정산`}
      header={<HeroHeader s={s} />}
      dock={
        <button className={`btn wide ${st.paid ? "primary" : "danger"}`} onClick={() => dispatch({ t: "closeSettlement" })}>
          {st.paid ? `${st.month + 1}월로 →` : "관공서로 끌려간다"}
        </button>
      }
      dockClass="dock-cta"
    >
      <Card title={st.cleared ? "1섹터 클리어!" : "귀환"} className="result">
        {st.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </Card>
      <Card title={`다음 달 1주차 — 세금 ${st.tax}G`} className={st.paid ? "" : "warn"}>
        {st.paid ? (
          <p>
            세금을 내고 나면 <b>{st.goldAfter}G</b>가 남는다.
          </p>
        ) : (
          <>
            <p className="hurt">
              가진 돈은 {s.gold}G. 세금 {st.tax}G를 낼 수 없다.
            </p>
            <p className="dim small">관공서 서기가 장부를 덮는다. 병사들이 다가온다.</p>
          </>
        )}
      </Card>
    </GameScreen>
  );
}
