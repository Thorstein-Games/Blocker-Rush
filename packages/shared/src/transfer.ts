// Moving daily progress (streak, best streak, solve history) between
// devices without a server: the progress is packed into a short string
// that travels in a link's #fragment (/transfer#p=…), which browsers never
// send to a server. The receiving device merges it with its own progress.
//
// Client-only; not mirrored to megingjord.

export type ProgressStats = {
  streak: number;
  /** Local date key (YYYY-MM-DD) of the last daily solved on its own day. */
  lastCompletedDateKey?: string;
  bestStreak?: number;
};

export type ProgressSolve = {
  moves: number;
  elapsedMs: number | null;
  hints: number;
};

export type ProgressData = {
  stats: ProgressStats;
  /** Solved days by date key, today's and archive puzzles alike. */
  history: Record<string, ProgressSolve>;
};

/** Upper bound on history in a transfer (~13 years of daily puzzles). */
export const MAX_TRANSFER_HISTORY = 5000;

// Calendar-day arithmetic on date keys, in UTC so it's the same in every
// time zone (keys are already local calendar days).
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const dayNumber = (dateKey: string): number | null => {
  const match = DATE_KEY.exec(dateKey);
  if (!match) return null;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  // Rejects 2026-02-30 and friends.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return ms / 86_400_000;
};

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1_000_000;

/**
 * Validates untrusted progress data (a decoded transfer link), dropping
 * malformed history entries. Returns null if the shape is wrong outright.
 */
export const parseProgressData = (value: unknown): ProgressData | null => {
  if (!value || typeof value !== "object") return null;
  const { stats, history } = value as { stats?: unknown; history?: unknown };
  if (!stats || typeof stats !== "object" || !history || typeof history !== "object") {
    return null;
  }
  const { streak, lastCompletedDateKey, bestStreak } = stats as Record<string, unknown>;
  if (!isCount(streak)) return null;
  const parsedStats: ProgressStats = { streak };
  if (typeof lastCompletedDateKey === "string" && dayNumber(lastCompletedDateKey) !== null) {
    parsedStats.lastCompletedDateKey = lastCompletedDateKey;
  }
  if (isCount(bestStreak)) parsedStats.bestStreak = bestStreak;

  const entries = Object.entries(history);
  if (entries.length > MAX_TRANSFER_HISTORY) return null;
  const parsedHistory: Record<string, ProgressSolve> = {};
  for (const [key, record] of entries) {
    if (dayNumber(key) === null || !record || typeof record !== "object") continue;
    const { moves, elapsedMs, hints } = record as Record<string, unknown>;
    if (!isCount(moves)) continue;
    parsedHistory[key] = {
      moves,
      elapsedMs: typeof elapsedMs === "number" && elapsedMs >= 0 && Number.isFinite(elapsedMs)
        ? elapsedMs
        : null,
      hints: isCount(hints) ? hints : 0,
    };
  }
  return { stats: parsedStats, history: parsedHistory };
};

/**
 * The record to keep when both devices solved the same day: a timed solve
 * over an untimed one, then fewer hints, then faster, then fewer moves.
 * Order-independent, so merging is commutative.
 */
const betterSolve = (a: ProgressSolve, b: ProgressSolve): ProgressSolve => {
  if ((a.elapsedMs === null) !== (b.elapsedMs === null)) return a.elapsedMs === null ? b : a;
  if (a.hints !== b.hints) return a.hints < b.hints ? a : b;
  if (a.elapsedMs !== b.elapsedMs) return (a.elapsedMs ?? 0) < (b.elapsedMs ?? 0) ? a : b;
  return a.moves <= b.moves ? a : b;
};

const bestOf = (stats: ProgressStats) => Math.max(stats.bestStreak ?? 0, stats.streak);

/**
 * Combines two devices' streaks. A streak is a run of consecutive days
 * ending at lastCompletedDateKey; runs that overlap or touch join into one
 * (solving Monday on a phone and Tuesday on a laptop is a 2-day streak).
 */
const mergeStats = (a: ProgressStats, b: ProgressStats): ProgressStats => {
  const aEnd = a.lastCompletedDateKey ? dayNumber(a.lastCompletedDateKey) : null;
  const bEnd = b.lastCompletedDateKey ? dayNumber(b.lastCompletedDateKey) : null;
  const best = Math.max(bestOf(a), bestOf(b));
  const aActive = aEnd !== null && a.streak > 0;
  const bActive = bEnd !== null && b.streak > 0;
  if (!aActive || !bActive) {
    if (aActive) return { ...a, bestStreak: best };
    if (bActive) return { ...b, bestStreak: best };
    const keys = [a.lastCompletedDateKey, b.lastCompletedDateKey].filter(
      (key): key is string => Boolean(key),
    );
    const last = keys.sort().pop();
    return { streak: 0, ...(last ? { lastCompletedDateKey: last } : {}), bestStreak: best };
  }

  const [later, laterEnd, earlier, earlierEnd] =
    aEnd! >= bEnd! ? [a, aEnd!, b, bEnd!] : [b, bEnd!, a, aEnd!];
  const laterStart = laterEnd - later.streak + 1;
  const earlierStart = earlierEnd - earlier.streak + 1;
  const streak =
    earlierEnd >= laterStart - 1
      ? laterEnd - Math.min(laterStart, earlierStart) + 1
      : later.streak;
  return {
    streak,
    lastCompletedDateKey: later.lastCompletedDateKey,
    bestStreak: Math.max(best, streak),
  };
};

