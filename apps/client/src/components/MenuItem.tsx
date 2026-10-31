import { ArrowRight } from "lucide-react";

interface MenuItemProps {
  title: string;
  subtitle: string;
  onClick?: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

export function MenuItem({ title, subtitle, onClick, disabled, comingSoon }: MenuItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left ${
          disabled
            ? "border-neutral-700 opacity-50 cursor-not-allowed"
            : "border-neutral-600 hover:border-neutral-400 hover:bg-neutral-800 cursor-pointer"
        }`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-white text-sm font-light">{title}</span>
          <span className="text-neutral-400 text-xs">{subtitle}</span>
        </div>
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full border ${disabled ? "border-neutral-700" : "border-neutral-500"}`}
        >
          <ArrowRight className="w-4 h-4 text-white" />
        </div>
      </button>
      {comingSoon && <span className="text-blue-400 text-xs px-1">Coming Soon</span>}
    </div>
  );
}
