// Code generated from protocol/schema.json; DO NOT EDIT.
package protocol

const DefaultConfigurationJSON = "{\n  \"version\": 1,\n  \"units\": {\n    \"distance\": \"world units\",\n    \"speed\": \"world units/second\",\n    \"duration\": \"seconds\",\n    \"rate\": \"inverse seconds\",\n    \"tickRate\": \"Hz\",\n    \"size\": \"bytes\"\n  },\n  \"fixed\": {\n    \"laneCount\": 3,\n    \"coinScore\": 10,\n    \"heartHealing\": 1,\n    \"predictionHorizon\": 1,\n    \"verificationDatagramBytes\": 10\n  },\n  \"gameplay\": {\n    \"long-drive\": {\n      \"maxHealth\": 2,\n      \"carWidth\": 50,\n      \"carHeight\": 80,\n      \"accelSpeedMultiplier\": 10,\n      \"invincibleDuration\": 2.0,\n      \"laneLerpSpeed\": 10,\n      \"laneSwitchCooldownDuration\": 0.15,\n      \"minSpawnInterval\": 0.35,\n      \"coinSize\": 28,\n      \"obstacleW\": 48,\n      \"obstacleH\": 40,\n      \"difficultyRampInterval\": 1,\n      \"roadSpeedIncrement\": 15,\n      \"maxRoadSpeed\": 900,\n      \"spawnIntervalDecrement\": 0.03,\n      \"startingRoadSpeed\": 400,\n      \"initialSpawnInterval\": 1,\n      \"obstacleDamage\": 1,\n      \"laneSpacing\": 120,\n      \"heartSize\": 28,\n      \"emptyWeight\": 0,\n      \"obstacleWeight\": 55,\n      \"coinWeight\": 45,\n      \"heartWeight\": 0\n    },\n    \"drag-race\": {\n      \"maxHealth\": 3,\n      \"carWidth\": 50,\n      \"carHeight\": 80,\n      \"accelSpeedMultiplier\": 2,\n      \"invincibleDuration\": 0,\n      \"coinSize\": 28,\n      \"obstacleW\": 48,\n      \"obstacleH\": 40,\n      \"maxRoadSpeed\": 400,\n      \"startingRoadSpeed\": 400,\n      \"obstacleDamage\": 1,\n      \"laneSpacing\": 120,\n      \"heartSize\": 28,\n      \"emptyWeight\": 0,\n      \"obstacleWeight\": 1,\n      \"coinWeight\": 0,\n      \"heartWeight\": 0,\n      \"tickRate\": 60,\n      \"speedGrowth\": 0,\n      \"laneShiftDuration\": 0.15,\n      \"laneSwitchCooldownDuration\": 0.15,\n      \"laneReturnDuration\": 0.15,\n      \"sliceSpacing\": 400,\n      \"initialClearDistance\": 800,\n      \"countdownDuration\": 3,\n      \"finishDistance\": 24000,\n      \"reservedHearts\": 4,\n      \"heartExclusionDistance\": 200\n    },\n    \"road-rage\": {\n      \"maxHealth\": 3,\n      \"carWidth\": 50,\n      \"carHeight\": 80,\n      \"accelSpeedMultiplier\": 2,\n      \"invincibleDuration\": 2,\n      \"coinSize\": 28,\n      \"obstacleW\": 48,\n      \"obstacleH\": 40,\n      \"maxRoadSpeed\": 400,\n      \"startingRoadSpeed\": 400,\n      \"obstacleDamage\": 1,\n      \"laneSpacing\": 120,\n      \"heartSize\": 28,\n      \"emptyWeight\": 0,\n      \"obstacleWeight\": 1,\n      \"coinWeight\": 0,\n      \"heartWeight\": 0,\n      \"tickRate\": 60,\n      \"speedGrowth\": 0,\n      \"laneShiftDuration\": 0.15,\n      \"laneSwitchCooldownDuration\": 0.15,\n      \"laneReturnDuration\": 0.15,\n      \"sliceSpacing\": 400,\n      \"initialClearDistance\": 800,\n      \"countdownDuration\": 3,\n      \"playerContactDamage\": 1,\n      \"timeLimit\": 120\n    }\n  },\n  \"presentation\": {\n    \"carBottomMargin\": 40,\n    \"accelCarOffset\": 80,\n    \"accelLerpSpeed\": 8,\n    \"blinkCount\": 3,\n    \"shakeDuration\": 0.5,\n    \"shakeIntensity\": 24,\n    \"narrowScreenWidth\": 320,\n    \"roadWidthRatioNarrow\": 1.0,\n    \"roadWidthRatioNormal\": 0.6,\n    \"carTiltMaxAngle\": 1,\n    \"carTiltLerpSpeed\": 12,\n    \"gameOverFadeMaxOpacity\": 0.75,\n    \"gameOverShakeMultiplier\": 1.5,\n    \"gameOverShakeDuration\": 0.5,\n    \"gameOverFadeSpeed\": 2,\n    \"correctionSmoothing\": 0.1\n  },\n  \"room\": {\n    \"reconnectGrace\": 15,\n    \"idleExpiry\": 900,\n    \"idleWarning\": 60\n  },\n  \"connection\": {\n    \"verificationInterval\": 0.1,\n    \"controlRefreshInterval\": 0.25,\n    \"controlFreshnessExpiry\": 1,\n    \"replayHistory\": 2,\n    \"clockSyncInterval\": 1,\n    \"clockSamples\": 8,\n    \"reliableFrameBytes\": 65536,\n    \"baselineBytes\": 1048576,\n    \"queueBytes\": 262144,\n    \"queueMessages\": 512,\n    \"essentialQueueWait\": 0.5,\n    \"essentialProgressDeadline\": 1,\n    \"inputRate\": 60,\n    \"inputBurst\": 120,\n    \"clockRequestRate\": 2,\n    \"recoveryRequestRate\": 1,\n    \"admissionTicketLifetime\": 30,\n    \"networkBytesPerSecond\": 16384,\n    \"networkBudgetWindow\": 60\n  },\n  \"operational\": {\n    \"simulationLagThreshold\": 1\n  }\n}\n"
const ProtocolVersion uint16 = 1

