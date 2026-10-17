package transport

import (
	"math"
	"testing"

	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
)

func TestRaceCoverageIncludesCompleteReplayHeadroom(t *testing.T) {
	cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "drag-race", []byte(`{"gameplay":{"finishDistance":2400,"initialClearDistance":0,"reservedHearts":0,"sliceSpacing":10}}`))
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	engine, err := simulation.New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	state, err := engine.Coverage()
	if err != nil {
		t.Fatal(err)
	}
	// Preserve authoritative per-seat consumption, including in widened windows.
	if len(state.Objects) == 0 {
		t.Fatal("missing seeded placements")
	}
	state.Objects[0].Flags |= 8
	b := p.Baseline{Context: cfg.Context(1)}
	_, windows := raceCoverage(b, state)
	g := b.Context.Gameplay
	extent := (g.CarHeight + math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize))) / 2
	padding := g.MaxRoadSpeed * g.AccelSpeedMultiplier / g.TickRate
	start, end := -extent-padding, g.MaxRoadSpeed*g.AccelSpeedMultiplier+extent+g.SliceSpacing+padding
	if len(windows) != 1 || windows[0].Start > start || windows[0].End < end {
		t.Fatalf("missing replay headroom: %+v; want [%g,%g]", windows, start, end)
	}
	if state.Track.Through < end {
		t.Fatalf("window promises ungenerated placement: through %g, end %g", state.Track.Through, end)
	}
	for _, object := range state.Objects {
		if object.Distance < windows[0].Start || object.Distance > windows[0].End {
			continue
		}
		found := false
		for _, represented := range windows[0].Objects {
			if represented.Id == object.Id {
				found = true
				if represented.Flags != object.Flags {
					t.Fatal("lost per-seat consumption")
				}
				break
			}
		}
		if !found {
			t.Fatalf("omitted represented object %d", object.Id)
		}
	}
	// At spacing10, center880 falls beyond the former870-unit horizon.
	found := false
	for _, slice := range state.Track.Slices {
		if slice.Distance == 880 {
			found = true
		}
	}
	if !found {
		t.Fatal("missing placement opportunity inside forward headroom")
	}
}

func TestRaceCoverageRetainsPlacementInsideBackwardHeadroom(t *testing.T) {
	cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "drag-race", []byte(`{"gameplay":{"finishDistance":2400,"initialClearDistance":0,"reservedHearts":0,"sliceSpacing":10,"maxHealth":100}}`))
	if err != nil {
		t.Fatal(err)
	}
	ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
	engine, err := simulation.New(cfg, 1, ids, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := engine.AdvanceTo(.25); err != nil {
		t.Fatal(err)
	}
	state, err := engine.Coverage()
	if err != nil {
		t.Fatal(err)
	}
	_, windows := raceCoverage(p.Baseline{Context: cfg.Context(1)}, state)
	// Cars at100 need backward coverage from26.666...; center30 must
	// survive retirement even though the unpadded lower edge is40.
	found := false
	for _, window := range windows {
		for _, object := range window.Objects {
			if object.Distance == 30 {
				found = true
			}
		}
	}
	if !found {
		t.Fatal("retired seeded obstacle30 inside backward replay headroom")
	}
}
