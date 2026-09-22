import type { Difficulty, PieceId } from "@blocker-rush/shared";

export const MAX_PLAYERS = 8;
export const MATCH_COUNTDOWN_MS = 3000;
// Must match Megingjord's BaseGameRoom.disconnectedTimeout (15 min) now that
// reconnection is server-driven rather than client resumeToken-based.
export const REJOIN_GRACE_MS = 15 * 60_000;
export const DEFAULT_LOCK_IN_MS = 20_000;

export type RoomStatus =
  | "lobby"
  | "countdown"
  | "in_game"
  | "winner_window"
  | "finished";

export type AdvanceMode = "solo";

export type MatchSettings = {
  rounds: number;
  difficulties: Difficulty[];
  advanceMode: AdvanceMode;
  lockInMs: number;
};

export type PiecePlacement = {
  pieceId: PieceId;
  transformId: string;
  x: number;
  y: number;
};

export type RoundHistoryEntry = {
  type: "place" | "remove";
  seq: number;
  pieceId: PieceId;
  prev?: PiecePlacement;
  next?: PiecePlacement;
};

export type PlayerRoundState = {
  roundIndex: number;
  puzzleId: string;
  startedAt: number;
  finishedAt?: number;
  splitMs?: number;
  placedPieces: PiecePlacement[];
  remainingPieceIds: PieceId[];
  boardFilledCount: number;
  history: RoundHistoryEntry[];
};

export type PlayerState = {
  playerId: string;
  name: string;
  socketId?: string;
  resumeToken: string;
  connected: boolean;
  disconnectedAt?: number;
  graceExpiresAt?: number;
  currentRoundIndex: number;
  completedFinal: boolean;
  finalFinishedAt?: number;
  splitsMs: Array<number | null>;
  lastProcessedSeq: number;
  rounds: Record<number, PlayerRoundState>;
};

export type RoundDef = {
  roundIndex: number;
  difficulty: Difficulty;
  puzzleId: string;
};

export type MatchState = {
  matchId: string;
  startedAt: number;
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

export type ActionRejectedReason =
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

export type MatchPlacement = {
  playerId: string;
  place: number;
  roundsCompleted: number;
  finalFinishAt?: number;
  status: "finished" | "dnf";
};
