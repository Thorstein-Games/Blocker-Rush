import type { PieceId, Vec2 } from "@blocker-rush/shared";
import {
  PIECES,
  PIECE_TRANSFORMS,
  canPlace,
  getPuzzleById,
  isSolved,
  placePiece,
  removePiece,
  withBlockers,
  withinBounds,
} from "@blocker-rush/shared";
import type { ActionRejectedReason, PiecePlacement } from "@blocker-rush/protocol";
import type {
  InternalPlayerState,
  InternalRoundState,
  MatchResultPayload,
  RoundPuzzle,
} from "./types";

const getTransform = (pieceId: PieceId, transformId: string) =>
  PIECE_TRANSFORMS[pieceId]?.find((item) => item.id === transformId);

const getFilledCount = (round: InternalRoundState): number =>
  round.board.cells.reduce<number>(
    (acc, cell) => (cell === null ? acc : acc + 1),
    0,
  );

const clonePlacement = (placement: PiecePlacement): PiecePlacement => ({
  pieceId: placement.pieceId,
  transformId: placement.transformId,
  x: placement.x,
  y: placement.y,
});

const getRound = (
  player: InternalPlayerState,
  roundIndex: number,
): InternalRoundState | null => player.rounds[roundIndex] ?? null;

const validatePlacement = (
  round: InternalRoundState,
  placement: PiecePlacement,
): ActionRejectedReason | null => {
  const transform = getTransform(placement.pieceId, placement.transformId);
  if (!transform) {
    return "invalid_transform";
  }

  for (const offset of transform.cells) {
    const target = { x: placement.x + offset.x, y: placement.y + offset.y };
    if (!withinBounds(round.board.size, target)) {
      return "out_of_bounds";
    }
    const idx = target.y * round.board.size.cols + target.x;
    const existing = round.board.cells[idx];
    if (existing === "blocker") return "blocked";
    if (existing !== null) return "collision";
  }

  return null;
};

const removeFromRemaining = (remaining: PieceId[], pieceId: PieceId): PieceId[] =>
  remaining.filter((id) => id !== pieceId);

const addToRemaining = (remaining: PieceId[], pieceId: PieceId): PieceId[] => {
  if (remaining.includes(pieceId)) return remaining;
  return [...remaining, pieceId].sort();
};

const removePlacement = (
  placedPieces: PiecePlacement[],
  pieceId: PieceId,
): PiecePlacement[] =>
  placedPieces.filter((piece: PiecePlacement) => piece.pieceId !== pieceId);

const upsertPlacement = (
  placedPieces: PiecePlacement[],
  next: PiecePlacement,
): PiecePlacement[] => {
  const filtered = removePlacement(placedPieces, next.pieceId);
  filtered.push(next);
  return filtered;
};

export const initialRoundState = (
  roundIndex: number,
  puzzleId: string,
  startedAt = 0,
): InternalRoundState => {
  const puzzle = getPuzzleById(puzzleId);
  if (!puzzle) {
    throw new Error(`Unknown puzzleId: ${puzzleId}`);
  }

  return {
    roundIndex,
    puzzleId,
    startedAt,
    placedPieces: [],
    remainingPieceIds: PIECES.map((piece) => piece.id),
    boardFilledCount: puzzle.blockers.length,
    history: [],
    board: withBlockers(puzzle.blockers),
  };
};

export const buildRoundStates = (
  rounds: RoundPuzzle[],
  firstRoundStartAt: number,
): Record<number, InternalRoundState> => {
  const result: Record<number, InternalRoundState> = {};
  for (const round of rounds) {
    result[round.roundIndex] = initialRoundState(
      round.roundIndex,
      round.puzzleId,
      round.roundIndex === 0 ? firstRoundStartAt : 0,
    );
  }
  return result;
};

export const validateAndApplySeq = (
  player: InternalPlayerState,
  clientSeq: number,
): ActionRejectedReason | null => {
  if (clientSeq <= player.lastProcessedSeq) {
    return clientSeq === player.lastProcessedSeq
      ? "duplicate_seq"
      : "out_of_order_seq";
  }
  if (clientSeq > player.lastProcessedSeq + 1) {
    return "out_of_order_seq";
  }

  player.lastProcessedSeq = clientSeq;
  return null;
};

export const applyPlacePiece = (
  player: InternalPlayerState,
  placement: PiecePlacement,
  clientSeq: number,
): { ok: true; round: InternalRoundState; solved: boolean } | { ok: false; reason: ActionRejectedReason } => {
  const round = getRound(player, player.currentRoundIndex);
  if (!round) return { ok: false, reason: "stale_round" };

  if (!round.remainingPieceIds.includes(placement.pieceId)) {
    return { ok: false, reason: "piece_unavailable" };
  }

  const placementIssue = validatePlacement(round, placement);
  if (placementIssue) {
    return { ok: false, reason: placementIssue };
  }

  const transform = getTransform(placement.pieceId, placement.transformId);
  if (!transform) {
    return { ok: false, reason: "invalid_transform" };
  }

  const nextOrigin: Vec2 = { x: placement.x, y: placement.y };
  if (!canPlace(round.board, transform, nextOrigin)) {
    return { ok: false, reason: "collision" };
  }

  round.board = placePiece(round.board, placement.pieceId, transform, nextOrigin);
  round.placedPieces = upsertPlacement(round.placedPieces, placement);
  round.remainingPieceIds = removeFromRemaining(
    round.remainingPieceIds,
    placement.pieceId,
  );
  round.boardFilledCount = getFilledCount(round);
  round.history.push({
    type: "place",
    seq: clientSeq,
    pieceId: placement.pieceId,
    next: clonePlacement(placement),
  });

  return { ok: true, round, solved: isSolved(round.board) };
};

