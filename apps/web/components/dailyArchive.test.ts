import { describe, expect, it } from "vitest";
import {
  ARCHIVE_START_KEY,
  archiveDateKeys,
  archiveDayStatus,
  isArchiveDateKey,
  isValidDateKey,
  parseSolveHistory,
  recordSolve,
  summarizeHistory,
} from "./dailyArchive";

// A zone with DST, so the November change falls inside one of these ranges
// (Node applies TZ changes at runtime).
process.env.TZ = "America/New_York";

describe("isValidDateKey", () => {
  it.each(["2026-10-07", "2024-02-29"])("accepts %s", (key) => {
    expect(isValidDateKey(key)).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-07", "20261007", "", "2026-10-07x"])(
    "rejects %s",
    (key) => {
      expect(isValidDateKey(key)).toBe(false);
    },
  );
});

describe("isArchiveDateKey", () => {
  it("starts at ARCHIVE_START_KEY", () => {
    expect(isArchiveDateKey(ARCHIVE_START_KEY)).toBe(true);
    expect(isArchiveDateKey("2026-02-03")).toBe(false);
  });
});

describe("archiveDayStatus", () => {
  it("compares calendar days", () => {
    expect(archiveDayStatus("2026-10-06", "2026-10-07")).toBe("past");
    expect(archiveDayStatus("2026-10-07", "2026-10-07")).toBe("today");
    expect(archiveDayStatus("2026-10-08", "2026-10-07")).toBe("future");
    expect(archiveDayStatus("2025-12-31", "2026-01-01")).toBe("past");
  });
});

describe("archiveDateKeys", () => {
  it("lists today back to the start, newest first", () => {
    const keys = archiveDateKeys("2026-02-07");
    expect(keys).toEqual(["2026-02-07", "2026-02-06", "2026-02-05", "2026-02-04"]);
  });

  it("has one entry per calendar day across DST changes", () => {
    const keys = archiveDateKeys("2026-11-03");
    expect(keys.slice(0, 4)).toEqual(["2026-11-03", "2026-11-02", "2026-11-01", "2026-10-31"]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[keys.length - 1]).toBe(ARCHIVE_START_KEY);
  });

  it("is empty before the archive starts", () => {
    expect(archiveDateKeys("2026-01-01")).toEqual([]);
  });
});

describe("recordSolve", () => {
  it("adds and updates entries, returning the same object when unchanged", () => {
    const one = recordSolve({}, "2026-10-06", { moves: 9, elapsedMs: 1000, hints: 0 });
    expect(one).toEqual({ "2026-10-06": { moves: 9, elapsedMs: 1000, hints: 0 } });
    expect(recordSolve(one, "2026-10-06", { moves: 9, elapsedMs: 1000, hints: 0 })).toBe(one);
    expect(recordSolve(one, "2026-10-06", { moves: 9, elapsedMs: 1000, hints: 1 })).not.toBe(one);
    expect(recordSolve(one, "2026-10-06", { moves: 9, elapsedMs: 1400, hints: 0 })).toEqual({
      "2026-10-06": { moves: 9, elapsedMs: 1400, hints: 0 },
    });
  });
});

describe("parseSolveHistory", () => {
  it("keeps valid entries and drops malformed ones", () => {
    expect(
      parseSolveHistory({
        "2026-10-06": { moves: 9, elapsedMs: 1000, hints: 2 },
        "2026-10-05": { moves: 12 },
        "not-a-date": { moves: 1, elapsedMs: 1 },
        "2026-10-04": { elapsedMs: 5 },
        "2026-10-03": null,
      }),
    ).toEqual({
      "2026-10-06": { moves: 9, elapsedMs: 1000, hints: 2 },
      "2026-10-05": { moves: 12, elapsedMs: null, hints: 0 },
    });
  });

  it.each([null, "x", 3, []])("returns {} for %j", (value) => {
    expect(parseSolveHistory(value)).toEqual({});
  });
});

describe("summarizeHistory", () => {
  // 2026-10-04 is a Sunday (easy), 10-05 Monday (easy), 10-06 Tuesday
  // (medium), 10-10 Saturday (insane).
  const history = {
    "2026-10-04": { moves: 9, elapsedMs: 60_000, hints: 0 },
    "2026-10-05": { moves: 10, elapsedMs: 120_000, hints: 0 },
    "2026-10-06": { moves: 12, elapsedMs: 30_000, hints: 2 },
    "2026-10-10": { moves: 9, elapsedMs: null, hints: 0 },
  };

  it("groups by the weekday's difficulty", () => {
    const summary = summarizeHistory(history);
    expect(summary.solved).toBe(4);
    expect(summary.byDifficulty.easy).toEqual({ solved: 2, averageMs: 90_000, bestMs: 60_000 });
    expect(summary.byDifficulty.hard).toEqual({ solved: 0, averageMs: null, bestMs: null });
  });

  it("averages hinted solves but leaves them out of best times", () => {
    expect(summarizeHistory(history).byDifficulty.medium).toEqual({
      solved: 1,
      averageMs: 30_000,
      bestMs: null,
    });
  });

  it("counts untimed solves without timing them", () => {
    expect(summarizeHistory(history).byDifficulty.insane).toEqual({
      solved: 1,
      averageMs: null,
      bestMs: null,
    });
  });
});
