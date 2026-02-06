import type { BoardSize, Coordinate, PieceId, SolveOptions, SolveResult } from "./types";
import { DEFAULT_BOARD, coordToVec, toIndex } from "./coords";
import { PIECES, PIECE_TRANSFORMS } from "./pieces";
import { createBoard, withBlockers } from "./board";

const orderPieces = (pieceIds: PieceId[]): PieceId[] =>
  [...pieceIds].sort((a, b) => {
    const aTransforms = PIECE_TRANSFORMS[a]?.length ?? 0;
    const bTransforms = PIECE_TRANSFORMS[b]?.length ?? 0;
    const aSize = PIECES.find((piece) => piece.id === a)?.size ?? 0;
    const bSize = PIECES.find((piece) => piece.id === b)?.size ?? 0;
    return bSize - aSize || bTransforms - aTransforms || a.localeCompare(b);
  });

const createEmptyPlacements = (): Record<
  PieceId,
  { origin: { x: number; y: number }; transformId: string } | undefined
> =>
  PIECES.reduce(
    (acc, piece) => {
      acc[piece.id] = undefined;
      return acc;
    },
    {} as Record<
      PieceId,
      { origin: { x: number; y: number }; transformId: string } | undefined
    >,
  );

const canPlaceAt = (
  cells: (PieceId | "blocker" | null)[],
  size: BoardSize,
  origin: { x: number; y: number },
  offsets: { x: number; y: number }[]
): boolean => {
  for (const offset of offsets) {
    const x = origin.x + offset.x;
    const y = origin.y + offset.y;
    if (x < 0 || y < 0 || x >= size.cols || y >= size.rows) return false;
    const idx = y * size.cols + x;
    if (cells[idx] !== null) return false;
  }
  return true;
};

const placeCells = (
  cells: (PieceId | "blocker" | null)[],
  size: BoardSize,
  origin: { x: number; y: number },
  offsets: { x: number; y: number }[],
  pieceId: PieceId
) => {
  for (const offset of offsets) {
    const x = origin.x + offset.x;
    const y = origin.y + offset.y;
    const idx = y * size.cols + x;
    cells[idx] = pieceId;
  }
};

const clearCells = (
  cells: (PieceId | "blocker" | null)[],
  size: BoardSize,
  origin: { x: number; y: number },
  offsets: { x: number; y: number }[]
) => {
  for (const offset of offsets) {
    const x = origin.x + offset.x;
    const y = origin.y + offset.y;
    const idx = y * size.cols + x;
    cells[idx] = null;
  }
};

export const solvePuzzle = (
  blockers: Coordinate[],
  options: SolveOptions = {},
  size: BoardSize = DEFAULT_BOARD
): SolveResult => {
  const maxSolutions = options.maxSolutions ?? 2;
  const board = withBlockers(blockers, size);
  const baseCells = [...board.cells];

  const pieceIds = orderPieces(PIECES.map((piece) => piece.id));
  const placements = createEmptyPlacements();
  const result: SolveResult = {
    solutionCount: 0,
    nodesVisited: 0,
    maxDepth: 0,
  };

  const recurse = (index: number) => {
    if (result.solutionCount >= maxSolutions) return;
    result.maxDepth = Math.max(result.maxDepth, index);

    if (index >= pieceIds.length) {
      result.solutionCount += 1;
      if (!result.firstSolution) {
        result.firstSolution = Object.fromEntries(
          Object.entries(placements).map(([pieceId, placement]) => [
            pieceId,
            placement
              ? {
                  pieceId: pieceId as PieceId,
                  transformId: placement.transformId,
                  origin: placement.origin,
                }
              : undefined,
          ])
        ) as Record<PieceId, any>;
      }
      return;
    }

    const pieceId = pieceIds[index] as PieceId;
    const transforms = PIECE_TRANSFORMS[pieceId];

    for (const transform of transforms) {
      for (let y = 0; y <= size.rows - transform.height; y += 1) {
        for (let x = 0; x <= size.cols - transform.width; x += 1) {
          const origin = { x, y };
          if (!canPlaceAt(baseCells, size, origin, transform.cells)) continue;
          result.nodesVisited += 1;
          placeCells(baseCells, size, origin, transform.cells, pieceId);
          placements[pieceId] = { origin, transformId: transform.id };
          recurse(index + 1);
          placements[pieceId] = undefined;
          clearCells(baseCells, size, origin, transform.cells);
          if (result.solutionCount >= maxSolutions) return;
        }
      }
    }
  };

  recurse(0);
  return result;
};

export const buildBoardFromPlacements = (
  blockers: Coordinate[],
  placements: Record<PieceId, { origin: { x: number; y: number }; transformId: string } | undefined>,
  size: BoardSize = DEFAULT_BOARD
) => {
  const board = createBoard(size);
  for (const blocker of blockers) {
    const vec = coordToVec(blocker);
    board.cells[toIndex(size, vec)] = "blocker";
  }
  for (const [pieceId, placement] of Object.entries(placements)) {
    if (!placement) continue;
    const transforms = PIECE_TRANSFORMS[pieceId as PieceId];
    const transform = transforms.find((item) => item.id === placement.transformId);
    if (!transform) continue;
    for (const cell of transform.cells) {
      const vec = { x: placement.origin.x + cell.x, y: placement.origin.y + cell.y };
      board.cells[toIndex(size, vec)] = pieceId as PieceId;
    }
  }
  return board;
};
