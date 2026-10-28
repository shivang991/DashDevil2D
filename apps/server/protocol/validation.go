package protocol

import (
	"math"
	"reflect"
)

func require(ok bool, reason string) error {
	if !ok {
		return invalid(reason)
	}
	return nil
}
func ValidateVersion(version uint16) error {
	return require(version == ProtocolVersion, "incompatible protocol version")
}
func NextCounter(value uint32, bits int) (uint32, error) {
	var max uint32 = math.MaxUint32
	if bits == 16 {
		max = math.MaxUint16
	} else if bits != 32 {
		return 0, invalid("counter width")
	}
	if value >= max {
		return 0, invalid("counter exhausted; renew context")
	}
	return value + 1, nil
}
func ValidateProgress(p Progress) error {
	return require(p.Disposed1 <= p.Processed1 && p.Disposed2 <= p.Processed2 && p.Event <= p.Authority, "inconsistent watermarks")
}
func ValidateCar(car Car, timeUs uint64, context Context) error {
	g := context.Gameplay
	if car.InputGeneration == 0 {
		return invalid("missing per-seat input generation")
	}
	if e := require(float64(car.Hp) <= g.MaxHealth && car.Score%10 == 0 && car.NormalSpeed >= g.StartingRoadSpeed && car.NormalSpeed <= g.MaxRoadSpeed, "invalid HP/score/speed"); e != nil {
		return e
	}
	if e := require(car.Progress >= 0 && math.Abs(car.Lateral) <= g.LaneSpacing, "car outside world"); e != nil {
		return e
	}
	if e := require(car.Phase == 0 || (car.MovementStartUs <= timeUs && timeUs <= car.MovementEndUs && car.MovementStartUs < car.MovementEndUs), "movement timing"); e != nil {
		return e
	}
	if e := require(car.Phase != 1 || math.Abs(float64(car.Departure)-float64(car.Target)) == 1, "nonadjacent shift"); e != nil {
		return e
	}

	if math.Abs(car.MovementOrigin) > g.LaneSpacing || math.Abs(car.MovementTarget) > g.LaneSpacing {
		return invalid("movement coordinates outside world")
	}
	if car.Phase == 1 && (car.MovementOrigin != (float64(car.Departure)-1)*g.LaneSpacing || car.MovementTarget != (float64(car.Target)-1)*g.LaneSpacing) {
		return invalid("shift destination/origin disagrees with lane")
	}
	if car.Phase == 2 && car.MovementTarget != (float64(car.Departure)-1)*g.LaneSpacing {
		return invalid("return destination disagrees with departure")
	}
	if e := require(car.Phase != 2 || (car.Effective != 3 && car.Flags&1 == 0), "return NOS"); e != nil {
		return e
	}
	if e := require(car.Controls == 0 || car.HeldMask&(1<<(car.Controls-1)) != 0, "winning control is not held"); e != nil {
		return e
	}
	if e := require(car.Effective == 0 || car.FreshnessUs > timeUs, "expired effective controls"); e != nil {
		return e
	}
	return require(car.Flags&1 == 0 || (car.HeldMask&4 != 0 && car.Effective != 0), "NOS requires held boost")
}
func ValidateWindow(w Window) error {
	if e := require(w.Start <= w.End && w.FirstSlice <= w.LastSlice, "window bounds"); e != nil {
		return e
	}
	var last uint32
	for _, o := range w.Objects {
		if e := require(o.Id > last && o.SliceId >= w.FirstSlice && o.SliceId <= w.LastSlice && o.Distance >= w.Start && o.Distance <= w.End, "object identity/order/coverage"); e != nil {
			return e
		}
		last = o.Id
		kind := o.Flags & 3
		if e := require(kind != 0 && ((kind == 2 && o.Flags&4 == 0) || (kind != 2 && o.Flags&24 == 0)), "consumption flags"); e != nil {
			return e
		}
	}
	return nil
}
func ValidateBaseline(b Baseline, context Context) error {
	if _, e := EncodeBaseline(b, 1048576); e != nil {
		return e
	}
	if _, e := ProjectBaseline(b); e != nil {
		return e
	}
	if e := ValidateProgress(b.Progress); e != nil {
		return e
	}
	if e := require(reflect.DeepEqual(b.Context, context), "immutable context mismatch"); e != nil {
		return e
	}
	if e := require(b.Context.ConfigurationVersion == 1 && b.Context.GenerationVersion == 1 && b.Context.Seed > 0 && b.Generator.RandomState > 0, "unsupported context/seed"); e != nil {
		return e
	}
	if e := require(b.Identity.RoomId > 0 && b.Identity.SeatSession > 0 && b.Identity.PairGeneration > 0 && b.Round.RoundId > 0 && b.Round.InputGeneration > 0 && b.Epoch > 0, "baseline identity"); e != nil {
		return e
	}
	if b.Cars[b.Identity.Seat].InputGeneration != b.Round.InputGeneration {
		return invalid("recipient input generation mismatch")
	}
	if b.Context.StartUs > exactMax-b.TimeUs {
		return invalid("round clock exceeds exact microseconds")
	}
	for _, car := range b.Cars {
		if e := ValidateCar(car, b.TimeUs, b.Context); e != nil {
			return e
		}
	}
	if e := require(b.Contact.LatestTimeUs <= b.TimeUs, "future qualifying input"); e != nil {
		return e
	}
	if e := require(b.Generator.NextSlice > 0 && b.Generator.NextObject > 0 && len(b.Windows) > 0, "generator/coverage"); e != nil {
		return e
	}
	ids := map[uint32]bool{}
	lastEnd := math.Inf(-1)
	for _, w := range b.Windows {
		if e := ValidateWindow(w); e != nil {
			return e
		}
		if e := require(w.Start > lastEnd, "overlapping/noncanonical windows"); e != nil {
			return e
		}
		lastEnd = w.End
		for _, o := range w.Objects {
			if e := require(!ids[o.Id] && o.Id < b.Generator.NextObject && o.SliceId < b.Generator.NextSlice, "duplicate/future object"); e != nil {
				return e
			}
			ids[o.Id] = true
		}
	}
	g := b.Context.Gameplay
	extent := (g.CarHeight + math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize))) / 2
	for _, car := range b.Cars {
		covered := false
		for _, w := range b.Windows {
			if w.Start <= car.Progress-extent && w.End >= car.Progress+g.MaxRoadSpeed*g.AccelSpeedMultiplier+extent+g.SliceSpacing {
				covered = true
			}
		}
		if !covered {
			return invalid("insufficient reachable coverage")
		}
	}
	return nil
}

