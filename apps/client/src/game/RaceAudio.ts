import { CarFlagsNOSActive } from "@dashdevil/contracts/protocol";
import { GameAudio } from "../lib/gameAudio";
import type { RaceSession } from "./RaceSession";

type Frame = ReturnType<RaceSession["frame"]>;

/** Audio observes predicted local play; it never advances or edits the simulation. */
export class RaceAudio {
  private readonly audio = new GameAudio();
  private started = false;
  private finished = false;
  constructor() {
    this.audio.unlock();
  }
  update(frame: Frame, seat: number, suspended = false) {
    const car = frame.cars[seat];
    if (!this.started) {
      this.started = true;
      // Recovery mid-round must not replay the starting cue.
      if (frame.timeUs < 1e6 && !frame.outcome) this.audio.playEffect("go");
    }
    if (!suspended && !frame.stale) {
      for (const sound of frame.sounds) {
        if (sound.type === "impact") this.audio.impact(sound.protected);
        else this.audio.playEffect(sound.type);
      }
    }
    if (frame.outcome && !this.finished) {
      this.finished = true;
      this.audio.playEffect("gameover");
    }
    this.audio.update({
      status: frame.outcome ? "gameover" : "playing",
      paused: suspended || frame.stale || document.hidden,
      score: car.score,
      health: car.hp,
      currentLane: car.lane,
      accelerating: Boolean(car.flags & CarFlagsNOSActive),
      roadSpeed: car.normalSpeed,
      countdownTimer: 0,
    });
  }
  dispose() {
    this.audio.dispose();
  }
}
