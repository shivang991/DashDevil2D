// @vitest-environment node
import { expect, test } from 'vitest';
import fixtures from '../../../../packages/contracts/race/objects.json';
import { Multiplayer } from '@dashdevil/simulation/multiplayer';
import { captureConfiguration } from '@dashdevil/simulation/config';
const ids = [0, 1].map(seat => ({ roomId: 1, seatSession: seat + 1, pairGeneration: 1, seat })) as [ { roomId: number; seatSession: number; pairGeneration: number; seat: number }, { roomId: number; seatSession: number; pairGeneration: number; seat: number } ];
for (const scenario of fixtures.scenarios) test(scenario.name, () => {
  const game = new Multiplayer(captureConfiguration('drag-race', scenario.overrides), scenario.seed, ids);
  const cars = game.snapshot().cars;
  scenario.cars.forEach((car, seat) => Object.assign(cars[seat], car));
  game.restore(cars, scenario.tick);
  const events = game.advanceTo(scenario.advance);
  game.snapshot().cars.forEach((car, seat) => expect(Math.abs(car.progress - scenario.expected.progress[seat])).toBeLessThanOrEqual(fixtures.precision.absolute + fixtures.precision.relative * Math.abs(scenario.expected.progress[seat])));
  expect(game.snapshot().cars.map(car => car.hp)).toEqual(scenario.expected.hp);
  expect(game.snapshot().cars.map(car => car.score)).toEqual(scenario.expected.score);
  if ('finish' in scenario.expected) {
    expect(game.snapshot().finish).toEqual(scenario.expected.finish);
    expect(game.snapshot().reason).toBe(scenario.expected.hp.includes(0) ? 1 : 0);
    const final = game.snapshot();
    game.disconnect(ids[0]);
    expect(game.advanceTo(scenario.advance + 2)).toEqual([]);
    expect(game.snapshot()).toEqual(final);
  }
  expect(events.map(event => ({ timeUs: event.timeUs, objects: event.objects }))).toEqual(scenario.expected.events);
});
