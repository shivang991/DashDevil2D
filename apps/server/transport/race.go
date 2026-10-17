package transport

import (
	"fmt"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
	"math"
	"time"
)

type raceRecord struct {
	authority uint32
	value     any
}

func cloneBaseline(b p.Baseline) p.Baseline {
	b.Windows = append([]p.Window(nil), b.Windows...)
	for i := range b.Windows {
		b.Windows[i].Objects = append([]p.ObjectState{}, b.Windows[i].Objects...)
	}
	return b
}
func (s *Server) finalizeRaceLocked(r *room, result, reason uint8, tick uint32, timeUs uint64) {
	if r.outcome != nil || r.phase != 2 {
		return
	}
	b := r.zero
	outcome := p.Outcome{RoundId: r.roundID, OutcomeId: 1, Tick: tick, TimeUs: timeUs, Result: result, Reason: reason, Progress: b.Progress}
	for seat, car := range b.Cars {
		outcome.Cars[seat] = p.FinalCar{Progress: car.Progress, Lateral: car.Lateral, Hp: car.Hp, Score: car.Score}
	}
	for i, seat := range r.seats {
		if seat != nil {
			r.outcomeSessions[i] = seat.session
		}
	}
	r.idle = time.Now().Add(time.Duration(r.settings.Value("room", "idleExpiry") * float64(time.Second)))
	r.outcome = &outcome
	r.phase = 3
	r.revision++
	s.config.Logger.Info("race_finalized", "room", r.id, "round", r.roundID, "time_us", timeUs, "server_us", s.nowUs(), "result", result, "reason", reason)
}

// One room owner advances both cars. Per-connection loops only drain records.
func (s *Server) advanceRacesLocked() []*room {
	var changed []*room
	for _, r := range s.rooms {
		if r.phase != 2 || r.mode != 1 || r.engine == nil {
			continue
		}
		targetUs := s.nowUs()
		stopping := false
		if s.draining {
			deadlineUs := uint64(s.drainDeadline.Sub(s.start).Microseconds())
			if targetUs >= deadlineUs {
				targetUs = deadlineUs
				stopping = true
			}
		}
		var events []simulation.Observation
		var err error
		if stopping {
			events, err = r.engine.StopAt(float64(targetUs-r.startUs) / 1e6)
		} else {
			events, err = r.engine.AdvanceTo(float64(targetUs-r.startUs) / 1e6)
		}
		if err != nil {
			s.finalizeRaceLocked(r, 3, 6, r.zero.Tick, r.zero.TimeUs)
			changed = append(changed, r)
			continue
		}
		maintenanceEnded := false
		for _, event := range events {
			if event.Type == "maintenance" {
				maintenanceEnded = true
			}
			s.recordRaceLocked(r, event)
		}
		state := r.engine.Snapshot()
		r.zero.Cars = state.Cars
		r.zero.Tick = state.Tick
		r.zero.TimeUs = state.TimeUs
		if state.Abandoned {
			reason := uint8(6)
			if maintenanceEnded {
				reason = 7
			}
			s.finalizeRaceLocked(r, 3, reason, state.Tick, state.TimeUs)
			changed = append(changed, r)
		} else if state.Finish != nil {
			s.finalizeRaceLocked(r, state.Finish.Result, state.Finish.Reason, state.Finish.Tick, state.Finish.TimeUs)
			changed = append(changed, r)
		}
		// Retain enough ordered history for the bounded replay window. A lagging
		// receiver fails explicitly rather than dropping essential records.
		if len(r.history) > 1024 {
			r.history = append([]raceRecord(nil), r.history[len(r.history)-1024:]...)
		}
	}
	return changed
}
func (s *Server) recordRaceLocked(r *room, event simulation.Observation) {
	b := r.zero
	b.Progress.Authority++
	if event.Type == "input" {
		seat := *event.Seat
		sequence := *event.Sequence
		disposition := uint8(2)
		if event.Disposition == "accepted" {
			disposition = 0
		}
		if event.Disposition == "ignored" {
			disposition = 1
		}
		if seat == 0 {
			b.Progress.Processed1 = sequence
			b.Progress.Disposed1 = sequence
		} else {
			b.Progress.Processed2 = sequence
			b.Progress.Disposed2 = sequence
		}
		// Intent/control are retained by admission, keyed by sequence until disposition.
		s.config.Logger.Info("race_input_applied", "room", r.id, "round", r.roundID, "seat", seat, "sequence", sequence, "time_us", event.TimeUs, "server_application_us", r.startUs+event.TimeUs, "server_record_us", s.nowUs(), "disposition", disposition)
		input := r.inputs[seat][sequence]
		delete(r.inputs[seat], sequence)
		value := p.Disposition{Authority: b.Progress.Authority, Tick: event.Tick, TimeUs: event.TimeUs, Seat: seat, Sequence: sequence, Processed: sequence, Disposition: disposition, Intent: input.Intent, Control: input.Control, Car: *event.Car, Contact: b.Contact}
		r.history = append(r.history, raceRecord{b.Progress.Authority, value})
	} else if event.Car != nil || (event.Type == "objects" || event.Type == "contact") {
		b.Progress.Event++
		cars := event.Cars
		kind := uint8(8)
		if event.Type == "expiry" {
			kind = 6
		}
		if event.Type == "release" {
			kind = 7
		}
		mask := uint8(3)
		if event.Seat != nil {
			mask = 1 << *event.Seat
		}
		if event.Type == "objects" {
			kind = 2
		}
		value := p.Event{Authority: b.Progress.Authority, EventId: b.Progress.Event, Tick: event.Tick, TimeUs: event.TimeUs, Kind: kind, SeatMask: mask, Cars: cars, Contact: b.Contact, Objects: append([]p.ObjectState{}, event.Objects...)}
		r.history = append(r.history, raceRecord{b.Progress.Authority, value})
	} else {
		b.Progress.Authority--
	}
}
func (pair *pair) submitRace(input p.Input) error {
	s := pair.server
	s.mu.Lock()
	defer s.mu.Unlock()
	r := pair.seat.room
	if pair.seat.pair != pair || r.phase != 2 || r.engine == nil || r.outcome != nil || !pair.seat.focused {
		return nil
	}
	if input.Round.RoundId != r.roundID || input.Round.InputGeneration != pair.seat.inputGeneration {
		return nil
	}
	if !r.primed[pair.identity.Seat] {
		r.engine.ResetSeat(pair.identity, pair.seat.inputGeneration, input.Sequence-1)
		r.primed[pair.identity.Seat] = true
	}
	if r.inputs[pair.identity.Seat] == nil {
		r.inputs[pair.identity.Seat] = map[uint32]p.Input{}
	}
	if len(r.inputs[pair.identity.Seat]) >= 120 {
		return fmt.Errorf("input disposition backlog")
	}
	r.inputs[pair.identity.Seat][input.Sequence] = input
	_, err := r.engine.Submit(pair.identity, input)
	return err
}

