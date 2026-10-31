package transport_test

import (
	"crypto/x509"
	"fmt"
	ws "github.com/fasthttp/websocket"
	wt "github.com/quic-go/webtransport-go"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"io"
	"math"
	"net/http"
	"sync/atomic"
	"testing"
	"time"
)

func TestRoomUsesConfiguredIdleAndReconnectWindows(t *testing.T) {
	s, c, roots := configuredServer(t, transport.Config{DragRaceOverrides: []byte(`{"room":{"reconnectGrace":2,"idleExpiry":120,"idleWarning":10}}`)})
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, game := initializedPair(t, s, roots, a, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Guest"}, origin)
	b := v.(p.Admission)
	guest, _ := initializedPair(t, s, roots, b, true)
	roomSend(t, guest, b, 1, p.RoomState{}, 4, 1, 1)
	state := roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Flags&1 != 0 })
	if state.IdleExpiryUs-state.IdleWarningUs != 10000000 {
		t.Fatalf("configured warning: %+v", state)
	}
	host.Close()
	game.CloseWithError(1, "disconnect")
	state = roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Flags&4 != 0 })
	gap := int64(state.IdleExpiryUs) - int64(state.Seats[0].ReservationUs)
	if gap < 117000000 || gap > 118000000 {
		t.Fatalf("expected 120s idle minus 2s grace, got %d us", gap)
	}
}

// Only the authoritative clock is replaced; admission and both transports remain real.
func lifecycleClock() (func() time.Time, func(time.Duration)) {
	start := time.Now()
	var elapsed atomic.Int64
	return func() time.Time { return start.Add(time.Duration(elapsed.Load())) }, func(d time.Duration) { elapsed.Add(int64(d)) }
}

func TestDuplicateLobbyActionsDoNotExtendIdleExpiry(t *testing.T) {
	now, advance := lifecycleClock()
	s, c, roots := configuredServer(t, transport.Config{Now: now})
	_, v, _ := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := v.(p.Admission)
	socket, _ := initializedPair(t, s, roots, a, true)
	roomSend(t, socket, a, 1, p.RoomState{}, 4, 1, 1)
	state := roomState(t, socket, func(r p.RoomState) bool { return r.Seats[0].Flags&1 != 0 })
	deadline := state.IdleExpiryUs
	for i, command := range []uint8{0, 1} {
		advance(time.Second)
		roomSend(t, socket, a, uint32(i*2+2), state, command, 1, 0)
		if reply := roomReply(t, socket, uint32(i*2+2)); reply.Accepted != 1 {
			t.Fatal(reply)
		}
		roomSend(t, socket, a, uint32(i*2+3), p.RoomState{}, 4, 1, 1)
		state = roomState(t, socket, func(r p.RoomState) bool { return r.Revision > state.Revision })
		if state.IdleExpiryUs != deadline {
			t.Fatalf("no-op command %d extended idle: %d != %d", command, state.IdleExpiryUs, deadline)
		}
	}
}

func TestRecoveryAdmissionStrictGraceBoundary(t *testing.T) {
	for _, offset := range []time.Duration{-time.Microsecond, 0, time.Microsecond} {
		t.Run(offset.String(), func(t *testing.T) {
			now, advance := lifecycleClock()
			s, c, _ := configuredServer(t, transport.Config{Now: now, DragRaceOverrides: []byte(`{"room":{"reconnectGrace":2}}`)})
			_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
			a := v.(p.Admission)
			advance(2*time.Second + offset)
			status, v := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
			if offset < 0 {
				if status != 201 || v.(p.Admission).Identity.SeatSession != a.Identity.SeatSession {
					t.Fatalf("before grace: %d %+v", status, v)
				}
				// Issuing replacement tickets must not extend the original reservation.
				advance(time.Microsecond)
				status, v = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
			}
			if status != 410 {
				t.Fatalf("at/after grace: %d %+v", status, v)
			}
			status, _ = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Guest"}, origin)
			if status != 404 {
				t.Fatalf("empty expired room retained code: %d", status)
			}
		})
	}
}

