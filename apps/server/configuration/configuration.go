// Package configuration captures the canonical contract without retaining caller-owned settings.
package configuration

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/shivang991/DashDevil2D/apps/server/protocol"
)

const maxExact = 9007199254740991.0

// Configuration owns private numeric groups. Context returns a value copy.
type Configuration struct {
	mode    string
	version uint32
	groups  map[string]map[string]float64
}

func (c Configuration) Value(group, key string) float64 { return c.groups[group][key] }
func (c Configuration) Context(seed uint32) protocol.Context {
	data, _ := json.Marshal(c.groups)
	var result protocol.Context
	_ = json.Unmarshal(data, &result)
	result.ConfigurationVersion = c.version
	result.ConfigurationId = 1
	result.GenerationVersion = 1
	result.Seed = seed
	if c.mode == "drag-race" {
		result.Mode = 1
	}
	if c.mode == "road-rage" {
		result.Mode = 2
	}
	return result
}
func contains(list, key string) bool { return strings.Contains(" "+list+" ", " "+key+" ") }

const integers = "maxHealth obstacleDamage playerContactDamage reservedHearts tickRate blinkCount clockSamples reliableFrameBytes baselineBytes queueBytes queueMessages inputBurst networkBytesPerSecond"
const nonnegative = "obstacleDamage playerContactDamage reservedHearts invincibleDuration roadSpeedIncrement spawnIntervalDecrement speedGrowth initialClearDistance heartExclusionDistance emptyWeight obstacleWeight coinWeight heartWeight carBottomMargin accelCarOffset blinkCount shakeDuration shakeIntensity carTiltMaxAngle gameOverFadeMaxOpacity gameOverShakeMultiplier gameOverShakeDuration gameOverFadeSpeed correctionSmoothing"
const durations = "invincibleDuration initialSpawnInterval minSpawnInterval difficultyRampInterval laneSwitchCooldownDuration laneShiftDuration laneReturnDuration countdownDuration timeLimit reconnectGrace idleExpiry idleWarning verificationInterval controlRefreshInterval controlFreshnessExpiry replayHistory clockSyncInterval essentialQueueWait essentialProgressDeadline admissionTicketLifetime networkBudgetWindow simulationLagThreshold correctionSmoothing"

func finite(v float64) bool              { return !math.IsNaN(v) && !math.IsInf(v, 0) }
func exact(v float64) bool               { return finite(v) && math.Trunc(v) == v && math.Abs(v) <= maxExact }
func failure(field, reason string) error { return fmt.Errorf("%s: %s", field, reason) }

