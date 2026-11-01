package transport

import (
	"encoding/json"
	"github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"strconv"
	"time"
)

// The caller holds room ownership. Presence is deliberately not consulted.
func (s *Server) challengeStatusLocked(v accounts.ChatChallenge) (string, *room) {
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
func (s *Server) challengeRoutes() {
	s.app.Post("/api/account/chat/thread/:peer/challenge", func(c *fiber.Ctx) error {
		peer, err := strconv.ParseInt(c.Params("peer"), 10, 64)
		var request struct {
			RoomID uint32
			Key    string
		}
		if err != nil || len(c.Body()) > 1000 || json.Unmarshal(c.Body(), &request) != nil {
			return accountError(c, 400, "Invalid challenge")
		}
		session := c.Locals("chatSession").(accounts.Session)
		self := c.Locals("chatSelf").(int64)
		if message, found, err := s.config.Accounts.ChatInviteRetry(self, peer, request.Key, request.RoomID); err != nil {
			return accountError(c, 400, err.Error())
		} else if found {
			return c.JSON(message)
		}
		invitation := accounts.ChatChallenge{Run: s.chatRun, RoomID: request.RoomID, Sender: self, Recipient: peer, ExpiresAt: s.config.Now().Add(5 * time.Minute).UnixMilli()}
		s.mu.Lock()
		valid := false
		for _, r := range s.rooms {
			for _, seat := range r.seats {
				if seat != nil && seat.accountID == session.User.ID && (r.phase == p.RoomPhaseCountdown || r.phase == p.RoomPhaseActive) {
					s.mu.Unlock()
					return accountError(c, 409, "Finish your game before challenging")
				}
				if (r.id == request.RoomID || request.RoomID == 0 && !valid) && seat != nil && seat.accountSession == session.ID && seat.connected {
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
			return accountError(c, 409, "Choose an open lobby with a free seat, or create a room")
		}
		message, err := s.config.Accounts.ChatInvite(self, peer, request.Key, s.config.Now(), invitation)
		if err == accounts.ErrChatRate {
			return accountError(c, 429, err.Error())
		}
		if err != nil {
			return accountError(c, 400, err.Error())
		}
		return c.JSON(message)
	})
}
