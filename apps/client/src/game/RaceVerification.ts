import type { Verification } from "@dashdevil/contracts/protocol";

/** Only reconstructed authoritative ticks enter this history; prediction stays separate. */
export class RaceVerification {
  verified = 0;
  private lastVerified = -1;
  private latest = -1;
  private history = new Map<number, number>();
  private pending = new Map<number, number>();
  private readonly ticks: number;
  private readonly epoch: number;
  constructor(epoch: number, tickRate: number, retentionSeconds: number) {
    this.epoch = epoch;
    this.ticks = Math.ceil(tickRate * retentionSeconds);
  }
  barrier(tick: number, crc: number): boolean {
    this.latest = Math.max(this.latest, tick);
    this.history.set(tick, crc);
    for (const retained of this.history.keys())
      if (retained < this.latest - this.ticks) this.history.delete(retained);
    return this.compare();
  }
  datagram(value: Verification): boolean {
    if (
      value.epoch !== this.epoch ||
      value.tick <= this.lastVerified ||
      value.tick < this.latest - this.ticks
    )
      return false;
    this.pending.set(value.tick, value.crc);
    // Even unusable future datagrams cannot grow an unbounded queue.
    while (this.pending.size > this.ticks + 1)
      this.pending.delete(this.pending.keys().next().value!);
    return this.compare();
  }
  private compare(): boolean {
    let recover = false;
    for (const [tick, crc] of this.pending) {
      if (tick <= this.lastVerified || tick < this.latest - this.ticks) {
        this.pending.delete(tick);
        continue;
      }
      const expected = this.history.get(tick);
      if (expected === undefined && tick >= this.latest) continue;
      this.pending.delete(tick);
      if (expected !== crc) recover = true;
      else {
        this.lastVerified = tick;
        this.verified++;
      }
    }
    return recover;
  }
}
