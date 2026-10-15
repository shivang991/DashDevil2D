package track

import (
	"encoding/json"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"os"
	"reflect"
	"testing"
)

func TestSharedMultiplayerPlacement(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../../packages/contracts/simulation/fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Placement []struct {
			Name, Mode string
			Seed       uint32
			Overrides  json.RawMessage
			Through    []float64
			Expected   PlacementState
		}
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, scenario := range fixture.Placement {
		t.Run(scenario.Name, func(t *testing.T) {
			cfg, err := configuration.Capture(definition, scenario.Mode, scenario.Overrides)
			if err != nil {
				t.Fatal(err)
			}
			track, err := NewMultiplayer(cfg.Context(scenario.Seed))
			if err != nil {
				t.Fatal(err)
			}
			for _, through := range scenario.Through {
				if err = track.EnsureThrough(through); err != nil {
					t.Fatal(err)
				}
			}
			if !reflect.DeepEqual(track.Snapshot(), scenario.Expected) {
				t.Fatalf("got %+v want %+v", track.Snapshot(), scenario.Expected)
			}
		})
	}
}
