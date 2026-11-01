package transport

import (
	"errors"
	"fmt"

	"github.com/gofiber/contrib/websocket"
	wt "github.com/quic-go/webtransport-go"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"sync"
	"time"
)

type pair struct {
	server             *Server
	seat               *seat
	identity           p.Identity
	mu                 sync.Mutex
	roomSocket         *websocket.Conn
	gameplay           *wt.Session
	roomInitialized    bool
	initialized        bool
	roomQueue          chan queued
	queuedBytes        int
	queuedMessages     int
	peakQueuedBytes    int
	peakQueuedMessages int
	capacity           chan struct{}
	limits             p.Connection
	roomSequence       uint32
	closed             bool
	once               sync.Once
	done               chan struct{}
	rounds             chan struct{}
}

func newPair(s *Server, seat *seat) *pair {
	return &pair{server: s, seat: seat, limits: seat.room.settings.Context(1).Connection, identity: p.Identity{RoomId: seat.room.id, SeatSession: seat.session, PairGeneration: seat.generation, Seat: seat.index}, done: make(chan struct{}), roomQueue: make(chan queued, 512), rounds: make(chan struct{}, 1), capacity: make(chan struct{})}
}

func (pair *pair) connectionLimits() p.Connection {
	pair.mu.Lock()
	defer pair.mu.Unlock()
	return pair.limits
}
func (pair *pair) close(reason string) {
	pair.once.Do(func() {
		pair.mu.Lock()
		pair.closed = true
		ws, game := pair.roomSocket, pair.gameplay
		close(pair.done)
		pair.mu.Unlock()
		s := pair.server
		s.mu.Lock()
		if pair.seat.pair == pair && pair.seat.room.seats[pair.seat.index] == pair.seat {
			s.resolveDeparturesLocked(pair.seat.room, s.nowTime())
			if pair.seat.deadline.IsZero() {
				pair.seat.deadline = s.nowTime().Add(roomDuration(pair.seat.room, "reconnectGrace"))
			}
			s.cancelCountdownLocked(pair.seat.room)
			if pair.seat.room.phase == p.RoomPhaseActive && pair.seat.room.engine != nil && pair.seat.leaving.IsZero() {
				pair.seat.room.engine.Disconnect(pair.identity)
				pair.seat.room.primed[pair.identity.Seat] = false
			}
			pair.seat.connected = false
			for _, other := range pair.seat.room.seats {
				if other != nil {
					other.ready = false
				}
			}
			pair.seat.room.revision++
		}
		s.mu.Unlock()
		if ws != nil {
			_ = ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(4001, reason), time.Now().Add(500*time.Millisecond))
			ws.Close()
		}
		if game != nil {
			game.CloseWithError(1, reason)
		}
		s.config.Logger.Info("pair_closed", "room", pair.identity.RoomId, "seat", pair.identity.Seat, "generation", pair.identity.PairGeneration, "reason", reason)
		s.broadcast(pair.seat.room)
	})
}

type queued struct {
	bytes []byte
	at    time.Time
}

