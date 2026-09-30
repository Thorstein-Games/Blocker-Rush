import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type {
  BoardState,
  Coordinate,
  Difficulty,
  PieceId,
  PieceTransform,
  Placement,
  Vec2,
} from "@blocker-rush/shared";

export type PieceState = { rotation: number; flipped: boolean };

export type DragGhost = {
  origin: Vec2;
  valid: boolean;
};

export type PieceColors = Record<PieceId, string>;

// --- GameContext (see GameContext.tsx) ---

export type InteractionState = {
  mode: "pending" | "dragging";
  pieceId: PieceId;
  pointerId: number;
  pointerType: PointerEvent["pointerType"];
  touchScrollLocked: boolean;
  captureTarget?: HTMLElement | null;
  startX: number;
  startY: number;
  startCenter: { x: number; y: number };
  pieceCenterOffsetPx: { x: number; y: number };
  previousBoard: BoardState;
  previousPlacement?: { origin: Vec2; transformId: string };
  metrics: {
    rect: DOMRect;
    gap: number;
    step: number;
    cell: number;
  };
  timeoutId: number;
  lastPointer?: { x: number; y: number };
  latestPointer?: { x: number; y: number };
  smoothedCenter?: { x: number; y: number };
  targetCenter?: { x: number; y: number };
  latestSnapCenter?: { x: number; y: number };
  lastSnapOrigin?: Vec2 | null;
  rafId?: number;
};

export type DragPreview = {
  pieceId: PieceId;
  cell: number;
  gap: number;
  offset: { x: number; y: number };
  scale: number;
  position: { x: number; y: number };
  dropTarget: { x: number; y: number } | null;
  isDropping?: boolean;
};

export type PuzzleSpec = {
  id: string;
  blockers: Coordinate[];
  difficulty: Difficulty | null;
};

export type GameContextValue = {
  puzzleId: string;
  puzzleDifficulty: Difficulty | null;
  solved: boolean;
  readOnly: boolean;
  moveCount: number;
  startedAt: number | null;
  board: BoardState;
  blockers: Coordinate[];
  pieceStates: Record<PieceId, PieceState>;
  activePieceId: PieceId | null;
  ghost: DragGhost | null;
  draggingPieceId: PieceId | null;
  dragPreview: DragPreview | null;
  applyPuzzle: (puzzle: PuzzleSpec) => void;
  setActivePieceId: (pieceId: PieceId | null) => void;
  setPieceState: (pieceId: PieceId, next: PieceState) => void;
  getTransformFor: (
    pieceId: PieceId,
    rotation: number,
    flipped: boolean,
  ) => PieceTransform;
  onBoardPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onBoardDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onPiecePointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    pieceId: PieceId,
  ) => void;
  rotatePiece: (pieceId: PieceId) => void;
  flipPiece: (pieceId: PieceId) => void;
  clearBoard: () => void;
  undo: () => void;
  canUndo: boolean;
  feedback: { text: string; error: boolean; sequence: number } | null;
  selectPiece: (pieceId: PieceId) => void;
  activateCell: (cellIndex: number, remove?: boolean) => void;
  restoreState: (snapshot: {
    placements: Placement[];
    pieceStates: Record<PieceId, PieceState>;
    blockers?: Coordinate[];
    startedAt?: number | null;
  }) => void;
  boardRef: RefObject<HTMLDivElement | null>;
};
