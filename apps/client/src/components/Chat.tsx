import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import { Avatar } from "./Avatar";
import type { Account } from "@/transport/account";
import { chatAPI, type ChatPerson, type ChatSnapshot, type ChatMessage } from "@/transport/chat";
import "./chat.css";

const Visibility = createContext<
  | {
      path: string;
      report: (value: {
        path: string;
        visible: boolean;
        playing: boolean;
        roomID?: number;
      }) => void;
    }
  | undefined
>(undefined);
/** Report the actual rendered result boundary, including the frozen final scene. */
export function ChatVisibility({
  visible,
  playing,
  roomID,
}: {
  visible: boolean;
  playing: boolean;
  roomID?: number;
}) {
  const context = useContext(Visibility);
  const report = context?.report;
  const pathname = context?.path ?? "";
  useLayoutEffect(() => {
    report?.({ path: pathname, visible, playing, roomID });
  }, [report, pathname, visible, playing, roomID]);
  return null;
}
export function ChatShell({ account, children }: { account?: Account; children: ReactNode }) {
  const { pathname } = useLocation();
  const [boundary, setBoundary] = useState<{
    path: string;
    visible: boolean;
    playing: boolean;
    roomID?: number;
  }>();
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
}: {
  account: Account;
  visible: boolean;
  playing: boolean;
  roomID?: number;
}) {
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
  }, [client, playing, focused, revision, roomID]);
  useEffect(() => {
    if (!query.trim()) return;
    let disposed = false;
    const timer = setTimeout(() => {
      setSearchState("Searching…");
      void chatAPI
        .search(query)
        .then((result) => {
          if (!disposed) {
            setSearch({ ...result, query });
            setSearchState("");
          }
        })
        .catch(() => {
          if (!disposed) setSearchState("Search failed. Change your search or retry.");
        });
    }, 300);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [query, revision]);
  useEffect(() => {
    if (!peer) return;
    let disposed = false;
    let busy = false;
    let after = 0;
    setMessages([]);
    setHistoryError("");
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        let batch: ChatMessage[];
        do {
          const result = await chatAPI.thread(peer.id, after);
          if (disposed) return;
          batch = result.messages;
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
    setQuery("");
    setDraft("");
    setHistoryError("");
  }
  async function send() {
    if (!peer || sending || !draft.trim() || peer.deleted) return;
    const target = peer.id,
      text = draft;
    if (!pending.current || pending.current.peer !== target || pending.current.text !== text)
      pending.current = { peer: target, text, key: crypto.randomUUID() };
    setSending(true);
    setHistoryError("");
    try {
      await chatAPI.send(target, text, pending.current.key);
      pending.current = undefined;
      if (current.current.peer === target) setDraft("");
      setRevision((n) => n + 1);
    } catch (failure) {
      setHistoryError(failure instanceof Error ? failure.message : "Send failed. Retry");
    } finally {
      setSending(false);
    }
  }
  const people = [
    ...(snapshot?.pinned ? [snapshot.pinned] : []),
    ...(snapshot?.acquaintances ?? []),
    ...(snapshot?.suggested ?? []),
  ];
  const selected = peer
    ? (people.find((p) => p.id === peer.id) ?? search?.users.find((p) => p.id === peer.id) ?? peer)
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
                <p>{message.text}</p>
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
