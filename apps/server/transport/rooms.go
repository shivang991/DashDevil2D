package transport

import (
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/simulation"
	"github.com/shivang991/DashDevil2D/apps/server/track"
	"math"
)

// Called only under the room owner mutex. Countdown never calls AdvanceTo.
func (s *Server) prepareRoundLocked(r *room) error {
	var ids [2]p.Identity
	for i, seat := range r.seats {
		ids[i] = p.Identity{RoomId: r.id, SeatSession: 1, PairGeneration: 1, Seat: uint8(i)}
		if seat != nil {
			ids[i] = seat.pair.identity
		}
	}
	engine, err := simulation.New(r.settings, r.seed, ids, r.roundID)
	if err != nil {
		return err
	}
	state := engine.Snapshot()
	context := r.settings.Context(r.seed)
	context.StartUs = r.startUs
	b := p.Baseline{Round: p.Round{RoundId: r.roundID, InputGeneration: r.roundID}, Epoch: 1, Context: context, Cars: state.Cars}
	for i := range b.Cars {
		b.Cars[i].InputGeneration = 1
		if r.seats[i] != nil {
			b.Cars[i].InputGeneration = r.seats[i].inputGeneration
		}
	}
	g := context.Gameplay
	extent := (g.CarHeight + math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize))) / 2
	end := g.MaxRoadSpeed*g.AccelSpeedMultiplier + extent + g.SliceSpacing
	// Both cars start abreast: one complete shared window, no duplicate objects.
	window := p.Window{Start: -extent, End: end, Objects: []p.ObjectState{}}
	placements, err := track.NewMultiplayer(context)
	if err != nil {
		return err
	}
	if err = placements.EnsureThrough(end); err != nil {
		return err
	}
	placement := placements.Snapshot()
	for _, slice := range placement.Slices {
		if window.FirstSlice == 0 {
			window.FirstSlice = uint32(slice.ID)
		}
		window.LastSlice = uint32(slice.ID)
		for lane, kind := range slice.Cells {
			flag := uint8(0)
			switch kind {
			case "coin":
				flag = 1
			case "obstacle":
				flag = 2
			case "heart":
				flag = 3
			}
			if flag != 0 {
				window.Objects = append(window.Objects, p.ObjectState{Id: uint32(len(window.Objects) + 1), SliceId: uint32(slice.ID), Lane: uint8(lane), Flags: flag, Distance: slice.Distance})
			}
		}
	}
	b.Generator = p.Generator{RandomState: placement.RandomState, NextSlice: uint32(placement.NextID), NextObject: uint32(len(window.Objects) + 1), Cursor: placement.Through, ReservedCursor: uint32(placement.HeartIndex)}
	b.Windows = []p.Window{window}
	r.zero = &b
	return nil
}
func (s *Server) cancelCountdownLocked(r *room) {
	if r.phase != 1 {
		return
	}
	r.phase = 0
	r.startUs = 0
	r.zero = nil
	r.revision++
	for _, seat := range r.seats {
		if seat != nil {
			seat.ready = false
			seat.installedRound = 0
		}
	}
}
func (s *Server) advanceCountdownsLocked() []*room {
	var changed []*room
	for _, r := range s.rooms {
		if r.phase != 1 || s.nowUs() < r.startUs {
			continue
		}
		valid := true
		for _, seat := range r.seats {
			if seat == nil || !seat.connected || seat.installedRound != r.roundID {
				valid = false
			}
		}
		if valid {
			r.phase = 2
			r.revision++
		} else {
			s.cancelCountdownLocked(r)
		}
		changed = append(changed, r)
	}
	return changed
}
func (pair *pair) roomBaseline() (p.Baseline, error) {
	s := pair.server
	s.mu.Lock()
	defer s.mu.Unlock()
	r := pair.seat.room
	if r.zero == nil || r.zero.Context.Mode != r.mode {
		if err := s.prepareRoundLocked(r); err != nil {
			return p.Baseline{}, err
		}
	}
	b := *r.zero
	b.Identity = pair.identity
	for i, seat := range r.seats {
		if seat != nil {
			b.Cars[i].InputGeneration = seat.inputGeneration
		}
	}
	b.Round.InputGeneration = b.Cars[pair.identity.Seat].InputGeneration
	return b, p.ValidateBaseline(b, b.Context)
}
