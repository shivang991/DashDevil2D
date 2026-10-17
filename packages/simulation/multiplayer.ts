import { type Car, type Context, type Identity, type Input, type ObjectState } from '@dashdevil/contracts/protocol';
import type { Configuration } from './config';
import { MultiplayerTrack } from './multiplayerTrack';
import { configurationContext, validateMessage } from '@dashdevil/contracts/validation';

export type MultiplayerConfiguration = Configuration<'drag-race' | 'road-rage'>;
export interface Observation {
 readonly objects?: readonly ObjectState[]; readonly cars?: readonly Car[];
 readonly type: 'contact' | 'objects' | 'input' | 'shift' | 'shift-end' | 'expiry' | 'release' | 'abandoned';
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
 private represented?: readonly ObjectState[];
 private continuationUs?: number;
 private consumption = new Map<number, number>();
 private readonly tracks: readonly [MultiplayerTrack, MultiplayerTrack];
 private tick = 0;
 private wallTime = 0;
 private abandoned = false;
 private finish?: { tick: number; timeUs: number; result: number; reason: number };
 private readonly cars: [Car, Car];
 private pending: { seat: number; input: Input; valid: boolean }[] = [];
 private releases: Observation[] = [];
 private readonly identities: readonly [Identity, Identity];
 private readonly sequences = [0, 0];
 private readonly tokens: number[];
 private readonly connected = [true, true];
 private order = 0;
 private latestPress: { seat: number; control: number; sequence: number; timeUs: number; order: number } | null = null;
 private readonly configuration: MultiplayerConfiguration;
 private readonly roundId: number;
 constructor(configuration: MultiplayerConfiguration, seed: number, identities: readonly [Identity, Identity], roundId = 1) {
  this.configuration = configuration; this.roundId = roundId;
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
  if (!identity || !sameIdentity(identity, authenticated) || this.finish || this.abandoned) return false;
  if (this.tokens[seat] < 1 || this.pending.length >= 2 * this.configuration.connection.inputBurst) throw new Error('Input rate/queue exceeded; recover connection');
  this.tokens[seat]--;
  let valid = this.connected[seat] && !this.abandoned && sameIdentity(identity, input.identity) && input.round.roundId === this.roundId && input.round.inputGeneration === this.cars[seat].inputGeneration && input.sequence === this.sequences[seat] + 1;
  try { validateMessage('Input', input, this.context); } catch { valid = false; }
  if (valid) this.sequences[seat] = input.sequence;
  this.pending.push({ seat, input: { ...input, identity: { ...input.identity }, round: { ...input.round } }, valid });
  return valid;
 }
 /** Restore a copied authoritative continuation at an exact simulation boundary. */
 restore(cars: readonly Car[], tick: number, objects?: readonly ObjectState[], timeUs = canonicalTime(tick / this.configuration.gameplay.tickRate)): void {
  this.represented = objects?.map(object => ({ ...object })); this.continuationUs = timeUs === canonicalTime(tick / this.configuration.gameplay.tickRate) ? undefined : timeUs;
  this.consumption = new Map((objects ?? []).map(object => [object.id, object.flags & 28]));
  if (!Number.isSafeInteger(tick) || tick < 0 || cars.length !== 2) throw new Error('Invalid continuation');
  this.tick = tick; this.wallTime = tick / this.configuration.gameplay.tickRate;
  this.pending = []; this.releases = []; this.abandoned = false; this.finish = undefined;
  cars.forEach((car, seat) => { this.cars[seat] = { ...car }; this.sequences[seat] = car.lastInput; this.connected[seat] = true; });
  this.updateTrack();
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
  if (!identity || !sameIdentity(identity, authenticated) || this.abandoned || this.finish) return;
  this.connected[authenticated.seat] = false;
  this.clear(this.cars[authenticated.seat]);
  for (const queued of this.pending) if (queued.seat === authenticated.seat) queued.valid = false;
  this.releases.push({ type: 'release', tick: this.tick, timeUs: canonicalTime(this.tick / this.configuration.gameplay.tickRate), seat: authenticated.seat, car: { ...this.cars[authenticated.seat] } });
 }
 private shift(car: Car, seat: number, timeUs: number, events: Observation[]): void {
  const g = this.configuration.gameplay;
  if (this.tailgating(seat) || car.phase !== 0 || (car.effective !== 1 && car.effective !== 2) || timeUs < car.nextShiftUs) return;
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
 advanceTo(seconds: number, provisional = false): Observation[] {
  canonicalTime(seconds);
  if (seconds < this.wallTime) throw new Error('Monotonic clock moved backwards');
  if (this.abandoned || this.finish && !provisional) return [];
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
   let time = Math.max(this.tick / g.tickRate, (this.continuationUs ?? 0) / 1e6);
   this.continuationUs = undefined;
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
    const collision = this.playerContact(time, next);
    if (collision !== undefined) next = Math.min(next, collision);
    next = this.clearance(time, next);
    const contacts = this.objectContacts(time, next);
    let finishTime = Infinity, finishMask = 0;
    if (!provisional && this.configuration.mode === 'drag-race') {
     const finish = this.context.gameplay.finishDistance;
     for (let seat = 0; seat < this.cars.length; seat++) {
      const car = this.cars[seat], remaining = finish - g.carHeight / 2 - car.progress;
      const multiplier = this.multiplier(this.cars.indexOf(car));
      if (this.forwardDistance(time, next - time) * multiplier < remaining) continue;
      let low = time, high = next;
      for (let n = 0; n < 52; n++) { const middle = low + (high - low) / 2; if (this.forwardDistance(time, middle - time) * multiplier < remaining) low = middle; else high = middle; }
      if (finishTime === Infinity || canonicalTime(high) < canonicalTime(finishTime)) { finishTime = high; finishMask = 1 << seat; }
      else if (canonicalTime(high) === canonicalTime(finishTime)) finishMask |= 1 << seat;
     }
     if (finishMask) next = finishTime;
    }
    const first = contacts[0];
    if (first && first.timeUs <= canonicalTime(next)) {
     if (finishMask && first.timeUs < canonicalTime(next)) finishMask = 0;
     next = Math.min(next, Math.max(time, first.timeUs / 1e6));
    }
    const elapsed = next - time;
    const multipliers = this.cars.map((_, seat) => this.multiplier(seat));
    for (const [seat, car] of this.cars.entries()) {
     car.progress += this.forwardDistance(time, elapsed) * multipliers[seat];
     car.normalSpeed = Math.min(g.maxRoadSpeed, g.startingRoadSpeed + g.speedGrowth * next);
     if (car.phase !== 0) car.lateral = car.movementOrigin + (car.movementTarget - car.movementOrigin) * ((next * 1e6 - car.movementStartUs) / (car.movementEndUs - car.movementStartUs));
    }
    if (collision !== undefined && Math.abs(next - collision) < 1e-12) this.resolvePlayers(next, events);
    if (first && first.timeUs === canonicalTime(next)) this.resolveObjects(contacts.filter(c => c.timeUs === first.timeUs), events, first.timeUs);
    const deadMask = this.cars.reduce((mask, car, seat) => mask | (car.hp === 0 ? 1 << seat : 0), 0);
    if (!provisional && deadMask) {
     this.tick = Math.ceil(canonicalTime(next) * g.tickRate / 1e6);
     this.finish = { tick: this.tick, timeUs: canonicalTime(next), result: deadMask === 1 ? 1 : deadMask === 2 ? 0 : 2, reason: 1 };
     return events;
    }
    if (finishMask) {
     this.cars.forEach((car, seat) => { if (finishMask & (1 << seat)) car.progress = this.context.gameplay.finishDistance - g.carHeight / 2; });
     this.tick = Math.ceil(canonicalTime(next) * g.tickRate / 1e6); this.finish = { tick: this.tick, timeUs: canonicalTime(next), result: finishMask === 1 ? 0 : finishMask === 2 ? 1 : 2, reason: 0 };
     return events;
    }
    time = next; this.boundaries(canonicalTime(time), events);
   }
   this.updateTrack();
   this.tick++;
  }
  return events;
 }
 /** Contact restrictions are derived from world rectangles, never presentation or
  * requested controls. A small numerical guard only absorbs floating roundoff. */
 private tailgating(seat: number): boolean {
  const a = this.cars[seat], b = this.cars[1 - seat], g = this.configuration.gameplay;
  return b.progress > a.progress && b.progress - a.progress <= g.carHeight + 1e-8 && Math.abs(a.lateral - b.lateral) < g.carWidth - 1e-8;
 }
 private multiplier(seat: number): number {
  const g = this.configuration.gameplay;
  const requested = this.cars.map(car => car.effective === 3 ? g.accelSpeedMultiplier : 1);
  return this.tailgating(seat) ? Math.min(requested[seat], requested[1 - seat]) : requested[seat];
 }
 private lateralSpeed(car: Car): number {
  return car.phase === 0 ? 0 : (car.movementTarget - car.movementOrigin) * 1e6 / (car.movementEndUs - car.movementStartUs);
 }
 /** Split at the instant a leader clears sideways, releasing the follower within
  * the tick rather than delaying its requested speed until the next tick. */
 private clearance(start: number, end: number): number {
  for (let seat = 0; seat < 2; seat++) if (this.tailgating(seat)) {
   const a = this.cars[seat], b = this.cars[1-seat];
   const x = a.lateral - b.lateral, v = this.lateralSpeed(a) - this.lateralSpeed(b);
   if (v !== 0) { const t = start + ((v > 0 ? 1 : -1) * this.configuration.gameplay.carWidth - x) / v; if (t > start + 1e-12) end = Math.min(end, t); }
  }
  return end;
 }
 /** Intersect linear lateral overlap with monotone integrated relative progress.
  * Touching while separating has no nonempty overlap interval and is ignored. */
 private playerContact(start: number, end: number): number | undefined {
  const [a, b] = this.cars, g = this.configuration.gameplay;
  if (a.phase !== 1 && b.phase !== 1 && Math.abs(a.lateral - b.lateral) < g.carWidth && Math.abs(a.progress - b.progress) < g.carHeight - 1e-8) return;
  let entry = start, exit = end;
  const x = a.lateral - b.lateral, vx = this.lateralSpeed(a) - this.lateralSpeed(b);
  // Detect a shifting impact from requested motion before tailgating clamps it.
  const requested = (car: Car) => car.effective === 3 ? g.accelSpeedMultiplier : 1;
  const y = a.progress - b.progress, m = (a.phase === 1 && a.progress < b.progress) || (b.phase === 1 && b.progress < a.progress) ? requested(a) - requested(b) : this.multiplier(0) - this.multiplier(1);
  if (vx === 0) { if (Math.abs(x) >= g.carWidth - 1e-8) return; }
  else {
   const t1 = start + (-g.carWidth - x) / vx, t2 = start + (g.carWidth - x) / vx;
   entry = Math.max(entry, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
  }
  const at = (t: number) => y + this.forwardDistance(start, t - start) * m;
  if (m === 0) { if (Math.abs(y) >= g.carHeight - 1e-8) return; }
  else {
   const root = (target: number) => {
    if ((m > 0 && y >= target) || (m < 0 && y <= target)) return start;
    if ((m > 0 && at(end) < target) || (m < 0 && at(end) > target)) return end;
    let low = start, high = end;
    for (let n=0; n<52; n++) { const mid = low + (high-low)/2; if ((m > 0 && at(mid) < target) || (m < 0 && at(mid) > target)) low = mid; else high = mid; }
    return high;
   };
   if (m > 0) { if (y >= g.carHeight - 1e-8 || at(end) < -g.carHeight) return; entry = Math.max(entry, root(-g.carHeight)); exit = Math.min(exit, root(g.carHeight)); }
   else { if (y <= -g.carHeight + 1e-8 || at(end) > g.carHeight) return; entry = Math.max(entry, root(g.carHeight)); exit = Math.min(exit, root(-g.carHeight)); }
  }
  if (entry < exit - 1e-12) return entry;
 }
 private resolvePlayers(time: number, events: Observation[]): void {
  const timeUs = canonicalTime(time), g = this.configuration.gameplay;
  for (const car of this.cars) if (car.phase === 1) {
   car.phase = 2; car.target = car.departure;
   car.movementOrigin = car.lateral; car.movementTarget = (car.departure - 1) * g.laneSpacing;
   car.movementStartUs = timeUs; car.movementEndUs = timeUs + canonicalTime(g.laneReturnDuration);
   this.clear(car);
  }
  events.push({ type: 'contact', tick: this.tick, timeUs, cars: this.cars.map(car => ({ ...car })) });
 }
 /** Stable placement is independent from mutable shared/per-seat consumption. */
 private objects(): ObjectState[] {
  if (this.represented) return this.represented.map(object => ({ ...object, flags: (object.flags & 3) | (this.consumption.get(object.id) ?? 0) }));
  return this.trackState().slices.flatMap(slice => slice.cells.flatMap((kind, lane) => {
   if (kind === 'empty') return [];
   const id = slice.id * 3 + lane + 1;
   return [{ id, sliceId: slice.id, lane, distance: slice.distance, flags: ({ coin: 1, obstacle: 2, heart: 3 }[kind]) | (this.consumption.get(id) ?? 0) }];
  }));
 }
 /** Intersect monotone longitudinal overlap and linear lateral overlap. Bisection
  * uses the integrated speed ramp, so acceleration cannot tunnel through objects. */
 private objectContacts(start: number, end: number) {
  if (this.configuration.mode !== 'drag-race') return [];
  const g = this.configuration.gameplay;
  const contacts: { object: ObjectState; seat: number; timeUs: number }[] = [];
  for (const object of this.objects()) for (let seat = 0; seat < 2; seat++) {
   const kind = object.flags & 3, car = this.cars[seat];
   if (object.flags & (kind === 2 ? 8 << seat : 4)) continue;
   const width = kind === 2 ? g.obstacleW : kind === 1 ? g.coinSize : g.heartSize;
   const height = kind === 2 ? g.obstacleH : kind === 1 ? g.coinSize : g.heartSize;
   const lateralExtent = (g.carWidth + width) / 2, forwardExtent = (g.carHeight + height) / 2;
   const center = (object.lane - 1) * g.laneSpacing;
   const multiplier = this.multiplier(this.cars.indexOf(car));
   const progress = (at: number) => car.progress + this.forwardDistance(start, at - start) * multiplier;
   if (progress(end) < object.distance - forwardExtent || car.progress >= object.distance + forwardExtent) continue;
   // Keep the true exit unconstrained: entry exactly at the tick end counts,
   // while an entry coinciding with a separating exit remains a tangency.
   let entry = start, exit = Infinity;
   if (car.progress <= object.distance - forwardExtent) {
    let low = start, high = end;
    for (let n = 0; n < 52; n++) { const middle = low + (high - low) / 2; if (progress(middle) <= object.distance - forwardExtent) low = middle; else high = middle; }
    entry = high;
   }
   if (progress(end) >= object.distance + forwardExtent) {
    let low = start, high = end;
    for (let n = 0; n < 52; n++) { const middle = low + (high - low) / 2; if (progress(middle) < object.distance + forwardExtent) low = middle; else high = middle; }
    exit = high;
   }
   const speed = car.phase === 0 ? 0 : (car.movementTarget - car.movementOrigin) * 1e6 / (car.movementEndUs - car.movementStartUs);
   if (speed === 0) { if (Math.abs(car.lateral - center) >= lateralExtent) continue; }
   else {
    const a = start + (center - lateralExtent - car.lateral) / speed;
    const b = start + (center + lateralExtent - car.lateral) / speed;
    entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
   }
   if (entry <= end && entry < exit) contacts.push({ object, seat, timeUs: canonicalTime(entry) });
  }
  return contacts.sort((a,b) => a.timeUs - b.timeUs || a.object.id - b.object.id || a.seat - b.seat);
 }
 private resolveObjects(contacts: { object: ObjectState; seat: number; timeUs: number }[], events: Observation[], timeUs: number) {
  const g = this.configuration.gameplay, objects = new Map<number, ObjectState>(), damage = [0, 0];
  for (const { object } of contacts) objects.set(object.id, { ...object });
  for (const object of objects.values()) {
   const kind = object.flags & 3;
   const seats = contacts.filter(c => c.object.id === object.id).map(c => c.seat);
   if (kind === 2) for (const seat of seats) { object.flags |= 8 << seat; damage[seat] += g.obstacleDamage; }
   else {
    object.flags |= 4;
    if (seats.length === 1) { const car = this.cars[seats[0]]; if (kind === 3) car.hp = Math.min(g.maxHealth, car.hp + 1); else car.score += 10; }
   }
   this.consumption.set(object.id, object.flags & 28);
  }
  this.cars.forEach((car, seat) => { car.hp = Math.max(0, car.hp - damage[seat]); });
  events.push({ type: 'objects', tick: this.tick, timeUs, objects: [...objects.values()], cars: this.cars.map(car => ({ ...car })) });
 }
 private forwardDistance(start: number, elapsed: number) {
  const g = this.configuration.gameplay;
  const normal = Math.min(g.maxRoadSpeed, g.startingRoadSpeed + g.speedGrowth * start);
  const ramp = g.speedGrowth === 0 ? 0 : Math.min(elapsed, Math.max(0, (g.maxRoadSpeed - normal) / g.speedGrowth));
  return normal * ramp + .5 * g.speedGrowth * ramp * ramp + Math.min(g.maxRoadSpeed, normal + g.speedGrowth * ramp) * (elapsed - ramp);
 }
 private trackState() {
  const states = this.tracks.map(track => track.snapshot());
  const leading = states[0].through >= states[1].through ? states[0] : states[1];
  const slices = new Map(states.flatMap(state => state.slices).map(slice => [slice.id, slice]));
  return { ...leading, slices: [...slices.values()].sort((a,b) => a.id - b.id) };
 }
 snapshot() { return { finish: this.finish ? { tick: this.finish.tick, timeUs: this.finish.timeUs, result: this.finish.result } : undefined, reason: this.finish?.reason, objects: this.objects(), tick: this.tick, timeUs: this.finish?.timeUs ?? this.continuationUs ?? canonicalTime(this.tick / this.configuration.gameplay.tickRate), abandoned: this.abandoned, track: this.trackState(),
  cars: this.cars.map(car => ({ ...car })) as [Car, Car], latestPress: this.latestPress ? { ...this.latestPress } : null }; }
}
