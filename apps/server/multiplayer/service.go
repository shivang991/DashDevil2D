package multiplayer

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
)

// Config supplies immutable settings and the process authentication ordering lock.
type Config struct {
	Accounts                             *accounts.Store
	Auth                                 *sync.Mutex
	RoomLimit                            int
	Logger                               *slog.Logger
	Now                                  func() time.Time
	CodeStart                            func() (uint16, error)
	Diagnostic                           bool
	DragRaceOverrides, RoadRageOverrides []byte
	// Called under room ownership: allocate only; no I/O or multiplayer callbacks.
	NewConnection func(Handle, p.Identity, p.Connection) Delivery
}
type Server struct {
	chatRounds      []accounts.SharedRound
	chatRun         string
	chatDone        chan struct{}
	sweepDone       chan struct{}
	historyPrefix   string
	historySequence uint64
	historyWrites   []historyWrite
	historyFailed   bool
	historyDone     chan struct{}
	avatarCleanup   chan struct{}
	draining        bool
	drainComplete   bool
	drainDeadline   time.Time
	drainClosing    time.Time
	config          Config
	mu              sync.Mutex // serializes room, admission and connection ownership; never hold across I/O
	rooms           map[string]*room
	credentials     map[string]*seat
	nextID          uint32
	start           time.Time
	stop            chan struct{}
	closeOnce       sync.Once
}
type room struct {
	invitationEpoch                   uint64
	historyID                         string
	historyStarting, historyFinishing bool
	racers                            [2]p.RacerIdentity
	engine                            *simulation.Engine
	history                           []raceRecord
	outcome                           *p.Outcome
	outcomeSessions                   [2]uint32
	primed                            [2]bool
	inputs                            [2]map[uint32]p.Input
	phase                             p.RoomPhase
	roundID                           uint32
	startUs                           uint64
	seed                              uint32
	zero                              *p.Baseline
	settings                          configuration.Configuration

	id       uint32
	code     string
	seats    [2]*seat
	revision uint32
	host     p.SeatIndex
	mode     p.Mode
	idle     time.Time
}
type seat struct {
	accountSession   string
	accountID        int64
	accountChatID    int64
	accountExpires   time.Time
	room             *room
	index            p.SeatIndex
	session          uint32
	savedName        string
	savedAvatar      string
	avatar           string
	name             string
	credential       []byte
	generation       uint32
	connection       *connection
	deadline         time.Time
	leaving          time.Time
	connected, ready bool
	returned         bool
	focused          bool
	installedRound   uint32
	inputGeneration  uint32
}

func New(config Config) (*Server, error) {
	if config.RoomLimit == 0 {
		config.RoomLimit = 50
	}
	if config.RoomLimit < 1 || config.RoomLimit > 10000 {
		return nil, errors.New("room limit must be between 1 and 10000")
	}
	if len(config.DragRaceOverrides) > 0 {
		if _, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "drag-race", config.DragRaceOverrides); err != nil {
			return nil, err
		}
	}
	config.DragRaceOverrides = append([]byte(nil), config.DragRaceOverrides...)
	if len(config.RoadRageOverrides) > 0 {
		if _, err := configuration.Capture([]byte(p.DefaultConfigurationJSON), "road-rage", config.RoadRageOverrides); err != nil {
			return nil, err
		}
	}
	config.RoadRageOverrides = append([]byte(nil), config.RoadRageOverrides...)
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	if config.Auth == nil {
		config.Auth = &sync.Mutex{}
	}
	if config.CodeStart == nil {
		config.CodeStart = func() (uint16, error) {
			n, err := rand.Int(rand.Reader, big.NewInt(10000))
			if err != nil {
				return 0, err
			}
			return uint16(n.Uint64()), nil
		}
	}
	if config.Now == nil {
		config.Now = time.Now
	}
	prefix, err := randomBytes()
	if err != nil {
		return nil, err
	}
	return &Server{chatRun: rand.Text(), historyPrefix: token(prefix), avatarCleanup: make(chan struct{}, 1), config: config, rooms: map[string]*room{}, credentials: map[string]*seat{}, start: config.Now(), stop: make(chan struct{})}, nil
}
func (s *Server) nowUs() uint64 { return uint64(max(0, s.config.Now().Sub(s.start).Microseconds())) }

// Room event times share the wire protocol's integer-microsecond clock.
func (s *Server) nowTime() time.Time { return s.start.Add(time.Duration(s.nowUs()) * time.Microsecond) }
func randomBytes() ([]byte, error)   { b := make([]byte, 32); _, err := rand.Read(b); return b, err }
func newTrackSeed() (uint32, error) {
	var bytes [4]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return 0, err
	}
	value := binary.BigEndian.Uint32(bytes[:])
	if value == 0 {
		value = 1
	}
	return value, nil
}
func token(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }
func (s *Server) roundOverrides(mode p.Mode) []byte {
	if mode == p.ModeDragRace {
		return s.config.DragRaceOverrides
	}
	if mode == p.ModeRoadRage {
		return s.config.RoadRageOverrides
	}
	return nil
}
