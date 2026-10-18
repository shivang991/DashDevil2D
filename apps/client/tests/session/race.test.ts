// @vitest-environment node
import { expect, test } from 'vitest';
import { RaceSession } from '../../src/game/RaceSession';
import { captureConfiguration } from '@dashdevil/simulation/config';
import { configurationContext, initialBaseline } from '@dashdevil/contracts/validation';
import type { Outcome } from '@dashdevil/contracts/protocol';
function baseline() {
  const config = captureConfiguration('drag-race', { gameplay: { finishDistance: 400, initialClearDistance: 0, reservedHearts: 0, obstacleWeight: 0, heartWeight: 0, coinWeight: 0, emptyWeight: 1 } });
  const b = initialBaseline(configurationContext(config, 1, 1000000));
  b.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
  return b;
}
test('local NOS predicts immediately; provisional finish keeps advancing and accepting controls', () => {
  const b = baseline(), race = new RaceSession(b);
  race.input({ identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 3, heldMask: 4 }, 0);
  expect(race.frame(100000, 0).cars[0].progress).toBeCloseTo(80, 6);
  const provisional = race.frame(600000, 0);
  expect(provisional.awaiting).toBe(true);
  expect(provisional.cars[0].progress).toBeCloseTo(480, 6);
  race.input({ identity: b.identity, round: b.round, sequence: 2, intent: 0, control: 2, heldMask: 6 }, 600000);
  expect(race.frame(700000, 0).cars[0].lateral).toBeCloseTo(-40, 6);
});
test('self-contained outcome wins over late baseline, authority and prediction', () => {
  const b = baseline(), race = new RaceSession(b);
  const outcome: Outcome = { identity: b.identity, roundId: b.round.roundId, outcomeId: 1, tick: 29, timeUs: 475000, result: 0, reason: 0,
    cars: b.cars.map((c, i) => ({ progress: i ? 190 : 380, lateral: c.lateral, hp: 3, score: 0 })), progress: b.progress };
  race.finish(outcome);
  race.install(b);
  race.finish({ ...outcome, result: 1 });
  expect(race.frame(900000, 0)).toMatchObject({ outcome, awaiting: false, timeUs: 475000 });
});
test('stale authority freezes prediction at one second without declaring a result', () => {
  const race = new RaceSession(baseline());
  const frozen = race.frame(2000000, 0);
  expect(frozen.stale).toBe(true);
  expect(frozen.timeUs).toBe(1000000);
  expect(race.frame(5000000, 0).cars).toEqual(frozen.cars);
  expect(frozen.outcome).toBeUndefined();
});

import fixtures from '../../../../packages/contracts/race/fixtures.json';
import { Multiplayer } from '@dashdevil/simulation/multiplayer';
for (const scenario of fixtures.scenarios) test(`shared finish: ${scenario.name}`, () => {
  const b = baseline();
  scenario.progress.forEach((progress, seat) => { b.cars[seat].progress = progress; });
  const car = b.cars[0]; car.phase = scenario.phase;
  if (scenario.phase) { car.target = scenario.phase === 1 ? 1 : 0; car.movementOrigin = scenario.phase === 1 ? -120 : -40; car.movementTarget = scenario.phase === 1 ? 0 : -120; car.lateral = car.movementOrigin; car.movementEndUs = 'movementEndUs' in scenario ? scenario.movementEndUs! : 150000; }
  if (scenario.nos) { car.controls = 3; car.effective = 3; car.heldMask = 4; car.flags = 1; car.freshnessUs = 1000000; }
  const config = captureConfiguration('drag-race', { gameplay: { finishDistance: 400, initialClearDistance: 0, reservedHearts: 0, obstacleWeight: 0, emptyWeight: 1 } });
  const game = new Multiplayer(config, 1, [b.identity, { ...b.identity, seat: 1 }]);
  game.restore(b.cars, 0);
  game.advanceTo(1);
  expect(game.snapshot().finish).toEqual({ tick: scenario.tick, timeUs: scenario.timeUs, result: scenario.result });
  expect(game.snapshot().cars[0].progress).toBeCloseTo('position0' in scenario ? scenario.position0! : 360, 6);
  expect(game.snapshot().cars[0].lateral).toBeCloseTo(scenario.lateral, 6);
  const final = game.snapshot(); game.advanceTo(2); expect(game.snapshot()).toEqual(final);
});

