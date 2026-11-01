package accounthttp

import (
	"encoding/json"
	"strconv"

	fiber "github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
)

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
		view, err := s.multiplayer.Invite(session.ID, session.User.ID, self, peer, request.RoomID)
		if err != nil {
			return accountError(c, 409, err.Error())
		}
		invitation := accounts.ChatChallenge{Run: view.Run, RoomID: view.RoomID, Epoch: view.Epoch, Sender: view.Sender, Recipient: view.Recipient, ExpiresAt: view.ExpiresAt}
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
