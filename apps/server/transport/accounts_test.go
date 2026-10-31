package transport_test

import (
	"encoding/base64"
	"encoding/json"
	ws "github.com/fasthttp/websocket"
	"net/http"
	"net/http/cookiejar"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
)

func accountRequest(t *testing.T, s *transport.Server, c *http.Client, method, path, body, from string) (int, map[string]any, *http.Response) {
	t.Helper()
	req, err := http.NewRequest(method, s.URL()+"/api/account"+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", from)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var value map[string]any
	if err := json.NewDecoder(res.Body).Decode(&value); err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, value, res
}

func TestAccountLoginSurvivesRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "accounts.sqlite")
	store, err := accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Bootstrap("Site_Admin", "a long password with spaces"); err != nil {
		t.Fatal(err)
	}
	s, c, _ := configuredServer(t, transport.Config{Accounts: store})
	c.Jar, _ = cookiejar.New(nil)
	status, value, response := accountRequest(t, s, c, "POST", "/login", `{"username":"site_admin","password":"a long password with spaces"}`, origin)
	if status != 200 || value["username"] != "Site_Admin" {
		t.Fatalf("login: %d %v", status, value)
	}
	cookies := response.Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode || cookies[0].MaxAge != 30*24*60*60 {
		t.Fatalf("unsafe cookie: %v", cookies)
	}
	s.Close()
	store.Close()
	store, err = accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	s, restarted, _ := configuredServer(t, transport.Config{Accounts: store})
	restarted.Jar = c.Jar
	status, value, _ = accountRequest(t, s, restarted, "GET", "", "", origin)
	if status != 200 || value["username"] != "Site_Admin" {
		t.Fatalf("durable session: %d %v", status, value)
	}
}

func TestGuestsCannotAdmitOrRecoverMultiplayer(t *testing.T) {
	store, err := accounts.Open(filepath.Join(t.TempDir(), "accounts.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	s, c, _ := configuredServer(t, transport.Config{Accounts: store})
	for _, operation := range []uint8{0, 1, 2} {
		status, _ := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: operation, Name: "Spoofed"}, origin)
		if status != 401 {
			t.Fatalf("guest operation %d: %d", operation, status)
		}
	}
}

