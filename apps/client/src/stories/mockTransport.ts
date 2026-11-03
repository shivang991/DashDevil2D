import { mocked } from "storybook/test";
import { accountAPI, adminAPI, connectionOptions } from "@/transport/account";
import { chatAPI } from "@/transport/chat";
import { account, chatSnapshot, managedUsers } from "./accountFixtures";

// Fresh implementations per story. All mutations remain local mock calls.
export function resetTransportMocks() {
  mocked(connectionOptions).mockResolvedValue({ server: location.origin });
  mocked(accountAPI.current).mockResolvedValue(account);
  mocked(accountAPI.login).mockResolvedValue(account);
  mocked(accountAPI.changeTemporaryPassword).mockResolvedValue(account);
  mocked(accountAPI.changePassword).mockResolvedValue(account);
  mocked(accountAPI.updateProfile).mockImplementation(async (avatar) => ({
    ...account,
    avatar,
  }));
  mocked(accountAPI.logout).mockResolvedValue({ ok: true });
  mocked(adminAPI.users).mockResolvedValue({ users: managedUsers });
  mocked(adminAPI.create).mockImplementation(async (username) => ({
    user: { ...account, username, id: 900004, mustChangePassword: true },
    temporaryPassword: "storybook-only-password",
  }));
  mocked(adminAPI.update).mockImplementation(async (id, username, avatar) => ({
    ...account,
    id,
    username,
    avatar,
  }));
  mocked(adminAPI.reset).mockResolvedValue({ temporaryPassword: "storybook-only-password" });
  mocked(adminAPI.delete).mockResolvedValue({ ok: true });
  mocked(chatAPI.sync).mockResolvedValue(chatSnapshot);
  mocked(chatAPI.search).mockResolvedValue({ users: [], total: 0 });
  mocked(chatAPI.thread).mockResolvedValue({ messages: [], challenges: [] });
  mocked(chatAPI.read).mockResolvedValue({ ok: true });
  mocked(chatAPI.send).mockImplementation(async (peer, text, key) => ({
    id: 2,
    sender: account.id,
    recipient: peer,
    text,
    key,
    createdAt: Date.UTC(2026, 0, 1, 12),
  }));
  mocked(chatAPI.invite).mockImplementation(async (peer, _roomID, key) => ({
    id: 3,
    sender: account.id,
    recipient: peer,
    text: "Room challenge",
    key,
    createdAt: Date.UTC(2026, 0, 1, 12),
  }));
}
