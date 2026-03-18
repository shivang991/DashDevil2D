import { ArrowRight } from "lucide-react";

interface MenuScreenProps {
  onStartGame: () => void;
}

interface MenuItemProps {
  title: string;
  subtitle: string;
  onClick?: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

function MenuItem({ title, subtitle, onClick, disabled, comingSoon }: MenuItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-colors text-left ${
          disabled
            ? "border-neutral-700 opacity-50 cursor-not-allowed"
            : "border-neutral-600 hover:border-neutral-400 hover:bg-neutral-800 cursor-pointer"
        }`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-white text-sm font-semibold">{title}</span>
          <span className="text-neutral-400 text-xs">{subtitle}</span>
        </div>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border ${disabled ? "border-neutral-700" : "border-neutral-500"}`}>
          <ArrowRight className="w-4 h-4 text-white" />
        </div>
      </button>
      {comingSoon && (
        <span className="text-blue-400 text-xs px-1">Coming Soon</span>
      )}
    </div>
  );
}

export function MenuScreen({ onStartGame }: MenuScreenProps) {
  return (
    <div className="flex items-center justify-center w-screen h-screen bg-neutral-950 overflow-hidden">
      <div className="flex flex-col w-[320px] sm:w-96 gap-6 p-6">
        {/* Branding */}
        <div className="flex items-center justify-center px-6 py-8 rounded-xl border border-neutral-700">
          <h1 className="text-white text-xl font-bold tracking-wide">Branding</h1>
        </div>

        {/* Menu items */}
        <div className="flex flex-col gap-3">
          <MenuItem
            title="Solo Trip"
            subtitle="Single player runner"
            onClick={onStartGame}
          />
          <MenuItem
            title="Road Rage"
            subtitle="Multiplayer aggressive run"
            disabled
            comingSoon
          />
        </div>
      </div>
    </div>
  );
}
