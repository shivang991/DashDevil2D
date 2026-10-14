// @vitest-environment node
import { expect, test } from 'vitest';
import { createLongDrive, advanceLongDrive, resetLongDrive } from '../../../packages/simulation/longDrive';
// Approved simulation state/events seam (#17). Literal defaults/timer outcomes
// come from #3's owner-approved preservation contract, not the implementation.
test('headless Long Drive starts stationary and advances difficulty on active seconds', () => {
  const game = createLongDrive(() => 0.5);
  expect(game.state).toMatchObject({ health: 2, score: 0, currentLane: 1, status: 'countdown', countdownTimer: 5 });
  advanceLongDrive(game, 5, {});
  expect(game.state).toMatchObject({ status: 'playing', roadOffset: 0, roadSpeed: 400 });
  advanceLongDrive(game, 3, {});
  expect(game.state).toMatchObject({ roadSpeed: 445, spawnInterval: 0.91 });
});

test('identified fatal contact events are emitted once, coins precede fatal damage', () => {
  const game = createLongDrive(() => 0.5);
  Object.assign(game.state, { status: 'playing', canvasWidth: 606, canvasHeight: 802, carY: 682, carYBase: 682, health: 1,
    coins: [{ id: 7, lane: 1, y: 680, width: 28, height: 28 }],
    obstacles: [{ id: 8, lane: 1, y: 680, width: 48, height: 40 }, { id: 9, lane: 1, y: 680, width: 48, height: 40 }] });
  const events = advanceLongDrive(game, 1 / 60, {});
  expect(events.map(event => event.type)).toEqual(['coin', 'damage', 'gameover']);
  expect(events.map(event => event.id)).toEqual([1, 2, 3]);
  expect(game.state).toMatchObject({ health: 0, score: 10, coins: [], obstacles: [], status: 'gameover' });
  expect(advanceLongDrive(game, 0.3, {})).toEqual([]);
  expect(game.state.gameOverAnimDone).toBe(false);
  advanceLongDrive(game, 0.2, {});
  expect(game.state.gameOverAnimDone).toBe(true);
});

test('pause boundary freezes every effect and active timer without consuming active time', () => {
  const game = createLongDrive(() => 0.5);
  Object.assign(game.state, { status: 'playing', invincibleTimer: 2, shakeTimer: 0.5 });
  advanceLongDrive(game, 0.2, {});
  expect(game.state.invincibleTimer).toBeCloseTo(1.8, 10);
  expect(game.state.shakeTimer).toBeCloseTo(0.3, 10);
  advanceLongDrive(game, 0.1, { pause: true });
  const before = structuredClone(game.state);
  const time = game.time;
  advanceLongDrive(game, 20, { steering: 'left', accelerating: true });
  expect(game.state).toEqual(before);
  expect(game.time).toBe(time);
  expect(game.state.invincibleTimer).toBeCloseTo(1.8, 10);
  expect(game.state.shakeTimer).toBeCloseTo(0.3, 10);
});

for (const fps of [30, 60, 120]) {
  test(`${fps} FPS retains fractional active-time remainder through difficulty milestones`, () => {
    const game = createLongDrive(() => 0.5);
    game.state.status = 'playing';
    // Literal n=22 and n=34 expectations independently reviewed against #3
    // (/private/tmp/dashdevil-implementation-context/stage2-expectations.md).
    for (let frame = 0; frame < 22 * fps; frame++) advanceLongDrive(game, 1 / fps, {});
    expect(game.state).toMatchObject({ roadSpeed: 730, spawnInterval: 0.35 });
    advanceLongDrive(game, 0.375, {});
    expect(game.state.difficultyTimer).toBeCloseTo(0.375, 10);
    advanceLongDrive(game, 11.625, {});
    expect(game.state).toMatchObject({ roadSpeed: 900, spawnInterval: 0.35 });
    expect(game.state.difficultyTimer).toBeCloseTo(0, 10);
    expect(game.state.health).toBe(2);
  });
  test(`${fps} FPS acceleration preserves tenfold travel and reference easing`, () => {
    const game = createLongDrive(() => 0.5);
    Object.assign(game.state, { status: 'playing', carY: 682, carYBase: 682 });
    for (let frame = 0; frame < fps / 2; frame++) advanceLongDrive(game, 1 / fps, { accelerating: true });
    expect(game.state.roadOffset).toBeCloseTo(2000, 8);
    // Worked baseline 60 Hz reference: 30 easing steps toward Y602 yields603.0930821051551.
    expect(game.state.carY).toBeCloseTo(603.0930821051551, 10);
  });
}

