import { connectionOptions, AccountError } from "./account";
export interface ChatPerson {
  id: number;
  username: string;
  avatar: string;
  deleted: boolean;
  presence: "Playing" | "Lobby" | "Active" | "Offline";
  unread: number;
  lastMessage: number;
  rounds: number;
}
export interface ChatMessage {
  id: number;
  sender: number;
  recipient: number;
  text: string;
  key: string;
  createdAt: number;
}
export interface ChatSnapshot {
  selected: ChatPerson | null;
  self: number;
  pinned: ChatPerson | null;
  acquaintances: ChatPerson[];
  suggested: ChatPerson[];
  unread: number;
}
async function request<T>(path: string, body?: object): Promise<T> {
  const { server } = await connectionOptions();
  const response = await fetch(`${server}/api/account/chat${path}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Chat unavailable. Retry shortly");
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("dashdevil-session-expired"));
    throw new AccountError(result.error ?? "Chat unavailable. Retry", response.status);
  }
  return result as T;
}
export const chatAPI = {
  sync: (client: string, activity: string, roomID?: number, peerID?: number) =>
    request<ChatSnapshot>("/sync", { client, activity, roomID, peerID }),
  search: (query: string) =>
    request<{ users: ChatPerson[]; total: number }>(`/search?q=${encodeURIComponent(query)}`),
  thread: (peer: number, after = 0) =>
    request<{ messages: ChatMessage[] }>(`/thread/${peer}?after=${after}`),
  send: (peer: number, text: string, key: string) =>
    request<ChatMessage>(`/thread/${peer}`, { text, key }),
  read: (peer: number, through: number) =>
    request<{ ok: boolean }>(`/thread/${peer}/read`, { through }),
};
