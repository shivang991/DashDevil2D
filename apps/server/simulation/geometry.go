package simulation

import "math"

// Bounds are axis-aligned world extents; visual tilt never enters geometry.
type Bounds struct {
	Left   float64 `json:"left"`
	Right  float64 `json:"right"`
	Top    float64 `json:"top"`
	Bottom float64 `json:"bottom"`
}

func Overlaps(a, b Bounds) bool {
	return a.Right > b.Left && a.Left < b.Right && a.Bottom > b.Top && a.Top < b.Bottom
}

// FirstContact returns the boundary preceding strict overlap along a linear path.
// Player edge blocking is a separate policy, introduced with contact resolution.
func FirstContact(a0, a1, b0, b1 Bounds) (float64, bool) {
	entry, exit := 0.0, 1.0
	for _, axis := range [][2]float64{{a0.Right - b0.Left, a1.Right - b1.Left}, {b0.Right - a0.Left, b1.Right - a1.Left}, {a0.Bottom - b0.Top, a1.Bottom - b1.Top}, {b0.Bottom - a0.Top, b1.Bottom - a1.Top}} {
		start, end := axis[0], axis[1]
		change := end - start
		if change == 0 {
			if start <= 0 {
				return 0, false
			}
		} else if change > 0 {
			entry = math.Max(entry, -start/change)
		} else {
			exit = math.Min(exit, -start/change)
		}
	}
	return entry, entry < exit && exit > 0 && entry < 1
}
