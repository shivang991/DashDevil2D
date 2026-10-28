package protocol

import (
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"math"
	"reflect"
	"unicode/utf8"
)

type field struct {
	Name, Type             string
	Array, Max, Mask, Bits int
	Fixed, Projection      bool
}

const exactMax uint64 = 9007199254740991

func invalid(s string) error { return fmt.Errorf("invalid wire record: %s", s) }
func Quantize(v float64) (int64, error) {
	q := math.Floor(v*ProjectionScale + .5)
	if math.IsNaN(v) || math.IsInf(v, 0) || math.Abs(q) > float64(exactMax) {
		return 0, invalid("position projection overflow")
	}
	return int64(q), nil
}
func CRC32C(bytes []byte) uint32 { return crc32.Checksum(bytes, crc32.MakeTable(crc32.Castagnoli)) }
func encodeRecord(name string, value any, limit int, projection bool) ([]byte, error) {
	if limit < 0 || uint64(limit) > CounterMax {
		return nil, invalid("record limit")
	}
	out := make([]byte, 0, min(limit, 1024))
	appendBytes := func(b []byte) error {
		if len(b) > limit-len(out) {
			return invalid("record exceeds limit")
		}
		out = append(out, b...)
		return nil
	}
	put32 := func(n uint32) error { var b [4]byte; binary.BigEndian.PutUint32(b[:], n); return appendBytes(b[:]) }
	var record func(string, reflect.Value) error
	var scalar func(field, reflect.Value) error
	record = func(name string, v reflect.Value) error {
		fields, ok := layouts[name]
		if !ok {
			return invalid("unknown record")
		}
		for index := 0; index < len(fields); index++ {
			f := fields[index]
			if f.Bits > 0 {
				var packed uint64
				shift := 0
				for index < len(fields) && fields[index].Bits > 0 && shift+fields[index].Bits <= 8 {
					part := fields[index]
					n := v.FieldByName(part.Name).Uint()
					if n >= 1<<part.Bits || (part.Max > 0 && n > uint64(part.Max)) || (part.Mask > 0 && n&^uint64(part.Mask) != 0) {
						return invalid("packed enum or reserved bits")
					}
					packed |= n << shift
					shift += part.Bits
					index++
				}
				index--
				if e := appendBytes([]byte{byte(packed)}); e != nil {
					return e
				}
				continue
			}
			item := v.FieldByName(f.Name)
			if f.Array > 0 {
				if item.Len() > f.Array || (f.Fixed && item.Len() != f.Array) {
					return invalid("array count")
				}
				if !f.Fixed {
					if err := put32(uint32(item.Len())); err != nil {
						return err
					}
				}
				for i := 0; i < item.Len(); i++ {
					if err := scalar(f, item.Index(i)); err != nil {
						return err
					}
				}
			} else if err := scalar(f, item); err != nil {
				return err
			}
		}
		return nil
	}
	scalar = func(f field, v reflect.Value) error {
		var b [8]byte
		if f.Type == "bytes" || f.Type == "string" {
			var data []byte
			if f.Type == "string" {
				if !utf8.ValidString(v.String()) {
					return invalid("UTF-8")
				}
				data = []byte(v.String())
			} else {
				data = v.Bytes()
			}
			if len(data) > f.Max {
				return invalid("section exceeds bound")
			}
			if err := put32(uint32(len(data))); err != nil {
				return err
			}
			return appendBytes(data)
		}
		switch f.Type {
		case "u8", "u16", "u32", "us":
			n := v.Uint()
			if (f.Max > 0 && n > uint64(f.Max)) || (f.Mask > 0 && n&^uint64(f.Mask) != 0) {
				return invalid("enum or reserved bits")
			}
			switch f.Type {
			case "u8":
				b[0] = byte(n)
				return appendBytes(b[:1])
			case "u16":
				binary.BigEndian.PutUint16(b[:], uint16(n))
				return appendBytes(b[:2])
			case "u32":
				binary.BigEndian.PutUint32(b[:], uint32(n))
				return appendBytes(b[:4])
			default:
				if n > exactMax {
					return invalid("timestamp exceeds exact integer range")
				}
				binary.BigEndian.PutUint64(b[:], n)
				return appendBytes(b[:])
			}
		case "f64":
			n := v.Float()
			if math.IsNaN(n) || math.IsInf(n, 0) {
				return invalid("nonfinite number")
			}
			if projection && f.Projection {
				q, err := Quantize(n)
				if err != nil {
					return err
				}
				binary.BigEndian.PutUint64(b[:], uint64(q))
			} else {
				binary.BigEndian.PutUint64(b[:], math.Float64bits(n))
			}
			return appendBytes(b[:])
		default:
			return record(f.Type, v)
		}
	}
	if err := record(name, reflect.ValueOf(value)); err != nil {
		return nil, err
	}
	return out, nil
}
func decodeRecord(name string, bytes []byte, value any, limit int) error {
	if limit < 0 || len(bytes) > limit {
		return invalid("record exceeds limit")
	}
	at := 0
	take := func(n int) ([]byte, error) {
		if n > len(bytes)-at {
			return nil, invalid("truncated record")
		}
		b := bytes[at : at+n]
		at += n
		return b, nil
	}
	get32 := func() (uint32, error) {
		b, e := take(4)
		if e != nil {
			return 0, e
		}
		return binary.BigEndian.Uint32(b), nil
	}
	var record func(string, reflect.Value) error
	var scalar func(field, reflect.Value) error
	record = func(name string, v reflect.Value) error {
		fields, ok := layouts[name]
		if !ok {
			return invalid("unknown record")
		}
		for index := 0; index < len(fields); index++ {
			f := fields[index]
			if f.Bits > 0 {
				b, e := take(1)
				if e != nil {
					return e
				}
				packed := uint64(b[0])
				shift := 0
				for index < len(fields) && fields[index].Bits > 0 && shift+fields[index].Bits <= 8 {
					part := fields[index]
					n := (packed >> shift) & ((1 << part.Bits) - 1)
					if (part.Max > 0 && n > uint64(part.Max)) || (part.Mask > 0 && n&^uint64(part.Mask) != 0) {
						return invalid("packed enum")
					}
					v.FieldByName(part.Name).SetUint(n)
					shift += part.Bits
					index++
				}
				if packed>>shift != 0 {
					return invalid("reserved packed bits")
				}
				index--
				continue
			}
			item := v.FieldByName(f.Name)
			if f.Array > 0 {
				count := uint32(f.Array)
				if !f.Fixed {
					var err error
					count, err = get32()
					if err != nil {
						return err
					}
				}
				if uint64(count) > uint64(f.Array) || uint64(count) > uint64(len(bytes)-at) {
					return invalid("count exceeds bound")
				}
				if !f.Fixed {
					item.Set(reflect.MakeSlice(item.Type(), int(count), int(count)))
				}
				for i := 0; i < int(count); i++ {
					if err := scalar(f, item.Index(i)); err != nil {
						return err
					}
				}
			} else if err := scalar(f, item); err != nil {
				return err
			}
		}
		return nil
	}
	scalar = func(f field, v reflect.Value) error {
		if f.Type == "bytes" || f.Type == "string" {
			n, err := get32()
			if err != nil {
				return err
			}
			if uint64(n) > uint64(f.Max) {
				return invalid("section exceeds bound")
			}
			b, err := take(int(n))
			if err != nil {
				return err
			}
			if f.Type == "string" {
				if !utf8.Valid(b) {
					return invalid("UTF-8")
				}
				v.SetString(string(b))
			} else {
				v.SetBytes(append([]byte{}, b...))
			}
			return nil
		}
		width := 0
		switch f.Type {
		case "u8":
			width = 1
		case "u16":
			width = 2
		case "u32":
			width = 4
		case "us", "f64":
			width = 8
		default:
			return record(f.Type, v)
		}
		b, err := take(width)
		if err != nil {
			return err
		}
		if f.Type == "f64" {
			n := math.Float64frombits(binary.BigEndian.Uint64(b))
			if math.IsNaN(n) || math.IsInf(n, 0) {
				return invalid("nonfinite number")
			}
			v.SetFloat(n)
			return nil
		}
		var n uint64
		switch width {
		case 1:
			n = uint64(b[0])
		case 2:
			n = uint64(binary.BigEndian.Uint16(b))
		case 4:
			n = uint64(binary.BigEndian.Uint32(b))
		case 8:
			n = binary.BigEndian.Uint64(b)
		}
		if (f.Type == "us" && n > exactMax) || (f.Max > 0 && n > uint64(f.Max)) || (f.Mask > 0 && n&^uint64(f.Mask) != 0) {
			return invalid("integer, enum or reserved bits")
		}
		v.SetUint(n)
		return nil
	}
	if err := record(name, reflect.ValueOf(value).Elem()); err != nil {
		return err
	}
	if at != len(bytes) {
		return invalid("trailing bytes")
	}
	return nil
}
func encodeFrame(name string, id byte, value any, limit int) ([]byte, error) {
	if limit < 5 {
		return nil, invalid("frame limit")
	}
	body, err := encodeRecord(name, value, limit-5, false)
	if err != nil {
		return nil, err
	}
	out := make([]byte, len(body)+5)
	binary.BigEndian.PutUint32(out, uint32(len(body)+1))
	out[4] = id
	copy(out[5:], body)
	return out, nil
}
func frameBody(bytes []byte, limit int) ([]byte, error) {
	if len(bytes) < 5 || len(bytes) > limit {
		return nil, invalid("frame length")
	}
	if uint64(binary.BigEndian.Uint32(bytes)) != uint64(len(bytes)-4) {
		return nil, invalid("body length")
	}
	return bytes[4:], nil
}

