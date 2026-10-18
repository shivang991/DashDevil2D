import { afterEach, expect, test, vi } from 'vitest';
import { PairedConnection } from '../../src/transport/PairedConnection';
import { encodeMessage, protocolVersion, type Admission, type RoomState } from '@dashdevil/contracts/protocol';

const identity = { roomId: 1, seatSession: 2, pairGeneration: 1, seat: 0 };
class RoomSocket {
  static OPEN = 1;
  static latest: RoomSocket;
  readyState = 1;
  binaryType = '';
  onmessage?: (event: { data: ArrayBuffer }) => void;
  onclose?: (event: { reason: string }) => void;
  constructor() { RoomSocket.latest = this; }
  send() {}
  close() {}
}
class Gameplay {
  ready = Promise.resolve();
  closed = new Promise<never>(() => {});
  incomingUnidirectionalStreams = new ReadableStream<ReadableStream<Uint8Array>>();
  get datagrams() { return { maxDatagramSize: 1200, readable: new ReadableStream<Uint8Array>() }; }
  createBidirectionalStream() { return Promise.resolve({ readable: new ReadableStream<Uint8Array>(), writable: new WritableStream<Uint8Array>() }); }
  createUnidirectionalStream() { return Promise.resolve(new WritableStream<Uint8Array>()); }
  close() {}
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); });

test('expired authority clears the unusable room and credential without inventing a result; old callbacks cannot affect a new admission', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', RoomSocket); vi.stubGlobal('WebTransport', Gameplay);
  const admission: Admission = { version: protocolVersion, identity, credential: new Uint8Array(32).fill(1), roomTicket: new Uint8Array(32).fill(2), gameplayTicket: new Uint8Array(32).fill(3), expiresUs: 10000000, origin: location.origin };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(encodeMessage('Admission', admission) as Uint8Array<ArrayBuffer>, { status: 201, headers: { 'X-Room-Code': '0042' } })));
  const client = new PairedConnection({ server: 'https://localhost:8443' }, () => {});
  try {
    await client.connect(0);
    const old = RoomSocket.latest;
    const room: RoomState = { identity, revision: 1, mode: 1, phase: 0, host: 0, seats: [{ session: 2, name: 'Driver', flags: 1, reservationUs: 0 }, { session: 0, name: '', flags: 0, reservationUs: 0 }], roundId: 1, startUs: 0, idleWarningUs: 1000000, idleExpiryUs: 2000000 };
    const wire = encodeMessage('RoomState', room);
    old.onmessage?.({ data: wire.slice().buffer as ArrayBuffer });
    expect(client.state.room?.identity).toEqual(identity);
    old.onclose?.({ reason: 'Room expired' });
    expect(client.state.status).toContain('Room expired');
    expect(client.state.room).toBeUndefined();
    expect(client.state.outcome).toBeUndefined();
    expect(client.hasCredential).toBe(false);
    await client.connect(0);
    old.onclose?.({ reason: 'superseded' });
    old.onmessage?.({ data: wire.slice().buffer as ArrayBuffer });
    expect(client.state.status).toBe('Connecting');
    expect(client.state.room).toBeUndefined();
    expect(client.hasCredential).toBe(true);
  } finally { client.dispose(); }
});
