import { localName } from "./localName";
import { AuthoritativeRoundState, type AuthorityEffect } from "@/game/AuthoritativeRoundState";
import {
  protocolVersion,
  decodeMessage,
  encodeMessage,
  decodeVerification,
  type Outcome,
  type Admission,
  type Baseline,
  type Context,
  type Identity,
  type Messages,
  type RoomState,
  type RoomReply,
} from "@dashdevil/contracts/protocol";
import { FrameReader } from "@dashdevil/contracts/wire";

export interface PairedState {
  status: string;
  code: string;
  identity?: Identity;
  connectedSeats: number;
  verified: number;
  barriers: number;
  clockSamples: number;
  clockOffsetUs: number;
  context?: Context;
  outcome?: Outcome;
  diagnostics: {
    corrections?: AuthoritativeRoundState["diagnostics"];
    reliableAttemptedBytes?: number;
    reliableReceivedBytes?: number;
    verificationReceivedBytes?: number;
    recoveryRequests?: number;
    recoveryEpochs?: number[];
    baselineEpochs?: number[];
    localInputs: number;
    remoteRecords: number;
    lastLocalInputUs?: number;
    lastRemoteReceiveUs?: number;
    outcomeReceivedUs?: number;
    resultDelayEstimateUs?: number;
    resultCommitDelayEstimateUs?: number;
    localInputToDrawUs?: number[];
    remoteReceiveToDrawUs?: number[];
  };
  contact?: Baseline["contact"];
  objects?: Baseline["windows"][number]["objects"];
  room?: RoomState;
  pending?: string;
  notice?: string;
  roundId?: number;
  startUs?: number;
  timeUs?: number;
  cars?: Baseline["cars"];
  seed?: number;
  positions: string;
  errors: string[];
  baselineBytes: number;
  recoveryMs?: number;
}
export interface ConnectionOptions {
  server: string;
  certificateHash?: number[];
  development?: boolean;
  diagnostic?: boolean;
}
const emptyState = (): PairedState => ({
  status: "Disconnected",
  diagnostics: { localInputs: 0, remoteRecords: 0 },
  code: "",
  connectedSeats: 0,
  verified: 0,
  barriers: 0,
  clockSamples: 0,
  clockOffsetUs: 0,
  positions: "",
  errors: [],
  baselineBytes: 0,
});
const nowUs = () => Math.round(performance.now() * 1000);
const token = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const sameIdentity = (a: Identity, b: Identity) =>
  a.roomId === b.roomId &&
  a.seat === b.seat &&
  a.seatSession === b.seatSession &&
  a.pairGeneration === b.pairGeneration;
