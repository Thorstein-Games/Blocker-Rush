import type { BoardCell, BoardSize, Coordinate, PieceId, PieceTransform, Placement, Vec2 } from "./types.js";
import { DEFAULT_BOARD, coordToVec, toIndex, withinBounds } from "./coords.js";

export const createBoard = (size: BoardSize = DEFAULT_BOARD): BoardState => ({
  size,
  cells: Array.from({ length: size.cols * size.rows }, () => null),
  placements: {},
});

export type BoardState = {
  size: BoardSize;
  cells: BoardCell[];
  placements: Record<PieceId, Placement | undefined>;
};

export const withBlockers = (
  blockers: Coordinate[],
  size: BoardSize = DEFAULT_BOARD
): BoardState => {
  const board = createBoard(size);
  for (const blocker of blockers) {
    const vec = coordToVec(blocker);
    const idx = toIndex(size, vec);
    board.cells[idx] = "blocker";
  }
  return board;
};

export const canPlace = (
  board: BoardState,
  transform: PieceTransform,
  origin: Vec2
): boolean => {
  for (const cell of transform.cells) {
    const vec = { x: origin.x + cell.x, y: origin.y + cell.y };
    if (!withinBounds(board.size, vec)) return false;
    const idx = toIndex(board.size, vec);
    if (board.cells[idx] !== null) return false;
  }
  return true;
};

export const placePiece = (
  board: BoardState,
  pieceId: PieceId,
  transform: PieceTransform,
  origin: Vec2
): BoardState => {
  if (!canPlace(board, transform, origin)) return board;
  const next = cloneBoard(board);
  for (const cell of transform.cells) {
    const vec = { x: origin.x + cell.x, y: origin.y + cell.y };
    const idx = toIndex(next.size, vec);
    next.cells[idx] = pieceId;
  }
  next.placements[pieceId] = { pieceId, transformId: transform.id, origin };
  return next;
};

export const removePiece = (board: BoardState, pieceId: PieceId): BoardState => {
  const placement = board.placements[pieceId];
  if (!placement) return board;
  const next = cloneBoard(board);
  for (let i = 0; i < next.cells.length; i += 1) {
    if (next.cells[i] === pieceId) next.cells[i] = null;
  }
  next.placements[pieceId] = undefined;
  return next;
};

export const isSolved = (board: BoardState): boolean =>
  board.cells.every((cell) => cell !== null);

export const cloneBoard = (board: BoardState): BoardState => ({
  size: board.size,
  cells: [...board.cells],
  placements: { ...board.placements },
});

export const getEmptyCells = (board: BoardState): Vec2[] => {
  const empties: Vec2[] = [];
  for (let index = 0; index < board.cells.length; index += 1) {
    if (board.cells[index] === null) {
      empties.push({
        x: index % board.size.cols,
        y: Math.floor(index / board.size.cols),
      });
    }
  }
  return empties;
};
