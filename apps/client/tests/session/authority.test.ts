// @vitest-environment node
import { expect, test } from "vitest";
import { AuthoritativeRoundState } from "../../src/game/AuthoritativeRoundState";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext, initialBaseline } from "@dashdevil/contracts/validation";
import {
  encodeBaseline,
  projectBaseline,
  type Baseline,
  type Outcome,
} from "@dashdevil/contracts/protocol";
import { crc32c } from "@dashdevil/contracts/wire";

function baseline() {
  const b = initialBaseline(configurationContext(captureConfiguration("drag-race"), 1, 1000000));
  b.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
  return b;
}
function initialize(authority: AuthoritativeRoundState, b: Baseline) {
  const effects = authority.accept({
    type: "Initialization",
    value: { identity: b.identity, round: b.round, context: b.context },
  });
  return [...effects, ...authority.initialized(b.round)];
}
function chunks(b: Baseline, count = 1) {
  const data = encodeBaseline(b),
    size = Math.ceil(data.length / count);
  return Array.from({ length: count }, (_, index) => ({
    type: "BaselineChunk" as const,
    value: {
      identity: b.identity,
      round: b.round,
      transferId: b.epoch,
      epoch: b.epoch,
      tick: b.tick,
      progress: b.progress,
      total: data.length,
      offset: index * size,
      index,
      count,
      data: data.slice(index * size, (index + 1) * size),
    },
  }));
}
function installed(diagnostic = false) {
  const b = baseline(),
    authority = new AuthoritativeRoundState(b.identity, diagnostic);
  initialize(authority, b);
  authority.accept(chunks(b)[0]);
  return { b, authority };
}
function barrier(authority: AuthoritativeRoundState, b: Baseline, tick: number, timeUs: number) {
  return authority.accept({
    type: "Barrier",
    value: {
      identity: b.identity,
      round: b.round,
      epoch: b.epoch,
      tick,
      timeUs,
      progress: b.progress,
    },
  });
}
function outcome(b: Baseline): Outcome {
  return {
    identity: b.identity,
    roundId: b.round.roundId,
    outcomeId: 1,
    tick: 29,
    timeUs: 475000,
    result: 0,
    reason: 0,
    cars: b.cars.map((car, seat) => ({
      progress: seat ? 190 : 380,
      lateral: car.lateral,
      hp: 3,
      score: 0,
    })),
    progress: b.progress,
  };
}

test("early reordered chunks install atomically after initialization and emit input setup before Ready", () => {
  const b = baseline(),
    authority = new AuthoritativeRoundState(b.identity),
    parts = chunks(b, 2);
  expect(authority.accept(parts[1])).toEqual([]);
  parts[1].value.data.fill(0); // Buffered records are owned by the module.
  expect(authority.round).toBeUndefined();
  expect(authority.view.baselineBytes).toBe(0);
  expect(initialize(authority, b).map((effect) => effect.type)).toEqual(["initialize"]);
  expect(authority.frame(0, 0)).toBeUndefined();
  const effects = authority.accept(parts[0]);
  expect(effects).toContainEqual({
    type: "send",
    message: "Ready",
    value: {
      identity: b.identity,
      round: b.round,
      transferId: b.epoch,
      epoch: b.epoch,
      progress: b.progress,
    },
  });
  expect(authority.frame(0, 0)?.cars).toEqual(b.cars);
  expect(authority.view.baselineBytes).toBe(encodeBaseline(b).length);
  expect(authority.accept.bind(authority, parts[0])).toThrow("Unexpected baseline transfer");
});

test("a complete early baseline emits initialization before its acknowledgement", () => {
  const b = baseline(),
    authority = new AuthoritativeRoundState(b.identity);
  authority.accept(chunks(b)[0]);
  const setup = authority.accept({
    type: "Initialization",
    value: { identity: b.identity, round: b.round, context: b.context },
  });
  expect(authority.round).toBeUndefined();
  expect(authority.frame(0, 0)).toBeUndefined();
  const effects = [...setup, ...authority.initialized(b.round)];
  expect(effects[0].type).toBe("initialize");
  expect(
    effects.findIndex((effect) => effect.type === "send" && effect.message === "Ready"),
  ).toBeGreaterThan(0);
  expect(authority.round).toEqual(b.round);
});

