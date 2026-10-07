#!/usr/bin/env node
// Derives src/data/puzzles.v1.compact.json from puzzles.v1.sample.json.
// The sample is the source of truth (and what refresh-samples writes); the
// compact copy is what the app and megingjord load. It stores each puzzle as
// "<id>:<solutionCount>", grouped by difficulty in sample order, which cuts
// ~1MB of JSON down to ~140KB. Blockers are recovered from the id and
// difficulty from the group. tests/puzzle.test.ts fails if the two drift.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/data");
const INPUT_PATH = path.join(dataDir, "puzzles.v1.sample.json");
const OUTPUT_PATH = path.join(dataDir, "puzzles.v1.compact.json");

export const DIFFICULTY_ORDER = ["easy", "medium", "hard", "insane"];

export const compactDataset = (sample) => {
  const groups = Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, []]));
  for (const record of sample.puzzles) {
    if (record.rulesVersion !== sample.rulesVersion) {
      throw new Error(`${record.id}: rulesVersion ${record.rulesVersion} != ${sample.rulesVersion}`);
    }
    groups[record.difficulty].push(`${record.id}:${record.solutionCount}`);
  }
  // Concatenating the groups must reproduce sample order, or seeded picks
  // (the daily puzzle) would change.
  const regrouped = DIFFICULTY_ORDER.flatMap((d) => groups[d]).join(" ");
  const original = sample.puzzles.map((r) => `${r.id}:${r.solutionCount}`).join(" ");
  if (regrouped !== original) {
    throw new Error("Sample puzzles must be ordered easy, medium, hard, insane.");
  }
  return {
    version: sample.version,
    rulesVersion: sample.rulesVersion,
    puzzles: Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, groups[d].join(" ")])),
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sample = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(compactDataset(sample)) + "\n");
  console.log(`Wrote ${sample.puzzles.length} puzzles to ${OUTPUT_PATH}`);
}
