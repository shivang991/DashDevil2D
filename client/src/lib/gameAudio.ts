import type { GameState } from "@/hooks/useGameContext";

const STORAGE_KEY = "runner-sound-enabled";

/**
 * SOUND TUNING — edit these settings, save, then reload the game to audition.
 *
 * Gains are linear amplitude multipliers, not perceived loudness percentages:
 * 0 is silent; doubling a gain adds about 6 dB. Master multiplies every sound.
 * For a quieter car ONLY, lower engine.cruiseGain and engine.boostGain.
 * Hz means pitch (or a filter's cutoff/center); larger numbers sound higher/brighter.
 * All times are seconds. "Smooth" values are exponential time constants:
 * roughly 63% of the change happens in that time, 95% in three times that time.
 * Keep smoothing times and frequencies positive. Adjust one setting at a time.
 * Synthesized V12-inspired exhaust; these are not recorded Lamborghini samples.
 * The optional turbo whistle is muted to keep the naturally aspirated character.
 */
const soundSettings = {
  masterGain: 0.3, // Overall mix; raising this also makes coins/crashes louder.
  engine: {
    cruiseGain: 0.05, // Normal driving volume.
    boostGain: 0.01, // Fuller exhaust under throttle.
    baseRpm: 500,
    speedRpm: 3.8, // Road speed 400–900 gives 3920–5820 cruising RPM.
    boostRpm: 2500, // Throttle opens up the high-rev howl.
    maxRpm: 8500,
    bassRatio: 0.5, // One bank's three firing pulses per crank revolution.
    bassGain: 0.28, // Body beneath the combined twelve-cylinder firing tone.
    cutoffHz: 600,
    cutoffSpeedHz: 0.3,
    boostCutoffHz: 5200,
    resonance: 0.65,
    volumeSmooth: 0,
    pitchSmooth: 0.05, // Engine inertia when opening the throttle.
    releaseSmooth: 0.16, // Faster rev drop on lift-off.
    filterSmooth: 0.15,
  },
  turbo: {
    restHz: 1200, // Silent resting pitch from which the whistle spools up.
    boostHz: 200, // Boost whistle base pitch; increase for a higher nitrous whine.
    speedHz: 1.1, // Added Hz per road-speed unit: 400–900 speed gives 3040–3590 Hz.
    whistleGain: 0.05, // Tonal whistle volume; reduce if the high pitch dominates.
    secondHarmonic: 0.18, // Relative strength at 2x pitch; 0 removes this bright edge.
    thirdHarmonic: 0.05, // Relative strength at 3x pitch; higher adds sharper overtones.
    airGain: 0.1, // Rushing air volume; more air / less whistle gives more "whoosh".
    airHz: 4800, // Air filter center; higher = thinner hiss, lower = fuller rush.
    airQ: 5, // Higher Q narrows the noise into a more whistle-like band.
    spoolSmooth: 0.22, // Pitch rise time constant; smaller = faster spool-up.
    spoolDownSmooth: 0.1, // Pitch return after releasing acceleration.
    whistleAttack: 0.1, // Whistle fade-in time constant.
    airAttack: 0.08, // Air fade-in time constant.
    fadeOut: 0.04, // Continuous boost fade-out on release/pause/game over.
  },
  release: {
    startHz: 2000, // Dark exhaust rush, rather than a high air-pressure hiss.
    endHz: 180,
    bodyHz: 150, // Descending tailpipe resonance.
    bodyEndHz: 48,
    bodyGain: 0.55,
    sweepSeconds: 0.42,
    resonance: 0.65,
    gain: 0.26,
    attackSeconds: 0.012,
    durationSeconds: 0.55,
  },
  crackle: {
    gain: 0.5,
    boostPops: 0,
    releasePops: 6,
    gapSeconds: 0.075,
    timingVariation: 0.45,
    durationSeconds: 0.055,
    snapHz: 1400, // Rounded exhaust cracks with a low thump underneath.
    bodyHz: 125,
  },
};

function readPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

class GameAudio {
  enabled = readPreference();
  private context?: AudioContext;
  private master?: GainNode;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private engineBass?: OscillatorNode;
  private engineFilter?: BiquadFilterNode;
  private turbo?: OscillatorNode;
  private turboGain?: GainNode;
  private turboAirGain?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private releaseStop?: () => void;
  private crackleStops = new Set<() => void>();
  private previous?: Pick<
    GameState,
    "status" | "paused" | "score" | "health" | "currentLane" | "accelerating"
  > & { countdown: number };