export const applyRemovePiece = (
  player: InternalPlayerState,
  input: { pieceId?: PieceId; placedId?: string },
  clientSeq: number,
): { ok: true; round: InternalRoundState } | { ok: false; reason: ActionRejectedReason } => {
  const round = getRound(player, player.currentRoundIndex);
  if (!round) return { ok: false, reason: "stale_round" };

  const targetPieceId = (input.pieceId ?? input.placedId) as PieceId | undefined;
  if (!targetPieceId) {
    return { ok: false, reason: "invalid_remove" };
  }

  const currentPlacement = round.placedPieces.find(
    (piece) => piece.pieceId === targetPieceId,
  );
  if (!currentPlacement) {
    return { ok: false, reason: "invalid_remove" };
  }

  round.board = removePiece(round.board, targetPieceId);
  round.placedPieces = removePlacement(round.placedPieces, targetPieceId);
  round.remainingPieceIds = addToRemaining(round.remainingPieceIds, targetPieceId);
  round.boardFilledCount = getFilledCount(round);
  round.history.push({
    type: "remove",
    seq: clientSeq,
    pieceId: targetPieceId,
    prev: clonePlacement(currentPlacement),
  });

  return { ok: true, round };
};

export const applyUndo = (
  player: InternalPlayerState,
): { ok: true; round: InternalRoundState } | { ok: false; reason: ActionRejectedReason } => {
  const round = getRound(player, player.currentRoundIndex);
  if (!round) return { ok: false, reason: "stale_round" };

  const last = round.history.pop();
  if (!last) {
    return { ok: false, reason: "invalid_undo" };
  }

  if (last.type === "place") {
    round.board = removePiece(round.board, last.pieceId);
    round.placedPieces = removePlacement(round.placedPieces, last.pieceId);
    round.remainingPieceIds = addToRemaining(round.remainingPieceIds, last.pieceId);
    round.boardFilledCount = getFilledCount(round);
    return { ok: true, round };
  }

  const prevPlacement = last.prev;
  if (!prevPlacement) {
    return { ok: false, reason: "invalid_undo" };
  }

  const transform = getTransform(prevPlacement.pieceId, prevPlacement.transformId);
  if (!transform) {
    return { ok: false, reason: "invalid_transform" };
  }

  round.board = placePiece(round.board, prevPlacement.pieceId, transform, {
    x: prevPlacement.x,
    y: prevPlacement.y,
  });
  round.placedPieces = upsertPlacement(round.placedPieces, prevPlacement);
  round.remainingPieceIds = removeFromRemaining(
    round.remainingPieceIds,
    prevPlacement.pieceId,
  );
  round.boardFilledCount = getFilledCount(round);

  return { ok: true, round };
};

export const applyFinish = (
  player: InternalPlayerState,
  now: number,
): { ok: true; round: InternalRoundState; splitMs: number; alreadyFinished: boolean } | { ok: false; reason: ActionRejectedReason } => {
  const round = getRound(player, player.currentRoundIndex);
  if (!round) return { ok: false, reason: "stale_round" };

  if (round.finishedAt) {
    return {
      ok: true,
      round,
      splitMs: round.splitMs ?? Math.max(0, round.finishedAt - round.startedAt),
      alreadyFinished: true,
    };
  }

  if (!isSolved(round.board)) {
    return { ok: false, reason: "not_solved" };
  }

  round.finishedAt = now;
  round.splitMs = Math.max(0, now - round.startedAt);
  player.splitsMs[round.roundIndex] = round.splitMs;

  return { ok: true, round, splitMs: round.splitMs, alreadyFinished: false };
};

export const tryAdvancePlayer = (
  player: InternalPlayerState,
  now: number,
): InternalRoundState | null => {
  const nextIndex = player.currentRoundIndex + 1;
  const nextRound = player.rounds[nextIndex];
  if (!nextRound) {
    return null;
  }

  player.currentRoundIndex = nextIndex;
  if (!nextRound.startedAt) {
    nextRound.startedAt = now;
  }
  return nextRound;
};

const roundsCompleted = (player: InternalPlayerState): number =>
  Object.values(player.rounds).filter((round) => Boolean(round.finishedAt)).length;

export const finalizePlacements = (
  players: Record<string, InternalPlayerState>,
  winnerId: string,
): MatchResultPayload => {
  const winner = players[winnerId];
  if (!winner) {
    throw new Error(`Winner not found in room players: ${winnerId}`);
  }

  const placements: MatchResultPayload["placements"] = [
    {
      playerId: winner.playerId,
      place: 1,
      roundsCompleted: roundsCompleted(winner),
      finalFinishAt: winner.finalFinishedAt,
      status: "finished",
    },
  ];

  return {
    winnerId,
    placements,
    splitsByPlayer: Object.fromEntries(
      Object.values(players).map((player) => [player.playerId, player.splitsMs]),
    ),
    winnerBoards: Object.values(winner.rounds)
      .sort((a, b) => a.roundIndex - b.roundIndex)
      .map((round) => ({
        roundIndex: round.roundIndex,
        puzzleId: round.puzzleId,
        placedPieces: round.placedPieces.map(clonePlacement),
      })),
  };
};
