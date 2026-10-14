import { afterEach, expect, test, vi } from 'vitest';
import { GameSession, type FrameClock } from '../../src/game/GameSession';

function clock() {
  let now = 0;
  let next = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const boundary: FrameClock = { now: () => now, request: fn => { frames.set(++next, fn); return next; }, cancel: id => { frames.delete(id); } };
  return { boundary, frames, elapse(seconds: number) { now += seconds * 1000; }, deliver(timestamp: number) { const ready = [...frames.values()]; frames.clear(); for (const callback of ready) callback(timestamp); }, jump(seconds: number) { now += seconds * 1000; const ready = [...frames.values()]; frames.clear(); for (const callback of ready) callback(now); }, advance(seconds: number, fps = 60) { for (let i = 0; i < Math.round(seconds * fps); i++) { now += 1000 / fps; const ready = [...frames.values()]; frames.clear(); for (const callback of ready) callback(now); } } };
}
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
test('independent sessions keep countdown, pause and reset state separate', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock();
  const canvasA = document.createElement('canvas'); const canvasB = document.createElement('canvas');
  document.body.append(canvasA, canvasB);
  const a = new GameSession({ mode: 'long-drive', canvas: canvasA, clock: time.boundary, countdown: 5, random: () => 0.5 });
  const b = new GameSession({ mode: 'long-drive', canvas: canvasB, clock: time.boundary, countdown: 3, random: () => 0.5 });
  a.start(); b.start(); time.advance(3);
  expect(a.getSnapshot()).toMatchObject({ status: 'countdown', countdown: 2, health: 2, score: 0 });
  expect(b.getSnapshot()).toMatchObject({ status: 'playing', paused: false, health: 2, score: 0 });
  b.command('pause'); expect(b.getSnapshot().paused).toBe(true);
  a.command('reset'); expect(a.getSnapshot().countdown).toBe(3);
  expect(b.getSnapshot().paused).toBe(true);
  a.dispose(); a.dispose(); time.advance(1);
  expect(time.frames.size).toBe(1);
  expect(a.getSnapshot().countdown).toBe(3);
  b.dispose(); expect(time.frames.size).toBe(0);
});

function keyboard(key: string, type = 'keydown', repeat = false, target: EventTarget = window) {
  const event = new KeyboardEvent(type, { key, repeat, bubbles: true, cancelable: true });
  target.dispatchEvent(event); return event;
}
test('keyboard discards countdown keys, suppresses repeats and requires fresh input after pause', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  session.start(); keyboard('w'); keyboard(' '); keyboard('Enter'); time.advance(3.1);
  expect(session.getSnapshot()).toMatchObject({ status: 'playing', paused: false, accelerating: false });
  keyboard('w', 'keyup'); keyboard(' ', 'keyup'); keyboard('Enter', 'keyup');
  expect(keyboard('w').defaultPrevented).toBe(true); time.advance(1 / 60);
  expect(session.getSnapshot().accelerating).toBe(true);
  keyboard('d'); keyboard('w', 'keydown', true); time.advance(1 / 60);
  expect(session.getSnapshot().accelerating).toBe(false);
  keyboard('d', 'keyup'); time.advance(1 / 60); expect(session.getSnapshot().accelerating).toBe(false);
  keyboard(' '); expect(session.getSnapshot().paused).toBe(true);
  keyboard(' ', 'keydown', true); expect(session.getSnapshot().paused).toBe(true);
  keyboard(' ', 'keyup'); keyboard(' '); expect(session.getSnapshot().paused).toBe(false);
  keyboard('w', 'keydown', true); time.advance(1 / 60); expect(session.getSnapshot().accelerating).toBe(false);
  keyboard('w', 'keyup'); keyboard('w'); time.advance(1 / 60); expect(session.getSnapshot().accelerating).toBe(true);
  session.dispose();
});

test('blur and visibility freeze active effects/countdown and returning never resumes active play', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  session.start(); time.advance(1);
  hidden = true; document.dispatchEvent(new Event('visibilitychange')); time.advance(20);
  expect(session.getSnapshot()).toMatchObject({ status: 'countdown', countdown: 2 });
  hidden = false; document.dispatchEvent(new Event('visibilitychange')); time.advance(2.1);
  expect(session.getSnapshot().status).toBe('playing');
  keyboard('w'); time.advance(1 / 60); expect(session.getSnapshot().accelerating).toBe(true);
  window.dispatchEvent(new Event('blur')); const road = session.getPresentation().roadOffset;
  time.advance(10); expect(session.getSnapshot()).toMatchObject({ paused: true, accelerating: false });
  expect(session.getPresentation().roadOffset).toBe(road);
  window.dispatchEvent(new Event('focus')); time.advance(1); expect(session.getSnapshot().paused).toBe(true);
  keyboard(' '); keyboard(' ', 'keyup'); time.advance(1 / 60);
  expect(session.getSnapshot()).toMatchObject({ paused: false, accelerating: false });
  keyboard('w', 'keydown', true); time.advance(1 / 60); expect(session.getSnapshot().accelerating).toBe(false);
  keyboard('w', 'keyup'); keyboard('w'); time.advance(1 / 60); expect(session.getSnapshot().accelerating).toBe(true);
  session.dispose();
});

test('interactive controls retain native keys and clear movement without restoring older held keys', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); const button = document.createElement('button');
  document.body.append(canvas, button);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  session.start(); time.advance(3.1); keyboard('w'); time.advance(1 / 60);
  expect(session.getSnapshot().accelerating).toBe(true);
  button.focus(); expect(keyboard(' ', 'keydown', false, button).defaultPrevented).toBe(false);
  keyboard(' ', 'keyup', false, button); time.advance(1 / 60);
  expect(session.getSnapshot()).toMatchObject({ paused: false, accelerating: false });
  session.focus(); keyboard('w', 'keydown', true); time.advance(1 / 60);
  expect(session.getSnapshot().accelerating).toBe(false);
  keyboard('w', 'keyup'); keyboard('w'); time.advance(1 / 60); expect(session.getSnapshot().accelerating).toBe(true);
  session.dispose();
});