/** Authenticated paired transport shared by product rooms and the retained diagnostic. */
export class PairedConnection {
  state = emptyState();
  private readonly options: ConnectionOptions;
  private socket?: WebSocket;
  private gameplay?: WebTransport;
  private control?: WritableStreamDefaultWriter<Uint8Array>;
  private inputs?: WritableStreamDefaultWriter<Uint8Array>;
  private authority?: AuthoritativeRoundState;
  private context?: Context;
  private get round() {
    return this.authority?.round;
  }
  private heldMask = 0;
  private winningControl = 0;
  private lastDrawnLocalUs = 0;
  private lastDrawnRemoteUs = 0;
  private admission?: Admission;
  private generation = 0;
  private timers: ReturnType<typeof setInterval>[] = [];
  private lastUsable = 0;
  private inputSequence = 0;
  private clockSequence = 0;
  private clocks = new Map<number, number>();
  private samples: { rtt: number; offset: number }[] = [];
  private queuedBytes = 0;
  private queuedMessages = 0;
  private roomWrites: { bytes: number; at: number }[] = [];
  private restoredAt = 0;
  private revision = 0;
  private roomSequence = 0;
  private terminal = false;
  private focused = true;
  private hidden = false;
  private timerStarted = false;
  private pendingCommands = new Map<
    number,
    { label: string; timeout: ReturnType<typeof setTimeout> }
  >();
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private recoverUntil = 0;
  private pulseSequence = 0;
  private recoveryRequestTimer?: ReturnType<typeof setTimeout>;
  private lastRecoveryRequest = -Infinity;
  private onChange: (state: PairedState) => void;
  constructor(options: ConnectionOptions, onChange: (state: PairedState) => void) {
    this.options = options;
    this.onChange = onChange;
    if (new URL(options.server).protocol !== "https:") throw new Error("HTTPS server required");
    if (
      options.certificateHash &&
      (!options.development ||
        !["localhost", "127.0.0.1", "[::1]"].includes(new URL(options.server).hostname))
    )
      throw new Error("Certificate fingerprints are development-only on loopback");
  }
  private storageKey() {
    return `dashdevil-seat:${this.options.server}`;
  }
  private credential(): Uint8Array {
    try {
      const value = sessionStorage.getItem(this.storageKey());
      return value
        ? Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
        : (this.admission?.credential ?? new Uint8Array());
    } catch {
      return this.admission?.credential ?? new Uint8Array();
    }
  }
  private publish() {
    this.onChange({ ...this.state, errors: [...this.state.errors] });
  }
  private fail(error: unknown, generation: number) {
    if (generation !== this.generation || this.terminal) return;
    const detail = error instanceof Error ? error.message : String(error);
    this.state.errors.push(detail);
    if (this.state.errors.length > 32) this.state.errors.shift();
    const ended = /(?:room|seat|credential) expired|rejected|superseded|replaced|version/i.test(
      detail,
    );
    this.teardown();
    if (ended) {
      try {
        sessionStorage.removeItem(this.storageKey());
      } catch {
        /* storage optional */
      }
      this.admission = undefined;
      this.state.room = undefined;
      this.state.identity = undefined;
    }
    this.state.status = detail.includes("version")
      ? "Version mismatch—reload"
      : `Unable to connect: ${detail}`;
    this.state.pending = undefined;
    this.publish();
    if (!this.options.diagnostic && this.admission && this.credential().length && !ended) {
      if (!this.recoverUntil)
        this.recoverUntil =
          performance.now() + (this.state.context?.room.reconnectGrace ?? 15) * 1000;
      if (performance.now() < this.recoverUntil)
        this.recoveryTimer = setTimeout(() => void this.connect(2), 500);
    }
  }
  private teardown() {
    this.generation++;
    this.lastUsable = 0;
    this.authority = undefined;
    this.context = undefined;
    this.heldMask = 0;
    this.winningControl = 0;
    clearTimeout(this.recoveryRequestTimer);
    this.recoveryRequestTimer = undefined;
    this.lastRecoveryRequest = -Infinity;
    clearTimeout(this.recoveryTimer);
    this.pendingCommands.forEach((command) => clearTimeout(command.timeout));
    this.pendingCommands.clear();
    this.timerStarted = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.socket?.close();
    this.gameplay?.close();
    this.socket = undefined;
    this.gameplay = undefined;
    this.control = undefined;
    this.inputs = undefined;
    this.clocks.clear();
    this.samples = [];
    this.queuedBytes = 0;
    this.queuedMessages = 0;
    this.roomWrites = [];
  }
  async connect(operation: 0 | 1 | 2, code = "", mode: 1 | 2 = 1): Promise<void> {
    this.teardown();
    this.terminal = false;
    const generation = this.generation;
    // Keep the last view visible and frozen while an authenticated seat recovers.
    // Input remains barred until the new pair has installed current authority.
    const retained = operation === 2 ? this.state : undefined;
    this.state = {
      ...emptyState(),
      ...retained,
      code: retained?.code ?? code,
      errors: this.state.errors,
      pending:
        operation === 0 ? "Creating room" : operation === 1 ? "Joining room" : "Recovering room",
    };
    this.pulseSequence = 0;
    this.publish();
    if (
      typeof globalThis.WebTransport !== "function" ||
      !("createUnidirectionalStream" in WebTransport.prototype) ||
      !("datagrams" in WebTransport.prototype)
    ) {
      this.state.pending = undefined;
      this.state.status = "Browser unsupported";
      this.publish();
      return;
    }
    this.state.status = "Connecting";
    this.publish();
    try {
      const response = await fetch(
        `${this.options.server}/admission${operation === 0 && !this.options.diagnostic ? `?mode=${mode}` : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          signal: AbortSignal.timeout(5000),
          body: encodeMessage("AdmissionRequest", {
            operation,
            version: protocolVersion,
            code,
            name: operation === 2 ? "" : localName(),
            credential: operation === 2 ? this.credential() : new Uint8Array(),
          }) as Uint8Array<ArrayBuffer>,
        },
      );
      const bytes = new Uint8Array(await response.arrayBuffer());
      const message = decodeMessage(bytes);
      if (message.type === "ProtocolError") throw new Error(message.value.detail);
      if (
        !response.ok ||
        message.type !== "Admission" ||
        message.value.version !== protocolVersion ||
        message.value.origin !== location.origin
      )
        throw new Error("Admission rejected");
      if (generation !== this.generation) return;
      this.admission = message.value;
      this.authority = new AuthoritativeRoundState(
        message.value.identity,
        this.options.diagnostic,
        {
          outcome: this.state.outcome,
          verified: this.state.verified,
          baselineBytes: this.state.baselineBytes,
        },
      );
      this.state.identity = message.value.identity;
      this.state.code = response.headers.get("X-Room-Code") ?? code;
      try {
        sessionStorage.setItem(
          this.storageKey(),
          btoa(String.fromCharCode(...message.value.credential)),
        );
      } catch {
        /* retain in memory */
      }
      this.revision = 0;
      this.inputSequence = 0;
      this.clockSequence = 0;
      this.roomSequence = 0;
      this.restoredAt = performance.now();
      this.openRoom(message.value, generation);
      const options: WebTransportOptions = this.options.certificateHash
        ? {
            serverCertificateHashes: [
              { algorithm: "sha-256", value: Uint8Array.from(this.options.certificateHash).buffer },
            ],
          }
        : {};
      const gameplay = new WebTransport(
        `${this.options.server}/gameplay?ticket=${token(message.value.gameplayTicket)}`,
        options,
      );
      this.gameplay = gameplay;
      void gameplay.closed.then(
        (info) => this.fail(new Error(info.reason || "Gameplay channel lost"), generation),
        (error) =>
          this.fail(
            new Error(
              `Gameplay channel failed: ${String(error).replace(/https?:\/\/\S+/g, "[endpoint]")}`,
            ),
            generation,
          ),
      );
      await Promise.race([
        gameplay.ready,
        new Promise<never>((_, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("WebTransport connection timed out")),
            5000,
          );
          void gameplay.ready.finally(() => clearTimeout(timeout)).catch(() => {});
        }),
      ]);
      if (generation !== this.generation) {
        gameplay.close();
        return;
      }
      if (gameplay.datagrams.maxDatagramSize < 10)
        throw new Error("Required datagram payload unavailable");
      const control = await gameplay.createBidirectionalStream();
      if (generation !== this.generation) {
        void control.readable.cancel().catch(() => {});
        void control.writable.abort().catch(() => {});
        return;
      }
      this.control = control.writable.getWriter();
      void this.read(control.readable, "control", generation).catch((error) =>
        this.fail(error, generation),
      );
      void this.readAuthority(gameplay, generation).catch((error) => this.fail(error, generation));
      void this.readDatagrams(gameplay, generation).catch((error) => this.fail(error, generation));
      await this.send(
        "Handshake",
        {
          version: protocolVersion,
          identity: message.value.identity,
          datagramBytes: gameplay.datagrams.maxDatagramSize,
        },
        generation,
      );
      if (generation !== this.generation) return;
      const watchdog = setInterval(() => {
        if (generation !== this.generation) return;
        this.drainRoomWrites();
        if (
          this.roomWrites.length &&
          performance.now() - this.roomWrites[0].at >=
            (this.context?.connection.essentialQueueWait ?? 0.5) * 1000
        ) {
          this.fail(new Error("Reliable room write stalled"), generation);
          return;
        }
        if (this.lastUsable && performance.now() - this.lastUsable >= 1000) {
          this.state.status = "Connection warning";
          this.releaseControls();
          this.publish();
          if (!this.options.diagnostic && this.state.room?.phase === 2 && !this.state.outcome) {
            this.fail(
              new Error("Authoritative history expired; recovering connection"),
              generation,
            );
            return;
          }
        }
        if (!this.round && performance.now() - this.restoredAt >= 5000)
          this.fail(new Error("Initialization timed out"), generation);
      }, 100);
      this.timers.push(watchdog);
    } catch (error) {
      this.fail(error, generation);
    }
  }
  private openRoom(admission: Admission, generation: number) {
    const socket = new WebSocket(
      `${this.options.server.replace("https:", "wss:")}/room?ticket=${token(admission.roomTicket)}`,
    );
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onclose = (event) =>
      this.fail(new Error(event.reason || "Room channel lost"), generation);
    socket.onerror = () => this.fail(new Error("Room channel failed"), generation);
    socket.onmessage = (event) => {
      if (generation !== this.generation) return;
      try {
        if (!(event.data instanceof ArrayBuffer)) throw new Error("Binary room frame required");
        const message = decodeMessage(new Uint8Array(event.data));
        if (message.type === "ProtocolError") throw new Error(message.value.detail);
        if (message.type === "RoomInitialization") {
          if (
            message.value.version !== protocolVersion ||
            !sameIdentity(message.value.identity, admission.identity)
          )
            throw new Error("Room initialization mismatch");
          this.sendRoom(encodeMessage("RoomInitialization", message.value));
        } else if (message.type === "RoomState") {
          if (!sameIdentity(message.value.identity, admission.identity))
            throw new Error("Room state identity mismatch");
          if (message.value.revision < this.revision) return;
          this.revision = message.value.revision;
          const previous = this.state.room;
          this.state.room = message.value;
          if (previous?.phase !== message.value.phase && message.value.phase !== 3)
            this.releaseControls();
          if (previous?.phase === 1 && message.value.phase === 0)
            this.state.notice = "Countdown cancelled. Both players must ready again.";
          this.state.connectedSeats = message.value.seats.filter((seat) => seat.flags & 1).length;
          if (message.value.seats[admission.identity.seat].flags & 1 && this.round) {
            this.state.status = "Connected";
            if (![...this.pendingCommands.values()].some((command) => command.label !== "Focus"))
              this.state.pending = undefined;
            this.recoverUntil = 0;
            this.state.recoveryMs = performance.now() - this.restoredAt;
          }
          this.publish();
          if (
            !this.options.diagnostic &&
            this.state.status === "Connected" &&
            !((previous?.seats[admission.identity.seat]?.flags ?? 0) & 1)
          )
            this.focus(this.focused, this.hidden);
        } else if (message.type === "RoomReply") {
          this.reply(message.value);
        } else throw new Error("Unexpected room message");
      } catch (error) {
        this.fail(error, generation);
      }
    };
  }
  private drainRoomWrites() {
    let drained =
      this.roomWrites.reduce((sum, item) => sum + item.bytes, 0) -
      (this.socket?.bufferedAmount ?? 0);
    while (drained > 0 && this.roomWrites.length) {
      const first = this.roomWrites[0],
        bytes = Math.min(drained, first.bytes);
      first.bytes -= bytes;
      drained -= bytes;
      if (!first.bytes) this.roomWrites.shift();
    }
  }
  private sendRoom(bytes: Uint8Array) {
    if (!this.socket) throw new Error("Room writer unavailable");
    this.checkQueue(bytes.length, "Reliable room queue overflow");
    this.socket.send(bytes);
    this.roomWrites.push({ bytes: bytes.length, at: performance.now() });
    this.drainRoomWrites();
  }
  private checkQueue(bytes: number, detail: string) {
    this.drainRoomWrites();
    // Transport work includes buffered room messages and in-flight gameplay
    // writes. Room application acknowledgements have their own bounded map.
    if (
      this.queuedBytes + (this.socket?.bufferedAmount ?? 0) + bytes >
        (this.context?.connection.queueBytes ?? 262144) ||
      this.queuedMessages + this.roomWrites.length >=
        (this.context?.connection.queueMessages ?? 512)
    )
      throw new Error(detail);
  }
  private async send<K extends keyof Messages>(
    type: K,
    value: Messages[K],
    generation: number,
    input = false,
  ) {
    if (generation !== this.generation) return;
    const writer = input ? this.inputs : this.control;
    if (!writer) throw new Error("Reliable writer unavailable");
    const bytes = encodeMessage(type, value, this.context?.connection.reliableFrameBytes ?? 65536);
    this.state.diagnostics.reliableAttemptedBytes =
      (this.state.diagnostics.reliableAttemptedBytes ?? 0) + bytes.length;
    this.checkQueue(bytes.length, "Reliable queue overflow");
    this.queuedBytes += bytes.length;
    this.queuedMessages++;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        writer.write(bytes),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Reliable write stalled")),
            (this.context?.connection.essentialQueueWait ?? 0.5) * 1000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.queuedBytes -= bytes.length;
        this.queuedMessages--;
      }
    }
  }
  private async read(
    stream: ReadableStream<Uint8Array>,
    channel: "control" | "authority",
    generation: number,
  ) {
    const reader = stream.getReader(),
      frames = new FrameReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (generation !== this.generation) return;
        if (done) {
          frames.finish();
          throw new Error(`${channel} stream ended`);
        }
        this.state.diagnostics.reliableReceivedBytes =
          (this.state.diagnostics.reliableReceivedBytes ?? 0) + value.length;
        for (const frame of frames.push(value))
          await this.record(decodeMessage(frame), channel, generation);
      }
    } finally {
      reader.releaseLock();
    }
  }
  private async readAuthority(gameplay: WebTransport, generation: number) {
    const reader = gameplay.incomingUnidirectionalStreams.getReader();
    try {
      const { value, done } = await reader.read();
      if (generation !== this.generation) return;
      if (done || !value) throw new Error("Authority stream unavailable");
      const reading = this.read(value, "authority", generation);
      void reader
        .read()
        .then((extra) => {
          if (!extra.done) this.fail(new Error("Unexpected extra authority stream"), generation);
        })
        .catch((error) => this.fail(error, generation));
      await reading;
    } finally {
      reader.releaseLock();
    }
  }
  private async record(
    message: ReturnType<typeof decodeMessage>,
    channel: string,
    generation: number,
  ) {
    if (!this.admission || generation !== this.generation || this.terminal) return;
    const identity = this.admission.identity;
    if (message.type === "ProtocolError") throw new Error(message.value.detail);
    if ("identity" in message.value && !sameIdentity(message.value.identity, identity))
      throw new Error("Reliable identity mismatch");
    switch (message.type) {
      case "Handshake":
        if (
          channel !== "control" ||
          message.value.version !== protocolVersion ||
          message.value.datagramBytes !== 10
        )
          throw new Error("Gameplay handshake rejected");
        break;
      case "Initialization":
      case "Outcome":
        if (channel !== "control") throw new Error(`${message.type} on wrong stream`);
        await this.applyAuthority(this.authority!.accept(message), generation);
        break;
      case "BaselineChunk":
      case "Disposition":
      case "Event":
      case "Coverage":
      case "Barrier":
        if (channel !== "authority") throw new Error(`${message.type} on wrong stream`);
        await this.applyAuthority(this.authority!.accept(message), generation);
        break;
      case "RoomPulse": {
        if (
          channel !== "authority" ||
          this.options.diagnostic ||
          !this.round ||
          message.value.round.roundId !== this.round.roundId
        )
          break;
        if (message.value.sequence <= this.pulseSequence) throw new Error("Stale room pulse");
        this.pulseSequence = message.value.sequence;
        if (this.state.room?.phase !== 2) this.lastUsable = performance.now();
        if (this.state.status === "Connection warning") this.state.status = "Connected";
        await this.send("RoomPulse", message.value, generation);
        if (generation !== this.generation) return;
        this.publish();
        break;
      }
      case "ClockReply": {
        if (channel !== "control") throw new Error("Clock on wrong stream");
        const reply = message.value,
          sent = this.clocks.get(reply.sequence);
        this.clocks.delete(reply.sequence);
        const received = nowUs(),
          rtt =
            sent === undefined
              ? -1
              : received - sent - (reply.serverSendUs - reply.serverReceiveUs);
        if (sent !== reply.clientSendUs || rtt < 0 || reply.serverSendUs < reply.serverReceiveUs)
          throw new Error("Invalid clock exchange");
        const offset = (reply.serverReceiveUs - sent + (reply.serverSendUs - received)) / 2;
        this.samples.push({ rtt, offset });
        if (this.samples.length > 8) this.samples.shift();
        const best = this.samples.reduce((a, b) => (a.rtt < b.rtt ? a : b));
        this.state.clockOffsetUs = this.state.clockSamples
          ? this.state.clockOffsetUs + (best.offset - this.state.clockOffsetUs) / 8
          : best.offset;
        this.state.clockSamples++;
        this.publish();
        break;
      }
      default:
        throw new Error(`Unexpected ${channel} record: ${message.type}`);
    }
  }
  private syncAuthority() {
    if (this.authority) {
      const view = this.authority.view;
      Object.assign(this.state, view);
      this.context = view.context;
    }
  }
  private async applyAuthority(effects: AuthorityEffect[], generation: number) {
    this.syncAuthority();
    for (const effect of effects) {
      if (generation !== this.generation) return;
      switch (effect.type) {
        case "initialize": {
          this.heldMask = 0;
          this.winningControl = 0;
          this.inputSequence = 0;
          if (!this.inputs) {
            const inputs = await this.gameplay!.createUnidirectionalStream();
            if (generation !== this.generation) {
              void inputs.abort().catch(() => {});
              return;
            }
            this.inputs = inputs.getWriter();
          }
          await this.send(
            "Input",
            {
              identity: this.admission!.identity,
              round: effect.round,
              sequence: ++this.inputSequence,
              intent: 2,
              control: 0,
              heldMask: 0,
            },
            generation,
            true,
          );
          if (generation !== this.generation) return;
          await this.applyAuthority(this.authority!.initialized(effect.round), generation);
          break;
        }
        case "send":
          await this.send(effect.message, effect.value, generation);
          break;
        case "installed":
          clearTimeout(this.recoveryRequestTimer);
          this.recoveryRequestTimer = undefined;
          (this.state.diagnostics.baselineEpochs ??= []).push(effect.epoch);
          break;
        case "ready":
          if (!this.timerStarted) {
            this.startTimers(generation);
            this.timerStarted = true;
          }
          if (!this.options.diagnostic) this.focus(this.focused, this.hidden);
          this.publish();
          break;
        case "usable":
          this.lastUsable = performance.now();
          break;
        case "remote-input":
          this.state.diagnostics.remoteRecords++;
          this.state.diagnostics.lastRemoteReceiveUs = nowUs();
          break;
        case "outcome":
          this.heldMask = 0;
          this.winningControl = 0;
          this.state.diagnostics.outcomeReceivedUs = nowUs();
          this.state.diagnostics.resultDelayEstimateUs =
            nowUs() + this.state.clockOffsetUs - this.context!.startUs - this.state.outcome!.timeUs;
          this.publish();
          break;
        case "barrier":
          this.state.barriers++;
          if (this.state.status === "Connection warning") this.state.status = "Connected";
          break;
        case "recover":
          this.requestBaseline();
          break;
        case "publish":
          this.publish();
          break;
      }
    }
  }
  private startTimers(generation: number) {
    this.timers.push(
      setInterval(
        () => {
          if (!this.round || generation !== this.generation || this.state.outcome) return;
          if (this.inputSequence >= 0xffffffff) {
            this.fail(new Error("Input counter exhausted"), generation);
            return;
          }
          const input = {
            identity: this.admission!.identity,
            round: this.round!,
            sequence: ++this.inputSequence,
            intent: 2,
            control: this.winningControl,
            heldMask: this.heldMask,
          };
          if (
            this.authority?.canPredict &&
            (this.state.room?.phase === 2 || this.state.room?.phase === 3)
          )
            this.authority!.input(input, this.estimatedRoundUs());
          void this.send("Input", input, generation, true).catch((e) => this.fail(e, generation));
        },
        (this.context?.connection.controlRefreshInterval ?? 0.25) * 1000,
      ),
    );
    const clock = () => {
      if (generation !== this.generation) return;
      if (this.clocks.size >= 8 || this.clockSequence >= 0xffffffff) {
        this.fail(new Error("Clock progress exhausted"), generation);
        return;
      }
      const sequence = ++this.clockSequence,
        clientSendUs = nowUs();
      this.clocks.set(sequence, clientSendUs);
      void this.send("ClockRequest", { sequence, clientSendUs }, generation).catch((e) =>
        this.fail(e, generation),
      );
    };
    clock();
    this.timers.push(setInterval(clock, (this.context?.connection.clockSyncInterval ?? 1) * 1000));
  }
  private async readDatagrams(gameplay: WebTransport, generation: number) {
    const reader = gameplay.datagrams.readable.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || generation !== this.generation) return;
        this.state.diagnostics.verificationReceivedBytes =
          (this.state.diagnostics.verificationReceivedBytes ?? 0) + value.length;
        if (value.length !== 10) continue;
        const verification = decodeVerification(value);
        if (this.state.outcome) continue;
        if (this.authority?.verify(verification)) this.requestBaseline();
        this.syncAuthority();
        this.publish();
      }
    } finally {
      reader.releaseLock();
    }
  }
  requestBaseline() {
    if (!this.authority?.canRecover) return;
    // Scheduling stays with delivery; the module coalesces outstanding requests.
    const interval = 1000 / this.context!.connection.recoveryRequestRate + 10;
    const wait = interval - (performance.now() - this.lastRecoveryRequest);
    if (wait > 0) {
      if (!this.recoveryRequestTimer) {
        const generation = this.generation;
        this.recoveryRequestTimer = setTimeout(() => {
          this.recoveryRequestTimer = undefined;
          if (generation === this.generation) this.requestBaseline();
        }, wait);
      }
      return;
    }
    const recovery = this.authority.requestRecovery();
    if (!recovery) return;
    this.lastRecoveryRequest = performance.now();
    this.state.diagnostics.recoveryRequests = (this.state.diagnostics.recoveryRequests ?? 0) + 1;
    (this.state.diagnostics.recoveryEpochs ??= []).push(recovery.epoch);
    const generation = this.generation;
    void this.send("Recovery", recovery, generation).catch((error) => this.fail(error, generation));
  }
  private estimatedRoundUs() {
    return Math.max(0, nowUs() + this.state.clockOffsetUs - (this.context?.startUs ?? nowUs()));
  }
  recordDraw() {
    const d = this.state.diagnostics;
    if (this.authority?.canPredict) d.corrections = this.authority.diagnostics;
    if (d.lastLocalInputUs && d.lastLocalInputUs > this.lastDrawnLocalUs) {
      this.lastDrawnLocalUs = d.lastLocalInputUs;
      (d.localInputToDrawUs ??= []).push(nowUs() - d.lastLocalInputUs);
      if (d.localInputToDrawUs.length > 200) d.localInputToDrawUs.shift();
    }
    if (d.lastRemoteReceiveUs && d.lastRemoteReceiveUs > this.lastDrawnRemoteUs) {
      this.lastDrawnRemoteUs = d.lastRemoteReceiveUs;
      (d.remoteReceiveToDrawUs ??= []).push(nowUs() - d.lastRemoteReceiveUs);
      if (d.remoteReceiveToDrawUs.length > 200) d.remoteReceiveToDrawUs.shift();
    }
  }
  recordResultCommit() {
    if (
      this.state.outcome &&
      this.context &&
      this.state.diagnostics.resultCommitDelayEstimateUs === undefined
    )
      this.state.diagnostics.resultCommitDelayEstimateUs =
        nowUs() + this.state.clockOffsetUs - this.context.startUs - this.state.outcome.timeUs;
  }
  frame() {
    const frame = this.authority?.frame(
      this.estimatedRoundUs(),
      (performance.now() - this.lastUsable) * 1000,
    );
    if (frame?.needsRecovery) this.requestBaseline();
    return frame;
  }
  input(intent: 0 | 1, control: number) {
    if (
      !this.round ||
      !this.admission ||
      !this.authority?.canPredict ||
      (this.state.room?.phase !== 2 && this.state.room?.phase !== 3) ||
      this.state.status !== "Connected" ||
      this.state.outcome ||
      !this.focused ||
      this.hidden
    )
      return;
    const mask = 1 << (control - 1);
    if (intent === 0) {
      if (this.heldMask & mask) return;
      this.heldMask |= mask;
      this.winningControl = control;
    } else {
      this.heldMask &= ~mask;
      if (this.winningControl === control)
        this.winningControl =
          this.heldMask & 4 ? 3 : this.heldMask & 2 ? 2 : this.heldMask & 1 ? 1 : 0;
    }
    const input = {
      identity: this.admission.identity,
      round: this.round!,
      sequence: ++this.inputSequence,
      intent,
      control,
      heldMask: this.heldMask,
    };
    this.authority!.input(input, this.estimatedRoundUs());
    this.state.diagnostics.localInputs++;
    this.state.diagnostics.lastLocalInputUs = nowUs();
    const generation = this.generation;
    void this.send("Input", input, generation, true).catch((e) => this.fail(e, generation));
  }
  releaseControls() {
    const hadInput = this.heldMask !== 0;
    this.heldMask = 0;
    this.winningControl = 0;
    if (!hadInput || !this.round || !this.admission || !this.inputs || this.state.outcome) return;
    const input = {
      identity: this.admission.identity,
      round: this.round!,
      sequence: ++this.inputSequence,
      intent: 1,
      control: 0,
      heldMask: 0,
    };
    this.authority?.input(input, this.estimatedRoundUs());
    const generation = this.generation;
    void this.send("Input", input, generation, true).catch((e) => this.fail(e, generation));
  }
  get hasCredential() {
    return this.credential().length === 32;
  }
  focus(focused: boolean, hidden: boolean) {
    const restoring = focused && !hidden && (!this.focused || this.hidden);
    if (!focused || hidden) this.releaseControls();
    this.focused = focused;
    this.hidden = hidden;
    if (
      restoring &&
      !this.options.diagnostic &&
      this.state.room?.phase === 2 &&
      !this.state.outcome
    ) {
      this.fail(new Error("Restoring current authority after suspension"), this.generation);
      return;
    }
    if (!this.options.diagnostic && this.state.status === "Connected")
      this.command(4, hidden ? 0 : 1, focused && !hidden ? 1 : 0, "Focus");
  }
  command(command: 0 | 1 | 2 | 3 | 4 | 5, mode = 1, ready = 0, label = "Updating room") {
    if (!this.admission || this.socket?.readyState !== WebSocket.OPEN) return;
    if (command !== 4 && this.state.pending) return;
    if (this.roomSequence >= 0xffffffff) {
      this.fail(new Error("Room counter exhausted"), this.generation);
      return;
    }
    const sequence = ++this.roomSequence;
    const generation = this.generation;
    const bytes = encodeMessage("RoomCommand", {
      identity: this.admission.identity,
      sequence,
      revision: this.revision,
      command,
      mode,
      ready,
    });
    if (this.pendingCommands.size >= (this.context?.connection.queueMessages ?? 512)) {
      this.fail(new Error("Room confirmation backlog"), generation);
      return;
    }
    const timeout = setTimeout(
      () => this.fail(new Error("Room confirmation timed out"), generation),
      (this.context?.connection.essentialProgressDeadline ?? 1) * 1000,
    );
    this.pendingCommands.set(sequence, { label, timeout });
    if (command !== 4) this.state.pending = label;
    try {
      this.sendRoom(bytes);
    } catch (error) {
      this.fail(error, generation);
      return;
    }
    this.publish();
  }
  private reply(value: RoomReply) {
    if (!this.admission || !sameIdentity(value.identity, this.admission.identity))
      throw new Error("Room reply identity mismatch");
    const pending = this.pendingCommands.get(value.sequence);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingCommands.delete(value.sequence);
    if (pending.label !== "Focus") this.state.pending = undefined;
    if (!value.accepted) this.state.notice = value.detail;
    else if (pending.label !== "Focus") this.state.notice = undefined;
    this.publish();
  }
  dispose() {
    this.terminal = true;
    this.teardown();
  }
  drop(channel: "room" | "gameplay") {
    if (channel === "room") this.socket?.close();
    else this.gameplay?.close();
  }
  leave() {
    if (this.socket?.readyState === WebSocket.OPEN && this.admission)
      this.socket.send(
        encodeMessage("RoomCommand", {
          identity: this.admission.identity,
          sequence: ++this.roomSequence,
          revision: this.revision,
          command: 3,
          mode: 1,
          ready: 0,
        }),
      );
    this.terminal = true;
    this.teardown();
    try {
      sessionStorage.removeItem(this.storageKey());
    } catch {
      /* storage optional */
    }
    this.admission = undefined;
    this.state.room = undefined;
    this.state.pending = undefined;
    this.state.notice = undefined;
    this.state.status = "Disconnected";
    this.publish();
  }
}
