package simulation

import (
	"encoding/json"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"math"
	"os"
	"reflect"
	"testing"
)

func TestNextUnprocessedTick(t *testing.T) {
	definition, e := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if e != nil {
		t.Fatal(e)
	}
	cfg, e := configuration.Capture(definition, "drag-race", nil)
	if e != nil {
		t.Fatal(e)
	}
	identities := [2]protocol.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	game, e := New(cfg, 1, identities, 1)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = game.AdvanceTo(.1); e != nil {
		t.Fatal(e)
	}
	ok, e := game.Submit(identities[0], protocol.Input{Identity: identities[0], Round: protocol.Round{RoundId: 1, InputGeneration: 1}, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
	if e != nil || !ok {
		t.Fatalf("%v %v", ok, e)
	}
	events, e := game.AdvanceTo(.2)
	if e != nil {
		t.Fatal(e)
	}
	if len(events) != 1 || events[0].TimeUs != 100000 || events[0].Tick != 6 {
		t.Fatal(events)
	}
	if math.Abs(game.Snapshot().Cars[0].Progress-120) > 1e-6 {
		t.Fatal(game.Snapshot())
	}
}

func TestSharedTimelines(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../../packages/contracts/simulation/fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	type step struct {
		Advance                   *float64
		Disconnect                *uint8
		At                        *float64
		Seat                      uint8
		Sequence                  uint32
		Intent, Control, HeldMask uint8
		PayloadSeat               *uint8
		RoundID                   *uint32
	}
	var fixture struct {
		Scenarios []struct {
			Name, Mode string
			Seed       uint32
			Overrides  json.RawMessage
			Steps      []step
			Expected   map[string]json.RawMessage
		}
		TimeVectors []struct {
			Seconds  float64
			Expected uint64
		}
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, v := range fixture.TimeVectors {
		got, err := CanonicalTime(v.Seconds)
		if err != nil || got != v.Expected {
			t.Fatalf("time %g: %v %v", v.Seconds, got, err)
		}
	}
	identities := [2]protocol.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	for _, scenario := range fixture.Scenarios {
		t.Run(scenario.Name, func(t *testing.T) {
			cfg, err := configuration.Capture(definition, scenario.Mode, scenario.Overrides)
			if err != nil {
				t.Fatal(err)
			}
			game, err := New(cfg, scenario.Seed, identities, 1)
			if err != nil {
				t.Fatal(err)
			}
			events := []Observation{}
			advance := func(seconds float64) {
				next, err := game.AdvanceTo(seconds)
				if err != nil {
					t.Fatal(err)
				}
				events = append(events, next...)
			}
			for _, step := range scenario.Steps {
				if step.Advance != nil {
					advance(*step.Advance)
				} else if step.Disconnect != nil {
					game.Disconnect(identities[*step.Disconnect])
				} else {
					advance(*step.At)
					payload := identities[step.Seat]
					if step.PayloadSeat != nil {
						payload.Seat = *step.PayloadSeat
					}
					round := uint32(1)
					if step.RoundID != nil {
						round = *step.RoundID
					}
					_, err = game.Submit(identities[step.Seat], protocol.Input{Identity: payload, Round: protocol.Round{RoundId: round, InputGeneration: 1}, Sequence: step.Sequence, Intent: step.Intent, Control: step.Control, HeldMask: step.HeldMask})
					if err != nil {
						t.Fatal(err)
					}
				}
			}
			for i := range events {
				if events[i].Car != nil {
					if err := protocol.ValidateCar(*events[i].Car, events[i].TimeUs, cfg.Context(scenario.Seed)); err != nil {
						t.Fatal(err)
					}
				}
				events[i].Car = nil
			}
			assertJSON(t, events, scenario.Expected["events"])
			snapshot := game.Snapshot()
			encoded, _ := json.Marshal(snapshot)
			var state map[string]json.RawMessage
			_ = json.Unmarshal(encoded, &state)
			var cars []map[string]float64
			_ = json.Unmarshal(state["cars"], &cars)
			var expected []map[string]float64
			_ = json.Unmarshal(scenario.Expected["cars"], &expected)
			for seat, car := range expected {
				for key, want := range car {
					got := cars[seat][key]
					tolerance := 0.0
					if key == "progress" || key == "lateral" || key == "normalSpeed" {
						tolerance = 1e-6 + 1e-12*math.Abs(want)
					}
					if math.Abs(got-want) > tolerance {
						t.Fatalf("seat %d %s got %.17g want %.17g", seat, key, got, want)
					}
				}
			}
			for key, want := range scenario.Expected {
				if key == "trackDistances" {
					distances := []float64{}
					for _, slice := range snapshot.Track.Slices {
						distances = append(distances, slice.Distance)
					}
					assertJSON(t, distances, want)
				} else if key != "cars" && key != "events" && key != "derivation" {
					var actual any
					_ = json.Unmarshal(state[key], &actual)
					assertJSON(t, actual, want)
				}
			}
		})
	}
}
func assertJSON(t *testing.T, value any, want json.RawMessage) {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var actual, expected any
	if err = json.Unmarshal(data, &actual); err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(want, &expected); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("got %s\nwant %s", data, want)
	}
}
func TestSharedGeometry(t *testing.T) {
	data, err := os.ReadFile("../../../packages/contracts/simulation/fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Geometry []struct {
			Name           string
			A0, A1, B0, B1 Bounds
			Expected       *float64
		}
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, v := range fixture.Geometry {
		t.Run(v.Name, func(t *testing.T) {
			got, ok := FirstContact(v.A0, v.A1, v.B0, v.B1)
			if v.Expected == nil {
				if ok {
					t.Fatal("unexpected contact", got)
				}
			} else if !ok || got != *v.Expected {
				t.Fatalf("contact %v %v want %v", got, ok, *v.Expected)
			}
		})
	}
}
func TestOwnershipAndAbuse(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := configuration.Capture(definition, "drag-race", []byte(`{"connection":{"inputBurst":1}}`))
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]protocol.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	game, err := New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	input := protocol.Input{Identity: ids[0], Round: protocol.Round{RoundId: 1, InputGeneration: 1}, Sequence: 1, Control: 3, HeldMask: 4}
	forged := ids[0]
	forged.SeatSession = 999
	if ok, _ := game.Submit(forged, input); ok {
		t.Fatal("forged identity accepted")
	}
	if ok, err := game.Submit(ids[0], input); !ok || err != nil {
		t.Fatal(ok, err)
	}
	input.Sequence = 2
	if _, err := game.Submit(ids[0], input); err == nil {
		t.Fatal("rate abuse did not fail")
	}
	if _, err = game.AdvanceTo(.1); err != nil {
		t.Fatal(err)
	}
	if _, err = game.AdvanceTo(.05); err == nil {
		t.Fatal("clock reversal accepted")
	}
	state := game.Snapshot()
	state.Cars[0].Hp = 0
	if game.Snapshot().Cars[0].Hp != 3 {
		t.Fatal("snapshot aliases state")
	}
	for _, seconds := range []float64{-1, math.NaN(), math.Inf(1), 1e20} {
		if _, err = CanonicalTime(seconds); err == nil {
			t.Fatal("invalid time accepted", seconds)
		}
	}
}

// These literals are shared with the client session tests and independently
// worked from front-edge geometry, rather than generated by either engine.
func TestSharedFinishContinuations(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := configuration.Capture(definition, "drag-race", []byte(`{"gameplay":{"finishDistance":400,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1}}`))
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../../packages/contracts/race/fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Scenarios []struct {
			Name          string
			Progress      [2]float64
			Phase         uint8
			Nos           bool
			TimeUs        uint64
			Tick          uint32
			Result        uint8
			Lateral       float64
			Position0     *float64
			MovementEndUs *uint64
		}
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, scenario := range fixture.Scenarios {
		t.Run(scenario.Name, func(t *testing.T) {
			ids := [2]protocol.Identity{{RoomId: 1, SeatSession: 1, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 2, PairGeneration: 1, Seat: 1}}
			game, err := New(cfg, 1, ids, 1)
			if err != nil {
				t.Fatal(err)
			}
			cars := game.Snapshot().Cars
			for seat := range cars {
				cars[seat].Progress = scenario.Progress[seat]
			}
			car := &cars[0]
			car.Phase = scenario.Phase
			if scenario.Phase != 0 {
				car.MovementEndUs = 150000
				if scenario.MovementEndUs != nil {
					car.MovementEndUs = *scenario.MovementEndUs
				}
				if scenario.Phase == 1 {
					car.Target = 1
					car.MovementOrigin = -120
					car.MovementTarget = 0
				} else {
					car.Target = 0
					car.MovementOrigin = -40
					car.MovementTarget = -120
				}
				car.Lateral = car.MovementOrigin
			}
			if scenario.Nos {
				car.Controls = 3
				car.Effective = 3
				car.HeldMask = 4
				car.Flags = 1
				car.FreshnessUs = 1000000
			}
			game.Restore(cars, 0)
			if _, err = game.AdvanceTo(1); err != nil {
				t.Fatal(err)
			}
			state := game.Snapshot()
			expected := &Finish{Tick: scenario.Tick, TimeUs: scenario.TimeUs, Result: scenario.Result}
			position0 := 360.0
			if scenario.Position0 != nil {
				position0 = *scenario.Position0
			}
			if !reflect.DeepEqual(state.Finish, expected) || math.Abs(state.Cars[0].Progress-position0) > 1e-6 || math.Abs(state.Cars[0].Lateral-scenario.Lateral) > 1e-6 {
				t.Fatalf("got %+v cars %+v; want %+v lateral %v", state.Finish, state.Cars, expected, scenario.Lateral)
			}
			game.Disconnect(ids[0])
			accepted, err := game.Submit(ids[0], protocol.Input{Identity: ids[0], Round: protocol.Round{RoundId: 1, InputGeneration: 1}, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
			if err != nil || accepted {
				t.Fatalf("terminal input accepted: %v %v", accepted, err)
			}
			game.AdvanceTo(2)
			if !reflect.DeepEqual(state, game.Snapshot()) {
				t.Fatal("finality changed")
			}
		})
	}
}
