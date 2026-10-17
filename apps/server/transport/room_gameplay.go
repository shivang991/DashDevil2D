package transport

import (
	"context"
	"errors"
	wt "github.com/quic-go/webtransport-go"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"time"
)

// Stage 5 entry owns initialization and round zero. Movement is the #31 slice.
// RoomPulse is application liveness, never a fabricated gameplay tick.
func (pair *pair) runRoomGameplay(session *wt.Session) error {
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
	if !ok || hello.Version != 1 || hello.Identity != pair.identity || hello.DatagramBytes < 10 {
		return errors.New("incompatible version, identity or datagrams")
	}
	control.SetReadDeadline(time.Time{})
	cw := writer(pair, control)
	if err = cw.send(p.Handshake{Version: 1, Identity: pair.identity, DatagramBytes: 10}); err != nil {
		return err
	}
	baseline, err := pair.roomBaseline()
	if err != nil {
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
	transfer := uint32(1)
	if _, err = queueBaseline(aw, baseline, transfer); err != nil {
		return err
	}
	receivedMessages := make(chan received, 128)
	go readMessages(session.Context(), control, "control", receivedMessages)
	go readMessages(session.Context(), inputs, "inputs", receivedMessages)
	go func() {
		if _, e := session.AcceptStream(session.Context()); e == nil {
			pair.close("extra control stream")
		}
	}()
	go func() {
		if _, e := session.AcceptUniStream(session.Context()); e == nil {
			pair.close("extra input stream")
		}
	}()
	go func() {
		if _, e := session.ReceiveDatagram(session.Context()); e == nil {
			pair.close("client datagram forbidden")
		}
	}()
	installed := false
	sentAt := time.Now()
	lastAck := time.Now()
	pulseSequence := uint32(0)
	ackedPulse := uint32(0)
	inputSequence := uint32(0)
	clockSequence := uint32(0)
	lastClock := time.Time{}
	inputTokens := 120.0
	lastInput := time.Now()
	timer := time.NewTicker(100 * time.Millisecond)
	defer timer.Stop()
	for {
		select {
		case <-pair.done:
			return errors.New("pair closed")
		case <-session.Context().Done():
			return session.Context().Err()
		case <-pair.rounds:
			baseline, err = pair.roomBaseline()
			if err != nil {
				return err
			}
			transfer, err = p.NextCounter(transfer, 16)
			if err != nil {
				return err
			}
			baseline.Epoch = uint16(transfer)
			installed = false
			sentAt = time.Now()
			inputSequence = 0
			if err = cw.send(p.Initialization{Identity: pair.identity, Round: baseline.Round, Context: baseline.Context}); err != nil {
				return err
			}
			if _, err = queueBaseline(aw, baseline, transfer); err != nil {
				return err
			}
		case record := <-receivedMessages:
			if record.err != nil {
				return record.err
			}
			switch value := record.value.(type) {
			case p.Input:
				if record.channel != "inputs" || value.Identity != pair.identity {
					return errors.New("input identity/channel mismatch")
				}
				if value.Round != baseline.Round {
					continue
				}
				now := time.Now()
				inputTokens = min(120, inputTokens+now.Sub(lastInput).Seconds()*60)
				lastInput = now
				inputTokens--
				if inputTokens < 0 {
					return errors.New("input rate exceeded")
				}
				if value.Sequence <= inputSequence {
					continue
				}
				if value.Sequence != inputSequence+1 {
					return errors.New("input sequence gap")
				}
				inputSequence = value.Sequence
				// Countdown/lobby keys are discarded, including presses from non-UI peers.
				// They cannot mutate controls, state, placement or the round-zero watermark.
			case p.Ready:
				if record.channel != "control" || value.Identity != pair.identity {
					return errors.New("baseline acknowledgement identity")
				}
				if value.Round.RoundId < baseline.Round.RoundId {
					continue
				}
				if installed || value.Round != baseline.Round || value.TransferId != transfer || value.Epoch != baseline.Epoch || value.Progress != baseline.Progress {
					return errors.New("invalid baseline acknowledgement")
				}
				installed = true
				lastAck = time.Now()
				pair.mu.Lock()
				wasInitialized := pair.initialized
				pair.initialized = true
				pair.mu.Unlock()
				s := pair.server
				s.mu.Lock()
				if pair.seat.pair == pair {
					pair.seat.installedRound = baseline.Round.RoundId
				}
				s.mu.Unlock()
				if !wasInitialized {
					pair.connectIfReady()
				}
			case p.RoomPulse:
				if record.channel != "control" || value.Identity != pair.identity || value.Sequence > pulseSequence {
					return errors.New("invalid room pulse acknowledgement")
				}
				if value.Round != baseline.Round || value.Sequence <= ackedPulse {
					continue
				}
				ackedPulse = value.Sequence
				lastAck = time.Now()
			case p.ClockRequest:
				if record.channel != "control" || value.Sequence <= clockSequence || time.Since(lastClock) < 400*time.Millisecond {
					return errors.New("invalid clock request")
				}
				clockSequence = value.Sequence
				lastClock = time.Now()
				now := pair.server.nowUs()
				if err = cw.send(p.ClockReply{Sequence: value.Sequence, ClientSendUs: value.ClientSendUs, ServerReceiveUs: now, ServerSendUs: pair.server.nowUs()}); err != nil {
					return err
				}
			default:
				return errors.New("unexpected room gameplay message")
			}
		case now := <-timer.C:
			if !installed {
				if now.Sub(sentAt) >= time.Second {
					return errors.New("baseline application timed out")
				}
				continue
			}
			if now.Sub(lastAck) >= time.Second {
				return errors.New("room application progress timed out")
			}
			pulseSequence, err = p.NextCounter(pulseSequence, 32)
			if err != nil {
				return err
			}
			if err = aw.send(p.RoomPulse{Identity: pair.identity, Sequence: pulseSequence, Round: baseline.Round, ServerUs: pair.server.nowUs()}); err != nil {
				return err
			}
		}
	}
}
