package transport

import (
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
	"testing"
	"time"
)

// With no periodic sweep running, the room command must enforce the cutoff.
func TestLeaveAfterMaintenanceCutoffCannotAwardForfeit(t *testing.T) {
	s, err := New(Config{Origin: "https://example.com"})
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "drag-race", nil)
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	engine, err := simulation.New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	r := &room{id: 1, code: "test", mode: 1, phase: 2, roundID: 1, settings: cfg, engine: engine, zero: &p.Baseline{}}
	for i := range r.seats {
		participant := &seat{room: r, index: p.SeatIndex(i), session: ids[i].SeatSession, generation: 1, connected: true}
		participant.pair = newPair(s, participant)
		r.seats[i] = participant
	}
	s.rooms[r.code] = r
	s.start = time.Now().Add(-100 * time.Millisecond)
	s.draining = true
	s.drainDeadline = s.start.Add(50 * time.Millisecond)
	host := r.seats[0].pair
	if err := host.roomCommand(p.RoomCommand{Identity: host.identity, Sequence: 1, Command: 3}); err != nil {
		t.Fatal(err)
	}
	if r.outcome == nil || r.outcome.Result != 3 || r.outcome.Reason != 7 || r.outcome.TimeUs != 50000 {
		t.Fatalf("late leave changed maintenance result: %+v", r.outcome)
	}
}

func TestGraceExpiryCannotOvertakePendingFinish(t *testing.T) {
	s, err := New(Config{Origin: "https://example.com"})
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "drag-race", []byte(`{"gameplay":{"finishDistance":440,"tickRate":1,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1},"operational":{"simulationLagThreshold":2}}`))
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	engine, err := simulation.New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = engine.AdvanceTo(1); err != nil {
		t.Fatal(err)
	}
	if !engine.PendingGroup() {
		t.Fatal("fixture did not open a group")
	}
	zero := p.Baseline{Cars: engine.Snapshot().Cars, Context: cfg.Context(1)}
	r := &room{id: 1, code: "test", mode: 1, phase: 2, roundID: 1, settings: cfg, engine: engine, zero: &zero}
	s.start = time.Now().Add(-1200 * time.Millisecond)
	for i := range r.seats {
		participant := &seat{room: r, index: p.SeatIndex(i), session: ids[i].SeatSession, generation: 1, connected: i == 0}
		participant.pair = newPair(s, participant)
		r.seats[i] = participant
	}
	r.seats[1].deadline = s.start.Add(1100 * time.Millisecond)
	s.rooms[r.code] = r
	s.mu.Lock()
	s.expireLocked(time.Now())
	s.mu.Unlock()
	if r.outcome == nil || r.outcome.Result != 2 || r.outcome.Reason != 0 || r.outcome.TimeUs != 1000000 {
		t.Fatalf("expiry overtook pending finish: %+v", r.outcome)
	}
}
