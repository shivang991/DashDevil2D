import { describe, expect, it } from 'vitest';
import { captureConfiguration } from '@dashdevil/simulation/config';
import { configurationResources } from '@dashdevil/contracts/validation';

describe('exact schema configuration resource gate', () => {
  it('sizes complete continuation for disjoint maximum-speed windows including reserved hearts', () => {
    const config = captureConfiguration('drag-race');
    const result = configurationResources(config);
    expect(result.objects).toBeGreaterThan(4);
    expect(result.baselineBytes).toBeGreaterThan(1000);
    expect(result.baselineBytes).toBeLessThan(config.connection.baselineBytes);
    expect(result.chunkBytes).toBeLessThanOrEqual(config.connection.reliableFrameBytes);
  });
  it('rejects a baseline that fits consumption bits but cannot fit actual continuation', () => {
    expect(() => captureConfiguration('drag-race', { connection: { baselineBytes: 512 } })).toThrow(/serialized baseline/);
  });
  it('rejects impossible chunk headers even when the frame fits the queue', () => {
    expect(() => captureConfiguration('road-rage', { connection: { reliableFrameBytes: 32 } })).toThrow(/chunk/);
  });
  it('rejects a frame limit that fits coverage and chunks but cannot carry initialization', () => {
    expect(() => captureConfiguration('drag-race', { connection: { reliableFrameBytes: 512 } })).toThrow(/initialization/);
  });
  it('rejects signed projection overflow at the round maximum, beyond individual dimensions', () => {
    expect(() => captureConfiguration('road-rage', { gameplay: { timeLimit: 1e8, tickRate: 1, maxRoadSpeed: 1e8 } })).toThrow(/projection/);
  });
});

