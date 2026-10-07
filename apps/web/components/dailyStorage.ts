import type { Placement, PieceId } from "@blocker-rush/shared";
import type { PieceState } from "./gameTypes";
import type { DailyStats } from "./dailyStats";
import { type SolveHistory, parseSolveHistory } from "./dailyArchive";

// localStorage persistence for the daily puzzle and its archive. Every
// accessor tolerates missing, malformed or unavailable storage.

const DAILY_STATS_KEY = "blockerRush.daily.stats";
const DAILY_PROGRESS_KEY = "blockerRush.daily.progress";
const SOLVE_HISTORY_KEY = "blockerRush.daily.history";
const ARCHIVE_PROGRESS_PREFIX = "blockerRush.archive.progress.";

export type DailyProgress = {
  dateKey: string;
  puzzleId: string;
  placements: Placement[];
  pieceStates: Record<PieceId, PieceState>;
  startedAt: number | null;
  /** Moves across every visit, not just since the last page load. */
  moveCount: number;
  /**
   * Visible solving time. Missing (null) on progress saved before the timer
   * existed, which only matters for an already-solved board.
   */
  elapsedMs: number | null;
  /** Hints shown so far (0 on progress saved before hints existed). */
  hintsUsed: number;
};

/**
 * Today's puzzle keeps one progress entry that the next day overwrites;
 * each archive day keeps its own so switching between them loses nothing.
 */
export const progressKeyFor = (dateKey: string, archive: boolean): string =>
  archive ? `${ARCHIVE_PROGRESS_PREFIX}${dateKey}` : DAILY_PROGRESS_KEY;

const readJson = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; progress just won't persist.
  }
};

export const readDailyStats = (): DailyStats => {
  if (typeof window === "undefined") return { streak: 0 };
  const parsed = readJson(DAILY_STATS_KEY) as Partial<DailyStats> | null;
  return {
    streak: typeof parsed?.streak === "number" ? parsed.streak : 0,
    lastCompletedDateKey: parsed?.lastCompletedDateKey,
  };
};

export const writeDailyStats = (stats: DailyStats) => {
  if (typeof window === "undefined") return;
  writeJson(DAILY_STATS_KEY, stats);
};

export const readDailyProgress = (
  key: string,
  dateKey: string,
  puzzleId: string,
): DailyProgress | null => {
  if (typeof window === "undefined") return null;
  const parsed = readJson(key) as DailyProgress | null;
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
    hintsUsed: typeof parsed.hintsUsed === "number" ? parsed.hintsUsed : 0,
  };
};

export const writeDailyProgress = (key: string, progress: DailyProgress) => {
  if (typeof window === "undefined") return;
  writeJson(key, progress);
};

export const clearDailyProgress = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
};

export const readSolveHistory = (): SolveHistory => {
  if (typeof window === "undefined") return {};
  return parseSolveHistory(readJson(SOLVE_HISTORY_KEY));
};

export const writeSolveHistory = (history: SolveHistory) => {
  if (typeof window === "undefined") return;
  writeJson(SOLVE_HISTORY_KEY, history);
};
