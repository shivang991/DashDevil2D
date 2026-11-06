import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/uiUtils";

const colors = { error: "text-red-400", success: "text-green-400", info: "text-neutral-400" };

export function InlineFeedback({
  tone,
  children,
  retry,
  className,
}: {
  tone: keyof typeof colors;
  children: ReactNode;
  retry?: { onClick: () => void; label?: string; disabled?: boolean };
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("text-sm", colors[tone], className)}
    >
      {children}
      {retry && (
        <Button type="button" variant="text" disabled={retry.disabled} onClick={retry.onClick}>
          {retry.label ?? "Retry"}
        </Button>
      )}
    </div>
  );
}
