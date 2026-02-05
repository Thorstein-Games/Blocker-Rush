export type Column = string;
export type Row = number;

export type Coordinate = {
  col: Column;
  row: Row;
};

export type BoardSize = {
  cols: number;
  rows: number;
};

export type PuzzleId = string;

export type Difficulty = "easy" | "medium" | "hard" | "insane";

export type PieceId =
  | "p1"
  | "p2"
  | "p3"
  | "p4"
  | "p5"
  | "p6"
  | "p7"
  | "p8"
  | "p9";

export type Vec2 = { x: number; y: number };

export type Piece = {
  id: PieceId;
  name: string;
  size: number;
  cells: Vec2[];
};

export type PieceTransform = {
  id: string;
  cells: Vec2[];
  width: number;
  height: number;
  /** Anchor cell in piece-local coordinates (top-left-most occupied cell) */
  anchorCell: Vec2;
};

export type Placement = {
  pieceId: PieceId;
  transformId: string;
  origin: Vec2;
};

export type BoardCell = "blocker" | PieceId | null;

export type BoardState = {
  size: BoardSize;
  cells: BoardCell[];
  placements: Record<PieceId, Placement | undefined>;
};

export type PuzzleRecord = {
  id: PuzzleId;
  blockers: Coordinate[];
  difficulty: Difficulty;
  solutionCount: number;
  rulesVersion: string;
};

export type SolveResult = {
  solutionCount: number;
  nodesVisited: number;
  maxDepth: number;
  firstSolution?: Record<PieceId, Placement>;
};

export type SolveOptions = {
  maxSolutions?: number;
};

export type DailyPuzzle = {
  id: PuzzleId;
  blockers: Coordinate[];
  difficulty: Difficulty;
  dateKey: string;
};
