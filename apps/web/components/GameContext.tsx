"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BoardState,
  Coordinate,
  Difficulty,
  PieceId,
  PieceTransform,
  Vec2,
} from "@blocker-rush/shared";
import {
  PIECES,
  PIECE_TRANSFORMS,
  canPlace,
  cellsToKey,
  createBoard,
  placePiece,
  removePiece,
  withBlockers,
  isSolved,
} from "@blocker-rush/shared";
import type { DragGhost, PieceState } from "./gameTypes";

type InteractionState = {
  mode: "pending" | "dragging";
  pieceId: PieceId;
  pointerId: number;
  startX: number;
  startY: number;
  offset: { x: number; y: number };
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
};

type DragPreview = {
  pieceId: PieceId;
  pointer: { x: number; y: number };
  cell: number;
  gap: number;
  offset: { x: number; y: number };
  scale: number;
  snap: { x: number; y: number } | null;
};

const initPieceStates = (): Record<PieceId, PieceState> =>
  PIECES.reduce(
    (acc, piece) => {
      acc[piece.id] = { rotation: 0, flipped: false };
      return acc;
    },
    {} as Record<PieceId, PieceState>,
  );

const rotateCells = (cells: Vec2[]): Vec2[] =>
  cells.map((cell) => ({ x: cell.y, y: -cell.x }));

const reflectCells = (cells: Vec2[]): Vec2[] =>
  cells.map((cell) => ({ x: -cell.x, y: cell.y }));

const getTransformFor = (
  pieceId: PieceId,
  rotation: number,
  flipped: boolean,
): PieceTransform => {
  const base = PIECES.find((piece) => piece.id === pieceId)?.cells ?? [];
  let cells = base.map((cell) => ({ ...cell }));
  if (flipped) {
    cells = reflectCells(cells);
  }
  for (let i = 0; i < rotation; i += 1) {
    cells = rotateCells(cells);
  }
  const key = cellsToKey(cells);
  const transforms = PIECE_TRANSFORMS[pieceId];
  if (!transforms || transforms.length === 0 || !transforms[0]) {
    throw new Error(`Missing transforms for piece ${pieceId}`);
  }
  return transforms.find((item) => item.id === key) ?? transforms[0];
};

export const findOrientationForTransform = (
  pieceId: PieceId,
  transformId: string,
) => {
  for (let rotation = 0; rotation < 4; rotation += 1) {
    for (const flipped of [false, true]) {
      const base = PIECES.find((piece) => piece.id === pieceId)?.cells ?? [];
      let cells = base.map((cell) => ({ ...cell }));
      if (flipped) {
        cells = reflectCells(cells);
      }
      for (let i = 0; i < rotation; i += 1) {
        cells = rotateCells(cells);
      }
      const key = cellsToKey(cells);
      if (key === transformId) {
        return { rotation, flipped };
      }
    }
  }
  return { rotation: 0, flipped: false };
};

type PuzzleSpec = {
  id: string;
  blockers: Coordinate[];
  difficulty: Difficulty | null;
};

type GameContextValue = {
  puzzleId: string;
  puzzleDifficulty: Difficulty | null;
  solved: boolean;
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
  boardRef: RefObject<HTMLDivElement | null>;
};

const GameContext = createContext<GameContextValue | null>(null);

type GameProviderProps = {
  children: ReactNode;
};

