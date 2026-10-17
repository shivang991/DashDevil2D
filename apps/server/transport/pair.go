package transport

import (
	"errors"
	"fmt"
	"github.com/gofiber/contrib/websocket"
	wt "github.com/quic-go/webtransport-go"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"sync"
	"time"
)

type pair struct {
	server          *Server
	seat            *seat
	identity        p.Identity
	mu              sync.Mutex
	roomSocket      *websocket.Conn
	gameplay        *wt.Session
	roomInitialized bool
	initialized     bool
	roomQueue       chan queued
	queuedBytes     int
	queuedMessages  int
	capacity        chan struct{}
	roomSequence    uint32
	closed          bool
	once            sync.Once
	done            chan struct{}
}

func newPair(s *Server, seat *seat) *pair {
	return &pair{server: s, seat: seat, identity: p.Identity{RoomId: seat.room.id, SeatSession: seat.session, PairGeneration: seat.generation, Seat: seat.index}, done: make(chan struct{}), roomQueue: make(chan queued, 512), capacity: make(chan struct{}, 1)}
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
			if pair.seat.deadline.IsZero() {
				pair.seat.deadline = time.Now().Add(15 * time.Second)
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
	wire, err := p.EncodeMessage(value, frameLimit)
	if err != nil {
		return err
	}
	pair.mu.Lock()
	defer pair.mu.Unlock()
	if pair.closed {
		return errors.New("pair closed")
	}
	if pair.queuedBytes+len(wire) > 262144 || pair.queuedMessages >= 512 {
		return errors.New("room queue overflow")
	}
	select {
	case pair.roomQueue <- queued{wire, time.Now()}:
		pair.queuedBytes += len(wire)
		pair.queuedMessages++
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
		state := p.RoomState{Identity: participant.pair.identity, Revision: r.revision, Mode: 1, Host: r.host, RoundId: 1, IdleExpiryUs: s.nowUs() + uint64(max(time.Until(r.idle).Microseconds(), 0))}
		state.IdleWarningUs = state.IdleExpiryUs - 60000000
		for i, seat := range r.seats {
			if seat == nil {
				continue
			}
			flags := uint8(4)
			if seat.connected {
				flags = 1
			}
			if seat.ready {
				flags |= 2
			}
			reservation := uint64(0)
			if !seat.deadline.IsZero() {
				reservation = s.nowUs() + uint64(max(time.Until(seat.deadline).Microseconds(), 0))
			}
			state.Seats[i] = p.Seat{Session: seat.session, Name: seat.name, Flags: flags, ReservationUs: reservation}
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
	ws.SetReadLimit(frameLimit)
	roomTokens := 120.0
	lastRoomMessage := time.Now()
	go func() {
		for {
			select {
			case <-pair.done:
				return
			case q := <-pair.roomQueue:
				if time.Since(q.at) > 500*time.Millisecond {
					pair.close("room queue wait")
					return
				}
				ws.SetWriteDeadline(time.Now().Add(500 * time.Millisecond))
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
	if err := pair.enqueueRoom(p.RoomInitialization{Version: 1, Identity: pair.identity, Revision: revision}); err != nil {
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
		roomTokens = min(120, roomTokens+now.Sub(lastRoomMessage).Seconds()*60)
		lastRoomMessage = now
		roomTokens--
		if roomTokens < 0 {
			return
		}
		message, err := p.DecodeMessage(wire, frameLimit)
		if err != nil {
			return
		}
		switch value := message.(type) {
		case p.RoomInitialization:
			if value.Version != 1 || value.Identity != pair.identity || value.Revision != revision {
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
			if err = pair.roomCommand(value); err != nil {
				pair.enqueueRoom(p.ProtocolError{Code: 3, ExpectedVersion: 1, Detail: err.Error()})
				return
			}
		default:
			return
		}
	}
}
func (pair *pair) connectIfReady() {
	pair.mu.Lock()
	ready := pair.roomInitialized && pair.initialized && !pair.closed
	pair.mu.Unlock()
	if !ready {
		return
	}
	s := pair.server
	s.mu.Lock()
	participant := pair.seat
	if participant.pair != pair || participant.room.seats[participant.index] != participant || (!participant.deadline.IsZero() && !time.Now().Before(participant.deadline)) {
		s.mu.Unlock()
		pair.close("recovery deadline")
		return
	}
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
	if participant.pair != pair || participant.room.seats[participant.index] != participant || command.Identity != pair.identity || command.Sequence <= pair.roomSequence {
		s.mu.Unlock()
		return fmt.Errorf("stale room command")
	}
	pair.roomSequence = command.Sequence
	if command.Command == 3 {
		delete(s.credentials, token(participant.credential))
		r.seats[participant.index] = nil
		if r.host == participant.index {
			r.host = 1 - r.host
		}
		if r.seats[0] == nil && r.seats[1] == nil {
			delete(s.rooms, r.code)
		}
		r.revision++
		s.mu.Unlock()
		go pair.close("explicit leave")
		s.broadcast(r)
		return nil
	}
	if !participant.connected || command.Revision != r.revision || command.Command != 1 {
		s.mu.Unlock()
		return fmt.Errorf("diagnostic readiness requires initialized pair; round start is unavailable")
	}
	participant.ready = command.Ready == 1
	r.revision++
	r.idle = time.Now().Add(15 * time.Minute)
	s.mu.Unlock()
	s.broadcast(r)
	return nil
}

// Budget is shared across room, control and authority queues, including writes
// in flight. Baseline production can wait for a released slot without buffering
// the complete transfer in the outgoing queue.
func (pair *pair) reserve(n int) error {
	pair.mu.Lock()
	defer pair.mu.Unlock()
	if pair.closed {
		return errors.New("pair closed")
	}
	if pair.queuedBytes+n > 262144 || pair.queuedMessages >= 512 {
		return errors.New("essential pair queue overflow")
	}
	pair.queuedBytes += n
	pair.queuedMessages++
	return nil
}
func (pair *pair) release(n int) {
	pair.mu.Lock()
	pair.queuedBytes -= n
	pair.queuedMessages--
	pair.mu.Unlock()
	select {
	case pair.capacity <- struct{}{}:
	default:
	}
}
