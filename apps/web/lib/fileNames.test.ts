import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// macOS and Windows file systems ignore case, so two files whose names differ
// only in case (e.g. DailyArchive.tsx and dailyArchive.ts) make imports pick
// the wrong one there while Linux and CI build fine.
const root = join(__dirname, "..");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

// What an import without an extension would match: "dir/name".
const importKey = (path: string) =>
  relative(root, path)
    .replace(/(\.test)?\.(tsx?|jsx?|mjs|css)$/, "$1")
    .toLowerCase();

describe("file names", () => {
  it("no two source files differ only in case", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of ["app", "components", "lib"].flatMap((dir) => walk(join(root, dir)))) {
      const key = importKey(file);
      const other = seen.get(key);
      if (other) clashes.push(`${relative(root, other)} / ${relative(root, file)}`);
      seen.set(key, file);
    }
    expect(clashes).toEqual([]);
  });
});
