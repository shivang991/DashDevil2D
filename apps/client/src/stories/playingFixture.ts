import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext, initialBaseline } from "@dashdevil/contracts/validation";
import type { PairedConnection, PairedState } from "@/transport/PairedConnection";
import { lobby, room } from "./fixtures";

/** Fixed render data: no transport, prediction, or advancing simulation. */
export function playingFixture(mode: 1 | 2) {
  const configuration = captureConfiguration(mode === 1 ? "drag-race" : "road-rage");
  const context = configurationContext(configuration, 42, room.startUs);
  const baseline = initialBaseline(context);
  const progress = context.gameplay.finishDistance * 0.45;
  const cars = baseline.cars.map((car, seat) => ({
    ...car,
    progress: progress + (seat === 0 ? 0 : 160),
    lateral: seat === 0 ? 0 : context.gameplay.laneSpacing,
    hp: seat === 0 ? context.gameplay.maxHealth : Math.max(1, context.gameplay.maxHealth - 1),
    score: seat === 0 ? 120 : 90,
    effective: seat === 0 ? 3 : 0,
  }));
  const frame: NonNullable<ReturnType<PairedConnection["frame"]>> = {
    cars: [cars[0], cars[1]],
    renderedCars: cars.map(({ progress, lateral }) => ({ progress, lateral, tilt: 0 })),
    objects: [
      { id: 1, sliceId: 1, lane: 0, distance: progress + 240, flags: 2 },
      { id: 2, sliceId: 2, lane: 1, distance: progress + 380, flags: 1 },
      { id: 3, sliceId: 3, lane: 2, distance: progress + 500, flags: 3 },
    ],
    timeUs: 38_000_000,
    feedback: [],
    sounds: [],
    outcome: undefined,
    awaiting: false,
    stale: false,
    needsRecovery: false,
  };
  const state: PairedState = {
    ...lobby,
    room: { ...room, mode, phase: 2 },
    context,
    roundId: room.roundId,
    startUs: room.startUs,
  };
  return { frame, state };
}
