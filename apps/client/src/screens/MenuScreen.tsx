import { localName } from "@/transport/localName";
import { MenuItem } from "@/components/MenuItem";

interface MenuScreenProps {
  playerName?: string;
  onStartGame: () => void;
  onMultiplayer: (mode: 1 | 2) => void;
}

export function MenuScreen({ onStartGame, onMultiplayer, playerName }: MenuScreenProps) {
  return (
    <div className="flex items-center justify-center w-screen h-screen bg-neutral-950 overflow-hidden">
      <div className="flex flex-col w-[320px] sm:w-96 gap-6 p-6">
        {/* Branding */}
        <div className="flex items-center justify-center px-6 py-8 rounded-xl border border-neutral-700">
          <h1 className="text-white text-xl tracking-wide">Branding</h1>
        </div>

        <p className="text-neutral-400 text-sm">{playerName ?? localName()}</p>
        {/* Menu items */}
        <div className="flex flex-col gap-3">
          <MenuItem title="Long Drive" subtitle="Single player runner" onClick={onStartGame} />
          <MenuItem
            title="Drag Race"
            subtitle="Private two-player race"
            onClick={() => onMultiplayer(1)}
          />
          <MenuItem
            title="Road Rage"
            subtitle="Multiplayer aggressive run"
            onClick={() => onMultiplayer(2)}
          />
        </div>
      </div>
    </div>
  );
}
