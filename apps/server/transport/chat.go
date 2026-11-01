package transport

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

func (s *Server) chatRoutes() {
	s.app.Use("/api/account/chat", func(c *fiber.Ctx) error {
		if c.Method() != "GET" && !s.accountMutation(c) {
			return accountError(c, 403, "Request rejected")
		}
		s.authMu.Lock()
		defer s.authMu.Unlock()
		session, err := s.account(c)
		if err != nil {
			return accountError(c, 401, accounts.ErrSession.Error())
		}
		if session.MustChangePassword {
			return accountError(c, 403, "Change your temporary password first")
		}
		self, err := s.config.Accounts.ChatID(session.User.ID)
		if err != nil {
			return accountError(c, 503, "Chat unavailable. Retry shortly")
		}
		c.Locals("chatSession", session)
		c.Locals("chatSelf", self)
		return c.Next()
	})
	s.challengeRoutes()
	s.app.Get("/api/account/chat/search", func(c *fiber.Ctx) error {
		_, rooms := s.chatRoomState(c.Locals("chatSession").(accounts.Session).ID, 0)
		people, err := s.config.Accounts.ChatPeople(s.config.Now(), rooms)
		if err != nil {
			return accountError(c, 503, "Search unavailable. Retry")
		}
		query := strings.ToLower(strings.TrimSpace(c.Query("q")))
		users := []accounts.ChatPerson{}
		total := 0
		for _, v := range people {
			if query != "" && v.ID != c.Locals("chatSelf").(int64) && !v.Deleted && strings.Contains(strings.ToLower(v.Username), query) {
				total++
				if len(users) < 50 {
					users = append(users, v)
				}
			}
		}
		return c.JSON(fiber.Map{"users": users, "total": total})
	})
	s.app.Post("/api/account/chat/sync", func(c *fiber.Ctx) error {
		var request struct {
			Activity, Client string
			RoomID           uint32
			PeerID           int64
		}
		if json.Unmarshal(c.Body(), &request) != nil || len(request.Client) > 100 {
			return accountError(c, 400, "Invalid presence")
		}
		rank := 1
		if request.Activity == "Playing" {
			rank = 3
		} else if request.Activity == "Offline" {
			rank = 0
		} else if request.Activity != "Active" {
			return accountError(c, 400, "Invalid activity")
		}
		session := c.Locals("chatSession").(accounts.Session)
		if err := s.config.Accounts.ChatHeartbeat(session.ID, request.Client, rank, s.config.Now()); err != nil {
			return accountError(c, 503, "Chat unavailable. Retry")
		}
		pinned, rooms := s.chatRoomState(session.ID, request.RoomID)
		people, err := s.config.Accounts.ChatPeople(s.config.Now(), rooms)
		if err != nil {
			return accountError(c, 503, "Chat unavailable. Retry")
		}
		pinnedID, _ := s.config.Accounts.ChatID(pinned)
		result, err := s.config.Accounts.ChatLists(c.Locals("chatSelf").(int64), pinnedID, people)
		if err != nil {
			return accountError(c, 503, "Chat unavailable. Retry")
		}
		for _, person := range people {
			if person.ID == request.PeerID {
				result.Selected = &person
				break
			}
		}
		return c.JSON(result)
	})
	s.app.Get("/api/account/chat/thread/:peer", func(c *fiber.Ctx) error {
		peer, err := strconv.ParseInt(c.Params("peer"), 10, 64)
		if err != nil || peer <= 0 || peer == c.Locals("chatSelf").(int64) {
			return accountError(c, 400, "Choose another account")
		}
		after, err := strconv.ParseInt(c.Query("after", "0"), 10, 64)
		if err != nil || after < 0 {
			return accountError(c, 400, "Invalid history position")
		}
		watch := []int64{}
		if raw := c.Query("watch"); raw != "" {
			ids := strings.Split(raw, ",")
			if len(ids) > 300 {
				return accountError(c, 400, "Too many invitation updates")
			}
			for _, rawID := range ids {
				id, err := strconv.ParseInt(rawID, 10, 64)
				if err != nil || id <= 0 {
					return accountError(c, 400, "Invalid invitation update")
				}
				watch = append(watch, id)
			}
		}
		messages, err := s.config.Accounts.ChatThread(c.Locals("chatSelf").(int64), peer, after)
		if err != nil {
			return accountError(c, 503, "History unavailable. Retry")
		}
		through := after
		if len(messages) > 0 {
			through = messages[len(messages)-1].ID
		}
		challenges, err := s.config.Accounts.ChatChallenges(c.Locals("chatSelf").(int64), peer, after, through, watch)
		if err != nil {
			return accountError(c, 503, "Invitations unavailable. Retry")
		}
		s.mu.Lock()
		for i := range challenges {
			challenges[i].Status, _ = s.challengeStatusLocked(challenges[i])
		}
		s.mu.Unlock()
		return c.JSON(fiber.Map{"messages": messages, "challenges": challenges})
	})
	s.app.Post("/api/account/chat/thread/:peer", func(c *fiber.Ctx) error {
		peer, err := strconv.ParseInt(c.Params("peer"), 10, 64)
		if err != nil {
			return accountError(c, 400, "Invalid account")
		}
		var request struct{ Text, Key string }
		if len(c.Body()) > 20000 || json.Unmarshal(c.Body(), &request) != nil {
			return accountError(c, 400, "Invalid message")
		}
		message, err := s.config.Accounts.ChatSend(c.Locals("chatSelf").(int64), peer, request.Text, request.Key, s.config.Now())
		if errors.Is(err, accounts.ErrChatRate) {
			c.Set("Retry-After", "60")
			return accountError(c, 429, err.Error())
		}
		if err != nil {
			return accountError(c, 400, err.Error())
		}
		return c.JSON(message)
	})
	s.app.Post("/api/account/chat/thread/:peer/read", func(c *fiber.Ctx) error {
		peer, err := strconv.ParseInt(c.Params("peer"), 10, 64)
		var request struct{ Through int64 }
		if err != nil || json.Unmarshal(c.Body(), &request) != nil {
			return accountError(c, 400, "Invalid read position")
		}
		if err = s.config.Accounts.ChatRead(c.Locals("chatSelf").(int64), peer, request.Through); err != nil {
			return accountError(c, 503, "Unable to save read position. Retry")
		}
		return c.JSON(fiber.Map{"ok": true})
	})
}
func (s *Server) chatRoomState(session string, roomID uint32) (int64, map[string]int) {
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

// Finalization queues value copies only. All persistence happens off the gameplay mutex.
func (s *Server) recordChatRoundLocked(r *room) {
	if s.config.Accounts == nil || r.outcome.Result == p.OutcomeResultAbandoned || r.seats[0] == nil || r.seats[1] == nil {
		return
	}
	s.chatRounds = append(s.chatRounds, accounts.SharedRound{Key: fmt.Sprintf("%s:%d:%d", s.chatRun, r.id, r.roundID), A: r.seats[0].accountChatID, B: r.seats[1].accountChatID, Finished: s.config.Now().UnixMilli()})
}
func (s *Server) flushChatRounds() {
	s.mu.Lock()
	pending := s.chatRounds
	s.chatRounds = nil
	s.mu.Unlock()
	for _, r := range pending {
		if err := s.config.Accounts.RecordChatRound(r); err != nil {
			s.config.Logger.Error("chat_history_write_failed", "error", err)
			s.mu.Lock()
			s.chatRounds = append(s.chatRounds, r)
			s.mu.Unlock()
		}
	}
}
func (s *Server) chatHistoryLoop() {
	defer close(s.chatDone)
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			s.flushChatRounds()
			return
		case <-ticker.C:
			s.flushChatRounds()
		}
	}
}
