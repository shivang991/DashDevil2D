package accounts

import (
	"database/sql"
	"errors"
	"strings"
)

// Challenge metadata is stored atomically with its conversation message. Room
// identities include the server run so a restart or reused code cannot revive it.
type ChatChallenge struct {
	ID        int64  `json:"id"`
	ExpiresAt int64  `json:"expiresAt"`
	Status    string `json:"status"`
	Run       string `json:"-"`
	RoomID    uint32 `json:"-"`
	Epoch     uint64 `json:"-"`
	Sender    int64  `json:"-"`
	Recipient int64  `json:"-"`
	Accepted  bool   `json:"-"`
}

func (s *Store) ChatChallenges(self, peer, after, through int64, watch []int64) ([]ChatChallenge, error) {
	query := `SELECT c.message,c.run,c.room,c.epoch,c.expires,c.accepted,m.sender,m.recipient FROM chat_challenges c JOIN chat_messages m ON m.id=c.message WHERE ((m.sender=? AND m.recipient=?) OR (m.sender=? AND m.recipient=?)) AND ((m.id>? AND m.id<=?)`
	args := []any{self, peer, peer, self, after, through}
	if len(watch) > 0 {
		query += ` OR c.message IN (` + strings.TrimSuffix(strings.Repeat("?,", len(watch)), ",") + `)`
		for _, id := range watch {
			args = append(args, id)
		}
	}
	query += `) ORDER BY c.message`
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ChatChallenge{}
	for rows.Next() {
		var v ChatChallenge
		if err = rows.Scan(&v.ID, &v.Run, &v.RoomID, &v.Epoch, &v.ExpiresAt, &v.Accepted, &v.Sender, &v.Recipient); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s *Store) ChatChallenge(id, recipient int64) (ChatChallenge, error) {
	var v ChatChallenge
	err := s.db.QueryRow(`SELECT c.message,c.run,c.room,c.epoch,c.expires,c.accepted,m.sender,m.recipient FROM chat_challenges c JOIN chat_messages m ON m.id=c.message WHERE c.message=? AND m.recipient=?`, id, recipient).Scan(&v.ID, &v.Run, &v.RoomID, &v.Epoch, &v.ExpiresAt, &v.Accepted, &v.Sender, &v.Recipient)
	return v, err
}
func (s *Store) AcceptChatChallenge(id int64) error {
	_, err := s.db.Exec(`UPDATE chat_challenges SET accepted=1 WHERE message=?`, id)
	return err
}

// Retry lookup precedes live room eligibility: delivery retries never create a
// second message or extend an invitation, even after acceptance or closure.
func (s *Store) ChatInviteRetry(self, peer int64, key string, roomID uint32) (ChatMessage, bool, error) {
	var m ChatMessage
	var originalRoom sql.NullInt64
	err := s.db.QueryRow(`SELECT m.id,m.sender,m.recipient,m.text,m.request_key,m.created_at,c.room FROM chat_messages m LEFT JOIN chat_challenges c ON c.message=m.id WHERE m.sender=? AND m.request_key=?`, self, key).Scan(&m.ID, &m.Sender, &m.Recipient, &m.Text, &m.Key, &m.CreatedAt, &originalRoom)
	if err == sql.ErrNoRows {
		return m, false, nil
	}
	if err != nil {
		return m, false, err
	}
	if m.Recipient != peer || !originalRoom.Valid || (roomID != 0 && int64(roomID) != originalRoom.Int64) {
		return m, true, errors.New("Message key already used")
	}
	return m, true, nil
}
