package simulation

import (
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"math"
)

// Restrictions derive from world rectangles. The guard absorbs floating roundoff.
func (e *Engine) tailgating(seat int) bool {
	a, b, g := e.state.Cars[seat], e.state.Cars[1-seat], e.context.Gameplay
	return b.Progress > a.Progress && b.Progress-a.Progress <= g.CarHeight+1e-8 && math.Abs(a.Lateral-b.Lateral) < g.CarWidth-1e-8
}
func (e *Engine) multiplier(seat int) float64 {
	requested := [2]float64{1, 1}
	for i, car := range e.state.Cars {
		if car.Flags&1 != 0 {
			requested[i] = e.context.Gameplay.AccelSpeedMultiplier
		}
	}
	if e.tailgating(seat) {
		return math.Min(requested[seat], requested[1-seat])
	}
	return requested[seat]
}
func rawLateralSpeed(car protocol.Car) float64 {
	if car.Phase == 0 {
		return 0
	}
	return (car.MovementTarget - car.MovementOrigin) * 1e6 / float64(car.MovementEndUs-car.MovementStartUs)
}

// Release a follower at sideways clearance inside a tick.
func (e *Engine) clearance(start, end float64) float64 {
	// Release a blocked return exactly at swept longitudinal clearance.
	for seat := range e.state.Cars {
		if e.lateralBlocked(seat) {
			y := e.state.Cars[seat].Progress - e.state.Cars[1-seat].Progress
			m := e.multiplier(seat) - e.multiplier(1-seat)
			extent := e.context.Gameplay.CarHeight
			at := func(time float64) float64 { return y + forwardDistance(e.context.Gameplay, start, time-start)*m }
			if m != 0 && math.Abs(at(end)) >= extent {
				low, high := start, end
				for n := 0; n < 52; n++ {
					mid := low + (high-low)/2
					if math.Abs(at(mid)) < extent {
						low = mid
					} else {
						high = mid
					}
				}
				if high > start+1e-12 {
					end = math.Min(end, high)
				}
			}
		}
	}

	for seat := range e.state.Cars {
		if e.tailgating(seat) {
			a, b := e.state.Cars[seat], e.state.Cars[1-seat]
			x, v := a.Lateral-b.Lateral, e.lateralSpeed(seat)-e.lateralSpeed(1-seat)
			if v != 0 {
				sign := 1.0
				if v < 0 {
					sign = -1
				}
				at := start + (sign*e.context.Gameplay.CarWidth-x)/v
				if at > start+1e-12 {
					end = math.Min(end, at)
				}
			}
		}
	}
	return end
}

