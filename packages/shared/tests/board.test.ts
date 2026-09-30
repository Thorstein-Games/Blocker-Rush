import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLOCKER_COUNT,
  DEFAULT_BOARD,
  PIECES,
  PIECE_TRANSFORMS,
  canPlace,
  createBoard,
  getEmptyCells,
  isSolved,
  placePiece,
  removePiece,
  withBlockers,
  type PieceId,
} from "../src";

const transformOf = (pieceId: PieceId, index = 0) => {
  const transform = PIECE_TRANSFORMS[pieceId][index];
  if (!transform) throw new Error(`No transform ${index} for ${pieceId}`);
  return transform;
};

describe("pieces", () => {
  it("exactly fill the open cells of a board with the default blocker count", () => {
    const pieceCells = PIECES.reduce((sum, piece) => sum + piece.size, 0);
    expect(pieceCells).toBe(
      DEFAULT_BOARD.cols * DEFAULT_BOARD.rows - DEFAULT_BLOCKER_COUNT
    );
  });

  it("generate the expected number of distinct rotations/reflections", () => {
    const counts = Object.fromEntries(
      PIECES.map((piece) => [piece.id, PIECE_TRANSFORMS[piece.id].length])
    );
    expect(counts).toEqual({
      p1: 1, // Dot
      p2: 8, // Spire (L tetromino)
      p3: 4, // Shift (S/Z tetromino)
      p4: 4, // Fork (T tetromino)
      p5: 4, // Kite
      p6: 2, // Line
      p7: 2, // Twin
      p8: 1, // Square
      p9: 2, // Long Line
    });
  });

  it("produce normalized transforms whose bounds match their cells", () => {
    for (const transforms of Object.values(PIECE_TRANSFORMS)) {
      for (const t of transforms) {
        expect(Math.min(...t.cells.map((c) => c.x))).toBe(0);
        expect(Math.min(...t.cells.map((c) => c.y))).toBe(0);
        expect(Math.max(...t.cells.map((c) => c.x)) + 1).toBe(t.width);
        expect(Math.max(...t.cells.map((c) => c.y)) + 1).toBe(t.height);
      }
    }
  });
});

describe("board", () => {
  it("places blockers at their coordinates", () => {
    const board = withBlockers([{ col: "B", row: 1 }]);
    expect(board.cells[1]).toBe("blocker");
    expect(getEmptyCells(board)).toHaveLength(35);
  });

  it("places and removes a piece without mutating the input", () => {
    const empty = createBoard();
    const square = transformOf("p8");
    const placed = placePiece(empty, "p8", square, { x: 0, y: 0 });

    expect(empty.cells.every((c) => c === null)).toBe(true);
    expect(placed.cells.filter((c) => c === "p8")).toHaveLength(4);
    expect(placed.placements.p8).toEqual({
      pieceId: "p8",
      transformId: square.id,
      origin: { x: 0, y: 0 },
    });

    const removed = removePiece(placed, "p8");
    expect(removed.cells.every((c) => c === null)).toBe(true);
    expect(removed.placements.p8).toBeUndefined();
  });

  it("rejects out-of-bounds and colliding placements", () => {
    const board = withBlockers([{ col: "A", row: 1 }]);
    const square = transformOf("p8");
    expect(canPlace(board, square, { x: 0, y: 0 })).toBe(false);
    expect(canPlace(board, square, { x: 5, y: 0 })).toBe(false);
    expect(canPlace(board, square, { x: 1, y: 0 })).toBe(true);
    // placePiece returns the same board untouched when placement is invalid
    expect(placePiece(board, "p8", square, { x: 0, y: 0 })).toBe(board);
  });

  it("removePiece is a no-op for unplaced pieces", () => {
    const board = createBoard();
    expect(removePiece(board, "p1")).toBe(board);
  });

  it("isSolved only when every cell is filled", () => {
    const board = createBoard();
    expect(isSolved(board)).toBe(false);
    board.cells.fill("blocker");
    expect(isSolved(board)).toBe(true);
  });
});
