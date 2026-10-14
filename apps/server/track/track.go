// Package track defines generation version 1 shared with the headless client.
// Server gameplay/transport integration remains owned by later stages.
package track

import "fmt"

type Generator struct {
	State  uint32
	NextID uint64
}
type Slice struct {
	ID       uint64
	Distance float64
	TimeUs   uint64
	Cells    [3]string
}
type Config struct {
	CoinWeight, ObstacleWeight, HeartWeight, EmptyWeight       float64
	CoinSize, ObstacleH, HeartSize, CarHeight, CarBottomMargin float64
}

func New(seed uint32) (*Generator, error) {
	if seed == 0 {
		return nil, fmt.Errorf("seed must be a nonzero uint32")
	}
	return &Generator{State: seed, NextID: 1}, nil
}
func (g *Generator) Draw() uint32 {
	x := g.State
	x ^= x << 13
	x ^= x >> 17
	x ^= x << 5
	g.State = x
	return x
}

// Append consumes exactly two draws, including empty opportunities: lane, type.
func (g *Generator) Append(progress float64, timeUs uint64, c Config) (Slice, error) {
	if g.NextID > 9007199254740991 {
		return Slice{}, fmt.Errorf("object identity exhausted")
	}
	lane := int(float64(g.Draw()) / 4294967296 * 3)
	total := c.CoinWeight + c.ObstacleWeight + c.HeartWeight + c.EmptyWeight
	selection := float64(g.Draw()) / 4294967296 * total
	cell, size := "empty", c.CoinSize
	if selection < c.CoinWeight {
		cell = "coin"
	} else if selection < c.CoinWeight+c.ObstacleWeight {
		cell, size = "obstacle", c.ObstacleH
	} else if selection < c.CoinWeight+c.ObstacleWeight+c.HeartWeight {
		cell, size = "heart", c.HeartSize
	}
	slice := Slice{ID: g.NextID, TimeUs: timeUs, Distance: progress + 806 - c.CarBottomMargin - c.CarHeight/2 + size/2, Cells: [3]string{"empty", "empty", "empty"}}
	slice.Cells[lane] = cell
	g.NextID++
	return slice, nil
}
