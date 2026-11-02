// Package accounthttp owns account, admin and chat HTTP translation.
package accounthttp

import (
	"sync"
	"time"

	fiber "github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	"github.com/shivang991/DashDevil2D/apps/server/multiplayer"
)

// Multiplayer exposes room-derived values and explicit identity publication.
type Multiplayer interface {
	RevokeSeats(string, int64, string)
	RevokeManagedSeats(int64, bool)
	PublishProfile(accounts.User)
	Presence(string, uint32) (int64, map[string]int)
	InvitationStatus(multiplayer.Invitation) string
	Invite(string, int64, int64, int64, uint32) (multiplayer.Invitation, error)
}
type Config struct {
	Accounts       *accounts.Store
	Origin         string
	Now            func() time.Time
	Auth           *sync.Mutex
	RevokeSession  func(string) error
	CleanupAvatars func()
}
type Server struct {
	config           Config
	multiplayer      Multiplayer
	app              *fiber.App
	accountAdmission accountAdmission
}

func Register(app *fiber.App, config Config, rooms Multiplayer) {
	s := &Server{app: app, config: config, multiplayer: rooms, accountAdmission: accountAdmission{attempts: map[string]loginAttempt{}, hashing: make(chan struct{}, 2)}}
	s.accountRoutes()
}
func invitation(v accounts.ChatChallenge) multiplayer.Invitation {
	return multiplayer.Invitation{ID: v.ID, Run: v.Run, RoomID: v.RoomID, Epoch: v.Epoch, Sender: v.Sender, Recipient: v.Recipient, ExpiresAt: v.ExpiresAt, Accepted: v.Accepted}
}
