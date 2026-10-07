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

/**
 * "1:43 with 12 moves", or just "12 moves" when the time is unknown (a solve
 * saved before the timer existed).
 */
export const describeSolve = (moves: number, elapsedMs: number | null): string =>
  elapsedMs === null
    ? formatMoves(moves)
    : `${formatDuration(elapsedMs)} with ${formatMoves(moves)}`;

export const dailyShareMessage = (
  moves: number,
  elapsedMs: number | null,
): string =>
  `I solved today's Blocker Rush in ${describeSolve(moves, elapsedMs)}! Can you beat that?`;
