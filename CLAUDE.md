# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Blocker Rush is a block-placement puzzle game: fit 9 pieces (29 cells) into a 6×6 board with 7 blockers. This repo is an npm workspaces monorepo (Node 20, see `.nvmrc`) containing only the client; multiplayer is served by the separate `megingjord` Colyseus server (room `blocker_rush`, `BlockerRushRoom`), reached via `NEXT_PUBLIC_GAME_SERVER_URL` (dev always uses `ws://localhost:2567`).

## Commands

```bash
npm run verify           # typecheck + lint + unit tests + megingjord drift check (~6s, no servers) — run before committing
npm test                 # unit tests only (vitest, all workspaces)
npm run test:e2e         # Playwright suite; starts megingjord + Next itself (~50s). E2E_NO_MEGINGJORD=1 runs only single-player specs
npm run test:e2e:prod    # *.prod.spec.ts against a production build on :3300 (offline/service worker, manifest)
npm run dev              # Next.js dev server on :3000
npm run sync:megingjord  # copy shared/protocol into megingjord after changing them
```

Single test file: `npx vitest run tests/solver.test.ts` from `packages/shared` (or `apps/web`). Lint currently reports only pre-existing warnings; don't treat those as failures.

## Layout

- `packages/shared` (`@blocker-rush/shared`) — pure puzzle logic: board, pieces/transforms, solver (`solveFromPlacements` solves around pieces already on the board), hints (`findHint`: next placement from the player's current board, or which piece to take back), progress transfer (`transfer.ts`: `encodeTransfer`/`decodeTransfer` pack stats + solve history into a compact base64url string, `mergeProgressData` combines two devices' progress), difficulty, daily puzzle, share text, puzzle dataset. Tests in `packages/shared/tests/`.
- `packages/protocol` (`@blocker-rush/protocol`) — client ↔ server types. `domain.ts` = domain types; `messages.ts` = every `blocker_rush` wire payload (`ServerMessages`, `ClientMessages`).
- `apps/web` — Next.js 14 App Router. Casual mode `app/casual`, multiplayer `app/multiplayer`, daily archive `app/daily` (list) and `app/daily/[date]` (one past day; rendered on first request and cached, invalid or pre-`ARCHIVE_START_KEY` dates 404).
  - `components/DailyGame.tsx` — today's puzzle, or a past day with `archiveDateKey` (own progress and timer, never touches the streak; today's date redirects to `/`, future dates show a gate). localStorage I/O lives in `dailyStorage.ts`; pure date/history helpers in `dailyArchive.ts` (`blockerRush.daily.history` holds moves/time/hints per solved day, today's and archive alike; `summarizeHistory` feeds `DailyStatsPanel`'s per-difficulty times). Best streak is `bestStreak` in the stats entry (`getBestStreak` covers stats saved before it existed).
  - `app/transfer` + `components/ProgressTransfer.tsx` — moving progress between devices with no server: a `/transfer#p=…` link carries the data in its fragment (never sent to a server); opening it offers to merge it into this device. Linked from the daily/archive settings panels; `noindex`. Megingjord never stores player data (its Redis is a restart cache for room state); the only server-side copy is the optional Thorstein Games account below.
  - Cloud saves (`lib/cloudSync.ts`, started by `components/CloudSync.tsx` in the layout): players signed in to a Thorstein Games account (run by the shared `tg-bar.js`, see the thorstein-games-website CLAUDE.md) get their daily stats and solve history on every device. It registers `blockerRush.daily.stats` and `blockerRush.daily.history` with `window.TG.sync`, merging with `mergeProgressData` like a transfer link does; `writeDailyStats`/`writeSolveHistory` call `cloud.save()` through `setProgressWriteHook`, and when another device's progress arrives it fires `blockerRush:progress-synced`, which `DailyGame` and `DailyArchive` re-read on. Boards in progress stay per device. Without the bar (tests, offline) or signed out it does nothing. Tested in `lib/cloudSync.test.ts`.
  - `components/useHint.ts` — the Hint button's behaviour for single-player boards (casual, daily, archive; `PiecesTray onHint`). The daily progress entry saves the hint count, which shows in the completion notice and share text.
  - Offline/PWA: `public/sw.js` (hand-written service worker, registered by `components/ServiceWorker.tsx` in production only, scope `/blocker-rush` via the `Service-Worker-Allowed` header in `next.config.js`). Pages are network-first with a cache fallback, `_next/static` is cache-first, and install precaches `/`, `/casual`, `/daily` plus every static file they reference. Manifest PNG icons come from `app/pwa-icon/[variant]` (rendered from `public/favicon.svg`).
  - `components/GameContext.tsx` — single-player board state + drag/drop/keyboard interaction (types in `gameTypes.ts`, pure helpers in `pieceGeometry.ts`).
    - Placing: a tap, click or Enter on a square puts the selected piece so it covers that square (`placementCovering` in `pieceGeometry.ts`: the piece's middle square first, then the nearest that fits), or on the hint's spot when the square is one the hint outlines. With a mouse, and with the keyboard, a dashed outline (`.ghost.outline`) shows where it will go first. A placed piece's tray slot is a "Take back" button (`takeBack`); double-tap on the board still works.
    - One message line under the board (`.board-feedback` in `GameBoard.tsx`) carries instructions, errors and hint notices (`HintNotice` from `useHint`, with a "Take back the …" button at a dead end). When solved it becomes the solve banner (Norse cheer, `solvedExtra` for the daily's streak and "Next puzzle in …"); nothing covers the finished board.
  - `components/multiplayer/useMultiplayerSocket.ts` — Colyseus connection and actions. If the lobby can't connect it sets `lobbyOffline`, and the landing page shows a Retry (`retryLobby`) and disables joining. The landing page starts from the shared `playerName` (see the hub's CLAUDE.md) and writes it back. Server-message state transitions are pure reducers in `multiplayerReducers.ts` (unit-tested); state shape in `multiplayerTypes.ts`; client/URL/seat-reservation shim in `colyseusClient.ts`.

Workspace packages export their TypeScript `src` directly; no build step is needed for the web app to consume them.

## Megingjord coupling (read before touching shared/protocol)

megingjord can't depend on this repo, so `scripts/sync-megingjord.mjs` writes generated copies into `megingjord/src/games/blocker-rush/{shared,protocol}/` (shared minus client-only `solver`/`puzzle`/`share`). After editing `packages/shared` or `packages/protocol`, run `npm run sync:megingjord` and typecheck megingjord (`pnpm typecheck` there). `verify` fails if the copy is stale; it skips the check if megingjord isn't checked out at `../megingjord` (override with `MEGINGJORD_DIR`).

To add or change a message: edit `packages/protocol/src/messages.ts`, sync, then update the handler in `BlockerRushRoom.ts` (it sends via typed `emit`/`sendTo`) and in `useMultiplayerSocket.ts` + `multiplayerReducers.ts` here. A mismatch fails typecheck on whichever side is out of date.

## Puzzle dataset

`packages/shared/src/data/puzzles.v1.sample.json` (committed, ~1MB, 2000 puzzles per difficulty) is the source of truth. The app and server load `puzzles.v1.compact.json` instead (~140KB, `"<id>:<solutionCount>"` strings grouped by difficulty in sample order), which `node packages/shared/scripts/compact-puzzles.js` derives from the sample; a unit test fails if they drift. Both are hidden from search by `.ignore`; grep them with `rg --no-ignore-dot`. The sample is derived from `fullpuzzles.v1.json` (gitignored): `npm run gen-puzzles` builds the full set (slow, multi-worker), then `npm run refresh-samples` samples it and rewrites the compact copy. Sample order matters: the daily puzzle is a seeded index into each difficulty's list. Difficulty = solution count: insane 1–3, hard 4–10, medium 11–50, easy 51+ (the solver caps at 51). Those ranges are duplicated in `generate-puzzles.js` and `difficulty.ts`, so change both together. Unit tests check that every puzzle's id, blockers and difficulty are consistent.

## Shared Thorstein Games bar and footer

`app/layout.tsx` loads `https://thorsteingames.com/tg-bar.js` (served by the thorstein-games-website repo, whose CLAUDE.md has the full contract) and renders `<tg-bar game="blocker-rush">` (thin site header that hides while scrolling down) above `.app-shell` and `<tg-footer game="blocker-rush">` after it. `<tg-more-games game="blocker-rush">` ("Play a different game") sits under the solved daily/archive and casual puzzles and the finished multiplayer match. JSX types for the tags are in `apps/web/tg-elements.d.ts`.

- The bar is always 40px. `globals.css` holds that space before the script loads (`tg-bar:not(:defined)`), and `.app-shell` / `.no-scroll-mobile` are `100dvh - 40px` so the footer starts below the fold. Keep those in step.
- `NEXT_PUBLIC_TG_BAR_SRC` overrides the script URL; both Playwright configs set it to `""` so tests never load it from production (the tags and the 40px placeholder stay, so layout is unchanged).
- The service worker only handles `/blocker-rush/*`, so offline the bar is simply missing.
- Ads (`<tg-ad>`, rules and options in the thorstein-games-website CLAUDE.md): `layout.tsx` has a `rail` beside `main.page` (every page; from 1200px wide and 672px tall `.page` keeps 192px free on the right for it) and a `banner` between `.app-shell` and the footer; a `box` (`.finish-ad`) sits under each "Play a different game", and one (`.waiting-ad`) under the multiplayer room while players wait (`MultiplayerRoomShell`). Never on the board or tray, or mid-match except the rail beside it. React 18 writes `className` on custom elements as a literal attribute, so the `tg-*` tags take `class`. Check placements with `?tgads=preview`.

## Analytics

Plausible, off unless `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set at build time (not set up in production yet; see the TODO in `lib/analytics.ts`) (`NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC` overrides the script URL). Send custom events with `track()` from `apps/web/lib/analytics.ts`; event names are a union type there.

## E2E gotchas

- `playwright.config.ts` starts megingjord (`pnpm dev` in `MEGINGJORD_DIR`, default `../megingjord`) with `MATCHMAKE_RATE_MAX=1000`. All simulated players share one IP, so megingjord's per-IP matchmake rate limit would otherwise make create/join calls fail silently. If you reuse an already-running megingjord that was started without that env var, you'll see the same failures, and they look like UI bugs.
- `e2e/single-player.spec.ts` covers the daily solve → streak → reload → share flow (it restores 8 pieces of a real solver solution into localStorage, then places the Dot through the UI), daily hydration on a later day with a saved streak, the archive (solving a past day, today/future/invalid dates), tap placement (a tap covers the tapped square, the mouse outline, tapping any hinted square, taking back from the tray), hints (following hints solves the daily; dead-end advice and its Take back button), casual `?p=` links, and that pages load without console errors. `e2e/transfer.spec.ts` moves progress between two browser contexts with a transfer link. `e2e/blocker-rush-multiplayer.spec.ts` covers join, ready, start, kick, reconnect, leave and invite links. Multiplayer gameplay message handling is covered by `multiplayerReducers.test.ts`; daily streak math by `components/dailyStats.test.ts`; the daily solve timer and move/time formatting by `components/dailyTimer.test.ts`. The daily move count and visible solving time are saved in the progress entry in localStorage, so both survive a reload.
- Specs fail on any console error, so a React hydration warning in dev fails them too.
- `e2e/offline.prod.spec.ts` starts and kills its own `next start` on :3301 to go offline: Playwright's `setOffline` doesn't stop a service worker's own fetches in Chromium, so it would pass without testing anything.

## CI

`.github/workflows/ci.yml` runs `npm run verify` and the Playwright suite on every PR. megingjord is private: the e2e job checks it out only if the repo has a `MEGINGJORD_TOKEN` secret, and otherwise runs with `E2E_NO_MEGINGJORD=1`. The megingjord drift check doesn't run in CI.

`.impeccable/` holds Impeccable design-critique snapshots (the skill lives in the thorstein-games-website repo); it skips the Netlify build too.

Netlify builds the site from `main` (settings in the Netlify UI). `netlify.toml` holds only an `ignore` command: pushes that change just docs, tests (`*.test.ts(x)`, `e2e/`, `packages/shared/tests/`), CI, dev scripts or tool settings skip the Netlify build, to save build credits. Paths in it are repo-root based (`:/`); add new test-only paths there. Anything else, including `package.json`, still builds.
