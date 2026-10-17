import { Multiplayer, canonicalTime, type MultiplayerConfiguration } from '@dashdevil/simulation/multiplayer';
import { captureConfiguration } from '@dashdevil/simulation/config';
import { validateBaseline, validateMessage } from '@dashdevil/contracts/validation';
import type { Baseline, Car, Coverage, Disposition, Event, Input, Outcome } from '@dashdevil/contracts/protocol';

/** Client prediction owns copied simulation state; rendering never writes it. */
export class RaceSession {
  private feedbackSeen = new Set<string>();
  private feedback: string[] = [];
  private baseline: Baseline;
  private configuration: MultiplayerConfiguration;
  private pending: { input: Input; timeUs: number }[] = [];
  private outcome?: Outcome;
  private lastAuthorityUs: number;
  private lastFrameUs: number;
  constructor(baseline: Baseline) {
    this.baseline = structuredClone(baseline);
    const c = baseline.context;
    const mode = c.mode === 1 ? 'drag-race' : 'road-rage';
    // Wire Gameplay includes fields for all modes; capture only this mode's keys.
    const defaults = captureConfiguration(mode).gameplay;
    const gameplay = Object.fromEntries(Object.keys(defaults).map(key => [key, c.gameplay[key as keyof typeof c.gameplay]]));
    this.configuration = captureConfiguration(mode, { gameplay, presentation: c.presentation, room: c.room, connection: c.connection, operational: c.operational });
    validateBaseline(baseline, c);
    this.lastAuthorityUs = baseline.timeUs;
    this.lastFrameUs = baseline.timeUs;
  }
  install(baseline: Baseline) {
    if (this.outcome || baseline.round.roundId !== this.baseline.round.roundId || baseline.tick < this.baseline.tick || baseline.progress.authority < this.baseline.progress.authority || baseline.timeUs < this.baseline.timeUs) return;
    validateBaseline(baseline, this.baseline.context);
    this.baseline = structuredClone(baseline);
    const cutoff = baseline.identity.seat === 0 ? baseline.progress.processed1 : baseline.progress.processed2;
    this.pending = this.pending.filter(p => p.input.sequence > cutoff);
    this.lastAuthorityUs = baseline.timeUs;
  }
  private engine(baseline = this.baseline) {
    const ids = [0, 1].map(seat => ({ ...baseline.identity, seat })) as [Baseline['identity'], Baseline['identity']];
    const game = new Multiplayer(this.configuration, baseline.context.seed, ids, baseline.round.roundId);
    game.restore(baseline.cars, baseline.tick, baseline.windows.flatMap(window => window.objects), baseline.timeUs);
    return { game, ids };
  }
  input(input: Input, timeUs: number) {
    if (this.outcome || input.round.roundId !== this.baseline.round.roundId) return;
    if (this.pending.length >= 512) throw new Error('Prediction input history exhausted');
    this.pending.push({ input: structuredClone(input), timeUs: Math.max(this.baseline.timeUs, timeUs) });
  }
  /** Accepted input state arrives at the server's tick, never at client send time. */
  disposition(record: Disposition) {
    if (this.outcome || record.round.roundId !== this.baseline.round.roundId || record.authority <= this.baseline.progress.authority) return;
    this.advanceAuthority(record.tick);
    this.baseline.cars[record.seat] = { ...record.car };
    this.baseline.contact = { ...record.contact };
    this.baseline.progress.authority = record.authority;
    if (record.seat === 0) { this.baseline.progress.processed1 = record.processed; this.baseline.progress.disposed1 = record.processed; }
    else { this.baseline.progress.processed2 = record.processed; this.baseline.progress.disposed2 = record.processed; }
    if (record.seat === this.baseline.identity.seat) this.pending = this.pending.filter(p => p.input.sequence > record.processed);
  }
  event(record: Event) {
    if (this.outcome || record.round.roundId !== this.baseline.round.roundId || record.authority <= this.baseline.progress.authority) return;
    this.advanceAuthority(record.tick);
    this.baseline.cars = structuredClone(record.cars);
    this.baseline.tick = record.tick; this.baseline.timeUs = record.timeUs;
    for (const object of record.objects) for (const window of this.baseline.windows) {
      const index = window.objects.findIndex(placement => placement.id === object.id);
      if (index >= 0) window.objects[index] = { ...object };
    }
    this.observeObjects(record.objects);
    this.baseline.contact = { ...record.contact };
    this.baseline.progress.authority = record.authority; this.baseline.progress.event = record.eventId;
  }
  advanceAuthority(tick: number): Baseline {
    if (this.outcome || tick <= this.baseline.tick) return this.snapshot();
    const { game } = this.engine();
    // Replay in bounded steps: a late network record is not a server overload.
    while (game.snapshot().tick < tick) game.advanceTo(Math.min(tick, game.snapshot().tick + 30) / this.configuration.gameplay.tickRate, true);
    const state = game.snapshot();
    this.baseline.windows.forEach(window => { window.objects = window.objects.map(object => state.objects.find(current => current.id === object.id) ?? object); });
    this.baseline.cars = state.cars; this.baseline.tick = tick;
    this.baseline.timeUs = canonicalTime(tick / this.configuration.gameplay.tickRate);
    this.lastAuthorityUs = this.baseline.timeUs;
    return this.snapshot();
  }
  coverage(record: Coverage) {
    if (this.outcome || record.tick < this.baseline.tick) return;
    this.advanceAuthority(record.tick);
    this.baseline.generator = structuredClone(record.generator);
    this.baseline.windows = structuredClone(record.windows);
  }
  snapshot(): Baseline { return structuredClone(this.baseline); }
  finish(outcome: Outcome) {
    if (this.outcome || outcome.roundId !== this.baseline.round.roundId) return;
    validateMessage('Outcome', outcome, this.baseline.context);
    this.outcome = structuredClone(outcome); this.pending = [];
  }
  private observeObjects(objects: readonly import('@dashdevil/contracts/protocol').ObjectState[]) {
    for (const object of objects) {
      const kind = object.flags & 3;
      if (!(object.flags & (kind === 2 ? 8 << this.baseline.identity.seat : 4))) continue;
      const key = `${object.id}:${kind}`;
      if (this.feedbackSeen.has(key)) continue;
      this.feedbackSeen.add(key);
      this.feedback.push(kind === 2 ? 'Obstacle hit' : kind === 3 ? 'Heart consumed' : 'Coin consumed');
    }
  }
  frame(estimatedUs: number, authorityAgeUs: number) {
    if (this.outcome) return { feedback: [] as string[], objects: this.baseline.windows.flatMap(window => window.objects), renderedCars: this.outcome.cars.map(c => ({ ...c })), cars: this.outcome.cars.map((c, seat) => ({ ...this.baseline.cars[seat], ...c, effective: 0, controls: 0, heldMask: 0, flags: 0 })) as Car[], timeUs: this.outcome.timeUs, outcome: this.outcome, awaiting: false, stale: false };
    const stale = authorityAgeUs >= 1000000 || estimatedUs - this.lastAuthorityUs > 1000000;
    const target = Math.max(this.baseline.timeUs, this.lastFrameUs, Math.min(estimatedUs, this.lastAuthorityUs + 1000000));
    this.lastFrameUs = target;
    const { game, ids } = this.engine();
    const rate = this.configuration.gameplay.tickRate;
    const advance = (us: number) => { const tick = Math.floor(us * rate / 1e6); while (game.snapshot().tick < tick) { const events = game.advanceTo(Math.min(tick, game.snapshot().tick + 30) / rate, true); for (const event of events) if (event.objects) this.observeObjects(event.objects); } };
    for (const pending of this.pending) {
      if (pending.timeUs > target) break;
      advance(pending.timeUs);
      // Provisional sequence is contiguous relative to this replay's cutoff.
      if (game.snapshot().cars[pending.input.identity.seat].lastInput === 0 && pending.input.sequence > 1) {
        const snapshot = game.snapshot(); snapshot.cars[pending.input.identity.seat].lastInput = pending.input.sequence - 1;
        game.restore(snapshot.cars, snapshot.tick, snapshot.objects, snapshot.timeUs);
      }
      game.submit(ids[pending.input.identity.seat], { ...pending.input, identity: ids[pending.input.identity.seat] });
    }
    advance(target);
    const state = game.snapshot();
    game.advanceTo((state.tick + 1) / rate, true);
    const next = game.snapshot();
    const fraction = Math.max(0, Math.min(1, target * rate / 1e6 - state.tick));
    const renderedCars = state.cars.map((car, seat) => ({ progress: car.progress + (next.cars[seat].progress - car.progress) * fraction, lateral: car.lateral + (next.cars[seat].lateral - car.lateral) * fraction }));
    const feedback = this.feedback; this.feedback = [];
    return { feedback, objects: state.objects, renderedCars, cars: state.cars, timeUs: state.timeUs, outcome: undefined as Outcome | undefined,
      awaiting: this.baseline.context.mode === 1 && state.cars.some(c => c.hp === 0 || c.progress + this.configuration.gameplay.carHeight / 2 >= this.baseline.context.gameplay.finishDistance), stale };
  }
}
