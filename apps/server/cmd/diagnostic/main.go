package main

import (
	"context"
	"flag"
	"github.com/shivang991/DashDevil2D/apps/server/operations"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	var c transport.Config
	var roundConfig, roadRageConfig string
	var operatorAddress string
	var drainTimeout, stopGrace time.Duration
	var checkReady, requestDrain, checkPublic, checkConfig bool
	flag.StringVar(&c.Address, "address", "127.0.0.1:8443", "TCP and UDP listen address")
	flag.StringVar(&c.Origin, "origin", "https://127.0.0.1:4173", "exact permitted website origin")
	flag.StringVar(&c.Certificate, "cert", "", "trusted HTTPS certificate PEM")
	flag.StringVar(&c.Key, "key", "", "HTTPS private key PEM")
	flag.StringVar(&c.QUICCertificate, "quic-cert", "", "optional separate development WebTransport certificate PEM")
	flag.StringVar(&c.QUICKey, "quic-key", "", "WebTransport private key PEM")
	flag.StringVar(&c.StaticDirectory, "static", "", "built client directory (production)")
	flag.BoolVar(&c.Diagnostic, "diagnostic", false, "stationary Stage 4 diagnostic instead of product rooms")
	flag.StringVar(&roundConfig, "drag-race-config", "", "explicit validated Drag Race configuration overrides JSON")
	flag.StringVar(&roadRageConfig, "road-rage-config", "", "explicit validated Road Rage configuration overrides JSON")
	flag.StringVar(&operatorAddress, "admin-address", "", "private loopback operator listener (disabled unless set)")
	flag.DurationVar(&drainTimeout, "drain-timeout", 3*time.Minute, "maximum planned-maintenance wait for active rounds")
	flag.BoolVar(&checkReady, "check-ready", false, "probe the private operator readiness endpoint and exit")
	flag.BoolVar(&requestDrain, "request-drain", false, "request private maintenance, wait for complete drain and exit")
	flag.BoolVar(&checkPublic, "check-public", false, "verify public client, admission and HTTP/3 UDP and exit")
	flag.DurationVar(&stopGrace, "stop-grace-period", 200*time.Second, "supervisor stop grace; must exceed drain timeout by at least 15 seconds")
	flag.BoolVar(&checkConfig, "check-config", false, "validate maintenance durations without starting listeners")
	flag.Parse()
	if drainTimeout < time.Millisecond || drainTimeout%time.Microsecond != 0 {
		slog.Error("drain timeout must be at least 1ms with whole microsecond precision")
		os.Exit(1)
	}
	if checkReady || requestDrain || checkPublic {
		if operatorAddress == "" {
			operatorAddress = "127.0.0.1:8082"
		}
		timeout := 30 * time.Second
		if requestDrain {
			timeout = drainTimeout + 15*time.Second
		}
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		var err error
		if requestDrain {
			err = operations.Drain(ctx, operatorAddress)
		} else if checkPublic {
			err = operations.Public(ctx, c.Origin, nil)
		} else {
			err = operations.Ready(ctx, operatorAddress)
		}
		if err != nil {
			slog.Error("operator check failed", "error", err)
			os.Exit(1)
		}
		return
	}
	if stopGrace < drainTimeout+15*time.Second {
		slog.Error("stop grace must exceed drain timeout by at least 15 seconds")
		os.Exit(1)
	}
	if checkConfig {
		return
	}
	if roundConfig != "" {
		var err error
		c.DragRaceOverrides, err = os.ReadFile(roundConfig)
		if err != nil {
			slog.Error("round configuration", "error", err)
			os.Exit(1)
		}
	}
	if roadRageConfig != "" {
		var err error
		c.RoadRageOverrides, err = os.ReadFile(roadRageConfig)
		if err != nil {
			slog.Error("round configuration", "error", err)
			os.Exit(1)
		}
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	server, err := transport.New(c)
	if err != nil {
		slog.Error("configuration", "error", err)
		os.Exit(1)
	}
	if err = server.Start(); err != nil {
		slog.Error("listeners", "error", err)
		os.Exit(1)
	}
	if operatorAddress != "" {
		operator, listener, err := server.StartOperator(operatorAddress, drainTimeout)
		if err != nil {
			server.Close()
			slog.Error("operator listener", "error", err)
			os.Exit(1)
		}
		defer operator.Close()
		slog.Info("operator_listener_ready", "address", listener.Addr().String())
	}
	slog.Info("listeners_ready", "address", server.URL(), "origin", c.Origin)
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	select {
	case <-signals:
		if err = server.BeginDrain(drainTimeout); err == nil {
			ticker := time.NewTicker(50 * time.Millisecond)
			for !server.Maintenance().Complete && err == nil {
				select {
				case err = <-server.Errors():
				case <-ticker.C:
				}
			}
			ticker.Stop()
		}
	case err = <-server.Errors():
		slog.Error("listener failed", "error", err)
	}
	server.Close()
	if err != nil {
		os.Exit(1)
	}
}
