import { layouts, encodeBaseline, encodeContext, encodeObjectState, encodeMessage, projectBaseline, type Baseline, type BaselineChunk, type Car, type Context, type Progress, type Window } from '../generated/protocol';
import { quantize, WireError } from './runtime';
import defaults from '../configuration/defaults.json';

export interface ConfigurationDefinition {
  readonly version: number; readonly mode: 'long-drive' | 'drag-race' | 'road-rage';
  readonly gameplay: object; readonly presentation: object; readonly room: object;
  readonly connection: typeof defaults.connection; readonly operational: object;
}
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean { return a.length === b.length && a.every((v, i) => v === b[i]); }
function requireState(ok: boolean, reason: string): void { if (!ok) throw new WireError(reason); }
function group(name: string, values: object): Record<string, number> {
  const source = values as Record<string, number>;
  return Object.fromEntries(layouts[name as keyof typeof layouts].map(f => [f.name, source[f.name] ?? 0]));
}
export function configurationContext(config: ConfigurationDefinition, seed = 1, startUs = 0): Context {
  return { configurationVersion: config.version, configurationId: 1, generationVersion: 1, seed,
    mode: ['long-drive', 'drag-race', 'road-rage'].indexOf(config.mode), startUs,
    gameplay: group('Gameplay', config.gameplay) as unknown as Context['gameplay'],
    presentation: group('Presentation', config.presentation) as unknown as Context['presentation'],
    room: group('Room', config.room) as unknown as Context['room'],
    connection: group('Connection', config.connection) as unknown as Context['connection'],
    operational: group('Operational', config.operational) as unknown as Context['operational'] };
}
const emptyProgress = (): Progress => ({ authority: 0, event: 0, processed1: 0, processed2: 0, disposed1: 0, disposed2: 0 });
export function initialCar(lane: number, hp: number): Car {
  return { progress: 0, lateral: (lane - 1) * 120, normalSpeed: 400, lane, departure: lane, target: lane,
    phase: 0, controls: 0, effective: 0, flags: 0, movementOrigin: (lane - 1) * 120, movementTarget: (lane - 1) * 120,
    movementStartUs: 0, movementEndUs: 0, nextShiftUs: 0, freshnessUs: 0, protectionUs: 0, hp, score: 0, lastInput: 0, heldMask: 0, inputGeneration: 1 };
}
export function initialBaseline(context: Context): Baseline {
  const cars = [initialCar(0, context.gameplay.maxHealth), initialCar(2, context.gameplay.maxHealth)];
  for (const car of cars) { car.lateral = (car.lane - 1) * context.gameplay.laneSpacing; car.movementOrigin = car.lateral; car.movementTarget = car.lateral; car.normalSpeed = context.gameplay.startingRoadSpeed; }
  return { identity: { roomId: 1, seatSession: 1, pairGeneration: 1, seat: 0 }, round: { roundId: 1, inputGeneration: 1 }, epoch: 1, tick: 0, timeUs: 0, progress: emptyProgress(), context, cars,
    contact: { episode: 0, flags: 0, blockedSeat: 0, latestSeat: 0, latestControl: 0, latestSequence: 0, latestTimeUs: 0, latestOrder: 0 },
    generator: { randomState: context.seed, nextSlice: 1, nextObject: 1, cursor: 0, nextSpawnUs: 0, nextDifficultyUs: 0, reservedCursor: 0 }, windows: [] };
}
/** Conservative reachable enclosure: full shift/return lane range, collision extents,
 * horizon at capped boosted speed, one extra generation slice, independent cars.
 * One random nonempty cell per opportunity; reserved hearts are additional objects.
 * State is serialized with the real codec, never estimated from consumption bits. */