export function GameProvider({ children }: GameProviderProps) {
  const [board, setBoard] = useState<BoardState>(() => createBoard());
  const [pieceStates, setPieceStates] =
    useState<Record<PieceId, PieceState>>(initPieceStates());
  const [puzzleId, setPuzzleId] = useState<string>("");
  const [blockers, setBlockers] = useState<Coordinate[]>([]);
  const [puzzleDifficulty, setPuzzleDifficulty] = useState<Difficulty | null>(
    null,
  );
  const [history, setHistory] = useState<BoardState[]>([]);
  const [activePieceId, setActivePieceId] = useState<PieceId | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [draggingPieceId, setDraggingPieceId] = useState<PieceId | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardStateRef = useRef(board);
  const pieceStatesRef = useRef(pieceStates);
  const interactionRef = useRef<InteractionState | null>(null);
  const ghostRef = useRef<DragGhost | null>(null);

  const solved = useMemo(() => isSolved(board), [board]);

  useEffect(() => {
    boardStateRef.current = board;
  }, [board]);

  useEffect(() => {
    pieceStatesRef.current = pieceStates;
  }, [pieceStates]);

  const updateGhostState = (next: DragGhost | null) => {
    ghostRef.current = next;
    setGhost(next);
  };

  const applyPuzzle = (puzzle: PuzzleSpec) => {
    setPuzzleId(puzzle.id);
    setBlockers(puzzle.blockers);
    setPuzzleDifficulty(puzzle.difficulty);
    const nextBoard = withBlockers(puzzle.blockers);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
    setPieceStates(initPieceStates());
    setHistory([]);
    updateGhostState(null);
    setDraggingPieceId(null);
    setDragPreview(null);
    setActivePieceId(null);
    setStartedAt(Date.now());
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!activePieceId) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        rotatePiece(activePieceId);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        flipPiece(activePieceId);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePieceId]);

  const rotatePiece = (pieceId: PieceId) => {
    setPieceStates((prev) => ({
      ...prev,
      [pieceId]: {
        ...prev[pieceId],
        rotation: (prev[pieceId].rotation + 1) % 4,
      },
    }));
  };

  const flipPiece = (pieceId: PieceId) => {
    setPieceStates((prev) => ({
      ...prev,
      [pieceId]: {
        ...prev[pieceId],
        flipped: !prev[pieceId].flipped,
      },
    }));
  };

  const setPieceState = (pieceId: PieceId, next: PieceState) => {
    setPieceStates((prev) => ({
      ...prev,
      [pieceId]: next,
    }));
  };

  const getMetrics = () => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const styles = window.getComputedStyle(boardRef.current);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    const cols = boardStateRef.current.size.cols;
    const cell = (rect.width - gap * (cols - 1)) / cols;
    return { rect, gap, cell, step: cell + gap };
  };

  const buildDragPreview = (
    pieceId: PieceId,
    pointer: { x: number; y: number },
    metrics: { cell: number; gap: number },
  ): DragPreview => {
    const state = pieceStatesRef.current[pieceId];
    const transform = getTransformFor(pieceId, state.rotation, state.flipped);
    const cell = metrics.cell;
    const gap = metrics.gap;
    const width = transform.width * cell + (transform.width - 1) * gap;
    const height = transform.height * cell + (transform.height - 1) * gap;
    const offset = { x: width / 2, y: height / 2 };
    return {
      pieceId,
      pointer,
      cell,
      gap,
      offset,
      scale: 1.06,
      snap: null,
    };
  };

  const updateDragPreviewPointer = (
    pointer: { x: number; y: number },
    interaction: InteractionState,
  ) => {
    setDragPreview((prev) => {
      if (!prev || prev.pieceId !== interaction.pieceId) {
        return buildDragPreview(
          interaction.pieceId,
          pointer,
          interaction.metrics,
        );
      }
      return { ...prev, pointer, snap: null };
    });
  };

  const updateDragPreviewSnap = (
    origin: Vec2 | null,
    interaction: InteractionState,
  ) => {
    if (!origin) {
      setDragPreview((prev) => (prev ? { ...prev, snap: null } : prev));
      return;
    }
    setDragPreview((prev) => {
      const preview =
        prev ??
        buildDragPreview(
          interaction.pieceId,
          interaction.lastPointer ?? {
            x: interaction.startX,
            y: interaction.startY,
          },
          interaction.metrics,
        );
      const state = pieceStatesRef.current[interaction.pieceId];
      const transform = getTransformFor(
        interaction.pieceId,
        state.rotation,
        state.flipped,
      );
      const width =
        transform.width * preview.cell + (transform.width - 1) * preview.gap;
      const height =
        transform.height * preview.cell + (transform.height - 1) * preview.gap;
      return {
        ...preview,
        snap: {
          x:
            interaction.metrics.rect.left +
            origin.x * interaction.metrics.step +
            width / 2,
          y:
            interaction.metrics.rect.top +
            origin.y * interaction.metrics.step +
            height / 2,
        },
      };
    });
  };

  const isPointerOutsideBoard = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ) =>
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom;

  const commitRemoval = (pieceId: PieceId, previousBoard: BoardState) => {
    const nextBoard = removePiece(previousBoard, pieceId);
    setHistory((prev) => [...prev, previousBoard]);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    pieceId: PieceId,
    origin?: Vec2,
  ) => {
    event.preventDefault();
    const wasActive = activePieceId === pieceId;
    const metrics = getMetrics();
    if (!metrics) return;
    const pointerId = event.pointerId;
    const targetRect = (
      event.currentTarget as HTMLElement
    ).getBoundingClientRect();
    const offset = origin
      ? {
          x: event.clientX - (metrics.rect.left + origin.x * metrics.step),
          y: event.clientY - (metrics.rect.top + origin.y * metrics.step),
        }
      : {
          x: event.clientX - targetRect.left,
          y: event.clientY - targetRect.top,
        };

    const previousBoard = boardStateRef.current;
    const previousPlacement = previousBoard.placements[pieceId] ?? undefined;

    const beginDrag = () => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.mode === "dragging") return;
      window.clearTimeout(interaction.timeoutId);
      interaction.mode = "dragging";
      interactionRef.current = interaction;
      setDraggingPieceId(pieceId);
      const previewPointer = interaction.lastPointer ?? {
        x: interaction.startX,
        y: interaction.startY,
      };
      setDragPreview(
        buildDragPreview(pieceId, previewPointer, interaction.metrics),
      );
      updateGhostState(null);
      if (interaction.previousPlacement) {
        const nextBoard = removePiece(interaction.previousBoard, pieceId);
        boardStateRef.current = nextBoard;
        setBoard(nextBoard);
      }
    };

    const timeoutId = window.setTimeout(() => {
      beginDrag();
    }, 180);

    interactionRef.current = {
      mode: "pending",
      pieceId,
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
      previousBoard,
      previousPlacement,
      metrics,
      timeoutId,
    };

    setActivePieceId(pieceId);

    const handleMove = (moveEvent: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || moveEvent.pointerId !== interaction.pointerId) return;
      interaction.lastPointer = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };

      if (interaction.mode === "pending") {
        const dx = moveEvent.clientX - interaction.startX;
        const dy = moveEvent.clientY - interaction.startY;
        if (Math.hypot(dx, dy) > 6) {
          beginDrag();
        }
        return;
      }

      updateDragPreviewPointer(
        { x: moveEvent.clientX, y: moveEvent.clientY },
        interaction,
      );
      updateGhost(moveEvent.clientX, moveEvent.clientY, interaction);
    };

    const handleUp = (upEvent: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || upEvent.pointerId !== interaction.pointerId) return;
      window.clearTimeout(interaction.timeoutId);

      if (interaction.mode === "pending") {
        if (!interaction.previousPlacement && wasActive) {
          rotatePiece(pieceId);
        }
      } else {
        finalizeDrop(interaction, {
          x: upEvent.clientX,
          y: upEvent.clientY,
        });
      }

      interactionRef.current = null;
      setDraggingPieceId(null);
      setDragPreview(null);
      updateGhostState(null);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const updateGhost = (
    clientX: number,
    clientY: number,
    interaction: InteractionState,
  ) => {
    const { rect, step } = interaction.metrics;
    const topLeftX = clientX - rect.left - interaction.offset.x;
    const topLeftY = clientY - rect.top - interaction.offset.y;

    const buffer = step;
    if (
      topLeftX < -buffer ||
      topLeftY < -buffer ||
      topLeftX > rect.width + buffer ||
      topLeftY > rect.height + buffer
    ) {
      updateGhostState(null);
      updateDragPreviewSnap(null, interaction);
      return;
    }

    const origin = {
      x: Math.round(topLeftX / step),
      y: Math.round(topLeftY / step),
    };
    const size = boardStateRef.current.size;
    if (
      origin.x < 0 ||
      origin.y < 0 ||
      origin.x >= size.cols ||
      origin.y >= size.rows
    ) {
      updateGhostState(null);
      updateDragPreviewSnap(null, interaction);
      return;
    }

    const state = pieceStatesRef.current[interaction.pieceId];
    const transform = getTransformFor(
      interaction.pieceId,
      state.rotation,
      state.flipped,
    );
    const valid = canPlace(boardStateRef.current, transform, origin);
    if (!valid) {
      updateGhostState(null);
      updateDragPreviewSnap(null, interaction);
      return;
    }

    updateGhostState({ origin, valid: true });
    updateDragPreviewSnap(origin, interaction);
  };

  const finalizeDrop = (
    interaction: InteractionState,
    dropPoint: { x: number; y: number },
  ) => {
    const { pieceId, previousBoard } = interaction;
    const currentBoard = boardStateRef.current;
    const latestGhost = ghostRef.current;
    if (latestGhost && latestGhost.valid) {
      const state = pieceStatesRef.current[pieceId];
      const transform = getTransformFor(pieceId, state.rotation, state.flipped);
      const nextBoard = placePiece(
        currentBoard,
        pieceId,
        transform,
        latestGhost.origin,
      );
      setHistory((prev) => [...prev, previousBoard]);
      boardStateRef.current = nextBoard;
      setBoard(nextBoard);
      return;
    }
    if (
      interaction.previousPlacement &&
      (!interaction.lastPointer ||
        isPointerOutsideBoard(
          dropPoint.x,
          dropPoint.y,
          interaction.metrics.rect,
        ))
    ) {
      commitRemoval(pieceId, previousBoard);
      return;
    }
    boardStateRef.current = previousBoard;
    setBoard(previousBoard);
    const previousPlacement = previousBoard.placements[pieceId];
    if (previousPlacement) {
      setPieceStates((current) => ({
        ...current,
        [pieceId]: findOrientationForTransform(
          pieceId,
          previousPlacement.transformId,
        ),
      }));
    }
  };

  const getCellIndexFromTarget = (target: EventTarget | null) => {
    if (!target) return null;
    const index = (target as HTMLElement).dataset.index;
    if (index === undefined) return null;
    const cellIndex = Number.parseInt(index, 10);
    if (Number.isNaN(cellIndex)) return null;
    return cellIndex;
  };

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const cellIndex = getCellIndexFromTarget(event.target);
    if (cellIndex === null) return;
    const currentBoard = boardStateRef.current;
    const cell = currentBoard.cells[cellIndex];
    if (!cell || cell === "blocker") return;
    const placement = currentBoard.placements[cell as PieceId];
    if (!placement) return;
    startInteraction(event, cell as PieceId, placement.origin);
  };

  const handleBoardClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const cellIndex = getCellIndexFromTarget(event.target);
    if (cellIndex === null) return;
    const currentBoard = boardStateRef.current;
    const cell = currentBoard.cells[cellIndex];
    if (cell) return;
    if (!activePieceId) return;
    if (currentBoard.placements[activePieceId]) return;
    const size = currentBoard.size;
    const origin = {
      x: cellIndex % size.cols,
      y: Math.floor(cellIndex / size.cols),
    };
    const state = pieceStatesRef.current[activePieceId];
    const transform = getTransformFor(
      activePieceId,
      state.rotation,
      state.flipped,
    );
    if (!canPlace(currentBoard, transform, origin)) return;
    const nextBoard = placePiece(
      currentBoard,
      activePieceId,
      transform,
      origin,
    );
    setHistory((prev) => [...prev, currentBoard]);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
  };

  const handleBoardDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const cellIndex = getCellIndexFromTarget(event.target);
    if (cellIndex === null) return;
    const currentBoard = boardStateRef.current;
    const cell = currentBoard.cells[cellIndex];
    if (!cell || cell === "blocker") return;
    commitRemoval(cell as PieceId, currentBoard);
    setActivePieceId(cell as PieceId);
  };

  const handlePiecePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    pieceId: PieceId,
  ) => {
    const placement = board.placements[pieceId];
    startInteraction(event, pieceId, placement?.origin);
  };

  const moveCount = useMemo(() => history.length, [history.length]);

  const value: GameContextValue = {
    puzzleId,
    puzzleDifficulty,
    solved,
    moveCount,
    startedAt,
    board,
    blockers,
    pieceStates,
    activePieceId,
    ghost,
    draggingPieceId,
    dragPreview,
    applyPuzzle,
    setActivePieceId,
    setPieceState,
    getTransformFor,
    onBoardPointerDown: handleBoardPointerDown,
    onBoardClick: handleBoardClick,
    onBoardDoubleClick: handleBoardDoubleClick,
    onPiecePointerDown: handlePiecePointerDown,
    rotatePiece,
    flipPiece,
    boardRef,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within GameProvider");
  }
  return context;
}
