import { PauseMenu } from "@/components/PauseMenu";
import { RotateCcw } from "lucide-react";
import { Button } from "./ui/button";

export function LongDrivePauseMenu({
  onResume,
  onRestart,
}: {
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <PauseMenu mode="long-drive" onResume={onResume}>
      <Button variant="multiplayer" className="min-h-11" onClick={onRestart}>
        <RotateCcw aria-hidden="true" />
        Restart
      </Button>
    </PauseMenu>
  );
}
