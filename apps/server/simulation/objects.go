package simulation

import (
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/track"
	"math"
	"sort"
)

type objectContact struct {
	object protocol.ObjectState
	seat   uint8
	timeUs uint64
}

func (e *Engine) objects(placements track.PlacementState) []protocol.ObjectState {
	objects := []protocol.ObjectState{}
	for _, slice := range placements.Slices {
		for lane, kind := range slice.Cells {
			flag := uint8(0)
			switch kind {
			case "coin":
				flag = 1
			case "obstacle":
				flag = 2
			case "heart":
				flag = 3
			}
			if flag == 0 {
				continue
			}
			id := uint32(slice.ID)*3 + uint32(lane) + 1
			objects = append(objects, protocol.ObjectState{Id: id, SliceId: uint32(slice.ID), Lane: uint8(lane), Distance: slice.Distance, Flags: flag | e.consumption[id]})
		}
	}
	return objects
}

// Intersect monotone longitudinal overlap with linear lateral overlap. Integrated
// speed bisection preserves chronological contacts under configured acceleration.
func (e *Engine) objectContacts(start, end float64) []objectContact {
	contacts := []objectContact{}
	if e.context.Mode != 1 {
		return contacts
	}
	g := e.context.Gameplay
	for _, object := range e.Snapshot().Objects {
		for seat, car := range e.state.Cars {
			kind := object.Flags & 3
			spent := uint8(4)
			if kind == 2 {
				spent = 8 << seat
			}
			if object.Flags&spent != 0 {
				continue
			}
			width, height := g.HeartSize, g.HeartSize
			if kind == 1 {
				width = g.CoinSize
				height = g.CoinSize
			}
			if kind == 2 {
				width = g.ObstacleW
				height = g.ObstacleH
			}
			lateralExtent, forwardExtent := (g.CarWidth+width)/2, (g.CarHeight+height)/2
			center := (float64(object.Lane) - 1) * g.LaneSpacing
			multiplier := e.multiplier(seat)
			progress := func(at float64) float64 { return car.Progress + forwardDistance(g, start, at-start)*multiplier }
			if progress(end) <= object.Distance-forwardExtent || car.Progress >= object.Distance+forwardExtent {
				continue
			}
			entry, exit := start, end
			if car.Progress <= object.Distance-forwardExtent {
				low, high := start, end
				for n := 0; n < 52; n++ {
					middle := low + (high-low)/2
					if progress(middle) <= object.Distance-forwardExtent {
						low = middle
					} else {
						high = middle
					}
				}
				entry = high
			}
			if progress(end) >= object.Distance+forwardExtent {
				low, high := start, end
				for n := 0; n < 52; n++ {
					middle := low + (high-low)/2
					if progress(middle) < object.Distance+forwardExtent {
						low = middle
					} else {
						high = middle
					}
				}
				exit = high
			}
			speed := 0.0
			if car.Phase != 0 {
				speed = (car.MovementTarget - car.MovementOrigin) * 1e6 / float64(car.MovementEndUs-car.MovementStartUs)
			}
			if speed == 0 {
				if math.Abs(car.Lateral-center) >= lateralExtent {
					continue
				}
			} else {
				a := start + (center-lateralExtent-car.Lateral)/speed
				b := start + (center+lateralExtent-car.Lateral)/speed
				entry = math.Max(entry, math.Min(a, b))
				exit = math.Min(exit, math.Max(a, b))
			}
			if entry < exit {
				timeUs, _ := CanonicalTime(entry)
				contacts = append(contacts, objectContact{object, uint8(seat), timeUs})
			}
		}
	}
	sort.Slice(contacts, func(i, j int) bool {
		a, b := contacts[i], contacts[j]
		if a.timeUs != b.timeUs {
			return a.timeUs < b.timeUs
		}
		if a.object.Id != b.object.Id {
			return a.object.Id < b.object.Id
		}
		return a.seat < b.seat
	})
	return contacts
}
func (e *Engine) resolveObjects(contacts []objectContact, events *[]Observation, timeUs uint64) {
	g := e.context.Gameplay
	objects := []protocol.ObjectState{}
	damage := [2]uint64{}
	for i := 0; i < len(contacts) && contacts[i].timeUs == timeUs; {
		object := contacts[i].object
		seats := []uint8{}
		for i < len(contacts) && contacts[i].timeUs == timeUs && contacts[i].object.Id == object.Id {
			seats = append(seats, contacts[i].seat)
			i++
		}
		kind := object.Flags & 3
		if kind == 2 {
			for _, seat := range seats {
				object.Flags |= 8 << seat
				damage[seat] += uint64(g.ObstacleDamage)
			}
		} else {
			object.Flags |= 4
			if len(seats) == 1 {
				car := &e.state.Cars[seats[0]]
				if kind == 3 {
					car.Hp = min(uint32(g.MaxHealth), car.Hp+1)
				} else {
					car.Score += 10
				}
			}
		}
		e.consumption[object.Id] = object.Flags & 28
		objects = append(objects, object)
	}
	for seat := range e.state.Cars {
		car := &e.state.Cars[seat]
		car.Hp = uint32(max(0, int64(car.Hp)-int64(damage[seat])))
	}
	*events = append(*events, Observation{Type: "objects", Tick: e.state.Tick, TimeUs: timeUs, Cars: e.state.Cars, Objects: objects})
}
