"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDailyDifficulty, getDateKey } from "@blocker-rush/shared";
import GameHeader from "./GameHeader";
import ThemeSelect from "./ThemeSelect";
import { type DailyStats, parseDateKey, reconcileStats } from "./dailyStats";
import DailyStatsPanel from "./DailyStatsPanel";
import { formatDuration } from "./dailyTimer";
import { type SolveHistory, archiveDateKeys } from "./dailyArchive";
import { readDailyStats, readSolveHistory } from "./dailyStorage";

type ArchiveState = {
  todayKey: string;
  history: SolveHistory;
  stats: DailyStats;
};

const groupByMonth = (keys: string[]) => {
  const months: Array<{ label: string; keys: string[] }> = [];
  for (const key of keys) {
    const label = parseDateKey(key).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const last = months[months.length - 1];
    if (last?.label === label) last.keys.push(key);
    else months.push({ label, keys: [key] });
  }
  return months;
};

/** Every daily puzzle to date, newest first, with the player's solves. */
export default function DailyArchive() {
  // The visitor's date and solves are only known after mount (see DailyGame).
  const [state, setState] = useState<ArchiveState | null>(null);

  useEffect(() => {
    setState({
      todayKey: getDateKey(new Date()),
      history: readSolveHistory(),
      stats: reconcileStats(readDailyStats(), getDateKey(new Date())),
    });
  }, []);

  const keys = state ? archiveDateKeys(state.todayKey) : [];
  const isSolved = (key: string) =>
    // lastCompletedDateKey covers a solve from before history was recorded.
    Boolean(state?.history[key]) || state?.stats.lastCompletedDateKey === key;
  const solvedCount = keys.filter(isSolved).length;

  return (
    <main className="page archive-page">
      <GameHeader
        mode="daily"
        statsTitle="Daily Stats"
        statsPanel={
          state ? <DailyStatsPanel stats={state.stats} history={state.history} /> : undefined
        }
        settingsPanel={
          <div className="settings-stack">
            <ThemeSelect />
          </div>
        }
      />
      <section className="archive" aria-labelledby="archive-heading">
        <h2 id="archive-heading">Past daily puzzles</h2>
        {!state ? (
          <p className="archive-summary">Loading puzzles…</p>
        ) : (
          <>
            <p className="archive-summary">
              Solved {solvedCount} of {keys.length}. Past puzzles don&apos;t
              affect your streak.
            </p>
            {groupByMonth(keys).map((month) => (
              <section key={month.label} className="archive-month">
                <h3>{month.label}</h3>
                <ul className="archive-list">
                  {month.keys.map((key) => {
                    const date = parseDateKey(key);
                    const record = state.history[key];
                    const isToday = key === state.todayKey;
                    return (
                      <li key={key}>
                        <Link
                          href={isToday ? "/" : `/daily/${key}`}
                          className={isSolved(key) ? "archive-day solved" : "archive-day"}
                        >
                          <time dateTime={key}>
                            {isToday
                              ? "Today"
                              : date.toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                          </time>
                          <span className="badge">{getDailyDifficulty(date)}</span>
                          <span className="archive-status">
                            {isSolved(key)
                              ? `✓${record?.elapsedMs != null ? ` ${formatDuration(record.elapsedMs)}` : ""}`
                              : ""}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </section>
    </main>
  );
}