// Capture accepts the canonical definition and optional JSON overrides. Runtime adapters
// load the definition once; no filesystem, browser or transport dependency enters validation.
func Capture(definition []byte, mode string, overrides []byte) (Configuration, error) {
	var source struct {
		Version                                     uint32
		Gameplay                                    map[string]map[string]float64
		Presentation, Room, Connection, Operational map[string]float64
	}
	if e := json.Unmarshal(definition, &source); e != nil {
		return Configuration{}, failure("definition", e.Error())
	}
	base, ok := source.Gameplay[mode]
	if !ok {
		return Configuration{}, failure("mode", "unsupported gameplay mode")
	}
	var changes map[string]json.RawMessage
	if len(overrides) > 0 {
		if strings.TrimSpace(string(overrides)) == "null" {
			return Configuration{}, failure("configuration", "expected settings groups")
		}
		if e := json.Unmarshal(overrides, &changes); e != nil {
			return Configuration{}, failure("configuration", "expected settings groups")
		}
	}
	groups := map[string]map[string]float64{"gameplay": base, "presentation": source.Presentation, "room": source.Room, "connection": source.Connection, "operational": source.Operational}
	for name, raw := range changes {
		baseline, exists := groups[name]
		if !exists {
			return Configuration{}, failure(name, "unknown configuration group")
		}
		var fields map[string]json.RawMessage
		if strings.TrimSpace(string(raw)) == "null" {
			return Configuration{}, failure(name, "expected a settings object")
		}
		if e := json.Unmarshal(raw, &fields); e != nil {
			return Configuration{}, failure(name, "expected a settings object")
		}
		for key, value := range fields {
			if _, exists := baseline[key]; !exists {
				return Configuration{}, failure(name+"."+key, "unknown or fixed setting")
			}
			var number float64
			if strings.TrimSpace(string(value)) == "null" {
				return Configuration{}, failure(name+"."+key, "must be a finite number")
			}
			if e := json.Unmarshal(value, &number); e != nil {
				return Configuration{}, failure(name+"."+key, "must be a finite number")
			}
			baseline[key] = number
		}
	}
	for name, fields := range groups {
		for key, v := range fields {
			field := name + "." + key
			if !finite(v) {
				return Configuration{}, failure(field, "must be a finite number")
			}
			if v < 0 || v == 0 && !contains(nonnegative, key) {
				return Configuration{}, failure(field, "invalid positive/nonnegative boundary")
			}
			if contains(integers, key) && !exact(v) {
				return Configuration{}, failure(field, "must be an exact integer")
			}
			if contains(durations, key) && (!finite(v*1e6) || v*1e6 > maxExact || v > 0 && v*1e6 < 1) {
				return Configuration{}, failure(field, "must fit exact microsecond timestamps")
			}
		}
	}
	g, p, r, c := groups["gameplay"], groups["presentation"], groups["room"], groups["connection"]
	checks := []struct {
		ok            bool
		field, reason string
	}{
		{g["maxRoadSpeed"] >= g["startingRoadSpeed"], "gameplay.maxRoadSpeed", "must be at least startingRoadSpeed"},
		{g["accelSpeedMultiplier"] >= 1, "gameplay.accelSpeedMultiplier", "must be at least one"},
		{finite(g["maxRoadSpeed"] * g["accelSpeedMultiplier"]), "gameplay.maxRoadSpeed", "boosted speed must remain finite"},
		{g["laneSpacing"] > math.Max(math.Max(g["carWidth"], g["obstacleW"]), math.Max(g["coinSize"], g["heartSize"])), "gameplay.laneSpacing", "must exceed every car/object width"},
		{finite(g["emptyWeight"]+g["obstacleWeight"]+g["coinWeight"]+g["heartWeight"]) && g["emptyWeight"]+g["obstacleWeight"]+g["coinWeight"]+g["heartWeight"] > 0, "gameplay.weights", "must have a finite positive total"},
		{p["roadWidthRatioNormal"] <= 1, "presentation.roadWidthRatioNormal", "must be at most one"},
		{p["roadWidthRatioNarrow"] <= 1, "presentation.roadWidthRatioNarrow", "must be at most one"},
		{p["gameOverFadeMaxOpacity"] <= 1, "presentation.gameOverFadeMaxOpacity", "must be at most one"},
		{p["correctionSmoothing"] <= .25, "presentation.correctionSmoothing", "must be at most 250 ms"},
		{p["gameOverFadeMaxOpacity"] == 0 || p["gameOverFadeSpeed"] > 0, "presentation.gameOverFadeSpeed", "positive opacity requires positive fade rate"},
		{r["idleWarning"] < r["idleExpiry"], "room.idleWarning", "must precede idle expiry"},
		{c["verificationInterval"] <= .25, "connection.verificationInterval", "must be at most 250 ms"},
		{c["controlRefreshInterval"] <= c["controlFreshnessExpiry"]/3, "connection.controlRefreshInterval", "must be at most one third of freshness expiry"},
		{c["replayHistory"] >= 1+c["verificationInterval"], "connection.replayHistory", "must cover prediction horizon plus verification interval"},
		{c["reliableFrameBytes"] <= c["queueBytes"], "connection.reliableFrameBytes", "frames including framing must fit queue"},
		{c["reliableFrameBytes"] > 4 && c["reliableFrameBytes"]-4 <= math.MaxUint32, "connection.reliableFrameBytes", "must fit framing and uint32 body length"},
		{c["essentialQueueWait"] <= c["essentialProgressDeadline"], "connection.essentialQueueWait", "cannot exceed essential progress deadline"},
		{c["inputRate"] >= 1/c["controlRefreshInterval"], "connection.inputRate", "must accommodate held-control refreshes"},
		{c["clockRequestRate"] >= 1/c["clockSyncInterval"], "connection.clockRequestRate", "must accommodate clock synchronization"},
	}
	if mode == "long-drive" {
		checks = append(checks, struct {
			ok            bool
			field, reason string
		}{g["minSpawnInterval"] <= g["initialSpawnInterval"], "gameplay.minSpawnInterval", "cannot exceed initialSpawnInterval"}, struct {
			ok            bool
			field, reason string
		}{finite(g["maxRoadSpeed"] + g["roadSpeedIncrement"]), "gameplay.roadSpeedIncrement", "derived speed must remain finite"})
	} else {
		checks = append(checks, struct {
			ok            bool
			field, reason string
		}{g["tickRate"] <= math.MaxUint32, "gameplay.tickRate", "must fit uint32"})
		if mode == "drag-race" {
			checks = append(checks, struct {
				ok            bool
				field, reason string
			}{g["invincibleDuration"] == 0, "gameplay.invincibleDuration", "Drag Race never grants damage invincibility"}, struct {
				ok            bool
				field, reason string
			}{g["finishDistance"] > math.Max(g["initialClearDistance"], g["carHeight"]/2), "gameplay.finishDistance", "must exceed clear distance and starting front edge"})
			if g["reservedHearts"] > 0 {
				spacing := g["finishDistance"] / (g["reservedHearts"] + 1)
				checks = append(checks, struct {
					ok            bool
					field, reason string
				}{spacing-g["heartSize"]/2 > g["initialClearDistance"] && spacing > g["heartSize"] && g["finishDistance"]-spacing+g["heartSize"]/2 < g["finishDistance"], "gameplay.reservedHearts", "whole hearts must fit beyond clear road, before finish, without overlapping"})
			}
		} else {
			checks = append(checks, struct {
				ok            bool
				field, reason string
			}{g["timeLimit"]*g["tickRate"] <= math.MaxUint32, "gameplay.timeLimit", "round must end before tick exhaustion"}, struct {
				ok            bool
				field, reason string
			}{finite(g["speedGrowth"] * g["timeLimit"]), "gameplay.speedGrowth", "derived growth must remain finite"})
		}
	}
	for _, check := range checks {
		if !check.ok {
			return Configuration{}, failure(check.field, check.reason)
		}
	}
	if mode != "long-drive" {
		reach := g["maxRoadSpeed"]*g["accelSpeedMultiplier"] + g["carHeight"] + math.Max(g["obstacleH"], math.Max(g["coinSize"], g["heartSize"]))
		if !exact(math.Ceil(reach * 1024)) {
			return Configuration{}, failure("gameplay.maxRoadSpeed", "coverage projection must remain exact")
		}
		cells := 6 * (math.Ceil(reach/g["sliceSpacing"]) + 2)
		if !exact(cells) {
			return Configuration{}, failure("gameplay.sliceSpacing", "reachable cell count must be representable")
		}
		if cells > c["baselineBytes"]*8 {
			return Configuration{}, failure("connection.baselineBytes", "cannot represent consumption bits")
		}
		for _, key := range strings.Fields("laneSpacing carWidth carHeight obstacleW obstacleH coinSize heartSize finishDistance initialClearDistance heartExclusionDistance") {
			if v, exists := g[key]; exists && !exact(math.Ceil(v*1024)) {
				return Configuration{}, failure("gameplay."+key, "projection must remain exact")
			}
		}
	}
	result := Configuration{mode, source.Version, groups}
	if _, e := protocol.ConfigurationResources(result.Context(1)); e != nil {
		return Configuration{}, failure("configuration.resources", e.Error())
	}
	return result, nil
}
