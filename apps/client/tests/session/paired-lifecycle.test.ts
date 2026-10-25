import { afterEach, expect, test, vi } from "vitest";
import { PairedConnection } from "../../src/transport/PairedConnection";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext, initialBaseline } from "@dashdevil/contracts/validation";
import { crc32c } from "@dashdevil/contracts/wire";
import {
  encodeBaseline,
  encodeVerification,
  projectBaseline,
  decodeMessage,
  encodeMessage,
  protocolVersion,
  type Admission,
  type RoomState,
} from "@dashdevil/contracts/protocol";

const identity = { roomId: 1, seatSession: 2, pairGeneration: 1, seat: 0 };
class RoomSocket {
  static OPEN = 1;
  static latest: RoomSocket;
  readyState = 1;
  binaryType = "";
  bufferedAmount = 0;
  onmessage?: (event: { data: ArrayBuffer }) => void;
  onclose?: (event: { reason: string }) => void;
  constructor() {
    RoomSocket.latest = this;
  }
  send() {}
  close() {}
}
class Gameplay {
  static instances: Gameplay[] = [];
  control!: ReadableStreamDefaultController<Uint8Array>;
  authority!: ReadableStreamDefaultController<ReadableStream<Uint8Array>>;
  verification!: ReadableStreamDefaultController<Uint8Array>;
  controlWrite?: (bytes: Uint8Array) => void | Promise<void>;
  verificationStream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      this.verification = controller;
    },
  });
  inputStream?: Promise<WritableStream<Uint8Array>>;
  inputWrites: Uint8Array[] = [];
  inputCalls = 0;
  constructor() {
    Gameplay.instances.push(this);
  }
  ready = Promise.resolve();
  closed = new Promise<never>(() => {});
  incomingUnidirectionalStreams = new ReadableStream<ReadableStream<Uint8Array>>({
    start: (controller) => {
      this.authority = controller;
    },
  });
  get datagrams() {
    return { maxDatagramSize: 1200, readable: this.verificationStream };
  }
  createBidirectionalStream() {
    return Promise.resolve({
      readable: new ReadableStream<Uint8Array>({
        start: (controller) => {
          this.control = controller;
        },
      }),
      writable: new WritableStream<Uint8Array>({ write: (bytes) => this.controlWrite?.(bytes) }),
    });
  }
  createUnidirectionalStream() {
    this.inputCalls++;
    return (
      this.inputStream ??
      Promise.resolve(
        new WritableStream<Uint8Array>({
          write: (bytes) => {
            this.inputWrites.push(bytes);
          },
        }),
      )
    );
  }
  close() {}
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
  Gameplay.instances = [];
});

test("an essential room command fails the pair when the browser room queue is full", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", RoomSocket);
  vi.stubGlobal("WebTransport", Gameplay);
  const admission: Admission = {
    version: protocolVersion,
    identity,
    credential: new Uint8Array(32).fill(1),
    roomTicket: new Uint8Array(32).fill(2),
    gameplayTicket: new Uint8Array(32).fill(3),
    expiresUs: 10000000,
    origin: location.origin,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(encodeMessage("Admission", admission) as Uint8Array<ArrayBuffer>, {
          status: 201,
        }),
    ),
  );
  const client = new PairedConnection(
    { server: "https://localhost:8443", diagnostic: true },
    () => {},
  );
  try {
    await client.connect(0);
    RoomSocket.latest.bufferedAmount = 262144;
    client.command(4, 1, 1, "Focus");
    expect(client.state.errors).toContain("Reliable room queue overflow");
    expect(client.state.status).toContain("Unable to connect");
    expect(client.state.pending).toBeUndefined();
  } finally {
    client.dispose();
  }
});

