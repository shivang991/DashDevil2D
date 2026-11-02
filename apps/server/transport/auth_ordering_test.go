package transport_test

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	ws "github.com/fasthttp/websocket"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	"github.com/shivang991/DashDevil2D/apps/server/multiplayer"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	network "github.com/shivang991/DashDevil2D/apps/server/transport"
)

func networkFixture(t *testing.T, config network.Config) (*network.Server, *http.Client, *x509.CertPool) {
	t.Helper()
	cert, key, roots := localCertificate(t)
	config.Address, config.Origin, config.Certificate, config.Key = "127.0.0.1:0", origin, cert, key
	s, err := network.New(config)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	return s, &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots}}, Timeout: 3 * time.Second}, roots
}

// Pause after real room admission, before HTTPS can publish channel tickets.
func TestAdmissionSerializesTicketPublicationWithResume(t *testing.T) {
	var auth sync.Mutex
	entered := make(chan struct{}, 2)
	allocated := make(chan multiplayer.AdmissionResult, 1)
	release := make(chan struct{})
	var releaseOnce sync.Once
	unblock := func() { releaseOnce.Do(func() { close(release) }) }
	defer unblock()
	var listener *network.Server
	owner, err := multiplayer.New(multiplayer.Config{Diagnostic: true, NewConnection: func(h multiplayer.Handle, id p.Identity, limits p.Connection) multiplayer.Delivery {
		return listener.NewConnection(h, id, limits)
	}})
	if err != nil {
		t.Fatal(err)
	}
	listener, client, _ := networkFixture(t, network.Config{Auth: &auth, NowUs: owner.NowUs, Admit: func(request p.AdmissionRequest, mode, cookie, challenge string) (multiplayer.AdmissionResult, error) {
		entered <- struct{}{}
		result, err := owner.Admit(request, mode, accounts.Session{}, 0, multiplayer.Invitation{})
		if request.Operation == p.AdmissionOperationCreate {
			allocated <- result
			<-release
		}
		return result, err
	}})
	// Cleanup must release pending requests before closing the listener.
	t.Cleanup(unblock)
	request := func(v p.AdmissionRequest) error {
		wire, err := p.EncodeMessage(v, p.DefaultFrameBytes)
		if err != nil {
			return err
		}
		req, err := http.NewRequestWithContext(context.Background(), "POST", listener.URL()+"/admission", strings.NewReader(string(wire)))
		if err != nil {
			return err
		}
		req.Header.Set("Origin", origin)
		response, err := client.Do(req)
		if err != nil {
			return err
		}
		defer response.Body.Close()
		if response.StatusCode != 201 {
			return errors.New("admission rejected")
		}
		return nil
	}
	created := make(chan error, 1)
	go func() {
		created <- request(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationCreate, Name: "Driver"})
	}()
	<-entered
	first := <-allocated
	resumed := make(chan error, 1)
	go func() {
		resumed <- request(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationResume, Credential: first.Credential})
	}()
	select {
	case <-entered:
		t.Fatal("resume overtook pending ticket publication")
	case <-time.After(50 * time.Millisecond):
	}
	unblock()
	if err := <-created; err != nil {
		t.Fatal(err)
	}
	if err := <-resumed; err != nil {
		t.Fatal(err)
	}
}

func TestTicketExpiryRecheckedAfterDurableAuthentication(t *testing.T) {
	store, err := accounts.Open(filepath.Join(t.TempDir(), "tickets.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	if err = store.Bootstrap("Ticket_Driver", "ticket test password"); err != nil {
		t.Fatal(err)
	}
	now, advance := lifecycleClock()
	account, _, err := store.Login("Ticket_Driver", "ticket test password", now())
	if err != nil {
		t.Fatal(err)
	}
	chatID, err := store.ChatID(account.User.ID)
	if err != nil {
		t.Fatal(err)
	}
	var listener *network.Server
	owner, err := multiplayer.New(multiplayer.Config{Accounts: store, Now: now, DragRaceOverrides: []byte(`{"room":{"reconnectGrace":60}}`), NewConnection: func(h multiplayer.Handle, id p.Identity, limits p.Connection) multiplayer.Delivery {
		return listener.NewConnection(h, id, limits)
	}})
	if err != nil {
		t.Fatal(err)
	}
	var auth sync.Mutex
	listener, client, roots := networkFixture(t, network.Config{Auth: &auth, Now: now, NowUs: owner.NowUs, Admit: func(request p.AdmissionRequest, mode, cookie, challenge string) (multiplayer.AdmissionResult, error) {
		return owner.Admit(request, mode, account, chatID, multiplayer.Invitation{})
	}, AuthenticateSession: func(id string) error {
		// Simulate authentication spanning ticket expiry, while the seat's longer
		// reconnect reservation and durable session both remain valid.
		advance(31 * time.Second)
		_, err := store.Session(id, now())
		return err
	}})
	wire, _ := p.EncodeMessage(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationCreate, Name: account.Username}, p.DefaultFrameBytes)
	req, _ := http.NewRequestWithContext(context.Background(), "POST", listener.URL()+"/admission", strings.NewReader(string(wire)))
	req.Header.Set("Origin", origin)
	response, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	value := readRecord(t, response.Body)
	response.Body.Close()
	admission, ok := value.(p.Admission)
	if !ok {
		t.Fatalf("admission failed: %T", value)
	}
	endpoint := "wss" + strings.TrimPrefix(listener.URL(), "https") + "/room?ticket=" + base64.RawURLEncoding.EncodeToString(admission.RoomTicket)
	socket, rejected, err := (&ws.Dialer{TLSClientConfig: &tls.Config{RootCAs: roots}}).Dial(endpoint, http.Header{"Origin": []string{origin}})
	if socket != nil {
		socket.Close()
	}
	if err == nil || rejected == nil || rejected.StatusCode != 403 {
		t.Fatal("ticket that expired during authentication attached a channel")
	}
	rejected.Body.Close()
}
