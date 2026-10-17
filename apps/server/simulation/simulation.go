// Package simulation owns serialized multiplayer mechanics, without transport or presentation.
package simulation

import (
	"fmt"
	"math"
	"sort"

	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/track"
)

type Observation struct {
	Objects     []protocol.ObjectState `json:"objects,omitempty"`
	Cars        [2]protocol.Car        `json:"-"`
	Car         *protocol.Car          `json:"car,omitempty"`
	Type        string                 `json:"type"`
	Tick        uint32                 `json:"tick"`
	TimeUs      uint64                 `json:"timeUs"`
	Seat        *uint8                 `json:"seat,omitempty"`
	Sequence    *uint32                `json:"sequence,omitempty"`
	Disposition string                 `json:"disposition,omitempty"`
}
type Press struct {
	Seat     uint8  `json:"seat"`
	Control  uint8  `json:"control"`
	Sequence uint32 `json:"sequence"`
	TimeUs   uint64 `json:"timeUs"`
	Order    uint32 `json:"order"`
}
type Finish struct {
	Reason uint8  `json:"-"`
	Tick   uint32 `json:"tick"`
	TimeUs uint64 `json:"timeUs"`
	Result uint8  `json:"result"`
}
type State struct {
	Objects     []protocol.ObjectState `json:"objects"`
	Finish      *Finish                `json:"finish,omitempty"`
	Track       track.PlacementState   `json:"track"`
	Tick        uint32                 `json:"tick"`
	TimeUs      uint64                 `json:"timeUs"`
	Abandoned   bool                   `json:"abandoned"`
	Cars        [2]protocol.Car        `json:"cars"`
	LatestPress *Press                 `json:"latestPress"`
}
type physicalSegment struct {
	start, end  float64
	cars        [2]protocol.Car
	multipliers [2]float64
}
type eventGroup struct {
	sampleTime float64
	timeUs     uint64
	contacts   []objectContact
	finishMask uint8
	sample     [2]protocol.Car
	hasSample  bool
}
type queued struct {
	seat  uint8
	input protocol.Input
	valid bool
}

// Engine is owned by one round coordinator. No method may run concurrently.
type seatReset struct {
	identity             protocol.Identity
	generation, sequence uint32
}
type Engine struct {
	segments    []physicalSegment
	frozen      *State
	resets      [2]*seatReset
	group       *eventGroup
	committed   *State
	held        []Observation
	consumption map[uint32]uint8
	tracks      [2]*track.Multiplayer
	context     protocol.Context
	identities  [2]protocol.Identity
	roundID     uint32
	state       State
	wallTime    float64
	pending     []queued
	releases    []Observation
	sequences   [2]uint32
	tokens      [2]float64
	connected   [2]bool
	order       uint32
}

