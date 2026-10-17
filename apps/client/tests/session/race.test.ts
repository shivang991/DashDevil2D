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
  if (scenario.phase) { car.target = scenario.phase === 1 ? 1 : 0; car.movementOrigin = scenario.phase === 1 ? -120 : -40; car.movementTarget = scenario.phase === 1 ? 0 : -120; car.lateral = car.movementOrigin; car.movementEndUs = 150000; }
  if (scenario.nos) { car.controls = 3; car.effective = 3; car.heldMask = 4; car.flags = 1; car.freshnessUs = 1000000; }
  const config = captureConfiguration('drag-race', { gameplay: { finishDistance: 400, initialClearDistance: 0, reservedHearts: 0, obstacleWeight: 0, emptyWeight: 1 } });
  const game = new Multiplayer(config, 1, [b.identity, { ...b.identity, seat: 1 }]);
  game.restore(b.cars, 0);
  game.advanceTo(1);
  expect(game.snapshot().finish).toEqual({ tick: scenario.tick, timeUs: scenario.timeUs, result: scenario.result });
  expect(game.snapshot().cars[0].progress).toBeCloseTo(360, 6);
  expect(game.snapshot().cars[0].lateral).toBeCloseTo(scenario.lateral, 6);
  const final = game.snapshot(); game.advanceTo(2); expect(game.snapshot()).toEqual(final);
});

test('rendered positions interpolate at current time without changing tick geometry', () => {
  const race = new RaceSession(baseline());
  const frame = race.frame(25000, 0);
  expect(frame.cars[0].progress).toBeCloseTo(6.666666666666667, 6);
  expect(frame.renderedCars[0].progress).toBeCloseTo(10, 6);
});
