package multiplayer

import (
	"time"

	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

func (s *Server) expireLocked(now time.Time) []*room {
	changed := s.expireAccountSeatsLocked(now)
	for code, r := range s.rooms {
		modified := false
		if r.historyStarting {
			continue
		}
		s.resolveDeparturesLocked(r, now)
		idleExpired := (r.phase == p.RoomPhaseLobby || r.phase == p.RoomPhaseEnded) && !now.Before(r.idle)
		for i, participant := range r.seats {
			if participant == nil {
				continue
			}
			expired := !participant.deadline.IsZero() && !now.Before(participant.deadline)
			leaving := !participant.leaving.IsZero()
			// Keep every active equal-time departure group open until its instant closes.
			if r.phase == p.RoomPhaseActive && !earliestDeparture(r).IsZero() && !now.After(earliestDeparture(r)) {
				continue
			}
			if expired || leaving || idleExpired {
				s.removeSeatLocked(r, p.SeatIndex(i))
				modified = true
				reason := "Reconnect grace expired"
				if idleExpired {
					reason = "Room expired"
				} else if leaving {
					reason = "explicit leave"
				}
				if participant.connection != nil {
					go participant.connection.close(reason)
				}
			}
		}
		if modified {
			r.revision++
			changed = append(changed, r)
		}
		if r.seats[r.host] == nil {
			r.host = 1 - r.host
		}
		if r.seats[0] == nil && r.seats[1] == nil {
			delete(s.rooms, code)
		}
	}
	return changed
}
func (s *Server) sweep() {
	defer close(s.sweepDone)
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			s.Advance()
		}
	}
}

// Advance resolves gameplay and lifecycle against the configured authoritative clock.
func (s *Server) Advance() {
	s.mu.Lock()
	now := s.nowTime()
	changed := s.expireAccountSeatsLocked(now)
	changed = append(changed, s.advanceCountdownsLocked()...)
	changed = append(changed, s.advanceRacesLocked()...)
	changed = append(changed, s.expireLocked(now)...)
	maintenanceChanged, closingPairs := s.advanceMaintenanceLocked(now)
	changed = append(changed, maintenanceChanged...)
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
	for _, connection := range closingPairs {
		connection.close("Server maintenance")
	}
}