test("an outcome during a partial recovery remains final when the baseline completes", () => {
  const { b, authority } = installed();
  expect(authority.requestRecovery()).toMatchObject({ epoch: 1 });
  expect(authority.requestRecovery()).toBeUndefined();
  const repaired = { ...b, epoch: 2 },
    parts = chunks(repaired, 2);
  authority.accept(parts[0]);
  const final = outcome(b);
  const effects = authority.accept({ type: "Outcome", value: final });
  expect(effects.map((effect) => effect.type)).toEqual(["outcome"]);
  expect(authority.view.outcome).toEqual(final);
  const completion = authority.accept(parts[1]);
  expect(completion).toContainEqual({
    type: "send",
    message: "AuthorityAck",
    value: {
      identity: b.identity,
      round: b.round,
      epoch: 2,
      tick: final.tick,
      progress: final.progress,
    },
  });
  expect(authority.view).toMatchObject({
    outcome: final,
    timeUs: final.timeUs,
    positions: "380, 190",
  });
  expect(authority.frame(900000, 0)).toMatchObject({ outcome: final, timeUs: final.timeUs });
  expect(authority.accept({ type: "Outcome", value: { ...final, result: 1 } })).toEqual([]);
  expect(barrier(authority, repaired, 30, 500000)).toEqual([]);
  expect(authority.verify({ epoch: 2, tick: 30, crc: 1 })).toBe(false);
  expect(authority.requestRecovery()).toBeUndefined();
});

test("verification counts survive recovery while duplicates and old epochs cannot contribute", () => {
  const { b, authority } = installed(true);
  const crc = (tick: number, timeUs: number) => crc32c(projectBaseline({ ...b, tick, timeUs }));
  expect(authority.verify({ epoch: 1, tick: 1, crc: crc(1, 16667) })).toBe(false);
  barrier(authority, b, 1, 16667);
  expect(authority.view.verified).toBe(1);
  expect(authority.verify({ epoch: 1, tick: 2, crc: (crc(2, 33333) ^ 1) >>> 0 })).toBe(false);
  expect(barrier(authority, b, 2, 33333)).toContainEqual({ type: "recover" });
  expect(authority.requestRecovery()).toMatchObject({ epoch: 1, tick: 2 });
  expect(authority.requestRecovery()).toBeUndefined();
  b.epoch = 2;
  b.tick = 2;
  b.timeUs = 33333;
  authority.accept(chunks(b)[0]);
  barrier(authority, b, 3, 50000);
  authority.verify({ epoch: 1, tick: 3, crc: crc(3, 50000) });
  expect(authority.view.verified).toBe(1);
  expect(authority.verify({ epoch: 2, tick: 3, crc: crc(3, 50000) })).toBe(false);
  authority.verify({ epoch: 2, tick: 3, crc: crc(3, 50000) });
  expect(authority.view.verified).toBe(2);
});

test("a remote generation reset rebases watermarks before coverage and verification", () => {
  const b = baseline();
  b.progress = {
    authority: 10,
    event: 1,
    processed1: 3,
    disposed1: 3,
    processed2: 7,
    disposed2: 7,
  };
  b.cars[0].lastInput = 3;
  b.cars[1].lastInput = 7;
  const authority = new AuthoritativeRoundState(b.identity);
  initialize(authority, b);
  authority.accept(chunks(b)[0]);
  const cars = structuredClone(b.cars);
  cars[1].inputGeneration = 2;
  cars[1].lastInput = 0;
  const event = {
    type: "Event" as const,
    value: {
      identity: b.identity,
      round: b.round,
      authority: 11,
      eventId: 2,
      tick: 0,
      timeUs: 0,
      kind: 7,
      causeInput: 0,
      objectId: 0,
      episodeId: 0,
      seatMask: 2,
      cars,
      contact: b.contact,
      objects: [],
    },
  };
  const before = authority.frame(0, 0)?.cars;
  expect(() => authority.accept({ ...event, value: { ...event.value, authority: 12 } })).toThrow(
    "Authority event gap",
  );
  expect(authority.frame(0, 0)?.cars).toEqual(before);
  authority.accept(event);
  expect(authority.accept(event)).toEqual([]);
  const progress = {
    authority: 11,
    event: 2,
    processed1: 3,
    disposed1: 3,
    processed2: 0,
    disposed2: 0,
  };
  authority.accept({
    type: "Coverage",
    value: {
      identity: b.identity,
      round: b.round,
      authority: 11,
      tick: 0,
      timeUs: 0,
      progress,
      generator: b.generator,
      windows: b.windows,
    },
  });
  const expected = { ...b, cars, progress };
  const crc = crc32c(projectBaseline(expected));
  authority.verify({ epoch: 1, tick: 0, crc });
  expect(barrier(authority, expected, 0, 0)).not.toContainEqual({ type: "recover" });
  expect(authority.view.verified).toBe(1);
  expect(authority.frame(0, 0)?.cars[1].inputGeneration).toBe(2);
});

