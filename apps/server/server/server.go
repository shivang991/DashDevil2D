// Package server constructs modules and coordinates authentication and lifecycle.
package server

import (
	"log/slog"
	"net/http"
	"strconv"
	"sync"
	"time"

	fiber "github.com/gofiber/fiber/v2"
	"github.com/shivang991/DashDevil2D/apps/server/accounthttp"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	"github.com/shivang991/DashDevil2D/apps/server/multiplayer"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
)

type Config struct {
	Accounts                                                                     *accounts.Store // required for product admission; diagnostic is stationary only
	RoomLimit                                                                    int             // zero selects the default 50-room admission limit
	Address, Origin, Certificate, Key, QUICCertificate, QUICKey, StaticDirectory string
	Logger                                                                       *slog.Logger
	Now                                                                          func() time.Time       // authoritative clock; nil uses time.Now
	CodeStart                                                                    func() (uint16, error) // nil uses cryptographic randomness
	Diagnostic                                                                   bool
	DragRaceOverrides                                                            []byte
	RoadRageOverrides                                                            []byte
}

type MaintenanceStatus = multiplayer.MaintenanceStatus
type Server struct {
	config     Config
	rooms      *multiplayer.Server
	network    *transport.Server
	authMu     sync.Mutex
	stop       chan struct{}
	avatarDone chan struct{}
	closeOnce  sync.Once
	errors     chan error
	operatorMu sync.Mutex
	operators  []*http.Server
}

