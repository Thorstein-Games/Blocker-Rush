// Pure helpers for the daily puzzle's solve timer and move count. The timer
// counts only time the page is open and visible, starting at the first move,
// so leaving the tab overnight doesn't turn a two-minute solve into ten hours.

/**
 * Longest gap a single tick may add. Intervals in background tabs get
 * throttled and a sleeping laptop fires one late tick on wake; neither
 * should count as solving time.
 */
export const MAX_TICK_MS = 5_000;

export const advanceElapsed = (
  elapsedMs: number,
  lastTickAt: number,
  now: number,
): number => elapsedMs + Math.min(Math.max(0, now - lastTickAt), MAX_TICK_MS);

/** "0:07", "12:34", or "1:02:03" past an hour. */
export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
};

export const formatMoves = (moves: number): string =>
  `${moves} ${moves === 1 ? "move" : "moves"}`;

export const formatHints = (hints: number): string =>
  `${hints} ${hints === 1 ? "hint" : "hints"}`;

/**
 * "1:43 with 12 moves", plus " and 2 hints" when hints were used, or just
 * "12 moves" when the time is unknown (a solve saved before the timer
 * existed).
 */
export const describeSolve = (
  moves: number,
  elapsedMs: number | null,
  hints = 0,
): string => {
  const counts =
    hints > 0 ? `${formatMoves(moves)} and ${formatHints(hints)}` : formatMoves(moves);
  return elapsedMs === null ? counts : `${formatDuration(elapsedMs)} with ${counts}`;
};

export type DailyShareResult = {
  /** e.g. "Oct 8". */
  dayLabel: string;
  difficulty: string;
  moves: number;
  elapsedMs: number | null;
  hints: number;
  /** The current streak; null for archive puzzles, which don't count. */
  streak: number | null;
  /** That day's puzzle page, so friends get the same board on any day. */
  url: string;
};

/**
 * The text the Share button sends after solving a daily puzzle:
 *
 *   Blocker Rush · Oct 8 · Medium
 *   ⏱️ 1:43 · 12 moves · 💡 1 hint
 *   🔥 5-day streak
 *   https://thorsteingames.com/blocker-rush/daily/2026-10-08
 */
export const dailyShareText = (result: DailyShareResult): string => {
  const difficulty = result.difficulty.charAt(0).toUpperCase() + result.difficulty.slice(1);
  const counts = [
    ...(result.elapsedMs === null ? [] : [`⏱️ ${formatDuration(result.elapsedMs)}`]),
    formatMoves(result.moves),
    ...(result.hints > 0 ? [`💡 ${formatHints(result.hints)}`] : []),
  ];
  return [
    `Blocker Rush · ${result.dayLabel} · ${difficulty}`,
    counts.join(" · "),
    ...(result.streak ? [`🔥 ${result.streak}-day streak`] : []),
    result.url,
  ].join("\n");
};
