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

// The enclosure is independently derived: 1800 units/s * one second,
// plus a 60-unit contact extent, one 10-unit slice, and one 30-unit tick.
func TestBothModesDenseSeparatedWindowsFitWithoutTruncation(t *testing.T) {
	for _, mode := range []string{"drag-race", "road-rage"} {
		t.Run(mode, func(t *testing.T) {
			override := `{"gameplay":{"maxRoadSpeed":900,"sliceSpacing":10,"initialClearDistance":0,"emptyWeight":0,"obstacleWeight":1,"coinWeight":0,"heartWeight":0,"maxHealth":100}}`
			cfg, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), mode, []byte(override))
			if err != nil {
				t.Fatal(err)
			}
			ids := [2]p.Identity{{RoomId: 1, SeatSession: 11, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 22, PairGeneration: 1, Seat: 1}}
			engine, err := simulation.New(cfg, 1, ids, 1)
			if err != nil {
				t.Fatal(err)
			}
			cars := engine.Snapshot().Cars
			cars[0].Progress = 1000
			cars[1].Progress = 15000
			engine.Restore(cars, 0)
			state, err := engine.Coverage()
			if err != nil {
				t.Fatal(err)
			}
			b := p.Baseline{Context: cfg.Context(1)}
			generator, windows := raceCoverage(b, state)
			if len(windows) != 2 {
				t.Fatalf("expected disjoint windows, got %d", len(windows))
			}
			for i, progress := range []float64{1000, 15000} {
				if windows[i].Start != progress-90 || windows[i].End != progress+1900 {
					t.Fatalf("window %d: [%g,%g]", i, windows[i].Start, windows[i].End)
				}
				// Every slice has one occupied opportunity in a chosen lane. No state in
				// the omitted gap is needed or permitted to inflate the transfer.
				expected := int(math.Floor(windows[i].End/10)) - int(math.Ceil(windows[i].Start/10)) + 1
				if len(windows[i].Objects) != expected {
					t.Fatalf("window %d lost objects: got%d want%d", i, len(windows[i].Objects), expected)
				}
			}
			coverage := p.Coverage{Generator: generator, Windows: windows}
			wire, err := p.EncodeMessage(coverage, int(b.Context.Connection.ReliableFrameBytes))
			if err != nil {
				t.Fatal(err)
			}
			decoded, err := p.DecodeMessage(wire, int(b.Context.Connection.ReliableFrameBytes))
			if err != nil {
				t.Fatal(err)
			}
			for i, w := range decoded.(p.Coverage).Windows {
				if len(w.Objects) != len(windows[i].Objects) {
					t.Fatal("coverage truncated on wire")
				}
			}
			t.Logf("mode=%s seed=1 windows=%d objects=%d coverage_bytes=%d", mode, len(windows), len(windows[0].Objects)+len(windows[1].Objects), len(wire))
		})
	}
}
