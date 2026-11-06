import type { ReactNode } from "react";

export function FormField({
  label,
  children,
  hint,
  hintId,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: string;
  hintId?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2 text-sm">
        {label}
        {children}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
}