test('rendered positions interpolate at current time without changing tick geometry', () => {
  const race = new RaceSession(baseline());
  const frame = race.frame(25000, 0);
  expect(frame.cars[0].progress).toBeCloseTo(6.666666666666667, 6);
  expect(frame.renderedCars[0].progress).toBeCloseTo(10, 6);
});

test('a mid-tick authoritative object event repairs HP and availability immediately and only once', () => {
  const b = baseline();
  b.windows[0].objects = [{ id: 4, sliceId: 1, lane: 0, flags: 3, distance: 100 }];
  b.windows[0].firstSlice = 1; b.windows[0].lastSlice = 1; b.generator.nextSlice = 2; b.generator.nextObject = 7;
  const race = new RaceSession(b);
  const event = { identity: b.identity, round: b.round, authority: 1, eventId: 1, tick: 0, timeUs: 5000, kind: 2, seatMask: 1,
    cars: structuredClone(b.cars), contact: b.contact, objects: [{ ...b.windows[0].objects[0], flags: 7 }] };
  event.cars[0].hp = 2; event.cars.forEach(car => { car.progress = 2; });
  race.event(event);
  expect(race.frame(5000, 0).cars[0].hp).toBe(2);
  expect(race.snapshot().windows[0].objects[0].flags).toBe(7);
  race.event({ ...event, cars: b.cars });
  expect(race.frame(25000, 0).cars[0].hp).toBe(2);
  expect(race.frame(25000, 0).cars[0].progress).toBeCloseTo(6.666666666666667, 6);
});

test('predicted pickup feedback is delivered once across frame replay and confirmation', () => {
  const b = baseline();
  b.cars[0].progress = 44;
  b.windows[0].objects = [{ id: 4, sliceId: 1, lane: 0, flags: 3, distance: 100 }];
  b.windows[0].firstSlice = 1; b.windows[0].lastSlice = 1; b.generator.nextSlice = 2; b.generator.nextObject = 7;
  const race = new RaceSession(b);
  expect(race.frame(25000, 0).feedback).toEqual(['Heart consumed']);
  expect(race.frame(25000, 0).feedback).toEqual([]);
  const state = race.frame(25000, 0);
  race.event({ identity: b.identity, round: b.round, authority: 1, eventId: 1, tick: 1, timeUs: 16667, kind: 2, seatMask: 1, cars: state.cars, contact: b.contact, objects: state.objects });
  expect(race.frame(30000, 0).feedback).toEqual([]);
});

test('an older same-tick checkpoint cannot undo confirmed HP or consumption', () => {
  const b = baseline(), race = new RaceSession(b);
  const cars = structuredClone(b.cars); cars[0].hp = 1;
  race.event({ identity: b.identity, round: b.round, authority: 1, eventId: 1, tick: 0, timeUs: 5000, kind: 2, seatMask: 1, cars, contact: b.contact, objects: [] });
  race.install(b);
  expect(race.frame(5000, 0).cars[0].hp).toBe(1);
});

test('authority reverses provisional death and restores an unconsumed obstacle', () => {
  const b = baseline(); b.cars[0].progress = 38; b.cars[0].hp = 1;
  b.windows[0].objects = [{ id: 4, sliceId: 1, lane: 0, flags: 2, distance: 100 }];
  b.windows[0].firstSlice = 1; b.windows[0].lastSlice = 1; b.generator.nextSlice = 2; b.generator.nextObject = 7;
  const race = new RaceSession(b);
  const predicted = race.frame(25000, 0);
  expect(predicted.cars[0].hp).toBe(0); expect(predicted.awaiting).toBe(true); expect(predicted.outcome).toBeUndefined();
  expect(predicted.objects[0].flags).toBe(10);
  const repaired = structuredClone(b); repaired.tick = 1; repaired.timeUs = 16667;
  Object.assign(repaired.cars[0], { progress: 44.666666666666664, hp: 3, lateral: 120, lane: 2, departure: 2, target: 2 });
  race.install(repaired);
  const frame = race.frame(25000, 0);
  expect(frame.cars[0].hp).toBe(3); expect(frame.objects[0].flags).toBe(2); expect(frame.awaiting).toBe(false);
  expect(frame.feedback).toEqual([]);
});

