import {
  type Outcome,
  OutcomeResultAbandoned,
  OutcomeResultTie,
} from "@dashdevil/contracts/protocol";
import { Crown } from "lucide-react";
import type { RacerIdentity } from "@dashdevil/contracts/protocol";
import { Avatar } from "./Avatar";

export function RoundResult({
  outcome,
  local,
  identities,
}: {
  outcome: Outcome;
  local: number;
  identities?: RacerIdentity[];
}) {
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
    <div className="flex flex-col items-center">
      <div
        className={`relative flex w-[208px] justify-center ${neutral ? "mt-6 h-[180px] items-center" : "mt-[18px] h-[205px] items-end"}`}
        aria-hidden="true"
      >
        {!neutral && (
          <Crown
            className="absolute top-px left-1/2 z-1 size-[55px] -translate-x-1/2 text-[#d9b968]"
            fill="currentColor"
            strokeWidth={1.5}
          />
        )}
        {seats.map((seat) => (
          <div
            key={seat}
            className={`grid [place-items:end_center] overflow-hidden rounded-full border-2 border-[#d2d0ca] ${seat === 1 ? "bg-[#24513c]" : "bg-[#642d2b]"} ${neutral ? "absolute size-[130px] first:left-0 last:right-0" : "relative size-[142px]"}`}
          >
            <Avatar
              className="h-full w-full border-0 bg-transparent text-[2.5rem]"
              imageClassName="object-bottom [image-rendering:auto]"
              username={identities?.[seat]?.name ?? `Player_${seat + 1}`}
              avatar={identities?.[seat]?.avatar}
            />
          </div>
        ))}
      </div>
      <p
        className="mt-[30px] font-heading text-[clamp(32px,7vw,42px)] leading-[1.1] font-light text-[#e2dfda]"
        role="status"
      >
        {result}
      </p>
      <pre hidden data-testid="outcome-evidence">
        {JSON.stringify(outcome)}
      </pre>
    </div>
  );
}
