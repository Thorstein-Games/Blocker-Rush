# Blocker Rush Multiplayer MVP Plan (Server-Authoritative, Solo-Advance)

## Summary

Ship a deterministic, typed, server-authoritative realtime race mode by adding a new Socket.io server app, a shared protocol package with runtime validation, and a multiplayer client state layer that reconciles optimistic actions against authoritative snapshots. MVP keeps scope tight: lobby/create/join, public queue (no bot), private rooms, synchronized match start, solo-advance rounds, winner-decided lock-in window, reconnect-with-snapshot, and end results with splits.

## Scope

- In:
  - Realtime multiplayer for up to 8 players.
  - Lobby with room list, join by room code, create private room, and public random matchmaking.
  - Host starts match; server countdown; deterministic per-round puzzle IDs shared by all players.
  - Solo-advance round flow and final-round winner detection.
  - Winner-decided lock-in window and final placements/splits.
  - 30s reconnect grace with authoritative `stateSync` snapshots.
  - Typed protocol (TS discriminated unions + zod validation).
  - Server-authoritative action apply/validate for `place/remove/undo/finish`.
  - Multiplayer HUD with opponent mini-boards and progress.
- Out:
  - Accounts, leaderboards, chat/emotes, spectators, mid-game non-rejoin joins.
  - Multi-instance websocket scaling.
  - Anti-cheat beyond authoritative rules + basic rate limiting.
  - Practice bot for MVP.

## Architecture Overview (Client vs Server)

1. Server responsibilities:
   - Own room lifecycle, host, settings, queue matching, and room status transitions.
   - Generate match rounds (`puzzleId[]`) from deterministic shared dataset.
   - Own authoritative per-player board state and action history.
   - Validate and apply each action; reject invalid or stale packets.
   - Broadcast authoritative per-player snapshots and lifecycle events.
   - Track server timestamps for countdowns, split times, winner decision, lock window.
   - Hold in-memory snapshots for reconnect; evict after grace + room cleanup TTL.
2. Client responsibilities:
   - Render lobby, room, and in-game HUD.
   - Capture discrete actions on drop/remove/undo only (no drag stream).
   - Optimistically render local action on drop, then reconcile to authoritative `playerState` or `actionRejected`.
   - Derive countdown and timers from server timestamps.
   - Persist room resume token locally for reconnect reclaim.

## Public API / Interface Additions

1. Add new workspace package: `/Users/craigwalker/Desktop/code/Blocker-Rush/packages/protocol`.
2. Add new server app: `/Users/craigwalker/Desktop/code/Blocker-Rush/apps/server`.
3. Add multiplayer routes/components in web app:
   - `/Users/craigwalker/Desktop/code/Blocker-Rush/apps/web/app/multiplayer/page.tsx`
   - `/Users/craigwalker/Desktop/code/Blocker-Rush/apps/web/components/multiplayer/*`
4. Keep rule logic single-source in `/Users/craigwalker/Desktop/code/Blocker-Rush/packages/shared/src/*`; server and client both import shared rules/transforms.

## Concrete Data Structures

```ts
// packages/protocol/src/domain.ts
export type RoomStatus =
  | "lobby"
  | "countdown"
  | "in_game"
  | "winner_window"
  | "finished";

export type AdvanceMode = "solo"; // keep enum for upgrade path to "room"

export type MatchSettings = {
  rounds: number; // MVP: 1..3
  difficulties: ("easy" | "medium" | "hard" | "insane")[]; // length === rounds
  advanceMode: AdvanceMode;
  lockInMs: number; // 20000
};

export type PiecePlacement = {
  pieceId: "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7" | "p8" | "p9";
  transformId: string;
  x: number;
  y: number;
};

export type PlayerRoundState = {
  roundIndex: number;
  puzzleId: string;
  startedAt: number; // server epoch ms
  finishedAt?: number; // server epoch ms
  splitMs?: number;
  placedPieces: PiecePlacement[];
  remainingPieceIds: string[];
  boardFilledCount: number;
  history: Array<{
    type: "place" | "remove";
    seq: number;
    pieceId: string;
    prev?: PiecePlacement;
    next?: PiecePlacement;
  }>;
};

export type PlayerState = {
  playerId: string;
  name: string;
  socketId?: string;
  resumeToken: string;
  connected: boolean;
  disconnectedAt?: number;
  graceExpiresAt?: number;
  currentRoundIndex: number; // 0-based
  completedFinal: boolean;
  finalFinishedAt?: number;
  splitsMs: Array<number | null>;
  lastProcessedSeq: number;
  rounds: Record<number, PlayerRoundState>;
};

export type RoundDef = {
  roundIndex: number;
  difficulty: "easy" | "medium" | "hard" | "insane";
  puzzleId: string;
};

export type MatchState = {
  matchId: string;
  startedAt: number; // countdown end / round0 start
  countdownStartAt: number;
  rounds: RoundDef[];
  winnerId?: string;
  winnerDecidedAt?: number;
  lockEndsAt?: number;
};

export type Room = {
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  visibility: "public" | "private";
  settings: MatchSettings;
  players: Record<string, PlayerState>;
  match?: MatchState;
  createdAt: number;
  updatedAt: number;
};
```

