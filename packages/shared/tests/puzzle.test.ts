import { describe, expect, it } from "vitest";
import {
  PUZZLE_DATASET_VERSION,
  RULES_VERSION,
  buildShareText,
  canonicalizePuzzleId,
  difficultyOptions,
  findPuzzleByDifficulty,
  getDailyDifficulty,
  getDailyPuzzle,
  getPuzzleById,
  getPuzzleDataset,
  getPuzzleDatasetVersion,
  getPuzzlesForDifficulty,
  pickPuzzleByDifficulty,
  puzzleFromId,
  renderEmojiBoard,
  scoreDifficulty,
  DEFAULT_BLOCKER_COUNT,
} from "../src";

describe("puzzle dataset", () => {
  const puzzles = getPuzzleDataset();

  it("matches the current dataset/rules version", () => {
    expect(getPuzzleDatasetVersion()).toBe(PUZZLE_DATASET_VERSION);
    for (const p of puzzles) expect(p.rulesVersion).toBe(RULES_VERSION);
  });

  it("has unique, canonical ids that match their blockers", () => {
    const ids = new Set<string>();
    for (const p of puzzles) {
      expect(p.blockers).toHaveLength(DEFAULT_BLOCKER_COUNT);
      expect(canonicalizePuzzleId(p.blockers)).toBe(p.id);
      ids.add(p.id);
    }
    expect(ids.size).toBe(puzzles.length);
  });

  it("labels each puzzle with the difficulty its solution count implies", () => {
    for (const p of puzzles) {
      expect(
        scoreDifficulty({ solutionCount: p.solutionCount, nodesVisited: 0, maxDepth: 0 })
      ).toBe(p.difficulty);
    }
  });

  it("has puzzles in every difficulty", () => {
    for (const d of difficultyOptions) {
      expect(getPuzzlesForDifficulty(d).length).toBeGreaterThan(0);
    }
  });

  it("looks puzzles up by id", () => {
    const first = puzzles[0]!;
    expect(getPuzzleById(first.id)).toBe(first);
    expect(getPuzzleById("nope")).toBeUndefined();
  });

  it("picks by difficulty using the provided rng", () => {
    const pool = getPuzzlesForDifficulty("hard");
    expect(pickPuzzleByDifficulty("hard", () => 0)).toBe(pool[0]);
    expect(pickPuzzleByDifficulty("hard", () => 0.9999)).toBe(pool[pool.length - 1]);
  });
});

describe("daily puzzle", () => {
  it("maps weekdays to difficulties", () => {
    // 2026-09-27 is a Sunday
    const days = Array.from({ length: 7 }, (_, i) =>
      getDailyDifficulty(new Date(2026, 8, 27 + i))
    );
    expect(days).toEqual(["easy", "easy", "medium", "medium", "hard", "hard", "insane"]);
  });

  it("is deterministic per date and matches that day's difficulty", () => {
    const date = new Date(2026, 8, 30);
    const a = getDailyPuzzle(date);
    const b = getDailyPuzzle(new Date(2026, 8, 30, 23, 59));
    expect(a).toEqual(b);
    expect(a.dateKey).toBe("2026-09-30");
    expect(a.difficulty).toBe(getDailyDifficulty(date));
  });

  it("findPuzzleByDifficulty is seed-deterministic", () => {
    expect(findPuzzleByDifficulty("medium", "seed")).toEqual(
      findPuzzleByDifficulty("medium", "seed")
    );
  });
});

describe("sharing", () => {
  const id = "A2A4D1D2F4F5F6";

  it("round-trips a puzzle id", () => {
    expect(canonicalizePuzzleId(puzzleFromId(id).blockers)).toBe(id);
  });

  it("builds share text with the puzzle url", () => {
    const text = buildShareText(id, {} as never, "https://example.com/");
    expect(text).toContain("https://example.com/?p=" + id);
    expect(text).toContain("Play Blocker Rush!");
  });

  it("renders blockers on a 6x6 emoji grid", () => {
    const grid = renderEmojiBoard(puzzleFromId(id).blockers, {} as never);
    const rows = grid.split("\n");
    expect(rows).toHaveLength(6);
    expect([...grid].filter((ch) => ch === "🔲")).toHaveLength(7);
  });
});