test("a buffered essential room command fails within its queue-wait deadline", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", RoomSocket);
  vi.stubGlobal("WebTransport", Gameplay);
  const admission: Admission = {
    version: protocolVersion,
    identity,
    credential: new Uint8Array(32).fill(1),
    roomTicket: new Uint8Array(32).fill(2),
    gameplayTicket: new Uint8Array(32).fill(3),
    expiresUs: 10000000,
    origin: location.origin,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(encodeMessage("Admission", admission) as Uint8Array<ArrayBuffer>, {
          status: 201,
        }),
    ),
  );
  const client = new PairedConnection(
    { server: "https://localhost:8443", diagnostic: true },
    () => {},
  );
  try {
    await client.connect(0);
    RoomSocket.latest.bufferedAmount = 32;
    client.command(4, 1, 1, "Focus");
    await vi.advanceTimersByTimeAsync(600);
    expect(client.state.errors).toContain("Reliable room write stalled");
  } finally {
    client.dispose();
  }
});

test("expired authority clears the unusable room and credential without inventing a result; old callbacks cannot affect a new admission", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", RoomSocket);
  vi.stubGlobal("WebTransport", Gameplay);
  const admission: Admission = {
    version: protocolVersion,
    identity,
    credential: new Uint8Array(32).fill(1),
    roomTicket: new Uint8Array(32).fill(2),
    gameplayTicket: new Uint8Array(32).fill(3),
    expiresUs: 10000000,
    origin: location.origin,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(encodeMessage("Admission", admission) as Uint8Array<ArrayBuffer>, {
          status: 201,
          headers: { "X-Room-Code": "0042" },
        }),
    ),
  );
  const client = new PairedConnection({ server: "https://localhost:8443" }, () => {});
  try {
    await client.connect(0);
    const old = RoomSocket.latest;
    const room: RoomState = {
      identity,
      revision: 1,
      mode: 1,
      phase: 0,
      host: 0,
      seats: [
        { session: 2, name: "Driver", flags: 1, reservationUs: 0 },
        { session: 0, name: "", flags: 0, reservationUs: 0 },
      ],
      roundId: 1,
      startUs: 0,
      idleWarningUs: 1000000,
      idleExpiryUs: 2000000,
    };
    const wire = encodeMessage("RoomState", room);
    old.onmessage?.({ data: wire.slice().buffer as ArrayBuffer });
    expect(client.state.room?.identity).toEqual(identity);
    old.onclose?.({ reason: "Room expired" });
    expect(client.state.status).toContain("Room expired");
    expect(client.state.room).toBeUndefined();
    expect(client.state.outcome).toBeUndefined();
    expect(client.hasCredential).toBe(false);
    await client.connect(0);
    old.onclose?.({ reason: "superseded" });
    old.onmessage?.({ data: wire.slice().buffer as ArrayBuffer });
    expect(client.state.status).toBe("Connecting");
    expect(client.state.room).toBeUndefined();
    expect(client.hasCredential).toBe(true);
  } finally {
    client.dispose();
  }
});

test("a delayed input stream from a superseded pair cannot capture inputs for the current pair", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", RoomSocket);
  vi.stubGlobal("WebTransport", Gameplay);
  const admission: Admission = {
    version: protocolVersion,
    identity,
    credential: new Uint8Array(32).fill(1),
    roomTicket: new Uint8Array(32).fill(2),
    gameplayTicket: new Uint8Array(32).fill(3),
    expiresUs: 10000000,
    origin: location.origin,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(encodeMessage("Admission", admission) as Uint8Array<ArrayBuffer>, {
          status: 201,
        }),
    ),
  );
  const client = new PairedConnection({ server: "https://localhost:8443" }, () => {});
  let resolveOld!: (stream: WritableStream<Uint8Array>) => void;
  const oldWrites: Uint8Array[] = [];
  const context = configurationContext(captureConfiguration("drag-race"), 1, 1000000);
  const initialize = (gameplay: Gameplay, roundId: number) =>
    gameplay.control.enqueue(
      encodeMessage("Initialization", {
        identity,
        round: { roundId, inputGeneration: roundId },
        context,
      }),
    );
  try {
    await client.connect(0);
    const old = Gameplay.instances[0];
    old.inputStream = new Promise((resolve) => {
      resolveOld = resolve;
    });
    initialize(old, 1);
    await vi.waitFor(() => expect(old.inputCalls).toBe(1));
    await client.connect(2);
    const current = Gameplay.instances[1];
    initialize(current, 1);
    await vi.waitFor(() => expect(current.inputWrites).toHaveLength(1));
    resolveOld(
      new WritableStream<Uint8Array>({
        write: (bytes) => {
          oldWrites.push(bytes);
        },
      }),
    );
    // Drain the superseded stream's promise continuation before a new round uses
    // the current input channel. No private client state is inspected.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    initialize(current, 2);
    await vi.waitFor(() => expect(current.inputWrites).toHaveLength(2));
    expect(oldWrites).toHaveLength(0);
  } finally {
    client.dispose();
  }
});