## Full Event Schema + Validation Strategy

```ts
// packages/protocol/src/events.ts
export type ClientEvent =
  | {
      type: "joinRoom";
      data: {
        name: string;
        roomCode?: string;
        queue?: "public" | "private";
        settings?: MatchSettings;
        resumeToken?: string;
      };
    }
  | { type: "leaveRoom"; data: {} }
  | { type: "ready"; data: { ready: boolean } }
  | { type: "startMatch"; data: {} } // host only
  | {
      type: "placePiece";
      data: {
        matchId: string;
        roundIndex: number;
        pieceId: string;
        transform: string;
        x: number;
        y: number;
        clientSeq: number;
      };
    }
  | {
      type: "removePiece";
      data: {
        matchId: string;
        roundIndex: number;
        placedId?: string;
        pieceId?: string;
        clientSeq: number;
      };
    }
  | {
      type: "undo";
      data: { matchId: string; roundIndex: number; clientSeq: number };
    }
  | {
      type: "submitFinish";
      data: { matchId: string; roundIndex: number; clientSeq: number };
    }
  | { type: "requestSync"; data: { matchId: string } }
  | { type: "listRooms"; data: {} };

export type ServerEvent =
  | {
      type: "lobbyState";
      data: {
        rooms: Array<{
          roomCode: string;
          hostName: string;
          playerCount: number;
          maxPlayers: number;
          status: RoomStatus;
          settings: MatchSettings;
          visibility: "public" | "private";
        }>;
      };
    }
  | {
      type: "roomState";
      data: {
        roomCode: string;
        players: Array<{
          playerId: string;
          name: string;
          connected: boolean;
          ready: boolean;
        }>;
        hostId: string;
        settings: MatchSettings;
        status: RoomStatus;
      };
    }
  | {
      type: "matchStart";
      data: {
        roomCode: string;
        matchId: string;
        startTime: number;
        rounds: RoundDef[];
        countdownMs: number;
      };
    }
  | {
      type: "roundStart";
      data: {
        roomCode: string;
        matchId: string;
        playerId: string;
        roundIndex: number;
        puzzleId: string;
        startTime: number;
      };
    }
  | {
      type: "playerState";
      data: {
        roomCode: string;
        matchId: string;
        playerId: string;
        roundIndex: number;
        placedPieces: PiecePlacement[];
        remainingPieceIds: string[];
        boardFilledCount: number;
        lastAppliedSeq: number;
        finishedAt?: number;
        splitMs?: number;
      };
    }
  | {
      type: "actionRejected";
      data: {
        roomCode: string;
        matchId: string;
        clientSeq: number;
        reason:
          | "invalid_payload"
          | "rate_limited"
          | "stale_match"
          | "stale_round"
          | "duplicate_seq"
          | "out_of_order_seq"
          | "invalid_transform"
          | "piece_unavailable"
          | "out_of_bounds"
          | "collision"
          | "blocked"
          | "invalid_remove"
          | "invalid_undo"
          | "not_solved";
        authoritativeState?: {
          roundIndex: number;
          placedPieces: PiecePlacement[];
          remainingPieceIds: string[];
          lastAppliedSeq: number;
        };
      };
    }
  | {
      type: "playerFinished";
      data: {
        roomCode: string;
        matchId: string;
        playerId: string;
        roundIndex: number;
        finishedAt: number;
        splitMs: number;
      };
    }
  | {
      type: "winnerDecided";
      data: {
        roomCode: string;
        matchId: string;
        winnerId: string;
        decidedAt: number;
        lockInMs: number;
        lockEndsAt: number;
      };
    }
  | {
      type: "matchResult";
      data: {
        roomCode: string;
        matchId: string;
        winnerId: string;
        placements: Array<{
          playerId: string;
          place: number;
          roundsCompleted: number;
          finalFinishAt?: number;
          status: "finished" | "dnf";
        }>;
        splitsByPlayer: Record<string, Array<number | null>>;
      };
    }
  | {
      type: "stateSync";
      data: {
        roomCode: string;
        now: number;
        status: RoomStatus;
        hostId: string;
        settings: MatchSettings;
        match?: MatchState;
        players: Array<{
          playerId: string;
          name: string;
          connected: boolean;
          currentRoundIndex: number;
          splitsMs: Array<number | null>;
          lastAppliedSeq: number;
          round?: {
            roundIndex: number;
            puzzleId: string;
            startedAt: number;
            finishedAt?: number;
            placedPieces: PiecePlacement[];
            remainingPieceIds: string[];
            boardFilledCount: number;
          };
        }>;
      };
    }
  | { type: "error"; data: { code: string; message: string } };
```

