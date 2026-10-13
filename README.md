# DDD — 열여섯 살, 미궁으로

섬의 영지, 미궁, 그리고 매달의 세금. 열여섯 살 모험가의 짧고 처절한 삶을 텍스트로 살아보는 던전크롤 로그라이크(웹).

- 기획: [`docs/DESIGN.md`](docs/DESIGN.md) (텍스트 구조는 14절), 결정 기록: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- 프로토타입 범위·임시 수치: [`docs/PROTOTYPE.md`](docs/PROTOTYPE.md)
- 아트: [`docs/ART_PROMPTS.md`](docs/ART_PROMPTS.md)

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm run build      # dist/ 정적 빌드 (어디든 정적 호스팅 가능)
npm test           # 로직 테스트
npm run sim -- 1000   # 봇 1000판 밸런스 시뮬레이션
```

## 구조

- `src/game/` — UI와 무관한 순수 게임 로직. `engine.ts`의 `act(state, action)`이 유일한 진입점이고, 랜덤은 상태에 저장되는 시드 RNG라 같은 시드·같은 선택이면 같은 결과가 나온다.
- `src/game/bot.ts` — "자동 결정" 옵션과 밸런스 시뮬레이션이 함께 쓰는 정책.
- `src/ui/` — React 화면. 저장은 브라우저 localStorage(내보내기/가져오기 지원).
