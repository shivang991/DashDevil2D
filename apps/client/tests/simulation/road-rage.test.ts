// @vitest-environment node
import { expect, test } from 'vitest';
import fixtures from '../../../../packages/contracts/race/road-rage.json';
import { Multiplayer } from '@dashdevil/simulation/multiplayer';
import { captureConfiguration } from '@dashdevil/simulation/config';
const ids = [0, 1].map(seat => ({ roomId: 1, seatSession: seat + 1, pairGeneration: 1, seat })) as [ { roomId: number; seatSession: number; pairGeneration: number; seat: number }, { roomId: number; seatSession: number; pairGeneration: number; seat: number } ];
for (const scenario of fixtures.scenarios) test(scenario.name, () => {
  const game = new Multiplayer(captureConfiguration('road-rage', scenario.overrides), scenario.seed, ids);
  const cars = game.snapshot().cars;
  scenario.cars.forEach((car, seat) => Object.assign(cars[seat], car));
  game.restore(cars, scenario.tick);
  game.advanceTo(scenario.advance);
  const state = game.snapshot(), expected = scenario.expected;
  expect(state.cars.map(car => car.hp)).toEqual(expected.hp);
  if (expected.score) expect(state.cars.map(car => car.score)).toEqual(expected.score);
  expect(state.cars.map(car => car.protectionUs)).toEqual(expected.protectionUs);
  expect(state.finish ?? null).toEqual(expected.finish);
  expect(state.reason ?? null).toBe(expected.reason);
  expect(Object.fromEntries(state.objects.filter(object => object.flags & 28).map(object => [object.id, object.flags]))).toEqual(expected.spent);
  if (expected.progress) state.cars.forEach((car, seat) => expect(Math.abs(car.progress - expected.progress![seat])).toBeLessThanOrEqual(fixtures.precision.absolute + fixtures.precision.relative * Math.abs(expected.progress![seat])));
  if (state.finish) {
    expect(game.submit(ids[0], { identity: ids[0], round: { roundId: 1, inputGeneration: 1 }, sequence: 1, intent: 0, control: 3, heldMask: 4 })).toBe(false);
    game.disconnect(ids[0]);
    expect(game.advanceTo(scenario.advance + 2)).toEqual([]);
    expect(game.snapshot()).toEqual(state);
  }
});