func CanonicalTime(seconds float64) (uint64, error) {
	value := math.Floor(float64(seconds*1e6) + .5)
	if math.IsNaN(seconds) || math.IsInf(seconds, 0) || seconds < 0 || value > 9007199254740991 {
		return 0, fmt.Errorf("unrepresentable round time")
	}
	return uint64(value), nil
}
func New(config configuration.Configuration, seed uint32, identities [2]protocol.Identity, roundID uint32) (*Engine, error) {
	if seed == 0 || roundID == 0 {
		return nil, fmt.Errorf("invalid seed/round identity")
	}
	for seat, id := range identities {
		if int(id.Seat) != seat || id.RoomId == 0 || id.SeatSession == 0 || id.PairGeneration == 0 {
			return nil, fmt.Errorf("invalid seat identity")
		}
	}
	context := config.Context(seed)
	if context.Mode != 1 && context.Mode != 2 {
		return nil, fmt.Errorf("multiplayer mode required")
	}
	e := &Engine{consumption: map[uint32]uint8{}, context: context, identities: identities, roundID: roundID, connected: [2]bool{true, true}, tokens: [2]float64{context.Connection.InputBurst, context.Connection.InputBurst}}
	for seat, lane := range []uint8{0, 2} {
		lateral := (float64(lane) - 1) * context.Gameplay.LaneSpacing
		e.state.Cars[seat] = protocol.Car{Lane: lane, Departure: lane, Target: lane, Lateral: lateral, MovementOrigin: lateral, MovementTarget: lateral, NormalSpeed: context.Gameplay.StartingRoadSpeed, Hp: uint32(context.Gameplay.MaxHealth), InputGeneration: 1}
	}
	e.tracks[0], _ = track.NewMultiplayer(context)
	e.tracks[1], _ = track.NewMultiplayer(context)
	if err := e.updateTrack(); err != nil {
		return nil, err
	}
	return e, nil
}
func cloneState(state State) State {
	if state.Finish != nil {
		copy := *state.Finish
		state.Finish = &copy
	}
	if state.LatestPress != nil {
		copy := *state.LatestPress
		state.LatestPress = &copy
	}
	state.Objects = append([]protocol.ObjectState{}, state.Objects...)
	state.Track.Slices = append([]track.Slice{}, state.Track.Slices...)
	return state
}
func (e *Engine) Snapshot() State {
	if e.frozen != nil {
		return cloneState(*e.frozen)
	}
	if e.committed != nil {
		return cloneState(*e.committed)
	}
	return e.currentSnapshot()
}
func (e *Engine) currentSnapshot() State {
	result := e.state
	if result.Finish != nil {
		copy := *result.Finish
		result.Finish = &copy
	}
	states := [2]track.PlacementState{e.tracks[0].Snapshot(), e.tracks[1].Snapshot()}
	result.Track = states[0]
	if states[1].Through > states[0].Through {
		result.Track = states[1]
	}
	slices := map[uint64]track.Slice{}
	for _, state := range states {
		for _, slice := range state.Slices {
			slices[slice.ID] = slice
		}
	}
	result.Track.Slices = []track.Slice{}
	for _, slice := range slices {
		result.Track.Slices = append(result.Track.Slices, slice)
	}
	sort.Slice(result.Track.Slices, func(i, j int) bool { return result.Track.Slices[i].ID < result.Track.Slices[j].ID })
	if result.LatestPress != nil {
		copy := *result.LatestPress
		result.LatestPress = &copy
	}
	result.Objects = e.objects(result.Track)
	return result
}
func (e *Engine) Submit(auth protocol.Identity, input protocol.Input) (bool, error) {
	seat := auth.Seat
	if seat > 1 || e.identities[seat] != auth || e.state.Finish != nil || e.state.Abandoned {
		return false, nil
	}
	if e.tokens[seat] < 1 || len(e.pending) >= int(2*e.context.Connection.InputBurst) {
		return false, fmt.Errorf("input rate/queue exceeded; recover connection")
	}
	e.tokens[seat]--
	valid := e.connected[seat] && !e.state.Abandoned && input.Identity == auth && input.Round.RoundId == e.roundID && input.Round.InputGeneration == e.state.Cars[seat].InputGeneration && uint64(input.Sequence) == uint64(e.sequences[seat])+1
	if err := protocol.ValidateMessage(input, e.context); err != nil {
		valid = false
	}
	if valid {
		e.sequences[seat] = input.Sequence
	}
	e.pending = append(e.pending, queued{seat, input, valid})
	return valid, nil
}
func (e *Engine) updateTrack() error {
	g := e.context.Gameplay
	extent := (g.CarHeight + math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize))) / 2
	// Retain complete placements for transport reconstruction headroom.
	for seat, placements := range e.tracks {
		if err := placements.EnsureThrough(e.state.Cars[seat].Progress + g.MaxRoadSpeed*g.AccelSpeedMultiplier + extent + g.MaxRoadSpeed*g.AccelSpeedMultiplier/g.TickRate); err != nil {
			return err
		}
		placements.RetireBehind(e.state.Cars[seat].Progress - g.CarHeight/2 - g.MaxRoadSpeed*g.AccelSpeedMultiplier/g.TickRate)
	}
	return nil
}
func clear(car *protocol.Car) {
	car.Controls = 0
	car.Effective = 0
	car.HeldMask = 0
	car.Flags = 0
	car.FreshnessUs = 0
}
func (e *Engine) event(kind string, seat uint8, timeUs uint64) Observation {
	copy := seat
	car := e.state.Cars[seat]
	return Observation{Type: kind, Tick: e.state.Tick, TimeUs: timeUs, Seat: &copy, Car: &car, Cars: e.state.Cars}
}
func (e *Engine) Disconnect(auth protocol.Identity) {
	seat := auth.Seat
	if seat > 1 || e.identities[seat] != auth || e.state.Abandoned || e.state.Finish != nil {
		return
	}
	e.connected[seat] = false
	clear(&e.state.Cars[seat])
	for i := range e.pending {
		if e.pending[i].seat == seat {
			e.pending[i].valid = false
		}
	}
	e.releases = append(e.releases, e.event("release", seat, e.state.TimeUs))
}
func (e *Engine) shift(car *protocol.Car, seat uint8, timeUs uint64, events *[]Observation) {
	g := e.context.Gameplay
	if e.tailgating(int(seat)) || car.Phase != 0 || (car.Effective != 1 && car.Effective != 2) || timeUs < car.NextShiftUs {
		return
	}
	delta := 1
	if car.Effective == 1 {
		delta = -1
	}
	target := max(0, min(2, int(car.Lane)+delta))
	if target == int(car.Lane) {
		return
	}
	car.Phase = 1
	car.Departure = car.Lane
	car.Target = uint8(target)
	car.MovementOrigin = car.Lateral
	car.MovementTarget = (float64(target) - 1) * g.LaneSpacing
	car.MovementStartUs = timeUs
	duration, _ := CanonicalTime(g.LaneShiftDuration)
	repeat, _ := CanonicalTime(g.LaneSwitchCooldownDuration)
	car.MovementEndUs = timeUs + duration
	car.NextShiftUs = timeUs + repeat
	*events = append(*events, e.event("shift", seat, timeUs))
}
func (e *Engine) boundaries(timeUs uint64, events *[]Observation) {
	for seat := range e.state.Cars {
		car := &e.state.Cars[seat]
		if car.Effective != 0 && car.FreshnessUs <= timeUs {
			clear(car)
			*events = append(*events, e.event("expiry", uint8(seat), timeUs))
		}
		if car.Phase != 0 && car.MovementEndUs <= timeUs {
			car.Lateral = car.MovementTarget
			car.Lane = car.Target
			car.Phase = 0
			*events = append(*events, e.event("shift-end", uint8(seat), timeUs))
		}
	}
}
func (e *Engine) apply(timeUs uint64, events *[]Observation) {
	sort.SliceStable(e.pending, func(i, j int) bool { return e.pending[i].seat < e.pending[j].seat })
	for _, q := range e.pending {
		car := &e.state.Cars[q.seat]
		input := q.input
		disposition := "rejected"
		if q.valid {
			disposition = "accepted"
			car.LastInput = input.Sequence
			switch input.Intent {
			case 0:
				if input.Control == 0 || car.HeldMask&(1<<(input.Control-1)) != 0 || car.Phase == 2 {
					disposition = "ignored"
				} else {
					car.HeldMask |= 1 << (input.Control - 1)
					car.Controls = input.Control
					car.Effective = input.Control
					car.Flags = 0
					if input.Control == 3 {
						car.Flags = 1
					}
					expiry, _ := CanonicalTime(e.context.Connection.ControlFreshnessExpiry)
					car.FreshnessUs = timeUs + expiry
					if e.context.Mode == 2 {
						e.order++
						e.state.LatestPress = &Press{q.seat, input.Control, input.Sequence, timeUs, e.order}
					}
				}
			case 1:
				if input.Control == 0 {
					clear(car)
				} else {
					car.HeldMask &^= 1 << (input.Control - 1)
					if car.Controls == input.Control {
						car.Controls = 0
						car.Effective = 0
						car.Flags = 0
						car.FreshnessUs = 0
					}
				}
			case 2:
				if car.Effective == 0 || input.Control != car.Controls || input.HeldMask != car.HeldMask {
					disposition = "ignored"
				} else {
					expiry, _ := CanonicalTime(e.context.Connection.ControlFreshnessExpiry)
					car.FreshnessUs = timeUs + expiry
				}
			}
		}
		event := e.event("input", q.seat, timeUs)
		sequence := input.Sequence
		event.Sequence = &sequence
		event.Disposition = disposition
		*events = append(*events, event)
		if disposition == "accepted" {
			e.shift(car, q.seat, timeUs, events)
		}
	}
	e.pending = nil
}
func (e *Engine) AdvanceTo(seconds float64) ([]Observation, error) {
	return e.advance(seconds, false)
}

