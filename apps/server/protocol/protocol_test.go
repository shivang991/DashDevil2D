package protocol

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

type fixture struct {
	Name, Type, Hex string
	Value           json.RawMessage
}
type suite struct {
	SemanticInvalid []struct {
		Name  string
		Value Baseline
	}
	Resources []struct {
		Name     string
		Context  Context
		Expected Resources
	}
	Version      int
	Records      []fixture
	Malformed    []fixture
	Quantization []struct {
		Value    float64
		Expected int64
	}
	CRC []struct {
		Hex      string
		Expected uint32
	}
	Projection struct {
		Hex string
		CRC uint32
	}
}

func fixtures(t *testing.T) suite {
	t.Helper()
	b, e := os.ReadFile("../../../packages/contracts/protocol/fixtures.json")
	if e != nil {
		t.Fatal(e)
	}
	var s suite
	if e = json.Unmarshal(b, &s); e != nil {
		t.Fatal(e)
	}
	return s
}
func unhex(t *testing.T, s string) []byte {
	t.Helper()
	b, e := hex.DecodeString(s)
	if e != nil {
		t.Fatal(e)
	}
	return b
}
func TestSharedWire(t *testing.T) {
	s := fixtures(t)
	for _, f := range s.Records {
		t.Run(f.Name, func(t *testing.T) {
			wire := unhex(t, f.Hex)
			var v any
			var encoded []byte
			var e error
			switch f.Type {
			case "Baseline":
				var b Baseline
				e = json.Unmarshal(f.Value, &b)
				if e == nil {
					encoded, e = EncodeBaseline(b, 1048576)
				}
				v, e = DecodeBaseline(wire, 1048576)
			case "Verification":
				var b Verification
				e = json.Unmarshal(f.Value, &b)
				if e == nil {
					encoded, e = EncodeVerification(b, 10)
				}
				v, e = DecodeVerification(wire, 10)
			default:
				v, e = DecodeMessage(wire, 65536)
				if e == nil {
					encoded, e = EncodeMessage(v, 65536)
				}
			}
			if e != nil {
				t.Fatal(e)
			}
			if !bytes.Equal(encoded, wire) {
				t.Fatal("wire bytes differ")
			}
			result, e := json.Marshal(v)
			if e != nil {
				t.Fatal(e)
			}
			var actual, expected any
			if e = json.Unmarshal(result, &actual); e != nil {
				t.Fatal(e)
			}
			if e = json.Unmarshal(f.Value, &expected); e != nil {
				t.Fatal(e)
			}
			if !reflect.DeepEqual(actual, expected) {
				t.Fatalf("decoded value differs:\n%s\n%s", result, f.Value)
			}
		})
	}
	for _, f := range s.Malformed {
		t.Run(f.Name, func(t *testing.T) {
			var e error
			wire := unhex(t, f.Hex)
			switch f.Type {
			case "Car":
				_, e = DecodeCar(wire, 1048576)
			case "ClockRequest":
				_, e = DecodeClockRequest(wire, 1048576)
			case "ProtocolError":
				_, e = DecodeProtocolError(wire, 1048576)
			case "ObjectState":
				_, e = DecodeObjectState(wire, 1048576)
			case "Window":
				_, e = DecodeWindow(wire, 1048576)
			default:
				_, e = DecodeMessage(wire, 65536)
			}
			if e == nil {
				t.Fatal("accepted malformed record")
			}
		})
	}
	for _, v := range s.Quantization {
		q, e := Quantize(v.Value)
		if e != nil || q != v.Expected {
			t.Fatalf("quantize %v: %v %v", v.Value, q, e)
		}
	}
	for _, v := range s.CRC {
		if CRC32C(unhex(t, v.Hex)) != v.Expected {
			t.Fatal("CRC vector")
		}
	}
	b := baselineFixture(t)
	p, e := ProjectBaseline(b)
	if e != nil {
		t.Fatal(e)
	}
	if hex.EncodeToString(p) != s.Projection.Hex || CRC32C(p) != s.Projection.CRC {
		t.Fatal("projection bytes/CRC")
	}
	for _, n := range []int{0, 9, 11} {
		if _, e = DecodeVerification(make([]byte, n), 10); e == nil {
			t.Fatal("wrong datagram length")
		}
	}
}
func baselineFixture(t *testing.T) Baseline {
	t.Helper()
	for _, f := range fixtures(t).Records {
		if f.Type == "Baseline" {
			var b Baseline
			if e := json.Unmarshal(f.Value, &b); e != nil {
				t.Fatal(e)
			}
			return b
		}
	}
	t.Fatal("missing baseline")
	return Baseline{}
}
func TestFrames(t *testing.T) {
	s := fixtures(t)
	a := unhex(t, s.Records[0].Hex)
	b := unhex(t, s.Records[1].Hex)
	joined := append(append([]byte{}, a...), b...)
	r := FrameReader{Limit: 65536}
	for _, part := range [][]byte{joined[:2], joined[2:6]} {
		frames, e := r.Push(part)
		if e != nil || len(frames) != 0 {
			t.Fatal("partial frames", e)
		}
	}
	frames, e := r.Push(joined[6:])
	if e != nil || len(frames) != 2 || !bytes.Equal(frames[0], a) || !bytes.Equal(frames[1], b) {
		t.Fatal("coalesced frames", e)
	}
	if e = r.Finish(); e != nil {
		t.Fatal(e)
	}
	r = FrameReader{Limit: 65536}
	if _, e = r.Push(unhex(t, "ffffffff")); e == nil {
		t.Fatal("unbounded advertised allocation")
	}
	r = FrameReader{Limit: 65536}
	r.Push(a[:5])
	if r.Finish() == nil {
		t.Fatal("incomplete frame")
	}
}
func TestContinuationAndResources(t *testing.T) {
	b := baselineFixture(t)
	if e := ValidateBaseline(b, b.Context); e != nil {
		t.Fatal(e)
	}
	size, e := ConfigurationResources(b.Context)
	if e != nil {
		t.Fatal(e)
	}
	if size.Objects <= 4 || size.BaselineBytes <= 1000 || size.ChunkBytes > 65536 {
		t.Fatal("incomplete size", size)
	}
	context := b.Context
	context.Connection.BaselineBytes = 512
	if _, e = ConfigurationResources(context); e == nil {
		t.Fatal("accepted undersized baseline")
	}
	context = b.Context
	context.Connection.ReliableFrameBytes = 32
	if _, e = ConfigurationResources(context); e == nil {
		t.Fatal("accepted impossible chunks")
	}
	wrong := b
	wrong.Cars[1].Effective = 3
	if ValidateBaseline(wrong, b.Context) == nil {
		t.Fatal("return NOS")
	}
	wrong = b
	wrong.Windows = append([]Window{}, b.Windows...)
	wrong.Windows[0].End = 500
	if ValidateBaseline(wrong, b.Context) == nil {
		t.Fatal("coverage")
	}
	context = b.Context
	context.Seed = 2
	if ValidateBaseline(b, context) == nil {
		t.Fatal("context mismatch")
	}
	if ValidateVersion(1) == nil {
		t.Fatal("version mismatch")
	}
	if _, e = NextCounter(65535, 16); e == nil {
		t.Fatal("epoch wrap")
	}
	if _, e = NextCounter(0xffffffff, 32); e == nil {
		t.Fatal("sequence wrap")
	}
}
func TestAtomicTransfer(t *testing.T) {
	b := baselineFixture(t)
	data, e := EncodeBaseline(b, 1048576)
	if e != nil {
		t.Fatal(e)
	}
	header := BaselineChunk{Identity: b.Identity, Round: b.Round, TransferId: 1, Epoch: b.Epoch, Tick: b.Tick, Progress: b.Progress, Total: uint32(len(data)), Count: 2}
	transfer := BaselineTransfer{Context: b.Context, Limit: 1048576}
	first := header
	first.Index = 1
	first.Offset = 100
	first.Data = data[100:]
	result, e := transfer.Accept(first)
	if e != nil || result != nil {
		t.Fatal("premature installation", e)
	}
	second := header
	second.Data = data[:100]
	result, e = transfer.Accept(second)
	if e != nil || result == nil || !reflect.DeepEqual(*result, b) {
		t.Fatal("atomic install", e)
	}
	transfer = BaselineTransfer{Context: b.Context, Limit: 1048576}
	transfer.Accept(second)
	first.Offset = 99
	if _, e = transfer.Accept(first); e == nil {
		t.Fatal("overlap")
	}
	first.Offset = 100
	first.TransferId = 2
	if _, e = transfer.Accept(first); e == nil {
		t.Fatal("identity inconsistency")
	}
	transfer.Cancel()
	if _, e = transfer.Accept(first); e == nil {
		t.Fatal("terminal cancellation")
	}
	transfer = BaselineTransfer{Context: b.Context, Limit: 512}
	if _, e = transfer.Accept(second); e == nil {
		t.Fatal("unbounded allocation")
	}
}
func TestMessageSemantics(t *testing.T) {
	b := baselineFixture(t)
	for _, f := range fixtures(t).Records {
		if f.Type == "Baseline" || f.Type == "Verification" || f.Name == "version-mismatch" {
			continue
		}
		v, e := DecodeMessage(unhex(t, f.Hex), 65536)
		if e != nil {
			t.Fatal(e)
		}
		version := reflect.ValueOf(v).FieldByName("Version")
		if version.IsValid() && uint16(version.Uint()) != ProtocolVersion {
			if ValidateMessage(v, b.Context) == nil {
				t.Fatalf("historical version accepted: %s", f.Name)
			}
			continue
		}
		if e = ValidateMessage(v, b.Context); e != nil {
			t.Fatalf("%s: %v", f.Name, e)
		}
	}
	if ValidateMessage(Handshake{Version: 1, Identity: b.Identity, DatagramBytes: 10}, b.Context) == nil {
		t.Fatal("version")
	}
	if ValidateMessage(Handshake{Version: ProtocolVersion, Identity: b.Identity, DatagramBytes: 9}, b.Context) == nil {
		t.Fatal("capacity")
	}
	if ValidateMessage(Input{Identity: b.Identity, Round: b.Round, Control: 3}, b.Context) == nil {
		t.Fatal("zero sequence")
	}
}

func TestSharedResourceVectors(t *testing.T) {
	for _, scenario := range fixtures(t).Resources {
		t.Run(scenario.Name, func(t *testing.T) {
			actual, e := ConfigurationResources(scenario.Context)
			if e != nil {
				t.Fatal(e)
			}
			if actual != scenario.Expected {
				t.Fatalf("resources differ: %+v want %+v", actual, scenario.Expected)
			}
		})
	}
}

func TestInvalidContinuation(t *testing.T) {
	for _, scenario := range fixtures(t).SemanticInvalid {
		t.Run(scenario.Name, func(t *testing.T) {
			if ValidateBaseline(scenario.Value, scenario.Value.Context) == nil {
				t.Fatal("impossible movement continuation accepted")
			}
		})
	}
}
