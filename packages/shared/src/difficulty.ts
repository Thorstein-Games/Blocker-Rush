import type { Difficulty, SolveResult } from "./types";

export const scoreDifficulty = (result: SolveResult): Difficulty => {
  const { solutionCount, nodesVisited } = result;

  if (solutionCount <= 1 && nodesVisited > 5000) return "insane";
  if (solutionCount <= 1 || nodesVisited > 2000) return "hard";
  if (solutionCount <= 3 || nodesVisited > 500) return "medium";
  return "easy";
};

export const isDifficultyMatch = (
  difficulty: Difficulty,
  target: Difficulty
): boolean => {
  if (difficulty === target) return true;
  if (target === "hard") return difficulty === "hard" || difficulty === "insane";
  return false;
};