// The observation is the reliable, server-issued Outcome, never inferred from RoomState.
func receiveOutcome(t *testing.T, outcomes <-chan p.Outcome) p.Outcome {
	t.Helper()
	select {
	case outcome := <-outcomes:
		return outcome
	case <-time.After(3 * time.Second):
		t.Fatal("no authoritative outcome")
		return p.Outcome{}
	}
}

type activeLifecycleRoom struct {
	server       *transport.Server
	client       *http.Client
	roots        *x509.CertPool
	code         string
	admissions   [2]p.Admission
	sockets      [2]*ws.Conn
	games        [2]*wt.Session
	outcomes     [2]chan p.Outcome
	inputs       [2]io.Writer
	dispositions [2]chan p.Disposition
	advance      func(time.Duration)
	state        p.RoomState
}

func activeLifecycle(t *testing.T, overrides string, beforeAdmission ...func(*transport.Server, *http.Client)) activeLifecycleRoom {
	t.Helper()
	now, advance := lifecycleClock()
	s, c, roots := configuredServer(t, transport.Config{Now: now, DragRaceOverrides: []byte(overrides)})
	f := activeLifecycleRoom{server: s, client: c, roots: roots, advance: advance}
	for _, setup := range beforeAdmission {
		setup(s, c)
	}
	for i := 0; i < 2; i++ {
		operation := uint8(i)
		_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: operation, Code: f.code, Name: "Driver"}, origin)
		if i == 0 {
			f.code = code
		}
		f.admissions[i] = v.(p.Admission)
		outcomes := make(chan p.Outcome, 4)
		f.outcomes[i] = outcomes
		dispositions := make(chan p.Disposition, 16)
		f.dispositions[i] = dispositions
		f.sockets[i], f.games[i] = observedPair(t, s, roots, f.admissions[i], true, func(record any) {
			switch value := record.(type) {
			case p.Outcome:
				outcomes <- value
			case p.Disposition:
				dispositions <- value
			case io.Writer:
				f.inputs[i] = value
			}
		})
	}
	state := roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
	roomSend(t, f.sockets[0], f.admissions[0], 1, state, 1, 1, 1)
	state = roomState(t, f.sockets[1], func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
	roomSend(t, f.sockets[1], f.admissions[1], 1, state, 1, 1, 1)
	state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
	roomSend(t, f.sockets[0], f.admissions[0], 2, state, 2, 1, 0)
	state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Phase == 1 })
	// Acknowledge the real countdown baseline before crossing the announced start.
	time.Sleep(30 * time.Millisecond)
	advance(3 * time.Second)
	f.state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Phase == 2 })
	return f
}
func TestGraceExpirySendsCanonicalForfeit(t *testing.T) {
	f := activeLifecycle(t, `{"room":{"reconnectGrace":2},"operational":{"simulationLagThreshold":10}}`)
	f.sockets[1].Close()
	f.games[1].CloseWithError(1, "disconnect")
	roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&4 != 0 })
	f.advance(2*time.Second + time.Microsecond)
	outcome := receiveOutcome(t, f.outcomes[0])
	if outcome.Result != 0 || outcome.Reason != 4 || outcome.TimeUs != 2000000 {
		t.Fatalf("grace outcome: %+v", outcome)
	}
}

func TestIdleExpiryBoundaryCannotBeResetByRecovery(t *testing.T) {
	for _, offset := range []time.Duration{-time.Microsecond, 0, time.Microsecond} {
		t.Run(offset.String(), func(t *testing.T) {
			now, advance := lifecycleClock()
			s, c, roots := configuredServer(t, transport.Config{Now: now, DragRaceOverrides: []byte(`{"room":{"idleExpiry":120,"idleWarning":10}}`)})
			_, v, _ := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
			a := v.(p.Admission)
			initializedPair(t, s, roots, a, true)
			advance(120*time.Second + offset)
			status, v := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
			if offset < 0 {
				if status != 201 {
					t.Fatalf("before idle: %d %+v", status, v)
				}
				advance(time.Microsecond)
				status, v = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
			}
			if status != 410 {
				t.Fatalf("at/after idle: %d %+v", status, v)
			}
		})
	}
}

