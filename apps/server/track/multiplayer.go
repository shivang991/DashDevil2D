package track

import (
	"fmt"
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"math"
)

type PlacementState struct {
	RandomState uint32  `json:"randomState"`
	NextID      uint64  `json:"nextId"`
	RandomIndex uint64  `json:"randomIndex"`
	HeartIndex  uint64  `json:"heartIndex"`
	Through     float64 `json:"through"`
	Slices      []Slice `json:"slices"`
}
type Multiplayer struct {
	context   protocol.Context
	generator *Generator
	state     PlacementState
}

func NewMultiplayer(context protocol.Context) (*Multiplayer, error) {
	generator, e := New(context.Seed)
	if e != nil {
		return nil, e
	}
	if context.Mode != protocol.ModeDragRace && context.Mode != protocol.ModeRoadRage {
		return nil, fmt.Errorf("multiplayer mode required")
	}
	return &Multiplayer{context: context, generator: generator, state: PlacementState{RandomIndex: 1, HeartIndex: 1, Slices: []Slice{}}}, nil
}
func (t *Multiplayer) EnsureThrough(distance float64) error {
	if math.IsNaN(distance) || math.IsInf(distance, 0) || distance < 0 || math.Ceil(distance*protocol.ProjectionScale) > 9007199254740991 {
		return fmt.Errorf("unrepresentable track coverage")
	}
	g := t.context.Gameplay
	hearts := 0.0
	finish := math.Inf(1)
	if t.context.Mode == protocol.ModeDragRace {
		hearts = g.ReservedHearts
		finish = g.FinishDistance
	}
	limit := math.Min(distance, finish)
	for {
		randomDistance := g.InitialClearDistance + float64(float64(t.state.RandomIndex)*g.SliceSpacing)
		heartDistance := math.Inf(1)
		if float64(t.state.HeartIndex) <= hearts {
			heartDistance = float64(float64(t.state.HeartIndex)/(hearts+1)) * finish
		}
		anchor := math.Min(randomDistance, heartDistance)
		if anchor > limit || anchor >= finish {
			break
		}
		if t.generator.NextID > math.MaxUint32 {
			return fmt.Errorf("track identity exhausted")
		}
		cells := [3]string{"empty", "empty", "empty"}
		if heartDistance <= randomDistance {
			cells[int(float64(t.generator.Draw())/4294967296*3)] = "heart"
			t.state.HeartIndex++
		} else {
			lane, cell := t.generator.Select(Config{CoinWeight: g.CoinWeight, ObstacleWeight: g.ObstacleWeight, HeartWeight: g.HeartWeight, EmptyWeight: g.EmptyWeight})
			index := math.Max(1, math.Min(hearts, math.Floor(float64(anchor/finish*(hearts+1))+.5)))
			reservedDistance := index / (hearts + 1) * finish
			reserved := hearts > 0 && (anchor == reservedDistance || cell == "obstacle" && math.Abs(anchor-reservedDistance) <= g.HeartExclusionDistance)
			if !reserved {
				cells[lane] = cell
			}
			t.state.RandomIndex++
		}
		t.state.Slices = append(t.state.Slices, Slice{ID: t.generator.NextID, Distance: anchor, Cells: cells})
		t.generator.NextID++
	}
	t.state.Through = math.Max(t.state.Through, limit)
	return nil
}
func (t *Multiplayer) RetireBehind(distance float64) {
	g := t.context.Gameplay
	extent := math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize)) / 2
	kept := t.state.Slices[:0]
	for _, slice := range t.state.Slices {
		if slice.Distance+extent >= distance {
			kept = append(kept, slice)
		}
	}
	t.state.Slices = kept
}
func (t *Multiplayer) Snapshot() PlacementState {
	result := t.state
	result.RandomState = t.generator.State
	result.NextID = t.generator.NextID
	result.Slices = append([]Slice{}, t.state.Slices...)
	return result
}