// FrameReader bounds an advertised frame before allocating its body.
type FrameReader struct {
	Limit  int
	prefix []byte
	body   []byte
	used   int
}

func (r *FrameReader) Push(part []byte) ([][]byte, error) {
	if r.Limit < 5 || uint64(r.Limit) > CounterMax {
		return nil, invalid("frame limit")
	}
	var result [][]byte
	for len(part) > 0 {
		if r.body == nil {
			n := min(4-len(r.prefix), len(part))
			r.prefix = append(r.prefix, part[:n]...)
			part = part[n:]
			if len(r.prefix) < 4 {
				break
			}
			size := binary.BigEndian.Uint32(r.prefix)
			if size < 1 || uint64(size) > uint64(r.Limit-4) {
				return nil, invalid("advertised length exceeds bound")
			}
			r.body = make([]byte, int(size)+4)
			copy(r.body, r.prefix)
			r.used = 4
		}
		n := min(len(part), len(r.body)-r.used)
		copy(r.body[r.used:], part[:n])
		r.used += n
		part = part[n:]
		if r.used == len(r.body) {
			result = append(result, r.body)
			r.body = nil
			r.prefix = nil
			r.used = 0
		}
	}
	return result, nil
}
func (r *FrameReader) Finish() error {
	if len(r.prefix) > 0 || r.body != nil {
		return invalid("incomplete stream frame")
	}
	return nil
}
