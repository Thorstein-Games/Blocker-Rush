"use client";

import { useEffect, useMemo, useState } from "react";
import { getDateKey, getDailyPuzzle } from "@blocker-rush/shared";
import GameBoard from "./GameBoard";
import PiecesTray from "./PiecesTray";
import { GameProvider, useGame } from "./GameContext";

const DAILY_STATS_KEY = "blockerRush.daily.stats";

type DailyStats = {
  streak: number;
  lastCompletedDateKey?: string;
};

const readDailyStats = (): DailyStats => {
  if (typeof window === "undefined") {
    return { streak: 0 };
  }
  try {
    const raw = window.localStorage.getItem(DAILY_STATS_KEY);
    if (!raw) return { streak: 0 };
    const parsed = JSON.parse(raw) as DailyStats;
    return {
      streak: typeof parsed.streak === "number" ? parsed.streak : 0,
      lastCompletedDateKey: parsed.lastCompletedDateKey,
    };
  } catch {
    return { streak: 0 };
  }
};

const writeDailyStats = (stats: DailyStats) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
};

const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

const getYesterdayKey = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - 1);
  return getDateKey(date);
};

const reconcileStats = (stats: DailyStats, dateKey: string): DailyStats => {
  if (!stats.lastCompletedDateKey) {
    return { ...stats, streak: 0 };
  }
  if (stats.lastCompletedDateKey === dateKey) {
    return stats;
  }
  const yesterdayKey = getYesterdayKey(dateKey);
  if (stats.lastCompletedDateKey === yesterdayKey) {
    return stats;
  }
  return { ...stats, streak: 0 };
};

function DailyGameLayout({ date }: { date: Date }) {
  const { solved, puzzleId, applyPuzzle } = useGame();
  const dateKey = getDateKey(date);
  const dailyPuzzle = useMemo(() => getDailyPuzzle(date), [dateKey]);
  const [stats, setStats] = useState<DailyStats>(() =>
    reconcileStats(readDailyStats(), dateKey),
  );
  const [hasRecorded, setHasRecorded] = useState(false);

  useEffect(() => {
    if (dailyPuzzle.id === puzzleId) return;
    applyPuzzle({
      id: dailyPuzzle.id,
      blockers: dailyPuzzle.blockers,
      difficulty: dailyPuzzle.difficulty,
    });
  }, [dailyPuzzle, puzzleId, applyPuzzle]);

  useEffect(() => {
    setStats((prev) => {
      const next = reconcileStats(prev, dateKey);
      writeDailyStats(next);
      return next;
    });
    setHasRecorded(false);
  }, [dateKey]);

  useEffect(() => {
    if (!solved || hasRecorded) return;
    setStats((prev) => {
      const base = reconcileStats(prev, dateKey);
      if (base.lastCompletedDateKey === dateKey) {
        return base;
      }
      const yesterdayKey = getYesterdayKey(dateKey);
      const nextStreak =
        base.lastCompletedDateKey === yesterdayKey ? base.streak + 1 : 1;
      const next = {
        ...base,
        streak: nextStreak,
        lastCompletedDateKey: dateKey,
      };
      writeDailyStats(next);
      return next;
    });
    setHasRecorded(true);
  }, [solved, hasRecorded, dateKey]);

  const statusLabel =
    stats.lastCompletedDateKey === dateKey
      ? "Completed"
      : "Not yet cleared";

  return (
    <main className="page">
      <section className="casual-layout">
        <div className="panel">
          <h2>Daily Challenge</h2>
          <div className="stack">
            <span className="badge">{dailyPuzzle.difficulty}</span>
            <span>Local date: {dateKey}</span>
          </div>
          <div className="status-row">
            <span>Streak: {stats.streak}</span>
            <span>{statusLabel}</span>
          </div>
          <div className="ad-slot">Ad slot placeholder</div>
        </div>

        <div className="game-center">
          <GameBoard />
          <PiecesTray />
        </div>
      </section>
    </main>
  );
}

export default function DailyGame() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 50);
    const timeout = window.setTimeout(
      () => setToday(new Date()),
      Math.max(0, nextMidnight.getTime() - now.getTime()),
    );
    return () => window.clearTimeout(timeout);
  }, [today]);

  return (
    <GameProvider>
      <DailyGameLayout date={today} />
    </GameProvider>
  );
}
