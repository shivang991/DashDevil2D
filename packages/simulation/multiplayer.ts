import { type Car, type Context, type Identity, type Input } from '@dashdevil/contracts/protocol';
import type { Configuration } from './config';
import { MultiplayerTrack } from './multiplayerTrack';
import { configurationContext, validateMessage } from '@dashdevil/contracts/validation';

export type MultiplayerConfiguration = Configuration<'drag-race' | 'road-rage'>;
export interface Observation {
 readonly type: 'input' | 'shift' | 'shift-end' | 'expiry' | 'release' | 'abandoned';
 readonly tick: number; readonly timeUs: number; readonly seat?: number;
 readonly car?: Readonly<Car>; readonly sequence?: number; readonly disposition?: 'accepted' | 'ignored' | 'rejected';
}
export function canonicalTime(seconds: number): number {
 const value = Math.floor(seconds * 1e6 + .5);
 if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(value)) throw new Error('Unrepresentable round time');
 return value;
}
const sameIdentity = (a: Identity, b: Identity) => a.roomId === b.roomId && a.seatSession === b.seatSession && a.pairGeneration === b.pairGeneration && a.seat === b.seat;
/** Serialized headless round owner. An adapter supplies its authenticated identity;
 * the payload cannot choose a different seat. All clocks are monotonic elapsed seconds. */
