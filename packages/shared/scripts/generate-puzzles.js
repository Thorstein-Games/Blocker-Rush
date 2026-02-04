#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_VERSION = "v1";
const DATASET_VERSION = "v1";
const OUTPUT_PATH = path.join(__dirname, "../src/data/puzzles.v1.json");
const MAX_SOLUTIONS = 4;

const DEFAULT_BOARD = { cols: 6, rows: 6 };

const DICE_FACES = [
  ["A1", "C1", "D1", "D2", "E2", "F3"],
  ["A2", "B2", "C2", "A3", "B1", "B3"],
  ["C3", "D3", "E3", "B4", "C4", "D4"],
  ["E1", "F2", "F2", "B6", "A5", "A5"],
  ["A4", "B5", "C6", "C5", "D6", "F6"],
  ["E4", "F4", "E5", "F5", "D5", "E6"],
  ["F1", "F1", "F1", "A6", "A6", "A6"],
];

const COLUMN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const columnLabelToIndex = (label) => {
  const normalized = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return null;
  let index = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized.charCodeAt(i) - 64;
    if (char < 1 || char > 26) return null;
    index = index * 26 + char;
  }
  return index - 1;
};

const parseCoordinate = (value) => {
  const match = value.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid coordinate: ${value}`);
  }
  const col = match[1] ?? "";
  const row = Number.parseInt(match[2] ?? "", 10);
  return { col, row };
};

const sortCoordinates = (coords) =>
  [...coords].sort((a, b) => {
    const aIndex = columnLabelToIndex(a.col);
    const bIndex = columnLabelToIndex(b.col);
    if (aIndex !== null && bIndex !== null && aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    if (a.col !== b.col) return a.col < b.col ? -1 : 1;
    return a.row - b.row;
  });

const canonicalizePuzzleId = (blockers) =>
  sortCoordinates(blockers)
    .map((coord) => `${coord.col}${coord.row}`)
    .join("");

const normalizeCells = (cells) => {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
};

const cellsToKey = (cells) =>
  normalizeCells(cells)
    .slice()
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map((cell) => `${cell.x},${cell.y}`)
    .join("|");

const getBounds = (cells) => {
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  return {
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  };
};

const makePiece = (id, name, cells) => ({
  id,
  name,
  size: cells.length,
  cells,
});

const PIECES = [
  makePiece("p1", "Crown", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
  ]),
  makePiece("p2", "Spire", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ]),
  makePiece("p3", "Shift", [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]),
  makePiece("p4", "Fork", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
  ]),
  makePiece("p5", "Kite", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]),
  makePiece("p6", "Line", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]),
  makePiece("p7", "Twin", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]),
  makePiece("p8", "Twin", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]),
  makePiece("p9", "Twin", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]),
];

const rotate90 = (cells) => cells.map((cell) => ({ x: cell.y, y: -cell.x }));
const reflect = (cells) => cells.map((cell) => ({ x: -cell.x, y: cell.y }));

const generateTransforms = (piece) => {
  const transforms = [];
  const seen = new Set();

  const pushTransform = (cells) => {
    const normalized = normalizeCells(cells);
    const key = cellsToKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    const bounds = getBounds(normalized);
    transforms.push({
      id: key,
      cells: normalized,
      width: bounds.width,
      height: bounds.height,
    });
  };

  let current = piece.cells;
  for (let i = 0; i < 4; i += 1) {
    pushTransform(current);
    pushTransform(reflect(current));
    current = rotate90(current);
  }

  return transforms;
};

const PIECE_TRANSFORMS = PIECES.reduce((acc, piece) => {
  acc[piece.id] = generateTransforms(piece);
  return acc;
}, {});

const orderPieces = (pieceIds) =>
  [...pieceIds].sort((a, b) => {
    const aTransforms = PIECE_TRANSFORMS[a]?.length ?? 0;
    const bTransforms = PIECE_TRANSFORMS[b]?.length ?? 0;
    const aSize = PIECES.find((piece) => piece.id === a)?.size ?? 0;
    const bSize = PIECES.find((piece) => piece.id === b)?.size ?? 0;
    return bSize - aSize || bTransforms - aTransforms || a.localeCompare(b);
  });

const solvePuzzle = (blockers, options = {}) => {
  const maxSolutions = options.maxSolutions ?? Number.POSITIVE_INFINITY;
  const size = DEFAULT_BOARD;
  const baseCells = Array.from({ length: size.cols * size.rows }, () => null);

  for (const blocker of blockers) {
    const x = columnLabelToIndex(blocker.col);
    if (x === null) throw new Error(`Invalid blocker column: ${blocker.col}`);
    const y = blocker.row - 1;
    baseCells[y * size.cols + x] = "blocker";
  }

  const pieceIds = orderPieces(PIECES.map((piece) => piece.id));
  const placements = {};
  const result = {
    solutionCount: 0,
    nodesVisited: 0,
    maxDepth: 0,
  };

  const canPlaceAt = (origin, offsets) => {
    for (const offset of offsets) {
      const x = origin.x + offset.x;
      const y = origin.y + offset.y;
      if (x < 0 || y < 0 || x >= size.cols || y >= size.rows) return false;
      const idx = y * size.cols + x;
      if (baseCells[idx] !== null) return false;
    }
    return true;
  };

  const placeCells = (origin, offsets, pieceId) => {
    for (const offset of offsets) {
      const x = origin.x + offset.x;
      const y = origin.y + offset.y;
      const idx = y * size.cols + x;
      baseCells[idx] = pieceId;
    }
  };

  const clearCells = (origin, offsets) => {
    for (const offset of offsets) {
      const x = origin.x + offset.x;
      const y = origin.y + offset.y;
      const idx = y * size.cols + x;
      baseCells[idx] = null;
    }
  };

  const recurse = (index) => {
    if (result.solutionCount >= maxSolutions) return;
    result.maxDepth = Math.max(result.maxDepth, index);

    if (index >= pieceIds.length) {
      result.solutionCount += 1;
      return;
    }

    const pieceId = pieceIds[index];
    const transforms = PIECE_TRANSFORMS[pieceId];

    for (const transform of transforms) {
      for (let y = 0; y <= size.rows - transform.height; y += 1) {
        for (let x = 0; x <= size.cols - transform.width; x += 1) {
          const origin = { x, y };
          if (!canPlaceAt(origin, transform.cells)) continue;
          result.nodesVisited += 1;
          placeCells(origin, transform.cells, pieceId);
          placements[pieceId] = { origin, transformId: transform.id };
          recurse(index + 1);
          placements[pieceId] = undefined;
          clearCells(origin, transform.cells);
          if (result.solutionCount >= maxSolutions) return;
        }
      }
    }
  };

  recurse(0);
  return result;
};

const scoreDifficulty = (result) => {
  const { solutionCount, nodesVisited } = result;
  if (solutionCount <= 1 && nodesVisited > 5000) return "insane";
  if (solutionCount <= 1 || nodesVisited > 2000) return "hard";
  if (solutionCount <= 3 || nodesVisited > 500) return "medium";
  return "easy";
};

const uniqueFaces = DICE_FACES.map((faces) => Array.from(new Set(faces)));

const buildCombinations = () => {
  const combos = [];
  const recurse = (index, current) => {
    if (index >= uniqueFaces.length) {
      combos.push([...current]);
      return;
    }
    for (const face of uniqueFaces[index]) {
      current.push(face);
      recurse(index + 1, current);
      current.pop();
    }
  };
  recurse(0, []);
  return combos;
};

const main = async () => {
  const combos = buildCombinations();
  const puzzles = [];
  const stats = { total: 0, easy: 0, medium: 0, hard: 0, insane: 0, unsolved: 0 };

  for (let i = 0; i < combos.length; i += 1) {
    const faces = combos[i];
    const blockers = faces.map(parseCoordinate);
    const id = canonicalizePuzzleId(blockers);
    const solve = solvePuzzle(blockers, { maxSolutions: MAX_SOLUTIONS });
    if (solve.solutionCount <= 0) {
      stats.unsolved += 1;
      continue;
    }
    const difficulty = scoreDifficulty(solve);
    const record = {
      id,
      blockers: blockers.map((coord) => `${coord.col}${coord.row}`),
      difficulty,
      solutionCount: solve.solutionCount,
      rulesVersion: RULES_VERSION,
    };
    puzzles.push(record);
    stats.total += 1;
    stats[difficulty] += 1;

    if ((i + 1) % 1000 === 0) {
      process.stdout.write(`Generated ${i + 1}/${combos.length}\r`);
    }
  }

  const dataset = {
    version: DATASET_VERSION,
    rulesVersion: RULES_VERSION,
    generatedAt: new Date().toISOString(),
    solutionCountCap: MAX_SOLUTIONS,
    stats,
    puzzles,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(dataset));
  process.stdout.write(`Generated ${puzzles.length} puzzles.\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
