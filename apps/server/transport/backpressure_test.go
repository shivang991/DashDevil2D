package transport

import (
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"testing"
	"testing/synctest"
	"time"
)

func TestEssentialSendBackpressure(t *testing.T) {
	for _, release := range []bool{true, false} {
		name := "deadline"
		if release {
			name = "drain"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				pair := &pair{limits: p.Connection{ReliableFrameBytes: 7168, QueueBytes: 7168, QueueMessages: 1, EssentialQueueWait: 1}, queuedBytes: 7168, queuedMessages: 1, done: make(chan struct{}), capacity: make(chan struct{})}
				w := &streamWriter{pair: pair, queue: make(chan queued, 1)}
				result := make(chan error, 1)
				start := time.Now()
				go func() { result <- w.send(p.ClockReply{Sequence: 1}) }()
				synctest.Wait()
				select {
				case err := <-result:
					t.Fatalf("send returned before capacity or deadline: %v", err)
				default:
				}
				if release {
					pair.release(7168)
				} else {
					time.Sleep(time.Second)
				}
				synctest.Wait()
				err := <-result
				if release {
					if err != nil {
						t.Fatal(err)
					}
					if len(w.queue) != 1 {
						t.Fatal("message not queued")
					}
				} else {
					if err == nil {
						t.Fatal("expected deadline error")
					}
					if time.Since(start) != time.Second {
						t.Fatal("incorrect deadline")
					}
					if pair.queuedBytes != 7168 || pair.queuedMessages != 1 {
						t.Fatal("reservation leaked")
					}
				}
			})
		})
	}
}

// Exercise the actual writer: a waiting producer must not hold the accounting
// mutex needed by the in-flight write to release its reservation.
type blockedWrite struct{ release chan struct{} }

func (w *blockedWrite) SetWriteDeadline(time.Time) error { return nil }
func (w *blockedWrite) Write(b []byte) (int, error)      { <-w.release; return len(b), nil }

func TestEssentialSendDrainsBlockedWriter(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		message := p.ClockReply{Sequence: 1}
		wire, err := p.EncodeMessage(message, 7168)
		if err != nil {
			t.Fatal(err)
		}
		pair := &pair{limits: p.Connection{ReliableFrameBytes: 7168, QueueBytes: float64(len(wire)), QueueMessages: 1, EssentialQueueWait: 1}, done: make(chan struct{}), capacity: make(chan struct{})}
		stream := &blockedWrite{release: make(chan struct{})}
		w := writer(pair, stream)
		if err := w.send(message); err != nil {
			t.Fatal(err)
		}
		result := make(chan error, 1)
		go func() { result <- w.send(p.ClockReply{Sequence: 2}) }()
		synctest.Wait()
		select {
		case err := <-result:
			t.Fatalf("send did not wait: %v", err)
		default:
		}
		close(stream.release)
		synctest.Wait()
		if err := <-result; err != nil {
			t.Fatal(err)
		}
		if pair.queuedBytes != 0 || pair.queuedMessages != 0 {
			t.Fatal("writer did not release capacity")
		}
		close(pair.done)
	})
}