func (pair *pair) enqueueRoom(value any) error {
	wire, err := p.EncodeMessage(value, int(pair.connectionLimits().ReliableFrameBytes))
	if err != nil {
		return err
	}
	pair.mu.Lock()
	defer pair.mu.Unlock()
	if pair.closed {
		return errors.New("pair closed")
	}
	if pair.queuedBytes+len(wire) > int(pair.limits.QueueBytes) || pair.queuedMessages >= int(pair.limits.QueueMessages) {
		return errors.New("room queue overflow")
	}
	select {
	case pair.roomQueue <- queued{wire, time.Now()}:
		pair.queuedBytes += len(wire)
		pair.queuedMessages++
		pair.trackQueuePeakLocked()
		return nil
	default:
		return errors.New("room queue overflow")
	}
}
func (s *Server) broadcast(r *room) {
	s.mu.Lock()
	var messages []struct {
		pair  *pair
		state p.RoomState
	}
	for _, participant := range r.seats {
		if participant == nil || participant.pair == nil {
			continue
		}
		state := p.RoomState{Racers: r.racers, Identity: participant.pair.identity, Revision: r.revision, Mode: r.mode, Phase: r.phase, StartUs: r.startUs, Host: r.host, RoundId: r.roundID, IdleExpiryUs: uint64(max(r.idle.Sub(s.start).Microseconds(), 0))}
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
			pair  *pair
			state p.RoomState
		}{participant.pair, state})
	}
	s.mu.Unlock()
	for _, message := range messages {
		message.pair.mu.Lock()
		active := message.pair.roomInitialized && !message.pair.closed
		message.pair.mu.Unlock()
		if !active {
			continue
		}
		if err := message.pair.enqueueRoom(message.state); err != nil {
			go message.pair.close("room queue unavailable")
		}
	}
}
func (s *Server) roomSocket(ws *websocket.Conn) {
	pair := ws.Locals("pair").(*pair)
	pair.mu.Lock()
	if pair.closed {
		pair.mu.Unlock()
		ws.Close()
		return
	}
	pair.roomSocket = ws
	pair.mu.Unlock()
	defer pair.close("room channel lost")
	ws.SetReadLimit(int64(pair.connectionLimits().ReliableFrameBytes))
	roomTokens := pair.connectionLimits().InputBurst
	lastRoomMessage := time.Now()
	go func() {
		for {
			select {
			case <-pair.done:
				return
			case q := <-pair.roomQueue:
				limit := time.Duration(pair.connectionLimits().EssentialQueueWait * float64(time.Second))
				if time.Since(q.at) >= limit {
					pair.close("room queue wait")
					return
				}
				ws.SetWriteDeadline(q.at.Add(limit))
				err := ws.WriteMessage(websocket.BinaryMessage, q.bytes)
				pair.release(len(q.bytes))
				if err != nil {
					pair.close("room write failed")
					return
				}
			}
		}
	}()
	s.mu.Lock()
	revision := pair.seat.room.revision
	s.mu.Unlock()
	if err := pair.enqueueRoom(p.RoomInitialization{Version: p.ProtocolVersion, Identity: pair.identity, Revision: revision}); err != nil {
		return
	}
	for {
		kind, wire, err := ws.ReadMessage()
		if err != nil {
			return
		}
		if kind != websocket.BinaryMessage {
			return
		}
		now := time.Now()
		limits := pair.connectionLimits()
		roomTokens = min(limits.InputBurst, roomTokens+now.Sub(lastRoomMessage).Seconds()*limits.InputRate)
		lastRoomMessage = now
		roomTokens--
		if roomTokens < 0 {
			return
		}
		message, err := p.DecodeMessage(wire, int(pair.connectionLimits().ReliableFrameBytes))
		if err != nil {
			return
		}
		switch value := message.(type) {
		case p.RoomInitialization:
			if value.Version != p.ProtocolVersion || value.Identity != pair.identity || value.Revision != revision {
				return
			}
			pair.mu.Lock()
			if pair.roomInitialized {
				pair.mu.Unlock()
				return
			}
			pair.roomInitialized = true
			pair.mu.Unlock()
			s.broadcast(pair.seat.room)
			pair.connectIfReady()
		case p.RoomCommand:
			err = pair.roomCommand(value)
			s.mu.Lock()
			revision := pair.seat.room.revision
			s.mu.Unlock()
			reply := p.RoomReply{Identity: pair.identity, Sequence: value.Sequence, Revision: revision, Accepted: p.WireBooleanTrue}
			if err != nil {
				reply.Accepted = p.WireBooleanFalse
				reply.Detail = err.Error()
			}
			if pair.enqueueRoom(reply) != nil {
				return
			}
		default:
			return
		}
	}
}
func (pair *pair) connectIfReady() {
	s := pair.server
	s.mu.Lock()
	pair.mu.Lock()
	ready := pair.roomInitialized && pair.initialized && !pair.closed
	pair.mu.Unlock()
	if !ready {
		s.mu.Unlock()
		return
	}
	participant := pair.seat
	if !participant.accountLive(s.nowTime()) {
		s.mu.Unlock()
		pair.close("Session expired or revoked")
		return
	}
	if participant.pair != pair || participant.room.seats[participant.index] != participant || !participant.leaving.IsZero() || (!participant.deadline.IsZero() && !s.nowTime().Before(participant.deadline)) {
		s.mu.Unlock()
		pair.close("recovery deadline")
		return
	}
	s.resolveDeparturesLocked(participant.room, s.nowTime())
	participant.connected = true
	participant.deadline = time.Time{}
	participant.room.revision++
	s.mu.Unlock()
	s.broadcast(participant.room)
}
func (pair *pair) roomCommand(command p.RoomCommand) error {
	s := pair.server
	s.mu.Lock()
	participant := pair.seat
	r := participant.room
	if participant.pair != pair || r.seats[participant.index] != participant || command.Identity != pair.identity || command.Sequence <= pair.roomSequence || !participant.leaving.IsZero() || !participant.accountLive(s.nowTime()) {
		s.mu.Unlock()
		return fmt.Errorf("stale room command")
	}
	pair.roomSequence = command.Sequence
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
		go pair.close("explicit leave")
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
			case other.pair.rounds <- struct{}{}:
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
				r.engine.Disconnect(pair.identity)
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

// Budget is shared across room, control and authority queues, including writes
// in flight. Essential stream sends wait for capacity within their queue-wait
// deadline; the same deadline also bounds subsequent queueing and writing.
func (pair *pair) reserve(n int, deadline time.Time) error {
	timer := time.NewTimer(time.Until(deadline))
	defer timer.Stop()
	for {
		pair.mu.Lock()
		if pair.closed {
			pair.mu.Unlock()
			return errors.New("pair closed")
		}
		if n > int(pair.limits.QueueBytes) {
			pair.mu.Unlock()
			return errors.New("essential message exceeds pair queue bound")
		}
		if !time.Now().Before(deadline) {
			pair.mu.Unlock()
			return errors.New("essential queue wait exceeded")
		}
		if pair.queuedBytes+n <= int(pair.limits.QueueBytes) && pair.queuedMessages < int(pair.limits.QueueMessages) {
			pair.queuedBytes += n
			pair.queuedMessages++
			pair.trackQueuePeakLocked()
			pair.mu.Unlock()
			return nil
		}
		capacity := pair.capacity
		pair.mu.Unlock()
		select {
		case <-pair.done:
			return errors.New("pair closed")
		case <-timer.C:
			return errors.New("essential queue wait exceeded")
		case <-capacity:
		}
	}
}
func (pair *pair) release(n int) {
	pair.mu.Lock()
	pair.queuedBytes -= n
	pair.queuedMessages--
	// Broadcast so a waiter for a large frame cannot hide capacity from smaller sends.
	close(pair.capacity)
	pair.capacity = make(chan struct{})
	pair.mu.Unlock()
}

// Caller holds pair.mu; peaks include all channels and writes in flight.
func (pair *pair) trackQueuePeakLocked() {
	pair.peakQueuedBytes = max(pair.peakQueuedBytes, pair.queuedBytes)
	pair.peakQueuedMessages = max(pair.peakQueuedMessages, pair.queuedMessages)
}
