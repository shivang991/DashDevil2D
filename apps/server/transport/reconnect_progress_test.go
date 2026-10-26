package transport

import (
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
	"testing"
	"time"
)

// A generation barrier must be delivered to the remaining player before a
// baseline or Coverage can advertise the replacement sequence space.
func TestReconnectPublishesFreshGenerationProgress(t *testing.T) {
	for _, mode := range []string{"drag-race", "road-rage"} {
		t.Run(mode, func(t *testing.T) {
			cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), mode, nil)
			if err != nil {
				t.Fatal(err)
			}
			ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
			engine, err := simulation.New(cfg, 1, ids, 1)
			if err != nil {
				t.Fatal(err)
			}
			cars := engine.Snapshot().Cars
			cars[0].LastInput = 5
			cars[1].LastInput = 7
			engine.Restore(cars, 0)
			r := &room{engine: engine, zero: &p.Baseline{Cars: cars, Progress: p.Progress{Processed1: 5, Disposed1: 5, Processed2: 7, Disposed2: 7}}}
			replacement := ids[1]
			replacement.PairGeneration++
			engine.ResetSeat(replacement, 2, 0)
			events, err := engine.AdvanceTo(1.0 / 120)
			if err != nil {
				t.Fatal(err)
			}
			s := &Server{}
			for _, event := range events {
				s.recordRaceLocked(r, event)
			}
			var reset *p.Event
			for _, record := range r.history {
				if value, ok := record.value.(p.Event); ok && value.SeatMask == 2 && value.Cars[1].InputGeneration == 2 {
					copy := value
					reset = &copy
				}
			}
			if reset == nil {
				t.Fatal("fresh generation was not published to the peer")
			}
			if reset.Cars[1].LastInput != 0 || reset.Cars[1].HeldMask != 0 || r.zero.Progress.Processed2 != 0 || r.zero.Progress.Disposed2 != 0 {
				t.Fatalf("reset retained old sequence space: event=%+v progress=%+v", reset, r.zero.Progress)
			}
			if r.zero.Progress.Processed1 != 5 || r.zero.Progress.Disposed1 != 5 {
				t.Fatal("reset changed the other seat")
			}
		})
	}
}

func TestRoomBaselineKeepsCommittedGenerationAndCounters(t *testing.T) {
	cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "drag-race", nil)
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(Config{Origin: "https://example.com"})
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	engine, err := simulation.New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	cars := engine.Snapshot().Cars
	cars[0].LastInput = 5
	cars[1].LastInput = 7
	engine.Restore(cars, 0)
	r := &room{id: 1, code: "test", mode: 1, phase: 2, roundID: 1, settings: cfg, engine: engine, zero: &p.Baseline{Context: cfg.Context(1), Round: p.Round{RoundId: 1, InputGeneration: 1}, Epoch: 1, Cars: cars, Progress: p.Progress{Processed1: 5, Disposed1: 5, Processed2: 7, Disposed2: 7}}}
	participant := &seat{room: r, index: 1, session: 22, generation: 2, inputGeneration: 2}
	participant.pair = newPair(s, participant)
	r.seats[1] = participant
	baseline, err := participant.pair.roomBaselineLocked()
	if err != nil {
		t.Fatal(err)
	}
	if baseline.Cars[1].InputGeneration != 1 || baseline.Round.InputGeneration != 1 || baseline.Cars[1].LastInput != 7 || baseline.Progress.Processed2 != 7 || baseline.Progress.Disposed2 != 7 {
		t.Fatalf("baseline fabricated a future generation: cars=%+v round=%+v progress=%+v", baseline.Cars, baseline.Round, baseline.Progress)
	}
}

func TestReconnectBaselineWaitsForPublishedReset(t *testing.T) {
	cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "drag-race", nil)
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(Config{Origin: "https://example.com"})
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	engine, err := simulation.New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	cars := engine.Snapshot().Cars
	cars[0].LastInput = 5
	cars[1].LastInput = 7
	engine.Restore(cars, 0)
	r := &room{id: 1, code: "test", mode: 1, phase: 2, roundID: 1, settings: cfg, engine: engine, zero: &p.Baseline{Context: cfg.Context(1), Round: p.Round{RoundId: 1, InputGeneration: 1}, Epoch: 1, Cars: cars, Progress: p.Progress{Processed1: 5, Disposed1: 5, Processed2: 7, Disposed2: 7}}}
	participant := &seat{room: r, index: 1, session: 22, generation: 2, inputGeneration: 2}
	participant.pair = newPair(s, participant)
	r.seats[1] = participant
	engine.ResetSeat(participant.pair.identity, 2, 0)
	type result struct {
		baseline p.Baseline
		err      error
	}
	captured := make(chan result, 1)
	go func() { baseline, err := participant.pair.roomBaseline(); captured <- result{baseline, err} }()
	select {
	case got := <-captured:
		t.Fatalf("baseline escaped unpublished reset: %+v %v", got.baseline.Progress, got.err)
	case <-time.After(10 * time.Millisecond):
	}
	s.mu.Lock()
	events, err := engine.AdvanceTo(1.0 / 120)
	for _, event := range events {
		s.recordRaceLocked(r, event)
	}
	r.zero.Cars = engine.Snapshot().Cars
	s.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	select {
	case got := <-captured:
		if got.err != nil {
			t.Fatal(got.err)
		}
		b := got.baseline
		if b.Round.InputGeneration != 2 || b.Cars[1].InputGeneration != 2 || b.Cars[1].LastInput != 0 || b.Progress.Processed2 != 0 || b.Progress.Disposed2 != 0 || b.Progress.Processed1 != 5 || b.Progress.Disposed1 != 5 {
			t.Fatalf("incoherent reset baseline: cars=%+v progress=%+v", b.Cars, b.Progress)
		}
	case <-time.After(time.Second):
		t.Fatal("published reset did not unblock baseline")
	}
}
