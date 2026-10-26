import { expect, test, vi } from "vitest";
import { advanceLongDrive, createLongDrive } from "@dashdevil/simulation/longDrive";
import { captureConfiguration, renderingConfig } from "@dashdevil/simulation/config";
import { renderLongDrive } from "../../src/lib/gameRenderer";
import { Multiplayer } from "@dashdevil/simulation/multiplayer";
import { longDriveObjectY, multiplayerRoadScale } from "../../src/lib/roadProjection";
import { drawObstacle } from "../../src/lib/renderUtils";

vi.mock("../../src/lib/renderUtils", () => ({
  drawRoad: vi.fn(),
  drawCar: vi.fn(),
  drawCoin: vi.fn(),
  drawHeart: vi.fn(),
  drawObstacle: vi.fn(),
  drawGameOver: vi.fn(),
}));

for (const accelerating of [false, true])
  for (const height of [600, 806, 1440, 2160]) {
    test(`Long Drive obstacles enter above the top at ${height}px (accelerating=${accelerating})`, () => {
      const game = createLongDrive(() => 0.5, { gameplay: { coinWeight: 0, obstacleWeight: 1 } });
      const config = renderingConfig(game.configuration);
      Object.assign(game.state, {
        status: "playing",
        canvasHeight: height,
        carYBase: height - config.carHeight - config.carBottomMargin,
        carY: height - config.carHeight - config.carBottomMargin,
      });
      advanceLongDrive(game, 1, { accelerating });
      renderLongDrive({} as CanvasRenderingContext2D, 606, height, game.state, config);
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

test("tall-screen projection preserves sprite size and exact contact edges while accelerating", () => {
  for (const offset of [0, 80]) {
    const carY = 2040 - offset;
    const height = 40;
    const carHeight = 80;
    const y = longDriveObjectY((carHeight + height) / 2, height, carY, carHeight, 2040, 686);
    expect(y + height).toBe(carY);
  }
});
