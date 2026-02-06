"use client";

import { useEffect, useMemo, useState } from "react";
import MultiplayerBoardPanel from "./MultiplayerBoardPanel";
import OpponentCard from "./OpponentCard";
import { useMultiplayerStore } from "./MultiplayerStore";
import { formatMs } from "./multiplayerViewUtils";

export default function MultiplayerActiveMatch() {
  const {
    state,
    sendPlace,
    sendRemove,
    submitFinish,
  } = useMultiplayerStore();

  const [renderNow, setRenderNow] = useState(() => Date.now());
  const shouldTickTimer =
    state.status === "countdown" || state.status === "in_game";

  useEffect(() => {
    if (!shouldTickTimer) return;

    setRenderNow(Date.now());
    const timer = window.setInterval(() => setRenderNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [shouldTickTimer]);

  const players = useMemo(() => Object.values(state.players), [state.players]);
  const selfPlayer = state.selfPlayerId
    ? state.players[state.selfPlayerId]
    : undefined;
  const opponents = players.filter(
    (player) => player.playerId !== state.selfPlayerId,
  );

  const adjustedNow = renderNow + state.clockOffsetMs;
  const countdownMs =
    state.status === "countdown" && state.match
      ? Math.max(0, state.match.startTime - adjustedNow)
      : 0;
  const roundElapsedMs =
    state.status === "in_game" && selfPlayer?.round?.startedAt
      ? Math.max(0, adjustedNow - selfPlayer.round.startedAt)
      : 0;

  const authoritativeReject =
    state.lastRejected?.authoritativeState && selfPlayer
      ? {
          roundIndex: state.lastRejected.authoritativeState.roundIndex,
          placedPieces: state.lastRejected.authoritativeState.placedPieces,
        }
      : undefined;

  return (
    <section className="multiplayer-game-layout">
      <aside className="opponents-column">
        <h3>Opponents</h3>
        <div className="opponents-grid">
          {opponents.length === 0 ? (
            <span className="pieces-hint">Waiting for players…</span>
          ) : (
            opponents.map((player) => (
              <OpponentCard
                key={player.playerId}
                player={player}
                showSplits={state.settings.rounds > 1}
              />
            ))
          )}
        </div>
      </aside>

      <div className="game-center multiplayer-main-board">
        {state.status === "countdown" && (
          <div className="notice">Round starts in {formatMs(countdownMs)}</div>
        )}

        {state.error && <div className="notice">{state.error}</div>}

        <MultiplayerBoardPanel
          selfPlayer={selfPlayer}
          active={state.status === "in_game"}
          onPlace={sendPlace}
          onRemove={sendRemove}
          onSubmitFinish={submitFinish}
          authoritativeReject={authoritativeReject}
        />
      </div>
      <aside className="panel multiplayer-side-card">
        <h3>Match</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Round</span>
            <span className="stat-value">
              {selfPlayer ? selfPlayer.currentRoundIndex + 1 : 1} ·{" "}
              {state.status === "in_game" ? "Live" : "Locked"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Room</span>
            <span className="stat-value">{state.roomCode ?? "--"}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Status</span>
            <span className="stat-value">{state.status ?? "--"}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Timer</span>
            <span className="stat-value">
              {state.status === "countdown"
                ? formatMs(countdownMs)
                : formatMs(roundElapsedMs)}
            </span>
          </div>
        </div>
      </aside>
    </section>
  );
}