type Resources struct {
	Objects, BaselineBytes, ChunkBytes, Chunks int
	WindowLength, MaxProgress                  float64
}

// Full semantic configuration capture parity belongs to #28. This checks actual wire resources
// for an already semantically validated context, using the same enclosure as TypeScript.
func ConfigurationResources(context Context) (Resources, error) {
	var result Resources
	if context.Mode == 0 {
		return result, nil
	}
	g := context.Gameplay
	c := context.Connection
	boosted := g.MaxRoadSpeed * g.AccelSpeedMultiplier
	extent := (g.CarHeight + math.Max(g.ObstacleH, math.Max(g.CoinSize, g.HeartSize))) / 2
	window := boosted + 2*extent + g.SliceSpacing
	random := math.Ceil(window/g.SliceSpacing) + 2
	reserved := 0.0
	if context.Mode == 1 {
		reserved = g.ReservedHearts
	}
	objects := 2*random + reserved
	progress := boosted * g.TimeLimit
	if context.Mode == 1 {
		progress = g.FinishDistance
	}
	for _, v := range []float64{progress + window, -extent, g.LaneSpacing + math.Max(g.CarWidth, math.Max(g.ObstacleW, math.Max(g.CoinSize, g.HeartSize)))/2} {
		if _, e := Quantize(v); e != nil {
			return result, e
		}
	}
	if math.IsNaN(objects) || math.IsInf(objects, 0) || objects != math.Trunc(objects) || objects < 0 || random+reserved > 40000 {
		return result, invalid("serialized baseline object count exceeds schema window bound")
	}
	if g.MaxHealth > math.MaxUint32 || g.ObstacleDamage > math.MaxUint32 || g.PlayerContactDamage > math.MaxUint32 {
		return result, invalid("HP/damage exceeds uint32")
	}
	duration := g.TimeLimit
	if context.Mode == 1 {
		duration = g.FinishDistance / g.StartingRoadSpeed
	}
	if math.IsNaN(duration) || math.IsInf(duration, 0) || math.Ceil(duration*g.TickRate) > math.MaxUint32 {
		return result, invalid("round tick counter would exhaust")
	}
	micros := math.Floor((duration+math.Max(math.Max(g.InvincibleDuration, g.LaneShiftDuration), math.Max(g.LaneReturnDuration, c.ControlFreshnessExpiry)))*1e6 + .5)
	if math.IsNaN(micros) || math.IsInf(micros, 0) || micros > float64(exactMax) {
		return result, invalid("round continuation timestamp exceeds exact microseconds")
	}
	slices := math.Ceil((progress+window)/g.SliceSpacing) + 2
	if slices+reserved >= math.MaxUint32 || 10*(slices+reserved) > math.MaxUint32 {
		return result, invalid("object identity/score exceeds uint32")
	}
	b := Baseline{Context: context}
	b.Windows = []Window{{}, {}}
	encoded, e := EncodeBaseline(b, 1048576)
	if e != nil {
		return result, e
	}
	base := len(encoded)
	objectBytes, e := EncodeObjectState(ObjectState{}, 1048576)
	if e != nil {
		return result, e
	}
	if float64(base)+objects*float64(len(objectBytes)) > math.Min(c.BaselineBytes, 1048576) {
		return result, invalid("serialized baseline exceeds assembled limit")
	}
	for i, count := range []int{int(random + reserved), int(random)} {
		b.Windows[i].Objects = make([]ObjectState, count)
	}
	encoded, e = EncodeBaseline(b, int(c.BaselineBytes))
	if e != nil {
		return result, e
	}
	header, e := EncodeMessage(BaselineChunk{}, 65536)
	if e != nil {
		return result, e
	}
	payload := int(math.Min(math.Min(c.ReliableFrameBytes, c.QueueBytes), 1048576)) - len(header)
	if payload <= 0 {
		return result, invalid("baseline chunk header leaves no payload in frame/queue")
	}
	if _, e := EncodeMessage(Initialization{Context: context}, int(c.ReliableFrameBytes)); e != nil {
		return result, invalid("initialization exceeds reliable frame limit")
	}
	chunks := (len(encoded) + payload - 1) / payload
	chunk := BaselineChunk{Data: make([]byte, min(len(encoded), payload))}
	frame, e := EncodeMessage(chunk, int(c.ReliableFrameBytes))
	if e != nil {
		return result, e
	}
	if _, e := EncodeMessage(Coverage{Windows: b.Windows}, int(c.ReliableFrameBytes)); e != nil {
		return result, invalid("coverage update exceeds reliable frame limit")
	}
	return Resources{int(objects), len(encoded), len(frame), chunks, window, progress}, nil
}