export function configurationResources(config: ConfigurationDefinition): { objects: number; baselineBytes: number; chunkBytes: number; chunks: number; windowLength: number; maxProgress: number } {
  const g = config.gameplay as Record<string, number>, c = config.connection;
  if (config.mode === 'long-drive') return { objects: 0, baselineBytes: 0, chunkBytes: 0, chunks: 0, windowLength: 0, maxProgress: 0 };
  const boosted = g.maxRoadSpeed * g.accelSpeedMultiplier;
  const extent = (g.carHeight + Math.max(g.obstacleH, g.coinSize, g.heartSize)) / 2;
  const windowLength = boosted * defaults.fixed.predictionHorizon + 2 * extent + g.sliceSpacing;
  const randomCount = Math.ceil(windowLength / g.sliceSpacing) + 2;
  const reserved = config.mode === 'drag-race' ? g.reservedHearts : 0;
  const objects = 2 * randomCount + reserved;
  const maxProgress = config.mode === 'drag-race' ? g.finishDistance : boosted * g.timeLimit;
  for (const value of [maxProgress + windowLength, -extent, g.laneSpacing + Math.max(g.carWidth, g.obstacleW, g.coinSize, g.heartSize) / 2]) quantize(value);
  requireState(Number.isSafeInteger(objects) && randomCount + reserved <= 40000, 'serialized baseline object count exceeds schema window bound');
  requireState(g.maxHealth <= 0xffffffff && g.obstacleDamage <= 0xffffffff && (g.playerContactDamage ?? 0) <= 0xffffffff, 'HP/damage exceeds uint32');
  const duration = config.mode === 'drag-race' ? g.finishDistance / g.startingRoadSpeed : g.timeLimit;
  requireState(Number.isFinite(duration) && Math.ceil(duration * g.tickRate) <= 0xffffffff, 'round tick counter would exhaust');
  requireState(Number.isSafeInteger(Math.floor((duration + Math.max(g.invincibleDuration, g.laneShiftDuration, g.laneReturnDuration, c.controlFreshnessExpiry)) * 1e6 + .5)), 'round continuation timestamp exceeds exact microseconds');
  const totalSlices = Math.ceil((maxProgress + windowLength) / g.sliceSpacing) + 2;
  requireState(totalSlices + reserved < 0xffffffff && 10 * (totalSlices + reserved) <= 0xffffffff, 'object identity/score exceeds uint32 before round end');
  // Known fixed record size is measured using the codec; count overflow is rejected before allocation.
  const baseline = initialBaseline(configurationContext(config));
  baseline.windows = [0, 1].map(() => ({ start: 0, end: windowLength, firstSlice: 1, lastSlice: 1, objects: [] }));
  const baseBytes = encodeBaseline(baseline).length;
  const objectBytes = encodeObjectState({ id: 0, sliceId: 0, lane: 0, flags: 0, distance: 0 }).length;
  requireState(baseBytes + objects * objectBytes <= Math.min(c.baselineBytes, 1048576), 'serialized baseline exceeds assembled limit');
  let id = 1;
  baseline.windows = [randomCount + reserved, randomCount].map(count => ({ start: 0, end: windowLength, firstSlice: 1, lastSlice: count,
    objects: Array.from({ length: count }, (_, index) => ({ id: id++, sliceId: index + 1, lane: index % 3, flags: index < randomCount ? 2 : 3, distance: index * g.sliceSpacing })) }));
  const baselineBytes = encodeBaseline(baseline, c.baselineBytes).length;
  requireState(baselineBytes === baseBytes + objects * objectBytes, 'schema size accounting mismatch');
  const chunk: BaselineChunk = { identity: baseline.identity, round: baseline.round, transferId: 1, epoch: 1, tick: 0, progress: baseline.progress, total: baselineBytes, offset: 0, index: 0, count: 1, data: new Uint8Array() };
  const headerBytes = encodeMessage('BaselineChunk', chunk).length;
  const payloadBytes = Math.min(c.reliableFrameBytes, c.queueBytes, 1048576) - headerBytes;
  requireState(payloadBytes > 0, 'baseline chunk header leaves no payload in frame/queue');
  const chunks = Math.ceil(baselineBytes / payloadBytes);
  requireState(chunks <= 0xffffffff, 'baseline chunk count exceeds uint32');
  chunk.count = chunks; chunk.data = new Uint8Array(Math.min(baselineBytes, payloadBytes));
  try { encodeMessage('Coverage', { identity: baseline.identity, round: baseline.round, authority: 1, tick: 0, timeUs: 0, progress: baseline.progress, generator: baseline.generator, windows: baseline.windows }, c.reliableFrameBytes); }
  catch { throw new WireError('coverage update exceeds reliable frame limit'); }
  const chunkBytes = encodeMessage('BaselineChunk', chunk, c.reliableFrameBytes).length;
  return { objects, baselineBytes, chunkBytes, chunks, windowLength, maxProgress };
}
export function validateProgress(p: Progress): void {
  requireState(p.disposed1 <= p.processed1 && p.disposed2 <= p.processed2 && p.event <= p.authority, 'inconsistent authority/input watermarks');
}
export function validateCar(car: Car, timeUs: number, context: Context): void {
  const g = context.gameplay;
  requireState(car.inputGeneration > 0, 'missing per-seat input generation');
  requireState(car.hp <= g.maxHealth && car.score % 10 === 0 && car.normalSpeed >= 0 && car.normalSpeed <= g.maxRoadSpeed, 'invalid HP/score/speed');
  requireState(car.progress >= 0 && Math.abs(car.lateral) <= g.laneSpacing, 'car outside world lanes/progress');
  requireState(car.phase === 0 || (car.movementStartUs <= timeUs && timeUs <= car.movementEndUs && car.movementStartUs < car.movementEndUs), 'invalid movement timing');
  requireState(car.phase !== 1 || Math.abs(car.departure - car.target) === 1, 'shift must target adjacent lane');
  requireState(car.phase !== 2 || (car.effective !== 3 && (car.flags & 1) === 0), 'return cannot enable NOS');
  requireState(car.effective === 0 || car.freshnessUs > timeUs, 'effective controls expired');
  requireState(car.controls === 0 || (car.heldMask & (1 << (car.controls - 1))) !== 0, 'winning control is not held');
  requireState((car.flags & 1) === 0 || car.effective === 3, 'NOS requires effective boost');
}
export function validateWindow(window: Window): void {
  requireState(window.start <= window.end && window.firstSlice <= window.lastSlice, 'invalid window bounds');
  let last = 0;
  for (const object of window.objects) {
    requireState(object.id > last && object.sliceId >= window.firstSlice && object.sliceId <= window.lastSlice && object.distance >= window.start && object.distance <= window.end, 'object identity/order/coverage invalid'); last = object.id;
    const kind = object.flags & 3;
    requireState(kind !== 0 && (kind === 2 ? (object.flags & 4) === 0 : (object.flags & 24) === 0), 'invalid consumption flags');
  }
}
/** Caller must compare immutable context to its validated captured configuration. */
export function validateBaseline(b: Baseline, expectedContext: Context): void {
  encodeBaseline(b); projectBaseline(b); validateProgress(b.progress);
  requireState(equalBytes(encodeContext(b.context), encodeContext(expectedContext)), 'baseline immutable context mismatch');
  requireState(b.context.configurationVersion === 1 && b.context.generationVersion === 1 && b.context.seed > 0 && b.generator.randomState > 0, 'unsupported context/seed');
  requireState(b.identity.roomId > 0 && b.identity.seatSession > 0 && b.identity.pairGeneration > 0 && b.round.roundId > 0 && b.round.inputGeneration > 0 && b.epoch > 0, 'invalid baseline identity');
  requireState(b.cars[b.identity.seat].inputGeneration === b.round.inputGeneration, 'recipient input generation mismatch');
  requireState(Number.isSafeInteger(b.context.startUs + b.timeUs), 'round clock exceeds exact microseconds');
  for (const car of b.cars) validateCar(car, b.timeUs, b.context);
  requireState(b.contact.latestTimeUs <= b.timeUs, 'future qualifying input');
  requireState(b.generator.nextSlice > 0 && b.generator.nextObject > 0, 'generator identity exhausted');
  requireState(b.windows.length > 0, 'missing track coverage');
  let lastEnd = -Infinity; const ids = new Set<number>();
  for (const window of b.windows) {
    validateWindow(window); requireState(window.start > lastEnd, 'overlapping/noncanonical windows'); lastEnd = window.end;
    for (const object of window.objects) { requireState(!ids.has(object.id) && object.id < b.generator.nextObject && object.sliceId < b.generator.nextSlice, 'duplicate/future object'); ids.add(object.id); }
  }
  const g = b.context.gameplay, extent = (g.carHeight + Math.max(g.obstacleH, g.coinSize, g.heartSize)) / 2;
  for (const car of b.cars) requireState(b.windows.some(w => w.start <= car.progress - extent && w.end >= car.progress + g.maxRoadSpeed * g.accelSpeedMultiplier * defaults.fixed.predictionHorizon + extent + g.sliceSpacing), 'insufficient reachable track coverage');
}
export function nextCounter(value: number, bits: 16 | 32): number {
  requireState(Number.isInteger(value) && value >= 0 && value < (bits === 16 ? 65535 : 0xffffffff), 'counter exhausted; renew context'); return value + 1;
}
export function validateVersion(version: number): void { requireState(version === 1, 'incompatible protocol version'); }

