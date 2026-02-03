import type { Piece, PieceId, PieceTransform, Vec2 } from "./types.js";
import { cellsToKey, getBounds, normalizeCells } from "./coords.js";

const makePiece = (id: PieceId, name: string, cells: Vec2[]): Piece => ({
  id,
  name,
  size: cells.length,
  cells,
});

// TODO: Replace these placeholder shapes with the exact production set.
export const PIECES: Piece[] = [
  makePiece("p1", "Crown", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
  ]),
  makePiece("p2", "Spire", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ]),
  makePiece("p3", "Shift", [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]),
  makePiece("p4", "Fork", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
  ]),
  makePiece("p5", "Kite", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]),
  makePiece("p6", "Line", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]),
  makePiece("p7", "Twin", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]),
  makePiece("p8", "Twin", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]),
  makePiece("p9", "Twin", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]),
];

const rotate90 = (cells: Vec2[]): Vec2[] =>
  cells.map((cell) => ({ x: cell.y, y: -cell.x }));

const reflect = (cells: Vec2[]): Vec2[] =>
  cells.map((cell) => ({ x: -cell.x, y: cell.y }));

export const generateTransforms = (piece: Piece): PieceTransform[] => {
  const transforms: PieceTransform[] = [];
  const seen = new Set<string>();

  const pushTransform = (cells: Vec2[]) => {
    const normalized = normalizeCells(cells);
    const key = cellsToKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    const bounds = getBounds(normalized);
    transforms.push({
      id: key,
      cells: normalized,
      width: bounds.width,
      height: bounds.height,
    });
  };

  let current = piece.cells;
  for (let i = 0; i < 4; i += 1) {
    pushTransform(current);
    pushTransform(reflect(current));
    current = rotate90(current);
  }

  return transforms;
};

export const PIECE_TRANSFORMS: Record<PieceId, PieceTransform[]> = PIECES.reduce(
  (acc, piece) => {
    acc[piece.id] = generateTransforms(piece);
    return acc;
  },
  {} as Record<PieceId, PieceTransform[]>
);
