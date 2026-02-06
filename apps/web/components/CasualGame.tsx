"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  Coordinate,
  Difficulty,
  PieceId,
  Vec2,
} from "@blocker-rush/shared";
import {
  PIECES,
  buildShareText,
  canonicalizePuzzleId,
  difficultyOptions,
  formatCoordinate,
  getPuzzleById,
  parsePuzzleId,
  pickPuzzleByDifficulty,
  scoreDifficulty,
  solvePuzzle,
  vecToCoord,
} from "@blocker-rush/shared";
import GameBoard from "./GameBoard";
import PiecesTray from "./PiecesTray";
import {
  GameProvider,
  findOrientationForTransform,
  useGame,
} from "./GameContext";
import GameHeader from "./GameHeader";
import ThemeSelect from "./ThemeSelect";

const SETTINGS_KEY = "blockerRush.casual.settings";
const STATS_KEY = "blockerRush.casual.stats";
const INVALID_PUZZLE_MESSAGE =
  "Invalid puzzle ID. Use 7 coordinates on a 6x6 grid, for example: A1A2B4B6C5D5F1";

type CasualSettings = {
  difficulty: Difficulty;
};

type CasualStats = {
  bestTimesMs: Record<string, number>;
  lastTimesMs: Record<string, number>;
  bestMoves: Record<string, number>;
  lastMoves: Record<string, number>;
};

type CurrentStats = {
  moves: number;
  bestMoves?: number;
  lastMoves?: number;
};

type SolutionCache = Record<
  PieceId,
  { origin: Vec2; transformId: string } | undefined
>;

type PuzzleSpec = {
  id: string;
  blockers: Coordinate[];
  difficulty: Difficulty | null;
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

function CasualGameLayout() {
  const {
    puzzleId,
    puzzleDifficulty,
    board,
    blockers,
    solved,
    moveCount,
    startedAt,
    applyPuzzle,
    setActivePieceId,
    setPieceState,
  } = useGame();
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzleParam = searchParams.get("p");
  const hintTimeoutRef = useRef<number | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [puzzleInput, setPuzzleInput] = useState<string>("");
  const [hint, setHint] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [solutionCache, setSolutionCache] = useState<SolutionCache | null>(
    null,
  );
  const [stats, setStats] = useState<CasualStats>(() => readStats());
  const [hasRecordedSolve, setHasRecordedSolve] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const settings = readSettings();
    setDifficulty(settings.difficulty);
  }, []);

  useEffect(() => {
    writeSettings({ difficulty });
  }, [difficulty]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 981px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        window.clearTimeout(hintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setHint(null);
    setShareStatus(null);
    setSolutionCache(null);
    setHasRecordedSolve(false);
    if (hintTimeoutRef.current) {
      window.clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
  }, [puzzleId]);

  const setPuzzleParam = useCallback(
    (nextId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("p", nextId);
      router.replace(`/casual?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const resolvePuzzleSpec = useCallback((raw: string): PuzzleSpec => {
    const parsed = parsePuzzleId(raw);
    const canonical = canonicalizePuzzleId(parsed);
    const record = getPuzzleById(canonical);
    if (record) {
      return {
        id: record.id,
        blockers: record.blockers,
        difficulty: record.difficulty,
      };
    }

    const solveResult = solvePuzzle(parsed, { maxSolutions: 51 });
    return {
      id: canonical,
      blockers: parsed,
      difficulty: scoreDifficulty(solveResult),
    };
  }, []);

  const loadRandomPuzzle = useCallback(
    (tier: Difficulty) => {
      const record = pickPuzzleByDifficulty(tier);
      setPuzzleParam(record.id);
    },
    [setPuzzleParam],
  );

  const loadPuzzleFromId = useCallback(
    (raw: string) => {
      try {
        const next = resolvePuzzleSpec(raw);
        setPuzzleParam(next.id);
        setHint(null);
      } catch {
        setHint(INVALID_PUZZLE_MESSAGE);
      }
    },
    [resolvePuzzleSpec, setPuzzleParam],
  );

  useEffect(() => {
    if (!puzzleParam) return;
    try {
      const next = resolvePuzzleSpec(puzzleParam);
      if (next.id !== puzzleParam) {
        setPuzzleParam(next.id);
      }
      if (next.id === puzzleId) return;
      applyPuzzle(next);
      setPuzzleInput(next.id);
      setHint(null);
    } catch {
      setHint(INVALID_PUZZLE_MESSAGE);
    }
  }, [puzzleParam, puzzleId, applyPuzzle, resolvePuzzleSpec, setPuzzleParam]);

  useEffect(() => {
    if (puzzleParam) return;
    loadRandomPuzzle(difficulty);
  }, [puzzleParam, difficulty, loadRandomPuzzle]);

  useEffect(() => {
    if (!solved || !puzzleId || !startedAt) return;
    if (hasRecordedSolve) return;
    const elapsed = Date.now() - startedAt;
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
  }, [solved, puzzleId, startedAt, hasRecordedSolve, moveCount]);

  const currentStats = useMemo<CurrentStats | null>(() => {
    if (!puzzleId) return null;
    return {
      moves: moveCount,
      bestMoves: stats.bestMoves[puzzleId],
      lastMoves: stats.lastMoves[puzzleId],
    };
  }, [puzzleId, stats, moveCount]);

  const loadPuzzleFromInput = () => {
    loadPuzzleFromId(puzzleInput);
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
    setPieceState(target.id, orientation);
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

  const settingsContent = (
    <div className="settings-stack">
      <ThemeSelect />
      <div className="stack">
        <label htmlFor="difficulty">Difficulty</label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value as Difficulty)}
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
        <div className="settings-actions">
          <button
            className="button"
            type="button"
            onClick={loadPuzzleFromInput}
          >
            Load
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
      <div className="settings-row">
        {puzzleDifficulty && <span className="badge">{puzzleDifficulty}</span>}
        {currentStats && (
          <span>
            Moves: {currentStats.moves} · Best: {currentStats.bestMoves ?? "--"}
          </span>
        )}
      </div>
      <div className="settings-actions">
        <button className="button secondary" type="button" onClick={handleHint}>
          Hint
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={handleShare}
        >
          Share
        </button>
      </div>
      {hint && <div className="notice">{hint}</div>}
      {shareStatus && <div className="notice">{shareStatus}</div>}
    </div>
  );

  return (
    <main className="page game-page">
      <GameHeader
        mode="casual"
        settingsTitle="Casual Settings"
        settingsPanel={isDesktop ? undefined : settingsContent}
      />
      <section className="game-layout">
        {isDesktop && (
          <aside className="panel side-panel">
            <h3>Casual Settings</h3>
            {settingsContent}
          </aside>
        )}
        <div className="game-center">
          <GameBoard />
          <PiecesTray />
        </div>
      </section>
    </main>
  );
}

export default function CasualGame() {
  return (
    <GameProvider>
      <CasualGameLayout />
    </GameProvider>
  );
}
