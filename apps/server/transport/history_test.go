package transport_test

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http/cookiejar"
	"path/filepath"
	"testing"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	appserver "github.com/shivang991/DashDevil2D/apps/server/server"
)

type historyFixture struct {
	activeLifecycleRoom
	db      *sql.DB
	store   *accounts.Store
	writers [2]chan io.Writer
	seq     [2]uint32
}

func historyLobby(t *testing.T, mode p.Mode, overrides string) *historyFixture {
	t.Helper()
	path := filepath.Join(t.TempDir(), "history.sqlite")
	store, err := accounts.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	if err = store.Bootstrap("History_Admin", "password"); err != nil {
		t.Fatal(err)
	}
	if err = store.CreateTemporary("History_Driver", "password"); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	now, advance := lifecycleClock()
	config := appserver.Config{Accounts: store, Now: now}
	if mode == p.ModeDragRace {
		config.DragRaceOverrides = []byte(overrides)
	} else {
		config.RoadRageOverrides = []byte(overrides)
	}
	s, c, roots := configuredServer(t, config)
	c.Jar, _ = cookiejar.New(nil)
	if status, _, _ := accountRequest(t, s, c, "POST", "/login", `{"username":"History_Driver","password":"password"}`, origin); status != 200 {
		t.Fatal(status)
	}
	if status, _, _ := accountRequest(t, s, c, "POST", "/password", `{"password":"new password"}`, origin); status != 200 {
		t.Fatal(status)
	}
	f := &historyFixture{activeLifecycleRoom: activeLifecycleRoom{server: s, client: c, roots: roots, advance: advance}, db: db, store: store}
	for i, operation := range []p.AdmissionOperation{p.AdmissionOperationCreate, p.AdmissionOperationJoin} {
		_, v, code := admitWithCode(t, s, c, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: operation, Code: f.code, Name: "ignored"}, origin)
		if i == 0 {
			f.code = code
		}
		f.admissions[i] = v.(p.Admission)
		f.outcomes[i] = make(chan p.Outcome, 4)
		f.writers[i] = make(chan io.Writer, 1)
		f.sockets[i], f.games[i] = observedPair(t, s, roots, f.admissions[i], true, func(record any) {
			switch value := record.(type) {
			case p.Outcome:
				f.outcomes[i] <- value
			case io.Writer:
				f.writers[i] <- value
			}
		})
	}
	f.state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Seats[1].Flags&1 != 0 })
	if mode != p.ModeDragRace {
		f.command(t, 0, p.RoomCommandCodeSelectMode, uint8(mode), 0)
	}
	return f
}
func (f *historyFixture) command(t *testing.T, seat int, command p.RoomCommandCode, mode, ready uint8) {
	t.Helper()
	f.seq[seat]++
	roomSend(t, f.sockets[seat], f.admissions[seat], f.seq[seat], f.state, uint8(command), mode, ready)
	old := f.state.Revision
	gotReply, gotState := false, false
	f.sockets[seat].SetReadDeadline(time.Now().Add(3 * time.Second))
	for !gotReply || !gotState {
		_, wire, err := f.sockets[seat].ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		value, err := p.DecodeMessage(wire, 65536)
		if err != nil {
			t.Fatal(err)
		}
		switch v := value.(type) {
		case p.RoomReply:
			if v.Sequence == f.seq[seat] {
				if v.Accepted != 1 {
					t.Fatalf("command %d: %+v", command, v)
				}
				gotReply = true
			}
		case p.RoomState:
			if v.Revision > old {
				f.state = v
				gotState = true
			}
		}
	}
}
func (f *historyFixture) countdown(t *testing.T) {
	f.command(t, 0, p.RoomCommandCodeReady, 1, 1)
	f.command(t, 1, p.RoomCommandCodeReady, 1, 1)
	f.command(t, 0, p.RoomCommandCodeStart, 1, 0)
	time.Sleep(40 * time.Millisecond) // real reliable baseline acknowledgements
}
func (f *historyFixture) start(t *testing.T) {
	f.countdown(t)
	f.advance(3 * time.Second)
	f.state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Phase == p.RoomPhaseActive })
}
func waitHistoryCount(t *testing.T, db *sql.DB, query string, want int) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for {
		var count int
		err := db.QueryRow(query).Scan(&count)
		if err != nil {
			t.Fatal(err)
		}
		if count == want {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("%s: got %d want %d", query, count, want)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
func assertStoredOutcome(t *testing.T, f *historyFixture, mode p.Mode, outcome p.Outcome, total int) {
	t.Helper()
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history WHERE ended_at IS NOT NULL`, total)
	var id, storedMode string
	var result int
	var reason string
	var duration, started, ended int64
	err := f.db.QueryRow(`SELECT id,mode,outcome,end_reason,duration_us,started_at,ended_at FROM race_history ORDER BY started_at DESC LIMIT 1`).Scan(&id, &storedMode, &result, &reason, &duration, &started, &ended)
	if err != nil {
		t.Fatal(err)
	}
	expectedMode := "drag-race"
	table := "drag_race_result"
	if mode == p.ModeRoadRage {
		expectedMode = "road-rage"
		table = "road_rage_result"
	}
	if storedMode != expectedMode || result != int(outcome.Result) || reason != fmt.Sprint(uint8(outcome.Reason)) || duration != int64(outcome.TimeUs) || ended-started != duration {
		t.Fatalf("stored outcome differs: %s %d %s %d; wire %+v", storedMode, result, reason, duration, outcome)
	}
	for seat, car := range outcome.Cars {
		var hp, score uint32
		var progress float64
		if err = f.db.QueryRow(`SELECT hp,score,progress FROM `+table+` WHERE race_id=? AND seat=?`, id, seat).Scan(&hp, &score, &progress); err != nil {
			t.Fatal(err)
		}
		if hp != car.Hp || score != car.Score || progress != car.Progress {
			t.Fatalf("seat %d stats differ from authority", seat)
		}
	}
}

func TestRaceHistoryTransportModesAndRematches(t *testing.T) {
	for _, mode := range []p.Mode{p.ModeDragRace, p.ModeRoadRage} {
		t.Run(fmt.Sprint(mode), func(t *testing.T) {
			gameplay := `"finishDistance":440,"reservedHearts":0,`
			if mode == p.ModeRoadRage {
				gameplay = `"timeLimit":1,`
			}
			f := historyLobby(t, mode, `{"gameplay":{`+gameplay+`"tickRate":1,"initialClearDistance":0,"obstacleWeight":0,"emptyWeight":1},"operational":{"simulationLagThreshold":10}}`)
			for round := 1; round <= 2; round++ {
				f.start(t)
				waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, round)
				f.advance(2 * time.Second)
				outcome := receiveOutcome(t, f.outcomes[0])
				receiveOutcome(t, f.outcomes[1])
				if outcome.Result != p.OutcomeResultTie {
					t.Fatalf("expected tie: %+v", outcome)
				}
				assertStoredOutcome(t, f, mode, outcome, round)
				f.state = roomState(t, f.sockets[0], func(r p.RoomState) bool { return r.Phase == p.RoomPhaseEnded })
				f.command(t, 0, p.RoomCommandCodeReturnToLobby, 1, 0)
				f.command(t, 1, p.RoomCommandCodeReturnToLobby, 1, 0)
			}
			waitHistoryCount(t, f.db, `SELECT COUNT(DISTINCT id) FROM race_history`, 2)
			waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_participant WHERE account_id IS NOT NULL`, 4)
			waitHistoryCount(t, f.db, `SELECT COUNT(DISTINCT account_id) FROM race_participant`, 1)
		})
	}
}

