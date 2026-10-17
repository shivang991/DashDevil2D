package transport_test

import (
	"context"
	"crypto/tls"
	"github.com/shivang991/DashDevil2D/apps/server/operations"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestOperatorReadinessDrainAndPublicIsolation(t *testing.T) {
	s, c, _ := serverMode(t, false)
	if _, _, err := s.StartOperator("0.0.0.0:0", time.Minute); err == nil {
		t.Fatal("operator exposed outside loopback")
	}
	operator, listener, err := s.StartOperator("127.0.0.1:0", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	defer operator.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = operations.Ready(ctx, listener.Addr().String()); err != nil {
		t.Fatal(err)
	}
	response, err := c.Get(s.URL() + "/readyz")
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 404 {
		t.Fatalf("private readiness exposed publicly: %d", response.StatusCode)
	}
	request, _ := http.NewRequest("POST", "http://"+listener.Addr().String()+"/drain", nil)
	request.Header.Set("Origin", "https://untrusted.example")
	rejected, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	rejected.Body.Close()
	if rejected.StatusCode != 403 || s.Maintenance().Draining {
		t.Fatal("browser-origin request started maintenance")
	}
	if err = operations.Drain(ctx, listener.Addr().String()); err != nil {
		t.Fatal(err)
	}
	if !s.Maintenance().Complete {
		t.Fatal("drain returned before closure")
	}
	if err = operations.Ready(ctx, listener.Addr().String()); err == nil {
		t.Fatal("drained service remained ready")
	}
}

func TestPublicDeploymentProbeRequiresClientAdmissionAndRealUDP(t *testing.T) {
	cert, key, roots := localCertificate(t)
	reservation, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := reservation.Addr().String()
	reservation.Close()
	assets := t.TempDir()
	if err = os.WriteFile(filepath.Join(assets, "index.html"), []byte("<!doctype html><html>deployment fixture</html>"), 0600); err != nil {
		t.Fatal(err)
	}
	s, err := transport.New(transport.Config{Address: address, Origin: "https://" + address, Certificate: cert, Key: key, StaticDirectory: assets})
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Start(); err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = operations.Public(ctx, s.URL(), &tls.Config{RootCAs: roots}); err != nil {
		t.Fatal(err)
	}
	if err = operations.Public(ctx, s.URL(), &tls.Config{InsecureSkipVerify: true}); err == nil {
		t.Fatal("public probe allowed global trust bypass")
	}
	// A fresh deployment without client assets must fail even with working listeners.
	if err = os.Remove(filepath.Join(assets, "index.html")); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, err = transport.New(transport.Config{Address: address, Origin: "https://" + address, Certificate: cert, Key: key, StaticDirectory: assets})
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Start(); err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = operations.Public(ctx, s.URL(), &tls.Config{RootCAs: roots}); err == nil {
		t.Fatal("missing client assets reported healthy")
	}
}
