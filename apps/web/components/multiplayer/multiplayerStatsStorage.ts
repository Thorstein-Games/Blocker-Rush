export const MULTIPLAYER_STATS_KEY = "blockerRush.multiplayer.stats";

type MultiplayerStatsRaw = {
  wins?: unknown;
  losses?: unknown;
  recordedMatchIds?: unknown;
};

export type MultiplayerStats = {
  wins: number;
  losses: number;
  recordedMatchIds: string[];
};

const DEFAULT_MULTIPLAYER_STATS: MultiplayerStats = {
  wins: 0,
  losses: 0,
  recordedMatchIds: [],
};

const sanitizeMatchIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
};

export const readMultiplayerStats = (): MultiplayerStats => {
  if (typeof window === "undefined") {
    return DEFAULT_MULTIPLAYER_STATS;
  }

  try {
    const raw = window.localStorage.getItem(MULTIPLAYER_STATS_KEY);
    if (!raw) return DEFAULT_MULTIPLAYER_STATS;

    const parsed = JSON.parse(raw) as MultiplayerStatsRaw;
    return {
      wins: typeof parsed.wins === "number" ? parsed.wins : 0,
      losses: typeof parsed.losses === "number" ? parsed.losses : 0,
      recordedMatchIds: sanitizeMatchIds(parsed.recordedMatchIds),
    };
  } catch {
    return DEFAULT_MULTIPLAYER_STATS;
  }
};

export const writeMultiplayerStats = (stats: MultiplayerStats) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MULTIPLAYER_STATS_KEY, JSON.stringify(stats));
};

export const recordMultiplayerResult = (
  current: MultiplayerStats,
  input: { matchId: string; didWin: boolean },
): MultiplayerStats => {
  if (!input.matchId || current.recordedMatchIds.includes(input.matchId)) {
    return current;
  }

  const nextRecordedMatchIds = [...current.recordedMatchIds, input.matchId].slice(
    -100,
  );

  return {
    wins: current.wins + (input.didWin ? 1 : 0),
    losses: current.losses + (input.didWin ? 0 : 1),
    recordedMatchIds: nextRecordedMatchIds,
  };
};

export const getMultiplayerRatio = (stats: MultiplayerStats): string => {
  const { wins, losses } = stats;
  if (wins === 0 && losses === 0) return "--";
  return `${wins}:${losses}`;
};
