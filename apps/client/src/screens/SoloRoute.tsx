import { useBlocker } from "react-router";
import { GameWorld } from "@/components/GameWorld";
import { NavigationConfirmation } from "./NavigationConfirmation";

export function SoloRoute(props: { countdown: 5 | 3; onBack: () => void }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname,
  );
  return (
    <>
      <GameWorld {...props} />
      <NavigationConfirmation blocker={blocker} />
    </>
  );
}
