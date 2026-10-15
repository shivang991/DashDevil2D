// devcert renews a short-lived ECDSA P-256 WebTransport certificate and publishes
// its SHA-256 fingerprint atomically. It never installs a machine trust root.
package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	dir := flag.String("dir", ".local/transport", "private certificate directory")
	server := flag.String("server", "https://127.0.0.1:8443", "development server URL")
	force := flag.Bool("renew", false, "force renewal before the automatic two-day threshold")
	flag.Parse()
	if err := os.MkdirAll(*dir, 0700); err != nil {
		return err
	}
	certPath, keyPath := filepath.Join(*dir, "webtransport.pem"), filepath.Join(*dir, "webtransport-key.pem")
	var der []byte
	if bytes, err := os.ReadFile(certPath); err == nil {
		block, _ := pem.Decode(bytes)
		if block != nil {
			cert, e := x509.ParseCertificate(block.Bytes)
			if e == nil && time.Until(cert.NotAfter) > 48*time.Hour && !*force && cert.NotAfter.Sub(cert.NotBefore) <= 14*24*time.Hour {
				if _, keyError := tls.LoadX509KeyPair(certPath, keyPath); keyError == nil {
					der = block.Bytes
				}
			}
		}
	}
	if der == nil {
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return err
		}
		serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
		if err != nil {
			return err
		}
		template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: "DashDevil local development"}, DNSNames: []string{"localhost"}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(13 * 24 * time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
		der, err = x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
		if err != nil {
			return err
		}
		private, err := x509.MarshalPKCS8PrivateKey(key)
		if err != nil {
			return err
		}
		if err = atomic(keyPath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: private})); err != nil {
			return err
		}
		if err = atomic(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})); err != nil {
			return err
		}
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		return err
	}
	hash := sha256.Sum256(der)
	numbers := make([]int, len(hash))
	for i, b := range hash {
		numbers[i] = int(b)
	}
	spki := sha256.Sum256(cert.RawSubjectPublicKeyInfo)
	config := map[string]any{"server": *server, "certificateHash": numbers, "development": true, "spki": base64.StdEncoding.EncodeToString(spki[:]), "expires": cert.NotAfter.UTC().Format(time.RFC3339)}
	bytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	if err = atomic(filepath.Join(*dir, "config.json"), bytes); err != nil {
		return err
	}
	fmt.Println(filepath.Join(*dir, "config.json"))
	return nil
}
func atomic(path string, bytes []byte) error {
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, bytes, 0600); err != nil {
		return err
	}
	return os.Rename(temporary, path)
}
