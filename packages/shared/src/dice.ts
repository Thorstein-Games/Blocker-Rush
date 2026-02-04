import type { Coordinate, PuzzleId } from "./types";
import { parseCoordinate, sortCoordinates } from "./coords";

export const DICE_FACES: string[][] = [
  ["A1", "C1", "D1", "D2", "E2", "F3"],
  ["A2", "B2", "C2", "A3", "B1", "B3"],
  ["C3", "D3", "E3", "B4", "C4", "D4"],
  ["E1", "F2", "F2", "B6", "A5", "A5"],
  ["A4", "B5", "C6", "C5", "D6", "F6"],
  ["E4", "F4", "E5", "F5", "D5", "E6"],
  ["F1", "F1", "F1", "A6", "A6", "A6"],
];

export const rollDice = (rng: () => number): Coordinate[] =>
  DICE_FACES.map((faces) => {
    const face = faces[Math.floor(rng() * faces.length)] ?? faces[0];
    return parseCoordinate(face);
  });

export const canonicalizePuzzleId = (blockers: Coordinate[]): PuzzleId => {
  const ordered = sortCoordinates(blockers);
  return ordered.map((coord) => `${coord.col}${coord.row}`).join("");
};

export const parsePuzzleId = (raw: string): Coordinate[] => {
  const normalized = raw.trim().toUpperCase();
  const tokens = normalized.match(/[A-Z]+[0-9]+/g);
  if (!tokens || tokens.length === 0) {
    throw new Error("Puzzle id must contain at least one coordinate.");
  }
  if (tokens.join("") !== normalized) {
    throw new Error("Puzzle id has an invalid format.");
  }
  return sortCoordinates(tokens.map((token) => parseCoordinate(token)));
};
