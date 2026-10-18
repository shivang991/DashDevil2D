package simulation

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"math"
	"os"
	"reflect"
	"testing"
)

func TestSharedResponsibility(t *testing.T) {
	data, err := os.ReadFile("../../../packages/contracts/race/responsibility.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures struct {
		Scenarios []struct {
			Name      string
			Seed      uint32
			Overrides json.RawMessage
			Cars      []json.RawMessage
			Steps     []struct {
				Contact                        *protocol.Contact
				ContactHex                     string
				Finish                         *Finish
				Reason                         *uint8
				Progress, Lateral              []float64
				At                             float64
				Inputs                         []struct{ Seat, Control, Intent, HeldMask uint8 }
				HP                             [2]uint32
				ContactTimes                   []uint64
				LatestSeat                     *uint8
				LatestOrder                    *uint32
				MovementStartUs, MovementEndUs []uint64
				Separated                      bool
				ReturnDeparture                *uint8
				Spent                          map[string]uint8
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
			seed := scenario.Seed
			if seed == 0 {
				seed = 1
			}
			game, err := New(cfg, seed, ids, 1)
			if err != nil {
				t.Fatal(err)
			}
			cars := game.Snapshot().Cars
			for seat, fields := range scenario.Cars {
				if err := json.Unmarshal(fields, &cars[seat]); err != nil {
					t.Fatal(err)
				}
			}
			game.Restore(cars, 0)
			sequences := [2]uint32{}
			for _, step := range scenario.Steps {
				for _, input := range step.Inputs {
					sequences[input.Seat]++
					accepted, err := game.Submit(ids[input.Seat], protocol.Input{Identity: ids[input.Seat], Round: protocol.Round{RoundId: 1, InputGeneration: 1}, Sequence: sequences[input.Seat], Control: input.Control, Intent: input.Intent, HeldMask: input.HeldMask})
					if err != nil || !accepted {
						t.Fatalf("submit: %v %v", accepted, err)
					}
				}
				events, err := game.AdvanceTo(step.At)
				if err != nil {
					t.Fatal(err)
				}
				state := game.Snapshot()
				if step.Contact != nil {
					if state.Contact != *step.Contact {
						t.Fatalf("contact %#v expected %#v", state.Contact, *step.Contact)
					}
					bytes, err := protocol.EncodeContact(state.Contact, 65536)
					if err != nil || hex.EncodeToString(bytes) != step.ContactHex {
						t.Fatalf("contact bytes %x: %v", bytes, err)
					}
				}
				if step.Finish != nil && (state.Finish == nil || state.Finish.Tick != step.Finish.Tick || state.Finish.TimeUs != step.Finish.TimeUs || state.Finish.Result != step.Finish.Result || state.Finish.Reason != *step.Reason) {
					t.Fatalf("finish %#v", state.Finish)
				}
				for seat, car := range state.Cars {
					for field, expected := range map[string][]float64{"progress": step.Progress, "lateral": step.Lateral} {
						if expected == nil {
							continue
						}
						actual := car.Progress
						if field == "lateral" {
							actual = car.Lateral
						}
						if math.Abs(actual-expected[seat]) > 1e-6+1e-12*math.Abs(expected[seat]) {
							t.Fatalf("%s %g expected %g", field, actual, expected[seat])
						}
					}
				}
				if step.LatestSeat != nil && (state.LatestPress == nil || state.LatestPress.Seat != *step.LatestSeat) {
					t.Fatalf("latest press %#v", state.LatestPress)
				}
				if step.LatestOrder != nil && (state.LatestPress == nil || state.LatestPress.Order != *step.LatestOrder) {
					t.Fatalf("latest press %#v", state.LatestPress)
				}
				if step.Separated && math.Abs(state.Cars[0].Lateral-state.Cars[1].Lateral) < 50-1e-6 && math.Abs(state.Cars[0].Progress-state.Cars[1].Progress) < 80-1e-6 {
					t.Fatal("cars interpenetrate")
				}
				if step.ReturnDeparture != nil && state.Cars[0].Departure != *step.ReturnDeparture {
					t.Fatal("return changed departure")
				}
				for seat, car := range state.Cars {
					if step.MovementStartUs != nil && car.MovementStartUs != step.MovementStartUs[seat] {
						t.Fatal("return restarted")
					}
					if step.MovementEndUs != nil && car.MovementEndUs != step.MovementEndUs[seat] {
						t.Fatal("return deadline restarted")
					}
				}
				if step.Spent != nil {
					spent := map[string]uint8{}
					for _, o := range state.Objects {
						if o.Flags&28 != 0 {
							spent[fmt.Sprint(o.Id)] = o.Flags
						}
					}
					if !reflect.DeepEqual(spent, step.Spent) {
						t.Fatalf("spent %v expected %v", spent, step.Spent)
					}
				}
				hp := [2]uint32{state.Cars[0].Hp, state.Cars[1].Hp}
				if hp != step.HP {
					t.Fatalf("HP %v expected %v", hp, step.HP)
				}
				times := []uint64{}
				for _, event := range events {
					if event.Type == "contact" {
						times = append(times, event.TimeUs)
					}
				}
				if !reflect.DeepEqual(times, step.ContactTimes) {
					t.Fatalf("contacts %v expected %v", times, step.ContactTimes)
				}
			}
		})
	}
}
