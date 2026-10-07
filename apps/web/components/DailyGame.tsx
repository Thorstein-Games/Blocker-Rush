"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Placement, PieceId } from "@blocker-rush/shared";
import {
  buildShareText,
  getDateKey,
  getDailyPuzzle,
  PIECES,
} from "@blocker-rush/shared";
import GameBoard from "./GameBoard";
import PiecesTray from "./PiecesTray";
import { GameProvider, useGame } from "./GameContext";
import GameHeader from "./GameHeader";
import type { PieceState } from "./gameTypes";
import ThemeSelect from "./ThemeSelect";
import { track } from "../lib/analytics";
import { BASE_PATH } from "../lib/basePath";
import {
  type DailyStats,
  reconcileStats,
  recordDailySolve,
} from "./dailyStats";
import {
  advanceElapsed,
  dailyShareMessage,
  describeSolve,
  formatDuration,
} from "./dailyTimer";

const DAILY_STATS_KEY = "blockerRush.daily.stats";
const DAILY_PROGRESS_KEY = "blockerRush.daily.progress";

type DailyProgress = {
  dateKey: string;
  puzzleId: string;
  placements: Placement[];
  pieceStates: Record<PieceId, PieceState>;
  startedAt: number | null;
  /** Moves across every visit today, not just since the last page load. */
  moveCount: number;
  /**
   * Visible solving time. Missing (null) on progress saved before the timer
   * existed, which only matters for an already-solved board.
   */
  elapsedMs: number | null;
};

const readDailyStats = (): DailyStats => {
  if (typeof window === "undefined") {
    return { streak: 0 };
  }
  try {
    const raw = window.localStorage.getItem(DAILY_STATS_KEY);
    if (!raw) return { streak: 0 };
    const parsed = JSON.parse(raw) as DailyStats;
    return {
      streak: typeof parsed.streak === "number" ? parsed.streak : 0,
      lastCompletedDateKey: parsed.lastCompletedDateKey,
    };
  } catch {
    return { streak: 0 };
  }
};

const writeDailyStats = (stats: DailyStats) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
};

const readDailyProgress = (
  dateKey: string,
  puzzleId: string,
): DailyProgress | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DAILY_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyProgress;
    if (!parsed || parsed.dateKey !== dateKey || parsed.puzzleId !== puzzleId) {
      return null;
    }
    if (!Array.isArray(parsed.placements) || !parsed.pieceStates) {
      return null;
    }
    return {
      ...parsed,
      moveCount: typeof parsed.moveCount === "number" ? parsed.moveCount : 0,
      elapsedMs: typeof parsed.elapsedMs === "number" ? parsed.elapsedMs : null,
    };
  } catch {
    return null;
  }
};

const writeDailyProgress = (progress: DailyProgress) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(progress));
};

const clearDailyProgress = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DAILY_PROGRESS_KEY);
};