test("verified diagnostics count successful comparisons across recovery epochs, including before a delayed acknowledgement", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", RoomSocket);
  vi.stubGlobal("WebTransport", Gameplay);
  const admission: Admission = {
    version: protocolVersion,
    identity,
    credential: new Uint8Array(32).fill(1),
    roomTicket: new Uint8Array(32).fill(2),
    gameplayTicket: new Uint8Array(32).fill(3),
    expiresUs: 10000000,
    origin: location.origin,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(encodeMessage("Admission", admission) as Uint8Array<ArrayBuffer>, {
          status: 201,
        }),
    ),
  );
  const client = new PairedConnection(
    { server: "https://localhost:8443", diagnostic: true },
    () => {},
  );
  let releaseAck!: () => void;
  try {
    await client.connect(0);
    const gameplay = Gameplay.instances[0];
    let authority!: ReadableStreamDefaultController<Uint8Array>;
    gameplay.authority.enqueue(
      new ReadableStream<Uint8Array>({
        start: (controller) => {
          authority = controller;
        },
      }),
    );
    const baseline = initialBaseline(
      configurationContext(captureConfiguration("drag-race"), 1, 1000000),
    );
    baseline.identity = identity;
    baseline.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
    gameplay.control.enqueue(
      encodeMessage("Initialization", {
        identity,
        round: baseline.round,
        context: baseline.context,
      }),
    );
    await vi.waitFor(() => expect(gameplay.inputCalls).toBe(1));
    const install = (epoch: number) => {
      baseline.epoch = epoch;
      const data = encodeBaseline(baseline);
      authority.enqueue(
        encodeMessage("BaselineChunk", {
          identity,
          round: baseline.round,
          transferId: epoch,
          epoch,
          tick: baseline.tick,
          progress: baseline.progress,
          total: data.length,
          offset: 0,
          index: 0,
          count: 1,
          data,
        }),
      );
    };
    install(1);
    await vi.waitFor(() =>
      expect(client.state.diagnostics.baselineEpochs, JSON.stringify(client.state.errors)).toEqual([
        1,
      ]),
    );
    const barrier = {
      identity,
      round: baseline.round,
      epoch: 1,
      tick: 1,
      timeUs: 16667,
      progress: baseline.progress,
    };
    const crc = crc32c(projectBaseline({ ...baseline, tick: 1, timeUs: 16667 }));
    let blocked = false;
    gameplay.controlWrite = (bytes) => {
      if (decodeMessage(bytes).type === "AuthorityAck" && !blocked) {
        blocked = true;
        return new Promise((resolve) => {
          releaseAck = resolve;
        });
      }
    };
    gameplay.verification.enqueue(encodeVerification({ epoch: 1, tick: 1, crc }));
    authority.enqueue(encodeMessage("Barrier", barrier));
    await vi.waitFor(() => expect(blocked).toBe(true));
    expect(client.state.verified).toBe(1);
    releaseAck();
    gameplay.controlWrite = undefined;
    client.requestBaseline();
    baseline.tick = 1;
    baseline.timeUs = 16667;
    install(2);
    await vi.waitFor(() => expect(client.state.diagnostics.baselineEpochs).toEqual([1, 2]));
    authority.enqueue(encodeMessage("Barrier", { ...barrier, epoch: 2, tick: 2, timeUs: 33333 }));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(client.state.verified).toBe(1);
    const crc2 = crc32c(projectBaseline({ ...baseline, tick: 2, timeUs: 33333 }));
    gameplay.verification.enqueue(encodeVerification({ epoch: 2, tick: 2, crc: crc2 }));
    await vi.waitFor(() => expect(client.state.verified).toBe(2));
    gameplay.verification.enqueue(encodeVerification({ epoch: 2, tick: 2, crc: crc2 }));
    gameplay.verification.enqueue(encodeVerification({ epoch: 1, tick: 2, crc }));
    authority.enqueue(encodeMessage("Barrier", { ...barrier, epoch: 2, tick: 3, timeUs: 50000 }));
    const crc3 = crc32c(projectBaseline({ ...baseline, tick: 3, timeUs: 50000 }));
    gameplay.verification.enqueue(encodeVerification({ epoch: 2, tick: 3, crc: (crc3 ^ 1) >>> 0 }));
    await vi.advanceTimersByTimeAsync(1000 / baseline.context.connection.recoveryRequestRate + 10);
    await vi.waitFor(() => expect(client.state.diagnostics.recoveryRequests).toBe(2));
    expect(client.state.verified).toBe(2);
  } finally {
    releaseAck?.();
    client.dispose();
  }
});

