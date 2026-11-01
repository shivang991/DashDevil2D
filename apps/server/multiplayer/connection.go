package multiplayer

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

// Delivery is a nonblocking network boundary. Room enqueues a copied snapshot;
// Close tears down both channels and reports Disconnected through its handle.
type Delivery interface {
	Room(p.RoomState)
	Close(string)
}
type connection struct {
	server       *Server
	seat         *seat
	identity     p.Identity
	limits       p.Connection
	delivery     Delivery
	rounds       chan struct{}
	done         chan struct{}
	once         sync.Once
	roomSequence uint32
}

func newConnection(s *Server, seat *seat) *connection {
	c := &connection{server: s, seat: seat, identity: p.Identity{RoomId: seat.room.id, SeatSession: seat.session, PairGeneration: seat.generation, Seat: seat.index}, limits: seat.room.settings.Context(1).Connection, rounds: make(chan struct{}, 1), done: make(chan struct{})}
	if s.config.NewConnection != nil {
		c.delivery = s.config.NewConnection(Handle{c}, c.identity, c.limits)
	}
	return c
}
func (c *connection) connectionLimits() p.Connection { return c.limits }
func (c *connection) close(reason string) {
	if c.delivery != nil {
		c.delivery.Close(reason)
	} else {
		Handle{c}.Disconnected()
	}
}

// Handle is opaque and bound to one seat and connection generation.
// Every authority-changing call revalidates ownership under the room mutex.
type Handle struct{ connection *connection }