func TestRaceHistoryTransportCancellationAndForfeit(t *testing.T) {
	f := historyLobby(t, p.ModeDragRace, `{"operational":{"simulationLagThreshold":10}}`)
	f.countdown(t)
	f.command(t, 0, p.RoomCommandCodeFocus, 0, 0)
	f.advance(4 * time.Second)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, 0)
	f.command(t, 0, p.RoomCommandCodeFocus, 1, 1)
	f.start(t)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, 1)
	f.seq[1]++
	roomSend(t, f.sockets[1], f.admissions[1], f.seq[1], f.state, 3, 1, 0)
	time.Sleep(30 * time.Millisecond)
	f.advance(time.Microsecond)
	outcome := receiveOutcome(t, f.outcomes[0])
	if outcome.Result != p.OutcomeResultPlayer1Win || outcome.Reason != p.OutcomeReasonExplicitLeave {
		t.Fatalf("forfeit: %+v", outcome)
	}
	assertStoredOutcome(t, f, p.ModeDragRace, outcome, 1)
}

func TestRaceHistoryTransportAbandonmentAndRestart(t *testing.T) {
	for _, restart := range []bool{false, true} {
		t.Run(fmt.Sprint(restart), func(t *testing.T) {
			f := historyLobby(t, p.ModeRoadRage, `{"room":{"reconnectGrace":1},"operational":{"simulationLagThreshold":10}}`)
			f.start(t)
			waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, 1)
			if restart {
				f.server.Close()
				s, _, _ := configuredServer(t, appserver.Config{Accounts: f.store})
				defer s.Close()
				waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history WHERE outcome=3 AND end_reason='server_restart' AND duration_us IS NULL`, 1)
				waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM road_rage_result`, 0)
			} else {
				for i := range f.games {
					f.sockets[i].Close()
					f.games[i].CloseWithError(1, "disconnect")
				}
				time.Sleep(40 * time.Millisecond)
				f.advance(2 * time.Second)
				waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history WHERE outcome=3 AND end_reason='5'`, 1)
				waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM road_rage_result`, 2)
			}
		})
	}
}

