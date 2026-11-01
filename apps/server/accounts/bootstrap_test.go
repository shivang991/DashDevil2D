package accounts

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBootstrapEnvironment(t *testing.T) {
	for _, secret := range []bool{false, true} {
		s, err := Open(filepath.Join(t.TempDir(), "accounts.sqlite"))
		if err != nil {
			t.Fatal(err)
		}
		defer s.Close()
		t.Setenv("ADMIN_USERNAME", "Site_Admin")
		t.Setenv("ADMIN_PASSWORD", "initial-password-123")
		t.Setenv("ADMIN_PASSWORD_FILE", "")
		t.Setenv("ADMIN_TEMPORARY_PASSWORD", "false")
		if secret {
			file := filepath.Join(t.TempDir(), "password")
			if err := os.WriteFile(file, []byte("initial-password-123\n"), 0600); err != nil {
				t.Fatal(err)
			}
			t.Setenv("ADMIN_PASSWORD", "")
			t.Setenv("ADMIN_PASSWORD_FILE", file)
		}
		if err := s.BootstrapEnvironment(); err != nil {
			t.Fatal(err)
		}
		t.Setenv("ADMIN_PASSWORD", "changed-password-123")
		t.Setenv("ADMIN_PASSWORD_FILE", "")
		if err := s.BootstrapEnvironment(); err != nil {
			t.Fatal(err)
		}
		session, _, err := s.Login("Site_Admin", "initial-password-123", time.Now())
		if err != nil {
			t.Fatal(err)
		}
		if !session.User.Admin {
			t.Fatal("missing admin")
		}
	}
}

func TestBootstrapEnvironmentInvalid(t *testing.T) {
	for _, tc := range []struct{ name, username, password, file string }{
		{"missing password", "Admin", "", ""},
		{"short password", "Admin", "short", ""},
		{"conflicting sources", "Admin", "initial-password-123", "/missing"},
		{"unreadable secret", "Admin", "", "/missing"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, err := Open(filepath.Join(t.TempDir(), "accounts.sqlite"))
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			t.Setenv("ADMIN_USERNAME", tc.username)
			t.Setenv("ADMIN_PASSWORD", tc.password)
			t.Setenv("ADMIN_PASSWORD_FILE", tc.file)
			if err := s.BootstrapEnvironment(); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
