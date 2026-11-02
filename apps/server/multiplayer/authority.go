package multiplayer

import (
	"errors"

	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

type AuthorityRecord struct {
	Authority uint32
	Value     any
}
type Authority struct {
	Outcome  *p.Outcome
	Active   bool
	Records  []AuthorityRecord
	Baseline p.Baseline
}

func copyRecord(r raceRecord) AuthorityRecord {
	v := r.value
	if event, ok := v.(p.Event); ok {
		event.Objects = append([]p.ObjectState(nil), event.Objects...)
		v = event
	}
	return AuthorityRecord{r.authority, v}
}

// Authority returns independent copies, never engine/room pointers or slices.
func (h Handle) Authority(cursor uint32, installed bool, baseline p.Baseline) (Authority, error) {
	connection := h.connection
	s := connection.server
	s.mu.Lock()
	defer s.mu.Unlock()
	if !connection.validLocked() {
		return Authority{}, errors.New("superseded connection")
	}
	r := connection.seat.room
	var outcome *p.Outcome
	if r.outcome != nil && r.outcomeSessions[connection.identity.Seat] == connection.identity.SeatSession {
		copy := *r.outcome
		copy.Identity = connection.identity
		outcome = &copy
	}
	active := r.phase == p.RoomPhaseActive
	var records []AuthorityRecord
	current := baseline
	if r.zero != nil {
		current = cloneBaseline(*r.zero)
		current.Context.Connection = baseline.Context.Connection
	}
	if active && installed {
		if len(r.history) > 0 && cursor+1 < r.history[0].authority {
			return Authority{}, errors.New("authority history unavailable")
		}
		for _, item := range r.history {
			if item.authority > cursor {
				records = append(records, copyRecord(item))
			}
		}
		state, coverageErr := r.engine.Coverage()
		if coverageErr != nil {
			return Authority{}, coverageErr
		}
		current.Generator, current.Windows = raceCoverage(current, state)
	}
	return Authority{outcome, active, records, current}, nil
}
