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
import { useRouter, useSearchParams } from "next/navigation";
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
  canonicalizePuzzleId,
  cellsToKey,
  createBoard,
  formatCoordinate,
  getPuzzleById,
  pickPuzzleByDifficulty,
  placePiece,
  parsePuzzleId,
  removePiece,
  solvePuzzle,
  vecToCoord,
  withBlockers,
  isSolved,
  buildShareText,
} from "@blocker-rush/shared";
import type { DragGhost, PieceState } from "./gameTypes";

const SETTINGS_KEY = "blockerRush.casual.settings";
const STATS_KEY = "blockerRush.casual.stats";

export const difficultyOptions: Difficulty[] = [
  "easy",
  "medium",
  "hard",
  "insane",
];

type CasualSettings = {
  difficulty: Difficulty;
};

type CasualStats = {
  bestTimesMs: Record<string, number>;
  lastTimesMs: Record<string, number>;
  bestMoves: Record<string, number>;
  lastMoves: Record<string, number>;
};

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

const findOrientationForTransform = (pieceId: PieceId, transformId: string) => {
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

const readSettings = (): CasualSettings => {
  if (typeof window === "undefined") {
    return { difficulty: "easy" };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { difficulty: "easy" };
    const parsed = JSON.parse(raw) as CasualSettings;
    if (!difficultyOptions.includes(parsed.difficulty)) {
      return { difficulty: "easy" };
    }
    return parsed;
  } catch {
    return { difficulty: "easy" };
  }
};

const writeSettings = (settings: CasualSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const readStats = (): CasualStats => {
  if (typeof window === "undefined") {
    return {
      bestTimesMs: {},
      lastTimesMs: {},
      bestMoves: {},
      lastMoves: {},
    };
  }
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) {
      return {
        bestTimesMs: {},
        lastTimesMs: {},
        bestMoves: {},
        lastMoves: {},
      };
    }
    const parsed = JSON.parse(raw) as CasualStats;
    return {
      bestTimesMs: parsed.bestTimesMs ?? {},
      lastTimesMs: parsed.lastTimesMs ?? {},
      bestMoves: parsed.bestMoves ?? {},
      lastMoves: parsed.lastMoves ?? {},
    };
  } catch {
    return {
      bestTimesMs: {},
      lastTimesMs: {},
      bestMoves: {},
      lastMoves: {},
    };
  }
};

const writeStats = (stats: CasualStats) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

type CurrentStats = {
  moves: number;
  bestMoves?: number;
  lastMoves?: number;
};

