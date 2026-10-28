package transport_test

import (
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"testing"
	"time"
)

func TestMaintenanceRejectsNewAdmissionsButAllowsReservedSeatRecovery(t *testing.T) {
	s, c, _ := serverMode(t, false)
	_, value, code := admitWithCode(t, s, c, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := value.(p.Admission)
	if err := s.BeginDrain(3 * time.Minute); err != nil {
		t.Fatal(err)
	}
	for _, request := range []p.AdmissionRequest{{Version: p.ProtocolVersion, Name: "New host"}, {Version: p.ProtocolVersion, Operation: p.AdmissionOperationJoin, Code: code, Name: "Guest"}} {
		status, value := admit(t, s, c, request, origin)
		problem, ok := value.(p.ProtocolError)
		if status != 503 || !ok || problem.Detail != "Server maintenance. Try again later." {
			t.Fatalf("admission during drain: %d %+v", status, value)
		}
	}
	status, value := admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationResume, Credential: a.Credential}, origin)
	if status != 201 || value.(p.Admission).Identity.SeatSession != a.Identity.SeatSession {
		t.Fatalf("reserved recovery rejected: %d %+v", status, value)
	}
	if !s.Maintenance().Draining {
		t.Fatal("maintenance not recorded")
	}
}

func TestMaintenanceCancelsCountdownAndRejectsNewStarts(t *testing.T) {
	s, c, roots := serverMode(t, false)
	_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion, Name: "Host"}, origin)
	a := v.(p.Admission)
	host, _ := initializedPair(t, s, roots, a, true)
	_, v = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationJoin, Code: code, Name: "Guest"}, origin)
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
	status, value := admit(t, s, c, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: 1, Name: "Old tab"}, origin)
	problem, ok := value.(p.ProtocolError)
	if status != 409 || !ok || problem.ExpectedVersion != p.ProtocolVersion {
		t.Fatalf("old tab not told to reload: status=%d response=%T", status, value)
	}
}

func TestConfiguredCapacityPreservesExistingSeats(t *testing.T) {
	s, c, _ := configuredServer(t, transport.Config{RoomLimit: 1})
	_, value, code := admitWithCode(t, s, c, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion, Name: "Host"}, origin)
	host := value.(p.Admission)
	status, value := admit(t, s, c, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion, Name: "Other"}, origin)
	if status != 503 || value.(p.ProtocolError).Detail != "Server full. Try again later." {
		t.Fatalf("capacity: %d %+v", status, value)
	}
	status, value = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationJoin, Code: code, Name: "Guest"}, origin)
	if status != 201 {
		t.Fatalf("existing seat: %d %+v", status, value)
	}
	status, value = admit(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationResume, Credential: host.Credential}, origin)
	if status != 201 || value.(p.Admission).Identity.SeatSession != host.Identity.SeatSession {
		t.Fatalf("reconnect: %d %+v", status, value)
	}
}

func TestRestartInvalidatesLostRoomCredential(t *testing.T) {
	old, client, _ := serverMode(t, false)
	_, value := admit(t, old, client, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion, Name: "Host"}, origin)
	credential := value.(p.Admission).Credential
	old.Close()
	restarted, client, _ := serverMode(t, false)
	status, value := admit(t, restarted, client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationResume, Credential: credential}, origin)
	if status != 410 || value.(p.ProtocolError).Detail != "Room expired" {
		t.Fatalf("lost room: %d %+v", status, value)
	}
	status, value = admit(t, restarted, client, p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: p.ProtocolVersion, Name: "New host"}, origin)
	if status != 201 {
		t.Fatalf("fresh process admission: %d %+v", status, value)
	}
}
