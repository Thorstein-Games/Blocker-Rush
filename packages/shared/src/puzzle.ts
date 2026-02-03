import type { DailyPuzzle, Difficulty, Coordinate, PuzzleId } from "./types.js";
import { DEFAULT_BOARD, getDateKey, getWeekday } from "./coords.js";
import { canonicalizePuzzleId, parsePuzzleId, rollDice } from "./dice.js";
import { solvePuzzle } from "./solver.js";
import { isDifficultyMatch, scoreDifficulty } from "./difficulty.js";

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
  const blockers = rollDice(rng);
  const id = canonicalizePuzzleId(blockers);
  return { id, blockers };
};

export const puzzleFromId = (id: PuzzleId): { id: PuzzleId; blockers: Coordinate[] } => ({
  id,
  blockers: parsePuzzleId(id),
});

export const findPuzzleByDifficulty = (
  target: Difficulty,
  seed: string,
  maxAttempts = 200
) => {
  const rng = mulberry32(hashSeed(seed));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generatePuzzle(rng);
    const solve = solvePuzzle(candidate.blockers, { maxSolutions: 2 }, DEFAULT_BOARD);
    const difficulty = scoreDifficulty(solve);
    if (isDifficultyMatch(difficulty, target)) {
      return { ...candidate, difficulty, solutionCount: solve.solutionCount };
    }
  }
  const fallback = generatePuzzle(rng);
  const fallbackSolve = solvePuzzle(fallback.blockers, { maxSolutions: 2 }, DEFAULT_BOARD);
  return {
    ...fallback,
    difficulty: scoreDifficulty(fallbackSolve),
    solutionCount: fallbackSolve.solutionCount,
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
