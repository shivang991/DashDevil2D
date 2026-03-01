# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `client/`:

```sh
pnpm dev        # Start Vite dev server
pnpm build      # Type-check (tsc -b) then production build
pnpm lint       # ESLint
pnpm preview    # Preview production build
```

Always use **pnpm**. Never npm or yarn.

Add shadcn components with: `pnpm dlx shadcn@latest add <component>`

## Architecture

Monorepo with `client/` (React SPA) and `server/` (empty placeholder for future multiplayer backend).

### Game engine vs React layer

The codebase separates game logic from React. These are two distinct layers:

- **`src/game/`** — Pure TypeScript, no React imports. Contains the game engine, input handling, state, and canvas rendering. This is framework-independent and testable in isolation.
- **`src/hooks/useGameCanvas.ts`** — The bridge. Wires a canvas ref to the `GameEngine` lifecycle (start on mount, stop on unmount, resize handling).
- **`src/screens/GameScreen.tsx`** — Owns the `update()` and `render()` callbacks passed to the engine. Also renders the React UI layer (HUD, overlays) on top of the canvas.

### Game loop flow

`GameEngine` runs a `requestAnimationFrame` loop. Each frame:
1. Computes delta time (capped at 100ms)
2. Calls `update(dt, input)` if not paused — this mutates `GameStateManager`
3. Calls `render(ctx, width, height)` — reads state and draws to canvas

### GameStateManager (`game/state.ts`)

Single class with all-public fields. All game state lives here: player position, health, score, road speed, spawn timers, object arrays, game status. The `update` function in GameScreen mutates this directly.

All numbers like car speed when accelerating, number of default hitpoints, hit box sizes, etc. should be configurable and put inside this file.


### Rendering pattern

`renderer.ts` exports pure drawing functions that take a canvas context and state. No classes, no retained scene graph — just immediate-mode draw calls each frame. The car is currently a plain rectangle placeholder (will be replaced with sprites).

### UI layer

React components overlay the canvas for HUD elements (health, score, branding, instruction text). The canvas handles only game rendering. All player controls are keyboard-based (arrows/WASD for lanes, Space for pause, Enter for restart after game over).

## Conventions

- **Path alias**: `@/` maps to `src/` — use it for all imports (e.g., `import { GameEngine } from "@/game/engine"`)
- **TypeScript strict mode** with `erasableSyntaxOnly` — do NOT use constructor parameter properties (`private x: T`). Declare fields explicitly on the class body.
- **shadcn components** go in `src/components/ui/` — these are auto-generated, don't hand-edit them
- **Game logic** belongs in `src/game/`, never import React there
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — no PostCSS config or `tailwind.config.ts` needed
