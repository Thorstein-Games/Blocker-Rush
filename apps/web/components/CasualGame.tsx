"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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

const SETTINGS_KEY = "blockerRush.casual.settings";
const STATS_KEY = "blockerRush.casual.stats";

const PIECE_COLORS: Record<PieceId, string> = {
  p1: "#f26d5b",
  p2: "#f2c14e",
  p3: "#7dd3fc",
  p4: "#a78bfa",
  p5: "#34d399",
  p6: "#fb7185",
  p7: "#facc15",
  p8: "#60a5fa",
  p9: "#f97316",
};

const difficultyOptions: Difficulty[] = ["easy", "medium", "hard", "insane"];

type PieceState = { rotation: number; flipped: boolean };

type CasualSettings = {
  difficulty: Difficulty;
};

type CasualStats = {
  attempts: Record<string, number>;
  bestTimesMs: Record<string, number>;
  lastTimesMs: Record<string, number>;
};

type DragGhost = {
  origin: Vec2;
  valid: boolean;
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
    return { attempts: {}, bestTimesMs: {}, lastTimesMs: {} };
  }
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return { attempts: {}, bestTimesMs: {}, lastTimesMs: {} };
    const parsed = JSON.parse(raw) as CasualStats;
    return {
      attempts: parsed.attempts ?? {},
      bestTimesMs: parsed.bestTimesMs ?? {},
      lastTimesMs: parsed.lastTimesMs ?? {},
    };
  } catch {
    return { attempts: {}, bestTimesMs: {}, lastTimesMs: {} };
  }
};

const writeStats = (stats: CasualStats) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

