import type { Difficulty, SolveResult } from "./types";

const MAX_SOLUTIONS = 51;

const DIFFICULTY_RANGES = {
  insane: { min: 1, max: 3 },
  hard: { min: 4, max: 10 },
  medium: { min: 10, max: MAX_SOLUTIONS - 1 },
  easy: { min: MAX_SOLUTIONS, max: null },
};

const scoreDifficultyFromCount = (solutionCount: number) => {
  if (solutionCount <= DIFFICULTY_RANGES.insane.max) return "insane";
  if (solutionCount <= DIFFICULTY_RANGES.hard.max) return "hard";
  if (solutionCount <= DIFFICULTY_RANGES.medium.max) return "medium";
  return "easy";
};

export const isDifficultyMatch = (
  difficulty: Difficulty,
  target: Difficulty,
): boolean => {
  return difficulty === target;
};
