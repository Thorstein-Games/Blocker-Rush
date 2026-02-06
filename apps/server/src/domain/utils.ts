import { randomBytes } from "node:crypto";
import type { Difficulty } from "@blocker-rush/shared";
import {
  DEFAULT_LOCK_IN_MS,
  MATCH_COUNTDOWN_MS,
  type MatchSettings,
} from "@blocker-rush/protocol";

export const now = (): number => Date.now();

export const createId = (prefix: string): string =>
  `${prefix}_${randomBytes(5).toString("hex")}`;

export const createRoomCode = (): string =>
  randomBytes(3)
    .toString("hex")
    .toUpperCase();

export const defaultDifficultiesForRounds = (rounds: number): Difficulty[] => {
  if (rounds <= 1) return ["easy"];
  if (rounds === 2) return ["easy", "medium"];
  return ["easy", "medium", "hard"];
};

export const normalizeSettings = (
  maybeSettings?: Partial<MatchSettings>,
): MatchSettings => {
  const rounds = Math.min(3, Math.max(1, maybeSettings?.rounds ?? 1));
  const difficulties =
    maybeSettings?.difficulties &&
    maybeSettings.difficulties.length === rounds
      ? maybeSettings.difficulties
      : defaultDifficultiesForRounds(rounds);

  return {
    rounds,
    difficulties,
    advanceMode: "solo",
    lockInMs: maybeSettings?.lockInMs ?? DEFAULT_LOCK_IN_MS,
  };
};

export const clampLockInMs = (value: number): number =>
  Math.min(30_000, Math.max(10_000, value));

export const countdownMs = MATCH_COUNTDOWN_MS;
