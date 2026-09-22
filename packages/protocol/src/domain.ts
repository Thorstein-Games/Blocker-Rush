import type { Difficulty, PieceId } from "@blocker-rush/shared";

// Must match Megingjord's BaseGameRoom.disconnectedTimeout (15 min) now that
// reconnection is server-driven rather than client resumeToken-based.
export const REJOIN_GRACE_MS = 15 * 60_000;

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

export type RoundDef = {
  roundIndex: number;
  difficulty: Difficulty;
  puzzleId: string;
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