// Intersect linear lateral overlap and monotone integrated relative progress.
// Touching while separating does not create a new collision.
func (e *Engine) playerContact(start, end float64) float64 {
	a, b, g := e.state.Cars[0], e.state.Cars[1], e.context.Gameplay
	e.refreshContact()
	if e.state.Contact.Flags&1 != 0 {
		return math.Inf(1)
	}
	if a.Phase != 1 && b.Phase != 1 && math.Abs(a.Lateral-b.Lateral) < g.CarWidth && math.Abs(a.Progress-b.Progress) < g.CarHeight-1e-8 {
		return math.Inf(1)
	}
	entry, exit := start, end
	x, vx := a.Lateral-b.Lateral, e.lateralSpeed(0)-e.lateralSpeed(1)
	y, m := a.Progress-b.Progress, e.multiplier(0)-e.multiplier(1)
	// Test requested motion before the follower constraint hides a shifting impact.
	if (a.Phase == 1 && a.Progress < b.Progress) || (b.Phase == 1 && b.Progress < a.Progress) {
		requested := func(car protocol.Car) float64 {
			if car.Flags&1 != 0 {
				return g.AccelSpeedMultiplier
			}
			return 1
		}
		m = requested(a) - requested(b)
	}
	if vx == 0 {
		if math.Abs(x) >= g.CarWidth-1e-8 {
			return math.Inf(1)
		}
	} else {
		t1, t2 := start+(-g.CarWidth-x)/vx, start+(g.CarWidth-x)/vx
		entry = math.Max(entry, math.Min(t1, t2))
		exit = math.Min(exit, math.Max(t1, t2))
	}
	at := func(t float64) float64 { return y + forwardDistance(g, start, t-start)*m }
	if m == 0 {
		if math.Abs(y) >= g.CarHeight-1e-8 {
			return math.Inf(1)
		}
	} else {
		root := func(target float64) float64 {
			if (m > 0 && y >= target) || (m < 0 && y <= target) {
				return start
			}
			if (m > 0 && at(end) < target) || (m < 0 && at(end) > target) {
				return end
			}
			low, high := start, end
			for n := 0; n < 52; n++ {
				mid := low + (high-low)/2
				if (m > 0 && at(mid) < target) || (m < 0 && at(mid) > target) {
					low = mid
				} else {
					high = mid
				}
			}
			return high
		}
		if m > 0 {
			if y >= g.CarHeight-1e-8 || at(end) < -g.CarHeight {
				return math.Inf(1)
			}
			entry = math.Max(entry, root(-g.CarHeight))
			exit = math.Min(exit, root(g.CarHeight))
		} else {
			if y <= -g.CarHeight+1e-8 || at(end) > g.CarHeight {
				return math.Inf(1)
			}
			entry = math.Max(entry, root(g.CarHeight))
			exit = math.Min(exit, root(-g.CarHeight))
		}
	}
	if entry < exit-1e-12 {
		return entry
	}
	return math.Inf(1)
}
func (e *Engine) resolvePlayers(time float64, events *[]Observation) {
	timeUs, _ := CanonicalTime(time)
	g := e.context.Gameplay
	phases := [2]uint8{e.state.Cars[0].Phase, e.state.Cars[1].Phase}
	e.state.Contact.Episode++
	e.state.Contact.Flags = 3
	if e.context.Mode == 2 && !(phases[0] == 1 && phases[1] == 1) && (phases[0] != 0 || phases[1] != 0) && e.state.LatestPress != nil && e.group != nil {
		e.group.damage[1-e.state.LatestPress.Seat] = uint64(g.PlayerContactDamage)
	}
	for seat := range e.state.Cars {
		car := &e.state.Cars[seat]
		if car.Phase == 1 {
			car.Phase = 2
			car.Target = car.Departure
			car.MovementOrigin = car.Lateral
			car.MovementTarget = (float64(car.Departure) - 1) * g.LaneSpacing
			car.MovementStartUs = timeUs
			duration, _ := CanonicalTime(g.LaneReturnDuration)
			car.MovementEndUs = timeUs + duration
			clear(car)
		}
	}
	e.refreshContact()
	*events = append(*events, Observation{Contact: e.state.Contact, Type: "contact", Tick: e.state.Tick, TimeUs: timeUs, Cars: e.state.Cars})
}

// A blocked return pauses its remaining travel, preserving departure and fraction.
func (e *Engine) lateralBlocked(seat int) bool {
	a, b, g := e.state.Cars[seat], e.state.Cars[1-seat], e.context.Gameplay
	x := a.Lateral - b.Lateral
	return e.state.Contact.Flags&1 != 0 && a.Phase == 2 && math.Abs(a.Progress-b.Progress) < g.CarHeight-1e-8 && math.Abs(x) <= g.CarWidth+1e-8 && x*rawLateralSpeed(a) < 0 && x*(rawLateralSpeed(a)-rawLateralSpeed(b)) < 0
}
func (e *Engine) lateralSpeed(seat int) float64 {
	if e.lateralBlocked(seat) {
		return 0
	}
	return rawLateralSpeed(e.state.Cars[seat])
}

func (e *Engine) refreshContact() {
	a, b, g := e.state.Cars[0], e.state.Cars[1], e.context.Gameplay
	if math.Abs(a.Lateral-b.Lateral) > g.CarWidth+1e-8 || math.Abs(a.Progress-b.Progress) > g.CarHeight+1e-8 {
		e.state.Contact.Flags = 0
	}
	e.state.Contact.Flags = e.state.Contact.Flags & 3
	if e.tailgating(0) || e.tailgating(1) {
		e.state.Contact.Flags |= 4
	}
	e.state.Contact.BlockedSeat = 0
	if e.tailgating(0) || e.lateralBlocked(0) {
		e.state.Contact.BlockedSeat = 1
	} else if e.tailgating(1) || e.lateralBlocked(1) {
		e.state.Contact.BlockedSeat = 2
	}

}
