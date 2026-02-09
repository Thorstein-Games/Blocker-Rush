"use client";

import { useEffect, useMemo, useState } from "react";
import GameHeader from "../GameHeader";
import ThemeSelect from "../ThemeSelect";
import MultiplayerActiveMatch from "./MultiplayerActiveMatch";
import MultiplayerRoomLobby from "./MultiplayerRoomLobby";
import { useMultiplayerStore } from "./MultiplayerStore";
import {
  getMultiplayerRatio,
  readMultiplayerStats,
  recordMultiplayerResult,
  writeMultiplayerStats,
} from "./multiplayerStatsStorage";

export default function MultiplayerRoomShell() {
  const { state, requestSync, leaveRoom } = useMultiplayerStore();
  const [stats, setStats] = useState(() => readMultiplayerStats());

  const isInActiveGame =
    state.status === "countdown" ||
    state.status === "in_game" ||
    state.status === "finished";

  useEffect(() => {
    if (!state.result || !state.selfPlayerId || !state.match?.matchId) return;
    const didWin = state.result.winnerId === state.selfPlayerId;
    setStats((prev) => {
      const next = recordMultiplayerResult(prev, {
        matchId: state.match?.matchId ?? "",
        didWin,
      });
      if (next === prev) return prev;
      writeMultiplayerStats(next);
      return next;
    });
  }, [state.match?.matchId, state.result, state.selfPlayerId]);

  const statsPanel = useMemo(
    () => (
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Wins</span>
          <span className="stat-value">{stats.wins}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Losses</span>
          <span className="stat-value">{stats.losses}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">W/L Ratio</span>
          <span className="stat-value">{getMultiplayerRatio(stats)}</span>
        </div>
      </div>
    ),
    [stats],
  );

  return (
    <main className="page game-page multiplayer-page">
      <GameHeader
        mode="multiplayer"
        statsTitle="Multiplayer Stats"
        statsPanel={statsPanel}
        settingsTitle="Multiplayer Settings"
        settingsPanel={
          <div className="settings-stack">
            <ThemeSelect />
            <button
              className="button secondary"
              type="button"
              onClick={requestSync}
            >
              Request Sync
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={leaveRoom}
            >
              Return to Lobby
            </button>
          </div>
        }
      />

      {state.status === "lobby" && <MultiplayerRoomLobby />}
      {isInActiveGame && <MultiplayerActiveMatch />}
    </main>
  );
}