/** Static semantic checks. Current identity/sequence admission and gameplay application are #28/#29. */
export function validateMessage<K extends keyof import('../generated/protocol').Messages>(type: K, value: import('../generated/protocol').Messages[K], context: Context): void {
  encodeMessage(type, value);
  const v = value as unknown as Record<string, unknown>;
  if ('version' in v) validateVersion(v.version as number);
  if ('identity' in v) { const i = v.identity as Baseline['identity']; requireState(i.roomId > 0 && i.seatSession > 0 && i.pairGeneration > 0, 'invalid message identity'); }
  if ('round' in v) { const r = v.round as Baseline['round']; requireState(r.roundId > 0 && r.inputGeneration > 0, 'invalid round/input generation'); }
  if ('progress' in v) validateProgress(v.progress as Progress);
  if (type === 'Handshake') requireState(v.datagramBytes === 10, 'required ten-byte datagram schema/capacity');
  if (type === 'Admission') requireState((v.credential as Uint8Array).length === 32 && (v.roomTicket as Uint8Array).length > 0 && (v.gameplayTicket as Uint8Array).length > 0 && (v.origin as string).length > 0, 'invalid admission credential/tickets/origin');
  if (type === 'AdmissionRequest') {
    requireState(v.operation === 0 || (v.code as string).match(/^\d{4}$/) !== null, 'four-digit room code required');
    requireState(v.operation !== 2 || (v.credential as Uint8Array).length === 32, 'resume credential must be 256 bits');
  }
  if (type === 'Input') {
    requireState((v.sequence as number) > 0, 'input sequence must increase from one');
    requireState(v.intent !== 0 || v.control !== 0, 'fresh press requires control');
    requireState(v.intent !== 2 || v.control === 0 || ((v.heldMask as number) & (1 << ((v.control as number) - 1))) !== 0, 'refresh control must be held');
  }
  if (type === 'ClockReply') requireState((v.serverReceiveUs as number) <= (v.serverSendUs as number), 'clock reply reverses server time');
  if (type === 'Disposition') {
    requireState((v.sequence as number) > 0 && (v.sequence as number) <= (v.processed as number), 'disposition outside processed cutoff');
    validateCar(v.car as Car, v.timeUs as number, context);
  }
  if (type === 'Event') for (const car of v.cars as Car[]) validateCar(car, v.timeUs as number, context);
  if (type === 'Coverage') for (const window of v.windows as Window[]) validateWindow(window);
  if (type === 'Outcome') {
    requireState((v.roundId as number) > 0 && (v.outcomeId as number) > 0, 'terminal identity required');
    for (const car of v.cars as import('../generated/protocol').FinalCar[]) requireState(car.progress >= 0 && Math.abs(car.lateral) <= context.gameplay.laneSpacing && car.hp <= context.gameplay.maxHealth && car.score % 10 === 0, 'invalid terminal player values');
  }
}
