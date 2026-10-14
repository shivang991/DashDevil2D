import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createLongDrive, advanceLongDrive, type LongDrive } from '../../../packages/simulation/longDrive';
import { makeInitialState, type GameState } from '../../../packages/simulation/state';
import { KeyboardInput } from '../../src/game/KeyboardInput';

// Approved simulation/input seams (#17): retained contract cases use controlled
// platform clock/randomness and initial headless objects; app sessions expose no
// arbitrary state setter. Actual GameWorld/lifecycle behavior is browser-tested.
interface FixtureContext { gameState: GameState; updateGameState(partial: Partial<GameState>): void; resetGameState(): void }
let context: FixtureContext;
let game: LongDrive;
let input: KeyboardInput;
let now = 0;
let lastTime = 0;
let nextFrame: FrameRequestCallback;
let firstMount = true;
let away = false;
let restartPending = false;
function act(run: () => void) { run(); }
function loseFocus() {
  away = true; input.clear(); game.state.accelerating = false;
  if (game.state.status === 'playing' && !game.state.paused) advanceLongDrive(game, 0, { pause: true });
}
function restoreFocus() { away = false; lastTime = now; }
function key(key: string, type = 'keydown', repeat = false) {
  window.dispatchEvent(new KeyboardEvent(type, { key, repeat, cancelable: true }));
}
function frame(fps: number) {
  act(() => { now += 1000 / fps; nextFrame(now); });
}
function advance(seconds: number, fps: number) {
  for (let i = 0; i < Math.round(seconds * fps); i++) frame(fps);
}
function playing() { act(() => context.updateGameState({ status: 'playing', paused: false, canvasWidth: 606, canvasHeight: 802, roadWidthRatio: 0.6, carYBase: 682, carY: 682 })); }
function object(lane = 1, height = 40, width = 48) { return { lane, y: 680, height, width }; }
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  now = 0; lastTime = 0; away = false; restartPending = false;
  game = createLongDrive(() => Math.random());
  context = { gameState: game.state, updateGameState: partial => { Object.assign(game.state, partial); }, resetGameState: () => {
    Object.assign(game.state, makeInitialState(() => Math.random()), { countdownTimer: 3 });
  } };
  const surface = document.createElement('canvas'); surface.tabIndex = 0; document.body.append(surface); surface.focus();
  input = new KeyboardInput(surface, () => ({ status: game.state.status, paused: game.state.paused, restartable: game.state.gameOverAnimDone, suspended: away || document.hidden }), command => {
    input.clear();
    if (command === 'pause') advanceLongDrive(game, 0, { pause: true });
    else restartPending = true;
  });
  window.addEventListener('blur', loseFocus); window.addEventListener('focus', restoreFocus);
  nextFrame = time => {
    const dt = Math.max(0, (time - lastTime) / 1000); lastTime = time;
    const phase = game.state.status;
    advanceLongDrive(game, away || document.hidden ? 0 : dt, { ...input.read(), restart: restartPending });
    restartPending = false;
    if (phase !== game.state.status) input.clear();
  };
  if (firstMount) {
    expect(context.gameState).toMatchObject({ health: 2, score: 0, currentLane: 1, coins: [], obstacles: [], roadSpeed: 400, spawnInterval: 1, status: "countdown", countdownTimer: 5 });
    firstMount = false;
  }
  context.resetGameState();
});
afterEach(() => { input.dispose(); window.removeEventListener('blur', loseFocus); window.removeEventListener('focus', restoreFocus); document.body.replaceChildren(); vi.restoreAllMocks(); });
for (const fps of [30, 60, 120]) {
  test(`${fps} FPS: reset gives three-second stationary countdown within 50 ms`, () => {
    expect(context.gameState).toMatchObject({ health: 2, score: 0, currentLane: 1, status: 'countdown', countdownTimer: 3 });
    advance(2.9, fps);
    expect(context.gameState.status).toBe('countdown');
    expect(context.gameState.roadOffset).toBe(0);
    advance(0.1, fps);
    if (context.gameState.status === 'countdown') frame(fps);
    expect(now).toBeLessThanOrEqual(3050);
    expect(context.gameState.status).toBe('playing');
  });
  test(`${fps} FPS: held steering respects lane bounds and latest-key release`, () => {
    playing(); key('ArrowUp'); frame(fps);
    expect(context.gameState.accelerating).toBe(true);
    key('ArrowLeft'); advance(0.5, fps);
    expect(context.gameState.currentLane).toBe(0);
    expect(context.gameState.accelerating).toBe(false);
    key('ArrowLeft', 'keyup'); frame(fps);
    expect(context.gameState.accelerating).toBe(false);
    key('d'); advance(0.5, fps);
    expect(context.gameState.currentLane).toBe(2);
  });
  test(`${fps} FPS: coin on fatal contact counts and is consumed`, () => {
    playing(); act(() => context.updateGameState({ health: 1, coins: [object(1, 28, 28)], obstacles: [object()] })); frame(fps);
    expect(context.gameState).toMatchObject({ score: 10, health: 0, coins: [], obstacles: [], status: 'gameover' });
    advance(0.55, fps);
    expect(context.gameState.gameOverAnimDone).toBe(true);
    key('Enter'); frame(fps);
    expect(context.gameState).toMatchObject({ score: 0, health: 2, currentLane: 1, roadSpeed: 400, spawnInterval: 1, status: 'countdown', countdownTimer: 3 });
  });
  test(`${fps} FPS: invincible contact consumes obstacle and coin without damage`, () => {
    playing(); act(() => context.updateGameState({ invincibleTimer: 1, coins: [object(1, 28, 28)], obstacles: [object()] })); frame(fps);
    expect(context.gameState).toMatchObject({ health: 2, score: 10, coins: [], obstacles: [] });
  });
  test(`${fps} FPS: pause freezes road, spawns, difficulty and lane movement`, () => {
    playing(); key(' '); frame(fps);
    const before = structuredClone(context.gameState);
    key('ArrowLeft'); advance(2, fps);
    expect(context.gameState).toMatchObject({ paused: true, roadOffset: before.roadOffset, spawnTimer: before.spawnTimer, difficultyTimer: before.difficultyTimer, visualLane: before.visualLane });
  });
}
for (const fps of [30, 60, 120]) {
  test(`${fps} FPS: tenfold acceleration and release easing`, () => {
    playing(); advance(0.5, fps); expect(context.gameState.roadOffset).toBeCloseTo(200, 8);
    key('w'); const before = context.gameState.roadOffset; advance(0.5, fps);
    expect(context.gameState.roadOffset - before).toBeCloseTo(2000, 8);
    expect(context.gameState.carY).toBeGreaterThanOrEqual(602); expect(context.gameState.carY).toBeLessThan(604);
    key('w', 'keyup'); advance(0.5, fps); expect(context.gameState.accelerating).toBe(false); expect(context.gameState.carY).toBeGreaterThan(680);
  });
  test(`${fps} FPS: one-second spawn/difficulty and caps`, () => {
    playing(); advance(0.9, fps); expect(context.gameState.obstacles).toHaveLength(0);
    while (now < 1050 && context.gameState.roadSpeed === 400) frame(fps);
    expect(context.gameState.obstacles).toHaveLength(1); expect(context.gameState.obstacles[0].lane).toBe(1);
    expect(context.gameState).toMatchObject({ roadSpeed: 415, spawnInterval: 0.97 });
    act(() => context.updateGameState({ currentLane: 0, visualLane: 0 })); advance(40, fps);
    expect(context.gameState).toMatchObject({ roadSpeed: 900, spawnInterval: 0.35, health: 2 });
  });
  test(`${fps} FPS: nonfatal protection expires within 50 ms`, () => {
    playing(); act(() => context.updateGameState({ obstacles: [object()] })); frame(fps);
    expect(context.gameState).toMatchObject({ health: 1, invincibleTimer: 2, shakeTimer: 0.5 });
    const damagedAt = now;
    // Observe the first expiry transition, rather than rounding a requested delay
    // into extra frames and accidentally accepting late protection expiry.
    while (context.gameState.invincibleTimer > 0 && now - damagedAt < 2100) frame(fps);
    const elapsedMs = Math.round((now - damagedAt) * 1e6) / 1e6;
    expect(context.gameState.invincibleTimer).toBe(0);
    expect(elapsedMs).toBeGreaterThanOrEqual(1950);
    expect(elapsedMs).toBeLessThanOrEqual(2050);
    expect(context.gameState.carVisible).toBe(true);
    console.info(`First invincibility expiry: ${fps} FPS, ${elapsedMs} ms active time after damage`);
  });
  test(`${fps} FPS: strict edge needs actual overlap`, () => {
    playing(); act(() => context.updateGameState({ roadSpeed: 0, coins: [{ lane: 1, y: 654, width: 28, height: 28 }] })); frame(fps); expect(context.gameState.score).toBe(0);
    act(() => context.updateGameState({ coins: [{ lane: 1, y: 654.001, width: 28, height: 28 }] })); frame(fps); expect(context.gameState.score).toBe(10);
  });
}
// Later owning slices must use PRESERVATION_ENFORCE=22,23,26 (or all).
function correction(owner: number, name: string, run: () => void) {
  const enforce = ['22', '23', ...(process.env.PRESERVATION_ENFORCE?.split(',') ?? [])];
  (enforce.includes(String(owner)) || enforce.includes('all') ? test : test.fails)(`correction #${owner}: ${name}`, run);
}
correction(22, 'pause freezes shake', () => { playing(); act(() => context.updateGameState({ paused: true, shakeTimer: 0.5 })); advance(0.2, 60); expect(context.gameState.shakeTimer).toBe(0.5); });
correction(22, 'fatal overlaps clamp HP', () => { playing(); act(() => context.updateGameState({ health: 1, obstacles: [object(), object()] })); frame(60); expect(context.gameState.health).toBe(0); });
correction(23, 'blur pauses and clears acceleration', () => { playing(); key('w'); frame(60); window.dispatchEvent(new Event('blur')); frame(60); expect(context.gameState).toMatchObject({ paused: true, accelerating: false }); });
correction(23, 'Space repeat ignored', () => { playing(); key(' ', 'keydown', true); frame(60); expect(context.gameState.paused).toBe(false); });
correction(23, 'early pause discarded', () => { key(' '); advance(3.1, 60); expect(context.gameState.paused).toBe(false); });
correction(26, 'swept collision detects tunneling', () => { playing(); act(() => context.updateGameState({ roadSpeed: 900, obstacles: [{ lane: 1, y: 550, width: 48, height: 40 }] })); key('w'); frame(30); expect(context.gameState.health).toBe(1); });
for (const fps of [30, 60, 120]) {
  test(`${fps} FPS: scripted uniform lane thirds and coin probability boundary`, () => {
    playing();
    for (const [sample, lane] of [[0, 0], [0.34, 1], [0.99, 2]]) {
      act(() => context.updateGameState({ coins: [], obstacles: [], spawnTimer: 1 }));
      vi.mocked(Math.random).mockReturnValueOnce(sample).mockReturnValueOnce(0.449999);
      frame(fps);
      expect(context.gameState.coins).toHaveLength(1);
      expect(context.gameState.coins[0].lane).toBe(lane);
    }
    act(() => context.updateGameState({ coins: [], obstacles: [], spawnTimer: 1 }));
    vi.mocked(Math.random).mockReturnValueOnce(0.5).mockReturnValueOnce(0.45);
    frame(fps);
    expect(context.gameState.coins).toHaveLength(0);
    expect(context.gameState.obstacles).toHaveLength(1);
  });
}
for (const fps of [30, 60, 120]) {
  test(`${fps} FPS: aliases repeat targets after 150 ms and effects finish`, () => {
    playing(); key('a'); advance(0.2, fps); expect(context.gameState.currentLane).toBe(0);
    key('d'); frame(fps); expect(context.gameState.currentLane).toBe(1);
    advance(0.1, fps); expect(context.gameState.currentLane).toBe(1);
    advance(0.1, fps); expect(context.gameState.currentLane).toBe(2);
    key('d', 'keyup'); act(() => context.updateGameState({ currentLane: 1, visualLane: 1, obstacles: [object()] })); frame(fps);
    advance(0.35, fps); expect(context.gameState.carVisible).toBe(false);
    advance(0.35, fps); expect(context.gameState.carVisible).toBe(true); expect(context.gameState.shakeTimer).toBe(0);
    advance(1.4, fps); expect(context.gameState.invincibleTimer).toBe(0);
  });
  test(`${fps} FPS: actual vertical and interpolated lateral bounds ignore tilt`, () => {
    playing(); act(() => context.updateGameState({ roadSpeed: 0, carTilt: 1, currentLane: 0.67, visualLane: 0.67, coins: [object(1, 28, 28)] })); frame(fps); expect(context.gameState.score).toBe(0);
    act(() => context.updateGameState({ currentLane: 0.68, visualLane: 0.68 })); frame(fps); expect(context.gameState.score).toBe(10);
    act(() => context.updateGameState({ currentLane: 1, visualLane: 1, carY: 602, carYBase: 602, coins: [{ lane: 1, y: 682, width: 28, height: 28 }] })); frame(fps); expect(context.gameState.score).toBe(10);
    act(() => context.updateGameState({ coins: [{ lane: 1, y: 681.999, width: 28, height: 28 }] })); frame(fps); expect(context.gameState.score).toBe(20);
  });
  test(`${fps} FPS: fatal event freezes road and delays overlay until shake/fade finish`, () => {
    playing(); act(() => context.updateGameState({ health: 1, obstacles: [object()] })); frame(fps);
    const before = structuredClone(context.gameState);
    expect(context.gameState.gameOverAnimDone).toBe(false); advance(0.3, fps);
    expect(context.gameState.gameOverAnimDone).toBe(false);
    expect(context.gameState).toMatchObject({ roadOffset: before.roadOffset, spawnTimer: before.spawnTimer, difficultyTimer: before.difficultyTimer, currentLane: before.currentLane });
    advance(0.25, fps); expect(context.gameState).toMatchObject({ gameOverAnimDone: true, gameOverFadeAlpha: 0.75, shakeTimer: 0 });
  });
}
correction(23, 'hidden countdown freezes until return', () => {
  const before = context.gameState.countdownTimer;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange')); advance(1, 60);
  expect(context.gameState.countdownTimer).toBe(before);
});
correction(23, 'keyboard movement prevents browser defaults', () => {
  playing();
  const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
});

test('restart clears a pause entered during gameover before the new countdown', () => {
  playing();
  act(() => context.updateGameState({ health: 1, obstacles: [object()] }));
  frame(60);
  key(' ');
  advance(0.55, 60);
  key('Enter'); frame(60);
  expect(context.gameState.status).toBe('countdown');
  advance(3.05, 60);
  expect(context.gameState).toMatchObject({ status: 'playing', paused: false });
});

