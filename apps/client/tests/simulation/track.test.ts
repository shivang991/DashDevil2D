// @vitest-environment node
import { expect, test } from 'vitest';
import fixture from '@dashdevil/contracts/track-fixtures';
import { createTrack, draw } from '@dashdevil/simulation/track';
import { advanceLongDrive, createLongDrive } from '@dashdevil/simulation/longDrive';

// Approved public simulation seam, decisions #5/#11/#14/#17.
// Seed 1: lane draw 0x00042021, coin draw 0x04080601.
test('seed 1 produces an immutable middle-empty slice at the exact first spawn anchor', () => {
  const game = createLongDrive(1);
  expect(game.state.track.slices).toEqual([]);
  advanceLongDrive(game, 5, {});
  advanceLongDrive(game, 1, {});
  expect(game.state.track.slices).toMatchObject([{ id: 1, cells: ['coin', 'empty', 'empty'] }]);
  expect(game.state.track.slices[0].distance).toBeCloseTo(1140, 6);
  expect(game.state.track.randomState).toBe(0x04080601);
});

test('a fatal swept contact stops later pickups at the canonical entry time', () => {
  const game = createLongDrive(1, { presentation: { accelCarOffset: 0 } });
  Object.assign(game.state, { status: 'playing', health: 1, roadSpeed: 400,
    obstacles: [{ id: 7, lane: 1, distance: 140, y: 0, width: 48, height: 40 }],
    coins: [{ id: 8, lane: 1, distance: 240, y: 0, width: 28, height: 28 }] });
  const events = advanceLongDrive(game, .1, { accelerating: true });
  expect(events.map(({ type, timeUs }) => ({ type, timeUs }))).toEqual([
    { type: 'damage', timeUs: 20000 }, { type: 'gameover', timeUs: 20000 },
  ]);
  expect(game.state.score).toBe(0);
  expect(game.state.roadOffset).toBeCloseTo(80, 6);
  expect(game.state.coins.map(object => object.id)).toEqual([8]);
});

for (const fps of [30, 60, 120]) {
  test(`${fps} FPS time-based spawns retain the same draws and cadence while boosting`, () => {
    const game = createLongDrive(1);
    game.state.status = 'playing'; game.state.currentLane = 2; game.state.visualLane = 2;
    for (let frame = 0; frame < fps; frame++) advanceLongDrive(game, 1 / fps, { accelerating: true });
    const first = game.state.track.slices.map(({ id, cells }) => ({ id, cells }));
    advanceLongDrive(game, .97, { accelerating: true });
    expect([...first, ...game.state.track.slices.map(({ id, cells }) => ({ id, cells }))]).toEqual([
      { id: 1, cells: ['coin', 'empty', 'empty'] }, { id: 2, cells: ['empty', 'coin', 'empty'] },
    ]);
    expect(game.state.track.slices[0].distance).toBeCloseTo(8765.5, 6);
    expect(game.state.track.randomState).toBe(0x1255994f);
  });
}

test('lateral paths collect an object even when both endpoints are in other lanes', () => {
  const game = createLongDrive(1, { gameplay: { laneLerpSpeed: 1000000 } });
  Object.assign(game.state, { status: 'playing', roadSpeed: 0, currentLane: 2, visualLane: 0,
    coins: [{ id: 7, lane: 1, distance: 0, y: 0, width: 28, height: 28 }] });
  expect(advanceLongDrive(game, .01, {}).map(event => event.type)).toEqual(['coin']);
  expect(game.state.score).toBe(10);
});

test('view changes and tilt cannot affect world contacts, full-health hearts and protected obstacles are consumed', () => {
  const run = (width: number, height: number) => {
    const game = createLongDrive(1);
    Object.assign(game.state, { status: 'playing', canvasWidth: width, canvasHeight: height,
      carYBase: height - 120, carY: height - 120, carTilt: 100, invincibleTimer: 1,
      coins: [{ id: 10, lane: 1, distance: 0, y: 0, width: 28, height: 28 }],
      hearts: [{ id: 11, lane: 1, distance: 0, y: 0, width: 28, height: 28 }],
      obstacles: [{ id: 12, lane: 1, distance: 0, y: 0, width: 48, height: 40 }] });
    return { events: advanceLongDrive(game, .01, {}).map(({ type, objectId, timeUs }) => ({ type, objectId, timeUs })),
      health: game.state.health, score: game.state.score, consumed: [...game.state.track.consumed] };
  };
  expect(run(0, 0)).toEqual({ events: [{ type: 'coin', objectId: 10, timeUs: 0 }, { type: 'heart', objectId: 11, timeUs: 0 }], health: 2, score: 10, consumed: [10, 11, 12] });
  expect(run(606, 806)).toEqual(run(320, 600));
});

