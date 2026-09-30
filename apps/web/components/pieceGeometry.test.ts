import { describe, expect, it } from "vitest";
import { PIECES, PIECE_TRANSFORMS, createBoard, withBlockers } from "@blocker-rush/shared";
import {
  findOrientationForTransform,
  getPieceVisualCenterLocal,
  getTransformFor,
  placementError,
} from "./pieceGeometry";

describe("piece orientation", () => {
  it("every rotation/flip resolves to a known transform", () => {
    for (const piece of PIECES) {
      for (let rotation = 0; rotation < 4; rotation += 1) {
        for (const flipped of [false, true]) {
          const t = getTransformFor(piece.id, rotation, flipped);
          expect(PIECE_TRANSFORMS[piece.id]).toContain(t);
        }
      }
    }
  });

  it("findOrientationForTransform inverts getTransformFor", () => {
    for (const piece of PIECES) {
      for (const transform of PIECE_TRANSFORMS[piece.id]) {
        const { rotation, flipped } = findOrientationForTransform(piece.id, transform.id);
        expect(getTransformFor(piece.id, rotation, flipped).id).toBe(transform.id);
      }
    }
  });

  it("visual center is the bounding-box center in cell units", () => {
    expect(getPieceVisualCenterLocal([{ x: 0, y: 0 }])).toEqual({ x: 0.5, y: 0.5 });
    expect(
      getPieceVisualCenterLocal([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]),
    ).toEqual({ x: 1.5, y: 0.5 });
  });
});

describe("placementError", () => {
  const square = getTransformFor("p8", 0, false);

  it("explains edge, blocker and overlap failures", () => {
    expect(placementError(createBoard(), square, { x: 5, y: 0 })).toMatch(/edge/);
    expect(placementError(withBlockers([{ col: "A", row: 1 }]), square, { x: 0, y: 0 })).toMatch(/blocker/);
    const board = createBoard();
    board.cells[0] = "p1";
    expect(placementError(board, square, { x: 0, y: 0 })).toMatch(/overlap/);
  });
});
