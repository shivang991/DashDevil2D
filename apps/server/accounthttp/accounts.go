package accounthttp

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"sync"
	"time"

	fiber "github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
)

const sessionCookie = "__Host-dashdevil-session"

type loginAttempt struct {
	count int
	until time.Time
}
type accountAdmission struct {
	mu       sync.Mutex
	attempts map[string]loginAttempt
	hashing  chan struct{}
}

func (s *Server) accountRoutes() {
	s.adminRoutes()
	s.chatRoutes()
	s.app.Get("/api/account/history", func(c *fiber.Ctx) error {
		session, err := s.account(c)
		if err != nil {
			return accountError(c, 401, accounts.ErrSession.Error())
		}
		if session.MustChangePassword {
			return accountError(c, 403, "Change your temporary password first")
		}
		page, err := strconv.Atoi(c.Query("page", "0"))
		if err != nil || page < 0 || page > 1000000 {
			return accountError(c, 400, "Invalid history page")
		}
		result, err := s.config.Accounts.RaceHistory(session.User.ID, page)
		if err != nil {
			return accountError(c, 503, "Unable to load race history. Try again")
		}
		c.Set("Cache-Control", "no-store")
		return c.JSON(result)
	})
	s.app.Get("/api/account", func(c *fiber.Ctx) error {
		user, err := s.account(c)
		if err != nil {
			return accountError(c, 401, err.Error())
		}
		return c.JSON(user)
	})
	s.app.Post("/api/account/profile", s.updateProfile)
	s.app.Get("/api/account/avatars/:id", func(c *fiber.Ctx) error {
		if s.config.Accounts == nil {
			return c.SendStatus(404)
		}
		data, err := s.config.Accounts.Avatar(c.Params("id"))
		if err != nil {
			return c.SendStatus(404)
		}
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Content-Security-Policy", "default-src 'none'; sandbox")
		c.Type("png")
		return c.Send(data)
	})
	s.app.Post("/api/account/login", s.login)
	s.app.Post("/api/account/logout", func(c *fiber.Ctx) error {
		if !s.accountMutation(c) {
			return accountError(c, 403, "Request rejected")
		}
		id := accounts.TokenID(c.Cookies(sessionCookie))
		err := s.config.RevokeSession(id)
		if err != nil {
			return accountError(c, 503, "Unable to log out. Try again")
		}
		c.Cookie(&fiber.Cookie{Name: sessionCookie, Value: "", Path: "/", Secure: true, HTTPOnly: true, SameSite: "Strict", MaxAge: -1, Expires: time.Unix(1, 0)})
		return c.JSON(fiber.Map{"ok": true})
	})
	s.app.Post("/api/account/password", s.changePassword)
}
func accountError(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{"error": message})
}
func (s *Server) account(c *fiber.Ctx) (accounts.Session, error) {
	if s.config.Accounts == nil {
		return accounts.Session{}, accounts.ErrSession
	}
	return s.config.Accounts.Authenticate(c.Cookies(sessionCookie), s.config.Now())
}
func (s *Server) accountMutation(c *fiber.Ctx) bool {
	return c.Get("Origin") == s.config.Origin && strings.Split(c.Get("Content-Type"), ";")[0] == "application/json"
}
func setSession(c *fiber.Ctx, session accounts.Session, token string) error {
	c.Cookie(&fiber.Cookie{Name: sessionCookie, Value: token, Path: "/", Secure: true, HTTPOnly: true, SameSite: "Strict", MaxAge: int(accounts.Lifetime.Seconds()), Expires: session.Expires})
	return c.JSON(session)
}
func (s *Server) allowLogin(ip, username string) bool {
	a := &s.accountAdmission
	a.mu.Lock()
	defer a.mu.Unlock()
	now := s.config.Now()
	for key, value := range a.attempts {
		if !now.Before(value.until) {
			delete(a.attempts, key)
		}
	}
	if len(a.attempts) > 4096 {
		return false
	}
	keys := []string{"ip:" + ip, "user:" + strings.ToLower(username)}
	for i, key := range keys {
		limit := 100
		if i == 1 {
			limit = 10
		}
		if a.attempts[key].count >= limit {
			return false
		}
	}
	for _, key := range keys {
		v := a.attempts[key]
		if v.count == 0 {
			v.until = now.Add(15 * time.Minute)
		}
		v.count++
		a.attempts[key] = v
	}
	return true
}
func (s *Server) login(c *fiber.Ctx) error {
	if !s.accountMutation(c) {
		return accountError(c, 403, "Request rejected")
	}
	if s.config.Accounts == nil {
		return accountError(c, 503, "Accounts unavailable")
	}
	var request struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if len(c.Body()) > 8192 || json.Unmarshal(c.Body(), &request) != nil {
		return accountError(c, 400, "Enter a username and password")
	}
	if !s.allowLogin(c.IP(), request.Username) {
		c.Set("Retry-After", "900")
		return accountError(c, 429, "Too many login attempts. Try again in 15 minutes")
	}
	select {
	case s.accountAdmission.hashing <- struct{}{}:
		defer func() { <-s.accountAdmission.hashing }()
	default:
		return accountError(c, 429, "Login busy. Try again shortly")
	}
	session, token, err := s.config.Accounts.Login(request.Username, request.Password, s.config.Now())
	if err != nil {
		return accountError(c, 401, accounts.ErrCredentials.Error())
	}
	s.accountAdmission.mu.Lock()
	delete(s.accountAdmission.attempts, "user:"+strings.ToLower(request.Username))
	s.accountAdmission.mu.Unlock()
	// Logging in again creates an independent session; it never takes over other devices.
	return setSession(c, session, token)
}
func (s *Server) changePassword(c *fiber.Ctx) error {
	if !s.accountMutation(c) {
		return accountError(c, 403, "Request rejected")
	}
	s.config.Auth.Lock()
	defer s.config.Auth.Unlock()
	session, err := s.account(c)
	if err != nil {
		return accountError(c, 401, accounts.ErrSession.Error())
	}
	var request struct {
		Password        string `json:"password"`
		CurrentPassword string `json:"currentPassword"`
	}
	if len(c.Body()) > 16384 || json.Unmarshal(c.Body(), &request) != nil {
		return accountError(c, 400, "Enter a new password")
	}
	select {
	case s.accountAdmission.hashing <- struct{}{}:
		defer func() { <-s.accountAdmission.hashing }()
	default:
		return accountError(c, 429, "Password change busy. Try again shortly")
	}
	if !session.MustChangePassword {
		if !s.allowLogin(c.IP(), session.Username) {
			return accountError(c, 429, "Too many attempts. Try again in 15 minutes")
		}
		next, err := s.config.Accounts.ChangePassword(session.ID, request.CurrentPassword, request.Password, s.config.Now())
		if err != nil {
			return accountError(c, 400, err.Error())
		}
		s.multiplayer.RevokeSeats("", session.User.ID, session.ID)
		return c.JSON(next)
	}
	next, token, err := s.config.Accounts.ChangeTemporaryPassword(session.ID, request.Password, s.config.Now())
	if err != nil {
		return accountError(c, 400, err.Error())
	}
	s.multiplayer.RevokeSeats("", session.User.ID, "")
	return setSession(c, next, token)
}

func (s *Server) updateProfile(c *fiber.Ctx) error {
	if !s.accountMutation(c) {
		return accountError(c, 403, "Request rejected")
	}
	s.config.Auth.Lock()
	defer s.config.Auth.Unlock()
	session, err := s.account(c)
	if err != nil {
		return accountError(c, 401, accounts.ErrSession.Error())
	}
	if session.MustChangePassword {
		return accountError(c, 403, "Change your temporary password first")
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
	next, err := s.config.Accounts.UpdateProfile(session.ID, request.Username, avatar, s.config.Now())
	if err != nil {
		status := 400
		if errors.Is(err, accounts.ErrUsernameConflict) {
			status = 409
		}
		return accountError(c, status, err.Error())
	}
	s.multiplayer.PublishProfile(next.User)
	s.config.CleanupAvatars()
	return c.JSON(next)
}