function DailyGameLayout({ date }: { date: Date }) {
  const {
    solved,
    puzzleId,
    applyPuzzle,
    board,
    pieceStates,
    moveCount,
    startedAt,
    restoreState,
  } = useGame();
  const router = useRouter();
  const dateKey = getDateKey(date);
  const dailyPuzzle = useMemo(() => getDailyPuzzle(date), [dateKey]);
  const [stats, setStats] = useState<DailyStats>(() =>
    reconcileStats(readDailyStats(), dateKey),
  );
  const [hasRecorded, setHasRecorded] = useState(false);
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  // GameContext counts moves since the board was last loaded; add the moves
  // from earlier visits today so a reload doesn't reset the count.
  const [earlierMoves, setEarlierMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(0);
  const hasRestoredRef = useRef<string | null>(null);
  const totalMoves = earlierMoves + moveCount;

  useEffect(() => {
    if (dailyPuzzle.id === puzzleId) return;
    applyPuzzle({
      id: dailyPuzzle.id,
      blockers: dailyPuzzle.blockers,
      difficulty: dailyPuzzle.difficulty,
    });
  }, [dailyPuzzle, puzzleId, applyPuzzle]);

  useEffect(() => {
    const saved = readDailyProgress(dateKey, dailyPuzzle.id);
    setProgress(saved);
    hasRestoredRef.current = null;
    setEarlierMoves(0);
    setElapsedMs(0);
    if (!saved) {
      clearDailyProgress();
    }
  }, [dateKey, dailyPuzzle.id]);

  useEffect(() => {
    if (!progress) return;
    if (puzzleId !== dailyPuzzle.id) return;
    if (hasRestoredRef.current === dateKey) return;
    restoreState({
      placements: progress.placements,
      pieceStates: progress.pieceStates,
      blockers: dailyPuzzle.blockers,
      startedAt: progress.startedAt,
    });
    setEarlierMoves(progress.moveCount);
    const wasSolved = progress.placements.length === PIECES.length;
    setElapsedMs(progress.elapsedMs ?? (wasSolved ? null : 0));
    hasRestoredRef.current = dateKey;
  }, [progress, puzzleId, dailyPuzzle, dateKey, restoreState]);

  // Solve timer: runs from the first move until solved, only while visible.
  const timerRunning =
    puzzleId === dailyPuzzle.id && !solved && totalMoves > 0;
  useEffect(() => {
    if (!timerRunning) return;
    let lastTickAt = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        const since = lastTickAt;
        setElapsedMs((prev) => advanceElapsed(prev ?? 0, since, now));
      }
      lastTickAt = now;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") lastTickAt = Date.now();
    };
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Count the partial second up to the solving move.
      tick();
    };
  }, [timerRunning]);

  useEffect(() => {
    setStats((prev) => {
      const next = reconcileStats(prev, dateKey);
      writeDailyStats(next);
      return next;
    });
    setHasRecorded(false);
  }, [dateKey]);

  useEffect(() => {
    if (!solved || hasRecorded) return;
    setStats((prev) => {
      const next = recordDailySolve(prev, dateKey);
      if (!next) return reconcileStats(prev, dateKey);
      writeDailyStats(next);
      track("Daily Solved", {
        difficulty: dailyPuzzle.difficulty,
        streak: next.streak,
      });
      return next;
    });
    setHasRecorded(true);
  }, [solved, hasRecorded, dateKey, dailyPuzzle.difficulty]);

  useEffect(() => {
    if (puzzleId !== dailyPuzzle.id) return;
    // Don't overwrite saved progress with the empty board before it's restored.
    if (progress && hasRestoredRef.current !== dateKey) return;
    const placements = PIECES.reduce<Placement[]>((acc, piece) => {
      const placement = board.placements[piece.id];
      if (placement) acc.push(placement);
      return acc;
    }, []);
    writeDailyProgress({
      dateKey,
      puzzleId,
      placements,
      pieceStates,
      startedAt,
      moveCount: totalMoves,
      elapsedMs,
    });
  }, [
    board,
    pieceStates,
    startedAt,
    totalMoves,
    elapsedMs,
    progress,
    puzzleId,
    dailyPuzzle.id,
    dateKey,
  ]);

  const statusLabel =
    stats.lastCompletedDateKey === dateKey ? "Completed" : "Not yet solved";
  const statsPanel = (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Streak</span>
        <span className="stat-value">{stats.streak}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Status</span>
        <span className="stat-value">{statusLabel}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Difficulty</span>
        <span className="badge">{dailyPuzzle.difficulty}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Date</span>
        <span className="stat-value">{dateKey}</span>
      </div>
    </div>
  );

  const handleShare = async () => {
    if (!puzzleId) return;
    track("Share", { mode: "daily" });
    const baseUrl = `${window.location.origin}${BASE_PATH}`;
    const messageText = solved
      ? dailyShareMessage(totalMoves, elapsedMs)
      : "Play today's Blocker Rush challenge";
    const text = buildShareText(puzzleId, board.placements, baseUrl, {
      messageText,
      revealPieceCount: 3,
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

  return (
    <DailyFrame
      statsPanel={statsPanel}
      contextStrip={
        <>
          <time dateTime={dateKey}>
            {date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
          <span className="context-difficulty">{dailyPuzzle.difficulty}</span>
          <span>{stats.streak}-day streak</span>
          {elapsedMs !== null && (
            <span className="context-timer" aria-label="Solve time">
              {formatDuration(elapsedMs)}
            </span>
          )}
        </>
      }
    >
      {solved && (
        <>
          <div className="notice" role="status">
            Completed in {describeSolve(totalMoves, elapsedMs)}.
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
              Play Casual
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => router.push("/multiplayer")}
            >
              Play Multiplayer
            </button>
          </div>
        </>
      )}
      {shareStatus && (
        <div className="notice" role="status">
          {shareStatus}
        </div>
      )}
    </DailyFrame>
  );
}

/** Page chrome shared by the real daily layout and the pre-mount shell. */
function DailyFrame({
  statsPanel,
  contextStrip,
  children,
}: {
  statsPanel?: ReactNode;
  contextStrip?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="page game-page no-scroll-mobile">
      <GameHeader
        mode="daily"
        statsTitle="Daily Challenge"
        statsPanel={statsPanel}
        settingsPanel={
          <div className="settings-stack">
            <ThemeSelect />
          </div>
        }
      />
      <section className="game-layout">
        <div className="game-center puzzle-workspace">
          <div
            className="game-context-strip"
            aria-label="Daily challenge details"
          >
            <strong>Daily</strong>
            {contextStrip}
          </div>
          <GameBoard />
          <PiecesTray />
          {children}
        </div>
      </section>
    </main>
  );
}

export default function DailyGame() {
  // Unknown until mount. This page is prerendered at build time, so the
  // server can't know the visitor's date, and their streak lives in
  // localStorage; rendering either during hydration mismatches the HTML and
  // makes React discard it and re-render the whole page.
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    if (!today) {
      setToday(new Date());
      return;
    }
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 50);
    const timeout = window.setTimeout(
      () => setToday(new Date()),
      Math.max(0, nextMidnight.getTime() - now.getTime()),
    );
    return () => window.clearTimeout(timeout);
  }, [today]);

  return (
    <GameProvider lockOnSolve>
      {today ? <DailyGameLayout date={today} /> : <DailyFrame />}
    </GameProvider>
  );
}
