import {
  type Car,
  ControlNone,
  ControlNOS,
  LaneLeft,
  LaneMiddle,
  LaneRight,
  ModeDragRace,
  ObjectKindCoin,
  ObjectKindHeart,
  ObjectKindObstacle,
  RoomPhaseActive,
  SeatIndexPlayer1,
} from "@dashdevil/contracts/protocol";

import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext, initialBaseline } from "@dashdevil/contracts/validation";
import type { MultiplayerMode, PairedConnection, PairedState } from "@/transport/PairedConnection";
import { lobby, room } from "./fixtures";

/** Fixed render data: no transport, prediction, or advancing simulation. */
export function playingFixture(mode: MultiplayerMode) {
  const configuration = captureConfiguration(mode === ModeDragRace ? "drag-race" : "road-rage");
  const context = configurationContext(configuration, 42, room.startUs);
  const baseline = initialBaseline(context);
  const progress = context.gameplay.finishDistance * 0.45;
  const cars = baseline.cars.map((car, seat): Car => ({
    ...car,
    progress: progress + (seat === SeatIndexPlayer1 ? 0 : 160),
    lateral: seat === SeatIndexPlayer1 ? 0 : context.gameplay.laneSpacing,
    hp:
      seat === SeatIndexPlayer1
        ? context.gameplay.maxHealth
        : Math.max(1, context.gameplay.maxHealth - 1),
    score: seat === SeatIndexPlayer1 ? 120 : 90,
    effective: seat === SeatIndexPlayer1 ? ControlNOS : ControlNone,
  }));
  const frame: NonNullable<ReturnType<PairedConnection["frame"]>> = {
    cars: [cars[0], cars[1]],
    renderedCars: cars.map(({ progress, lateral }) => ({ progress, lateral, tilt: 0 })),
    objects: [
      { id: 1, sliceId: 1, lane: LaneLeft, distance: progress + 240, flags: ObjectKindObstacle },
      { id: 2, sliceId: 2, lane: LaneMiddle, distance: progress + 380, flags: ObjectKindCoin },
      { id: 3, sliceId: 3, lane: LaneRight, distance: progress + 500, flags: ObjectKindHeart },
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
    room: { ...room, mode, phase: RoomPhaseActive },
    context,
    roundId: room.roundId,
    startUs: room.startUs,
  };
  return { frame, state };
}
