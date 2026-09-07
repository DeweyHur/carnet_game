export type DriveContract = 'scenic' | 'express' | 'careful';
export type Upgrade = 'handling' | 'boost' | 'bumper';
export type CarUpgrades = Record<Upgrade, number>;
export interface RoadObject { id: number; distance: number; lane: number; kind: 'traffic' | 'works' | 'film' | 'zone'; resolved: boolean; velocity?: number }
export type NitroMode = 'off' | 'normal' | 'perfect' | 'shockwave';
export interface DriveState {
  elapsed: number; distance: number; speed: number; lane: number; x: number; integrity: number; energy: number;
  score: number; films: number; passes: number; combo: number; bestCombo: number; collisions: number; speeding: number; zones: number;
  invulnerable: number; objects: RoadObject[]; finished: boolean; notice: string; noticeUntil: number;
  nitro: NitroMode; nitroAge: number; boostWasDown: boolean; drifting: boolean; driftCharge: number;
  driftSeconds: number; drifts: number; nearMisses: number; comboTime: number;
}
export interface DriveResult {
  grade: 'S' | 'A' | 'B' | 'C'; score: number; xp: number; gross: number; repairs: number; earned: number;
  goal: boolean; arrived: boolean; elapsed: number; films: number; collisions: number; bestCombo: number;
  drifts?: number; nearMisses?: number;
}
export interface DriveRun {
  id: number; cityId: string; label: string; missionKey?: string; contract: DriveContract;
  upgrades: CarUpgrades; state: DriveState; result?: DriveResult;
}
export const DRIVE_LENGTH = 1800;
export const DRIVE_LIMIT = 100;
export const SPRINT_TARGET = 30;
export const CONTRACTS: { id: DriveContract; title: string; description: string; goal: string; bonus: number }[] = [
  { id: 'scenic', title: '골든 아워', description: '황금빛 필름을 잇는 나만의 시티 투어.', goal: '사진 필름 6개 수집', bonus: 12 },
  { id: 'express', title: '시티 스프린트', description: '드리프트로 충전하고 니트로로 앞서가세요.', goal: `${SPRINT_TARGET}초 안에 도착`, bonus: 16 },
  { id: 'careful', title: '퍼펙트 크루즈', description: '부드러운 코너링, 깔끔한 추월. 한 번의 완벽한 주행.', goal: '충돌·과속 없이 도착', bonus: 14 },
];
export const driverLevel = (xp: number) => Math.min(20, Math.floor(Math.sqrt(Math.max(0, xp) / 70)) + 1);
export const nextDriverXp = (xp: number) => driverLevel(xp) ** 2 * 70;
export const upgradePrice = (rank: number) => 35 + rank * 30;
export const upgradeUnlock = (rank: number) => rank + 2;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const CORNERS = [
  { start: 220, end: 420, bend: .85 }, { start: 670, end: 880, bend: -.95 },
  { start: 1090, end: 1290, bend: .8 }, { start: 1450, end: 1660, bend: -.75 },
];
export function roadCurve(distance: number) {
  const corner = CORNERS.find((c) => distance >= c.start && distance <= c.end);
  return corner ? Math.sin((distance - corner.start) / (corner.end - corner.start) * Math.PI) * corner.bend : 0;
}
export function roadDistrict(distance: number) {
  return distance < 600 ? { name: '리버사이드', en: 'RIVERSIDE', index: 0 } : distance < 1200
    ? { name: '올드 타운', en: 'OLD TOWN', index: 1 } : { name: '그랜드 불바르', en: 'GRAND BOULEVARD', index: 2 };
}
/** New driving fields also default safely when resuming a pre-update save. */
export function restoreDrive(state: DriveState): DriveState {
  const defaults = { nitro: 'off' as NitroMode, nitroAge: 0, boostWasDown: false, drifting: false, driftCharge: 0,
    driftSeconds: 0, drifts: 0, nearMisses: 0, comboTime: 0 };
  return { ...defaults, ...state };
}

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
      const velocity = row % 4 === 0 ? 0 : 10;
      objects.push({ id: objects.length, distance, lane, kind: row % 4 === 0 ? 'works' : 'traffic', velocity, resolved: false });
      const safeLane = (lane + 1 + Math.floor(random() * 2)) % 3;
      objects.push({ id: objects.length, distance, lane: safeLane, kind: 'film', velocity, resolved: false });
    }
  }
  return { elapsed: 0, distance: 0, speed: 25, lane: 1, x: 1, integrity: 100, energy: 70,
    score: 0, films: 0, passes: 0, combo: 0, bestCombo: 0, collisions: 0, speeding: 0, zones: 0,
    invulnerable: 0, objects, finished: false, notice: '자동 가속 ON · 필름을 따라 달려보세요', noticeUntil: 4,
    nitro: 'off', nitroAge: 0, boostWasDown: false, drifting: false, driftCharge: 0,
    driftSeconds: 0, drifts: 0, nearMisses: 0, comboTime: 0 };
}

