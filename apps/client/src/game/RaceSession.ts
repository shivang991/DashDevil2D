import {
  Multiplayer,
  canonicalTime,
  type MultiplayerConfiguration,
  type Observation,
} from "@dashdevil/simulation/multiplayer";
import { firstContact } from "@dashdevil/simulation/geometry";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { validateBaseline, validateMessage } from "@dashdevil/contracts/validation";
import type {
  Baseline,
  Car,
  Coverage,
  Disposition,
  Event,
  Input,
  Outcome,
} from "@dashdevil/contracts/protocol";

const sameIdentity = (a: Baseline["identity"], b: Baseline["identity"]) =>
  a.roomId === b.roomId &&
  a.seat === b.seat &&
  a.seatSession === b.seatSession &&
  a.pairGeneration === b.pairGeneration;

export interface RaceSound {
  type: "coin" | "heart" | "impact" | "lane" | "damage";
  protected?: boolean;
}

/** Client prediction owns copied simulation state; rendering never writes it. */
export class RaceSession {
  readonly diagnostics = [0, 1].map(() => ({
    corrections: 0,
    abrupt: 0,
    snaps: 0,
    maxSettlingUs: 0,
  }));
  private settlingSince?: number;
  private soundEpisode = 0;
  private sounds: RaceSound[] = [];
  private soundSeen = new Set<string>();
  private feedbackSeen = new Set<string>();
  private feedback: string[] = [];
  private baseline: Baseline;
  private configuration: MultiplayerConfiguration;
  private readonly nowUs: () => number;
  private pending: { input: Input; timeUs: number }[] = [];
  private outcome?: Outcome;
  private lastAuthorityUs: number;
  private lastFrameUs: number;
  private rendered?: { progress: number; lateral: number }[];
  private correction?: {
    baseline: Baseline;
    pending: { input: Input; timeUs: number }[];
    receivedUs: number;
  };
  private offset?: { progress: number; lateral: number }[];
  private snapCorrection = false;
  private carTilts = [0, 0];
  private settleStartUs = 0;
  private settleEndUs = 0;
  constructor(baseline: Baseline, nowUs = () => performance.now() * 1000) {
    this.nowUs = nowUs;
    this.baseline = structuredClone(baseline);
    this.soundEpisode = Math.max(this.soundEpisode, baseline.contact.episode);
    const c = baseline.context;
    const mode = c.mode === 1 ? "drag-race" : "road-rage";
    // Wire Gameplay includes fields for all modes; capture only this mode's keys.
    const defaults = captureConfiguration(mode).gameplay;
    const gameplay = Object.fromEntries(
      Object.keys(defaults).map((key) => [key, c.gameplay[key as keyof typeof c.gameplay]]),
    );
    this.configuration = captureConfiguration(mode, {
      gameplay,
      presentation: c.presentation,
      room: c.room,
      connection: c.connection,
      operational: c.operational,
    });
    validateBaseline(baseline, c);
    this.lastAuthorityUs = baseline.timeUs;
    this.lastFrameUs = baseline.timeUs;
  }
  install(baseline: Baseline) {
    if (
      this.outcome ||
      !sameIdentity(baseline.identity, this.baseline.identity) ||
      baseline.epoch < this.baseline.epoch ||
      baseline.round.roundId !== this.baseline.round.roundId ||
      baseline.tick < this.baseline.tick ||
      baseline.progress.authority < this.baseline.progress.authority ||
      baseline.timeUs < this.baseline.timeUs
    )
      return;
    validateBaseline(baseline, this.baseline.context);
    if (baseline.round.inputGeneration !== this.baseline.round.inputGeneration) {
      this.pending = [];
      this.offset = undefined;
      this.correction = undefined;
      this.rendered = undefined;
      this.carTilts = [0, 0];
      this.lastFrameUs = baseline.timeUs;
    } else this.beforeCorrection();
    this.baseline = structuredClone(baseline);
    this.soundEpisode = Math.max(this.soundEpisode, baseline.contact.episode);
    const cutoff =
      baseline.identity.seat === 0 ? baseline.progress.processed1 : baseline.progress.processed2;
    this.pending = this.pending.filter((p) => p.input.sequence > cutoff);
    this.lastAuthorityUs = baseline.timeUs;
  }
  private beforeCorrection() {
    if (this.rendered && !this.correction)
      this.correction = {
        baseline: this.snapshot(),
        pending: structuredClone(this.pending),
        receivedUs: this.nowUs(),
      };
  }
  private engine(baseline = this.baseline) {
    const ids = [0, 1].map((seat) => ({ ...baseline.identity, seat })) as [
      Baseline["identity"],
      Baseline["identity"],
    ];
    const game = new Multiplayer(
      this.configuration,
      baseline.context.seed,
      ids,
      baseline.round.roundId,
    );
    game.restore(
      baseline.cars,
      baseline.tick,
      baseline.windows.flatMap((window) => window.objects),
      baseline.timeUs,
      baseline.contact,
    );
    return { game, ids };
  }
  input(input: Input, timeUs: number) {
    if (
      this.outcome ||
      !sameIdentity(input.identity, this.baseline.identity) ||
      input.round.roundId !== this.baseline.round.roundId ||
      input.round.inputGeneration !== this.baseline.round.inputGeneration
    )
      return;
    const cutoff =
      this.baseline.identity.seat === 0
        ? this.baseline.progress.processed1
        : this.baseline.progress.processed2;
    if (input.sequence <= cutoff || this.pending.some((p) => p.input.sequence >= input.sequence))
      return;
    if (this.pending.length >= 512) throw new Error("Prediction input history exhausted");
    this.pending.push({
      input: structuredClone(input),
      timeUs: Math.max(this.baseline.timeUs, this.pending.at(-1)?.timeUs ?? 0, timeUs),
    });
  }
  /** Accepted input state arrives at the server's tick, never at client send time. */
  disposition(record: Disposition) {
    if (
      this.outcome ||
      !sameIdentity(record.identity, this.baseline.identity) ||
      record.round.inputGeneration !== this.baseline.round.inputGeneration ||
      record.round.roundId !== this.baseline.round.roundId ||
      record.authority <= this.baseline.progress.authority
    )
      return;
    this.beforeCorrection();
    if (record.disposition === 2 && record.intent === 0 && record.control <= 2)
      this.snapCorrection = true;
    this.advanceAuthority(record.tick);
    this.baseline.cars[record.seat] = { ...record.car };
    this.baseline.contact = { ...record.contact };
    this.baseline.progress.authority = record.authority;
    if (record.seat === 0) {
      this.baseline.progress.processed1 = record.processed;
      this.baseline.progress.disposed1 = record.processed;
    } else {
      this.baseline.progress.processed2 = record.processed;
      this.baseline.progress.disposed2 = record.processed;
    }
    if (record.seat === this.baseline.identity.seat)
      this.pending = this.pending.filter((p) => p.input.sequence > record.processed);
  }
  event(record: Event) {
    if (
      this.outcome ||
      !sameIdentity(record.identity, this.baseline.identity) ||
      record.round.inputGeneration !== this.baseline.round.inputGeneration ||
      record.round.roundId !== this.baseline.round.roundId ||
      record.authority <= this.baseline.progress.authority
    )
      return;
    const previousCars = this.baseline.cars;
    this.beforeCorrection();
    this.advanceAuthority(record.tick);
    // An authoritative generation change starts a new sequence space for that
    // seat. Keep the other seat's processed/disposed watermarks unchanged.
    for (let seat = 0; seat < record.cars.length; seat++) {
      const car = record.cars[seat];
      if (
        !(record.seatMask & (1 << seat)) ||
        car.inputGeneration === this.baseline.cars[seat].inputGeneration
      )
        continue;
      if (seat === 0) {
        this.baseline.progress.processed1 = car.lastInput;
        this.baseline.progress.disposed1 = car.lastInput;
      } else {
        this.baseline.progress.processed2 = car.lastInput;
        this.baseline.progress.disposed2 = car.lastInput;
      }
    }
    this.baseline.cars = structuredClone(record.cars);
    this.baseline.tick = record.tick;
    this.baseline.timeUs = record.timeUs;
    for (const object of record.objects)
      for (const window of this.baseline.windows) {
        const index = window.objects.findIndex((placement) => placement.id === object.id);
        if (index >= 0) window.objects[index] = { ...object };
      }
    this.observeObjects(record.objects);
    this.observeSounds(
      record.objects,
      record.cars,
      record.timeUs,
      record.contact.episode,
      undefined,
      previousCars,
    );
    this.baseline.contact = { ...record.contact };
    this.baseline.progress.authority = record.authority;
    this.baseline.progress.event = record.eventId;
  }
  private reconstruct(tick: number): Baseline {
    const baseline = this.snapshot();
    if (tick <= baseline.tick) return baseline;
    const { game } = this.engine();
    // Replay in bounded steps: a late network record is not a server overload.
    while (game.processedTick < tick)
      game.advanceTo(
        Math.min(tick, game.processedTick + 30) / this.configuration.gameplay.tickRate,
        true,
      );
    const state = game.preview();
    baseline.windows.forEach((window) => {
      window.objects = window.objects.map(
        (object) => state.objects.find((current) => current.id === object.id) ?? object,
      );
    });
    baseline.cars = state.cars;
    baseline.contact = state.contact;
    baseline.tick = tick;
    baseline.timeUs = canonicalTime(tick / this.configuration.gameplay.tickRate);
    return baseline;
  }
  advanceAuthority(tick: number): Baseline {
    if (!this.outcome) {
      this.baseline = this.reconstruct(tick);
      this.lastAuthorityUs = this.baseline.timeUs;
    }
    return this.snapshot();
  }
  coverage(record: Coverage) {
    if (
      this.outcome ||
      !sameIdentity(record.identity, this.baseline.identity) ||
      record.round.roundId !== this.baseline.round.roundId ||
      record.round.inputGeneration !== this.baseline.round.inputGeneration ||
      record.tick < this.baseline.tick
    )
      return;
    const candidate = this.reconstruct(record.tick);
    candidate.generator = structuredClone(record.generator);
    candidate.windows = structuredClone(record.windows);
    validateBaseline(candidate, this.baseline.context);
    this.beforeCorrection();
    this.baseline = candidate;
    this.lastAuthorityUs = candidate.timeUs;
  }
  snapshot(): Baseline {
    return structuredClone(this.baseline);
  }
  finish(outcome: Outcome) {
    if (
      this.outcome ||
      !sameIdentity(outcome.identity, this.baseline.identity) ||
      outcome.roundId !== this.baseline.round.roundId
    )
      return;
    validateMessage("Outcome", outcome, this.baseline.context);
    this.outcome = structuredClone(outcome);
    this.pending = [];
  }
  private observeObjects(objects: readonly import("@dashdevil/contracts/protocol").ObjectState[]) {
    for (const object of objects) {
      const kind = object.flags & 3;
      if (!(object.flags & (kind === 2 ? 8 << this.baseline.identity.seat : 4))) continue;
      const key = `${object.id}:${kind}`;
      if (this.feedbackSeen.has(key)) continue;
      this.feedbackSeen.add(key);
      this.feedback.push(
        kind === 2 ? "Obstacle hit" : kind === 3 ? "Heart consumed" : "Coin consumed",
      );
    }
  }
  private observeSounds(
    objects: readonly import("@dashdevil/contracts/protocol").ObjectState[],
    cars: readonly Car[],
    timeUs: number,
    episode: number,
    observation?: Observation,
    previousCars: readonly Car[] = this.baseline.cars,
  ) {
    const seat = this.baseline.identity.seat;
    const car = cars[seat];
    const g = this.configuration.gameplay;
    const emit = (key: string, sound: RaceSound) => {
      if (this.soundSeen.has(key)) return;
      this.soundSeen.add(key);
      this.sounds.push(sound);
    };
    for (const object of objects) {
      const kind = object.flags & 3;
      if (kind === 2) {
        if (object.flags & (8 << seat))
          emit(`object:${object.id}`, {
            type: "impact",
            protected: previousCars[seat].protectionUs > timeUs,
          });
        continue;
      }
      if (!(object.flags & 4)) continue;
      // Pickup consumption is global. Identify the sole overlapping collector,
      // including hearts consumed at full HP. A simultaneous contested pickup is silent.
      const size = kind === 3 ? g.heartSize : g.coinSize;
      const overlaps = cars.map(
        (candidate) =>
          Math.abs(candidate.lateral - (object.lane - 1) * g.laneSpacing) <=
            (g.carWidth + size) / 2 + 0.001 &&
          Math.abs(candidate.progress - object.distance) <= (g.carHeight + size) / 2 + 0.001,
      );
      if (overlaps[seat] && !overlaps[1 - seat])
        emit(`object:${object.id}`, { type: kind === 3 ? "heart" : "coin" });
    }
    if (episode > this.soundEpisode) {
      this.soundEpisode = episode;
      emit(`contact:${episode}`, {
        type: "impact",
        protected: previousCars[seat].protectionUs > timeUs,
      });
    }
    if ((!observation || observation.type === "objects") && car.hp < previousCars[seat].hp)
      emit(`damage:${timeUs}`, { type: "damage" });
    if (
      car.phase === 1 &&
      ((observation?.type === "shift" && observation.seat === seat) ||
        previousCars[seat].phase !== 1 ||
        car.movementStartUs !== previousCars[seat].movementStartUs)
    )
      emit(`lane:${car.inputGeneration}:${car.movementStartUs}`, { type: "lane" });
  }
  private drainSounds() {
    const sounds = this.sounds;
    this.sounds = [];
    return sounds;
  }
  frame(estimatedUs: number, authorityAgeUs: number) {
    if (this.outcome)
      return {
        feedback: [] as string[],
        sounds: this.drainSounds(),
        objects: this.baseline.windows.flatMap((window) => window.objects),
        renderedCars: this.outcome.cars.map((c) => ({ ...c, tilt: 0 })),
        cars: this.outcome.cars.map((c, seat) => ({
          ...this.baseline.cars[seat],
          ...c,
          effective: 0,
          controls: 0,
          heldMask: 0,
          flags: 0,
        })) as Car[],
        timeUs: this.outcome.timeUs,
        outcome: this.outcome,
        awaiting: false,
        stale: false,
        needsRecovery: false,
      };
    const stale = authorityAgeUs >= 1000000 || estimatedUs - this.lastAuthorityUs > 1000000;
    const target = Math.max(
      this.baseline.timeUs,
      this.lastFrameUs,
      Math.min(estimatedUs, this.lastAuthorityUs + 1000000),
    );
    let resetTilt = false;
    const dt = Math.max(0, (target - this.lastFrameUs) / 1e6);
    this.completeSettling(target);
    if (this.correction) {
      const previous = this.predict(
        target,
        false,
        this.correction.baseline,
        this.correction.pending,
      );
      const repaired = this.predict(target, false);
      const remaining = this.remainingOffset(target);
      const delta = repaired.renderedCars.map((car, seat) => ({
        progress: previous.renderedCars[seat].progress - car.progress,
        lateral: previous.renderedCars[seat].lateral - car.lateral,
      }));
      const offset = delta.map((change, seat) => ({
        progress: change.progress + (this.offset?.[seat].progress ?? 0) * remaining,
        lateral: change.lateral + (this.offset?.[seat].lateral ?? 0) * remaining,
      }));
      const g = this.configuration.gameplay;
      const bounds = (seat: number, corrected: boolean) => {
        const car = repaired.renderedCars[seat],
          correction = corrected ? { progress: 0, lateral: 0 } : offset[seat];
        return {
          left: car.lateral + correction.lateral - g.carWidth / 2,
          right: car.lateral + correction.lateral + g.carWidth / 2,
          top: car.progress + correction.progress - g.carHeight / 2,
          bottom: car.progress + correction.progress + g.carHeight / 2,
        };
      };
      const crossesCars =
        firstContact(bounds(0, false), bounds(0, true), bounds(1, false), bounds(1, true)) !== null;
      const snap =
        crossesCars ||
        this.snapCorrection ||
        offset.some(
          (o) => Math.abs(o.progress) > g.carHeight || Math.abs(o.lateral) > g.laneSpacing,
        ) ||
        repaired.cars.some((c) => c.phase === 2) ||
        (Math.abs(repaired.renderedCars[0].progress - repaired.renderedCars[1].progress) <=
          g.carHeight &&
          Math.abs(repaired.renderedCars[0].lateral - repaired.renderedCars[1].lateral) <=
            g.carWidth);
      const changed = delta.some((o) => Math.abs(o.progress) > 1e-6 || Math.abs(o.lateral) > 1e-6);
      if (changed) {
        delta.forEach((o, seat) => {
          const d = this.diagnostics[seat];
          if (Math.abs(o.progress) <= 1e-6 && Math.abs(o.lateral) <= 1e-6) return;
          d.corrections++;
          if (
            Math.abs(o.progress) > g.carHeight * 0.25 ||
            Math.abs(o.lateral) > g.laneSpacing * 0.1
          )
            d.abrupt++;
          if (snap) d.snaps++;
        });
        if (this.settlingSince === undefined) this.settlingSince = this.correction.receivedUs;
      }
      if (snap) {
        resetTilt = true;
        this.offset = undefined;
        this.settlingSince = undefined;
      } else {
        this.offset = offset;
        this.settleStartUs = target;
        // Updates inside a settling window keep its original deadline.
        if (this.settleEndUs <= target)
          this.settleEndUs = target + this.configuration.presentation.correctionSmoothing * 1e6;
      }
    }
    this.correction = undefined;
    this.snapCorrection = false;
    this.lastFrameUs = target;
    const state = this.predict(target, true);
    const remaining = this.remainingOffset(target);
    const { carTiltMaxAngle, carTiltLerpSpeed } = this.configuration.presentation;
    // Match Long Drive's 60 Hz easing; only actual lane movement produces tilt.
    const ease =
      carTiltLerpSpeed < 60
        ? 1 - Math.pow(1 - carTiltLerpSpeed / 60, dt * 60)
        : 1 - Math.exp(-carTiltLerpSpeed * dt);
    const renderedCars = state.renderedCars.map((car, seat) => {
      const movement = state.cars[seat];
      const laneDiff =
        movement.phase === 0
          ? 0
          : (movement.movementTarget - car.lateral) / this.configuration.gameplay.laneSpacing;
      const targetTilt = Math.max(-1, Math.min(1, laneDiff)) * carTiltMaxAngle;
      this.carTilts[seat] = resetTilt
        ? 0
        : this.carTilts[seat] + (targetTilt - this.carTilts[seat]) * ease;
      return {
        progress: car.progress + (this.offset?.[seat].progress ?? 0) * remaining,
        lateral: car.lateral + (this.offset?.[seat].lateral ?? 0) * remaining,
        tilt: this.carTilts[seat],
      };
    });
    this.rendered = renderedCars;
    this.completeSettling(target);
    const feedback = this.feedback;
    this.feedback = [];
    return {
      feedback,
      sounds: this.drainSounds(),
      objects: state.objects,
      renderedCars,
      cars: state.cars,
      timeUs: state.timeUs,
      outcome: undefined as Outcome | undefined,
      needsRecovery: state.needsRecovery,
      awaiting:
        state.cars.some((c) => c.hp === 0) ||
        (this.baseline.context.mode === 1
          ? state.cars.some(
              (c) =>
                c.progress + this.configuration.gameplay.carHeight / 2 >=
                this.baseline.context.gameplay.finishDistance,
            )
          : state.timeUs >= this.baseline.context.gameplay.timeLimit * 1e6),
      stale,
    };
  }
  private completeSettling(target: number) {
    if (this.settlingSince !== undefined && target >= this.settleEndUs) {
      for (const d of this.diagnostics)
        d.maxSettlingUs = Math.max(d.maxSettlingUs, this.nowUs() - this.settlingSince);
      this.settlingSince = undefined;
    }
  }
  private remainingOffset(target: number) {
    return Math.max(
      0,
      Math.min(1, (this.settleEndUs - target) / (this.settleEndUs - this.settleStartUs || 1)),
    );
  }
  private predict(
    target: number,
    observe: boolean,
    baseline = this.baseline,
    inputs = this.pending,
  ) {
    const { game, ids } = this.engine(baseline);
    const rate = this.configuration.gameplay.tickRate;
    const g = this.configuration.gameplay;
    const extent = (g.carHeight + Math.max(g.obstacleH, g.coinSize, g.heartSize)) / 2;
    let needsRecovery = false;
    const covered = (cars: readonly Car[]) =>
      cars.every((car) =>
        baseline.windows.some(
          (window) => window.start <= car.progress - extent && window.end >= car.progress + extent,
        ),
      );
    const step = (publish = observe) => {
      const previous = game.snapshot();
      const events = game.advanceTo((game.processedTick + 1) / rate, true);
      if (!covered(game.preview().cars)) {
        game.restore(
          previous.cars,
          previous.tick,
          previous.objects,
          previous.timeUs,
          previous.contact,
        );
        needsRecovery = true;
        return;
      }
      if (publish)
        for (const event of events) {
          if (event.objects) this.observeObjects(event.objects);
          this.observeSounds(
            event.objects ?? [],
            event.cars ?? game.preview().cars,
            event.timeUs,
            game.preview().contact.episode,
            event,
            previous.cars,
          );
        }
    };
    const advance = (us: number) => {
      const tick = Math.floor((us * rate) / 1e6);
      while (!needsRecovery && game.processedTick < tick) step();
    };
    for (const pending of inputs) {
      if (pending.timeUs > target) break;
      advance(pending.timeUs);
      // Provisional sequence is contiguous relative to this replay's cutoff.
      if (
        game.snapshot().cars[pending.input.identity.seat].lastInput === 0 &&
        pending.input.sequence > 1
      ) {
        const snapshot = game.snapshot();
        snapshot.cars[pending.input.identity.seat].lastInput = pending.input.sequence - 1;
        game.restore(
          snapshot.cars,
          snapshot.tick,
          snapshot.objects,
          snapshot.timeUs,
          snapshot.contact,
        );
      }
      game.submit(ids[pending.input.identity.seat], {
        ...pending.input,
        identity: ids[pending.input.identity.seat],
      });
    }
    advance(target);
    const state = game.preview();
    if (!needsRecovery) step(false);
    const next = game.preview();
    const fraction = Math.max(0, Math.min(1, (target * rate) / 1e6 - state.tick));
    const renderedCars = state.cars.map((car, seat) => ({
      progress: car.progress + (next.cars[seat].progress - car.progress) * fraction,
      lateral: car.lateral + (next.cars[seat].lateral - car.lateral) * fraction,
    }));
    return { ...state, renderedCars, needsRecovery };
  }
}
