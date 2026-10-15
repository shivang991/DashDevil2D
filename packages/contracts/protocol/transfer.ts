import { decodeBaseline, encodeBaselineChunk, type Baseline, type BaselineChunk, type Context, encodeIdentity, encodeRound, encodeProgress } from '../generated/protocol';
import { validateBaseline, equalBytes } from './validation';
import { WireError } from './runtime';
/** Pure assembly only. Transport scheduling, timeouts and terminal application belong to #29. */
export class BaselineTransfer {
  private header?: string;
  private bytes?: Uint8Array;
  private pieces = new Map<number, { start: number; end: number }>();
  private totalReceived = 0;
  private canceled = false;
  private installed = false;
  private readonly context: Context;
  private readonly limit: number;
  constructor(context: Context, limit: number) {
    this.context = context; this.limit = limit;
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1048576) throw new WireError('invalid transfer limit');
  }
  accept(chunk: BaselineChunk): Baseline | undefined {
    if (this.canceled || this.installed) throw new WireError('transfer no longer active');
    encodeBaselineChunk(chunk); // Enforce mechanical integer/section bounds on callers too.
    const { offset, index, data, ...metadata } = chunk;
    if (!chunk.transferId || chunk.total > this.limit || chunk.total === 0 || !chunk.count || chunk.count > chunk.total || index >= chunk.count || !data.length || offset + data.length > chunk.total) throw new WireError('invalid transfer bounds');
    const header = Array.from(encodeBaselineChunk({ ...metadata, offset: 0, index: 0, data: new Uint8Array() })).join(",");
    if (this.header !== undefined && this.header !== header) throw new WireError('inconsistent transfer metadata');
    const end = offset + data.length;
    if (this.pieces.has(index) || [...this.pieces.values()].some(p => offset < p.end && end > p.start)) throw new WireError('overlapping/duplicate chunk');
    if (!this.bytes) { this.bytes = new Uint8Array(chunk.total); this.header = header; }
    this.bytes.set(data, offset); this.pieces.set(index, { start: offset, end }); this.totalReceived += data.length;
    if (this.pieces.size !== chunk.count) return undefined;
    if (this.totalReceived !== chunk.total) throw new WireError('incomplete baseline');
    const b = decodeBaseline(this.bytes, this.limit); validateBaseline(b, this.context);
    if (!equalBytes(encodeIdentity(b.identity), encodeIdentity(chunk.identity)) || !equalBytes(encodeRound(b.round), encodeRound(chunk.round)) || b.epoch !== chunk.epoch || b.tick !== chunk.tick || !equalBytes(encodeProgress(b.progress), encodeProgress(chunk.progress))) throw new WireError('baseline/transfer watermark mismatch');
    this.installed = true; this.bytes = undefined; this.pieces.clear(); return b;
  }
  cancel(): void { this.canceled = true; this.bytes = undefined; this.pieces.clear(); }
}
