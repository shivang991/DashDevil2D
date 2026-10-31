import {
  type Barrier,
  type Baseline,
  type Context,
  type decodeMessage,
  DispositionCodeIgnored,
  type Identity,
  type Input,
  InputIntentRefresh,
  LaneLeft,
  LaneRight,
  type Messages,
  type Outcome,
  projectBaseline,
  RecoveryReasonResynchronize,
  SeatIndexPlayer1,
  type Verification,
} from "@dashdevil/contracts/protocol";

import { RaceSession } from "./RaceSession";
import { RaceVerification } from "./RaceVerification";
import { initialCar, validateMessage } from "@dashdevil/contracts/validation";
import { BaselineTransfer } from "@dashdevil/contracts/transfer";
import { crc32c } from "@dashdevil/contracts/wire";

type AuthorityKind =
  "Initialization" | "BaselineChunk" | "Disposition" | "Event" | "Coverage" | "Outcome" | "Barrier";
export type AuthorityRecord = Extract<ReturnType<typeof decodeMessage>, { type: AuthorityKind }>;
type SendEffect = {
  [K in "Ready" | "AuthorityAck"]: { type: "send"; message: K; value: Messages[K] };
}["Ready" | "AuthorityAck"];
export type AuthorityEffect =
  | SendEffect
  | { type: "initialize"; round: Messages["Initialization"]["round"] }
  | { type: "installed"; epoch: number }
  | { type: "usable" | "remote-input" | "outcome" | "barrier" | "recover" | "publish" | "ready" };

interface AuthorityView {
  context?: Context;
  outcome?: Outcome;
  verified: number;
  baselineBytes: number;
  roundId?: number;
  startUs?: number;
  timeUs?: number;
  cars?: Baseline["cars"];
  contact?: Baseline["contact"];
  objects?: Baseline["windows"][number]["objects"];
  seed?: number;
  positions?: string;
}
const sameIdentity = (a: Identity, b: Identity) =>
  a.roomId === b.roomId &&
  a.seat === b.seat &&
  a.seatSession === b.seatSession &&
  a.pairGeneration === b.pairGeneration;
const sameProgress = (a: Baseline["progress"], b: Baseline["progress"]) =>
  a.authority === b.authority &&
  a.event === b.event &&
  a.processed1 === b.processed1 &&
  a.processed2 === b.processed2 &&
  a.disposed1 === b.disposed1 &&
  a.disposed2 === b.disposed2;

/** Owns authoritative acceptance for one pair, across rounds and recovery epochs.
 * Delivery executes returned effects; it never edits the authoritative baseline.
 */
export class AuthoritativeRoundState {
  private readonly identity: Identity;
  private readonly diagnostic: boolean;
  private readonly nowUs: () => number;
  private current: AuthorityView;
  private context?: Context;
  private initialRound?: number;
  private baseline?: Baseline;
  private race?: RaceSession;
  private verification?: RaceVerification;
  private verifiedEpochBase = 0;
  private transfer?: BaselineTransfer;
  private earlyChunks: Messages["BaselineChunk"][] = [];
  private recoveryOutstanding = false;

  constructor(
    identity: Identity,
    diagnostic = false,
    retained: Pick<AuthorityView, "outcome" | "verified" | "baselineBytes"> = {
      verified: 0,
      baselineBytes: 0,
    },
    nowUs = () => performance.now() * 1000,
  ) {
    this.identity = { ...identity };
    this.diagnostic = diagnostic;
    this.current = structuredClone(retained);
    this.nowUs = nowUs;
  }
  get view(): AuthorityView {
    return structuredClone(this.current);
  }
  get round() {
    return this.baseline ? { ...this.baseline.round } : undefined;
  }
  get canPredict() {
    return Boolean(this.race);
  }
  get canRecover() {
    return Boolean(this.baseline && !this.recoveryOutstanding && !this.current.outcome);
  }