export const mergeProgressData = (a: ProgressData, b: ProgressData): ProgressData => {
  const history: Record<string, ProgressSolve> = { ...a.history };
  for (const [key, record] of Object.entries(b.history)) {
    const existing = history[key];
    history[key] = existing ? betterSolve(existing, record) : record;
  }
  return { stats: mergeStats(a.stats, b.stats), history };
};

export const emptyProgressData = (): ProgressData => ({ stats: { streak: 0 }, history: {} });

// --- Transfer encoding -----------------------------------------------------
//
// Binary, then base64url. Unsigned varints throughout:
//   version (1)
//   streak, bestStreak, lastCompletedDateKey (0 = none, else day + 1)
//   history count, then per day in date order:
//     days since the previous entry (the first: days since 2020-01-01),
//     moves, elapsed (0 = unknown, else tenths of a second + 1), hints
// About 5 bytes per solved day, so a year of play is ~2.5KB of link.

const TRANSFER_VERSION = 1;
const EPOCH_DAY = Date.UTC(2020, 0, 1) / 86_400_000;

const dateKeyFor = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10);

const writeVarint = (bytes: number[], value: number) => {
  let rest = Math.max(0, Math.floor(value));
  while (rest >= 0x80) {
    bytes.push((rest % 0x80) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  bytes.push(rest);
};

const toBase64Url = (bytes: number[]): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (text: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

/** Packs progress into a URL-safe string. Days before 2020 are dropped. */
export const encodeTransfer = (data: ProgressData): string => {
  const bytes: number[] = [TRANSFER_VERSION];
  const { stats } = data;
  writeVarint(bytes, stats.streak);
  writeVarint(bytes, stats.bestStreak ?? 0);
  const last = stats.lastCompletedDateKey ? dayNumber(stats.lastCompletedDateKey) : null;
  writeVarint(bytes, last === null || last < EPOCH_DAY ? 0 : last - EPOCH_DAY + 1);

  const days = Object.entries(data.history)
    .map(([key, record]) => [dayNumber(key), record] as const)
    .filter((entry): entry is readonly [number, ProgressSolve] => entry[0] !== null && entry[0] >= EPOCH_DAY)
    .sort((a, b) => a[0] - b[0]);
  writeVarint(bytes, days.length);
  let previous = EPOCH_DAY;
  for (const [day, record] of days) {
    writeVarint(bytes, day - previous);
    previous = day;
    writeVarint(bytes, record.moves);
    writeVarint(bytes, record.elapsedMs === null ? 0 : Math.round(record.elapsedMs / 100) + 1);
    writeVarint(bytes, record.hints);
  }
  return toBase64Url(bytes);
};

/**
 * Unpacks a transfer string, or the transfer link containing one. Returns
 * null for anything damaged or truncated.
 */
export const decodeTransfer = (input: string): ProgressData | null => {
  const trimmed = input.trim();
  const fromLink = /[#&?]p=([A-Za-z0-9_-]+)/.exec(trimmed);
  const bytes = fromBase64Url(fromLink ? fromLink[1]! : trimmed);
  if (!bytes || bytes[0] !== TRANSFER_VERSION) return null;

  let offset = 1;
  const read = (): number => {
    let value = 0;
    let scale = 1;
    for (;;) {
      if (offset >= bytes.length || scale > 2 ** 42) throw new Error("truncated");
      const byte = bytes[offset++]!;
      value += (byte & 0x7f) * scale;
      if (byte < 0x80) return value;
      scale *= 0x80;
    }
  };

  try {
    const streak = read();
    const bestStreak = read();
    const last = read();
    const count = read();
    if (count > MAX_TRANSFER_HISTORY) return null;
    const history: Record<string, unknown> = {};
    let day = EPOCH_DAY;
    for (let i = 0; i < count; i += 1) {
      day += read();
      const moves = read();
      const elapsed = read();
      const hints = read();
      history[dateKeyFor(day)] = {
        moves,
        elapsedMs: elapsed === 0 ? null : (elapsed - 1) * 100,
        hints,
      };
    }
    if (offset !== bytes.length) return null;
    return parseProgressData({
      stats: {
        streak,
        ...(bestStreak > 0 ? { bestStreak } : {}),
        ...(last > 0 ? { lastCompletedDateKey: dateKeyFor(EPOCH_DAY + last - 1) } : {}),
      },
      history,
    });
  } catch {
    return null;
  }
};