// StopAt resolves gameplay through an exact maintenance boundary, including a
// partial final tick, then abandons only if gameplay did not already end it.
// It is terminal; future advancement cannot replay the partial tick.
func (e *Engine) StopAt(seconds float64) ([]Observation, error) {
	events, err := e.advance(seconds, true)
	if err == nil && e.state.Finish == nil && !e.state.Abandoned {
		e.state.Abandoned = true
		e.pending = nil
		events = append(events, Observation{Type: "maintenance", Tick: e.state.Tick, TimeUs: e.state.TimeUs})
		for seat := range e.state.Cars {
			clear(&e.state.Cars[seat])
		}
	}
	return events, err
}
func (e *Engine) PendingGroup() bool { return e.committed != nil }

func (e *Engine) move(start, end float64) {
	g := e.context.Gameplay
	multipliers := [2]float64{e.multiplier(0), e.multiplier(1)}
	retained := e.segments[:0]
	for _, segment := range e.segments {
		if segment.end >= start-.000002 {
			retained = append(retained, segment)
		}
	}
	e.segments = retained
	if len(e.segments) >= 1024 {
		panic("physical segment history exceeded")
	}
	e.segments = append(e.segments, physicalSegment{start, end, e.state.Cars, multipliers})
	for seat := range e.state.Cars {
		car := &e.state.Cars[seat]
		distance := forwardDistance(g, start, end-start)
		car.Progress = car.Progress + float64(distance*multipliers[seat])
		car.NormalSpeed = math.Min(g.MaxRoadSpeed, g.StartingRoadSpeed+float64(g.SpeedGrowth*end))
		if car.Phase != 0 {
			fraction := math.Max(0, math.Min(1, (float64(end*1e6)-float64(car.MovementStartUs))/float64(car.MovementEndUs-car.MovementStartUs)))
			car.Lateral = car.MovementOrigin + float64((car.MovementTarget-car.MovementOrigin)*fraction)
		}
	}
}

