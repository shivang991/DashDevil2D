// Generated from protocol/schema.json. Run pnpm generate; do not edit.
import { encodeRecord, decodeRecord, encodeFrame, decodeFrame, projectRecord } from '../protocol/runtime';
export const protocolVersion = 3;
import { DefaultFrameBytes, RecordLimitBytes } from './constants';
export * from './constants';
export const HeldControlsLeft = 1;
export const HeldControlsRight = 2;
export const HeldControlsNOS = 4;
export const HeldControlsNone = 0;
export const HeldControlsAll = 7;
export const CarFlagsNOSActive = 1;
export const CarFlagsFreshSteeringRequired = 2;
export const CarFlagsFreshNOSRequired = 4;
export const CarFlagsForwardBlocked = 8;
export const CarFlagsNone = 0;
export const CarFlagsAll = 15;
export const ContactFlagsEpisodeActive = 1;
export const ContactFlagsDamageDecided = 2;
export const ContactFlagsTailgating = 4;
export const ContactFlagsNone = 0;
export const ContactFlagsEpisodeDamageDecided = 3;
export const ContactFlagsAll = 7;
export const SeatFlagsConnected = 1;
export const SeatFlagsReady = 2;
export const SeatFlagsReserved = 4;
export const SeatFlagsReturned = 8;
export const SeatFlagsNone = 0;
export const SeatFlagsConnectedReady = 3;
export const SeatFlagsAll = 15;
export const ObjectFlagsSharedConsumed = 4;
export const ObjectFlagsSpentPlayer1 = 8;
export const ObjectFlagsSpentPlayer2 = 16;
export const ObjectFlagsNone = 0;
export const ObjectFlagsKindMask = 3;
export const ObjectFlagsSpentMask = 24;
export const ObjectFlagsConsumptionMask = 28;
export const ObjectFlagsAll = 31;
export const SeatMaskPlayer1 = 1;
export const SeatMaskPlayer2 = 2;
export const SeatMaskNone = 0;
export const SeatMaskAll = 3;
export const ModeLongDrive = 0;
export const ModeDragRace = 1;
export const ModeRoadRage = 2;
export type Mode = typeof ModeLongDrive | typeof ModeDragRace | typeof ModeRoadRage;
export const SeatIndexPlayer1 = 0;
export const SeatIndexPlayer2 = 1;
export type SeatIndex = typeof SeatIndexPlayer1 | typeof SeatIndexPlayer2;
export const SeatOrNoneNone = 0;
export const SeatOrNonePlayer1 = 1;
export const SeatOrNonePlayer2 = 2;
export type SeatOrNone = typeof SeatOrNoneNone | typeof SeatOrNonePlayer1 | typeof SeatOrNonePlayer2;
export const LaneLeft = 0;
export const LaneMiddle = 1;
export const LaneRight = 2;
export type Lane = typeof LaneLeft | typeof LaneMiddle | typeof LaneRight;
export const ControlNone = 0;
export const ControlLeft = 1;
export const ControlRight = 2;
export const ControlNOS = 3;
export type Control = typeof ControlNone | typeof ControlLeft | typeof ControlRight | typeof ControlNOS;
export const InputIntentPress = 0;
export const InputIntentRelease = 1;
export const InputIntentRefresh = 2;
export type InputIntent = typeof InputIntentPress | typeof InputIntentRelease | typeof InputIntentRefresh;
export const DispositionCodeAccepted = 0;
export const DispositionCodeIgnored = 1;
export const DispositionCodeRejected = 2;
export type DispositionCode = typeof DispositionCodeAccepted | typeof DispositionCodeIgnored | typeof DispositionCodeRejected;
export const AdmissionOperationCreate = 0;
export const AdmissionOperationJoin = 1;
export const AdmissionOperationResume = 2;
export type AdmissionOperation = typeof AdmissionOperationCreate | typeof AdmissionOperationJoin | typeof AdmissionOperationResume;
export const RoomPhaseLobby = 0;
export const RoomPhaseCountdown = 1;
export const RoomPhaseActive = 2;
export const RoomPhaseEnded = 3;
export type RoomPhase = typeof RoomPhaseLobby | typeof RoomPhaseCountdown | typeof RoomPhaseActive | typeof RoomPhaseEnded;
export const RoomCommandCodeSelectMode = 0;
export const RoomCommandCodeReady = 1;
export const RoomCommandCodeStart = 2;
export const RoomCommandCodeLeave = 3;
export const RoomCommandCodeFocus = 4;
export const RoomCommandCodeReturnToLobby = 5;
export type RoomCommandCode = typeof RoomCommandCodeSelectMode | typeof RoomCommandCodeReady | typeof RoomCommandCodeStart | typeof RoomCommandCodeLeave | typeof RoomCommandCodeFocus | typeof RoomCommandCodeReturnToLobby;
export const OutcomeResultPlayer1Win = 0;
export const OutcomeResultPlayer2Win = 1;
export const OutcomeResultTie = 2;
export const OutcomeResultAbandoned = 3;
export type OutcomeResult = typeof OutcomeResultPlayer1Win | typeof OutcomeResultPlayer2Win | typeof OutcomeResultTie | typeof OutcomeResultAbandoned;
export const OutcomeReasonFinish = 0;
export const OutcomeReasonHP = 1;
export const OutcomeReasonDeadline = 2;
export const OutcomeReasonExplicitLeave = 3;
export const OutcomeReasonGraceExpiry = 4;
export const OutcomeReasonBothDisconnected = 5;
export const OutcomeReasonServerLag = 6;
export const OutcomeReasonMaintenance = 7;
export type OutcomeReason = typeof OutcomeReasonFinish | typeof OutcomeReasonHP | typeof OutcomeReasonDeadline | typeof OutcomeReasonExplicitLeave | typeof OutcomeReasonGraceExpiry | typeof OutcomeReasonBothDisconnected | typeof OutcomeReasonServerLag | typeof OutcomeReasonMaintenance;
export const EventKindPickup = 0;
export const EventKindObstacle = 1;
export const EventKindHPScoreProtection = 2;
export const EventKindContact = 3;
export const EventKindReturn = 4;
export const EventKindBlocking = 5;
export const EventKindFreshnessExpiry = 6;
export const EventKindControlRelease = 7;
export const EventKindRoundEvent = 8;
export type EventKind = typeof EventKindPickup | typeof EventKindObstacle | typeof EventKindHPScoreProtection | typeof EventKindContact | typeof EventKindReturn | typeof EventKindBlocking | typeof EventKindFreshnessExpiry | typeof EventKindControlRelease | typeof EventKindRoundEvent;
export const MovementPhaseSteady = 0;
export const MovementPhaseShift = 1;
export const MovementPhaseReturn = 2;
export type MovementPhase = typeof MovementPhaseSteady | typeof MovementPhaseShift | typeof MovementPhaseReturn;
export const WireBooleanFalse = 0;
export const WireBooleanTrue = 1;
export type WireBoolean = typeof WireBooleanFalse | typeof WireBooleanTrue;
export const ObjectKindEmpty = 0;
export const ObjectKindCoin = 1;
export const ObjectKindObstacle = 2;
export const ObjectKindHeart = 3;
export type ObjectKind = typeof ObjectKindEmpty | typeof ObjectKindCoin | typeof ObjectKindObstacle | typeof ObjectKindHeart;
export const ProtocolErrorCodeReserved0 = 0;
export const ProtocolErrorCodeIncompatibleHandshake = 1;
export const ProtocolErrorCodeAdmissionRejected = 2;
export const ProtocolErrorCodeMalformedOrProcessingFailure = 3;
export const ProtocolErrorCodeCapacityUnavailable = 4;
export const ProtocolErrorCodeRoomNotFound = 5;
export const ProtocolErrorCodeRoomUnavailable = 6;
export const ProtocolErrorCodeRoomExpired = 7;
export const ProtocolErrorCodeMaintenance = 8;
export const ProtocolErrorCodeReserved9 = 9;
export const ProtocolErrorCodeReserved10 = 10;
export const ProtocolErrorCodeReserved11 = 11;
export const ProtocolErrorCodeReserved12 = 12;
export const ProtocolErrorCodeReserved13 = 13;
export const ProtocolErrorCodeReserved14 = 14;
export const ProtocolErrorCodeReserved15 = 15;
export type ProtocolErrorCode = typeof ProtocolErrorCodeReserved0 | typeof ProtocolErrorCodeIncompatibleHandshake | typeof ProtocolErrorCodeAdmissionRejected | typeof ProtocolErrorCodeMalformedOrProcessingFailure | typeof ProtocolErrorCodeCapacityUnavailable | typeof ProtocolErrorCodeRoomNotFound | typeof ProtocolErrorCodeRoomUnavailable | typeof ProtocolErrorCodeRoomExpired | typeof ProtocolErrorCodeMaintenance | typeof ProtocolErrorCodeReserved9 | typeof ProtocolErrorCodeReserved10 | typeof ProtocolErrorCodeReserved11 | typeof ProtocolErrorCodeReserved12 | typeof ProtocolErrorCodeReserved13 | typeof ProtocolErrorCodeReserved14 | typeof ProtocolErrorCodeReserved15;
export const RecoveryReasonResynchronize = 0;
export const RecoveryReasonReserved1 = 1;
export const RecoveryReasonReserved2 = 2;
export const RecoveryReasonReserved3 = 3;
export const RecoveryReasonReserved4 = 4;
export type RecoveryReason = typeof RecoveryReasonResynchronize | typeof RecoveryReasonReserved1 | typeof RecoveryReasonReserved2 | typeof RecoveryReasonReserved3 | typeof RecoveryReasonReserved4;
export const LatestSeatCodePlayer1 = 0;
export const LatestSeatCodePlayer2 = 1;
export const LatestSeatCodeReserved = 2;
export type LatestSeatCode = typeof LatestSeatCodePlayer1 | typeof LatestSeatCodePlayer2 | typeof LatestSeatCodeReserved;
export const layouts = {
  "Identity": [
    {
      "name": "roomId",
      "type": "u32"
    },
    {
      "name": "seatSession",
      "type": "u32"
    },
    {
      "name": "pairGeneration",
      "type": "u32"
    },
    {
      "name": "seat",
      "type": "u8",
      "max": 1
    }
  ],
  "Round": [
    {
      "name": "roundId",
      "type": "u32"
    },
    {
      "name": "inputGeneration",
      "type": "u32"
    }
  ],
  "Progress": [
    {
      "name": "authority",
      "type": "u32"
    },
    {
      "name": "event",
      "type": "u32"
    },
    {
      "name": "processed1",
      "type": "u32"
    },
    {
      "name": "processed2",
      "type": "u32"
    },
    {
      "name": "disposed1",
      "type": "u32"
    },
    {
      "name": "disposed2",
      "type": "u32"
    }
  ],
  "Car": [
    {
      "name": "progress",
      "type": "f64",
      "projection": true
    },
    {
      "name": "lateral",
      "type": "f64",
      "projection": true
    },
    {
      "name": "normalSpeed",
      "type": "f64"
    },
    {
      "name": "lane",
      "type": "u8",
      "bits": 2,
      "max": 2
    },
    {
      "name": "departure",
      "type": "u8",
      "bits": 2,
      "max": 2
    },
    {
      "name": "target",
      "type": "u8",
      "bits": 2,
      "max": 2
    },
    {
      "name": "phase",
      "type": "u8",
      "bits": 2,
      "max": 2
    },
    {
      "name": "controls",
      "type": "u8",
      "bits": 2,
      "max": 3
    },
    {
      "name": "effective",
      "type": "u8",
      "bits": 2,
      "max": 3
    },
    {
      "name": "flags",
      "type": "u8",
      "bits": 4,
      "mask": 15
    },
    {
      "name": "movementOrigin",
      "type": "f64",
      "projection": true
    },
    {
      "name": "movementTarget",
      "type": "f64",
      "projection": true
    },
    {
      "name": "movementStartUs",
      "type": "us"
    },
    {
      "name": "movementEndUs",
      "type": "us"
    },
    {
      "name": "nextShiftUs",
      "type": "us"
    },
    {
      "name": "freshnessUs",
      "type": "us"
    },
    {
      "name": "protectionUs",
      "type": "us"
    },
    {
      "name": "hp",
      "type": "u32"
    },
    {
      "name": "score",
      "type": "u32"
    },
    {
      "name": "lastInput",
      "type": "u32"
    },
    {
      "name": "heldMask",
      "type": "u8",
      "mask": 7
    },
    {
      "name": "inputGeneration",
      "type": "u32"
    }
  ],
  "Contact": [
    {
      "name": "episode",
      "type": "u32"
    },
    {
      "name": "flags",
      "type": "u8",
      "mask": 7
    },
    {
      "name": "blockedSeat",
      "type": "u8",
      "max": 2
    },
    {
      "name": "latestSeat",
      "type": "u8",
      "max": 2
    },
    {
      "name": "latestControl",
      "type": "u8",
      "max": 3
    },
    {
      "name": "latestSequence",
      "type": "u32"
    },
    {
      "name": "latestTimeUs",
      "type": "us"
    },
    {
      "name": "latestOrder",
      "type": "u32"
    }
  ],
  "ObjectState": [
    {
      "name": "id",
      "type": "u32"
    },
    {
      "name": "sliceId",
      "type": "u32"
    },
    {
      "name": "lane",
      "type": "u8",
      "bits": 2,
      "max": 2
    },
    {
      "name": "flags",
      "type": "u8",
      "bits": 5,
      "mask": 31
    },
    {
      "name": "distance",
      "type": "f64",
      "projection": true
    }
  ],
  "Window": [
    {
      "name": "start",
      "type": "f64",
      "projection": true
    },
    {
      "name": "end",
      "type": "f64",
      "projection": true
    },
    {
      "name": "firstSlice",
      "type": "u32"
    },
    {
      "name": "lastSlice",
      "type": "u32"
    },
    {
      "name": "objects",
      "type": "ObjectState",
      "array": 40000
    }
  ],
  "Generator": [
    {
      "name": "randomState",
      "type": "u32"
    },
    {
      "name": "nextSlice",
      "type": "u32"
    },
    {
      "name": "nextObject",
      "type": "u32"
    },
    {
      "name": "cursor",
      "type": "f64",
      "projection": true
    },
    {
      "name": "nextSpawnUs",
      "type": "us"
    },
    {
      "name": "nextDifficultyUs",
      "type": "us"
    },
    {
      "name": "reservedCursor",
      "type": "u32"
    }
  ],
  "Gameplay": [
    {
      "name": "accelSpeedMultiplier",
      "type": "f64"
    },
    {
      "name": "carHeight",
      "type": "f64"
    },
    {
      "name": "carWidth",
      "type": "f64"
    },
    {
      "name": "coinSize",
      "type": "f64"
    },
    {
      "name": "coinWeight",
      "type": "f64"
    },
    {
      "name": "countdownDuration",
      "type": "f64"
    },
    {
      "name": "difficultyRampInterval",
      "type": "f64"
    },
    {
      "name": "emptyWeight",
      "type": "f64"
    },
    {
      "name": "finishDistance",
      "type": "f64"
    },
    {
      "name": "heartExclusionDistance",
      "type": "f64"
    },
    {
      "name": "heartSize",
      "type": "f64"
    },
    {
      "name": "heartWeight",
      "type": "f64"
    },
    {
      "name": "initialClearDistance",
      "type": "f64"
    },
    {
      "name": "initialSpawnInterval",
      "type": "f64"
    },
    {
      "name": "invincibleDuration",
      "type": "f64"
    },
    {
      "name": "laneLerpSpeed",
      "type": "f64"
    },
    {
      "name": "laneReturnDuration",
      "type": "f64"
    },
    {
      "name": "laneShiftDuration",
      "type": "f64"
    },
    {
      "name": "laneSpacing",
      "type": "f64"
    },
    {
      "name": "laneSwitchCooldownDuration",
      "type": "f64"
    },
    {
      "name": "maxHealth",
      "type": "f64"
    },
    {
      "name": "maxRoadSpeed",
      "type": "f64"
    },
    {
      "name": "minSpawnInterval",
      "type": "f64"
    },
    {
      "name": "obstacleDamage",
      "type": "f64"
    },
    {
      "name": "obstacleH",
      "type": "f64"
    },
    {
      "name": "obstacleW",
      "type": "f64"
    },
    {
      "name": "obstacleWeight",
      "type": "f64"
    },
    {
      "name": "playerContactDamage",
      "type": "f64"
    },
    {
      "name": "reservedHearts",
      "type": "f64"
    },
    {
      "name": "roadSpeedIncrement",
      "type": "f64"
    },
    {
      "name": "sliceSpacing",
      "type": "f64"
    },
    {
      "name": "spawnIntervalDecrement",
      "type": "f64"
    },
    {
      "name": "speedGrowth",
      "type": "f64"
    },
    {
      "name": "startingRoadSpeed",
      "type": "f64"
    },
    {
      "name": "tickRate",
      "type": "f64"
    },
    {
      "name": "timeLimit",
      "type": "f64"
    }
  ],
  "Presentation": [
    {
      "name": "accelCarOffset",
      "type": "f64"
    },
    {
      "name": "accelLerpSpeed",
      "type": "f64"
    },
    {
      "name": "blinkCount",
      "type": "f64"
    },
    {
      "name": "carBottomMargin",
      "type": "f64"
    },
    {
      "name": "carTiltLerpSpeed",
      "type": "f64"
    },
    {
      "name": "carTiltMaxAngle",
      "type": "f64"
    },
    {
      "name": "correctionSmoothing",
      "type": "f64"
    },
    {
      "name": "gameOverFadeMaxOpacity",
      "type": "f64"
    },
    {
      "name": "gameOverFadeSpeed",
      "type": "f64"
    },
    {
      "name": "gameOverShakeDuration",
      "type": "f64"
    },
    {
      "name": "gameOverShakeMultiplier",
      "type": "f64"
    },
    {
      "name": "narrowScreenWidth",
      "type": "f64"
    },
    {
      "name": "roadWidthRatioNarrow",
      "type": "f64"
    },
    {
      "name": "roadWidthRatioNormal",
      "type": "f64"
    },
    {
      "name": "shakeDuration",
      "type": "f64"
    },
    {
      "name": "shakeIntensity",
      "type": "f64"
    },
    {
      "name": "roundOverDelay",
      "type": "f64"
    }
  ],
  "Room": [
    {
      "name": "idleExpiry",
      "type": "f64"
    },
    {
      "name": "idleWarning",
      "type": "f64"
    },
    {
      "name": "reconnectGrace",
      "type": "f64"
    }
  ],
  "Connection": [
    {
      "name": "admissionTicketLifetime",
      "type": "f64"
    },
    {
      "name": "baselineBytes",
      "type": "f64"
    },
    {
      "name": "clockRequestRate",
      "type": "f64"
    },
    {
      "name": "clockSamples",
      "type": "f64"
    },
    {
      "name": "clockSyncInterval",
      "type": "f64"
    },
    {
      "name": "controlFreshnessExpiry",
      "type": "f64"
    },
    {
      "name": "controlRefreshInterval",
      "type": "f64"
    },
    {
      "name": "essentialProgressDeadline",
      "type": "f64"
    },
    {
      "name": "essentialQueueWait",
      "type": "f64"
    },
    {
      "name": "inputBurst",
      "type": "f64"
    },
    {
      "name": "inputRate",
      "type": "f64"
    },
    {
      "name": "networkBudgetWindow",
      "type": "f64"
    },
    {
      "name": "networkBytesPerSecond",
      "type": "f64"
    },
    {
      "name": "queueBytes",
      "type": "f64"
    },
    {
      "name": "queueMessages",
      "type": "f64"
    },
    {
      "name": "recoveryRequestRate",
      "type": "f64"
    },
    {
      "name": "reliableFrameBytes",
      "type": "f64"
    },
    {
      "name": "replayHistory",
      "type": "f64"
    },
    {
      "name": "verificationInterval",
      "type": "f64"
    }
  ],
  "Operational": [
    {
      "name": "simulationLagThreshold",
      "type": "f64"
    }
  ],
  "Context": [
    {
      "name": "configurationVersion",
      "type": "u32"
    },
    {
      "name": "configurationId",
      "type": "u32"
    },
    {
      "name": "generationVersion",
      "type": "u32"
    },
    {
      "name": "seed",
      "type": "u32"
    },
    {
      "name": "mode",
      "type": "u8",
      "max": 2
    },
    {
      "name": "startUs",
      "type": "us"
    },
    {
      "name": "gameplay",
      "type": "Gameplay"
    },
    {
      "name": "presentation",
      "type": "Presentation"
    },
    {
      "name": "room",
      "type": "Room"
    },
    {
      "name": "connection",
      "type": "Connection"
    },
    {
      "name": "operational",
      "type": "Operational"
    }
  ],
  "Baseline": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "epoch",
      "type": "u16"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "timeUs",
      "type": "us"
    },
    {
      "name": "progress",
      "type": "Progress"
    },
    {
      "name": "context",
      "type": "Context"
    },
    {
      "name": "cars",
      "type": "Car",
      "array": 2,
      "fixed": true
    },
    {
      "name": "contact",
      "type": "Contact"
    },
    {
      "name": "generator",
      "type": "Generator"
    },
    {
      "name": "windows",
      "type": "Window",
      "array": 2
    }
  ],
  "FinalCar": [
    {
      "name": "progress",
      "type": "f64"
    },
    {
      "name": "lateral",
      "type": "f64"
    },
    {
      "name": "hp",
      "type": "u32"
    },
    {
      "name": "score",
      "type": "u32"
    }
  ],
  "Seat": [
    {
      "name": "session",
      "type": "u32"
    },
    {
      "name": "name",
      "type": "string",
      "max": 128
    },
    {
      "name": "flags",
      "type": "u8",
      "mask": 15
    },
    {
      "name": "reservationUs",
      "type": "us"
    }
  ],
  "AdmissionRequest": [
    {
      "name": "operation",
      "type": "u8",
      "max": 2
    },
    {
      "name": "version",
      "type": "u16"
    },
    {
      "name": "code",
      "type": "string",
      "max": 4
    },
    {
      "name": "name",
      "type": "string",
      "max": 128
    },
    {
      "name": "credential",
      "type": "bytes",
      "max": 32
    }
  ],
  "Admission": [
    {
      "name": "version",
      "type": "u16"
    },
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "credential",
      "type": "bytes",
      "max": 32
    },
    {
      "name": "roomTicket",
      "type": "bytes",
      "max": 256
    },
    {
      "name": "gameplayTicket",
      "type": "bytes",
      "max": 256
    },
    {
      "name": "expiresUs",
      "type": "us"
    },
    {
      "name": "origin",
      "type": "string",
      "max": 512
    }
  ],
  "ProtocolError": [
    {
      "name": "code",
      "type": "u8",
      "max": 15
    },
    {
      "name": "expectedVersion",
      "type": "u16"
    },
    {
      "name": "detail",
      "type": "string",
      "max": 512
    }
  ],
  "RoomInitialization": [
    {
      "name": "version",
      "type": "u16"
    },
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "revision",
      "type": "u32"
    }
  ],
  "RoomState": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "revision",
      "type": "u32"
    },
    {
      "name": "mode",
      "type": "u8",
      "max": 2
    },
    {
      "name": "phase",
      "type": "u8",
      "max": 3
    },
    {
      "name": "host",
      "type": "u8",
      "max": 1
    },
    {
      "name": "seats",
      "type": "Seat",
      "array": 2,
      "fixed": true
    },
    {
      "name": "roundId",
      "type": "u32"
    },
    {
      "name": "startUs",
      "type": "us"
    },
    {
      "name": "idleWarningUs",
      "type": "us"
    },
    {
      "name": "idleExpiryUs",
      "type": "us"
    }
  ],
  "RoomCommand": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "sequence",
      "type": "u32"
    },
    {
      "name": "revision",
      "type": "u32"
    },
    {
      "name": "command",
      "type": "u8",
      "max": 5
    },
    {
      "name": "mode",
      "type": "u8",
      "max": 2
    },
    {
      "name": "ready",
      "type": "u8",
      "max": 1
    }
  ],
  "Handshake": [
    {
      "name": "version",
      "type": "u16"
    },
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "datagramBytes",
      "type": "u16"
    }
  ],
  "Initialization": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "context",
      "type": "Context"
    }
  ],
  "Ready": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "transferId",
      "type": "u32"
    },
    {
      "name": "epoch",
      "type": "u16"
    },
    {
      "name": "progress",
      "type": "Progress"
    }
  ],
  "ClockRequest": [
    {
      "name": "sequence",
      "type": "u32"
    },
    {
      "name": "clientSendUs",
      "type": "us"
    }
  ],
  "ClockReply": [
    {
      "name": "sequence",
      "type": "u32"
    },
    {
      "name": "clientSendUs",
      "type": "us"
    },
    {
      "name": "serverReceiveUs",
      "type": "us"
    },
    {
      "name": "serverSendUs",
      "type": "us"
    }
  ],
  "Recovery": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "reason",
      "type": "u8",
      "max": 4
    },
    {
      "name": "epoch",
      "type": "u16"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "progress",
      "type": "Progress"
    }
  ],
  "AuthorityAck": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "epoch",
      "type": "u16"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "progress",
      "type": "Progress"
    }
  ],
  "Outcome": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "roundId",
      "type": "u32"
    },
    {
      "name": "outcomeId",
      "type": "u32"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "timeUs",
      "type": "us"
    },
    {
      "name": "result",
      "type": "u8",
      "max": 3
    },
    {
      "name": "reason",
      "type": "u8",
      "max": 7
    },
    {
      "name": "cars",
      "type": "FinalCar",
      "array": 2,
      "fixed": true
    },
    {
      "name": "progress",
      "type": "Progress"
    }
  ],
  "Input": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "sequence",
      "type": "u32"
    },
    {
      "name": "intent",
      "type": "u8",
      "max": 2
    },
    {
      "name": "control",
      "type": "u8",
      "max": 3
    },
    {
      "name": "heldMask",
      "type": "u8",
      "mask": 7
    }
  ],
  "Disposition": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "authority",
      "type": "u32"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "timeUs",
      "type": "us"
    },
    {
      "name": "seat",
      "type": "u8",
      "max": 1
    },
    {
      "name": "sequence",
      "type": "u32"
    },
    {
      "name": "processed",
      "type": "u32"
    },
    {
      "name": "disposition",
      "type": "u8",
      "max": 2
    },
    {
      "name": "intent",
      "type": "u8",
      "max": 2
    },
    {
      "name": "control",
      "type": "u8",
      "max": 3
    },
    {
      "name": "car",
      "type": "Car"
    },
    {
      "name": "contact",
      "type": "Contact"
    }
  ],
  "Event": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "authority",
      "type": "u32"
    },
    {
      "name": "eventId",
      "type": "u32"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "timeUs",
      "type": "us"
    },
    {
      "name": "kind",
      "type": "u8",
      "max": 8
    },
    {
      "name": "causeInput",
      "type": "u32"
    },
    {
      "name": "objectId",
      "type": "u32"
    },
    {
      "name": "episodeId",
      "type": "u32"
    },
    {
      "name": "seatMask",
      "type": "u8",
      "mask": 3
    },
    {
      "name": "cars",
      "type": "Car",
      "array": 2,
      "fixed": true
    },
    {
      "name": "contact",
      "type": "Contact"
    },
    {
      "name": "objects",
      "type": "ObjectState",
      "array": 3
    }
  ],
  "Barrier": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "epoch",
      "type": "u16"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "timeUs",
      "type": "us"
    },
    {
      "name": "progress",
      "type": "Progress"
    }
  ],
  "BaselineChunk": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "transferId",
      "type": "u32"
    },
    {
      "name": "epoch",
      "type": "u16"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "progress",
      "type": "Progress"
    },
    {
      "name": "total",
      "type": "u32"
    },
    {
      "name": "offset",
      "type": "u32"
    },
    {
      "name": "index",
      "type": "u32"
    },
    {
      "name": "count",
      "type": "u32"
    },
    {
      "name": "data",
      "type": "bytes",
      "max": 1048576
    }
  ],
  "Verification": [
    {
      "name": "epoch",
      "type": "u16"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "crc",
      "type": "u32"
    }
  ],
  "Projection": [
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "configurationId",
      "type": "u32"
    },
    {
      "name": "generationVersion",
      "type": "u32"
    },
    {
      "name": "seed",
      "type": "u32"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "timeUs",
      "type": "us"
    },
    {
      "name": "progress",
      "type": "Progress"
    },
    {
      "name": "cars",
      "type": "Car",
      "array": 2,
      "fixed": true
    },
    {
      "name": "contact",
      "type": "Contact"
    },
    {
      "name": "generator",
      "type": "Generator"
    },
    {
      "name": "windows",
      "type": "Window",
      "array": 2
    }
  ],
  "Coverage": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "authority",
      "type": "u32"
    },
    {
      "name": "tick",
      "type": "u32"
    },
    {
      "name": "timeUs",
      "type": "us"
    },
    {
      "name": "progress",
      "type": "Progress"
    },
    {
      "name": "generator",
      "type": "Generator"
    },
    {
      "name": "windows",
      "type": "Window",
      "array": 2
    }
  ],
  "RoomReply": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "sequence",
      "type": "u32"
    },
    {
      "name": "revision",
      "type": "u32"
    },
    {
      "name": "accepted",
      "type": "u8",
      "max": 1
    },
    {
      "name": "detail",
      "type": "string",
      "max": 512
    }
  ],
  "RoomPulse": [
    {
      "name": "identity",
      "type": "Identity"
    },
    {
      "name": "sequence",
      "type": "u32"
    },
    {
      "name": "round",
      "type": "Round"
    },
    {
      "name": "serverUs",
      "type": "us"
    }
  ]
} as const;
export interface Identity {
  roomId: number;
  seatSession: number;
  pairGeneration: number;
  seat: SeatIndex;
}
export function encodeIdentity(value: Identity, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Identity', value, limit); }
export function decodeIdentity(bytes: Uint8Array, limit = RecordLimitBytes): Identity { return decodeRecord(layouts, 'Identity', bytes, limit) as Identity; }
export interface Round {
  roundId: number;
  inputGeneration: number;
}
export function encodeRound(value: Round, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Round', value, limit); }
export function decodeRound(bytes: Uint8Array, limit = RecordLimitBytes): Round { return decodeRecord(layouts, 'Round', bytes, limit) as Round; }
export interface Progress {
  authority: number;
  event: number;
  processed1: number;
  processed2: number;
  disposed1: number;
  disposed2: number;
}
export function encodeProgress(value: Progress, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Progress', value, limit); }
export function decodeProgress(bytes: Uint8Array, limit = RecordLimitBytes): Progress { return decodeRecord(layouts, 'Progress', bytes, limit) as Progress; }
export interface Car {
  progress: number;
  lateral: number;
  normalSpeed: number;
  lane: Lane;
  departure: Lane;
  target: Lane;
  phase: MovementPhase;
  controls: Control;
  effective: Control;
  flags: number;
  movementOrigin: number;
  movementTarget: number;
  movementStartUs: number;
  movementEndUs: number;
  nextShiftUs: number;
  freshnessUs: number;
  protectionUs: number;
  hp: number;
  score: number;
  lastInput: number;
  heldMask: number;
  inputGeneration: number;
}
export function encodeCar(value: Car, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Car', value, limit); }
export function decodeCar(bytes: Uint8Array, limit = RecordLimitBytes): Car { return decodeRecord(layouts, 'Car', bytes, limit) as Car; }
export interface Contact {
  episode: number;
  flags: number;
  blockedSeat: SeatOrNone;
  latestSeat: LatestSeatCode;
  latestControl: Control;
  latestSequence: number;
  latestTimeUs: number;
  latestOrder: number;
}
export function encodeContact(value: Contact, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Contact', value, limit); }
export function decodeContact(bytes: Uint8Array, limit = RecordLimitBytes): Contact { return decodeRecord(layouts, 'Contact', bytes, limit) as Contact; }
export interface ObjectState {
  id: number;
  sliceId: number;
  lane: Lane;
  flags: number;
  distance: number;
}
export function encodeObjectState(value: ObjectState, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'ObjectState', value, limit); }
export function decodeObjectState(bytes: Uint8Array, limit = RecordLimitBytes): ObjectState { return decodeRecord(layouts, 'ObjectState', bytes, limit) as ObjectState; }
export interface Window {
  start: number;
  end: number;
  firstSlice: number;
  lastSlice: number;
  objects: ObjectState[];
}
export function encodeWindow(value: Window, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Window', value, limit); }
export function decodeWindow(bytes: Uint8Array, limit = RecordLimitBytes): Window { return decodeRecord(layouts, 'Window', bytes, limit) as Window; }
export interface Generator {
  randomState: number;
  nextSlice: number;
  nextObject: number;
  cursor: number;
  nextSpawnUs: number;
  nextDifficultyUs: number;
  reservedCursor: number;
}
export function encodeGenerator(value: Generator, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Generator', value, limit); }
export function decodeGenerator(bytes: Uint8Array, limit = RecordLimitBytes): Generator { return decodeRecord(layouts, 'Generator', bytes, limit) as Generator; }
export interface Gameplay {
  accelSpeedMultiplier: number;
  carHeight: number;
  carWidth: number;
  coinSize: number;
  coinWeight: number;
  countdownDuration: number;
  difficultyRampInterval: number;
  emptyWeight: number;
  finishDistance: number;
  heartExclusionDistance: number;
  heartSize: number;
  heartWeight: number;
  initialClearDistance: number;
  initialSpawnInterval: number;
  invincibleDuration: number;
  laneLerpSpeed: number;
  laneReturnDuration: number;
  laneShiftDuration: number;
  laneSpacing: number;
  laneSwitchCooldownDuration: number;
  maxHealth: number;
  maxRoadSpeed: number;
  minSpawnInterval: number;
  obstacleDamage: number;
  obstacleH: number;
  obstacleW: number;
  obstacleWeight: number;
  playerContactDamage: number;
  reservedHearts: number;
  roadSpeedIncrement: number;
  sliceSpacing: number;
  spawnIntervalDecrement: number;
  speedGrowth: number;
  startingRoadSpeed: number;
  tickRate: number;
  timeLimit: number;
}
export function encodeGameplay(value: Gameplay, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Gameplay', value, limit); }
export function decodeGameplay(bytes: Uint8Array, limit = RecordLimitBytes): Gameplay { return decodeRecord(layouts, 'Gameplay', bytes, limit) as Gameplay; }
export interface Presentation {
  accelCarOffset: number;
  accelLerpSpeed: number;
  blinkCount: number;
  carBottomMargin: number;
  carTiltLerpSpeed: number;
  carTiltMaxAngle: number;
  correctionSmoothing: number;
  gameOverFadeMaxOpacity: number;
  gameOverFadeSpeed: number;
  gameOverShakeDuration: number;
  gameOverShakeMultiplier: number;
  narrowScreenWidth: number;
  roadWidthRatioNarrow: number;
  roadWidthRatioNormal: number;
  shakeDuration: number;
  shakeIntensity: number;
  roundOverDelay: number;
}
export function encodePresentation(value: Presentation, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Presentation', value, limit); }
export function decodePresentation(bytes: Uint8Array, limit = RecordLimitBytes): Presentation { return decodeRecord(layouts, 'Presentation', bytes, limit) as Presentation; }
export interface Room {
  idleExpiry: number;
  idleWarning: number;
  reconnectGrace: number;
}
export function encodeRoom(value: Room, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Room', value, limit); }
export function decodeRoom(bytes: Uint8Array, limit = RecordLimitBytes): Room { return decodeRecord(layouts, 'Room', bytes, limit) as Room; }
export interface Connection {
  admissionTicketLifetime: number;
  baselineBytes: number;
  clockRequestRate: number;
  clockSamples: number;
  clockSyncInterval: number;
  controlFreshnessExpiry: number;
  controlRefreshInterval: number;
  essentialProgressDeadline: number;
  essentialQueueWait: number;
  inputBurst: number;
  inputRate: number;
  networkBudgetWindow: number;
  networkBytesPerSecond: number;
  queueBytes: number;
  queueMessages: number;
  recoveryRequestRate: number;
  reliableFrameBytes: number;
  replayHistory: number;
  verificationInterval: number;
}
export function encodeConnection(value: Connection, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Connection', value, limit); }
export function decodeConnection(bytes: Uint8Array, limit = RecordLimitBytes): Connection { return decodeRecord(layouts, 'Connection', bytes, limit) as Connection; }
export interface Operational {
  simulationLagThreshold: number;
}
export function encodeOperational(value: Operational, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Operational', value, limit); }
export function decodeOperational(bytes: Uint8Array, limit = RecordLimitBytes): Operational { return decodeRecord(layouts, 'Operational', bytes, limit) as Operational; }
export interface Context {
  configurationVersion: number;
  configurationId: number;
  generationVersion: number;
  seed: number;
  mode: Mode;
  startUs: number;
  gameplay: Gameplay;
  presentation: Presentation;
  room: Room;
  connection: Connection;
  operational: Operational;
}
export function encodeContext(value: Context, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Context', value, limit); }
export function decodeContext(bytes: Uint8Array, limit = RecordLimitBytes): Context { return decodeRecord(layouts, 'Context', bytes, limit) as Context; }
export interface Baseline {
  identity: Identity;
  round: Round;
  epoch: number;
  tick: number;
  timeUs: number;
  progress: Progress;
  context: Context;
  cars: Car[];
  contact: Contact;
  generator: Generator;
  windows: Window[];
}
export function encodeBaseline(value: Baseline, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Baseline', value, limit); }
export function decodeBaseline(bytes: Uint8Array, limit = RecordLimitBytes): Baseline { return decodeRecord(layouts, 'Baseline', bytes, limit) as Baseline; }
export interface FinalCar {
  progress: number;
  lateral: number;
  hp: number;
  score: number;
}
export function encodeFinalCar(value: FinalCar, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'FinalCar', value, limit); }
export function decodeFinalCar(bytes: Uint8Array, limit = RecordLimitBytes): FinalCar { return decodeRecord(layouts, 'FinalCar', bytes, limit) as FinalCar; }
export interface Seat {
  session: number;
  name: string;
  flags: number;
  reservationUs: number;
}
export function encodeSeat(value: Seat, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Seat', value, limit); }
export function decodeSeat(bytes: Uint8Array, limit = RecordLimitBytes): Seat { return decodeRecord(layouts, 'Seat', bytes, limit) as Seat; }
export interface AdmissionRequest {
  operation: AdmissionOperation;
  version: number;
  code: string;
  name: string;
  credential: Uint8Array;
}
export function encodeAdmissionRequest(value: AdmissionRequest, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'AdmissionRequest', value, limit); }
export function decodeAdmissionRequest(bytes: Uint8Array, limit = RecordLimitBytes): AdmissionRequest { return decodeRecord(layouts, 'AdmissionRequest', bytes, limit) as AdmissionRequest; }
export interface Admission {
  version: number;
  identity: Identity;
  credential: Uint8Array;
  roomTicket: Uint8Array;
  gameplayTicket: Uint8Array;
  expiresUs: number;
  origin: string;
}
export function encodeAdmission(value: Admission, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Admission', value, limit); }
export function decodeAdmission(bytes: Uint8Array, limit = RecordLimitBytes): Admission { return decodeRecord(layouts, 'Admission', bytes, limit) as Admission; }
export interface ProtocolError {
  code: ProtocolErrorCode;
  expectedVersion: number;
  detail: string;
}
export function encodeProtocolError(value: ProtocolError, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'ProtocolError', value, limit); }
export function decodeProtocolError(bytes: Uint8Array, limit = RecordLimitBytes): ProtocolError { return decodeRecord(layouts, 'ProtocolError', bytes, limit) as ProtocolError; }
export interface RoomInitialization {
  version: number;
  identity: Identity;
  revision: number;
}
export function encodeRoomInitialization(value: RoomInitialization, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'RoomInitialization', value, limit); }
export function decodeRoomInitialization(bytes: Uint8Array, limit = RecordLimitBytes): RoomInitialization { return decodeRecord(layouts, 'RoomInitialization', bytes, limit) as RoomInitialization; }
export interface RoomState {
  identity: Identity;
  revision: number;
  mode: Mode;
  phase: RoomPhase;
  host: SeatIndex;
  seats: Seat[];
  roundId: number;
  startUs: number;
  idleWarningUs: number;
  idleExpiryUs: number;
}
export function encodeRoomState(value: RoomState, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'RoomState', value, limit); }
export function decodeRoomState(bytes: Uint8Array, limit = RecordLimitBytes): RoomState { return decodeRecord(layouts, 'RoomState', bytes, limit) as RoomState; }
export interface RoomCommand {
  identity: Identity;
  sequence: number;
  revision: number;
  command: RoomCommandCode;
  mode: Mode;
  ready: WireBoolean;
}
export function encodeRoomCommand(value: RoomCommand, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'RoomCommand', value, limit); }
export function decodeRoomCommand(bytes: Uint8Array, limit = RecordLimitBytes): RoomCommand { return decodeRecord(layouts, 'RoomCommand', bytes, limit) as RoomCommand; }
export interface Handshake {
  version: number;
  identity: Identity;
  datagramBytes: number;
}
export function encodeHandshake(value: Handshake, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Handshake', value, limit); }
export function decodeHandshake(bytes: Uint8Array, limit = RecordLimitBytes): Handshake { return decodeRecord(layouts, 'Handshake', bytes, limit) as Handshake; }
export interface Initialization {
  identity: Identity;
  round: Round;
  context: Context;
}
export function encodeInitialization(value: Initialization, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Initialization', value, limit); }
export function decodeInitialization(bytes: Uint8Array, limit = RecordLimitBytes): Initialization { return decodeRecord(layouts, 'Initialization', bytes, limit) as Initialization; }
export interface Ready {
  identity: Identity;
  round: Round;
  transferId: number;
  epoch: number;
  progress: Progress;
}
export function encodeReady(value: Ready, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Ready', value, limit); }
export function decodeReady(bytes: Uint8Array, limit = RecordLimitBytes): Ready { return decodeRecord(layouts, 'Ready', bytes, limit) as Ready; }
export interface ClockRequest {
  sequence: number;
  clientSendUs: number;
}
export function encodeClockRequest(value: ClockRequest, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'ClockRequest', value, limit); }
export function decodeClockRequest(bytes: Uint8Array, limit = RecordLimitBytes): ClockRequest { return decodeRecord(layouts, 'ClockRequest', bytes, limit) as ClockRequest; }
export interface ClockReply {
  sequence: number;
  clientSendUs: number;
  serverReceiveUs: number;
  serverSendUs: number;
}
export function encodeClockReply(value: ClockReply, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'ClockReply', value, limit); }
export function decodeClockReply(bytes: Uint8Array, limit = RecordLimitBytes): ClockReply { return decodeRecord(layouts, 'ClockReply', bytes, limit) as ClockReply; }
export interface Recovery {
  identity: Identity;
  round: Round;
  reason: RecoveryReason;
  epoch: number;
  tick: number;
  progress: Progress;
}
export function encodeRecovery(value: Recovery, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Recovery', value, limit); }
export function decodeRecovery(bytes: Uint8Array, limit = RecordLimitBytes): Recovery { return decodeRecord(layouts, 'Recovery', bytes, limit) as Recovery; }
export interface AuthorityAck {
  identity: Identity;
  round: Round;
  epoch: number;
  tick: number;
  progress: Progress;
}
export function encodeAuthorityAck(value: AuthorityAck, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'AuthorityAck', value, limit); }
export function decodeAuthorityAck(bytes: Uint8Array, limit = RecordLimitBytes): AuthorityAck { return decodeRecord(layouts, 'AuthorityAck', bytes, limit) as AuthorityAck; }
export interface Outcome {
  identity: Identity;
  roundId: number;
  outcomeId: number;
  tick: number;
  timeUs: number;
  result: OutcomeResult;
  reason: OutcomeReason;
  cars: FinalCar[];
  progress: Progress;
}
export function encodeOutcome(value: Outcome, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Outcome', value, limit); }
export function decodeOutcome(bytes: Uint8Array, limit = RecordLimitBytes): Outcome { return decodeRecord(layouts, 'Outcome', bytes, limit) as Outcome; }
export interface Input {
  identity: Identity;
  round: Round;
  sequence: number;
  intent: InputIntent;
  control: Control;
  heldMask: number;
}
export function encodeInput(value: Input, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Input', value, limit); }
export function decodeInput(bytes: Uint8Array, limit = RecordLimitBytes): Input { return decodeRecord(layouts, 'Input', bytes, limit) as Input; }
export interface Disposition {
  identity: Identity;
  round: Round;
  authority: number;
  tick: number;
  timeUs: number;
  seat: SeatIndex;
  sequence: number;
  processed: number;
  disposition: DispositionCode;
  intent: InputIntent;
  control: Control;
  car: Car;
  contact: Contact;
}
export function encodeDisposition(value: Disposition, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Disposition', value, limit); }
export function decodeDisposition(bytes: Uint8Array, limit = RecordLimitBytes): Disposition { return decodeRecord(layouts, 'Disposition', bytes, limit) as Disposition; }
export interface Event {
  identity: Identity;
  round: Round;
  authority: number;
  eventId: number;
  tick: number;
  timeUs: number;
  kind: EventKind;
  causeInput: number;
  objectId: number;
  episodeId: number;
  seatMask: number;
  cars: Car[];
  contact: Contact;
  objects: ObjectState[];
}
export function encodeEvent(value: Event, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Event', value, limit); }
export function decodeEvent(bytes: Uint8Array, limit = RecordLimitBytes): Event { return decodeRecord(layouts, 'Event', bytes, limit) as Event; }
export interface Barrier {
  identity: Identity;
  round: Round;
  epoch: number;
  tick: number;
  timeUs: number;
  progress: Progress;
}
export function encodeBarrier(value: Barrier, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Barrier', value, limit); }
export function decodeBarrier(bytes: Uint8Array, limit = RecordLimitBytes): Barrier { return decodeRecord(layouts, 'Barrier', bytes, limit) as Barrier; }
export interface BaselineChunk {
  identity: Identity;
  round: Round;
  transferId: number;
  epoch: number;
  tick: number;
  progress: Progress;
  total: number;
  offset: number;
  index: number;
  count: number;
  data: Uint8Array;
}
export function encodeBaselineChunk(value: BaselineChunk, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'BaselineChunk', value, limit); }
export function decodeBaselineChunk(bytes: Uint8Array, limit = RecordLimitBytes): BaselineChunk { return decodeRecord(layouts, 'BaselineChunk', bytes, limit) as BaselineChunk; }
export interface Verification {
  epoch: number;
  tick: number;
  crc: number;
}
export function encodeVerification(value: Verification, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Verification', value, limit); }
export function decodeVerification(bytes: Uint8Array, limit = RecordLimitBytes): Verification { return decodeRecord(layouts, 'Verification', bytes, limit) as Verification; }
export interface Projection {
  round: Round;
  configurationId: number;
  generationVersion: number;
  seed: number;
  tick: number;
  timeUs: number;
  progress: Progress;
  cars: Car[];
  contact: Contact;
  generator: Generator;
  windows: Window[];
}
export function encodeProjection(value: Projection, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Projection', value, limit); }
export function decodeProjection(bytes: Uint8Array, limit = RecordLimitBytes): Projection { return decodeRecord(layouts, 'Projection', bytes, limit) as Projection; }
export interface Coverage {
  identity: Identity;
  round: Round;
  authority: number;
  tick: number;
  timeUs: number;
  progress: Progress;
  generator: Generator;
  windows: Window[];
}
export function encodeCoverage(value: Coverage, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'Coverage', value, limit); }
export function decodeCoverage(bytes: Uint8Array, limit = RecordLimitBytes): Coverage { return decodeRecord(layouts, 'Coverage', bytes, limit) as Coverage; }
export interface RoomReply {
  identity: Identity;
  sequence: number;
  revision: number;
  accepted: WireBoolean;
  detail: string;
}
export function encodeRoomReply(value: RoomReply, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'RoomReply', value, limit); }
export function decodeRoomReply(bytes: Uint8Array, limit = RecordLimitBytes): RoomReply { return decodeRecord(layouts, 'RoomReply', bytes, limit) as RoomReply; }
export interface RoomPulse {
  identity: Identity;
  sequence: number;
  round: Round;
  serverUs: number;
}
export function encodeRoomPulse(value: RoomPulse, limit = RecordLimitBytes): Uint8Array { return encodeRecord(layouts, 'RoomPulse', value, limit); }
export function decodeRoomPulse(bytes: Uint8Array, limit = RecordLimitBytes): RoomPulse { return decodeRecord(layouts, 'RoomPulse', bytes, limit) as RoomPulse; }
export const messageTypes = {
  "AdmissionRequest": {
    "id": 1,
    "channel": "https"
  },
  "Admission": {
    "id": 2,
    "channel": "https"
  },
  "ProtocolError": {
    "id": 3,
    "channel": "all-reliable"
  },
  "RoomInitialization": {
    "id": 4,
    "channel": "room"
  },
  "RoomState": {
    "id": 5,
    "channel": "room"
  },
  "RoomCommand": {
    "id": 6,
    "channel": "room"
  },
  "Handshake": {
    "id": 7,
    "channel": "control"
  },
  "Initialization": {
    "id": 8,
    "channel": "control"
  },
  "Ready": {
    "id": 9,
    "channel": "control"
  },
  "ClockRequest": {
    "id": 10,
    "channel": "control"
  },
  "ClockReply": {
    "id": 11,
    "channel": "control"
  },
  "Recovery": {
    "id": 12,
    "channel": "control"
  },
  "AuthorityAck": {
    "id": 13,
    "channel": "control"
  },
  "Outcome": {
    "id": 14,
    "channel": "control"
  },
  "Input": {
    "id": 15,
    "channel": "inputs"
  },
  "Disposition": {
    "id": 16,
    "channel": "authority"
  },
  "Event": {
    "id": 17,
    "channel": "authority"
  },
  "Barrier": {
    "id": 18,
    "channel": "authority"
  },
  "BaselineChunk": {
    "id": 19,
    "channel": "authority"
  },
  "Coverage": {
    "id": 20,
    "channel": "authority"
  },
  "RoomReply": {
    "id": 21,
    "channel": "room"
  },
  "RoomPulse": {
    "id": 22,
    "channel": "authority"
  }
} as const;
export interface Messages {
  AdmissionRequest: AdmissionRequest;
  Admission: Admission;
  ProtocolError: ProtocolError;
  RoomInitialization: RoomInitialization;
  RoomState: RoomState;
  RoomCommand: RoomCommand;
  Handshake: Handshake;
  Initialization: Initialization;
  Ready: Ready;
  ClockRequest: ClockRequest;
  ClockReply: ClockReply;
  Recovery: Recovery;
  AuthorityAck: AuthorityAck;
  Outcome: Outcome;
  Input: Input;
  Disposition: Disposition;
  Event: Event;
  Barrier: Barrier;
  BaselineChunk: BaselineChunk;
  Coverage: Coverage;
  RoomReply: RoomReply;
  RoomPulse: RoomPulse;
}
export function encodeMessage<K extends keyof Messages>(type: K, value: Messages[K], limit = DefaultFrameBytes): Uint8Array { return encodeFrame(layouts, type, messageTypes[type].id, value, limit); }
export function decodeMessage(bytes: Uint8Array, limit = DefaultFrameBytes): { [K in keyof Messages]: { type: K; value: Messages[K] } }[keyof Messages] { return decodeFrame(layouts, messageTypes, bytes, limit) as ReturnType<typeof decodeMessage>; }
export function projectBaseline(value: Baseline): Uint8Array { return projectRecord(layouts, 'Projection', { round: value.round, configurationId: value.context.configurationId, generationVersion: value.context.generationVersion, seed: value.context.seed, tick: value.tick, timeUs: value.timeUs, progress: value.progress, cars: value.cars, contact: value.contact, generator: value.generator, windows: value.windows }); }
