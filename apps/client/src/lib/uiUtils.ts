import { ModeRoadRage } from "@dashdevil/contracts/protocol";
import type { MultiplayerMode } from "@/transport/PairedConnection";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const multiplayerPath = (mode: MultiplayerMode) =>
  mode === ModeRoadRage ? "/multiplayer/road-rage" : "/multiplayer/drag-race";
