package transport

import (
	"strconv"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

// Immutable work survives room removal/rematches until its transaction succeeds.
// Only the persistence loop does I/O; gameplay merely appends under mu.
type historyWrite struct {
	room     *room
	id, mode string
	started  time.Time
	accounts [2]int64
	final    *accounts.RaceFinal
}

func (s *Server) startHistoryLocked(r *room) {
	if s.config.Accounts == nil || s.config.Diagnostic {
		return
	}
	// The random process prefix plus monotonic round counter survives restarts
	// without depending on reusable room codes or protocol IDs.
	s.historySequence++
	r.historyID = s.historyPrefix + "-" + strconv.FormatUint(s.historySequence, 10)
	r.historyStarting = true
	w := historyWrite{room: r, id: r.historyID, mode: "drag-race", started: s.start.Add(time.Duration(r.startUs) * time.Microsecond)}
	if r.mode == p.ModeRoadRage {
		w.mode = "road-rage"
	}
	for i, seat := range r.seats {
		w.accounts[i] = seat.accountID
	}
	s.historyWrites = append(s.historyWrites, w)
}

func (s *Server) finishHistoryLocked(r *room, outcome p.Outcome) {
	if r.historyID == "" {
		return
	}
	final := accounts.RaceFinal{DurationUs: outcome.TimeUs, Outcome: outcome.Result, Reason: outcome.Reason}
	for i, car := range outcome.Cars {
		final.Cars[i] = accounts.RaceCar{HP: car.Hp, Score: car.Score, Progress: car.Progress}
	}
	r.historyFinishing = true
	s.historyWrites = append(s.historyWrites, historyWrite{room: r, id: r.historyID, final: &final})
}

func (s *Server) flushHistory() bool {
	for {
		s.authMu.Lock()
		s.mu.Lock()
		if len(s.historyWrites) == 0 {
			s.mu.Unlock()
			s.authMu.Unlock()
			return true
		}
		w := s.historyWrites[0]
		s.mu.Unlock()
		var err error
		if w.final == nil {
			err = s.config.Accounts.StartRace(w.id, w.mode, w.started, w.accounts)
		} else {
			err = s.config.Accounts.FinishRace(w.id, *w.final)
		}
		s.mu.Lock()
		s.historyFailed = err != nil
		if err == nil {
			s.historyWrites[0] = historyWrite{}
			s.historyWrites = s.historyWrites[1:]
			if w.room.historyID == w.id {
				if w.final == nil {
					w.room.historyStarting = false
				} else {
					w.room.historyFinishing = false
				}
			}
		}
		s.mu.Unlock()
		s.authMu.Unlock()
		if err == nil && w.final == nil {
			s.broadcast(w.room)
		}
		if err != nil {
			s.config.Logger.Error("race_history_retry", "race", w.id, "error", err)
			return false
		}
	}
}

func (s *Server) historyLoop() {
	defer close(s.historyDone)
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			if !s.flushHistory() {
				// Avoid busy retries/logging while storage is unavailable.
				select {
				case <-s.stop:
					continue
				case <-time.After(time.Second):
				}
			}
		}
	}
}
