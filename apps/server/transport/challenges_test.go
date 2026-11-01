package transport_test

import (
	"bytes"
	"fmt"
	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"io"
	"net/http"
	"net/http/cookiejar"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestChallengeDeliveredOfflineAndRequiresExplicitAcceptance(t *testing.T) {
	_, s, host := accountFixture(t)
	loginAccount(t, s, host, "Case_Admin", "a long password with spaces")
	_, created, _ := accountRequest(t, s, host, "POST", "/admin/users", `{"username":"Challenge_Driver"}`, origin)
	peer := independentClient(host)
	loginAccount(t, s, peer, "Challenge_Driver", created["temporaryPassword"].(string))
	accountRequest(t, s, peer, "POST", "/password", `{"password":"replacement password"}`, origin)
	_, people, _ := accountRequest(t, s, host, "GET", "/chat/search?q=Challenge_Driver", "", origin)
	peerID := people["users"].([]any)[0].(map[string]any)["id"]
	_, value, _ := admitWithCode(t, s, host, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion}, origin)
	admission := value.(p.Admission)
	initializedPair(t, s, host.Transport.(*http.Transport).TLSClientConfig.RootCAs, admission, true)
	status, invitation, _ := accountRequest(t, s, host, "POST", fmt.Sprintf("/chat/thread/%.0f/challenge", peerID), `{"roomID":0,"key":"challenge-one"}`, origin)
	if status != 200 {
		t.Fatalf("invite: %d %v", status, invitation)
	}
	_, state, _ := accountRequest(t, s, peer, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if state["unread"] != float64(1) {
		t.Fatalf("offline delivery: %v", state)
	}
	sender := state["acquaintances"].([]any)[0].(map[string]any)["id"]
	_, thread, _ := accountRequest(t, s, peer, "GET", fmt.Sprintf("/chat/thread/%.0f", sender), "", origin)
	challenge := thread["challenges"].([]any)[0].(map[string]any)
	if challenge["status"] != "Pending" {
		t.Fatalf("invitation: %v", challenge)
	}
	// Merely receiving/reading the invitation leaves the recipient outside the room.
	_, state, _ = accountRequest(t, s, peer, "POST", "/chat/sync", `{"activity":"Active"}`, origin)
	if state["pinned"] != nil {
		t.Fatal("invitation auto-joined recipient")
	}
	status, accepted := acceptChallenge(t, s, peer, int64(challenge["id"].(float64)))
	if status != 201 {
		t.Fatalf("accept: %d %v", status, accepted)
	}
	guestAdmission := accepted.(p.Admission)
	if guestAdmission.Identity.RoomId != admission.Identity.RoomId {
		t.Fatal("accepted wrong room")
	}
	initializedPair(t, s, host.Transport.(*http.Transport).TLSClientConfig.RootCAs, guestAdmission, true)
	status, retry, _ := accountRequest(t, s, host, "POST", fmt.Sprintf("/chat/thread/%.0f/challenge", peerID), `{"roomID":0,"key":"challenge-one"}`, origin)
	if status != 200 || retry["id"] != invitation["id"] {
		t.Fatalf("retry after acceptance: %d %v", status, retry)
	}
	_, updates, _ := accountRequest(t, s, host, "GET", fmt.Sprintf("/chat/thread/%.0f?after=%.0f&watch=%.0f", peerID, invitation["id"], invitation["id"]), "", origin)
	if len(updates["messages"].([]any)) != 0 || updates["challenges"].([]any)[0].(map[string]any)["status"] != "Accepted" {
		t.Fatalf("terminal update: %v", updates)
	}

}

func acceptChallenge(t *testing.T, s *transport.Server, c *http.Client, id int64) (int, any) {
	t.Helper()
	wire, err := p.EncodeMessage(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationJoin}, 65536)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest("POST", fmt.Sprintf("%s/admission?challenge=%d", s.URL(), id), bytes.NewReader(wire))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", origin)
	res, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	value, err := p.DecodeMessage(body, 65536)
	if err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, value
}