// Track coverage is reliable mutable continuation, independent of verification.
// Stable placement and complete mutable consumption cover both reachable windows.
func raceCoverage(b p.Baseline, state simulation.State) (p.Generator, []p.Window) {
	g := b.Context.Gameplay
	extent := (g.CarHeight + math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize))) / 2
	windows := []p.Window{}
	for _, car := range state.Cars {
		w := p.Window{Start: car.Progress - extent, End: car.Progress + g.MaxRoadSpeed*g.AccelSpeedMultiplier + extent + g.SliceSpacing, Objects: []p.ObjectState{}}
		windows = append(windows, w)
	}
	if windows[0].Start > windows[1].Start {
		windows[0], windows[1] = windows[1], windows[0]
	}
	if windows[1].Start <= windows[0].End {
		windows[0].End = math.Max(windows[0].End, windows[1].End)
		windows = windows[:1]
	}
	for i := range windows {
		w := &windows[i]
		for _, slice := range state.Track.Slices {
			if slice.Distance < w.Start || slice.Distance > w.End {
				continue
			}
			if w.FirstSlice == 0 {
				w.FirstSlice = uint32(slice.ID)
			}
			w.LastSlice = uint32(slice.ID)
			for _, object := range state.Objects {
				if object.SliceId == uint32(slice.ID) {
					w.Objects = append(w.Objects, object)
				}
			}
		}
	}
	generator := p.Generator{RandomState: state.Track.RandomState, NextSlice: uint32(state.Track.NextID), NextObject: uint32(state.Track.NextID)*3 + 1, Cursor: state.Track.Through, ReservedCursor: uint32(state.Track.HeartIndex)}
	return generator, windows
}
