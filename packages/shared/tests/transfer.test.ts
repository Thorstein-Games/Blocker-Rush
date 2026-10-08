import { describe, expect, it } from "vitest";
import {
  MAX_TRANSFER_HISTORY,
  decodeTransfer,
  emptyProgressData,
  encodeTransfer,
  mergeProgressData,
  parseProgressData,
  type ProgressData,
  type ProgressStats,
} from "../src";

const data = (stats: ProgressStats, history: ProgressData["history"] = {}): ProgressData => ({ stats, history });

describe("parseProgressData", () => {
  it("keeps valid data and drops bad history entries", () => {
    expect(
      parseProgressData({
        stats: { streak: 3, lastCompletedDateKey: "2026-10-07", bestStreak: 9, extra: 1 },
        history: {
          "2026-10-07": { moves: 9, elapsedMs: 1000, hints: 1 },
          "2026-10-06": { moves: 10 },
          "2026-02-30": { moves: 9, elapsedMs: 1, hints: 0 },
          nope: { moves: 1 },
          "2026-10-05": { moves: -1 },
          "2026-10-04": { moves: 9, elapsedMs: -5, hints: 1.5 },
        },
      }),
    ).toEqual({
      stats: { streak: 3, lastCompletedDateKey: "2026-10-07", bestStreak: 9 },
      history: {
        "2026-10-07": { moves: 9, elapsedMs: 1000, hints: 1 },
        "2026-10-06": { moves: 10, elapsedMs: null, hints: 0 },
        "2026-10-04": { moves: 9, elapsedMs: null, hints: 0 },
      },
    });
  });

  it.each([null, "x", {}, { stats: {}, history: {} }, { stats: { streak: "3" }, history: {} }])(
    "rejects %j",
    (value) => {
      expect(parseProgressData(value)).toBeNull();
    },
  );

  it("rejects oversized history", () => {
    const history: Record<string, unknown> = {};
    const date = new Date(Date.UTC(2000, 0, 1));
    for (let i = 0; i <= MAX_TRANSFER_HISTORY; i += 1) {
      history[date.toISOString().slice(0, 10)] = { moves: 9 };
      date.setUTCDate(date.getUTCDate() + 1);
    }
    expect(parseProgressData({ stats: { streak: 0 }, history })).toBeNull();
  });
});

describe("mergeProgressData", () => {
  it("unions history and keeps the better solve of a shared day", () => {
    const a = data({ streak: 0 }, {
      "2026-10-01": { moves: 9, elapsedMs: 90_000, hints: 0 },
      "2026-10-02": { moves: 9, elapsedMs: null, hints: 0 },
      "2026-10-03": { moves: 9, elapsedMs: 50_000, hints: 1 },
    });
    const b = data({ streak: 0 }, {
      "2026-10-01": { moves: 12, elapsedMs: 80_000, hints: 0 },
      "2026-10-02": { moves: 9, elapsedMs: 70_000, hints: 2 },
      "2026-10-03": { moves: 9, elapsedMs: 99_000, hints: 0 },
      "2026-10-04": { moves: 9, elapsedMs: 10_000, hints: 0 },
    });
    expect(mergeProgressData(a, b).history).toEqual({
      "2026-10-01": { moves: 12, elapsedMs: 80_000, hints: 0 }, // faster
      "2026-10-02": { moves: 9, elapsedMs: 70_000, hints: 2 }, // timed beats untimed
      "2026-10-03": { moves: 9, elapsedMs: 99_000, hints: 0 }, // no hints beats faster
      "2026-10-04": { moves: 9, elapsedMs: 10_000, hints: 0 },
    });
    expect(mergeProgressData(b, a)).toEqual(mergeProgressData(a, b));
  });

  it.each([
    // [a, b, expected streak, expected last]
    ["same run on both devices", { streak: 5, lastCompletedDateKey: "2026-10-07" }, { streak: 5, lastCompletedDateKey: "2026-10-07" }, 5, "2026-10-07"],
    ["phone Mon–Wed, laptop Thu", { streak: 3, lastCompletedDateKey: "2026-10-07" }, { streak: 1, lastCompletedDateKey: "2026-10-08" }, 4, "2026-10-08"],
    ["overlapping runs", { streak: 4, lastCompletedDateKey: "2026-10-06" }, { streak: 3, lastCompletedDateKey: "2026-10-08" }, 6, "2026-10-08"],
    ["a gap between runs", { streak: 4, lastCompletedDateKey: "2026-10-05" }, { streak: 1, lastCompletedDateKey: "2026-10-07" }, 1, "2026-10-07"],
    ["across a month end", { streak: 2, lastCompletedDateKey: "2026-09-30" }, { streak: 1, lastCompletedDateKey: "2026-10-01" }, 3, "2026-10-01"],
    ["one device never played", { streak: 0 }, { streak: 2, lastCompletedDateKey: "2026-10-08" }, 2, "2026-10-08"],
  ] as const)("streaks: %s", (_name, a, b, streak, last) => {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const merged = mergeProgressData(data({ ...x }), data({ ...y })).stats;
      expect(merged.streak).toBe(streak);
      expect(merged.lastCompletedDateKey).toBe(last);
    }
  });

  it("keeps the best streak from either side, or a longer joined run", () => {
    expect(
      mergeProgressData(
        data({ streak: 1, lastCompletedDateKey: "2026-10-08", bestStreak: 20 }),
        data({ streak: 2, lastCompletedDateKey: "2026-10-01", bestStreak: 7 }),
      ).stats.bestStreak,
    ).toBe(20);
    expect(
      mergeProgressData(
        data({ streak: 3, lastCompletedDateKey: "2026-10-07", bestStreak: 3 }),
        data({ streak: 2, lastCompletedDateKey: "2026-10-09", bestStreak: 2 }),
      ).stats,
    ).toEqual({ streak: 5, lastCompletedDateKey: "2026-10-09", bestStreak: 5 });
  });

  it("is idempotent and merges with empty data unchanged", () => {
    const a = data(
      { streak: 2, lastCompletedDateKey: "2026-10-08", bestStreak: 4 },
      { "2026-10-08": { moves: 9, elapsedMs: 1, hints: 0 } },
    );
    expect(mergeProgressData(a, a)).toEqual(a);
    expect(mergeProgressData(a, emptyProgressData())).toEqual(a);
    expect(mergeProgressData(emptyProgressData(), a)).toEqual(a);
  });
});

