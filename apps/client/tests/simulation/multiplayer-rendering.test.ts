import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { captureConfiguration } from "@dashdevil/simulation/config";
import { configurationContext, initialBaseline } from "@dashdevil/contracts/validation";
import { RaceSession } from "../../src/game/RaceSession";
import { MultiplayerRaceDrawing } from "../../src/game/MultiplayerRaceDrawing";
import { RaceView } from "../../src/components/RaceView";
import type { PairedState } from "../../src/transport/PairedConnection";

function fixture(mode: "drag-race" | "road-rage" = "drag-race") {
  const context = configurationContext(captureConfiguration(mode), 1, 1000000);
  const baseline = initialBaseline(context);
  baseline.windows = [{ start: -200, end: 5000, firstSlice: 0, lastSlice: 0, objects: [] }];
  const frame = new RaceSession(baseline).frame(0, 0);
  frame.objects = [{ id: 1, lane: 1, distance: 500, flags: 2 }];
  const fillRect = vi.fn(),
    fillText = vi.fn(),
    rotate = vi.fn();
  const ctx = {
    fillRect,
    fillText,
    rotate,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  return { context, baseline, frame, ctx, fillRect, fillText, rotate };
}

for (const mode of ["drag-race", "road-rage"] as const)
  for (const seat of [0, 1])
    test(`${mode} seat ${seat}: obstacle scrolling and per-car damage effects`, () => {
      const { context, frame, ctx, fillRect, rotate } = fixture(mode);
      const random = vi.spyOn(Math, "random").mockReturnValue(1);
      const drawing = new MultiplayerRaceDrawing(context, seat);
      let height = 600;
      const draw = (time: number) => drawing.draw(ctx, 560, height, frame, time);
      try {
        const g = context.gameplay;
        const obstacleWidth = (g.obstacleW * 560) / (g.laneSpacing * 3.9);
        for (const availableHeight of [600, 1440, 2160]) {
          height = availableHeight;
          let previousY: number | undefined;
          let previousStep: number | undefined;
          let crossedBottom = false;
          // Fixed world travel, from above the view through the entire lower edge.
          for (let progress = 0; progress < 1600; progress += 2) {
            frame.renderedCars[seat].progress = progress;
            fillRect.mockClear();
            draw(0);
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
          draw(time);
          return fillRect.mock.calls.filter((call) => Math.abs(Number(call[2]) - carWidth) < 1e-8);
        };
        frame.renderedCars[seat].tilt = 0.35;
        rotate.mockClear();
        const before = carsAt(0);
        expect(rotate.mock.calls.map(([angle]) => angle)).toEqual(
          seat === 0 ? [0.35, 0] : [0, 0.35],
        );
        expect(before).toHaveLength(2);
        frame.cars[seat].hp--;
        frame.feedback = ["Obstacle hit"];
        const hit = carsAt(10);
        expect(hit[seat][0]).not.toBe(before[seat][0]);
        expect(hit[1 - seat]).toEqual(before[1 - seat]);
        // First hidden phase, followed by complete recovery without another HP drop.
        expect(carsAt(410)).toHaveLength(1);
        expect(carsAt(2210)).toEqual(before);
        frame.cars[1 - seat].hp--;
        expect(carsAt(2220)[1 - seat][0]).not.toBe(before[1 - seat][0]);
        expect(carsAt(2620)).toHaveLength(1);
      } finally {
        random.mockRestore();
      }
    });

for (const mode of ["drag-race", "road-rage"] as const)
  for (const seat of [0, 1]) {
    test(`${mode} seat ${seat}: spent objects and pickups across resizing`, () => {
      const { context, frame, ctx, fillRect, fillText } = fixture(mode);
      const drawing = new MultiplayerRaceDrawing(context, seat);
      for (const [width, height] of [
        [320, 600],
        [1040, 1440],
        [560, 600],
      ]) {
        const obstacleWidth =
          (context.gameplay.obstacleW * width) / (context.gameplay.laneSpacing * 3.9);
        const drawFlags = (flags: number, distance = frame.renderedCars[seat].progress) => {
          frame.objects = [{ id: 1, lane: 1, distance, flags }];
          fillRect.mockClear();
          fillText.mockClear();
          drawing.draw(ctx, width, height, frame, 0);
          return fillRect.mock.calls.filter(
            (call) => Math.abs(Number(call[2]) - obstacleWidth) < 1e-8,
          );
        };
        expect(drawFlags(2)).toHaveLength(2);
        expect(drawFlags(2 | (8 << (1 - seat)))).toHaveLength(2);
        expect(drawFlags(2 | (8 << seat))).toHaveLength(0);
        expect(drawFlags(2, 1e9)).toHaveLength(0);
        expect(drawFlags(2, -1e9)).toHaveLength(0);
        for (const [kind, glyph] of [
          [1, "●"],
          [3, "♥"],
        ] as const) {
          drawFlags(kind);
          expect(fillText.mock.calls.some(([text]) => text === glyph)).toBe(true);
          drawFlags(kind | 4);
          expect(fillText.mock.calls.some(([text]) => text === glyph)).toBe(false);
        }
      }
    });

    test(`${mode} seat ${seat}: rendered camera, finish and rival indicators`, () => {
      const { context, frame, ctx, fillRect, fillText } = fixture(mode);
      const drawing = new MultiplayerRaceDrawing(context, seat);
      const rival = 1 - seat;
      frame.objects = [];
      // Predicted positions deliberately differ: only rendered positions move the drawing.
      frame.renderedCars[seat].progress = context.gameplay.finishDistance;
      for (const [offset, arrow, hp] of [
        [1e6, "▲ Rival", context.gameplay.maxHealth + 1],
        [-1e6, "▼ Rival", -1],
      ] as const) {
        frame.renderedCars[rival].progress = frame.renderedCars[seat].progress + offset;
        frame.renderedCars[rival].lateral = offset;
        frame.cars[rival].hp = hp;
        fillRect.mockClear();
        fillText.mockClear();
        // Fresh lifetime avoids treating the test's HP extremes as damage.
        new MultiplayerRaceDrawing(context, seat).draw(ctx, 560, 600, frame, 0);
        const texts = fillText.mock.calls.map(([text]) => text);
        expect(texts.includes("FINISH")).toBe(mode === "drag-race");
        expect(texts).toContain(arrow);
        const bar = fillRect.mock.calls.find((call) => call[3] === 8)!;
        expect(bar).toBeDefined();
        expect(bar[0]).toBeGreaterThanOrEqual(8);
        expect(bar[0] + bar[2]).toBeLessThanOrEqual(552);
        expect(bar[1]).toBeGreaterThanOrEqual(30);
        expect(bar[1] + 8).toBeLessThanOrEqual(600);
        expect(bar[2]).toBe(
          hp < 0
            ? 0
            : Math.max(
                64,
                (context.gameplay.carWidth * 560) / (context.gameplay.laneSpacing * 3.9),
              ),
        );
      }
      frame.renderedCars[seat].progress = 0;
      frame.renderedCars[rival] = { ...frame.renderedCars[seat] };
      fillText.mockClear();
      drawing.draw(ctx, 560, 600, frame, 3000);
      expect(fillText.mock.calls.map(([text]) => text)).not.toContain("FINISH");
      expect(fillText.mock.calls.map(([text]) => text)).not.toContain("▲ Rival");
      expect(fillText.mock.calls.map(([text]) => text)).not.toContain("▼ Rival");
    });
  }

test("damage history starts at first HP, updates on healing, and resets with a new lifetime", () => {
  const { context, frame, ctx, fillRect } = fixture();
  const random = vi.spyOn(Math, "random").mockReturnValue(1);
  const carWidth = (context.gameplay.carWidth * 560) / (context.gameplay.laneSpacing * 3.9);
  let drawing = new MultiplayerRaceDrawing(context, 0);
  const carsAt = (time: number) => {
    fillRect.mockClear();
    drawing.draw(ctx, 560, 600, frame, time);
    return fillRect.mock.calls.filter((call) => Math.abs(Number(call[2]) - carWidth) < 1e-8);
  };
  try {
    frame.cars[0].hp = 1;
    const initial = carsAt(0);
    expect(initial).toHaveLength(2);
    expect(initial[0][0]).toBeCloseTo(
      280 +
        (frame.renderedCars[0].lateral * 560) / (context.gameplay.laneSpacing * 3.9) -
        carWidth / 2,
    );
    frame.cars[0].hp = 2;
    expect(carsAt(10)).toEqual(initial);
    frame.cars[0].hp = 1;
    expect(carsAt(20)[0][0]).not.toBe(initial[0][0]);
    expect(carsAt(420)).toHaveLength(1);
    drawing = new MultiplayerRaceDrawing(context, 0);
    expect(carsAt(420)).toEqual(initial);
  } finally {
    random.mockRestore();
  }
});

test("zero shake and blink settings keep damaged cars visible and stationary", () => {
  const { context, frame, ctx, fillRect } = fixture();
  Object.assign(context.presentation, { shakeDuration: 0, blinkCount: 0 });
  const drawing = new MultiplayerRaceDrawing(context, 0);
  drawing.draw(ctx, 560, 600, frame, 0);
  const before = fillRect.mock.calls.slice();
  frame.cars[0].hp--;
  for (const time of [10, 410, 2210]) {
    fillRect.mockClear();
    drawing.draw(ctx, 560, 600, frame, time);
    expect(fillRect.mock.calls).toEqual(before);
  }
});

test("RaceView reuses drawing history, acquires each frame once, and cancels on unmount", () => {
  const { context, baseline, frame, ctx } = fixture();
  const connection = {
    frame: vi.fn(() => frame),
    input: vi.fn(),
    releaseControls: vi.fn(),
    recordDraw: vi.fn(),
    recordResultCommit: vi.fn(),
  };
  const state = { context, identity: baseline.identity, status: "Connected" } as PairedState;
  const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
  const drawingSpy = vi.spyOn(MultiplayerRaceDrawing.prototype, "draw");
  let next: FrameRequestCallback;
  let handle = 0;
  const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    next = callback;
    return ++handle;
  });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (suspended = false) =>
    act(() =>
      root.render(
        createElement(RaceView, {
          connection,
          state,
          suspended,
          onLeave: () => {},
        }),
      ),
    );
  try {
    render();
    act(() => next(100));
    render(true);
    act(() => next(200));
    expect(connection.frame).toHaveBeenCalledTimes(2);
    expect(connection.recordDraw).toHaveBeenCalledTimes(2);
    expect(drawingSpy).toHaveBeenCalledTimes(2);
    expect(drawingSpy.mock.contexts[0]).toBe(drawingSpy.mock.contexts[1]);
    const canvas = host.querySelector("canvas")!;
    expect(drawingSpy.mock.calls[0]).toEqual([ctx, canvas.width, canvas.height, frame, 100]);
    expect(host.querySelector('[data-testid="object-feedback"]')).toBeNull();
    state.context = { ...context };
    render();
    act(() => next(300));
    expect(drawingSpy.mock.contexts[2]).not.toBe(drawingSpy.mock.contexts[0]);
  } finally {
    act(() => root.unmount());
    expect(cancel).toHaveBeenLastCalledWith(handle);
    host.remove();
    contextSpy.mockRestore();
    drawingSpy.mockRestore();
    raf.mockRestore();
    cancel.mockRestore();
  }
});
