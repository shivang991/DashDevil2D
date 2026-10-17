package transport_test

import (
	ws "github.com/fasthttp/websocket"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"testing"
	"time"
)

func roomState(t *testing.T, socket *ws.Conn, match func(p.RoomState) bool) p.RoomState {
	t.Helper()
	socket.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		_, wire, err := socket.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		value, err := p.DecodeMessage(wire, 65536)
		if err != nil {
			t.Fatal(err)
		}
		if problem, ok := value.(p.ProtocolError); ok {
			t.Fatalf("room rejected: %s", problem.Detail)
		}
		if state, ok := value.(p.RoomState); ok && match(state) {
			return state
		}
	}
}
func roomSend(t *testing.T, socket *ws.Conn, a p.Admission, sequence uint32, state p.RoomState, command, mode, ready uint8) {
	t.Helper()
	wire, err := p.EncodeMessage(p.RoomCommand{Identity: a.Identity, Sequence: sequence, Revision: state.Revision, Command: command, Mode: mode, Ready: ready}, 65536)
	if err != nil {
		t.Fatal(err)
	}
	if err = socket.WriteMessage(ws.BinaryMessage, wire); err != nil {
		t.Fatal(err)
	}
}
func TestRoomHostChangesModeAndClearsBothReadyStatuses(t *testing.T) {
	s, c, roots := serverMode(t, false)
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: 1, Name: "Same"}, origin)
	hostAdmission := v.(p.Admission)
	host, _ := initializedPair(t, s, roots, hostAdmission, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Version: 1, Operation: 1, Code: code, Name: "Same"}, origin)
	guestAdmission := v.(p.Admission)
	guest, _ := initializedPair(t, s, roots, guestAdmission, true)
	state := roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
	roomSend(t, host, hostAdmission, 1, state, 1, 1, 1)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
	guestState := roomState(t, guest, func(r p.RoomState) bool { return r.Revision == state.Revision })
	roomSend(t, guest, guestAdmission, 1, guestState, 1, 1, 1)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
	roomSend(t, host, hostAdmission, 2, state, 0, 2, 0)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Mode == 2 })
	if state.Seats[0].Flags&2 != 0 || state.Seats[1].Flags&2 != 0 || state.Host != 0 {
		t.Fatal("mode change must clear readiness and retain host")
	}
}

func TestRoomCountdownDisconnectCancelsAndRequiresFreshReadiness(t *testing.T) {
	s, c, roots := serverMode(t, false)
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: 1, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, _ := initializedPair(t, s, roots, a, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Version: 1, Operation: 1, Code: code, Name: "Guest"}, origin)
	b := v.(p.Admission)
	guest, game := initializedPair(t, s, roots, b, true)
	state := roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
	roomSend(t, host, a, 1, state, 1, 1, 1)
	state = roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
	roomSend(t, guest, b, 1, state, 1, 1, 1)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
	roomSend(t, host, a, 2, state, 2, 1, 0)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Phase == 1 })
	if state.StartUs == 0 || state.RoundId == 0 {
		t.Fatal("countdown requires shared announced round identity and zero")
	}
	guest.Close()
	game.CloseWithError(1, "countdown disconnect")
	state = roomState(t, host, func(r p.RoomState) bool { return r.Phase == 0 })
	if state.Seats[0].Flags&2 != 0 || state.Seats[1].Flags&2 != 0 || state.StartUs != 0 {
		t.Fatal("cancellation must clear readiness and schedule")
	}
}

func roomReply(t *testing.T, socket *ws.Conn, sequence uint32) p.RoomReply {
	t.Helper()
	socket.SetReadDeadline(time.Now().Add(3 * time.Second))
	for {
		_, wire, err := socket.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		value, err := p.DecodeMessage(wire, 65536)
		if err != nil {
			t.Fatal(err)
		}
		if reply, ok := value.(p.RoomReply); ok && reply.Sequence == sequence {
			return reply
		}
	}
}
func TestRoomRejectsGuestAuthorityAndHiddenReadinessWithoutDroppingPair(t *testing.T) {
	s, c, roots := serverMode(t, false)
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: 1, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, _ := initializedPair(t, s, roots, a, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Version: 1, Operation: 1, Code: code, Name: "Guest"}, origin)
	b := v.(p.Admission)
	guest, _ := initializedPair(t, s, roots, b, true)
	state := roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
	roomSend(t, guest, b, 1, state, 0, 2, 0)
	if reply := roomReply(t, guest, 1); reply.Accepted != 0 {
		t.Fatal("guest changed mode")
	}
	roomSend(t, guest, b, 2, state, 2, 1, 0)
	if reply := roomReply(t, guest, 2); reply.Accepted != 0 {
		t.Fatal("guest started round")
	}
	roomSend(t, guest, b, 3, state, 4, 0, 0)
	if reply := roomReply(t, guest, 3); reply.Accepted != 1 {
		t.Fatal("hidden safety action must apply despite old revisions")
	}
	state = roomState(t, host, func(r p.RoomState) bool { return r.Revision > state.Revision })
	roomSend(t, guest, b, 4, state, 1, 1, 1)
	if reply := roomReply(t, guest, 4); reply.Accepted != 0 {
		t.Fatal("hidden participant became ready")
	}
	roomSend(t, guest, b, 5, state, 4, 1, 1)
	if reply := roomReply(t, guest, 5); reply.Accepted != 1 {
		t.Fatal("focus restoration rejected")
	}
	state = roomState(t, host, func(r p.RoomState) bool { return r.Revision > state.Revision })
	roomSend(t, guest, b, 6, state, 1, 1, 1)
	if reply := roomReply(t, guest, 6); reply.Accepted != 1 {
		t.Fatal("focused participant could not ready after rejection")
	}
}

func TestReturnToLobbyRejectsUnfinishedRoundWithoutDroppingPair(t *testing.T) {
	s, c, roots := serverMode(t, false)
	_, v, _ := admitWithCode(t, s, c, p.AdmissionRequest{Version: 1, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, _ := initializedPair(t, s, roots, a, true)
	roomSend(t, host, a, 1, p.RoomState{}, 4, 1, 1)
	state := roomState(t, host, func(r p.RoomState) bool { return r.Seats[0].Flags&1 != 0 })
	roomSend(t, host, a, 2, state, 5, 1, 0)
	reply := roomReply(t, host, 2)
	if reply.Accepted != 0 || reply.Detail != "Return to Lobby requires a finalized round" {
		t.Fatalf("unfinished return accepted or wrong rejection: %+v", reply)
	}
	roomSend(t, host, a, 3, state, 1, 1, 1)
	if reply := roomReply(t, host, 3); reply.Accepted != 1 {
		t.Fatalf("rejection dropped usable pair: %+v", reply)
	}
}
