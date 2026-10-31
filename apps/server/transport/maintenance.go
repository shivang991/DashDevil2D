package transport

import (
	"errors"
	"time"
)

const maintenanceMessage = "Server maintenance. Try again later."

// MaintenanceStatus is an operator view, never served on the public listeners.
type MaintenanceStatus struct {
	Draining     bool   `json:"draining"`
	Complete     bool   `json:"complete"`
	ActiveRounds int    `json:"activeRounds"`
	DeadlineUs   uint64 `json:"deadlineUs"`
}

func (s *Server) Maintenance() MaintenanceStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	status := MaintenanceStatus{Draining: s.draining, Complete: s.drainComplete}
	if s.draining {
		status.DeadlineUs = uint64(s.drainDeadline.Sub(s.start).Microseconds())
	}
	for _, r := range s.rooms {
		if r.phase == 2 {
			status.ActiveRounds++
		}
	}
	return status
}

// BeginDrain is idempotent: repeated requests never extend the original deadline.
func (s *Server) BeginDrain(timeout time.Duration) error {
	if timeout < time.Millisecond || timeout%time.Microsecond != 0 {
		return errors.New("drain timeout must be at least 1ms with whole microsecond precision")
	}
	s.mu.Lock()
	if s.draining {
		s.mu.Unlock()
		return nil
	}
	s.draining = true
	s.drainDeadline = s.start.Add(time.Duration(s.nowUs())*time.Microsecond + timeout)
	var changed []*room
	for _, r := range s.rooms {
		if r.phase == 1 {
			s.cancelCountdownLocked(r)
			changed = append(changed, r)
		}
	}
	s.mu.Unlock()
	for _, r := range changed {
		s.broadcast(r)
	}
	s.config.Logger.Info("maintenance_started", "deadline", s.drainDeadline)
	return nil
}

// Runs under the room-owner mutex after gameplay and lifecycle events. Terminal
// outcomes remain immutable. Allow one application-progress window for delivery
// before invalidating all rooms and their credentials.
func (s *Server) advanceMaintenanceLocked(now time.Time) ([]*room, []*pair) {
	if !s.draining || s.drainComplete {
		return nil, nil
	}
	var changed []*room
	active := false
	for _, r := range s.rooms {
		if r.phase != 2 {
			continue
		}
		if now.Before(s.drainDeadline) {
			active = true
			continue
		}
		s.finalizeRaceLocked(r, 3, 7, r.zero.Tick, r.zero.TimeUs)
		changed = append(changed, r)
	}
	if active {
		return changed, nil
	}
	if s.drainClosing.IsZero() {
		s.drainClosing = now.Add(time.Second)
	}
	if now.Before(s.drainClosing) {
		return changed, nil
	}
	var pairs []*pair
	for _, r := range s.rooms {
		for _, seat := range r.seats {
			if seat != nil && seat.pair != nil {
				pairs = append(pairs, seat.pair)
			}
		}
	}
	s.rooms = map[string]*room{}
	s.cleanupAvatarsLocked()
	s.credentials = map[string]*seat{}
	s.tickets = map[string]ticket{}
	s.drainComplete = true
	s.config.Logger.Info("maintenance_complete", "closed_pairs", len(pairs))
	return changed, pairs
}

// privateReady reports both startup and maintenance eligibility to the operator.
func (s *Server) Ready() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	select {
	case <-s.stop:
		return false
	default:
	}
	return s.tcp != nil && s.udp != nil && !s.draining
}
