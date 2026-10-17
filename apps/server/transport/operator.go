package transport

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"time"
)

// StartOperator binds only loopback. It is deliberately separate from public
// HTTPS/HTTP3 and never reverse-proxied by the deployment edge.
func (s *Server) StartOperator(address string, timeout time.Duration) (*http.Server, net.Listener, error) {
	host, _, err := net.SplitHostPort(address)
	if err != nil || net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback() {
		return nil, nil, errors.New("operator address must be an explicit loopback IP and port")
	}
	if timeout < time.Millisecond || timeout%time.Microsecond != 0 {
		return nil, nil, errors.New("drain timeout must be at least 1ms with whole microsecond precision")
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return nil, nil, err
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /livez", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if !s.Ready() {
			http.Error(w, "not ready", 503)
			return
		}
		w.WriteHeader(200)
	})
	mux.HandleFunc("GET /drain", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(s.Maintenance())
	})
	mux.HandleFunc("POST /drain", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != "" {
			http.Error(w, "operator requests must not originate from a browser", http.StatusForbidden)
			return
		}
		if err := s.BeginDrain(timeout); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	})
	operator := &http.Server{Handler: mux, ReadHeaderTimeout: time.Second, ReadTimeout: 2 * time.Second, WriteTimeout: 2 * time.Second, IdleTimeout: 5 * time.Second, MaxHeaderBytes: 4096}
	go func() {
		if err := operator.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			select {
			case s.errors <- err:
			case <-s.stop:
			}
		}
	}()
	return operator, listener, nil
}