const formatDuration = (ms: number | undefined) => {
  if (!ms) return "--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function CasualGame() {
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

  const solved = useMemo(() => isSolved(board), [board]);

  useEffect(() => {
    boardStateRef.current = board;
  }, [board]);

  useEffect(() => {
    pieceStatesRef.current = pieceStates;
  }, [pieceStates]);

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
    setStats((prev) => {
      const next = {
        ...prev,
        lastTimesMs: { ...prev.lastTimesMs },
        bestTimesMs: { ...prev.bestTimesMs },
      };
      next.lastTimesMs[puzzleId] = elapsed;
      const best = next.bestTimesMs[puzzleId];
      next.bestTimesMs[puzzleId] = best ? Math.min(best, elapsed) : elapsed;
      writeStats(next);
      return next;
    });
    setHasRecordedSolve(true);
  }, [solved, puzzleId, startTime, hasRecordedSolve]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!activePieceId) return;
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        rotatePiece(activePieceId);
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        flipPiece(activePieceId);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePieceId]);

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
    setGhost(null);
    setDraggingPieceId(null);
    setActivePieceId(null);
    setPuzzleInput(id);
    setStartTime(Date.now());
    setHasRecordedSolve(false);
    setShareStatus(null);
    setStats((prev) => {
      const next = { ...prev, attempts: { ...prev.attempts } };
      next.attempts[id] = (next.attempts[id] ?? 0) + 1;
      writeStats(next);
      return next;
    });
    router.replace(`/casual?p=${id}`, { scroll: false });
  };

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

  const startInteraction = (
    event: React.PointerEvent,
    pieceId: PieceId,
    origin?: Vec2,
  ) => {
    event.preventDefault();
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
      setGhost(null);
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
        if (!interaction.previousPlacement) {
          rotatePiece(pieceId);
        }
      } else {
        finalizeDrop(interaction);
      }

      interactionRef.current = null;
      setDraggingPieceId(null);
      setGhost(null);
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
      setGhost(null);
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
      setGhost(null);
      return;
    }

    const state = pieceStatesRef.current[interaction.pieceId];
    const transform = getTransformFor(
      interaction.pieceId,
      state.rotation,
      state.flipped,
    );
    const valid = canPlace(boardStateRef.current, transform, origin);

    setGhost({ origin, valid });
  };

  const finalizeDrop = (interaction: InteractionState) => {
    const { pieceId, previousBoard } = interaction;
    const currentBoard = boardStateRef.current;
    if (ghost && ghost.valid) {
      const state = pieceStatesRef.current[pieceId];
      const transform = getTransformFor(pieceId, state.rotation, state.flipped);
      const nextBoard = placePiece(
        currentBoard,
        pieceId,
        transform,
        ghost.origin,
      );
      setHistory((prev) => [...prev, previousBoard]);
      boardStateRef.current = nextBoard;
      setBoard(nextBoard);
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

  const handleBoardPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLElement;
    const index = target.dataset.index;
    if (index === undefined) return;
    const cellIndex = Number.parseInt(index, 10);
    const cell = board.cells[cellIndex];
    if (!cell || cell === "blocker") return;
    const placement = board.placements[cell as PieceId];
    if (!placement) return;
    startInteraction(event, cell as PieceId, placement.origin);
  };

  const handlePiecePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
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

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previousBoard = next.pop();
      if (previousBoard) {
        boardStateRef.current = previousBoard;
        setBoard(previousBoard);
        setPieceStates((current) => {
          const updated = { ...current };
          for (const piece of PIECES) {
            const placement = previousBoard.placements[piece.id];
            if (placement) {
              updated[piece.id] = findOrientationForTransform(
                piece.id,
                placement.transformId,
              );
            }
          }
          return updated;
        });
      }
      return next;
    });
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

  const boardCells = board.cells.map((cell, index) => {
    const isBlocker = cell === "blocker";
    const isPiece = cell && cell !== "blocker";
    const background = isPiece ? PIECE_COLORS[cell as PieceId] : undefined;
    const className = [
      "board-cell",
      isBlocker ? "blocker" : null,
      isPiece ? "piece" : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        key={index}
        className={className}
        data-index={index}
        style={{ background }}
      />
    );
  });

  const activePiece = activePieceId
    ? PIECES.find((piece) => piece.id === activePieceId)
    : null;

  const currentStats = puzzleId
    ? {
        attempts: stats.attempts[puzzleId] ?? 0,
        last: stats.lastTimesMs[puzzleId],
        best: stats.bestTimesMs[puzzleId],
      }
    : null;

  return (
    <main className="page">
      <section className="casual-layout">
        <div className="panel">
          <h2>Casual Run</h2>
          <div className="stack">
            <label htmlFor="difficulty">Difficulty</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
            >
              {difficultyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="stack">
            <label htmlFor="puzzle-input">Puzzle ID</label>
            <input
              id="puzzle-input"
              value={puzzleInput}
              onChange={(event) => setPuzzleInput(event.target.value)}
              placeholder="A1A2B4B6C5D5F1"
            />
            <div className="status-row">
              <button
                className="button"
                type="button"
                onClick={() => loadPuzzleFromId(puzzleInput, difficulty)}
              >
                Load Puzzle
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => loadRandomPuzzle(difficulty)}
              >
                New Random
              </button>
            </div>
          </div>
          <div className="status-row">
            {puzzleDifficulty && (
              <span className="badge">{puzzleDifficulty}</span>
            )}
            {currentStats && (
              <span>
                Attempts: {currentStats.attempts} · Best:{" "}
                {formatDuration(currentStats.best)}
              </span>
            )}
          </div>
          <div className="status-row">
            <button
              className="button secondary"
              type="button"
              onClick={handleUndo}
            >
              Undo
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={handleHint}
            >
              Hint
            </button>
            <button className="button secondary" type="button" disabled>
              Watch Ad for Hint
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={handleShare}
              disabled={!solved}
            >
              Share
            </button>
          </div>
          {hint && <div className="notice">{hint}</div>}
          {shareStatus && <div className="notice">{shareStatus}</div>}
          <div className="ad-slot">Ad slot placeholder</div>
        </div>

        <div className="board-area">
          <div className="board-shell">
            <div
              className="board"
              ref={boardRef}
              onPointerDown={handleBoardPointerDown}
              style={
                {
                  "--cols": board.size.cols,
                  "--rows": board.size.rows,
                } as CSSProperties
              }
            >
              {boardCells}
              {ghost && draggingPieceId && (
                <div className={`ghost ${ghost.valid ? "valid" : "invalid"}`}>
                  {(() => {
                    const state = pieceStates[draggingPieceId];
                    const transform = getTransformFor(
                      draggingPieceId,
                      state.rotation,
                      state.flipped,
                    );
                    return transform.cells.map((cell, idx) => (
                      <div
                        key={idx}
                        className="ghost-cell"
                        style={{
                          gridColumn: ghost.origin.x + cell.x + 1,
                          gridRow: ghost.origin.y + cell.y + 1,
                        }}
                      />
                    ));
                  })()}
                </div>
              )}
            </div>
            {solved && (
              <div className="celebration">
                <div className="celebration-card">
                  <strong>Puzzle Complete</strong>
                  <span>That last snap hits just right.</span>
                </div>
              </div>
            )}
          </div>
          <div className="status-row">
            <span>Blockers locked. Invalid placements are blocked.</span>
          </div>
        </div>

        <div className="panel">
          <h3>Pieces</h3>
          <div className="tray">
            {PIECES.map((piece) => {
              const state = pieceStates[piece.id];
              const transform = getTransformFor(
                piece.id,
                state.rotation,
                state.flipped,
              );
              const placed = Boolean(board.placements[piece.id]);
              const cardClassName = [
                "piece-card",
                placed ? "placed" : null,
                activePieceId === piece.id ? "active" : null,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={piece.id}
                  className={cardClassName}
                  onPointerDown={(event) =>
                    handlePiecePointerDown(event, piece.id)
                  }
                >
                  <div
                    className="piece-grid"
                    style={{
                      gridTemplateColumns: `repeat(${transform.width}, 18px)`,
                      gridTemplateRows: `repeat(${transform.height}, 18px)`,
                    }}
                  >
                    {transform.cells.map((cell, index) => (
                      <div
                        key={index}
                        className="piece-cell"
                        style={{
                          gridColumn: cell.x + 1,
                          gridRow: cell.y + 1,
                          background: PIECE_COLORS[piece.id],
                        }}
                      />
                    ))}
                  </div>
                  <div className="piece-meta">
                    <strong>{piece.name}</strong>
                    <span>
                      {placed ? "Placed" : "Ready"} · R to rotate · F to flip
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {activePiece && (
            <div className="stack">
              <label>Active Piece</label>
              <div className="status-row">
                <span>{activePiece.name}</span>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => rotatePiece(activePiece.id)}
                >
                  Rotate
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => flipPiece(activePiece.id)}
                >
                  Flip
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