func New(config Config) (*Server, error) {
	if config.Now == nil {
		config.Now = time.Now
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	s := &Server{config: config, stop: make(chan struct{})}
	rooms, err := multiplayer.New(multiplayer.Config{
		Accounts:          config.Accounts,
		Auth:              &s.authMu,
		RoomLimit:         config.RoomLimit,
		Logger:            config.Logger,
		Now:               config.Now,
		CodeStart:         config.CodeStart,
		Diagnostic:        config.Diagnostic,
		DragRaceOverrides: config.DragRaceOverrides,
		RoadRageOverrides: config.RoadRageOverrides,
		NewConnection: func(h multiplayer.Handle, id p.Identity, limits p.Connection) multiplayer.Delivery {
			return s.network.NewConnection(h, id, limits)
		},
	})
	if err != nil {
		return nil, err
	}
	s.rooms = rooms
	network, err := transport.New(transport.Config{
		Address:             config.Address,
		Origin:              config.Origin,
		Certificate:         config.Certificate,
		Key:                 config.Key,
		QUICCertificate:     config.QUICCertificate,
		QUICKey:             config.QUICKey,
		StaticDirectory:     config.StaticDirectory,
		Logger:              config.Logger,
		Now:                 config.Now,
		Diagnostic:          config.Diagnostic,
		Auth:                &s.authMu,
		NowUs:               rooms.NowUs,
		Admit:               s.admit,
		AuthenticateSession: s.authenticateSession,
		Routes: func(app *fiber.App) {
			accounthttp.Register(app, accounthttp.Config{
				Accounts:       config.Accounts,
				Origin:         config.Origin,
				Now:            config.Now,
				Auth:           &s.authMu,
				RevokeSession:  s.RevokeSession,
				CleanupAvatars: s.cleanupAvatars,
			}, rooms)
		},
	})
	if err != nil {
		return nil, err
	}
	s.network = network
	s.errors = make(chan error, 2)
	return s, nil
}
func (s *Server) Start() error {
	if err := s.rooms.Start(); err != nil {
		return err
	}
	if err := s.network.Start(); err != nil {
		s.rooms.Close()
		return err
	}
	s.avatarDone = make(chan struct{})
	s.authMu.Lock()
	s.cleanupAvatars()
	s.authMu.Unlock()
	go s.avatarCleanupLoop()
	go func() {
		select {
		case err := <-s.network.Errors():
			select {
			case s.errors <- err:
			case <-s.stop:
			}
		case <-s.stop:
		}
	}()
	return nil
}
func (s *Server) Close() {
	s.closeOnce.Do(func() {
		close(s.stop)
		s.operatorMu.Lock()
		for _, operator := range s.operators {
			operator.Close()
		}
		s.operatorMu.Unlock()
		s.network.Close()
		s.rooms.Close()
		if s.avatarDone != nil {
			<-s.avatarDone
		}
	})
}
func (s *Server) URL() string                            { return s.network.URL() }
func (s *Server) Errors() <-chan error                   { return s.errors }
func (s *Server) Ready() bool                            { return s.network.Ready() && s.rooms.Ready() }
func (s *Server) BeginDrain(timeout time.Duration) error { return s.rooms.BeginDrain(timeout) }
func (s *Server) Maintenance() MaintenanceStatus         { return s.rooms.Maintenance() }
func (s *Server) authenticateSession(id string) error {
	if s.config.Diagnostic {
		return nil
	}
	if s.config.Accounts == nil {
		return accounts.ErrSession
	}
	session, err := s.config.Accounts.Session(id, s.config.Now())
	if err != nil {
		return err
	}
	if session.MustChangePassword {
		return accounts.ErrSession
	}
	return nil
}
func (s *Server) RevokeSession(id string) error {
	s.authMu.Lock()
	defer s.authMu.Unlock()
	if s.config.Accounts == nil {
		return accounts.ErrSession
	}
	if err := s.config.Accounts.Revoke(id); err != nil {
		return err
	}
	s.rooms.RevokeSeats(id, 0, "")
	return nil
}
func (s *Server) RevokeAccountSessions(id int64) error {
	s.authMu.Lock()
	defer s.authMu.Unlock()
	if s.config.Accounts == nil {
		return accounts.ErrSession
	}
	if err := s.config.Accounts.RevokeAccount(id); err != nil {
		return err
	}
	s.rooms.RevokeSeats("", id, "")
	return nil
}
func (s *Server) cleanupAvatars() {
	if s.config.Accounts == nil {
		return
	}
	if err := s.config.Accounts.CleanupAvatars(s.rooms.RetainedAvatars()); err != nil {
		s.config.Logger.Error("avatar_cleanup", "error", err)
	}
}
func (s *Server) avatarCleanupLoop() {
	defer close(s.avatarDone)
	for {
		select {
		case <-s.stop:
			return
		case <-s.rooms.AvatarCleanup():
			s.authMu.Lock()
			s.cleanupAvatars()
			s.authMu.Unlock()
		}
	}
}
func reject(status int, code p.ProtocolErrorCode, detail string) (multiplayer.AdmissionResult, error) {
	return multiplayer.AdmissionResult{}, &multiplayer.AdmissionError{Status: status, Code: code, Detail: detail}
}

// Hold auth ordering through durable lookup, room admission and invitation acceptance.
// Durable I/O never holds the multiplayer state mutex.
func (s *Server) admit(request p.AdmissionRequest, mode, cookie, challengeID string) (multiplayer.AdmissionResult, error) {
	s.authMu.Lock()
	defer s.authMu.Unlock()
	var account accounts.Session
	var chatID int64
	var challenge accounts.ChatChallenge
	var err error
	if !s.config.Diagnostic {
		if s.config.Accounts == nil {
			return reject(401, 2, "Session expired. Please log in again")
		}
		account, err = s.config.Accounts.Authenticate(cookie, s.config.Now())
		if err != nil {
			return reject(401, 2, "Session expired. Please log in again")
		}
		if account.MustChangePassword {
			return reject(403, 2, "Change your temporary password before multiplayer")
		}
		chatID, err = s.config.Accounts.ChatID(account.User.ID)
		if err != nil {
			return reject(503, 2, "Unable to connect")
		}
		if challengeID != "" {
			id, parseErr := strconv.ParseInt(challengeID, 10, 64)
			if parseErr != nil || request.Operation != p.AdmissionOperationJoin || request.Code != "" {
				return reject(400, 2, "Invalid challenge")
			}
			challenge, err = s.config.Accounts.ChatChallenge(id, chatID)
			if err != nil {
				return reject(404, 2, "Challenge unavailable")
			}
		}
		request.Name = account.Username
	}
	invitation := multiplayer.Invitation{ID: challenge.ID, Run: challenge.Run, RoomID: challenge.RoomID, Epoch: challenge.Epoch, Sender: challenge.Sender, Recipient: challenge.Recipient, ExpiresAt: challenge.ExpiresAt, Accepted: challenge.Accepted}
	result, err := s.rooms.Admit(request, mode, account, chatID, invitation)
	if err != nil {
		return result, err
	}
	if challenge.ID != 0 {
		if err := s.config.Accounts.AcceptChatChallenge(challenge.ID); err != nil {
			s.rooms.RollbackAdmission(result.Handle)
			return reject(503, 2, "Unable to accept challenge. Retry")
		}
	}
	return result, nil
}
