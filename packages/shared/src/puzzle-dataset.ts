import type { Difficulty, PuzzleId, PuzzleRecord } from "./types";
import { parseCoordinate } from "./coords";
import { isDifficultyMatch } from "./difficulty";
import { PUZZLE_DATASET_VERSION } from "./rules";
import rawDataset from "./data/puzzles.v1.sample.json" assert { type: "json" };

type RawPuzzleRecord = {
  id: PuzzleId;
  blockers: string[];
  difficulty: Difficulty;
  solutionCount: number;
  rulesVersion: string;
};

type PuzzleDataset = {
  version: string;
  rulesVersion: string;
  puzzles: RawPuzzleRecord[];
};

const dataset = rawDataset as PuzzleDataset;

if (dataset.version !== PUZZLE_DATASET_VERSION) {
  throw new Error(
    `Puzzle dataset version mismatch: expected ${PUZZLE_DATASET_VERSION}, got ${dataset.version}`
  );
}

const puzzleRecords: PuzzleRecord[] = dataset.puzzles.map((record) => ({
  id: record.id,
  blockers: record.blockers.map((coord) => parseCoordinate(coord)),
  difficulty: record.difficulty,
  solutionCount: record.solutionCount,
  rulesVersion: record.rulesVersion,
}));

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
