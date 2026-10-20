// @vitest-environment node
import { expect, test } from "vitest";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { Multiplayer } from "@dashdevil/simulation/multiplayer";
const identity = { roomId: 1, seatSession: 11, pairGeneration: 1, seat: 0 };
const input = {
  identity,
  round: { roundId: 1, inputGeneration: 1 },
  sequence: 1,
  intent: 0,
  control: 3,
  heldMask: 4,
};
test("authenticated NOS starts at the next unprocessed tick without backdating", () => {
  const game = new Multiplayer(captureConfiguration("drag-race"), 1, [
    identity,
    { ...identity, seat: 1, seatSession: 22 },
  ]);
  game.advanceTo(0.1);
  expect(game.snapshot().cars[0].progress).toBeCloseTo(40, 9);
  expect(game.submit(identity, input)).toBe(true);
  const events = game.advanceTo(0.2);
  expect(events[0]).toMatchObject({
    type: "input",
    timeUs: 100000,
    tick: 6,
    disposition: "accepted",
    seat: 0,
  });
  expect(game.snapshot().cars[0].progress).toBeCloseTo(120, 9);
  expect(game.snapshot().cars[1].progress).toBeCloseTo(80, 9);
});
test("held steering shifts at constant speed and repeats only after completion", () => {
  const game = new Multiplayer(captureConfiguration("road-rage"), 1, [
    identity,
    { ...identity, seat: 1, seatSession: 22 },
  ]);
  // Isolate free steering from the opponent's newly implemented blocking.
  const cars = game.snapshot().cars;
  cars[1].progress = 200;
  game.restore(cars, 0);
  game.submit(identity, { ...input, control: 2, heldMask: 2 });
  game.advanceTo(0.1);
  expect(game.snapshot().cars[0].lateral).toBeCloseTo(-40, 9);
  game.advanceTo(0.3);
  expect(game.snapshot().cars[0]).toMatchObject({ lane: 2, phase: 0, lateral: 120 });
});
test("freshness expiry splits a tick, refresh cannot reactivate expired NOS", () => {
  const game = new Multiplayer(
    captureConfiguration("drag-race", {
      connection: { controlFreshnessExpiry: 0.31, controlRefreshInterval: 0.1 },
    }),
    1,
    [identity, { ...identity, seat: 1, seatSession: 22 }],
  );
  game.submit(identity, input);
  const events = game.advanceTo(0.5);
  expect(events).toContainEqual(
    expect.objectContaining({ type: "expiry", tick: 18, timeUs: 310000, seat: 0 }),
  );
  expect(game.snapshot().cars[0].progress).toBeCloseTo(324, 9);
  game.submit(identity, { ...input, sequence: 2, intent: 2 });
  expect(game.advanceTo(0.6)[0]).toMatchObject({ disposition: "ignored" });
  expect(game.snapshot().cars[0].effective).toBe(0);
});
test("disconnect releases held NOS immediately without cancelling an in-flight shift", () => {
  const game = new Multiplayer(captureConfiguration("drag-race"), 1, [
    identity,
    { ...identity, seat: 1, seatSession: 22 },
  ]);
  game.submit(identity, input);
  game.advanceTo(0.1);
  game.disconnect(identity);
  game.advanceTo(0.2);
  expect(game.snapshot().cars[0].effective).toBe(0);
  expect(game.snapshot().cars[0].progress).toBeCloseTo(120, 9);
});
test("overload abandons without skipping forward or revising final state", () => {
  const game = new Multiplayer(captureConfiguration("drag-race"), 1, [
    identity,
    { ...identity, seat: 1, seatSession: 22 },
  ]);
  expect(game.advanceTo(1.01)).toEqual([{ type: "abandoned", tick: 0, timeUs: 0 }]);
  expect(game.snapshot()).toMatchObject({ tick: 0, abandoned: true });
  expect(game.advanceTo(2)).toEqual([]);
});
import { MultiplayerTrack } from "@dashdevil/simulation/multiplayerTrack";
test("multiplayer seeded placement reserves hearts and suppresses nearby obstacles without moving anchors", () => {
  const track = new MultiplayerTrack(
    captureConfiguration("drag-race", {
      gameplay: { finishDistance: 2400, initialClearDistance: 0, reservedHearts: 2 },
    }),
    1,
  );
  track.ensureThrough(1200);
  expect(track.snapshot().slices).toEqual([
    { id: 1, distance: 400, timeUs: 0, cells: ["obstacle", "empty", "empty"] },
    { id: 2, distance: 800, timeUs: 0, cells: ["empty", "heart", "empty"] },
    { id: 3, distance: 800, timeUs: 0, cells: ["empty", "empty", "empty"] },
    { id: 4, distance: 1200, timeUs: 0, cells: ["obstacle", "empty", "empty"] },
  ]);
  const prefix = track.snapshot();
  track.ensureThrough(2000);
  expect(track.snapshot().slices.slice(0, 4)).toEqual(prefix.slices);
});
import fixtures from "../../../../packages/contracts/simulation/fixtures.json";
import { canonicalTime } from "@dashdevil/simulation/multiplayer";
import type { ConfigurationOverrides } from "@dashdevil/simulation/config";
for (const scenario of fixtures.scenarios) {
  test(`shared timeline: ${scenario.name}`, () => {
    const identities = [identity, { ...identity, seat: 1, seatSession: 22 }] as const;
    const game = new Multiplayer(
      captureConfiguration(
        scenario.mode as "drag-race" | "road-rage",
        scenario.overrides as ConfigurationOverrides<"drag-race" | "road-rage">,
      ),
      scenario.seed,
      identities,
    );
    const events = [];
    for (const step of scenario.steps) {
      if ("advance" in step) events.push(...game.advanceTo(step.advance!));
      else if ("disconnect" in step) game.disconnect(identities[step.disconnect!]);
      else if ("at" in step) {
        events.push(...game.advanceTo(step.at!));
        const command = step as {
          seat: number;
          sequence: number;
          intent: number;
          control: number;
          heldMask: number;
          payloadSeat?: number;
          roundId?: number;
        };
        game.submit(identities[command.seat], {
          identity: { ...identities[command.seat], seat: command.payloadSeat ?? command.seat },
          round: { roundId: command.roundId ?? 1, inputGeneration: 1 },
          sequence: command.sequence,
          intent: command.intent,
          control: command.control,
          heldMask: command.heldMask,
        });
      }
    }
    expect(
      events.map(({ car, ...event }) => {
        if (car)
          validateCar(
            car,
            event.timeUs,
            configurationContext(
              captureConfiguration(
                scenario.mode as "drag-race" | "road-rage",
                scenario.overrides as ConfigurationOverrides<"drag-race" | "road-rage">,
              ),
            ),
          );
        return event;
      }),
    ).toEqual(scenario.expected.events);
    const snapshot = game.snapshot();
    if ("trackDistances" in scenario.expected)
      expect(snapshot.track.slices.map((slice) => slice.distance)).toEqual(
        scenario.expected.trackDistances,
      );
    for (const [seat, expected] of scenario.expected.cars.entries())
      for (const [key, value] of Object.entries(expected)) {
        const actual = snapshot.cars[seat][key as keyof (typeof snapshot.cars)[0]];
        if (["progress", "lateral", "normalSpeed"].includes(key))
          expect(Math.abs(actual - value)).toBeLessThanOrEqual(
            fixtures.precision.absolute + fixtures.precision.relative * Math.abs(value),
          );
        else expect(actual).toBe(value);
      }
    for (const [key, value] of Object.entries(scenario.expected))
      if (!["cars", "events", "derivation", "trackDistances"].includes(key))
        expect(snapshot[key as keyof typeof snapshot]).toEqual(value);
  });
}
for (const vector of fixtures.timeVectors)
  test(`canonical half-up time ${vector.seconds}`, () =>
    expect(canonicalTime(vector.seconds)).toBe(vector.expected));