Validation strategy:

1. Use `z.discriminatedUnion("type", [...])` for `ClientEvent` and `ServerEvent`.
2. Parse every inbound client payload before any room lookup or mutation.
3. Use `.strict()` on each object to reject unknown keys.
4. Validate semantic constraints after schema parse:
   - `matchId` equals current room match.
   - `roundIndex` equals player authoritative current round.
   - `clientSeq` monotonic and in-order.
5. Reuse shared enums for difficulty/piece IDs to avoid drift.

Example payloads:

1. `joinRoom`: `{ "type":"joinRoom","data":{"name":"Kai","queue":"public"} }`
2. `startMatch`: `{ "type":"startMatch","data":{} }`
3. `placePiece`: `{ "type":"placePiece","data":{"matchId":"m_9Z","roundIndex":0,"pieceId":"p4","transform":"0,0|1,0|2,0|1,1","x":2,"y":1,"clientSeq":14} }`
4. `actionRejected`: `{ "type":"actionRejected","data":{"roomCode":"A7K2FQ","matchId":"m_9Z","clientSeq":14,"reason":"collision","authoritativeState":{"roundIndex":0,"placedPieces":[],"remainingPieceIds":["p1","p2","p3","p4","p5","p6","p7","p8","p9"],"lastAppliedSeq":14}} }`
5. `winnerDecided`: `{ "type":"winnerDecided","data":{"roomCode":"A7K2FQ","matchId":"m_9Z","winnerId":"u1","decidedAt":1738853200000,"lockInMs":20000,"lockEndsAt":1738853220000} }`

## Authoritative Apply/Validate Flow

1. Common pre-check pipeline for action events (`place/remove/undo/submitFinish`):
   - Parse zod schema.
   - Verify socket is bound to a room/player seat.
   - Apply per-socket token-bucket limit: 15 actions/sec, burst 20.
   - Verify room `status` is `in_game` or `winner_window` (only limited actions in window).
   - Verify `matchId` and `roundIndex`.
   - Enforce seq:
     - If `clientSeq <= lastProcessedSeq`, reject as duplicate/out_of_order.
     - If `clientSeq > lastProcessedSeq + 1`, reject as out_of_order.
     - On any in-order attempt, set `lastProcessedSeq = clientSeq` (prevents sequence deadlock on rejected in-order action).
2. `placePiece`:
   - Validate piece exists and is currently unplaced in authoritative round state.
   - Validate `transform` is in `PIECE_TRANSFORMS[pieceId]`.
   - Validate bounds/collision/blockers using shared `canPlace`.
   - Apply with shared `placePiece`.
   - Push history entry for undo.
   - Emit `playerState` for that player.
   - If board solved, run finish path.
3. `removePiece`:
   - Resolve target piece from `placedId` or `pieceId`.
   - Validate piece currently placed.
   - Apply with shared `removePiece`.
   - Push history entry.
   - Emit `playerState`.
4. `undo`:
   - Validate history non-empty.
   - Pop last mutation and invert it.
   - Emit `playerState`.
