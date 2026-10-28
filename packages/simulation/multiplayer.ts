import {
  type Car,
  CarFlagsNone,
  CarFlagsNOSActive,
  type Contact,
  ContactFlagsEpisodeActive,
  ContactFlagsEpisodeDamageDecided,
  ContactFlagsNone,
  ContactFlagsTailgating,
  type Context,
  type Control,
  ControlLeft,
  ControlNone,
  ControlNOS,
  ControlRight,
  CounterMax,
  HeldControlsLeft,
  HeldControlsNone,
  HeldControlsNOS,
  HeldControlsRight,
  type Identity,
  type Input,
  InputIntentPress,
  InputIntentRelease,
  type Lane,
  LaneLeft,
  LaneRight,
  MovementPhaseReturn,
  MovementPhaseShift,
  MovementPhaseSteady,
  ObjectFlagsConsumptionMask,
  ObjectFlagsKindMask,
  ObjectFlagsSharedConsumed,
  ObjectFlagsSpentPlayer1,
  ObjectKindCoin,
  ObjectKindHeart,
  ObjectKindObstacle,
  type ObjectState,
  type OutcomeReason,
  OutcomeReasonDeadline,
  OutcomeReasonFinish,
  OutcomeReasonHP,
  type OutcomeResult,
  OutcomeResultPlayer1Win,
  OutcomeResultPlayer2Win,
  OutcomeResultTie,
  SeatMaskPlayer1,
  SeatMaskPlayer2,
  SeatOrNoneNone,
  SeatOrNonePlayer1,
  SeatOrNonePlayer2,
} from "@dashdevil/contracts/protocol";

const maxPhysicalSegments = 1024;
const maxUncommittedEvents = 1024;

import type { Configuration } from "./config";
import { MultiplayerTrack } from "./multiplayerTrack";
import { configurationContext, validateMessage } from "@dashdevil/contracts/validation";

export type MultiplayerConfiguration = Configuration<"drag-race" | "road-rage">;
export interface Observation {
  readonly objects?: readonly ObjectState[];
  readonly cars?: readonly Car[];
  readonly type:
    "contact" | "objects" | "input" | "shift" | "shift-end" | "expiry" | "release" | "abandoned";
  readonly tick: number;
  readonly timeUs: number;
  readonly seat?: number;
  readonly car?: Readonly<Car>;
  readonly sequence?: number;
  readonly disposition?: "accepted" | "ignored" | "rejected";
}
export function canonicalTime(seconds: number): number {
  const value = Math.floor(seconds * 1e6 + 0.5);
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(value))
    throw new Error("Unrepresentable round time");
  return value;
}
const sameIdentity = (a: Identity, b: Identity) =>
  a.roomId === b.roomId &&
  a.seatSession === b.seatSession &&
  a.pairGeneration === b.pairGeneration &&
  a.seat === b.seat;
/** Serialized headless round owner. An adapter supplies its authenticated identity;
 * the payload cannot choose a different seat. All clocks are monotonic elapsed seconds. */
