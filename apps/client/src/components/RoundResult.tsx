import { Crown } from "lucide-react";
import type { Outcome } from "@dashdevil/contracts/protocol";
import type { Seat } from "@dashdevil/contracts/protocol";
import { Avatar } from "./Avatar";

export function RoundResult({
  outcome,
  local,
  identities,
}: {
  outcome: Outcome;
  local: number;
  identities?: Seat[];
}) {
  const neutral = outcome.result >= 2;
  const result =
    outcome.result === 3
      ? "Round Abandoned"
      : outcome.result === 2
        ? "Tie"
        : outcome.result === local
          ? "You Won"
          : "You Lost";
  const seats = neutral ? [1 - local, local] : [outcome.result];

  return (
    <div className="round-result">
      <div
        className={`round-result-portraits ${neutral ? "round-result-portraits--paired" : ""}`}
        aria-hidden="true"
      >
        {!neutral && <Crown className="round-result-crown" fill="currentColor" strokeWidth={1.5} />}
        {seats.map((seat) => (
          <div key={seat} className={`round-result-portrait round-result-portrait--seat-${seat}`}>
            <Avatar
              username={identities?.[seat]?.name ?? `Player_${seat + 1}`}
              avatar={identities?.[seat]?.avatar}
            />
          </div>
        ))}
      </div>
      <p className="round-result-message" role="status">
        {result}
      </p>
      <pre hidden data-testid="outcome-evidence">
        {JSON.stringify(outcome)}
      </pre>
    </div>
  );
}
