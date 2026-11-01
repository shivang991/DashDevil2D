import { ModeRoadRage } from "@dashdevil/contracts/protocol";
import type { MultiplayerMode } from "@/transport/PairedConnection";

export const multiplayerPath = (mode: MultiplayerMode) =>
  mode === ModeRoadRage ? "/multiplayer/road-rage" : "/multiplayer/drag-race";
