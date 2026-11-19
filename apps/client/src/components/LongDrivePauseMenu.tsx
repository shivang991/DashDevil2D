import { PauseMenu } from "@/components/PauseMenu";
export function LongDrivePauseMenu({ onResume }: { onResume: () => void; onRestart: () => void }) {
  return (
    <PauseMenu mode="long-drive" onResume={onResume}>
      {null}
    </PauseMenu>
  );
}
