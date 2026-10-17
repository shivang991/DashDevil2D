import type { Outcome } from '@dashdevil/contracts/protocol';

const reasons = ['Finish line', 'HP depleted', 'Time limit', 'Forfeit', 'Reconnect grace expired', 'Both players disconnected or left', 'Server simulation interrupted'];

export function RoundResult({ outcome, local }: { outcome: Outcome; local: number }) {
  return <div role="status" className="rounded-xl border border-red-400 bg-neutral-900 p-5">
    <h2 className="text-xl">Round result</h2>
    <p>{outcome.result === 3 ? 'Round abandoned' : outcome.result === 2 ? 'Tie' : outcome.result === local ? 'You won!' : 'You lost'}</p>
    <p>{reasons[outcome.reason]}</p>
    <p>Server confirmed · {(outcome.timeUs / 1e6).toFixed(3)} s</p>
    {outcome.cars.map((car, seat) => <p key={seat}>{seat === local ? 'You' : 'Opponent'} · Final HP {car.hp} · Score {car.score}</p>)}
    <details><summary>Result details</summary><pre data-testid="outcome-evidence" className="text-xs overflow-auto">{JSON.stringify(outcome)}</pre></details>
  </div>;
}
