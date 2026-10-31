import { expect, test, vi } from "vitest";
import { advanceLongDrive, createLongDrive } from "@dashdevil/simulation/longDrive";
import { captureConfiguration, renderingConfig } from "@dashdevil/simulation/config";
import { LongDriveDrawing } from "../../src/lib/gameRenderer";
import { Multiplayer } from "@dashdevil/simulation/multiplayer";
import { multiplayerRoadScale } from "../../src/lib/roadProjection";
import { drawCar, drawObstacle } from "../../src/lib/renderUtils";

vi.mock("../../src/lib/renderUtils", () => ({
  drawRoad: vi.fn(),
  drawCar: vi.fn(),
  drawCoin: vi.fn(),
  drawHeart: vi.fn(),
  drawObstacle: vi.fn(),
  drawGameOver: vi.fn(),
}));

for (const accelerating of [false, true])
  for (const availableHeight of [600, 806, 1440, 2160]) {
    const height = Math.min(availableHeight, 806);
    test(`Long Drive obstacles enter above the top at ${availableHeight}px (accelerating=${accelerating})`, () => {
      const game = createLongDrive(() => 0.5, { gameplay: { coinWeight: 0, obstacleWeight: 1 } });
      const config = renderingConfig(game.configuration);
      Object.assign(game.state, {
        status: "playing",
        canvasHeight: height,
        carYBase: height - config.carHeight - config.carBottomMargin,
        carY: height - config.carHeight - config.carBottomMargin,
      });
      advanceLongDrive(game, 1, { accelerating });
      new LongDriveDrawing(config).draw(
        { save: vi.fn(), restore: vi.fn(), scale: vi.fn() } as unknown as CanvasRenderingContext2D,
        606,
        height,
        game.state,
      );
      const call = vi.mocked(drawObstacle).mock.lastCall!;
      expect(call[2] + call[4]).toBeLessThanOrEqual(0.000001);
    });
  }

for (const mode of ["drag-race", "road-rage"] as const) {
  for (const height of [806, 1440, 2160, 4320]) {
    test(`${mode} extends objects outside the visible top at ${height}px`, () => {
      const configuration = captureConfiguration(mode);
      const g = configuration.gameplay;
      const ids = [0, 1].map((seat) => ({
        roomId: 1,
        seatSession: seat + 1,
        pairGeneration: 1,
        seat,
      }));
      const game = new Multiplayer(configuration, 1, ids);
      const scale = multiplayerRoadScale(
        320 / (g.laneSpacing * 3.5),
        height,
        g.maxRoadSpeed * g.accelSpeedMultiplier + g.carHeight / 2,
      );
      let previous = new Set(game.snapshot().objects.map((object) => object.id));
      let checked = 0;
      for (let tick = 1; tick <= 180; tick++) {
        game.advanceTo(tick / g.tickRate);
        const state = game.snapshot();
        for (const object of state.objects) {
          if (previous.has(object.id)) continue;
          const kind = object.flags & 3;
          const size = kind === 2 ? g.obstacleH : kind === 1 ? g.coinSize : g.heartSize;
          const bottom =
            height * 0.76 - (object.distance - state.cars[0].progress) * scale + (size * scale) / 2;
          expect(bottom).toBeLessThanOrEqual(0);
          checked++;
        }
        previous = new Set(state.objects.map((object) => object.id));
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
}

for (const availableHeight of [600, 806, 1440, 2160])
  for (const accelerating of [false, true]) {
    test(`Long Drive constant speed from entry to exit at ${availableHeight}px (accelerating=${accelerating})`, () => {
      const height = Math.min(availableHeight, 806);
      const game = createLongDrive(() => 0.5);
      const config = renderingConfig(game.configuration);
      const base = height - config.carHeight - config.carBottomMargin;
      const offset = accelerating ? config.accelCarOffset : 0;
      Object.assign(game.state, {
        status: "playing",
        canvasHeight: height,
        carYBase: base,
        carY: base - offset,
        carOffset: offset,
        obstacles: [{ id: 1, lane: 0, distance: 900, y: 0, width: 48, height: 40 }],
      });
      const drawing = new LongDriveDrawing(config);
      let scale = 1;
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        scale: (_x: number, y: number) => {
          scale = y;
        },
      } as unknown as CanvasRenderingContext2D;
      const positions: number[] = [];
      for (let progress = 0; progress <= 1100; progress += 5) {
        game.state.roadOffset = progress;
        scale = 1;
        drawing.draw(ctx, 606, height, game.state);
        positions.push(vi.mocked(drawObstacle).mock.lastCall![2] * scale);
      }
      expect(positions[0] + 40 * scale).toBeLessThan(0);
      expect(positions.at(-1)).toBeGreaterThan(height);
      const step = positions[1] - positions[0];
      expect(step).toBeGreaterThan(0);
      for (let i = 2; i < positions.length; i++)
        expect(positions[i] - positions[i - 1]).toBeCloseTo(step, 8);
      // Both contact edges stay aligned under the same transform as the car.
      const contact = (config.carHeight + 40) / 2;
      for (const distance of [contact, -contact]) {
        game.state.obstacles[0].distance = game.state.roadOffset + offset + distance;
        drawing.draw(ctx, 606, height, game.state);
        const obstacle = vi.mocked(drawObstacle).mock.lastCall!;
        const car = vi.mocked(drawCar).mock.lastCall!;
        if (distance > 0) expect(obstacle[2] + obstacle[4]).toBeCloseTo(car[2].carY, 8);
        else expect(obstacle[2]).toBeCloseTo(car[2].carY + car[3].carHeight, 8);
      }
    });
  }

test("missed Long Drive obstacle stays until its top is offscreen", () => {
  const game = createLongDrive(() => 0.5, { gameplay: { roadSpeedIncrement: 0 } });
  Object.assign(game.state, {
    status: "playing",
    canvasHeight: 806,
    carYBase: 686,
    carY: 686,
    obstacles: [{ id: 1, lane: 0, distance: 0, y: 706, width: 48, height: 40 }],
  });
  advanceLongDrive(game, 0.2, {});
  expect(game.state.obstacles.some((object) => object.id === 1)).toBe(true);
  advanceLongDrive(game, 0.1, {});
  expect(game.state.obstacles.some((object) => object.id === 1)).toBe(false);
});

test("Long Drive never stretches the canvas or sprite proportions", () => {
  const game = createLongDrive(1);
  const scale = vi.fn();
  const ctx = { save: vi.fn(), restore: vi.fn(), scale } as unknown as CanvasRenderingContext2D;
  new LongDriveDrawing().draw(ctx, 606, 2160, game.state);
  expect(scale).not.toHaveBeenCalled();
});
