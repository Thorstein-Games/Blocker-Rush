#!/usr/bin/env node
// Mirrors @blocker-rush/shared (server-relevant modules) and
// @blocker-rush/protocol into megingjord's src/games/blocker-rush/, which
// can't depend on this repo directly.
//
//   node scripts/sync-megingjord.mjs          write the mirror
//   node scripts/sync-megingjord.mjs --check  exit 1 if the mirror has drifted
//
// Megingjord is found via $MEGINGJORD_DIR, defaulting to ../megingjord.
// --check skips (exit 0) when it isn't there, so verify still works alone.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const megingjordDir = path.resolve(
  process.env.MEGINGJORD_DIR ?? path.join(repoRoot, "..", "megingjord")
);
const targetRoot = path.join(megingjordDir, "src/games/blocker-rush");
const check = process.argv.includes("--check");

const header = (source) =>
  `// GENERATED from Blocker-Rush ${source} by scripts/sync-megingjord.mjs.\n` +
  `// Do not edit here: change it in Blocker-Rush and re-run the sync.\n`;

const exportsIndex = (source, modules) =>
  header(source) + modules.map((m) => `export * from "./${m}";\n`).join("");

const mirrors = [
  {
    source: "packages/shared/src",
    target: "shared",
    // solver/puzzle/share are client-only (daily puzzle, sharing, generation).
    modules: ["types", "coords", "pieces", "board", "difficulty", "rules", "puzzle-dataset"],
    data: ["data/puzzles.v1.sample.json"],
    // megingjord compiles to CommonJS, which rejects import assertions.
    transform: (code) => code.replace(/ assert \{ type: "json" \}/g, ""),
  },
  {
    source: "packages/protocol/src",
    target: "protocol",
    modules: ["domain", "messages"],
    data: [],
    transform: (code) => code.replace(/"@blocker-rush\/shared"/g, '"../shared"'),
  },
];

const expected = new Map();
for (const m of mirrors) {
  const outDir = path.join(targetRoot, m.target);
  for (const mod of m.modules) {
    const rel = `${m.source}/${mod}.ts`;
    const code = fs.readFileSync(path.join(repoRoot, rel), "utf8");
    expected.set(path.join(outDir, `${mod}.ts`), header(rel) + m.transform(code));
  }
  expected.set(path.join(outDir, "index.ts"), exportsIndex(m.source, m.modules));
  for (const file of m.data) {
    expected.set(
      path.join(outDir, file),
      fs.readFileSync(path.join(repoRoot, m.source, file), "utf8")
    );
  }
}

const listFiles = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((e) => e.isFile())
        .map((e) => path.join(e.parentPath ?? e.path, e.name))
    : [];

const stale = mirrors
  .flatMap((m) => listFiles(path.join(targetRoot, m.target)))
  .filter((file) => !expected.has(file));

if (!fs.existsSync(targetRoot)) {
  const msg = `megingjord not found at ${megingjordDir} (set MEGINGJORD_DIR)`;
  if (check) {
    console.log(`sync-megingjord: skipped, ${msg}`);
    process.exit(0);
  }
  console.error(`sync-megingjord: ${msg}`);
  process.exit(1);
}

const rel = (file) => path.relative(megingjordDir, file);

if (check) {
  const drifted = [...expected]
    .filter(([file, content]) => !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content)
    .map(([file]) => file);
  if (drifted.length === 0 && stale.length === 0) {
    console.log("sync-megingjord: megingjord mirror is up to date");
    process.exit(0);
  }
  for (const file of drifted) console.error(`  out of date: ${rel(file)}`);
  for (const file of stale) console.error(`  not mirrored (remove?): ${rel(file)}`);
  console.error("sync-megingjord: run `npm run sync:megingjord` to update megingjord");
  process.exit(1);
}

for (const [file, content] of expected) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
    fs.writeFileSync(file, content);
    console.log(`  wrote ${rel(file)}`);
  }
}
for (const file of stale) {
  fs.rmSync(file);
  console.log(`  removed ${rel(file)}`);
}
console.log("sync-megingjord: done");