import fixtures from '@dashdevil/contracts/protocol-fixtures';
import { layouts, messageTypes, encodeMessage, decodeMessage, encodeBaseline, decodeBaseline, encodeVerification, decodeVerification, projectBaseline, type Messages, type Baseline, type Verification } from '@dashdevil/contracts/protocol';
import { encodeRecord, decodeRecord, FrameReader, crc32c, quantize } from '@dashdevil/contracts/wire';
import { validateBaseline, validateVersion, nextCounter } from '@dashdevil/contracts/validation';
function hex(bytes: Uint8Array): string { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
function bytes(value: string): Uint8Array { return Uint8Array.from(value.match(/../g) ?? [], x => parseInt(x, 16)); }
function hydrate(type: string, value: unknown): unknown {
  const data = value as Record<string, unknown>, output: Record<string, unknown> = {};
  for (const field of layouts[type as keyof typeof layouts]) {
    const convert = (v: unknown): unknown => field.type === 'bytes' ? Uint8Array.from(atob(v as string), c => c.charCodeAt(0)) : field.type in layouts ? hydrate(field.type, v) : v;
    output[field.name] = 'array' in field ? (data[field.name] as unknown[]).map(convert) : convert(data[field.name]);
  }
  return output;
}
const baseline = hydrate('Baseline', fixtures.records.find(r => r.type === 'Baseline')!.value) as Baseline;
describe('shared versioned Go/TypeScript wire fixtures', () => {
  for (const fixture of fixtures.records) it(`rejects every truncated prefix of ${fixture.name}`, () => {
    const wire = bytes(fixture.hex);
    for (let n = 0; n < wire.length; n++) {
      const prefix = wire.subarray(0, n);
      expect(() => fixture.type === 'Baseline' ? decodeBaseline(prefix) : fixture.type === 'Verification' ? decodeVerification(prefix) : decodeMessage(prefix)).toThrow();
    }
  });
  for (const fixture of fixtures.records) it(fixture.name, () => {
    const value = hydrate(fixture.type, fixture.value);
    if (fixture.type in messageTypes) {
      const type = fixture.type as keyof Messages;
      expect(hex(encodeMessage(type, value as Messages[typeof type]))).toBe(fixture.hex);
      expect(decodeMessage(bytes(fixture.hex))).toEqual({ type, value });
    } else if (fixture.type === 'Baseline') {
      expect(hex(encodeBaseline(value as Baseline))).toBe(fixture.hex);
      expect(decodeBaseline(bytes(fixture.hex))).toEqual(value);
      validateBaseline(value as Baseline, (value as Baseline).context);
    } else {
      expect(hex(encodeVerification(value as Verification))).toBe(fixture.hex);
      expect(decodeVerification(bytes(fixture.hex))).toEqual(value);
    }
  });
  for (const fixture of fixtures.malformed) it(`rejects ${fixture.name}`, () => {
    if ('type' in fixture && fixture.type) expect(() => decodeRecord(layouts, fixture.type, bytes(fixture.hex), 1048576)).toThrow();
    else expect(() => decodeMessage(bytes(fixture.hex))).toThrow();
  });
  it('bounds section counts and lengths on encoding too', () => {
    expect(() => encodeRecord(layouts, 'ProtocolError', { code: 1, expectedVersion: 1, detail: 'x'.repeat(513) }, 65536)).toThrow();
    expect(() => encodeBaseline({ ...baseline, windows: [baseline.windows[0], baseline.windows[0], baseline.windows[0]] })).toThrow();
  });
  it('keeps float64 corrections unquantized while projection matches independent bytes/CRC', () => {
    expect(hex(projectBaseline(baseline))).toBe(fixtures.projection.hex);
    expect(crc32c(projectBaseline(baseline))).toBe(fixtures.projection.crc);
    const changed = structuredClone(baseline); changed.cars[0].progress += .0001;
    expect(hex(encodeBaseline(changed))).not.toBe(hex(encodeBaseline(baseline)));
    expect(hex(projectBaseline(changed))).toBe(hex(projectBaseline(baseline)));
    changed.context.startUs -= 1; changed.identity.pairGeneration += 1; changed.epoch += 1;
    expect(hex(projectBaseline(changed))).toBe(hex(projectBaseline(baseline)));
  });
  it('uses literal Castagnoli and signed half-up quantization vectors', () => {
    for (const vector of fixtures.crc) expect(crc32c(bytes(vector.hex))).toBe(vector.expected);
    for (const vector of fixtures.quantization) expect(quantize(vector.value)).toBe(vector.expected);
    expect(() => quantize(Number.MAX_SAFE_INTEGER)).toThrow();
  });
  it('rejects datagram lengths other than ten', () => { for (const length of [0, 9, 11]) expect(() => decodeVerification(new Uint8Array(length))).toThrow(); });
  it('handles split prefixes/bodies and coalesced frames without trusting advertised allocation', () => {
    const a = bytes(fixtures.records[0].hex), b = bytes(fixtures.records[1].hex), joined = new Uint8Array(a.length + b.length); joined.set(a); joined.set(b, a.length);
    const reader = new FrameReader(); expect(reader.push(joined.subarray(0, 2))).toEqual([]); expect(reader.push(joined.subarray(2, 6))).toEqual([]);
    expect(reader.push(joined.subarray(6))).toEqual([a, b]); reader.finish();
    expect(() => new FrameReader().push(bytes('ffffffff'))).toThrow();
    const incomplete = new FrameReader(); incomplete.push(a.subarray(0, 5)); expect(() => incomplete.finish()).toThrow();
  });
  it('rejects incompatible versions and refuses counter wrap', () => {
    expect(() => validateVersion(1)).toThrow(); expect(nextCounter(65534, 16)).toBe(65535);
    expect(() => nextCounter(65535, 16)).toThrow(); expect(() => nextCounter(0xffffffff, 32)).toThrow();
  });
  it('validates continuation semantics beyond mechanical decoding', () => {
    const wrong = structuredClone(baseline); wrong.cars[1].effective = 3; expect(() => validateBaseline(wrong, baseline.context)).toThrow();
    const insufficient = structuredClone(baseline); insufficient.windows[0].end = 500; expect(() => validateBaseline(insufficient, baseline.context)).toThrow();
    const context = structuredClone(baseline.context); context.seed = 2; expect(() => validateBaseline(baseline, context)).toThrow();
  });
});

import { BaselineTransfer } from '@dashdevil/contracts/transfer';
describe('atomic complete-baseline transfer', () => {
  const data = encodeBaseline(baseline);
  const header = { identity: baseline.identity, round: baseline.round, transferId: 1, epoch: baseline.epoch, tick: baseline.tick, progress: baseline.progress, total: data.length, count: 2 };
  it('installs only after all consistent chunks validate, tolerating arrival order', () => {
    const transfer = new BaselineTransfer(baseline.context, 1048576);
    const split = 100;
    expect(transfer.accept({ ...header, index: 1, offset: split, data: data.subarray(split) })).toBeUndefined();
    expect(transfer.accept({ ...header, index: 0, offset: 0, data: data.subarray(0, split) })).toEqual(baseline);
  });
  it('rejects overlap, inconsistent identities and totals, and oversized allocation', () => {
    const transfer = new BaselineTransfer(baseline.context, 1048576);
    transfer.accept({ ...header, index: 0, offset: 0, data: data.subarray(0, 100) });
    expect(() => transfer.accept({ ...header, index: 1, offset: 99, data: data.subarray(100) })).toThrow();
    expect(() => transfer.accept({ ...header, transferId: 2, index: 1, offset: 100, data: data.subarray(100) })).toThrow();
    expect(() => new BaselineTransfer(baseline.context, 512).accept({ ...header, index: 0, offset: 0, data })).toThrow();
  });
  it('a self-contained terminal outcome cancels the transfer and cannot be undone by late chunks', () => {
    const transfer = new BaselineTransfer(baseline.context, 1048576);
    transfer.accept({ ...header, index: 0, offset: 0, data: data.subarray(0, 100) });
    transfer.cancel(); expect(() => transfer.accept({ ...header, index: 1, offset: 100, data: data.subarray(100) })).toThrow();
  });
});

import { validateMessage } from '@dashdevil/contracts/validation';
describe('handwritten reliable record semantics', () => {
  it('rejects incompatible handshakes and missing required datagram capacity', () => {
    const value = hydrate('Handshake', fixtures.records.find(r => r.name === 'Handshake protocol 2')!.value) as Messages['Handshake'];
    expect(() => validateMessage('Handshake', { ...value, version: 1 }, baseline.context)).toThrow();
    expect(() => validateMessage('Handshake', { ...value, datagramBytes: 9 }, baseline.context)).toThrow();
  });
  it('checks admissions, input progress and self-contained terminal values', () => {
    for (const type of ['Admission', 'Input', 'Outcome', 'Barrier', 'Disposition', 'Event', 'Coverage'] as const) {
      validateMessage(type, hydrate(type, fixtures.records.find(r => r.name === (type === 'Admission' ? 'Admission protocol 2' : type))!.value) as Messages[typeof type], baseline.context);
    }
    const input = hydrate('Input', fixtures.records.find(r => r.type === 'Input')!.value) as Messages['Input'];
    expect(() => validateMessage('Input', { ...input, sequence: 0 }, baseline.context)).toThrow();
    const outcome = hydrate('Outcome', fixtures.records.find(r => r.type === 'Outcome')!.value) as Messages['Outcome'];
    const wrong = structuredClone(outcome); wrong.cars[0].hp = 4; expect(() => validateMessage('Outcome', wrong, baseline.context)).toThrow();
  });
});

it('rejects configurations whose complete coverage update cannot fit a reliable frame', () => {
  expect(() => captureConfiguration('road-rage', { gameplay: { sliceSpacing: 1 }, connection: { reliableFrameBytes: 1024 } })).toThrow(/coverage.*frame/);
});
it('rejects Drag Race durations that exhaust ticks despite a representable finish distance', () => {
  expect(() => captureConfiguration('drag-race', { gameplay: { startingRoadSpeed: 0.000001 } })).toThrow(/tick.*exhaust/);
});
it('preserves signed zero in float64 baselines while canonicalizing its projection', () => {
  const changed = structuredClone(baseline); changed.cars[0].progress = -0;
  expect(Object.is(decodeBaseline(encodeBaseline(changed)).cars[0].progress, -0)).toBe(true);
  const positive = structuredClone(changed); positive.cars[0].progress = 0;
  expect(hex(projectBaseline(changed))).toBe(hex(projectBaseline(positive)));
});

for (const scenario of fixtures.resources) it(`shared exact serialization resource vector: ${scenario.name}`, () => {
  const configuration = captureConfiguration(scenario.mode as 'drag-race' | 'road-rage', { gameplay: scenario.overrides });
  expect(configurationResources(configuration)).toEqual(scenario.expected);
});

for (const scenario of fixtures.semanticInvalid) it(`rejects impossible continuation: ${scenario.name}`, () => {
  const value = hydrate('Baseline', scenario.value) as Baseline;
  expect(() => validateBaseline(value, value.context)).toThrow();
});
