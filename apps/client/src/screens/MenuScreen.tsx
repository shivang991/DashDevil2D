import { Avatar } from "@/components/Avatar";
import { MenuItem } from "@/components/MenuItem";
import type { Account } from "@/transport/account";
import { ProfileDialog } from "./ProfileDialog";

interface MenuScreenProps {
  playerName?: string;
  account?: Account;
  onLogin?: () => void;
  onLogout?: () => Promise<void>;
  onAccountSaved?: (account: Account) => void;
  onStartGame: () => void;
  onMultiplayer: (mode: 1 | 2) => void;
}

export function MenuScreen({
  onStartGame,
  onMultiplayer,
  playerName,
  account,
  onLogin,
  onLogout,
  onAccountSaved,
}: MenuScreenProps) {
  const authenticated = Boolean(account && !account.mustChangePassword);
  return (
    <div className="flex items-center justify-center w-full min-h-dvh bg-neutral-950">
      <div className="flex flex-col w-full max-w-96 gap-6 p-6 pb-20">
        {/* Branding */}
        <div className="flex items-center justify-center px-6 py-8 rounded-xl border border-neutral-700">
          <h1 className="text-white text-xl tracking-wide">Branding</h1>
        </div>

        <div className="flex items-center gap-3 text-neutral-400 text-sm">
          {account && <Avatar username={account.username} avatar={account.avatar} />}
          <span>{account?.username ?? playerName ?? "Guest"}</span>
        </div>
        {authenticated && account && onLogout && (
          <div className="flex gap-3">
            <ProfileDialog account={account} onLogout={onLogout} onSaved={onAccountSaved} />
            <button
              disabled
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-500"
            >
              Chat · Coming soon
            </button>
          </div>
        )}
        {/* Menu items */}
        <div className="flex flex-col gap-3">
          <MenuItem title="Long Drive" subtitle="Single player runner" onClick={onStartGame} />
          <MenuItem
            title="Drag Race"
            disabled={!authenticated}
            subtitle="Private two-player race"
            onClick={() => onMultiplayer(1)}
          />
          <MenuItem
            title="Road Rage"
            disabled={!authenticated}
            subtitle="Multiplayer aggressive run"
            onClick={() => onMultiplayer(2)}
          />
        </div>
        {!authenticated && (
          <button onClick={onLogin} className="text-sm text-blue-400 underline">
            Login to play multiplayer
          </button>
        )}
      </div>
    </div>
  );
}
