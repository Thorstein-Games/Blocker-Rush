# Blocker Rush Implementation Plan (Detailed)

Build a web-first experience with a React/Next.js client and a separate Node/TypeScript WebSocket server in the same repo. The plan emphasizes deterministic, shareable puzzle IDs, precomputed solvable puzzles, and the three required game modes. Multiplayer is server-authoritative with a countdown start and a 30-second rejoin grace period. Daily challenge is computed client-side based on local date and mapped to fixed difficulty tiers.

## Scope

In:

- Core 6x6 board engine, piece transforms (rotate/reflect), and strict placement rules.
- Deterministic puzzle IDs and shareable links.
- Casual, Multiplayer, and Daily Challenge modes.
- Server-authoritative realtime multiplayer (rooms + matchmaking).
- Local-only stats, streaks, and telemetry.
- Keyboard play and basic accessibility for menus.
- UI slots for future ads (no provider integration yet).

Out:

- Cosmetics, themes, skins.
- Leaderboards.
- Offline/PWA support.
- Account system or cloud sync.

## Phase 0 — Repo Layout & Conventions

1. Confirm repo structure: `apps/web` (Next.js) and `apps/server` (Node/TS) or equivalent folders.
2. Establish shared types package (e.g., `packages/shared`) for coordinates, pieces, puzzle IDs, and multiplayer events.
3. Define lint/format tooling and TS configs for client/server/shared.
4. Add a single source of truth for rules versioning.

## Phase 1 — Core Rules & Data Model

1. [x] **Board coordinate system**
   - Grid is 6x6 with columns `A–F` and rows `1–6`.
   - Canonical coordinate order is letter-first then number, e.g., `A1 < A2 < ... < A6 < B1 < ... < F6`.
   - Ensure the engine can expand beyond 6x6 later (board size parameterized).

2. [x] **Pieces**
   - Nine polyomino pieces, each with rotation (0/90/180/270) and reflection support.
   - Represent piece shapes as sets of relative coordinates plus a canonical origin.
   - Precompute all unique transforms per piece for fast placement tests.

3. [x] **Blocker dice model**
   - Hard-code the seven dice faces exactly as specified.
   - Dice faces list:
     - Die 1: A1 C1 D1 D2 E2 F3
     - Die 2: A2 B2 C2 A3 B1 B3
     - Die 3: C3 D3 E3 B4 C4 D4
     - Die 4: E1 F2 F2 B6 A5 A5
     - Die 5: A4 B5 C6 C5 D6 F6
     - Die 6: E4 F4 E5 F5 D5 E6
     - Die 7: F1 F1 F1 A6 A6 A6
   - Blockers are placed by rolling one face from each die.

4. [x] **Puzzle ID format**
   - ID is the canonical list of the 7 blocker coordinates, sorted letter then number.
   - Format: `?p=A1A2B4B6C5D5F1`.
   - Mode is in the path: `/casual`, `/multiplayer` (or `/lobby`), `/daily-challenge`.

5. [x] **Solver & validation**
   - Placement validator is real-time and blocks invalid placements.
   - Maintain a solver to:
     - Validate that each puzzle is solvable.
     - Compute solution count for difficulty scoring.
     - Provide hints in casual mode (constructive guidance).

6. [x] **Difficulty model**
   - Casual difficulty buckets: `easy`, `medium`, `hard`, `insane`.
   - Multiplayer rounds: `easy` → `medium` → `hard`.
   - Daily challenge difficulty by weekday (local time):
     - Mon, Tue = easy
     - Wed, Thu = medium
     - Fri, Sat = hard
     - Sun = insane
   - Store difficulty metadata alongside puzzles in the dataset.

## Phase 2 — Puzzle Dataset Pipeline

1. [x] **Generate all solvable puzzles**
   - Enumerate all 62,208 dice outcomes.
   - Canonicalize each blocker set into its puzzle ID.
   - Run solver validation to guarantee solvable.

2. [x] **Difficulty scoring**
   - Compute a difficulty score using a mix of solver depth, branching, and solution count.
   - Tag each puzzle into difficulty tiers (including `insane`).
   - Keep deterministic tier boundaries so IDs remain stable over time.

3. [x] **Data storage**
   - Store puzzles in a versioned JSON or SQLite file.
   - Include fields: `id`, `blockers`, `difficulty`, `solutionCount`, `rulesVersion`.

4. [x] **Selection helpers**
   - Provide utilities to pick a random puzzle within a difficulty tier.
   - Provide utilities to pick a daily puzzle deterministically from local date and tier.

## Phase 3 — Core Client (Casual Mode)

1. [x] **Board UI and interaction**
   - Drag and drop pieces with “hover ghost” placement.
   - Snap to grid; block invalid placements completely.
   - Tap to cycle rotation on mobile; press and hold to drag.
   - Support reflection (e.g., keyboard `F` or UI toggle).

2. [x] **Game flow**
   - Start from a puzzle ID or random by difficulty selection.
   - Show blockers fixed on the board.
   - Real-time validation for each piece placement.

3. [x] **Hints (casual only)**
   - Constructive hints only.
   - No limit on hint usage.
   - Wire UI for “watch ad for hint” but leave integration stubbed.

4. [x] **Completion**
   - No animations during play.
   - Celebratory effects only after puzzle completion.

5. [x] **Shareable puzzles**
   - “Share” generates text with ASCII solve summary.
   - Link only includes puzzle ID, no solution.

6. [x] **Local telemetry**
   - Store time-to-solve, casual attempts, and settings in localStorage.

## Phase 4 — Daily Challenge

1. [x] **Daily puzzle selection**
   - Deterministic client-side selection based on local date.
   - Use weekday to select difficulty tier.
   - Map date to a puzzle ID within the tier using seeded RNG.

2. [x] **Streaks**
   - Track streak locally.
   - Reset streak on missed day.

3. [x] **End of day**
   - Local midnight rollover triggers new puzzle.

## Phase 5 — Multiplayer Mode (Server-Authoritative)

1. **Server foundation**
   - Node/TypeScript server with WebSocket (Socket.io).
   - Server owns authoritative puzzle state, clocks, and round transitions.

2. **Matchmaking**
   - Public queue and private room codes.
   - Support up to 20 players per room.

3. **Round flow**
   - Countdown start before round begins.
   - All players receive the same puzzle ID for each round.
   - Players who finish instantly advance to the next puzzle.
   - First to complete 3 puzzles wins.

4. **Disconnect handling**
   - 30-second rejoin grace period.
   - Forfeit on timeout.

5. **Anti-cheat**
   - Server checks for impossible completion times.
   - Server validates move sequences and final board states.

6. **Multiplayer stats**
   - Store win/loss and best times locally only.

## Phase 6 — Testing & QA

1. **Unit tests**
   - Piece transforms (rotations/reflections).
   - Placement validity and collision rules.
   - Puzzle ID canonicalization round-trip.

2. **Integration tests**
   - Casual mode complete solve flow.
   - Hint retrieval and undo behavior.

3. **Multiplayer simulation**
   - Join/leave/rejoin flows.
   - Countdown start, round transitions, and winner detection.

4. **Daily challenge**
   - Day boundary logic and streak resets.

5. **Cross-device**
   - Mobile-first usability validation.
   - Performance check in modern browsers.

## Phase 7 — Deployment & Operations (MVP)

1. **Client deploy**
   - Build and host Next.js web app.

2. **Server deploy**
   - Host WebSocket server.
   - Configure CORS and production environment variables.

3. **Monitoring**
   - Basic logging for multiplayer errors and disconnects.
