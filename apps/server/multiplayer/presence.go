package multiplayer

import (
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

func (s *Server) Presence(session string, roomID uint32) (int64, map[string]int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	statuses := map[string]int{}
	var pinned int64
	for _, r := range s.rooms {
		for i, seat := range r.seats {
			if seat == nil {
				continue
			}
			if seat.connected {
				rank := 2
				if r.phase == p.RoomPhaseCountdown || r.phase == p.RoomPhaseActive {
					rank = 3
				}
				statuses[seat.accountSession] = max(statuses[seat.accountSession], rank)
			}
			if r.id == roomID && seat.accountSession == session && r.seats[1-i] != nil {
				pinned = r.seats[1-i].accountID
			}
		}
	}
	return pinned, statuses
}