// ValidateMessage checks static record semantics after mechanical decoding.
// Stateful admission, ordered application and lifecycle decisions remain #28/#29.
func ValidateMessage(value any, context Context) error {
	if _, e := EncodeMessage(value, 65536); e != nil {
		return e
	}
	v := reflect.ValueOf(value)
	if f := v.FieldByName("Version"); f.IsValid() {
		if e := ValidateVersion(uint16(f.Uint())); e != nil {
			return e
		}
	}
	if f := v.FieldByName("Identity"); f.IsValid() {
		i := f.Interface().(Identity)
		if i.RoomId == 0 || i.SeatSession == 0 || i.PairGeneration == 0 {
			return invalid("message identity")
		}
	}
	if f := v.FieldByName("Round"); f.IsValid() {
		r := f.Interface().(Round)
		if r.RoundId == 0 || r.InputGeneration == 0 {
			return invalid("round/input generation")
		}
	}
	if f := v.FieldByName("Progress"); f.IsValid() {
		if e := ValidateProgress(f.Interface().(Progress)); e != nil {
			return e
		}
	}
	switch x := value.(type) {
	case Handshake:
		return require(x.DatagramBytes == 10, "required ten-byte datagram schema/capacity")
	case Admission:
		return require(len(x.Credential) == 32 && len(x.RoomTicket) > 0 && len(x.GameplayTicket) > 0 && len(x.Origin) > 0, "admission credential/tickets/origin")
	case AdmissionRequest:
		code := len(x.Code) == 4
		for _, r := range x.Code {
			if r < '0' || r > '9' {
				code = false
			}
		}
		if x.Operation != AdmissionOperationCreate && !code {
			return invalid("four-digit room code required")
		}
		return require(x.Operation != AdmissionOperationResume || len(x.Credential) == 32, "resume credential must be 256 bits")
	case Input:
		if x.Sequence == 0 || x.Intent == 0 && x.Control == 0 {
			return invalid("fresh input sequence/control")
		}
		return require(x.Intent != 2 || x.Control == 0 || x.HeldMask&(1<<(x.Control-1)) != 0, "refresh control must be held")
	case ClockReply:
		return require(x.ServerReceiveUs <= x.ServerSendUs, "clock reply reverses server time")
	case Disposition:
		if x.Sequence == 0 || x.Sequence > x.Processed {
			return invalid("disposition outside processed cutoff")
		}
		return ValidateCar(x.Car, x.TimeUs, context)
	case Event:
		for _, car := range x.Cars {
			if e := ValidateCar(car, x.TimeUs, context); e != nil {
				return e
			}
		}
	case Coverage:
		for _, window := range x.Windows {
			if e := ValidateWindow(window); e != nil {
				return e
			}
		}
	case Outcome:
		if x.RoundId == 0 || x.OutcomeId == 0 {
			return invalid("terminal identity")
		}
		for _, car := range x.Cars {
			if car.Progress < 0 || math.Abs(car.Lateral) > context.Gameplay.LaneSpacing || float64(car.Hp) > context.Gameplay.MaxHealth || car.Score%10 != 0 {
				return invalid("terminal player values")
			}
		}
	}
	return nil
}
