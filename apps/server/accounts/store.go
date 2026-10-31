// Package accounts owns durable credentials and opaque, fixed-lifetime sessions.
package accounts

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
	_ "modernc.org/sqlite"
)

const Lifetime = 30 * 24 * time.Hour

var ErrCredentials = errors.New("Invalid username or password")
var ErrSession = errors.New("Session expired. Please log in again")
var ErrPassword = errors.New("Password must contain 12–1024 characters")
var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]{3,24}$`)

type User struct {
	ID                 int64  `json:"id"`
	Username           string `json:"username"`
	Admin              bool   `json:"admin"`
	MustChangePassword bool   `json:"mustChangePassword"`
}
type Session struct {
	User
	ID      string    `json:"-"` // SHA-256 digest of bearer token; safe internal binding
	Expires time.Time `json:"expires"`
}
type Store struct{ db *sql.DB }

func Open(path string) (*Store, error) {
	if path == "" {
		return nil, errors.New("account database path required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	file.Close()
	if err := os.Chmod(path, 0600); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS accounts (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0,
 must_change INTEGER NOT NULL DEFAULT 0);
 CREATE UNIQUE INDEX IF NOT EXISTS single_admin ON accounts(admin) WHERE admin=1;
 CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS account_sessions ON sessions(account_id);`)
	if err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}
func (s *Store) Close() error { return s.db.Close() }
func Validate(username, password string) error {
	if !usernamePattern.MatchString(username) {
		return errors.New("Username must contain 3–24 letters, digits, or underscores")
	}
	return validatePassword(password)
}
func validatePassword(password string) error {
	n := utf8.RuneCountInString(password)
	if !utf8.ValidString(password) || n < 12 || n > 1024 {
		return ErrPassword
	}
	return nil
}
func passwordHash(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
	return base64.RawStdEncoding.EncodeToString(append(salt, hash...)), nil
}
func passwordMatches(encoded, password string) bool {
	raw, err := base64.RawStdEncoding.DecodeString(encoded)
	if err != nil || len(raw) != 48 {
		raw = make([]byte, 48)
	}
	hash := argon2.IDKey([]byte(password), raw[:16], 3, 64*1024, 4, 32)
	return subtle.ConstantTimeCompare(raw[16:], hash) == 1
}
func (s *Store) Bootstrap(username, password string) error {
	return s.create(username, password, true, false)
}

// BootstrapTemporaryPassword requires the admin to replace the setup credential.
func (s *Store) BootstrapTemporaryPassword(username, password string) error {
	return s.create(username, password, true, true)
}

// CreateTemporary is an operator-side seam for later account administration.
// No public registration endpoint is provided.
func (s *Store) CreateTemporary(username, password string) error {
	return s.create(username, password, false, true)
}
func (s *Store) create(username, password string, admin, temporary bool) error {
	if err := Validate(username, password); err != nil {
		return err
	}
	hash, err := passwordHash(password)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`INSERT INTO accounts(username,password_hash,admin,must_change) VALUES(?,?,?,?)`, username, hash, admin, temporary)
	if err != nil {
		return errors.New("Account already exists or admin already configured")
	}
	return nil
}
func TokenID(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
func newToken() (string, error) {
	raw := make([]byte, 32)
	_, err := rand.Read(raw)
	return base64.RawURLEncoding.EncodeToString(raw), err
}
func (s *Store) Login(username, password string, now time.Time) (Session, string, error) {
	var user User
	var hash string
	if len(username) > 24 || len(password) > 4096 {
		return Session{}, "", ErrCredentials
	}
	err := s.db.QueryRow(`SELECT id,username,password_hash,admin,must_change FROM accounts WHERE username=?`, username).Scan(&user.ID, &user.Username, &hash, &user.Admin, &user.MustChangePassword)
	// Unknown accounts perform the same expensive work as known accounts.
	matches := passwordMatches(hash, password)
	if err != nil || !matches {
		return Session{}, "", ErrCredentials
	}
	token, err := newToken()
	if err != nil {
		return Session{}, "", err
	}
	session := Session{User: user, ID: TokenID(token), Expires: time.Unix(now.Add(Lifetime).Unix(), 0)}
	result, err := s.db.Exec(`INSERT INTO sessions(id,account_id,expires) SELECT ?,id,? FROM accounts WHERE id=? AND password_hash=? AND must_change=?`, session.ID, session.Expires.Unix(), user.ID, hash, user.MustChangePassword)
	if err != nil {
		return Session{}, "", err
	}
	n, err := result.RowsAffected()
	if err != nil || n != 1 {
		return Session{}, "", ErrCredentials
	}
	return session, token, nil
}
func (s *Store) Authenticate(token string, now time.Time) (Session, error) {
	if len(token) != 43 {
		return Session{}, ErrSession
	}
	return s.Session(TokenID(token), now)
}
func (s *Store) Session(id string, now time.Time) (Session, error) {
	var result Session
	var expires int64
	err := s.db.QueryRow(`SELECT a.id,a.username,a.admin,a.must_change,s.expires FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.expires>?`, id, now.Unix()).Scan(&result.User.ID, &result.Username, &result.Admin, &result.MustChangePassword, &expires)
	if err != nil {
		return Session{}, ErrSession
	}
	result.ID = id
	result.Expires = time.Unix(expires, 0)
	return result, nil
}
func (s *Store) Revoke(id string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE id=?`, id)
	return err
}
func (s *Store) RevokeAccount(accountID int64) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE account_id=?`, accountID)
	return err
}

// ChangeTemporaryPassword atomically consumes the temporary credential, revokes
// existing sessions and returns a new normal session. It cannot edit normal users.
func (s *Store) ChangeTemporaryPassword(id, password string, now time.Time) (Session, string, error) {
	if err := validatePassword(password); err != nil {
		return Session{}, "", err
	}
	session, err := s.Session(id, now)
	if err != nil {
		return Session{}, "", err
	}
	if !session.MustChangePassword {
		return Session{}, "", errors.New("Password change is not required")
	}
	var oldHash string
	if err = s.db.QueryRow(`SELECT password_hash FROM accounts WHERE id=?`, session.User.ID).Scan(&oldHash); err != nil {
		return Session{}, "", err
	}
	if passwordMatches(oldHash, password) {
		return Session{}, "", errors.New("Choose a different password")
	}
	hash, err := passwordHash(password)
	if err != nil {
		return Session{}, "", err
	}
	token, err := newToken()
	if err != nil {
		return Session{}, "", err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return Session{}, "", err
	}
	defer tx.Rollback()
	result, err := tx.Exec(`UPDATE accounts SET password_hash=?,must_change=0 WHERE id=? AND must_change=1 AND password_hash=? AND EXISTS(SELECT 1 FROM sessions WHERE id=? AND expires>?)`, hash, session.User.ID, oldHash, id, now.Unix())
	if err != nil {
		return Session{}, "", err
	}
	n, _ := result.RowsAffected()
	if n != 1 {
		return Session{}, "", ErrSession
	}
	if _, err = tx.Exec(`DELETE FROM sessions WHERE account_id=?`, session.User.ID); err != nil {
		return Session{}, "", err
	}
	session.ID = TokenID(token)
	session.MustChangePassword = false
	session.Expires = time.Unix(now.Add(Lifetime).Unix(), 0)
	if _, err = tx.Exec(`INSERT INTO sessions(id,account_id,expires) VALUES(?,?,?)`, session.ID, session.User.ID, session.Expires.Unix()); err != nil {
		return Session{}, "", err
	}
	return session, token, tx.Commit()
}
