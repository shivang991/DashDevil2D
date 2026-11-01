package multiplayer

import (
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

func (s *Server) revokeSeatsLocked(matches func(*seat) bool, at time.Time) []*room {
	var changed []*room
	for _, r := range s.rooms {
		modified := false
		s.resolveDeparturesLocked(r, at)
		for _, seat := range r.seats {
			if seat == nil || !matches(seat) {
				continue
			}
			modified = true
			delete(s.credentials, token(seat.credential))
			if seat.leaving.IsZero() {
				seat.leaving = at
			}
			seat.connected = false
			seat.ready = false
			if seat.connection != nil {
				go seat.connection.close("Session expired or revoked")
			}
		}
		if modified {
			// All affected seats are marked before resolving; same-session opponents
			// depart together and produce abandonment, never an iteration-order winner.
			if r.phase != 2 {
				for i, seat := range r.seats {
					if seat != nil && matches(seat) {
						s.removeSeatLocked(r, p.SeatIndex(i))
					}
				}
			}
			if r.seats[r.host] == nil {
				r.host = 1 - r.host
			}
			if r.seats[0] == nil && r.seats[1] == nil {
				delete(s.rooms, r.code)
			}
			r.revision++
			changed = append(changed, r)
		}
	}
	return changed
}

func (s *Server) expireAccountSeatsLocked(now time.Time) []*room {
	expired := map[string]time.Time{}
	for _, r := range s.rooms {
		for _, seat := range r.seats {
			if seat != nil && seat.accountSession != "" && seat.leaving.IsZero() && !now.Before(seat.accountExpires) {
				expired[seat.accountSession] = seat.accountExpires
			}
		}
	}
	var changed []*room
	for id, at := range expired {
		changed = append(changed, s.revokeSeatsLocked(func(seat *seat) bool { return seat.accountSession == id }, at)...)
	}
	return changed
}

// Unbound seats exist only in the stationary diagnostic and native fixtures.
func (seat *seat) accountLive(now time.Time) bool {
	return seat.accountSession == "" || now.Before(seat.accountExpires)
}

func (s *Server) PublishProfile(next accounts.User) {
	s.mu.Lock()
	var changed []*room
	for _, r := range s.rooms {
		modified := false
		for _, seat := range r.seats {
			if seat != nil && seat.accountID == next.ID {
				seat.savedName, seat.savedAvatar = next.Username, next.Avatar
				modified = true
			}
		}
		if modified && r.phase == 0 {
			s.refreshRoomIdentityLocked(r)
			r.revision++
			changed = append(changed, r)
		}
	}
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
}
func (s *Server) refreshRoomIdentityLocked(r *room) {
	if r.phase == 0 {
		r.racers = [2]p.RacerIdentity{}
	}
	for _, seat := range r.seats {
		if seat != nil && seat.accountSession != "" {
			seat.name, seat.avatar = seat.savedName, seat.savedAvatar
		}
	}
}

// Schedule I/O outside gameplay ownership; revocation/profile writes share authMu.
func (s *Server) cleanupAvatarsLocked() {
	select {
	case s.avatarCleanup <- struct{}{}:
	default:
	}
}
func (s *Server) RetainedAvatars() []string {
	s.mu.Lock()
	var retained []string
	for _, r := range s.rooms {
		if r.phase != 0 {
			for _, racer := range r.racers {
				if racer.Avatar != "" {
					retained = append(retained, racer.Avatar)
				}
			}
		}
		for _, seat := range r.seats {
			if seat != nil && seat.avatar != "" {
				retained = append(retained, seat.avatar)
			}
		}
	}
	s.mu.Unlock()
	return retained
}
func (s *Server) RevokeManagedSeats(id int64, deleted bool) {
	s.mu.Lock()
	if deleted {
		// Scrub queued starts and revoke seats in the same ownership turn:
		// countdown activation cannot enqueue deleted identity between them.
		for i := range s.historyWrites {
			for seat, accountID := range s.historyWrites[i].accounts {
				if accountID == id {
					s.historyWrites[i].accounts[seat] = 0
				}
			}
		}
	}
	changed := s.revokeSeatsLocked(func(seat *seat) bool { return seat.accountID == id }, s.nowTime())
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
}

func (s *Server) RevokeSeats(session string, account int64, except string) {
	s.mu.Lock()
	changed := s.revokeSeatsLocked(func(seat *seat) bool {
		return (session != "" && seat.accountSession == session) || (account != 0 && seat.accountID == account && seat.accountSession != except)
	}, s.nowTime())
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
}
func (s *Server) RollbackAdmission(h Handle) {
	c := h.connection
	s.mu.Lock()
	if c.seat.connection == c {
		s.removeSeatLocked(c.seat.room, c.seat.index)
	}
	s.mu.Unlock()
	c.close("challenge persistence failed")
	s.broadcast(c.seat.room)
}
