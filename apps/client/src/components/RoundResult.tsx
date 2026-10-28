import {
  type Outcome,
  OutcomeResultAbandoned,
  OutcomeResultTie,
} from "@dashdevil/contracts/protocol";
import { Crown } from "lucide-react";

import portrait from "@/assets/racer-portrait.png";

export function RoundResult({ outcome, local }: { outcome: Outcome; local: number }) {
  const neutral = outcome.result >= 2;
  const result =
    outcome.result === OutcomeResultAbandoned
      ? "Round Abandoned"
      : outcome.result === OutcomeResultTie
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
            <img src={portrait} alt="" />
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