test('ordinary authority corrections settle in 100ms while gameplay repairs immediately', () => {
  const b = baseline(), race = new RaceSession(b);
  const before = race.frame(100000, 0);
  const corrected = structuredClone(b);
  corrected.tick = 6; corrected.timeUs = 100000; corrected.epoch++;
  corrected.cars.forEach(car => { car.progress = 48; car.hp = 2; });
  race.install(corrected);
  const repaired = race.frame(100000, 0);
  expect(repaired.cars[0].progress).toBe(48);
  expect(repaired.cars[0].hp).toBe(2);
  expect(repaired.renderedCars[0].progress).toBeCloseTo(before.renderedCars[0].progress, 6);
  expect(race.frame(150000, 0).renderedCars[0].progress).toBeCloseTo(64, 6);
  const settled = race.frame(200000, 0);
  expect(settled.renderedCars[0].progress).toBeCloseTo(settled.cars[0].progress, 6);
});

test('authority arriving ahead of the previous render compares positions at matching times', () => {
  const b = baseline(), race = new RaceSession(b);
  race.frame(100000, 0);
  const corrected = structuredClone(b); corrected.epoch++;
  corrected.tick = 12; corrected.timeUs = 200000;
  corrected.cars.forEach(car => { car.progress = 88; });
  race.install(corrected);
  expect(race.frame(200000, 0).renderedCars[0].progress).toBeCloseTo(80, 6);
});

test('late remote steering is already two-thirds complete after 100ms', () => {
  const b = baseline(), race = new RaceSession(b);
  race.frame(100000, 0);
  const car = { ...b.cars[1], controls: 1, effective: 1, heldMask: 1, lastInput: 1, freshnessUs: 1000000, phase: 1, departure: 2, target: 1, movementOrigin: 120, movementTarget: 0, movementStartUs: 0, movementEndUs: 150000, nextShiftUs: 250000 };
  race.disposition({ identity: b.identity, round: b.round, authority: 1, tick: 0, timeUs: 0, seat: 1, sequence: 1, processed: 1, disposition: 0, intent: 0, control: 1, car, contact: b.contact });
  expect(race.frame(100000, 0).cars[1].lateral).toBeCloseTo(40, 6);
  expect(race.frame(200000, 0).cars[1].lateral).toBe(0);
});

test('correction retains unresolved inputs exactly once by sequence cutoff', () => {
  const b = baseline(), race = new RaceSession(b);
  race.input({ identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 2, heldMask: 2 }, 0);
  const applied = race.frame(100000, 0);
  const corrected = structuredClone(b); corrected.epoch++;
  corrected.tick = 6; corrected.timeUs = 100000; corrected.cars = applied.cars;
  corrected.progress.processed1 = 1; corrected.progress.disposed1 = 1;
  // Sent before the checkpoint but not processed: replay by sequence, not time.
  race.input({ identity: b.identity, round: b.round, sequence: 2, intent: 1, control: 2, heldMask: 0 }, 50000);
  race.install(corrected);
  const frame = race.frame(300000, 0);
  expect(frame.cars[0].lateral).toBe(0);
  expect(frame.cars[0].lastInput).toBe(2);
  expect(frame.cars[0].effective).toBe(0);
});

