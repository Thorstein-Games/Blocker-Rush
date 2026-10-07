import { describe, expect, it } from "vitest";
import {
  MAX_TICK_MS,
  advanceElapsed,
  dailyShareMessage,
  describeSolve,
  formatDuration,
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

describe("solve text", () => {
  it("includes the time when known", () => {
    expect(describeSolve(12, 103_000)).toBe("1:43 with 12 moves");
    expect(dailyShareMessage(1, 7_000)).toBe(
      "I solved today's Blocker Rush in 0:07 with 1 move! Can you beat that?",
    );
  });

  it("falls back to moves only for solves saved before the timer", () => {
    expect(describeSolve(9, null)).toBe("9 moves");
  });
});
