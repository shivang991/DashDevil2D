package accounts

import (
	"database/sql"
	"errors"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"time"
)

const historySchema = `
 CREATE TABLE IF NOT EXISTS race_history(
 id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('drag-race','road-rage')),
 started_at INTEGER NOT NULL, ended_at INTEGER, duration_us INTEGER,
 outcome INTEGER, end_reason TEXT);
 CREATE TABLE IF NOT EXISTS race_participant(
 race_id TEXT NOT NULL REFERENCES race_history(id), seat INTEGER NOT NULL CHECK(seat IN (0,1)),
 account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
 PRIMARY KEY(race_id,seat));
 CREATE INDEX IF NOT EXISTS participant_account ON race_participant(account_id);
 CREATE TABLE IF NOT EXISTS drag_race_result(
 race_id TEXT NOT NULL, seat INTEGER NOT NULL, hp INTEGER NOT NULL, score INTEGER NOT NULL, progress REAL NOT NULL,
 PRIMARY KEY(race_id,seat), FOREIGN KEY(race_id,seat) REFERENCES race_participant(race_id,seat));
 CREATE TABLE IF NOT EXISTS road_rage_result(
 race_id TEXT NOT NULL, seat INTEGER NOT NULL, hp INTEGER NOT NULL, score INTEGER NOT NULL, progress REAL NOT NULL,
 PRIMARY KEY(race_id,seat), FOREIGN KEY(race_id,seat) REFERENCES race_participant(race_id,seat));`

// No identifying snapshots or replay data are retained. Seat, not account, is
// participant identity: two sessions of one account can race each other.
type RaceCar struct {
	HP       uint32
	Score    uint32
	Progress float64
}
type RaceFinal struct {
	DurationUs uint64
	Outcome    p.OutcomeResult
	Reason     p.OutcomeReason
	Cars       [2]RaceCar
}

// StartRace is the durable start barrier. Retrying the same ID is harmless.
// Missing/deleted accounts remain anonymous, including deletion racing a retry.
func (s *Store) StartRace(id, mode string, at time.Time, accounts [2]int64) error {
	if id == "" {
		return errors.New("race ID required")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.Exec(`INSERT INTO race_history(id,mode,started_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING`, id, mode, at.UnixMicro())
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return tx.Commit()
	}
	for seat, account := range accounts {
		if _, err = tx.Exec(`INSERT INTO race_participant(race_id,seat,account_id) VALUES(?,?,(SELECT id FROM accounts WHERE id=?))`, id, seat, account); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// FinishRace commits both mode results and the terminal outcome together.
// First terminal result wins, even after an ambiguous commit and retry.
func (s *Store) FinishRace(id string, final RaceFinal) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var mode string
	var ended sql.NullInt64
	if err = tx.QueryRow(`SELECT mode,ended_at FROM race_history WHERE id=?`, id).Scan(&mode, &ended); err != nil {
		return err
	}
	if ended.Valid {
		return tx.Commit()
	}
	table := "drag_race_result"
	if mode == "road-rage" {
		table = "road_rage_result"
	}
	for seat, car := range final.Cars {
		if _, err = tx.Exec(`INSERT INTO `+table+`(race_id,seat,hp,score,progress) VALUES(?,?,?,?,?)`, id, seat, car.HP, car.Score, car.Progress); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(`UPDATE race_history SET ended_at=started_at+?,duration_us=?,outcome=?,end_reason=? WHERE id=?`, final.DurationUs, final.DurationUs, final.Outcome, final.Reason, id); err != nil {
		return err
	}
	return tx.Commit()
}

// RecoverRaces runs before accepting rooms, once per room-owner startup.
// A crash gives no authoritative terminal instant or final car statistics.
// ended_at records recovery time; duration and mode results stay unknown.
func (s *Store) RecoverRaces(at time.Time) error {
	_, err := s.db.Exec(`UPDATE race_history SET ended_at=MAX(started_at,?),outcome=?,end_reason='server_restart' WHERE ended_at IS NULL`, at.UnixMicro(), p.OutcomeResultAbandoned)
	return err
}
