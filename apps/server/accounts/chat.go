package accounts

import (
	"database/sql"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// Chat identities outlive deleted accounts. Their IDs never get reassigned.
func (s *Store) initChat() error {
	_, err := s.db.Exec(`
 CREATE TABLE IF NOT EXISTS chat_people(id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER UNIQUE REFERENCES accounts(id) ON DELETE SET NULL);
 INSERT OR IGNORE INTO chat_people(account_id) SELECT id FROM accounts;
 CREATE TRIGGER IF NOT EXISTS chat_account_created AFTER INSERT ON accounts BEGIN INSERT INTO chat_people(account_id) VALUES(NEW.id); END;
 CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,sender INTEGER NOT NULL REFERENCES chat_people(id),recipient INTEGER NOT NULL REFERENCES chat_people(id),text TEXT NOT NULL,request_key TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(sender,request_key));
 CREATE TABLE IF NOT EXISTS chat_challenges(message INTEGER PRIMARY KEY REFERENCES chat_messages(id),run TEXT NOT NULL,room INTEGER NOT NULL,epoch INTEGER NOT NULL,expires INTEGER NOT NULL,accepted INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS chat_pair ON chat_messages(sender,recipient,id);
 CREATE INDEX IF NOT EXISTS chat_recipient ON chat_messages(recipient,id);
 CREATE TABLE IF NOT EXISTS chat_reads(reader INTEGER NOT NULL REFERENCES chat_people(id),peer INTEGER NOT NULL REFERENCES chat_people(id),through INTEGER NOT NULL,PRIMARY KEY(reader,peer));
 CREATE TABLE IF NOT EXISTS chat_presence(session TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,client TEXT NOT NULL,rank INTEGER NOT NULL,seen INTEGER NOT NULL,PRIMARY KEY(session,client));
 CREATE TABLE IF NOT EXISTS chat_rounds(round_key TEXT PRIMARY KEY,a INTEGER NOT NULL REFERENCES chat_people(id),b INTEGER NOT NULL REFERENCES chat_people(id),finished INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS chat_round_people ON chat_rounds(a,b,finished);`)
	return err
}

type ChatPerson struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	Avatar      string `json:"avatar"`
	Deleted     bool   `json:"deleted"`
	Presence    string `json:"presence"`
	Unread      int    `json:"unread"`
	LastMessage int64  `json:"lastMessage"`
	Rounds      int    `json:"rounds"`
}
type ChatMessage struct {
	ID        int64  `json:"id"`
	Sender    int64  `json:"sender"`
	Recipient int64  `json:"recipient"`
	Text      string `json:"text"`
	Key       string `json:"key"`
	CreatedAt int64  `json:"createdAt"`
}
type ChatSnapshot struct {
	Selected      *ChatPerson  `json:"selected"`
	Self          int64        `json:"self"`
	Pinned        *ChatPerson  `json:"pinned"`
	Acquaintances []ChatPerson `json:"acquaintances"`
	Suggested     []ChatPerson `json:"suggested"`
	Unread        int          `json:"unread"`
}

func (s *Store) ChatID(account int64) (int64, error) {
	var id int64
	err := s.db.QueryRow(`SELECT id FROM chat_people WHERE account_id=?`, account).Scan(&id)
	return id, err
}

