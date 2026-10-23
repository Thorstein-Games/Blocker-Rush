import { describe, expect, it } from "vitest";
import { mergeCloudSaves, SYNC_KEYS } from "./cloudSync";

const STATS = "blockerRush.daily.stats";
const HISTORY = "blockerRush.daily.history";
const solve = (moves: number, elapsedMs: number | null = moves * 1000, hints = 0) => ({ moves, elapsedMs, hints });

describe("cloud saves", () => {
  it("syncs the stats and solve history, not boards in progress", () => {
    expect(SYNC_KEYS).toEqual([STATS, HISTORY]);
  });

  it("joins a streak played on two devices and keeps every solve", () => {
    const phone = {
      [STATS]: { streak: 2, lastCompletedDateKey: "2026-10-17", bestStreak: 2 },
      [HISTORY]: { "2026-10-16": solve(12), "2026-10-17": solve(15) },
    };
    const laptop = {
      [STATS]: { streak: 1, lastCompletedDateKey: "2026-10-18", bestStreak: 1 },
      [HISTORY]: { "2026-10-18": solve(11), "2026-10-01": solve(20) },
    };
    const merged = mergeCloudSaves(phone, laptop);
    expect(merged[STATS]).toEqual({ streak: 3, lastCompletedDateKey: "2026-10-18", bestStreak: 3 });
    expect(Object.keys(merged[HISTORY] as object).sort()).toEqual(["2026-10-01", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(mergeCloudSaves(laptop, phone)).toEqual(merged);
    expect(mergeCloudSaves(merged, merged)).toEqual(merged);
  });

  it("keeps the better solve of a day played on both", () => {
    const a = { [HISTORY]: { "2026-10-20": solve(14, 90_000, 1) } };
    const b = { [HISTORY]: { "2026-10-20": solve(16, 120_000, 0) } };
    // Fewer hints wins first.
    expect((mergeCloudSaves(a, b)[HISTORY] as Record<string, unknown>)["2026-10-20"]).toEqual(solve(16, 120_000, 0));
  });

  it("brings a new device everything, and ignores damaged data", () => {
    const account = { [STATS]: { streak: 4, lastCompletedDateKey: "2026-10-20", bestStreak: 9 }, [HISTORY]: { "2026-10-20": solve(10) } };
    expect(mergeCloudSaves({}, account)).toEqual(account);
    expect(mergeCloudSaves(account, { [STATS]: "junk", [HISTORY]: { nope: 1 } })).toEqual(account);
    expect(mergeCloudSaves({}, {})).toEqual({});
  });
});