test('restart and explicit reset announce their first countdown cue exactly once', () => {
  const game = createLongDrive(() => 0.5);
  advanceLongDrive(game, 5, {});
  Object.assign(game.state, { status: 'gameover', gameOverAnimDone: true });
  expect(advanceLongDrive(game, 1 / 60, { restart: true }).map(event => event.type)).toEqual(['countdown']);
  expect(game.state.countdownTimer).toBe(3);
  expect(advanceLongDrive(game, 0.25, {})).toEqual([]);
  expect(advanceLongDrive(game, 0.75, {}).map(event => event.type)).toEqual(['countdown']);
  advanceLongDrive(game, 2, {});
  resetLongDrive(game);
  expect(advanceLongDrive(game, 1 / 60, {}).map(event => event.type)).toEqual(['countdown']);
});

for (const [fps, observedAt] of [[30, 0.03333333333333333], [60, 0.016666666666666666], [120, 0.008333333333333333]]) {
  test(`${fps} FPS event time is explicitly a local observation boundary`, () => {
    const game = createLongDrive(() => 0.5);
    game.state.status = 'playing';
    expect(advanceLongDrive(game, 1 / fps, { steering: 'left' })).toMatchObject([{ id: 1, type: 'lane', observedAt }]);
  });
}


test('simulation-owned reset restores fresh defaults and current viewport while preserving event identities', () => {
  let random = 0.5; const game = createLongDrive(() => random);
  Object.assign(game.state, { canvasWidth: 320, canvasHeight: 600, roadWidthRatio: 0.8 });
  const firstCue = advanceLongDrive(game, 0, {})[0];
  advanceLongDrive(game, 1, {}); random = 0.25;
  resetLongDrive(game);
  expect(game.state).toMatchObject({ canvasWidth: 320, canvasHeight: 600, roadWidthRatio: 0.8,
    carYBase: 480, carY: 480, countdownTimer: 3, status: 'countdown', paused: false,
    grassSeed: 1073741824, health: 2, score: 0, currentLane: 1, visualLane: 1, roadOffset: 0,
    coins: [], obstacles: [], invincibleTimer: 0, shakeTimer: 0, gameOverFadeAlpha: 0, gameOverAnimDone: false });
  const resetCue = advanceLongDrive(game, 0, {})[0];
  expect(resetCue.type).toBe('countdown'); expect(resetCue.id).toBeGreaterThan(firstCue.id);
  expect(advanceLongDrive(game, 0, {})).toEqual([]);
  resetLongDrive(game);
  expect(advanceLongDrive(game, 0, {})).toMatchObject([{ type: 'countdown', id: resetCue.id + 1 }]);
});

test('terminal restart uses the same fresh viewport and reset defaults as explicit reset', () => {
  let random = 0.5; const game = createLongDrive(() => random);
  advanceLongDrive(game, 0, {});
  Object.assign(game.state, { canvasWidth: 320, canvasHeight: 600, roadWidthRatio: 0.8,
    carYBase: 682, carY: 602, status: 'gameover', gameOverAnimDone: true, score: 50, health: 0 });
  random = 0.25;
  expect(advanceLongDrive(game, 1 / 60, { restart: true })).toMatchObject([{ type: 'countdown', id: 2 }]);
  expect(game.state).toMatchObject({ canvasWidth: 320, canvasHeight: 600, roadWidthRatio: 0.8,
    carYBase: 480, carY: 480, countdownTimer: 3, status: 'countdown', paused: false,
    grassSeed: 1073741824, health: 2, score: 0, currentLane: 1, visualLane: 1, roadOffset: 0,
    coins: [], obstacles: [], invincibleTimer: 0, shakeTimer: 0, gameOverFadeAlpha: 0, gameOverAnimDone: false });
  expect(advanceLongDrive(game, 0, {})).toEqual([]);
});