// Room status is copied under the room mutex by transport; SQLite never holds it.
func (s *Store) ChatPeople(now time.Time, rooms map[string]int) ([]ChatPerson, error) {
	rows, err := s.db.Query(`SELECT p.id,COALESCE(a.username,'Deleted account'),COALESCE(f.avatar,''),a.id IS NULL,
 COALESCE((SELECT MAX(h.rank) FROM chat_presence h JOIN sessions ss ON ss.id=h.session WHERE ss.account_id=a.id AND ss.expires>? AND h.seen>?),0)
 FROM chat_people p LEFT JOIN accounts a ON a.id=p.account_id LEFT JOIN profiles f ON f.account_id=a.id`, now.Unix(), now.Add(-45*time.Second).Unix())
	if err != nil {
		return nil, err
	}
	people := []ChatPerson{}
	ranks := map[int64]int{}
	for rows.Next() {
		var v ChatPerson
		var rank int
		if err = rows.Scan(&v.ID, &v.Username, &v.Avatar, &v.Deleted, &rank); err != nil {
			rows.Close()
			return nil, err
		}
		people = append(people, v)
		ranks[v.ID] = rank
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	// Only live, normal sessions can contribute authoritative lobby/game presence.
	rows, err = s.db.Query(`SELECT ss.id,p.id FROM sessions ss JOIN accounts a ON a.id=ss.account_id JOIN chat_people p ON p.account_id=a.id WHERE ss.expires>? AND a.must_change=0`, now.Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var session string
		var id int64
		if err = rows.Scan(&session, &id); err != nil {
			return nil, err
		}
		ranks[id] = max(ranks[id], rooms[session])
	}
	labels := []string{"Offline", "Active", "Lobby", "Playing"}
	for i := range people {
		people[i].Presence = labels[ranks[people[i].ID]]
	}
	return people, rows.Err()
}
func (s *Store) ChatHeartbeat(session, client string, rank int, now time.Time) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`DELETE FROM chat_presence WHERE seen<=?`, now.Add(-45*time.Second).Unix()); err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO chat_presence(session,client,rank,seen) SELECT id,?,?,? FROM sessions WHERE id=? AND expires>? ON CONFLICT(session,client) DO UPDATE SET rank=excluded.rank,seen=excluded.seen`, client, rank, now.Unix(), session, now.Unix())
	if err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Store) ChatLists(self, pinned int64, people []ChatPerson) (ChatSnapshot, error) {
	out := ChatSnapshot{Self: self, Acquaintances: []ChatPerson{}, Suggested: []ChatPerson{}}
	byID := map[int64]ChatPerson{}
	for _, v := range people {
		byID[v.ID] = v
	}
	rows, err := s.db.Query(`SELECT CASE WHEN sender=? THEN recipient ELSE sender END AS peer,MAX(id),SUM(CASE WHEN recipient=? AND id>COALESCE((SELECT through FROM chat_reads WHERE reader=? AND peer=sender),0) THEN 1 ELSE 0 END) FROM chat_messages WHERE sender=? OR recipient=? GROUP BY peer ORDER BY MAX(id) DESC`, self, self, self, self, self)
	if err != nil {
		return out, err
	}
	exchanged := map[int64]bool{}
	for rows.Next() {
		var id, last int64
		var unread int
		if err = rows.Scan(&id, &last, &unread); err != nil {
			rows.Close()
			return out, err
		}
		v := byID[id]
		v.LastMessage = last
		v.Unread = unread
		byID[id] = v
		exchanged[id] = true
		out.Unread += unread
		if id != pinned {
			out.Acquaintances = append(out.Acquaintances, v)
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	if v, ok := byID[pinned]; ok && pinned != self && !v.Deleted {
		out.Pinned = &v
	}
	rows, err = s.db.Query(`SELECT CASE WHEN a=? THEN b ELSE a END AS peer,COUNT(*),MAX(finished) FROM chat_rounds WHERE a=? OR b=? GROUP BY peer ORDER BY COUNT(*) DESC,MAX(finished) DESC,peer ASC`, self, self, self)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, last int64
		var count int
		if err = rows.Scan(&id, &count, &last); err != nil {
			return out, err
		}
		v, ok := byID[id]
		if ok && id != self && id != pinned && !exchanged[id] && !v.Deleted {
			v.Rounds = count
			out.Suggested = append(out.Suggested, v)
		}
	}
	return out, rows.Err()
}
func (s *Store) ChatThread(self, peer, after int64) ([]ChatMessage, error) {
	rows, err := s.db.Query(`SELECT id,sender,recipient,text,request_key,created_at FROM chat_messages WHERE ((sender=? AND recipient=?) OR (sender=? AND recipient=?)) AND id>? ORDER BY id LIMIT 200`, self, peer, peer, self, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ChatMessage{}
	for rows.Next() {
		var m ChatMessage
		if err = rows.Scan(&m.ID, &m.Sender, &m.Recipient, &m.Text, &m.Key, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

var ErrChatRate = errors.New("Too many messages. Wait a minute and retry")

func (s *Store) ChatSend(self, peer int64, text, key string, now time.Time) (ChatMessage, error) {
	return s.chatSend(self, peer, text, key, now, nil)
}

func (s *Store) ChatInvite(self, peer int64, key string, now time.Time, invitation ChatChallenge) (ChatMessage, error) {
	return s.chatSend(self, peer, "Room challenge", key, now, &invitation)
}
func (s *Store) chatSend(self, peer int64, text, key string, now time.Time, invitation *ChatChallenge) (ChatMessage, error) {
	var m ChatMessage
	if self == peer || !utf8.ValidString(text) || utf8.RuneCountInString(text) > 2000 || strings.TrimSpace(text) == "" || len(key) < 1 || len(key) > 100 {
		return m, errors.New("Enter 1–2,000 characters and a valid message key")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return m, err
	}
	defer tx.Rollback()
	err = tx.QueryRow(`SELECT id,sender,recipient,text,request_key,created_at FROM chat_messages WHERE sender=? AND request_key=?`, self, key).Scan(&m.ID, &m.Sender, &m.Recipient, &m.Text, &m.Key, &m.CreatedAt)
	if err == nil {
		var isChallenge bool
		if err = tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM chat_challenges WHERE message=?)`, m.ID).Scan(&isChallenge); err != nil {
			return m, err
		}
		if m.Recipient != peer || m.Text != text || isChallenge != (invitation != nil) {
			return ChatMessage{}, errors.New("Message key already used")
		}
		if invitation != nil {
			var original ChatChallenge
			if err = tx.QueryRow(`SELECT run,room,epoch FROM chat_challenges WHERE message=?`, m.ID).Scan(&original.Run, &original.RoomID, &original.Epoch); err != nil {
				return m, err
			}
			if original.Run != invitation.Run || original.RoomID != invitation.RoomID || original.Epoch != invitation.Epoch {
				return ChatMessage{}, errors.New("Message key already used")
			}
		}
		return m, nil
	}
	if err != sql.ErrNoRows {
		return m, err
	}
	var active bool
	if err = tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM chat_people WHERE id=? AND account_id IS NOT NULL)`, peer).Scan(&active); err != nil {
		return m, err
	}
	if !active {
		return m, errors.New("Account unavailable")
	}
	var count int
	if err = tx.QueryRow(`SELECT COUNT(*) FROM chat_messages WHERE sender=? AND created_at>?`, self, now.Add(-time.Minute).UnixMilli()).Scan(&count); err != nil {
		return m, err
	}
	if count >= 30 {
		return m, ErrChatRate
	}
	result, err := tx.Exec(`INSERT INTO chat_messages(sender,recipient,text,request_key,created_at) VALUES(?,?,?,?,?)`, self, peer, text, key, now.UnixMilli())
	if err != nil {
		return m, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return m, err
	}
	if invitation != nil {
		if _, err = tx.Exec(`INSERT INTO chat_challenges(message,run,room,epoch,expires) VALUES(?,?,?,?,?)`, id, invitation.Run, invitation.RoomID, invitation.Epoch, invitation.ExpiresAt); err != nil {
			return m, err
		}
	}
	if err = tx.Commit(); err != nil {
		return m, err
	}
	return ChatMessage{ID: id, Sender: self, Recipient: peer, Text: text, Key: key, CreatedAt: now.UnixMilli()}, nil
}
func (s *Store) ChatRead(self, peer, through int64) error {
	_, err := s.db.Exec(`INSERT INTO chat_reads(reader,peer,through) VALUES(?,?,MIN(?,COALESCE((SELECT MAX(id) FROM chat_messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)),0))) ON CONFLICT(reader,peer) DO UPDATE SET through=MAX(through,excluded.through)`, self, peer, max(0, through), self, peer, peer, self)
	return err
}

type SharedRound struct {
	Key      string
	A, B     int64
	Finished int64
}

func (s *Store) RecordChatRound(r SharedRound) error {
	if r.A == r.B || r.A == 0 || r.B == 0 {
		return nil
	}
	_, err := s.db.Exec(`INSERT OR IGNORE INTO chat_rounds(round_key,a,b,finished) SELECT ?,a.id,b.id,? FROM chat_people a,chat_people b WHERE a.id=? AND b.id=?`, r.Key, r.Finished, r.A, r.B)
	return err
}