test('strict world tangency gives no pickup; a positive overlap does', () => {
  const game = createLongDrive(1, { gameplay: { laneSpacing: 128 } });
  Object.assign(game.state, { status: 'playing', roadSpeed: 0, visualLane: 1 + 39 / 128, currentLane: 1 + 39 / 128,
    coins: [{ id: 7, lane: 1, distance: 0, y: 0, width: 28, height: 28 }] });
  expect(advanceLongDrive(game, .01, {})).toEqual([]);
  game.state.currentLane -= .001; game.state.visualLane -= .001;
  expect(advanceLongDrive(game, .01, {}).map(event => event.type)).toEqual(['coin']);
});

test('retirement stays bounded, advances identities and never recreates consumed slices', () => {
  const game = createLongDrive(1, { gameplay: { obstacleDamage: 0 } });
  game.state.status = 'playing';
  advanceLongDrive(game, 120, { accelerating: true });
  expect(game.state.track.nextId).toBeGreaterThan(300);
  expect(game.state.track.slices.length).toBeLessThan(5);
  const next = game.state.track.nextId;
  advanceLongDrive(game, 1, { accelerating: true });
  expect(game.state.track.slices.every(slice => slice.id >= next - 4)).toBe(true);
  expect(game.state.track.consumed.size).toBeLessThan(5);
});

// Shared immutable expectations consumed by Go and TypeScript.
test('shared xorshift vectors and timed track fixtures match exactly', () => {
  const track = createTrack(fixture.seed);
  expect(fixture.words.map(() => { draw(track); return track.randomState; })).toEqual(fixture.words);
  for (const invalid of [0, -1, 1.5, 4294967296, NaN]) expect(() => createLongDrive(invalid)).toThrow('nonzero uint32');
  const game = createLongDrive(fixture.seed); game.state.status = 'playing';
  advanceLongDrive(game, 1, {}); advanceLongDrive(game, .97, {});
  for (const [index, expected] of fixture.opportunities.entries()) {
    const actual = game.state.track.slices[index];
    expect({ id: actual.id, timeUs: actual.timeUs, cells: actual.cells }).toEqual({ id: expected.id, timeUs: expected.timeUs, cells: expected.cells });
    expect(Math.abs(actual.distance - expected.distance)).toBeLessThanOrEqual(fixture.precision.absolute + fixture.precision.relative * Math.abs(expected.distance));
  }
});

test('seeded contact identities, consumption and canonical times agree at 30/60/120 FPS', () => {
  const run = (fps: number) => {
    const game = createLongDrive(5408, { gameplay: { obstacleDamage: 0 } });
    game.state.status = 'playing';
    const events = [];
    for (let frame = 0; frame < 4 * fps; frame++) {
      events.push(...advanceLongDrive(game, 1 / fps, { accelerating: true }).map(({ type, objectId, timeUs }) => ({ type, objectId, timeUs })));
    }
    return { events, score: game.state.score, hp: game.state.health,
      nextId: game.state.track.nextId, consumed: [...game.state.track.consumed], randomState: game.state.track.randomState };
  };
  expect(run(30)).toEqual(run(60));
  expect(run(120)).toEqual(run(60));
  expect(run(60).events[0]).toMatchObject({ type: 'coin', objectId: 1 });
});

test('pause freezes a pending spawn opportunity after the difficulty interval shrinks', () => {
  const game = createLongDrive(1, { gameplay: { initialSpawnInterval: 2, spawnIntervalDecrement: 1 } });
  game.state.status = 'playing';
  advanceLongDrive(game, 1, {});
  expect(game.state).toMatchObject({ spawnInterval: 1 });
  advanceLongDrive(game, 0, { pause: true });
  const before = structuredClone(game.state);
  advanceLongDrive(game, 20, {});
  expect(game.state).toEqual(before);
  expect(game.state.track.nextId).toBe(1);
});