  accept(message: AuthorityRecord): AuthorityEffect[] {
    // Preserve the active realm's byte-array type for the mechanical wire validator.
    message =
      message.type === "BaselineChunk"
        ? {
            type: "BaselineChunk",
            value: {
              ...message.value,
              identity: { ...message.value.identity },
              round: { ...message.value.round },
              progress: { ...message.value.progress },
              data: new Uint8Array(message.value.data),
            },
          }
        : structuredClone(message);
    if (!sameIdentity(message.value.identity, this.identity))
      throw new Error("Reliable identity mismatch");
    const identity = this.identity;
    const effects: AuthorityEffect[] = [];
    switch (message.type) {
      case "Initialization": {
        if (this.diagnostic && this.context) throw new Error("Unexpected initialization");
        if (this.initialRound !== undefined && message.value.round.roundId <= this.initialRound)
          throw new Error("Stale round initialization");
        this.initialRound = message.value.round.roundId;
        this.context = message.value.context;
        this.current.context = this.context;
        this.race = undefined;
        if (this.current.outcome && message.value.round.roundId > this.current.outcome.roundId)
          this.current.outcome = undefined;
        this.transfer?.cancel();
        this.transfer = new BaselineTransfer(
          this.context,
          Math.min(1048576, this.context.connection.baselineBytes),
        );
        this.baseline = undefined;
        effects.push({ type: "initialize", round: message.value.round });
        break;
      }
      case "BaselineChunk": {
        if (
          !this.diagnostic &&
          (!this.context || message.value.round.roundId > (this.initialRound ?? 0))
        ) {
          if (
            this.earlyChunks.reduce((n, chunk) => n + chunk.data.length, 0) +
              message.value.data.length >
              1048576 ||
            this.earlyChunks.length >= 64
          )
            throw new Error("Early baseline queue overflow");
          this.earlyChunks.push(message.value);
          break;
        }
        if (!this.context) throw new Error("Baseline before initialization");
        if (!this.transfer) {
          if (
            !this.recoveryOutstanding ||
            !this.baseline ||
            message.value.epoch <= this.baseline.epoch
          )
            throw new Error("Unexpected baseline transfer");
          this.transfer = new BaselineTransfer(
            this.context,
            Math.min(1048576, this.context.connection.baselineBytes),
          );
        }
        const baseline = this.transfer.accept(message.value);
        this.current.baselineBytes += message.value.data.length;
        if (!baseline) break;
        this.baseline = baseline;
        this.transfer = undefined;
        this.recoveryOutstanding = false;
        this.verifiedEpochBase = this.current.verified;
        this.verification = new RaceVerification(
          baseline.epoch,
          baseline.context.gameplay.tickRate,
          baseline.context.connection.replayHistory,
        );
        effects.push({ type: "usable" }, { type: "installed", epoch: baseline.epoch });
        this.current.positions = baseline.cars.map((car) => car.progress).join(", ");
        this.current.roundId = baseline.round.roundId;
        this.current.startUs = baseline.context.startUs;
        this.current.timeUs = baseline.timeUs;
        this.current.cars = baseline.cars;
        this.current.contact = baseline.contact;
        this.current.seed = baseline.context.seed;
        if (!this.diagnostic) {
          if (this.race) this.race.install(baseline);
          else this.race = new RaceSession(baseline, this.nowUs);
          if (this.current.outcome?.roundId === baseline.round.roundId) {
            this.race.finish(this.current.outcome);
            this.current.timeUs = this.current.outcome.timeUs;
            this.current.cars = baseline.cars.map((car, seat) => ({
              ...car,
              ...this.current.outcome!.cars[seat],
            }));
            this.current.positions = this.current.outcome.cars
              .map((car) => car.progress)
              .join(", ");
          }
        }
        effects.push({
          type: "send",
          message: "Ready",
          value: {
            identity,
            round: baseline.round,
            transferId: message.value.transferId,
            epoch: baseline.epoch,
            progress: baseline.progress,
          },
        });
        effects.push(...this.ackOutcome());
        effects.push({ type: "ready" });
        break;
      }
      case "Disposition": {
        if (this.current.outcome) break;
        if (
          !this.baseline ||
          message.value.round.roundId !== this.baseline.round.roundId ||
          message.value.round.inputGeneration !== this.baseline.round.inputGeneration
        )
          throw new Error("Disposition context mismatch");
        const value = message.value;
        if (!this.diagnostic && this.race) {
          validateMessage("Disposition", value, this.context!);
          if (value.authority <= this.baseline.progress.authority) break;
          if (value.authority !== this.baseline.progress.authority + 1)
            throw new Error("Authority sequence gap");
          this.race.disposition(value);
          this.baseline = this.race.snapshot();
          effects.push({ type: "usable" });
          if (value.seat !== identity.seat) effects.push({ type: "remote-input" });
          break;
        }
        if (
          value.authority !== this.baseline.progress.authority + 1 ||
          value.disposition !== DispositionCodeIgnored ||
          value.intent !== InputIntentRefresh
        )
          throw new Error("Unexpected diagnostic disposition");
        this.baseline.cars[value.seat] = value.car;
        this.baseline.contact = value.contact;
        this.baseline.progress.authority = value.authority;
        if (value.seat === SeatIndexPlayer1) {
          this.baseline.progress.processed1 = value.processed;
          this.baseline.progress.disposed1 = value.processed;
        } else {
          this.baseline.progress.processed2 = value.processed;
          this.baseline.progress.disposed2 = value.processed;
        }
        break;
      }
      case "Event": {
        if (this.current.outcome) break;
        if (
          !this.race ||
          !this.baseline ||
          message.value.round.roundId !== this.baseline.round.roundId
        )
          throw new Error("Event context mismatch");
        validateMessage("Event", message.value, this.context!);
        if (message.value.authority <= this.baseline.progress.authority) break;
        if (message.value.authority !== this.baseline.progress.authority + 1)
          throw new Error("Authority event gap");
        this.race.event(message.value);
        this.baseline = this.race.snapshot();
        effects.push({ type: "usable" });
        break;
      }
      case "Coverage": {
        if (this.current.outcome) break;
        if (
          !this.race ||
          !this.baseline ||
          message.value.round.roundId !== this.baseline.round.roundId
        )
          throw new Error("Coverage context mismatch");
        validateMessage("Coverage", message.value, this.context!);
        if (!sameProgress(message.value.progress, this.baseline.progress))
          throw new Error("Coverage history unavailable");
        this.race.coverage(message.value);
        this.baseline = this.race.snapshot();
        break;
      }
      case "Outcome": {
        if (!this.context || message.value.roundId !== this.initialRound)
          throw new Error("Outcome context mismatch");
        if (this.current.outcome) break;
        validateMessage("Outcome", message.value, this.context);
        this.current.outcome = structuredClone(message.value);
        this.race?.finish(message.value);
        this.current.timeUs = message.value.timeUs;
        this.current.cars = message.value.cars.map((car, seat) => ({
          ...this.baseline?.cars[seat],
          ...car,
        })) as Baseline["cars"];
        this.current.positions = message.value.cars.map((car) => car.progress).join(", ");
        effects.push({ type: "outcome" }, ...this.ackOutcome());
        break;
      }
      case "Barrier":
        effects.push(...this.barrier(message.value));
        break;
    }
    return structuredClone(effects);
  }
  /** Completes the initialization delivery effect before replaying buffered authority. */
  initialized(round: Messages["Initialization"]["round"]): AuthorityEffect[] {
    if (round.roundId !== this.initialRound) return [];
    const waiting = this.earlyChunks;
    this.earlyChunks = [];
    return waiting.flatMap((value) => this.accept({ type: "BaselineChunk", value }));
  }
  private ackOutcome(): AuthorityEffect[] {
    const outcome = this.current.outcome,
      baseline = this.baseline;
    if (
      !outcome ||
      !baseline ||
      this.recoveryOutstanding ||
      this.transfer ||
      outcome.roundId !== baseline.round.roundId
    )
      return [];
    return [
      {
        type: "send",
        message: "AuthorityAck",
        value: {
          identity: baseline.identity,
          round: baseline.round,
          epoch: baseline.epoch,
          tick: outcome.tick,
          progress: outcome.progress,
        },
      },
    ];
  }
  private barrier(value: Barrier): AuthorityEffect[] {
    if (this.current.outcome) return [];
    if (this.race) this.baseline = this.race.advanceAuthority(value.tick);
    const b = this.baseline;
    if (
      !b ||
      value.epoch !== b.epoch ||
      value.round.roundId !== b.round.roundId ||
      value.round.inputGeneration !== b.round.inputGeneration ||
      (this.diagnostic ? value.tick <= b.tick : value.tick < b.tick) ||
      !sameProgress(value.progress, b.progress)
    )
      throw new Error("Authority history unavailable");
    b.tick = value.tick;
    b.timeUs = value.timeUs;
    this.current.objects = b.windows.flatMap((window) => window.objects);
    this.current.contact = { ...b.contact };
    this.current.timeUs = b.timeUs;
    this.current.cars = structuredClone(b.cars);
    this.current.positions = b.cars.map((car) => car.progress).join(", ");
    const recover = this.verification?.barrier(value.tick, crc32c(projectBaseline(b)));
    this.updateVerified();
    return [
      { type: "usable" },
      { type: "barrier" },
      {
        type: "send",
        message: "AuthorityAck",
        value: {
          identity: b.identity,
          round: b.round,
          epoch: b.epoch,
          tick: b.tick,
          progress: b.progress,
        },
      },
      ...(recover ? [{ type: "recover" } as const] : []),
      { type: "publish" },
    ];
  }
  verify(value: Verification): boolean {
    if (this.current.outcome) return false;
    const recover = this.verification?.datagram(value) ?? false;
    this.updateVerified();
    return recover;
  }
  private updateVerified() {
    if (this.verification)
      this.current.verified = this.verifiedEpochBase + this.verification.verified;
  }
  requestRecovery(): Messages["Recovery"] | undefined {
    if (!this.canRecover) return;
    const b = this.baseline!;
    this.recoveryOutstanding = true;
    return structuredClone({
      identity: b.identity,
      round: b.round,
      reason: RecoveryReasonResynchronize,
      epoch: b.epoch,
      tick: b.tick,
      progress: b.progress,
    });
  }
  input(value: Input, timeUs: number) {
    this.race?.input(value, timeUs);
  }
  frame(timeUs: number, authorityAgeUs: number): ReturnType<RaceSession["frame"]> | undefined {
    if (this.race) return this.race.frame(timeUs, authorityAgeUs);
    const outcome = this.current.outcome;
    if (!outcome || !this.context || outcome.roundId !== this.initialRound) return;
    // A recovered terminal outcome can precede the first baseline. Its cars are
    // sufficient to draw the frozen result while road-object state is unavailable.
    return {
      feedback: [],
      sounds: [],
      objects: [],
      renderedCars: outcome.cars.map((car) => ({ ...car, tilt: 0 })),
      cars: outcome.cars.map((car, seat) => ({
        ...initialCar(seat === SeatIndexPlayer1 ? LaneLeft : LaneRight, car.hp),
        ...car,
        normalSpeed: this.context!.gameplay.startingRoadSpeed,
      })),
      timeUs: outcome.timeUs,
      outcome: structuredClone(outcome),
      awaiting: false,
      stale: false,
      needsRecovery: false,
    };
  }
  get diagnostics() {
    return this.race?.diagnostics.map((value) => ({ ...value }));
  }
}
