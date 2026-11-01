// Package transport owns secure network delivery and bounded paired channels.
package transport

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	fiber "github.com/gofiber/fiber/v2"
	quic "github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	wt "github.com/quic-go/webtransport-go"
	"github.com/shivang991/DashDevil2D/apps/server/multiplayer"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

const frameLimit = p.DefaultFrameBytes

type Config struct {
	Auth                *sync.Mutex
	AuthenticateSession func(string) error
	Admit               func(p.AdmissionRequest, string, string, string) (multiplayer.AdmissionResult, error)
	Routes              func(*fiber.App)
	NowUs               func() uint64

	Address, Origin, Certificate, Key, QUICCertificate, QUICKey, StaticDirectory string
	Logger                                                                       *slog.Logger
	Now                                                                          func() time.Time // authoritative clock; nil uses time.Now
	Diagnostic                                                                   bool
}
type Server struct {
	config       Config
	mu           sync.Mutex
	tickets      map[string]ticket
	pairs        map[multiplayer.Handle]*pair
	app          *fiber.App
	webtransport *wt.Server
	tcp          net.Listener
	udp          net.PacketConn
	stop         chan struct{}
	closeOnce    sync.Once
	ticketDone   chan struct{}
	errors       chan error
}
type ticket struct {
	handle                   multiplayer.Handle
	session, channel, origin string
	expires                  time.Time
}

