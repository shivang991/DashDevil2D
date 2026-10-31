package transport

import (
	"errors"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
	"time"
)

// Called only under the room owner mutex. Countdown never calls AdvanceTo.
func (s *Server) prepareRoundLocked(r *room) error {
	var ids [2]p.Identity
	for i, seat := range r.seats {
		ids[i] = p.Identity{RoomId: r.id, SeatSession: 1, PairGeneration: 1, Seat: p.SeatIndex(i)}
		if seat != nil {
			ids[i] = seat.pair.identity
		}
	}
	engine, err := simulation.New(r.settings, r.seed, ids, r.roundID)
	if err != nil {
		return err
	}
	for i, seat := range r.seats {
		if seat != nil {
			engine.ResetSeat(ids[i], seat.inputGeneration, 0, seat.pair.connectionLimits())
		}
	}
	r.engine = engine
	r.history = nil
	r.outcome = nil
	r.primed = [2]bool{}
	r.inputs = [2]map[uint32]p.Input{}
	state, err := engine.Coverage()
	if err != nil {
		return err
	}
	context := r.settings.Context(r.seed)
	context.StartUs = r.startUs
	b := p.Baseline{Round: p.Round{RoundId: r.roundID, InputGeneration: r.roundID}, Epoch: 1, Context: context, Cars: state.Cars}
	for i := range b.Cars {
		b.Cars[i].InputGeneration = 1
		if r.seats[i] != nil {
			b.Cars[i].InputGeneration = r.seats[i].inputGeneration
		}
	}
	b.Generator, b.Windows = raceCoverage(b, state)
	r.zero = &b
	return nil
}
func (s *Server) cancelCountdownLocked(r *room) {
	if r.phase != p.RoomPhaseCountdown {
		return
	}
	r.phase = p.RoomPhaseLobby
	r.startUs = 0
	r.zero = nil
	r.revision++
	for _, seat := range r.seats {
		if seat != nil {
			seat.ready = false
			seat.installedRound = 0
		}
	}
}
func (s *Server) advanceCountdownsLocked() []*room {
	var changed []*room
	for _, r := range s.rooms {
		if r.phase != p.RoomPhaseCountdown || s.nowUs() < r.startUs {
			continue
		}
		valid := true
		for _, seat := range r.seats {
			if seat == nil || !seat.connected || seat.installedRound != r.roundID {
				valid = false
			}
		}
		if valid {
			r.phase = p.RoomPhaseActive
			r.revision++
		} else {
			s.cancelCountdownLocked(r)
		}
		changed = append(changed, r)
	}
	return changed
}
func (pair *pair) roomBaseline() (p.Baseline, error) {
	s := pair.server
	deadline := time.NewTimer(time.Second)
	defer deadline.Stop()
	waiting := false
	for {
		s.mu.Lock()
		r := pair.seat.room
		if r.engine == nil || !r.engine.PendingGroup() {
			defer s.mu.Unlock()
			return pair.roomBaselineLocked()
		}
		if !waiting {
			s.config.Logger.Info("baseline_waiting_group", "room", r.id, "seat", pair.identity.Seat)
			waiting = true
		}
		s.mu.Unlock()
		select {
		case <-pair.done:
			return p.Baseline{}, errors.New("pair closed while waiting for committed baseline")
		case <-deadline.C:
			return p.Baseline{}, errors.New("committed baseline capture timed out")
		case <-time.After(time.Millisecond):
		}
	}
}
func (pair *pair) roomBaselineLocked() (p.Baseline, error) {
	s := pair.server
	r := pair.seat.room
	if pair.seat.pair != pair || r.seats[pair.identity.Seat] != pair.seat || !pair.seat.leaving.IsZero() {
		return p.Baseline{}, errors.New("superseded room seat")
	}
	if r.zero == nil || r.zero.Context.Mode != r.mode {
		if err := s.prepareRoundLocked(r); err != nil {
			return p.Baseline{}, err
		}
	}
	b := cloneBaseline(*r.zero)
	b.Context.Connection = pair.connectionLimits()
	if r.engine != nil {
		state, err := r.engine.Coverage()
		if err != nil {
			return p.Baseline{}, err
		}
		b.Generator, b.Windows = raceCoverage(b, state)
	}
	b.Identity = pair.identity
	for i, seat := range r.seats {
		if seat != nil {
			b.Cars[i].InputGeneration = seat.inputGeneration
		}
	}
	b.Round.InputGeneration = b.Cars[pair.identity.Seat].InputGeneration
	return b, p.ValidateBaseline(b, b.Context)
}

// Room timers use the immutable configuration captured for the selected mode.
func roomDuration(r *room, key string) time.Duration {
	return time.Duration(r.settings.Value("room", key) * float64(time.Second))
}

// The room owner resolves one earliest departure group, after gameplay at that
// instant. Explicit leaves stay queued for the rest of their clock instant so
// two same-time commands cannot choose a winner by arrival/seat iteration order.
func departureAt(participant *seat) time.Time {
	if participant == nil {
		return time.Time{}
	}
	if !participant.leaving.IsZero() && (participant.deadline.IsZero() || participant.leaving.Before(participant.deadline)) {
		return participant.leaving
	}
	return participant.deadline
}
func earliestDeparture(r *room) time.Time {
	var earliest time.Time
	for _, participant := range r.seats {
		at := departureAt(participant)
		if !at.IsZero() && (earliest.IsZero() || at.Before(earliest)) {
			earliest = at
		}
	}
	return earliest
}
func (s *Server) resolveDeparturesLocked(r *room, now time.Time) bool {
	if r.phase != p.RoomPhaseActive {
		return false
	}
	at := earliestDeparture(r)
	if at.IsZero() || !now.After(at) {
		return false
	}
	survivors := -1
	reason := p.OutcomeReasonGraceExpiry
	for i, participant := range r.seats {
		if participant == nil {
			continue
		}
		if !participant.leaving.IsZero() && participant.leaving.Equal(at) {
			reason = p.OutcomeReasonExplicitLeave
		}
		cutoff := departureAt(participant)
		if participant.connected && (cutoff.IsZero() || cutoff.After(at)) {
			survivors = i
		}
	}
	result := p.OutcomeResultAbandoned
	if survivors >= 0 {
		result = p.OutcomeResult(survivors)
	} else {
		reason = p.OutcomeReasonBothDisconnected
	}
	s.finalizeLifecycleLocked(r, result, reason, uint64(max(0, at.Sub(s.start).Microseconds())))
	return true
}
func (s *Server) removeSeatLocked(r *room, index p.SeatIndex) {
	participant := r.seats[index]
	if participant == nil {
		return
	}
	delete(s.credentials, token(participant.credential))
	for key, t := range s.tickets {
		if t.seat == participant {
			delete(s.tickets, key)
		}
	}
	r.seats[index] = nil
	s.cancelCountdownLocked(r)
	if r.phase == p.RoomPhaseEnded && r.seats[1-index] != nil && r.seats[1-index].returned {
		r.phase = p.RoomPhaseLobby
	}
	for _, other := range r.seats {
		if other != nil {
			other.ready = false
		}
	}
}
