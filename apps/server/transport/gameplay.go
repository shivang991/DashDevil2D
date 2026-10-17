package transport

import (
	"context"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"sync"
	"time"

	wt "github.com/quic-go/webtransport-go"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

//go:embed diagnostic.json
var diagnosticJSON []byte

// fixtureBaseline uses the independently reviewed #27 continuation as diagnostic
// state. It freezes its geometry and clears controls; this is not a game loop.
func fixtureBaseline(identity p.Identity) (p.Baseline, error) {
	var b p.Baseline
	if err := json.Unmarshal(diagnosticJSON, &b); err != nil {
		return b, err
	}
	b.Identity = identity
	b.Round = p.Round{RoundId: 1, InputGeneration: identity.PairGeneration}
	b.Epoch = 1
	b.Progress = p.Progress{}
	for i := range b.Cars {
		car := &b.Cars[i]
		car.Phase = 0
		car.Controls = 0
		car.Effective = 0
		car.Flags = 0
		car.HeldMask = 0
		car.LastInput = 0
		car.FreshnessUs = 0
		car.NextShiftUs = 0
		car.MovementStartUs = 0
		car.MovementEndUs = 0
		car.InputGeneration = 1
	}
	b.Cars[identity.Seat].InputGeneration = identity.PairGeneration
	return b, p.ValidateBaseline(b, b.Context)
}

// Each stream has one bounded application writer. Time waiting in the queue and
// time blocked inside QUIC writes are both bounded, including in-flight bytes.
type streamWriter struct {
	pair   *pair
	stream interface {
		io.Writer
		SetWriteDeadline(time.Time) error
	}
	queue chan queued
	mu    sync.Mutex
	bytes int
}

func writer(pair *pair, stream interface {
	io.Writer
	SetWriteDeadline(time.Time) error
}) *streamWriter {
	w := &streamWriter{pair: pair, stream: stream, queue: make(chan queued, 512)}
	go func() {
		for {
			select {
			case <-pair.done:
				return
			case item := <-w.queue:
				deadline := item.at.Add(500 * time.Millisecond)
				if !time.Now().Before(deadline) {
					pair.close("essential queue wait exceeded")
					return
				}
				w.stream.SetWriteDeadline(deadline)
				_, err := w.stream.Write(item.bytes)
				w.mu.Lock()
				w.bytes -= len(item.bytes)
				w.mu.Unlock()
				pair.release(len(item.bytes))
				if err != nil {
					pair.close("reliable write failed")
					return
				}
			}
		}
	}()
	return w
}
func (w *streamWriter) send(value any) error {
	wire, err := p.EncodeMessage(value, frameLimit)
	if err != nil {
		return err
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if err = w.pair.reserve(len(wire)); err != nil {
		return err
	}
	select {
	case <-w.pair.done:
		w.pair.release(len(wire))
		return errors.New("pair closed")
	default:
	}
	select {
	case w.queue <- queued{wire, time.Now()}:
		w.bytes += len(wire)
		return nil
	default:
		w.pair.release(len(wire))
		return errors.New("essential queue count exceeded")
	}
}
func readFrame(r io.Reader) (any, error) {
	var prefix [4]byte
	if _, err := io.ReadFull(r, prefix[:]); err != nil {
		return nil, err
	}
	n := binary.BigEndian.Uint32(prefix[:])
	if n < 1 || n > frameLimit-4 {
		return nil, errors.New("advertised frame length exceeds bound")
	}
	bytes := make([]byte, int(n)+4)
	copy(bytes, prefix[:])
	if _, err := io.ReadFull(r, bytes[4:]); err != nil {
		return nil, err
	}
	return p.DecodeMessage(bytes, frameLimit)
}
func (s *Server) gameplay(w http.ResponseWriter, r *http.Request) {
	// The HTTP/3 Origin check happens before ticket consumption as well as upgrade.
	if r.Header.Get("Origin") != s.config.Origin {
		http.Error(w, "Admission rejected", 403)
		return
	}
	pair, err := s.consume(r.URL.Query().Get("ticket"), "gameplay", r.Header.Get("Origin"))
	if err != nil {
		http.Error(w, "Admission rejected", 403)
		return
	}
	session, err := s.webtransport.Upgrade(w, r)
	if err != nil {
		pair.close("WebTransport upgrade failed")
		return
	}
	pair.mu.Lock()
	if pair.closed {
		pair.mu.Unlock()
		session.CloseWithError(1, "pair superseded")
		return
	}
	pair.gameplay = session
	pair.mu.Unlock()
	defer pair.close("gameplay channel lost")
	if s.config.Diagnostic {
		err = pair.runGameplay(session)
	} else {
		err = pair.runRoomGameplay(session)
	}
	if err != nil {
		pair.close(err.Error())
		s.config.Logger.Info("gameplay_failure", "room", pair.identity.RoomId, "seat", pair.identity.Seat, "generation", pair.identity.PairGeneration, "reason", err.Error())
	}
}

type received struct {
	value   any
	channel string
	err     error
}

func readMessages(ctx context.Context, r io.Reader, channel string, out chan<- received) {
	for {
		value, err := readFrame(r)
		select {
		case out <- received{value, channel, err}:
		case <-ctx.Done():
			return
		}
		if err != nil {
			return
		}
	}
}

type progressPoint struct {
	tick     uint32
	progress p.Progress
	at       time.Time
}

func (pair *pair) runGameplay(session *wt.Session) error {
	ctx, cancel := context.WithTimeout(session.Context(), 3*time.Second)
	control, err := session.AcceptStream(ctx)
	cancel()
	if err != nil {
		return err
	}
	control.SetReadDeadline(time.Now().Add(3 * time.Second))
	first, err := readFrame(control)
	if err != nil {
		return err
	}
	hello, ok := first.(p.Handshake)
	if !ok || hello.Version != p.ProtocolVersion || hello.Identity != pair.identity || hello.DatagramBytes < 10 {
		wire, _ := p.EncodeMessage(p.ProtocolError{Code: 1, ExpectedVersion: p.ProtocolVersion, Detail: "Incompatible version, identity or datagram support"}, frameLimit)
		control.SetWriteDeadline(time.Now().Add(500 * time.Millisecond))
		control.Write(wire)
		return errors.New("gameplay handshake rejected")
	}
	baseline, err := fixtureBaseline(pair.identity)
	if err != nil {
		return err
	}
	control.SetReadDeadline(time.Time{})
	cw := writer(pair, control)
	if err = cw.send(p.Handshake{Version: p.ProtocolVersion, Identity: pair.identity, DatagramBytes: 10}); err != nil {
		return err
	}
	if err = cw.send(p.Initialization{Identity: pair.identity, Round: baseline.Round, Context: baseline.Context}); err != nil {
		return err
	}
	ctx, cancel = context.WithTimeout(session.Context(), 3*time.Second)
	inputs, err := session.AcceptUniStream(ctx)
	cancel()
	if err != nil {
		return err
	}
	ctx, cancel = context.WithTimeout(session.Context(), 3*time.Second)
	authority, err := session.OpenUniStreamSync(ctx)
	cancel()
	if err != nil {
		return err
	}
	aw := writer(pair, authority)
	transferID := uint32(1)
	transferProgress := baseline.Progress
	dataBytes, err := queueBaseline(aw, baseline, transferID)
	if err != nil {
		return err
	}
	receivedMessages := make(chan received, 128)
	go readMessages(session.Context(), control, "control", receivedMessages)
	go readMessages(session.Context(), inputs, "inputs", receivedMessages)
	// Any fourth application stream is a protocol failure, not an unbounded task.
	go func() {
		_, e := session.AcceptStream(session.Context())
		if e == nil {
			pair.close("extra control stream")
		}
	}()
	go func() {
		_, e := session.AcceptUniStream(session.Context())
		if e == nil {
			pair.close("extra input stream")
		}
	}()
	go func() {
		_, e := session.ReceiveDatagram(session.Context())
		if e == nil {
			pair.close("client datagram direction forbidden")
		}
	}()
	timer := time.NewTicker(100 * time.Millisecond)
	defer timer.Stop()
	installed := false
	initialSent := time.Now()
	var outstanding []progressPoint
	var acknowledgedTick uint32
	lastInput := uint32(0)
	clockSequence := uint32(0)
	clockTokens := 2.0
	inputTokens := 120.0
	lastRate := time.Now()
	lastRecovery := time.Time{}
	fail := func(err error) error {
		cw.send(p.ProtocolError{Code: 3, ExpectedVersion: p.ProtocolVersion, Detail: err.Error()})
		return err
	}
	for {
		select {
		case <-pair.done:
			return errors.New("pair closed")
		case <-session.Context().Done():
			return session.Context().Err()
		case message := <-receivedMessages:
			if message.err != nil {
				return fail(fmt.Errorf("%s stream ended or malformed", message.channel))
			}
			now := time.Now()
			elapsed := now.Sub(lastRate).Seconds()
			lastRate = now
			clockTokens = math.Min(2, clockTokens+elapsed*2)
			inputTokens = math.Min(120, inputTokens+elapsed*60)
			if message.channel == "inputs" {
				input, ok := message.value.(p.Input)
				if !ok || input.Identity != pair.identity || input.Round != baseline.Round {
					return fail(errors.New("input context mismatch"))
				}
				inputTokens--
				if inputTokens < 0 {
					return fail(errors.New("input rate exceeded"))
				}
				if input.Sequence <= lastInput {
					continue
				}
				if input.Sequence != lastInput+1 {
					return fail(errors.New("input sequence gap"))
				}
				if input.Intent != 2 || input.Control != 0 || input.HeldMask != 0 {
					return fail(errors.New("diagnostic fixture accepts released-control refreshes only"))
				}
				lastInput = input.Sequence
				baseline.Cars[pair.identity.Seat].LastInput = lastInput
				if pair.identity.Seat == 0 {
					baseline.Progress.Processed1 = lastInput
					baseline.Progress.Disposed1 = lastInput
				} else {
					baseline.Progress.Processed2 = lastInput
					baseline.Progress.Disposed2 = lastInput
				}
				next, e := p.NextCounter(baseline.Progress.Authority, 32)
				if e != nil {
					return e
				}
				baseline.Progress.Authority = next
				if err = aw.send(p.Disposition{Identity: pair.identity, Round: baseline.Round, Authority: next, Tick: baseline.Tick, TimeUs: baseline.TimeUs, Seat: pair.identity.Seat, Sequence: lastInput, Processed: lastInput, Disposition: 1, Intent: 2, Car: baseline.Cars[pair.identity.Seat], Contact: baseline.Contact}); err != nil {
					return err
				}
				continue
			}
			switch value := message.value.(type) {
			case p.Ready:
				if installed || value.Identity != pair.identity || value.Round != baseline.Round || value.TransferId != transferID || value.Epoch != baseline.Epoch || value.Progress != transferProgress {
					return fail(errors.New("invalid baseline acknowledgement"))
				}
				installed = true
				pair.mu.Lock()
				pair.initialized = true
				pair.mu.Unlock()
				pair.connectIfReady()
				pair.server.config.Logger.Info("baseline_installed", "room", pair.identity.RoomId, "seat", pair.identity.Seat, "generation", pair.identity.PairGeneration, "bytes", dataBytes, "duration_us", time.Since(initialSent).Microseconds())
			case p.Recovery:
				if !installed || value.Identity != pair.identity || value.Round != baseline.Round || value.Epoch != baseline.Epoch || time.Since(lastRecovery) < time.Second {
					return fail(errors.New("invalid or excessive recovery request"))
				}
				lastRecovery = time.Now()
				epoch, e := p.NextCounter(uint32(baseline.Epoch), 16)
				if e != nil {
					return e
				}
				baseline.Epoch = uint16(epoch)
				transferID, e = p.NextCounter(transferID, 32)
				if e != nil {
					return e
				}
				installed = false
				initialSent = time.Now()
				outstanding = nil
				transferProgress = baseline.Progress
				dataBytes, err = queueBaseline(aw, baseline, transferID)
				if err != nil {
					return err
				}
			case p.AuthorityAck:
				if value.Epoch < baseline.Epoch {
					continue
				}
				if !installed || value.Identity != pair.identity || value.Round != baseline.Round || value.Epoch != baseline.Epoch {
					return fail(errors.New("invalid authority acknowledgement context"))
				}
				if value.Tick <= acknowledgedTick {
					continue
				}
				found := -1
				for i, point := range outstanding {
					if value.Tick == point.tick && value.Progress == point.progress {
						found = i
						break
					}
				}
				if found < 0 {
					return fail(errors.New("unknown or obsolete authority acknowledgement"))
				}
				acknowledgedTick = value.Tick
				outstanding = outstanding[found+1:]
			case p.ClockRequest:
				if clockTokens < 1 || value.Sequence <= clockSequence {
					return fail(errors.New("clock rate or sequence violation"))
				}
				clockTokens--
				clockSequence = value.Sequence
				now := pair.server.nowUs()
				if err = cw.send(p.ClockReply{Sequence: value.Sequence, ClientSendUs: value.ClientSendUs, ServerReceiveUs: now, ServerSendUs: pair.server.nowUs()}); err != nil {
					return err
				}
			default:
				return fail(errors.New("unexpected control record"))
			}
		case now := <-timer.C:
			if !installed {
				if now.Sub(initialSent) >= time.Second {
					return fail(errors.New("baseline application acknowledgement timed out"))
				}
				continue
			}
			if len(outstanding) > 0 && now.Sub(outstanding[0].at) >= time.Second {
				return fail(errors.New("essential application progress timed out"))
			}
			next, e := p.NextCounter(baseline.Tick, 32)
			if e != nil {
				return e
			}
			baseline.Tick = next
			baseline.TimeUs = uint64(math.Floor(float64(next)*1e6/60 + .5))
			barrier := p.Barrier{Identity: pair.identity, Round: baseline.Round, Epoch: baseline.Epoch, Tick: baseline.Tick, TimeUs: baseline.TimeUs, Progress: baseline.Progress}
			if err = aw.send(barrier); err != nil {
				return err
			}
			outstanding = append(outstanding, progressPoint{barrier.Tick, barrier.Progress, now})
			if barrier.Tick%10 == 0 {
				aw.mu.Lock()
				queueBytes := aw.bytes
				aw.mu.Unlock()
				pair.server.config.Logger.Info("application_progress", "room", pair.identity.RoomId, "seat", pair.identity.Seat, "generation", pair.identity.PairGeneration, "sent_tick", barrier.Tick, "acknowledged_tick", acknowledgedTick, "outstanding_records", len(outstanding), "oldest_ack_age_us", now.Sub(outstanding[0].at).Microseconds(), "authority_queue_bytes", queueBytes)
			}
			projection, e := p.ProjectBaseline(baseline)
			if e != nil {
				return e
			}
			datagram, e := p.EncodeVerification(p.Verification{Epoch: baseline.Epoch, Tick: baseline.Tick, Crc: p.CRC32C(projection)}, 10)
			if e != nil {
				return e
			}
			if err = session.SendDatagram(datagram); err != nil {
				return err
			}
		}
	}
}

func queueBaseline(writer *streamWriter, baseline p.Baseline, transferID uint32) (int, error) {
	data, err := p.EncodeBaseline(baseline, 1048576)
	if err != nil {
		return 0, err
	}
	const payload = 60000
	count := (len(data) + payload - 1) / payload
	for i := 0; i < count; i++ {
		start := i * payload
		end := min(start+payload, len(data))
		if err = writer.sendChunk(p.BaselineChunk{Identity: baseline.Identity, Round: baseline.Round, TransferId: transferID, Epoch: baseline.Epoch, Tick: baseline.Tick, Progress: baseline.Progress, Total: uint32(len(data)), Offset: uint32(start), Index: uint32(i), Count: uint32(count), Data: data[start:end]}); err != nil {
			return 0, err
		}
	}
	return len(data), nil
}

func (w *streamWriter) sendChunk(value p.BaselineChunk) error {
	deadline := time.NewTimer(500 * time.Millisecond)
	defer deadline.Stop()
	for {
		err := w.send(value)
		if err == nil {
			return nil
		}
		select {
		case <-w.pair.done:
			return err
		case <-deadline.C:
			return err
		case <-w.pair.capacity:
		}
	}
}
