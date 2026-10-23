// Cloud saves for signed-in players: daily stats and solve history follow
// them to every device. Accounts are run by the shared Thorstein Games bar
// (thorsteingames.com/tg-bar.js, see that repo's CLAUDE.md), which exposes
// window.TG; this registers Blocker Rush with it. Without the bar (tests,
// offline) or signed out, nothing happens.
import {
  type ProgressData,
  emptyProgressData,
  mergeProgressData,
  parseProgressData,
} from "@blocker-rush/shared";
import {
  DAILY_STATS_KEY,
  SOLVE_HISTORY_KEY,
  setProgressWriteHook,
} from "../components/dailyStorage";

/** Fired on window when another device's progress has been merged in. */
export const PROGRESS_SYNCED_EVENT = "blockerRush:progress-synced";

export const SYNC_KEYS = [DAILY_STATS_KEY, SOLVE_HISTORY_KEY];

type Save = Record<string, unknown>;

const toProgress = (save: Save): ProgressData =>
  parseProgressData({
    stats: save[DAILY_STATS_KEY] ?? { streak: 0 },
    history: save[SOLVE_HISTORY_KEY] ?? {},
  }) ?? emptyProgressData();

/**
 * Combines this device's saved progress with the account's ({ localStorage
 * key: parsed value }), the same way a transfer link does: every solved day
 * (the better solve when both have it), streaks that touch joined up.
 */
export const mergeCloudSaves = (local: Save, remote: Save): Save => {
  const merged = mergeProgressData(toProgress(local), toProgress(remote));
  const out: Save = {};
  if (DAILY_STATS_KEY in local || DAILY_STATS_KEY in remote) out[DAILY_STATS_KEY] = merged.stats;
  if (SOLVE_HISTORY_KEY in local || SOLVE_HISTORY_KEY in remote) out[SOLVE_HISTORY_KEY] = merged.history;
  return out;
};

type TG = {
  sync(options: {
    game: string;
    keys: string[];
    merge: (local: Save, remote: Save) => Save;
    onUpdate?: () => void;
  }): { save(): void };
};

let started = false;

export const startCloudSync = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  const withTG = (fn: (tg: TG) => void) => {
    const tg = (window as unknown as { TG?: TG }).TG;
    if (tg) fn(tg);
    else window.addEventListener("tg:ready", () => withTG(fn), { once: true });
  };
  withTG((tg) => {
    const cloud = tg.sync({
      game: "blocker-rush",
      keys: SYNC_KEYS,
      merge: mergeCloudSaves,
      onUpdate: () => window.dispatchEvent(new Event(PROGRESS_SYNCED_EVENT)),
    });
    setProgressWriteHook(() => cloud.save());
  });
};
