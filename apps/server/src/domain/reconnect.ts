import type { InternalPlayerState } from "./types";

export const canPlayerRejoin = (
  player: InternalPlayerState,
  resumeToken: string | undefined,
  nowMs: number,
): boolean => {
  if (!resumeToken) return false;
  if (player.resumeToken !== resumeToken) return false;
  if (!player.graceExpiresAt) return false;
  return player.graceExpiresAt >= nowMs;
};
