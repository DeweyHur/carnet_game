import assert from 'node:assert/strict';

export async function checkDriving(server) {
  const { createDrive, restoreDrive, tickDrive, roadCurve, scoreDrive } = await server.ssrLoadModule('/src/game/driving.ts');
  const upgrades = { handling: 0, boost: 0, bumper: 0 }, idle = { gas: false, brake: false, boost: false };
  const step = (state, input = idle, count = 1) => {
    for (let i = 0; i < count; i++) state = tickDrive(state, input, 1 / 120, upgrades);
    return state;
  };
  assert.deepEqual(createDrive(123), createDrive(123), 'A course seed is reproducible');
  const empty = { ...createDrive(1), objects: [] };
  assert.equal(tickDrive(empty, idle, 0, upgrades), empty, 'A zero-duration tick cannot trigger an input');
  assert.equal(tickDrive(empty, idle, NaN, upgrades), empty, 'Invalid frame durations cannot corrupt saves');
  assert.ok(step(empty, idle, 120).speed > empty.speed, 'Auto acceleration works without a held pedal');
  let burst = step(empty, { ...idle, boost: true });
  assert.equal(burst.nitro, 'normal', 'A tap starts nitro');
  burst = step(burst, idle, 35);
  burst = step(burst, { ...idle, boost: true });
  assert.equal(burst.nitro, 'perfect', 'A second tap in the blue window upgrades the burst');
  assert.equal(step(burst, { ...idle, brake: true }).nitro, 'off', 'Braking always cancels nitro');
  let early = step(empty, { ...idle, boost: true });
  early = step(early, idle, 3); early = step(early, { ...idle, boost: true });
  assert.equal(early.nitro, 'normal', 'Mashing before the timing window does not give perfect nitro');
  const depleted = step({ ...empty, energy: 17 }, { ...idle, boost: true });
  assert.equal(depleted.nitro, 'off', 'Starting a burst needs the displayed minimum energy');
  const shock = step({ ...empty, energy: 95 }, { ...idle, boost: true }, 120);
  assert.equal(shock.nitro, 'shockwave'); assert.ok(shock.speed > 82);
  const drained = step(shock, { ...idle, boost: true }, 600);
  assert.equal(drained.nitro, 'off', 'Holding the button cannot repeatedly restart an empty tank');
  assert.ok(drained.energy >= 0 && drained.energy <= 100);
  assert.equal(roadCurve(0), 0); assert.ok(roadCurve(300) > .5); assert.ok(roadCurve(770) < -.5);
  let drift = step({ ...empty, distance: 280, speed: 75, energy: 15 }, { ...idle, drift: true }, 120);
  assert.ok(drift.drifting && drift.driftCharge >= .99 && drift.energy > 30, 'Corner drift earns energy over time');
  drift = step(drift);
  assert.equal(drift.drifts, 1); assert.ok(drift.score > 100);
  assert.equal(step(drift).drifts, 1, 'A released drift pays its style score once');
  const straight = step({ ...empty, speed: 75 }, { ...idle, drift: true }, 120);
  assert.equal(straight.drifts, 0); assert.equal(straight.driftCharge, 0, 'Holding drift on a straight gives no drift reward');
  const traffic = { id: 1, distance: .1, lane: 0, kind: 'traffic', resolved: false };
  const near = step({ ...empty, speed: 82, energy: 30, objects: [traffic] });
  assert.equal(near.nearMisses, 1); assert.equal(near.collisions, 0); assert.ok(near.energy >= 40);
  assert.equal(step({ ...empty, speed: 82, lane: 2, x: 2, objects: [traffic] }).nearMisses, 0, 'A distant pass is not a near miss');
  const crash = step({ ...empty, speed: 82, lane: 0, x: 0, nitro: 'perfect', combo: 5, comboTime: 4, driftCharge: 1, objects: [traffic] });
  assert.equal(crash.collisions, 1); assert.equal(crash.combo, 0); assert.equal(crash.driftCharge, 0); assert.equal(crash.nitro, 'off');
  const expired = step({ ...empty, combo: 4, comboTime: .1 }, idle, 20);
  assert.equal(expired.combo, 0, 'A combo expires without another skill action');
  const legacy = { ...empty };
  for (const key of ['nitro', 'nitroAge', 'boostWasDown', 'drifting', 'driftCharge', 'driftSeconds', 'drifts', 'nearMisses', 'comboTime']) delete legacy[key];
  const resumed = step(restoreDrive(legacy));
  assert.equal(resumed.nitro, 'off'); assert.equal(resumed.drifts, 0); assert.ok(Number.isFinite(resumed.energy));
  assert.equal(scoreDrive(resumed, 'scenic', 1).drifts, 0);
  const sprintTimes = [];
  for (let seed = 1; seed <= 20; seed++) {
    let s = createDrive(seed);
    while (!s.finished) {
      const next = s.objects.find((o) => !o.resolved);
      if (next && next.kind !== 'zone') {
        const film = s.objects.find((o) => !o.resolved && o.kind === 'film' && o.distance === next.distance);
        s = { ...s, lane: film?.lane ?? (next.lane + 1) % 3 };
      }
      const zone = s.objects.find((o) => !o.resolved && o.kind === 'zone');
      const slow = zone && zone.distance - s.distance < Math.max(65, s.speed * 1.4);
      const boost = !slow && (s.nitro === 'off' && s.energy >= 18 || s.nitro === 'normal' && s.nitroAge >= .3 && s.nitroAge < .5);
      s = step(s, { ...idle, gas: true, brake: !!slow && s.speed > 49, boost });
    }
    assert.equal(s.collisions, 0, 'Nitro courses remain avoidable at full speed');
    assert.equal(s.speeding, 0, 'Every speed zone allows braking from nitro speed');
    assert.equal(scoreDrive(s, 'express', 1).grade, 'S', 'The sprint target is reachable through clean, timed nitro');
    sprintTimes.push(s.elapsed);
  }
  console.log(`Sprint balance: ${Math.min(...sprintTimes).toFixed(1)}–${Math.max(...sprintTimes).toFixed(1)}s across 20 clean courses.`);
  console.log('PASS: timed nitro, shockwave, corner-only drift, near misses, combo expiry, collisions and old driving checkpoints.');
}
