import { Button } from "./ui/button";
import { InlineFeedback } from "./ui/inline-feedback";
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
import { ChevronLeft, MessageCircle, X } from "lucide-react";
import { AppHeader } from "./AppHeader";
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

const chatBadge =
  "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[12px] bg-[#2563eb] px-[5px] font-chat text-[12px] text-white";
const chatError = "p-3 font-chat text-[14px]";
const chatField =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400 w-full rounded-[8px] border border-neutral-600 bg-neutral-950 p-2.5 font-chat text-[16px]";

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
      <div className="app-shell">
        <div className="app-content">{children}</div>
        <AppHeader>
          {account && !account.mustChangePassword ? (
            <ChatPanel
              key={account.id}
              account={account}
              visible={Boolean(visible)}
              playing={playing}
              pending={boundary?.path === pathname && boundary.pending}
              admissionFailure={boundary?.path === pathname ? boundary.admissionFailure : undefined}
              roomID={boundary?.path === pathname ? boundary.roomID : undefined}
            />
          ) : (
            <span title="Sign in to use chat">
              <button type="button" className="header-icon-button" aria-label="Open chat" disabled>
                <MessageCircle size={20} aria-hidden="true" />
              </button>
            </span>
          )}
        </AppHeader>
      </div>
    </Visibility.Provider>
  );
}
export function Presence({ value }: { value: ChatPerson["presence"] }) {
  return (
    <span
      className={`block font-chat text-[12px] ${value === "Offline" ? "text-neutral-400" : "text-[#60a5fa]"}`}
    >
      {value}
    </span>
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
    <Button
      variant="ghost"
      key={person.id}
      className="h-auto w-full justify-start whitespace-normal items-center gap-3 border-b border-neutral-800 px-1 py-2.5 text-left [&_strong]:text-[12px] [&_strong]:wrap-anywhere"
      aria-label={`Open conversation with ${person.username}`}
      onClick={() => open(person)}
    >
      <Avatar username={person.username} avatar={person.avatar} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <strong>{person.username}</strong>
        <Presence value={person.presence} />
      </span>
      {person.unread > 0 && (
        <span className={chatBadge}>
          {person.unread}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </Button>
  );
  const unavailableReason = playing
    ? "Chat unavailable during a race"
    : "Chat unavailable on this page";
  return (
    <>
      <span title={visible ? (expanded ? "Close chat" : "Open chat") : unavailableReason}>
        <button
          type="button"
          className="header-icon-button"
          aria-label={visible && expanded ? "Hide chat" : "Open chat"}
          aria-expanded={visible && expanded}
          disabled={!visible}
          onClick={() => toggle(!expanded)}
        >
          <MessageCircle size={20} aria-hidden="true" />
          {snapshot && snapshot.unread > 0 && (
            <span className="header-chat-badge">
              {snapshot.unread > 99 ? "99+" : snapshot.unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </button>
      </span>
      {visible && expanded && (
        <aside
          className="fixed right-4 z-60 border border-neutral-600 bg-neutral-900 text-[13px] text-neutral-50 top-[calc(var(--app-header-height,0px)_+_16px)] bottom-4 flex w-[380px] flex-col overflow-hidden rounded-[12px] shadow-[0_16px_48px_#0008] [@media(max-width:600px)]:inset-x-0 [@media(max-width:600px)]:bottom-0 [@media(max-width:600px)]:top-[var(--app-header-height,0px)] [@media(max-width:600px)]:w-full [@media(max-width:600px)]:rounded-none [@media(max-width:600px)]:border-0"
          aria-label="Chat"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") toggle(false);
          }}
          onKeyUp={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-neutral-700 px-4 py-3 [&_h2]:text-[18px]">
            <h2>Chat</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggle(false)}
              aria-label="Close chat"
            >
              <X size={24} aria-hidden="true" />
            </Button>
          </header>
          {error && (
            <InlineFeedback
              tone="error"
              className={chatError}
              retry={{ onClick: () => setRevision((n) => n + 1) }}
            >
              {error}
            </InlineFeedback>
          )}
          {selected ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-neutral-700 p-2 [&>div]:flex [&>div]:flex-col [&>div]:gap-1.5 [&_strong]:text-[12px] [&_strong]:wrap-anywhere">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPeer(undefined)}
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={24} aria-hidden="true" />
                </Button>
                <Avatar username={selected.username} avatar={selected.avatar} />
                <div>
                  <strong>{selected.username}</strong>
                  <Presence value={selected.presence} />
                </div>
              </div>
              <div
                className="min-h-0 flex-1 overflow-auto p-4 font-chat [&>p]:py-3 [&>p]:font-chat [&>p]:leading-normal [&>p]:text-neutral-400"
                aria-label="Messages"
              >
                {!activeMessages.length && !historyError && <p>No messages yet.</p>}
                {activeMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`mb-3 w-fit max-w-[90%] rounded-[10px] px-3 py-2.5 wrap-anywhere [&_p]:text-[15px] [&_p]:leading-[1.45] [&_p]:whitespace-pre-wrap [&_time]:mt-1.5 [&_time]:block [&_time]:text-[10px] [&_time]:text-neutral-400 ${message.sender === snapshot?.self ? "ml-auto mr-0 border border-[#3b82f6] bg-[#172235]" : "ml-0 mr-auto bg-neutral-800"}`}
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
                <InlineFeedback
                  tone="error"
                  className={chatError}
                  retry={{ onClick: () => setRevision((n) => n + 1) }}
                >
                  {historyError}
                </InlineFeedback>
              )}
              {sendError && (
                <InlineFeedback
                  tone="error"
                  className={chatError}
                  retry={{ disabled: sending, label: "Retry send", onClick: () => void send() }}
                >
                  {sendError}
                </InlineFeedback>
              )}
              {!selected.deleted && (
                <div className="border-t border-neutral-700 px-4 py-2 [&_p]:font-chat [&_p]:leading-[1.45]">
                  <Button
                    variant="chat"
                    disabled={playing || challengeBusy || admissionPending}
                    onClick={() => void challenge()}
                  >
                    {challengeBusy ? "Inviting…" : "Challenge"}
                  </Button>
                  {createOffer && (
                    <div>
                      <p>
                        Create a room to invite {selected.username}. You’ll choose the mode and
                        readiness in the lobby.
                      </p>
                      <Button
                        variant="chat"
                        onClick={() => {
                          setCreateOffer(false);
                          void navigate("/multiplayer/drag-race", {
                            state: { challengePeer: selected.id },
                          });
                        }}
                      >
                        Create room &amp; invite
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {selected.deleted ? (
                <p className="p-3 font-chat text-sm text-red-300">
                  This account was deleted. Shared messages remain available.
                </p>
              ) : (
                <form
                  className="border-t border-neutral-700 p-3 [&>div]:mt-2 [&>div]:flex [&>div]:items-center [&>div]:justify-between [&_small]:font-chat [&_small]:text-neutral-400"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                  }}
                >
                  <textarea
                    className={`${chatField} min-h-[76px] max-h-[180px] resize-y`}
                    aria-label="Message"
                    placeholder="Write a message"
                    value={draft}
                    maxLength={2000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <div>
                    <small>{draft.length}/2,000</small>
                    <Button variant="chat" disabled={sending || !draft.trim()} type="submit">
                      {sending ? "Sending…" : "Send"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="p-4 [&_label]:mb-2 [&_label]:block">
                <label htmlFor="chat-search">Search accounts</label>
                <input
                  className={chatField}
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
              <div className="overflow-y-auto px-4 pb-4 [&_section]:mb-6 [&_h3]:mb-2 [&_h3]:text-[12px] [&_h3]:text-neutral-400 [&_p]:py-3 [&_p]:font-chat [&_p]:leading-normal [&_p]:text-neutral-400">
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
                      <Button variant="chat" onClick={() => setRevision((n) => n + 1)}>
                        Retry search
                      </Button>
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
                    {!snapshot && <p>Loading conversations…</p>}
                    {snapshot && snapshot.acquaintances.length > 0 && (
                      <section>
                        <h3>Acquaintances</h3>
                        {snapshot.acquaintances.map(row)}
                      </section>
                    )}
                    {snapshot && snapshot.suggested.length > 0 && (
                      <section>
                        <h3>Suggested</h3>
                        {snapshot.suggested.map(row)}
                      </section>
                    )}
                    {snapshot && !people.length && <p>No chats found.</p>}
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      )}
    </>
  );
}
