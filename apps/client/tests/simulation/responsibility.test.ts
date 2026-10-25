// @vitest-environment node
import { expect, test } from "vitest";
import fixtures from "../../../../packages/contracts/race/responsibility.json";
import { encodeContact, type Contact, type Car } from "@dashdevil/contracts/protocol";
import { Multiplayer } from "@dashdevil/simulation/multiplayer";
import { captureConfiguration } from "@dashdevil/simulation/config";
const ids = [0, 1].map((seat) => ({
  roomId: 1,
  seatSession: seat + 1,
  pairGeneration: 1,
  seat,
})) as [
  { roomId: number; seatSession: number; pairGeneration: number; seat: number },
  { roomId: number; seatSession: number; pairGeneration: number; seat: number },
];
interface Step {
  at: number;
  inputs: { seat: number; control: number; intent: number; heldMask: number }[];
  hp: number[];
  contactTimes: number[];
  contact?: Contact;
  contactHex?: string;
  finish?: { tick: number; timeUs: number; result: number };
  reason?: number;
  progress?: number[];
  lateral?: number[];
  spent?: Record<string, number>;
  separated?: boolean;
  returnDeparture?: number;
  latestSeat?: number;
  latestOrder?: number;
  movementStartUs?: number[];
  movementEndUs?: number[];
}
const scenarios: {
  name: string;
  seed?: number;
  cars: Partial<Car>[];
  overrides?: { gameplay: Record<string, number> };
  steps: Step[];
}[] = fixtures.scenarios;
for (const scenario of scenarios)
  test(scenario.name, () => {
    const game = new Multiplayer(
      captureConfiguration("road-rage", scenario.overrides),
      scenario.seed ?? 1,
      ids,
    );
    const cars = game.snapshot().cars;
    scenario.cars.forEach((car, seat) => Object.assign(cars[seat], car));
    game.restore(cars, 0);
    const sequences = [0, 0];
    for (const step of scenario.steps) {
      for (const { seat, ...input } of step.inputs)
        expect(
          game.submit(ids[seat], {
            ...input,
            identity: ids[seat],
            round: { roundId: 1, inputGeneration: 1 },
            sequence: ++sequences[seat],
          }),
        ).toBe(true);
      const events = game.advanceTo(step.at);
      expect(game.snapshot().cars.map((car) => car.hp)).toEqual(step.hp);
      const state = game.snapshot();
      if (step.contact) {
        expect(state.contact).toEqual(step.contact);
        expect(Buffer.from(encodeContact(state.contact)).toString("hex")).toBe(step.contactHex);
      }
      if (step.finish) {
        expect(state.finish).toEqual(step.finish);
        expect(state.reason).toBe(step.reason);
      }
      for (const field of ["progress", "lateral"] as const)
        if (step[field])
          state.cars.forEach((car, seat) =>
            expect(Math.abs(car[field] - step[field]![seat])).toBeLessThanOrEqual(
              fixtures.precision.absolute +
                fixtures.precision.relative * Math.abs(step[field]![seat]),
            ),
          );
      if (step.spent)
        expect(
          Object.fromEntries(
            game
              .snapshot()
              .objects.filter((o) => o.flags & 28)
              .map((o) => [o.id, o.flags]),
          ),
        ).toEqual(step.spent);
      if (step.separated) {
        const [a, b] = game.snapshot().cars;
        expect(
          Math.abs(a.lateral - b.lateral) >= 50 - 1e-6 ||
            Math.abs(a.progress - b.progress) >= 80 - 1e-6,
        ).toBe(true);
      }
      if (step.returnDeparture !== undefined)
        expect(game.snapshot().cars[0].departure).toBe(step.returnDeparture);
      if (step.latestSeat !== undefined)
        expect(game.snapshot().latestPress?.seat).toBe(step.latestSeat);
      if (step.latestOrder !== undefined)
        expect(game.snapshot().latestPress?.order).toBe(step.latestOrder);
      for (const field of ["movementStartUs", "movementEndUs"] as const)
        if (step[field]) expect(game.snapshot().cars.map((car) => car[field])).toEqual(step[field]);
      expect(
        events.filter((event) => event.type === "contact").map((event) => event.timeUs),
      ).toEqual(step.contactTimes);
    }
  });
