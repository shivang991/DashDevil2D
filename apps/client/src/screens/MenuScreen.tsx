import { useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Gamepad, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { ModeDragRace, ModeRoadRage } from "@dashdevil/contracts/protocol";
import type { MultiplayerMode } from "@/game/multiplayer/PairedConnection";
import { MenuItem } from "@/components/MenuItem";
import type { Account } from "@/transport/account";
import { RaceHistoryDialog } from "./RaceHistoryDialog";
import { ProfileDialog } from "./ProfileDialog";

interface MenuScreenProps {
  playerName?: string;
  account?: Account;
  onAdmin?: () => void;
  onLogin?: () => void;
  onLogout?: () => Promise<void>;
  onAccountSaved?: (account: Account) => void;
  onStartGame: () => void;
  onMultiplayer: (mode: MultiplayerMode) => void;
}

export function MenuScreen({
  onStartGame,
  onMultiplayer,
  account,
  onLogin,
  onAdmin,
  onLogout,
  onAccountSaved,
}: MenuScreenProps) {
  const [dialog, setDialog] = useState<"profile" | "history">();
  const trigger = useRef<HTMLButtonElement>(null);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  function restoreFocus(event: Event) {
    event.preventDefault();
    trigger.current?.focus();
  }
  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await onLogout?.();
    } catch (failure) {
      setLogoutError(failure instanceof Error ? failure.message : "Unable to log out. Try again");
    } finally {
      setLoggingOut(false);
    }
  }
  const authenticated = Boolean(account && !account.mustChangePassword);
  return (
    <div className="flex items-center justify-center w-full min-h-dvh bg-neutral-950">
      <div className="flex flex-col w-full max-w-96 gap-6 p-6 pb-20">
        {/* Branding */}
        <div className="flex items-center justify-center px-6 py-8 rounded-xl border border-neutral-700">
          <h1 className="text-white text-xl tracking-wide">Branding</h1>
        </div>

        {authenticated && account && (
          <>
            <div className="flex items-center justify-between gap-3 text-neutral-400 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar username={account.username} avatar={account.avatar} />
                <span className="truncate">{account.username}</span>
              </div>
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <Button ref={trigger} variant="multiplayer" size="icon" aria-label="Account menu">
                    <Menu />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    collisionPadding={16}
                    onCloseAutoFocus={(event) => {
                      if (dialog) event.preventDefault();
                    }}
                    className="z-40 flex w-56 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl border border-neutral-600 bg-neutral-950 p-3 text-white shadow-lg"
                  >
                    <DropdownMenu.Item asChild onSelect={() => setDialog("profile")}>
                      <Button
                        variant="multiplayer"
                        iconLeft={User}
                        dividerLeft
                        className="justify-start focus:bg-neutral-800 focus:outline-2 focus:outline-white"
                      >
                        Profile
                      </Button>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild onSelect={() => setDialog("history")}>
                      <Button
                        variant="multiplayer"
                        iconLeft={Gamepad}
                        dividerLeft
                        className="justify-start focus:bg-neutral-800 focus:outline-2 focus:outline-white"
                      >
                        Race History
                      </Button>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      asChild
                      disabled={!onLogout || loggingOut}
                      onSelect={() => void logout()}
                    >
                      <Button
                        variant="danger-outlined"
                        iconLeft={LogOut}
                        dividerLeft
                        disabled={!onLogout || loggingOut}
                        className="justify-start focus:bg-destructive/10 focus:outline-2 focus:outline-current"
                      >
                        Logout
                      </Button>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            {dialog === "profile" && (
              <ProfileDialog
                account={account}
                open
                onOpenChange={(open) => setDialog(open ? "profile" : undefined)}
                onCloseAutoFocus={restoreFocus}
                onSaved={onAccountSaved}
              />
            )}
            <RaceHistoryDialog
              key={account.id}
              authenticated
              open={dialog === "history"}
              onOpenChange={(open) => setDialog(open ? "history" : undefined)}
              onCloseAutoFocus={restoreFocus}
            />
            {logoutError && (
              <p role="alert" className="text-sm text-red-400">
                {logoutError}
              </p>
            )}
          </>
        )}
        {/* Menu items */}
        <div className="flex flex-col gap-3">
          <MenuItem title="Long Drive" subtitle="Single player runner" onClick={onStartGame} />
          <MenuItem
            title="Drag Race"
            disabled={!authenticated}
            subtitle="Private two-player race"
            onClick={() => onMultiplayer(ModeDragRace)}
          />
          <MenuItem
            title="Road Rage"
            disabled={!authenticated}
            subtitle="Multiplayer aggressive run"
            onClick={() => onMultiplayer(ModeRoadRage)}
          />
        </div>
        {authenticated && account?.admin && onAdmin && (
          <Button variant="multiplayer" onClick={onAdmin}>
            Admin
          </Button>
        )}
        {!authenticated && (
          <button onClick={onLogin} className="text-sm text-blue-400 underline">
            Login to play multiplayer
          </button>
        )}
      </div>
    </div>
  );
}
