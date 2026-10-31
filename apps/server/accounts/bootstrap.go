package accounts

import (
	"errors"
	"io"
	"os"
	"strings"
)

// BootstrapEnvironment creates the admin once. Existing credentials are never reset.
func (s *Store) BootstrapEnvironment() error {
	var exists bool
	if err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM accounts WHERE admin=1)`).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	username, password, file := os.Getenv("ADMIN_USERNAME"), os.Getenv("ADMIN_PASSWORD"), os.Getenv("ADMIN_PASSWORD_FILE")
	if username == "" && password == "" && file == "" {
		return nil
	}
	if password != "" && file != "" {
		return errors.New("set only ADMIN_PASSWORD or ADMIN_PASSWORD_FILE")
	}
	if file != "" {
		f, err := os.Open(file)
		if err != nil {
			return errors.New("cannot open ADMIN_PASSWORD_FILE")
		}
		defer f.Close()
		data, err := io.ReadAll(io.LimitReader(f, 4098))
		if err != nil {
			return errors.New("cannot read ADMIN_PASSWORD_FILE")
		}
		password = strings.TrimSuffix(strings.TrimSuffix(string(data), "\n"), "\r")
	}
	if username == "" || password == "" {
		return errors.New("ADMIN_USERNAME and ADMIN_PASSWORD or ADMIN_PASSWORD_FILE required")
	}
	if os.Getenv("ADMIN_TEMPORARY_PASSWORD") == "true" {
		return s.BootstrapTemporaryPassword(username, password)
	}
	return s.Bootstrap(username, password)
}
