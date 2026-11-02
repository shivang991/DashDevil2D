package multiplayer_test

import (
	"testing"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	"github.com/shivang991/DashDevil2D/apps/server/multiplayer"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

func TestReplacementRejectsOldHandleAndReturnsCopiedBaseline(t *testing.T) {
	now := time.Unix(1700000000, 0)
	s, err := multiplayer.New(multiplayer.Config{Now: func() time.Time { return now }, Diagnostic: true})
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.Admit(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationCreate, Name: "Driver"}, "", accounts.Session{}, 0, multiplayer.Invitation{})
	if err != nil {
		t.Fatal(err)
	}
	before, err := first.Handle.Baseline()
	if err != nil {
		t.Fatal(err)
	}
	before.Cars[0].Hp = 0
	before.Windows[0].Start = 123456
	fresh, err := first.Handle.Baseline()
	if err != nil {
		t.Fatal(err)
	}
	if fresh.Cars[0].Hp == 0 || fresh.Windows[0].Start == 123456 {
		t.Fatal("caller mutated authoritative baseline")
	}
	replacement, err := s.Admit(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationResume, Credential: first.Credential}, "", accounts.Session{}, 0, multiplayer.Invitation{})
	if err != nil {
		t.Fatal(err)
	}
	first.Handle.Disconnected()
	if first.Handle.Valid() {
		t.Fatal("superseded handle remains valid")
	}
	if err := first.Handle.Connected(); err == nil {
		t.Fatal("old callback revived replaced connection")
	}
	if _, err := first.Handle.Baseline(); err == nil {
		t.Fatal("old handle obtained authority")
	}
	if !replacement.Handle.Valid() {
		t.Fatal("old callback invalidated replacement")
	}
	if replacement.Identity.PairGeneration != first.Identity.PairGeneration+1 {
		t.Fatal("replacement did not rotate generation")
	}
}

// No timer goroutine: all lifecycle work uses the owner's controlled clock.
func TestAdvanceReleasesReservationAtExactGrace(t *testing.T) {
	now := time.Unix(1700000000, 0)
	owner, err := multiplayer.New(multiplayer.Config{Now: func() time.Time { return now }, Diagnostic: true, CodeStart: func() (uint16, error) { return 42, nil }, DragRaceOverrides: []byte(`{"room":{"reconnectGrace":2}}`)})
	if err != nil {
		t.Fatal(err)
	}
	first, err := owner.Admit(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationCreate, Name: "Driver"}, "", accounts.Session{}, 0, multiplayer.Invitation{})
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(2*time.Second - time.Microsecond)
	owner.Advance()
	if !first.Handle.Valid() {
		t.Fatal("reservation expired before grace")
	}
	now = now.Add(time.Microsecond)
	owner.Advance()
	if first.Handle.Valid() {
		t.Fatal("reservation survived exact grace")
	}
	next, err := owner.Admit(p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationCreate, Name: "Next"}, "", accounts.Session{}, 0, multiplayer.Invitation{})
	if err != nil {
		t.Fatal(err)
	}
	if next.Code != "0042" || next.Identity.RoomId == first.Identity.RoomId {
		t.Fatal("expired room did not release code with a fresh identity")
	}
}
