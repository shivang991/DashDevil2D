package transport

import (
	"testing"
	"time"

	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
)

func finalizedRoomForReturn() (*Server, *room, [2]*pair) {
	now := time.Now()
	s := &Server{config: Config{Now: func() time.Time { return now }}, start: now}
	r := &room{phase: 3, revision: 1, roundID: 1, idle: now.Add(time.Minute)}
	var pairs [2]*pair
	for i := range pairs {
		participant := &seat{room: r, index: uint8(i), connected: true}
		identity := p.Identity{RoomId: 1, SeatSession: uint32(i + 1), PairGeneration: 1, Seat: uint8(i)}
		pairs[i] = &pair{server: s, seat: participant, identity: identity}
		participant.pair = pairs[i]
		r.seats[i] = participant
	}
	return s, r, pairs
}

func TestReturnToLobbyWaitsForBothSeats(t *testing.T) {
	_, r, pairs := finalizedRoomForReturn()
	if err := pairs[0].roomCommand(p.RoomCommand{Identity: pairs[0].identity, Sequence: 1, Revision: 1, Command: 5}); err != nil {
		t.Fatal(err)
	}
	if r.phase != 3 || !r.seats[0].returned || r.seats[1].returned {
		t.Fatal("first return must not dismiss the other seat's result")
	}
	if err := pairs[1].roomCommand(p.RoomCommand{Identity: pairs[1].identity, Sequence: 1, Revision: 2, Command: 5}); err != nil {
		t.Fatal(err)
	}
	if r.phase != 0 || !r.seats[1].returned {
		t.Fatal("both returned seats must enter the lobby")
	}
}

func TestReturnedSeatCanUseLobbyAfterOtherLeaves(t *testing.T) {
	s, r, pairs := finalizedRoomForReturn()
	if err := pairs[0].roomCommand(p.RoomCommand{Identity: pairs[0].identity, Sequence: 1, Revision: 1, Command: 5}); err != nil {
		t.Fatal(err)
	}
	s.removeSeatLocked(r, 1)
	if r.phase != 0 {
		t.Fatal("remaining returned seat must regain the lobby")
	}
}