func New(config Config) (*Server, error) {
	u, err := url.Parse(config.Origin)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return nil, errors.New("one explicit HTTPS website origin is required")
	}
	if config.Address == "" {
		config.Address = ":443"
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	if config.Now == nil {
		config.Now = time.Now
	}
	return &Server{config: config, tickets: map[string]ticket{}, pairs: map[multiplayer.Handle]*pair{}, stop: make(chan struct{}), errors: make(chan error, 2)}, nil
}
func (s *Server) nowUs() uint64        { return s.config.NowUs() }
func (s *Server) URL() string          { return "https://" + s.tcp.Addr().String() }
func (s *Server) Errors() <-chan error { return s.errors }
func (s *Server) Ready() bool {
	select {
	case <-s.stop:
		return false
	default:
	}
	return s.tcp != nil && s.udp != nil
}
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
	s.app = fiber.New(fiber.Config{DisableStartupMessage: true, BodyLimit: 3 * 1024 * 1024, ReadTimeout: 5 * time.Second, WriteTimeout: time.Second, IdleTimeout: 30 * time.Second})
	s.app.Use(func(c *fiber.Ctx) error {
		c.Set("Cache-Control", "no-store")
		c.Set("Referrer-Policy", "no-referrer")
		from := c.Get("Origin")
		if from != "" && from != s.config.Origin {
			if strings.HasPrefix(c.Path(), "/api/account") {
				return c.Status(403).JSON(fiber.Map{"error": "Request rejected"})
			}
			return s.failure(c, 403, p.ProtocolErrorCodeAdmissionRejected, "Admission rejected")
		}
		if from == s.config.Origin {
			c.Set("Access-Control-Allow-Credentials", "true")
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
	if s.config.Routes != nil {
		s.config.Routes(s.app)
	}
	s.app.Post("/admission", s.admission)
	s.app.Get("/room", func(c *fiber.Ctx) error {
		if c.Get("Origin") != s.config.Origin || !websocket.IsWebSocketUpgrade(c) {
			return s.failure(c, 403, p.ProtocolErrorCodeAdmissionRejected, "Admission rejected")
		}
		pair, err := s.consume(c.Query("ticket"), "room", c.Get("Origin"))
		if err != nil {
			return s.failure(c, 403, p.ProtocolErrorCodeAdmissionRejected, "Admission rejected")
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
	s.ticketDone = make(chan struct{})
	go s.expireTickets()
	return nil
}
func (s *Server) Close() {
	s.closeOnce.Do(func() {
		close(s.stop)
		if s.ticketDone != nil {
			<-s.ticketDone
		}
		s.mu.Lock()
		pairs := make([]*pair, 0, len(s.pairs))
		for _, c := range s.pairs {
			pairs = append(pairs, c)
		}
		s.mu.Unlock()
		for _, c := range pairs {
			c.close("server shutdown")
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
func (s *Server) failure(c *fiber.Ctx, status int, code p.ProtocolErrorCode, detail string) error {
	wire, _ := p.EncodeMessage(p.ProtocolError{Code: code, ExpectedVersion: p.ProtocolVersion, Detail: detail}, frameLimit)
	c.Type("bin")
	return c.Status(status).Send(wire)
}
func randomBytes() ([]byte, error) { b := make([]byte, 32); _, err := rand.Read(b); return b, err }
func token(b []byte) string        { return base64.RawURLEncoding.EncodeToString(b) }
func (s *Server) admission(c *fiber.Ctx) error {
	if c.Get("Origin") != s.config.Origin {
		return s.failure(c, 403, p.ProtocolErrorCodeAdmissionRejected, "Admission rejected")
	}
	message, err := p.DecodeMessage(c.Body(), frameLimit)
	if err != nil {
		return s.failure(c, 400, p.ProtocolErrorCodeMalformedOrProcessingFailure, "Malformed admission")
	}
	request, ok := message.(p.AdmissionRequest)
	if !ok {
		return s.failure(c, 400, p.ProtocolErrorCodeMalformedOrProcessingFailure, "Admission request required")
	}
	if request.Version != p.ProtocolVersion {
		return s.failure(c, 409, p.ProtocolErrorCodeIncompatibleHandshake, "Incompatible protocol version")
	}

	roomTicket, err := randomBytes()
	if err != nil {
		return s.failure(c, 503, 2, "Unable to connect")
	}
	gameplayTicket, err := randomBytes()
	if err != nil {
		return s.failure(c, 503, 2, "Unable to connect")
	}
	result, err := s.config.Admit(request, c.Query("mode"), c.Cookies("__Host-dashdevil-session"), c.Query("challenge"))
	if err != nil {
		var rejection *multiplayer.AdmissionError
		if errors.As(err, &rejection) {
			return s.failure(c, rejection.Status, rejection.Code, rejection.Detail)
		}
		return s.failure(c, 503, 2, "Unable to connect")
	}
	s.mu.Lock()
	for key, t := range s.tickets {
		if !s.config.Now().Before(t.expires) || t.handle.Identity().SeatSession == result.Identity.SeatSession {
			delete(s.tickets, key)
		}
	}
	expires := s.config.Now().Add(30 * time.Second)
	s.tickets[token(roomTicket)] = ticket{result.Handle, result.Session, "room", s.config.Origin, expires}
	s.tickets[token(gameplayTicket)] = ticket{result.Handle, result.Session, "gameplay", s.config.Origin, expires}
	s.mu.Unlock()
	response := p.Admission{Version: p.ProtocolVersion, Identity: result.Identity, Credential: result.Credential, RoomTicket: roomTicket, GameplayTicket: gameplayTicket, ExpiresUs: s.nowUs() + 30000000, Origin: s.config.Origin}
	wire, err := p.EncodeMessage(response, frameLimit)
	if err != nil {
		return s.failure(c, 500, 2, "Unable to connect")
	}
	c.Set("X-Room-Code", result.Code)
	c.Type("bin")
	return c.Status(201).Send(wire)
}
func (s *Server) consume(key, channel, origin string) (*pair, error) {
	s.config.Auth.Lock()
	defer s.config.Auth.Unlock()
	s.mu.Lock()
	t, ok := s.tickets[key]
	s.mu.Unlock()
	if !ok || t.channel != channel || t.origin != origin || !s.config.Now().Before(t.expires) {
		return nil, errors.New("admission rejected")
	}
	if s.config.AuthenticateSession != nil {
		if err := s.config.AuthenticateSession(t.session); err != nil {
			return nil, err
		}
	}
	if !t.handle.Valid() {
		return nil, errors.New("admission rejected")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	c := s.pairs[t.handle]
	if _, ok := s.tickets[key]; !ok || c == nil {
		return nil, errors.New("admission rejected")
	}
	delete(s.tickets, key)
	return c, nil
}

func (s *Server) expireTickets() {
	defer close(s.ticketDone)
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			s.mu.Lock()
			for key, t := range s.tickets {
				if !s.config.Now().Before(t.expires) {
					delete(s.tickets, key)
				}
			}
			s.mu.Unlock()
		}
	}
}
