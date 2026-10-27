// @vitest-environment node
import { expect, test } from "vitest";
import { createLongDrive, advanceLongDrive, resetLongDrive } from "@dashdevil/simulation/longDrive";

test("Long Drive captures overrides independently and recaptures them only at reset", () => {
  const overrides = {
    maxHealth: 4,
    startingRoadSpeed: 500,
    maxRoadSpeed: 700,
    roadSpeedIncrement: 0,
    spawnIntervalDecrement: 0,
  };
  const game = createLongDrive(() => 0.5, { gameplay: overrides });
  expect(game.state).toMatchObject({ health: 4, roadSpeed: 500, countdownTimer: 5 });
  overrides.maxHealth = 3;
  overrides.startingRoadSpeed = 600;
  advanceLongDrive(game, 6, {});
  expect(game.state).toMatchObject({ health: 4, roadSpeed: 500 });
  expect(Object.isFrozen(game.configuration.gameplay)).toBe(true);
  resetLongDrive(game, { gameplay: overrides });
  expect(game.state).toMatchObject({ health: 3, roadSpeed: 600, countdownTimer: 3 });
  const independent = createLongDrive(() => 0.5);
  expect(independent.state).toMatchObject({ health: 2, roadSpeed: 400 });
});

// Fixtures carry owner-approved literal expectations, shared with future Go validation.
import fixtures from "../../../../packages/contracts/configuration/fixtures.json";
import {
  captureConfiguration,
  type Mode,
  type ConfigurationOverrides,
} from "@dashdevil/simulation/config";
test.each(["drag-race", "road-rage"] as const)(
  "%s captures a default one-second round-over delay and immutable overrides",
  (mode) => {
    expect(captureConfiguration(mode).presentation.roundOverDelay).toBe(1);
    const overrides = { presentation: { roundOverDelay: 2.5 } };
    const captured = captureConfiguration(mode, overrides);
    overrides.presentation.roundOverDelay = 4;
    expect(captured.presentation.roundOverDelay).toBe(2.5);
  },
);
for (const scenario of fixtures.valid) {
  test(scenario.name, () => {
    const configuration = captureConfiguration(
      scenario.mode as Mode,
      scenario.overrides as ConfigurationOverrides<Mode>,
    );
    expect(configuration.gameplay).toMatchObject(scenario.expected);
    expect(Object.isFrozen(configuration)).toBe(true);
  });
}
for (const scenario of fixtures.invalid) {
  test(`rejects ${scenario.name}`, () => {
    expect(() =>
      captureConfiguration(
        scenario.mode as Mode,
        scenario.overrides as ConfigurationOverrides<Mode>,
      ),
    ).toThrow(scenario.error);
  });
}
test.each([NaN, Infinity, -Infinity, undefined, "2", Number.MAX_SAFE_INTEGER + 1])(
  "rejects unsupported maximum HP %s explicitly",
  (value) => {
    expect(() => createLongDrive(() => 0.5, { gameplay: { maxHealth: value as number } })).toThrow(
      "gameplay.maxHealth",
    );
  },
);
test("rejects overflowing derived speed and weight totals", () => {
  expect(() =>
    captureConfiguration("long-drive", { gameplay: { maxRoadSpeed: Number.MAX_VALUE } }),
  ).toThrow("gameplay.maxRoadSpeed");
  expect(() =>
    captureConfiguration("long-drive", {
      gameplay: { obstacleWeight: Number.MAX_VALUE, coinWeight: Number.MAX_VALUE },
    }),
  ).toThrow("gameplay.weights");
});

