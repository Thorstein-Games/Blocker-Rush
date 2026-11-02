import {
  type Difficulty,
  difficultyOptions,
  getDailyDifficulty,
  getDateKey,
} from "@blocker-rush/shared";
import { parseDateKey } from "./dailyStats";

// Pure helpers for the daily archive (/daily and /daily/YYYY-MM-DD). Date
// keys are local "YYYY-MM-DD" strings, compared as strings (they sort
// chronologically).

/** First day the archive lists; earlier dates 404. */
export const ARCHIVE_START_KEY = "2026-02-04";

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30 etc.). */
export const isValidDateKey = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && getDateKey(parseDateKey(value)) === value;

export const isArchiveDateKey = (value: string): boolean =>
  isValidDateKey(value) && value >= ARCHIVE_START_KEY;

export type ArchiveDayStatus = "past" | "today" | "future";

export const archiveDayStatus = (
  dateKey: string,
  todayKey: string,
): ArchiveDayStatus =>
  dateKey === todayKey ? "today" : dateKey < todayKey ? "past" : "future";

/** Every archive day up to and including today, newest first. */
export const archiveDateKeys = (todayKey: string): string[] => {
  const keys: string[] = [];
  const date = parseDateKey(todayKey);
  for (
    let key = todayKey;
    key >= ARCHIVE_START_KEY;
    date.setDate(date.getDate() - 1), key = getDateKey(date)
  ) {
    keys.push(key);
  }
  return keys;
};

export type SolveRecord = {
  moves: number;
  elapsedMs: number | null;
  /** 0 on records saved before hints were counted. */
  hints: number;
};

/** Solved days, keyed by date key. Covers both today's and archive solves. */
export type SolveHistory = Record<string, SolveRecord>;

export const recordSolve = (
  history: SolveHistory,
  dateKey: string,
  record: SolveRecord,
): SolveHistory => {
  const existing = history[dateKey];
  if (
    existing &&
    existing.moves === record.moves &&
    existing.elapsedMs === record.elapsedMs &&
    existing.hints === record.hints
  ) {
    return history;
  }
  return { ...history, [dateKey]: record };
};

/** Validates history read from localStorage, dropping malformed entries. */
export const parseSolveHistory = (value: unknown): SolveHistory => {
  if (!value || typeof value !== "object") return {};
  const history: SolveHistory = {};
  for (const [key, record] of Object.entries(value)) {
    if (!isValidDateKey(key) || !record || typeof record !== "object") continue;
    const { moves, elapsedMs, hints } = record as Partial<SolveRecord>;
    if (typeof moves !== "number") continue;
    history[key] = {
      moves,
      elapsedMs: typeof elapsedMs === "number" ? elapsedMs : null,
      hints: typeof hints === "number" ? hints : 0,
    };
  }
  return history;
};

export type DifficultySummary = {
  solved: number;
  /** Mean of solves with a recorded time; null if there are none. */
  averageMs: number | null;
  /** Fastest solve without hints; null if there are none. */
  bestMs: number | null;
};

export type HistorySummary = {
  solved: number;
  byDifficulty: Record<Difficulty, DifficultySummary>;
};

/**
 * Totals per daily difficulty (which follows the weekday, so it comes from
 * the date key). Covers today's and archive solves alike.
 */
export const summarizeHistory = (history: SolveHistory): HistorySummary => {
  const times = Object.fromEntries(
    difficultyOptions.map((difficulty) => [
      difficulty,
      { solved: 0, timed: [] as number[], unassisted: [] as number[] },
    ]),
  ) as Record<Difficulty, { solved: number; timed: number[]; unassisted: number[] }>;
  for (const [key, record] of Object.entries(history)) {
    const bucket = times[getDailyDifficulty(parseDateKey(key))];
    bucket.solved += 1;
    if (record.elapsedMs === null) continue;
    bucket.timed.push(record.elapsedMs);
    if (record.hints === 0) bucket.unassisted.push(record.elapsedMs);
  }
  const byDifficulty = Object.fromEntries(
    difficultyOptions.map((difficulty) => {
      const { solved, timed, unassisted } = times[difficulty];
      return [
        difficulty,
        {
          solved,
          averageMs: timed.length
            ? timed.reduce((sum, ms) => sum + ms, 0) / timed.length
            : null,
          bestMs: unassisted.length ? Math.min(...unassisted) : null,
        },
      ];
    }),
  ) as Record<Difficulty, DifficultySummary>;
  return { solved: Object.keys(history).length, byDifficulty };
};
