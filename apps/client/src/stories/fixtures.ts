import {
  type Identity,
  ModeDragRace,
  type Outcome,
  OutcomeReasonFinish,
  OutcomeResultPlayer1Win,
  RoomPhaseLobby,
  type RoomState,
  SeatFlagsConnectedReady,
  SeatIndexPlayer1,
} from "@dashdevil/contracts/protocol";

import type { PairedState } from "@/transport/PairedConnection";
export const identity: Identity = {
  roomId: 1,
  seatSession: 1,
  pairGeneration: 1,
  seat: SeatIndexPlayer1,
};
export const outcome: Outcome = {
  identity,
  roundId: 1,
  outcomeId: 1,
  tick: 900,
  timeUs: 15_000_000,
  result: OutcomeResultPlayer1Win,
  reason: OutcomeReasonFinish,
  cars: [
    { progress: 1000, lateral: 0, hp: 2, score: 120 },
    { progress: 950, lateral: 0, hp: 1, score: 90 },
  ],
  progress: { authority: 1, event: 1, processed1: 1, processed2: 1, disposed1: 0, disposed2: 0 },
};
export const room: RoomState = {
  identity,
  revision: 1,
  mode: ModeDragRace,
  phase: RoomPhaseLobby,
  host: SeatIndexPlayer1,
  roundId: 1,
  startUs: 3_000_000,
  idleWarningUs: 0,
  idleExpiryUs: 0,
  seats: [
    { session: 1, name: "Driver 01", flags: SeatFlagsConnectedReady, reservationUs: 0 },
    { session: 2, name: "Driver 02", flags: SeatFlagsConnectedReady, reservationUs: 0 },
  ],
};
export const disconnected: PairedState = {
  status: "Disconnected",
  code: "",
  connectedSeats: 0,
  verified: 0,
  barriers: 0,
  clockSamples: 0,
  clockOffsetUs: 0,
  diagnostics: { localInputs: 0, remoteRecords: 0 },
  positions: "",
  errors: [],
  baselineBytes: 0,
};
export const lobby: PairedState = {
  ...disconnected,
  status: "Connected",
  code: "1234",
  identity,
  room,
  connectedSeats: 2,
};
