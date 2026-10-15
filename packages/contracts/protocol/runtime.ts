/** Mechanical layout interpreter. Game/context semantics belong to validation.ts. */
export interface Field {
  readonly name: string; readonly type: string; readonly array?: number; readonly fixed?: boolean;
  readonly max?: number; readonly mask?: number; readonly projection?: boolean; readonly bits?: number;
}
export type Layouts = Readonly<Record<string, readonly Field[]>>;
export class WireError extends Error {}
const widths: Record<string, number> = { u8: 1, u16: 2, u32: 4, us: 8, f64: 8 };
const maximum: Record<string, number> = { u8: 255, u16: 65535, u32: 4294967295, us: Number.MAX_SAFE_INTEGER };
function fail(message: string): never { throw new WireError(message); }
export function quantize(value: number): number {
  const q = Math.floor(value * 1024 + .5);
  if (!Number.isFinite(value) || !Number.isSafeInteger(q)) fail('position projection overflow');
  return Object.is(q, -0) ? 0 : q;
}
function scalarValid(f: Field, v: unknown): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${f.name}: nonfinite or nonnumeric`);
  if (f.type !== 'f64' && (!Number.isSafeInteger(v) || v < 0 || v > maximum[f.type])) fail(`${f.name}: integer out of range`);
  if (f.max !== undefined && v > f.max) fail(`${f.name}: invalid enum`);
  if (f.mask !== undefined && (v & ~f.mask) !== 0) fail(`${f.name}: reserved bits`);
}
// TextEncoder/TextDecoder are supplied by the browser or Node; shared packages use DOM-free types.
const utf8 = globalThis as unknown as {
  TextEncoder: new () => { encode(value: string): Uint8Array };
  TextDecoder: new (encoding: string, options: { fatal: boolean; ignoreBOM: boolean }) => { decode(value: Uint8Array): string };
};
const textEncoder = new utf8.TextEncoder();
const textDecoder = new utf8.TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
export function encodeRecord(layouts: Layouts, name: string, value: unknown, limit: number, projection = false): Uint8Array {
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 0xffffffff) fail('invalid record limit');
  // Grow only up to the caller's negotiated bound, rather than trusting section counts.
  let bytes = new Uint8Array(Math.min(limit, 1024)); let at = 0;
  function reserve(n: number): DataView {
    if (at + n > limit) fail('record exceeds limit');
    if (at + n > bytes.length) { const grown = new Uint8Array(Math.min(limit, Math.max(at + n, bytes.length * 2))); grown.set(bytes); bytes = grown; }
    return new DataView(bytes.buffer);
  }
  function put32(v: number): void { reserve(4).setUint32(at, v); at += 4; }
  function record(type: string, v: unknown): void {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${type}: expected record`);
    const fields = layouts[type] ?? fail('unknown record');
    const data = v as Record<string, unknown>;
    if (Object.keys(data).some(key => !fields.some(f => f.name === key))) fail(`${type}: unknown field`);
    for (let index = 0; index < fields.length; index++) {
      const f = fields[index];
      if (f.bits !== undefined) {
        let packed = 0, shift = 0;
        while (index < fields.length && fields[index].bits !== undefined && shift + fields[index].bits! <= 8) {
          const part = fields[index], item = data[part.name]; scalarValid(part, item);
          if (item >= 2 ** part.bits!) fail("packed field overflow");
          packed |= item << shift; shift += part.bits!; index++;
        }
        index--; reserve(1).setUint8(at++, packed); continue;
      }
      const item = data[f.name];
      if (f.array !== undefined) {
        if (!Array.isArray(item) || item.length > f.array || (f.fixed && item.length !== f.array)) fail(`${f.name}: invalid count`);
        if (!f.fixed) put32(item.length);
        for (const element of item) field({ ...f, array: undefined }, element);
      } else field(f, item);
    }
  }
  function field(f: Field, v: unknown): void {
    if (f.type === 'string' || f.type === 'bytes') {
      if (f.type === 'string' && (typeof v !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))) fail(`${f.name}: invalid UTF-8 string`);
      if (f.type === 'bytes' && !(v instanceof Uint8Array)) fail(`${f.name}: expected bytes`);
      const b = f.type === 'string' ? textEncoder.encode(v as string) : v as Uint8Array;
      if (b.length > (f.max ?? 0)) fail(`${f.name}: section exceeds bound`);
      put32(b.length); reserve(b.length); bytes.set(b, at); at += b.length; return;
    }
    if (!widths[f.type]) { record(f.type, v); return; }
    scalarValid(f, v); const view = reserve(widths[f.type]);
    switch (f.type) {
      case 'u8': view.setUint8(at, v); break;
      case 'u16': view.setUint16(at, v); break;
      case 'u32': view.setUint32(at, v); break;
      case 'us': view.setBigUint64(at, BigInt(v)); break;
      case 'f64': if (projection && f.projection) view.setBigInt64(at, BigInt(quantize(v))); else view.setFloat64(at, v); break;
    }
    at += widths[f.type];
  }
  record(name, value); return bytes.slice(0, at);
}
export function decodeRecord(layouts: Layouts, name: string, bytes: Uint8Array, limit: number): unknown {
  if (bytes.length > limit) fail('record exceeds limit');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let at = 0;
  function take(n: number): number { const start = at; if (n > bytes.length - at) fail('truncated record'); at += n; return start; }
  function get32(): number { return view.getUint32(take(4)); }
  function record(type: string): Record<string, unknown> {
    const value: Record<string, unknown> = {};
    const fields = layouts[type] ?? fail('unknown record');
    for (let index = 0; index < fields.length; index++) {
      const f = fields[index];
      if (f.bits !== undefined) {
        const packed = view.getUint8(take(1)); let shift = 0;
        while (index < fields.length && fields[index].bits !== undefined && shift + fields[index].bits! <= 8) {
          const part = fields[index], item = (packed >>> shift) & (2 ** part.bits! - 1); scalarValid(part, item);
          value[part.name] = item; shift += part.bits!; index++;
        }
        if (packed >>> shift) fail('reserved packed bits');
        index--; continue;
      }
      if (f.array !== undefined) {
        const count = f.fixed ? f.array : get32();
        // Every composite has at least one byte; this also bounds allocation before traversal.
        if (count > f.array || count > bytes.length - at) fail(`${f.name}: count exceeds bound`);
        value[f.name] = Array.from({ length: count }, () => field(f));
      } else value[f.name] = field(f);
    }
    return value;
  }
  function field(f: Field): unknown {
    if (f.type === 'bytes' || f.type === 'string') {
      const n = get32(); if (n > (f.max ?? 0)) fail(`${f.name}: section exceeds bound`);
      const b = bytes.slice(take(n), at);
      try { return f.type === 'bytes' ? b : textDecoder.decode(b); } catch { return fail('invalid UTF-8'); }
    }
    if (!widths[f.type]) return record(f.type);
    const pos = take(widths[f.type]); let v: number;
    switch (f.type) {
      case 'u8': v = view.getUint8(pos); break;
      case 'u16': v = view.getUint16(pos); break;
      case 'u32': v = view.getUint32(pos); break;
      case 'us': { const big = view.getBigUint64(pos); if (big > BigInt(Number.MAX_SAFE_INTEGER)) fail('timestamp exceeds exact integer range'); v = Number(big); break; }
      default: v = view.getFloat64(pos);
    }
    scalarValid(f, v); return v;
  }
  const result = record(name); if (at !== bytes.length) fail('trailing record bytes'); return result;
}
export function encodeFrame(layouts: Layouts, name: string, id: number, value: unknown, limit: number): Uint8Array {
  if (limit < 5) fail('frame limit too small');
  const body = encodeRecord(layouts, name, value, limit - 5); const bytes = new Uint8Array(body.length + 5);
  new DataView(bytes.buffer).setUint32(0, body.length + 1); bytes[4] = id; bytes.set(body, 5); return bytes;
}
export function decodeFrame(layouts: Layouts, messages: Readonly<Record<string, { readonly id: number }>>, bytes: Uint8Array, limit: number): { type: string; value: unknown } {
  if (bytes.length < 5 || bytes.length > limit) fail('invalid frame length');
  if (new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0) !== bytes.length - 4) fail('invalid body length');
  const type = Object.keys(messages).find(n => messages[n].id === bytes[4]) ?? fail('unknown message type');
  return { type, value: decodeRecord(layouts, type, bytes.subarray(5), limit - 5) };
}
export function projectRecord(layouts: Layouts, name: string, value: unknown): Uint8Array { return encodeRecord(layouts, name, value, 1048576, true); }
export function crc32c(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0x82f63b78 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Stream boundaries may split a prefix/body or contain many frames. */
export class FrameReader {
  private prefix: number[] = [];
  private body?: Uint8Array;
  private used = 0;
  private readonly limit: number;
  constructor(limit = 65536) { this.limit = limit; if (!Number.isSafeInteger(limit) || limit < 5 || limit > 0xffffffff) fail('invalid frame limit'); }
  push(part: Uint8Array): Uint8Array[] {
    const result: Uint8Array[] = []; let at = 0;
    while (at < part.length) {
      if (!this.body) {
        while (at < part.length && this.prefix.length < 4) this.prefix.push(part[at++]);
        if (this.prefix.length < 4) break;
        const n = new DataView(Uint8Array.from(this.prefix).buffer).getUint32(0);
        if (n < 1 || n > this.limit - 4) fail('advertised length exceeds bound');
        this.body = new Uint8Array(n + 4); this.body.set(this.prefix); this.used = 4;
      }
      const n = Math.min(part.length - at, this.body.length - this.used); this.body.set(part.subarray(at, at + n), this.used); at += n; this.used += n;
      if (this.used === this.body.length) { result.push(this.body); this.body = undefined; this.prefix = []; this.used = 0; }
    }
    return result;
  }
  finish(): void { if (this.prefix.length || this.body) fail('incomplete stream frame'); }
}
