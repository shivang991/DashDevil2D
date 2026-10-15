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
	Car         *protocol.Car `json:"car,omitempty"`
	Type        string        `json:"type"`
	Tick        uint32        `json:"tick"`
	TimeUs      uint64        `json:"timeUs"`
	Seat        *uint8        `json:"seat,omitempty"`
	Sequence    *uint32       `json:"sequence,omitempty"`
	Disposition string        `json:"disposition,omitempty"`
}
type Press struct {
	Seat     uint8  `json:"seat"`
	Control  uint8  `json:"control"`
	Sequence uint32 `json:"sequence"`
	TimeUs   uint64 `json:"timeUs"`
	Order    uint32 `json:"order"`
}
type State struct {
	Track       track.PlacementState `json:"track"`
	Tick        uint32               `json:"tick"`
	TimeUs      uint64               `json:"timeUs"`
	Abandoned   bool                 `json:"abandoned"`
	Cars        [2]protocol.Car      `json:"cars"`
	LatestPress *Press               `json:"latestPress"`
}
type queued struct {
	seat  uint8
	input protocol.Input
	valid bool
}

// Engine is owned by one round coordinator. No method may run concurrently.
type Engine struct {
	track      *track.Multiplayer
	context    protocol.Context
	identities [2]protocol.Identity
	roundID    uint32
	state      State
	wallTime   float64
	pending    []queued
	releases   []Observation
	sequences  [2]uint32
	tokens     [2]float64
	connected  [2]bool
	order      uint32
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
	e := &Engine{context: context, identities: identities, roundID: roundID, connected: [2]bool{true, true}, tokens: [2]float64{context.Connection.InputBurst, context.Connection.InputBurst}}
	for seat, lane := range []uint8{0, 2} {
		lateral := (float64(lane) - 1) * context.Gameplay.LaneSpacing
		e.state.Cars[seat] = protocol.Car{Lane: lane, Departure: lane, Target: lane, Lateral: lateral, MovementOrigin: lateral, MovementTarget: lateral, NormalSpeed: context.Gameplay.StartingRoadSpeed, Hp: uint32(context.Gameplay.MaxHealth), InputGeneration: 1}
	}
	e.track, _ = track.NewMultiplayer(context)
	if err := e.updateTrack(); err != nil {
		return nil, err
	}
	return e, nil
}
func (e *Engine) Snapshot() State {
	result := e.state
	result.Track = e.track.Snapshot()
	if result.LatestPress != nil {
		copy := *result.LatestPress
		result.LatestPress = &copy
	}
	return result
}
func (e *Engine) Submit(auth protocol.Identity, input protocol.Input) (bool, error) {
	seat := auth.Seat
	if seat > 1 || e.identities[seat] != auth {
		return false, nil
	}
	if e.tokens[seat] < 1 || len(e.pending) >= int(2*e.context.Connection.InputBurst) {
		return false, fmt.Errorf("input rate/queue exceeded; recover connection")
	}
	e.tokens[seat]--
	valid := e.connected[seat] && !e.state.Abandoned && input.Identity == auth && input.Round.RoundId == e.roundID && input.Round.InputGeneration == e.state.Cars[seat].InputGeneration && uint64(input.Sequence) == uint64(e.sequences[seat])+1
	if _, err := protocol.EncodeInput(input, 65536); err != nil {
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
	if err := e.track.EnsureThrough(math.Max(e.state.Cars[0].Progress, e.state.Cars[1].Progress) + g.MaxRoadSpeed*g.AccelSpeedMultiplier + extent); err != nil {
		return err
	}
	e.track.RetireBehind(math.Min(e.state.Cars[0].Progress, e.state.Cars[1].Progress) - g.CarHeight/2)
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
	return Observation{Type: kind, Tick: e.state.Tick, TimeUs: timeUs, Seat: &copy, Car: &car}
}
func (e *Engine) Disconnect(auth protocol.Identity) {
	seat := auth.Seat
	if seat > 1 || e.identities[seat] != auth || e.state.Abandoned {
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
	if car.Phase != 0 || (car.Effective != 1 && car.Effective != 2) || timeUs < car.NextShiftUs {
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
	if _, err := CanonicalTime(seconds); err != nil {
		return nil, err
	}
	if seconds < e.wallTime {
		return nil, fmt.Errorf("monotonic clock moved backwards")
	}
	if e.state.Abandoned {
		return []Observation{}, nil
	}
	for seat, tokens := range e.tokens {
		e.tokens[seat] = math.Min(e.context.Connection.InputBurst, tokens+float64((seconds-e.wallTime)*e.context.Connection.InputRate))
	}
	e.wallTime = seconds
	g := e.context.Gameplay
	events := e.releases
	e.releases = nil
	if events == nil {
		events = []Observation{}
	}
	if seconds-float64(e.state.Tick)/g.TickRate > e.context.Operational.SimulationLagThreshold {
		e.state.Abandoned = true
		e.pending = nil
		for seat := range e.state.Cars {
			clear(&e.state.Cars[seat])
		}
		events = append(events, Observation{Type: "abandoned", Tick: e.state.Tick, TimeUs: e.state.TimeUs})
		return events, nil
	}
	for float64(uint64(e.state.Tick)+1)/g.TickRate <= seconds {
		if e.state.Tick == math.MaxUint32 {
			return nil, fmt.Errorf("tick exhausted")
		}
		time := float64(e.state.Tick) / g.TickRate
		end := float64(uint64(e.state.Tick)+1) / g.TickRate
		timeUs, _ := CanonicalTime(time)
		e.boundaries(timeUs, &events)
		e.apply(timeUs, &events)
		for time < end {
			startUs, _ := CanonicalTime(time)
			for seat := range e.state.Cars {
				e.shift(&e.state.Cars[seat], uint8(seat), startUs, &events)
			}
			next := end
			for _, car := range e.state.Cars {
				if car.Effective != 0 && car.FreshnessUs > startUs {
					next = math.Min(next, float64(car.FreshnessUs)/1e6)
				}
				if car.Phase != 0 && car.MovementEndUs > startUs {
					next = math.Min(next, float64(car.MovementEndUs)/1e6)
				}
				if car.Phase == 0 && (car.Effective == 1 || car.Effective == 2) && car.NextShiftUs > startUs {
					next = math.Min(next, float64(car.NextShiftUs)/1e6)
				}
			}
			elapsed := next - time
			for seat := range e.state.Cars {
				car := &e.state.Cars[seat]
				// Explicit conversions prevent Go fused multiply-add from changing JS operation order.
				normal := math.Min(g.MaxRoadSpeed, g.StartingRoadSpeed+float64(g.SpeedGrowth*time))
				ramp := 0.0
				if g.SpeedGrowth != 0 {
					ramp = math.Min(elapsed, math.Max(0, (g.MaxRoadSpeed-normal)/g.SpeedGrowth))
				}
				rampDistance := float64(normal*ramp) + float64(float64(float64(.5*g.SpeedGrowth)*ramp)*ramp)
				distance := rampDistance + float64(math.Min(g.MaxRoadSpeed, normal+float64(g.SpeedGrowth*ramp))*(elapsed-ramp))
				multiplier := 1.0
				if car.Effective == 3 {
					multiplier = g.AccelSpeedMultiplier
				}
				car.Progress = car.Progress + float64(distance*multiplier)
				car.NormalSpeed = math.Min(g.MaxRoadSpeed, g.StartingRoadSpeed+float64(g.SpeedGrowth*next))
				if car.Phase != 0 {
					fraction := (float64(next*1e6) - float64(car.MovementStartUs)) / float64(car.MovementEndUs-car.MovementStartUs)
					car.Lateral = car.MovementOrigin + float64((car.MovementTarget-car.MovementOrigin)*fraction)
				}
			}
			time = next
			timeUs, _ = CanonicalTime(time)
			e.boundaries(timeUs, &events)
		}
		if err := e.updateTrack(); err != nil {
			return nil, err
		}
		e.state.Tick++
		e.state.TimeUs, _ = CanonicalTime(float64(e.state.Tick) / g.TickRate)
	}
	return events, nil
}
