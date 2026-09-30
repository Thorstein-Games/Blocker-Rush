"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
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
  Vec2,
} from "@blocker-rush/shared";
import {
  PIECES,
  PIECE_TRANSFORMS,
  canPlace,
  createBoard,
  placePiece,
  removePiece,
  withBlockers,
  isSolved,
} from "@blocker-rush/shared";
import type {
  DragGhost,
  DragPreview,
  GameContextValue,
  InteractionState,
  PieceState,
  PuzzleSpec,
} from "./gameTypes";
import { DRAG_GAIN, DRAG_VISUAL_OFFSET_Y } from "./dragConfig";
import {
  findOrientationForTransform,
  getCellIndexFromTarget,
  getPieceVisualCenterLocal,
  getPieceVisualCenterPx,
  getTransformFor,
  initPieceStates,
  isPointerOutsideBoard,
  pieceName,
  placementError,
} from "./pieceGeometry";
import { useTouchScrollLock } from "./useTouchScrollLock";

// Re-exported for existing importers (e.g. MultiplayerBoardPanel).
export { findOrientationForTransform };


const GameContext = createContext<GameContextValue | null>(null);

type GameProviderProps = {
  children: ReactNode;
  lockOnSolve?: boolean;
  disabled?: boolean;
};

export function GameProvider({
  children,
  lockOnSolve = false,
  disabled = false,
}: GameProviderProps) {
  const [board, setBoard] = useState<BoardState>(() => createBoard());
  const [pieceStates, setPieceStates] =
    useState<Record<PieceId, PieceState>>(initPieceStates());
  const [puzzleId, setPuzzleId] = useState<string>("");
  const [blockers, setBlockers] = useState<Coordinate[]>([]);
  const [puzzleDifficulty, setPuzzleDifficulty] = useState<Difficulty | null>(
    null,
  );
  const [feedback, setFeedback] = useState<GameContextValue["feedback"]>(null);
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
  const lastTapRef = useRef<{ time: number; cellIndex: number } | null>(null);
  const metricsRef = useRef<InteractionState["metrics"] | null>(null);

  const setTouchScrollLock = useTouchScrollLock();

  const solved = useMemo(() => isSolved(board), [board]);
  const readOnly = disabled || (lockOnSolve && solved);

  useEffect(() => {
    boardStateRef.current = board;
  }, [board]);

  useEffect(() => {
    pieceStatesRef.current = pieceStates;
  }, [pieceStates]);

  useEffect(() => {
    if (!draggingPieceId) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggingPieceId]);

  const announce = (text: string, error = false) => {
    setFeedback((previous) => ({
      text,
      error,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
  };

  const selectPiece = (pieceId: PieceId) => {
    if (readOnly || interactionRef.current) return;
    setActivePieceId(pieceId);
    announce(
      `${pieceName(pieceId)} selected. Arrows choose a square; Enter places. D / S rotates; F flips.`,
    );
  };

  const updateGhostState = (next: DragGhost | null) => {
    ghostRef.current = next;
    setGhost(next);
  };

  const applyPuzzle = (puzzle: PuzzleSpec) => {
    setFeedback(null);
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
      const target = event.target;
      if (
        readOnly ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        !(target instanceof HTMLElement) ||
        target.isContentEditable ||
        target.closest(
          'input, textarea, select, [contenteditable], dialog, [role="dialog"]',
        ) ||
        document.querySelector('dialog[open], [aria-modal="true"]')
      )
        return;
      const surface = boardRef.current?.closest(
        ".game-center, .multiplayer-main-board",
      );
      if (!surface?.contains(target) && !interactionRef.current) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        setActivePieceId(null);
        announce("Selection cancelled. Choose a piece from the tray.");
        return;
      }
      if (!activePieceId || boardStateRef.current.placements[activePieceId])
        return;
      if (key === "d" || key === "s" || key === "f") {
        event.preventDefault();
        if (key === "f") flipPiece(activePieceId);
        else rotatePieceBy(activePieceId, key === "d" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePieceId, readOnly]);

  const rotatePieceBy = (pieceId: PieceId, delta: number) => {
    if (readOnly || boardStateRef.current.placements[pieceId]) return;
    announce(`${pieceName(pieceId)} rotated.`);
    setPieceStates((prev) => ({
      ...prev,
      [pieceId]: {
        ...prev[pieceId],
        rotation: (prev[pieceId].rotation + delta + 4) % 4,
      },
    }));
  };

  const rotatePiece = (pieceId: PieceId) => {
    rotatePieceBy(pieceId, -1);
  };

  const flipPiece = (pieceId: PieceId) => {
    if (readOnly || boardStateRef.current.placements[pieceId]) return;
    announce(`${pieceName(pieceId)} flipped.`);
    setPieceStates((prev) => ({
      ...prev,
      [pieceId]: {
        ...prev[pieceId],
        flipped: !prev[pieceId].flipped,
      },
    }));
  };

  const clearBoard = () => {
    if (readOnly || interactionRef.current) return;
    const currentBoard = boardStateRef.current;
    const hasPlacedPieces = PIECES.some((piece) =>
      Boolean(currentBoard.placements[piece.id]),
    );
    if (!hasPlacedPieces) return;
    announce("Board emptied. Undo restores your pieces.");
    setActivePieceId(null);
    const nextBoard = withBlockers(blockers);
    setHistory((prev) => [...prev, currentBoard]);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
    updateGhostState(null);
    setDraggingPieceId(null);
    setDragPreview(null);
  };

  const undo = () => {
    if (readOnly || interactionRef.current) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    boardStateRef.current = previous;
    setBoard(previous);
    setPieceStates((current) => {
      const next = { ...current };
      for (const placement of Object.values(previous.placements)) {
        if (placement)
          next[placement.pieceId] = findOrientationForTransform(
            placement.pieceId,
            placement.transformId,
          );
      }
      return next;
    });
    setActivePieceId(null);
    updateGhostState(null);
    setDragPreview(null);
    announce("Last move undone.");
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

  const updateMetrics = () => {
    const metrics = getMetrics();
    if (!metrics) return;
    metricsRef.current = metrics;
    if (interactionRef.current) {
      interactionRef.current.metrics = metrics;
    }
  };

  useEffect(() => {
    updateMetrics();
    const handleResize = () => updateMetrics();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, []);

  const buildDragPreview = (
    pieceId: PieceId,
    center: { x: number; y: number },
    metrics: { cell: number; gap: number; step: number },
  ): DragPreview => {
    const state = pieceStatesRef.current[pieceId];
    const transform = getTransformFor(pieceId, state.rotation, state.flipped);
    const centerLocal = getPieceVisualCenterLocal(transform.cells);
    const offset = getPieceVisualCenterPx(centerLocal, metrics);
    return {
      pieceId,
      cell: metrics.cell,
      gap: metrics.gap,
      offset,
      scale: 1,
      position: center,
      dropTarget: null,
    };
  };

  const updateDragPreviewPosition = (
    center: { x: number; y: number },
    interaction: InteractionState,
  ) => {
    setDragPreview((prev) => {
      const state = pieceStatesRef.current[interaction.pieceId];
      const transform = getTransformFor(
        interaction.pieceId,
        state.rotation,
        state.flipped,
      );
      const centerLocal = getPieceVisualCenterLocal(transform.cells);
      const offset = getPieceVisualCenterPx(centerLocal, interaction.metrics);
      if (!prev || prev.pieceId !== interaction.pieceId) {
        return buildDragPreview(
          interaction.pieceId,
          center,
          interaction.metrics,
        );
      }
      return {
        ...prev,
        position: center,
        offset,
        dropTarget: prev.dropTarget ?? null,
      };
    });
  };

  const updateDragPreviewDropTarget = (
    snapCenter: { x: number; y: number } | null,
    interaction: InteractionState,
  ) => {
    if (!snapCenter) {
      setDragPreview((prev) => (prev ? { ...prev, dropTarget: null } : prev));
      return;
    }
    setDragPreview((prev) => {
      const preview =
        prev ??
        buildDragPreview(
          interaction.pieceId,
          interaction.targetCenter ?? {
            x: interaction.startX,
            y: interaction.startY,
          },
          interaction.metrics,
        );
      return {
        ...preview,
        dropTarget: snapCenter,
      };
    });
  };

  const commitRemoval = (pieceId: PieceId, previousBoard: BoardState) => {
    const nextBoard = removePiece(previousBoard, pieceId);
    setHistory((prev) => [...prev, previousBoard]);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
    announce(`${pieceName(pieceId)} removed. Undo restores it.`);
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    pieceId: PieceId,
    origin?: Vec2,
  ) => {
    if (readOnly || event.button !== 0 || interactionRef.current) return;
    event.preventDefault();
    const focusTarget =
      event.target instanceof HTMLElement &&
      event.target.closest('[role="gridcell"]');
    (focusTarget instanceof HTMLElement
      ? focusTarget
      : event.currentTarget
    ).focus({ preventScroll: true });
    const wasActive = activePieceId === pieceId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateMetrics();
    const metrics = metricsRef.current;
    if (!metrics) return;
    const pointerId = event.pointerId;
    const captureTarget = event.currentTarget as HTMLElement;
    const touchScrollLocked = event.pointerType === "touch";
    if (touchScrollLocked) {
      setTouchScrollLock(true);
    }
    const state = pieceStatesRef.current[pieceId];
    const transform = getTransformFor(pieceId, state.rotation, state.flipped);
    const centerLocal = getPieceVisualCenterLocal(transform.cells);
    const centerLocalPx = getPieceVisualCenterPx(centerLocal, metrics);
    const targetRect = (
      event.currentTarget as HTMLElement
    ).getBoundingClientRect();
    const pieceCenterWorld = origin
      ? {
          x: metrics.rect.left + origin.x * metrics.step + centerLocalPx.x,
          y: metrics.rect.top + origin.y * metrics.step + centerLocalPx.y,
        }
      : {
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2,
        };
    const pieceCenterOffsetPx = {
      // (A) Drag rendering: keep the piece's grab anchor stable at drag start.
      x: event.clientX - pieceCenterWorld.x,
      y: event.clientY - pieceCenterWorld.y,
    };
    const startCenter = {
      x: event.clientX - pieceCenterOffsetPx.x,
      y: event.clientY - pieceCenterOffsetPx.y,
    };

    const previousBoard = boardStateRef.current;
    const previousPlacement = previousBoard.placements[pieceId] ?? undefined;

    const beginDrag = () => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.mode === "dragging") return;
      window.clearTimeout(interaction.timeoutId);
      interaction.mode = "dragging";
      interactionRef.current = interaction;
      lastTapRef.current = null;
      setDraggingPieceId(pieceId);
      const previewCenter = getAmplifiedCenter(
        interaction,
        interaction.lastPointer ?? {
          x: interaction.startX,
          y: interaction.startY,
        },
      );
      setDragPreview(
        buildDragPreview(pieceId, previewCenter, interaction.metrics),
      );
      updateGhostState(null);
      if (interaction.previousPlacement) {
        const nextBoard = removePiece(interaction.previousBoard, pieceId);
        boardStateRef.current = nextBoard;
        setBoard(nextBoard);
      }
      startDragLoop();
    };

    const timeoutId = window.setTimeout(() => {
      beginDrag();
    }, 180);

    interactionRef.current = {
      mode: "pending",
      pieceId,
      pointerId,
      pointerType: event.pointerType,
      touchScrollLocked,
      captureTarget,
      startX: event.clientX,
      startY: event.clientY,
      startCenter,
      pieceCenterOffsetPx,
      previousBoard,
      previousPlacement,
      metrics,
      timeoutId,
    };

    setActivePieceId(pieceId);
    announce(`${pieceName(pieceId)} selected.`);

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

      interaction.latestPointer = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };
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

      if (interaction.rafId) {
        window.cancelAnimationFrame(interaction.rafId);
      }
      if (interaction.captureTarget?.hasPointerCapture(interaction.pointerId)) {
        interaction.captureTarget.releasePointerCapture(interaction.pointerId);
      }
      if (interaction.touchScrollLocked) {
        setTouchScrollLock(false);
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

  const getAmplifiedCenter = (
    interaction: InteractionState,
    pointer: { x: number; y: number },
  ) => {
    const dx = pointer.x - interaction.startX;
    const dy = pointer.y - interaction.startY;
    return {
      x: interaction.startCenter.x + dx * DRAG_GAIN,
      // Apply a constant upward offset so the piece sits above the pointer.
      y: interaction.startCenter.y + dy * DRAG_GAIN - DRAG_VISUAL_OFFSET_Y,
    };
  };

  const updateGhostFromCenter = (
    center: { x: number; y: number },
    interaction: InteractionState,
  ) => {
    const { rect, step } = interaction.metrics;
    const state = pieceStatesRef.current[interaction.pieceId];
    const transform = getTransformFor(
      interaction.pieceId,
      state.rotation,
      state.flipped,
    );
    const centerLocal = getPieceVisualCenterLocal(transform.cells);
    const centerLocalPx = getPieceVisualCenterPx(
      centerLocal,
      interaction.metrics,
    );
    // (B) Shadow snapping: convert pointer px -> board px -> cell space.
    const centerLocalInBoard = {
      x: (center.x - rect.left + interaction.metrics.gap / 2) / step,
      y: (center.y - rect.top + interaction.metrics.gap / 2) / step,
    };
    const candidateOrigin = {
      // Ensure oriented cells land on integer grid cells when snapped.
      x: Math.round(centerLocalInBoard.x - centerLocal.x),
      y: Math.round(centerLocalInBoard.y - centerLocal.y),
    };

    const lastSnap = interaction.lastSnapOrigin;
    let origin = candidateOrigin;
    if (lastSnap) {
      const lastCenter = {
        x: lastSnap.x + centerLocal.x,
        y: lastSnap.y + centerLocal.y,
      };
      const hysteresis = 0.35;
      if (
        Math.hypot(
          centerLocalInBoard.x - lastCenter.x,
          centerLocalInBoard.y - lastCenter.y,
        ) < hysteresis
      ) {
        origin = lastSnap;
      }
    }
    interaction.lastSnapOrigin = origin;

    const buffer =
      step + Math.max(transform.width, transform.height) * step * 0.35;
    const topLeftX = origin.x * step;
    const topLeftY = origin.y * step;
    if (
      topLeftX < -buffer ||
      topLeftY < -buffer ||
      topLeftX > rect.width + buffer ||
      topLeftY > rect.height + buffer
    ) {
      updateGhostState(null);
      updateDragPreviewDropTarget(null, interaction);
      return;
    }

    const valid = canPlace(boardStateRef.current, transform, origin);
    const snapCenter = {
      x: rect.left + origin.x * step + centerLocalPx.x,
      y: rect.top + origin.y * step + centerLocalPx.y,
    };

    interaction.latestSnapCenter = snapCenter;
    updateGhostState({ origin, valid });
    updateDragPreviewDropTarget(snapCenter, interaction);
  };

  const startDragLoop = () => {
    const tick = () => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.mode !== "dragging") return;
      const pointer = interaction.latestPointer ?? {
        x: interaction.startX,
        y: interaction.startY,
      };
      const targetCenter = getAmplifiedCenter(interaction, pointer);
      interaction.targetCenter = targetCenter;
      const alpha = interaction.pointerType === "touch" ? 0.28 : 0.4;
      const smoothed = interaction.smoothedCenter ?? targetCenter;
      const nextSmoothed = {
        x: smoothed.x + (targetCenter.x - smoothed.x) * alpha,
        y: smoothed.y + (targetCenter.y - smoothed.y) * alpha,
      };
      interaction.smoothedCenter = nextSmoothed;

      updateDragPreviewPosition(nextSmoothed, interaction);
      // Keep the shadow responsive: snap from the raw target center.
      updateGhostFromCenter(targetCenter, interaction);

      interaction.rafId = window.requestAnimationFrame(tick);
    };
    const interaction = interactionRef.current;
    if (interaction?.rafId) {
      window.cancelAnimationFrame(interaction.rafId);
    }
    if (interaction) {
      interaction.rafId = window.requestAnimationFrame(tick);
    }
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
      setActivePieceId(null);
      announce(
        `${pieceName(pieceId)} placed. ${Object.values(nextBoard.placements).filter(Boolean).length} of 9 pieces placed.`,
      );
      const snapCenter = interaction.latestSnapCenter;
      if (snapCenter) {
        setDragPreview((prev) =>
          prev
            ? {
                ...prev,
                dropTarget: snapCenter,
                isDropping: true,
              }
            : prev,
        );
        window.setTimeout(() => {
          setDragPreview(null);
        }, 120);
      } else {
        setDragPreview(null);
      }
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
      setDragPreview(null);
      return;
    }
    const state = pieceStatesRef.current[pieceId];
    announce(
      latestGhost
        ? placementError(
            currentBoard,
            getTransformFor(pieceId, state.rotation, state.flipped),
            latestGhost.origin,
          )
        : "Drop inside the board to place this piece.",
      true,
    );
    boardStateRef.current = previousBoard;
    setBoard(previousBoard);
    setDragPreview(null);
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

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const cellIndex = getCellIndexFromTarget(event.target);
    if (cellIndex === null) return;
    const currentBoard = boardStateRef.current;
    const cell = currentBoard.cells[cellIndex];
    if (!cell || cell === "blocker") return;
    const placement = currentBoard.placements[cell as PieceId];
    if (!placement) return;
    if (event.pointerType === "touch") {
      const now = Date.now();
      const lastTap = lastTapRef.current;
      if (
        lastTap &&
        now - lastTap.time < 320 &&
        lastTap.cellIndex === cellIndex
      ) {
        lastTapRef.current = null;
        commitRemoval(cell as PieceId, currentBoard);
        setActivePieceId(cell as PieceId);
        return;
      }
      lastTapRef.current = { time: now, cellIndex };
    }
    startInteraction(event, cell as PieceId, placement.origin);
  };

  const activateCell = (cellIndex: number, remove = false) => {
    if (readOnly || interactionRef.current) return;
    const currentBoard = boardStateRef.current;
    const cell = currentBoard.cells[cellIndex];
    if (remove || (!activePieceId && cell && cell !== "blocker")) {
      if (cell && cell !== "blocker") {
        commitRemoval(cell, currentBoard);
        setActivePieceId(cell);
      } else announce("No piece here to remove.");
      return;
    }
    if (!activePieceId) {
      announce(
        cell === "blocker"
          ? "Blocked square. Choose a piece from the tray."
          : "Choose a piece from the tray first.",
      );
      return;
    }
    if (currentBoard.placements[activePieceId]) return;
    const origin = {
      x: cellIndex % currentBoard.size.cols,
      y: Math.floor(cellIndex / currentBoard.size.cols),
    };
    const state = pieceStatesRef.current[activePieceId];
    const transform = getTransformFor(
      activePieceId,
      state.rotation,
      state.flipped,
    );
    if (!canPlace(currentBoard, transform, origin)) {
      announce(placementError(currentBoard, transform, origin), true);
      return;
    }
    const nextBoard = placePiece(
      currentBoard,
      activePieceId,
      transform,
      origin,
    );
    setHistory((prev) => [...prev, currentBoard]);
    boardStateRef.current = nextBoard;
    setBoard(nextBoard);
    setActivePieceId(null);
    announce(
      `${pieceName(activePieceId)} placed. ${Object.values(nextBoard.placements).filter(Boolean).length} of 9 pieces placed.`,
    );
  };

  const handleBoardClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const cellIndex = getCellIndexFromTarget(event.target);
    if (cellIndex !== null && !boardStateRef.current.cells[cellIndex])
      activateCell(cellIndex);
    else if (
      cellIndex !== null &&
      boardStateRef.current.cells[cellIndex] === "blocker"
    )
      activateCell(cellIndex);
  };

  const handleBoardDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    // Pointer capture can retarget a double-click to the board itself.
    const metrics = metricsRef.current;
    const cellIndex =
      getCellIndexFromTarget(event.target) ??
      (metrics
        ? Math.floor((event.clientY - metrics.rect.top) / metrics.step) *
            boardStateRef.current.size.cols +
          Math.floor((event.clientX - metrics.rect.left) / metrics.step)
        : null);
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
    clearBoard,
    undo,
    canUndo: history.length > 0 && !readOnly && !draggingPieceId,
    feedback,
    selectPiece,
    activateCell,
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
