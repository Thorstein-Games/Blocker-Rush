import { getDateKey } from "@blocker-rush/shared";

// Pure streak bookkeeping for the daily puzzle. Date keys are local
// "YYYY-MM-DD" strings from getDateKey, so "yesterday" is a calendar day,
// not 24 hours (which would break across DST changes).

export type DailyStats = {
  streak: number;
  lastCompletedDateKey?: string;
};

export const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

export const getYesterdayKey = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - 1);
  return getDateKey(date);
};

/** Drops the streak if the last solve was before yesterday. */
export const reconcileStats = (stats: DailyStats, dateKey: string): DailyStats => {
  if (!stats.lastCompletedDateKey) {
    return { ...stats, streak: 0 };
  }
  if (stats.lastCompletedDateKey === dateKey) {
    return stats;
  }
  if (stats.lastCompletedDateKey === getYesterdayKey(dateKey)) {
    return stats;
  }
  return { ...stats, streak: 0 };
};

/**
 * Stats after solving the puzzle for dateKey. Returns null if that day was
 * already recorded (e.g. the solved board was restored on reload).
 */
export const recordDailySolve = (
  stats: DailyStats,
  dateKey: string,
): DailyStats | null => {
  const base = reconcileStats(stats, dateKey);
  if (base.lastCompletedDateKey === dateKey) return null;
  const continues = base.lastCompletedDateKey === getYesterdayKey(dateKey);
  return {
    ...base,
    streak: continues ? base.streak + 1 : 1,
    lastCompletedDateKey: dateKey,
  };
};
