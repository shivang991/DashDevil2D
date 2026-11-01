package transport_test

import (
	"fmt"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"net/http"
	"path/filepath"
	"testing"
	"time"
)

func TestAdminCreatesTemporaryUserAndListsObservedMetadata(t *testing.T) {
	_, s, c := accountFixture(t)
	status, _, _ := accountRequest(t, s, c, "GET", "/admin/users", "", origin)
	if status != 401 {
		t.Fatalf("guest: %d", status)
	}
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	status, created, _ := accountRequest(t, s, c, "POST", "/admin/users", `{"username":"New_Driver","admin":true}`, origin)
	if status != 200 {
		t.Fatalf("create: %d %v", status, created)
	}
	password, ok := created["temporaryPassword"].(string)
	if !ok || len(password) < 12 {
		t.Fatal("missing temporary password")
	}
	user := independentClient(c)
	value := loginAccount(t, s, user, "New_Driver", password)
	if value["admin"] != false || value["mustChangePassword"] != true {
		t.Fatalf("unsafe user: %v", value)
	}
	status, _, _ = accountRequest(t, s, user, "GET", "/admin/users", "", origin)
	if status != 403 {
		t.Fatalf("non admin: %d", status)
	}
	status, list, _ := accountRequest(t, s, c, "GET", "/admin/users", "", origin)
	if status != 200 {
		t.Fatalf("list: %d %v", status, list)
	}
	users := list["users"].([]any)
	if len(users) != 2 {
		t.Fatalf("users: %v", users)
	}
	driver := users[1].(map[string]any)
	if driver["createdAt"] == nil || driver["lastSeenAt"] == nil || driver["temporaryPassword"] != nil {
		t.Fatalf("metadata: %v", driver)
	}
	status, _, _ = accountRequest(t, s, user, "POST", "/password", `{"password":"replacement password"}`, origin)
	if status != 200 {
		t.Fatalf("first login: %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/delete", created["user"].(map[string]any)["id"]), `{}`, origin)
	if status != 400 {
		t.Fatalf("unconfirmed deletion: %d", status)
	}
}

func TestAdminEditsProfilesAndProtectsAdminDeletion(t *testing.T) {
	_, s, c := accountFixture(t)
	admin := loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	_, created, _ := accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Profile_Driver"}`, origin)
	id := created["user"].(map[string]any)["id"].(float64)
	path := fmt.Sprintf("/admin/users/%.0f", id)
	status, value, _ := accountRequest(t, s, c, "POST", path+"/profile", profileBody("Renamed_Driver", avatarPNG(t)), origin)
	if status != 200 || value["username"] != "Renamed_Driver" || value["avatar"] == "" {
		t.Fatalf("edit: %d %v", status, value)
	}
	avatar := value["avatar"].(string)
	status, _, _ = accountRequest(t, s, c, "POST", path+"/profile", profileBody("bad name", nil), origin)
	if status != 400 {
		t.Fatalf("validation: %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "POST", path+"/profile", profileBody("case_admin", nil), origin)
	if status != 409 {
		t.Fatalf("conflict: %d", status)
	}
	status, value, _ = accountRequest(t, s, c, "POST", path+"/profile", profileBody("Renamed_Driver", ""), origin)
	if status != 200 || value["avatar"] != "" {
		t.Fatalf("remove: %d %v", status, value)
	}
	res, err := c.Get(s.URL() + "/api/account/avatars/" + avatar)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatal("unused avatar survived")
	}
	status, _, _ = accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/delete", admin["id"]), `{"confirm":true}`, origin)
	if status != 403 {
		t.Fatalf("admin deletion: %d", status)
	}
}

func TestAdminResetAndDeleteRevokeConcurrentRoomsAndRecovery(t *testing.T) {
	for _, action := range []string{"reset", "delete"} {
		t.Run(action, func(t *testing.T) {
			_, s, c := accountFixture(t)
			loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
			_, created, _ := accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Target_Driver"}`, origin)
			id := created["user"].(map[string]any)["id"].(float64)
			password := created["temporaryPassword"].(string)
			first := independentClient(c)
			loginAccount(t, s, first, "Target_Driver", password)
			status, _, _ := accountRequest(t, s, first, "POST", "/password", `{"password":"replacement password"}`, origin)
			if status != 200 {
				t.Fatalf("password: %d", status)
			}
			second := independentClient(c)
			loginAccount(t, s, second, "Target_Driver", "replacement password")
			status, profile, _ := accountRequest(t, s, first, "POST", "/profile", profileBody("Target_Driver", avatarPNG(t)), origin)
			if status != 200 {
				t.Fatalf("avatar: %d", status)
			}
			roots := c.Transport.(*http.Transport).TLSClientConfig.RootCAs
			var admissions []p.Admission
			for _, device := range []*http.Client{first, second} {
				_, value := admit(t, s, device, p.AdmissionRequest{Version: p.ProtocolVersion}, origin)
				a := value.(p.Admission)
				admissions = append(admissions, a)
			}
			_, game := initializedPair(t, s, roots, admissions[0], true)
			status, result, _ := accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/%s", id, action), `{"confirm":true}`, origin)
			if status != 200 {
				t.Fatalf("%s: %d %v", action, status, result)
			}
			select {
			case <-game.Context().Done():
			case <-time.After(time.Second):
				t.Fatal("gameplay survived")
			}
			for i, device := range []*http.Client{first, second} {
				status, _, _ = accountRequest(t, s, device, "GET", "", "", origin)
				if status != 401 {
					t.Fatalf("session survived: %d", status)
				}
				status, _ = admit(t, s, device, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: admissions[i].Credential}, origin)
				if status != 401 {
					t.Fatalf("stale cookie recovery: %d", status)
				}
			}
			if action == "reset" {
				loginAccount(t, s, first, "Target_Driver", result["temporaryPassword"].(string))
				status, _, _ = accountRequest(t, s, first, "POST", "/password", `{"password":"another replacement password"}`, origin)
				if status != 200 {
					t.Fatalf("reset first-login: %d", status)
				}
				for _, a := range admissions {
					status, _ = admit(t, s, first, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
					if status != 410 {
						t.Fatalf("authenticated recovery: %d", status)
					}
				}
			} else {
				status, _, _ = accountRequest(t, s, first, "POST", "/login", `{"username":"Target_Driver","password":"replacement password"}`, origin)
				if status != 401 {
					t.Fatal("deleted login survived")
				}
				response, err := c.Get(s.URL() + "/api/account/avatars/" + profile["avatar"].(string))
				if err != nil {
					t.Fatal(err)
				}
				response.Body.Close()
				if response.StatusCode != 404 {
					t.Fatal("deleted avatar survived")
				}
				_, _, _ = accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Target_Driver"}`, origin)
				status, list, _ := accountRequest(t, s, c, "GET", "/admin/users", "", origin)
				if status != 200 {
					t.Fatal(list)
				}
				users := list["users"].([]any)
				replacement := users[len(users)-1].(map[string]any)
				// A newly created identity with the same name cannot recover old credentials.
				if replacement["avatar"] != "" {
					t.Fatal("recreated account inherited avatar")
				}
				status, _ = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: admissions[0].Credential}, origin)
				if status != 410 {
					t.Fatalf("authenticated deleted recovery: %d", status)
				}
			}
		})
	}
}

