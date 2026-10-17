package transport

import (
	"context"
	"errors"
	wt "github.com/quic-go/webtransport-go"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"time"
)

// The room owns simulation; each pair delivers its ordered authority independently.
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
	cursor := baseline.Progress.Authority
	var outstanding []progressPoint
	lastBarrier := time.Now()
	outcomeSent := false
	lastRecovery := time.Time{}
	timer := time.NewTicker(10 * time.Millisecond)
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
			cursor = baseline.Progress.Authority
			outstanding = nil
			outcomeSent = false
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
				// Countdown/lobby keys never mutate the round-zero state.
				if err = pair.submitRace(value); err != nil {
					return err
				}
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
			case p.AuthorityAck:
				if record.channel == "control" && value.Identity == pair.identity && value.Round == baseline.Round && value.Epoch < baseline.Epoch {
					continue
				}
				if record.channel != "control" || value.Identity != pair.identity || value.Round != baseline.Round || value.Epoch != baseline.Epoch {
					return errors.New("authority acknowledgement context")
				}
				found := -1
				for i, point := range outstanding {
					if value.Tick == point.tick && value.Progress == point.progress {
						found = i
						break
					}
				}
				if found >= 0 {
					outstanding = outstanding[found+1:]
					lastAck = time.Now()
				}
			case p.Recovery:
				if record.channel != "control" || value.Identity != pair.identity || value.Round != baseline.Round || !installed || time.Since(lastRecovery) < time.Duration(float64(time.Second)/baseline.Context.Connection.RecoveryRequestRate) {
					return errors.New("invalid recovery")
				}
				lastRecovery = time.Now()
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
				cursor = baseline.Progress.Authority
				outstanding = nil
				if _, err = queueBaseline(aw, baseline, transfer); err != nil {
					return err
				}
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
			s := pair.server
			s.mu.Lock()
			r := pair.seat.room
			var outcome *p.Outcome
			if r.outcome != nil && r.outcomeSessions[pair.identity.Seat] == pair.identity.SeatSession {
				copy := *r.outcome
				copy.Identity = pair.identity
				outcome = &copy
			}
			active := r.phase == 2 && r.mode == 1
			var records []raceRecord
			current := baseline
			if r.zero != nil {
				current = cloneBaseline(*r.zero)
			}
			if active && installed {
				if len(r.history) > 0 && cursor+1 < r.history[0].authority {
					s.mu.Unlock()
					return errors.New("authority history unavailable")
				}
				for _, item := range r.history {
					if item.authority > cursor {
						records = append(records, item)
					}
				}
				state, coverageErr := r.engine.Coverage()
				if coverageErr != nil {
					s.mu.Unlock()
					return coverageErr
				}
				current.Generator, current.Windows = raceCoverage(current, state)
			}
			s.mu.Unlock()
			if outcome != nil && !outcomeSent {
				if err = cw.send(*outcome); err != nil {
					return err
				}
				outcomeSent = true
				// The self-contained result supersedes earlier authority. Its
				// application acknowledgement uses the terminal watermark.
				outstanding = []progressPoint{{outcome.Tick, outcome.Progress, now}}
			}
			if !installed {
				if now.Sub(sentAt) >= time.Second {
					return errors.New("baseline application timed out")
				}
				continue
			}
			if now.Sub(lastAck) >= time.Second {
				return errors.New("room application progress timed out")
			}
			for _, item := range records {
				switch value := item.value.(type) {
				case p.Disposition:
					value.Identity = pair.identity
					value.Round = baseline.Round
					err = aw.send(value)
				case p.Event:
					value.Identity = pair.identity
					value.Round = baseline.Round
					err = aw.send(value)
				}
				if err != nil {
					return err
				}
				cursor = item.authority
			}
			if len(outstanding) > 0 && now.Sub(outstanding[0].at) >= time.Second {
				return errors.New("authority application progress timed out")
			}
			if now.Sub(lastBarrier) < 100*time.Millisecond {
				continue
			}
			lastBarrier = now
			if active {
				current.Identity = pair.identity
				current.Round = baseline.Round
				current.Epoch = baseline.Epoch
				coverage := p.Coverage{Identity: pair.identity, Round: baseline.Round, Authority: current.Progress.Authority, Tick: current.Tick, TimeUs: current.TimeUs, Progress: current.Progress, Generator: current.Generator, Windows: current.Windows}
				if err = aw.send(coverage); err != nil {
					return err
				}
				barrier := p.Barrier{Identity: pair.identity, Round: baseline.Round, Epoch: baseline.Epoch, Tick: current.Tick, TimeUs: current.TimeUs, Progress: current.Progress}
				if err = aw.send(barrier); err != nil {
					return err
				}
				outstanding = append(outstanding, progressPoint{barrier.Tick, barrier.Progress, now})
				projection, e := p.ProjectBaseline(current)
				if e != nil {
					return e
				}
				datagram, e := p.EncodeVerification(p.Verification{Epoch: baseline.Epoch, Tick: current.Tick, Crc: p.CRC32C(projection)}, 10)
				if e != nil {
					return e
				}
				if err = session.SendDatagram(datagram); err != nil {
					return err
				}
				continue
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