  // Called from a user gesture so browsers allow audio playback.
  unlock = () => {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const context = new AudioContext();
        this.context = context;
        this.master = context.createGain();
        this.master.gain.value = document.hidden ? 0 : soundSettings.masterGain;
        this.master.connect(context.destination);
        this.engineGain = context.createGain();
        this.engineGain.gain.value = 0;
        this.engineGain.connect(this.master);
        this.engine = context.createOscillator();
        // A smooth firing fundamental with strong upper exhaust harmonics gives
        // a V12-style howl without the thin edge of a plain sawtooth.
        this.engine.setPeriodicWave(
          context.createPeriodicWave(
            new Float32Array(9),
            new Float32Array([0, 1, 0.65, 0.42, 0.28, 0.18, 0.1, 0.06, 0.03]),
          ),
        );
        // Initial silent values only; update() applies the driving settings each frame.
        this.engine.frequency.value = 55;
        this.engineFilter = context.createBiquadFilter();
        this.engineFilter.type = "lowpass";
        this.engineFilter.frequency.value = 400;
        this.engineFilter.Q.value = soundSettings.engine.resonance;
        this.engine.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engine.start();

        // A lower firing pulse gives the engine body beneath its exhaust buzz.
        this.engineBass = context.createOscillator();
        this.engineBass.type = "triangle";
        this.engineBass.frequency.value = 27.5;
        const bassGain = context.createGain();
        bassGain.gain.value = soundSettings.engine.bassGain;
        this.engineBass.connect(bassGain);
        bassGain.connect(this.engineGain);
        this.engineBass.start();

        this.turboGain = context.createGain();
        this.turboGain.gain.value = 0;
        this.turboGain.connect(this.master);
        this.turbo = context.createOscillator();
        // Harmonic slots are [DC, fundamental, 2x pitch, 3x pitch]. Keep DC at 0.
        // Web Audio normalizes the waveform; use whistleGain for overall volume.
        this.turbo.setPeriodicWave(
          context.createPeriodicWave(
            new Float32Array([0, 0, 0, 0]),
            new Float32Array([
              0,
              1,
              soundSettings.turbo.secondHarmonic,
              soundSettings.turbo.thirdHarmonic,
            ]),
          ),
        );
        this.turbo.frequency.value = soundSettings.turbo.restHz;
        this.turbo.connect(this.turboGain);
        this.turbo.start();

        // Filtered air adds a rushing boost sound underneath the turbine whistle.
        this.noiseBuffer = context.createBuffer(
          1,
          context.sampleRate * 2,
          context.sampleRate,
        );
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
        const air = context.createBufferSource();
        air.buffer = this.noiseBuffer;
        air.loop = true;
        const airFilter = context.createBiquadFilter();
        airFilter.type = "bandpass";
        airFilter.frequency.value = soundSettings.turbo.airHz;
        airFilter.Q.value = soundSettings.turbo.airQ;
        this.turboAirGain = context.createGain();
        this.turboAirGain.gain.value = 0;
        air.connect(airFilter);
        airFilter.connect(this.turboAirGain);
        this.turboAirGain.connect(this.master);
        air.start();
      }
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      // Audio is optional; unsupported or blocked audio must not stop the game.
    }
  };

  private stopCrackle() {
    for (const stop of this.crackleStops) stop();
    this.crackleStops.clear();
  }

  private exhaustCrackle(popCount: number) {
    const context = this.context;
    const settings = soundSettings.crackle;
    if (
      !this.enabled ||
      document.hidden ||
      !context ||
      context.state !== "running" ||
      !this.master ||
      !this.noiseBuffer ||
      settings.gain <= 0
    )
      return;

    // Replace the preceding burst on rapid taps, so backfires never pile up.
    this.stopCrackle();
    let start = context.currentTime;
    for (let i = 0; i < Math.min(8, popCount); i++) {
      const noise = context.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = settings.snapHz * (0.85 + Math.random() * 0.3);
      filter.Q.value = 0.7;
      const body = context.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(settings.bodyHz, start);
      body.frequency.exponentialRampToValueAtTime(
        settings.bodyHz * 0.45,
        start + settings.durationSeconds,
      );
      const envelope = context.createGain();
      // A 3 ms attack plus a fast decay combines a sharp noise crack with an
      // exhaust thump. Later pops get softer; random strength avoids a metronome.
      const strength =
        settings.gain * (0.75 + Math.random() * 0.25) * Math.pow(0.88, i);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(strength, start + 0.003);
      envelope.gain.exponentialRampToValueAtTime(
        0.001,
        start + settings.durationSeconds,
      );
      noise.connect(filter);
      filter.connect(envelope);
      body.connect(envelope);
      envelope.connect(this.master);
      const stop = () => {
        // Disconnect scheduled pops immediately on pause, mute, or navigation.
        envelope.disconnect();
        noise.stop();
        body.stop();
      };
      this.crackleStops.add(stop);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        body.disconnect();
        envelope.disconnect();
        this.crackleStops.delete(stop);
      };
      // Choose a different part of the shared noise buffer for every pop.
      noise.start(start, Math.random() * this.noiseBuffer.duration * 0.5);
      body.start(start);
      noise.stop(start + settings.durationSeconds + 0.02);
      body.stop(start + settings.durationSeconds + 0.02);
      start +=
        settings.gapSeconds *
        (1 + (Math.random() * 2 - 1) * settings.timingVariation);
    }
  }

  private stopRelease() {
    this.releaseStop?.();
    this.releaseStop = undefined;
  }

  private releaseExhaust() {
    const context = this.context;
    if (
      !this.enabled ||
      document.hidden ||
      !context ||
      context.state !== "running" ||
      !this.master ||
      !this.noiseBuffer
    )
      return;
    this.stopRelease();
    const air = context.createBufferSource();
    air.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = soundSettings.release.resonance;
    filter.frequency.setValueAtTime(
      soundSettings.release.startHz,
      context.currentTime,
    );
    filter.frequency.exponentialRampToValueAtTime(
      soundSettings.release.endHz,
      context.currentTime + soundSettings.release.sweepSeconds,
    );
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(
      soundSettings.release.gain,
      context.currentTime + soundSettings.release.attackSeconds,
    );
    // Fade the exhaust tail to near silence before stopping the sources.
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + soundSettings.release.durationSeconds,
    );
    const body = context.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(
      soundSettings.release.bodyHz,
      context.currentTime,
    );
    body.frequency.exponentialRampToValueAtTime(
      soundSettings.release.bodyEndHz,
      context.currentTime + soundSettings.release.durationSeconds,
    );
    const bodyGain = context.createGain();
    bodyGain.gain.value = soundSettings.release.bodyGain;
    body.connect(bodyGain);
    bodyGain.connect(gain);
    air.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    const stop = () => {
      gain.disconnect();
      air.stop();
      body.stop();
    };
    this.releaseStop = stop;
    body.start();
    body.stop(
      context.currentTime + soundSettings.release.durationSeconds + 0.02,
    );
    air.start();
    air.stop(
      context.currentTime + soundSettings.release.durationSeconds + 0.02,
    );
    air.onended = () => {
      air.disconnect();
      body.disconnect();
      bodyGain.disconnect();
      filter.disconnect();
      gain.disconnect();
      if (this.releaseStop === stop) this.releaseStop = undefined;
    };
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
    if (enabled) this.unlock();
    this.syncVisibility();
  }

  syncVisibility = () => {
    if (!this.enabled || document.hidden) {
      this.stopCrackle();
      this.stopRelease();
    }
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(
      this.enabled && !document.hidden ? soundSettings.masterGain : 0,
      this.context.currentTime,
      0.015,
    );
  };

  /**
   * Short effect recipe: tone(startHz, endHz, durationSeconds, waveform, gain, delaySeconds).
   * Equal frequencies give a steady note; end < start falls, end > start rises.
   * sine = clean chime, triangle = soft, square = retro beep, sawtooth = rough buzz.
   * Gain defaults to 0.3, delay to 0. Keep frequencies > 0 and duration > 0.008.
   * Delay schedules notes relative to the current event, useful for melodies.
   */
  private tone(
    frequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.3,
    delay = 0,
  ) {
    const context = this.context;
    if (
      !this.enabled ||
      document.hidden ||
      !context ||
      context.state !== "running" ||
      !this.master
    )
      return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      endFrequency,
      start + duration,
    );
    gain.gain.setValueAtTime(0, start);
    // An 8 ms attack avoids clicks; the remaining duration decays to near silence.
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  update(state: GameState) {
    // Compare snapshots so effects fire once per event, not every animation frame.
    const previous = this.previous;
    const countdown = Math.ceil(state.countdownTimer);
    if (
      state.status === "countdown" &&
      countdown > 0 &&
      (!previous ||
        previous.status !== "countdown" ||
        previous.countdown !== countdown)
    ) {
      // Countdown: steady A4 beep, 130 ms long, square-wave gain 0.16.
      this.tone(440, 440, 0.13, "square", 0.16);
    }
    if (previous) {
      // GO cue: upward pitch sweep. Increase duration for a longer starting beep.
      if (previous.status === "countdown" && state.status === "playing")
        this.tone(880, 1100, 0.35, "square", 0.16);
      // Lane change: short, soft downward swoop; final argument sets its volume.
      if (
        state.currentLane !== previous.currentLane &&
        state.status === "playing"
      )
        this.tone(180, 90, 0.09, "triangle", 0.2);
      if (state.score > previous.score) {
        // Coin: two overlapping notes; the second starts 70 ms after the first.
        this.tone(880, 880, 0.1);
        this.tone(1320, 1320, 0.2, "sine", 0.3, 0.07);
      }
      // Crash: rough bass sweep from 130 Hz to 30 Hz over 300 ms.
      if (state.health < previous.health)
        this.tone(130, 30, 0.3, "sawtooth", 0.5);
      if (state.status === "gameover" && previous.status !== "gameover") {
        // Edit this array for a different melody. Notes start 160 ms apart;
        // each lasts 300 ms and falls to 90% of its initial pitch.
        [330, 262, 196, 98].forEach((note, index) =>
          this.tone(note, note * 0.9, 0.3, "triangle", 0.4, index * 0.16),
        );
      }
      // Pause falls an octave; resume rises an octave. Uses the default gain.
      if (state.paused !== previous.paused && state.status === "playing")
        this.tone(state.paused ? 440 : 220, state.paused ? 220 : 440, 0.16);
    }
    if (this.context && this.engine && this.engineGain) {
      const running = state.status === "playing" && !state.paused;
      const boosting = running && state.accelerating;
      if (!running || boosting) {
        this.stopCrackle();
        this.stopRelease();
      }
      // Trigger only on throttle edges, not every frame or when resuming pause.
      if (
        boosting &&
        previous?.status === "playing" &&
        !previous.paused &&
        !previous.accelerating
      )
        this.exhaustCrackle(soundSettings.crackle.boostPops);
      const now = this.context.currentTime;
      const { engine, turbo } = soundSettings;
      // A four-stroke V12 fires six times per crank revolution: RPM / 10 Hz.
      const rpm = Math.min(
        engine.maxRpm,
        engine.baseRpm +
          state.roadSpeed * engine.speedRpm +
          (boosting ? engine.boostRpm : 0),
      );
      const engineHz = rpm / 10;
      const pitchSmooth = boosting ? engine.pitchSmooth : engine.releaseSmooth;
      this.engineGain.gain.setTargetAtTime(
        running ? (boosting ? engine.boostGain : engine.cruiseGain) : 0,
        now,
        engine.volumeSmooth,
      );
      this.engine.frequency.setTargetAtTime(engineHz, now, pitchSmooth);
      this.engineBass?.frequency.setTargetAtTime(
        engineHz * engine.bassRatio,
        now,
        pitchSmooth,
      );
      this.engineFilter?.frequency.setTargetAtTime(
        boosting
          ? engine.boostCutoffHz
          : engine.cutoffHz + state.roadSpeed * engine.cutoffSpeedHz,
        now,
        engine.filterSmooth,
      );
      this.turbo?.frequency.setTargetAtTime(
        boosting
          ? turbo.boostHz + state.roadSpeed * turbo.speedHz
          : turbo.restHz,
        now,
        boosting ? turbo.spoolSmooth : turbo.spoolDownSmooth,
      );
      this.turboGain?.gain.setTargetAtTime(
        boosting ? turbo.whistleGain : 0,
        now,
        boosting ? turbo.whistleAttack : turbo.fadeOut,
      );
      this.turboAirGain?.gain.setTargetAtTime(
        boosting ? turbo.airGain : 0,
        now,
        boosting ? turbo.airAttack : turbo.fadeOut,
      );
      if (
        running &&
        previous?.status === "playing" &&
        !previous.paused &&
        previous.accelerating &&
        !state.accelerating
      ) {
        this.releaseExhaust();
        this.exhaustCrackle(soundSettings.crackle.releasePops);
      }
    }
    this.previous = {
      status: state.status,
      paused: state.paused,
      score: state.score,
      health: state.health,
      currentLane: state.currentLane,
      accelerating: state.accelerating,
      countdown,
    };
  }

  stop() {
    this.stopCrackle();
    this.stopRelease();
    // Short cleanup fades prevent clicks when leaving the game; these aren't
    // the musical boost-release settings above. Reset events for the next run.
    this.previous = undefined;
    if (this.context && this.engineGain)
      this.engineGain.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
    if (this.context) {
      this.turboGain?.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
      this.turboAirGain?.gain.setTargetAtTime(
        0,
        this.context.currentTime,
        0.02,
      );
    }
  }
}

export const gameAudio = new GameAudio();
