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
  Placement,
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
  computeAnchorOffset,
} from "@blocker-rush/shared";
import type { DragGhost, PieceState } from "./gameTypes";

type InteractionState = {
  mode: "pending" | "dragging";
  pieceId: PieceId;
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  /** Offset from pointer to anchor cell center (in world coordinates) */
  pointerToAnchorOffset: { x: number; y: number };
  previousBoard: BoardState;
  previousPlacement?: { origin: Vec2; transformId: string };
  /** Cached metrics to avoid layout thrashing during drag */
  metrics: {
    rect: DOMRect;
    gap: number;
    step: number;
    cell: number;
  };
  timeoutId: number;
  /** Latest pointer position (updated in move handler, consumed in RAF) */
  currentPointerX: number;
  currentPointerY: number;
  /** For hysteresis: last snapped grid cell */
  lastSnappedCell: Vec2 | null;
  /** RAF ID for drag updates */
  rafId: number | null;
  /** Target element for pointer capture */
  targetElement: HTMLElement | null;
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
  restoreState: (snapshot: {
    placements: Placement[];
    pieceStates: Record<PieceId, PieceState>;
    blockers?: Coordinate[];
    startedAt?: number | null;
  }) => void;
  boardRef: RefObject<HTMLDivElement | null>;
};

const GameContext = createContext<GameContextValue | null>(null);

type GameProviderProps = {
  children: ReactNode;
  lockOnSolve?: boolean;
};

