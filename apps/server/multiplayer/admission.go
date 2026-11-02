package multiplayer

import (
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
	"github.com/shivang991/DashDevil2D/apps/server/configuration"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

type AdmissionError struct {
	Status int
	Code   p.ProtocolErrorCode
	Detail string
}

func (e *AdmissionError) Error() string { return e.Detail }
func admissionFailure(status int, code p.ProtocolErrorCode, detail string) (AdmissionResult, error) {
	return AdmissionResult{}, &AdmissionError{status, code, detail}
}

type AdmissionResult struct {
	Handle        Handle
	Identity      p.Identity
	Credential    []byte
	Code, Session string
}

func (s *Server) Admit(request p.AdmissionRequest, selectedMode string, account accounts.Session, accountChatID int64, challenge Invitation) (AdmissionResult, error) {
	credential, err := randomBytes()
	if err != nil {
		return admissionFailure(503, 2, "Unable to connect")
	}
	s.mu.Lock()
	if !s.config.Diagnostic && !s.config.Now().Before(account.Expires) {
		s.mu.Unlock()
		return admissionFailure(401, 2, "Session expired. Please log in again")
	}
	now := s.nowTime()
	changedRooms := s.expireLocked(now)
	defer func() {
		for _, r := range changedRooms {
			s.broadcast(r)
		}
	}()
	if challenge.ID != 0 {
		status, target := s.challengeStatusLocked(challenge)
		if status != "Pending" {
			s.mu.Unlock()
			return admissionFailure(409, p.ProtocolErrorCodeRoomUnavailable, "Challenge "+strings.ToLower(status))
		}
		for _, r := range s.rooms {
			for _, seat := range r.seats {
				if seat != nil && seat.accountID == account.User.ID {
					detail := "Leave your current room before accepting"
					if r.phase == p.RoomPhaseCountdown || r.phase == p.RoomPhaseActive {
						detail = "Finish your game before accepting"
					}
					s.mu.Unlock()
					return admissionFailure(409, p.ProtocolErrorCodeRoomUnavailable, detail)
				}
			}
		}
		request.Code = target.code
	}
	var participant *seat
	switch request.Operation {
	case p.AdmissionOperationCreate, p.AdmissionOperationJoin:
		if s.draining {
			s.mu.Unlock()
			return admissionFailure(503, p.ProtocolErrorCodeMaintenance, maintenanceMessage)
		}
		if len(request.Credential) != 0 || len(request.Name) == 0 || len(request.Name) > 128 || !utf8.ValidString(request.Name) {
			s.mu.Unlock()
			return admissionFailure(400, p.ProtocolErrorCodeAdmissionRejected, "Invalid admission")
		}
		var r *room
		if request.Operation == p.AdmissionOperationCreate {
			if request.Code != "" {
				s.mu.Unlock()
				return admissionFailure(400, p.ProtocolErrorCodeAdmissionRejected, "Invalid room code")
			}
			if len(s.rooms) >= s.config.RoomLimit {
				s.config.Logger.Info("capacity_rejected", "rooms", len(s.rooms), "limit", s.config.RoomLimit)
				s.mu.Unlock()
				return admissionFailure(503, p.ProtocolErrorCodeCapacityUnavailable, "Server full. Try again later.")
			}
			n, e := s.config.CodeStart()
			if e != nil || n >= 10000 {
				s.mu.Unlock()
				return admissionFailure(503, p.ProtocolErrorCodeAdmissionRejected, "Unable to connect")
			}
			code := ""
			for i := 0; i < 10000; i++ {
				candidate := fmt.Sprintf("%04d", (int(n)+i)%10000)
				if s.rooms[candidate] == nil {
					code = candidate
					break
				}
			}
			if code == "" {
				s.mu.Unlock()
				return admissionFailure(503, p.ProtocolErrorCodeCapacityUnavailable, "No rooms available")
			}
			if s.nextID == p.CounterMax {
				s.mu.Unlock()
				return admissionFailure(503, p.ProtocolErrorCodeAdmissionRejected, "Identity exhausted")
			}
			s.nextID++
			r = &room{id: s.nextID, code: code, revision: 1, mode: p.ModeDragRace, idle: now.Add(15 * time.Minute)}
			mode := p.ModeDragRace
			if selectedMode == strconv.Itoa(int(p.ModeRoadRage)) {
				mode = p.ModeRoadRage
			} else if selectedMode != "" && selectedMode != strconv.Itoa(int(p.ModeDragRace)) {
				s.mu.Unlock()
				return admissionFailure(400, p.ProtocolErrorCodeAdmissionRejected, "Invalid mode")
			}
			r.mode = mode
			r.roundID = 1
			r.seed, err = newTrackSeed()
			if err != nil {
				s.mu.Unlock()
				return admissionFailure(503, p.ProtocolErrorCodeAdmissionRejected, "Unable to connect")
			}
			modeName := "drag-race"
			if mode == p.ModeRoadRage {
				modeName = "road-rage"
			}
			definition := []byte(p.DefaultConfigurationJSON)
			r.settings, err = configuration.Capture(definition, modeName, s.roundOverrides(mode))
			if err != nil {
				s.mu.Unlock()
				return admissionFailure(503, p.ProtocolErrorCodeAdmissionRejected, "Invalid configuration")
			}
			s.rooms[code] = r
		} else {
			if len(request.Code) != p.RoomCodeLength {
				s.mu.Unlock()
				return admissionFailure(400, p.ProtocolErrorCodeAdmissionRejected, "Invalid room code")
			}
			for _, v := range request.Code {
				if v < '0' || v > '9' {
					s.mu.Unlock()
					return admissionFailure(400, p.ProtocolErrorCodeAdmissionRejected, "Invalid room code")
				}
			}
			r = s.rooms[request.Code]
			if r == nil {
				s.mu.Unlock()
				return admissionFailure(404, p.ProtocolErrorCodeRoomNotFound, "Room not found")
			}
		}
		if r.phase == p.RoomPhaseCountdown || r.phase == p.RoomPhaseActive {
			s.mu.Unlock()
			return admissionFailure(409, p.ProtocolErrorCodeRoomUnavailable, "Round in progress")
		}
		index := p.SeatIndexPlayer1
		if r.seats[0] != nil {
			index = p.SeatIndexPlayer2
		}
		if r.seats[index] != nil {
			s.mu.Unlock()
			return admissionFailure(409, p.ProtocolErrorCodeRoomUnavailable, "Room full")
		}
		if s.nextID == p.CounterMax {
			s.mu.Unlock()
			return admissionFailure(503, p.ProtocolErrorCodeAdmissionRejected, "Identity exhausted")
		}
		s.nextID++
		participant = &seat{room: r, index: index, session: s.nextID, name: request.Name, focused: true, credential: credential, deadline: now.Add(roomDuration(r, "reconnectGrace"))}
		participant.accountSession, participant.accountID, participant.accountExpires = account.ID, account.User.ID, account.Expires
		participant.accountChatID = accountChatID
		participant.avatar = account.Avatar
		participant.savedName, participant.savedAvatar = request.Name, account.Avatar
		if r.phase == p.RoomPhaseEnded {
			r.phase = p.RoomPhaseLobby
		}
		for _, other := range r.seats {
			if other != nil {
				other.ready = false
			}
		}
		r.seats[index] = participant
		r.invitationEpoch++
		r.idle = now.Add(roomDuration(r, "idleExpiry"))
		s.credentials[token(credential)] = participant
	case p.AdmissionOperationResume:
		if len(request.Credential) != 32 {
			s.mu.Unlock()
			return admissionFailure(403, p.ProtocolErrorCodeAdmissionRejected, "Admission rejected")
		}
		participant = s.credentials[token(request.Credential)]
		if participant == nil || (!s.config.Diagnostic && participant.accountSession != account.ID) || !participant.leaving.IsZero() || (!participant.deadline.IsZero() && !now.Before(participant.deadline)) {
			s.mu.Unlock()
			return admissionFailure(410, p.ProtocolErrorCodeRoomExpired, "Room expired")
		}
		// Reconnection cannot overtake a departure while the durable start
		// barrier is pending and lifecycle resolution is suspended.
		if participant.room.historyStarting {
			s.mu.Unlock()
			return admissionFailure(503, p.ProtocolErrorCodeAdmissionRejected, "Round is starting. Try again")
		}
	default:
		s.mu.Unlock()
		return admissionFailure(400, p.ProtocolErrorCodeAdmissionRejected, "Invalid admission")
	}
	if participant.generation == p.CounterMax || participant.inputGeneration == p.CounterMax {
		s.mu.Unlock()
		return admissionFailure(409, p.ProtocolErrorCodeAdmissionRejected, "Connection generation exhausted")
	}
	old := participant.connection
	// Ticket issuance alone cannot extend an existing disconnected reservation.
	if participant.deadline.IsZero() {
		participant.deadline = now.Add(roomDuration(participant.room, "reconnectGrace"))
	}
	s.cancelCountdownLocked(participant.room)
	participant.connected = false
	participant.ready = false
	for _, other := range participant.room.seats {
		if other != nil {
			other.ready = false
		}
	}
	participant.generation++
	participant.inputGeneration++
	connection := newConnection(s, participant)
	participant.connection = connection
	if r := participant.room; r.phase == p.RoomPhaseActive && r.engine != nil {
		r.engine.ResetSeat(connection.identity, participant.inputGeneration, 0)
		r.primed[participant.index] = false
		r.zero.Cars = r.engine.Snapshot().Cars
	}
	code := participant.room.code
	s.mu.Unlock()
	if old != nil {
		old.close("replaced")
	}
	s.broadcast(participant.room)
	return AdmissionResult{Handle: Handle{connection}, Identity: connection.identity, Credential: append([]byte(nil), participant.credential...), Code: code, Session: participant.accountSession}, nil
}