test('a rejected local shift repairs gameplay and snaps its misleading animation', () => {
  const b = baseline(), race = new RaceSession(b);
  race.input({ identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 2, heldMask: 2 }, 0);
  expect(race.frame(100000, 0).cars[0].lateral).toBeCloseTo(-40, 6);
  race.disposition({ identity: b.identity, round: b.round, authority: 1, tick: 0, timeUs: 0, seat: 0, sequence: 1, processed: 1, disposition: 2, intent: 0, control: 2, car: b.cars[0], contact: b.contact });
  const frame = race.frame(100000, 0);
  expect(frame.cars[0].lateral).toBe(-120);
  expect(frame.renderedCars[0].lateral).toBe(-120);
});

test('large corrections snap and repeated small corrections retain the first settling deadline', () => {
  const b = baseline(), race = new RaceSession(b);
  race.frame(100000, 0);
  const corrected = structuredClone(b); corrected.epoch++;
  corrected.tick = 6; corrected.timeUs = 100000;
  corrected.cars.forEach(car => { car.progress = 48; });
  race.install(corrected); race.frame(100000, 0);
  corrected.epoch++; corrected.tick = 9; corrected.timeUs = 150000;
  corrected.cars.forEach(car => { car.progress = 72; });
  race.install(corrected); race.frame(150000, 0);
  expect(race.frame(200000, 0).renderedCars[0].progress).toBeCloseTo(92, 6);
  corrected.epoch++; corrected.tick = 12; corrected.timeUs = 200000;
  corrected.cars.forEach(car => { car.progress = 200; });
  race.install(corrected);
  expect(race.frame(200000, 0).renderedCars[0].progress).toBe(200);
});

test('old input generations and duplicate local sequences never enter replay', () => {
  const b = baseline(), race = new RaceSession(b);
  const input = { identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 3, heldMask: 4 };
  race.input({ ...input, round: { ...b.round, inputGeneration: 2 } }, 0);
  race.input(input, 0);
  race.input({ ...input, intent: 1, heldMask: 0 }, 0);
  expect(race.frame(100000, 0).cars[0].progress).toBe(80);
  expect(race.frame(100000, 0).cars[0].effective).toBe(3);
});

test('a replaced pair cannot enqueue local prediction into the current session', () => {
  const b = baseline(), race = new RaceSession(b);
  race.input({ identity: { ...b.identity, pairGeneration: b.identity.pairGeneration + 1 }, round: b.round, sequence: 1, intent: 0, control: 3, heldMask: 4 }, 0);
  expect(race.frame(100000, 0).cars[0].effective).toBe(0);
});

test('fresh-generation recovery drops pending controls and presentation offsets', () => {
  const b = baseline(), race = new RaceSession(b);
  race.input({ identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 2, heldMask: 2 }, 0);
  race.frame(100000, 0);
  const recovered = structuredClone(b); recovered.epoch++;
  recovered.round.inputGeneration++; recovered.cars[0].inputGeneration++;
  race.install(recovered);
  const frame = race.frame(100000, 0);
  expect(frame.cars[0].effective).toBe(0);
  expect(frame.renderedCars[0].lateral).toBe(-120);
});

test('correction diagnostics measure abrupt corrections and settling without counting normal movement', () => {
  let nowUs = 100000;
  const b = baseline(), race = new RaceSession(b, () => nowUs);
  race.frame(100000, 0);
  const corrected = structuredClone(b); corrected.epoch++;
  corrected.tick = 6; corrected.timeUs = 100000;
  corrected.cars.forEach(car => { car.progress = 48; });
  race.install(corrected); race.frame(100000, 0); nowUs = 200000; race.frame(200000, 0);
  expect(race.diagnostics[0]).toMatchObject({ corrections: 1, abrupt: 0, snaps: 0, maxSettlingUs: 100000 });
});

test('incomplete replacement track coverage cannot partially mutate authority', () => {
  const b = baseline(), race = new RaceSession(b);
  expect(() => race.coverage({ identity: b.identity, round: b.round, authority: 0, tick: 0, timeUs: 0, progress: b.progress, generator: b.generator,
    windows: [{ ...b.windows[0], end: 50 }] })).toThrow(/coverage/);
  expect(race.snapshot()).toEqual(b);
});

