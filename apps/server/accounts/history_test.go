package accounts

import (
	"fmt"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"path/filepath"
	"testing"
	"time"
)

func TestRaceHistoryPersistsBothSeatsAndFinalResults(t *testing.T) {
	path := filepath.Join(t.TempDir(), "history.sqlite")
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = s.CreateTemporary("Driver", "password"); err != nil {
		t.Fatal(err)
	}
	users, _ := s.Users()
	id := users[0].ID
	for _, mode := range []string{"drag-race", "road-rage"} {
		start := time.Unix(100, 0)
		if err = s.StartRace(mode, mode, start, [2]int64{id, id}); err != nil {
			t.Fatal(err)
		}
		final := RaceFinal{DurationUs: 2500000, Outcome: 2, Reason: 0, Cars: [2]RaceCar{{HP: 2, Score: 10, Progress: 42}, {HP: 1, Score: 20, Progress: 41}}}
		if err = s.FinishRace(mode, final); err != nil {
			t.Fatal(err)
		}
		final.Outcome = 0
		if err = s.FinishRace(mode, final); err != nil {
			t.Fatal(err)
		}
		var outcome, count int
		var duration int64
		if err = s.db.QueryRow(`SELECT outcome,duration_us FROM race_history WHERE id=?`, mode).Scan(&outcome, &duration); err != nil {
			t.Fatal(err)
		}
		if outcome != 2 || duration != 2500000 {
			t.Fatalf("wrong final: %d %d", outcome, duration)
		}
		if err = s.db.QueryRow(`SELECT COUNT(*) FROM race_participant WHERE race_id=? AND account_id=?`, mode, id).Scan(&count); err != nil || count != 2 {
			t.Fatalf("same account seats: %d %v", count, err)
		}
		var hp int
		var progress float64
		if err = s.db.QueryRow(`SELECT hp,progress FROM `+map[string]string{"drag-race": "drag_race_result", "road-rage": "road_rage_result"}[mode]+` WHERE race_id=? AND seat=0`, mode).Scan(&hp, &progress); err != nil || hp != 2 || progress != 42 {
			t.Fatalf("results: %d %g %v", hp, progress, err)
		}
	}
}

func TestRaceHistoryRecoversInterruptedRoundsWithoutInventingStats(t *testing.T) {
	path := filepath.Join(t.TempDir(), "history.sqlite")
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.StartRace("interrupted", "road-rage", time.Unix(100, 0), [2]int64{}); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = s.RecoverRaces(time.Unix(200, 0)); err != nil {
		t.Fatal(err)
	}
	if err = s.RecoverRaces(time.Unix(300, 0)); err != nil {
		t.Fatal(err)
	}
	var outcome int
	var reason string
	var ended int64
	var duration any
	if err = s.db.QueryRow(`SELECT outcome,end_reason,ended_at,duration_us FROM race_history WHERE id='interrupted'`).Scan(&outcome, &reason, &ended, &duration); err != nil {
		t.Fatal(err)
	}
	if outcome != 3 || reason != "server_restart" || ended != 200000000 || duration != nil {
		t.Fatalf("recovery fabricated final state: %d %s %d %v", outcome, reason, ended, duration)
	}
	var count int
	s.db.QueryRow(`SELECT COUNT(*) FROM road_rage_result`).Scan(&count)
	if count != 0 {
		t.Fatal("recovery fabricated car statistics")
	}
}

func TestRaceHistoryFinalTransactionRetriesWithoutPartialResults(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "history.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = s.StartRace("atomic", "drag-race", time.Unix(100, 0), [2]int64{}); err != nil {
		t.Fatal(err)
	}
	if _, err = s.db.Exec(`CREATE TRIGGER fail_result BEFORE INSERT ON drag_race_result WHEN NEW.seat=1 BEGIN SELECT RAISE(ABORT,'disk failure'); END`); err != nil {
		t.Fatal(err)
	}
	final := RaceFinal{DurationUs: 123, Outcome: 1, Reason: 3, Cars: [2]RaceCar{{HP: 1}, {HP: 2}}}
	if err = s.FinishRace("atomic", final); err == nil {
		t.Fatal("failure hidden")
	}
	var count int
	if err = s.db.QueryRow(`SELECT COUNT(*) FROM drag_race_result`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("partial results: %d %v", count, err)
	}
	if err = s.db.QueryRow(`SELECT COUNT(*) FROM race_history WHERE ended_at IS NOT NULL`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("partial final: %d %v", count, err)
	}
	s.db.Exec(`DROP TRIGGER fail_result`)
	if err = s.FinishRace("atomic", final); err != nil {
		t.Fatal(err)
	}
	if err = s.FinishRace("atomic", final); err != nil {
		t.Fatal(err)
	}
	s.db.QueryRow(`SELECT COUNT(*) FROM drag_race_result`).Scan(&count)
	if count != 2 {
		t.Fatalf("retry count: %d", count)
	}
}

