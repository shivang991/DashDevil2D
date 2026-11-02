package transport_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	appserver "github.com/shivang991/DashDevil2D/apps/server/server"
)

func TestChatOfflineRetryAuthorizationAndReadSync(t *testing.T) {
	_, s, admin := accountFixture(t)
	loginAccount(t, s, admin, "Case_Admin", "a long password with spaces")
	_, created, _ := accountRequest(t, s, admin, "POST", "/admin/users", `{"username":"Chat_Driver"}`, origin)
	peer := independentClient(admin)
	loginAccount(t, s, peer, "Chat_Driver", created["temporaryPassword"].(string))
	accountRequest(t, s, peer, "POST", "/password", `{"password":"replacement password"}`, origin)
	status, found, _ := accountRequest(t, s, admin, "GET", "/chat/search?q=chat_dri", "", origin)
	if status != 200 {
		t.Fatalf("search: %d %v", status, found)
	}
	users := found["users"].([]any)
	if len(users) != 1 {
		t.Fatalf("matches %v", users)
	}
	path := fmt.Sprintf("/chat/thread/%.0f", users[0].(map[string]any)["id"])
	status, thread, _ := accountRequest(t, s, admin, "GET", path, "", origin)
	if status != 200 || len(thread["messages"].([]any)) != 0 {
		t.Fatalf("empty thread %d %v", status, thread)
	}
	_, state, _ := accountRequest(t, s, admin, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if len(state["acquaintances"].([]any)) != 0 {
		t.Fatal("opening created acquaintance")
	}
	body := `{"text":"hello offline","key":"retry-1"}`
	for range 2 {
		status, msg, _ := accountRequest(t, s, admin, "POST", path, body, origin)
		if status != 200 {
			t.Fatalf("send %d %v", status, msg)
		}
	}
	_, state, _ = accountRequest(t, s, peer, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if state["unread"] != float64(1) {
		t.Fatalf("retry inflated unread %v", state)
	}
	sender := state["acquaintances"].([]any)[0].(map[string]any)["id"]
	otherPath := fmt.Sprintf("/chat/thread/%.0f", sender)
	status, thread, _ = accountRequest(t, s, peer, "GET", otherPath, "", origin)
	if status != 200 || len(thread["messages"].([]any)) != 1 {
		t.Fatalf("history %v", thread)
	}
	messageID := thread["messages"].([]any)[0].(map[string]any)["id"]
	secondSession := independentClient(admin)
	loginAccount(t, s, secondSession, "Chat_Driver", "replacement password")
	status, _, _ = accountRequest(t, s, secondSession, "POST", otherPath+"/read", fmt.Sprintf(`{"through":%.0f}`, messageID), origin)
	if status != 200 {
		t.Fatalf("read %d", status)
	}
	accountRequest(t, s, peer, "POST", otherPath+"/read", `{"through":0}`, origin)
	_, state, _ = accountRequest(t, s, peer, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if state["unread"] != float64(0) {
		t.Fatalf("read regressed %v", state)
	}
	status, _, _ = accountRequest(t, s, independentClient(admin), "GET", path, "", origin)
	if status != 401 {
		t.Fatalf("guest history %d", status)
	}
	status, _, _ = accountRequest(t, s, admin, "POST", path, body, "https://evil.example")
	if status != 403 {
		t.Fatalf("cross site %d", status)
	}
	status, _, _ = accountRequest(t, s, admin, "POST", path, `{"text":" ","key":"empty"}`, origin)
	if status != 400 {
		t.Fatalf("empty %d", status)
	}
}

func TestChatRetentionDeletionValidationAndRateLimit(t *testing.T) {
	path := filepath.Join(t.TempDir(), "accounts.sqlite")
	store, err := accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err = store.Bootstrap("Chat_Admin", "original password"); err != nil {
		t.Fatal(err)
	}
	s, c, _ := configuredServer(t, appserver.Config{Accounts: store})
	c.Jar, _ = cookiejar.New(nil)
	loginAccount(t, s, c, "Chat_Admin", "original password")
	_, created, _ := accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Retained_Driver"}`, origin)
	accountID := created["user"].(map[string]any)["id"]
	_, found, _ := accountRequest(t, s, c, "GET", "/chat/search?q=retained", "", origin)
	id := found["users"].([]any)[0].(map[string]any)["id"]
	threadPath := fmt.Sprintf("/chat/thread/%.0f", id)
	for _, text := range []string{"", strings.Repeat("x", 2001)} {
		body, _ := json.Marshal(map[string]string{"text": text, "key": "invalid"})
		status, _, _ := accountRequest(t, s, c, "POST", threadPath, string(body), origin)
		if status != 400 {
			t.Fatalf("validation %d", status)
		}
	}
	for i := range 30 {
		body, _ := json.Marshal(map[string]string{"text": "retained message", "key": fmt.Sprint(i)})
		status, value, _ := accountRequest(t, s, c, "POST", threadPath, string(body), origin)
		if status != 200 {
			t.Fatalf("send %d %v", status, value)
		}
	}
	status, _, _ := accountRequest(t, s, c, "POST", threadPath, `{"text":"rate limited","key":"31"}`, origin)
	if status != 429 {
		t.Fatalf("rate %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "POST", threadPath, `{"text":"retained message","key":"0"}`, origin)
	if status != 200 {
		t.Fatalf("retry at limit %d", status)
	}
	status, _, _ = accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/profile", accountID), `{"username":"Renamed_Driver"}`, origin)
	if status != 200 {
		t.Fatal("rename")
	}
	_, state, _ := accountRequest(t, s, c, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if state["acquaintances"].([]any)[0].(map[string]any)["username"] != "Renamed_Driver" {
		t.Fatal("stale identity")
	}
	status, _, _ = accountRequest(t, s, c, "POST", fmt.Sprintf("/admin/users/%.0f/delete", accountID), `{"confirm":true}`, origin)
	if status != 200 {
		t.Fatal("delete")
	}
	s.Close()
	store.Close()
	store, err = accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	s, c, _ = configuredServer(t, appserver.Config{Accounts: store})
	c.Jar, _ = cookiejar.New(nil)
	loginAccount(t, s, c, "Chat_Admin", "original password")
	_, state, _ = accountRequest(t, s, c, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	person := state["acquaintances"].([]any)[0].(map[string]any)
	if person["username"] != "Deleted account" || person["deleted"] != true || person["id"] != id {
		t.Fatalf("anonymization %v", person)
	}
	_, thread, _ := accountRequest(t, s, c, "GET", threadPath, "", origin)
	if len(thread["messages"].([]any)) != 30 {
		t.Fatal("history lost on restart/delete")
	}
	_, created, _ = accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Retained_Driver"}`, origin)
	_, found, _ = accountRequest(t, s, c, "GET", "/chat/search?q=retained", "", origin)
	replacement := found["users"].([]any)[0].(map[string]any)["id"]
	if replacement == id {
		t.Fatal("deleted identity reassigned")
	}
	_, thread, _ = accountRequest(t, s, c, "GET", fmt.Sprintf("/chat/thread/%.0f", replacement), "", origin)
	if len(thread["messages"].([]any)) != 0 {
		t.Fatal("replacement inherited history")
	}
}

func TestChatPresenceAggregatesTabsSessionsAndExpires(t *testing.T) {
	now, advance := lifecycleClock()
	store, err := accounts.Open(filepath.Join(t.TempDir(), "presence.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	store.Bootstrap("Presence_Admin", "original password")
	s, c, _ := configuredServer(t, appserver.Config{Accounts: store, Now: now})
	c.Jar, _ = cookiejar.New(nil)
	loginAccount(t, s, c, "Presence_Admin", "original password")
	other := independentClient(c)
	loginAccount(t, s, other, "Presence_Admin", "original password")
	accountRequest(t, s, c, "POST", "/chat/sync", `{"client":"long-drive","activity":"Playing"}`, origin)
	accountRequest(t, s, c, "POST", "/chat/sync", `{"client":"idle-tab","activity":"Offline"}`, origin)
	accountRequest(t, s, other, "POST", "/chat/sync", `{"client":"menu","activity":"Active"}`, origin)
	// Search from a different account so self is excluded normally.
	_, created, _ := accountRequest(t, s, c, "POST", "/admin/users", `{"username":"Observer_Driver"}`, origin)
	observer := independentClient(c)
	loginAccount(t, s, observer, "Observer_Driver", created["temporaryPassword"].(string))
	accountRequest(t, s, observer, "POST", "/password", `{"password":"replacement password"}`, origin)
	presence := func() string {
		_, found, _ := accountRequest(t, s, observer, "GET", "/chat/search?q=presence", "", origin)
		return found["users"].([]any)[0].(map[string]any)["presence"].(string)
	}
	if presence() != "Playing" {
		t.Fatal("idle session overrode playing")
	}
	accountRequest(t, s, c, "POST", "/logout", `{}`, origin)
	if presence() != "Active" {
		t.Fatal("revoked session retained presence")
	}
	advance(46 * time.Second)
	if presence() != "Offline" {
		t.Fatal("stale session stayed online")
	}
	accountRequest(t, s, other, "POST", "/chat/sync", `{"client":"menu","activity":"Active"}`, origin)
	if presence() != "Active" {
		t.Fatal("reconnect failed")
	}
}

func TestChatPinnedLobbyAndQualifiedRaceSuggestions(t *testing.T) {
	now, advance := lifecycleClock()
	store, err := accounts.Open(filepath.Join(t.TempDir(), "races.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	store.Bootstrap("Race_Admin", "original password")
	s, c, roots := configuredServer(t, appserver.Config{Accounts: store, Now: now, DragRaceOverrides: []byte(`{"operational":{"simulationLagThreshold":10}}`)})
	c.Jar, _ = cookiejar.New(nil)
	loginAccount(t, s, c, "Race_Admin", "original password")
	peers := []*http.Client{}
	for _, name := range []string{"First_Racer", "Second_Racer"} {
		_, created, _ := accountRequest(t, s, c, "POST", "/admin/users", fmt.Sprintf(`{"username":%q}`, name), origin)
		peer := independentClient(c)
		loginAccount(t, s, peer, name, created["temporaryPassword"].(string))
		accountRequest(t, s, peer, "POST", "/password", `{"password":"replacement password"}`, origin)
		peers = append(peers, peer)
	}
	// Three qualifying forfeits: first opponent wins frequency despite the second's recency.
	for _, index := range []int{0, 0, 1} {
		_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion}, origin)
		a := v.(p.Admission)
		outcomes := make(chan p.Outcome, 4)
		host, hostGame := observedPair(t, s, roots, a, true, func(v any) {
			if outcome, ok := v.(p.Outcome); ok {
				outcomes <- outcome
			}
		})
		_, v = admit(t, s, peers[index], p.AdmissionRequest{Operation: p.AdmissionOperationJoin, Version: p.ProtocolVersion, Code: code}, origin)
		b := v.(p.Admission)
		guest, guestGame := initializedPair(t, s, roots, b, true)
		state := roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
		_, snapshot, _ := accountRequest(t, s, c, "POST", "/chat/sync", fmt.Sprintf(`{"activity":"Active","roomID":%d}`, state.Identity.RoomId), origin)
		pin := snapshot["pinned"].(map[string]any)
		if pin["username"] != []string{"First_Racer", "Second_Racer"}[index] {
			t.Fatalf("pin %v", snapshot)
		}
		_, unpinned, _ := accountRequest(t, s, c, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
		if unpinned["pinned"] != nil {
			t.Fatal("another tab inherited lobby")
		}
		roomSend(t, host, a, 1, state, 1, 1, 1)
		state = roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
		roomSend(t, guest, b, 1, state, 1, 1, 1)
		state = roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
		roomSend(t, host, a, 2, state, 2, 1, 0)
		roomState(t, host, func(r p.RoomState) bool { return r.Phase == 1 })
		time.Sleep(30 * time.Millisecond)
		advance(3 * time.Second)
		state = roomState(t, host, func(r p.RoomState) bool { return r.Phase == 2 })
		roomSend(t, guest, b, 2, state, 3, 1, 0)
		time.Sleep(20 * time.Millisecond)
		advance(time.Microsecond)
		receiveOutcome(t, outcomes)
		host.Close()
		guest.Close()
		hostGame.CloseWithError(1, "done")
		guestGame.CloseWithError(1, "done")
	}
	deadline := time.Now().Add(2 * time.Second)
	var state map[string]any
	for time.Now().Before(deadline) {
		_, state, _ = accountRequest(t, s, c, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
		if len(state["suggested"].([]any)) == 2 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	suggestions := state["suggested"].([]any)
	if len(suggestions) != 2 {
		t.Fatalf("suggestions %v", state)
	}
	first := suggestions[0].(map[string]any)
	if first["username"] != "First_Racer" || first["rounds"] != float64(2) {
		t.Fatalf("ranking %v", suggestions)
	}
	thread := fmt.Sprintf("/chat/thread/%.0f", first["id"])
	accountRequest(t, s, c, "GET", thread, "", origin)
	_, state, _ = accountRequest(t, s, c, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if len(state["suggested"].([]any)) != 2 {
		t.Fatal("opening suggestion sent message")
	}
	accountRequest(t, s, c, "POST", thread, `{"text":"Good race","key":"first-contact"}`, origin)
	_, state, _ = accountRequest(t, s, c, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if len(state["suggested"].([]any)) != 1 || len(state["acquaintances"].([]any)) != 1 {
		t.Fatalf("suggestion conversion %v", state)
	}
}
