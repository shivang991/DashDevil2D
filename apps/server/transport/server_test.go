package transport_test

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/binary"
	"encoding/pem"
	"fmt"
	ws "github.com/fasthttp/websocket"
	wt "github.com/quic-go/webtransport-go"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
)

const origin = "https://localhost:4173"

func localCertificate(t *testing.T) (string, string, *x509.CertPool) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "localhost"}, DNSNames: []string{"localhost"}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(24 * time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	private, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	certPath, keyPath := filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem")
	cert := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err = os.WriteFile(certPath, cert, 0600); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: private}), 0600); err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(cert)
	return certPath, keyPath, roots
}
func server(t *testing.T) (*transport.Server, *http.Client, *x509.CertPool) {
	return serverMode(t, true)
}
func serverMode(t *testing.T, diagnostic bool) (*transport.Server, *http.Client, *x509.CertPool) {
	return configuredServer(t, transport.Config{Diagnostic: diagnostic})
}
func configuredServer(t *testing.T, config transport.Config) (*transport.Server, *http.Client, *x509.CertPool) {
	t.Helper()
	cert, key, roots := localCertificate(t)
	config.Address, config.Origin, config.Certificate, config.Key = "127.0.0.1:0", origin, cert, key
	s, err := transport.New(config)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s, &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots}}, Timeout: 3 * time.Second}, roots
}
func admit(t *testing.T, s *transport.Server, c *http.Client, request p.AdmissionRequest, from string) (int, any) {
	t.Helper()
	status, value, _ := admitWithCode(t, s, c, request, from)
	return status, value
}
func admitWithCode(t *testing.T, s *transport.Server, c *http.Client, request p.AdmissionRequest, from string) (int, any, string) {
	t.Helper()
	wire, err := p.EncodeMessage(request, 65536)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequestWithContext(context.Background(), "POST", s.URL()+"/admission", bytes.NewReader(wire))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", from)
	req.Header.Set("Content-Type", "application/octet-stream")
	response, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	value, err := p.DecodeMessage(body, 65536)
	if err != nil {
		t.Fatalf("decode %d: %v %q", response.StatusCode, err, body)
	}
	return response.StatusCode, value, response.Header.Get("X-Room-Code")
}
func TestHTTPSAdmissionBindsOpaqueSeatAndReplacementGeneration(t *testing.T) {
	s, c, _ := server(t)
	status, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	if status != 201 {
		t.Fatalf("create: %d %v", status, value)
	}
	a := value.(p.Admission)
	if len(a.Credential) != 32 || len(a.RoomTicket) != 32 || len(a.GameplayTicket) != 32 || bytes.Equal(a.RoomTicket, a.GameplayTicket) {
		t.Fatal("credentials and tickets must be distinct 256-bit values")
	}
	if a.Identity.RoomId == 0 || a.Identity.PairGeneration != 1 || a.Identity.Seat != 0 {
		t.Fatalf("identity: %+v", a.Identity)
	}
	status, value = admit(t, s, c, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	b := value.(p.Admission)
	if status != 201 || b.Identity.SeatSession != a.Identity.SeatSession || b.Identity.PairGeneration != 2 || !bytes.Equal(a.Credential, b.Credential) {
		t.Fatalf("resume: %d %+v", status, b)
	}
	status, value = admit(t, s, c, p.AdmissionRequest{Version: 99, Name: "Driver"}, origin)
	if status != 409 || value.(p.ProtocolError).ExpectedVersion != p.ProtocolVersion {
		t.Fatal("explicit version error required")
	}
	status, _ = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, "https://evil.example")
	if status != 403 {
		t.Fatal("foreign origins must be rejected")
	}
}

