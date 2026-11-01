package transport

import (
	"errors"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	wt "github.com/quic-go/webtransport-go"
	"github.com/shivang991/DashDevil2D/apps/server/multiplayer"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

type pair struct {
	server             *Server
	handle             multiplayer.Handle
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
	rounds             <-chan struct{}
}

func (s *Server) NewConnection(h multiplayer.Handle, id p.Identity, limits p.Connection) multiplayer.Delivery {
	c := &pair{server: s, handle: h, identity: id, limits: limits, done: make(chan struct{}), roomQueue: make(chan queued, 512), rounds: h.Rounds(), capacity: make(chan struct{})}
	s.mu.Lock()
	s.pairs[h] = c
	s.mu.Unlock()
	return c
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
		pair.handle.Disconnected()
		s.mu.Lock()
		delete(s.pairs, pair.handle)
		for key, t := range s.tickets {
			if t.handle == pair.handle {
				delete(s.tickets, key)
			}
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

func (pair *pair) Close(reason string) { pair.close(reason) }
func (pair *pair) Room(state p.RoomState) {
	pair.mu.Lock()
	active := pair.roomInitialized && !pair.closed
	pair.mu.Unlock()
	if active {
		if err := pair.enqueueRoom(state); err != nil {
			go pair.close("room queue unavailable")
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
	revision := pair.handle.Revision()
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
			pair.handle.Broadcast()
			pair.connectIfReady()
		case p.RoomCommand:
			err = pair.handle.Command(value)
			revision := pair.handle.Revision()
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
	pair.mu.Lock()
	ready := pair.roomInitialized && pair.initialized && !pair.closed
	pair.mu.Unlock()
	if ready {
		if err := pair.handle.Connected(); err != nil {
			pair.close(err.Error())
		}
	}
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
