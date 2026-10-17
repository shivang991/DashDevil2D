// Run from apps/client: node --import tsx ../../docs/preservation/evidence/finality/cross-tick-probe.mjs
import assert from 'node:assert/strict';
import { Multiplayer } from '../../../../packages/simulation/multiplayer.ts';
import { captureConfiguration } from '../../../../packages/simulation/config.ts';
const ids = [0, 1].map(seat => ({ roomId: 1, seatSession: seat + 1, pairGeneration: 1, seat }));
const game = new Multiplayer(captureConfiguration('drag-race', { gameplay: { finishDistance: 400, initialClearDistance: 0, reservedHearts: 0, obstacleWeight: 0, emptyWeight: 1 } }), 1, ids);
const cars = game.snapshot().cars;
cars[0].progress = 353.33336;
cars[1].progress = 353.33328;
game.restore(cars, 0);
game.advanceTo(1);
const actual = game.snapshot().finish;
const expected = { tick: 2, timeUs: 16667, result: 2 };
console.log(JSON.stringify({ actual, expected, seed: 1, crossingsUs: [16666.6, 16666.8], tickBoundaryUs: 1000000 / 60 }));
assert.deepEqual(actual, expected);