test("a remote generation reset rebases its input watermarks before following coverage", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", RoomSocket);
  vi.stubGlobal("WebTransport", Gameplay);
  const admission: Admission = {
    version: protocolVersion,
    identity,
    credential: new Uint8Array(32).fill(1),
    roomTicket: new Uint8Array(32).fill(2),
    gameplayTicket: new Uint8Array(32).fill(3),
    expiresUs: 10000000,
    origin: location.origin,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(encodeMessage("Admission", admission) as Uint8Array<ArrayBuffer>, {
          status: 201,
        }),
    ),
  );
  const client = new PairedConnection({ server: "https://localhost:8443" }, () => {});
  try {
    await client.connect(0);
    const gameplay = Gameplay.instances[0];
    let authority!: ReadableStreamDefaultController<Uint8Array>;
    gameplay.authority.enqueue(
      new ReadableStream<Uint8Array>({
        start: (controller) => {
          authority = controller;
        },
      }),
    );
    const baseline = initialBaseline(
      configurationContext(captureConfiguration("drag-race"), 1, 1000000),
    );
    baseline.identity = identity;
    baseline.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
    baseline.progress = {
      authority: 10,
      event: 1,
      processed1: 3,
      disposed1: 3,
      processed2: 7,
      disposed2: 7,
    };
    baseline.cars[0].lastInput = 3;
    baseline.cars[1].lastInput = 7;
    gameplay.control.enqueue(
      encodeMessage("Initialization", {
        identity,
        round: baseline.round,
        context: baseline.context,
      }),
    );
    await vi.waitFor(() => expect(gameplay.inputCalls).toBe(1));
    const data = encodeBaseline(baseline);
    authority.enqueue(
      encodeMessage("BaselineChunk", {
        identity,
        round: baseline.round,
        transferId: 1,
        epoch: 1,
        tick: 0,
        progress: baseline.progress,
        total: data.length,
        offset: 0,
        index: 0,
        count: 1,
        data,
      }),
    );
    await vi.waitFor(() =>
      expect(client.state.diagnostics.baselineEpochs, JSON.stringify(client.state.errors)).toEqual([
        1,
      ]),
    );
    const cars = structuredClone(baseline.cars);
    cars[1].inputGeneration = 2;
    cars[1].lastInput = 0;
    authority.enqueue(
      encodeMessage("Event", {
        identity,
        round: baseline.round,
        authority: 11,
        eventId: 2,
        tick: 0,
        timeUs: 0,
        kind: 7,
        causeInput: 0,
        objectId: 0,
        episodeId: 0,
        seatMask: 2,
        cars,
        contact: baseline.contact,
        objects: [],
      }),
    );
    await vi.waitFor(() => expect(client.frame()?.cars[1].inputGeneration).toBe(2));
    const progress = {
      authority: 11,
      event: 2,
      processed1: 3,
      disposed1: 3,
      processed2: 0,
      disposed2: 0,
    };
    authority.enqueue(
      encodeMessage("Coverage", {
        identity,
        round: baseline.round,
        authority: 11,
        tick: 0,
        timeUs: 0,
        progress,
        generator: baseline.generator,
        windows: baseline.windows,
      }),
    );
    authority.enqueue(
      encodeMessage("Barrier", {
        identity,
        round: baseline.round,
        epoch: 1,
        tick: 0,
        timeUs: 0,
        progress,
      }),
    );
    await vi.waitFor(() =>
      expect(client.state.barriers > 0 || client.state.errors.length > 0).toBe(true),
    );
    expect(client.state.errors).toEqual([]);
    expect(client.state.barriers).toBe(1);
    expect(client.state.diagnostics.recoveryRequests ?? 0).toBe(0);
  } finally {
    client.dispose();
  }
});

