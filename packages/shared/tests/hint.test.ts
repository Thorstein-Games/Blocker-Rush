import { describe, expect, it } from "vitest";
import {
  PIECES,
  PIECE_TRANSFORMS,
  buildBoardFromPlacements,
  findHint,
  getPuzzlesForDifficulty,
  isSolved,
  parsePuzzleId,
  solveFromPlacements,
  solvePuzzle,
  type PieceId,
  type Placement,
} from "../src";

type Placements = Partial<Record<PieceId, Placement>>;

const insane = getPuzzlesForDifficulty("insane").slice(0, 5);
const easy = getPuzzlesForDifficulty("easy").slice(0, 3);

/** Every way to put `pieceId` on the board that no solution allows. */
const deadEndPlacements = (blockers: ReturnType<typeof parsePuzzleId>, pieceId: PieceId) => {
  const found: Placement[] = [];
  for (const transform of PIECE_TRANSFORMS[pieceId]) {
    for (let y = 0; y <= 6 - transform.height; y += 1) {
      for (let x = 0; x <= 6 - transform.width; x += 1) {
        const placement = { pieceId, transformId: transform.id, origin: { x, y } };
        const fixed = { [pieceId]: placement };
        const board = buildBoardFromPlacements(blockers, fixed as never);
        const overlaps = transform.cells.some(
          (cell) => board.cells[(y + cell.y) * 6 + x + cell.x] !== pieceId,
        );
        if (overlaps) continue;
        if (!solveFromPlacements(blockers, fixed).firstSolution) found.push(placement);
      }
    }
  }
  return found;
};

describe("solveFromPlacements", () => {
  it("keeps fixed pieces in every solution", () => {
    const blockers = insane[0]!.blockers;
    const solution = solvePuzzle(blockers, { maxSolutions: 1 }).firstSolution!;
    const fixed = { p9: solution.p9, p5: solution.p5 };
    const result = solveFromPlacements(blockers, fixed, { maxSolutions: 1 });
    expect(result.firstSolution?.p9).toEqual(solution.p9);
    expect(result.firstSolution?.p5).toEqual(solution.p5);
    expect(isSolved(buildBoardFromPlacements(blockers, result.firstSolution!))).toBe(true);
  });

  it("matches solvePuzzle when nothing is fixed", () => {
    for (const { blockers } of [...insane, ...easy]) {
      expect(solveFromPlacements(blockers, {}, { maxSolutions: 51 }).solutionCount).toBe(
        solvePuzzle(blockers, { maxSolutions: 51 }).solutionCount,
      );
    }
  });

  it("finds nothing when fixed pieces overlap a blocker", () => {
    const blockers = insane[0]!.blockers;
    const blocker = blockers[0]!;
    const origin = { x: blocker.col.charCodeAt(0) - 65, y: blocker.row - 1 };
    const fixed = { p1: { transformId: PIECE_TRANSFORMS.p1[0]!.id, origin } };
    expect(solveFromPlacements(blockers, fixed).solutionCount).toBe(0);
  });
});

describe("findHint", () => {
  it.each([...insane, ...easy].map((p) => [p.id, p.blockers] as const))(
    "following hints from an empty board solves %s",
    (_id, blockers) => {
      const placements: Placements = {};
      for (let step = 0; step < PIECES.length; step += 1) {
        const hint = findHint(blockers, placements);
        expect(hint.kind).toBe("place");
        if (hint.kind !== "place") return;
        expect(placements[hint.placement.pieceId]).toBeUndefined();
        placements[hint.placement.pieceId] = hint.placement;
      }
      expect(isSolved(buildBoardFromPlacements(blockers, placements as never))).toBe(true);
      expect(findHint(blockers, placements)).toEqual({ kind: "solved" });
    },
  );

  it("hints the biggest unplaced piece first", () => {
    const hint = findHint(insane[0]!.blockers, {});
    const biggest = Math.max(...PIECES.map((piece) => piece.size));
    expect(hint.kind === "place" && PIECES.find((p) => p.id === hint.placement.pieceId)?.size).toBe(
      biggest,
    );
  });

  it("builds on placed pieces instead of one fixed answer", () => {
    // On an easy board, pick a placement for the Dot that some solution
    // allows but the solver's first solution doesn't use.
    const blockers = easy[0]!.blockers;
    const first = solvePuzzle(blockers, { maxSolutions: 1 }).firstSolution!;
    const firstDot = first.p1;
    const dead = new Set(deadEndPlacements(blockers, "p1").map((p) => JSON.stringify(p.origin)));
    let alternative: Placement | undefined;
    for (let i = 0; i < 36 && !alternative; i += 1) {
      const origin = { x: i % 6, y: Math.floor(i / 6) };
      const key = JSON.stringify(origin);
      if (dead.has(key) || key === JSON.stringify(firstDot.origin)) continue;
      const candidate = { pieceId: "p1" as const, transformId: firstDot.transformId, origin };
      if (solveFromPlacements(blockers, { p1: candidate }).firstSolution) alternative = candidate;
    }
    expect(alternative).toBeDefined();
    const hint = findHint(blockers, { p1: alternative! });
    expect(hint.kind).toBe("place");
    if (hint.kind !== "place") return;
    const after = { p1: alternative!, [hint.placement.pieceId]: hint.placement };
    expect(solveFromPlacements(blockers, after).firstSolution).toBeDefined();
  });

  it("says which piece to take back from a dead end", () => {
    const blockers = insane[0]!.blockers;
    const wrong = deadEndPlacements(blockers, "p1")[0]!;
    expect(findHint(blockers, { p1: wrong })).toEqual({ kind: "remove", pieceId: "p1" });
  });

  it("prefers taking back the smaller piece when either would do", () => {
    const blockers = insane[0]!.blockers;
    const solution = solvePuzzle(blockers, { maxSolutions: 1 }).firstSolution!;
    const wrongDot = deadEndPlacements(blockers, "p1").find(
      (p) => !buildBoardFromPlacements(blockers, { p9: solution.p9 } as never).cells[
        p.origin.y * 6 + p.origin.x
      ],
    );
    expect(wrongDot).toBeDefined();
    // p9 is where a solution puts it; the Dot is the problem.
    expect(findHint(blockers, { p9: solution.p9, p1: wrongDot! })).toEqual({
      kind: "remove",
      pieceId: "p1",
    });
  });
});
