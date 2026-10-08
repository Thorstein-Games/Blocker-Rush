import type { ReactNode } from "react";
import { difficultyOptions } from "@blocker-rush/shared";
import { type DailyStats, getBestStreak } from "./dailyStats";
import { type SolveHistory, summarizeHistory } from "./dailyArchive";
import { formatDuration } from "./dailyTimer";

/**
 * The daily stats panel: streaks, total solves, and solve times per
 * difficulty across today's and archive puzzles. `children` adds cards about
 * the puzzle on screen (status, difficulty, date).
 */
export default function DailyStatsPanel({
  stats,
  history,
  children,
}: {
  stats: DailyStats;
  history: SolveHistory;
  children?: ReactNode;
}) {
  const summary = summarizeHistory(history);
  return (
    <div className="settings-stack">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Streak</span>
          <span className="stat-value">{stats.streak}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Best streak</span>
          <span className="stat-value">{getBestStreak(stats)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Solved</span>
          <span className="stat-value">{summary.solved}</span>
        </div>
        {children}
      </div>
      <table className="stats-table">
        <caption>Daily solve times</caption>
        <thead>
          <tr>
            <th scope="col">Difficulty</th>
            <th scope="col">Solved</th>
            <th scope="col">Average</th>
            <th scope="col">Best</th>
          </tr>
        </thead>
        <tbody>
          {difficultyOptions.map((difficulty) => {
            const row = summary.byDifficulty[difficulty];
            return (
              <tr key={difficulty}>
                <th scope="row">{difficulty}</th>
                <td>{row.solved}</td>
                <td>{row.averageMs === null ? "–" : formatDuration(row.averageMs)}</td>
                <td>{row.bestMs === null ? "–" : formatDuration(row.bestMs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="stats-note">
        Best times count solves without hints. Past puzzles count toward
        times but not streaks.
      </p>
    </div>
  );
}
