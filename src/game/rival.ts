// 라이벌 테오의 국경 너머 경로. 불로뉴 메인 미션 완료 후, 본인이 예고한 순서
// (런던 → 브뤼셀 → 쾰른 → 제네바 → 바르셀로나, 대사 참고)대로 움직이다가
// 베를린·바르셀로나발 마드리드까지 발을 넓힌다는 설정. offsetDays는 그 완료일로부터
// 테오가 해당 도시에 "이미 도착해 있는" 날수 — 플레이어가 그보다 먼저 스탬프를
// 찍으면 특종 보너스를 받는다(§2.2 "특종 경쟁 이벤트").
export const THEO_ROUTE: { cityId: string; offsetDays: number }[] = [
  { cityId: 'london', offsetDays: 2 },
  { cityId: 'brussels', offsetDays: 3 },
  { cityId: 'cologne', offsetDays: 5 },
  { cityId: 'berlin', offsetDays: 7 },
  { cityId: 'geneva', offsetDays: 8 },
  { cityId: 'barcelona', offsetDays: 10 },
  { cityId: 'madrid', offsetDays: 12 },
];

/** 테오가 이 도시에 도착하는(도착한) 게임 날짜. 아직 경주가 시작 안 됐거나 경로에 없으면 null. */
export function theoArrivalDay(cityId: string, startDay: number | null): number | null {
  if (startDay === null) return null;
  const leg = THEO_ROUTE.find((l) => l.cityId === cityId);
  return leg ? startDay + leg.offsetDays : null;
}
