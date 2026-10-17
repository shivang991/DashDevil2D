// Run from apps/server: go run ../../docs/preservation/evidence/finality/cross-tick-probe.go
package main

import (
	"encoding/json"
	"fmt"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
	"os"
)

func main() {
	definition, err := os.ReadFile("../../packages/contracts/configuration/defaults.json")
	if err != nil {
		panic(err)
	}
	cfg, err := configuration.Capture(definition, "drag-race", []byte(`{"gameplay":{"finishDistance":400,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1}}`))
	if err != nil {
		panic(err)
	}
	ids := [2]protocol.Identity{{RoomId: 1, SeatSession: 1, PairGeneration: 1, Seat: 0}, {RoomId: 1, SeatSession: 2, PairGeneration: 1, Seat: 1}}
	game, err := simulation.New(cfg, 1, ids, 1)
	if err != nil {
		panic(err)
	}
	cars := game.Snapshot().Cars
	cars[0].Progress = 353.33336
	cars[1].Progress = 353.33328
	game.Restore(cars, 0)
	if _, err = game.AdvanceTo(1); err != nil {
		panic(err)
	}
	actual := game.Snapshot().Finish
	expected := simulation.Finish{Tick: 2, TimeUs: 16667, Result: 2}
	body, _ := json.Marshal(map[string]any{"actual": actual, "expected": expected, "seed": 1, "crossingsUs": []float64{16666.6, 16666.8}, "tickBoundaryUs": 1000000.0 / 60})
	fmt.Println(string(body))
	if actual == nil || *actual != expected {
		os.Exit(1)
	}
}
