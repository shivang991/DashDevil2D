import type { ComponentProps } from "react";
import { cn } from "@/lib/uiUtils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "w-full min-w-0 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-white focus-visible:outline-2 focus-visible:outline-white user-invalid:border-red-400 aria-invalid:border-red-400 disabled:opacity-50",
        className,
      )}
    />
  );
}
