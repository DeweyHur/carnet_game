# 카르네(Carnet): 세계를 걷는 기록 — 프로토타입 v0.1

`Carnet_게임개발계획서_v0.9.md`의 6장(샘플 콘텐츠·MVP)을 플레이 가능한 웹 프로토타입으로 옮긴 것입니다.
일드프랑스 6개 도시 + 프랑스 북부·중부 6개 도시, 미션 14개, 사실 카드 51장, 음식 30여 종, 환전·이동·시간·체력·평판 루프.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ 정적 번들 (PWA/Capacitor/Electron의 입력)
```

지도 타일은 OpenFreeMap(무료 공개 스타일)을 쓰고, 네트워크가 막히면 내장된 프랑스 윤곽 폴백 스타일로 자동 전환합니다.
실서비스에서는 기획서 §3.1대로 PMTiles 자체 호스팅으로 교체하면 됩니다(`src/ui/MapView.tsx`의 `STYLE_PRIMARY`).

## 구조

```
src/
  game/
    types.ts      도시·POI·음식·이동 엣지·사실 카드·미션 스텝 타입 (기획서 §4 스키마 축약)
    economy.ts    환율(ECB 예시)·환전 경로 5종 스프레드·가격 산정(기준가×물가지수×판매처 계수)·기사 등급
    store.ts      Zustand 게임 상태: 시간/요일·지갑(다중 통화+카드 수수료)·체력·평판·부채·미션 진행·저장(localStorage)
  data/
    cities.ts     12개 도시 노드 + 이동 그래프(§3.2 MVP 이동표: 수단·소요·요금[예약/당일]·편수·첫차/막차·차창 사실)
    cards.ts      사실 카드 51장 — 문장마다 출처 ID
    sources.ts    출처 목록(Wikipedia·Wikidata·기관 공식) — 수첩에서 '출처 보기'
    missions.ts   미션 스크립트 14개(오프닝 튜토리얼, 메인 「지구의 기록」, 아미앵 풀 미션 「80일의 첫 페이지」, 도시 이야기 11개)
    fallbackMap.ts 오프라인 폴백 지도
  ui/
    MapView.tsx   MapLibre 지도: 도시 핀(티어·잠김·현재·스탬프), 노선, 이동 애니메이션
    CityPanel.tsx 도시 카드 4탭(미션·장소·이동·음식) — 기차표 UI, 현지+자국 통화 병기, 파리 대비 태그
    Scene.tsx     비주얼노벨식 미션 러너: 대사/사실 카드/퀴즈/포토 매칭/순서 퍼즐/방문(개장 요일 검사)/구매(가격 맞히기)/환전/기사 조립/편지/해금/스탬프
    Notebook.tsx  수첩·지갑(환율 보드·환전)·여권(스탬프·수집품)·기사·편지
    Hud.tsx, Intro.tsx, common.tsx
```

## 미션 스텝 추가하기

`src/data/missions.ts`의 `steps` 배열에 스텝을 넣으면 됩니다. 스텝 타입은 `src/game/types.ts`의 `Step`:

| 타입 | 설명 |
|---|---|
| `say` | 대사. `who`: margot / guide / L / theo / echo / narrator. echo는 `fiction` 플래그로 창작/인용 표시 |
| `card` | 사실 카드 수집 (`cardId`는 `cards.ts`에 있어야 함) |
| `quiz` | 3지선다. 정답이든 오답이든 카드는 주고, 오답은 기사 정확도에 반영 |
| `photo` | L.의 사진 ↔ 현재 장소 매칭 |
| `order` | 순서 퍼즐. `items`는 정답 순서(UI에서 섞음) |
| `visit` | 장소 방문: 입장료·소요 시간·휴관 요일(실제 데이터) 검사, 22시 이후 불가 |
| `buy` | 음식 구매. `guess: true`면 가격 맞히기(오차가 KPI로 기록됨) |
| `exchange` | 환전 튜토리얼(환전 경로 선택) |
| `move` | 도시 내 구역 이동(1회권 €2.50) |
| `article` | 사실 카드로 기사 조립 → 등급(C/B/A/S) → 원고료 |
| `letter` / `unlock` / `collect` / `stamp` | L.의 편지 / 지역 해금 / 수집품 / 여권 스탬프 |

## 기획서 대비 이번 범위 밖(다음 단계)

- 실제 GTFS·Wikidata·Commons 파이프라인(§4) — 현재는 손으로 큐레이션한 JSON
- 사진(Commons) 표시 — 포토 매칭은 텍스트 묘사로 대체
- 런던·브뤼셀·제네바 국경 환전 미션, 라이벌 테오 이벤트, 계정·클라우드 세이브(FastAPI)
- PMTiles 자체 호스팅, PWA 오프라인 캐시, Capacitor/Electron 패키징