5. `submitFinish`:
   - Validate board solved (`isSolved`) and round still active.
   - If already finished, ignore idempotently.
   - Set `finishedAt` and `splitMs = finishedAt - round.startedAt`.
   - Emit `playerFinished`.
   - If not final round and room not in winner window, advance player immediately in solo mode and emit `roundStart` + `playerState`.
   - If final round first finisher, set winner and emit `winnerDecided`; move room to `winner_window`.
6. Winner window behavior:
   - Freeze cross-round advancement immediately.
   - Players may continue actions only on their current round board.
   - On `lockEndsAt`, finalize placements and emit `matchResult`; set room `finished`.

## Reconnect / Rejoin Flow + `stateSync`

1. On initial join, server returns and client stores `resumeToken` (per room seat).
2. On disconnect:
   - Mark player `connected=false`.
   - Set `disconnectedAt` and `graceExpiresAt = now + 30000`.
   - Keep authoritative state in memory.
3. On reconnect `joinRoom` with `roomCode + resumeToken`:
   - If token matches and within grace, rebind socket to same player seat.
   - Emit full `stateSync`.
4. If reconnect fails or grace expires:
   - Mark player DNF for remaining rounds.
   - Keep them in result list.
5. `stateSync` must include:
   - `status`, `hostId`, `settings`, `match`.
   - Per-player current round, splits, finished flags/timestamps.
   - For reconnecting player: full authoritative `placedPieces`, `remainingPieceIds`, `lastAppliedSeq`, `startedAt`, `puzzleId`.
   - `now` server time for countdown/timer offset.
6. No replay-only recovery is used; snapshot is canonical.

## Timer Strategy and Split Computation

1. Countdown:
   - Server sets `countdownStartAt` and `startTime`.
   - Client shows `max(0, startTime - (Date.now()+offset))`.
2. Clock sync:
   - `offset = serverNow - Date.now()` refreshed on `stateSync`.
3. Split times:
   - `splitMs = finishedAt - round.startedAt` on server.
   - In solo-advance, each player has per-round `startedAt`.
4. Winner lock window:
   - Fixed `lockInMs = 20000`.
   - Client derives remaining window from `lockEndsAt - (Date.now()+offset)`.
5. Background tab safety:
   - UI derives from absolute server timestamps each render; no dependence on interval accuracy.

## UI State Machine (Lobby → Countdown → In-Game → Winner Window → End)

1. `LOBBY`:
   - Show room list, room code join, create modal, public queue join.
   - Show room members, ready states, host controls.
2. `COUNTDOWN`:
   - After host `startMatch`, show global countdown.
3. `IN_GAME`:
   - Local board + piece tray.
   - Opponent cards:
     - Desktop: fixed column left of main board.
     - Mobile: below piece tray.
   - Card data: name, mini board, round number, splits as completed.
4. `WINNER_WINDOW`:
   - Banner: “Winner decided”.
   - Show winner and countdown to lock-in.
   - Keep current round playable; block round advancement.
5. `MATCH_END`:
   - Show winner, placements, per-round splits for all players.
   - CTA buttons:
     - “Play again with same group” (host can start new match in same room; reset readiness).
     - “Return to lobby” (leave room and return to lobby view).

## Implementation Milestones (Ordered, Must-Have vs Nice-to-Have)

1. [Must] Scaffold server app at `/Users/craigwalker/Desktop/code/Blocker-Rush/apps/server` with Socket.io entrypoint, room registry, and lifecycle FSM.
2. [Must] Create protocol package at `/Users/craigwalker/Desktop/code/Blocker-Rush/packages/protocol` with discriminated unions + zod schemas + shared reason enums.
3. [Must] Implement authoritative match engine in server:
   - Room/host/settings.
   - Match generation using shared puzzle dataset.
   - Action validators and apply functions using shared board/piece logic.
4. [Must] Implement reconnect system:
   - Resume tokens.
   - 30s grace tracking.
   - Full `stateSync` snapshot generation.
5. [Must] Implement winner-decided window and final placement calculation.
6. [Must] Build multiplayer client state layer in `/Users/craigwalker/Desktop/code/Blocker-Rush/apps/web/components/multiplayer`:
   - Socket client.
   - Optimistic local apply.
   - Reconcile on `playerState`/`actionRejected`.
