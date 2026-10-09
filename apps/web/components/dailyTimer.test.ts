import { describe, expect, it } from "vitest";
import {
  MAX_TICK_MS,
  advanceElapsed,
  dailyShareText,
  describeSolve,
  formatDuration,
  formatHints,
  formatMoves,
} from "./dailyTimer";

describe("advanceElapsed", () => {
  it("adds the time since the last tick", () => {
    expect(advanceElapsed(10_000, 1_000, 2_000)).toBe(11_000);
  });

  it("caps a long gap (sleep, throttled background tab)", () => {
    expect(advanceElapsed(0, 0, 8 * 60 * 60 * 1000)).toBe(MAX_TICK_MS);
  });

  it("ignores a clock that went backwards", () => {
    expect(advanceElapsed(5_000, 2_000, 1_000)).toBe(5_000);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [999, "0:00"],
    [7_000, "0:07"],
    [103_000, "1:43"],
    [754_000, "12:34"],
    [3_723_000, "1:02:03"],
    [-5_000, "0:00"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("formatMoves", () => {
  it("pluralises", () => {
    expect(formatMoves(0)).toBe("0 moves");
    expect(formatMoves(1)).toBe("1 move");
    expect(formatMoves(9)).toBe("9 moves");
  });
});

describe("formatHints", () => {
  it("pluralises", () => {
    expect(formatHints(1)).toBe("1 hint");
    expect(formatHints(3)).toBe("3 hints");
  });
});

describe("solve text", () => {
  it("mentions hints only when used", () => {
    expect(describeSolve(12, 103_000, 0)).toBe("1:43 with 12 moves");
    expect(describeSolve(12, 103_000, 2)).toBe("1:43 with 12 moves and 2 hints");
    expect(describeSolve(9, null, 1)).toBe("9 moves and 1 hint");
  });

  it("includes the time when known", () => {
    expect(describeSolve(12, 103_000)).toBe("1:43 with 12 moves");
  });

  it("falls back to moves only for solves saved before the timer", () => {
    expect(describeSolve(9, null)).toBe("9 moves");
  });
});

describe("dailyShareText", () => {
  const base = {
    dayLabel: "Oct 8",
    difficulty: "medium",
    moves: 12,
    elapsedMs: 103_000,
    hints: 0,
    streak: 5,
    url: "https://thorsteingames.com/blocker-rush/daily/2026-10-08",
  };

  it("shares time, moves, streak and that day's link", () => {
    expect(dailyShareText(base)).toBe(
      [
        "Blocker Rush · Oct 8 · Medium",
        "⏱️ 1:43 · 12 moves",
        "🔥 5-day streak",
        "https://thorsteingames.com/blocker-rush/daily/2026-10-08",
      ].join("\n"),
    );
  });

  it("adds hints when used", () => {
    expect(dailyShareText({ ...base, hints: 1 }).split("\n")[1]).toBe("⏱️ 1:43 · 12 moves · 💡 1 hint");
  });

  it("leaves out the streak for archive puzzles and an unknown time", () => {
    expect(dailyShareText({ ...base, streak: null, elapsedMs: null, moves: 1 })).toBe(
      [
        "Blocker Rush · Oct 8 · Medium",
        "1 move",
        "https://thorsteingames.com/blocker-rush/daily/2026-10-08",
      ].join("\n"),
    );
  });
});