func TestReservedHostBlocksGuestsUntilExactGraceThenTransfers(t *testing.T) {
	now, advance := lifecycleClock()
	s, c, roots := configuredServer(t, transport.Config{Now: now, DragRaceOverrides: []byte(`{"room":{"reconnectGrace":2}}`)})
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, game := initializedPair(t, s, roots, a, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Guest"}, origin)
	b := v.(p.Admission)
	guest, _ := initializedPair(t, s, roots, b, true)
	host.Close()
	game.CloseWithError(1, "disconnect")
	state := roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Flags&4 != 0 })
	if state.Host != 0 {
		t.Fatal("temporary disconnect transferred host")
	}
	advance(2*time.Second - time.Microsecond)
	status, _ := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Intruder"}, origin)
	if status != 409 {
		t.Fatalf("reserved seat admitted a guest: %d", status)
	}
	advance(time.Microsecond)
	status, v = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Replacement"}, origin)
	if status != 201 || v.(p.Admission).Identity.SeatSession == a.Identity.SeatSession {
		t.Fatalf("expired host seat unavailable: %d %+v", status, v)
	}
	state = roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Session != a.Identity.SeatSession })
	if state.Host != 1 {
		t.Fatal("expired host role did not transfer")
	}
}

func TestGameplayPrecedesGraceAtCanonicalBoundary(t *testing.T) {
	for _, scenario := range []struct {
		grace          string
		elapsed        time.Duration
		result, reason uint8
		timeUs         uint64
	}{
		{"0.999999", 999999 * time.Microsecond, 0, 4, 999999},
		{"1", time.Second, 2, 0, 1000000},
		{"1.000001", 1000001 * time.Microsecond, 2, 0, 1000000},
	} {
		t.Run(scenario.grace, func(t *testing.T) {
			f := activeLifecycle(t, `{"room":{"reconnectGrace":`+scenario.grace+`},"gameplay":{"finishDistance":440,"tickRate":1,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1},"operational":{"simulationLagThreshold":10}}`)
			f.sockets[1].Close()
			f.games[1].CloseWithError(1, "disconnect")
			roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&4 != 0 })
			f.advance(scenario.elapsed + time.Microsecond)
			outcome := receiveOutcome(t, f.outcomes[0])
			if outcome.Result != scenario.result || outcome.Reason != scenario.reason || outcome.TimeUs != scenario.timeUs {
				t.Fatalf("boundary outcome: %+v", outcome)
			}
		})
	}
}

func TestAbandonmentIsRecoverableBeforeRemainingReservationExpires(t *testing.T) {
	f := activeLifecycle(t, `{"room":{"reconnectGrace":2},"operational":{"simulationLagThreshold":10}}`)
	f.sockets[1].Close()
	f.games[1].CloseWithError(1, "disconnect")
	state := roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&4 != 0 })
	f.advance(500 * time.Millisecond)
	roomSend(t, f.sockets[0], f.admissions[0], 3, state, 3, 1, 0)
	f.sockets[0].SetReadDeadline(time.Now().Add(time.Second))
	for {
		if _, _, err := f.sockets[0].ReadMessage(); err != nil {
			break
		}
	}
	// A leave while the opponent is disconnected abandons at 500000us.
	f.advance(time.Microsecond)
	status, value := admit(t, f.server, f.client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: f.admissions[1].Credential}, origin)
	if status != 201 {
		t.Fatalf("reserved participant cannot recover: %d %+v", status, value)
	}
	outcomes := make(chan p.Outcome, 2)
	observedPair(t, f.server, f.roots, value.(p.Admission), true, func(record any) {
		if outcome, ok := record.(p.Outcome); ok {
			outcomes <- outcome
		}
	})
	outcome := receiveOutcome(t, outcomes)
	if outcome.Result != 3 || outcome.Reason != 5 || outcome.TimeUs != 500000 {
		t.Fatalf("recovered abandonment: %+v", outcome)
	}
}

