package accounthttp

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"

	fiber "github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
)

func (s *Server) adminRoutes() {
	s.app.Use("/api/account/admin", func(c *fiber.Ctx) error {
		s.config.Auth.Lock()
		defer s.config.Auth.Unlock()
		session, err := s.account(c)
		if err != nil {
			return accountError(c, 401, "Please log in again")
		}
		if !session.Admin || session.MustChangePassword {
			return accountError(c, 403, "Admin access required")
		}
		if c.Method() != "GET" && !s.accountMutation(c) {
			return accountError(c, 403, "Request rejected")
		}
		return c.Next()
	})
	s.app.Get("/api/account/admin/users", func(c *fiber.Ctx) error {
		users, err := s.config.Accounts.Users()
		if err != nil {
			return accountError(c, 503, "Unable to list users")
		}
		return c.JSON(fiber.Map{"users": users})
	})
	s.app.Post("/api/account/admin/users", func(c *fiber.Ctx) error {
		var request struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if len(c.Body()) > 8192 || json.Unmarshal(c.Body(), &request) != nil {
			return accountError(c, 400, "Enter a username")
		}
		select {
		case s.accountAdmission.hashing <- struct{}{}:
			defer func() { <-s.accountAdmission.hashing }()
		default:
			return accountError(c, 429, "Busy. Try again shortly")
		}
		user, err := s.config.Accounts.CreateManaged(request.Username, request.Password)
		if err != nil {
			return accountError(c, 400, err.Error())
		}
		return c.JSON(fiber.Map{"user": user})
	})
	s.app.Post("/api/account/admin/users/:id/profile", func(c *fiber.Ctx) error {
		id, err := strconv.ParseInt(c.Params("id"), 10, 64)
		if err != nil || id < 1 {
			return accountError(c, 400, "Invalid user")
		}
		var request struct {
			Username string  `json:"username"`
			Avatar   *string `json:"avatar"`
		}
		if len(c.Body()) > 3*1024*1024 || json.Unmarshal(c.Body(), &request) != nil {
			return accountError(c, 400, "Invalid profile")
		}
		var avatar *[]byte
		if request.Avatar != nil {
			data, err := base64.StdEncoding.DecodeString(*request.Avatar)
			if err != nil {
				return accountError(c, 400, "Invalid avatar")
			}
			avatar = &data
		}
		session, err := s.account(c)
		if err != nil {
			return accountError(c, 401, "Please log in again")
		}
		user, err := s.config.Accounts.UpdateManagedProfile(session.ID, id, request.Username, avatar, s.config.Now())
		if err != nil {
			status := 400
			if errors.Is(err, accounts.ErrUsernameConflict) {
				status = 409
			}
			return accountError(c, status, err.Error())
		}
		s.multiplayer.PublishProfile(user)
		s.config.CleanupAvatars()
		return c.JSON(user)
	})
	s.app.Post("/api/account/admin/users/:id/reset", func(c *fiber.Ctx) error {
		id, err := strconv.ParseInt(c.Params("id"), 10, 64)
		if err != nil {
			return accountError(c, 400, "Invalid user")
		}
		if _, err = s.config.Accounts.User(id); err != nil {
			return accountError(c, 404, "User not found")
		}
		select {
		case s.accountAdmission.hashing <- struct{}{}:
			defer func() { <-s.accountAdmission.hashing }()
		default:
			return accountError(c, 429, "Busy. Try again shortly")
		}
		password, err := s.config.Accounts.ResetManagedPassword(id)
		if err != nil {
			return accountError(c, 503, "Unable to reset password")
		}
		s.multiplayer.RevokeManagedSeats(id, false)
		return c.JSON(fiber.Map{"temporaryPassword": password})
	})
	s.app.Post("/api/account/admin/users/:id/delete", func(c *fiber.Ctx) error {
		id, err := strconv.ParseInt(c.Params("id"), 10, 64)
		if err != nil {
			return accountError(c, 400, "Invalid user")
		}
		user, err := s.config.Accounts.User(id)
		if err != nil {
			return accountError(c, 404, "User not found")
		}
		if user.Admin {
			return accountError(c, 403, "The configured admin cannot be deleted")
		}
		var request struct {
			Confirm bool `json:"confirm"`
		}
		if len(c.Body()) > 8192 || json.Unmarshal(c.Body(), &request) != nil || !request.Confirm {
			return accountError(c, 400, "Confirm permanent deletion")
		}
		if err = s.config.Accounts.DeleteManaged(id); err != nil {
			return accountError(c, 503, "Unable to delete user")
		}
		s.multiplayer.RevokeManagedSeats(id, true)
		s.config.CleanupAvatars()
		return c.JSON(fiber.Map{"ok": true})
	})
}
