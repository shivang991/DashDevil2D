package simulation

import (
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"os"
	"reflect"
	"testing"
)

func groupRound(t *testing.T, overrides string) (*Engine, [2]protocol.Identity) {
	t.Helper()
	definition, err := os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := configuration.Capture(definition, "drag-race", []byte(overrides))
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]protocol.Identity{{RoomId: 1, SeatSession: 1, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 2, PairGeneration: 1, Seat: 1}}
	game, err := New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	return game, ids
}
func TestPendingGroupCheckpointAndInput(t *testing.T) {
	game, ids := groupRound(t, `{"gameplay":{"finishDistance":400,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1}}`)
	cars := game.Snapshot().Cars
	cars[0].Progress = 353.33336
	cars[1].Progress = 353.33328
	game.Restore(cars, 0)
	checkpoint, err := game.Coverage()
	if err != nil {
		t.Fatal(err)
	}
	events, err := game.AdvanceTo(1.0 / 60)
	if err != nil || len(events) != 0 || !game.PendingGroup() || !reflect.DeepEqual(checkpoint, game.Snapshot()) {
		t.Fatalf("incoherent open checkpoint: %v %v", events, err)
	}
	accepted, err := game.Submit(ids[0], protocol.Input{Identity: ids[0], Round: protocol.Round{RoundId: 1, InputGeneration: 1}, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
	if err != nil || !accepted {
		t.Fatalf("boundary input: %v %v", accepted, err)
	}
	events, err = game.AdvanceTo(2.0 / 60)
	if err != nil || len(events) != 1 || events[0].Type != "input" || events[0].TimeUs != 16667 || events[0].Disposition != "accepted" {
		t.Fatalf("boundary input order: %v %v", events, err)
	}
	state := game.Snapshot()
	if game.PendingGroup() || state.Finish == nil || state.Finish.TimeUs != 16667 || state.Finish.Result != 2 || state.Cars[0].LastInput != 1 {
		t.Fatalf("group finality: %+v", state)
	}
}
func TestRecoveryResetWaitsForPendingGroup(t *testing.T) {
	game, ids := groupRound(t, `{"gameplay":{"finishDistance":2400,"initialClearDistance":0,"reservedHearts":2,"sliceSpacing":397,"heartExclusionDistance":0,"heartSize":51.99984}}`)
	cars := game.Snapshot().Cars
	cars[0].Progress = 727.33336
	cars[0].Lateral = 0
	cars[0].Lane = 1
	cars[0].Hp = 1
	game.Restore(cars, 0)
	checkpoint, err := game.Coverage()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := game.AdvanceTo(1.0 / 60); err != nil {
		t.Fatal(err)
	}
	replacement := ids[0]
	replacement.PairGeneration++
	game.ResetSeat(replacement, 2, 0)
	if !reflect.DeepEqual(checkpoint, game.Snapshot()) {
		t.Fatal("reset exposed an unfinished group")
	}
	events, err := game.AdvanceTo(2.0 / 60)
	if err != nil {
		t.Fatal(err)
	}
	state := game.Snapshot()
	if game.PendingGroup() || state.Cars[0].InputGeneration != 2 || state.Cars[0].LastInput != 0 || state.Cars[0].Hp != 1 {
		t.Fatalf("reset continuation: %+v", state.Cars[0])
	}
	if len(events) != 2 || events[0].Type != "objects" || events[1].Type != "release" {
		t.Fatalf("reset ordering: %v", events)
	}
	accepted, err := game.Submit(replacement, protocol.Input{Identity: replacement, Round: protocol.Round{RoundId: 1, InputGeneration: 2}, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
	if err != nil || !accepted {
		t.Fatalf("fresh recovery input: %v %v", accepted, err)
	}
}