func TestRaceHistoryTransportRetriesFailedFinalization(t *testing.T) {
	f := historyLobby(t, p.ModeDragRace, `{"gameplay":{"finishDistance":440,"tickRate":1,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1},"operational":{"simulationLagThreshold":10}}`)
	f.start(t)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, 1)
	if _, err := f.db.Exec(`CREATE TRIGGER fail_history BEFORE INSERT ON drag_race_result WHEN NEW.seat=1 BEGIN SELECT RAISE(ABORT,'unavailable'); END`); err != nil {
		t.Fatal(err)
	}
	f.advance(2 * time.Second)
	outcome := receiveOutcome(t, f.outcomes[0])
	receiveOutcome(t, f.outcomes[1])
	deadline := time.Now().Add(2 * time.Second)
	for f.server.Ready() {
		if time.Now().After(deadline) {
			t.Fatal("storage failure did not disable readiness")
		}
		time.Sleep(10 * time.Millisecond)
	}
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM drag_race_result`, 0)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history WHERE ended_at IS NOT NULL`, 0)
	if _, err := f.db.Exec(`DROP TRIGGER fail_history`); err != nil {
		t.Fatal(err)
	}
	assertStoredOutcome(t, f, p.ModeDragRace, outcome, 1)
	if !f.server.Ready() {
		t.Fatal("successful retry did not restore readiness")
	}
}

func TestRaceHistoryBlockedDatabaseDoesNotHoldGameplayOwnership(t *testing.T) {
	f := historyLobby(t, p.ModeDragRace, `{"operational":{"simulationLagThreshold":10}}`)
	f.start(t)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, 1)
	conn, err := f.db.Conn(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if _, err = conn.ExecContext(context.Background(), `BEGIN IMMEDIATE`); err != nil {
		t.Fatal(err)
	}
	defer conn.ExecContext(context.Background(), `ROLLBACK`)
	if err = f.server.BeginDrain(time.Second); err != nil {
		t.Fatal(err)
	}
	f.advance(time.Second)
	outcome := receiveOutcome(t, f.outcomes[0])
	if outcome.Result != p.OutcomeResultAbandoned || outcome.Reason != p.OutcomeReasonMaintenance {
		t.Fatal(outcome)
	}
	time.Sleep(50 * time.Millisecond) // persistence is now waiting on the real writer
	status := make(chan appserver.MaintenanceStatus, 1)
	go func() { status <- f.server.Maintenance() }()
	select {
	case <-status:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("SQLite writer held gameplay ownership")
	}
	if _, err = conn.ExecContext(context.Background(), `ROLLBACK`); err != nil {
		t.Fatal(err)
	}
	assertStoredOutcome(t, f, p.ModeDragRace, outcome, 1)
}