func TestExpiredEmptyRoomCodeIsImmediatelyReusableWithNewIdentity(t *testing.T) {
	now, advance := lifecycleClock()
	s, c, _ := configuredServer(t, transport.Config{Now: now, CodeStart: func() (uint16, error) { return 42, nil }, DragRaceOverrides: []byte(`{"room":{"reconnectGrace":2}}`)})
	_, value, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Original"}, origin)
	a := value.(p.Admission)
	if code != "0042" {
		t.Fatalf("leading zero code: %s", code)
	}
	advance(2 * time.Second)
	status, value, reused := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Replacement"}, origin)
	if status != 201 || reused != "0042" || value.(p.Admission).Identity.RoomId == a.Identity.RoomId {
		t.Fatalf("released code did not identify a fresh room: %d %s %+v", status, reused, value)
	}
	status, _ = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
	if status != 410 {
		t.Fatal("old credential recovered a reused code")
	}
}

func TestBothChannelsInitializedJustBeforeGraceClearReservation(t *testing.T) {
	now, advance := lifecycleClock()
	s, c, roots := configuredServer(t, transport.Config{Now: now, DragRaceOverrides: []byte(`{"room":{"reconnectGrace":2}}`)})
	_, value, _ := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	original := value.(p.Admission)
	status, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: original.Credential}, origin)
	if status != 201 {
		t.Fatal(status)
	}
	replacement := value.(p.Admission)
	advance(2*time.Second - time.Microsecond)
	initializedPair(t, s, roots, replacement, true)
	advance(time.Microsecond)
	status, value = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: original.Credential}, origin)
	if status != 201 || value.(p.Admission).Identity.SeatSession != original.Identity.SeatSession {
		t.Fatalf("fully initialized recovery did not clear reservation: %d %+v", status, value)
	}
}

func TestSameInstantExplicitDeparturesReleaseBothSeats(t *testing.T) {
	for _, order := range [][2]int{{0, 1}, {1, 0}} {
		t.Run(fmt.Sprint(order), func(t *testing.T) {
			f := activeLifecycle(t, `{"operational":{"simulationLagThreshold":10}}`)
			f.advance(500 * time.Millisecond)
			for _, i := range order {
				sequence := uint32(2)
				if i == 0 {
					sequence = 3
				}
				roomSend(t, f.sockets[i], f.admissions[i], sequence, f.state, 3, 1, 0)
				f.sockets[i].SetReadDeadline(time.Now().Add(time.Second))
				for {
					if _, _, err := f.sockets[i].ReadMessage(); err != nil {
						break
					}
				}
			}
			for _, a := range f.admissions {
				status, _ := admit(t, f.server, f.client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
				if status != 410 {
					t.Fatalf("departed seat recovered: %d", status)
				}
			}
			status, _ := admit(t, f.server, f.client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: f.code, Name: "Guest"}, origin)
			if status != 404 {
				t.Fatalf("empty room still joinable: %d", status)
			}
		})
	}
}

