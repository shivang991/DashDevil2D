package multiplayer

import ()

func (s *Server) Start() error {
	if s.config.Accounts != nil && !s.config.Diagnostic {
		if err := s.config.Accounts.RecoverRaces(s.config.Now()); err != nil {
			return err
		}
	}
	s.chatDone = make(chan struct{})
	s.sweepDone = make(chan struct{})
	s.historyDone = make(chan struct{})
	go s.chatHistoryLoop()
	go s.historyLoop()
	go s.sweep()
	return nil
}
func (s *Server) Close() {
	s.closeOnce.Do(func() {
		close(s.stop)
		if s.chatDone != nil {
			<-s.chatDone
		}
		if s.historyDone != nil {
			<-s.historyDone
		}
		if s.sweepDone != nil {
			<-s.sweepDone
		}
		s.flushChatRounds()
		if !s.flushHistory() {
			s.config.Logger.Error("race_history_shutdown_pending")
		}
	})
}
func (s *Server) NowUs() uint64                  { return s.nowUs() }
func (s *Server) AvatarCleanup() <-chan struct{} { return s.avatarCleanup }
