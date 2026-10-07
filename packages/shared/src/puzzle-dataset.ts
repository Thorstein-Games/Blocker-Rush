import type { Coordinate, Difficulty, PuzzleId, PuzzleRecord } from "./types";
import { parsePuzzleId } from "./coords";
import { isDifficultyMatch } from "./difficulty";
import { PUZZLE_DATASET_VERSION } from "./rules";
// Derived from puzzles.v1.sample.json by scripts/compact-puzzles.js: each
// difficulty is a space-separated list of "<id>:<solutionCount>", in sample
// order. Much smaller than the sample, which matters because the web app
// ships this to every page.
import rawDataset from "./data/puzzles.v1.compact.json" assert { type: "json" };

type CompactPuzzleDataset = {
  version: string;
  rulesVersion: string;
  puzzles: Record<Difficulty, string>;
};

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard", "insane"];

const dataset = rawDataset as CompactPuzzleDataset;

if (dataset.version !== PUZZLE_DATASET_VERSION) {
  throw new Error(
    `Puzzle dataset version mismatch: expected ${PUZZLE_DATASET_VERSION}, got ${dataset.version}`
  );
}

// Row-major, matching the blockers order in the sample dataset.
const byRowThenCol = (a: Coordinate, b: Coordinate): number =>
  a.row - b.row || a.col.localeCompare(b.col);

const puzzleRecords: PuzzleRecord[] = DIFFICULTY_ORDER.flatMap((difficulty) =>
  dataset.puzzles[difficulty].split(" ").map((entry): PuzzleRecord => {
    const [id = "", count = ""] = entry.split(":");
    return {
      id,
      blockers: parsePuzzleId(id).sort(byRowThenCol),
      difficulty,
      solutionCount: Number(count),
      rulesVersion: dataset.rulesVersion,
    };
  })
);

const puzzleById = new Map<PuzzleId, PuzzleRecord>(
  puzzleRecords.map((record) => [record.id, record])
);

const puzzlesByDifficulty = new Map<Difficulty, PuzzleRecord[]>();

const pickFrom = <T>(items: T[], rng: () => number): T | undefined => {
  if (items.length === 0) return undefined;
  const index = Math.floor(rng() * items.length);
  return items[index];
};

export const getPuzzleDatasetVersion = (): string => dataset.version;

export const getPuzzleDataset = (): PuzzleRecord[] => puzzleRecords;

export const getPuzzleById = (id: PuzzleId): PuzzleRecord | undefined =>
  puzzleById.get(id);

export const getPuzzlesForDifficulty = (difficulty: Difficulty): PuzzleRecord[] => {
  const cached = puzzlesByDifficulty.get(difficulty);
  if (cached) return cached;
  const filtered = puzzleRecords.filter((record) =>
    isDifficultyMatch(record.difficulty, difficulty)
  );
  puzzlesByDifficulty.set(difficulty, filtered);
  return filtered;
};

export const pickRandomPuzzle = (rng: () => number = Math.random): PuzzleRecord => {
  const picked = pickFrom(puzzleRecords, rng);
  if (!picked) {
    throw new Error("Puzzle dataset is empty.");
  }
  return picked;
};

export const pickPuzzleByDifficulty = (
  difficulty: Difficulty,
  rng: () => number = Math.random
): PuzzleRecord => {
  const pool = getPuzzlesForDifficulty(difficulty);
  return pickFrom(pool, rng) ?? pickRandomPuzzle(rng);
};
