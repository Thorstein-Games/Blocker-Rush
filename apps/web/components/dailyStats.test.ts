import { describe, expect, it } from "vitest";
import { getYesterdayKey, reconcileStats, recordDailySolve } from "./dailyStats";

// Pin a zone with DST so the DST cases below mean something wherever the
// tests run (Node applies TZ changes at runtime).
process.env.TZ = "America/New_York";

describe("getYesterdayKey", () => {
  it.each([
    ["2026-10-07", "2026-10-06"],
    ["2026-03-01", "2026-02-28"], // month boundary
    ["2028-03-01", "2028-02-29"], // leap year
    ["2027-01-01", "2026-12-31"], // year boundary
    ["2026-03-09", "2026-03-08"], // day after spring-forward
    ["2026-03-08", "2026-03-07"], // spring-forward day (23h long)
    ["2026-11-02", "2026-11-01"], // day after fall-back (1 Nov is 25h)
  ])("%s -> %s", (today, yesterday) => {
    expect(getYesterdayKey(today)).toBe(yesterday);
  });

  it("actually runs in a zone with DST", () => {
    expect(new Date(2026, 2, 7).getTimezoneOffset()).not.toBe(
      new Date(2026, 2, 9).getTimezoneOffset(),
    );
  });
});

describe("reconcileStats", () => {
  it("keeps the streak if the last solve was today or yesterday", () => {
    const stats = { streak: 4, lastCompletedDateKey: "2026-10-06" };
    expect(reconcileStats(stats, "2026-10-06")).toEqual(stats);
    expect(reconcileStats(stats, "2026-10-07")).toEqual(stats);
  });

  it("resets the streak after a missed day", () => {
    expect(
      reconcileStats({ streak: 4, lastCompletedDateKey: "2026-10-05" }, "2026-10-07"),
    ).toEqual({ streak: 0, lastCompletedDateKey: "2026-10-05" });
  });

  it("treats no previous solve as no streak", () => {
    expect(reconcileStats({ streak: 3 }, "2026-10-07").streak).toBe(0);
  });
});

describe("recordDailySolve", () => {
  it("starts a streak at 1", () => {
    expect(recordDailySolve({ streak: 0 }, "2026-10-07")).toEqual({
      streak: 1,
      lastCompletedDateKey: "2026-10-07",
    });
  });

  it("extends a streak from yesterday, across a month boundary", () => {
    expect(
      recordDailySolve({ streak: 6, lastCompletedDateKey: "2026-02-28" }, "2026-03-01"),
    ).toEqual({ streak: 7, lastCompletedDateKey: "2026-03-01" });
  });

  it("restarts at 1 after a missed day", () => {
    expect(
      recordDailySolve({ streak: 6, lastCompletedDateKey: "2026-10-04" }, "2026-10-07"),
    ).toEqual({ streak: 1, lastCompletedDateKey: "2026-10-07" });
  });

  it("returns null when today is already recorded", () => {
    expect(
      recordDailySolve({ streak: 2, lastCompletedDateKey: "2026-10-07" }, "2026-10-07"),
    ).toBeNull();
  });
});
