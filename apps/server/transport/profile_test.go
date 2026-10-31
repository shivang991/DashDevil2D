package transport_test

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/http/cookiejar"
	"path/filepath"
	"strings"
	"testing"
	"time"

	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

func profileBody(username string, avatar any) string {
	value := map[string]any{"username": username}
	if avatar != nil {
		value["avatar"] = avatar
	}
	data, _ := json.Marshal(value)
	return string(data)
}
func avatarPNG(t *testing.T) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(out.Bytes())
}
func TestProfileRenameAndAvatarAreAtomicAndAuthorized(t *testing.T) {
	_, s, c := accountFixture(t)
	status, _, _ := accountRequest(t, s, c, "POST", "/profile", profileBody("New_Name", nil), origin)
	if status != 401 {
		t.Fatalf("guest update: %d", status)
	}
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	other := independentClient(c)
	loginAccount(t, s, other, "Case_Admin", "a long password with spaces")
	status, _, _ = accountRequest(t, s, c, "POST", "/profile", profileBody("New_Name", nil), "https://evil.example")
	if status != 403 {
		t.Fatalf("cross-site: %d", status)
	}
	for _, body := range []string{profileBody("x", nil), profileBody("Invalid_Avatar", base64.StdEncoding.EncodeToString([]byte("fake png"))), profileBody("Invalid_Avatar", base64.StdEncoding.EncodeToString(make([]byte, 2*1024*1024+1)))} {
		status, _, _ = accountRequest(t, s, c, "POST", "/profile", body, origin)
		if status != 400 {
			t.Fatalf("invalid profile: %d", status)
		}
	}
	status, value, _ := accountRequest(t, s, c, "POST", "/profile", profileBody("Saved_Name", avatarPNG(t)), origin)
	if status != 200 || value["username"] != "Saved_Name" || value["avatar"] == "" {
		t.Fatalf("save: %d %v", status, value)
	}
	avatar := value["avatar"].(string)
	status, value, _ = accountRequest(t, s, other, "GET", "", "", origin)
	if status != 200 || value["username"] != "Saved_Name" || value["avatar"] != avatar {
		t.Fatalf("other session: %d %v", status, value)
	}
	response, err := c.Get(s.URL() + "/api/account/avatars/" + avatar)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if response.StatusCode != 200 || response.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("image: %d %s", response.StatusCode, response.Header.Get("Content-Type"))
	}
	if _, err := png.Decode(bytes.NewReader(data)); err != nil {
		t.Fatal(err)
	}
	status, _, _ = accountRequest(t, s, c, "POST", "/login", `{"username":"Case_Admin","password":"a long password with spaces"}`, origin)
	if status != 401 {
		t.Fatalf("old login: %d", status)
	}
	loginAccount(t, s, c, "saved_name", "a long password with spaces")
	status, value, _ = accountRequest(t, s, c, "POST", "/profile", profileBody("Saved_Name", ""), origin)
	if status != 200 || value["avatar"] != "" {
		t.Fatalf("remove: %d %v", status, value)
	}
	response, err = c.Get(s.URL() + "/api/account/avatars/" + avatar)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 404 {
		t.Fatalf("removed upload retained: %d", response.StatusCode)
	}
}

