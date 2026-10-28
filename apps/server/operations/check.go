// Package operations supplies bounded deployment probes and private drain requests.
package operations

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/quic-go/quic-go/http3"
	p "github.com/shivang991/DashDevil2D/apps/server/protocol"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
)

func operatorURL(address, path string) (string, error) {
	host, _, err := net.SplitHostPort(address)
	if err != nil || net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback() {
		return "", errors.New("operator address must be loopback")
	}
	return "http://" + address + path, nil
}
func Ready(ctx context.Context, address string) error {
	endpoint, err := operatorURL(address, "/readyz")
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return err
	}
	response, err := (&http.Client{Timeout: 3 * time.Second}).Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return fmt.Errorf("server not ready (%d)", response.StatusCode)
	}
	return nil
}
func Drain(ctx context.Context, address string) error {
	endpoint, err := operatorURL(address, "/drain")
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 3 * time.Second}
	request, err := http.NewRequestWithContext(ctx, "POST", endpoint, nil)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	response.Body.Close()
	if response.StatusCode != 202 {
		return fmt.Errorf("drain refused (%d)", response.StatusCode)
	}
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			request, _ = http.NewRequestWithContext(ctx, "GET", endpoint, nil)
			response, err = client.Do(request)
			if err != nil {
				return err
			}
			var status transport.MaintenanceStatus
			err = json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&status)
			response.Body.Close()
			if err != nil {
				return err
			}
			if response.StatusCode != 200 {
				return fmt.Errorf("drain status failed (%d)", response.StatusCode)
			}
			if status.Complete {
				return nil
			}
		}
	}
}

// Public checks normal public TLS, built assets, binary admission/version routing,
// and HTTP/3 UDP reachability. It allocates no room and is not a browser playtest.
// tlsConfig exists for explicitly trusted local-CA integration tests; callers
// must never supply InsecureSkipVerify or production fingerprint overrides.
func Public(ctx context.Context, origin string, tlsConfig *tls.Config) error {
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.User != nil || u.Fragment != "" {
		return errors.New("one HTTPS origin required")
	}
	if tlsConfig != nil && tlsConfig.InsecureSkipVerify {
		return errors.New("public probes require certificate validation")
	}
	tcp := &http.Transport{TLSClientConfig: tlsConfig}
	defer tcp.CloseIdleConnections()
	client := &http.Client{Transport: tcp, Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("unexpected redirect") }}
	request, _ := http.NewRequestWithContext(ctx, "GET", origin+"/", nil)
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("public HTTPS: %w", err)
	}
	body, readErr := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	response.Body.Close()
	if readErr != nil || response.StatusCode != 200 || !bytes.Contains(bytes.ToLower(body), []byte("<html")) {
		return errors.New("public client assets unavailable")
	}
	wire, err := p.EncodeMessage(p.AdmissionRequest{Operation: p.AdmissionOperationCreate, Version: 0}, 65536)
	if err != nil {
		return err
	}
	request, _ = http.NewRequestWithContext(ctx, "POST", origin+"/admission", bytes.NewReader(wire))
	request.Header.Set("Origin", origin)
	request.Header.Set("Content-Type", "application/octet-stream")
	response, err = client.Do(request)
	if err != nil {
		return fmt.Errorf("public admission: %w", err)
	}
	body, readErr = io.ReadAll(io.LimitReader(response.Body, 65537))
	response.Body.Close()
	if readErr != nil {
		return readErr
	}
	value, err := p.DecodeMessage(body, 65536)
	problem, ok := value.(p.ProtocolError)
	if err != nil || response.StatusCode != 409 || !ok || problem.Code != 1 || problem.ExpectedVersion != p.ProtocolVersion {
		return errors.New("public binary admission/version probe failed")
	}
	quic := &http3.Transport{TLSClientConfig: tlsConfig}
	defer quic.Close()
	request, _ = http.NewRequestWithContext(ctx, "GET", origin+"/gameplay", nil)
	request.Header.Set("Origin", origin)
	response, err = (&http.Client{Transport: quic, Timeout: 10 * time.Second}).Do(request)
	if err != nil {
		return fmt.Errorf("public HTTP/3 UDP: %w", err)
	}
	body, readErr = io.ReadAll(io.LimitReader(response.Body, 4096))
	response.Body.Close()
	if readErr != nil || response.ProtoMajor != 3 || response.StatusCode != 403 || !bytes.Contains(body, []byte("Admission rejected")) {
		return errors.New("public HTTP/3 admission guard probe failed")
	}
	return nil
}