test('coverage headroom accepts the retained tick44 replay discrepancy', () => {
  const b = baseline();
  b.tick = 44; b.timeUs = 733333;
  b.cars[0].progress = 366.6669333333332;
  b.cars[1].progress = 293.33346666666654;
  const race = new RaceSession(b);
  const padding = b.context.gameplay.maxRoadSpeed * b.context.gameplay.accelSpeedMultiplier / b.context.gameplay.tickRate;
  const windows = [{ start: 233.3333333333332 - padding, end: 1626.6666666666665 + padding, firstSlice: 0, lastSlice: 0, objects: [] }];
  expect(() => race.coverage({ identity: b.identity, round: b.round, authority: 0, tick: 44, timeUs: 733333, progress: b.progress, generator: b.generator, windows })).not.toThrow();
  expect(race.snapshot().windows).toEqual(windows);
  expect(race.snapshot().cars.map(car => car.progress)).toEqual(b.cars.map(car => car.progress));
});

test('separate correction windows measure their own settling time', () => {
  let nowUs = 100000;
  const b = baseline(), race = new RaceSession(b, () => nowUs);
  race.frame(100000, 0);
  const corrected = structuredClone(b); corrected.epoch++;
  corrected.tick = 6; corrected.timeUs = 100000;
  corrected.cars.forEach(car => { car.progress = 48; });
  race.install(corrected); race.frame(100000, 0);
  corrected.epoch++; corrected.tick = 18; corrected.timeUs = 300000;
  corrected.cars.forEach(car => { car.progress = 136; });
  nowUs = 300000; race.install(corrected); race.frame(300000, 0); nowUs = 400000; race.frame(400000, 0);
  expect(race.diagnostics[0].maxSettlingUs).toBe(200000);
});

test('prediction stops at known track bounds and requests recovery', () => {
  const b = baseline(), race = new RaceSession(b);
  race.advanceAuthority(720); // 12s / 4800 units: old windows remain unchanged.
  const frame = race.frame(13000000, 0);
  expect(frame.needsRecovery).toBe(true);
  expect(frame.cars[0].progress).toBeLessThan(5000);
});

test('smoothing snaps when repaired cars would visually pass through each other', () => {
  const b = baseline();
  Object.assign(b.cars[1], { lateral: 0, lane: 1, departure: 1, target: 1, movementOrigin: 0, movementTarget: 0 });
  const race = new RaceSession(b); race.frame(100000, 0);
  const corrected = structuredClone(b); corrected.epoch++;
  corrected.tick = 6; corrected.timeUs = 100000;
  corrected.cars.forEach(car => { car.progress = 40; });
  Object.assign(corrected.cars[0], { lateral: 0, lane: 1, departure: 1, target: 1, movementOrigin: 0, movementTarget: 0 });
  Object.assign(corrected.cars[1], { lateral: -120, lane: 0, departure: 0, target: 0, movementOrigin: -120, movementTarget: -120 });
  race.install(corrected);
  const frame = race.frame(100000, 0);
  expect(frame.renderedCars[0].lateral).toBe(0);
  expect(frame.renderedCars[1].lateral).toBe(-120);
});


test('terminal simulation state is immutable after disconnect and late input', () => {
  const b = baseline(), game = new Multiplayer(captureConfiguration('drag-race', { gameplay: { finishDistance: 400, initialClearDistance: 0, reservedHearts: 0, obstacleWeight: 0, emptyWeight: 1 } }), 1, [b.identity, { ...b.identity, seat: 1 }]);
  game.submit(b.identity, { identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 3, heldMask: 4 });
  game.advanceTo(.5);
  const final = game.snapshot();
  expect(final.finish).toEqual({ tick: 27, timeUs: 450000, result: 0 });
  game.disconnect(b.identity);
  expect(game.submit(b.identity, { identity: b.identity, round: b.round, sequence: 2, intent: 1, control: 0, heldMask: 0 })).toBe(false);
  expect(game.advanceTo(2)).toEqual([]);
  expect(game.snapshot()).toEqual(final);
});

