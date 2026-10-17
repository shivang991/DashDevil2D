package main

import (
	"flag"
	"github.com/shivang991/DashDevil2D/apps/server/transport"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	var c transport.Config
	flag.StringVar(&c.Address, "address", "127.0.0.1:8443", "TCP and UDP listen address")
	flag.StringVar(&c.Origin, "origin", "https://127.0.0.1:4173", "exact permitted website origin")
	flag.StringVar(&c.Certificate, "cert", "", "trusted HTTPS certificate PEM")
	flag.StringVar(&c.Key, "key", "", "HTTPS private key PEM")
	flag.StringVar(&c.QUICCertificate, "quic-cert", "", "optional separate development WebTransport certificate PEM")
	flag.StringVar(&c.QUICKey, "quic-key", "", "WebTransport private key PEM")
	flag.StringVar(&c.StaticDirectory, "static", "", "built client directory (production)")
	flag.BoolVar(&c.Diagnostic, "diagnostic", false, "stationary Stage 4 diagnostic instead of product rooms")
	flag.Parse()
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
	slog.Info("diagnostic_listeners_ready", "address", server.URL(), "origin", c.Origin)
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	select {
	case <-signals:
	case err = <-server.Errors():
		slog.Error("listener failed", "error", err)
	}
	server.Close()
	if err != nil {
		os.Exit(1)
	}
}
