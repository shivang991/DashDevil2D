import { afterEach, expect, test, vi } from "vitest";
import { GameAudio } from "../../src/lib/gameAudio";
import { createLongDrive, type LongDriveEvent } from "@dashdevil/simulation/longDrive";

afterEach(() => vi.unstubAllGlobals());
test("audio consumes an identified terminal cue once and cannot mutate frozen gameplay", () => {
  let oscillators = 0;
  const pitches: number[] = [];
  const parameter = () => ({
    value: 0,
    setTargetAtTime() {},
    setValueAtTime(value: number) {
      pitches.push(value);
    },
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const node = () => ({
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
    setPeriodicWave() {},
    frequency: parameter(),
    gain: parameter(),
    Q: parameter(),
  });
  class AudioPlatform {
    state = "running";
    currentTime = 0;
    sampleRate = 10;
    destination = {};
    createGain = node;
    createBiquadFilter = node;
    createBufferSource = node;
    createOscillator() {
      oscillators++;
      return node();
    }
    createPeriodicWave() {
      return {};
    }
    createBuffer() {
      return { duration: 2, getChannelData: () => new Float32Array(20) };
    }
  }
  vi.stubGlobal("AudioContext", AudioPlatform);
  const audio = new GameAudio();
  audio.enabled = true;
  audio.unlock();
  const initial = oscillators;
  const state = Object.freeze({ ...createLongDrive().state, status: "gameover" as const });
  const event: LongDriveEvent = Object.freeze({ id: 1, observedAt: 0, type: "gameover" });
  audio.update(state, Object.freeze([event]));
  expect(oscillators - initial).toBe(4); // Four-note baseline terminal melody.
  audio.update(state, Object.freeze([event]));
  expect(oscillators - initial).toBe(4);
  expect(state).toMatchObject({ health: 2, score: 0, status: "gameover", gameOverFadeAlpha: 0 });
  pitches.length = 0;
  audio.playEffect("coin");
  const coin = [...pitches];
  pitches.length = 0;
  audio.playEffect("heart");
  expect(pitches).not.toEqual(coin);
  expect(pitches.length).toBeGreaterThan(0);
  const audible = oscillators;
  audio.enabled = false;
  audio.playEffect("heart");
  audio.impact();
  expect(oscillators).toBe(audible);
  audio.dispose();
});

test("session audio players share mute preferences while disposing one leaves the other usable", async () => {
  let contexts = 0;
  const closed: number[] = [];
  const parameter = () => ({
    value: 0,
    setTargetAtTime() {},
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const node = () => ({
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
    setPeriodicWave() {},
    frequency: parameter(),
    gain: parameter(),
    Q: parameter(),
  });
  class AudioPlatform {
    id = ++contexts;
    state = "running";
    currentTime = 0;
    sampleRate = 10;
    destination = {};
    createGain = node;
    createBiquadFilter = node;
    createBufferSource = node;
    createOscillator = node;
    createPeriodicWave() {
      return {};
    }
    createBuffer() {
      return { duration: 2, getChannelData: () => new Float32Array(20) };
    }
    close() {
      closed.push(this.id);
      return Promise.resolve();
    }
  }
  vi.stubGlobal("AudioContext", AudioPlatform);
  const first = new GameAudio();
  const second = new GameAudio();
  first.unlock();
  second.unlock();
  expect(contexts).toBe(2);
  first.setEnabled(false);
  expect(second.enabled).toBe(false);
  first.dispose();
  first.dispose();
  expect(closed).toEqual([1]);
  second.setEnabled(true);
  second.unlock();
  expect(second.enabled).toBe(true);
  expect(contexts).toBe(2);
  second.dispose();
  expect(closed).toEqual([1, 2]);
});