func (h Handle) Identity() p.Identity          { return h.connection.identity }
func (h Handle) Rounds() <-chan struct{}       { return h.connection.rounds }
func (h Handle) Baseline() (p.Baseline, error) { return h.connection.roomBaseline() }
func (h Handle) Command(v p.RoomCommand) error { return h.connection.roomCommand(v) }
func (h Handle) Input(v p.Input) error         { return h.connection.submitRace(v) }
func (h Handle) Revision() uint32 {
	c := h.connection
	c.server.mu.Lock()
	defer c.server.mu.Unlock()
	return c.seat.room.revision
}
func (h Handle) Broadcast() { h.connection.server.broadcast(h.connection.seat.room) }
func (h Handle) Valid() bool {
	if h.connection == nil {
		return false
	}
	c := h.connection
	s := c.server
	s.mu.Lock()
	defer s.mu.Unlock()
	return c.validLocked()
}
func (c *connection) validLocked() bool {
	now := c.server.nowTime()
	seat := c.seat
	select {
	case <-c.done:
		return false
	default:
	}
	return seat.connection == c && seat.room.seats[seat.index] == seat && seat.generation == c.identity.PairGeneration && seat.accountLive(now) && seat.leaving.IsZero() && (seat.deadline.IsZero() || now.Before(seat.deadline))
}
func (h Handle) Installed(round uint32) {
	c := h.connection
	s := c.server
	s.mu.Lock()
	defer s.mu.Unlock()
	if c.validLocked() {
		c.seat.installedRound = round
	}
}
func (h Handle) Connected() error {
	connection := h.connection
	s := connection.server
	s.mu.Lock()
	if !connection.validLocked() {
		s.mu.Unlock()
		return errors.New("superseded connection")
	}
	participant := connection.seat
	if !participant.accountLive(s.nowTime()) {
		s.mu.Unlock()
		return errors.New("Session expired or revoked")
	}
	if participant.connection != connection || participant.room.seats[participant.index] != participant || !participant.leaving.IsZero() || (!participant.deadline.IsZero() && !s.nowTime().Before(participant.deadline)) {
		s.mu.Unlock()
		return errors.New("recovery deadline")
	}
	s.resolveDeparturesLocked(participant.room, s.nowTime())
	participant.connected = true
	participant.deadline = time.Time{}
	participant.room.revision++
	s.mu.Unlock()
	s.broadcast(participant.room)
	return nil
}
func (h Handle) Disconnected() {
	connection := h.connection
	connection.once.Do(func() {
		close(connection.done)
		s := connection.server
		s.mu.Lock()
		if connection.seat.connection == connection && connection.seat.room.seats[connection.seat.index] == connection.seat {
			s.resolveDeparturesLocked(connection.seat.room, s.nowTime())
			if connection.seat.deadline.IsZero() {
				connection.seat.deadline = s.nowTime().Add(roomDuration(connection.seat.room, "reconnectGrace"))
			}
			s.cancelCountdownLocked(connection.seat.room)
			if connection.seat.room.phase == p.RoomPhaseActive && connection.seat.room.engine != nil && connection.seat.leaving.IsZero() {
				connection.seat.room.engine.Disconnect(connection.identity)
				connection.seat.room.primed[connection.identity.Seat] = false
			}
			connection.seat.connected = false
			for _, other := range connection.seat.room.seats {
				if other != nil {
					other.ready = false
				}
			}
			connection.seat.room.revision++
		}
		s.mu.Unlock()
		s.broadcast(connection.seat.room)
	})
}
func (s *Server) broadcast(r *room) {
	s.mu.Lock()
	// A claimed start becomes observable only after its durable barrier.
	// In particular, clients must not treat a pending database write as Active.
	if r.historyStarting {
		s.mu.Unlock()
		return
	}
	var messages []struct {
		connection *connection
		state      p.RoomState
	}
	for _, participant := range r.seats {
		if participant == nil || participant.connection == nil {
			continue
		}
		state := p.RoomState{Racers: r.racers, Identity: participant.connection.identity, Revision: r.revision, Mode: r.mode, Phase: r.phase, StartUs: r.startUs, Host: r.host, RoundId: r.roundID, IdleExpiryUs: uint64(max(r.idle.Sub(s.start).Microseconds(), 0))}
		warningUs := uint64(roomDuration(r, "idleWarning").Microseconds())
		if state.IdleExpiryUs >= warningUs {
			state.IdleWarningUs = state.IdleExpiryUs - warningUs
		}
		for i, seat := range r.seats {
			if seat == nil {
				continue
			}
			flags := uint8(p.SeatFlagsReserved)
			if seat.connected {
				flags = p.SeatFlagsConnected
			}
			if seat.ready {
				flags |= p.SeatFlagsReady
			}
			if seat.returned {
				flags |= p.SeatFlagsReturned
			}
			reservation := uint64(0)
			if !seat.deadline.IsZero() {
				reservation = uint64(max(seat.deadline.Sub(s.start).Microseconds(), 0))
			}
			state.Seats[i] = p.Seat{Session: seat.session, Name: seat.name, Avatar: seat.avatar, Flags: flags, ReservationUs: reservation}
		}
		messages = append(messages, struct {
			connection *connection
			state      p.RoomState
		}{participant.connection, state})
	}
	s.mu.Unlock()
	for _, message := range messages {
		if message.connection.delivery != nil {
			message.connection.delivery.Room(message.state)
		}
	}
}
func (connection *connection) roomCommand(command p.RoomCommand) error {
	s := connection.server
	s.mu.Lock()
	participant := connection.seat
	r := participant.room
	if participant.connection != connection || r.seats[participant.index] != participant || command.Identity != connection.identity || command.Sequence <= connection.roomSequence || !participant.leaving.IsZero() || !participant.accountLive(s.nowTime()) {
		s.mu.Unlock()
		return fmt.Errorf("stale room command")
	}
	connection.roomSequence = command.Sequence
	// Resolve the exact maintenance cutoff before any command can make a
	// terminal result immutable between periodic sweeps.
	if s.draining && !s.nowTime().Before(s.drainDeadline) {
		changed := s.advanceRacesLocked()
		defer func() {
			for _, room := range changed {
				s.broadcast(room)
			}
		}()
	}
	if command.Command == p.RoomCommandCodeLeave {
		now := s.nowTime()
		s.resolveDeparturesLocked(r, now)
		if r.phase == p.RoomPhaseActive {
			// Revoke input ownership immediately, but retain engine controls until
			// StopAt integrates gameplay through this departure instant.
			participant.leaving = now
			participant.connected = false
			s.resolveDeparturesLocked(r, now)
			if r.seats[0] != nil && r.seats[1] != nil && !r.seats[0].leaving.IsZero() && !r.seats[1].leaving.IsZero() {
				s.resolveDeparturesLocked(r, now.Add(time.Microsecond))
			}
		}
		if r.phase != p.RoomPhaseActive {
			s.removeSeatLocked(r, participant.index)
			for i, other := range r.seats {
				if other != nil && !other.leaving.IsZero() {
					s.removeSeatLocked(r, p.SeatIndex(i))
				}
			}
			if r.host == participant.index {
				r.host = 1 - r.host
			}
			if r.seats[0] == nil && r.seats[1] == nil {
				delete(s.rooms, r.code)
			}
		}
		r.revision++
		s.mu.Unlock()
		go connection.close("explicit leave")
		s.broadcast(r)
		return nil
	}
	// Focus-loss and unready are safety actions: apply even against an older revision.
	safety := command.Command == p.RoomCommandCodeFocus || command.Command == p.RoomCommandCodeReady && command.Ready == p.WireBooleanFalse
	if !participant.connected || (!participant.deadline.IsZero() && !s.nowTime().Before(participant.deadline)) || ((r.phase == p.RoomPhaseLobby || r.phase == p.RoomPhaseEnded) && !s.nowTime().Before(r.idle)) || (!safety && command.Revision != r.revision) {
		s.mu.Unlock()
		return fmt.Errorf("Room changed; try again")
	}
	resetIdle := false
	switch command.Command {
	case p.RoomCommandCodeSelectMode:
		if r.phase != p.RoomPhaseLobby || participant.index != r.host || (command.Mode != p.ModeDragRace && command.Mode != p.ModeRoadRage) {
			s.mu.Unlock()
			return fmt.Errorf("Only host may select a mode in the lobby")
		}
		if r.mode != command.Mode {
			resetIdle = true
			mode := "drag-race"
			if command.Mode == p.ModeRoadRage {
				mode = "road-rage"
			}
			definition := []byte(p.DefaultConfigurationJSON)
			config, e := configuration.Capture(definition, mode, s.roundOverrides(command.Mode))
			if e != nil {
				s.mu.Unlock()
				return e
			}
			r.settings = config
			r.mode = command.Mode
			for _, other := range r.seats {
				if other != nil {
					other.ready = false
				}
			}
		}
	case p.RoomCommandCodeReady:
		if r.phase != p.RoomPhaseLobby || command.Ready == p.WireBooleanTrue && !participant.focused {
			s.mu.Unlock()
			return fmt.Errorf("Ready requires a focused, visible lobby")
		}
		resetIdle = participant.ready != (command.Ready == p.WireBooleanTrue)
		participant.ready = command.Ready == p.WireBooleanTrue
	case p.RoomCommandCodeStart:
		if s.draining {
			s.mu.Unlock()
			return fmt.Errorf("%s", maintenanceMessage)
		}
		if r.historyFinishing || s.historyFailed {
			s.mu.Unlock()
			return fmt.Errorf("Previous result is still being saved; try again")
		}
		if r.phase != p.RoomPhaseLobby || participant.index != r.host {
			s.mu.Unlock()
			return fmt.Errorf("Only host may start from the lobby")
		}
		for _, other := range r.seats {
			if other == nil || !other.connected || !other.ready || !other.focused {
				s.mu.Unlock()
				return fmt.Errorf("Two connected, focused, ready players required")
			}
		}
		if r.roundID == p.CounterMax || r.seats[0].inputGeneration == p.CounterMax || r.seats[1].inputGeneration == p.CounterMax {
			s.mu.Unlock()
			return fmt.Errorf("Round counter exhausted")
		}
		seed, err := newTrackSeed()
		if err != nil {
			s.mu.Unlock()
			return err
		}
		r.seed = seed
		for _, seat := range r.seats {
			seat.inputGeneration++
			seat.returned = false
		}
		resetIdle = true
		s.refreshRoomIdentityLocked(r)
		for i, seat := range r.seats {
			r.racers[i] = p.RacerIdentity{Name: seat.name, Avatar: seat.avatar}
		}
		s.cleanupAvatarsLocked()
		r.roundID++
		r.phase = p.RoomPhaseCountdown
		r.startUs = s.nowUs() + uint64(r.settings.Value("gameplay", "countdownDuration")*1e6)
		if e := s.prepareRoundLocked(r); e != nil {
			s.cancelCountdownLocked(r)
			s.mu.Unlock()
			return e
		}
		for _, other := range r.seats {
			other.installedRound = 0
			select {
			case other.connection.rounds <- struct{}{}:
			default:
			}
		}
	case p.RoomCommandCodeReturnToLobby:
		if r.phase != p.RoomPhaseEnded {
			s.mu.Unlock()
			return fmt.Errorf("Return to Lobby requires a finalized round")
		}
		participant.returned = true
		if r.seats[1-participant.index] == nil || r.seats[1-participant.index].returned {
			// Keep the outcome for reserved seats recovering in the lobby.
			r.phase = p.RoomPhaseLobby
			s.refreshRoomIdentityLocked(r)
			s.cleanupAvatarsLocked()
			for _, other := range r.seats {
				if other != nil {
					other.ready = false
				}
			}
		}
	case p.RoomCommandCodeFocus:
		participant.focused = command.Ready == p.WireBooleanTrue
		if !participant.focused {
			participant.ready = false
			if r.phase == p.RoomPhaseActive && r.engine != nil {
				r.engine.Disconnect(connection.identity)
				r.primed[participant.index] = false
			}
			if command.Mode == p.Mode(p.WireBooleanFalse) {
				s.cancelCountdownLocked(r)
			}
		}
	default:
		s.mu.Unlock()
		return fmt.Errorf("Unknown room command")
	}
	r.revision++
	if resetIdle {
		r.idle = s.nowTime().Add(time.Duration(r.settings.Value("room", "idleExpiry") * float64(time.Second)))
	}
	s.mu.Unlock()
	s.broadcast(r)
	return nil
}
