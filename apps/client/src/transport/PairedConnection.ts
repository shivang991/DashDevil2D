import { localName } from './localName';
import { RaceSession } from '@/game/RaceSession';
import { validateMessage } from '@dashdevil/contracts/validation';
import {
  decodeMessage, encodeMessage, decodeVerification, projectBaseline,
  type Outcome, type Admission, type Baseline, type Barrier, type Context, type Identity, type Messages, type RoomState, type RoomReply,
} from '@dashdevil/contracts/protocol';
import { FrameReader, crc32c } from '@dashdevil/contracts/wire';
import { BaselineTransfer } from '@dashdevil/contracts/transfer';

export interface PairedState {
  status: string; code: string; identity?: Identity; connectedSeats: number;
  verified: number; barriers: number; clockSamples: number; clockOffsetUs: number;
  context?: Context; outcome?: Outcome;
  diagnostics: { localInputs: number; remoteRecords: number; lastLocalInputUs?: number; lastRemoteReceiveUs?: number; outcomeReceivedUs?: number; resultDelayEstimateUs?: number; resultCommitDelayEstimateUs?: number; localInputToDrawUs?: number[]; remoteReceiveToDrawUs?: number[] };
  room?: RoomState; pending?: string; notice?: string; roundId?: number; startUs?: number; timeUs?: number; cars?: Baseline['cars']; seed?: number; positions: string; errors: string[]; baselineBytes: number; recoveryMs?: number;
}
export interface ConnectionOptions { server: string; certificateHash?: number[]; development?: boolean; diagnostic?: boolean }
const emptyState = (): PairedState => ({ status: 'Disconnected', diagnostics: { localInputs: 0, remoteRecords: 0 }, code: '', connectedSeats: 0, verified: 0, barriers: 0, clockSamples: 0, clockOffsetUs: 0, positions: '', errors: [], baselineBytes: 0 });
const nowUs = () => Math.round(performance.now() * 1000);
const token = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const sameIdentity = (a: Identity, b: Identity) => a.roomId === b.roomId && a.seat === b.seat && a.seatSession === b.seatSession && a.pairGeneration === b.pairGeneration;
const sameProgress = (a: Baseline['progress'], b: Baseline['progress']) => a.authority === b.authority && a.event === b.event && a.processed1 === b.processed1 && a.processed2 === b.processed2 && a.disposed1 === b.disposed1 && a.disposed2 === b.disposed2;

