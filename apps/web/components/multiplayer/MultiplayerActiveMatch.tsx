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
    sendUndo,
    submitFinish,
  } = useMultiplayerStore();

  const [renderNow, setRenderNow] = useState(() => Date.now());
  const shouldTickTimer = state.status === "countdown";

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
        {opponents.length === 0 ? (
          <span className="pieces-hint">Waiting for players…</span>
        ) : (
          opponents.map((player) => (
            <OpponentCard key={player.playerId} player={player} />
          ))
        )}
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
          onUndo={sendUndo}
          onSubmitFinish={submitFinish}
          authoritativeReject={authoritativeReject}
        />
      </div>
    </section>
  );
}