test('predicted fatal damage remains provisional and authority can repair it', () => {
  const b = baseline();
  b.cars[0].hp = 1;
  b.windows[0].firstSlice = 1; b.windows[0].lastSlice = 1;
  b.windows[0].objects = [{ id: 4, sliceId: 1, lane: 0, flags: 2, distance: 62 }];
  b.generator.nextSlice = 2; b.generator.nextObject = 7;
  const race = new RaceSession(b);
  const provisional = race.frame(50000, 0);
  expect(provisional).toMatchObject({ awaiting: true, outcome: undefined });
  expect(provisional.cars[0].hp).toBe(0);
  expect(race.frame(100000, 0).cars[0].progress).toBeCloseTo(40, 6);
  const repaired = structuredClone(b); repaired.epoch++;
  repaired.windows[0].objects[0].flags = 10;
  race.install(repaired);
  expect(race.frame(150000, 0).cars[0].hp).toBe(1);
  expect(race.frame(150000, 0).outcome).toBeUndefined();
});

test('an open canonical group withholds its tick and admits the next boundary input before finality', () => {
  const b = baseline(), game = new Multiplayer(captureConfiguration('drag-race', { gameplay: { finishDistance: 400, initialClearDistance: 0, reservedHearts: 0, obstacleWeight: 0, emptyWeight: 1 } }), 1, [b.identity, { ...b.identity, seat: 1 }]);
  const cars = game.snapshot().cars;
  cars[0].progress = 353.33336; cars[1].progress = 353.33328;
  game.restore(cars, 0);
  const checkpoint = game.snapshot();
  expect(game.advanceTo(1 / 60)).toEqual([]);
  expect(game.snapshot()).toEqual(checkpoint);
  expect(game.pendingGroup).toBe(true);
  game.submit(b.identity, { identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 3, heldMask: 4 });
  const events = game.advanceTo(2 / 60);
  expect(events.filter(event => event.type === 'input')).toMatchObject([{ timeUs: 16667, seat: 0, disposition: 'accepted' }]);
  expect(game.snapshot().finish).toEqual({ tick: 2, timeUs: 16667, result: 2 });
  expect(game.snapshot().cars[0].lastInput).toBe(1);
  expect(game.pendingGroup).toBe(false);
});

test('ordered boundary authority reconstructs both cars before the grouped object record', () => {
  const config = captureConfiguration('drag-race', { gameplay: { finishDistance: 2400, initialClearDistance: 0, reservedHearts: 2, sliceSpacing: 397, heartExclusionDistance: 0, heartSize: 51.99984 } });
  const b = initialBaseline(configurationContext(config, 1, 1000000));
  Object.assign(b.cars[0], { progress: 727.33336, lateral: 0, lane: 1, departure: 1, target: 1, movementOrigin: 0, movementTarget: 0, hp: 1 });
  b.windows = [{ start: -200, end: 5000, firstSlice: 2, lastSlice: 3, objects: [{ id: 8, sliceId: 2, lane: 1, distance: 794, flags: 2 }, { id: 11, sliceId: 3, lane: 1, distance: 800, flags: 3 }] }];
  b.generator.nextSlice = 4; b.generator.nextObject = 13;
  const race = new RaceSession(b);
  const car = { ...b.cars[0], progress: 734.0000266666666, controls: 3, effective: 3, flags: 1, heldMask: 4, lastInput: 1, freshnessUs: 1016667 };
  race.disposition({ identity: b.identity, round: b.round, authority: 1, tick: 1, timeUs: 16667, seat: 0, sequence: 1, processed: 1, disposition: 0, intent: 0, control: 3, car, contact: b.contact });
  expect(race.snapshot().cars[1].progress).toBeCloseTo(6.666666666666667, 6);
  expect(race.snapshot().cars[0].hp).toBe(1);
});

