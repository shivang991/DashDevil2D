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

func TestSharedObjects(t *testing.T) {
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../../packages/contracts/race/objects.json")
	if err != nil {
		t.Fatal(err)
	}
	type expectedEvent struct {
		TimeUs  uint64
		Objects []protocol.ObjectState
	}
	var fixtures struct {
		Scenarios []struct {
			Name      string
			Seed      uint32
			Overrides json.RawMessage
			Cars      []json.RawMessage
			Advance   float64
			Tick      uint32
			Expected  struct {
				Hp, Score []uint32
				Progress  []float64
				Finish    *Finish
				Events    []expectedEvent
			}
		}
	}
	if err = json.Unmarshal(data, &fixtures); err != nil {
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
				if err = json.Unmarshal(fields, &cars[seat]); err != nil {
					t.Fatal(err)
				}
			}
			game.Restore(cars, scenario.Tick)
			events, err := game.AdvanceTo(scenario.Advance)
			if err != nil {
				t.Fatal(err)
			}
			for seat, car := range game.Snapshot().Cars {
				if math.Abs(car.Progress-scenario.Expected.Progress[seat]) > 1e-6+1e-12*math.Abs(scenario.Expected.Progress[seat]) {
					t.Fatalf("seat %d progress %.15g", seat, car.Progress)
				}
				if car.Hp != scenario.Expected.Hp[seat] || car.Score != scenario.Expected.Score[seat] {
					t.Fatalf("seat %d HP/score: %d/%d", seat, car.Hp, car.Score)
				}
			}
			if scenario.Expected.Finish != nil {
				state := game.Snapshot()
				actual := state.Finish
				if actual == nil || actual.Tick != scenario.Expected.Finish.Tick || actual.TimeUs != scenario.Expected.Finish.TimeUs || actual.Result != scenario.Expected.Finish.Result {
					t.Fatalf("finish %#v expected %#v", actual, scenario.Expected.Finish)
				}
				reason := uint8(0)
				for _, hp := range scenario.Expected.Hp {
					if hp == 0 {
						reason = 1
					}
				}
				if actual.Reason != reason {
					t.Fatalf("terminal reason %d expected %d", actual.Reason, reason)
				}
				game.Disconnect(ids[0])
				later, err := game.AdvanceTo(scenario.Advance + 2)
				if err != nil || len(later) != 0 || !reflect.DeepEqual(state, game.Snapshot()) {
					t.Fatalf("terminal state changed: %v %v", later, err)
				}
			}
			actual := []expectedEvent{}
			for _, event := range events {
				actual = append(actual, expectedEvent{event.TimeUs, event.Objects})
			}
			if !reflect.DeepEqual(actual, scenario.Expected.Events) {
				t.Fatalf("events: %#v expected %#v", actual, scenario.Expected.Events)
			}
		})
	}
}