export class Multiplayer {
 private readonly context: Context;
 private readonly tracks: readonly [MultiplayerTrack, MultiplayerTrack];
 private tick = 0;
 private wallTime = 0;
 private abandoned = false;
 private readonly cars: [Car, Car];
 private pending: { seat: number; input: Input; valid: boolean }[] = [];
 private releases: Observation[] = [];
 private readonly identities: readonly [Identity, Identity];
 private readonly sequences = [0, 0];
 private readonly tokens: number[];
 private readonly connected = [true, true];
 private order = 0;
 private latestPress: { seat: number; control: number; sequence: number; timeUs: number; order: number } | null = null;
 constructor(private readonly configuration: MultiplayerConfiguration, seed: number, identities: readonly [Identity, Identity], private readonly roundId = 1) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Seed must be a nonzero uint32');
  if (!Number.isInteger(roundId) || roundId < 1 || roundId > 0xffffffff || identities.some((identity, seat) => identity.seat !== seat || [identity.roomId, identity.seatSession, identity.pairGeneration].some(v => !Number.isInteger(v) || v < 1 || v > 0xffffffff))) throw new Error('Invalid round/seat identity');
  this.context = configurationContext(configuration, seed);
  this.tracks = [new MultiplayerTrack(configuration, seed), new MultiplayerTrack(configuration, seed)];
  this.identities = [{ ...identities[0] }, { ...identities[1] }];
  this.tokens = [configuration.connection.inputBurst, configuration.connection.inputBurst];
  this.cars = [0, 2].map(lane => ({ progress: 0, lateral: (lane - 1) * configuration.gameplay.laneSpacing,
   normalSpeed: configuration.gameplay.startingRoadSpeed, lane, departure: lane, target: lane, phase: 0,
   controls: 0, effective: 0, flags: 0, movementOrigin: (lane - 1) * configuration.gameplay.laneSpacing,
   movementTarget: (lane - 1) * configuration.gameplay.laneSpacing, movementStartUs: 0, movementEndUs: 0,
   nextShiftUs: 0, freshnessUs: 0, protectionUs: 0, hp: configuration.gameplay.maxHealth, score: 0,
   lastInput: 0, heldMask: 0, inputGeneration: 1 })) as [Car, Car];
  this.updateTrack();
 }
 submit(authenticated: Identity, input: Input): boolean {
  const seat = authenticated.seat, identity = this.identities[seat];
  if (!identity || !sameIdentity(identity, authenticated)) return false;
  if (this.tokens[seat] < 1 || this.pending.length >= 2 * this.configuration.connection.inputBurst) throw new Error('Input rate/queue exceeded; recover connection');
  this.tokens[seat]--;
  let valid = this.connected[seat] && !this.abandoned && sameIdentity(identity, input.identity) && input.round.roundId === this.roundId && input.round.inputGeneration === this.cars[seat].inputGeneration && input.sequence === this.sequences[seat] + 1;
  try { validateMessage('Input', input, this.context); } catch { valid = false; }
  if (valid) this.sequences[seat] = input.sequence;
  this.pending.push({ seat, input: { ...input, identity: { ...input.identity }, round: { ...input.round } }, valid });
  return valid;
 }
 private updateTrack(): void {
  const g = this.configuration.gameplay;
  const extent = (g.carHeight + Math.max(g.obstacleH, g.coinSize, g.heartSize)) / 2;
  this.tracks.forEach((track, seat) => {
   track.ensureThrough(this.cars[seat].progress + g.maxRoadSpeed * g.accelSpeedMultiplier + extent);
   track.retireBehind(this.cars[seat].progress - g.carHeight / 2);
  });
 }
 private clear(car: Car): void { car.controls = 0; car.effective = 0; car.heldMask = 0; car.flags = 0; car.freshnessUs = 0; }
 disconnect(authenticated: Identity): void {
  const identity = this.identities[authenticated.seat];
  if (!identity || !sameIdentity(identity, authenticated) || this.abandoned) return;
  this.connected[authenticated.seat] = false;
  this.clear(this.cars[authenticated.seat]);
  for (const queued of this.pending) if (queued.seat === authenticated.seat) queued.valid = false;
  this.releases.push({ type: 'release', tick: this.tick, timeUs: canonicalTime(this.tick / this.configuration.gameplay.tickRate), seat: authenticated.seat, car: { ...this.cars[authenticated.seat] } });
 }
 private shift(car: Car, seat: number, timeUs: number, events: Observation[]): void {
  const g = this.configuration.gameplay;
  if (car.phase !== 0 || (car.effective !== 1 && car.effective !== 2) || timeUs < car.nextShiftUs) return;
  const target = Math.max(0, Math.min(2, car.lane + (car.effective === 1 ? -1 : 1)));
  if (target === car.lane) return;
  car.phase = 1; car.departure = car.lane; car.target = target; car.movementOrigin = car.lateral;
  car.movementTarget = (target - 1) * g.laneSpacing; car.movementStartUs = timeUs;
  car.movementEndUs = timeUs + canonicalTime(g.laneShiftDuration);
  car.nextShiftUs = timeUs + canonicalTime(g.laneSwitchCooldownDuration);
  events.push({ type: 'shift', tick: this.tick, timeUs, seat, car: { ...car } });
 }
 private boundaries(timeUs: number, events: Observation[]): void {
  this.cars.forEach((car, seat) => {
   if (car.effective !== 0 && car.freshnessUs <= timeUs) {
    this.clear(car); events.push({ type: 'expiry', tick: this.tick, timeUs, seat, car: { ...car } });
   }
   if (car.phase !== 0 && car.movementEndUs <= timeUs) {
    car.lateral = car.movementTarget; car.lane = car.target; car.phase = 0;
    events.push({ type: 'shift-end', tick: this.tick, timeUs, seat, car: { ...car } });
   }
  });
 }
 private apply(events: Observation[], timeUs: number): void {
  // Stable sorting preserves arrival order within each authenticated seat.
  for (const { seat, input, valid } of this.pending.sort((a,b) => a.seat - b.seat)) {
   const car = this.cars[seat];
   let disposition: Observation['disposition'] = valid ? 'accepted' : 'rejected';
   if (valid) {
    car.lastInput = input.sequence;
    if (input.intent === 0) {
     if (input.control === 0 || (car.heldMask & (1 << (input.control - 1))) !== 0 || car.phase === 2) disposition = 'ignored';
     else {
      car.heldMask |= 1 << (input.control - 1); car.controls = input.control; car.effective = input.control;
      car.flags = input.control === 3 ? 1 : 0;
      car.freshnessUs = timeUs + canonicalTime(this.configuration.connection.controlFreshnessExpiry);
      if (this.configuration.mode === 'road-rage') this.latestPress = { seat, control: input.control, sequence: input.sequence, timeUs, order: ++this.order };
     }
    } else if (input.intent === 1) {
     if (input.control === 0) this.clear(car);
     else { car.heldMask &= ~(1 << (input.control - 1)); if (car.controls === input.control) { car.controls = 0; car.effective = 0; car.flags = 0; car.freshnessUs = 0; } }
    } else if (car.effective === 0 || input.control !== car.controls || input.heldMask !== car.heldMask) disposition = 'ignored';
    else car.freshnessUs = timeUs + canonicalTime(this.configuration.connection.controlFreshnessExpiry);
   }
   events.push({ type: 'input', tick: this.tick, timeUs, seat, sequence: input.sequence, disposition, car: { ...car } });
   if (disposition === 'accepted') this.shift(car, seat, timeUs, events);
  }
  this.pending = [];
 }
 advanceTo(seconds: number): Observation[] {
  canonicalTime(seconds);
  if (seconds < this.wallTime) throw new Error('Monotonic clock moved backwards');
  if (this.abandoned) return [];
  this.tokens.forEach((tokens, seat) => { this.tokens[seat] = Math.min(this.configuration.connection.inputBurst, tokens + (seconds - this.wallTime) * this.configuration.connection.inputRate); });
  this.wallTime = seconds;
  const g = this.configuration.gameplay;
  const events = this.releases; this.releases = [];
  if (seconds - this.tick / g.tickRate > this.configuration.operational.simulationLagThreshold) {
   this.abandoned = true; this.pending = []; this.cars.forEach(car => this.clear(car));
   events.push({ type: 'abandoned', tick: this.tick, timeUs: canonicalTime(this.tick / g.tickRate) }); return events;
  }
  while ((this.tick + 1) / g.tickRate <= seconds) {
   if (this.tick === 0xffffffff) throw new Error('Tick exhausted');
   let time = this.tick / g.tickRate;
   const end = (this.tick + 1) / g.tickRate;
   this.boundaries(canonicalTime(time), events); this.apply(events, canonicalTime(time));
   while (time < end) {
    const startUs = canonicalTime(time);
    this.cars.forEach((car, seat) => this.shift(car, seat, startUs, events));
    let next = end;
    for (const car of this.cars) {
     if (car.effective !== 0 && car.freshnessUs > startUs) next = Math.min(next, car.freshnessUs / 1e6);
     if (car.phase !== 0 && car.movementEndUs > startUs) next = Math.min(next, car.movementEndUs / 1e6);
     if (car.phase === 0 && (car.effective === 1 || car.effective === 2) && car.nextShiftUs > startUs) next = Math.min(next, car.nextShiftUs / 1e6);
    }
    const elapsed = next - time;
    for (const car of this.cars) {
     // Integrate continuous normal-speed growth exactly, splitting at the cap.
     const normal = Math.min(g.maxRoadSpeed, g.startingRoadSpeed + g.speedGrowth * time);
     const ramp = g.speedGrowth === 0 ? 0 : Math.min(elapsed, Math.max(0, (g.maxRoadSpeed - normal) / g.speedGrowth));
     const rampDistance = normal * ramp + .5 * g.speedGrowth * ramp * ramp;
     const distance = rampDistance + Math.min(g.maxRoadSpeed, normal + g.speedGrowth * ramp) * (elapsed - ramp);
     car.progress += distance * (car.effective === 3 ? g.accelSpeedMultiplier : 1);
     car.normalSpeed = Math.min(g.maxRoadSpeed, g.startingRoadSpeed + g.speedGrowth * next);
     if (car.phase !== 0) car.lateral = car.movementOrigin + (car.movementTarget - car.movementOrigin) * ((next * 1e6 - car.movementStartUs) / (car.movementEndUs - car.movementStartUs));
    }
    time = next; this.boundaries(canonicalTime(time), events);
   }
   this.updateTrack();
   this.tick++;
  }
  return events;
 }
 private trackState() {
  const states = this.tracks.map(track => track.snapshot());
  const leading = states[0].through >= states[1].through ? states[0] : states[1];
  const slices = new Map(states.flatMap(state => state.slices).map(slice => [slice.id, slice]));
  return { ...leading, slices: [...slices.values()].sort((a,b) => a.id - b.id) };
 }
 snapshot() { return { tick: this.tick, timeUs: canonicalTime(this.tick / this.configuration.gameplay.tickRate), abandoned: this.abandoned, track: this.trackState(),
  cars: this.cars.map(car => ({ ...car })) as [Car, Car], latestPress: this.latestPress ? { ...this.latestPress } : null }; }
}
