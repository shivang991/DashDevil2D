package simulation

import (
	"encoding/json"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"math"
	"os"
	"reflect"
	"strconv"
	"testing"
)

func TestSharedRoadRage(t *testing.T) {
	data, err := os.ReadFile("../../../packages/contracts/race/road-rage.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures struct {
		Scenarios []struct {
			Name      string
			Seed      uint32
			Tick      uint32
			Overrides json.RawMessage
			Cars      []json.RawMessage
			Advance   float64
			Expected  struct {
				Hp, Score    []uint32
				ProtectionUs []uint64
				Finish       *Finish
				Reason       *uint8
				Spent        map[string]uint8
				Progress     []float64
			}
		}
	}
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, scenario := range fixtures.Scenarios {
		t.Run(scenario.Name, func(t *testing.T) {
			cfg, err := configuration.Capture([]byte(protocol.DefaultConfigurationJSON), "road-rage", scenario.Overrides)
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
			if _, err := game.AdvanceTo(scenario.Advance); err != nil {
				t.Fatal(err)
			}
			state, expected := game.Snapshot(), scenario.Expected
			for seat, car := range state.Cars {
				if car.Hp != expected.Hp[seat] || car.ProtectionUs != expected.ProtectionUs[seat] {
					t.Fatalf("seat %d HP/protection: %d/%d", seat, car.Hp, car.ProtectionUs)
				}
				if expected.Score != nil && car.Score != expected.Score[seat] {
					t.Fatalf("seat %d score %d", seat, car.Score)
				}
				if expected.Progress != nil && math.Abs(car.Progress-expected.Progress[seat]) > 1e-6+1e-12*math.Abs(expected.Progress[seat]) {
					t.Fatalf("seat %d progress %.15g expected %.15g", seat, car.Progress, expected.Progress[seat])
				}
			}
			if (state.Finish == nil) != (expected.Finish == nil) {
				t.Fatalf("finish %#v expected %#v", state.Finish, expected.Finish)
			}
			if expected.Finish != nil && (state.Finish.Tick != expected.Finish.Tick || state.Finish.TimeUs != expected.Finish.TimeUs || state.Finish.Result != expected.Finish.Result || state.Finish.Reason != *expected.Reason) {
				t.Fatalf("finish %#v expected %#v reason %d", state.Finish, expected.Finish, *expected.Reason)
			}
			for id, flags := range expected.Spent {
				number, _ := strconv.ParseUint(id, 10, 32)
				found := false
				for _, object := range state.Objects {
					if object.Id == uint32(number) {
						found = object.Flags == flags
						break
					}
				}
				if !found {
					t.Fatalf("object %s expected flags %d", id, flags)
				}
			}
			if state.Finish != nil {
				accepted, err := game.Submit(ids[0], protocol.Input{Identity: ids[0], Round: protocol.Round{RoundId: 1, InputGeneration: 1}, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
				if err != nil || accepted {
					t.Fatalf("terminal input accepted: %v %v", accepted, err)
				}
				game.Disconnect(ids[0])
				events, err := game.AdvanceTo(scenario.Advance + 2)
				if err != nil || len(events) != 0 || !reflect.DeepEqual(game.Snapshot(), state) {
					t.Fatalf("terminal state changed: %v %v", events, err)
				}
			}
		})
	}
}
