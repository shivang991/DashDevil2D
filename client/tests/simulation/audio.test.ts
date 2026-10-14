import { afterEach, expect, test, vi } from 'vitest';
import { GameAudio } from '../../src/lib/gameAudio';
import { createLongDrive, type LongDriveEvent } from '../../../packages/simulation/longDrive';

afterEach(() => vi.unstubAllGlobals());
test('audio consumes an identified terminal cue once and cannot mutate frozen gameplay', () => {
  let oscillators = 0;
  const parameter = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}, frequency: parameter(), gain: parameter(), Q: parameter() });
  class AudioPlatform {
    state = 'running'; currentTime = 0; sampleRate = 10; destination = {};
    createGain = node; createBiquadFilter = node; createBufferSource = node;
    createOscillator() { oscillators++; return node(); }
    createPeriodicWave() { return {}; }
    createBuffer() { return { duration: 2, getChannelData: () => new Float32Array(20) }; }
  }
  vi.stubGlobal('AudioContext', AudioPlatform);
  const audio = new GameAudio();
  audio.enabled = true;
  audio.unlock();
  const initial = oscillators;
  const state = Object.freeze({ ...createLongDrive().state, status: 'gameover' as const });
  const event: LongDriveEvent = Object.freeze({ id: 1, time: 0, type: 'gameover' });
  audio.update(state, Object.freeze([event]));
  expect(oscillators - initial).toBe(4); // Four-note baseline terminal melody.
  audio.update(state, Object.freeze([event]));
  expect(oscillators - initial).toBe(4);
  expect(state).toMatchObject({ health: 2, score: 0, status: 'gameover', gameOverFadeAlpha: 0 });
});
