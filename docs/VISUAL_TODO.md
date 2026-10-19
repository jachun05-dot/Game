# 비주얼 남은 작업 (2026-10-15 작성, 2026-10-19 갱신)

> 2026-10-19: 화면 틀(UI) 그림 요청은 따로 `docs/UI_ART_REQUESTS.md`(앱 아이콘·공유 그림·소모품/상태 아이콘·신의 문장 등). UI 스킨은 `src/ui/theme.css`, 선 아이콘은 `src/ui/icons.tsx`.

게임은 6섹터·엔딩까지 완성. 그림은 1섹터·2섹터 일부만 있다. 이 문서는 남은 그림 체크리스트다.
작업 방식: 비주얼 세션이 파일만 넣고 `src/ui/art.ts`에 등록(VISUAL_HANDOFF 1-1절), 빌드·배포는 게임 세션.

## 현황

| 구분 | 전체 | 있음 | 남음 |
|---|---|---|---|
| 직업 그림(전신+얼굴) | 4 | 3 | **1** (로그 — G절) |
| 몬스터 스프라이트 | 83 | 20 | **63** |
| 장비 아이콘 | 75 | 21 | **54** |
| 방 아이콘 | 18 | 10 | **8** |
| 미궁 장면(지도 배경) | 섹터 6 + 2섹터 밤 + 끝없는 미궁 | 3 | **5** |
| 마을 장면 | 9 | 8 | **1** (여관) |
| 훈련 갈래 아이콘(`LINE_ICON`) | 10 | 0 | **10** |
| 엔딩 일러스트 | 4 | 0 | **4** (숨겨진 엔딩 "섬을 떠난 자" 추가) |
| 보스 증표 아이콘 | 5 | 0 | 5 (선택) |

UI·출시용 그림(앱 아이콘·공유 미리보기·소모품·상태·신의 문장·스플래시 등)은 게임 세션이 쓴 `docs/UI_ART_REQUESTS.md`(U01~U10)에 따로 있다.

등록만 하면 화면에 바로 나오는 것: 몬스터(도감·전투 로그), 장비(시트·대장간·발견 카드), 방 아이콘(갈림길 버튼), 미궁 장면(`dungeon<섹터>` → 지도 배경, 자동), 여관(`WEEK_SCENE`에 한 줄).
화면 코드가 필요한 것(게임 세션): ~~2섹터 밤 배경 교체~~(완료), 엔딩 일러스트 자리(DeadScreen/TombCard), 증표 아이콘 자리, 보스만 크게 보이기(선택).

## 단계 (플레이어가 많이 보는 순서)

### A. 2섹터 마무리
- [x] 장면 낮 `dungeon2` (038) · 밤 `dungeon2night` (039) — 밤 연결도 게임 세션이 끝냄
- [ ] 여관 장면 (040) · 방 아이콘 relic 전쟁의 흔적 (041) — 프롬프트 나감, 생성 대기
- [ ] (프롬프트 042·043, 생성 대기) 장비 10: wraithspear 망령의 녹슨 창, warbanner 녹슨 군기 방패, harpycharm 하피 깃털 부적, horseshoe 군마의 편자 장화, battlering 전장의 반지, wolfhide 늑대 가죽 갑옷, steelsword 강철 장검, steelshield 강철 방패, oakstaff 마력이 깃든 지팡이, queencloak 하피 여왕의 깃털 망토

### B. 3섹터 "물에 잠긴 사원"
- [ ] 장면 `dungeon3`
- [ ] 몬스터 12: plaguerat 역병 쥐떼, leech 진흙 거머리, toad 독두꺼비, snail 산성 달팽이, mold 곰팡이 괴물, shroudmold 사제복 균사체, gargoyle 잠긴 석상 / 희귀 pearlleech 진주 먹은 거머리, sporecap 마석 균모자, shellsnail 마석 껍질 달팽이 / 정예 drownedchoir 익사한 성가대 / 보스 mycomother 가라앉은 본당의 균모
- [ ] 장비 약 9: antidotering 해독의 반지, sporemask 포자 가면, leechcharm 거머리 이빨 부적, tidestaff 조수의 지팡이, choirbell 성가대의 녹청 종, bronzeblade 청동 장검, corkshield 코르크 방패, waders 물장화, oiledleather 기름 먹인 가죽 갑옷
- [ ] 방 아이콘 altar 공양 제단

### C. 4섹터 "불타는 광산 갱도"
- [ ] 장면 `dungeon4`
- [ ] 몬스터 12: emberbat 불씨 박쥐, salamander 불도롱뇽, orebeetle 광석 갑충, fireelem 화염 정령, burrower 굴착 벌레, frostwraith 서리 망령, icetroll 얼음 트롤 / 희귀 goldbat 금맥 박쥐, manabeetle 마석 광석 갑충, frostspirit 마석 서리 정령 / 정예 cartmimic 광차 미믹 / 보스 furnacemother 화로 어미 도롱뇽
- [ ] 장비 약 9: canary 카나리아 새장, emberring 불씨 반지, frostwand 서리 광맥 지팡이, fireleather 내화 가죽 갑옷, furcoat 털 안감 외투, minerpick 광부 곡괭이, minerhelm 등불 달린 갱도모, safetyboots 징 박은 안전화, hingeshield 미믹의 경첩 방패
- [ ] 방 아이콘 magazine 버려진 화약고

