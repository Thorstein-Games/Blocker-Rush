import type { DailyPuzzle, Difficulty, Coordinate, PuzzleId } from "./types";
import { getDateKey, getWeekday, parsePuzzleId } from "./coords";
import { pickPuzzleByDifficulty, pickRandomPuzzle } from "./puzzle-dataset";

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const generatePuzzle = (rng: () => number): { id: PuzzleId; blockers: Coordinate[] } => {
  const record = pickRandomPuzzle(rng);
  return { id: record.id, blockers: record.blockers };
};

export const puzzleFromId = (id: PuzzleId): { id: PuzzleId; blockers: Coordinate[] } => ({
  id,
  blockers: parsePuzzleId(id),
});

export const findPuzzleByDifficulty = (
  target: Difficulty,
  seed: string,
  _maxAttempts = 200
) => {
  const rng = mulberry32(hashSeed(seed));
  const record = pickPuzzleByDifficulty(target, rng);
  return {
    id: record.id,
    blockers: record.blockers,
    difficulty: record.difficulty,
    solutionCount: record.solutionCount,
  };
};

export const getDailyDifficulty = (date: Date): Difficulty => {
  const day = getWeekday(date);
  if (day === 1 || day === 2) return "easy";
  if (day === 3 || day === 4) return "medium";
  return "hard";
};

export const getDailyPuzzle = (date: Date = new Date()): DailyPuzzle => {
  const dateKey = getDateKey(date);
  const difficulty = getDailyDifficulty(date);
  const result = findPuzzleByDifficulty(difficulty, `${dateKey}-${difficulty}`);
  return {
    id: result.id,
    blockers: result.blockers,
    difficulty: result.difficulty,
    dateKey,
  };
};
