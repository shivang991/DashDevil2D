import type { ConnectionOptions } from "./PairedConnection";

export interface Account {
  id: number;
  username: string;
  admin: boolean;
  mustChangePassword: boolean;
  expires: string;
}
export async function connectionOptions(): Promise<ConnectionOptions> {
  if (!import.meta.env.DEV) return { server: location.origin };
  const response = await fetch("/__transport-config");
  if (!response.ok) throw new Error("Login unavailable. Try again shortly");
  return response.json() as Promise<ConnectionOptions>;
}
export class AccountError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function request<T>(path: string, body?: object): Promise<T> {
  const { server } = await connectionOptions();
  const response = await fetch(`${server}/api/account${path}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Login unavailable. Try again shortly");
  const result = await response.json();
  if (!response.ok)
    throw new AccountError(result.error ?? "Request failed. Try again", response.status);
  return result as T;
}
export const accountAPI = {
  current: () => request<Account>(""),
  login: (username: string, password: string) => request<Account>("/login", { username, password }),
  changeTemporaryPassword: (password: string) => request<Account>("/password", { password }),
  logout: () => request<{ ok: boolean }>("/logout", {}),
};
export function clearReconnectState() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("dashdevil-seat:")) sessionStorage.removeItem(key);
  } catch {
    /* storage optional */
  }
}