/** Authenticated paired transport shared by product rooms and the retained diagnostic. */
export class PairedConnection {
  state = emptyState();
  private readonly options: ConnectionOptions;
  private socket?: WebSocket;
  private gameplay?: WebTransport;
  private control?: WritableStreamDefaultWriter<Uint8Array>;
  private inputs?: WritableStreamDefaultWriter<Uint8Array>;
  private baseline?: Baseline;
  private race?: RaceSession;
  private heldMask = 0;
  private winningControl = 0;
  private lastDrawnLocalUs = 0;
  private lastDrawnRemoteUs = 0;
  private admission?: Admission;
  private context?: Context;
  private transfer?: BaselineTransfer;
  private generation = 0;
  private timers: ReturnType<typeof setInterval>[] = [];
  private lastUsable = 0;
  private inputSequence = 0;
  private clockSequence = 0;
  private clocks = new Map<number, number>();
  private samples: { rtt: number; offset: number }[] = [];
  private history = new Map<number, number>();
  private pending = new Map<number, ReturnType<typeof decodeVerification>>();
  private lastVerified = 0;
  private queuedBytes = 0;
  private queuedMessages = 0;
  private restoredAt = 0;
  private revision = 0;
  private roomSequence = 0;
  private terminal = false;
  private focused = true;
  private hidden = false;
  private timerStarted = false;
  private pendingCommands = new Map<number, { label: string; timeout: ReturnType<typeof setTimeout> }>();
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private recoverUntil = 0;
  private pulseSequence = 0;
  private initialRound?: number;
  private earlyChunks: Messages['BaselineChunk'][] = [];
  private recoveryOutstanding = false;
  private onChange: (state: PairedState) => void;
  constructor(options: ConnectionOptions, onChange: (state: PairedState) => void) {
    this.options = options; this.onChange = onChange;
    if (new URL(options.server).protocol !== 'https:') throw new Error('HTTPS server required');
    if (options.certificateHash && (!options.development || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(options.server).hostname))) throw new Error('Certificate fingerprints are development-only on loopback');
  }
  private storageKey() { return `dashdevil-seat:${this.options.server}`; }
  private credential(): Uint8Array {
    try { const value = sessionStorage.getItem(this.storageKey()); return value ? Uint8Array.from(atob(value), c => c.charCodeAt(0)) : this.admission?.credential ?? new Uint8Array(); } catch { return this.admission?.credential ?? new Uint8Array(); }
  }
  private publish() { this.onChange({ ...this.state, errors: [...this.state.errors] }); }
  private fail(error: unknown, generation: number) {
    if (generation !== this.generation || this.terminal) return;
    const detail = error instanceof Error ? error.message : String(error);
    this.state.errors.push(detail); if (this.state.errors.length > 32) this.state.errors.shift();
    this.teardown(); this.state.status = detail.includes('version') ? 'Version mismatch—reload' : `Unable to connect: ${detail}`; this.state.pending = undefined; this.publish();
    if (!this.options.diagnostic && this.admission && this.credential().length && !/expired|rejected|superseded|replaced|version/i.test(detail)) {
      if (!this.recoverUntil) this.recoverUntil = performance.now() + 15000;
      if (performance.now() < this.recoverUntil) this.recoveryTimer = setTimeout(() => void this.connect(2), 500);
    }
  }
  private teardown() {
    this.generation++; this.race = undefined; this.heldMask = 0; this.winningControl = 0;
    clearTimeout(this.recoveryTimer); this.pendingCommands.forEach(command => clearTimeout(command.timeout)); this.pendingCommands.clear(); this.timerStarted = false;
    this.timers.forEach(clearInterval); this.timers = [];
    this.socket?.close(); this.gameplay?.close(); this.socket = undefined; this.gameplay = undefined;
    this.control = undefined; this.inputs = undefined; this.transfer?.cancel(); this.transfer = undefined;
    this.earlyChunks = []; this.baseline = undefined; this.context = undefined; this.recoveryOutstanding = false; this.history.clear(); this.pending.clear(); this.clocks.clear(); this.samples = [];
    this.queuedBytes = 0; this.queuedMessages = 0;
  }
  async connect(operation: 0 | 1 | 2, code = '', mode: 1 | 2 = 1): Promise<void> {
    this.teardown(); this.terminal = false;
    const generation = this.generation;
    this.state = { ...emptyState(), code, errors: this.state.errors, pending: operation === 0 ? 'Creating room' : operation === 1 ? 'Joining room' : 'Recovering room' }; this.initialRound = undefined; this.pulseSequence = 0; this.publish();
    if (typeof globalThis.WebTransport !== 'function' || !('createUnidirectionalStream' in WebTransport.prototype) || !('datagrams' in WebTransport.prototype)) {
      this.state.pending = undefined; this.state.status = 'Browser unsupported'; this.publish(); return;
    }
    this.state.status = 'Connecting'; this.publish();
    try {
      const response = await fetch(`${this.options.server}/admission${operation === 0 && !this.options.diagnostic ? `?mode=${mode}` : ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, signal: AbortSignal.timeout(5000),
        body: encodeMessage('AdmissionRequest', { operation, version: 1, code, name: operation === 2 ? '' : localName(), credential: operation === 2 ? this.credential() : new Uint8Array() }) as Uint8Array<ArrayBuffer>,
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const message = decodeMessage(bytes);
      if (message.type === 'ProtocolError') throw new Error(message.value.detail);
      if (!response.ok || message.type !== 'Admission' || message.value.version !== 1 || message.value.origin !== location.origin) throw new Error('Admission rejected');
      if (generation !== this.generation) return;
      this.admission = message.value; this.state.identity = message.value.identity;
      this.state.code = response.headers.get('X-Room-Code') ?? code;
      try { sessionStorage.setItem(this.storageKey(), btoa(String.fromCharCode(...message.value.credential))); } catch { /* retain in memory */ }
      this.revision = 0; this.inputSequence = 0; this.clockSequence = 0; this.lastVerified = 0; this.roomSequence = 0; this.restoredAt = performance.now();
      this.openRoom(message.value, generation);
      const options: WebTransportOptions = this.options.certificateHash ? { serverCertificateHashes: [{ algorithm: 'sha-256', value: Uint8Array.from(this.options.certificateHash).buffer }] } : {};
      const gameplay = new WebTransport(`${this.options.server}/gameplay?ticket=${token(message.value.gameplayTicket)}`, options);
      this.gameplay = gameplay;
      void gameplay.closed.then(info => this.fail(new Error(info.reason || 'Gameplay channel lost'), generation), error => this.fail(new Error(`Gameplay channel failed: ${String(error).replace(/https?:\/\/\S+/g, '[endpoint]')}`), generation));
      await Promise.race([gameplay.ready, new Promise<never>((_, reject) => { const timeout = setTimeout(() => reject(new Error('WebTransport connection timed out')), 5000); void gameplay.ready.finally(() => clearTimeout(timeout)).catch(() => {}); })]);
      if (generation !== this.generation) { gameplay.close(); return; }
      if (gameplay.datagrams.maxDatagramSize < 10) throw new Error('Required datagram payload unavailable');
      const control = await gameplay.createBidirectionalStream(); this.control = control.writable.getWriter();
      void this.read(control.readable, 'control', generation).catch(error => this.fail(error, generation));
      void this.readAuthority(gameplay, generation).catch(error => this.fail(error, generation));
      void this.readDatagrams(gameplay, generation).catch(error => this.fail(error, generation));
      await this.send('Handshake', { version: 1, identity: message.value.identity, datagramBytes: gameplay.datagrams.maxDatagramSize }, generation);
      const watchdog = setInterval(() => {
        if (generation !== this.generation) return;
        if (this.lastUsable && performance.now() - this.lastUsable >= 1000) { this.state.status = 'Connection warning'; this.publish(); }
        if (!this.baseline && performance.now() - this.restoredAt >= 5000) this.fail(new Error('Initialization timed out'), generation);
      }, 100);
      this.timers.push(watchdog);
    } catch (error) { this.fail(error, generation); }
  }
  private openRoom(admission: Admission, generation: number) {
    const socket = new WebSocket(`${this.options.server.replace('https:', 'wss:')}/room?ticket=${token(admission.roomTicket)}`);
    socket.binaryType = 'arraybuffer'; this.socket = socket;
    socket.onclose = event => this.fail(new Error(event.reason || 'Room channel lost'), generation);
    socket.onerror = () => this.fail(new Error('Room channel failed'), generation);
    socket.onmessage = event => {
      if (generation !== this.generation) return;
      try {
        if (!(event.data instanceof ArrayBuffer)) throw new Error('Binary room frame required');
        const message = decodeMessage(new Uint8Array(event.data));
        if (message.type === 'ProtocolError') throw new Error(message.value.detail);
        if (message.type === 'RoomInitialization') {
          if (message.value.version !== 1 || !sameIdentity(message.value.identity, admission.identity)) throw new Error('Room initialization mismatch');
          socket.send(encodeMessage('RoomInitialization', message.value));
        } else if (message.type === 'RoomState') {
          if (!sameIdentity(message.value.identity, admission.identity)) throw new Error('Room state identity mismatch');
          if (message.value.revision < this.revision) return;
          this.revision = message.value.revision;
          const previous = this.state.room;
          this.state.room = message.value;
          if (previous?.phase !== message.value.phase && message.value.phase !== 3) this.releaseControls();
          if (previous?.phase === 1 && message.value.phase === 0) this.state.notice = 'Countdown cancelled. Both players must ready again.';
          this.state.connectedSeats = message.value.seats.filter(seat => seat.flags & 1).length;
          if ((message.value.seats[admission.identity.seat].flags & 1) && this.baseline) { this.state.status = 'Connected'; if (![...this.pendingCommands.values()].some(command => command.label !== 'Focus')) this.state.pending = undefined; this.recoverUntil = 0; this.state.recoveryMs = performance.now() - this.restoredAt; }
          this.publish();
          if (!this.options.diagnostic && this.state.status === 'Connected' && !((previous?.seats[admission.identity.seat]?.flags ?? 0) & 1)) this.focus(this.focused, this.hidden);
        } else if (message.type === 'RoomReply') { this.reply(message.value); } else throw new Error('Unexpected room message');
      } catch (error) { this.fail(error, generation); }
    };
  }
  private async send<K extends keyof Messages>(type: K, value: Messages[K], generation: number, input = false) {
    if (generation !== this.generation) return;
    const writer = input ? this.inputs : this.control;
    if (!writer) throw new Error('Reliable writer unavailable');
    const bytes = encodeMessage(type, value);
    if (this.queuedBytes + bytes.length > 262144 || this.queuedMessages >= 512) throw new Error('Reliable queue overflow');
    this.queuedBytes += bytes.length; this.queuedMessages++;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([writer.write(bytes), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Reliable write stalled')), 500); })]);
    } finally { clearTimeout(timeout); if (generation === this.generation) { this.queuedBytes -= bytes.length; this.queuedMessages--; } }
  }
  private async read(stream: ReadableStream<Uint8Array>, channel: 'control' | 'authority', generation: number) {
    const reader = stream.getReader(), frames = new FrameReader();
    try { for (;;) {
      const { value, done } = await reader.read();
      if (generation !== this.generation) return;
      if (done) { frames.finish(); throw new Error(`${channel} stream ended`); }
      for (const frame of frames.push(value)) await this.record(decodeMessage(frame), channel, generation);
    } } finally { reader.releaseLock(); }
  }
  private async readAuthority(gameplay: WebTransport, generation: number) {
    const reader = gameplay.incomingUnidirectionalStreams.getReader();
    try {
      const { value, done } = await reader.read(); if (done || !value) throw new Error('Authority stream unavailable');
      const reading = this.read(value, 'authority', generation);
      void reader.read().then(extra => { if (!extra.done) this.fail(new Error('Unexpected extra authority stream'), generation); }).catch(error => this.fail(error, generation));
      await reading;
    } finally { reader.releaseLock(); }
  }
  private async record(message: ReturnType<typeof decodeMessage>, channel: string, generation: number) {
    if (!this.admission || generation !== this.generation || this.terminal) return;
    const identity = this.admission.identity;
    if (message.type === 'ProtocolError') throw new Error(message.value.detail);
    if ('identity' in message.value && !sameIdentity(message.value.identity, identity)) throw new Error('Reliable identity mismatch');
    switch (message.type) {
      case 'Handshake':
        if (channel !== 'control' || message.value.version !== 1 || message.value.datagramBytes !== 10) throw new Error('Gameplay handshake rejected');
        break;
      case 'Initialization': {
        if (channel !== 'control' || this.options.diagnostic && this.context) throw new Error('Unexpected initialization');
        if (this.initialRound !== undefined && message.value.round.roundId <= this.initialRound) throw new Error('Stale round initialization');
        this.initialRound = message.value.round.roundId;
        this.context = message.value.context; this.state.context = this.context;
        this.race = undefined; this.heldMask = 0; this.winningControl = 0;
        if (this.state.outcome && message.value.round.roundId > this.state.outcome.roundId) this.state.outcome = undefined; this.transfer?.cancel(); this.transfer = new BaselineTransfer(this.context, 1048576);
        this.baseline = undefined; this.inputSequence = 0;
        if (!this.inputs) { const inputs = await this.gameplay!.createUnidirectionalStream(); this.inputs = inputs.getWriter(); }
        await this.send('Input', { identity, round: message.value.round, sequence: ++this.inputSequence, intent: 2, control: 0, heldMask: 0 }, generation, true);
        const waiting = this.earlyChunks; this.earlyChunks = [];
        for (const chunk of waiting) await this.record({ type: 'BaselineChunk', value: chunk }, 'authority', generation);
        break;
      }
      case 'BaselineChunk': {
        if (channel !== 'authority') throw new Error('Baseline on wrong stream');
        if (!this.options.diagnostic && (!this.context || message.value.round.roundId > (this.initialRound ?? 0))) {
          if (this.earlyChunks.reduce((n, chunk) => n + chunk.data.length, 0) + message.value.data.length > 1048576 || this.earlyChunks.length >= 64) throw new Error('Early baseline queue overflow');
          this.earlyChunks.push(message.value); break;
        }
        if (!this.context) throw new Error('Baseline before initialization');
        if (!this.transfer) {
          if (!this.recoveryOutstanding || !this.baseline || message.value.epoch <= this.baseline.epoch) throw new Error('Unexpected baseline transfer');
          this.transfer = new BaselineTransfer(this.context, 1048576);
        }
        const wasInitialized = this.timerStarted;
        const baseline = this.transfer.accept(message.value); this.state.baselineBytes += message.value.data.length;
        if (!baseline) break;
        this.baseline = baseline; this.transfer = undefined; this.recoveryOutstanding = false; this.history.clear(); this.pending.clear(); this.lastVerified = 0; this.lastUsable = performance.now();
        this.state.positions = baseline.cars.map(car => car.progress).join(', ');
        this.state.roundId = baseline.round.roundId; this.state.startUs = baseline.context.startUs;
        this.state.timeUs = baseline.timeUs; this.state.cars = baseline.cars; this.state.seed = baseline.context.seed;
        if (!this.options.diagnostic) {
          if (this.race) this.race.install(baseline); else this.race = new RaceSession(baseline);
          if (this.state.outcome?.roundId === baseline.round.roundId) { this.race.finish(this.state.outcome); this.state.timeUs = this.state.outcome.timeUs;
            this.state.cars = baseline.cars.map((car, seat) => ({ ...car, ...this.state.outcome!.cars[seat] })); this.state.positions = this.state.outcome.cars.map(car => car.progress).join(', '); }
        }
        await this.send('Ready', { identity, round: baseline.round, transferId: message.value.transferId, epoch: baseline.epoch, progress: baseline.progress }, generation);
        if (this.state.outcome) await this.ackOutcome(generation);
        if (!wasInitialized) { this.startTimers(generation); this.timerStarted = true; }
        if (!this.options.diagnostic) this.focus(this.focused, this.hidden);
        this.publish(); break;
      }
      case 'RoomPulse': {
        if (channel !== 'authority' || this.options.diagnostic || !this.baseline || message.value.round.roundId !== this.baseline.round.roundId) break;
        if (message.value.sequence <= this.pulseSequence) throw new Error('Stale room pulse');
        this.pulseSequence = message.value.sequence; if (this.state.room?.phase !== 2) this.lastUsable = performance.now();
        if (this.state.status === 'Connection warning') this.state.status = 'Connected';
        await this.send('RoomPulse', message.value, generation); this.publish(); break;
      }
      case 'Disposition': {
        if (this.state.outcome) break;
        if (channel !== 'authority' || !this.baseline || message.value.round.roundId !== this.baseline.round.roundId || message.value.round.inputGeneration !== this.baseline.round.inputGeneration) throw new Error('Disposition context mismatch');
        const value = message.value;
        if (!this.options.diagnostic && this.race) {
          validateMessage('Disposition', value, this.context!);
          if (value.authority <= this.baseline.progress.authority) break;
          if (value.authority !== this.baseline.progress.authority + 1) throw new Error('Authority sequence gap');
          this.race.disposition(value); this.baseline = this.race.snapshot();
          this.lastUsable = performance.now();
          if (value.seat !== identity.seat) { this.state.diagnostics.remoteRecords++; this.state.diagnostics.lastRemoteReceiveUs = nowUs(); }
          break;
        }
        if (value.authority !== this.baseline.progress.authority + 1 || value.disposition !== 1 || value.intent !== 2) throw new Error('Unexpected diagnostic disposition');
        this.baseline.cars[value.seat] = value.car; this.baseline.contact = value.contact;
        this.baseline.progress.authority = value.authority;
        if (value.seat === 0) { this.baseline.progress.processed1 = value.processed; this.baseline.progress.disposed1 = value.processed; }
        else { this.baseline.progress.processed2 = value.processed; this.baseline.progress.disposed2 = value.processed; }
        break;
      }
      case 'Event': {
        if (channel !== 'authority' || !this.race || !this.baseline || message.value.round.roundId !== this.baseline.round.roundId) throw new Error('Event context mismatch');
        if (this.state.outcome) break;
        validateMessage('Event', message.value, this.context!);
        if (message.value.authority <= this.baseline.progress.authority) break;
        if (message.value.authority !== this.baseline.progress.authority + 1) throw new Error('Authority event gap');
        this.race.event(message.value); this.baseline = this.race.snapshot(); this.lastUsable = performance.now(); break;
      }
      case 'Coverage': {
        if (channel !== 'authority' || !this.race || !this.baseline || message.value.round.roundId !== this.baseline.round.roundId) throw new Error('Coverage context mismatch');
        if (this.state.outcome) break;
        validateMessage('Coverage', message.value, this.context!);
        if (!sameProgress(message.value.progress, this.baseline.progress)) throw new Error('Coverage history unavailable');
        this.race.coverage(message.value); this.baseline = this.race.snapshot(); break;
      }
      case 'Outcome': {
        if (channel !== 'control' || !this.context || message.value.roundId !== this.initialRound) throw new Error('Outcome context mismatch');
        if (this.state.outcome) break;
        validateMessage('Outcome', message.value, this.context);
        this.state.outcome = structuredClone(message.value); this.race?.finish(message.value);
        this.heldMask = 0; this.winningControl = 0;
        this.state.timeUs = message.value.timeUs;
        this.state.cars = message.value.cars.map((car, seat) => ({ ...this.baseline?.cars[seat], ...car })) as Baseline['cars'];
        this.state.positions = message.value.cars.map(car => car.progress).join(', ');
        this.state.diagnostics.outcomeReceivedUs = nowUs();
        this.state.diagnostics.resultDelayEstimateUs = nowUs() + this.state.clockOffsetUs - this.context.startUs - message.value.timeUs;
        this.publish(); await this.ackOutcome(generation); break;
      }
      case 'Barrier':
        if (channel !== 'authority') throw new Error('Barrier on wrong stream');
        await this.barrier(message.value, generation); break;
      case 'ClockReply': {
        if (channel !== 'control') throw new Error('Clock on wrong stream');
        const reply = message.value, sent = this.clocks.get(reply.sequence); this.clocks.delete(reply.sequence);
        const received = nowUs(), rtt = sent === undefined ? -1 : (received - sent) - (reply.serverSendUs - reply.serverReceiveUs);
        if (sent !== reply.clientSendUs || rtt < 0 || reply.serverSendUs < reply.serverReceiveUs) throw new Error('Invalid clock exchange');
        const offset = ((reply.serverReceiveUs - sent) + (reply.serverSendUs - received)) / 2;
        this.samples.push({ rtt, offset }); if (this.samples.length > 8) this.samples.shift();
        const best = this.samples.reduce((a, b) => a.rtt < b.rtt ? a : b);
        this.state.clockOffsetUs = this.state.clockSamples ? this.state.clockOffsetUs + (best.offset - this.state.clockOffsetUs) / 8 : best.offset;
        this.state.clockSamples++; this.publish(); break;
      }
      default: throw new Error(`Unexpected ${channel} record: ${message.type}`);
    }
  }
  private async ackOutcome(generation: number) {
    const outcome = this.state.outcome, baseline = this.baseline;
    if (outcome && baseline && !this.recoveryOutstanding && !this.transfer && outcome.roundId === baseline.round.roundId) await this.send('AuthorityAck', { identity: baseline.identity, round: baseline.round, epoch: baseline.epoch, tick: outcome.tick, progress: outcome.progress }, generation);
  }
  private startTimers(generation: number) {
    this.timers.push(setInterval(() => {
      if (!this.baseline || generation !== this.generation || this.state.outcome) return;
      if (this.inputSequence >= 0xffffffff) { this.fail(new Error('Input counter exhausted'), generation); return; }
      const input = { identity: this.admission!.identity, round: this.baseline.round, sequence: ++this.inputSequence, intent: 2, control: this.winningControl, heldMask: this.heldMask };
      if (this.race && (this.state.room?.phase === 2 || this.state.room?.phase === 3)) this.race.input(input, this.estimatedRoundUs());
      void this.send('Input', input, generation, true).catch(e => this.fail(e, generation));
    }, 250));
    const clock = () => {
      if (generation !== this.generation) return;
      if (this.clocks.size >= 8 || this.clockSequence >= 0xffffffff) { this.fail(new Error('Clock progress exhausted'), generation); return; }
      const sequence = ++this.clockSequence, clientSendUs = nowUs(); this.clocks.set(sequence, clientSendUs);
      void this.send('ClockRequest', { sequence, clientSendUs }, generation).catch(e => this.fail(e, generation));
    };
    clock(); this.timers.push(setInterval(clock, 1000));
  }
  private async barrier(value: Barrier, generation: number) {
    if (this.state.outcome) return;
    if (this.race) this.baseline = this.race.advanceAuthority(value.tick);
    const b = this.baseline;
    if (!b || value.epoch !== b.epoch || value.round.roundId !== b.round.roundId || value.round.inputGeneration !== b.round.inputGeneration || (this.options.diagnostic ? value.tick <= b.tick : value.tick < b.tick) || !sameProgress(value.progress, b.progress)) throw new Error('Authority history unavailable');
    b.tick = value.tick; b.timeUs = value.timeUs;
    this.state.timeUs = b.timeUs; this.state.cars = structuredClone(b.cars); this.state.positions = b.cars.map(c => c.progress).join(', ');
    this.history.set(value.tick, crc32c(projectBaseline(b)));
    while (this.history.size > 20) this.history.delete(this.history.keys().next().value!);
    this.lastUsable = performance.now(); this.state.barriers++;
    if (this.state.status === 'Connection warning') this.state.status = 'Connected';
    await this.send('AuthorityAck', { identity: b.identity, round: b.round, epoch: b.epoch, tick: b.tick, progress: b.progress }, generation);
    this.comparePending(); this.publish();
  }
  private async readDatagrams(gameplay: WebTransport, generation: number) {
    const reader = gameplay.datagrams.readable.getReader();
    try { for (;;) {
      const { done, value } = await reader.read(); if (done || generation !== this.generation) return;
      if (value.length !== 10) continue;
      const verification = decodeVerification(value);
      if (!this.baseline || verification.epoch !== this.baseline.epoch || verification.tick <= this.lastVerified) continue;
      this.pending.set(verification.tick, verification);
      while (this.pending.size > 20) this.pending.delete(this.pending.keys().next().value!);
      this.comparePending(); this.publish();
    } } finally { reader.releaseLock(); }
  }
  private comparePending() {
    for (const [tick, value] of this.pending) {
      const expected = this.history.get(tick);
      if (expected === undefined) { if (this.baseline && tick < this.baseline.tick - 20) this.pending.delete(tick); continue; }
      this.pending.delete(tick);
      if (tick <= this.lastVerified) continue;
      if (value.crc !== expected) { this.requestBaseline(); continue; }
      this.lastVerified = tick; this.state.verified++;
    }
  }
  requestBaseline() {
    const baseline = this.baseline;
    if (!baseline || this.recoveryOutstanding) return;
    this.recoveryOutstanding = true;
    const generation = this.generation;
    void this.send('Recovery', { identity: baseline.identity, round: baseline.round, reason: 0, epoch: baseline.epoch, tick: baseline.tick, progress: baseline.progress }, generation).catch(error => this.fail(error, generation));
  }
  private estimatedRoundUs() { return Math.max(0, nowUs() + this.state.clockOffsetUs - (this.context?.startUs ?? nowUs())); }
  recordDraw() {
    const d = this.state.diagnostics;
    if (d.lastLocalInputUs && d.lastLocalInputUs > this.lastDrawnLocalUs) { this.lastDrawnLocalUs = d.lastLocalInputUs; (d.localInputToDrawUs ??= []).push(nowUs() - d.lastLocalInputUs); if (d.localInputToDrawUs.length > 200) d.localInputToDrawUs.shift(); }
    if (d.lastRemoteReceiveUs && d.lastRemoteReceiveUs > this.lastDrawnRemoteUs) { this.lastDrawnRemoteUs = d.lastRemoteReceiveUs; (d.remoteReceiveToDrawUs ??= []).push(nowUs() - d.lastRemoteReceiveUs); if (d.remoteReceiveToDrawUs.length > 200) d.remoteReceiveToDrawUs.shift(); }
  }
  recordResultCommit() {
    if (this.state.outcome && this.context && this.state.diagnostics.resultCommitDelayEstimateUs === undefined) this.state.diagnostics.resultCommitDelayEstimateUs = nowUs() + this.state.clockOffsetUs - this.context.startUs - this.state.outcome.timeUs;
  }
  frame() { return this.race?.frame(this.estimatedRoundUs(), (performance.now() - this.lastUsable) * 1000); }
  input(intent: 0 | 1, control: number) {
    if (!this.baseline || !this.admission || !this.race || (this.state.room?.phase !== 2 && this.state.room?.phase !== 3) || this.state.status !== 'Connected' || this.state.outcome || !this.focused || this.hidden) return;
    const mask = 1 << (control - 1);
    if (intent === 0) { if (this.heldMask & mask) return; this.heldMask |= mask; this.winningControl = control; }
    else { this.heldMask &= ~mask; if (this.winningControl === control) this.winningControl = 0; }
    const input = { identity: this.admission.identity, round: this.baseline.round, sequence: ++this.inputSequence, intent, control, heldMask: this.heldMask };
    this.race.input(input, this.estimatedRoundUs());
    this.state.diagnostics.localInputs++; this.state.diagnostics.lastLocalInputUs = nowUs();
    const generation = this.generation; void this.send('Input', input, generation, true).catch(e => this.fail(e, generation));
  }
  releaseControls() {
    const hadInput = this.heldMask !== 0; this.heldMask = 0; this.winningControl = 0;
    if (!hadInput || !this.baseline || !this.admission || !this.inputs || this.state.outcome) return;
    const input = { identity: this.admission.identity, round: this.baseline.round, sequence: ++this.inputSequence, intent: 1, control: 0, heldMask: 0 };
    this.race?.input(input, this.estimatedRoundUs());
    const generation = this.generation; void this.send('Input', input, generation, true).catch(e => this.fail(e, generation));
  }
  get hasCredential() { return this.credential().length === 32; }
  focus(focused: boolean, hidden: boolean) {
    if (!focused || hidden) this.releaseControls();
    this.focused = focused; this.hidden = hidden;
    if (!this.options.diagnostic && this.state.status === 'Connected') this.command(4, hidden ? 0 : 1, focused && !hidden ? 1 : 0, 'Focus');
  }
  command(command: 0 | 1 | 2 | 3 | 4, mode = 1, ready = 0, label = 'Updating room') {
    if (!this.admission || this.socket?.readyState !== WebSocket.OPEN) return;
    if (command !== 4 && this.state.pending) return;
    if (this.roomSequence >= 0xffffffff) { this.fail(new Error('Room counter exhausted'), this.generation); return; }
    const sequence = ++this.roomSequence;
    const generation = this.generation;
    const timeout = setTimeout(() => this.fail(new Error('Room confirmation timed out'), generation), 5000);
    this.pendingCommands.set(sequence, { label, timeout });
    if (command !== 4) this.state.pending = label;
    this.socket.send(encodeMessage('RoomCommand', { identity: this.admission.identity, sequence, revision: this.revision, command, mode, ready }));
    this.publish();
  }
  private reply(value: RoomReply) {
    if (!this.admission || !sameIdentity(value.identity, this.admission.identity)) throw new Error('Room reply identity mismatch');
    const pending = this.pendingCommands.get(value.sequence); if (!pending) return;
    clearTimeout(pending.timeout); this.pendingCommands.delete(value.sequence);
    if (pending.label !== 'Focus') this.state.pending = undefined;
    if (!value.accepted) this.state.notice = value.detail;
    else if (pending.label !== 'Focus') this.state.notice = undefined;
    this.publish();
  }
  dispose() { this.terminal = true; this.teardown(); }
  drop(channel: 'room' | 'gameplay') { if (channel === 'room') this.socket?.close(); else this.gameplay?.close(); }
  leave() {
    if (this.socket?.readyState === WebSocket.OPEN && this.admission) this.socket.send(encodeMessage('RoomCommand', { identity: this.admission.identity, sequence: ++this.roomSequence, revision: this.revision, command: 3, mode: 1, ready: 0 }));
    this.terminal = true; this.teardown();
    try { sessionStorage.removeItem(this.storageKey()); } catch { /* storage optional */ }
    this.admission = undefined; this.state.room = undefined; this.state.pending = undefined; this.state.notice = undefined; this.state.status = 'Disconnected'; this.publish();
  }
}