type GameContextValue = {
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
  puzzleInput: string;
  setPuzzleInput: (value: string) => void;
  puzzleDifficulty: Difficulty | null;
  currentStats: CurrentStats | null;
  hint: string | null;
  shareStatus: string | null;
  solved: boolean;
  loadPuzzleFromInput: () => void;
  loadRandomPuzzle: () => void;
  handleHint: () => void;
  handleShare: () => Promise<void>;
  board: BoardState;
  pieceStates: Record<PieceId, PieceState>;
  activePieceId: PieceId | null;
  ghost: DragGhost | null;
  draggingPieceId: PieceId | null;
  getTransformFor: (
    pieceId: PieceId,
    rotation: number,
    flipped: boolean,
  ) => PieceTransform;
  onBoardPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onBoardDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onPiecePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    pieceId: PieceId,
  ) => void;
  rotatePiece: (pieceId: PieceId) => void;
  flipPiece: (pieceId: PieceId) => void;
  boardRef: RefObject<HTMLDivElement | null>;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzleParam = searchParams.get("p");

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<BoardState>(() => createBoard());
  const [pieceStates, setPieceStates] =
    useState<Record<PieceId, PieceState>>(initPieceStates());
  const [puzzleId, setPuzzleId] = useState<string>("");
  const [blockers, setBlockers] = useState<Coordinate[]>([]);
  const [puzzleDifficulty, setPuzzleDifficulty] = useState<Difficulty | null>(
    null,
  );
  const [hint, setHint] = useState<string | null>(null);
  const [solutionCache, setSolutionCache] = useState<Record<
    PieceId,
    { origin: Vec2; transformId: string } | undefined
  > | null>(null);
  const [history, setHistory] = useState<BoardState[]>([]);
  const [stats, setStats] = useState<CasualStats>(() => readStats());
  const [activePieceId, setActivePieceId] = useState<PieceId | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [draggingPieceId, setDraggingPieceId] = useState<PieceId | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [puzzleInput, setPuzzleInput] = useState<string>("");
  const [hasRecordedSolve, setHasRecordedSolve] = useState(false);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardStateRef = useRef(board);
  const pieceStatesRef = useRef(pieceStates);
  const interactionRef = useRef<InteractionState | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
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

  const applyPuzzle = (
    id: string,
    blockersForPuzzle: Coordinate[],
    difficultyForPuzzle: Difficulty | null,
  ) => {
    setPuzzleId(id);
    setBlockers(blockersForPuzzle);
    setPuzzleDifficulty(difficultyForPuzzle);
    const nextBoard = withBlockers(blockersForPuzzle);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
    setPieceStates(initPieceStates());
    setHistory([]);
    setHint(null);
    setSolutionCache(null);
    updateGhostState(null);
    setDraggingPieceId(null);
    setActivePieceId(null);
    setPuzzleInput(id);
    setStartTime(Date.now());
    setHasRecordedSolve(false);
    setShareStatus(null);
    router.replace(`/casual?p=${id}`, { scroll: false });
  };

  const loadPuzzleFromId = (raw: string, fallbackDifficulty: Difficulty) => {
    try {
      const parsed = parsePuzzleId(raw);
      const canonical = canonicalizePuzzleId(parsed);
      const record = getPuzzleById(canonical);
      const resolvedBlockers = record?.blockers ?? parsed;
      applyPuzzle(canonical, resolvedBlockers, record?.difficulty ?? null);
    } catch {
      loadRandomPuzzle(fallbackDifficulty);
    }
  };

  const loadRandomPuzzle = (tier: Difficulty) => {
    const record = pickPuzzleByDifficulty(tier);
    applyPuzzle(record.id, record.blockers, record.difficulty);
  };

  useEffect(() => {
    const settings = readSettings();
    setDifficulty(settings.difficulty);
    if (puzzleParam) {
      loadPuzzleFromId(puzzleParam, settings.difficulty);
      return;
    }
    loadRandomPuzzle(settings.difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        window.clearTimeout(hintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (puzzleParam && puzzleParam !== puzzleId) {
      loadPuzzleFromId(puzzleParam, difficulty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleParam]);

  useEffect(() => {
    writeSettings({ difficulty });
  }, [difficulty]);

  useEffect(() => {
    if (!solved || !puzzleId || !startTime) return;
    if (hasRecordedSolve) return;
    const elapsed = Date.now() - startTime;
    const moveCount = history.length;
    setStats((prev) => {
      const next = {
        ...prev,
        lastTimesMs: { ...prev.lastTimesMs },
        bestTimesMs: { ...prev.bestTimesMs },
        lastMoves: { ...prev.lastMoves },
        bestMoves: { ...prev.bestMoves },
      };
      next.lastTimesMs[puzzleId] = elapsed;
      const best = next.bestTimesMs[puzzleId];
      next.bestTimesMs[puzzleId] = best ? Math.min(best, elapsed) : elapsed;
      next.lastMoves[puzzleId] = moveCount;
      const bestMoves = next.bestMoves[puzzleId];
      next.bestMoves[puzzleId] =
        bestMoves !== undefined ? Math.min(bestMoves, moveCount) : moveCount;
      writeStats(next);
      return next;
    });
    setHasRecordedSolve(true);
  }, [solved, puzzleId, startTime, hasRecordedSolve, history.length]);

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

  const getMetrics = () => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const styles = window.getComputedStyle(boardRef.current);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    const cols = boardStateRef.current.size.cols;
    const cell = (rect.width - gap * (cols - 1)) / cols;
    return { rect, gap, cell, step: cell + gap };
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
    event: ReactPointerEvent<HTMLDivElement>,
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
      return;
    }

    const state = pieceStatesRef.current[interaction.pieceId];
    const transform = getTransformFor(
      interaction.pieceId,
      state.rotation,
      state.flipped,
    );
    const valid = canPlace(boardStateRef.current, transform, origin);

    updateGhostState({ origin, valid });
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
    const nextBoard = placePiece(currentBoard, activePieceId, transform, origin);
    setHistory((prev) => [...prev, currentBoard]);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
  };

  const handleBoardDoubleClick = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    const cellIndex = getCellIndexFromTarget(event.target);
    if (cellIndex === null) return;
    const currentBoard = boardStateRef.current;
    const cell = currentBoard.cells[cellIndex];
    if (!cell || cell === "blocker") return;
    commitRemoval(cell as PieceId, currentBoard);
    setActivePieceId(cell as PieceId);
  };

  const handlePiecePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    pieceId: PieceId,
  ) => {
    const placement = board.placements[pieceId];
    startInteraction(event, pieceId, placement?.origin);
  };

  const handleHint = () => {
    if (!puzzleId) return;
    let solution = solutionCache;
    if (!solution) {
      const result = solvePuzzle(blockers, { maxSolutions: 1 });
      solution = result.firstSolution ?? null;
      setSolutionCache(solution);
    }
    if (!solution) {
      setHint("No hints available for this puzzle.");
      return;
    }
    const remaining = PIECES.filter((piece) => !board.placements[piece.id]);
    const target = remaining[0];
    if (!target) {
      setHint("All pieces are already placed.");
      return;
    }
    const placement = solution[target.id];
    if (!placement) {
      setHint("Hint unavailable for that piece.");
      return;
    }
    const coord = vecToCoord(placement.origin);
    const orientation = findOrientationForTransform(
      target.id,
      placement.transformId,
    );
    setPieceStates((prev) => ({
      ...prev,
      [target.id]: orientation,
    }));
    setActivePieceId(target.id);
    setHint(
      `Try placing ${target.name} so its top-left is at ${formatCoordinate(
        coord,
      )}.`,
    );
    if (hintTimeoutRef.current) {
      window.clearTimeout(hintTimeoutRef.current);
    }
    hintTimeoutRef.current = window.setTimeout(() => {
      setHint(null);
    }, 6000);
  };

  const handleShare = async () => {
    if (!puzzleId) return;
    const baseUrl = `${window.location.origin}/casual`;
    const text = buildShareText(puzzleId, board.placements, baseUrl);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setShareStatus("Copied share text.");
    } catch {
      setShareStatus("Unable to share right now.");
    }
  };

  const currentStats = useMemo<CurrentStats | null>(() => {
    if (!puzzleId) return null;
    return {
      moves: history.length,
      bestMoves: stats.bestMoves[puzzleId],
      lastMoves: stats.lastMoves[puzzleId],
    };
  }, [puzzleId, stats, history.length]);

  const loadPuzzleFromInput = () => {
    loadPuzzleFromId(puzzleInput, difficulty);
  };

  const value: GameContextValue = {
    difficulty,
    setDifficulty,
    puzzleInput,
    setPuzzleInput,
    puzzleDifficulty,
    currentStats,
    hint,
    shareStatus,
    solved,
    loadPuzzleFromInput,
    loadRandomPuzzle: () => loadRandomPuzzle(difficulty),
    handleHint,
    handleShare,
    board,
    pieceStates,
    activePieceId,
    ghost,
    draggingPieceId,
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
