import type { Ctl } from "./App";
import { t } from "../i18n";
import { Card, GameScreen, HeroHeader, SceneBanner } from "./components";
import { AGE, chaserName } from "../game/age";

export function SettlementScreen({ ctl }: { ctl: Ctl }) {
  const { s, dispatch } = ctl;
  const st = s.settlement!;
  const eighteen = st.month + 1 > AGE.lastMonth;
  return (
    <GameScreen
      ctl={ctl}
      title={t("{m}월 정산", { m: st.month })}
      header={<HeroHeader s={s} onOpen={() => ctl.setSheet(true)} />}
      dock={
        st.inquisition ? (
          <div className="choices">
            <button className="btn primary" onClick={() => dispatch({ t: "inquisition", renounce: true })}>
              {t("{faith|을} 부정한다 — 신앙을 포기한다", { faith: s.hero.faith ? t(s.hero.faith) : t("옛 신") })}
            </button>
            <button className="btn danger" onClick={() => dispatch({ t: "inquisition", renounce: false })}>
              {t("거부한다 — 현상수배가 된다")}
            </button>
          </div>
        ) : (
          <button className={`btn wide ${st.paid ? "primary" : "danger"}`} onClick={() => dispatch({ t: "closeSettlement" })}>
            {eighteen ? t("열여덟 번째 생일 아침으로") : st.paid ? t("{m}월로 →", { m: st.month + 1 }) : t("관공서로 끌려간다")}
          </button>
        )
      }
      dockClass="dock-cta"
    >
      <Card title={st.cleared ? t("{n}섹터 클리어!", { n: st.sector ?? 1 }) : t("귀환")} className="result">
        {st.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </Card>
      {st.inquisition && (
        <Card title={t("이단 심문")} className="warn">
          <p>{t("성당 지하의 심문실. 심문관이 묻는다. \"네가 섬기는 것은 누구냐.\"")}</p>
          <p className="small">
            <b>{t("부정하면")}</b> {t("신앙(신앙심 {n})을 모두 잃지만 마을에서 계속 살 수 있다.", { n: Math.floor(s.piety) })}
          </p>
          <p className="small">
            <b>{t("거부하면")}</b> {t("현상수배가 된다 — 마을의 모든 시설(훈련·탐문·상점·대장간·신전·관공서)을 쓸 수 없고 영지 외곽(숲)만 다닐 수 있다. 세금은 걷히지 않지만 마석은 밀수꾼에게 반값에 넘겨야 한다. 미궁에서는 방을 옮길 때마다 5% 확률로 이단심문관이 나타난다. 심문관을 쓰러뜨리면 신앙심 +10. 언제든 성당에 자수하면 신앙을 버리고 돌아올 수 있다.")}
          </p>
        </Card>
      )}
      {eighteen ? (
        <Card title={t("열여덟 번째 생일")} className="warn">
          <p>{t("내일이면 미궁이 문을 닫는다. 세금은 더 걷히지 않는다 — 쓸모없어진 모험가를 거두러 {chaser} 셋이 온다.", { chaser: t(chaserName(s)) }
)}</p>
          <p className="dim small">{t("도망칠 곳은 없다. 싸움 전에 HP는 다 차지만 부상은 그대로고, 물약은 들고 있는 것뿐이다. 지면 처형, 이기면 — 항구가 있다.")}</p>
        </Card>
      ) : s.heretic ? (
        <Card title={t("현상수배 중")}>
          <p className="small">{t("관공서는 세금 대신 당신의 목에 현상금을 걸었다. 가진 돈 {g}G.", { g: s.gold })}</p>
        </Card>
      ) : (
      <Card title={t("다음 달 1주차 — 세금 {tax}G{debt}", { tax: st.tax, debt: st.debt ? t(" (외상)") : "" })} className={st.paid ? "" : "warn"}>
        <SceneBanner id="office" />
        {st.debt ? (
          <p>{t("빚 문서로 이번 세금을 미뤘다. 다음 달에 {tax}G를 더 내야 한다.", { tax: st.tax })}</p>
        ) : st.paid ? (
          <p>
            {t("세금을 내고 나면")} <b>{st.goldAfter}G</b>{t("가 남는다.")}
          </p>
        ) : (
          <>
            <p className="hurt">
              {t("가진 돈은 {g}G. 세금 {tax}G를 낼 수 없다.", { g: s.gold, tax: st.tax })}
            </p>
            <p className="dim small">{t("관공서 서기가 장부를 덮는다. 병사들이 다가온다.")}</p>
          </>
        )}
      </Card>
      )}
    </GameScreen>
  );
}