type crossing struct {
	seat   int
	time   float64
	timeUs uint64
}

func (e *Engine) crossings(start, end float64) []crossing {
	result := []crossing{}
	g := e.context.Gameplay
	for seat, car := range e.state.Cars {
		if e.group != nil && e.group.finishMask&(1<<seat) != 0 {
			continue
		}
		remaining := g.FinishDistance - g.CarHeight/2 - car.Progress
		multiplier := e.multiplier(seat)
		if forwardDistance(g, start, end-start)*multiplier < remaining {
			continue
		}
		low, high := start, end
		for n := 0; n < 52; n++ {
			middle := low + (high-low)/2
			if forwardDistance(g, start, middle-start)*multiplier < remaining {
				low = middle
			} else {
				high = middle
			}
		}
		us, _ := CanonicalTime(high)
		result = append(result, crossing{seat, high, us})
	}
	return result
}
func (e *Engine) advance(seconds float64, stopping bool) ([]Observation, error) {
	stopUs, err := CanonicalTime(seconds)
	if err != nil {
		return nil, err
	}
	if seconds < e.wallTime {
		return nil, fmt.Errorf("monotonic clock moved backwards")
	}
	if e.state.Abandoned || e.state.Finish != nil {
		return []Observation{}, nil
	}
	for seat, tokens := range e.tokens {
		e.tokens[seat] = math.Min(e.context.Connection.InputBurst, tokens+float64((seconds-e.wallTime)*e.context.Connection.InputRate))
	}
	e.wallTime = seconds
	g := e.context.Gameplay
	events := append(append([]Observation{}, e.held...), e.releases...)
	e.held = nil
	e.releases = nil
	withheldStart := -1
	if e.committed != nil {
		withheldStart = 0
	}
	if seconds-float64(e.state.Tick)/g.TickRate > e.context.Operational.SimulationLagThreshold {
		hadPending := e.committed != nil
		if e.committed != nil {
			e.state = cloneState(*e.committed)
		}
		e.state.Abandoned = true
		e.pending = nil
		e.group = nil
		e.committed = nil
		for seat := range e.state.Cars {
			clear(&e.state.Cars[seat])
		}
		if hadPending {
			copy := cloneState(e.state)
			e.frozen = &copy
		}
		return []Observation{{Type: "abandoned", Tick: e.state.Tick, TimeUs: e.state.TimeUs}}, nil
	}
	if err := e.updateTrack(); err != nil {
		return nil, err
	}
	limit := (float64(stopUs) + .5) / 1e6
	var stopPositions [2]protocol.Car
	sampledStop := false
	for float64(uint64(e.state.Tick)+1)/g.TickRate <= seconds || stopping && float64(e.state.Tick)/g.TickRate < limit {
		if e.state.Tick == math.MaxUint32 {
			return nil, fmt.Errorf("tick exhausted")
		}
		before := e.currentSnapshot()
		eventStart := len(events)
		if e.committed != nil {
			before = cloneState(*e.committed)
			eventStart = 0
		}
		time := float64(e.state.Tick) / g.TickRate
		end := float64(uint64(e.state.Tick)+1) / g.TickRate
		if stopping {
			end = math.Min(end, limit)
		}
		e.boundaries(uint64(math.Floor(time*1e6)), &events)
		applicationUs, _ := CanonicalTime(time)
		e.apply(applicationUs, &events)
		for time < end {
			for seat := range e.state.Cars {
				e.shift(&e.state.Cars[seat], uint8(seat), uint64(math.Floor(time*1e6)), &events)
			}
			if stopping && !sampledStop && time >= seconds {
				stopPositions = e.state.Cars
				sampledStop = true
			}
			next := end
			for _, car := range e.state.Cars {
				if car.Effective != 0 && float64(car.FreshnessUs)/1e6 > time {
					next = math.Min(next, float64(car.FreshnessUs)/1e6)
				}
				if car.Phase != 0 && float64(car.MovementEndUs)/1e6 > time {
					next = math.Min(next, float64(car.MovementEndUs)/1e6)
				}
				if car.Phase == 0 && (car.Effective == 1 || car.Effective == 2) && float64(car.NextShiftUs)/1e6 > time {
					next = math.Min(next, float64(car.NextShiftUs)/1e6)
				}
			}
			collision := e.playerContact(time, next)
			next = math.Min(next, collision)
			next = e.clearance(time, next)
			contacts := e.objectContacts(time, next)
			if stopping {
				filtered := contacts[:0]
				for _, contact := range contacts {
					if contact.timeUs <= stopUs {
						filtered = append(filtered, contact)
					}
				}
				contacts = filtered
			}
			finishes := []crossing{}
			if e.context.Mode == 1 {
				finishes = e.crossings(time, next)
				if stopping {
					filtered := finishes[:0]
					for _, finish := range finishes {
						if finish.timeUs <= stopUs {
							filtered = append(filtered, finish)
						}
					}
					finishes = filtered
				}
			}
			if e.group == nil {
				first := uint64(math.MaxUint64)
				if len(contacts) > 0 {
					first = contacts[0].timeUs
				}
				for _, finish := range finishes {
					first = min(first, finish.timeUs)
				}
				if first != math.MaxUint64 {
					boundary := math.Round(float64(first)*g.TickRate/1e6) / g.TickRate
					boundaryUs, _ := CanonicalTime(boundary)
					sampleTime := float64(first) / 1e6
					if boundaryUs == first {
						sampleTime = boundary
					}
					e.group = &eventGroup{timeUs: first, sampleTime: sampleTime}
				}
			}
			group := e.group
			if stopping && !sampledStop && seconds > time {
				next = math.Min(next, seconds)
			}
			if group != nil {
				next = math.Min(next, (float64(group.timeUs)+.5)/1e6)
				center := group.sampleTime
				if !group.hasSample && center > time {
					next = math.Min(next, center)
				}
				if !group.hasSample && center <= time {
					group.sample = e.state.Cars
					sampleStart := time
					multipliers := [2]float64{e.multiplier(0), e.multiplier(1)}
					for _, segment := range e.segments {
						if segment.start <= center && segment.end >= center {
							group.sample, sampleStart, multipliers = segment.cars, segment.start, segment.multipliers
							break
						}
					}
					elapsed := center - sampleStart
					for seat := range group.sample {
						car := &group.sample[seat]
						car.Progress += forwardDistance(g, sampleStart, elapsed) * multipliers[seat]
						car.NormalSpeed = math.Min(g.MaxRoadSpeed, g.StartingRoadSpeed+float64(g.SpeedGrowth*group.sampleTime))
						if car.Phase != 0 {
							fraction := math.Max(0, math.Min(1, (group.sampleTime*1e6-float64(car.MovementStartUs))/float64(car.MovementEndUs-car.MovementStartUs)))
							car.Lateral = car.MovementOrigin + float64((car.MovementTarget-car.MovementOrigin)*fraction)
						}
					}
					group.hasSample = true
				}
				contacts = e.objectContacts(time, next)
				for _, contact := range contacts {
					if contact.timeUs == group.timeUs {
						group.contacts = append(group.contacts, contact)
					}
				}
				if e.context.Mode == 1 {
					for _, finish := range e.crossings(time, next) {
						if finish.timeUs == group.timeUs {
							group.finishMask |= 1 << finish.seat
						}
					}
				}
			}
			e.move(time, next)
			closing := group != nil && next >= (float64(group.timeUs)+.5)/1e6
			nextUs, _ := CanonicalTime(next)
			if (!closing || nextUs == group.timeUs) && (!stopping || nextUs <= stopUs) {
				if math.Abs(next-collision) < 1e-12 {
					e.resolvePlayers(next, &events)
				}
				e.boundaries(uint64(math.Floor(next*1e6)), &events)
			}
			if stopping && !sampledStop && next >= seconds {
				stopPositions = e.state.Cars
				sampledStop = true
			}
			if group != nil && !group.hasSample && next >= group.sampleTime {
				group.sample = e.state.Cars
				group.hasSample = true
			}
			if closing {
				positions := e.state.Cars
				for seat := range e.state.Cars {
					restorePosition(&e.state.Cars[seat], group.sample[seat])
				}
				if len(group.contacts) > 0 {
					sort.SliceStable(group.contacts, func(i, j int) bool {
						a, b := group.contacts[i], group.contacts[j]
						if a.object.Id != b.object.Id {
							return a.object.Id < b.object.Id
						}
						return a.seat < b.seat
					})
					e.resolveObjects(group.contacts, &events, group.timeUs)
				}
				deadMask := uint8(0)
				for seat, car := range e.state.Cars {
					if car.Hp == 0 {
						deadMask |= 1 << seat
					}
				}
				if deadMask != 0 || group.finishMask != 0 {
					result, reason := uint8(2), uint8(0)
					if deadMask != 0 {
						reason = 1
						if deadMask == 1 {
							result = 1
						}
						if deadMask == 2 {
							result = 0
						}
					} else {
						if group.finishMask == 1 {
							result = 0
						}
						if group.finishMask == 2 {
							result = 1
						}
						for seat := range e.state.Cars {
							if group.finishMask&(1<<seat) != 0 {
								e.state.Cars[seat].Progress = g.FinishDistance - g.CarHeight/2
							}
						}
					}
					e.state.Tick = uint32(math.Ceil(float64(group.timeUs) * g.TickRate / 1e6))
					e.state.TimeUs = group.timeUs
					e.state.Finish = &Finish{Tick: e.state.Tick, TimeUs: group.timeUs, Result: result, Reason: reason}
					e.resets = [2]*seatReset{}
					e.group = nil
					e.committed = nil
					return events, nil
				}
				for seat := range e.state.Cars {
					car := &e.state.Cars[seat]
					car.Progress = positions[seat].Progress
					car.Lateral = positions[seat].Lateral
					car.NormalSpeed = positions[seat].NormalSpeed
				}
				e.group = nil
				e.committed = nil
				for seat, reset := range e.resets {
					if reset != nil {
						e.resetSeat(reset.identity, reset.generation, reset.sequence)
						events = append(events, e.event("release", uint8(seat), group.timeUs+1))
						e.resets[seat] = nil
					}
				}
			}
			time = next
		}
		if err := e.updateTrack(); err != nil {
			return nil, err
		}
		e.state.Tick++
		e.state.TimeUs, _ = CanonicalTime(float64(e.state.Tick) / g.TickRate)
		if e.group != nil {
			if e.committed == nil {
				copy := cloneState(before)
				e.committed = &copy
			}
			if withheldStart < 0 {
				withheldStart = eventStart
			}
		}
	}
	if stopping {
		if sampledStop {
			for seat := range e.state.Cars {
				restorePosition(&e.state.Cars[seat], stopPositions[seat])
			}
		}
		e.state.Tick = uint32(math.Ceil(float64(stopUs) * g.TickRate / 1e6))
		e.state.TimeUs = stopUs
	}
	if e.group != nil && e.committed != nil {
		if withheldStart < 0 {
			withheldStart = 0
		}
		e.held = append([]Observation{}, events[withheldStart:]...)
		if len(e.held) > 1024 {
			return nil, fmt.Errorf("uncommitted authority history exhausted")
		}
		events = events[:withheldStart]
	}
	return events, nil
}

