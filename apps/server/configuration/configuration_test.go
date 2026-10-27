package configuration

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestSharedCaptureFixtures(t *testing.T) {
	definition, e := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if e != nil {
		t.Fatal(e)
	}
	data, e := os.ReadFile("../../../packages/contracts/configuration/fixtures.json")
	if e != nil {
		t.Fatal(e)
	}
	var fixtures struct {
		Valid []struct {
			Name, Mode string
			Overrides  json.RawMessage
			Expected   map[string]float64
		}
		Invalid []struct {
			Name, Mode string
			Overrides  json.RawMessage
			Error      string
		}
	}
	if e = json.Unmarshal(data, &fixtures); e != nil {
		t.Fatal(e)
	}
	for _, f := range fixtures.Valid {
		t.Run(f.Name, func(t *testing.T) {
			c, e := Capture(definition, f.Mode, f.Overrides)
			if e != nil {
				t.Fatal(e)
			}
			for key, want := range f.Expected {
				if c.Value("gameplay", key) != want {
					t.Fatalf("%s: got %v want %v", key, c.Value("gameplay", key), want)
				}
			}
		})
	}
	for _, f := range fixtures.Invalid {
		t.Run(f.Name, func(t *testing.T) {
			_, e := Capture(definition, f.Mode, f.Overrides)
			if e == nil || !strings.Contains(e.Error(), f.Error) {
				t.Fatalf("got %v want rejection %s", e, f.Error)
			}
		})
	}
}
func TestCaptureOwnershipAndMalformedSettings(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	config, err := Capture(definition, "drag-race", nil)
	if err != nil {
		t.Fatal(err)
	}
	context := config.Context(1)
	context.Gameplay.MaxHealth = 99
	if config.Context(1).Gameplay.MaxHealth != 3 {
		t.Fatal("mutable captured configuration")
	}
	for _, raw := range []string{`null`, ` null `, `[]`, `{"gameplay":null}`, `{"gameplay":{"maxHealth":"3"}}`, `{"other":{}}`} {
		if _, err := Capture(definition, "drag-race", []byte(raw)); err == nil {
			t.Fatal("malformed settings accepted", raw)
		}
	}
}

func TestRoundOverDelayCapturedInContext(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"drag-race", "road-rage"} {
		for _, scenario := range []struct {
			override string
			want     float64
		}{{"", 1}, {`{"presentation":{"roundOverDelay":2.5}}`, 2.5}} {
			config, err := Capture(definition, mode, []byte(scenario.override))
			if err != nil {
				t.Fatal(err)
			}
			if got := config.Context(1).Presentation.RoundOverDelay; got != scenario.want {
				t.Fatalf("%s delay: got %v want %v", mode, got, scenario.want)
			}
		}
	}
}
