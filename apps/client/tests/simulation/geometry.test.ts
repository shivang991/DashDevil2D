// @vitest-environment node
import { expect, test } from 'vitest';
import { firstContact, chronologicalContacts } from '@dashdevil/simulation/geometry';

test('continuous strict AABB finds crossing contact but excludes a mere edge touch', () => {
  const car = { left: 0, right: 50, top: 682, bottom: 762 };
  const moving = { left: 1, right: 49, top: 550, bottom: 590 };
  expect(firstContact(car, car, moving, { ...moving, top: 850, bottom: 890 })).toBeCloseTo(0.30666666666666664, 12);
  expect(firstContact(car, car, { ...moving, top: 642, bottom: 682 }, { ...moving, top: 642, bottom: 682 })).toBeNull();
});

test('contacts resolve chronologically and coin precedes damage only at equal time', () => {
  expect(chronologicalContacts([
    { time: 2, kind: 'obstacle', id: 3 }, { time: 1, kind: 'obstacle', id: 2 },
    { time: 2, kind: 'coin', id: 4 }, { time: 1, kind: 'obstacle', id: 1 },
  ])).toEqual([
    { time: 1, kind: 'obstacle', id: 1 }, { time: 1, kind: 'obstacle', id: 2 },
    { time: 2, kind: 'coin', id: 4 }, { time: 2, kind: 'obstacle', id: 3 },
  ]);
});