### D. 5섹터 "바닥없는 균열"
- [ ] 장면 `dungeon5`
- [ ] 몬스터 12: riftbat 균열 박쥐 떼, tendril 그림자 촉수, hungerwraith 굶주린 망령, ledgespider 벼랑 거미, voideye 공허 눈, riftworm 균열 벌레, fallenheap 낙하 잔해 덩어리 / 희귀 scalebat 마석 비늘 박쥐, manaeye 마석 눈동자, shellworm 마석 껍질 균열 벌레 / 정예 hungermother 허기의 어미 / 보스 abyssmaw 심연의 아귀
- [ ] 장비 약 9: batcloak 박쥐 날개 망토, voidring 공허 눈 반지, ghoulfang 아귀 이빨 단검, abyssblade 심연강 장검, voidstaff 공허 수정 지팡이, shadowhide 그림자 가죽 갑옷, lanternhelm 이끼 등불 투구, clawboots 갈고리 장화, twofacebowl 두 얼굴의 그릇
- [ ] 방 아이콘 plenty 풍요의 제단

### E. 6섹터 "타락한 신전과 차원문의 성소" + 엔딩
- [ ] 장면 `dungeon6` (필요하면 성소 구간 1장 더)
- [ ] 몬스터 19: litany 기도문 떼, censer 떠도는 향로, hollowknight 빈 성갑, penitchain 참회의 사슬, executioner 처형인의 갑주, reliquary 저주받은 성물, waxfaithful 밀랍 신도, seraph 눈 많은 날개, swallowed 삼켜진 것 / 희귀 candle 마석 촛대, grail 마석 성배, wingshard 마석 날개 조각 / 정예 mitre 주인 없는 주교관 / 보스·특수 guardian 봉인의 수호자, avatar 짝을 삼킨 빛의 화신, judgeeye 심판의 눈, grandinquisitor 심문관장, lord 늙지 않는 영주, godavatar 유일신의 아바타
- [ ] 장비 약 9: hollowplate 빈 성갑의 흉갑, confessmask 고해의 가면, chainbelt 참회의 사슬 띠, pairring 짝 잃은 반지, sunsteel 성광 강철 장검, relicstaff 성인의 뼈 지팡이, towershield 결계석 방패, pilgrimboots 순례자의 신, oldsigil 뒤집힌 성표
- [ ] 방 아이콘 4: offerbox 봉헌함, confession 고해실, altars 옛 신들의 제단, scepter 셉터의 제단
- [ ] 엔딩 4: offering 헌납, true 돌아온 신들(진엔딩), fallen 영주에게 맞선 자, escape 섬을 떠난 자(숨겨진 엔딩) (화면 코드 필요)

### G. 로그(민첩 직업, 2026-10-19) — 지금은 모험가 그림을 빌려 쓴다
- [ ] (프롬프트 044) 로그 전신 `rogue.png`(약 37×90) · 얼굴 `rogue-face.png`(30×30) — 뒷골목 출신 열여섯 살, 후드 달린 낡은 가죽 조끼, 허리에 단검. `CLASS_ART.rogue`에 등록
- [ ] 왼손 무기 아이콘 3: rgOffDagger 왼손 단검, rgToxFlask 독병 주머니, rgHandXbow 손쇠뇌
- [ ] 단검 사다리 아이콘 4: steeldagger 강철 단검, bronzedagger 청동 단검, abyssdagger 심연강 단검, sundagger 성광 단검
- [ ] 소모품 볼트 묶음 `bolt`(UI_ART_REQUESTS U04와 함께)

### F. 공통·기타
- [ ] 훈련 갈래 아이콘 10(`LINE_ICON`, 키 = 훈련 id): 마법사 fire·frost·bolt·earth, 전사 guard·glad·berserk, 모험가 fighter·caster·rogue — 한 장 시트
- [ ] 끝없는 미궁 장면(`endless`, 지도 배경)
- [ ] 영주의 추적자 `pursuer`(2026-10-19, 18세 추적 — 영주 문장이 새겨진 철퇴를 든 병사, 사람. 지금은 이단심문관 그림을 빌림) · 심문관장 `grandinquisitor`
- [ ] 청소부 5종(sweeper1~5, 숨김 몬스터 — 한 디자인을 섹터별로 변형)
- [ ] 허수아비 3종(dummy, dummyPack, dummyArmor — 한 장 시트)
- [ ] 장비 grooty 시험자의 부적
- [ ] 보스 증표 5(마석 심장·녹슨 휘장·포자낭·불씨 비늘·검은 이빨, 한 장 시트, 화면 코드 필요)
- [ ] (선택) 1섹터 스켈레톤 다시 뽑기 — 소년보다 작게 나와 있음

## 생성 횟수 어림
몬스터는 한 장에 한 마리(희귀는 기본형 첨부 변형) 약 60회, 장비는 시트 8~9개씩 6회, 방 아이콘 시트 1~2회, 장면·엔딩 10회, 증표·허수아비 시트 2회 → **약 80회**.

## 게임 세션 메모(화면 코드가 필요한 그림)

- ~~**2섹터 밤 배경**~~ (연결 완료 2026-10-19 — 밤 그림이 있는 섹터는 `dungeon<섹터>night`을 자동으로 쓴다): `DungeonScreen.tsx` `mapBackdrop()`에서 `SCENE_ART[\`dungeon${dg.sector}\`]` 대신, 밤(`isNight(s)`)이면 `SCENE_ART[\`dungeon${dg.sector}night\`] ?? SCENE_ART[\`dungeon${dg.sector}\`]`. 밤 그림이 이미 매우 어두워 덧칠(`rgba(12,10,7,0.62)`)을 밤에는 0.35 정도로