export class Multiplayer {
  private readonly context: Context;
  private represented?: readonly ObjectState[];
  private continuationUs?: number;
  private rawTime = 0;
  private segments: {
    start: number;
    end: number;
    cars: [Car, Car];
    multipliers: number[];
    blocked: boolean[];
  }[] = [];
  private group?: {
    timeUs: number;
    sampleTime: number;
    contacts: { object: ObjectState; seat: number; timeUs: number }[];
    finishMask: number;
    damage: number[];
    sample?: [Car, Car];
  };
  private heldEvents: Observation[] = [];
  private committed?: ReturnType<Multiplayer["currentSnapshot"]>;
  private frozen?: ReturnType<Multiplayer["currentSnapshot"]>;
  private consumption = new Map<number, number>();
  private readonly tracks: readonly [MultiplayerTrack, MultiplayerTrack];
  private tick = 0;
  private wallTime = 0;
  private abandoned = false;
  private finish?: { tick: number; timeUs: number; result: OutcomeResult; reason: OutcomeReason };
  private readonly cars: [Car, Car];
  private pending: { seat: number; input: Input; valid: boolean }[] = [];
  private releases: Observation[] = [];
  private readonly identities: readonly [Identity, Identity];
  private readonly sequences = [0, 0];
  private readonly tokens: number[];
  private readonly connected = [true, true];
  private contact: Contact = {
    episode: 0,
    flags: ContactFlagsNone,
    blockedSeat: SeatOrNoneNone,
    latestSeat: SeatOrNoneNone,
    latestControl: ControlNone,
    latestSequence: 0,
    latestTimeUs: 0,
    latestOrder: 0,
  };
  private order = 0;
  private latestPress: {
    seat: number;
    control: number;
    sequence: number;
    timeUs: number;
    order: number;
  } | null = null;
  private readonly configuration: MultiplayerConfiguration;
  private readonly roundId: number;
  constructor(
    configuration: MultiplayerConfiguration,
    seed: number,
    identities: readonly [Identity, Identity],
    roundId = 1,
  ) {
    this.configuration = configuration;
    this.roundId = roundId;
    if (!Number.isInteger(seed) || seed < 1 || seed > CounterMax)
      throw new Error("Seed must be a nonzero uint32");
    if (
      !Number.isInteger(roundId) ||
      roundId < 1 ||
      roundId > CounterMax ||
      identities.some(
        (identity, seat) =>
          identity.seat !== seat ||
          [identity.roomId, identity.seatSession, identity.pairGeneration].some(
            (v) => !Number.isInteger(v) || v < 1 || v > CounterMax,
          ),
      )
    )
      throw new Error("Invalid round/seat identity");
    this.context = configurationContext(configuration, seed);
    this.tracks = [
      new MultiplayerTrack(configuration, seed),
      new MultiplayerTrack(configuration, seed),
    ];
    this.identities = [{ ...identities[0] }, { ...identities[1] }];
    this.tokens = [configuration.connection.inputBurst, configuration.connection.inputBurst];
    this.cars = [LaneLeft, LaneRight].map((lane): Car => ({
      progress: 0,
      lateral: (lane - 1) * configuration.gameplay.laneSpacing,
      normalSpeed: configuration.gameplay.startingRoadSpeed,
      lane: lane as Lane,
      departure: lane as Lane,
      target: lane as Lane,
      phase: MovementPhaseSteady,
      controls: ControlNone,
      effective: ControlNone,
      flags: CarFlagsNone,
      movementOrigin: (lane - 1) * configuration.gameplay.laneSpacing,
      movementTarget: (lane - 1) * configuration.gameplay.laneSpacing,
      movementStartUs: 0,
      movementEndUs: 0,
      nextShiftUs: 0,
      freshnessUs: 0,
      protectionUs: 0,
      hp: configuration.gameplay.maxHealth,
      score: 0,
      lastInput: 0,
      heldMask: HeldControlsNone,
      inputGeneration: 1,
    })) as [Car, Car];
    this.updateTrack();
  }
  submit(authenticated: Identity, input: Input): boolean {
    const seat = authenticated.seat,
      identity = this.identities[seat];
    if (!identity || !sameIdentity(identity, authenticated) || this.finish || this.abandoned)
      return false;
    if (
      this.tokens[seat] < 1 ||
      this.pending.length >= 2 * this.configuration.connection.inputBurst
    )
      throw new Error("Input rate/queue exceeded; recover connection");
    this.tokens[seat]--;
    let valid =
      this.connected[seat] &&
      !this.abandoned &&
      sameIdentity(identity, input.identity) &&
      input.round.roundId === this.roundId &&
      input.round.inputGeneration === this.cars[seat].inputGeneration &&
      input.sequence === this.sequences[seat] + 1;
    try {
      validateMessage("Input", input, this.context);
    } catch {
      valid = false;
    }
    if (valid) this.sequences[seat] = input.sequence;
    this.pending.push({
      seat,
      input: { ...input, identity: { ...input.identity }, round: { ...input.round } },
      valid,
    });
    return valid;
  }
  /** Restore a copied authoritative continuation at an exact simulation boundary. */
  restore(
    cars: readonly Car[],
    tick: number,
    objects?: readonly ObjectState[],
    timeUs = canonicalTime(tick / this.configuration.gameplay.tickRate),
    contact?: Readonly<Contact>,
  ): void {
    if (contact) {
      this.contact = { ...contact };
      this.order = contact.latestOrder;
      this.latestPress = contact.latestControl
        ? {
            seat: contact.latestSeat,
            control: contact.latestControl,
            sequence: contact.latestSequence,
            timeUs: contact.latestTimeUs,
            order: contact.latestOrder,
          }
        : null;
    }
    this.represented = objects?.map((object) => ({ ...object }));
    this.continuationUs =
      timeUs === canonicalTime(tick / this.configuration.gameplay.tickRate) ? undefined : timeUs;
    this.consumption = new Map(
      (objects ?? []).map((object) => [object.id, object.flags & ObjectFlagsConsumptionMask]),
    );
    if (!Number.isSafeInteger(tick) || tick < 0 || cars.length !== 2)
      throw new Error("Invalid continuation");
    this.segments = [];
    this.tick = tick;
    this.wallTime = tick / this.configuration.gameplay.tickRate;
    this.rawTime = this.continuationUs === undefined ? this.wallTime : timeUs / 1e6;
    this.pending = [];
    this.releases = [];
    this.abandoned = false;
    this.finish = undefined;
    this.group = undefined;
    this.heldEvents = [];
    this.committed = undefined;
    this.frozen = undefined;
    cars.forEach((car, seat) => {
      this.cars[seat] = { ...car };
      this.sequences[seat] = car.lastInput;
      this.connected[seat] = true;
    });
    this.updateTrack();
  }
  private updateTrack(): void {
    const g = this.configuration.gameplay;
    const extent = (g.carHeight + Math.max(g.obstacleH, g.coinSize, g.heartSize)) / 2;
    // Match authoritative coverage headroom, including complete retained objects.
    this.tracks.forEach((track, seat) => {
      track.ensureThrough(
        this.cars[seat].progress +
          g.maxRoadSpeed * g.accelSpeedMultiplier +
          extent +
          (g.maxRoadSpeed * g.accelSpeedMultiplier) / g.tickRate,
      );
      track.retireBehind(
        this.cars[seat].progress -
          g.carHeight / 2 -
          (g.maxRoadSpeed * g.accelSpeedMultiplier) / g.tickRate,
      );
    });
  }
  private clear(car: Car): void {
    car.controls = ControlNone;
    car.effective = ControlNone;
    car.heldMask = HeldControlsNone;
    car.flags = CarFlagsNone;
    car.freshnessUs = 0;
  }
  disconnect(authenticated: Identity): void {
    const identity = this.identities[authenticated.seat];
    if (!identity || !sameIdentity(identity, authenticated) || this.abandoned || this.finish)
      return;
    this.connected[authenticated.seat] = false;
    this.clear(this.cars[authenticated.seat]);
    for (const queued of this.pending) if (queued.seat === authenticated.seat) queued.valid = false;
    this.releases.push({
      type: "release",
      tick: this.tick,
      timeUs: canonicalTime(this.tick / this.configuration.gameplay.tickRate),
      seat: authenticated.seat,
      car: { ...this.cars[authenticated.seat] },
    });
  }
  private steering(car: Car): Control {
    return car.effective === ControlLeft || car.effective === ControlRight
      ? car.effective
      : car.heldMask & HeldControlsRight
        ? ControlRight
        : car.heldMask & HeldControlsLeft
          ? ControlLeft
          : ControlNone;
  }
  private shift(car: Car, seat: number, timeUs: number, events: Observation[]): void {
    const g = this.configuration.gameplay;
    if (
      this.tailgating(seat) ||
      car.phase !== MovementPhaseSteady ||
      this.steering(car) === ControlNone ||
      timeUs < car.nextShiftUs
    )
      return;
    const target = Math.max(
      0,
      Math.min(2, car.lane + (this.steering(car) === ControlLeft ? -1 : 1)),
    );
    if (target === car.lane) return;
    car.phase = MovementPhaseShift;
    car.departure = car.lane;
    car.target = target as Lane;
    car.movementOrigin = car.lateral;
    car.movementTarget = (target - 1) * g.laneSpacing;
    car.movementStartUs = timeUs;
    car.movementEndUs = timeUs + canonicalTime(g.laneShiftDuration);
    car.nextShiftUs = timeUs + canonicalTime(g.laneSwitchCooldownDuration);
    events.push({ type: "shift", tick: this.tick, timeUs, seat, car: { ...car } });
  }
  private boundaries(timeUs: number, events: Observation[]): void {
    this.cars.forEach((car, seat) => {
      if (car.effective !== ControlNone && car.freshnessUs <= timeUs) {
        this.clear(car);
        events.push({ type: "expiry", tick: this.tick, timeUs, seat, car: { ...car } });
      }
      if (car.phase !== MovementPhaseSteady && car.movementEndUs <= timeUs) {
        car.lateral = car.movementTarget;
        car.lane = car.target;
        car.phase = MovementPhaseSteady;
        events.push({ type: "shift-end", tick: this.tick, timeUs, seat, car: { ...car } });
      }
    });
  }
  private apply(events: Observation[], timeUs: number): void {
    // Stable sorting preserves arrival order within each authenticated seat.
    for (const { seat, input, valid } of this.pending.sort((a, b) => a.seat - b.seat)) {
      const car = this.cars[seat];
      let disposition: Observation["disposition"] = valid ? "accepted" : "rejected";
      if (valid) {
        car.lastInput = input.sequence;
        if (input.intent === InputIntentPress) {
          if (
            input.control === ControlNone ||
            (car.heldMask & (1 << (input.control - 1))) !== 0 ||
            car.phase === MovementPhaseReturn
          )
            disposition = "ignored";
          else {
            car.heldMask |= 1 << (input.control - 1);
            car.controls = input.control;
            car.effective = input.control;
            car.flags = car.heldMask & HeldControlsNOS ? CarFlagsNOSActive : CarFlagsNone;
            car.freshnessUs =
              timeUs + canonicalTime(this.configuration.connection.controlFreshnessExpiry);
            if (this.configuration.mode === "road-rage") {
              this.latestPress = {
                seat,
                control: input.control,
                sequence: input.sequence,
                timeUs,
                order: ++this.order,
              };
              Object.assign(this.contact, {
                latestSeat: seat,
                latestControl: input.control,
                latestSequence: input.sequence,
                latestTimeUs: timeUs,
                latestOrder: this.order,
              });
            }
          }
        } else if (input.intent === InputIntentRelease) {
          if (input.control === ControlNone) this.clear(car);
          else {
            car.heldMask &= ~(1 << (input.control - 1));
            car.flags = car.heldMask & HeldControlsNOS ? CarFlagsNOSActive : CarFlagsNone;
            if (car.controls === input.control) {
              car.controls =
                car.heldMask & HeldControlsNOS
                  ? ControlNOS
                  : car.heldMask & HeldControlsRight
                    ? ControlRight
                    : car.heldMask & HeldControlsLeft
                      ? ControlLeft
                      : ControlNone;
              car.effective = car.controls;
              if (!car.controls) car.freshnessUs = 0;
            }
          }
        } else if (
          car.effective === ControlNone ||
          input.control !== car.controls ||
          input.heldMask !== car.heldMask
        )
          disposition = "ignored";
        else
          car.freshnessUs =
            timeUs + canonicalTime(this.configuration.connection.controlFreshnessExpiry);
      }
      events.push({
        type: "input",
        tick: this.tick,
        timeUs,
        seat,
        sequence: input.sequence,
        disposition,
        car: { ...car },
      });
      if (disposition === "accepted") this.shift(car, seat, timeUs, events);
    }
    this.pending = [];
  }
  /** Raw completed ticks can lead the last committed checkpoint while a group closes. */
  get processedTick() {
    return this.tick;
  }
  get pendingGroup() {
    return this.committed !== undefined;
  }
  private move(start: number, end: number): void {
    const g = this.configuration.gameplay,
      multipliers = this.cars.map((_, seat) => this.multiplier(seat)),
      blocked = this.cars.map((_, seat) => this.lateralBlocked(seat));
    // A newly discovered group can sample an earlier piece of this microsecond.
    this.segments = this.segments.filter((segment) => segment.end >= start - 0.000002);
    if (this.segments.length >= maxPhysicalSegments)
      throw new Error("Physical segment history exceeded");
    this.segments.push({
      start,
      end,
      cars: this.cars.map((car) => ({ ...car })) as [Car, Car],
      multipliers,
      blocked,
    });
    for (const [seat, car] of this.cars.entries()) {
      car.progress += this.forwardDistance(start, end - start) * multipliers[seat];
      car.normalSpeed = Math.min(g.maxRoadSpeed, g.startingRoadSpeed + g.speedGrowth * end);
      if (blocked[seat]) {
        const pause = canonicalTime(end) - canonicalTime(start);
        car.movementStartUs += pause;
        car.movementEndUs += pause;
      } else if (car.phase !== MovementPhaseSteady)
        car.lateral =
          car.movementOrigin +
          (car.movementTarget - car.movementOrigin) *
            Math.max(
              0,
              Math.min(
                1,
                (end * 1e6 - car.movementStartUs) / (car.movementEndUs - car.movementStartUs),
              ),
            );
    }
    this.refreshContact();
  }
  private refreshContact(): void {
    const [a, b] = this.cars,
      g = this.configuration.gameplay;
    if (
      Math.abs(a.lateral - b.lateral) > g.carWidth + 1e-8 ||
      Math.abs(a.progress - b.progress) > g.carHeight + 1e-8
    )
      this.contact.flags = ContactFlagsNone;
    this.contact.flags =
      (this.contact.flags & ContactFlagsEpisodeDamageDecided) |
      (this.tailgating(0) || this.tailgating(1) ? ContactFlagsTailgating : ContactFlagsNone);
    this.contact.blockedSeat =
      this.tailgating(0) || this.lateralBlocked(0)
        ? SeatOrNonePlayer1
        : this.tailgating(1) || this.lateralBlocked(1)
          ? SeatOrNonePlayer2
          : SeatOrNoneNone;
  }
  private crossings(start: number, end: number) {
    const result: { seat: number; time: number; timeUs: number }[] = [];
    for (const [seat, car] of this.cars.entries()) {
      if ((this.group?.finishMask ?? 0) & (1 << seat)) continue;
      const remaining =
        this.context.gameplay.finishDistance -
        this.configuration.gameplay.carHeight / 2 -
        car.progress;
      const multiplier = this.multiplier(seat);
      if (this.forwardDistance(start, end - start) * multiplier < remaining) continue;
      let low = start,
        high = end;
      for (let n = 0; n < 52; n++) {
        const middle = low + (high - low) / 2;
        if (this.forwardDistance(start, middle - start) * multiplier < remaining) low = middle;
        else high = middle;
      }
      result.push({ seat, time: high, timeUs: canonicalTime(high) });
    }
    return result;
  }
  advanceTo(seconds: number, provisional = false): Observation[] {
    canonicalTime(seconds);
    if (seconds < this.wallTime) throw new Error("Monotonic clock moved backwards");
    if (this.abandoned || this.finish) return [];
    this.tokens.forEach((tokens, seat) => {
      this.tokens[seat] = Math.min(
        this.configuration.connection.inputBurst,
        tokens + (seconds - this.wallTime) * this.configuration.connection.inputRate,
      );
    });
    this.wallTime = seconds;
    const g = this.configuration.gameplay;
    const events = [...this.heldEvents, ...this.releases];
    this.heldEvents = [];
    this.releases = [];
    let withheldStart: number | undefined = this.committed ? 0 : undefined;
    if (seconds - this.tick / g.tickRate > this.configuration.operational.simulationLagThreshold) {
      const checkpoint = this.committed;
      if (checkpoint) {
        this.cars.splice(0, 2, ...checkpoint.cars.map((car) => ({ ...car })));
        this.tick = checkpoint.tick;
      }
      this.abandoned = true;
      this.pending = [];
      this.group = undefined;
      this.committed = undefined;
      this.cars.forEach((car) => this.clear(car));
      if (checkpoint)
        this.frozen = {
          ...this.copySnapshot(checkpoint),
          abandoned: true,
          cars: this.cars.map((car) => ({ ...car })) as [Car, Car],
        };
      return [
        {
          type: "abandoned",
          tick: this.tick,
          timeUs: checkpoint?.timeUs ?? canonicalTime(this.tick / g.tickRate),
        },
      ];
    }
    while ((this.tick + 1) / g.tickRate <= seconds) {
      if (this.tick === CounterMax) throw new Error("Tick exhausted");
      const before = this.committed ?? this.currentSnapshot(),
        eventStart = this.committed ? 0 : events.length;
      let time = Math.max(this.tick / g.tickRate, this.rawTime);
      const end = (this.tick + 1) / g.tickRate;
      this.boundaries(Math.floor(time * 1e6), events);
      this.apply(events, canonicalTime(time));
      while (time < end) {
        this.cars.forEach((car, seat) => this.shift(car, seat, Math.floor(time * 1e6), events));
        let next = end;
        for (const car of this.cars) {
          if (car.effective !== ControlNone && car.freshnessUs / 1e6 > time)
            next = Math.min(next, car.freshnessUs / 1e6);
          if (car.phase !== MovementPhaseSteady && car.movementEndUs / 1e6 > time)
            next = Math.min(next, car.movementEndUs / 1e6);
          if (
            car.phase === MovementPhaseSteady &&
            this.steering(car) !== ControlNone &&
            car.nextShiftUs / 1e6 > time
          )
            next = Math.min(next, car.nextShiftUs / 1e6);
        }
        const collision = this.playerContact(time, next);
        if (collision !== undefined) next = Math.min(next, collision);
        next = this.clearance(time, next);
        let contacts = this.objectContacts(time, next);
        let finishes =
          !provisional && this.configuration.mode === "drag-race" ? this.crossings(time, next) : [];
        if (!this.group) {
          const deadlineUs = "timeLimit" in g ? canonicalTime(g.timeLimit) : Infinity;
          const deadline =
            !provisional &&
            this.configuration.mode === "road-rage" &&
            canonicalTime(next) >= deadlineUs
              ? deadlineUs
              : Infinity;
          const firstUs = Math.min(
            this.configuration.mode === "road-rage" && collision !== undefined
              ? canonicalTime(collision)
              : Infinity,
            contacts[0]?.timeUs ?? Infinity,
            ...finishes.map((finish) => finish.timeUs),
            deadline,
          );
          if (firstUs !== Infinity) {
            const boundary = Math.round((firstUs * g.tickRate) / 1e6) / g.tickRate;
            this.group = {
              timeUs: firstUs,
              sampleTime: canonicalTime(boundary) === firstUs ? boundary : firstUs / 1e6,
              contacts: [],
              finishMask: 0,
              damage: [0, 0],
            };
          }
        }
        const group = this.group;
        if (group) {
          next = Math.min(next, (group.timeUs + 0.5) / 1e6);
          // Sampling does not round or replace the raw integration boundaries.
          if (!group.sample && group.sampleTime > time) next = Math.min(next, group.sampleTime);
          if (!group.sample && group.sampleTime <= time) {
            const segment = this.segments.find(
              (segment) => segment.start <= group.sampleTime && segment.end >= group.sampleTime,
            );
            const sample = (segment?.cars ?? this.cars).map((car) => ({ ...car })) as [Car, Car];
            const sampleStart = segment?.start ?? time;
            const elapsed = group.sampleTime - sampleStart;
            sample.forEach((car, seat) => {
              car.progress +=
                this.forwardDistance(sampleStart, elapsed) *
                (segment?.multipliers[seat] ?? this.multiplier(seat));
              car.normalSpeed = Math.min(
                g.maxRoadSpeed,
                g.startingRoadSpeed + g.speedGrowth * group.sampleTime,
              );
              if (car.phase !== MovementPhaseSteady && !segment?.blocked[seat])
                car.lateral =
                  car.movementOrigin +
                  (car.movementTarget - car.movementOrigin) *
                    Math.max(
                      0,
                      Math.min(
                        1,
                        (group.sampleTime * 1e6 - car.movementStartUs) /
                          (car.movementEndUs - car.movementStartUs),
                      ),
                    );
            });
            group.sample = sample;
          }
          contacts = this.objectContacts(time, next).filter(
            (contact) => contact.timeUs === group.timeUs,
          );
          finishes =
            !provisional && this.configuration.mode === "drag-race"
              ? this.crossings(time, next).filter((finish) => finish.timeUs === group.timeUs)
              : [];
          group.contacts.push(...contacts);
          for (const finish of finishes) group.finishMask |= 1 << finish.seat;
        }
        this.move(time, next);
        const closing = group && next >= (group.timeUs + 0.5) / 1e6;
        if (!closing || canonicalTime(next) === group.timeUs) {
          if (collision !== undefined && Math.abs(next - collision) < 1e-12)
            this.resolvePlayers(next, events);
          this.boundaries(Math.floor(next * 1e6), events);
        }
        if (group && !group.sample && next >= group.sampleTime)
          group.sample = this.cars.map((car) => ({ ...car })) as [Car, Car];
        if (closing) {
          const positions = this.cars.map((car) => ({
            progress: car.progress,
            lateral: car.lateral,
            normalSpeed: car.normalSpeed,
          }));
          this.cars.forEach((car, seat) =>
            Object.assign(car, {
              progress: group.sample![seat].progress,
              lateral:
                car.phase === group.sample![seat].phase &&
                car.movementStartUs === group.sample![seat].movementStartUs
                  ? group.sample![seat].lateral
                  : car.phase === MovementPhaseSteady
                    ? car.movementTarget
                    : car.movementOrigin,
              normalSpeed: group.sample![seat].normalSpeed,
            }),
          );
          if (group.contacts.length || group.damage.some((damage) => damage > 0))
            this.resolveObjects(
              group.contacts.sort((a, b) => a.object.id - b.object.id || a.seat - b.seat),
              events,
              group.timeUs,
            );
          const deadMask = this.cars.reduce(
            (mask, car, seat) => mask | (car.hp === 0 ? 1 << seat : 0),
            0,
          );
          const deadline = "timeLimit" in g && group.timeUs === canonicalTime(g.timeLimit);
          if (!provisional && (deadMask || group.finishMask || deadline)) {
            this.tick = Math.ceil((group.timeUs * g.tickRate) / 1e6);
            const result = deadMask
              ? deadMask === SeatMaskPlayer1
                ? OutcomeResultPlayer2Win
                : deadMask === SeatMaskPlayer2
                  ? OutcomeResultPlayer1Win
                  : OutcomeResultTie
              : deadline
                ? this.cars[0].hp > this.cars[1].hp
                  ? OutcomeResultPlayer1Win
                  : this.cars[1].hp > this.cars[0].hp
                    ? OutcomeResultPlayer2Win
                    : OutcomeResultTie
                : group.finishMask === SeatMaskPlayer1
                  ? OutcomeResultPlayer1Win
                  : group.finishMask === SeatMaskPlayer2
                    ? OutcomeResultPlayer2Win
                    : OutcomeResultTie;
            if (!deadMask && !deadline)
              this.cars.forEach((car, seat) => {
                if (group.finishMask & (1 << seat))
                  car.progress = this.context.gameplay.finishDistance - g.carHeight / 2;
              });
            this.finish = {
              tick: this.tick,
              timeUs: group.timeUs,
              result,
              reason: deadMask
                ? OutcomeReasonHP
                : deadline
                  ? OutcomeReasonDeadline
                  : OutcomeReasonFinish,
            };
            this.group = undefined;
            this.committed = undefined;
            return events;
          }
          this.cars.forEach((car, seat) => Object.assign(car, positions[seat]));
          this.group = undefined;
          this.committed = undefined;
        }
        time = next;
        this.rawTime = next;
        this.continuationUs = undefined;
      }
      this.updateTrack();
      this.tick++;
      if (this.group) {
        this.committed ??= this.copySnapshot(before);
        withheldStart ??= eventStart;
      }
    }
    if (this.group && this.committed) {
      this.heldEvents = events.splice(withheldStart ?? 0);
      if (this.heldEvents.length > maxUncommittedEvents)
        throw new Error("Uncommitted authority history exhausted");
    }
    return events;
  }
  /** Contact restrictions are derived from world rectangles, never presentation or
   * requested controls. A small numerical guard only absorbs floating roundoff. */
  private tailgating(seat: number): boolean {
    const a = this.cars[seat],
      b = this.cars[1 - seat],
      g = this.configuration.gameplay;
    return (
      b.progress > a.progress &&
      b.progress - a.progress <= g.carHeight + 1e-8 &&
      Math.abs(a.lateral - b.lateral) < g.carWidth - 1e-8
    );
  }
  private multiplier(seat: number): number {
    const g = this.configuration.gameplay;
    const requested = this.cars.map((car) =>
      car.flags & CarFlagsNOSActive ? g.accelSpeedMultiplier : 1,
    );
    return this.tailgating(seat) ? Math.min(requested[seat], requested[1 - seat]) : requested[seat];
  }
  /** Pause a return at a lateral contact boundary. Keeping the completed fraction
   * preserves the same return rather than starting another full-duration slide. */
  private lateralBlocked(seat: number): boolean {
    const a = this.cars[seat],
      b = this.cars[1 - seat],
      g = this.configuration.gameplay;
    const x = a.lateral - b.lateral;
    return (
      (this.contact.flags & ContactFlagsEpisodeActive) !== 0 &&
      a.phase === MovementPhaseReturn &&
      Math.abs(a.progress - b.progress) < g.carHeight - 1e-8 &&
      Math.abs(x) <= g.carWidth + 1e-8 &&
      x * this.rawLateralSpeed(a) < 0 &&
      x * (this.rawLateralSpeed(a) - this.rawLateralSpeed(b)) < 0
    );
  }
  private lateralSpeed(car: Car): number {
    return this.lateralBlocked(this.cars.indexOf(car)) ? 0 : this.rawLateralSpeed(car);
  }
  private rawLateralSpeed(car: Car): number {
    return car.phase === MovementPhaseSteady
      ? 0
      : ((car.movementTarget - car.movementOrigin) * 1e6) /
          (car.movementEndUs - car.movementStartUs);
  }
  /** Split at the instant a leader clears sideways, releasing the follower within
   * the tick rather than delaying its requested speed until the next tick. */
  private clearance(start: number, end: number): number {
    // Release a laterally blocked return at the swept longitudinal boundary,
    // including when it lies between ticks or inside an event-time group.
    for (let seat = 0; seat < 2; seat++)
      if (this.lateralBlocked(seat)) {
        const y = this.cars[seat].progress - this.cars[1 - seat].progress;
        const m = this.multiplier(seat) - this.multiplier(1 - seat),
          extent = this.configuration.gameplay.carHeight;
        const at = (time: number) => y + this.forwardDistance(start, time - start) * m;
        if (m !== 0 && Math.abs(at(end)) >= extent) {
          let low = start,
            high = end;
          for (let n = 0; n < 52; n++) {
            const mid = low + (high - low) / 2;
            if (Math.abs(at(mid)) < extent) low = mid;
            else high = mid;
          }
          if (high > start + 1e-12) end = Math.min(end, high);
        }
      }
    for (let seat = 0; seat < 2; seat++)
      if (this.tailgating(seat)) {
        const a = this.cars[seat],
          b = this.cars[1 - seat];
        const x = a.lateral - b.lateral,
          v = this.lateralSpeed(a) - this.lateralSpeed(b);
        if (v !== 0) {
          const t = start + ((v > 0 ? 1 : -1) * this.configuration.gameplay.carWidth - x) / v;
          if (t > start + 1e-12) end = Math.min(end, t);
        }
      }
    return end;
  }
  /** Intersect linear lateral overlap with monotone integrated relative progress.
   * Touching while separating has no nonempty overlap interval and is ignored. */
  private playerContact(start: number, end: number): number | undefined {
    const [a, b] = this.cars,
      g = this.configuration.gameplay;
    this.refreshContact();
    if (this.contact.flags & ContactFlagsEpisodeActive) return;
    if (
      a.phase !== MovementPhaseShift &&
      b.phase !== MovementPhaseShift &&
      Math.abs(a.lateral - b.lateral) < g.carWidth &&
      Math.abs(a.progress - b.progress) < g.carHeight - 1e-8
    )
      return;
    let entry = start,
      exit = end;
    const x = a.lateral - b.lateral,
      vx = this.lateralSpeed(a) - this.lateralSpeed(b);
    // Detect a shifting impact from requested motion before tailgating clamps it.
    const requested = (car: Car) => (car.flags & CarFlagsNOSActive ? g.accelSpeedMultiplier : 1);
    const y = a.progress - b.progress,
      m =
        (a.phase === MovementPhaseShift && a.progress < b.progress) ||
        (b.phase === MovementPhaseShift && b.progress < a.progress)
          ? requested(a) - requested(b)
          : this.multiplier(0) - this.multiplier(1);
    if (vx === 0) {
      if (Math.abs(x) >= g.carWidth - 1e-8) return;
    } else {
      const t1 = start + (-g.carWidth - x) / vx,
        t2 = start + (g.carWidth - x) / vx;
      entry = Math.max(entry, Math.min(t1, t2));
      exit = Math.min(exit, Math.max(t1, t2));
    }
    const at = (t: number) => y + this.forwardDistance(start, t - start) * m;
    if (m === 0) {
      if (Math.abs(y) >= g.carHeight - 1e-8) return;
    } else {
      const root = (target: number) => {
        if ((m > 0 && y >= target) || (m < 0 && y <= target)) return start;
        if ((m > 0 && at(end) < target) || (m < 0 && at(end) > target)) return end;
        let low = start,
          high = end;
        for (let n = 0; n < 52; n++) {
          const mid = low + (high - low) / 2;
          if ((m > 0 && at(mid) < target) || (m < 0 && at(mid) > target)) low = mid;
          else high = mid;
        }
        return high;
      };
      if (m > 0) {
        if (y >= g.carHeight - 1e-8 || at(end) < -g.carHeight) return;
        entry = Math.max(entry, root(-g.carHeight));
        exit = Math.min(exit, root(g.carHeight));
      } else {
        if (y <= -g.carHeight + 1e-8 || at(end) > g.carHeight) return;
        entry = Math.max(entry, root(g.carHeight));
        exit = Math.min(exit, root(-g.carHeight));
      }
    }
    if (entry < exit - 1e-12) return entry;
  }
  private resolvePlayers(time: number, events: Observation[]): void {
    const timeUs = canonicalTime(time),
      g = this.configuration.gameplay;
    const phases = this.cars.map((car) => car.phase);
    this.contact.episode++;
    this.contact.flags = ContactFlagsEpisodeDamageDecided;
    if (
      this.configuration.mode === "road-rage" &&
      !(phases[0] === MovementPhaseShift && phases[1] === MovementPhaseShift) &&
      phases.some((phase) => phase !== MovementPhaseSteady) &&
      this.latestPress &&
      this.group
    ) {
      this.group.damage[1 - this.latestPress.seat] =
        "playerContactDamage" in g ? g.playerContactDamage : 0;
    }
    for (const car of this.cars)
      if (car.phase === MovementPhaseShift) {
        car.phase = MovementPhaseReturn;
        car.target = car.departure;
        car.movementOrigin = car.lateral;
        car.movementTarget = (car.departure - 1) * g.laneSpacing;
        car.movementStartUs = timeUs;
        car.movementEndUs = timeUs + canonicalTime(g.laneReturnDuration);
        this.clear(car);
      }
    this.refreshContact();
    events.push({
      type: "contact",
      tick: this.tick,
      timeUs,
      cars: this.cars.map((car) => ({ ...car })),
    });
  }
  /** Stable placement is independent from mutable shared/per-seat consumption. */
  private objects(): ObjectState[] {
    if (this.represented)
      return this.represented.map((object) => ({
        ...object,
        flags: (object.flags & ObjectFlagsKindMask) | (this.consumption.get(object.id) ?? 0),
      }));
    return this.trackState().slices.flatMap((slice) =>
      slice.cells.flatMap((kind, lane) => {
        if (kind === "empty") return [];
        const id = slice.id * 3 + lane + 1;
        return [
          {
            id,
            sliceId: slice.id,
            lane: lane as Lane,
            distance: slice.distance,
            flags:
              { coin: ObjectKindCoin, obstacle: ObjectKindObstacle, heart: ObjectKindHeart }[kind] |
              (this.consumption.get(id) ?? 0),
          },
        ];
      }),
    );
  }
  /** Intersect monotone longitudinal overlap and linear lateral overlap. Bisection
   * uses the integrated speed ramp, so acceleration cannot tunnel through objects. */
  private objectContacts(start: number, end: number) {
    const g = this.configuration.gameplay;
    const contacts: { object: ObjectState; seat: number; timeUs: number }[] = [];
    for (const object of this.objects())
      for (let seat = 0; seat < 2; seat++) {
        const kind = object.flags & ObjectFlagsKindMask,
          car = this.cars[seat];
        if (
          object.flags &
            (kind === ObjectKindObstacle
              ? ObjectFlagsSpentPlayer1 << seat
              : ObjectFlagsSharedConsumed) ||
          this.group?.contacts.some(
            (contact) => contact.object.id === object.id && contact.seat === seat,
          )
        )
          continue;
        const width =
          kind === ObjectKindObstacle
            ? g.obstacleW
            : kind === ObjectKindCoin
              ? g.coinSize
              : g.heartSize;
        const height =
          kind === ObjectKindObstacle
            ? g.obstacleH
            : kind === ObjectKindCoin
              ? g.coinSize
              : g.heartSize;
        const lateralExtent = (g.carWidth + width) / 2,
          forwardExtent = (g.carHeight + height) / 2;
        const center = (object.lane - 1) * g.laneSpacing;
        const multiplier = this.multiplier(this.cars.indexOf(car));
        const progress = (at: number) =>
          car.progress + this.forwardDistance(start, at - start) * multiplier;
        if (
          progress(end) < object.distance - forwardExtent ||
          car.progress >= object.distance + forwardExtent
        )
          continue;
        // Keep the true exit unconstrained: entry exactly at the tick end counts,
        // while an entry coinciding with a separating exit remains a tangency.
        let entry = start,
          exit = Infinity;
        if (car.progress <= object.distance - forwardExtent) {
          let low = start,
            high = end;
          for (let n = 0; n < 52; n++) {
            const middle = low + (high - low) / 2;
            if (progress(middle) <= object.distance - forwardExtent) low = middle;
            else high = middle;
          }
          entry = high;
        }
        if (progress(end) >= object.distance + forwardExtent) {
          let low = start,
            high = end;
          for (let n = 0; n < 52; n++) {
            const middle = low + (high - low) / 2;
            if (progress(middle) < object.distance + forwardExtent) low = middle;
            else high = middle;
          }
          exit = high;
        }
        const speed = this.lateralSpeed(car);
        if (speed === 0) {
          if (Math.abs(car.lateral - center) >= lateralExtent) continue;
        } else {
          const a = start + (center - lateralExtent - car.lateral) / speed;
          const b = start + (center + lateralExtent - car.lateral) / speed;
          entry = Math.max(entry, Math.min(a, b));
          exit = Math.min(exit, Math.max(a, b));
        }
        if (entry <= end && entry < exit)
          contacts.push({ object, seat, timeUs: canonicalTime(entry) });
      }
    return contacts.sort(
      (a, b) => a.timeUs - b.timeUs || a.object.id - b.object.id || a.seat - b.seat,
    );
  }
  private resolveObjects(
    contacts: { object: ObjectState; seat: number; timeUs: number }[],
    events: Observation[],
    timeUs: number,
  ) {
    const g = this.configuration.gameplay,
      objects = new Map<number, ObjectState>(),
      damage = [...(this.group?.damage ?? [0, 0])];
    for (const { object } of contacts) objects.set(object.id, { ...object });
    for (const object of objects.values()) {
      const kind = object.flags & ObjectFlagsKindMask;
      const seats = contacts.filter((c) => c.object.id === object.id).map((c) => c.seat);
      if (kind === ObjectKindObstacle)
        for (const seat of seats) {
          object.flags |= ObjectFlagsSpentPlayer1 << seat;
          damage[seat] =
            this.configuration.mode === "road-rage"
              ? Math.max(damage[seat], g.obstacleDamage)
              : damage[seat] + g.obstacleDamage;
        }
      else {
        object.flags |= ObjectFlagsSharedConsumed;
        if (seats.length === 1) {
          const car = this.cars[seats[0]];
          if (kind === ObjectKindHeart) car.hp = Math.min(g.maxHealth, car.hp + 1);
          else car.score += 10;
        }
      }
      this.consumption.set(object.id, object.flags & ObjectFlagsConsumptionMask);
    }
    this.cars.forEach((car, seat) => {
      if (this.configuration.mode === "road-rage" && car.protectionUs > timeUs) return;
      car.hp = Math.max(0, car.hp - damage[seat]);
      if (this.configuration.mode === "road-rage" && damage[seat] > 0)
        car.protectionUs = timeUs + canonicalTime(g.invincibleDuration);
    });
    events.push({
      type: "objects",
      tick: this.tick,
      timeUs,
      objects: [...objects.values()],
      cars: this.cars.map((car) => ({ ...car })),
    });
  }
  private forwardDistance(start: number, elapsed: number) {
    const g = this.configuration.gameplay;
    const normal = Math.min(g.maxRoadSpeed, g.startingRoadSpeed + g.speedGrowth * start);
    const ramp =
      g.speedGrowth === 0
        ? 0
        : Math.min(elapsed, Math.max(0, (g.maxRoadSpeed - normal) / g.speedGrowth));
    return (
      normal * ramp +
      0.5 * g.speedGrowth * ramp * ramp +
      Math.min(g.maxRoadSpeed, normal + g.speedGrowth * ramp) * (elapsed - ramp)
    );
  }
  private trackState() {
    const states = this.tracks.map((track) => track.snapshot());
    const leading = states[0].through >= states[1].through ? states[0] : states[1];
    const slices = new Map(
      states.flatMap((state) => state.slices).map((slice) => [slice.id, slice]),
    );
    return { ...leading, slices: [...slices.values()].sort((a, b) => a.id - b.id) };
  }
  /** Uncommitted prediction view; never send it as an authoritative checkpoint. */
  preview() {
    return this.currentSnapshot();
  }
  snapshot() {
    return this.copySnapshot(this.frozen ?? this.committed ?? this.currentSnapshot());
  }
  private copySnapshot(state: ReturnType<Multiplayer["currentSnapshot"]>) {
    return {
      ...state,
      contact: { ...state.contact },
      finish: state.finish ? { ...state.finish } : undefined,
      cars: state.cars.map((car) => ({ ...car })) as [Car, Car],
      objects: state.objects.map((object) => ({ ...object })),
      latestPress: state.latestPress ? { ...state.latestPress } : null,
      track: {
        ...state.track,
        slices: state.track.slices.map((slice) => ({
          ...slice,
          cells: [...slice.cells] as typeof slice.cells,
        })),
      },
    };
  }
  private currentSnapshot() {
    return {
      contact: { ...this.contact },
      finish: this.finish
        ? { tick: this.finish.tick, timeUs: this.finish.timeUs, result: this.finish.result }
        : undefined,
      reason: this.finish?.reason,
      objects: this.objects(),
      tick: this.tick,
      timeUs:
        this.finish?.timeUs ??
        this.continuationUs ??
        canonicalTime(this.tick / this.configuration.gameplay.tickRate),
      abandoned: this.abandoned,
      track: this.trackState(),
      cars: this.cars.map((car) => ({ ...car })) as [Car, Car],
      latestPress: this.latestPress ? { ...this.latestPress } : null,
    };
  }
}
