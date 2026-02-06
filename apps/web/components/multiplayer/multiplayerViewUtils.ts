"use client";

import type { PiecePlacement } from "@blocker-rush/protocol";
import {
  PIECE_TRANSFORMS,
  getPuzzleById,
  parsePuzzleId,
  placePiece,
  withBlockers,
} from "@blocker-rush/shared";

export const formatMs = (ms: number): string => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const resolveBlockers = (puzzleId: string) => {
  const puzzle = getPuzzleById(puzzleId);
  if (puzzle) return puzzle.blockers;
  try {
    return parsePuzzleId(puzzleId);
  } catch {
    return [];
  }
};

export const buildMiniCells = (
  pieces: PiecePlacement[],
  puzzleId: string,
): Array<string | null> => {
  const blockers = resolveBlockers(puzzleId);
  let board = withBlockers(blockers);

  for (const piece of pieces) {
    const transform = PIECE_TRANSFORMS[piece.pieceId]?.find(
      (item) => item.id === piece.transformId,
    );
    if (!transform) continue;
    board = placePiece(board, piece.pieceId, transform, {
      x: piece.x,
      y: piece.y,
    });
  }

  return board.cells.map((cell) => (cell === null ? null : String(cell)));
};