func TestRaceHistoryStartFailurePreventsSimulationUntilDurable(t *testing.T) {
	f := historyLobby(t, p.ModeDragRace, `{"gameplay":{"finishDistance":440,"tickRate":1,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1},"operational":{"simulationLagThreshold":10}}`)
	if _, err := f.db.Exec(`CREATE TRIGGER fail_start BEFORE INSERT ON race_history BEGIN SELECT RAISE(ABORT,'unavailable'); END`); err != nil {
		t.Fatal(err)
	}
	f.countdown(t)
	f.advance(3 * time.Second)
	f.advance(2 * time.Second)
	select {
	case outcome := <-f.outcomes[0]:
		t.Fatalf("advanced without durable start: %+v", outcome)
	case <-time.After(100 * time.Millisecond):
	}
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, 0)
	status, _ := admit(t, f.server, f.client, p.AdmissionRequest{Version: p.ProtocolVersion, Operation: p.AdmissionOperationResume, Credential: f.admissions[0].Credential}, origin)
	if status != 503 {
		t.Fatalf("pending start allowed recovery: %d", status)
	}
	f.sockets[0].SetReadDeadline(time.Now().Add(50 * time.Millisecond))
	for {
		_, wire, err := f.sockets[0].ReadMessage()
		if err != nil {
			break
		}
		value, err := p.DecodeMessage(wire, 65536)
		if err != nil {
			t.Fatal(err)
		}
		if state, ok := value.(p.RoomState); ok && state.Phase == p.RoomPhaseActive {
			t.Fatal("published Active before durable start")
		}
	}

	if _, err := f.db.Exec(`DROP TRIGGER fail_start`); err != nil {
		t.Fatal(err)
	}
	outcome := receiveOutcome(t, f.outcomes[0])
	assertStoredOutcome(t, f, p.ModeDragRace, outcome, 1)
}

func TestRaceHistoryDeletionAnonymizesQueuedStartBeforeAccountIDReuse(t *testing.T) {
	f := historyLobby(t, p.ModeDragRace, `{"operational":{"simulationLagThreshold":10}}`)
	if _, err := f.db.Exec(`CREATE TRIGGER fail_start BEFORE INSERT ON race_history BEGIN SELECT RAISE(ABORT,'unavailable'); END`); err != nil {
		t.Fatal(err)
	}
	f.countdown(t)
	f.advance(3 * time.Second)
	deadline := time.Now().Add(2 * time.Second)
	for f.server.Ready() {
		if time.Now().After(deadline) {
			t.Fatal("start did not fail")
		}
		time.Sleep(10 * time.Millisecond)
	}
	admin := independentClient(f.client)
	loginAccount(t, f.server, admin, "History_Admin", "password")
	var id int64
	if err := f.db.QueryRow(`SELECT id FROM accounts WHERE username='History_Driver'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if status, body, _ := accountRequest(t, f.server, admin, "POST", fmt.Sprintf("/admin/users/%d/delete", id), `{"confirm":true}`, origin); status != 200 {
		t.Fatalf("delete: %d %v", status, body)
	}
	if err := f.store.CreateTemporary("Replacement", "password"); err != nil {
		t.Fatal(err)
	}
	f.advance(time.Microsecond)
	if _, err := f.db.Exec(`DROP TRIGGER fail_start`); err != nil {
		t.Fatal(err)
	}
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history WHERE outcome=3`, 1)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_participant WHERE account_id IS NULL`, 2)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM drag_race_result`, 2)
}

func TestRaceHistoryStoresGameplayWinFromAuthority(t *testing.T) {
	f := historyLobby(t, p.ModeDragRace, `{"gameplay":{"finishDistance":1240,"tickRate":1,"initialClearDistance":0,"reservedHearts":0,"obstacleWeight":0,"emptyWeight":1},"connection":{"controlFreshnessExpiry":10},"operational":{"simulationLagThreshold":10}}`)
	f.start(t)
	waitHistoryCount(t, f.db, `SELECT COUNT(*) FROM race_history`, 1)
	sendRecord(t, <-f.writers[0], p.Input{Identity: f.admissions[0].Identity, Round: p.Round{RoundId: f.state.RoundId, InputGeneration: 2}, Sequence: 1, Intent: 0, Control: 3, HeldMask: 4})
	time.Sleep(30 * time.Millisecond)
	f.advance(3 * time.Second)
	outcome := receiveOutcome(t, f.outcomes[0])
	if outcome.Result != p.OutcomeResultPlayer1Win || outcome.Reason != p.OutcomeReasonFinish {
		t.Fatalf("gameplay win: %+v", outcome)
	}
	assertStoredOutcome(t, f, p.ModeDragRace, outcome, 1)
}
