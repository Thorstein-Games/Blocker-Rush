#!/usr/bin/env node
import { once } from "node:events";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_VERSION = "v1";
const DATASET_VERSION = "v1";
const OUTPUT_PATH = path.join(__dirname, "../src/data/puzzles.v1.json");
const MAX_SOLUTIONS = 51;

const DIFFICULTY_RANGES = {
  insane: { min: 1, max: 3 },
  hard: { min: 4, max: 10 },
  medium: { min: 10, max: MAX_SOLUTIONS - 1 },
  easy: { min: MAX_SOLUTIONS, max: null },
};

const DEFAULT_BOARD = { cols: 6, rows: 6 };
const BLOCKER_COUNT = 7;

const COLUMN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const indexToColumnLabel = (index) => COLUMN_ALPHABET[index] ?? null;

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
    .sort((a, b) => a.y - b.y || a.x - b.x)
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

// Keep in sync with packages/shared/src/pieces.ts.
const PIECES = [
  makePiece("p1", "Dot", [{ x: 0, y: 0 }]),
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
  makePiece("p8", "Square", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]),
  makePiece("p9", "Long Line", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
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

const BOARD_CELL_COUNT = DEFAULT_BOARD.cols * DEFAULT_BOARD.rows;
const TOTAL_PIECE_CELLS = PIECES.reduce((sum, piece) => sum + piece.size, 0);
if (TOTAL_PIECE_CELLS + BLOCKER_COUNT !== BOARD_CELL_COUNT) {
  throw new Error(
    `Piece set size (${TOTAL_PIECE_CELLS}) + blockers (${BLOCKER_COUNT}) does not fill board (${BOARD_CELL_COUNT}).`,
  );
}
const CELL_BITS = Array.from(
  { length: BOARD_CELL_COUNT },
  (_, index) => 1n << BigInt(index),
);
const BINOMIAL_TABLE = (() => {
  const table = Array.from({ length: BOARD_CELL_COUNT + 1 }, () =>
    Array(BLOCKER_COUNT + 1).fill(0),
  );
  for (let n = 0; n <= BOARD_CELL_COUNT; n += 1) {
    table[n][0] = 1;
    const limit = Math.min(n, BLOCKER_COUNT);
    for (let k = 1; k <= limit; k += 1) {
      if (k === n) {
        table[n][k] = 1;
      } else {
        table[n][k] = table[n - 1][k - 1] + table[n - 1][k];
      }
    }
  }
  return table;
})();

const binomial = (n, k) => {
  if (n < 0 || k < 0 || k > n || n > BOARD_CELL_COUNT) return 0;
  return BINOMIAL_TABLE[n][k];
};

const PIECE_INDEX_BY_ID = PIECES.reduce((acc, piece, index) => {
  acc[piece.id] = index;
  return acc;
}, {});
const ALL_PIECES_MASK = (1 << PIECES.length) - 1;
const BOARD_MASK = (1n << BigInt(BOARD_CELL_COUNT)) - 1n;

const buildPlacementsIndex = () => {
  const placements = [];
  const placementsByCell = Array.from({ length: BOARD_CELL_COUNT }, () => []);

  for (const piece of PIECES) {
    const pieceIndex = PIECE_INDEX_BY_ID[piece.id];
    const transforms = PIECE_TRANSFORMS[piece.id];
    for (const transform of transforms) {
      for (let y = 0; y <= DEFAULT_BOARD.rows - transform.height; y += 1) {
        for (let x = 0; x <= DEFAULT_BOARD.cols - transform.width; x += 1) {
          let mask = 0n;
          const cells = [];
          for (const cell of transform.cells) {
            const cellIndex = (y + cell.y) * DEFAULT_BOARD.cols + (x + cell.x);
            mask |= CELL_BITS[cellIndex];
            cells.push(cellIndex);
          }
          const placementIndex = placements.length;
          placements.push({ mask, pieceIndex, cells });
          for (const cellIndex of cells) {
            placementsByCell[cellIndex].push(placementIndex);
          }
        }
      }
    }
  }

  return { placements, placementsByCell };
};

const { placements: ALL_PLACEMENTS, placementsByCell: PLACEMENTS_BY_CELL } =
  buildPlacementsIndex();

const solvePuzzle = (blockers, options = {}) => {
  const maxSolutions = options.maxSolutions ?? Number.POSITIVE_INFINITY;
  let occupied = 0n;

  for (const blocker of blockers) {
    const x = columnLabelToIndex(blocker.col);
    if (x === null) throw new Error(`Invalid blocker column: ${blocker.col}`);
    const y = blocker.row - 1;
    const index = y * DEFAULT_BOARD.cols + x;
    occupied |= CELL_BITS[index];
  }

  const result = {
    solutionCount: 0,
    nodesVisited: 0,
    maxDepth: 0,
  };

  const recurse = (freeMask, usedPiecesMask, depth) => {
    if (result.solutionCount >= maxSolutions) return;
    result.maxDepth = Math.max(result.maxDepth, depth);

    if (freeMask === 0n) {
      if (usedPiecesMask === ALL_PIECES_MASK) {
        result.solutionCount += 1;
      }
      return;
    }

    let bestCell = -1;
    let bestCount = Number.POSITIVE_INFINITY;

    for (let cellIndex = 0; cellIndex < BOARD_CELL_COUNT; cellIndex += 1) {
      const cellBit = CELL_BITS[cellIndex];
      if ((freeMask & cellBit) === 0n) continue;
      const placementsForCell = PLACEMENTS_BY_CELL[cellIndex];
      let count = 0;
      for (const placementIndex of placementsForCell) {
        const placement = ALL_PLACEMENTS[placementIndex];
        if (usedPiecesMask & (1 << placement.pieceIndex)) continue;
        if ((placement.mask & freeMask) !== placement.mask) continue;
        count += 1;
        if (count >= bestCount) break;
      }
      if (count === 0) return;
      if (count < bestCount) {
        bestCount = count;
        bestCell = cellIndex;
      }
    }

    if (bestCell < 0) return;

    const placementsForCell = PLACEMENTS_BY_CELL[bestCell];
    for (const placementIndex of placementsForCell) {
      const placement = ALL_PLACEMENTS[placementIndex];
      if (usedPiecesMask & (1 << placement.pieceIndex)) continue;
      if ((placement.mask & freeMask) !== placement.mask) continue;
      result.nodesVisited += 1;
      recurse(
        freeMask ^ placement.mask,
        usedPiecesMask | (1 << placement.pieceIndex),
        depth + 1,
      );
      if (result.solutionCount >= maxSolutions) return;
    }
  };

  const freeMask = BOARD_MASK & ~occupied;
  recurse(freeMask, 0, 0);
  return result;
};

const combinationCount = (n, k) => {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
};

const buildAllCells = () => {
  const cells = [];
  for (let row = 1; row <= DEFAULT_BOARD.rows; row += 1) {
    for (let col = 0; col < DEFAULT_BOARD.cols; col += 1) {
      const label = indexToColumnLabel(col);
      if (!label) {
        throw new Error(`Missing column label for index ${col}`);
      }
      cells.push({ col: label, row });
    }
  }
  return cells;
};

const generateCombinations = function* (items, choose) {
  const n = items.length;
  if (choose <= 0 || choose > n) return;
  const indices = Array.from({ length: choose }, (_, i) => i);
  while (true) {
    yield indices.map((index) => items[index]);
    let pivot = choose - 1;
    while (pivot >= 0 && indices[pivot] === pivot + n - choose) {
      pivot -= 1;
    }
    if (pivot < 0) break;
    indices[pivot] += 1;
    for (let i = pivot + 1; i < choose; i += 1) {
      indices[i] = indices[i - 1] + 1;
    }
  }
};

const scoreDifficultyFromCount = (solutionCount) => {
  if (solutionCount <= DIFFICULTY_RANGES.insane.max) return "insane";
  if (solutionCount <= DIFFICULTY_RANGES.hard.max) return "hard";
  if (solutionCount <= DIFFICULTY_RANGES.medium.max) return "medium";
  return "easy";
};

const unrankCombination = (rank, n, k) => {
  const indices = [];
  let start = 0;
  let remaining = rank;
  for (let i = 0; i < k; i += 1) {
    for (let value = start; value <= n - (k - i); value += 1) {
      const count = binomial(n - value - 1, k - i - 1);
      if (remaining < count) {
        indices.push(value);
        start = value + 1;
        break;
      }
      remaining -= count;
    }
  }
  return indices;
};

const nextCombination = (indices, n) => {
  const k = indices.length;
  let pivot = k - 1;
  while (pivot >= 0 && indices[pivot] === n - k + pivot) {
    pivot -= 1;
  }
  if (pivot < 0) return false;
  indices[pivot] += 1;
  for (let i = pivot + 1; i < k; i += 1) {
    indices[i] = indices[i - 1] + 1;
  }
  return true;
};

const generateCombinationsByRank = function* (
  items,
  choose,
  startRank,
  endRank,
) {
  const n = items.length;
  if (choose <= 0 || choose > n || startRank >= endRank) return;
  let indices = unrankCombination(startRank, n, choose);
  let rank = startRank;
  while (rank < endRank) {
    yield indices.map((index) => items[index]);
    rank += 1;
    if (rank >= endRank) break;
    if (!nextCombination(indices, n)) break;
  }
};

const writeChunk = async (stream, chunk) => {
  if (!stream.write(chunk)) {
    await once(stream, "drain");
  }
};

const pipeStream = (readStream, writeStream) =>
  new Promise((resolve, reject) => {
    readStream.on("error", reject);
    writeStream.on("error", reject);
    readStream.on("end", resolve);
    readStream.pipe(writeStream, { end: false });
  });

const runGeneration = async ({
  startRank,
  endRank,
  tempPath,
  progressEvery,
  onProgress,
}) => {
  const allCells = buildAllCells();
  const stats = {
    total: 0,
    easy: 0,
    medium: 0,
    hard: 0,
    insane: 0,
    unsolved: 0,
  };
  let processed = 0;
  let puzzleCount = 0;
  let firstPuzzle = true;

  const puzzleStream = fs.createWriteStream(tempPath, { encoding: "utf8" });

  for (const blockers of generateCombinationsByRank(
    allCells,
    BLOCKER_COUNT,
    startRank,
    endRank,
  )) {
    processed += 1;
    const id = canonicalizePuzzleId(blockers);
    const solve = solvePuzzle(blockers, { maxSolutions: MAX_SOLUTIONS });
    if (solve.solutionCount <= 0) {
      stats.unsolved += 1;
      continue;
    }
    const difficulty = scoreDifficultyFromCount(solve.solutionCount);
    const record = {
      id,
      blockers: blockers.map((coord) => `${coord.col}${coord.row}`),
      difficulty,
      solutionCount: solve.solutionCount,
      rulesVersion: RULES_VERSION,
    };
    if (!firstPuzzle) {
      await writeChunk(puzzleStream, ",\n");
    } else {
      firstPuzzle = false;
    }
    puzzleCount += 1;
    await writeChunk(puzzleStream, JSON.stringify(record));
    stats.total += 1;
    stats[difficulty] += 1;

    if (progressEvery && processed % progressEvery === 0 && onProgress) {
      onProgress(processed);
    }
  }

  await new Promise((resolve, reject) => {
    puzzleStream.end(resolve);
    puzzleStream.on("error", reject);
  });

  return { stats, puzzleCount, processed };
};

const main = async () => {
  const allCells = buildAllCells();
  const totalCombos = combinationCount(allCells.length, BLOCKER_COUNT);
  const envWorkers = Number.parseInt(
    process.env.PUZZLE_WORKERS ?? process.env.WORKERS ?? "",
    10,
  );
  const cpuCount = Math.max(1, os.cpus().length);
  const requestedWorkers =
    Number.isFinite(envWorkers) && envWorkers > 0
      ? envWorkers
      : Math.max(1, cpuCount - 1);
  const workerCount = Math.max(1, Math.min(requestedWorkers, totalCombos));

  await fsPromises.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const tempPaths = Array.from(
    { length: workerCount },
    (_, index) => `${OUTPUT_PATH}.part-${index}.tmp`,
  );

  const progressEvery = 10000;
  const workerProgress = Array(workerCount).fill(0);
  const updateProgress = () => {
    const processed = workerProgress.reduce((sum, value) => sum + value, 0);
    process.stdout.write(`Generated ${processed}/${totalCombos}\r`);
  };

  let combinedStats = {
    total: 0,
    easy: 0,
    medium: 0,
    hard: 0,
    insane: 0,
    unsolved: 0,
  };
  let puzzleCount = 0;

  if (workerCount === 1) {
    const {
      stats,
      puzzleCount: count,
      processed,
    } = await runGeneration({
      startRank: 0,
      endRank: totalCombos,
      tempPath: tempPaths[0],
      progressEvery,
      onProgress: (value) => {
        workerProgress[0] = value;
        updateProgress();
      },
    });
    combinedStats = stats;
    puzzleCount = count;
    workerProgress[0] = processed;
    updateProgress();
  } else {
    const chunkSize = Math.ceil(totalCombos / workerCount);
    const workerPromises = tempPaths.map((tempPath, index) => {
      const startRank = index * chunkSize;
      const endRank = Math.min(totalCombos, startRank + chunkSize);
      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), {
          workerData: {
            index,
            startRank,
            endRank,
            tempPath,
            progressEvery,
          },
          type: "module",
        });
        worker.on("message", (message) => {
          if (message.type === "progress") {
            workerProgress[index] = message.processed;
            updateProgress();
          } else if (message.type === "done") {
            workerProgress[index] = endRank - startRank;
            updateProgress();
            resolve(message);
          }
        });
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Worker ${index} exited with code ${code}`));
          }
        });
      });
    });

    const results = await Promise.all(workerPromises);
    for (const result of results) {
      combinedStats.total += result.stats.total;
      combinedStats.easy += result.stats.easy;
      combinedStats.medium += result.stats.medium;
      combinedStats.hard += result.stats.hard;
      combinedStats.insane += result.stats.insane;
      combinedStats.unsolved += result.stats.unsolved;
      puzzleCount += result.puzzleCount;
    }
  }

  const solutionCountCap = Number.isFinite(MAX_SOLUTIONS)
    ? MAX_SOLUTIONS
    : null;

  const datasetHeader = JSON.stringify({
    version: DATASET_VERSION,
    rulesVersion: RULES_VERSION,
    generatedAt: new Date().toISOString(),
    solutionCountCap,
    difficultyRanges: DIFFICULTY_RANGES,
    stats: combinedStats,
    puzzles: "__PUZZLES__",
  });
  const [headerPrefix, headerSuffix] = datasetHeader.split('"__PUZZLES__"');

  const outputStream = fs.createWriteStream(OUTPUT_PATH, { encoding: "utf8" });
  await writeChunk(outputStream, headerPrefix);
  await writeChunk(outputStream, "[\n");
  let firstChunk = true;
  for (let i = 0; i < tempPaths.length; i += 1) {
    const tempPath = tempPaths[i];
    const stats = await fsPromises.stat(tempPath);
    if (stats.size === 0) {
      continue;
    }
    if (!firstChunk) {
      await writeChunk(outputStream, ",\n");
    }
    firstChunk = false;
    await pipeStream(
      fs.createReadStream(tempPath, { encoding: "utf8" }),
      outputStream,
    );
  }
  await writeChunk(outputStream, "\n]");
  await writeChunk(outputStream, headerSuffix);
  await new Promise((resolve, reject) => {
    outputStream.end(resolve);
    outputStream.on("error", reject);
  });

  await Promise.all(
    tempPaths.map((tempPath) => fsPromises.unlink(tempPath).catch(() => {})),
  );
  process.stdout.write(`Generated ${puzzleCount} puzzles.\n`);
};

if (isMainThread) {
  console.log("starting");
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  console.log("not main thread starting");
  const { index, startRank, endRank, tempPath, progressEvery } = workerData;
  runGeneration({
    startRank,
    endRank,
    tempPath,
    progressEvery,
    onProgress: (processed) => {
      parentPort?.postMessage({ type: "progress", index, processed });
    },
  })
    .then((result) => {
      parentPort?.postMessage({ type: "done", index, ...result });
    })
    .catch((error) => {
      parentPort?.postMessage({
        type: "error",
        index,
        error: error?.message ?? String(error),
      });
      process.exit(1);
    });
}
