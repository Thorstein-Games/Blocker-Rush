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

export const dailyShareMessage = (
  moves: number,
  elapsedMs: number | null,
  /** e.g. "Oct 6" for an archive puzzle; omitted for today's. */
  dayLabel?: string,
  hints = 0,
): string =>
  `I solved ${dayLabel ? `the ${dayLabel} daily` : "today's"} Blocker Rush in ${describeSolve(moves, elapsedMs, hints)}! Can you beat that?`;
