// @vitest-environment node
import { expect, test } from "vitest";
import { RaceVerification } from "../../src/game/RaceVerification";

test("datagram before barrier waits; loss, reordering and wrong epochs do not regress progress", () => {
  const verification = new RaceVerification(2, 60, 2);
  expect(verification.datagram({ epoch: 3, tick: 12, crc: 1 })).toBe(false);
  expect(verification.datagram({ epoch: 2, tick: 12, crc: 123 })).toBe(false);
  expect(verification.barrier(12, 123)).toBe(false);
  expect(verification.verified).toBe(1);
  verification.barrier(24, 456);
  verification.datagram({ epoch: 2, tick: 24, crc: 456 });
  verification.datagram({ epoch: 2, tick: 12, crc: 999 });
  expect(verification.verified).toBe(2);
});

test("a mismatch requests correction and history is retained for two seconds in tick units", () => {
  const verification = new RaceVerification(1, 60, 2);
  verification.barrier(6, 11);
  for (let tick = 12; tick <= 120; tick += 6) verification.barrier(tick, 22);
  expect(verification.datagram({ epoch: 1, tick: 6, crc: 11 })).toBe(false);
  expect(verification.verified).toBe(1);
  expect(verification.datagram({ epoch: 1, tick: 120, crc: 33 })).toBe(true);
});

test("a missing barrier inside retained history requests recovery rather than guessing", () => {
  const verification = new RaceVerification(1, 60, 2);
  verification.barrier(6, 11);
  expect(verification.datagram({ epoch: 1, tick: 12, crc: 22 })).toBe(false);
  expect(verification.barrier(18, 33)).toBe(true);
});
