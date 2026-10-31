package accounts

import (
	"database/sql"
	"time"
)

type ManagedUser struct {
	User
	CreatedAt  *time.Time `json:"createdAt"`
	LastSeenAt *time.Time `json:"lastSeenAt"`
}

func (s *Store) Users() ([]ManagedUser, error) {
	rows, err := s.db.Query(`SELECT a.id,a.username,a.admin,a.must_change,COALESCE(p.avatar,''),m.created_at,m.last_seen_at FROM accounts a LEFT JOIN profiles p ON p.account_id=a.id LEFT JOIN account_activity m ON m.account_id=a.id ORDER BY a.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []ManagedUser{}
	for rows.Next() {
		var u ManagedUser
		var created, seen sql.NullInt64
		if err = rows.Scan(&u.ID, &u.Username, &u.Admin, &u.MustChangePassword, &u.Avatar, &created, &seen); err != nil {
			return nil, err
		}
		if created.Valid {
			v := time.Unix(created.Int64, 0).UTC()
			u.CreatedAt = &v
		}
		if seen.Valid {
			v := time.Unix(seen.Int64, 0).UTC()
			u.LastSeenAt = &v
		}
		users = append(users, u)
	}
	return users, rows.Err()
}
func (s *Store) User(id int64) (User, error) {
	var u User
	err := s.db.QueryRow(`SELECT a.id,a.username,a.admin,a.must_change,COALESCE(p.avatar,'') FROM accounts a LEFT JOIN profiles p ON p.account_id=a.id WHERE a.id=?`, id).Scan(&u.ID, &u.Username, &u.Admin, &u.MustChangePassword, &u.Avatar)
	return u, err
}

func (s *Store) CreateManaged(username string) (User, string, error) {
	password, err := newToken()
	if err != nil {
		return User{}, "", err
	}
	if err = s.CreateTemporary(username, password); err != nil {
		return User{}, "", err
	}
	var id int64
	if err = s.db.QueryRow(`SELECT id FROM accounts WHERE username=?`, username).Scan(&id); err != nil {
		return User{}, "", err
	}
	u, err := s.User(id)
	return u, password, err
}

// ResetManagedPassword atomically replaces credentials and removes every session.
// The server owns seat/ticket revocation under its authentication lock.
func (s *Store) ResetManagedPassword(id int64) (string, error) {
	password, err := newToken()
	if err != nil {
		return "", err
	}
	hash, err := passwordHash(password)
	if err != nil {
		return "", err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	result, err := tx.Exec(`UPDATE accounts SET password_hash=?,must_change=1 WHERE id=?`, hash, id)
	if err != nil {
		return "", err
	}
	n, _ := result.RowsAffected()
	if n != 1 {
		return "", sql.ErrNoRows
	}
	if _, err = tx.Exec(`DELETE FROM sessions WHERE account_id=?`, id); err != nil {
		return "", err
	}
	if err = tx.Commit(); err != nil {
		return "", err
	}
	return password, nil
}
func (s *Store) DeleteManaged(id int64) error {
	result, err := s.db.Exec(`DELETE FROM accounts WHERE id=? AND admin=0`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n != 1 {
		return sql.ErrNoRows
	}
	return nil
}