7. [Must] Build multiplayer UI screens:
   - Lobby list + join/create modal.
   - Room waiting screen + host start.
   - In-game HUD with opponent mini-boards.
   - Winner window banner + end screen CTAs.
8. [Must] Add tests for engine/protocol/reconnect/winner window/round splits.
9. [Must] Add run scripts and CI-friendly commands:
   - Root scripts for `dev:server`, `test:server`, `test:shared`.
10. [Nice] Add payload size optimization:

- Optional board delta compression for opponent cards.

11. [Nice] Add host migration policy polish:

- Auto-transfer host in lobby if host disconnects >5s.

12. [Nice] Add optional `advanceMode: "room"` code path behind a server flag for future.

## Testing and Acceptance Scenarios

1. Deterministic action apply:
   - Same action stream yields identical board state across runs.
2. Sequence handling:
   - Duplicate seq ignored/rejected.
   - Out-of-order seq rejected.
   - In-order invalid action still advances `lastProcessedSeq`.
3. Validation coverage:
   - Invalid transform, piece unavailable, collision, out-of-bounds, invalid remove/undo.
4. Reconnect correctness:
   - Disconnect and reconnect within 30s restores exact authoritative state.
   - Reconnect after 30s fails reclaim and marks DNF.
5. Winner-decided behavior:
   - First final-round finisher emits `winnerDecided`.
   - 20s window allows current-round finishing.
   - No round advancement during window.
   - Lock timer emits deterministic `matchResult`.
6. Round transitions and splits:
   - Solo-advance progression per player.
   - Split times based on server timestamps only.
7. Lobby/match restrictions:
   - Join mid-game denied unless valid resume token.
   - Max 8 players enforced.
8. Client reconcile:
   - Optimistic local board converges to authoritative state after rejects.
9. Countdown stability:
   - Background-tab scenario still shows correct remaining time from server timestamps.

## Risks / Edge Cases and Mitigations

1. Solo-advance fairness perception:
   - Mitigation: clear UI labels per-player round and split history; winner window preserves placement opportunities.
2. Premature match end:
   - Mitigation: `winner_window` explicit state; finalize only at `lockEndsAt`.
3. Host disconnect:
   - Mitigation: in-game host role is non-critical; room continues. Lobby host transfer if needed.
4. Reconnect race at grace boundary:
   - Mitigation: server compares against `graceExpiresAt` using server time only.
5. Stale packets after round change:
   - Mitigation: strict `matchId + roundIndex + seq` gates.
6. Payload spam:
   - Mitigation: action token-bucket and per-event validation short-circuit.
7. Logic divergence client/server:
   - Mitigation: all placement and transform checks sourced from shared package; client never authoritatively validates final state.

## Code Organization Guidance (Avoid Client/Server Divergence)

1. Keep pure game logic in `/Users/craigwalker/Desktop/code/Blocker-Rush/packages/shared/src` only.
2. Keep network contracts and zod schemas in `/Users/craigwalker/Desktop/code/Blocker-Rush/packages/protocol/src`.
3. Keep server orchestration in `/Users/craigwalker/Desktop/code/Blocker-Rush/apps/server/src`:
   - `domain/rooms.ts`
   - `domain/match-engine.ts`
   - `domain/reconnect.ts`
   - `transport/socket-gateway.ts`
4. Keep client multiplayer state in `/Users/craigwalker/Desktop/code/Blocker-Rush/apps/web/components/multiplayer`:
   - `MultiplayerStore.ts`
   - `useMultiplayerSocket.ts`
   - `reconcile.ts`
5. Do not duplicate board mutation logic in client multiplayer store; call shared helpers for local optimistic mirror only.
6. Emit only typed events from a single adapter layer on both sides.

## Explicit Assumptions and Defaults Locked

1. Public matchmaking fallback after 30s: no bot in MVP.
2. Winner-decided lock-in window: 20 seconds (`lockInMs=20000`).
3. Max room size: 8 players.
4. Match settings:
   - `rounds` range is 1..3 for MVP.
   - Default rounds is 1.
   - If rounds=3 default difficulties are `[easy, medium, hard]`.
   - `advanceMode` exposed as `"solo"` only in MVP.
5. Countdown length before round 1: 3 seconds.
6. Public queue uses default settings only to avoid queue fragmentation in MVP.
7. Practice bot and room-advance remain explicit post-MVP upgrades.
