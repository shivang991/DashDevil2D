package protocol

import "reflect"

type piece struct{ start, end uint32 }
type BaselineTransfer struct {
	Context             Context
	Limit               int
	metadata            *BaselineChunk
	data                []byte
	pieces              map[uint32]piece
	received            int
	canceled, installed bool
}

func (t *BaselineTransfer) Accept(chunk BaselineChunk) (*Baseline, error) {
	if t.Limit <= 0 || t.Limit > 1048576 || t.canceled || t.installed {
		return nil, invalid("transfer inactive/limit")
	}
	if _, e := EncodeBaselineChunk(chunk, 1048576); e != nil {
		return nil, e
	}
	if chunk.TransferId == 0 || uint64(chunk.Total) > uint64(t.Limit) || chunk.Total == 0 || chunk.Count == 0 || chunk.Count > chunk.Total || chunk.Index >= chunk.Count || len(chunk.Data) == 0 || uint64(chunk.Offset)+uint64(len(chunk.Data)) > uint64(chunk.Total) {
		return nil, invalid("transfer bounds")
	}
	metadata := chunk
	metadata.Offset = 0
	metadata.Index = 0
	metadata.Data = nil
	if t.metadata != nil && !reflect.DeepEqual(*t.metadata, metadata) {
		return nil, invalid("inconsistent transfer metadata")
	}
	end := chunk.Offset + uint32(len(chunk.Data))
	if _, ok := t.pieces[chunk.Index]; ok {
		return nil, invalid("duplicate chunk")
	}
	for _, p := range t.pieces {
		if chunk.Offset < p.end && end > p.start {
			return nil, invalid("overlapping chunk")
		}
	}
	if t.data == nil {
		t.data = make([]byte, int(chunk.Total))
		t.metadata = &metadata
		t.pieces = map[uint32]piece{}
	}
	copy(t.data[chunk.Offset:], chunk.Data)
	t.pieces[chunk.Index] = piece{chunk.Offset, end}
	t.received += len(chunk.Data)
	if len(t.pieces) != int(chunk.Count) {
		return nil, nil
	}
	if t.received != int(chunk.Total) {
		return nil, invalid("incomplete baseline")
	}
	b, e := DecodeBaseline(t.data, t.Limit)
	if e != nil {
		return nil, e
	}
	if e = ValidateBaseline(b, t.Context); e != nil {
		return nil, e
	}
	if b.Identity != chunk.Identity || b.Round != chunk.Round || b.Epoch != chunk.Epoch || b.Tick != chunk.Tick || b.Progress != chunk.Progress {
		return nil, invalid("baseline/transfer watermark mismatch")
	}
	t.installed = true
	t.data = nil
	t.pieces = nil
	return &b, nil
}
func (t *BaselineTransfer) Cancel() { t.canceled = true; t.data = nil; t.pieces = nil }
