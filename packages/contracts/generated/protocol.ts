// Generated from protocol/schema.json. Run pnpm generate; do not edit.
import { encodeRecord, decodeRecord, encodeFrame, decodeFrame, projectRecord } from '../protocol/runtime';
export const protocolVersion = 1;
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
      "max": 2,
      "bits": 2
    },
    {
      "name": "departure",
      "type": "u8",
      "max": 2,
      "bits": 2
    },
    {
      "name": "target",
      "type": "u8",
      "max": 2,
      "bits": 2
    },
    {
      "name": "phase",
      "type": "u8",
      "max": 2,
      "bits": 2
    },
    {
      "name": "controls",
      "type": "u8",
      "max": 3,
      "bits": 2
    },
    {
      "name": "effective",
      "type": "u8",
      "max": 3,
      "bits": 2
    },
    {
      "name": "flags",
      "type": "u8",
      "mask": 15,
      "bits": 4
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
      "max": 2,
      "bits": 2
    },
    {
      "name": "flags",
      "type": "u8",
      "mask": 31,
      "bits": 5
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
      "mask": 7
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
      "max": 4
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
      "max": 6
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
  seat: number;
}
export function encodeIdentity(value: Identity, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Identity', value, limit); }
export function decodeIdentity(bytes: Uint8Array, limit = 1048576): Identity { return decodeRecord(layouts, 'Identity', bytes, limit) as Identity; }
export interface Round {
  roundId: number;
  inputGeneration: number;
}
export function encodeRound(value: Round, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Round', value, limit); }
export function decodeRound(bytes: Uint8Array, limit = 1048576): Round { return decodeRecord(layouts, 'Round', bytes, limit) as Round; }
export interface Progress {
  authority: number;
  event: number;
  processed1: number;
  processed2: number;
  disposed1: number;
  disposed2: number;
}
export function encodeProgress(value: Progress, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Progress', value, limit); }
export function decodeProgress(bytes: Uint8Array, limit = 1048576): Progress { return decodeRecord(layouts, 'Progress', bytes, limit) as Progress; }
export interface Car {
  progress: number;
  lateral: number;
  normalSpeed: number;
  lane: number;
  departure: number;
  target: number;
  phase: number;
  controls: number;
  effective: number;
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
export function encodeCar(value: Car, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Car', value, limit); }
export function decodeCar(bytes: Uint8Array, limit = 1048576): Car { return decodeRecord(layouts, 'Car', bytes, limit) as Car; }
export interface Contact {
  episode: number;
  flags: number;
  blockedSeat: number;
  latestSeat: number;
  latestControl: number;
  latestSequence: number;
  latestTimeUs: number;
  latestOrder: number;
}
export function encodeContact(value: Contact, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Contact', value, limit); }
export function decodeContact(bytes: Uint8Array, limit = 1048576): Contact { return decodeRecord(layouts, 'Contact', bytes, limit) as Contact; }
export interface ObjectState {
  id: number;
  sliceId: number;
  lane: number;
  flags: number;
  distance: number;
}
export function encodeObjectState(value: ObjectState, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'ObjectState', value, limit); }
export function decodeObjectState(bytes: Uint8Array, limit = 1048576): ObjectState { return decodeRecord(layouts, 'ObjectState', bytes, limit) as ObjectState; }
export interface Window {
  start: number;
  end: number;
  firstSlice: number;
  lastSlice: number;
  objects: ObjectState[];
}
export function encodeWindow(value: Window, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Window', value, limit); }
export function decodeWindow(bytes: Uint8Array, limit = 1048576): Window { return decodeRecord(layouts, 'Window', bytes, limit) as Window; }
export interface Generator {
  randomState: number;
  nextSlice: number;
  nextObject: number;
  cursor: number;
  nextSpawnUs: number;
  nextDifficultyUs: number;
  reservedCursor: number;
}
export function encodeGenerator(value: Generator, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Generator', value, limit); }
export function decodeGenerator(bytes: Uint8Array, limit = 1048576): Generator { return decodeRecord(layouts, 'Generator', bytes, limit) as Generator; }
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
export function encodeGameplay(value: Gameplay, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Gameplay', value, limit); }
export function decodeGameplay(bytes: Uint8Array, limit = 1048576): Gameplay { return decodeRecord(layouts, 'Gameplay', bytes, limit) as Gameplay; }
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
}
export function encodePresentation(value: Presentation, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Presentation', value, limit); }
export function decodePresentation(bytes: Uint8Array, limit = 1048576): Presentation { return decodeRecord(layouts, 'Presentation', bytes, limit) as Presentation; }
export interface Room {
  idleExpiry: number;
  idleWarning: number;
  reconnectGrace: number;
}
export function encodeRoom(value: Room, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Room', value, limit); }
export function decodeRoom(bytes: Uint8Array, limit = 1048576): Room { return decodeRecord(layouts, 'Room', bytes, limit) as Room; }
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
export function encodeConnection(value: Connection, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Connection', value, limit); }
export function decodeConnection(bytes: Uint8Array, limit = 1048576): Connection { return decodeRecord(layouts, 'Connection', bytes, limit) as Connection; }
export interface Operational {
  simulationLagThreshold: number;
}
export function encodeOperational(value: Operational, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Operational', value, limit); }
export function decodeOperational(bytes: Uint8Array, limit = 1048576): Operational { return decodeRecord(layouts, 'Operational', bytes, limit) as Operational; }
export interface Context {
  configurationVersion: number;
  configurationId: number;
  generationVersion: number;
  seed: number;
  mode: number;
  startUs: number;
  gameplay: Gameplay;
  presentation: Presentation;
  room: Room;
  connection: Connection;
  operational: Operational;
}
export function encodeContext(value: Context, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Context', value, limit); }
export function decodeContext(bytes: Uint8Array, limit = 1048576): Context { return decodeRecord(layouts, 'Context', bytes, limit) as Context; }
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
export function encodeBaseline(value: Baseline, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Baseline', value, limit); }
export function decodeBaseline(bytes: Uint8Array, limit = 1048576): Baseline { return decodeRecord(layouts, 'Baseline', bytes, limit) as Baseline; }
export interface FinalCar {
  progress: number;
  lateral: number;
  hp: number;
  score: number;
}
export function encodeFinalCar(value: FinalCar, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'FinalCar', value, limit); }
export function decodeFinalCar(bytes: Uint8Array, limit = 1048576): FinalCar { return decodeRecord(layouts, 'FinalCar', bytes, limit) as FinalCar; }
export interface Seat {
  session: number;
  name: string;
  flags: number;
  reservationUs: number;
}
export function encodeSeat(value: Seat, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Seat', value, limit); }
export function decodeSeat(bytes: Uint8Array, limit = 1048576): Seat { return decodeRecord(layouts, 'Seat', bytes, limit) as Seat; }
export interface AdmissionRequest {
  operation: number;
  version: number;
  code: string;
  name: string;
  credential: Uint8Array;
}
export function encodeAdmissionRequest(value: AdmissionRequest, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'AdmissionRequest', value, limit); }
export function decodeAdmissionRequest(bytes: Uint8Array, limit = 1048576): AdmissionRequest { return decodeRecord(layouts, 'AdmissionRequest', bytes, limit) as AdmissionRequest; }
export interface Admission {
  version: number;
  identity: Identity;
  credential: Uint8Array;
  roomTicket: Uint8Array;
  gameplayTicket: Uint8Array;
  expiresUs: number;
  origin: string;
}
export function encodeAdmission(value: Admission, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Admission', value, limit); }
export function decodeAdmission(bytes: Uint8Array, limit = 1048576): Admission { return decodeRecord(layouts, 'Admission', bytes, limit) as Admission; }
export interface ProtocolError {
  code: number;
  expectedVersion: number;
  detail: string;
}
export function encodeProtocolError(value: ProtocolError, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'ProtocolError', value, limit); }
export function decodeProtocolError(bytes: Uint8Array, limit = 1048576): ProtocolError { return decodeRecord(layouts, 'ProtocolError', bytes, limit) as ProtocolError; }
export interface RoomInitialization {
  version: number;
  identity: Identity;
  revision: number;
}
export function encodeRoomInitialization(value: RoomInitialization, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'RoomInitialization', value, limit); }
export function decodeRoomInitialization(bytes: Uint8Array, limit = 1048576): RoomInitialization { return decodeRecord(layouts, 'RoomInitialization', bytes, limit) as RoomInitialization; }
export interface RoomState {
  identity: Identity;
  revision: number;
  mode: number;
  phase: number;
  host: number;
  seats: Seat[];
  roundId: number;
  startUs: number;
  idleWarningUs: number;
  idleExpiryUs: number;
}
export function encodeRoomState(value: RoomState, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'RoomState', value, limit); }
export function decodeRoomState(bytes: Uint8Array, limit = 1048576): RoomState { return decodeRecord(layouts, 'RoomState', bytes, limit) as RoomState; }
export interface RoomCommand {
  identity: Identity;
  sequence: number;
  revision: number;
  command: number;
  mode: number;
  ready: number;
}
export function encodeRoomCommand(value: RoomCommand, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'RoomCommand', value, limit); }
export function decodeRoomCommand(bytes: Uint8Array, limit = 1048576): RoomCommand { return decodeRecord(layouts, 'RoomCommand', bytes, limit) as RoomCommand; }
export interface Handshake {
  version: number;
  identity: Identity;
  datagramBytes: number;
}
export function encodeHandshake(value: Handshake, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Handshake', value, limit); }
export function decodeHandshake(bytes: Uint8Array, limit = 1048576): Handshake { return decodeRecord(layouts, 'Handshake', bytes, limit) as Handshake; }
export interface Initialization {
  identity: Identity;
  round: Round;
  context: Context;
}
export function encodeInitialization(value: Initialization, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Initialization', value, limit); }
export function decodeInitialization(bytes: Uint8Array, limit = 1048576): Initialization { return decodeRecord(layouts, 'Initialization', bytes, limit) as Initialization; }
export interface Ready {
  identity: Identity;
  round: Round;
  transferId: number;
  epoch: number;
  progress: Progress;
}
export function encodeReady(value: Ready, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Ready', value, limit); }
export function decodeReady(bytes: Uint8Array, limit = 1048576): Ready { return decodeRecord(layouts, 'Ready', bytes, limit) as Ready; }
export interface ClockRequest {
  sequence: number;
  clientSendUs: number;
}
export function encodeClockRequest(value: ClockRequest, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'ClockRequest', value, limit); }
export function decodeClockRequest(bytes: Uint8Array, limit = 1048576): ClockRequest { return decodeRecord(layouts, 'ClockRequest', bytes, limit) as ClockRequest; }
export interface ClockReply {
  sequence: number;
  clientSendUs: number;
  serverReceiveUs: number;
  serverSendUs: number;
}
export function encodeClockReply(value: ClockReply, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'ClockReply', value, limit); }
export function decodeClockReply(bytes: Uint8Array, limit = 1048576): ClockReply { return decodeRecord(layouts, 'ClockReply', bytes, limit) as ClockReply; }
export interface Recovery {
  identity: Identity;
  round: Round;
  reason: number;
  epoch: number;
  tick: number;
  progress: Progress;
}
export function encodeRecovery(value: Recovery, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Recovery', value, limit); }
export function decodeRecovery(bytes: Uint8Array, limit = 1048576): Recovery { return decodeRecord(layouts, 'Recovery', bytes, limit) as Recovery; }
export interface AuthorityAck {
  identity: Identity;
  round: Round;
  epoch: number;
  tick: number;
  progress: Progress;
}
export function encodeAuthorityAck(value: AuthorityAck, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'AuthorityAck', value, limit); }
export function decodeAuthorityAck(bytes: Uint8Array, limit = 1048576): AuthorityAck { return decodeRecord(layouts, 'AuthorityAck', bytes, limit) as AuthorityAck; }
export interface Outcome {
  identity: Identity;
  roundId: number;
  outcomeId: number;
  tick: number;
  timeUs: number;
  result: number;
  reason: number;
  cars: FinalCar[];
  progress: Progress;
}
export function encodeOutcome(value: Outcome, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Outcome', value, limit); }
export function decodeOutcome(bytes: Uint8Array, limit = 1048576): Outcome { return decodeRecord(layouts, 'Outcome', bytes, limit) as Outcome; }
export interface Input {
  identity: Identity;
  round: Round;
  sequence: number;
  intent: number;
  control: number;
  heldMask: number;
}
export function encodeInput(value: Input, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Input', value, limit); }
export function decodeInput(bytes: Uint8Array, limit = 1048576): Input { return decodeRecord(layouts, 'Input', bytes, limit) as Input; }
export interface Disposition {
  identity: Identity;
  round: Round;
  authority: number;
  tick: number;
  timeUs: number;
  seat: number;
  sequence: number;
  processed: number;
  disposition: number;
  intent: number;
  control: number;
  car: Car;
  contact: Contact;
}
export function encodeDisposition(value: Disposition, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Disposition', value, limit); }
export function decodeDisposition(bytes: Uint8Array, limit = 1048576): Disposition { return decodeRecord(layouts, 'Disposition', bytes, limit) as Disposition; }
export interface Event {
  identity: Identity;
  round: Round;
  authority: number;
  eventId: number;
  tick: number;
  timeUs: number;
  kind: number;
  causeInput: number;
  objectId: number;
  episodeId: number;
  seatMask: number;
  cars: Car[];
  contact: Contact;
  objects: ObjectState[];
}
export function encodeEvent(value: Event, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Event', value, limit); }
export function decodeEvent(bytes: Uint8Array, limit = 1048576): Event { return decodeRecord(layouts, 'Event', bytes, limit) as Event; }
export interface Barrier {
  identity: Identity;
  round: Round;
  epoch: number;
  tick: number;
  timeUs: number;
  progress: Progress;
}
export function encodeBarrier(value: Barrier, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Barrier', value, limit); }
export function decodeBarrier(bytes: Uint8Array, limit = 1048576): Barrier { return decodeRecord(layouts, 'Barrier', bytes, limit) as Barrier; }
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
export function encodeBaselineChunk(value: BaselineChunk, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'BaselineChunk', value, limit); }
export function decodeBaselineChunk(bytes: Uint8Array, limit = 1048576): BaselineChunk { return decodeRecord(layouts, 'BaselineChunk', bytes, limit) as BaselineChunk; }
export interface Verification {
  epoch: number;
  tick: number;
  crc: number;
}
export function encodeVerification(value: Verification, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Verification', value, limit); }
export function decodeVerification(bytes: Uint8Array, limit = 1048576): Verification { return decodeRecord(layouts, 'Verification', bytes, limit) as Verification; }
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
export function encodeProjection(value: Projection, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Projection', value, limit); }
export function decodeProjection(bytes: Uint8Array, limit = 1048576): Projection { return decodeRecord(layouts, 'Projection', bytes, limit) as Projection; }
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
export function encodeCoverage(value: Coverage, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'Coverage', value, limit); }
export function decodeCoverage(bytes: Uint8Array, limit = 1048576): Coverage { return decodeRecord(layouts, 'Coverage', bytes, limit) as Coverage; }
export interface RoomReply {
  identity: Identity;
  sequence: number;
  revision: number;
  accepted: number;
  detail: string;
}
export function encodeRoomReply(value: RoomReply, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'RoomReply', value, limit); }
export function decodeRoomReply(bytes: Uint8Array, limit = 1048576): RoomReply { return decodeRecord(layouts, 'RoomReply', bytes, limit) as RoomReply; }
export interface RoomPulse {
  identity: Identity;
  sequence: number;
  round: Round;
  serverUs: number;
}
export function encodeRoomPulse(value: RoomPulse, limit = 1048576): Uint8Array { return encodeRecord(layouts, 'RoomPulse', value, limit); }
export function decodeRoomPulse(bytes: Uint8Array, limit = 1048576): RoomPulse { return decodeRecord(layouts, 'RoomPulse', bytes, limit) as RoomPulse; }
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
export function encodeMessage<K extends keyof Messages>(type: K, value: Messages[K], limit = 65536): Uint8Array { return encodeFrame(layouts, type, messageTypes[type].id, value, limit); }
export function decodeMessage(bytes: Uint8Array, limit = 65536): { [K in keyof Messages]: { type: K; value: Messages[K] } }[keyof Messages] { return decodeFrame(layouts, messageTypes, bytes, limit) as ReturnType<typeof decodeMessage>; }
export function projectBaseline(value: Baseline): Uint8Array { return projectRecord(layouts, 'Projection', { round: value.round, configurationId: value.context.configurationId, generationVersion: value.context.generationVersion, seed: value.context.seed, tick: value.tick, timeUs: value.timeUs, progress: value.progress, cars: value.cars, contact: value.contact, generator: value.generator, windows: value.windows }); }
