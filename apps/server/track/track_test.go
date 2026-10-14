package track

import (
	"encoding/json"
	"math"
	"os"
	"testing"
)

func TestSharedTrackFixtures(t *testing.T) {
	var fixture struct {
		Seed          uint32
		Words         []uint32
		Opportunities []struct {
			Progress float64
			TimeUs   uint64
			ID       uint64
			Distance float64
			Cells    [3]string
		}
		Precision struct{ Absolute, Relative float64 }
	}
	data, err := os.ReadFile("../../../packages/contracts/track/fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	generator, _ := New(fixture.Seed)
	for _, expected := range fixture.Words {
		if actual := generator.Draw(); actual != expected {
			t.Fatalf("word got %08x want %08x", actual, expected)
		}
	}
	var defaults struct {
		Gameplay     map[string]struct{ CoinWeight, ObstacleWeight, HeartWeight, EmptyWeight, CoinSize, ObstacleH, HeartSize, CarHeight float64 }
		Presentation struct{ CarBottomMargin float64 }
	}
	data, err = os.ReadFile("../../../packages/contracts/configuration/defaults.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, &defaults); err != nil {
		t.Fatal(err)
	}
	c := defaults.Gameplay["long-drive"]
	config := Config{c.CoinWeight, c.ObstacleWeight, c.HeartWeight, c.EmptyWeight, c.CoinSize, c.ObstacleH, c.HeartSize, c.CarHeight, defaults.Presentation.CarBottomMargin}
	generator, _ = New(fixture.Seed)
	for _, expected := range fixture.Opportunities {
		actual, err := generator.Append(expected.Progress, expected.TimeUs, config)
		if err != nil {
			t.Fatal(err)
		}
		if actual.ID != expected.ID || actual.TimeUs != expected.TimeUs || actual.Cells != expected.Cells {
			t.Fatalf("slice got %+v want %+v", actual, expected)
		}
		if math.Abs(actual.Distance-expected.Distance) > fixture.Precision.Absolute+fixture.Precision.Relative*math.Abs(expected.Distance) {
			t.Fatalf("distance got %.17g want %.17g", actual.Distance, expected.Distance)
		}
	}
	if _, err := New(0); err == nil {
		t.Fatal("zero seed accepted")
	}
}