describe("transfer encoding", () => {
  const sample: ProgressData = {
    stats: { streak: 12, lastCompletedDateKey: "2026-10-08", bestStreak: 30 },
    history: {
      "2026-10-08": { moves: 9, elapsedMs: 103_400, hints: 0 },
      "2026-10-07": { moves: 14, elapsedMs: null, hints: 2 },
      "2026-02-04": { moves: 11, elapsedMs: 3_723_000, hints: 0 },
    },
  };

  it("round-trips progress", () => {
    expect(decodeTransfer(encodeTransfer(sample))).toEqual(sample);
    expect(decodeTransfer(encodeTransfer(emptyProgressData()))).toEqual(emptyProgressData());
  });

  it("is URL-safe and reads back from a whole link", () => {
    const code = encodeTransfer(sample);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeTransfer(`https://thorsteingames.com/blocker-rush/transfer#p=${code}`)).toEqual(sample);
    expect(decodeTransfer(`  ${code}\n`)).toEqual(sample);
  });

  it("keeps times to a tenth of a second", () => {
    const decoded = decodeTransfer(
      encodeTransfer({ stats: { streak: 0 }, history: { "2026-10-08": { moves: 9, elapsedMs: 61_234, hints: 0 } } }),
    );
    expect(decoded?.history["2026-10-08"]?.elapsedMs).toBe(61_200);
  });

  it("is short: a year of daily solves fits in a few KB", () => {
    const history: ProgressData["history"] = {};
    const date = new Date(Date.UTC(2025, 9, 9));
    for (let i = 0; i < 365; i += 1) {
      history[date.toISOString().slice(0, 10)] = { moves: 9 + (i % 7), elapsedMs: 60_000 + i * 997, hints: i % 3 };
      date.setUTCDate(date.getUTCDate() + 1);
    }
    const code = encodeTransfer({ stats: { streak: 365, lastCompletedDateKey: "2026-10-08", bestStreak: 365 }, history });
    expect(code.length).toBeLessThan(3000);
    expect(Object.keys(decodeTransfer(code)!.history)).toHaveLength(365);
  });

  it.each([
    ["empty", ""],
    ["not base64url", "abc$def"],
    ["wrong version", "Ag"],
    ["truncated", () => encodeTransfer(sample).slice(0, -3)],
    ["trailing junk", () => `${encodeTransfer(sample)}AA`],
  ])("rejects %s input", (_name, input) => {
    expect(decodeTransfer(typeof input === "function" ? input() : input)).toBeNull();
  });
});