func TestProfilePasswordKeepsCurrentSessionAndRevokesOtherAccess(t *testing.T) {
	_, s, c := accountFixture(t)
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	other := independentClient(c)
	loginAccount(t, s, other, "Case_Admin", "a long password with spaces")
	_, value := admit(t, s, other, p.AdmissionRequest{Version: p.ProtocolVersion}, origin)
	a := value.(p.Admission)
	roots := c.Transport.(*http.Transport).TLSClientConfig.RootCAs
	_, game := initializedPair(t, s, roots, a, true)
	for _, body := range []string{`{"currentPassword":"wrong","password":"replacement password"}`, `{"currentPassword":"a long password with spaces","password":"short"}`} {
		status, _, _ := accountRequest(t, s, c, "POST", "/password", body, origin)
		if status != 400 {
			t.Fatalf("invalid password change: %d", status)
		}
	}
	status, _, _ := accountRequest(t, s, c, "POST", "/password", `{"currentPassword":"a long password with spaces","password":"replacement password"}`, origin)
	if status != 200 {
		t.Fatalf("password change: %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "GET", "", "", origin)
	if status != 200 {
		t.Fatalf("current session lost: %d", status)
	}
	status, _, _ = accountRequest(t, s, other, "GET", "", "", origin)
	if status != 401 {
		t.Fatalf("other session survives: %d", status)
	}
	status, _ = admit(t, s, other, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	if status != 401 {
		t.Fatalf("revoked recovery: %d", status)
	}
	select {
	case <-game.Context().Done():
	case <-time.After(time.Second):
		t.Fatal("revoked gameplay stayed connected")
	}
	loginAccount(t, s, other, "Case_Admin", "replacement password")
	status, _ = admit(t, s, other, p.AdmissionRequest{Operation: 2, Version: p.ProtocolVersion, Credential: a.Credential}, origin)
	if status != 410 {
		t.Fatalf("revoked seat survives new login: %d", status)
	}
}

func TestProfileActiveRaceIdentitySurvivesRenameAndRemoval(t *testing.T) {
	var originalAvatar string
	f := activeLifecycle(t, `{"operational":{"simulationLagThreshold":10}}`, func(s *transport.Server, c *http.Client) {
		status, value, _ := accountRequest(t, s, c, "POST", "/profile", profileBody("Fixture_Driver", avatarPNG(t)), origin)
		if status != 200 {
			t.Fatalf("initial avatar: %d %v", status, value)
		}
		originalAvatar = value["avatar"].(string)
	})
	status, value, _ := accountRequest(t, f.server, f.client, "POST", "/profile", profileBody("Future_Driver", avatarPNG(t)), origin)
	if status != 200 {
		t.Fatalf("rename: %d %v", status, value)
	}
	response, err := f.client.Get(f.server.URL() + "/api/account/avatars/" + originalAvatar)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal("active snapshot deleted")
	}
	// Focus publishes a fresh room state without changing the active identity.
	roomSend(t, f.sockets[0], f.admissions[0], 3, f.state, 4, 1, 1)
	state := roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Revision > f.state.Revision })
	if state.Seats[0].Name != "Fixture_Driver" || state.Seats[0].Avatar != originalAvatar {
		t.Fatalf("active identity changed: %+v", state.Seats[0])
	}
	f.games[1].CloseWithError(1, "finish by forfeit")
	f.sockets[1].Close()
	roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&4 != 0 })
	f.advance(15*time.Second + time.Microsecond)
	receiveOutcome(t, f.outcomes[0])
	state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Phase == 3 })
	if state.Seats[0].Name != "Fixture_Driver" {
		t.Fatal("result identity changed")
	}
	roomSend(t, f.sockets[0], f.admissions[0], 4, state, 5, 1, 0)
	state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Phase == 0 })
	if state.Seats[0].Name != "Future_Driver" || state.Seats[0].Avatar != value["avatar"] {
		t.Fatalf("future identity stale: %+v", state.Seats[0])
	}
	waitAvatarDeleted(t, f.server, f.client, originalAvatar)
}

func TestProfileSurvivesRestartWithPasswordAndAvatar(t *testing.T) {
	path := filepath.Join(t.TempDir(), "accounts.sqlite")
	store, err := accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Bootstrap("Original_Name", "original password"); err != nil {
		t.Fatal(err)
	}
	s, c, _ := configuredServer(t, transport.Config{Accounts: store})
	c.Jar, _ = cookiejar.New(nil)
	loginAccount(t, s, c, "Original_Name", "original password")
	status, value, _ := accountRequest(t, s, c, "POST", "/profile", profileBody("Durable_Name", avatarPNG(t)), origin)
	if status != 200 {
		t.Fatalf("save: %d %v", status, value)
	}
	avatar := value["avatar"].(string)
	status, _, _ = accountRequest(t, s, c, "POST", "/password", `{"currentPassword":"original password","password":"persistent replacement"}`, origin)
	if status != 200 {
		t.Fatalf("password: %d", status)
	}
	s.Close()
	store.Close()
	store, err = accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	s, reopened, _ := configuredServer(t, transport.Config{Accounts: store})
	reopened.Jar = c.Jar
	status, value, _ = accountRequest(t, s, reopened, "GET", "", "", origin)
	if status != 200 || value["username"] != "Durable_Name" || value["avatar"] != avatar {
		t.Fatalf("restart: %d %v", status, value)
	}
	response, err := reopened.Get(s.URL() + "/api/account/avatars/" + avatar)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal("avatar not persisted")
	}
	loginAccount(t, s, independentClient(reopened), "durable_name", "persistent replacement")
}

func TestProfileConcurrentRenamesCannotDuplicateAccounts(t *testing.T) {
	store, s, c := accountFixture(t)
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	if err := store.CreateTemporary("Other_Driver", "temporary password"); err != nil {
		t.Fatal(err)
	}
	other := independentClient(c)
	loginAccount(t, s, other, "Other_Driver", "temporary password")
	status, _, _ := accountRequest(t, s, other, "POST", "/password", `{"password":"normal driver password"}`, origin)
	if status != 200 {
		t.Fatal(status)
	}
	results := make(chan int, 2)
	for i, client := range []*http.Client{c, other} {
		go func(client *http.Client, name string) {
			data := profileBody(name, nil)
			req, err := http.NewRequest("POST", s.URL()+"/api/account/profile", strings.NewReader(data))
			if err != nil {
				results <- 0
				return
			}
			req.Header.Set("Origin", origin)
			req.Header.Set("Content-Type", "application/json")
			response, err := client.Do(req)
			if err != nil {
				results <- 0
				return
			}
			response.Body.Close()
			results <- response.StatusCode
		}(client, []string{"Contested_Name", "contested_name"}[i])
	}
	a, b := <-results, <-results
	if !((a == 200 && b == 409) || (a == 409 && b == 200)) {
		t.Fatalf("concurrent outcomes: %d %d", a, b)
	}
}