func accountFixture(t *testing.T) (*accounts.Store, *transport.Server, *http.Client) {
	t.Helper()
	store, err := accounts.Open(filepath.Join(t.TempDir(), "accounts.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	if err := store.Bootstrap("Case_Admin", "a long password with spaces"); err != nil {
		t.Fatal(err)
	}
	s, c, _ := configuredServer(t, transport.Config{Accounts: store})
	c.Jar, _ = cookiejar.New(nil)
	return store, s, c
}
func loginAccount(t *testing.T, s *transport.Server, c *http.Client, username, password string) map[string]any {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	status, value, _ := accountRequest(t, s, c, "POST", "/login", string(body), origin)
	if status != 200 {
		t.Fatalf("login: %d %v", status, value)
	}
	return value
}
func independentClient(c *http.Client) *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Transport: c.Transport, Jar: jar, Timeout: c.Timeout}
}
func TestCredentialRulesAndSingleAdminBootstrap(t *testing.T) {
	store, s, c := accountFixture(t)
	if err := store.Bootstrap("Another_Admin", "another long password"); err == nil {
		t.Fatal("second admin allowed")
	}
	for _, name := range []string{"ab", "invalid name", "éclair", strings.Repeat("a", 25)} {
		if err := store.CreateTemporary(name, "temporary password"); err == nil {
			t.Fatalf("invalid username accepted: %q", name)
		}
	}
	if err := store.CreateTemporary("Valid_Name", "short"); err == nil {
		t.Fatal("short password accepted")
	}
	if err := store.CreateTemporary("case_ADMIN", "temporary password"); err == nil {
		t.Fatal("case-insensitive duplicate allowed")
	}
	name := "Ab_123456789012345678901"
	if err := store.CreateTemporary(name, " spaces are allowed "); err != nil {
		t.Fatal(err)
	}
	value := loginAccount(t, s, c, strings.ToLower(name), " spaces are allowed ")
	if value["username"] != name || value["mustChangePassword"] != true {
		t.Fatalf("account rules: %v", value)
	}
}
func TestTemporaryPasswordBlocksMultiplayerAndRotatesSessions(t *testing.T) {
	store, s, c := accountFixture(t)
	if err := store.CreateTemporary("New_Driver", "temporary password"); err != nil {
		t.Fatal(err)
	}
	loginAccount(t, s, c, "new_driver", "temporary password")
	old := independentClient(c)
	loginAccount(t, s, old, "New_Driver", "temporary password")
	if status, _ := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Fake"}, origin); status != 403 {
		t.Fatalf("temporary account admitted: %d", status)
	}
	for _, password := range []string{"short", "temporary password"} {
		body, _ := json.Marshal(map[string]string{"password": password})
		status, _, _ := accountRequest(t, s, c, "POST", "/password", string(body), origin)
		if status != 400 {
			t.Fatalf("invalid replacement: %d", status)
		}
	}
	status, value, _ := accountRequest(t, s, c, "POST", "/password", `{"password":"replacement password"}`, origin)
	if status != 200 || value["mustChangePassword"] != false {
		t.Fatalf("change: %d %v", status, value)
	}
	status, _, _ = accountRequest(t, s, old, "GET", "", "", origin)
	if status != 401 {
		t.Fatalf("old temporary session survives: %d", status)
	}
	status, _, _ = accountRequest(t, s, old, "POST", "/login", `{"username":"New_Driver","password":"temporary password"}`, origin)
	if status != 401 {
		t.Fatalf("temporary password remains valid: %d", status)
	}
	if status, _ := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion}, origin); status != 201 {
		t.Fatalf("changed account rejected: %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "POST", "/password", `{"password":"unsolicited password change"}`, origin)
	if status != 400 {
		t.Fatal("normal password editing is out of scope")
	}
}
func TestLogoutRevokesEverySessionSeatAndTicketButPreservesOtherSessions(t *testing.T) {
	_, s, c := accountFixture(t)
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	other := independentClient(c)
	loginAccount(t, s, other, "Case_Admin", "a long password with spaces")
	_, value, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Forged_Admin"}, origin)
	first := value.(p.Admission)
	roots := c.Transport.(*http.Transport).TLSClientConfig.RootCAs
	socket, _ := initializedPair(t, s, roots, first, true)
	roomSend(t, socket, first, 1, p.RoomState{}, 4, 1, 1)
	state := roomState(t, socket, func(r p.RoomState) bool { return r.Seats[0].Flags&1 != 0 })
	if state.Seats[0].Name != "Case_Admin" {
		t.Fatalf("client supplied identity trusted: %s", state.Seats[0].Name)
	}
	_, value = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion}, origin)
	second := value.(p.Admission)
	_, value = admit(t, s, other, p.AdmissionRequest{Operation: 1, Version: p.ProtocolVersion, Code: code, Name: "Fake"}, origin)
	independent := value.(p.Admission)
	// A valid account session still cannot recover a different session's seat.
	status, _ := admit(t, s, other, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: first.Credential}, origin)
	if status != 410 {
		t.Fatalf("cross-session recovery: %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "POST", "/logout", `{}`, origin)
	if status != 200 {
		t.Fatalf("logout: %d", status)
	}
	for _, a := range []p.Admission{first, second} {
		status, _ = admit(t, s, other, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
		if status != 410 {
			t.Fatalf("revoked credential recovered: %d", status)
		}
		endpoint := "wss" + strings.TrimPrefix(s.URL(), "https") + "/room?ticket=" + base64.RawURLEncoding.EncodeToString(a.RoomTicket)
		socket, response, err := (&ws.Dialer{TLSClientConfig: c.Transport.(*http.Transport).TLSClientConfig}).Dial(endpoint, http.Header{"Origin": []string{origin}})
		if socket != nil {
			socket.Close()
		}
		if err == nil || response.StatusCode != 403 {
			t.Fatal("revoked ticket survived")
		}
	}
	status, _ = admit(t, s, other, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: independent.Credential}, origin)
	if status != 201 {
		t.Fatalf("other session lost: %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "GET", "", "", origin)
	if status != 401 {
		t.Fatalf("logged-out cookie usable: %d", status)
	}
}

func TestSessionExpiryRejectsHTTPRecoveryAndUnconsumedTickets(t *testing.T) {
	store, err := accounts.Open(filepath.Join(t.TempDir(), "accounts.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	if err := store.Bootstrap("Expiry_Admin", "expiry password with spaces"); err != nil {
		t.Fatal(err)
	}
	now, advance := lifecycleClock()
	s, c, _ := configuredServer(t, transport.Config{Accounts: store, Now: now})
	c.Jar, _ = cookiejar.New(nil)
	loginAccount(t, s, c, "Expiry_Admin", "expiry password with spaces")
	advance(accounts.Lifetime - time.Second)
	status, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion}, origin)
	if status != 201 {
		t.Fatalf("valid session rejected before expiry: %d", status)
	}
	a := value.(p.Admission)
	advance(time.Second)
	status, _, _ = accountRequest(t, s, c, "GET", "", "", origin)
	if status != 401 {
		t.Fatalf("session survived 30 days: %d", status)
	}
	endpoint := "wss" + strings.TrimPrefix(s.URL(), "https") + "/room?ticket=" + base64.RawURLEncoding.EncodeToString(a.RoomTicket)
	socket, response, err := (&ws.Dialer{TLSClientConfig: c.Transport.(*http.Transport).TLSClientConfig}).Dial(endpoint, http.Header{"Origin": []string{origin}})
	if socket != nil {
		socket.Close()
	}
	if err == nil || response.StatusCode != 403 {
		t.Fatal("expired session ticket usable")
	}
	status, _ = admit(t, s, c, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	if status != 401 {
		t.Fatalf("expired session recovered: %d", status)
	}
	loginAccount(t, s, c, "Expiry_Admin", "expiry password with spaces")
	status, _ = admit(t, s, c, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	if status != 410 {
		t.Fatalf("stale credential usable after fresh login: %d", status)
	}
}
func TestAccountMutationsRejectCrossSiteRequestsAndLimitLoginAbuse(t *testing.T) {
	_, s, c := accountFixture(t)
	for _, from := range []string{"", "https://attacker.example"} {
		for _, path := range []string{"/login", "/logout", "/password"} {
			req, _ := http.NewRequest("POST", s.URL()+"/api/account"+path, strings.NewReader(`{"username":"Case_Admin","password":"a long password with spaces"}`))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", from)
			res, err := c.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			res.Body.Close()
			if res.StatusCode != 403 {
				t.Fatalf("cross-site %s: %d", path, res.StatusCode)
			}
		}
	}
	for i := 0; i < 10; i++ {
		username := "Unknown_User"
		if i%2 == 1 {
			username = "UNKNOWN_USER"
		}
		body, _ := json.Marshal(map[string]string{"username": username, "password": "a wrong long password"})
		status, value, _ := accountRequest(t, s, c, "POST", "/login", string(body), origin)
		if status != 401 || value["error"] != "Invalid username or password" {
			t.Fatalf("credential leak: %d %v", status, value)
		}
	}
	status, _, response := accountRequest(t, s, c, "POST", "/login", `{"username":"unknown_user","password":"a wrong long password"}`, origin)
	if status != 429 || response.Header.Get("Retry-After") == "" {
		t.Fatalf("unlimited login attempts: %d", status)
	}
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	status, _, response = accountRequest(t, s, c, "GET", "", "", origin)
	if status != 200 || response.Header.Get("Access-Control-Allow-Credentials") != "true" || response.Header.Get("Access-Control-Allow-Origin") != origin {
		t.Fatal("credentialed development HTTP unavailable")
	}
	req, _ := http.NewRequest("POST", s.URL()+"/api/account/logout", strings.NewReader(`{}`))
	req.Header.Set("Origin", origin)
	req.Header.Set("Content-Type", "text/plain")
	res, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Fatal("simple cross-site content type accepted")
	}
}
func TestSessionRevocationClosesAllActiveTransportsAndRemovesRoom(t *testing.T) {
	f := activeLifecycle(t, `{"gameplay":{"obstacleWeight":0,"emptyWeight":1}}`)
	status, _, _ := accountRequest(t, f.server, f.client, "POST", "/logout", `{}`, origin)
	if status != 200 {
		t.Fatalf("logout: %d", status)
	}
	f.advance(time.Microsecond)
	for _, a := range f.admissions {
		status, _ := admit(t, f.server, f.client, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
		if status != 401 {
			t.Fatalf("logged-out active seat recovered: %d", status)
		}
	}
	loginAccount(t, f.server, f.client, "Fixture_Driver", "test fixture password")
	status, _ = admit(t, f.server, f.client, p.AdmissionRequest{Operation: 1, Version: p.ProtocolVersion, Code: f.code}, origin)
	if status != 404 {
		t.Fatalf("revoked active room survives: %d", status)
	}
	// Both transports close, regardless of how many seats share the session.
	for _, game := range f.games {
		select {
		case <-game.Context().Done():
		case <-time.After(time.Second):
			t.Fatal("revoked gameplay still connected")
		}
	}
}
