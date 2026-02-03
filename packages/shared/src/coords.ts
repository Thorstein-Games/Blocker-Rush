import type { BoardSize, Column, Coordinate, Row, Vec2 } from "./types.js";

const COLUMN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const DEFAULT_BOARD: BoardSize = { cols: 6, rows: 6 };

export const columnLabelToIndex = (label: string): number | null => {
  const normalized = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return null;
  let index = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized.charCodeAt(i) - 64;
    if (char < 1 || char > 26) return null;
    index = index * 26 + char;
  }
  return index - 1;
};

export const columnIndexToLabel = (index: number): Column => {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid column index: ${index}`);
  }
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = COLUMN_ALPHABET[remainder] + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

export const isColumn = (
  value: string,
  size: BoardSize = DEFAULT_BOARD
): value is Column => {
  const index = columnLabelToIndex(value);
  return index !== null && index >= 0 && index < size.cols;
};

export const isRow = (value: number, size: BoardSize = DEFAULT_BOARD): value is Row =>
  Number.isInteger(value) && value >= 1 && value <= size.rows;

export const formatCoordinate = (coord: Coordinate): string =>
  `${coord.col}${coord.row}`;

export const parseCoordinate = (
  value: string,
  size: BoardSize = DEFAULT_BOARD
): Coordinate => {
  const match = value.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid coordinate: ${value}`);
  }
  const col = match[1] ?? "";
  const row = Number.parseInt(match[2] ?? "", 10);
  if (!isColumn(col, size) || !isRow(row, size)) {
    throw new Error(`Invalid coordinate: ${value}`);
  }
  return { col, row };
};

export const sortCoordinates = (coords: Coordinate[]): Coordinate[] =>
  [...coords].sort((a, b) => {
    const aIndex = columnLabelToIndex(a.col);
    const bIndex = columnLabelToIndex(b.col);
    if (aIndex !== null && bIndex !== null && aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    if (a.col !== b.col) return a.col < b.col ? -1 : 1;
    return a.row - b.row;
  });

export const toIndex = (size: BoardSize, vec: Vec2): number =>
  vec.y * size.cols + vec.x;

export const fromIndex = (size: BoardSize, index: number): Vec2 => ({
  x: index % size.cols,
  y: Math.floor(index / size.cols),
});

export const coordToVec = (coord: Coordinate): Vec2 => {
  const colIndex = columnLabelToIndex(coord.col);
  if (colIndex === null) {
    throw new Error(`Invalid column label: ${coord.col}`);
  }
  return { x: colIndex, y: coord.row - 1 };
};

export const vecToCoord = (vec: Vec2): Coordinate => ({
  col: columnIndexToLabel(vec.x),
  row: vec.y + 1,
});

export const withinBounds = (size: BoardSize, vec: Vec2): boolean =>
  vec.x >= 0 && vec.y >= 0 && vec.x < size.cols && vec.y < size.rows;

export const normalizeCells = (cells: Vec2[]): Vec2[] => {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
};

export const cellsToKey = (cells: Vec2[]): string =>
  normalizeCells(cells)
    .slice()
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map((cell) => `${cell.x},${cell.y}`)
    .join("|");

export const getBounds = (cells: Vec2[]): { width: number; height: number } => {
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  return {
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  };
};

export const getDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getWeekday = (date: Date): number => date.getDay();
