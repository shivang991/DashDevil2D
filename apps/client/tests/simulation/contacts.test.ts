// @vitest-environment node
import { expect, test } from "vitest";
import fixtures from "../../../../packages/contracts/race/contacts.json";
import { Multiplayer } from "@dashdevil/simulation/multiplayer";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext, validateCar } from "@dashdevil/contracts/validation";
const ids = [0, 1].map((seat) => ({
  roomId: 1,
  seatSession: seat + 1,
  pairGeneration: 1,
  seat,
})) as [
  { roomId: number; seatSession: number; pairGeneration: number; seat: number },
  { roomId: number; seatSession: number; pairGeneration: number; seat: number },
];
for (const scenario of fixtures.scenarios)
  test(scenario.name, () => {
    const game = new Multiplayer(
      captureConfiguration("drag-race", scenario.overrides),
      scenario.seed,
      ids,
    );
    const cars = game.snapshot().cars;
    scenario.cars.forEach((car, seat) => Object.assign(cars[seat], car));
    game.restore(cars, scenario.tick);
    const events = game.advanceTo(scenario.advance),
      state = game.snapshot();
    for (const field of ["progress", "lateral"] as const)
      state.cars.forEach((car, seat) =>
        expect(Math.abs(car[field] - scenario.expected[field][seat])).toBeLessThanOrEqual(
          fixtures.precision.absolute +
            fixtures.precision.relative * Math.abs(scenario.expected[field][seat]),
        ),
      );
    for (const field of ["phase", "effective"] as const)
      expect(state.cars.map((car) => car[field])).toEqual(scenario.expected[field]);
    expect(events.filter((event) => event.type === "contact").map((event) => event.timeUs)).toEqual(
      scenario.expected.contactTimes,
    );
    expect(state.cars.map((car) => car.hp)).toEqual([3, 3]);
    state.cars.forEach((car) =>
      validateCar(
        car,
        state.timeUs,
        configurationContext(captureConfiguration("drag-race", scenario.overrides), scenario.seed),
      ),
    );
  });

test("return ignores presses and held refreshes; a fresh press after completion reactivates NOS", () => {
  const game = new Multiplayer(captureConfiguration("drag-race"), 1, ids);
  const scenario = fixtures.scenarios.find((s) => s.name.startsWith("single shifter"))!;
  const cars = game.snapshot().cars;
  scenario.cars.forEach((car, seat) => Object.assign(cars[seat], car));
  game.restore(cars, 0);
  game.advanceTo(0.1);
  const input = (sequence: number, intent: number, control: number, heldMask: number) =>
    game.submit(ids[0], {
      identity: ids[0],
      round: { roundId: 1, inputGeneration: 1 },
      sequence,
      intent,
      control,
      heldMask,
    });
  input(1, 0, 3, 4);
  expect(game.advanceTo(0.2).find((e) => e.sequence === 1)?.disposition).toBe("ignored");
  game.advanceTo(0.3);
  input(2, 2, 3, 4);
  expect(game.advanceTo(0.35).find((e) => e.sequence === 2)?.disposition).toBe("ignored");
  expect(game.snapshot().cars[0].phase).toBe(0);
  expect(game.snapshot().cars[0].effective).toBe(0);
  input(3, 0, 3, 4);
  game.advanceTo(0.4);
  expect(game.snapshot().cars[0].effective).toBe(3);
});

test("tailgating bars lane changes until a positive gap or sideways clearance", () => {
  const game = new Multiplayer(captureConfiguration("drag-race"), 1, ids);
  const cars = game.snapshot().cars;
  const scenario = fixtures.scenarios.find((s) => s.name.startsWith("equal requested"))!;
  scenario.cars.forEach((car, seat) => Object.assign(cars[seat], car));
  game.restore(cars, 0);
  game.submit(ids[0], {
    identity: ids[0],
    round: { roundId: 1, inputGeneration: 1 },
    sequence: 1,
    intent: 0,
    control: 1,
    heldMask: 1,
  });
  game.advanceTo(0.2);
  expect(game.snapshot().cars[0].phase).toBe(0);
  expect(game.snapshot().cars[0].lateral).toBe(0);
  game.submit(ids[1], {
    identity: ids[1],
    round: { roundId: 1, inputGeneration: 1 },
    sequence: 1,
    intent: 0,
    control: 3,
    heldMask: 4,
  });
  game.advanceTo(0.3);
  expect(game.snapshot().cars[0].phase).toBe(1);
  expect(game.snapshot().cars[0].lateral).toBeLessThan(0);
});