test("stalled authoritative progress retains the seat credential for paired recovery", async () => {
  vi.useFakeTimers();
  await vi.advanceTimersByTimeAsync(1);
  vi.stubGlobal("WebSocket", RoomSocket);
  vi.stubGlobal("WebTransport", Gameplay);
  const admission: Admission = {
    version: protocolVersion,
    identity,
    credential: new Uint8Array(32).fill(1),
    roomTicket: new Uint8Array(32).fill(2),
    gameplayTicket: new Uint8Array(32).fill(3),
    expiresUs: 10000000,
    origin: location.origin,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(encodeMessage("Admission", admission) as Uint8Array<ArrayBuffer>, {
          status: 201,
        }),
    ),
  );
  const client = new PairedConnection({ server: "https://localhost:8443" }, () => {});
  try {
    await client.connect(0);
    const gameplay = Gameplay.instances[0];
    let authority!: ReadableStreamDefaultController<Uint8Array>;
    gameplay.authority.enqueue(
      new ReadableStream<Uint8Array>({
        start: (controller) => {
          authority = controller;
        },
      }),
    );
    const baseline = initialBaseline(
      configurationContext(captureConfiguration("drag-race"), 1, 1000000),
    );
    baseline.identity = identity;
    baseline.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
    gameplay.control.enqueue(
      encodeMessage("Initialization", {
        identity,
        round: baseline.round,
        context: baseline.context,
      }),
    );
    await vi.waitFor(() => expect(gameplay.inputCalls).toBe(1));
    const data = encodeBaseline(baseline);
    authority.enqueue(
      encodeMessage("BaselineChunk", {
        identity,
        round: baseline.round,
        transferId: 1,
        epoch: 1,
        tick: 0,
        progress: baseline.progress,
        total: data.length,
        offset: 0,
        index: 0,
        count: 1,
        data,
      }),
    );
    await vi.waitFor(() => expect(client.state.diagnostics.baselineEpochs).toEqual([1]));
    const room: RoomState = {
      identity,
      revision: 1,
      mode: 1,
      phase: 2,
      host: 0,
      seats: [
        { session: 2, name: "Driver", flags: 1, reservationUs: 0 },
        { session: 3, name: "Guest", flags: 1, reservationUs: 0 },
      ],
      roundId: 1,
      startUs: 1000000,
      idleWarningUs: 100000000,
      idleExpiryUs: 200000000,
    };
    RoomSocket.latest.onmessage?.({
      data: encodeMessage("RoomState", room).slice().buffer as ArrayBuffer,
    });
    RoomSocket.latest.onmessage?.({
      data: encodeMessage("RoomReply", {
        identity,
        sequence: 1,
        revision: 1,
        accepted: 1,
        detail: "",
      }).slice().buffer as ArrayBuffer,
    });
    await vi.advanceTimersByTimeAsync(1100);
    expect(client.state.errors).toContain("Authoritative history expired; recovering connection");
    expect(client.hasCredential).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(Gameplay.instances).toHaveLength(2);
  } finally {
    client.dispose();
  }
});