export interface DriveInput { gas: boolean; brake: boolean; boost: boolean; drift?: boolean }
/** Deterministic simulation; neither browser frames nor network availability affect outcomes. */
export function tickDrive(previous: DriveState, input: DriveInput, seconds: number, upgrades: CarUpgrades): DriveState {
  if (previous.finished) return previous;
  const dt = clamp(Number.isFinite(seconds) ? seconds : 0, 0, 0.05);
  if (dt === 0) return previous;
  const s = { ...restoreDrive(previous), objects: previous.objects.map((o) => ({ ...o })) };
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  const notify = (message: string) => { s.notice = message; s.noticeUntil = s.elapsed + 1.6; };
  const combo = (points: number) => {
    s.combo++; s.comboTime = 5; s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.score += points * Math.min(4, 1 + Math.floor(s.combo / 4));
  };
  s.comboTime = Math.max(0, s.comboTime - dt);
  if (s.comboTime === 0) s.combo = 0;
  // A tap starts a burst; a second tap inside the visible timing window upgrades it.
  const boostPressed = input.boost && !s.boostWasDown;
  s.boostWasDown = input.boost;
  if (boostPressed && !input.brake && !input.drift) {
    if (s.nitro === 'normal' && s.nitroAge >= .18 && s.nitroAge <= .65) {
      s.nitro = 'perfect'; notify('PERFECT NITRO · 타이밍 성공!');
    } else if (s.nitro === 'off' && s.energy >= 18) {
      s.nitro = s.energy >= 90 ? 'shockwave' : 'normal'; s.nitroAge = 0;
      notify(s.nitro === 'shockwave' ? 'SHOCKWAVE · 풀 차지!' : 'NITRO · 파란 타이밍에 한 번 더!');
    }
  }
  if (input.brake || input.drift || s.energy <= 0) s.nitro = 'off';
  const boosting = s.nitro !== 'off';
  if (boosting) s.nitroAge += dt;
  const curve = roadCurve(s.distance);
  s.drifting = !!input.drift && !input.brake && s.speed >= 42 && Math.abs(curve) > .18;
  if (s.drifting) {
    s.driftCharge += dt; s.driftSeconds += dt;
    s.energy = Math.min(100, s.energy + (14 + Math.abs(curve) * 8) * dt);
  } else if (s.driftCharge > 0) {
    if (s.driftCharge >= .55) { s.drifts++; combo(Math.round(100 + s.driftCharge * 65)); notify(`드리프트 ${s.driftCharge.toFixed(1)}초 · 니트로 충전!`); }
    s.driftCharge = 0;
  }
  const maxSpeed = s.nitro === 'shockwave' ? 142 : s.nitro === 'perfect' ? 128 : boosting ? 116 : s.drifting ? 70 : 82;
  const acceleration = input.brake ? -86 : s.speed > maxSpeed ? -38 : boosting ? 64 : 28;
  s.speed = clamp(s.speed + acceleration * dt, 0, Math.max(maxSpeed, s.speed));
  s.energy = clamp(s.energy + (boosting ? -(s.nitro === 'perfect' ? 19 : 28) + upgrades.boost * 3 : 2.5) * dt, 0, 100);
  if (s.energy === 0) s.nitro = 'off';
  s.x += clamp(s.lane - s.x, -(4.5 + upgrades.handling) * dt, (4.5 + upgrades.handling) * dt);
  s.distance = Math.min(DRIVE_LENGTH, s.distance + s.speed * dt * 0.8);
  for (const item of s.objects) {
    if (!item.resolved && item.distance - previous.distance < 360) item.distance += (item.velocity ?? 0) * dt;
  }
  s.objects.sort((a, b) => a.distance - b.distance || a.id - b.id);
  for (const item of s.objects) {
    if (item.resolved || item.distance > s.distance) continue;
    item.resolved = true;
    if (item.kind === 'zone') {
      if (s.speed <= 55) { s.zones++; combo(65); notify('제한속도 준수 +65'); }
      else { s.speeding++; s.combo = 0; s.comboTime = 0; notify('과속! 50 표지 앞에서는 감속하세요'); }
    } else if (item.kind === 'film') {
      if (Math.abs(s.x - item.lane) < 0.55) { s.films++; combo(90); s.energy = Math.min(100, s.energy + 12); notify('사진 필름 +90 · 부스트 충전'); }
    } else if (Math.abs(s.x - item.lane) < 0.6) {
      if (s.invulnerable === 0) {
        s.collisions++; s.combo = 0; s.comboTime = 0; s.integrity = Math.max(0, s.integrity - (24 - upgrades.bumper * 4));
        s.speed *= 0.42; s.invulnerable = 1; s.nitro = 'off'; s.drifting = false; s.driftCharge = 0; notify('충돌! 빈 차선으로 빠져나가세요');
      }
    } else {
      s.passes++;
      const near = item.kind === 'traffic' && s.speed >= 65 && Math.abs(s.x - item.lane) < 1.25;
      if (near) { s.nearMisses++; s.energy = Math.min(100, s.energy + 10); combo(80); notify('NEAR MISS +80 · 아슬아슬한 추월!'); }
      else { combo(s.speed > 60 ? 45 : 25); notify(s.speed > 60 ? '깔끔한 추월 +45' : '안전하게 통과 +25'); }
    }
  }
  s.finished = s.distance >= DRIVE_LENGTH || s.integrity <= 0 || s.elapsed >= DRIVE_LIMIT;
  return s;
}