var layouts = map[string][]field{
	"Identity":           {{Name: "RoomId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "SeatSession", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "PairGeneration", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Seat", Type: "u8", Array: 0, Fixed: false, Max: 1, Mask: 0, Projection: false, Bits: 0}},
	"Round":              {{Name: "RoundId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "InputGeneration", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Progress":           {{Name: "Authority", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Event", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Processed1", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Processed2", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Disposed1", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Disposed2", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Car":                {{Name: "Progress", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}, {Name: "Lateral", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}, {Name: "NormalSpeed", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Lane", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 2}, {Name: "Departure", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 2}, {Name: "Target", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 2}, {Name: "Phase", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 2}, {Name: "Controls", Type: "u8", Array: 0, Fixed: false, Max: 3, Mask: 0, Projection: false, Bits: 2}, {Name: "Effective", Type: "u8", Array: 0, Fixed: false, Max: 3, Mask: 0, Projection: false, Bits: 2}, {Name: "Flags", Type: "u8", Array: 0, Fixed: false, Max: 0, Mask: 15, Projection: false, Bits: 4}, {Name: "MovementOrigin", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}, {Name: "MovementTarget", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}, {Name: "MovementStartUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "MovementEndUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "NextShiftUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "FreshnessUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ProtectionUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Hp", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Score", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LastInput", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "HeldMask", Type: "u8", Array: 0, Fixed: false, Max: 0, Mask: 7, Projection: false, Bits: 0}, {Name: "InputGeneration", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Contact":            {{Name: "Episode", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Flags", Type: "u8", Array: 0, Fixed: false, Max: 0, Mask: 7, Projection: false, Bits: 0}, {Name: "BlockedSeat", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "LatestSeat", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "LatestControl", Type: "u8", Array: 0, Fixed: false, Max: 3, Mask: 0, Projection: false, Bits: 0}, {Name: "LatestSequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LatestTimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LatestOrder", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"ObjectState":        {{Name: "Id", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "SliceId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Lane", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 2}, {Name: "Flags", Type: "u8", Array: 0, Fixed: false, Max: 0, Mask: 31, Projection: false, Bits: 5}, {Name: "Distance", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}},
	"Window":             {{Name: "Start", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}, {Name: "End", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}, {Name: "FirstSlice", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LastSlice", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Objects", Type: "ObjectState", Array: 40000, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Generator":          {{Name: "RandomState", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "NextSlice", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "NextObject", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Cursor", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: true, Bits: 0}, {Name: "NextSpawnUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "NextDifficultyUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ReservedCursor", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Gameplay":           {{Name: "AccelSpeedMultiplier", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CarHeight", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CarWidth", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CoinSize", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CoinWeight", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CountdownDuration", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "DifficultyRampInterval", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "EmptyWeight", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "FinishDistance", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "HeartExclusionDistance", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "HeartSize", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "HeartWeight", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "InitialClearDistance", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "InitialSpawnInterval", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "InvincibleDuration", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LaneLerpSpeed", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LaneReturnDuration", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LaneShiftDuration", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LaneSpacing", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "LaneSwitchCooldownDuration", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "MaxHealth", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "MaxRoadSpeed", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "MinSpawnInterval", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ObstacleDamage", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ObstacleH", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ObstacleW", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ObstacleWeight", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "PlayerContactDamage", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ReservedHearts", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "RoadSpeedIncrement", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "SliceSpacing", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "SpawnIntervalDecrement", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "SpeedGrowth", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "StartingRoadSpeed", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TickRate", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeLimit", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Presentation":       {{Name: "AccelCarOffset", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "AccelLerpSpeed", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "BlinkCount", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CarBottomMargin", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CarTiltLerpSpeed", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CarTiltMaxAngle", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "CorrectionSmoothing", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "GameOverFadeMaxOpacity", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "GameOverFadeSpeed", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "GameOverShakeDuration", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "GameOverShakeMultiplier", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "NarrowScreenWidth", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "RoadWidthRatioNarrow", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "RoadWidthRatioNormal", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ShakeDuration", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ShakeIntensity", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Room":               {{Name: "IdleExpiry", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "IdleWarning", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ReconnectGrace", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Connection":         {{Name: "AdmissionTicketLifetime", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "BaselineBytes", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ClockRequestRate", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ClockSamples", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ClockSyncInterval", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ControlFreshnessExpiry", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ControlRefreshInterval", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "EssentialProgressDeadline", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "EssentialQueueWait", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "InputBurst", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "InputRate", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "NetworkBudgetWindow", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "NetworkBytesPerSecond", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "QueueBytes", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "QueueMessages", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "RecoveryRequestRate", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ReliableFrameBytes", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ReplayHistory", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "VerificationInterval", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Operational":        {{Name: "SimulationLagThreshold", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Context":            {{Name: "ConfigurationVersion", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ConfigurationId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "GenerationVersion", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Seed", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Mode", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "StartUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Gameplay", Type: "Gameplay", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Presentation", Type: "Presentation", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Room", Type: "Room", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Connection", Type: "Connection", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Operational", Type: "Operational", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Baseline":           {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Epoch", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Context", Type: "Context", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Cars", Type: "Car", Array: 2, Fixed: true, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Contact", Type: "Contact", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Generator", Type: "Generator", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Windows", Type: "Window", Array: 2, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"FinalCar":           {{Name: "Progress", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Lateral", Type: "f64", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Hp", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Score", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Seat":               {{Name: "Session", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Name", Type: "string", Array: 0, Fixed: false, Max: 128, Mask: 0, Projection: false, Bits: 0}, {Name: "Flags", Type: "u8", Array: 0, Fixed: false, Max: 0, Mask: 7, Projection: false, Bits: 0}, {Name: "ReservationUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"AdmissionRequest":   {{Name: "Operation", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "Version", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Code", Type: "string", Array: 0, Fixed: false, Max: 4, Mask: 0, Projection: false, Bits: 0}, {Name: "Name", Type: "string", Array: 0, Fixed: false, Max: 128, Mask: 0, Projection: false, Bits: 0}, {Name: "Credential", Type: "bytes", Array: 0, Fixed: false, Max: 32, Mask: 0, Projection: false, Bits: 0}},
	"Admission":          {{Name: "Version", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Credential", Type: "bytes", Array: 0, Fixed: false, Max: 32, Mask: 0, Projection: false, Bits: 0}, {Name: "RoomTicket", Type: "bytes", Array: 0, Fixed: false, Max: 256, Mask: 0, Projection: false, Bits: 0}, {Name: "GameplayTicket", Type: "bytes", Array: 0, Fixed: false, Max: 256, Mask: 0, Projection: false, Bits: 0}, {Name: "ExpiresUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Origin", Type: "string", Array: 0, Fixed: false, Max: 512, Mask: 0, Projection: false, Bits: 0}},
	"ProtocolError":      {{Name: "Code", Type: "u8", Array: 0, Fixed: false, Max: 15, Mask: 0, Projection: false, Bits: 0}, {Name: "ExpectedVersion", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Detail", Type: "string", Array: 0, Fixed: false, Max: 512, Mask: 0, Projection: false, Bits: 0}},
	"RoomInitialization": {{Name: "Version", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Revision", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"RoomState":          {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Revision", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Mode", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "Phase", Type: "u8", Array: 0, Fixed: false, Max: 3, Mask: 0, Projection: false, Bits: 0}, {Name: "Host", Type: "u8", Array: 0, Fixed: false, Max: 1, Mask: 0, Projection: false, Bits: 0}, {Name: "Seats", Type: "Seat", Array: 2, Fixed: true, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "RoundId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "StartUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "IdleWarningUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "IdleExpiryUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"RoomCommand":        {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Sequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Revision", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Command", Type: "u8", Array: 0, Fixed: false, Max: 5, Mask: 0, Projection: false, Bits: 0}, {Name: "Mode", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "Ready", Type: "u8", Array: 0, Fixed: false, Max: 1, Mask: 0, Projection: false, Bits: 0}},
	"Handshake":          {{Name: "Version", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "DatagramBytes", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Initialization":     {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Context", Type: "Context", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Ready":              {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TransferId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Epoch", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"ClockRequest":       {{Name: "Sequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ClientSendUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"ClockReply":         {{Name: "Sequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ClientSendUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ServerReceiveUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ServerSendUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Recovery":           {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Reason", Type: "u8", Array: 0, Fixed: false, Max: 4, Mask: 0, Projection: false, Bits: 0}, {Name: "Epoch", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"AuthorityAck":       {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Epoch", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Outcome":            {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "RoundId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "OutcomeId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Result", Type: "u8", Array: 0, Fixed: false, Max: 3, Mask: 0, Projection: false, Bits: 0}, {Name: "Reason", Type: "u8", Array: 0, Fixed: false, Max: 6, Mask: 0, Projection: false, Bits: 0}, {Name: "Cars", Type: "FinalCar", Array: 2, Fixed: true, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Input":              {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Sequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Intent", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "Control", Type: "u8", Array: 0, Fixed: false, Max: 3, Mask: 0, Projection: false, Bits: 0}, {Name: "HeldMask", Type: "u8", Array: 0, Fixed: false, Max: 0, Mask: 7, Projection: false, Bits: 0}},
	"Disposition":        {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Authority", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Seat", Type: "u8", Array: 0, Fixed: false, Max: 1, Mask: 0, Projection: false, Bits: 0}, {Name: "Sequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Processed", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Disposition", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "Intent", Type: "u8", Array: 0, Fixed: false, Max: 2, Mask: 0, Projection: false, Bits: 0}, {Name: "Control", Type: "u8", Array: 0, Fixed: false, Max: 3, Mask: 0, Projection: false, Bits: 0}, {Name: "Car", Type: "Car", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Contact", Type: "Contact", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Event":              {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Authority", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "EventId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Kind", Type: "u8", Array: 0, Fixed: false, Max: 8, Mask: 0, Projection: false, Bits: 0}, {Name: "CauseInput", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ObjectId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "EpisodeId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "SeatMask", Type: "u8", Array: 0, Fixed: false, Max: 0, Mask: 3, Projection: false, Bits: 0}, {Name: "Cars", Type: "Car", Array: 2, Fixed: true, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Contact", Type: "Contact", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Objects", Type: "ObjectState", Array: 3, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Barrier":            {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Epoch", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"BaselineChunk":      {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TransferId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Epoch", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Total", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Offset", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Index", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Count", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Data", Type: "bytes", Array: 0, Fixed: false, Max: 1048576, Mask: 0, Projection: false, Bits: 0}},
	"Verification":       {{Name: "Epoch", Type: "u16", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Crc", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Projection":         {{Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ConfigurationId", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "GenerationVersion", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Seed", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Cars", Type: "Car", Array: 2, Fixed: true, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Contact", Type: "Contact", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Generator", Type: "Generator", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Windows", Type: "Window", Array: 2, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"Coverage":           {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Authority", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Tick", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "TimeUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Progress", Type: "Progress", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Generator", Type: "Generator", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Windows", Type: "Window", Array: 2, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
	"RoomReply":          {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Sequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Revision", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Accepted", Type: "u8", Array: 0, Fixed: false, Max: 1, Mask: 0, Projection: false, Bits: 0}, {Name: "Detail", Type: "string", Array: 0, Fixed: false, Max: 512, Mask: 0, Projection: false, Bits: 0}},
	"RoomPulse":          {{Name: "Identity", Type: "Identity", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Sequence", Type: "u32", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "Round", Type: "Round", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}, {Name: "ServerUs", Type: "us", Array: 0, Fixed: false, Max: 0, Mask: 0, Projection: false, Bits: 0}},
}

type Identity struct {
	RoomId         uint32 `json:"roomId"`
	SeatSession    uint32 `json:"seatSession"`
	PairGeneration uint32 `json:"pairGeneration"`
	Seat           uint8  `json:"seat"`
}

func EncodeIdentity(value Identity, limit int) ([]byte, error) {
	return encodeRecord("Identity", value, limit, false)
}
func DecodeIdentity(bytes []byte, limit int) (Identity, error) {
	var value Identity
	err := decodeRecord("Identity", bytes, &value, limit)
	return value, err
}

type Round struct {
	RoundId         uint32 `json:"roundId"`
	InputGeneration uint32 `json:"inputGeneration"`
}

func EncodeRound(value Round, limit int) ([]byte, error) {
	return encodeRecord("Round", value, limit, false)
}
func DecodeRound(bytes []byte, limit int) (Round, error) {
	var value Round
	err := decodeRecord("Round", bytes, &value, limit)
	return value, err
}

type Progress struct {
	Authority  uint32 `json:"authority"`
	Event      uint32 `json:"event"`
	Processed1 uint32 `json:"processed1"`
	Processed2 uint32 `json:"processed2"`
	Disposed1  uint32 `json:"disposed1"`
	Disposed2  uint32 `json:"disposed2"`
}

func EncodeProgress(value Progress, limit int) ([]byte, error) {
	return encodeRecord("Progress", value, limit, false)
}
func DecodeProgress(bytes []byte, limit int) (Progress, error) {
	var value Progress
	err := decodeRecord("Progress", bytes, &value, limit)
	return value, err
}

type Car struct {
	Progress        float64 `json:"progress"`
	Lateral         float64 `json:"lateral"`
	NormalSpeed     float64 `json:"normalSpeed"`
	Lane            uint8   `json:"lane"`
	Departure       uint8   `json:"departure"`
	Target          uint8   `json:"target"`
	Phase           uint8   `json:"phase"`
	Controls        uint8   `json:"controls"`
	Effective       uint8   `json:"effective"`
	Flags           uint8   `json:"flags"`
	MovementOrigin  float64 `json:"movementOrigin"`
	MovementTarget  float64 `json:"movementTarget"`
	MovementStartUs uint64  `json:"movementStartUs"`
	MovementEndUs   uint64  `json:"movementEndUs"`
	NextShiftUs     uint64  `json:"nextShiftUs"`
	FreshnessUs     uint64  `json:"freshnessUs"`
	ProtectionUs    uint64  `json:"protectionUs"`
	Hp              uint32  `json:"hp"`
	Score           uint32  `json:"score"`
	LastInput       uint32  `json:"lastInput"`
	HeldMask        uint8   `json:"heldMask"`
	InputGeneration uint32  `json:"inputGeneration"`
}

func EncodeCar(value Car, limit int) ([]byte, error) { return encodeRecord("Car", value, limit, false) }
func DecodeCar(bytes []byte, limit int) (Car, error) {
	var value Car
	err := decodeRecord("Car", bytes, &value, limit)
	return value, err
}

type Contact struct {
	Episode        uint32 `json:"episode"`
	Flags          uint8  `json:"flags"`
	BlockedSeat    uint8  `json:"blockedSeat"`
	LatestSeat     uint8  `json:"latestSeat"`
	LatestControl  uint8  `json:"latestControl"`
	LatestSequence uint32 `json:"latestSequence"`
	LatestTimeUs   uint64 `json:"latestTimeUs"`
	LatestOrder    uint32 `json:"latestOrder"`
}

func EncodeContact(value Contact, limit int) ([]byte, error) {
	return encodeRecord("Contact", value, limit, false)
}
func DecodeContact(bytes []byte, limit int) (Contact, error) {
	var value Contact
	err := decodeRecord("Contact", bytes, &value, limit)
	return value, err
}

type ObjectState struct {
	Id       uint32  `json:"id"`
	SliceId  uint32  `json:"sliceId"`
	Lane     uint8   `json:"lane"`
	Flags    uint8   `json:"flags"`
	Distance float64 `json:"distance"`
}

func EncodeObjectState(value ObjectState, limit int) ([]byte, error) {
	return encodeRecord("ObjectState", value, limit, false)
}
func DecodeObjectState(bytes []byte, limit int) (ObjectState, error) {
	var value ObjectState
	err := decodeRecord("ObjectState", bytes, &value, limit)
	return value, err
}

type Window struct {
	Start      float64       `json:"start"`
	End        float64       `json:"end"`
	FirstSlice uint32        `json:"firstSlice"`
	LastSlice  uint32        `json:"lastSlice"`
	Objects    []ObjectState `json:"objects"`
}

func EncodeWindow(value Window, limit int) ([]byte, error) {
	return encodeRecord("Window", value, limit, false)
}
func DecodeWindow(bytes []byte, limit int) (Window, error) {
	var value Window
	err := decodeRecord("Window", bytes, &value, limit)
	return value, err
}

type Generator struct {
	RandomState      uint32  `json:"randomState"`
	NextSlice        uint32  `json:"nextSlice"`
	NextObject       uint32  `json:"nextObject"`
	Cursor           float64 `json:"cursor"`
	NextSpawnUs      uint64  `json:"nextSpawnUs"`
	NextDifficultyUs uint64  `json:"nextDifficultyUs"`
	ReservedCursor   uint32  `json:"reservedCursor"`
}

func EncodeGenerator(value Generator, limit int) ([]byte, error) {
	return encodeRecord("Generator", value, limit, false)
}
func DecodeGenerator(bytes []byte, limit int) (Generator, error) {
	var value Generator
	err := decodeRecord("Generator", bytes, &value, limit)
	return value, err
}

type Gameplay struct {
	AccelSpeedMultiplier       float64 `json:"accelSpeedMultiplier"`
	CarHeight                  float64 `json:"carHeight"`
	CarWidth                   float64 `json:"carWidth"`
	CoinSize                   float64 `json:"coinSize"`
	CoinWeight                 float64 `json:"coinWeight"`
	CountdownDuration          float64 `json:"countdownDuration"`
	DifficultyRampInterval     float64 `json:"difficultyRampInterval"`
	EmptyWeight                float64 `json:"emptyWeight"`
	FinishDistance             float64 `json:"finishDistance"`
	HeartExclusionDistance     float64 `json:"heartExclusionDistance"`
	HeartSize                  float64 `json:"heartSize"`
	HeartWeight                float64 `json:"heartWeight"`
	InitialClearDistance       float64 `json:"initialClearDistance"`
	InitialSpawnInterval       float64 `json:"initialSpawnInterval"`
	InvincibleDuration         float64 `json:"invincibleDuration"`
	LaneLerpSpeed              float64 `json:"laneLerpSpeed"`
	LaneReturnDuration         float64 `json:"laneReturnDuration"`
	LaneShiftDuration          float64 `json:"laneShiftDuration"`
	LaneSpacing                float64 `json:"laneSpacing"`
	LaneSwitchCooldownDuration float64 `json:"laneSwitchCooldownDuration"`
	MaxHealth                  float64 `json:"maxHealth"`
	MaxRoadSpeed               float64 `json:"maxRoadSpeed"`
	MinSpawnInterval           float64 `json:"minSpawnInterval"`
	ObstacleDamage             float64 `json:"obstacleDamage"`
	ObstacleH                  float64 `json:"obstacleH"`
	ObstacleW                  float64 `json:"obstacleW"`
	ObstacleWeight             float64 `json:"obstacleWeight"`
	PlayerContactDamage        float64 `json:"playerContactDamage"`
	ReservedHearts             float64 `json:"reservedHearts"`
	RoadSpeedIncrement         float64 `json:"roadSpeedIncrement"`
	SliceSpacing               float64 `json:"sliceSpacing"`
	SpawnIntervalDecrement     float64 `json:"spawnIntervalDecrement"`
	SpeedGrowth                float64 `json:"speedGrowth"`
	StartingRoadSpeed          float64 `json:"startingRoadSpeed"`
	TickRate                   float64 `json:"tickRate"`
	TimeLimit                  float64 `json:"timeLimit"`
}

func EncodeGameplay(value Gameplay, limit int) ([]byte, error) {
	return encodeRecord("Gameplay", value, limit, false)
}
func DecodeGameplay(bytes []byte, limit int) (Gameplay, error) {
	var value Gameplay
	err := decodeRecord("Gameplay", bytes, &value, limit)
	return value, err
}

type Presentation struct {
	AccelCarOffset          float64 `json:"accelCarOffset"`
	AccelLerpSpeed          float64 `json:"accelLerpSpeed"`
	BlinkCount              float64 `json:"blinkCount"`
	CarBottomMargin         float64 `json:"carBottomMargin"`
	CarTiltLerpSpeed        float64 `json:"carTiltLerpSpeed"`
	CarTiltMaxAngle         float64 `json:"carTiltMaxAngle"`
	CorrectionSmoothing     float64 `json:"correctionSmoothing"`
	GameOverFadeMaxOpacity  float64 `json:"gameOverFadeMaxOpacity"`
	GameOverFadeSpeed       float64 `json:"gameOverFadeSpeed"`
	GameOverShakeDuration   float64 `json:"gameOverShakeDuration"`
	GameOverShakeMultiplier float64 `json:"gameOverShakeMultiplier"`
	NarrowScreenWidth       float64 `json:"narrowScreenWidth"`
	RoadWidthRatioNarrow    float64 `json:"roadWidthRatioNarrow"`
	RoadWidthRatioNormal    float64 `json:"roadWidthRatioNormal"`
	ShakeDuration           float64 `json:"shakeDuration"`
	ShakeIntensity          float64 `json:"shakeIntensity"`
}

func EncodePresentation(value Presentation, limit int) ([]byte, error) {
	return encodeRecord("Presentation", value, limit, false)
}
func DecodePresentation(bytes []byte, limit int) (Presentation, error) {
	var value Presentation
	err := decodeRecord("Presentation", bytes, &value, limit)
	return value, err
}

type Room struct {
	IdleExpiry     float64 `json:"idleExpiry"`
	IdleWarning    float64 `json:"idleWarning"`
	ReconnectGrace float64 `json:"reconnectGrace"`
}

func EncodeRoom(value Room, limit int) ([]byte, error) {
	return encodeRecord("Room", value, limit, false)
}
func DecodeRoom(bytes []byte, limit int) (Room, error) {
	var value Room
	err := decodeRecord("Room", bytes, &value, limit)
	return value, err
}

type Connection struct {
	AdmissionTicketLifetime   float64 `json:"admissionTicketLifetime"`
	BaselineBytes             float64 `json:"baselineBytes"`
	ClockRequestRate          float64 `json:"clockRequestRate"`
	ClockSamples              float64 `json:"clockSamples"`
	ClockSyncInterval         float64 `json:"clockSyncInterval"`
	ControlFreshnessExpiry    float64 `json:"controlFreshnessExpiry"`
	ControlRefreshInterval    float64 `json:"controlRefreshInterval"`
	EssentialProgressDeadline float64 `json:"essentialProgressDeadline"`
	EssentialQueueWait        float64 `json:"essentialQueueWait"`
	InputBurst                float64 `json:"inputBurst"`
	InputRate                 float64 `json:"inputRate"`
	NetworkBudgetWindow       float64 `json:"networkBudgetWindow"`
	NetworkBytesPerSecond     float64 `json:"networkBytesPerSecond"`
	QueueBytes                float64 `json:"queueBytes"`
	QueueMessages             float64 `json:"queueMessages"`
	RecoveryRequestRate       float64 `json:"recoveryRequestRate"`
	ReliableFrameBytes        float64 `json:"reliableFrameBytes"`
	ReplayHistory             float64 `json:"replayHistory"`
	VerificationInterval      float64 `json:"verificationInterval"`
}

func EncodeConnection(value Connection, limit int) ([]byte, error) {
	return encodeRecord("Connection", value, limit, false)
}
func DecodeConnection(bytes []byte, limit int) (Connection, error) {
	var value Connection
	err := decodeRecord("Connection", bytes, &value, limit)
	return value, err
}

type Operational struct {
	SimulationLagThreshold float64 `json:"simulationLagThreshold"`
}

func EncodeOperational(value Operational, limit int) ([]byte, error) {
	return encodeRecord("Operational", value, limit, false)
}
func DecodeOperational(bytes []byte, limit int) (Operational, error) {
	var value Operational
	err := decodeRecord("Operational", bytes, &value, limit)
	return value, err
}

type Context struct {
	ConfigurationVersion uint32       `json:"configurationVersion"`
	ConfigurationId      uint32       `json:"configurationId"`
	GenerationVersion    uint32       `json:"generationVersion"`
	Seed                 uint32       `json:"seed"`
	Mode                 uint8        `json:"mode"`
	StartUs              uint64       `json:"startUs"`
	Gameplay             Gameplay     `json:"gameplay"`
	Presentation         Presentation `json:"presentation"`
	Room                 Room         `json:"room"`
	Connection           Connection   `json:"connection"`
	Operational          Operational  `json:"operational"`
}

func EncodeContext(value Context, limit int) ([]byte, error) {
	return encodeRecord("Context", value, limit, false)
}
func DecodeContext(bytes []byte, limit int) (Context, error) {
	var value Context
	err := decodeRecord("Context", bytes, &value, limit)
	return value, err
}

type Baseline struct {
	Identity  Identity  `json:"identity"`
	Round     Round     `json:"round"`
	Epoch     uint16    `json:"epoch"`
	Tick      uint32    `json:"tick"`
	TimeUs    uint64    `json:"timeUs"`
	Progress  Progress  `json:"progress"`
	Context   Context   `json:"context"`
	Cars      [2]Car    `json:"cars"`
	Contact   Contact   `json:"contact"`
	Generator Generator `json:"generator"`
	Windows   []Window  `json:"windows"`
}

func EncodeBaseline(value Baseline, limit int) ([]byte, error) {
	return encodeRecord("Baseline", value, limit, false)
}
func DecodeBaseline(bytes []byte, limit int) (Baseline, error) {
	var value Baseline
	err := decodeRecord("Baseline", bytes, &value, limit)
	return value, err
}

type FinalCar struct {
	Progress float64 `json:"progress"`
	Lateral  float64 `json:"lateral"`
	Hp       uint32  `json:"hp"`
	Score    uint32  `json:"score"`
}

func EncodeFinalCar(value FinalCar, limit int) ([]byte, error) {
	return encodeRecord("FinalCar", value, limit, false)
}
func DecodeFinalCar(bytes []byte, limit int) (FinalCar, error) {
	var value FinalCar
	err := decodeRecord("FinalCar", bytes, &value, limit)
	return value, err
}

type Seat struct {
	Session       uint32 `json:"session"`
	Name          string `json:"name"`
	Flags         uint8  `json:"flags"`
	ReservationUs uint64 `json:"reservationUs"`
}

func EncodeSeat(value Seat, limit int) ([]byte, error) {
	return encodeRecord("Seat", value, limit, false)
}
func DecodeSeat(bytes []byte, limit int) (Seat, error) {
	var value Seat
	err := decodeRecord("Seat", bytes, &value, limit)
	return value, err
}

type AdmissionRequest struct {
	Operation  uint8  `json:"operation"`
	Version    uint16 `json:"version"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	Credential []byte `json:"credential"`
}

func EncodeAdmissionRequest(value AdmissionRequest, limit int) ([]byte, error) {
	return encodeRecord("AdmissionRequest", value, limit, false)
}
func DecodeAdmissionRequest(bytes []byte, limit int) (AdmissionRequest, error) {
	var value AdmissionRequest
	err := decodeRecord("AdmissionRequest", bytes, &value, limit)
	return value, err
}

type Admission struct {
	Version        uint16   `json:"version"`
	Identity       Identity `json:"identity"`
	Credential     []byte   `json:"credential"`
	RoomTicket     []byte   `json:"roomTicket"`
	GameplayTicket []byte   `json:"gameplayTicket"`
	ExpiresUs      uint64   `json:"expiresUs"`
	Origin         string   `json:"origin"`
}

func EncodeAdmission(value Admission, limit int) ([]byte, error) {
	return encodeRecord("Admission", value, limit, false)
}
func DecodeAdmission(bytes []byte, limit int) (Admission, error) {
	var value Admission
	err := decodeRecord("Admission", bytes, &value, limit)
	return value, err
}

type ProtocolError struct {
	Code            uint8  `json:"code"`
	ExpectedVersion uint16 `json:"expectedVersion"`
	Detail          string `json:"detail"`
}

func EncodeProtocolError(value ProtocolError, limit int) ([]byte, error) {
	return encodeRecord("ProtocolError", value, limit, false)
}
func DecodeProtocolError(bytes []byte, limit int) (ProtocolError, error) {
	var value ProtocolError
	err := decodeRecord("ProtocolError", bytes, &value, limit)
	return value, err
}

type RoomInitialization struct {
	Version  uint16   `json:"version"`
	Identity Identity `json:"identity"`
	Revision uint32   `json:"revision"`
}

func EncodeRoomInitialization(value RoomInitialization, limit int) ([]byte, error) {
	return encodeRecord("RoomInitialization", value, limit, false)
}
func DecodeRoomInitialization(bytes []byte, limit int) (RoomInitialization, error) {
	var value RoomInitialization
	err := decodeRecord("RoomInitialization", bytes, &value, limit)
	return value, err
}

type RoomState struct {
	Identity      Identity `json:"identity"`
	Revision      uint32   `json:"revision"`
	Mode          uint8    `json:"mode"`
	Phase         uint8    `json:"phase"`
	Host          uint8    `json:"host"`
	Seats         [2]Seat  `json:"seats"`
	RoundId       uint32   `json:"roundId"`
	StartUs       uint64   `json:"startUs"`
	IdleWarningUs uint64   `json:"idleWarningUs"`
	IdleExpiryUs  uint64   `json:"idleExpiryUs"`
}

func EncodeRoomState(value RoomState, limit int) ([]byte, error) {
	return encodeRecord("RoomState", value, limit, false)
}
func DecodeRoomState(bytes []byte, limit int) (RoomState, error) {
	var value RoomState
	err := decodeRecord("RoomState", bytes, &value, limit)
	return value, err
}

type RoomCommand struct {
	Identity Identity `json:"identity"`
	Sequence uint32   `json:"sequence"`
	Revision uint32   `json:"revision"`
	Command  uint8    `json:"command"`
	Mode     uint8    `json:"mode"`
	Ready    uint8    `json:"ready"`
}

func EncodeRoomCommand(value RoomCommand, limit int) ([]byte, error) {
	return encodeRecord("RoomCommand", value, limit, false)
}
func DecodeRoomCommand(bytes []byte, limit int) (RoomCommand, error) {
	var value RoomCommand
	err := decodeRecord("RoomCommand", bytes, &value, limit)
	return value, err
}

type Handshake struct {
	Version       uint16   `json:"version"`
	Identity      Identity `json:"identity"`
	DatagramBytes uint16   `json:"datagramBytes"`
}

func EncodeHandshake(value Handshake, limit int) ([]byte, error) {
	return encodeRecord("Handshake", value, limit, false)
}
func DecodeHandshake(bytes []byte, limit int) (Handshake, error) {
	var value Handshake
	err := decodeRecord("Handshake", bytes, &value, limit)
	return value, err
}

type Initialization struct {
	Identity Identity `json:"identity"`
	Round    Round    `json:"round"`
	Context  Context  `json:"context"`
}

func EncodeInitialization(value Initialization, limit int) ([]byte, error) {
	return encodeRecord("Initialization", value, limit, false)
}
func DecodeInitialization(bytes []byte, limit int) (Initialization, error) {
	var value Initialization
	err := decodeRecord("Initialization", bytes, &value, limit)
	return value, err
}

type Ready struct {
	Identity   Identity `json:"identity"`
	Round      Round    `json:"round"`
	TransferId uint32   `json:"transferId"`
	Epoch      uint16   `json:"epoch"`
	Progress   Progress `json:"progress"`
}

func EncodeReady(value Ready, limit int) ([]byte, error) {
	return encodeRecord("Ready", value, limit, false)
}
func DecodeReady(bytes []byte, limit int) (Ready, error) {
	var value Ready
	err := decodeRecord("Ready", bytes, &value, limit)
	return value, err
}

type ClockRequest struct {
	Sequence     uint32 `json:"sequence"`
	ClientSendUs uint64 `json:"clientSendUs"`
}

func EncodeClockRequest(value ClockRequest, limit int) ([]byte, error) {
	return encodeRecord("ClockRequest", value, limit, false)
}
func DecodeClockRequest(bytes []byte, limit int) (ClockRequest, error) {
	var value ClockRequest
	err := decodeRecord("ClockRequest", bytes, &value, limit)
	return value, err
}

type ClockReply struct {
	Sequence        uint32 `json:"sequence"`
	ClientSendUs    uint64 `json:"clientSendUs"`
	ServerReceiveUs uint64 `json:"serverReceiveUs"`
	ServerSendUs    uint64 `json:"serverSendUs"`
}

func EncodeClockReply(value ClockReply, limit int) ([]byte, error) {
	return encodeRecord("ClockReply", value, limit, false)
}
func DecodeClockReply(bytes []byte, limit int) (ClockReply, error) {
	var value ClockReply
	err := decodeRecord("ClockReply", bytes, &value, limit)
	return value, err
}

type Recovery struct {
	Identity Identity `json:"identity"`
	Round    Round    `json:"round"`
	Reason   uint8    `json:"reason"`
	Epoch    uint16   `json:"epoch"`
	Tick     uint32   `json:"tick"`
	Progress Progress `json:"progress"`
}

func EncodeRecovery(value Recovery, limit int) ([]byte, error) {
	return encodeRecord("Recovery", value, limit, false)
}
func DecodeRecovery(bytes []byte, limit int) (Recovery, error) {
	var value Recovery
	err := decodeRecord("Recovery", bytes, &value, limit)
	return value, err
}

type AuthorityAck struct {
	Identity Identity `json:"identity"`
	Round    Round    `json:"round"`
	Epoch    uint16   `json:"epoch"`
	Tick     uint32   `json:"tick"`
	Progress Progress `json:"progress"`
}

func EncodeAuthorityAck(value AuthorityAck, limit int) ([]byte, error) {
	return encodeRecord("AuthorityAck", value, limit, false)
}
func DecodeAuthorityAck(bytes []byte, limit int) (AuthorityAck, error) {
	var value AuthorityAck
	err := decodeRecord("AuthorityAck", bytes, &value, limit)
	return value, err
}

type Outcome struct {
	Identity  Identity    `json:"identity"`
	RoundId   uint32      `json:"roundId"`
	OutcomeId uint32      `json:"outcomeId"`
	Tick      uint32      `json:"tick"`
	TimeUs    uint64      `json:"timeUs"`
	Result    uint8       `json:"result"`
	Reason    uint8       `json:"reason"`
	Cars      [2]FinalCar `json:"cars"`
	Progress  Progress    `json:"progress"`
}

func EncodeOutcome(value Outcome, limit int) ([]byte, error) {
	return encodeRecord("Outcome", value, limit, false)
}
func DecodeOutcome(bytes []byte, limit int) (Outcome, error) {
	var value Outcome
	err := decodeRecord("Outcome", bytes, &value, limit)
	return value, err
}

type Input struct {
	Identity Identity `json:"identity"`
	Round    Round    `json:"round"`
	Sequence uint32   `json:"sequence"`
	Intent   uint8    `json:"intent"`
	Control  uint8    `json:"control"`
	HeldMask uint8    `json:"heldMask"`
}

func EncodeInput(value Input, limit int) ([]byte, error) {
	return encodeRecord("Input", value, limit, false)
}
func DecodeInput(bytes []byte, limit int) (Input, error) {
	var value Input
	err := decodeRecord("Input", bytes, &value, limit)
	return value, err
}

type Disposition struct {
	Identity    Identity `json:"identity"`
	Round       Round    `json:"round"`
	Authority   uint32   `json:"authority"`
	Tick        uint32   `json:"tick"`
	TimeUs      uint64   `json:"timeUs"`
	Seat        uint8    `json:"seat"`
	Sequence    uint32   `json:"sequence"`
	Processed   uint32   `json:"processed"`
	Disposition uint8    `json:"disposition"`
	Intent      uint8    `json:"intent"`
	Control     uint8    `json:"control"`
	Car         Car      `json:"car"`
	Contact     Contact  `json:"contact"`
}

func EncodeDisposition(value Disposition, limit int) ([]byte, error) {
	return encodeRecord("Disposition", value, limit, false)
}
func DecodeDisposition(bytes []byte, limit int) (Disposition, error) {
	var value Disposition
	err := decodeRecord("Disposition", bytes, &value, limit)
	return value, err
}

type Event struct {
	Identity   Identity      `json:"identity"`
	Round      Round         `json:"round"`
	Authority  uint32        `json:"authority"`
	EventId    uint32        `json:"eventId"`
	Tick       uint32        `json:"tick"`
	TimeUs     uint64        `json:"timeUs"`
	Kind       uint8         `json:"kind"`
	CauseInput uint32        `json:"causeInput"`
	ObjectId   uint32        `json:"objectId"`
	EpisodeId  uint32        `json:"episodeId"`
	SeatMask   uint8         `json:"seatMask"`
	Cars       [2]Car        `json:"cars"`
	Contact    Contact       `json:"contact"`
	Objects    []ObjectState `json:"objects"`
}

func EncodeEvent(value Event, limit int) ([]byte, error) {
	return encodeRecord("Event", value, limit, false)
}
func DecodeEvent(bytes []byte, limit int) (Event, error) {
	var value Event
	err := decodeRecord("Event", bytes, &value, limit)
	return value, err
}

type Barrier struct {
	Identity Identity `json:"identity"`
	Round    Round    `json:"round"`
	Epoch    uint16   `json:"epoch"`
	Tick     uint32   `json:"tick"`
	TimeUs   uint64   `json:"timeUs"`
	Progress Progress `json:"progress"`
}

func EncodeBarrier(value Barrier, limit int) ([]byte, error) {
	return encodeRecord("Barrier", value, limit, false)
}
func DecodeBarrier(bytes []byte, limit int) (Barrier, error) {
	var value Barrier
	err := decodeRecord("Barrier", bytes, &value, limit)
	return value, err
}

type BaselineChunk struct {
	Identity   Identity `json:"identity"`
	Round      Round    `json:"round"`
	TransferId uint32   `json:"transferId"`
	Epoch      uint16   `json:"epoch"`
	Tick       uint32   `json:"tick"`
	Progress   Progress `json:"progress"`
	Total      uint32   `json:"total"`
	Offset     uint32   `json:"offset"`
	Index      uint32   `json:"index"`
	Count      uint32   `json:"count"`
	Data       []byte   `json:"data"`
}

func EncodeBaselineChunk(value BaselineChunk, limit int) ([]byte, error) {
	return encodeRecord("BaselineChunk", value, limit, false)
}
func DecodeBaselineChunk(bytes []byte, limit int) (BaselineChunk, error) {
	var value BaselineChunk
	err := decodeRecord("BaselineChunk", bytes, &value, limit)
	return value, err
}

type Verification struct {
	Epoch uint16 `json:"epoch"`
	Tick  uint32 `json:"tick"`
	Crc   uint32 `json:"crc"`
}

func EncodeVerification(value Verification, limit int) ([]byte, error) {
	return encodeRecord("Verification", value, limit, false)
}
func DecodeVerification(bytes []byte, limit int) (Verification, error) {
	var value Verification
	err := decodeRecord("Verification", bytes, &value, limit)
	return value, err
}

type Projection struct {
	Round             Round     `json:"round"`
	ConfigurationId   uint32    `json:"configurationId"`
	GenerationVersion uint32    `json:"generationVersion"`
	Seed              uint32    `json:"seed"`
	Tick              uint32    `json:"tick"`
	TimeUs            uint64    `json:"timeUs"`
	Progress          Progress  `json:"progress"`
	Cars              [2]Car    `json:"cars"`
	Contact           Contact   `json:"contact"`
	Generator         Generator `json:"generator"`
	Windows           []Window  `json:"windows"`
}

func EncodeProjection(value Projection, limit int) ([]byte, error) {
	return encodeRecord("Projection", value, limit, false)
}
func DecodeProjection(bytes []byte, limit int) (Projection, error) {
	var value Projection
	err := decodeRecord("Projection", bytes, &value, limit)
	return value, err
}

type Coverage struct {
	Identity  Identity  `json:"identity"`
	Round     Round     `json:"round"`
	Authority uint32    `json:"authority"`
	Tick      uint32    `json:"tick"`
	TimeUs    uint64    `json:"timeUs"`
	Progress  Progress  `json:"progress"`
	Generator Generator `json:"generator"`
	Windows   []Window  `json:"windows"`
}

func EncodeCoverage(value Coverage, limit int) ([]byte, error) {
	return encodeRecord("Coverage", value, limit, false)
}
func DecodeCoverage(bytes []byte, limit int) (Coverage, error) {
	var value Coverage
	err := decodeRecord("Coverage", bytes, &value, limit)
	return value, err
}

type RoomReply struct {
	Identity Identity `json:"identity"`
	Sequence uint32   `json:"sequence"`
	Revision uint32   `json:"revision"`
	Accepted uint8    `json:"accepted"`
	Detail   string   `json:"detail"`
}

func EncodeRoomReply(value RoomReply, limit int) ([]byte, error) {
	return encodeRecord("RoomReply", value, limit, false)
}
func DecodeRoomReply(bytes []byte, limit int) (RoomReply, error) {
	var value RoomReply
	err := decodeRecord("RoomReply", bytes, &value, limit)
	return value, err
}

type RoomPulse struct {
	Identity Identity `json:"identity"`
	Sequence uint32   `json:"sequence"`
	Round    Round    `json:"round"`
	ServerUs uint64   `json:"serverUs"`
}

func EncodeRoomPulse(value RoomPulse, limit int) ([]byte, error) {
	return encodeRecord("RoomPulse", value, limit, false)
}
func DecodeRoomPulse(bytes []byte, limit int) (RoomPulse, error) {
	var value RoomPulse
	err := decodeRecord("RoomPulse", bytes, &value, limit)
	return value, err
}
func ProjectBaseline(value Baseline) ([]byte, error) {
	return encodeRecord("Projection", Projection{Round: value.Round, ConfigurationId: value.Context.ConfigurationId, GenerationVersion: value.Context.GenerationVersion, Seed: value.Context.Seed, Tick: value.Tick, TimeUs: value.TimeUs, Progress: value.Progress, Cars: value.Cars, Contact: value.Contact, Generator: value.Generator, Windows: value.Windows}, 1048576, true)
}
func EncodeMessage(value any, limit int) ([]byte, error) {
	switch v := value.(type) {
	case AdmissionRequest:
		return encodeFrame("AdmissionRequest", 1, v, limit)
	case Admission:
		return encodeFrame("Admission", 2, v, limit)
	case ProtocolError:
		return encodeFrame("ProtocolError", 3, v, limit)
	case RoomInitialization:
		return encodeFrame("RoomInitialization", 4, v, limit)
	case RoomState:
		return encodeFrame("RoomState", 5, v, limit)
	case RoomCommand:
		return encodeFrame("RoomCommand", 6, v, limit)
	case Handshake:
		return encodeFrame("Handshake", 7, v, limit)
	case Initialization:
		return encodeFrame("Initialization", 8, v, limit)
	case Ready:
		return encodeFrame("Ready", 9, v, limit)
	case ClockRequest:
		return encodeFrame("ClockRequest", 10, v, limit)
	case ClockReply:
		return encodeFrame("ClockReply", 11, v, limit)
	case Recovery:
		return encodeFrame("Recovery", 12, v, limit)
	case AuthorityAck:
		return encodeFrame("AuthorityAck", 13, v, limit)
	case Outcome:
		return encodeFrame("Outcome", 14, v, limit)
	case Input:
		return encodeFrame("Input", 15, v, limit)
	case Disposition:
		return encodeFrame("Disposition", 16, v, limit)
	case Event:
		return encodeFrame("Event", 17, v, limit)
	case Barrier:
		return encodeFrame("Barrier", 18, v, limit)
	case BaselineChunk:
		return encodeFrame("BaselineChunk", 19, v, limit)
	case Coverage:
		return encodeFrame("Coverage", 20, v, limit)
	case RoomReply:
		return encodeFrame("RoomReply", 21, v, limit)
	case RoomPulse:
		return encodeFrame("RoomPulse", 22, v, limit)
	default:
		return nil, invalid("unknown message type")
	}
}
func DecodeMessage(bytes []byte, limit int) (any, error) {
	body, err := frameBody(bytes, limit)
	if err != nil {
		return nil, err
	}
	switch body[0] {
	case 1:
		return DecodeAdmissionRequest(body[1:], limit)
	case 2:
		return DecodeAdmission(body[1:], limit)
	case 3:
		return DecodeProtocolError(body[1:], limit)
	case 4:
		return DecodeRoomInitialization(body[1:], limit)
	case 5:
		return DecodeRoomState(body[1:], limit)
	case 6:
		return DecodeRoomCommand(body[1:], limit)
	case 7:
		return DecodeHandshake(body[1:], limit)
	case 8:
		return DecodeInitialization(body[1:], limit)
	case 9:
		return DecodeReady(body[1:], limit)
	case 10:
		return DecodeClockRequest(body[1:], limit)
	case 11:
		return DecodeClockReply(body[1:], limit)
	case 12:
		return DecodeRecovery(body[1:], limit)
	case 13:
		return DecodeAuthorityAck(body[1:], limit)
	case 14:
		return DecodeOutcome(body[1:], limit)
	case 15:
		return DecodeInput(body[1:], limit)
	case 16:
		return DecodeDisposition(body[1:], limit)
	case 17:
		return DecodeEvent(body[1:], limit)
	case 18:
		return DecodeBarrier(body[1:], limit)
	case 19:
		return DecodeBaselineChunk(body[1:], limit)
	case 20:
		return DecodeCoverage(body[1:], limit)
	case 21:
		return DecodeRoomReply(body[1:], limit)
	case 22:
		return DecodeRoomPulse(body[1:], limit)
	default:
		return nil, invalid("unknown message type")
	}
}
