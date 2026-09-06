export type DriveContract = 'scenic' | 'express' | 'careful';
export type Upgrade = 'handling' | 'boost' | 'bumper';
export type CarUpgrades = Record<Upgrade, number>;
export interface RoadObject { id: number; distance: number; lane: number; kind: 'traffic' | 'works' | 'film' | 'zone'; resolved: boolean }
export interface DriveState {
  elapsed: number; distance: number; speed: number; lane: number; x: number; integrity: number; energy: number;
  score: number; films: number; passes: number; combo: number; bestCombo: number; collisions: number; speeding: number; zones: number;
  invulnerable: number; objects: RoadObject[]; finished: boolean; notice: string; noticeUntil: number;
}
export interface DriveResult {
  grade: 'S' | 'A' | 'B' | 'C'; score: number; xp: number; gross: number; repairs: number; earned: number;
  goal: boolean; arrived: boolean; elapsed: number; films: number; collisions: number; bestCombo: number;
}
export interface DriveRun {
  id: number; cityId: string; label: string; missionKey?: string; contract: DriveContract;
  upgrades: CarUpgrades; state: DriveState; result?: DriveResult;
}
export const DRIVE_LENGTH = 1800;
export const DRIVE_LIMIT = 100;
export const CONTRACTS: { id: DriveContract; title: string; description: string; goal: string; bonus: number }[] = [
  { id: 'scenic', title: '풍경 수집가', description: '필름을 따라 도시의 장면을 모으세요.', goal: '사진 필름 6개 수집', bonus: 12 },
  { id: 'express', title: '마감 전 특급', description: '빈 차선에서 부스트, 제한 구간에서는 감속.', goal: '42초 안에 도착', bonus: 16 },
  { id: 'careful', title: '흠집 없는 여행', description: '여유 있게 달리고 모든 제한 구간을 지키세요.', goal: '충돌·과속 없이 도착', bonus: 14 },
];
export const driverLevel = (xp: number) => Math.min(20, Math.floor(Math.sqrt(Math.max(0, xp) / 70)) + 1);
export const nextDriverXp = (xp: number) => driverLevel(xp) ** 2 * 70;
export const upgradePrice = (rank: number) => 35 + rank * 30;
export const upgradeUnlock = (rank: number) => rank + 2;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function createDrive(seed: number): DriveState {
  let value = seed >>> 0;
  const random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  const objects: RoadObject[] = [];
  for (let row = 0; row < 16; row++) {
    const distance = 170 + row * 98;
    if ([3, 8, 13].includes(row)) {
      objects.push({ id: objects.length, distance, lane: -1, kind: 'zone', resolved: false });
    } else {
      const lane = Math.floor(random() * 3);
      objects.push({ id: objects.length, distance, lane, kind: row % 4 === 0 ? 'works' : 'traffic', resolved: false });
      const safeLane = (lane + 1 + Math.floor(random() * 2)) % 3;
      objects.push({ id: objects.length, distance, lane: safeLane, kind: 'film', resolved: false });
    }
  }
  return { elapsed: 0, distance: 0, speed: 25, lane: 1, x: 1, integrity: 100, energy: 70,
    score: 0, films: 0, passes: 0, combo: 0, bestCombo: 0, collisions: 0, speeding: 0, zones: 0,
    invulnerable: 0, objects, finished: false, notice: '필름을 모으고 교통을 피해 달리세요', noticeUntil: 4 };
}

export interface DriveInput { gas: boolean; brake: boolean; boost: boolean }
/** Deterministic simulation; neither browser frames nor network availability affect outcomes. */
export function tickDrive(previous: DriveState, input: DriveInput, seconds: number, upgrades: CarUpgrades): DriveState {
  if (previous.finished) return previous;
  const dt = clamp(seconds, 0, 0.05);
  const s = { ...previous, objects: previous.objects.map((o) => ({ ...o })) };
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  const boosting = input.boost && !input.brake && s.energy > 1;
  const maxSpeed = boosting ? 112 : 82;
  s.speed = clamp(s.speed + (input.brake ? -76 : input.gas || boosting ? 26 : -12) * dt, input.brake ? 0 : 22, maxSpeed);
  s.energy = clamp(s.energy + (boosting ? -(30 - upgrades.boost * 3) : 5) * dt, 0, 100);
  s.x += clamp(s.lane - s.x, -(4.5 + upgrades.handling) * dt, (4.5 + upgrades.handling) * dt);
  s.distance = Math.min(DRIVE_LENGTH, s.distance + s.speed * dt * 0.8);
  const notify = (message: string) => { s.notice = message; s.noticeUntil = s.elapsed + 1.6; };
  const combo = (points: number) => {
    s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.score += points * Math.min(4, 1 + Math.floor(s.combo / 4));
  };
  for (const item of s.objects) {
    if (item.resolved || item.distance > s.distance) continue;
    item.resolved = true;
    if (item.kind === 'zone') {
      if (s.speed <= 55) { s.zones++; combo(65); notify('제한속도 준수 +65'); }
      else { s.speeding++; s.combo = 0; notify('과속! 50 표지 앞에서는 감속하세요'); }
    } else if (item.kind === 'film') {
      if (Math.abs(s.x - item.lane) < 0.55) { s.films++; combo(90); s.energy = Math.min(100, s.energy + 12); notify('사진 필름 +90 · 부스트 충전'); }
    } else if (Math.abs(s.x - item.lane) < 0.6) {
      if (s.invulnerable === 0) {
        s.collisions++; s.combo = 0; s.integrity = Math.max(0, s.integrity - (24 - upgrades.bumper * 4));
        s.speed *= 0.42; s.invulnerable = 1; notify('충돌! 차선을 바꿔 피하세요');
      }
    } else { s.passes++; combo(s.speed > 60 ? 45 : 25); notify(s.speed > 60 ? '깔끔한 추월 +45' : '안전하게 통과 +25'); }
  }
  s.finished = s.distance >= DRIVE_LENGTH || s.integrity <= 0 || s.elapsed >= DRIVE_LIMIT;
  return s;
}

export function scoreDrive(s: DriveState, contract: DriveContract, level: number): DriveResult {
  const arrived = s.distance >= DRIVE_LENGTH && s.integrity > 0;
  const goal = arrived && (contract === 'scenic' ? s.films >= 6 : contract === 'express' ? s.elapsed <= 42 : s.collisions === 0 && s.speeding === 0);
  const grade = !arrived ? 'C' : goal && s.collisions === 0 && s.speeding === 0 ? 'S' : goal ? 'A' : s.collisions < 3 ? 'B' : 'C';
  const gross = arrived ? 10 + Math.min(15, Math.floor(s.score / 200)) + (goal ? CONTRACTS.find((c) => c.id === contract)!.bonus : 0) + Math.min(5, level - 1) : 0;
  const repairs = Math.min(gross, s.collisions * 3 + s.speeding * 2);
  return { grade, score: s.score, xp: arrived ? 20 + s.films * 3 + (goal ? 20 : 0) : 5, gross, repairs, earned: gross - repairs,
    goal, arrived, elapsed: Math.round(s.elapsed * 10) / 10, films: s.films, collisions: s.collisions, bestCombo: s.bestCombo };
}
