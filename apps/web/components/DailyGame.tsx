"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Placement, PieceId } from "@blocker-rush/shared";
import { getDateKey, getDailyPuzzle, PIECES } from "@blocker-rush/shared";
import GameBoard from "./GameBoard";
import PiecesTray from "./PiecesTray";
import { GameProvider, useGame } from "./GameContext";
import GameHeader from "./GameHeader";
import type { PieceState } from "./gameTypes";
import ThemeSelect from "./ThemeSelect";

const DAILY_STATS_KEY = "blockerRush.daily.stats";
const DAILY_PROGRESS_KEY = "blockerRush.daily.progress";

type DailyStats = {
  streak: number;
  lastCompletedDateKey?: string;
};

type DailyProgress = {
  dateKey: string;
  puzzleId: string;
  placements: Placement[];
  pieceStates: Record<PieceId, PieceState>;
  startedAt: number | null;
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

const readDailyProgress = (
  dateKey: string,
  puzzleId: string,
): DailyProgress | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DAILY_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyProgress;
    if (!parsed || parsed.dateKey !== dateKey || parsed.puzzleId !== puzzleId) {
      return null;
    }
    if (!Array.isArray(parsed.placements) || !parsed.pieceStates) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeDailyProgress = (progress: DailyProgress) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(progress));
};

const clearDailyProgress = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DAILY_PROGRESS_KEY);
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
  const {
    solved,
    puzzleId,
    applyPuzzle,
    board,
    pieceStates,
    startedAt,
    restoreState,
  } = useGame();
  const dateKey = getDateKey(date);
  const dailyPuzzle = useMemo(() => getDailyPuzzle(date), [dateKey]);
  const [stats, setStats] = useState<DailyStats>(() =>
    reconcileStats(readDailyStats(), dateKey),
  );
  const [hasRecorded, setHasRecorded] = useState(false);
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const hasRestoredRef = useRef<string | null>(null);

  useEffect(() => {
    if (dailyPuzzle.id === puzzleId) return;
    applyPuzzle({
      id: dailyPuzzle.id,
      blockers: dailyPuzzle.blockers,
      difficulty: dailyPuzzle.difficulty,
    });
  }, [dailyPuzzle, puzzleId, applyPuzzle]);

  useEffect(() => {
    const saved = readDailyProgress(dateKey, dailyPuzzle.id);
    setProgress(saved);
    hasRestoredRef.current = null;
    if (!saved) {
      clearDailyProgress();
    }
  }, [dateKey, dailyPuzzle.id]);

  useEffect(() => {
    if (!progress) return;
    if (puzzleId !== dailyPuzzle.id) return;
    if (hasRestoredRef.current === dateKey) return;
    restoreState({
      placements: progress.placements,
      pieceStates: progress.pieceStates,
      blockers: dailyPuzzle.blockers,
      startedAt: progress.startedAt,
    });
    hasRestoredRef.current = dateKey;
  }, [progress, puzzleId, dailyPuzzle, dateKey, restoreState]);

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

  useEffect(() => {
    if (puzzleId !== dailyPuzzle.id) return;
    const placements = PIECES.reduce<Placement[]>((acc, piece) => {
      const placement = board.placements[piece.id];
      if (placement) acc.push(placement);
      return acc;
    }, []);
    writeDailyProgress({
      dateKey,
      puzzleId,
      placements,
      pieceStates,
      startedAt,
    });
  }, [board, pieceStates, startedAt, puzzleId, dailyPuzzle.id, dateKey]);

  const statusLabel =
    stats.lastCompletedDateKey === dateKey ? "Completed" : "Not yet cleared";

  return (
    <main className="page game-page">
      <GameHeader
        mode="daily"
        statsTitle="Daily Challenge"
        statsPanel={
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Streak</span>
              <span className="stat-value">{stats.streak}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Status</span>
              <span className="stat-value">{statusLabel}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Difficulty</span>
              <span className="badge">{dailyPuzzle.difficulty}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Date</span>
              <span className="stat-value">{dateKey}</span>
            </div>
          </div>
        }
        settingsPanel={
          <div className="settings-stack">
            <ThemeSelect />
          </div>
        }
      />
      <section className="game-layout">
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
    <GameProvider lockOnSolve>
      <DailyGameLayout date={today} />
    </GameProvider>
  );
}
