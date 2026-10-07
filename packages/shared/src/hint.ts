import type { Coordinate, PieceId, Placement } from "./types";
import { PIECES } from "./pieces";
import { solveFromPlacements } from "./solver";

type PlacementMap = Partial<
  Record<PieceId, { origin: { x: number; y: number }; transformId: string } | undefined>
>;

export type Hint =
  /** Where one unplaced piece goes in a solution that keeps every placed piece. */
  | { kind: "place"; placement: Placement }
  /** No solution keeps the current pieces; taking this one back fixes that. */
  | { kind: "remove"; pieceId: PieceId }
  /** No single piece is the problem; start over. */
  | { kind: "restart" }
  | { kind: "solved" }
  /** The puzzle itself has no solution. */
  | { kind: "unsolvable" };

const placedIds = (placements: PlacementMap): PieceId[] =>
  PIECES.map((piece) => piece.id).filter((id) => placements[id]);

/**
 * The next step toward a solution from the player's current board. Hints
 * build on what's already placed rather than one fixed answer, so they never
 * point at squares the player has filled.
 */
export const findHint = (
  blockers: Coordinate[],
  placements: PlacementMap,
): Hint => {
  const placed = placedIds(placements);
  if (placed.length === PIECES.length) return { kind: "solved" };

  const solution = solveFromPlacements(blockers, placements, { maxSolutions: 1 })
    .firstSolution;
  if (solution) {
    // Biggest unplaced piece first: those are the hardest to fit and the
    // most useful to be told about.
    const target = [...PIECES]
      .filter((piece) => !placements[piece.id])
      .sort((a, b) => b.size - a.size)[0]!;
    return { kind: "place", placement: solution[target.id]! };
  }

  if (placed.length === 0) return { kind: "unsolvable" };

  // Most recently added pieces aren't known, so prefer taking back a small
  // piece: it's the cheapest move for the player to redo.
  const candidates = [...placed].sort(
    (a, b) =>
      (PIECES.find((piece) => piece.id === a)?.size ?? 0) -
      (PIECES.find((piece) => piece.id === b)?.size ?? 0),
  );
  for (const pieceId of candidates) {
    const without = { ...placements, [pieceId]: undefined };
    if (solveFromPlacements(blockers, without, { maxSolutions: 1 }).firstSolution) {
      return { kind: "remove", pieceId };
    }
  }
  return { kind: "restart" };
};