func TestRoomTicketIsSingleUseAndRoomInitializationIsBoundToSeat(t *testing.T) {
	s, c, roots := server(t)
	_, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	a := value.(p.Admission)
	dialer := ws.Dialer{TLSClientConfig: &tls.Config{RootCAs: roots}}
	endpoint := "wss" + strings.TrimPrefix(s.URL(), "https") + "/room?ticket=" + base64.RawURLEncoding.EncodeToString(a.RoomTicket)
	socket, _, err := dialer.Dial(endpoint, http.Header{"Origin": []string{origin}})
	if err != nil {
		t.Fatal(err)
	}
	defer socket.Close()
	socket.SetReadDeadline(time.Now().Add(time.Second))
	_, wire, err := socket.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	message, err := p.DecodeMessage(wire, 65536)
	if err != nil {
		t.Fatal(err)
	}
	init, ok := message.(p.RoomInitialization)
	if !ok || init.Identity != a.Identity || init.Version != p.ProtocolVersion {
		t.Fatalf("initialization: %v", message)
	}
	second, reply, err := dialer.Dial(endpoint, http.Header{"Origin": []string{origin}})
	if second != nil {
		second.Close()
	}
	if err == nil || reply.StatusCode != 403 {
		t.Fatal("ticket replay accepted")
	}
}

func readRecord(t *testing.T, r io.Reader) any {
	t.Helper()
	var prefix [4]byte
	if _, err := io.ReadFull(r, prefix[:]); err != nil {
		t.Fatal(err)
	}
	n := binary.BigEndian.Uint32(prefix[:])
	if n < 1 || n > 65532 {
		t.Fatal("unbounded record")
	}
	body := make([]byte, int(n)+4)
	copy(body, prefix[:])
	if _, err := io.ReadFull(r, body[4:]); err != nil {
		t.Fatal(err)
	}
	value, err := p.DecodeMessage(body, 65536)
	if err != nil {
		t.Fatal(err)
	}
	return value
}
func sendRecord(t *testing.T, w io.Writer, value any) {
	t.Helper()
	wire, err := p.EncodeMessage(value, 65536)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = w.Write(wire); err != nil {
		t.Fatal(err)
	}
}
func TestRealQUICInitializesThreeStreamsAndVerifiesDiagnosticState(t *testing.T) {
	s, c, roots := server(t)
	_, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	a := value.(p.Admission)
	dialer := wt.Transport{TLSClientConfig: &tls.Config{RootCAs: roots}}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	_, session, err := dialer.Dial(ctx, s.URL()+"/gameplay?ticket="+base64.RawURLEncoding.EncodeToString(a.GameplayTicket), http.Header{"Origin": []string{origin}})
	if err != nil {
		t.Fatal(err)
	}
	defer session.CloseWithError(0, "test complete")
	control, err := session.OpenStreamSync(ctx)
	if err != nil {
		t.Fatal(err)
	}
	control.SetDeadline(time.Now().Add(3 * time.Second))
	sendRecord(t, control, p.Handshake{Version: p.ProtocolVersion, Identity: a.Identity, DatagramBytes: 10})
	handshake := readRecord(t, control).(p.Handshake)
	if handshake.Identity != a.Identity {
		t.Fatal("handshake seat mismatch")
	}
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
	baseline, err := p.DecodeBaseline(chunk.Data, 1048576)
	if err != nil {
		t.Fatal(err)
	}
	if err = p.ValidateBaseline(baseline, initialization.Context); err != nil {
		t.Fatal(err)
	}
	if baseline.Cars[0].Progress != 100.125 || baseline.Cars[1].Progress != 20000.5 || baseline.Cars[0].HeldMask != 0 || baseline.Cars[1].HeldMask != 0 {
		t.Fatal("diagnostic state or fresh controls wrong")
	}
	sendRecord(t, control, p.Ready{Identity: a.Identity, Round: baseline.Round, TransferId: chunk.TransferId, Epoch: baseline.Epoch, Progress: baseline.Progress})
	// No WebSocket yet: gameplay initialization alone must not connect the seat.
	// A barrier and datagram still exercise initialized gameplay while admission awaits room init.
	var barrier p.Barrier
	for {
		record := readRecord(t, authority)
		if disposition, ok := record.(p.Disposition); ok {
			baseline.Cars[disposition.Seat] = disposition.Car
			continue
		}
		barrier = record.(p.Barrier)
		break
	}
	datagram, err := session.ReceiveDatagram(ctx)
	if err != nil {
		t.Fatal(err)
	}
	verification, err := p.DecodeVerification(datagram, 10)
	if err != nil {
		t.Fatal(err)
	}
	if verification.Epoch != baseline.Epoch || verification.Tick != barrier.Tick {
		t.Fatal("verification barrier mismatch")
	}
	baseline.Tick = barrier.Tick
	baseline.TimeUs = barrier.TimeUs
	baseline.Progress = barrier.Progress
	projection, err := p.ProjectBaseline(baseline)
	if err != nil {
		t.Fatal(err)
	}
	if verification.Crc != p.CRC32C(projection) {
		t.Fatal("verification must describe exact diagnostic continuation")
	}
	sendRecord(t, control, p.AuthorityAck{Identity: a.Identity, Round: baseline.Round, Epoch: barrier.Epoch, Tick: barrier.Tick, Progress: barrier.Progress})
	sendRecord(t, control, p.ClockRequest{Sequence: 1, ClientSendUs: 123})
	reply := readRecord(t, control).(p.ClockReply)
	if reply.ClientSendUs != 123 || reply.ServerSendUs < reply.ServerReceiveUs {
		t.Fatal("clock timestamps")
	}
	sendRecord(t, control, p.Recovery{Identity: a.Identity, Round: baseline.Round, Epoch: baseline.Epoch, Tick: barrier.Tick, Progress: barrier.Progress})
	var recovery p.BaselineChunk
	for {
		record := readRecord(t, authority)
		if chunk, ok := record.(p.BaselineChunk); ok {
			recovery = chunk
			break
		}
	}
	if recovery.Epoch != 2 || recovery.TransferId != 2 {
		t.Fatal("correction must establish a fresh epoch/transfer")
	}
	restored, err := p.DecodeBaseline(recovery.Data, 1048576)
	if err != nil {
		t.Fatal(err)
	}
	if restored.Cars[0].Progress != 100.125 || restored.Cars[1].Progress != 20000.5 || restored.Round != baseline.Round {
		t.Fatal("correction altered diagnostic context")
	}
	sendRecord(t, control, p.Ready{Identity: a.Identity, Round: restored.Round, TransferId: 2, Epoch: 2, Progress: restored.Progress})

}

