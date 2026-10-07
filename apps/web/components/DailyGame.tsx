"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Placement } from "@blocker-rush/shared";
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
import ThemeSelect from "./ThemeSelect";
import { track } from "../lib/analytics";
import { BASE_PATH } from "../lib/basePath";
import {
  type DailyStats,
  parseDateKey,
  reconcileStats,
  recordDailySolve,
} from "./dailyStats";
import {
  advanceElapsed,
  dailyShareMessage,
  describeSolve,
  formatDuration,
} from "./dailyTimer";
import { type SolveHistory, archiveDayStatus, recordSolve } from "./dailyArchive";
import { useHint } from "./useHint";
import {
  type DailyProgress,
  clearDailyProgress,
  progressKeyFor,
  readDailyProgress,
  readDailyStats,
  readSolveHistory,
  writeDailyProgress,
  writeDailyStats,
  writeSolveHistory,
} from "./dailyStorage";

const shortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Plays the daily puzzle for `date`. Today's puzzle (`archive` false) keeps
 * the streak; an archive puzzle has its own saved progress and timer but
 * never touches the streak.
 */
function DailyGameLayout({ date, archive }: { date: Date; archive: boolean }) {
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
  const progressKey = progressKeyFor(dateKey, archive);
  const [stats, setStats] = useState<DailyStats>(() =>
    reconcileStats(readDailyStats(), dateKey),
  );
  const [history, setHistory] = useState<SolveHistory>(readSolveHistory);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  // GameContext counts moves since the board was last loaded; add the moves
  // from earlier visits so a reload doesn't reset the count.
  const [earlierMoves, setEarlierMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const { hintMessage, hintPlacement, requestHint } = useHint();
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
    const saved = readDailyProgress(progressKey, dateKey, dailyPuzzle.id);
    setProgress(saved);
    hasRestoredRef.current = null;
    setEarlierMoves(0);
    setElapsedMs(0);
    setHintsUsed(0);
    if (!saved) {
      clearDailyProgress(progressKey);
    }
  }, [progressKey, dateKey, dailyPuzzle.id]);

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
    setHintsUsed(progress.hintsUsed);
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
    if (archive) return;
    setStats((prev) => {
      const next = reconcileStats(prev, dateKey);
      writeDailyStats(next);
      return next;
    });
    setHasRecorded(false);
  }, [archive, dateKey]);

  useEffect(() => {
    if (archive || !solved || hasRecorded) return;
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
  }, [archive, solved, hasRecorded, dateKey, dailyPuzzle.difficulty]);

  // The archive list's ✓ and times. Re-runs once more after solving, when
  // the timer's final partial second lands.
  useEffect(() => {
    if (!solved || puzzleId !== dailyPuzzle.id) return;
    const record = { moves: totalMoves, elapsedMs };
    const next = recordSolve(history, dateKey, record);
    if (next === history) return;
    if (archive && !history[dateKey]) {
      track("Archive Solved", { difficulty: dailyPuzzle.difficulty });
    }
    // Merge into a fresh read so a solve saved in another tab isn't dropped.
    writeSolveHistory(recordSolve(readSolveHistory(), dateKey, record));
    setHistory(next);
  }, [
    history,
    solved,
    puzzleId,
    dailyPuzzle.id,
    dailyPuzzle.difficulty,
    dateKey,
    totalMoves,
    elapsedMs,
    archive,
  ]);

  useEffect(() => {
    if (puzzleId !== dailyPuzzle.id) return;
    // Don't overwrite saved progress with the empty board before it's restored.
    if (progress && hasRestoredRef.current !== dateKey) return;
    const placements = PIECES.reduce<Placement[]>((acc, piece) => {
      const placement = board.placements[piece.id];
      if (placement) acc.push(placement);
      return acc;
    }, []);
    writeDailyProgress(progressKey, {
      dateKey,
      puzzleId,
      placements,
      pieceStates,
      startedAt,
      moveCount: totalMoves,
      elapsedMs,
      hintsUsed,
    });
  }, [
    hintsUsed,
    board,
    pieceStates,
    startedAt,
    totalMoves,
    elapsedMs,
    progress,
    progressKey,
    puzzleId,
    dailyPuzzle.id,
    dateKey,
  ]);

  const completed = archive
    ? solved || Boolean(history[dateKey])
    : stats.lastCompletedDateKey === dateKey;
  const statsPanel = (
    <div className="stats-grid">
      {!archive && (
        <div className="stat-card">
          <span className="stat-label">Streak</span>
          <span className="stat-value">{stats.streak}</span>
        </div>
      )}
      <div className="stat-card">
        <span className="stat-label">Status</span>
        <span className="stat-value">
          {completed ? "Completed" : "Not yet solved"}
        </span>
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
    track("Share", { mode: archive ? "archive" : "daily" });
    const baseUrl = `${window.location.origin}${BASE_PATH}`;
    let text: string;
    if (archive) {
      text = [
        solved
          ? dailyShareMessage(totalMoves, elapsedMs, shortDate(date), hintsUsed)
          : `Play the ${shortDate(date)} Blocker Rush daily puzzle`,
        `${baseUrl}/daily/${dateKey}`,
      ].join("\n");
    } else {
      text = buildShareText(puzzleId, board.placements, baseUrl, {
        messageText: solved
          ? dailyShareMessage(totalMoves, elapsedMs, undefined, hintsUsed)
          : "Play today's Blocker Rush challenge",
        revealPieceCount: 3,
      });
    }
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

  const handleHint = () => {
    if (!requestHint()) return;
    setHintsUsed((count) => count + 1);
    track("Hint", { mode: archive ? "archive" : "daily" });
  };

  return (
    <DailyFrame
      label={archive ? "Archive" : "Daily"}
      statsPanel={statsPanel}
      onHint={handleHint}
      hintPlacement={hintPlacement}
      contextStrip={
        <>
          <time dateTime={dateKey}>{shortDate(date)}</time>
          <span className="context-difficulty">{dailyPuzzle.difficulty}</span>
          {!archive && <span>{stats.streak}-day streak</span>}
          {elapsedMs !== null && (
            <span className="context-timer" aria-label="Solve time">
              {formatDuration(elapsedMs)}
            </span>
          )}
        </>
      }
    >
      {hintMessage && !solved && (
        <div className="notice" role="status">
          {hintMessage}
        </div>
      )}
      {solved && (
        <>
          <div className="notice" role="status">
            Completed in {describeSolve(totalMoves, elapsedMs, hintsUsed)}.
          </div>
          <div className="settings-actions">
            <button className="button" type="button" onClick={handleShare}>
              Share
            </button>
            {archive && (
              <button
                className="button secondary"
                type="button"
                onClick={() => router.push("/")}
              >
                Today&apos;s Puzzle
              </button>
            )}
            <button
              className="button secondary"
              type="button"
              onClick={() => router.push("/daily")}
            >
              {archive ? "More Past Puzzles" : "Past Puzzles"}
            </button>
            {!archive && (
              <>
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
              </>
            )}
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
  label = "Daily",
  statsPanel,
  contextStrip,
  showBoard = true,
  onHint,
  hintPlacement,
  children,
}: {
  label?: string;
  onHint?: () => void;
  hintPlacement?: Placement | null;
  statsPanel?: ReactNode;
  contextStrip?: ReactNode;
  showBoard?: boolean;
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
            <strong>{label}</strong>
            {contextStrip}
          </div>
          {showBoard && (
            <>
              <GameBoard hintPlacement={hintPlacement} />
              <PiecesTray onHint={onHint} />
            </>
          )}
          {children}
        </div>
      </section>
    </main>
  );
}

/** An archive date that isn't playable yet: today's lives at "/". */
function ArchiveGate({
  dateKey,
  status,
}: {
  dateKey: string;
  status: "today" | "future";
}) {
  const router = useRouter();
  useEffect(() => {
    if (status === "today") router.replace("/");
  }, [status, router]);
  if (status === "today") return <DailyFrame label="Archive" />;
  return (
    <DailyFrame label="Archive" showBoard={false}>
      <div className="notice" role="status">
        The puzzle for{" "}
        {parseDateKey(dateKey).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}{" "}
        isn&apos;t out yet. <Link href="/">Play today&apos;s puzzle</Link>
      </div>
    </DailyFrame>
  );
}

/**
 * Today's daily puzzle, or with `archiveDateKey` (a validated YYYY-MM-DD),
 * that day's puzzle from the archive.
 */
export default function DailyGame({
  archiveDateKey,
}: {
  archiveDateKey?: string;
}) {
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

  let content: ReactNode;
  if (!today) {
    content = <DailyFrame label={archiveDateKey ? "Archive" : "Daily"} />;
  } else if (!archiveDateKey) {
    content = <DailyGameLayout date={today} archive={false} />;
  } else {
    const status = archiveDayStatus(archiveDateKey, getDateKey(today));
    content =
      status === "past" ? (
        <DailyGameLayout date={parseDateKey(archiveDateKey)} archive />
      ) : (
        <ArchiveGate dateKey={archiveDateKey} status={status} />
      );
  }

  return <GameProvider lockOnSolve>{content}</GameProvider>;
}
