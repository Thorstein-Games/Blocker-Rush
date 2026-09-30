import { describe, expect, it } from "vitest";
import {
  canonicalizePuzzleId,
  columnIndexToLabel,
  columnLabelToIndex,
  coordToVec,
  fromIndex,
  parseCoordinate,
  parsePuzzleId,
  toIndex,
  vecToCoord,
  DEFAULT_BOARD,
} from "../src";

describe("column labels", () => {
  it("round-trips index <-> label", () => {
    for (let i = 0; i < 60; i += 1) {
      expect(columnLabelToIndex(columnIndexToLabel(i))).toBe(i);
    }
    expect(columnIndexToLabel(0)).toBe("A");
    expect(columnIndexToLabel(25)).toBe("Z");
    expect(columnIndexToLabel(26)).toBe("AA");
  });

  it("rejects invalid input", () => {
    expect(columnLabelToIndex("1")).toBeNull();
    expect(columnLabelToIndex("")).toBeNull();
    expect(() => columnIndexToLabel(-1)).toThrow();
    expect(() => columnIndexToLabel(1.5)).toThrow();
  });
});

describe("parseCoordinate", () => {
  it("parses and normalizes case/whitespace", () => {
    expect(parseCoordinate(" b3 ")).toEqual({ col: "B", row: 3 });
  });

  it("rejects out-of-bounds coordinates on the default 6x6 board", () => {
    expect(() => parseCoordinate("G1")).toThrow();
    expect(() => parseCoordinate("A7")).toThrow();
    expect(() => parseCoordinate("A0")).toThrow();
    expect(() => parseCoordinate("hello")).toThrow();
  });
});

describe("puzzle ids", () => {
  it("parses into sorted coordinates and canonicalizes back", () => {
    const blockers = parsePuzzleId("f6a2d1a4d2f4f5");
    expect(canonicalizePuzzleId(blockers)).toBe("A2A4D1D2F4F5F6");
  });

  it("requires exactly 7 coordinates", () => {
    expect(() => parsePuzzleId("A1B2")).toThrow(/exactly 7/);
    expect(() => parsePuzzleId("A1B2C3D4E5F6A6B1")).toThrow(/exactly 7/);
  });

  it("rejects junk between coordinates", () => {
    expect(() => parsePuzzleId("A1-B2C3D4E5F6A6")).toThrow(/invalid format/);
    expect(() => parsePuzzleId("")).toThrow();
  });
});

describe("index/vector conversions", () => {
  it("round-trips index <-> vec <-> coordinate", () => {
    for (let i = 0; i < DEFAULT_BOARD.cols * DEFAULT_BOARD.rows; i += 1) {
      const vec = fromIndex(DEFAULT_BOARD, i);
      expect(toIndex(DEFAULT_BOARD, vec)).toBe(i);
      expect(coordToVec(vecToCoord(vec))).toEqual(vec);
    }
  });

  it("maps A1 to the top-left origin", () => {
    expect(coordToVec({ col: "A", row: 1 })).toEqual({ x: 0, y: 0 });
    expect(coordToVec({ col: "F", row: 6 })).toEqual({ x: 5, y: 5 });
  });
});
