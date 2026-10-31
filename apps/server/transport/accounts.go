package transport

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
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
		err := s.RevokeSession(id)
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
	s.authMu.Lock()
	defer s.authMu.Unlock()
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
		s.mu.Lock()
		changed := s.revokeSeatsLocked(func(seat *seat) bool { return seat.accountID == session.User.ID && seat.accountSession != session.ID }, s.nowTime())
		s.mu.Unlock()
		for _, r := range changed {
			s.broadcast(r)
		}
		return c.JSON(next)
	}
	next, token, err := s.config.Accounts.ChangeTemporaryPassword(session.ID, request.Password, s.config.Now())
	if err != nil {
		return accountError(c, 400, err.Error())
	}
	s.mu.Lock()
	changed := s.revokeSeatsLocked(func(seat *seat) bool { return seat.accountID == session.User.ID }, s.nowTime())
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
	return setSession(c, next, token)
}

// RevokeSession is the shared logout/reset/deletion seam. The argument is the
// internal session ID, never a client-supplied seat identity. Callers must use
// this server seam so revoking login also removes every seat and unused ticket.
func (s *Server) RevokeSession(id string) error {
	s.authMu.Lock()
	defer s.authMu.Unlock()
	if s.config.Accounts == nil {
		return accounts.ErrSession
	}
	if err := s.config.Accounts.Revoke(id); err != nil {
		return err
	}
	s.mu.Lock()
	changed := s.revokeSeatsLocked(func(seat *seat) bool { return seat.accountSession == id }, s.nowTime())
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
	return nil
}
func (s *Server) RevokeAccountSessions(accountID int64) error {
	s.authMu.Lock()
	defer s.authMu.Unlock()
	if s.config.Accounts == nil {
		return accounts.ErrSession
	}
	if err := s.config.Accounts.RevokeAccount(accountID); err != nil {
		return err
	}
	s.mu.Lock()
	changed := s.revokeSeatsLocked(func(seat *seat) bool { return seat.accountID == accountID }, s.nowTime())
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
	return nil
}
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
			for key, t := range s.tickets {
				if t.seat == seat {
					delete(s.tickets, key)
				}
			}
			if seat.leaving.IsZero() {
				seat.leaving = at
			}
			seat.connected = false
			seat.ready = false
			if seat.pair != nil {
				go seat.pair.close("Session expired or revoked")
			}
		}
		if modified {
			// All affected seats are marked before resolving; same-session opponents
			// depart together and produce abandonment, never an iteration-order winner.
			if r.phase != 2 {
				for i, seat := range r.seats {
					if seat != nil && matches(seat) {
						s.removeSeatLocked(r, uint8(i))
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

func (s *Server) updateProfile(c *fiber.Ctx) error {
	if !s.accountMutation(c) {
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
	s.mu.Lock()
	var changed []*room
	for _, r := range s.rooms {
		modified := false
		for _, seat := range r.seats {
			if seat != nil && seat.accountID == next.User.ID {
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
	s.cleanupAvatars()
	for _, r := range changed {
		s.broadcast(r)
	}
	return c.JSON(next)
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
func (s *Server) avatarCleanupLoop() {
	defer close(s.avatarCleanupDone)
	for {
		select {
		case <-s.stop:
			return
		case <-s.avatarCleanup:
			s.authMu.Lock()
			s.cleanupAvatars()
			s.authMu.Unlock()
		}
	}
}

// Caller holds authMu, preventing a profile change between snapshot and deletion.
func (s *Server) cleanupAvatars() {
	if s.config.Accounts == nil {
		return
	}
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
	if err := s.config.Accounts.CleanupAvatars(retained); err != nil {
		s.config.Logger.Error("avatar_cleanup", "error", err)
	}
}
