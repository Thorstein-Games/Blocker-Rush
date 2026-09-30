# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Blocker Rush is a sliding-block puzzle game. This repo is an npm workspaces monorepo (Node 20, see `.nvmrc`) containing only the client; multiplayer is served by the separate `megingjord` Colyseus server (room `blocker_rush`, `BlockerRushRoom`), reached via `NEXT_PUBLIC_GAME_SERVER_URL`.

## Layout

- `apps/web` — Next.js 14 app (App Router). Casual mode in `app/casual`, multiplayer in `app/multiplayer`; the Colyseus client lives in `components/multiplayer/useMultiplayerSocket.ts`.
- `packages/shared` (`@blocker-rush/shared`) — game-agnostic puzzle logic: board, pieces, rules, solver, difficulty, puzzle dataset (`src/data`).
- `packages/protocol` (`@blocker-rush/protocol`) — shared domain/message types for client ↔ server.

Workspace packages export their TypeScript `src` directly; no build step is needed for the web app to consume them.

## Commands

```bash
npm run dev          # Next.js dev server on :3000
npm run build        # production build of apps/web
npm run typecheck    # typecheck web + build shared/protocol
npm run verify       # typecheck + shared lint (run before committing)
npm run gen-puzzles  # regenerate puzzle dataset
npm run test:e2e -w apps/web   # Playwright e2e (needs megingjord running for multiplayer)
```
