import { describe, expect, it } from "vitest";
import {
  buildBoardFromPlacements,
  getPuzzlesForDifficulty,
  isSolved,
  scoreDifficulty,
  solvePuzzle,
  difficultyOptions,
  type SolveResult,
} from "../src";

// Matches the generator's solutionCountCap (see puzzles.v1.sample.json).
const SOLUTION_CAP = 51;

const result = (solutionCount: number): SolveResult => ({
  solutionCount,
  nodesVisited: 0,
  maxDepth: 0,
});

describe("scoreDifficulty", () => {
  it("buckets solution counts at the documented boundaries", () => {
    expect(scoreDifficulty(result(1))).toBe("insane");
    expect(scoreDifficulty(result(3))).toBe("insane");
    expect(scoreDifficulty(result(4))).toBe("hard");
    expect(scoreDifficulty(result(10))).toBe("hard");
    expect(scoreDifficulty(result(11))).toBe("medium");
    expect(scoreDifficulty(result(50))).toBe("medium");
    expect(scoreDifficulty(result(51))).toBe("easy");
  });
});

describe("solvePuzzle", () => {
  // A couple of dataset puzzles per difficulty: the solver must agree with
  // the solution counts baked into the dataset, and its first solution must
  // actually fill the board.
  for (const difficulty of difficultyOptions) {
    for (const puzzle of getPuzzlesForDifficulty(difficulty).slice(0, 2)) {
      it(`reproduces ${difficulty} puzzle ${puzzle.id}`, () => {
        const solved = solvePuzzle(puzzle.blockers, {
          maxSolutions: SOLUTION_CAP,
        });
        expect(solved.solutionCount).toBe(puzzle.solutionCount);
        expect(scoreDifficulty(solved)).toBe(difficulty);

        expect(solved.firstSolution).toBeDefined();
        const board = buildBoardFromPlacements(
          puzzle.blockers,
          solved.firstSolution!
        );
        expect(isSolved(board)).toBe(true);
      });
    }
  }

  it("stops at maxSolutions", () => {
    const easy = getPuzzlesForDifficulty("easy")[0]!;
    expect(solvePuzzle(easy.blockers, { maxSolutions: 2 }).solutionCount).toBe(2);
  });
});
