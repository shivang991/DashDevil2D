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

func TestSharedContacts(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../../packages/contracts/race/contacts.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures struct {
		Scenarios []struct {
			Overrides  json.RawMessage
			Name       string
			Seed, Tick uint32
			Advance    float64
			Cars       []json.RawMessage
			Expected   struct {
				Progress, Lateral []float64
				Phase, Effective  []uint8
				ContactTimes      []uint64
			}
		}
	}
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, scenario := range fixtures.Scenarios {
		t.Run(scenario.Name, func(t *testing.T) {
			cfg, err := configuration.Capture(definition, "drag-race", scenario.Overrides)
			if err != nil {
				t.Fatal(err)
			}
			ids := [2]protocol.Identity{{RoomId: 1, SeatSession: 1, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 2, PairGeneration: 1, Seat: 1}}
			game, err := New(cfg, scenario.Seed, ids, 1)
			if err != nil {
				t.Fatal(err)
			}
			cars := game.Snapshot().Cars
			for seat, fields := range scenario.Cars {
				if err := json.Unmarshal(fields, &cars[seat]); err != nil {
					t.Fatal(err)
				}
			}
			game.Restore(cars, scenario.Tick)
			events, err := game.AdvanceTo(scenario.Advance)
			if err != nil {
				t.Fatal(err)
			}
			state := game.Snapshot()
			for seat, car := range state.Cars {
				if math.Abs(car.Progress-scenario.Expected.Progress[seat]) > 1e-6+1e-12*math.Abs(scenario.Expected.Progress[seat]) || math.Abs(car.Lateral-scenario.Expected.Lateral[seat]) > 1e-6+1e-12*math.Abs(scenario.Expected.Lateral[seat]) {
					t.Fatalf("seat %d position: %g %g", seat, car.Progress, car.Lateral)
				}
				if car.Phase != scenario.Expected.Phase[seat] || car.Effective != scenario.Expected.Effective[seat] || car.Hp != 3 {
					t.Fatalf("seat %d: %#v", seat, car)
				}
				if err := protocol.ValidateCar(car, state.TimeUs, cfg.Context(scenario.Seed)); err != nil {
					t.Fatal(err)
				}
			}
			times := []uint64{}
			for _, event := range events {
				if event.Type == "contact" {
					times = append(times, event.TimeUs)
				}
			}
			if !reflect.DeepEqual(times, scenario.Expected.ContactTimes) {
				t.Fatalf("contacts %v expected %v", times, scenario.Expected.ContactTimes)
			}
		})
	}
}

func TestReturnRequiresFreshControls(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := configuration.Capture(definition, "drag-race", nil)
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]protocol.Identity{{RoomId: 1, SeatSession: 1, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 2, PairGeneration: 1, Seat: 1}}
	game, err := New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	cars := game.Snapshot().Cars
	cars[0].Phase = 1
	cars[0].Target = 1
	cars[0].MovementTarget = 0
	cars[0].MovementEndUs = 150000
	cars[1].Lateral = 0
	cars[1].Lane = 1
	cars[1].Departure = 1
	cars[1].Target = 1
	cars[1].MovementOrigin = 0
	cars[1].MovementTarget = 0
	game.Restore(cars, 0)
	advance := func(at float64) []Observation {
		events, err := game.AdvanceTo(at)
		if err != nil {
			t.Fatal(err)
		}
		return events
	}
	submit := func(seq uint32, intent, control, held uint8) {
		ok, err := game.Submit(ids[0], protocol.Input{Identity: ids[0], Round: protocol.Round{RoundId: 1, InputGeneration: 1}, Sequence: seq, Intent: intent, Control: control, HeldMask: held})
		if err != nil || !ok {
			t.Fatalf("submit %v %v", ok, err)
		}
	}
	advance(.1)
	submit(1, 0, 3, 4)
	if events := advance(.2); events[0].Disposition != "ignored" {
		t.Fatal(events)
	}
	advance(.3)
	submit(2, 2, 3, 4)
	if events := advance(.35); events[0].Disposition != "ignored" {
		t.Fatal(events)
	}
	if car := game.Snapshot().Cars[0]; car.Phase != 0 || car.Effective != 0 {
		t.Fatal(car)
	}
	submit(3, 0, 3, 4)
	advance(.4)
	if car := game.Snapshot().Cars[0]; car.Effective != 3 {
		t.Fatal(car)
	}
}