test("validated weights disable types and optional hearts heal exactly one up to captured HP", () => {
  const game = createLongDrive(() => 0.4, {
    gameplay: {
      coinWeight: 0,
      obstacleWeight: 0,
      heartWeight: 1,
      maxHealth: 4,
      roadSpeedIncrement: 0,
      spawnIntervalDecrement: 0,
    },
  });
  advanceLongDrive(game, 6, {});
  expect(game.state.coins).toHaveLength(0);
  expect(game.state.obstacles).toHaveLength(0);
  expect(game.state.hearts).toHaveLength(1);
  Object.assign(game.state, {
    canvasWidth: 606,
    canvasHeight: 806,
    carY: 686,
    carYBase: 686,
    health: 2,
  });
  // #26 fixture placement uses a world center; y is now view-only.
  game.state.hearts = [{ ...game.state.hearts[0], distance: 432, y: 680 }];
  expect(advanceLongDrive(game, 1 / 60, {}).map((event) => event.type)).toEqual(["heart"]);
  expect(game.state.health).toBe(3);
  expect(game.state.hearts).toHaveLength(0);
  game.state.hearts.push({ id: 99, lane: 1, y: 680, width: 28, height: 28 });
  game.state.health = 4;
  advanceLongDrive(game, 1 / 60, {});
  expect(game.state.health).toBe(4);
  expect(game.state.hearts).toHaveLength(0);
  const empty = createLongDrive(() => 0.5, {
    gameplay: { emptyWeight: 1, coinWeight: 0, obstacleWeight: 0 },
  });
  advanceLongDrive(empty, 8, {});
  expect(empty.state.coins).toEqual([]);
  expect(empty.state.obstacles).toEqual([]);
  expect(empty.state.hearts).toEqual([]);
});
test("zero damage and zero protection are playable and disabled blink cannot stall", () => {
  const game = createLongDrive(() => 0.5, {
    gameplay: { obstacleDamage: 0, invincibleDuration: 0 },
    presentation: { blinkCount: 0 },
  });
  Object.assign(game.state, {
    status: "playing",
    canvasWidth: 606,
    carY: 686,
    carYBase: 686,
    obstacles: [{ id: 1, lane: 1, y: 680, width: 48, height: 40 }],
  });
  expect(advanceLongDrive(game, 1 / 60, {})).toEqual([]);
  expect(game.state.health).toBe(2);
  expect(game.state.obstacles).toEqual([]);
  expect(game.state.invincibleTimer).toBe(0);
  const noBlink = createLongDrive(() => 0.5, { presentation: { blinkCount: 0 } });
  Object.assign(noBlink.state, { status: "playing", invincibleTimer: 2 });
  advanceLongDrive(noBlink, 1, {});
  expect(noBlink.state.carVisible).toBe(true);
});
test("invalid reset preserves the active captured game atomically", () => {
  const game = createLongDrive(() => 0.5);
  advanceLongDrive(game, 6, {});
  const state = structuredClone(game.state);
  const settings = game.configuration;
  expect(() => resetLongDrive(game, { gameplay: { initialSpawnInterval: 0 } })).toThrow(
    "gameplay.initialSpawnInterval",
  );
  expect(game.state).toEqual(state);
  expect(game.configuration).toBe(settings);
});

test("rejects unrepresentable canonical timing and coverage without inventing a speed cap", () => {
  expect(() => captureConfiguration("road-rage", { gameplay: { timeLimit: 1e-7 } })).toThrow(
    "gameplay.timeLimit",
  );
  expect(() =>
    captureConfiguration("road-rage", { gameplay: { sliceSpacing: Number.MIN_VALUE } }),
  ).toThrow("gameplay.sliceSpacing");
  expect(() => captureConfiguration("road-rage", { gameplay: { maxRoadSpeed: 1e20 } })).toThrow(
    "gameplay.maxRoadSpeed",
  );
  expect(() => captureConfiguration("road-rage", { connection: { baselineBytes: 1 } })).toThrow(
    "connection.baselineBytes",
  );
  expect(
    captureConfiguration("road-rage", { gameplay: { maxRoadSpeed: 10000 } }).gameplay.maxRoadSpeed,
  ).toBe(10000);
});
test("configuration objects and mode names reject malformed shapes instead of using defaults", () => {
  expect(() => captureConfiguration("unknown" as Mode)).toThrow("mode");
  expect(() =>
    captureConfiguration("long-drive", { gameplay: null } as unknown as ConfigurationOverrides),
  ).toThrow("gameplay");
  expect(() => captureConfiguration("long-drive", { other: {} } as ConfigurationOverrides)).toThrow(
    "other",
  );
});

test.each([0, 0.5])(
  "disabled ordinary shake and fatal multiplier %s keep rendering finite",
  (multiplier) => {
    const game = createLongDrive(() => 0.5, {
      presentation: {
        shakeDuration: 0,
        gameOverShakeDuration: 0.5,
        gameOverShakeMultiplier: multiplier,
      },
    });
    Object.assign(game.state, {
      status: "playing",
      health: 1,
      canvasWidth: 606,
      carY: 686,
      carYBase: 686,
      obstacles: [{ lane: 1, y: 680, width: 48, height: 40 }],
    });
    advanceLongDrive(game, 1 / 60, {});
    expect(game.state.status).toBe("gameover");
    advanceLongDrive(game, 0.1, {});
    expect(Number.isFinite(game.state.shakeOffsetX)).toBe(true);
    expect(Number.isFinite(game.state.shakeOffsetY)).toBe(true);
    advanceLongDrive(game, 0.4, {});
    expect(game.state.gameOverAnimDone).toBe(true);
  },
);
