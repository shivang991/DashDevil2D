import type { Account, ManagedUser } from "@/transport/account";
import type { ChatPerson, ChatSnapshot } from "@/transport/chat";

export const account: Account = {
  id: 900001,
  username: "Driver_01",
  admin: false,
  mustChangePassword: false,
  expires: "2099-12-01T00:00:00Z",
};
export const managedUsers: ManagedUser[] = [
  {
    ...account,
    admin: true,
    createdAt: "2026-01-01T12:00:00Z",
    lastSeenAt: "2026-01-02T12:00:00Z",
  },
  { ...account, id: 900002, username: "Driver_02", createdAt: null, lastSeenAt: null },
];
export const peer: ChatPerson = {
  id: 900002,
  username: "Driver_02",
  avatar: "",
  deleted: false,
  presence: "Lobby",
  unread: 2,
  lastMessage: 1,
  rounds: 3,
};
export const chatSnapshot: ChatSnapshot = {
  self: account.id,
  selected: null,
  pinned: peer,
  acquaintances: [],
  suggested: [{ ...peer, id: 900003, username: "Driver_03", presence: "Offline", unread: 0 }],
  unread: 2,
};