export function GameProvider({ children, lockOnSolve = false }: GameProviderProps) {
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
  const readOnly = lockOnSolve && solved;

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
      if (readOnly) return;
      if (!activePieceId) return;
      const key = event.key.toLowerCase();
      if (key === "w" || key === "s") {
        event.preventDefault();
        rotatePiece(activePieceId);
        return;
      }
      if (key === "a" || key === "d") {
        event.preventDefault();
        flipPiece(activePieceId);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePieceId, readOnly]);

  const rotatePiece = (pieceId: PieceId) => {
    if (readOnly) return;
    setPieceStates((prev) => ({
      ...prev,
      [pieceId]: {
        ...prev[pieceId],
        rotation: (prev[pieceId].rotation + 1) % 4,
      },
    }));
  };

  const flipPiece = (pieceId: PieceId) => {
    if (readOnly) return;
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
    anchorOffset: { x: number; y: number },
  ): DragPreview => {
    const state = pieceStatesRef.current[pieceId];
    const transform = getTransformFor(pieceId, state.rotation, state.flipped);
    const cell = metrics.cell;
    const gap = metrics.gap;
    
    // The offset is from the drag preview's top-left to the anchor point
    // This keeps the anchor under the pointer
    return {
      pieceId,
      pointer,
      cell,
      gap,
      offset: anchorOffset,
      scale: 1.06,
      snap: null,
    };
  };

  const updateDragPreviewPointer = (
    pointer: { x: number; y: number },
    interaction: InteractionState,
  ) => {
    const state = pieceStatesRef.current[interaction.pieceId];
    const transform = getTransformFor(
      interaction.pieceId,
      state.rotation,
      state.flipped,
    );
    const anchorOffset = computeAnchorOffset(
      transform.anchorCell,
      interaction.metrics.cell,
      interaction.metrics.gap,
    );
    
    setDragPreview((prev) => {
      if (!prev || prev.pieceId !== interaction.pieceId) {
        return buildDragPreview(
          interaction.pieceId,
          pointer,
          interaction.metrics,
          anchorOffset,
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
      const state = pieceStatesRef.current[interaction.pieceId];
      const transform = getTransformFor(
        interaction.pieceId,
        state.rotation,
        state.flipped,
      );
      const anchorOffset = computeAnchorOffset(
        transform.anchorCell,
        interaction.metrics.cell,
        interaction.metrics.gap,
      );
      
      const preview =
        prev ??
        buildDragPreview(
          interaction.pieceId,
          { x: interaction.currentPointerX, y: interaction.currentPointerY },
          interaction.metrics,
          anchorOffset,
        );
      
      // Snap position is where the anchor cell should be in world coordinates
      const anchorWorldX =
        interaction.metrics.rect.left +
        (origin.x + transform.anchorCell.x) * interaction.metrics.step +
        interaction.metrics.cell / 2;
      const anchorWorldY =
        interaction.metrics.rect.top +
        (origin.y + transform.anchorCell.y) * interaction.metrics.step +
        interaction.metrics.cell / 2;
      
      return {
        ...preview,
        snap: {
          x: anchorWorldX,
          y: anchorWorldY,
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
    if (readOnly) return;
    event.preventDefault();
    
    const wasActive = activePieceId === pieceId;
    const metrics = getMetrics();
    if (!metrics) return;
    
    const pointerId = event.pointerId;
    const targetElement = event.currentTarget as HTMLElement;
    
    // Get piece transform to compute anchor offset
    const state = pieceStatesRef.current[pieceId];
    const transform = getTransformFor(pieceId, state.rotation, state.flipped);
    
    // Compute anchor offset in pixels
    const anchorOffset = computeAnchorOffset(
      transform.anchorCell,
      metrics.cell,
      metrics.gap,
    );
    
    // Calculate pointer-to-anchor offset in world coordinates
    let pointerToAnchorOffset: { x: number; y: number };
    
    if (origin) {
      // Dragging from board: anchor is at a known grid position
      const anchorWorldX =
        metrics.rect.left +
        (origin.x + transform.anchorCell.x) * metrics.step +
        metrics.cell / 2;
      const anchorWorldY =
        metrics.rect.top +
        (origin.y + transform.anchorCell.y) * metrics.step +
        metrics.cell / 2;
      
      pointerToAnchorOffset = {
        x: event.clientX - anchorWorldX,
        y: event.clientY - anchorWorldY,
      };
      
      // console.log('Drag from board:', {
      //   origin,
      //   anchorCell: transform.anchorCell,
      //   anchorWorldX,
      //   anchorWorldY,
      //   pointerX: event.clientX,
      //   pointerY: event.clientY,
      //   pointerToAnchorOffset,
      // });
    } else {
      // Dragging from tray: compute offset from tray element
      const trayRect = targetElement.getBoundingClientRect();
      const pointerInTrayX = event.clientX - trayRect.left;
      const pointerInTrayY = event.clientY - trayRect.top;
      
      // Offset from pointer to anchor within the tray element
      // (assuming tray element positions piece at its top-left)
      pointerToAnchorOffset = {
        x: pointerInTrayX - anchorOffset.x,
        y: pointerInTrayY - anchorOffset.y,
      };
      
      // console.log('Drag from tray:', {
      //   trayRect,
      //   pointerInTrayX,
      //   pointerInTrayY,
      //   anchorOffset,
      //   pointerToAnchorOffset,
      // });
    }
    
    const previousBoard = boardStateRef.current;
    const previousPlacement = previousBoard.placements[pieceId] ?? undefined;
    
    const beginDrag = () => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.mode === "dragging") return;
      
      window.clearTimeout(interaction.timeoutId);
      interaction.mode = "dragging";
      
      setDraggingPieceId(pieceId);
      
      const previewPointer = {
        x: interaction.currentPointerX,
        y: interaction.currentPointerY,
      };
      
      const previewAnchorOffset = computeAnchorOffset(
        transform.anchorCell,
        interaction.metrics.cell,
        interaction.metrics.gap,
      );
      
      setDragPreview(
        buildDragPreview(
          pieceId,
          previewPointer,
          interaction.metrics,
          previewAnchorOffset,
        ),
      );
      updateGhostState(null);
      
      if (interaction.previousPlacement) {
        const nextBoard = removePiece(interaction.previousBoard, pieceId);
        boardStateRef.current = nextBoard;
        setBoard(nextBoard);
      }
      
      // Start RAF loop for smooth updates
      interaction.rafId = requestAnimationFrame(() => rafDragLoop(interaction));
    };
    
    const timeoutId = window.setTimeout(() => {
      beginDrag();
    }, 180);
    
    interactionRef.current = {
      mode: "pending",
      pieceId,
      pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      pointerToAnchorOffset,
      previousBoard,
      previousPlacement,
      metrics,
      timeoutId,
      currentPointerX: event.clientX,
      currentPointerY: event.clientY,
      lastSnappedCell: null,
      rafId: null,
      targetElement,
    };
    
    setActivePieceId(pieceId);
    
    // Set pointer capture immediately for reliable event delivery
    // This ensures we get move/up events even if pointer leaves element
    try {
      targetElement.setPointerCapture(pointerId);
    } catch (e) {
      console.warn("Failed to set pointer capture:", e);
    }
    
    // Pointer event handlers
    // Note: With pointer capture, events are delivered to the capturing element
    // but we attach to window for broader compatibility
    const handleMove = (moveEvent: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || moveEvent.pointerId !== interaction.pointerId) return;
      
      // Update pointer position (consumed by RAF loop)
      interaction.currentPointerX = moveEvent.clientX;
      interaction.currentPointerY = moveEvent.clientY;
      
      if (interaction.mode === "pending") {
        const dx = moveEvent.clientX - interaction.startPointerX;
        const dy = moveEvent.clientY - interaction.startPointerY;
        if (Math.hypot(dx, dy) > 6) {
          beginDrag();
        }
      }
      // If dragging, RAF loop handles the updates
    };
    
    const handleUp = (upEvent: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || upEvent.pointerId !== interaction.pointerId) return;
      
      window.clearTimeout(interaction.timeoutId);
      
      // Cancel RAF loop
      if (interaction.rafId !== null) {
        cancelAnimationFrame(interaction.rafId);
      }
      
      // Release pointer capture
      try {
        interaction.targetElement?.releasePointerCapture(interaction.pointerId);
      } catch (e) {
        // Ignore - may have been released already
      }
      
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
  
  // RAF loop for smooth 60fps drag updates
  // This decouples pointer events from DOM updates, reducing jank
  const rafDragLoop = (interaction: InteractionState) => {
    if (!interaction || interaction.mode !== "dragging") return;
    
    const current = interactionRef.current;
    if (!current || current !== interaction) return;
    
    // Update drag preview and ghost using current pointer position
    updateDragPreviewPointer(
      { x: interaction.currentPointerX, y: interaction.currentPointerY },
      interaction,
    );
    updateGhost(
      interaction.currentPointerX,
      interaction.currentPointerY,
      interaction,
    );
    
    // Schedule next frame
    interaction.rafId = requestAnimationFrame(() => rafDragLoop(interaction));
  };

  const updateGhost = (
    clientX: number,
    clientY: number,
    interaction: InteractionState,
  ) => {
    // --- DIAGNOSTICS: Current snap computation values ---
    // console.log('updateGhost called:', {
    //   pointerX: clientX,
    //   pointerY: clientY,
    //   boardRect: interaction.metrics.rect,
    //   step: interaction.metrics.step,
    //   pointerToAnchorOffset: interaction.pointerToAnchorOffset,
    // });
    
    const { rect, step, cell, gap } = interaction.metrics;
    const state = pieceStatesRef.current[interaction.pieceId];
    const transform = getTransformFor(
      interaction.pieceId,
      state.rotation,
      state.flipped,
    );
    
    // Convert pointer to anchor position in world coordinates
    const anchorWorldX = clientX - interaction.pointerToAnchorOffset.x;
    const anchorWorldY = clientY - interaction.pointerToAnchorOffset.y;
    
    // Convert anchor world position to board-relative position
    const anchorBoardX = anchorWorldX - rect.left;
    const anchorBoardY = anchorWorldY - rect.top;
    
    // console.log('Anchor position:', {
    //   anchorWorldX,
    //   anchorWorldY,
    //   anchorBoardX,
    //   anchorBoardY,
    //   anchorCell: transform.anchorCell,
    // });
    
    // Check if anchor is too far outside board (with buffer)
    const buffer = step * 1.5;
    if (
      anchorBoardX < -buffer ||
      anchorBoardY < -buffer ||
      anchorBoardX > rect.width + buffer ||
      anchorBoardY > rect.height + buffer
    ) {
      updateGhostState(null);
      updateDragPreviewSnap(null, interaction);
      return;
    }
    
    // Convert anchor board position to grid cell (where anchor cell should snap)
    const anchorGridX = anchorBoardX / step;
    const anchorGridY = anchorBoardY / step;
    
    // Calculate piece origin from anchor grid position
    // origin = anchorGridCell - anchorCell
    const rawOriginX = anchorGridX - transform.anchorCell.x;
    const rawOriginY = anchorGridY - transform.anchorCell.y;
    
    // Apply hysteresis: only snap to new cell if we cross threshold
    // This prevents jitter at cell boundaries
    const HYSTERESIS_THRESHOLD = 0.35; // Must move 35% into a cell to snap
    
    let snappedOriginX: number;
    let snappedOriginY: number;
    
    if (interaction.lastSnappedCell) {
      const lastX = interaction.lastSnappedCell.x;
      const lastY = interaction.lastSnappedCell.y;
      const deltaX = rawOriginX - lastX;
      const deltaY = rawOriginY - lastY;
      
      // Only change snap if we've moved far enough
      snappedOriginX =
        Math.abs(deltaX) > HYSTERESIS_THRESHOLD
          ? Math.round(rawOriginX)
          : lastX;
      snappedOriginY =
        Math.abs(deltaY) > HYSTERESIS_THRESHOLD
          ? Math.round(rawOriginY)
          : lastY;
    } else {
      // First snap, just round normally
      snappedOriginX = Math.round(rawOriginX);
      snappedOriginY = Math.round(rawOriginY);
    }
    
    const origin = {
      x: snappedOriginX,
      y: snappedOriginY,
    };
    
    // console.log('Grid computation:', {
    //   anchorGridX,
    //   anchorGridY,
    //   rawOriginX,
    //   rawOriginY,
    //   snappedOrigin: origin,
    //   lastSnappedCell: interaction.lastSnappedCell,
    // });
    
    // Validate origin is in bounds
    const size = boardStateRef.current.size;
    if (
      origin.x < 0 ||
      origin.y < 0 ||
      origin.x + transform.width > size.cols ||
      origin.y + transform.height > size.rows
    ) {
      updateGhostState(null);
      updateDragPreviewSnap(null, interaction);
      interaction.lastSnappedCell = null;
      return;
    }
    
    // Check if placement is valid (no collision)
    const valid = canPlace(boardStateRef.current, transform, origin);
    
    // Update last snapped cell for hysteresis
    interaction.lastSnappedCell = origin;
    
    if (!valid) {
      updateGhostState({ origin, valid: false });
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
      isPointerOutsideBoard(
        dropPoint.x,
        dropPoint.y,
        interaction.metrics.rect,
      )
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    const placement = board.placements[pieceId];
    startInteraction(event, pieceId, placement?.origin);
  };

  const moveCount = useMemo(() => history.length, [history.length]);

  const restoreState = (snapshot: {
    placements: Placement[];
    pieceStates: Record<PieceId, PieceState>;
    blockers?: Coordinate[];
    startedAt?: number | null;
  }) => {
    const baseBlockers = snapshot.blockers ?? blockers;
    let nextBoard = withBlockers(baseBlockers);
    for (const placement of snapshot.placements) {
      const transforms = PIECE_TRANSFORMS[placement.pieceId];
      const transform =
        transforms?.find((item) => item.id === placement.transformId) ?? null;
      if (!transform) continue;
      if (!canPlace(nextBoard, transform, placement.origin)) continue;
      nextBoard = placePiece(
        nextBoard,
        placement.pieceId,
        transform,
        placement.origin,
      );
    }
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
    setPieceStates(snapshot.pieceStates ?? initPieceStates());
    setHistory([]);
    updateGhostState(null);
    setDraggingPieceId(null);
    setDragPreview(null);
    setActivePieceId(null);
    if (snapshot.startedAt !== undefined) {
      setStartedAt(snapshot.startedAt);
    }
  };

  const value: GameContextValue = {
    puzzleId,
    puzzleDifficulty,
    solved,
    readOnly,
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
    restoreState,
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
