#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.join(__dirname, "../src/data/fullpuzzles.v1.json");
const OUTPUT_PATH = path.join(__dirname, "../src/data/puzzles.v1.sample.json");

const TARGET_PER_DIFFICULTY = Number(process.env.SAMPLE_PER_DIFFICULTY ?? 2000);

const DIFFICULTY_RANGES = {
  insane: { min: 1, max: 3 },
  hard: { min: 4, max: 10 },
  medium: { min: 10, max: 50 },
  easy: { min: 51, max: null },
};

const difficulties = ["easy", "medium", "hard", "insane"];
const targets = Object.fromEntries(
  difficulties.map((difficulty) => [difficulty, TARGET_PER_DIFFICULTY]),
);

const samples = Object.fromEntries(
  difficulties.map((difficulty) => [difficulty, []]),
);
const seenCounts = Object.fromEntries(
  difficulties.map((difficulty) => [difficulty, 0]),
);

const considerRecord = (record) => {
  const difficulty = record.difficulty;
  if (!targets[difficulty]) return;
  seenCounts[difficulty] += 1;
  const bucket = samples[difficulty];
  const target = targets[difficulty];
  if (bucket.length < target) {
    bucket.push(record);
    return;
  }
  const pick = Math.floor(Math.random() * seenCounts[difficulty]);
  if (pick < target) {
    bucket[pick] = record;
  }
};

const stream = fs.createReadStream(INPUT_PATH, {
  encoding: "utf8",
  highWaterMark: 256 * 1024,
});

const marker = '"puzzles":[';
let pending = "";
let inPuzzles = false;
let done = false;

let inString = false;
let escapeNext = false;
let depth = 0;
let currentParts = [];

const processChars = (chunk) => {
  let lastIndex = 0;

  for (let i = 0; i < chunk.length; i += 1) {
    const ch = chunk[i];

    if (done) return;

    if (depth === 0) {
      if (ch === "{") {
        depth = 1;
        inString = false;
        escapeNext = false;
        currentParts = ["{"];
        lastIndex = i + 1;
      } else if (ch === "]") {
        done = true;
        return;
      }
      continue;
    }

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === "\\") {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        currentParts.push(chunk.slice(lastIndex, i + 1));
        const jsonStr = currentParts.join("");
        try {
          const record = JSON.parse(jsonStr);
          considerRecord(record);
        } catch (error) {
          console.error("Failed to parse record", error);
          process.exit(1);
        }
        currentParts = [];
        lastIndex = i + 1;
      }
    }
  }

  if (depth > 0) {
    currentParts.push(chunk.slice(lastIndex));
  }
};

stream.on("data", (chunk) => {
  if (!inPuzzles) {
    const combined = pending + chunk;
    const idx = combined.indexOf(marker);
    if (idx === -1) {
      pending = combined.slice(-marker.length);
      return;
    }
    inPuzzles = true;
    const rest = combined.slice(idx + marker.length);
    pending = "";
    processChars(rest);
    return;
  }
  processChars(chunk);
});

stream.on("end", () => {
  const puzzles = difficulties.flatMap((difficulty) => samples[difficulty]);
  const stats = {
    total: puzzles.length,
    easy: samples.easy.length,
    medium: samples.medium.length,
    hard: samples.hard.length,
    insane: samples.insane.length,
    unsolved: 0,
  };

  const dataset = {
    version: "v1",
    rulesVersion: "v1",
    generatedAt: new Date().toISOString(),
    solutionCountCap: 51,
    difficultyRanges: DIFFICULTY_RANGES,
    stats,
    puzzles,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dataset));
  console.log(`Wrote ${puzzles.length} puzzles to ${OUTPUT_PATH}`);
});

stream.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