func TestChallengeAdmissionEligibility(t *testing.T) {
	for _, scenario := range []string{"expired", "full", "closed", "another room", "concurrent acceptance", "accept versus join", "unauthorized", "playing"} {
		t.Run(scenario, func(t *testing.T) {
			now, advance := lifecycleClock()
			store, err := accounts.Open(filepath.Join(t.TempDir(), "challenges.sqlite"))
			if err != nil {
				t.Fatal(err)
			}
			defer store.Close()
			if err = store.Bootstrap("Challenge_Admin", "original password"); err != nil {
				t.Fatal(err)
			}
			s, host, roots := configuredServer(t, transport.Config{Accounts: store, Now: now})
			host.Jar, _ = cookiejar.New(nil)
			loginAccount(t, s, host, "Challenge_Admin", "original password")
			_, created, _ := accountRequest(t, s, host, "POST", "/admin/users", `{"username":"Challenge_Guest"}`, origin)
			peer := independentClient(host)
			loginAccount(t, s, peer, "Challenge_Guest", created["temporaryPassword"].(string))
			accountRequest(t, s, peer, "POST", "/password", `{"password":"replacement password"}`, origin)
			_, people, _ := accountRequest(t, s, host, "GET", "/chat/search?q=Challenge_Guest", "", origin)
			peerID := people["users"].([]any)[0].(map[string]any)["id"]
			_, value, code := admitWithCode(t, s, host, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion}, origin)
			a := value.(p.Admission)
			socket, _ := initializedPair(t, s, roots, a, true)
			status, message, _ := accountRequest(t, s, host, "POST", fmt.Sprintf("/chat/thread/%.0f/challenge", peerID), fmt.Sprintf(`{"roomID":%d,"key":"test-invite"}`, a.Identity.RoomId), origin)
			if status != 200 {
				t.Fatalf("invite %d %v", status, message)
			}
			id := int64(message["id"].(float64))
			expected := "Unavailable"
			switch scenario {
			case "expired":
				advance(5 * time.Minute)
				expected = "Expired"
			case "full":
				admit(t, s, host, p.AdmissionRequest{Operation: p.AdmissionOperationJoin, Version: p.ProtocolVersion, Code: code}, origin)
			case "closed":
				roomSend(t, socket, a, 1, p.RoomState{}, 3, 1, 0)
				socket.SetReadDeadline(time.Now().Add(time.Second))
				for {
					if _, _, err := socket.ReadMessage(); err != nil {
						break
					}
				}
			case "another room":
				admit(t, s, peer, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion}, origin)
				expected = "Pending"
			case "playing":
				_, v, otherCode := admitWithCode(t, s, peer, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion}, origin)
				b := v.(p.Admission)
				guestSocket, _ := initializedPair(t, s, roots, b, true)
				_, v = admit(t, s, host, p.AdmissionRequest{Operation: p.AdmissionOperationJoin, Version: p.ProtocolVersion, Code: otherCode}, origin)
				c := v.(p.Admission)
				opponent, _ := initializedPair(t, s, roots, c, true)
				state := roomState(t, guestSocket, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
				roomSend(t, guestSocket, b, 1, state, 1, 1, 1)
				state = roomState(t, opponent, func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
				roomSend(t, opponent, c, 1, state, 1, 1, 1)
				state = roomState(t, guestSocket, func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
				roomSend(t, guestSocket, b, 2, state, 2, 1, 0)
				roomState(t, guestSocket, func(r p.RoomState) bool { return r.Phase == p.RoomPhaseCountdown })
				expected = "Pending"
			case "unauthorized":
				if status, _ := acceptChallenge(t, s, host, id); status != 404 {
					t.Fatalf("sender accepted %d", status)
				}
				if status, _ := acceptChallenge(t, s, independentClient(host), id); status != 401 {
					t.Fatalf("guest accepted %d", status)
				}
				return
			case "concurrent acceptance", "accept versus join":
				results := make(chan int, 2)
				go func() { status, _ := acceptChallenge(t, s, peer, id); results <- status }()
				go func() {
					if scenario == "accept versus join" {
						status, _ := admit(t, s, host, p.AdmissionRequest{Operation: p.AdmissionOperationJoin, Version: p.ProtocolVersion, Code: code}, origin)
						results <- status
					} else {
						status, _ := acceptChallenge(t, s, peer, id)
						results <- status
					}
				}()
				first, second := <-results, <-results
				if (first == 201) == (second == 201) {
					t.Fatalf("race winners: %d %d", first, second)
				}
				return
			}
			status, result := acceptChallenge(t, s, peer, id)
			if status != 409 {
				t.Fatalf("accepted %s: %d %v", scenario, status, result)
			}
			if scenario == "playing" && !strings.Contains(result.(p.ProtocolError).Detail, "Finish your game") {
				t.Fatalf("gameplay rejection: %v", result)
			}
			_, thread, _ := accountRequest(t, s, host, "GET", fmt.Sprintf("/chat/thread/%.0f", peerID), "", origin)
			invitation := thread["challenges"].([]any)[0].(map[string]any)
			if invitation["status"] != expected {
				t.Fatalf("offline status: %v", invitation)
			}
		})
	}
}