func TestEqualTimeGraceAndDisconnectAreOrderIndependent(t *testing.T) {
	for _, expiryFirst := range []bool{true, false} {
		t.Run(fmt.Sprint(expiryFirst), func(t *testing.T) {
			f := activeLifecycle(t, `{"room":{"reconnectGrace":2},"operational":{"simulationLagThreshold":10}}`)
			f.sockets[1].Close()
			f.games[1].CloseWithError(1, "disconnect")
			roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&4 != 0 })
			f.advance(2 * time.Second)
			sweepThroughAdmission := func() {
				admit(t, f.server, f.client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: make([]byte, 32)}, origin)
			}
			if expiryFirst {
				sweepThroughAdmission()
			}
			f.sockets[0].Close()
			f.games[0].CloseWithError(1, "equal-time disconnect")
			// Replacement admission synchronously closes the old pair at the same clock
			// instant, establishing disconnection even if QUIC/WS close delivery is pending.
			status, value := admit(t, f.server, f.client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: f.admissions[0].Credential}, origin)
			if status != 201 {
				t.Fatalf("remaining reservation lost: %d %+v", status, value)
			}
			replacement := value.(p.Admission)
			if !expiryFirst {
				sweepThroughAdmission()
			}
			f.advance(time.Microsecond)
			outcomes := make(chan p.Outcome, 2)
			observedPair(t, f.server, f.roots, replacement, true, func(record any) {
				if outcome, ok := record.(p.Outcome); ok {
					outcomes <- outcome
				}
			})
			outcome := receiveOutcome(t, outcomes)
			if outcome.Result != 3 || outcome.Reason != 5 || outcome.TimeUs != 2000000 {
				t.Fatalf("equal-time order changed result: %+v", outcome)
			}
		})
	}
}

func TestPairedBaselineAcknowledgementMustPrecedeGrace(t *testing.T) {
	for _, offset := range []time.Duration{-time.Microsecond, 0, time.Microsecond} {
		t.Run(offset.String(), func(t *testing.T) {
			now, advance := lifecycleClock()
			s, c, roots := configuredServer(t, transport.Config{Now: now, DragRaceOverrides: []byte(`{"room":{"reconnectGrace":2}}`)})
			_, value, _ := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
			a := value.(p.Admission)
			pairAtReady(t, s, roots, a, false, nil, func() { advance(2*time.Second + offset) }, offset < 0)
			if offset >= 0 {
				status, _ := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
				if status != 410 {
					t.Fatalf("late baseline acknowledgement revived reservation: %d", status)
				}
			}
		})
	}
}

func TestQueuedLeavePreservesBoostedGameplayThroughCutoff(t *testing.T) {
	for _, scenario := range []struct {
		cutoff         time.Duration
		result, reason uint8
		timeUs         uint64
		progress       float64
	}{
		{1499999 * time.Microsecond, 1, 3, 1499999, 1199.9992},
		{1500000 * time.Microsecond, 0, 0, 1500000, 1200},
		{1500001 * time.Microsecond, 0, 0, 1500000, 1200},
	} {
		t.Run(scenario.cutoff.String(), func(t *testing.T) {
			f := activeLifecycle(t, `{"gameplay":{"finishDistance":1240,"tickRate":1,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1},"connection":{"controlFreshnessExpiry":10},"operational":{"simulationLagThreshold":10}}`)
			sendRecord(t, f.inputs[0], p.Input{Identity: f.admissions[0].Identity, Round: p.Round{RoundId: f.state.RoundId, InputGeneration: 2}, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
			// Let the real input reader queue the press before advancing its next tick.
			time.Sleep(20 * time.Millisecond)
			f.advance(time.Second)
			select {
			case disposition := <-f.dispositions[0]:
				if disposition.Disposition != 0 || disposition.Car.Flags&1 == 0 {
					t.Fatalf("NOS was not accepted: %+v", disposition)
				}
			case <-time.After(time.Second):
				t.Fatal("no authoritative input disposition")
			}
			f.advance(scenario.cutoff - time.Second)
			roomSend(t, f.sockets[0], f.admissions[0], 3, f.state, 3, 1, 0)
			f.sockets[0].SetReadDeadline(time.Now().Add(time.Second))
			for {
				if _, _, err := f.sockets[0].ReadMessage(); err != nil {
					break
				}
			}
			f.advance(time.Microsecond)
			outcome := receiveOutcome(t, f.outcomes[1])
			if outcome.Result != scenario.result || outcome.Reason != scenario.reason || outcome.TimeUs != scenario.timeUs || math.Abs(outcome.Cars[0].Progress-scenario.progress) > 1e-6+1e-12*math.Abs(scenario.progress) {
				t.Fatalf("leave erased boosted gameplay: %+v", outcome)
			}
		})
	}
}