test('canonical group sample preserves the blocked segment before lateral clearance', () => {
  const b = baseline();
  const game = new Multiplayer(captureConfiguration('drag-race', { gameplay: { finishDistance: 450, initialClearDistance: 0, reservedHearts: 0, obstacleWeight: 1, emptyWeight: 0, coinWeight: 0, heartWeight: 0 } }), 1, [b.identity, { ...b.identity, seat: 1 }]);
  const cars = game.snapshot().cars;
  Object.assign(cars[0], { progress: 333.33304, hp: 1, controls: 3, effective: 3, heldMask: 4, flags: 1, freshnessUs: 1000000 });
  const origin = -70 / (1 - .0166668 / .15);
  Object.assign(cars[1], { progress: 343.33304, lateral: origin, lane: 1, departure: 1, target: 1, phase: 2, movementOrigin: origin, movementTarget: 0, movementStartUs: 0, movementEndUs: 150000 });
  game.restore(cars, 0);
  game.advanceTo(.05);
  const state = game.snapshot();
  expect(state.finish).toEqual({ tick: 2, timeUs: 16667, result: 1 });
  // Seed1 obstacle400: follower is blocked at400/s until clearance16666.8us,
  // then uses800/s to enter at16667.1us. Sample tick1 precedes clearance.
  expect(state.cars[0].progress).toBeCloseTo(333.33304 + 400 / 60, 6);
  expect(state.cars.map(car => car.hp)).toEqual([0, 2]);
});

test('Road Rage deadline prediction waits for authority and accepts fresh controls', () => {
  const config = captureConfiguration('road-rage', { gameplay: { timeLimit: .05, obstacleWeight: 0, emptyWeight: 1 } });
  const b = initialBaseline(configurationContext(config, 1, 1000000));
  b.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
  const race = new RaceSession(b);
  expect(race.frame(100000, 0)).toMatchObject({ awaiting: true, outcome: undefined });
  race.input({ identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 3, heldMask: 4 }, 100000);
  expect(race.frame(200000, 0).cars[0].effective).toBe(3);
  const outcome: Outcome = { identity: b.identity, roundId: b.round.roundId, outcomeId: 1, tick: 3, timeUs: 50000, result: 2, reason: 2,
    cars: b.cars.map(c => ({ progress: 20, lateral: c.lateral, hp: 3, score: 0 })), progress: b.progress };
  race.finish(outcome);
  expect(race.frame(300000, 0)).toMatchObject({ outcome, awaiting: false, timeUs: 50000 });
});

test('Road Rage restores shared history and reverses provisional player-contact damage', () => {
  const config = captureConfiguration('road-rage', { gameplay: { emptyWeight: 1, obstacleWeight: 0, maxHealth: 6 } });
  const b = initialBaseline(configurationContext(config, 1));
  b.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
  // Seat 0 already occupies middle; seat 1 approaches from right.
  Object.assign(b.cars[0], { lane: 1, departure: 1, target: 1, lateral: 0, movementOrigin: 0, movementTarget: 0 });
  b.identity.seat = 1;
  const race = new RaceSession(b);
  race.input({ identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 1, heldMask: 1 }, 0);
  expect(race.frame(100000, 0).cars.map(car => car.hp)).toEqual([5, 6]);
  // Authority accepted seat 0 NOS after seat 1 steering, so seat 1 is the victim.
  const authoritative = structuredClone(b);
  authoritative.epoch = 2;
  authoritative.contact = { ...b.contact, latestSeat: 0, latestControl: 3, latestSequence: 1, latestTimeUs: 0, latestOrder: 2 };
  Object.assign(authoritative.cars[1], { controls: 1, effective: 1, heldMask: 1, freshnessUs: 1000000, lastInput: 1, phase: 1, target: 1, movementEndUs: 150000, movementTarget: 0, nextShiftUs: 150000 });
  authoritative.progress.processed2 = authoritative.progress.disposed2 = 1;
  race.install(authoritative);
  expect(race.frame(100000, 0).cars.map(car => car.hp)).toEqual([6, 5]);
  expect(race.snapshot().contact.latestOrder).toBe(2);
});
