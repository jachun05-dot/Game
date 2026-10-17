# 코드 구조와 확장 지점 (2026-10-17)

```
src/
  game/      순수 게임 규칙(React·브라우저 없음). act(state, action)이 유일한 진입점, 시드 RNG라 재현 가능
  save/      저장 형식 판·이전(migrate.ts), 불러오기·저장·백업(storage.ts)
  platform/  실행 환경: 빌드 정보(build.ts), 어디서 열렸는지(host.ts), 키-값 저장소(kv.ts),
             플레이 기록 보내기(telemetry.ts), 새 버전 확인(update.ts)
  ui/        React 화면. 게임 상태를 그리고 Action을 보낸다
scripts/     시뮬·퍼저(게임 규칙만 쓴다), release/(배포)
```

의존 방향: `ui → save, platform, game` · `save → platform/kv, game` · `platform → (없음)` · `game → (없음)`.
`game/`은 브라우저 API를 쓰지 않는다 — 그래서 시뮬·퍼저가 bun/vite-node에서 그대로 돈다. 이 규칙을 지키면 서버 검증·다른 화면(앱 네이티브 UI 등)에도 규칙을 그대로 쓸 수 있다.

## 확장 지점
- **새 섹터**: `data.ts`의 섹터 표(BAL 배열 끝 칸, `SECTOR_ENCOUNTERS`·`SECTOR_FLAVOR`·`SECTOR_NAME`), 몬스터, `gear.ts`·`fragments.ts`, 규칙 파일(예: `temple.ts`), `dungeon.ts`의 층 생성 분기, `endless.ts`의 `LAST_SECTOR`, `bot.ts`의 준비 조건 → 시뮬 `scripts/sim-sectorN.ts`
- **새 직업**: `classes.ts`, `elements.ts`(훈련 갈래), `skills.ts`, `town.ts`의 `townMaxLevel`, 그림 `ui/art.ts`
- **새 신앙**: `data.ts` FAITH, `faith.ts`(★ 권능·유물·가르침)
- **저장 필드 추가**: `types.ts`에 선택 필드(`?`)로 → `save/migrate.ts` `normalize()`에 기본값. 한 번짜리 변환은 `MIGRATIONS`(docs/DEPLOY.md)
- **기록 보낼 곳 추가**: `platform/telemetry.ts`의 `Sink`
- **저장소 교체(앱)**: `platform/kv.ts`의 `setKv`
- **배포 대상 추가**: `docs/DEPLOY.md`, `scripts/release/`
