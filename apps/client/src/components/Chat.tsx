import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { Avatar } from "./Avatar";
import type { Account } from "@/transport/account";
import {
  chatAPI,
  type ChatPerson,
  type ChatSnapshot,
  type ChatMessage,
  type ChatChallenge,
} from "@/transport/chat";
import { ChallengeInvitation } from "./ChallengeInvitation";
import "./chat.css";

interface ChatBoundary {
  path: string;
  visible: boolean;
  playing: boolean;
  roomID?: number;
  pending?: boolean;
  admissionFailure?: string;
}
const Visibility = createContext<
  { path: string; report: (value: ChatBoundary) => void } | undefined
>(undefined);
/** Report the actual rendered result boundary, including the frozen final scene. */
export function ChatVisibility({
  visible,
  playing,
  roomID,
  pending,
  admissionFailure,
}: Omit<ChatBoundary, "path">) {
  const context = useContext(Visibility);
  const report = context?.report;
  const pathname = context?.path ?? "";
  useLayoutEffect(() => {
    report?.({ path: pathname, visible, playing, roomID, pending, admissionFailure });
  }, [report, pathname, visible, playing, roomID, pending, admissionFailure]);
  return null;
}
export function ChatShell({ account, children }: { account?: Account; children: ReactNode }) {
  const { pathname } = useLocation();
  const [boundary, setBoundary] = useState<ChatBoundary>();
  const game = pathname === "/long-drive" || pathname.startsWith("/multiplayer/");
  const visible = game ? boundary?.path === pathname && boundary.visible : pathname != "/login";
  const playing = game && (boundary?.path !== pathname || boundary.playing);
  return (
    <Visibility.Provider value={{ path: pathname, report: setBoundary }}>
      {children}
      {account && !account.mustChangePassword && (
        <ChatPanel
          key={account.id}
          account={account}
          visible={Boolean(visible)}
          playing={playing}
          pending={boundary?.path === pathname && boundary.pending}
          admissionFailure={boundary?.path === pathname ? boundary.admissionFailure : undefined}
          roomID={boundary?.path === pathname ? boundary.roomID : undefined}
        />
      )}
    </Visibility.Provider>
  );
}
export function Presence({ value }: { value: ChatPerson["presence"] }) {
  return (
    <span className={`chat-presence ${value === "Offline" ? "chat-offline" : ""}`}>{value}</span>
  );
}
function preference(id: number) {
  try {
    return localStorage.getItem(`dashdevil-chat:${id}`) === "open";
  } catch {
    return false;
  }
}
function ChatPanel({
  account,
  visible,
  playing,
  roomID,
  pending: admissionPending,
  admissionFailure,
}: {
  pending?: boolean;
  admissionFailure?: string;
  account: Account;
  visible: boolean;
  playing: boolean;
  roomID?: number;
}) {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<ChatChallenge[]>([]);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [createOffer, setCreateOffer] = useState(false);
  const inviteKey = useRef<string | undefined>(undefined);
  const [expanded, setExpanded] = useState(() => preference(account.id));
  const [snapshot, setSnapshot] = useState<ChatSnapshot>();
  const [peer, setPeer] = useState<ChatPerson>();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ query: string; users: ChatPerson[]; total: number }>();
  const [searchState, setSearchState] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [focused, setFocused] = useState(() => document.hasFocus() && !document.hidden);
  const [client] = useState(() => crypto.randomUUID());
  const pending = useRef<{ peer: number; text: string; key: string } | undefined>(undefined);
  const current = useRef({ visible, expanded, focused, peer: peer?.id });
  useLayoutEffect(() => {
    current.current = { visible, expanded, focused, peer: peer?.id };
  }, [visible, expanded, focused, peer?.id]);
  useEffect(() => {
    const update = () => setFocused(document.hasFocus() && !document.hidden);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    let busy = false;
    const sync = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await chatAPI.sync(
          client,
          playing ? "Playing" : focused ? "Active" : "Offline",
          roomID,
          peer?.id,
        );
        if (!disposed) {
          setSnapshot(result);
          setError("");
        }
      } catch (failure) {
        if (!disposed)
          setError(failure instanceof Error ? failure.message : "Chat unavailable. Retry");
      } finally {
        busy = false;
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [client, playing, focused, revision, roomID, peer?.id]);
  useEffect(() => {
    if (!query.trim()) return;
    let disposed = false;
    let busy = false;
    const searchAccounts = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await chatAPI.search(query);
        if (!disposed) {
          setSearch({ ...result, query });
          setSearchState("");
        }
      } catch {
        if (!disposed) setSearchState("Search failed. Change your search or retry.");
      } finally {
        busy = false;
      }
    };
    const timer = setTimeout(() => {
      setSearchState("Searching…");
      void searchAccounts();
    }, 300);
    const interval = setInterval(() => void searchAccounts(), 2000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [query, revision]);

  useEffect(() => {
    if (!peer) return;
    let disposed = false;
    let busy = false;
    let after = 0;
    const watch = new Set<number>();
    setMessages([]);
    setChallenges([]);
    setHistoryError("");
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        let batch: ChatMessage[];
        do {
          const result = await chatAPI.thread(peer.id, after, [...watch]);
          if (disposed) return;
          batch = result.messages;
          for (const invitation of result.challenges) {
            if (invitation.status === "Pending") watch.add(invitation.id);
            else watch.delete(invitation.id);
          }
          setChallenges((previous) => [
            ...new Map(
              [...previous, ...result.challenges].map((invitation) => [invitation.id, invitation]),
            ).values(),
          ]);
          if (batch.length) {
            after = batch[batch.length - 1].id;
            setMessages((previous) => [...previous, ...batch]);
          }
        } while (batch.length === 200);
        if (!disposed) setHistoryError("");
      } catch (failure) {
        if (!disposed)
          setHistoryError(
            failure instanceof Error ? failure.message : "History unavailable. Retry",
          );
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [peer, revision]);
  const activeMessages = messages.filter(
    (message) => message.sender === peer?.id || message.recipient === peer?.id,
  );
  const invitationsByID = new Map(challenges.map((invitation) => [invitation.id, invitation]));
  const last = activeMessages.at(-1)?.id ?? 0;
  useEffect(() => {
    const now = current.current;
    if (
      !last ||
      !peer ||
      !now.visible ||
      !now.expanded ||
      !now.focused ||
      now.peer !== peer.id ||
      document.hidden ||
      !document.hasFocus()
    )
      return;
    let disposed = false;
    void chatAPI
      .read(peer.id, last)
      .then(() => {
        if (!disposed)
          setSnapshot((previous) => {
            if (!previous) return previous;
            const clear = (person: ChatPerson) =>
              person.id === peer.id ? { ...person, unread: 0 } : person;
            const unread =
              (previous.pinned?.id === peer.id
                ? previous.pinned.unread
                : previous.acquaintances.find((p) => p.id === peer.id)?.unread) ?? 0;
            return {
              ...previous,
              unread: Math.max(0, previous.unread - unread),
              pinned: previous.pinned ? clear(previous.pinned) : null,
              acquaintances: previous.acquaintances.map(clear),
            };
          });
      })
      .catch(() => {
        if (!disposed) setHistoryError("Unable to save read position. Retry");
      });
    return () => {
      disposed = true;
    };
  }, [last, peer, visible, expanded, focused, snapshot?.unread]);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (visible && expanded) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [last, visible, expanded]);
  function toggle(value: boolean) {
    setExpanded(value);
    try {
      localStorage.setItem(`dashdevil-chat:${account.id}`, value ? "open" : "closed");
    } catch {
      /* optional storage */
    }
  }
  function open(person: ChatPerson) {
    setPeer(person);
    setCreateOffer(false);
    inviteKey.current = undefined;
    setQuery("");
    setDraft("");
    setHistoryError("");
    setSendError("");
  }
  async function send() {
    if (!peer || sending || !draft.trim() || peer.deleted) return;
    const target = peer.id,
      text = draft;
    if (!pending.current || pending.current.peer !== target || pending.current.text !== text)
      pending.current = { peer: target, text, key: crypto.randomUUID() };
    setSending(true);
    setSendError("");
    try {
      await chatAPI.send(target, text, pending.current.key);
      pending.current = undefined;
      if (current.current.peer === target) setDraft("");
      setRevision((n) => n + 1);
    } catch (failure) {
      setSendError(failure instanceof Error ? failure.message : "Send failed. Retry");
    } finally {
      setSending(false);
    }
  }
  async function challenge() {
    if (!peer || challengeBusy || playing) return;
    setChallengeBusy(true);
    setSendError("");
    inviteKey.current ??= crypto.randomUUID();
    try {
      await chatAPI.invite(peer.id, roomID ?? 0, inviteKey.current);
      inviteKey.current = undefined;
      setRevision((n) => n + 1);
    } catch (failure) {
      if (
        !roomID &&
        failure instanceof Error &&
        failure.message === "Choose an open lobby with a free seat, or create a room"
      )
        setCreateOffer(true);
      else setSendError(failure instanceof Error ? failure.message : "Challenge failed. Retry");
    } finally {
      setChallengeBusy(false);
    }
  }
  const people = [
    ...(snapshot?.pinned ? [snapshot.pinned] : []),
    ...(snapshot?.acquaintances ?? []),
    ...(snapshot?.suggested ?? []),
  ];
  const selected = peer
    ? ((snapshot?.selected?.id === peer.id ? snapshot.selected : undefined) ??
      people.find((p) => p.id === peer.id) ??
      search?.users.find((p) => p.id === peer.id) ??
      peer)
    : undefined;
  const row = (person: ChatPerson) => (
    <button
      key={person.id}
      className="chat-person"
      aria-label={`Open conversation with ${person.username}`}
      onClick={() => open(person)}
    >
      <Avatar username={person.username} avatar={person.avatar} />
      <span className="chat-person-copy">
        <strong>{person.username}</strong>
        <Presence value={person.presence} />
        {person.rounds > 0 && <small>{person.rounds} shared rounds</small>}
      </span>
      {person.unread > 0 && (
        <span className="chat-badge">
          {person.unread}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </button>
  );
  if (!visible) return null;
  if (!expanded)
    return (
      <button
        className="chat-launch"
        aria-label="Open chat"
        aria-expanded={false}
        onClick={() => toggle(true)}
      >
        Chat{" "}
        {snapshot && snapshot.unread > 0 && (
          <span className="chat-badge">
            {snapshot.unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </button>
    );
  return (
    <aside
      className="chat-panel"
      aria-label="Chat"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") toggle(false);
      }}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <header className="chat-header">
        <h2>Chat</h2>
        <button onClick={() => toggle(false)} aria-label="Close chat">
          ×
        </button>
      </header>
      {error && (
        <div role="alert" className="chat-error">
          {error} <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {selected ? (
        <>
          <div className="chat-thread-head">
            <button onClick={() => setPeer(undefined)} aria-label="Back to conversations">
              ‹
            </button>
            <Avatar username={selected.username} avatar={selected.avatar} />
            <div>
              <strong>{selected.username}</strong>
              <Presence value={selected.presence} />
            </div>
          </div>
          {!selected.deleted && (
            <div className="chat-challenge-control">
              <button
                disabled={playing || challengeBusy || admissionPending}
                onClick={() => void challenge()}
              >
                {challengeBusy ? "Inviting…" : "Challenge"}
              </button>
              {createOffer && (
                <div>
                  <p>
                    Create a room to invite {selected.username}. You’ll choose the mode and
                    readiness in the lobby.
                  </p>
                  <button
                    onClick={() => {
                      setCreateOffer(false);
                      void navigate("/multiplayer/drag-race", {
                        state: { challengePeer: selected.id },
                      });
                    }}
                  >
                    Create room &amp; invite
                  </button>
                </div>
              )}
            </div>
          )}
          <nav className="chat-rail" aria-label="Switch conversation">
            <button
              onClick={() => {
                setPeer(undefined);
                setQuery("");
              }}
              aria-label="Search conversations"
            >
              ⌕
            </button>
            {people
              .filter(
                (p, i, list) => list.findIndex((v) => v.id === p.id) === i && p.lastMessage > 0,
              )
              .map((person) => (
                <button
                  key={person.id}
                  title={person.username}
                  aria-label={`Switch to ${person.username}`}
                  aria-pressed={person.id === selected.id}
                  onClick={() => open(person)}
                >
                  <Avatar username={person.username} avatar={person.avatar} />
                  {person.unread > 0 && <span className="chat-badge">{person.unread}</span>}
                </button>
              ))}
          </nav>
          <div className="chat-messages" aria-label="Messages">
            {!activeMessages.length && !historyError && <p>No messages yet.</p>}
            {activeMessages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.sender === snapshot?.self ? "chat-mine" : ""}`}
              >
                {invitationsByID.get(message.id) ? (
                  <ChallengeInvitation
                    key={`${message.id}:${admissionFailure ?? ""}`}
                    pending={admissionPending}
                    invitation={invitationsByID.get(message.id)!}
                    incoming={message.recipient === snapshot?.self}
                    playing={playing}
                    inRoom={Boolean(roomID)}
                    onAccept={() => {
                      if (!playing && !roomID)
                        void navigate("/multiplayer/drag-race", {
                          state: { challenge: message.id },
                        });
                    }}
                  />
                ) : (
                  <p>{message.text}</p>
                )}
                <time dateTime={new Date(message.createdAt).toISOString()}>
                  {new Date(message.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
            <div ref={bottom} />
          </div>
          {historyError && (
            <div className="chat-error" role="alert">
              {historyError} <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
            </div>
          )}
          {sendError && (
            <div className="chat-error" role="alert">
              {sendError}{" "}
              <button disabled={sending} onClick={() => void send()}>
                Retry send
              </button>
            </div>
          )}
          {selected.deleted ? (
            <p className="chat-error">
              This account was deleted. Shared messages remain available.
            </p>
          ) : (
            <form
              className="chat-compose"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <textarea
                aria-label="Message"
                placeholder="Write a message"
                value={draft}
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <div>
                <small>{draft.length}/2,000</small>
                <button disabled={sending || !draft.trim()} type="submit">
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="chat-search">
            <label htmlFor="chat-search">Search accounts</label>
            <input
              id="chat-search"
              value={query}
              placeholder="Find a driver"
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchState("");
                setSearch(undefined);
              }}
            />
          </div>
          <div className="chat-list">
            {query.trim() ? (
              <>
                <p role="status">
                  {searchState ||
                    (!search || search.query !== query
                      ? "Searching…"
                      : `${search.total} matching ${search.total === 1 ? "account" : "accounts"}${search.total > 50 ? " · first 50 shown" : ""}`)}
                </p>
                {search?.query === query && search.users.map(row)}
                {searchState.startsWith("Search failed") && (
                  <button onClick={() => setRevision((n) => n + 1)}>Retry search</button>
                )}
              </>
            ) : (
              <>
                {snapshot?.pinned && (
                  <section>
                    <h3>Lobby opponent</h3>
                    {row(snapshot.pinned)}
                  </section>
                )}
                <section>
                  <h3>Acquaintances</h3>
                  {snapshot?.acquaintances.map(row)}
                  {snapshot && !snapshot.acquaintances.length && (
                    <p>Search for a driver to start a conversation.</p>
                  )}
                  {!snapshot && <p>Loading conversations…</p>}
                </section>
                <section>
                  <h3>Suggested</h3>
                  {snapshot?.suggested.map(row)}
                  {snapshot && !snapshot.suggested.length && (
                    <p>Previous race opponents will appear here.</p>
                  )}
                </section>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
