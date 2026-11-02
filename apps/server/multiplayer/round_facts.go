package multiplayer

import (
	"fmt"
	"time"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

// Finalization queues value copies only. All persistence happens off the gameplay mutex.
func (s *Server) recordChatRoundLocked(r *room) {
	if s.config.Accounts == nil || r.outcome.Result == p.OutcomeResultAbandoned || r.seats[0] == nil || r.seats[1] == nil {
		return
	}
	s.chatRounds = append(s.chatRounds, accounts.SharedRound{Key: fmt.Sprintf("%s:%d:%d", s.chatRun, r.id, r.roundID), A: r.seats[0].accountChatID, B: r.seats[1].accountChatID, Finished: s.config.Now().UnixMilli()})
}
func (s *Server) flushChatRounds() {
	s.mu.Lock()
	pending := s.chatRounds
	s.chatRounds = nil
	s.mu.Unlock()
	for _, r := range pending {
		if err := s.config.Accounts.RecordChatRound(r); err != nil {
			s.config.Logger.Error("chat_history_write_failed", "error", err)
			s.mu.Lock()
			s.chatRounds = append(s.chatRounds, r)
			s.mu.Unlock()
		}
	}
}
func (s *Server) chatHistoryLoop() {
	defer close(s.chatDone)
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			s.flushChatRounds()
			return
		case <-ticker.C:
			s.flushChatRounds()
		}
	}
}
