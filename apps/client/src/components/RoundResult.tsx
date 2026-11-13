import {
  type Outcome,
  OutcomeResultAbandoned,
  OutcomeResultTie,
} from "@dashdevil/contracts/protocol";
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
          <svg
            viewBox="0 0 24 18"
            className="absolute top-0 left-1/2 size-14 -translate-x-1/2 text-[#d9bc66]"
            fill="currentColor"
            shapeRendering="crispEdges"
          >
            <path d="M0 2h4v4h4V0h8v6h4V2h4v12h-4v4H4v-4H0z" />
          </svg>
        )}
        {seats.map((seat) => (
          <div
            key={seat}
            className={`grid [place-items:end_center] overflow-hidden rounded-full border-2 border-[#d2d0ca] bg-[#242424] ${neutral ? "absolute size-[130px] first:left-0 last:right-0" : "relative size-[142px]"}`}
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
      <ol aria-label="Finishing order" className="mt-6 w-full text-sm text-neutral-400">
        {(neutral ? [0, 1] : [outcome.result, 1 - outcome.result]).map((seat, index) => (
          <li key={seat} className="flex justify-between gap-3 py-2">
            <span className="min-w-0 wrap-anywhere">
              {!neutral && `${index + 1}. `}
              {identities?.[seat]?.name ?? `Player_${seat + 1}`}
            </span>
            <span>{outcome.cars[seat]?.score ?? 0}</span>
          </li>
        ))}
      </ol>
      <pre hidden data-testid="outcome-evidence">
        {JSON.stringify(outcome)}
      </pre>
    </div>
  );
}
