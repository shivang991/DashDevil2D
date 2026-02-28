# Agents

Instructions for AI agents working on this codebase.

## Project Overview

2D browser game built with React 19 + TypeScript + Vite. Canvas rendering uses raw HTML5 Canvas API (no abstraction libraries). UI overlays use shadcn/ui + Tailwind CSS v4.

## Structure

```
client/          # Frontend SPA (Vite + React + TypeScript)
  src/
    game/        # Game engine — pure TypeScript, no React dependency
    hooks/       # React hooks (bridge between React and game engine)
    screens/     # Full-screen views (GameScreen, menus, etc.)
    components/  # React UI components
    components/ui/  # shadcn/ui components (auto-generated, don't edit manually)
    lib/         # Utilities (cn(), etc.)
server/          # Backend (future — currently empty)
```

## Commands

All commands run from `client/`:

```sh
pnpm dev       # Start dev server (http://localhost:5173)
pnpm build     # Type-check + production build
pnpm lint      # ESLint
pnpm preview   # Preview production build
```

## Package Manager

Always use **pnpm**. Never use npm or yarn.

## Key Conventions

- **Game logic lives in `src/game/`** — pure TypeScript classes, no React imports. This keeps the engine testable and framework-independent.
- **React ↔ engine bridge** — use hooks in `src/hooks/` (e.g., `useGameCanvas`) to connect canvas refs and lifecycle to the engine.
- **UI overlays** — menus, HUD, dialogs go in React components layered on top of the canvas via absolute positioning. Use shadcn/ui components.
- **Path alias** — use `@/` to import from `src/` (e.g., `import { GameEngine } from "@/game/engine"`).
- **TypeScript strict mode** is enabled with `erasableSyntaxOnly` — do not use parameter properties (`private x: T` in constructors). Declare fields explicitly.
- **shadcn components** — add via `pnpm dlx shadcn@latest add <component>`. Don't hand-write files in `components/ui/`.

## Game Engine Architecture

- `GameEngine` (`game/engine.ts`) — owns the `requestAnimationFrame` loop, delta-time calculation, pause state, and `InputManager`.
- `InputManager` (`game/input.ts`) — tracks pressed keys via `keydown`/`keyup`. Query with `isKeyDown(key)`.
- Renderer helpers (`game/renderer.ts`) — `clear()`, `drawRect()`, `drawCircle()`, `drawText()`.
- Game logic is passed to the engine as `update(dt, input)` and `render(ctx, width, height)` callbacks.

## Adding New Game Features

1. Define types/interfaces in `game/types.ts`.
2. Write update/render logic as pure functions or classes in `game/`.
3. Wire into `GameScreen.tsx` (or a new screen) via the `useGameCanvas` hook.
4. For UI elements (health bar, score, menus), use React + shadcn overlaid on the canvas.

## Tech Stack

- React 19, TypeScript 5.9, Vite 7
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- shadcn/ui (new-york style, lucide icons)
- Raw Canvas 2D API for game rendering
