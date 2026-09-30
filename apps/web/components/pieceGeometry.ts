// Pure piece-orientation and board-geometry helpers used by GameContext.
// No React state here — everything is a function of its arguments.
import type { BoardState, PieceId, PieceTransform, Vec2 } from "@blocker-rush/shared";
import { PIECES, PIECE_TRANSFORMS, cellsToKey } from "@blocker-rush/shared";
import type { PieceState } from "./gameTypes";

export const initPieceStates = (): Record<PieceId, PieceState> =>
  PIECES.reduce(
    (acc, piece) => {
      acc[piece.id] = { rotation: 0, flipped: false };
      return acc;
    },
    {} as Record<PieceId, PieceState>,
  );

const rotateCells = (cells: Vec2[]): Vec2[] =>
  cells.map((cell) => ({ x: cell.y, y: -cell.x }));

const reflectCells = (cells: Vec2[]): Vec2[] =>
  cells.map((cell) => ({ x: -cell.x, y: cell.y }));

export const getTransformFor = (
  pieceId: PieceId,
  rotation: number,
  flipped: boolean,
): PieceTransform => {
  const base = PIECES.find((piece) => piece.id === pieceId)?.cells ?? [];
  let cells = base.map((cell) => ({ ...cell }));
  if (flipped) {
    cells = reflectCells(cells);
  }
  for (let i = 0; i < rotation; i += 1) {
    cells = rotateCells(cells);
  }
  const key = cellsToKey(cells);
  const transforms = PIECE_TRANSFORMS[pieceId];
  if (!transforms || transforms.length === 0 || !transforms[0]) {
    throw new Error(`Missing transforms for piece ${pieceId}`);
  }
  return transforms.find((item) => item.id === key) ?? transforms[0];
};

export const findOrientationForTransform = (
  pieceId: PieceId,
  transformId: string,
) => {
  for (let rotation = 0; rotation < 4; rotation += 1) {
    for (const flipped of [false, true]) {
      const base = PIECES.find((piece) => piece.id === pieceId)?.cells ?? [];
      let cells = base.map((cell) => ({ ...cell }));
      if (flipped) {
        cells = reflectCells(cells);
      }
      for (let i = 0; i < rotation; i += 1) {
        cells = rotateCells(cells);
      }
      const key = cellsToKey(cells);
      if (key === transformId) {
        return { rotation, flipped };
      }
    }
  }
  return { rotation: 0, flipped: false };
};

export const pieceName = (id: PieceId) =>
  PIECES.find((piece) => piece.id === id)?.name ?? id;

/** User-facing reason a placement at `origin` is invalid. */
export const placementError = (
  current: BoardState,
  transform: PieceTransform,
  origin: Vec2,
) => {
  for (const cell of transform.cells) {
    const x = origin.x + cell.x,
      y = origin.y + cell.y;
    if (x < 0 || y < 0 || x >= current.size.cols || y >= current.size.rows)
      return "Piece crosses the edge. Move it inward or rotate it.";
    const occupied = current.cells[y * current.size.cols + x];
    if (occupied === "blocker")
      return "A blocker is in the way. Choose another square or rotate the piece.";
    if (occupied)
      return "Pieces cannot overlap. Choose a free area or remove a placed piece.";
  }
  return "Choose a square inside the board.";
};

export const getPieceVisualCenterLocal = (cells: Vec2[]) => {
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    // (C) Orientation math: use the center of the oriented bounding box so the
    // piece stays centered under the pointer for any rotation/flip.
    x: (minX + maxX + 1) / 2,
    y: (minY + maxY + 1) / 2,
  };
};

export const getPieceVisualCenterPx = (
  centerLocal: { x: number; y: number },
  metrics: { step: number; gap: number },
) => ({
  // Convert from local cell space (cell centers) to pixels.
  x: centerLocal.x * metrics.step - metrics.gap / 2,
  y: centerLocal.y * metrics.step - metrics.gap / 2,
});

export const isPointerOutsideBoard = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
) =>
  clientX < rect.left ||
  clientX > rect.right ||
  clientY < rect.top ||
  clientY > rect.bottom;

export const getCellIndexFromTarget = (target: EventTarget | null) => {
  if (!target) return null;
  const index = (target as HTMLElement).dataset.index;
  if (index === undefined) return null;
  const cellIndex = Number.parseInt(index, 10);
  if (Number.isNaN(cellIndex)) return null;
  return cellIndex;
};