func TestRaceHistoryAccountDeletionPreservesAnonymousResults(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "history.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = s.CreateTemporary("Driver", "password"); err != nil {
		t.Fatal(err)
	}
	users, _ := s.Users()
	id := users[0].ID
	if err = s.StartRace("deleted", "drag-race", time.Unix(100, 0), [2]int64{id, id}); err != nil {
		t.Fatal(err)
	}
	if err = s.DeleteManaged(id); err != nil {
		t.Fatal(err)
	}
	if err = s.FinishRace("deleted", RaceFinal{Outcome: 3}); err != nil {
		t.Fatal(err)
	}
	if err = s.StartRace("deleted", "drag-race", time.Unix(100, 0), [2]int64{id, id}); err != nil {
		t.Fatal(err)
	}
	var anonymous, results int
	s.db.QueryRow(`SELECT COUNT(*) FROM race_participant WHERE account_id IS NULL`).Scan(&anonymous)
	s.db.QueryRow(`SELECT COUNT(*) FROM drag_race_result`).Scan(&results)
	if anonymous != 2 || results != 2 {
		t.Fatalf("deletion removed results or kept identity: %d %d", anonymous, results)
	}
}

func TestPersonalRaceHistory(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "history.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	// Direct fixture identities avoid password hashing in read-model tests.
	_, err = s.db.Exec(`INSERT INTO accounts(id,username,password_hash) VALUES(1,'Driver',''),(2,'Opponent',''),(3,'Other','')`)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 23; i++ {
		id := fmt.Sprintf("race-%02d", i)
		if err = s.StartRace(id, "drag-race", time.Unix(int64(i), 0), [2]int64{1, 2}); err != nil {
			t.Fatal(err)
		}
		if err = s.FinishRace(id, RaceFinal{Outcome: p.OutcomeResult(i % 3)}); err != nil {
			t.Fatal(err)
		}
	}
	s.StartRace("active", "road-rage", time.Unix(100, 0), [2]int64{1, 2})
	s.StartRace("abandoned", "road-rage", time.Unix(101, 0), [2]int64{1, 2})
	s.FinishRace("abandoned", RaceFinal{Outcome: 3})
	first, err := s.RaceHistory(1, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Races) != 20 || !first.HasNext || first.Races[0].ID != "race-22" || first.Races[0].Result != "loss" || first.Races[0].Opponent != "Opponent" {
		t.Fatalf("first page: %+v", first)
	}
	last, err := s.RaceHistory(1, 1)
	if err != nil || len(last.Races) != 3 || last.HasNext {
		t.Fatalf("last page: %+v %v", last, err)
	}
	other, err := s.RaceHistory(3, 0)
	if err != nil || len(other.Races) != 0 {
		t.Fatalf("privacy: %+v %v", other, err)
	}
	opponent, err := s.RaceHistory(2, 0)
	if err != nil || opponent.Races[0].Result != "win" {
		t.Fatalf("seat result: %+v %v", opponent, err)
	}
	s.db.Exec(`UPDATE accounts SET username='Renamed' WHERE id=2`)
	renamed, _ := s.RaceHistory(1, 0)
	if renamed.Races[0].Opponent != "Renamed" {
		t.Fatal("name not current")
	}
	s.db.Exec(`DELETE FROM accounts WHERE id=2`)
	anonymous, _ := s.RaceHistory(1, 0)
	if anonymous.Races[0].Opponent != "Anonymous" {
		t.Fatal("deleted opponent not anonymous")
	}
	s.StartRace("self", "road-rage", time.Unix(200, 0), [2]int64{1, 1})
	s.FinishRace("self", RaceFinal{Outcome: 0})
	self, _ := s.RaceHistory(1, 0)
	if self.Races[0].Result != "win" || self.Races[1].Result != "loss" || self.Races[0].Seat == self.Races[1].Seat {
		t.Fatal("self-race lost seat identity")
	}
}
