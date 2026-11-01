package multiplayer

import (
	"errors"
	"time"

	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

type Invitation struct {
	ID                           int64
	Run                          string
	RoomID                       uint32
	Epoch                        uint64
	Sender, Recipient, ExpiresAt int64
	Accepted                     bool
}

func (s *Server) challengeStatusLocked(v Invitation) (string, *room) {
	if v.Accepted {
		return "Accepted", nil
	}
	if s.config.Now().UnixMilli() >= v.ExpiresAt {
		return "Expired", nil
	}
	if v.Run != s.chatRun {
		return "Unavailable", nil
	}
	for _, r := range s.rooms {
		if r.id != v.RoomID {
			continue
		}
		if r.invitationEpoch != v.Epoch || r.phase != p.RoomPhaseLobby || (r.seats[0] != nil && r.seats[1] != nil) || !s.nowTime().Before(r.idle) {
			return "Unavailable", nil
		}
		for _, seat := range r.seats {
			if seat != nil && seat.accountChatID == v.Sender && seat.leaving.IsZero() && seat.accountLive(s.nowTime()) && (seat.deadline.IsZero() || s.nowTime().Before(seat.deadline)) {
				return "Pending", r
			}
		}
	}
	return "Unavailable", nil
}

func (s *Server) InvitationStatus(v Invitation) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	status, _ := s.challengeStatusLocked(v)
	return status
}
func (s *Server) Invite(session string, accountID, self, peer int64, roomID uint32) (Invitation, error) {
	invitation := Invitation{Run: s.chatRun, RoomID: roomID, Sender: self, Recipient: peer, ExpiresAt: s.config.Now().Add(5 * time.Minute).UnixMilli()}
	s.mu.Lock()
	valid := false
	for _, r := range s.rooms {
		for _, seat := range r.seats {
			if seat != nil && seat.accountID == accountID && (r.phase == p.RoomPhaseCountdown || r.phase == p.RoomPhaseActive) {
				s.mu.Unlock()
				return Invitation{}, errors.New("Finish your game before challenging")
			}
			if (r.id == roomID || roomID == 0 && !valid) && seat != nil && seat.accountSession == session && seat.connected {
				candidate := invitation
				candidate.RoomID, candidate.Epoch = r.id, r.invitationEpoch
				if state, _ := s.challengeStatusLocked(candidate); state == "Pending" {
					invitation = candidate
					valid = true
				}
			}
		}
	}
	status, _ := s.challengeStatusLocked(invitation)
	s.mu.Unlock()
	if !valid || status != "Pending" {
		return Invitation{}, errors.New("Choose an open lobby with a free seat, or create a room")
	}
	return invitation, nil
}