// ResetSeat is the authoritative fresh-generation barrier, also used after a
// countdown has discarded keys. It never queues or reactivates those controls.
func (e *Engine) ResetSeat(identity protocol.Identity, generation, sequence uint32) {
	if e.state.Finish != nil || e.state.Abandoned {
		return
	}
	if e.committed != nil {
		e.resets[identity.Seat] = &seatReset{identity, generation, sequence}
		return
	}
	e.resetSeat(identity, generation, sequence)
}
func (e *Engine) resetSeat(identity protocol.Identity, generation, sequence uint32) {
	seat := identity.Seat
	e.identities[seat] = identity
	e.connected[seat] = true
	e.sequences[seat] = sequence
	car := &e.state.Cars[seat]
	clear(car)
	car.InputGeneration = generation
	car.LastInput = sequence
	for i := range e.pending {
		if e.pending[i].seat == seat {
			e.pending[i].valid = false
		}
	}
}
func forwardDistance(g protocol.Gameplay, start, elapsed float64) float64 {
	normal := math.Min(g.MaxRoadSpeed, g.StartingRoadSpeed+float64(g.SpeedGrowth*start))
	ramp := 0.0
	if g.SpeedGrowth != 0 {
		ramp = math.Min(elapsed, math.Max(0, (g.MaxRoadSpeed-normal)/g.SpeedGrowth))
	}
	return float64(normal*ramp) + float64(float64(float64(.5*g.SpeedGrowth)*ramp)*ramp) + float64(math.Min(g.MaxRoadSpeed, normal+float64(g.SpeedGrowth*ramp))*(elapsed-ramp))
}

