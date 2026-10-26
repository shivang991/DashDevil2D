// Package transport owns the Stage 4 diagnostic admission and connection pair.
// Diagnostic state is deliberately stationary; gameplay authority belongs to #28.
package transport

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"

	"errors"
	"fmt"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
	"log/slog"
	"math"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	wt "github.com/quic-go/webtransport-go"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

const frameLimit = 65536

// Config uses one hostname/port for TCP HTTPS and UDP HTTP/3. Local tests may
// request port zero; the UDP listener then binds the allocated TCP port.
type Config struct {
	RoomLimit                                                                    int // zero selects the default 50-room admission limit
	Address, Origin, Certificate, Key, QUICCertificate, QUICKey, StaticDirectory string
	Logger                                                                       *slog.Logger
	Now                                                                          func() time.Time       // authoritative clock; nil uses time.Now
	CodeStart                                                                    func() (uint16, error) // nil uses cryptographic randomness
	Diagnostic                                                                   bool
	DragRaceOverrides                                                            []byte
	RoadRageOverrides                                                            []byte
}
type Server struct {
	draining      bool
	drainComplete bool
	drainDeadline time.Time
	drainClosing  time.Time
	config        Config
	mu            sync.Mutex // serializes room, admission and pair ownership; never hold across I/O
	rooms         map[string]*room
	credentials   map[string]*seat
	tickets       map[string]ticket
	nextID        uint32
	start         time.Time
	app           *fiber.App
	webtransport  *wt.Server
	tcp           net.Listener
	udp           net.PacketConn
	stop          chan struct{}
	closeOnce     sync.Once
	errors        chan error
}
type room struct {
	engine          *simulation.Engine
	history         []raceRecord
	outcome         *p.Outcome
	outcomeSessions [2]uint32
	primed          [2]bool
	inputs          [2]map[uint32]p.Input
	phase           uint8
	roundID         uint32
	startUs         uint64
	seed            uint32
	zero            *p.Baseline
	settings        configuration.Configuration

	id       uint32
	code     string
	seats    [2]*seat
	revision uint32
	host     uint8
	mode     uint8
	idle     time.Time
}
type seat struct {
	room             *room
	index            uint8
	session          uint32
	name             string
	credential       []byte
	generation       uint32
	pair             *pair
	deadline         time.Time
	leaving          time.Time
	connected, ready bool
	focused          bool
	installedRound   uint32
	inputGeneration  uint32
}
type ticket struct {
	seat            *seat
	generation      uint32
	channel, origin string
	expires         time.Time
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
	u, err := url.Parse(config.Origin)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return nil, errors.New("one explicit HTTPS website origin is required")
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	if config.Address == "" {
		config.Address = ":443"
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
	return &Server{config: config, rooms: map[string]*room{}, credentials: map[string]*seat{}, tickets: map[string]ticket{}, start: config.Now(), stop: make(chan struct{}), errors: make(chan error, 2)}, nil
}
func (s *Server) nowUs() uint64 { return uint64(max(0, s.config.Now().Sub(s.start).Microseconds())) }

// Room event times share the wire protocol's integer-microsecond clock.
func (s *Server) nowTime() time.Time   { return s.start.Add(time.Duration(s.nowUs()) * time.Microsecond) }
func (s *Server) URL() string          { return "https://" + s.tcp.Addr().String() }
func (s *Server) Errors() <-chan error { return s.errors }
func (s *Server) Start() error {
	cert, err := tls.LoadX509KeyPair(s.config.Certificate, s.config.Key)
	if err != nil {
		return err
	}
	quicCert := cert
	if s.config.QUICCertificate != "" {
		quicCert, err = tls.LoadX509KeyPair(s.config.QUICCertificate, s.config.QUICKey)
		if err != nil {
			return err
		}
	}
	s.tcp, err = net.Listen("tcp", s.config.Address)
	if err != nil {
		return err
	}
	s.udp, err = net.ListenPacket("udp", s.tcp.Addr().String())
	if err != nil {
		s.tcp.Close()
		return err
	}
	s.app = fiber.New(fiber.Config{DisableStartupMessage: true, BodyLimit: frameLimit, ReadTimeout: 5 * time.Second, WriteTimeout: time.Second, IdleTimeout: 30 * time.Second})
	s.app.Use(func(c *fiber.Ctx) error {
		c.Set("Cache-Control", "no-store")
		c.Set("Referrer-Policy", "no-referrer")
		from := c.Get("Origin")
		if from != "" && from != s.config.Origin {
			return s.failure(c, 403, 2, "Admission rejected")
		}
		if from == s.config.Origin {
			c.Set("Access-Control-Allow-Origin", s.config.Origin)
			c.Set("Vary", "Origin")
			c.Set("Access-Control-Allow-Headers", "Content-Type")
			c.Set("Access-Control-Expose-Headers", "X-Room-Code")
			c.Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		}
		if c.Method() == "OPTIONS" {
			return c.SendStatus(204)
		}
		return c.Next()
	})
	s.app.Post("/admission", s.admission)
	s.app.Get("/room", func(c *fiber.Ctx) error {
		if c.Get("Origin") != s.config.Origin || !websocket.IsWebSocketUpgrade(c) {
			return s.failure(c, 403, 2, "Admission rejected")
		}
		pair, err := s.consume(c.Query("ticket"), "room", c.Get("Origin"))
		if err != nil {
			return s.failure(c, 403, 2, "Admission rejected")
		}
		c.Locals("pair", pair)
		return c.Next()
	}, websocket.New(s.roomSocket, websocket.Config{Origins: []string{s.config.Origin}, ReadBufferSize: 4096, WriteBufferSize: 4096}))
	if s.config.StaticDirectory != "" {
		s.app.Static("/", s.config.StaticDirectory)
	}
	mux := http.NewServeMux()
	s.webtransport = &wt.Server{Config: &wt.Config{MaxIncomingStreams: 1, MaxIncomingUniStreams: 1, MaxIncomingData: 262144}, H3: &http3.Server{TLSConfig: &tls.Config{Certificates: []tls.Certificate{quicCert}, MinVersion: tls.VersionTLS13, NextProtos: []string{http3.NextProtoH3}}, Handler: mux, QUICConfig: &quic.Config{EnableDatagrams: true, EnableStreamResetPartialDelivery: true, MaxIncomingStreams: 8, MaxIncomingUniStreams: 8, MaxIdleTimeout: 10 * time.Second, InitialStreamReceiveWindow: 65536, MaxStreamReceiveWindow: 65536, InitialConnectionReceiveWindow: 262144, MaxConnectionReceiveWindow: 262144}}, CheckOrigin: func(r *http.Request) bool { return r.Header.Get("Origin") == s.config.Origin }}
	mux.HandleFunc("/gameplay", s.gameplay)
	go func() {
		err := s.app.Listener(tls.NewListener(s.tcp, &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}))
		select {
		case <-s.stop:
		default:
			s.errors <- err
		}
	}()
	go func() {
		err := s.webtransport.Serve(s.udp)
		select {
		case <-s.stop:
		default:
			s.errors <- err
		}
	}()
	go s.sweep()
	return nil
}
func (s *Server) Close() {
	s.closeOnce.Do(func() {
		close(s.stop)
		s.mu.Lock()
		var pairs []*pair
		for _, r := range s.rooms {
			for _, seat := range r.seats {
				if seat != nil && seat.pair != nil {
					pairs = append(pairs, seat.pair)
				}
			}
		}
		s.mu.Unlock()
		for _, pair := range pairs {
			pair.close("server shutdown")
		}
		if s.webtransport != nil {
			s.webtransport.Close()
		}
		if s.udp != nil {
			s.udp.Close()
		}
		if s.app != nil {
			s.app.Shutdown()
		}
		if s.tcp != nil {
			s.tcp.Close()
		}
	})
}
func (s *Server) failure(c *fiber.Ctx, status int, code uint8, detail string) error {
	wire, _ := p.EncodeMessage(p.ProtocolError{Code: code, ExpectedVersion: p.ProtocolVersion, Detail: detail}, frameLimit)
	c.Type("bin")
	return c.Status(status).Send(wire)
}
func randomBytes() ([]byte, error) { b := make([]byte, 32); _, err := rand.Read(b); return b, err }
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
func (s *Server) admission(c *fiber.Ctx) error {
	if c.Get("Origin") != s.config.Origin {
		return s.failure(c, 403, 2, "Admission rejected")
	}
	message, err := p.DecodeMessage(c.Body(), frameLimit)
	if err != nil {
		return s.failure(c, 400, 3, "Malformed admission")
	}
	request, ok := message.(p.AdmissionRequest)
	if !ok {
		return s.failure(c, 400, 3, "Admission request required")
	}
	if request.Version != p.ProtocolVersion {
		return s.failure(c, 409, 1, "Incompatible protocol version")
	}
	credential, err := randomBytes()
	if err != nil {
		return s.failure(c, 503, 2, "Unable to connect")
	}
	roomTicket, err := randomBytes()
	if err != nil {
		return s.failure(c, 503, 2, "Unable to connect")
	}
	gameplayTicket, err := randomBytes()
	if err != nil {
		return s.failure(c, 503, 2, "Unable to connect")
	}
	s.mu.Lock()
	now := s.nowTime()
	changedRooms := s.expireLocked(now)
	defer func() {
		for _, r := range changedRooms {
			s.broadcast(r)
		}
	}()
	var participant *seat
	switch request.Operation {
	case 0, 1:
		if s.draining {
			s.mu.Unlock()
			return s.failure(c, 503, 8, maintenanceMessage)
		}
		if len(request.Credential) != 0 || len(request.Name) == 0 || len(request.Name) > 128 || !utf8.ValidString(request.Name) {
			s.mu.Unlock()
			return s.failure(c, 400, 2, "Invalid admission")
		}
		var r *room
		if request.Operation == 0 {
			if request.Code != "" {
				s.mu.Unlock()
				return s.failure(c, 400, 2, "Invalid room code")
			}
			if len(s.rooms) >= s.config.RoomLimit {
				s.config.Logger.Info("capacity_rejected", "rooms", len(s.rooms), "limit", s.config.RoomLimit)
				s.mu.Unlock()
				return s.failure(c, 503, 4, "Server full. Try again later.")
			}
			n, e := s.config.CodeStart()
			if e != nil || n >= 10000 {
				s.mu.Unlock()
				return s.failure(c, 503, 2, "Unable to connect")
			}
			code := ""
			for i := 0; i < 10000; i++ {
				candidate := fmt.Sprintf("%04d", (int(n)+i)%10000)
				if s.rooms[candidate] == nil {
					code = candidate
					break
				}
			}
			if code == "" {
				s.mu.Unlock()
				return s.failure(c, 503, 4, "No rooms available")
			}
			if s.nextID == math.MaxUint32 {
				s.mu.Unlock()
				return s.failure(c, 503, 2, "Identity exhausted")
			}
			s.nextID++
			r = &room{id: s.nextID, code: code, revision: 1, mode: 1, idle: now.Add(15 * time.Minute)}
			mode := uint8(1)
			if c.Query("mode") == "2" {
				mode = 2
			} else if c.Query("mode") != "" && c.Query("mode") != "1" {
				s.mu.Unlock()
				return s.failure(c, 400, 2, "Invalid mode")
			}
			r.mode = mode
			r.roundID = 1
			r.seed, err = newTrackSeed()
			if err != nil {
				s.mu.Unlock()
				return s.failure(c, 503, 2, "Unable to connect")
			}
			modeName := "drag-race"
			if mode == 2 {
				modeName = "road-rage"
			}
			definition := []byte(p.DefaultConfigurationJSON)
			r.settings, err = configuration.Capture(definition, modeName, s.roundOverrides(mode))
			if err != nil {
				s.mu.Unlock()
				return s.failure(c, 503, 2, "Invalid configuration")
			}
			s.rooms[code] = r
		} else {
			if len(request.Code) != 4 {
				s.mu.Unlock()
				return s.failure(c, 400, 2, "Invalid room code")
			}
			for _, v := range request.Code {
				if v < '0' || v > '9' {
					s.mu.Unlock()
					return s.failure(c, 400, 2, "Invalid room code")
				}
			}
			r = s.rooms[request.Code]
			if r == nil {
				s.mu.Unlock()
				return s.failure(c, 404, 5, "Room not found")
			}
		}
		if r.phase == 1 || r.phase == 2 {
			s.mu.Unlock()
			return s.failure(c, 409, 6, "Round in progress")
		}
		index := uint8(0)
		if r.seats[0] != nil {
			index = 1
		}
		if r.seats[index] != nil {
			s.mu.Unlock()
			return s.failure(c, 409, 6, "Room full")
		}
		if s.nextID == math.MaxUint32 {
			s.mu.Unlock()
			return s.failure(c, 503, 2, "Identity exhausted")
		}
		s.nextID++
		participant = &seat{room: r, index: index, session: s.nextID, name: request.Name, focused: true, credential: credential, deadline: now.Add(roomDuration(r, "reconnectGrace"))}
		if r.phase == 3 {
			r.phase = 0
		}
		for _, other := range r.seats {
			if other != nil {
				other.ready = false
			}
		}
		r.seats[index] = participant
		r.idle = now.Add(roomDuration(r, "idleExpiry"))
		s.credentials[token(credential)] = participant
	case 2:
		if len(request.Credential) != 32 {
			s.mu.Unlock()
			return s.failure(c, 403, 2, "Admission rejected")
		}
		participant = s.credentials[token(request.Credential)]
		if participant == nil || !participant.leaving.IsZero() || (!participant.deadline.IsZero() && !now.Before(participant.deadline)) {
			s.mu.Unlock()
			return s.failure(c, 410, 7, "Room expired")
		}
	default:
		s.mu.Unlock()
		return s.failure(c, 400, 2, "Invalid admission")
	}
	if participant.generation == math.MaxUint32 || participant.inputGeneration == math.MaxUint32 {
		s.mu.Unlock()
		return s.failure(c, 409, 2, "Connection generation exhausted")
	}
	old := participant.pair
	// Ticket issuance alone cannot extend an existing disconnected reservation.
	if participant.deadline.IsZero() {
		participant.deadline = now.Add(roomDuration(participant.room, "reconnectGrace"))
	}
	s.cancelCountdownLocked(participant.room)
	participant.connected = false
	participant.ready = false
	for _, other := range participant.room.seats {
		if other != nil {
			other.ready = false
		}
	}
	participant.generation++
	participant.inputGeneration++
	pair := newPair(s, participant)
	participant.pair = pair
	if r := participant.room; r.phase == 2 && r.engine != nil {
		r.engine.ResetSeat(pair.identity, participant.inputGeneration, 0)
		r.primed[participant.index] = false
	}
	for key, t := range s.tickets {
		if t.seat == participant {
			delete(s.tickets, key)
		}
	}
	expires := now.Add(30 * time.Second)
	s.tickets[token(roomTicket)] = ticket{participant, participant.generation, "room", s.config.Origin, expires}
	s.tickets[token(gameplayTicket)] = ticket{participant, participant.generation, "gameplay", s.config.Origin, expires}
	response := p.Admission{Version: p.ProtocolVersion, Identity: pair.identity, Credential: participant.credential, RoomTicket: roomTicket, GameplayTicket: gameplayTicket, ExpiresUs: s.nowUs() + 30000000, Origin: s.config.Origin}
	code := participant.room.code
	s.mu.Unlock()
	if old != nil {
		old.close("replaced")
	}
	s.broadcast(participant.room)
	wire, err := p.EncodeMessage(response, frameLimit)
	if err != nil {
		return s.failure(c, 500, 2, "Unable to connect")
	}
	c.Set("X-Room-Code", code)
	c.Type("bin")
	return c.Status(201).Send(wire)
}
func (s *Server) consume(key, channel, origin string) (*pair, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.tickets[key]
	if !ok || t.channel != channel || t.origin != origin || !s.nowTime().Before(t.expires) || t.seat.generation != t.generation || t.seat.pair == nil || t.seat.room.seats[t.seat.index] != t.seat || !t.seat.leaving.IsZero() || (!t.seat.deadline.IsZero() && !s.nowTime().Before(t.seat.deadline)) {
		return nil, errors.New("admission rejected")
	}
	delete(s.tickets, key)
	return t.seat.pair, nil
}
func (s *Server) expireLocked(now time.Time) []*room {
	var changed []*room
	for code, r := range s.rooms {
		modified := false
		s.resolveDeparturesLocked(r, now)
		idleExpired := (r.phase == 0 || r.phase == 3) && !now.Before(r.idle)
		for i, participant := range r.seats {
			if participant == nil {
				continue
			}
			expired := !participant.deadline.IsZero() && !now.Before(participant.deadline)
			leaving := !participant.leaving.IsZero()
			// Keep every active equal-time departure group open until its instant closes.
			if r.phase == 2 && !earliestDeparture(r).IsZero() && !now.After(earliestDeparture(r)) {
				continue
			}
			if expired || leaving || idleExpired {
				s.removeSeatLocked(r, uint8(i))
				modified = true
				reason := "Reconnect grace expired"
				if idleExpired {
					reason = "Room expired"
				} else if leaving {
					reason = "explicit leave"
				}
				if participant.pair != nil {
					go participant.pair.close(reason)
				}
			}
		}
		if modified {
			r.revision++
			changed = append(changed, r)
		}
		if r.seats[r.host] == nil {
			r.host = 1 - r.host
		}
		if r.seats[0] == nil && r.seats[1] == nil {
			delete(s.rooms, code)
		}
	}
	for key, t := range s.tickets {
		if !now.Before(t.expires) {
			delete(s.tickets, key)
		}
	}
	return changed
}
func (s *Server) sweep() {
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			s.mu.Lock()
			now := s.nowTime()
			changed := s.advanceCountdownsLocked()
			changed = append(changed, s.advanceRacesLocked()...)
			changed = append(changed, s.expireLocked(now)...)
			maintenanceChanged, closingPairs := s.advanceMaintenanceLocked(now)
			changed = append(changed, maintenanceChanged...)
			s.mu.Unlock()
			for _, r := range changed {
				s.broadcast(r)
			}
			for _, pair := range closingPairs {
				pair.close("Server maintenance")
			}
		}
	}
}

func (s *Server) roundOverrides(mode uint8) []byte {
	if mode == 1 {
		return s.config.DragRaceOverrides
	}
	if mode == 2 {
		return s.config.RoadRageOverrides
	}
	return nil
}
