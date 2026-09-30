import type { PieceId } from "@blocker-rush/shared";
import type {
  ActionRejectedReason,
  MatchPlacement,
  MatchSettings,
  PiecePlacement,
  RoundDef,
} from "./domain";

// Wire format for the `blocker_rush` room (megingjord BlockerRushRoom).
// Megingjord mirrors this file via scripts/sync-megingjord.mjs and types its
// sends against it, so a payload change here fails typecheck on both sides.

export type MatchStatus = "lobby" | "countdown" | "in_game" | "finished";

export type RoundProgress = {
  placedPieces: PiecePlacement[];
  remainingPieceIds: PieceId[];
  boardFilledCount: number;
};

export type PlayerStatePayload = RoundProgress & {
  matchId: string;
  playerId: string;
  roundIndex: number;
  lastAppliedSeq: number;
  finishedAt?: number;
  splitMs?: number;
};

export type SyncedRound = RoundProgress & {
  roundIndex: number;
  puzzleId: string;
  startedAt: number;
  finishedAt?: number;
};

export type SyncedPlayer = {
  playerId: string;
  name: string;
  currentRoundIndex: number;
  splitsMs: Array<number | null>;
  lastAppliedSeq: number;
  round?: SyncedRound;
};

export type MatchResultPayload = {
  matchId: string;
  winnerId: string;
  placements: MatchPlacement[];
  splitsByPlayer: Record<string, Array<number | null>>;
  winnerBoards: Array<{
    roundIndex: number;
    puzzleId: string;
    placedPieces: PiecePlacement[];
  }>;
};

/** Game-specific messages the server sends (BaseGameRoom's own are not listed). */
export type ServerMessages = {
  match_start: {
    matchId: string;
    startTime: number;
    rounds: RoundDef[];
    countdownMs: number;
  };
  round_start: {
    playerId: string;
    roundIndex: number;
    puzzleId: string;
    startTime: number;
  };
  player_state: PlayerStatePayload;
  player_finished: {
    playerId: string;
    roundIndex: number;
    finishedAt: number;
    splitMs: number;
  };
  match_result: MatchResultPayload;
  action_rejected: {
    matchId: string;
    clientSeq: number;
    reason: ActionRejectedReason;
    authoritativeState?: {
      roundIndex: number;
      placedPieces: PiecePlacement[];
      remainingPieceIds: PieceId[];
      lastAppliedSeq: number;
    };
  };
  state_sync: {
    now: number;
    status: MatchStatus;
    settings: MatchSettings;
    matchId?: string;
    matchStartedAt?: number;
    rounds: RoundDef[];
    winnerId?: string;
    players: SyncedPlayer[];
  };
  error: { code: string; message: string };
  // Sent by BaseGameRoom, but read by the Blocker Rush client.
  player_removed: { sessionId: string; playerName?: string; reason?: string };
};

type ActionEnvelope = { matchId: string; roundIndex: number; clientSeq: number };

/** Game-specific messages the client sends. */
export type ClientMessages = {
  update_settings: { settings: MatchSettings };
  start_match: undefined;
  request_sync: { matchId: string };
  place_piece: ActionEnvelope & {
    pieceId: PieceId;
    /** Transform id from PIECE_TRANSFORMS. */
    transform: string;
    x: number;
    y: number;
  };
  remove_piece: ActionEnvelope & { pieceId: PieceId };
  undo: ActionEnvelope;
  submit_finish: ActionEnvelope;
};
