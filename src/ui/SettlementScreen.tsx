import type { Ctl } from "./App";
import { josa } from "../game/josa";
import { Card, GameScreen, HeroHeader, SceneBanner } from "./components";

export function SettlementScreen({ ctl }: { ctl: Ctl }) {
  const { s, dispatch } = ctl;
  const st = s.settlement!;
  return (
    <GameScreen
      ctl={ctl}
      title={`${st.month}월 정산`}
      header={<HeroHeader s={s} onOpen={() => ctl.setSheet(true)} />}
      dock={
        st.inquisition ? (
          <div className="choices">
            <button className="btn primary" onClick={() => dispatch({ t: "inquisition", renounce: true })}>
              {josa(s.hero.faith ?? "옛 신", "을")} 부정한다 — 신앙을 포기한다
            </button>
            <button className="btn danger" onClick={() => dispatch({ t: "inquisition", renounce: false })}>
              거부한다 — 현상수배가 된다
            </button>
          </div>
        ) : (
          <button className={`btn wide ${st.paid ? "primary" : "danger"}`} onClick={() => dispatch({ t: "closeSettlement" })}>
            {st.paid ? `${st.month + 1}월로 →` : "관공서로 끌려간다"}
          </button>
        )
      }
      dockClass="dock-cta"
    >
      <Card title={st.cleared ? "1섹터 클리어!" : "귀환"} className="result">
        {st.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </Card>
      {st.inquisition && (
        <Card title="이단 심문" className="warn">
          <p>성당 지하의 심문실. 심문관이 묻는다. "네가 섬기는 것은 누구냐."</p>
          <p className="small">
            <b>부정하면</b> 신앙(신앙심 {Math.floor(s.piety)})을 모두 잃지만 마을에서 계속 살 수 있다.
          </p>
          <p className="small">
            <b>거부하면</b> 현상수배가 된다 — 마을의 모든 시설(훈련·탐문·상점·대장간·신전·관공서)을 쓸 수 없고 영지 외곽(숲)만 다닐 수 있다. 세금은 걷히지 않지만 마석은 밀수꾼에게 반값에 넘겨야 한다. 미궁에서는 방을 옮길 때마다 5% 확률로 이단심문관이 나타난다. 심문관을 쓰러뜨리면 신앙심 +10. 언제든 성당에 자수하면 신앙을 버리고 돌아올 수 있다.
          </p>
        </Card>
      )}
      {s.heretic ? (
        <Card title="현상수배 중">
          <p className="small">관공서는 세금 대신 당신의 목에 현상금을 걸었다. 가진 돈 {s.gold}G.</p>
        </Card>
      ) : (
      <Card title={`다음 달 1주차 — 세금 ${st.tax}G${st.debt ? " (외상)" : ""}`} className={st.paid ? "" : "warn"}>
        <SceneBanner id="office" />
        {st.debt ? (
          <p>빚 문서로 이번 세금을 미뤘다. 다음 달에 {st.tax}G를 더 내야 한다.</p>
        ) : st.paid ? (
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
      )}
    </GameScreen>
  );
}