test('small UI subscriptions are stable across unchanged world frames and stale callbacks cannot revive disposal', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  let updates = 0; session.subscribe(() => { updates++; }); session.start(); time.advance(3.1);
  const ui = session.getSnapshot(); const count = updates; const stale = [...time.frames.values()][0];
  time.advance(0.5); expect(session.getSnapshot()).toBe(ui); expect(updates).toBe(count);
  const view = session.getPresentation(); (view.coins as unknown[]).push({});
  expect(session.getPresentation().coins).toHaveLength(0);
  session.dispose(); stale(100000); keyboard('w'); session.command('reset');
  expect(time.frames.size).toBe(0); expect(session.getSnapshot()).toBe(ui);
});

test('session preserves full active elapsed time across sparse frames and guards negative first RAF', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 5, random: () => 0.5 });
  session.start(); time.deliver(-16); expect(session.getSnapshot().countdown).toBe(5);
  time.jump(5); expect(session.getSnapshot()).toMatchObject({ status: 'playing', countdown: 0 });
  expect(session.getPresentation().roadOffset).toBe(0);
  time.jump(3); expect(session.getPresentation()).toMatchObject({ roadSpeed: 445, spawnInterval: 0.91 });
  session.dispose();
});

test('disposing synchronously from a UI subscription cannot schedule another frame', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  session.subscribe(() => { if (session.getSnapshot().status === 'playing') session.dispose(); });
  session.start(); time.advance(3);
  expect(time.frames.size).toBe(0);
});

for (const fps of [30, 60, 120]) {
  test(`${fps} FPS session first-start and reset countdowns retain literal five/three-second deadlines`, () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
    const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 5, random: () => 0.5 });
    session.start(); time.advance(4.9, fps);
    expect(session.getSnapshot()).toMatchObject({ status: 'countdown', countdown: 1 });
    expect(session.getPresentation().roadOffset).toBe(0);
    time.advance(0.1, fps); expect(session.getSnapshot().status).toBe('playing');
    session.command('reset'); expect(session.getSnapshot()).toMatchObject({ status: 'countdown', countdown: 3, score: 0, health: 2 });
    time.advance(2.9, fps); expect(session.getSnapshot().status).toBe('countdown');
    time.advance(0.1, fps); expect(session.getSnapshot().status).toBe('playing');
    session.dispose();
  });
}


test('resuming after a paused interval without RAF does not catch up unseen gameplay', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  session.start(); time.advance(3); session.command('pause');
  const before = session.getPresentation().roadOffset;
  time.elapse(20); session.command('pause'); time.advance(1 / 60);
  expect(session.getPresentation().roadOffset - before).toBeCloseTo(400 / 60, 8);
  expect(session.getPresentation().roadSpeed).toBe(400);
  session.dispose();
});

test('fresh nonrepeat press after an undelivered away keyup recovers controls', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  session.start(); time.advance(3); keyboard('w'); time.advance(1 / 60);
  window.dispatchEvent(new Event('blur')); time.advance(5);
  window.dispatchEvent(new Event('focus')); keyboard(' '); keyboard(' ', 'keyup');
  // Release occurred outside this window, so its keyup was never delivered.
  keyboard('w', 'keydown', true); time.advance(1 / 60);
  expect(session.getSnapshot().accelerating).toBe(false);
  keyboard('w', 'keydown', false); time.advance(1 / 60);
  expect(session.getSnapshot().accelerating).toBe(true);
  session.dispose();
});


test('explicit reset discards pre-reset wall time before its fresh countdown', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 5, random: () => 0.5 });
  session.start(); time.elapse(20); session.command('reset'); time.advance(1 / 60);
  expect(session.getSnapshot()).toMatchObject({ status: 'countdown', countdown: 3, score: 0, health: 2 });
  expect(session.getPresentation().roadOffset).toBe(0);
  time.advance(2.9); expect(session.getSnapshot().status).toBe('countdown');
  time.advance(0.1); expect(session.getSnapshot().status).toBe('playing');
  session.dispose();
});


test('accepted restart discards the completed-gameover RAF gap before its fresh countdown', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  Object.defineProperties(canvas, { clientWidth: { value: 606 }, clientHeight: { value: 806 } });
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 3, random: () => 0.5 });
  session.start(); time.advance(15);
  expect(session.getSnapshot()).toMatchObject({ status: 'gameover', gameOverAnimDone: true });
  time.elapse(20); session.command('restart'); time.advance(1 / 60);
  expect(session.getSnapshot()).toMatchObject({ status: 'countdown', countdown: 3, score: 0, health: 2 });
  expect(session.getPresentation().roadOffset).toBe(0);
  time.advance(2.9); expect(session.getSnapshot().status).toBe('countdown');
  time.advance(0.1); expect(session.getSnapshot().status).toBe('playing');
  session.dispose();
});

test('unavailable pause and restart commands cannot rebase or delay a running countdown', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const time = clock(); const canvas = document.createElement('canvas'); document.body.append(canvas);
  const session = new GameSession({ mode: 'long-drive', canvas, clock: time.boundary, countdown: 5, random: () => 0.5 });
  session.start(); time.elapse(4); session.command('pause'); session.command('restart'); time.jump(1);
  expect(session.getSnapshot()).toMatchObject({ status: 'playing', countdown: 0, paused: false });
  expect(session.getPresentation().roadOffset).toBe(0);
  session.dispose();
});