test("a new round clears finality and prediction; old rounds and pairs cannot replace it", () => {
  const { b, authority } = installed();
  authority.input(
    { identity: b.identity, round: b.round, sequence: 1, intent: 0, control: 3, heldMask: 4 },
    0,
  );
  expect(authority.frame(100000, 0)?.cars[0].progress).toBeCloseTo(80, 6);
  authority.accept({ type: "Outcome", value: outcome(b) });
  const next = baseline();
  next.round.roundId++;
  initialize(authority, next);
  expect(authority.view.outcome).toBeUndefined();
  expect(authority.frame(100000, 0)).toBeUndefined();
  authority.accept(chunks(next)[0]);
  expect(authority.frame(100000, 0)?.cars[0].progress).toBeCloseTo(40, 6);
  expect(() => initialize(authority, b)).toThrow("Stale round initialization");
  expect(() => authority.accept({ type: "Outcome", value: outcome(b) })).toThrow(
    "Outcome context mismatch",
  );
  const stalePair = {
    ...outcome(next),
    identity: { ...next.identity, pairGeneration: next.identity.pairGeneration + 1 },
  };
  expect(() => authority.accept({ type: "Outcome", value: stalePair })).toThrow(
    "Reliable identity mismatch",
  );
});

test("early transfer buffering remains bounded", () => {
  const b = baseline(),
    authority = new AuthoritativeRoundState(b.identity),
    first = chunks(b)[0];
  for (let i = 0; i < 64; i++) authority.accept(first);
  expect(() => authority.accept(first)).toThrow("Early baseline queue overflow");
  expect(authority.round).toBeUndefined();
});

test("view and acknowledgement values cannot mutate the owned round state", () => {
  const { b, authority } = installed();
  const view = authority.view;
  view.cars![0].hp = 0;
  view.context!.gameplay.baseSpeed = 1;
  const effects = barrier(authority, b, 0, 0);
  const ack = effects.find((effect) => effect.type === "send" && effect.message === "AuthorityAck");
  if (ack?.type !== "send") throw new Error("missing acknowledgement");
  ack.value.progress.authority = 999;
  expect(authority.frame(100000, 0)?.cars[0].progress).toBeCloseTo(40, 6);
  expect(authority.view.cars![0].hp).toBe(b.cars[0].hp);
  expect(barrier(authority, b, 0, 0)).toContainEqual({
    type: "send",
    message: "AuthorityAck",
    value: {
      identity: b.identity,
      round: b.round,
      epoch: b.epoch,
      tick: 0,
      progress: b.progress,
    },
  });
});

test("a cold recovered outcome stays visible before the first baseline is complete", () => {
  const b = baseline(),
    authority = new AuthoritativeRoundState(b.identity),
    parts = chunks(b, 2);
  initialize(authority, b);
  authority.accept(parts[0]);
  const final = outcome(b);
  expect(authority.accept({ type: "Outcome", value: final })).toEqual([{ type: "outcome" }]);
  expect(authority.view).toMatchObject({ outcome: final, timeUs: final.timeUs });
  expect(authority.frame(900000, 0)).toMatchObject({
    outcome: final,
    timeUs: 475000,
    cars: [
      { progress: 380, hp: 3, controls: 0, effective: 0, heldMask: 0 },
      { progress: 190, hp: 3, controls: 0, effective: 0, heldMask: 0 },
    ],
    renderedCars: [
      { progress: 380, tilt: 0 },
      { progress: 190, tilt: 0 },
    ],
    awaiting: false,
    stale: false,
    needsRecovery: false,
  });
  expect(authority.frame(2_000_000, 2_000_000)).toEqual(authority.frame(900000, 0));
  expect(authority.requestRecovery()).toBeUndefined();
  const completion = authority.accept(parts[1]);
  expect(
    completion.filter((effect) => effect.type === "send").map((effect) => effect.message),
  ).toEqual(["Ready", "AuthorityAck"]);
  expect(authority.frame(900000, 0)).toMatchObject({ outcome: final, timeUs: final.timeUs });
});
