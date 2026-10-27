import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext, initialBaseline } from "@dashdevil/contracts/validation";
import { RaceSession } from "../../src/game/RaceSession";
import { RaceView } from "../../src/components/RaceView";
import type { PairedConnection, PairedState } from "../../src/transport/PairedConnection";

for (const mode of ["drag-race", "road-rage"] as const)
  for (const seat of [0, 1])
    test(`${mode} seat ${seat}: obstacle scrolling and per-car damage effects`, () => {
      const configuration = captureConfiguration(mode);
      const context = configurationContext(configuration, 1, 1000000);
      const baseline = initialBaseline(context);
      baseline.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
      const frame = new RaceSession(baseline).frame(0, 0);
      frame.objects = [{ id: 1, lane: 1, distance: 500, flags: 2 }];
      const connection = {
        frame: () => frame,
        releaseControls: vi.fn(),
        recordDraw: vi.fn(),
      } as unknown as PairedConnection;
      const state = {
        context,
        identity: { ...baseline.identity, seat },
        status: "Connected",
      } as PairedState;
      const fillRect = vi.fn();
      const ctx = {
        fillRect,
        save: vi.fn(),
        restore: vi.fn(),
        setLineDash: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
      let draw: FrameRequestCallback;
      const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        draw = callback;
        return 1;
      });
      const random = vi.spyOn(Math, "random").mockReturnValue(1);
      const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      try {
        act(() =>
          root.render(
            createElement(RaceView, {
              connection,
              state,
              suspended: false,
              onLeave: () => {},
            }),
          ),
        );
        const g = context.gameplay;
        const obstacleWidth = (g.obstacleW * 560) / (g.laneSpacing * 3.9);
        for (const height of [600, 1440, 2160]) {
          host.querySelector("canvas")!.height = height;
          let previousY: number | undefined;
          let previousStep: number | undefined;
          let crossedBottom = false;
          // Fixed world travel, from above the view through the entire lower edge.
          for (let progress = 0; progress < 1600; progress += 2) {
            frame.renderedCars[seat].progress = progress;
            fillRect.mockClear();
            act(() => draw!(0));
            const obstacle = fillRect.mock.calls.find(
              (call) => Math.abs(Number(call[2]) - obstacleWidth) < 1e-8,
            );
            if (!obstacle) continue;
            const y = obstacle[1] as number;
            if (previousY !== undefined) {
              const step = y - previousY;
              expect(step).toBeGreaterThan(0);
              if (previousStep !== undefined) expect(step).toBeCloseTo(previousStep, 8);
              previousStep = step;
            }
            if (y >= height) crossedBottom = true;
            previousY = y;
          }
          expect(crossedBottom).toBe(true);
        }
        const carWidth = (g.carWidth * 560) / (g.laneSpacing * 3.9);
        const carsAt = (time: number) => {
          fillRect.mockClear();
          act(() => draw!(time));
          return fillRect.mock.calls.filter((call) => Math.abs(Number(call[2]) - carWidth) < 1e-8);
        };
        const before = carsAt(0);
        expect(before).toHaveLength(2);
        frame.cars[seat].hp--;
        frame.feedback = ["Obstacle hit"];
        const hit = carsAt(10);
        expect(hit[seat][0]).not.toBe(before[seat][0]);
        expect(hit[1 - seat]).toEqual(before[1 - seat]);
        expect(host.querySelector('[data-testid="object-feedback"]')).toBeNull();
        // First hidden phase, followed by complete recovery without another HP drop.
        expect(carsAt(410)).toHaveLength(1);
        expect(carsAt(2210)).toEqual(before);
        frame.cars[1 - seat].hp--;
        expect(carsAt(2220)[1 - seat][0]).not.toBe(before[1 - seat][0]);
        expect(carsAt(2620)).toHaveLength(1);
      } finally {
        act(() => root.unmount());
        host.remove();
        contextSpy.mockRestore();
        raf.mockRestore();
        cancel.mockRestore();
        random.mockRestore();
      }
    });
