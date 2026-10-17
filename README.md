# DDD — 열여섯 살, 미궁으로

섬의 영지, 미궁, 그리고 매달의 세금. 열여섯 살 모험가의 짧고 처절한 삶을 텍스트로 살아보는 던전크롤 로그라이크(웹).

- 기획: [`docs/DESIGN.md`](docs/DESIGN.md) (텍스트 구조는 14절), 결정 기록: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- 지금 상태 요약·작업 방법: [`docs/HANDOFF.md`](docs/HANDOFF.md)
- 시스템별 구현 기록: [`docs/PROTOTYPE.md`](docs/PROTOTYPE.md), 직업: [`MAGE`](docs/MAGE.md)·[`WARRIOR`](docs/WARRIOR.md)·[`ADVENTURER`](docs/ADVENTURER.md), 밸런스: [`docs/CLASS_BALANCE.md`](docs/CLASS_BALANCE.md)
- 아트: [`docs/ART_PROMPTS.md`](docs/ART_PROMPTS.md)

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm run build      # dist/ 정적 빌드 (어디든 정적 호스팅 가능)
npm test           # 로직 테스트
npm run check      # 타입 검사 + 테스트
npm run release:pages                       # GitHub Pages 배포(docs/DEPLOY.md)
npm run release:artifact -- <스테이징 폴더>   # 아티팩트 게시 준비
bun scripts/sim-report.ts 200   # 81조합 밸런스 시뮬레이션(docs/HANDOFF.md 환경 메모 참고)
```

## 구조

- `src/game/` — UI와 무관한 순수 게임 로직. `engine.ts`의 `act(state, action)`이 유일한 진입점이고, 랜덤은 상태에 저장되는 시드 RNG라 같은 시드·같은 선택이면 같은 결과가 나온다.
- `src/game/bot.ts` — "자동 결정" 옵션과 밸런스 시뮬레이션이 함께 쓰는 정책.
- `src/ui/` — React 화면.
- `src/save/` — 저장 형식 판·이전·백업. 저장은 기기 안(localStorage)에만(텍스트 내보내기·가져오기는 2026-10-14에 없앰).
- `src/platform/` — 빌드 정보·실행 환경·저장소·플레이 기록·새 버전 확인.
- 구조와 확장 지점: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), 배포·업데이트: [`docs/DEPLOY.md`](docs/DEPLOY.md)