func TestEveryAdminEndpointRejectsGuestsNormalUsersAndCrossSiteWrites(t *testing.T) {
	store, s, c := accountFixture(t)
	if err := store.CreateTemporary("Normal_Driver", "temporary password"); err != nil {
		t.Fatal(err)
	}
	normal := independentClient(c)
	loginAccount(t, s, normal, "Normal_Driver", "temporary password")
	accountRequest(t, s, normal, "POST", "/password", `{"password":"normal replacement password"}`, origin)
	endpoints := []struct{ method, path, body string }{
		{"GET", "/admin/users", ""}, {"POST", "/admin/users", `{"username":"Blocked_Driver"}`},
		{"POST", "/admin/users/1/profile", profileBody("Hacked_Admin", nil)},
		{"POST", "/admin/users/1/reset", `{}`}, {"POST", "/admin/users/1/delete", `{"confirm":true}`},
	}
	for _, e := range endpoints {
		status, _, _ := accountRequest(t, s, c, e.method, e.path, e.body, origin)
		if status != 401 {
			t.Fatalf("guest %s: %d", e.path, status)
		}
		status, _, _ = accountRequest(t, s, normal, e.method, e.path, e.body, origin)
		if status != 403 {
			t.Fatalf("normal %s: %d", e.path, status)
		}
	}
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	for _, e := range endpoints[1:] {
		status, _, _ := accountRequest(t, s, c, e.method, e.path, e.body, "https://evil.example")
		if status != 403 {
			t.Fatalf("cross site %s: %d", e.path, status)
		}
	}
}

func TestAdminResetDuringActiveRoundAbandonsSameAccountOpponents(t *testing.T) {
	f := activeLifecycle(t, `{"operational":{"simulationLagThreshold":10}}`)
	status, current, _ := accountRequest(t, f.server, f.client, "GET", "", "", origin)
	if status != 200 {
		t.Fatal(current)
	}
	status, _, _ = accountRequest(t, f.server, f.client, "POST", fmt.Sprintf("/admin/users/%.0f/reset", current["id"]), `{}`, origin)
	if status != 200 {
		t.Fatalf("reset: %d", status)
	}
	// Same-account seats must leave together, never award an iteration-order win.
	f.advance(time.Millisecond)
	status, _ = admit(t, f.server, f.client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: f.admissions[0].Credential}, origin)
	if status != 401 {
		t.Fatalf("active recovery: %d", status)
	}
	for _, game := range f.games {
		select {
		case <-game.Context().Done():
		case <-time.After(time.Second):
			t.Fatal("active gameplay survived")
		}
	}
}

func TestAdminMetadataAndProfileSurviveRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "accounts.sqlite")
	store, err := accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err = store.Bootstrap("Restart_Admin", "test fixture password"); err != nil {
		t.Fatal(err)
	}
	s, c, _ := configuredServer(t, transport.Config{Accounts: store})
	c = independentClient(c)
	loginAccount(t, s, c, "Restart_Admin", "test fixture password")
	_, created, _ := accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Restart_Driver"}`, origin)
	driver := independentClient(c)
	loginAccount(t, s, driver, "Restart_Driver", created["temporaryPassword"].(string))
	accountRequest(t, s, driver, "GET", "", "", origin)
	id := created["user"].(map[string]any)["id"].(float64)
	status, _, _ := accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/profile", id), profileBody("Saved_Driver", avatarPNG(t)), origin)
	if status != 200 {
		t.Fatalf("save: %d", status)
	}
	_, before, _ := accountRequest(t, s, c, "GET", "/admin/users", "", origin)
	s.Close()
	store.Close()
	store, err = accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	s, client, _ := configuredServer(t, transport.Config{Accounts: store})
	client.Jar = c.Jar
	status, after, _ := accountRequest(t, s, client, "GET", "/admin/users", "", origin)
	if status != 200 {
		t.Fatalf("restart: %d", status)
	}
	old := before["users"].([]any)[1].(map[string]any)
	saved := after["users"].([]any)[1].(map[string]any)
	for _, key := range []string{"id", "username", "avatar", "createdAt", "lastSeenAt"} {
		if saved[key] != old[key] || saved[key] == nil {
			t.Fatalf("%s: %v != %v", key, saved[key], old[key])
		}
	}
}

func TestAdminResetAndDeletionForfeitActiveOpponent(t *testing.T) {
	for _, action := range []string{"reset", "delete"} {
		t.Run(action, func(t *testing.T) {
			store, err := accounts.Open(filepath.Join(t.TempDir(), "accounts.sqlite"))
			if err != nil {
				t.Fatal(err)
			}
			defer store.Close()
			if err = store.Bootstrap("Race_Admin", "test fixture password"); err != nil {
				t.Fatal(err)
			}
			now, advance := lifecycleClock()
			s, c, roots := configuredServer(t, transport.Config{Accounts: store, Now: now, DragRaceOverrides: []byte(`{"operational":{"simulationLagThreshold":10},"gameplay":{"obstacleWeight":0,"emptyWeight":1}}`)})
			c = independentClient(c)
			loginAccount(t, s, c, "Race_Admin", "test fixture password")
			_, created, _ := accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Race_Driver"}`, origin)
			id := created["user"].(map[string]any)["id"].(float64)
			driver := independentClient(c)
			loginAccount(t, s, driver, "Race_Driver", created["temporaryPassword"].(string))
			accountRequest(t, s, driver, "POST", "/password", `{"password":"race replacement password"}`, origin)
			_, value, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion}, origin)
			host := value.(p.Admission)
			_, value = admit(t, s, driver, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code}, origin)
			guest := value.(p.Admission)
			outcomes := make(chan p.Outcome, 4)
			socket, _ := observedPair(t, s, roots, host, true, func(record any) {
				if outcome, ok := record.(p.Outcome); ok {
					outcomes <- outcome
				}
			})
			guestSocket, _ := initializedPair(t, s, roots, guest, true)
			state := roomState(t, socket, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
			roomSend(t, socket, host, 1, state, 1, 1, 1)
			state = roomState(t, guestSocket, func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
			roomSend(t, guestSocket, guest, 1, state, 1, 1, 1)
			state = roomState(t, socket, func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
			roomSend(t, socket, host, 2, state, 2, 1, 0)
			roomState(t, socket, func(r p.RoomState) bool { return r.Phase == 1 })
			time.Sleep(30 * time.Millisecond)
			advance(3 * time.Second)
			roomState(t, socket, func(r p.RoomState) bool { return r.Phase == 2 })
			// An admin edit during the race must leave its starting identity unchanged.
			status, _, _ := accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/profile", id), profileBody("Future_Driver", nil), origin)
			if status != 200 {
				t.Fatalf("race edit: %d", status)
			}
			status, _, _ = accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/%s", id, action), `{"confirm":true}`, origin)
			if status != 200 {
				t.Fatalf("%s: %d", action, status)
			}
			advance(time.Millisecond)
			outcome := receiveOutcome(t, outcomes)
			if outcome.Result != 0 || outcome.Reason != 3 {
				t.Fatalf("forfeit: %+v", outcome)
			}
			result := roomState(t, socket, func(r p.RoomState) bool { return r.Phase == 3 })
			if result.Racers[1].Name != "Race_Driver" {
				t.Fatalf("race identity changed: %+v", result.Racers)
			}
		})
	}
}