func TestProfileAcceptsDecodedImagesAtUploadLimitAndStripsPayloads(t *testing.T) {
	_, s, c := accountFixture(t)
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	pngData, _ := base64.StdEncoding.DecodeString(avatarPNG(t))
	padded := append(pngData, make([]byte, accounts.MaxAvatarBytes-len(pngData))...)
	webp, _ := base64.StdEncoding.DecodeString("UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAIAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=")
	var jpg bytes.Buffer
	if err := jpeg.Encode(&jpg, image.NewRGBA(image.Rect(0, 0, 2, 2)), nil); err != nil {
		t.Fatal(err)
	}
	previous := ""
	var wide bytes.Buffer
	png.Encode(&wide, image.NewRGBA(image.Rect(0, 0, 3000, 1000)))
	for _, content := range [][]byte{padded, jpg.Bytes(), webp, wide.Bytes()} {
		status, value, _ := accountRequest(t, s, c, "POST", "/profile", profileBody("Case_Admin", base64.StdEncoding.EncodeToString(content)), origin)
		if status != 200 {
			t.Fatalf("valid image: %d %v", status, value)
		}
		id := value["avatar"].(string)
		response, err := c.Get(s.URL() + "/api/account/avatars/" + id)
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(response.Body)
		response.Body.Close()
		if len(content) == len(padded) && len(data) > 1024 {
			t.Fatal("stored trailing payload")
		}
		if _, err := png.Decode(bytes.NewReader(data)); err != nil {
			t.Fatal(err)
		}
		if previous != "" {
			response, err := c.Get(s.URL() + "/api/account/avatars/" + previous)
			if err != nil {
				t.Fatal(err)
			}
			response.Body.Close()
			if response.StatusCode != 404 {
				t.Fatal("replaced avatar retained")
			}
		}
		previous = id
	}
	var huge bytes.Buffer
	png.Encode(&huge, image.NewRGBA(image.Rect(0, 0, 4097, 4096)))
	for _, content := range [][]byte{huge.Bytes(), pngData[:len(pngData)/2], []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)} {
		status, _, _ := accountRequest(t, s, c, "POST", "/profile", profileBody("Case_Admin", base64.StdEncoding.EncodeToString(content)), origin)
		if status != 400 {
			t.Fatalf("invalid content accepted: %d", status)
		}
	}
}

func TestProfileResultRetainsAvatarAfterParticipantLeaves(t *testing.T) {
	var startingAvatar string
	f := activeLifecycle(t, `{"gameplay":{"finishDistance":440,"tickRate":1,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1},"operational":{"simulationLagThreshold":10}}`, func(s *transport.Server, c *http.Client) {
		status, value, _ := accountRequest(t, s, c, "POST", "/profile", profileBody("Fixture_Driver", avatarPNG(t)), origin)
		if status != 200 {
			t.Fatalf("initial avatar: %d %v", status, value)
		}
		startingAvatar = value["avatar"].(string)
	})
	status, _, _ := accountRequest(t, f.server, f.client, "POST", "/profile", profileBody("Future_Driver", ""), origin)
	if status != 200 {
		t.Fatal(status)
	}
	f.advance(2 * time.Second)
	if outcome := receiveOutcome(t, f.outcomes[0]); outcome.Result != 2 {
		t.Fatalf("expected finish tie: %+v", outcome)
	}
	state := roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Phase == 3 })
	roomSend(t, f.sockets[0], f.admissions[0], 3, state, 3, 1, 0)
	state = roomState(t, f.sockets[1], func(r p.RoomState) bool { return r.Seats[0].Session == 0 })
	if state.Racers[0].Name != "Fixture_Driver" || state.Racers[0].Avatar != startingAvatar {
		t.Fatalf("departed result identity lost: %+v", state.Racers[0])
	}
	response, err := f.client.Get(f.server.URL() + "/api/account/avatars/" + startingAvatar)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal("result avatar deleted while opponent viewing")
	}
	roomSend(t, f.sockets[1], f.admissions[1], 2, state, 5, 1, 0)
	roomState(t, f.sockets[1], func(r p.RoomState) bool { return r.Phase == 0 })
	waitAvatarDeleted(t, f.server, f.client, startingAvatar)
}

func waitAvatarDeleted(t *testing.T, s *transport.Server, c *http.Client, id string) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for {
		response, err := c.Get(s.URL() + "/api/account/avatars/" + id)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode == 404 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("avatar still served: %d", response.StatusCode)
		}
		time.Sleep(5 * time.Millisecond)
	}
}