export function scoreDrive(s: DriveState, contract: DriveContract, level: number): DriveResult {
  const arrived = s.distance >= DRIVE_LENGTH && s.integrity > 0;
  const goal = arrived && (contract === 'scenic' ? s.films >= 6 : contract === 'express' ? s.elapsed <= SPRINT_TARGET : s.collisions === 0 && s.speeding === 0);
  const grade = !arrived ? 'C' : goal && s.collisions === 0 && s.speeding === 0 ? 'S' : goal ? 'A' : s.collisions < 3 ? 'B' : 'C';
  const gross = arrived ? 10 + Math.min(15, Math.floor(s.score / 200)) + (goal ? CONTRACTS.find((c) => c.id === contract)!.bonus : 0) + Math.min(5, level - 1) : 0;
  const repairs = Math.min(gross, s.collisions * 3 + s.speeding * 2);
  return { grade, score: s.score, xp: arrived ? 20 + s.films * 3 + (goal ? 20 : 0) : 5, gross, repairs, earned: gross - repairs,
    goal, arrived, elapsed: Math.round(s.elapsed * 10) / 10, films: s.films, collisions: s.collisions, bestCombo: s.bestCombo,
    drifts: s.drifts ?? 0, nearMisses: s.nearMisses ?? 0 };
}
