package transport_test

import (
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"testing"
	"time"
)

func TestMaintenanceRejectsNewAdmissionsButAllowsReservedSeatRecovery(t *testing.T) {
	s, c, _ := serverMode(t, false)
	_, value, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := value.(p.Admission)
	if err := s.BeginDrain(3 * time.Minute); err != nil {
		t.Fatal(err)
	}
	for _, request := range []p.AdmissionRequest{{Version: p.ProtocolVersion, Name: "New host"}, {Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Guest"}} {
		status, value := admit(t, s, c, request, origin)
		problem, ok := value.(p.ProtocolError)
		if status != 503 || !ok || problem.Detail != "Server maintenance. Try again later." {
			t.Fatalf("admission during drain: %d %+v", status, value)
		}
	}
	status, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 2, Credential: a.Credential}, origin)
	if status != 201 || value.(p.Admission).Identity.SeatSession != a.Identity.SeatSession {
		t.Fatalf("reserved recovery rejected: %d %+v", status, value)
	}
	if !s.Maintenance().Draining {
		t.Fatal("maintenance not recorded")
	}
}

func TestMaintenanceCancelsCountdownAndRejectsNewStarts(t *testing.T) {
	s, c, roots := serverMode(t, false)
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, _ := initializedPair(t, s, roots, a, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: 1, Code: code, Name: "Guest"}, origin)
	b := v.(p.Admission)
	guest, _ := initializedPair(t, s, roots, b, true)
	state := roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
	roomSend(t, host, a, 1, state, 1, 1, 1)
	state = roomState(t, guest, func(r p.RoomState) bool { return r.Seats[0].Flags&2 != 0 })
	roomSend(t, guest, b, 1, state, 1, 1, 1)
	state = roomState(t, host, func(r p.RoomState) bool { return r.Seats[1].Flags&2 != 0 })
	roomSend(t, host, a, 2, state, 2, 1, 0)
	roomState(t, host, func(r p.RoomState) bool { return r.Phase == 1 })
	if err := s.BeginDrain(time.Minute); err != nil {
		t.Fatal(err)
	}
	state = roomState(t, host, func(r p.RoomState) bool { return r.Phase == 0 })
	if state.Seats[0].Flags&2 != 0 || state.Seats[1].Flags&2 != 0 {
		t.Fatal("drain retained readiness")
	}
	roomSend(t, host, a, 3, state, 2, 1, 0)
	reply := roomReply(t, host, 3)
	if reply.Accepted != 0 || reply.Detail != "Server maintenance. Try again later." {
		t.Fatalf("start during drain: %+v", reply)
	}
}

func TestDeploymentRejectsPriorProtocolBeforeAllocatingSeat(t *testing.T) {
	s, c, _ := serverMode(t, false)
	status, value := admit(t, s, c, p.AdmissionRequest{Version: 1, Name: "Old tab"}, origin)
	problem, ok := value.(p.ProtocolError)
	if status != 409 || !ok || problem.ExpectedVersion != 2 {
		t.Fatalf("old tab not told to reload: status=%d response=%T", status, value)
	}
}