// initializedPair exercises only public TLS endpoints, never server internals.
func initializedPair(t *testing.T, s *transport.Server, roots *x509.CertPool, a p.Admission, acknowledge bool) (*ws.Conn, *wt.Session) {
	return observedPair(t, s, roots, a, acknowledge, nil)
}
func observedPair(t *testing.T, s *transport.Server, roots *x509.CertPool, a p.Admission, acknowledge bool, observe func(any)) (*ws.Conn, *wt.Session) {
	return pairAtReady(t, s, roots, a, acknowledge, observe, nil, true)
}
func pairAtReady(t *testing.T, s *transport.Server, roots *x509.CertPool, a p.Admission, acknowledge bool, observe func(any), beforeReady func(), wantConnected bool) (*ws.Conn, *wt.Session) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	socket, _, err := (&ws.Dialer{TLSClientConfig: &tls.Config{RootCAs: roots}}).Dial("wss"+strings.TrimPrefix(s.URL(), "https")+"/room?ticket="+base64.RawURLEncoding.EncodeToString(a.RoomTicket), http.Header{"Origin": []string{origin}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { socket.Close() })
	socket.SetReadDeadline(time.Now().Add(4 * time.Second))
	_, wire, err := socket.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	init, err := p.DecodeMessage(wire, 65536)
	if err != nil {
		t.Fatal(err)
	}
	reply, _ := p.EncodeMessage(init, 65536)
	if err = socket.WriteMessage(ws.BinaryMessage, reply); err != nil {
		t.Fatal(err)
	}
	client := wt.Transport{TLSClientConfig: &tls.Config{RootCAs: roots}}
	_, session, err := client.Dial(ctx, s.URL()+"/gameplay?ticket="+base64.RawURLEncoding.EncodeToString(a.GameplayTicket), http.Header{"Origin": []string{origin}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { session.CloseWithError(0, "test") })
	control, err := session.OpenStreamSync(ctx)
	if err != nil {
		t.Fatal(err)
	}
	control.SetDeadline(time.Now().Add(4 * time.Second))
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
	chunk := readRecord(t, authority).(p.BaselineChunk)
	// Room-only admission is reserved until the gameplay baseline is acknowledged.
	for {
		_, wire, err = socket.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		value, e := p.DecodeMessage(wire, 65536)
		if e != nil {
			t.Fatal(e)
		}
		if state, ok := value.(p.RoomState); ok {
			if state.Seats[a.Identity.Seat].Flags&1 != 0 {
				t.Fatal("connected before baseline acknowledgement")
			}
			break
		}
	}
	if beforeReady != nil {
		beforeReady()
	}
	ready := p.Ready{Identity: a.Identity, Round: initialization.Round, TransferId: 1, Epoch: chunk.Epoch, Progress: chunk.Progress}
	if wantConnected {
		sendRecord(t, control, ready)
	} else {
		wire, _ := p.EncodeMessage(ready, 65536)
		_, _ = control.Write(wire)
	}
	for {
		_, wire, err = socket.ReadMessage()
		if err != nil {
			if !wantConnected {
				return socket, session
			}
			t.Fatal(err)
		}
		value, e := p.DecodeMessage(wire, 65536)
		if e != nil {
			t.Fatal(e)
		}
		if state, ok := value.(p.RoomState); ok && state.Seats[a.Identity.Seat].Flags&1 != 0 {
			if !wantConnected {
				t.Fatal("connected at/after grace without timely paired initialization")
			}
			break
		}
	}
	control.SetDeadline(time.Time{})
	if acknowledge {
		go func() {
			for {
				record, e := readTestFrame(control)
				if e != nil {
					return
				}
				if observe != nil {
					observe(record)
				}
			}
		}()
		go func() {
			for {
				record, e := readTestFrame(authority)
				if e != nil {
					return
				}
				if pulse, ok := record.(p.RoomPulse); ok {
					wire, _ := p.EncodeMessage(pulse, 65536)
					if _, e = control.Write(wire); e != nil {
						return
					}
				}
				if chunk, ok := record.(p.BaselineChunk); ok {
					wire, _ := p.EncodeMessage(p.Ready{Identity: a.Identity, Round: chunk.Round, TransferId: chunk.TransferId, Epoch: chunk.Epoch, Progress: chunk.Progress}, 65536)
					if _, e = control.Write(wire); e != nil {
						return
					}
				}
				if barrier, ok := record.(p.Barrier); ok {
					wire, e := p.EncodeMessage(p.AuthorityAck{Identity: a.Identity, Round: barrier.Round, Epoch: barrier.Epoch, Tick: barrier.Tick, Progress: barrier.Progress}, 65536)
					if e != nil {
						return
					}
					if _, e = control.Write(wire); e != nil {
						return
					}
				}
			}
		}()
	}
	return socket, session
}
func readTestFrame(r io.Reader) (any, error) {
	var prefix [4]byte
	if _, err := io.ReadFull(r, prefix[:]); err != nil {
		return nil, err
	}
	n := binary.BigEndian.Uint32(prefix[:])
	if n < 1 || n > 65532 {
		return nil, fmt.Errorf("frame too large")
	}
	body := make([]byte, int(n)+4)
	copy(body, prefix[:])
	if _, err := io.ReadFull(r, body[4:]); err != nil {
		return nil, err
	}
	return p.DecodeMessage(body, 65536)
}
func TestPairLossRecoversSameSeatAndReplacementOutlivesOldCallbacks(t *testing.T) {
	s, c, roots := server(t)
	_, v := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	a := v.(p.Admission)
	socket, gameplay := initializedPair(t, s, roots, a, true)
	socket.Close()
	select {
	case <-gameplay.Context().Done():
	case <-time.After(2 * time.Second):
		t.Fatal("room loss did not close gameplay")
	}
	_, v = admit(t, s, c, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	b := v.(p.Admission)
	_, replacement := initializedPair(t, s, roots, b, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	d := v.(p.Admission)
	_, current := initializedPair(t, s, roots, d, true)
	if d.Identity.SeatSession != a.Identity.SeatSession || d.Identity.PairGeneration != 3 {
		t.Fatal("seat replacement identity")
	}
	select {
	case <-replacement.Context().Done():
	case <-time.After(time.Second):
		t.Fatal("replacement did not close old gameplay")
	}
	gameplay.CloseWithError(1, "late teardown")
	replacement.CloseWithError(1, "late teardown")
	select {
	case <-current.Context().Done():
		t.Fatal("old teardown killed current pair")
	case <-time.After(250 * time.Millisecond):
	}
}
func TestUnacknowledgedApplicationProgressClosesBothChannels(t *testing.T) {
	s, c, roots := server(t)
	_, v := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	socket, gameplay := initializedPair(t, s, roots, v.(p.Admission), false)
	select {
	case <-gameplay.Context().Done():
	case <-time.After(2500 * time.Millisecond):
		t.Fatal("transport write success hid missing application progress")
	}
	socket.SetReadDeadline(time.Now().Add(time.Second))
	for {
		_, _, err := socket.ReadMessage()
		if err != nil {
			break
		}
	}
}

func TestDisconnectedReservationCannotBeExtendedByTicketRetries(t *testing.T) {
	s, c, _ := server(t)
	_, v := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	a := v.(p.Admission)
	timer := time.NewTimer(8 * time.Second)
	defer timer.Stop()
	<-timer.C
	status, v := admit(t, s, c, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	if status != 201 || v.(p.Admission).Identity.SeatSession != a.Identity.SeatSession {
		t.Fatal("same seat must recover before grace")
	}
	timer.Reset(7500 * time.Millisecond)
	<-timer.C
	status, v = admit(t, s, c, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	if status != 410 || v.(p.ProtocolError).Detail != "Room expired" {
		t.Fatal("ticket retries extended reconnect grace")
	}
}
func TestTicketsRejectWrongChannelAndOriginWithoutConsumingValidAdmission(t *testing.T) {
	s, c, roots := server(t)
	_, v := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Driver"}, origin)
	a := v.(p.Admission)
	dialer := ws.Dialer{TLSClientConfig: &tls.Config{RootCAs: roots}}
	for _, attempt := range []struct {
		ticket []byte
		origin string
	}{{a.GameplayTicket, origin}, {a.RoomTicket, "https://evil.example"}} {
		socket, response, err := dialer.Dial("wss"+strings.TrimPrefix(s.URL(), "https")+"/room?ticket="+base64.RawURLEncoding.EncodeToString(attempt.ticket), http.Header{"Origin": []string{attempt.origin}})
		if socket != nil {
			socket.Close()
		}
		if err == nil || response.StatusCode != 403 {
			t.Fatal("ticket binding bypass")
		}
	}
	socket, gameplay := initializedPair(t, s, roots, a, true)
	socket.WriteMessage(ws.BinaryMessage, []byte{0xff, 0xff, 0xff, 0xff})
	select {
	case <-gameplay.Context().Done():
	case <-time.After(time.Second):
		t.Fatal("oversized room frame did not fail pair")
	}
}

func TestReservationExpiryNotifiesConnectedGuestAndTransfersHost(t *testing.T) {
	s, c, roots := server(t)
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, gameplay := initializedPair(t, s, roots, a, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Operation: 1, Version: p.ProtocolVersion, Code: code, Name: "Guest"}, origin)
	guest, _ := initializedPair(t, s, roots, v.(p.Admission), true)
	host.Close()
	select {
	case <-gameplay.Context().Done():
	case <-time.After(time.Second):
		t.Fatal("pair did not close")
	}
	guest.SetReadDeadline(time.Now().Add(17 * time.Second))
	for {
		_, wire, err := guest.ReadMessage()
		if err != nil {
			t.Fatalf("guest never received reservation expiry: %v", err)
		}
		record, err := p.DecodeMessage(wire, 65536)
		if err != nil {
			t.Fatal(err)
		}
		if state, ok := record.(p.RoomState); ok && state.Seats[0].Session == 0 {
			if state.Host != 1 || state.Seats[1].Flags&1 == 0 {
				t.Fatal("expiry did not preserve connected guest as host")
			}
			return
		}
	}
}