import { firstContact } from "@dashdevil/simulation/geometry";
for (const vector of fixtures.geometry)
  test(`shared swept geometry: ${vector.name}`, () =>
    expect(firstContact(vector.a0, vector.a1, vector.b0, vector.b1)).toBe(vector.expected));
for (const scenario of fixtures.placement)
  test(`shared placement: ${scenario.name}`, () => {
    const track = new MultiplayerTrack(
      captureConfiguration(scenario.mode as "drag-race" | "road-rage", scenario.overrides),
      scenario.seed,
    );
    for (const through of scenario.through) track.ensureThrough(through);
    expect(track.snapshot()).toEqual(scenario.expected);
  });

import { configurationContext, validateCar } from "@dashdevil/contracts/validation";
test("snapshots cannot mutate captured state or another independent session", () => {
  const identities = [identity, { ...identity, seat: 1, seatSession: 22 }] as const;
  const first = new Multiplayer(captureConfiguration("drag-race"), 1, identities);
  const second = new Multiplayer(captureConfiguration("drag-race"), 1, identities);
  const snapshot = first.snapshot();
  snapshot.cars[0].hp = 0;
  snapshot.track.slices.push({
    id: 999,
    distance: 0,
    timeUs: 0,
    cells: ["coin", "empty", "empty"],
  });
  first.submit(identity, input);
  first.advanceTo(0.1);
  expect(first.snapshot().cars[0].hp).toBe(3);
  expect(first.snapshot().track.slices.some((slice) => slice.id === 999)).toBe(false);
  expect(second.snapshot().cars[0].progress).toBe(0);
});
test("input abuse fails explicitly and elapsed time is monotonic", () => {
  const game = new Multiplayer(
    captureConfiguration("drag-race", { connection: { inputBurst: 1 } }),
    1,
    [identity, { ...identity, seat: 1, seatSession: 22 }],
  );
  expect(game.submit({ ...identity, seatSession: 999 }, input)).toBe(false);
  expect(game.submit(identity, input)).toBe(true);
  expect(() => game.submit(identity, { ...input, sequence: 2 })).toThrow(
    "Input rate/queue exceeded",
  );
  game.advanceTo(0.1);
  expect(() => game.advanceTo(0.05)).toThrow("Monotonic");
  for (const seconds of [-1, NaN, Infinity, 1e20]) expect(() => canonicalTime(seconds)).toThrow();
});
