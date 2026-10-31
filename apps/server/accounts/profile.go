package accounts

import (
	"bytes"
	"errors"
	"image"
	_ "image/jpeg"
	"image/png"
	"strings"
	"time"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const MaxAvatarBytes = 2 * 1024 * 1024

var ErrUsernameConflict = errors.New("Username already taken")

// Decode before storing, then re-encode to strip metadata and trailing payloads.
// A pixel bound keeps a small compressed upload from exhausting server memory.
func ValidateAvatar(data []byte) ([]byte, error) {
	invalid := errors.New("Choose a valid JPEG, PNG, or WebP up to 2 MB and 16 megapixels")
	if len(data) == 0 || len(data) > MaxAvatarBytes {
		return nil, invalid
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png" && format != "webp") || config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > 16*1024*1024 {
		return nil, invalid
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, invalid
	}
	// Avatars need bounded storage and response sizes even for large source photos.
	if config.Width > 512 || config.Height > 512 {
		width, height := config.Width, config.Height
		if width >= height {
			height = max(1, height*512/width)
			width = 512
		} else {
			width = max(1, width*512/height)
			height = 512
		}
		scaled := image.NewRGBA(image.Rect(0, 0, width, height))
		draw.CatmullRom.Scale(scaled, scaled.Bounds(), img, img.Bounds(), draw.Src, nil)
		img = scaled
	}
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		return nil, invalid
	}
	return out.Bytes(), nil
}

// UpdateProfile saves username and optional avatar replacement/removal together.
// SQLite's NOCASE unique index arbitrates concurrent renames across processes.
func (s *Store) UpdateProfile(id, username string, avatar *[]byte, now time.Time) (Session, error) {
	session, err := s.Session(id, now)
	if err != nil {
		return Session{}, err
	}
	if err = s.updateProfile(session.User.ID, id, false, username, avatar, now); err != nil {
		return Session{}, err
	}
	return s.Session(id, now)
}

func (s *Store) UpdateManagedProfile(actor string, accountID int64, username string, avatar *[]byte, now time.Time) (User, error) {
	if err := s.updateProfile(accountID, actor, true, username, avatar, now); err != nil {
		return User{}, err
	}
	return s.User(accountID)
}
func (s *Store) updateProfile(accountID int64, actor string, admin bool, username string, avatar *[]byte, now time.Time) error {
	if !usernamePattern.MatchString(username) {
		return errors.New("Username must contain 3–24 letters, digits, or underscores")
	}
	var err error
	var content []byte
	avatarID := ""
	if avatar != nil && len(*avatar) > 0 {
		content, err = ValidateAvatar(*avatar)
		if err != nil {
			return err
		}
		avatarID, err = newToken()
		if err != nil {
			return err
		}
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.Exec(`UPDATE accounts SET username=? WHERE id=? AND EXISTS(SELECT 1 FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.expires>? AND a.must_change=0 AND ((?=1 AND a.admin=1) OR (?=0 AND a.id=?)))`, username, accountID, actor, now.Unix(), admin, admin, accountID)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return ErrUsernameConflict
		}
		return err
	}
	n, _ := result.RowsAffected()
	if n != 1 {
		return ErrSession
	}
	if avatar != nil {
		if _, err = tx.Exec(`DELETE FROM profiles WHERE account_id=?`, accountID); err != nil {
			return err
		}
		if avatarID != "" {
			if _, err = tx.Exec(`INSERT INTO avatars(id,content) VALUES(?,?)`, avatarID, content); err != nil {
				return err
			}
			if _, err = tx.Exec(`INSERT INTO profiles(account_id,avatar) VALUES(?,?)`, accountID, avatarID); err != nil {
				return err
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}
func (s *Store) Avatar(id string) ([]byte, error) {
	var data []byte
	err := s.db.QueryRow(`SELECT content FROM avatars WHERE id=?`, id).Scan(&data)
	return data, err
}

// Retain live room snapshots as well as current profiles. Called under room ownership.
func (s *Store) CleanupAvatars(retained []string) error {
	args := make([]any, len(retained))
	placeholders := make([]string, len(retained))
	for i, id := range retained {
		args[i] = id
		placeholders[i] = "?"
	}
	query := `DELETE FROM avatars WHERE id NOT IN (SELECT avatar FROM profiles)`
	if len(args) > 0 {
		query += ` AND id NOT IN (` + strings.Join(placeholders, ",") + `)`
	}
	_, err := s.db.Exec(query, args...)
	return err
}

// Keep the caller's opaque session, atomically revoke every other device.
func (s *Store) ChangePassword(id, current, password string, now time.Time) (Session, error) {
	if err := validatePassword(password); err != nil {
		return Session{}, err
	}
	if len(current) > 4096 {
		return Session{}, ErrCredentials
	}
	session, err := s.Session(id, now)
	if err != nil {
		return Session{}, err
	}
	var oldHash string
	if err = s.db.QueryRow(`SELECT password_hash FROM accounts WHERE id=? AND must_change=0`, session.User.ID).Scan(&oldHash); err != nil {
		return Session{}, ErrSession
	}
	if !passwordMatches(oldHash, current) {
		return Session{}, errors.New("Current password is incorrect")
	}
	hash, err := passwordHash(password)
	if err != nil {
		return Session{}, err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return Session{}, err
	}
	defer tx.Rollback()
	result, err := tx.Exec(`UPDATE accounts SET password_hash=? WHERE id=? AND password_hash=? AND EXISTS(SELECT 1 FROM sessions WHERE id=? AND expires>?)`, hash, session.User.ID, oldHash, id, now.Unix())
	if err != nil {
		return Session{}, err
	}
	n, _ := result.RowsAffected()
	if n != 1 {
		return Session{}, ErrSession
	}
	if _, err = tx.Exec(`DELETE FROM sessions WHERE account_id=? AND id<>?`, session.User.ID, id); err != nil {
		return Session{}, err
	}
	return session, tx.Commit()
}
