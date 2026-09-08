"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  Coordinate,
  Difficulty,
  PieceId,
  Placement,
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
  winsByDifficulty: Record<Difficulty, number>;
};

type RoundStats = {
  moves: number;
  elapsedMs: number;
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
  const emptyWins: Record<Difficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
    insane: 0,
  };

  if (typeof window === "undefined") {
    return { winsByDifficulty: emptyWins };
  }
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) {
      return { winsByDifficulty: emptyWins };
    }
    const parsed = JSON.parse(raw) as Partial<CasualStats>;
    return {
      winsByDifficulty: {
        easy: parsed.winsByDifficulty?.easy ?? 0,
        medium: parsed.winsByDifficulty?.medium ?? 0,
        hard: parsed.winsByDifficulty?.hard ?? 0,
        insane: parsed.winsByDifficulty?.insane ?? 0,
      },
    };
  } catch {
    return { winsByDifficulty: emptyWins };
  }
};

const writeStats = (stats: CasualStats) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

const formatElapsedTime = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
    selectPiece,
    setPieceState,
    boardRef,
  } = useGame();
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzleParam = searchParams.get("p");
  const hintTimeoutRef = useRef<number | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [puzzleInput, setPuzzleInput] = useState<string>("");
  const [hint, setHint] = useState<string | null>(null);
  const [hintPlacement, setHintPlacement] = useState<Placement | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [solutionCache, setSolutionCache] = useState<SolutionCache | null>(
    null,
  );
  const [stats, setStats] = useState<CasualStats>(() => readStats());
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
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
    const media = window.matchMedia("(min-width: 1200px)");
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
    setHintPlacement(null);
    setSolutionCache(null);
    setRoundStats(null);
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
    setRoundStats({ moves: moveCount, elapsedMs: elapsed });

    if (!puzzleDifficulty) {
      setHasRecordedSolve(true);
      return;
    }

    setStats((prev) => {
      const next = {
        ...prev,
        winsByDifficulty: { ...prev.winsByDifficulty },
      };
      next.winsByDifficulty[puzzleDifficulty] += 1;
      writeStats(next);
      return next;
    });
    setHasRecordedSolve(true);
  }, [
    solved,
    puzzleId,
    startedAt,
    hasRecordedSolve,
    moveCount,
    puzzleDifficulty,
  ]);

  const loadPuzzleFromInput = () => {
    loadPuzzleFromId(puzzleInput);
  };

  const handleHint = (event: MouseEvent<HTMLButtonElement>) => {
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
    setHintPlacement({ ...placement, pieceId: target.id });
    setPieceState(target.id, orientation);
    selectPiece(target.id);
    setHint(
      `Try placing ${target.name} so its top-left is at ${formatCoordinate(
        coord,
      )}.`,
    );
    event.currentTarget.closest("dialog")?.close();
    window.requestAnimationFrame(() => {
      boardRef.current
        ?.querySelector<HTMLElement>(
          `[data-index="${placement.origin.y * board.size.cols + placement.origin.x}"]`,
        )
        ?.focus();
    });
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
    const text = buildShareText(puzzleId, board.placements, baseUrl, {
      messageText: solved
        ? `I just solved a ${puzzleDifficulty ?? "mystery"} puzzle in ${moveCount} moves Blocker Rush! Can you solve it?`
        : "Check out this puzzle I found in Blocker Rush!",
    });
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
            Random Puzzle
          </button>
        </div>
      </div>
      <div className="settings-row">
        {puzzleDifficulty && <span className="badge">{puzzleDifficulty}</span>}
        {solved && roundStats && (
          <span>
            Moves: {roundStats.moves} · Time:{" "}
            {formatElapsedTime(roundStats.elapsedMs)}
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
      {hint && (
        <div className="notice" role="status">
          {hint}
        </div>
      )}
      {shareStatus && (
        <div className="notice" role="status">
          {shareStatus}
        </div>
      )}
    </div>
  );

  const statsContent = useMemo(
    () => (
      <div className="stats-grid">
        {difficultyOptions.map((tier) => (
          <div className="stat-card" key={tier}>
            <span className="stat-label">{tier}</span>
            <span className="stat-value">{stats.winsByDifficulty[tier]}</span>
          </div>
        ))}
      </div>
    ),
    [stats],
  );

  return (
    <main className="page game-page no-scroll-mobile">
      <GameHeader
        mode="casual"
        statsTitle="Casual Wins"
        statsPanel={statsContent}
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
        <div className="game-center puzzle-workspace">
          <div className="game-context-strip">
            <strong>Casual</strong>
            <span className="context-difficulty">
              {puzzleDifficulty ?? "Custom puzzle"}
            </span>
          </div>
          <GameBoard hintPlacement={hintPlacement} />
          <PiecesTray />
          {solved && (
            <>
              <div className="notice" role="status">
                Completed in {roundStats?.moves ?? moveCount} moves in{" "}
                {formatElapsedTime(roundStats?.elapsedMs ?? 0)}.
              </div>
              <div className="settings-actions">
                <button className="button" type="button" onClick={handleShare}>
                  Share
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => router.push("/casual")}
                >
                  Play Again
                </button>
              </div>
            </>
          )}
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