func (e *Engine) Restore(cars [2]protocol.Car, tick uint32) {
	e.segments = nil
	e.consumption = map[uint32]uint8{}
	e.state.Cars = cars
	e.state.Tick = tick
	e.state.TimeUs, _ = CanonicalTime(float64(tick) / e.context.Gameplay.TickRate)
	e.state.Finish = nil
	e.frozen = nil
	e.group = nil
	e.committed = nil
	e.held = nil
	e.resets = [2]*seatReset{}
	e.state.Abandoned = false
	e.wallTime = float64(tick) / e.context.Gameplay.TickRate
	e.pending = nil
	e.releases = nil
	for seat, car := range cars {
		e.sequences[seat] = car.LastInput
		e.connected[seat] = true
	}
}

// Coverage extends only the represented reachable windows, leaving headless
// mechanics' placement retention independent of transport prediction horizons.
func (e *Engine) Coverage() (State, error) {
	g := e.context.Gameplay
	extent := (g.CarHeight + math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize))) / 2
	for seat, placements := range e.tracks {
		if err := placements.EnsureThrough(e.state.Cars[seat].Progress + g.MaxRoadSpeed*g.AccelSpeedMultiplier + extent + g.SliceSpacing + g.MaxRoadSpeed*g.AccelSpeedMultiplier/g.TickRate); err != nil {
			return State{}, err
		}
	}
	return e.Snapshot(), nil
}

// restorePosition preserves boundary-applied discrete state while sampling movement.
func restorePosition(car *protocol.Car, sample protocol.Car) {
	car.Progress, car.NormalSpeed = sample.Progress, sample.NormalSpeed
	if car.Phase == sample.Phase && car.MovementStartUs == sample.MovementStartUs {
		car.Lateral = sample.Lateral
	} else if car.Phase == 0 {
		car.Lateral = car.MovementTarget
	} else {
		car.Lateral = car.MovementOrigin
	}
}
