package transport_test

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	ws "github.com/fasthttp/websocket"
	wt "github.com/quic-go/webtransport-go"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
)

// Keep application acknowledgements under the scenario's control. These are
// real TLS/QUIC endpoints, including the paired room channel.
func failurePair(t *testing.T, s *transport.Server, roots *x509.CertPool, a p.Admission, frameBounds ...int) (*ws.Conn, *wt.Session, *wt.Stream, *wt.SendStream, *wt.ReceiveStream, p.BaselineChunk) {
	t.Helper()
	dialer := ws.Dialer{TLSClientConfig: &tls.Config{RootCAs: roots}}
	socket, _, err := dialer.Dial("wss"+strings.TrimPrefix(s.URL(), "https")+"/room?ticket="+base64.RawURLEncoding.EncodeToString(a.RoomTicket), http.Header{"Origin": []string{origin}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { socket.Close() })
	socket.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, wire, err := socket.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	if err = socket.WriteMessage(ws.BinaryMessage, wire); err != nil {
		t.Fatal(err)
	}
	client := &wt.Transport{TLSClientConfig: &tls.Config{RootCAs: roots}}
	t.Cleanup(func() { client.Close() })
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, session, err := client.Dial(ctx, s.URL()+"/gameplay?ticket="+base64.RawURLEncoding.EncodeToString(a.GameplayTicket), http.Header{"Origin": []string{origin}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { session.CloseWithError(0, "test complete") })
	control, err := session.OpenStreamSync(ctx)
	if err != nil {
		t.Fatal(err)
	}
	control.SetDeadline(time.Now().Add(3 * time.Second))
	sendRecord(t, control, p.Handshake{Version: p.ProtocolVersion, Identity: a.Identity, DatagramBytes: 10})
	readRecord(t, control)
	initialization := readRecord(t, control).(p.Initialization)
	inputs, err := session.OpenUniStreamSync(ctx)
	if err != nil {
		t.Fatal(err)
	}
	sendRecord(t, inputs, p.Input{Identity: a.Identity, Round: initialization.Round, Sequence: 1, Intent: 2})
	authority, err := session.AcceptUniStream(ctx)
	if err != nil {
		t.Fatal(err)
	}
	authority.SetReadDeadline(time.Now().Add(3 * time.Second))
	chunk := readRecord(t, authority).(p.BaselineChunk)
	for i := uint32(0); i < chunk.Count; i++ {
		part := chunk
		if i > 0 {
			part = readRecord(t, authority).(p.BaselineChunk)
		}
		if len(frameBounds) > 0 {
			if _, err := p.EncodeMessage(part, frameBounds[0]); err != nil {
				t.Fatalf("server exceeded configured frame bound: %v", err)
			}
		}
	}
	sendRecord(t, control, p.Ready{Identity: a.Identity, Round: chunk.Round, TransferId: chunk.TransferId, Epoch: chunk.Epoch, Progress: chunk.Progress})
	roomState(t, socket, func(r p.RoomState) bool { return r.Seats[a.Identity.Seat].Flags&1 != 0 })
	return socket, session, control, inputs, authority, chunk
}

func TestBaselineTransferHonorsConfiguredFrameAndQueueBounds(t *testing.T) {
	s, c, roots := configuredServer(t, transport.Config{DragRaceOverrides: []byte(`{"connection":{"reliableFrameBytes":1024,"queueBytes":2048},"gameplay":{"sliceSpacing":50,"initialClearDistance":0}}`)})
	_, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	_, _, _, _, _, chunk := failurePair(t, s, roots, value.(p.Admission), 1024)
	if chunk.Count < 2 {
		t.Fatal("fixture must require multiple bounded chunks")
	}
}

func TestRecoveryRejectsUninstalledEpoch(t *testing.T) {
	for _, epoch := range []uint16{0, 2} {
		t.Run(string(rune('0'+epoch)), func(t *testing.T) {
			s, c, roots := serverMode(t, false)
			_, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
			a := value.(p.Admission)
			socket, session, control, _, authority, chunk := failurePair(t, s, roots, a)
			sendRecord(t, control, p.Recovery{Identity: a.Identity, Round: chunk.Round, Epoch: epoch, Tick: chunk.Tick, Progress: chunk.Progress})
			// A rejected request cannot start a replacement baseline.
			for {
				record, err := readTestFrame(authority)
				if err != nil {
					break
				}
				if _, ok := record.(p.BaselineChunk); ok {
					t.Fatal("uninstalled epoch started recovery")
				}
			}
			select {
			case <-session.Context().Done():
			case <-time.After(2 * time.Second):
				t.Fatal("gameplay pair remained open")
			}
			for {
				if _, _, err := socket.ReadMessage(); err != nil {
					break
				}
			}
		})
	}
}

func TestMalformedAndExcessiveTrafficFailsBothChannels(t *testing.T) {
	cases := []struct {
		name   string
		attack func(*testing.T, *wt.Session, *wt.Stream, *wt.SendStream, p.Admission, p.BaselineChunk)
	}{
		{"sequence gap", func(t *testing.T, _ *wt.Session, _ *wt.Stream, inputs *wt.SendStream, a p.Admission, b p.BaselineChunk) {
			sendRecord(t, inputs, p.Input{Identity: a.Identity, Round: b.Round, Sequence: 3, Intent: 2})
		}},
		{"stale pair identity", func(t *testing.T, _ *wt.Session, _ *wt.Stream, inputs *wt.SendStream, a p.Admission, b p.BaselineChunk) {
			a.Identity.PairGeneration++
			sendRecord(t, inputs, p.Input{Identity: a.Identity, Round: b.Round, Sequence: 2, Intent: 2})
		}},
		{"wrong stream", func(t *testing.T, _ *wt.Session, control *wt.Stream, _ *wt.SendStream, a p.Admission, b p.BaselineChunk) {
			sendRecord(t, control, p.Input{Identity: a.Identity, Round: b.Round, Sequence: 2, Intent: 2})
		}},
		{"oversized advertised frame", func(t *testing.T, _ *wt.Session, _ *wt.Stream, inputs *wt.SendStream, _ p.Admission, _ p.BaselineChunk) {
			if _, err := inputs.Write([]byte{255, 255, 255, 255}); err != nil {
				t.Fatal(err)
			}
		}},
		{"partial frame EOF", func(t *testing.T, _ *wt.Session, _ *wt.Stream, inputs *wt.SendStream, _ p.Admission, _ p.BaselineChunk) {
			if _, err := inputs.Write([]byte{0, 0}); err != nil {
				t.Fatal(err)
			}
			inputs.Close()
		}},
		{"unknown message", func(t *testing.T, _ *wt.Session, _ *wt.Stream, inputs *wt.SendStream, _ p.Admission, _ p.BaselineChunk) {
			if _, err := inputs.Write([]byte{0, 0, 0, 1, 255}); err != nil {
				t.Fatal(err)
			}
		}},
		{"client datagram", func(t *testing.T, session *wt.Session, _ *wt.Stream, _ *wt.SendStream, _ p.Admission, _ p.BaselineChunk) {
			if err := session.SendDatagram(make([]byte, 10)); err != nil {
				t.Fatal(err)
			}
		}},
		{"extra control stream", func(t *testing.T, session *wt.Session, _ *wt.Stream, _ *wt.SendStream, _ p.Admission, _ p.BaselineChunk) {
			stream, err := session.OpenStreamSync(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			if _, err = stream.Write([]byte{0}); err != nil {
				t.Fatal(err)
			}
		}},
		{"clock rate", func(t *testing.T, _ *wt.Session, control *wt.Stream, _ *wt.SendStream, _ p.Admission, _ p.BaselineChunk) {
			sendRecord(t, control, p.ClockRequest{Sequence: 1})
			sendRecord(t, control, p.ClockRequest{Sequence: 2})
		}},
		{"input burst", func(t *testing.T, _ *wt.Session, _ *wt.Stream, inputs *wt.SendStream, a p.Admission, b p.BaselineChunk) {
			wire, err := p.EncodeMessage(p.Input{Identity: a.Identity, Round: b.Round, Sequence: 1, Intent: 2}, 65536)
			if err != nil {
				t.Fatal(err)
			}
			// Duplicate traffic is still charged; it must not bypass the rate budget.
			batch := []byte{}
			for i := 0; i < 200; i++ {
				batch = append(batch, wire...)
			}
			_, _ = inputs.Write(batch)
		}},
	}
	for _, mode := range []uint8{1, 2} {
		for _, tc := range cases {
			t.Run(fmt.Sprintf("mode%d/%s", mode, tc.name), func(t *testing.T) {
				s, c, roots := serverMode(t, false)
				_, value, _ := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin, mode)
				a := value.(p.Admission)
				socket, session, control, inputs, _, chunk := failurePair(t, s, roots, a)
				tc.attack(t, session, control, inputs, a, chunk)
				select {
				case <-session.Context().Done():
				case <-time.After(700 * time.Millisecond):
					t.Fatal("invalid traffic did not fail gameplay promptly")
				}
				socket.SetReadDeadline(time.Now().Add(time.Second))
				for {
					if _, _, err := socket.ReadMessage(); err != nil {
						if err, ok := err.(interface{ Timeout() bool }); ok && err.Timeout() {
							t.Fatal("paired room channel remained open")
						}
						break
					}
				}
			})
		}
	}
}

func TestReusedPairRetainsConnectionSettingsAcrossModeChange(t *testing.T) {
	s, c, roots := configuredServer(t, transport.Config{RoadRageOverrides: []byte(`{"connection":{"controlRefreshInterval":0.1,"controlFreshnessExpiry":0.6}}`)})
	_, value, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := value.(p.Admission)
	initializations := make(chan p.Initialization, 4)
	dispositions := make(chan p.Disposition, 16)
	chunks := make(chan p.BaselineChunk, 4)
	var input *wt.SendStream
	host, _ := observedPair(t, s, roots, a, true, func(value any) {
		switch x := value.(type) {
		case *wt.SendStream:
			input = x
		case p.Initialization:
			initializations <- x
		case p.BaselineChunk:
			chunks <- x
		case p.Disposition:
			dispositions <- x
		}
	})
	_, value = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Guest"}, origin)
	b := value.(p.Admission)
	guest, _ := initializedPair(t, s, roots, b, true)
	state := roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
	roomSend(t, host, a, 1, state, 0, 2, 0)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Mode == 2 })
	roomSend(t, host, a, 2, state, 1, 2, 1)
	state = roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
	roomSend(t, guest, b, 1, state, 1, 2, 1)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
	roomSend(t, host, a, 3, state, 2, 2, 0)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Phase == 2 })
	var init p.Initialization
	select {
	case init = <-initializations:
	case <-time.After(time.Second):
		t.Fatal("missing new-round initialization")
	}
	if init.Context.Connection.ControlFreshnessExpiry != 1 || init.Context.Connection.ControlRefreshInterval != .25 {
		t.Fatal("reused pair lost captured connection settings")
	}
	var chunk p.BaselineChunk
	select {
	case chunk = <-chunks:
	case <-time.After(time.Second):
		t.Fatal("missing new-round baseline")
	}
	sendRecord(t, input, p.Input{Identity: a.Identity, Round: chunk.Round, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
	select {
	case d := <-dispositions:
		if d.Car.FreshnessUs-d.TimeUs != 1000000 {
			t.Fatalf("authority used new-mode freshness instead of captured pair setting: %d", d.Car.FreshnessUs-d.TimeUs)
		}
	case <-time.After(time.Second):
		t.Fatal("missing input disposition")
	}
	// A replacement pair captures the now-selected mode's settings, while the
	// reused pair above retained its original settings through the same round.
	_, value = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
	replacement := value.(p.Admission)
	_, _, _, replacementInput, authority, installed := failurePair(t, s, roots, replacement)
	baseline, err := p.DecodeBaseline(installed.Data, 1048576)
	if err != nil {
		t.Fatal(err)
	}
	if baseline.Context.Connection.ControlFreshnessExpiry != .6 {
		t.Fatal("replacement did not capture current connection settings")
	}
	sendRecord(t, replacementInput, p.Input{Identity: replacement.Identity, Round: installed.Round, Sequence: 2, Intent: 0, Control: 3, HeldMask: 4})
	for {
		if d, ok := readRecord(t, authority).(p.Disposition); ok {
			if d.Car.FreshnessUs-d.TimeUs != 600000 {
				t.Fatal("replacement authority did not use its captured freshness")
			}
			break
		}
	}
}
