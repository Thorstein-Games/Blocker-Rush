"use client";

import { useEffect, useMemo, useState } from "react";
import { useMultiplayerStore } from "./MultiplayerStore";
import { formatMs } from "./multiplayerViewUtils";

export default function MultiplayerRoomLobby() {
  const { state, setReady, startMatch, kickPlayer } = useMultiplayerStore();

  const players = useMemo(() => Object.values(state.players), [state.players]);
  const selfPlayer = state.selfPlayerId
    ? state.players[state.selfPlayerId]
    : undefined;
  const selfIsHost = state.hostId === state.selfPlayerId;
  const isPublicWaitRoom =
    state.status === "lobby" &&
    state.roomVisibility === "public" &&
    players.length <= 1;

  const [renderNow, setRenderNow] = useState(() => Date.now());
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [publicWaitStartedAt, setPublicWaitStartedAt] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (isPublicWaitRoom) {
      setPublicWaitStartedAt((prev) => prev ?? Date.now());
      return;
    }
    setPublicWaitStartedAt(null);
  }, [isPublicWaitRoom]);

  useEffect(() => {
    if (!isPublicWaitRoom) return;

    setRenderNow(Date.now());
    const timer = window.setInterval(() => setRenderNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isPublicWaitRoom]);

  const publicWaitRemainingMs = publicWaitStartedAt
    ? Math.max(0, 30_000 - (renderNow - publicWaitStartedAt))
    : 0;

  const handleShareRoom = async () => {
    if (!state.roomCode) return;
    const url = `${window.location.origin}/multiplayer?room=${state.roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: url, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setShareStatus("Room link copied.");
    } catch {
      setShareStatus("Unable to share right now.");
    }
  };

  return (
    <section className="multiplayer-room-stage panel stack">
      <h3>Room {state.roomCode}</h3>
      {isPublicWaitRoom && (
        <div className="notice">
          Matchmaking wait: {formatMs(publicWaitRemainingMs)} remaining.
          {publicWaitRemainingMs === 0 &&
            " No opponent found yet. Keep waiting or return to lobby."}
        </div>
      )}
      <div className="multiplayer-room-list">
        {players.map((player) => (
          <div className="room-row" key={player.playerId}>
            <div>
              <strong>{player.name} · </strong>
              <span className="pieces-hint">
                {player.connected ? "Connected" : "Disconnected"} ·{" "}
                {player.ready ? "Ready" : "Not ready"}
              </span>
            </div>
            {selfIsHost && player.playerId !== state.selfPlayerId && (
              <button
                className="button secondary"
                type="button"
                onClick={() => kickPlayer(player.playerId)}
              >
                Kick
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="settings-actions">
        <button
          className="button secondary"
          type="button"
          onClick={handleShareRoom}
        >
          Share Room Link
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => setReady(!(selfPlayer?.ready ?? false))}
        >
          {selfPlayer?.ready ? "Unready" : "Ready"}
        </button>
        {selfIsHost && (
          <button
            className="button"
            type="button"
            onClick={startMatch}
            disabled={players.length < 2}
          >
            Start Match
          </button>
        )}
      </div>
      {shareStatus && <div className="notice">{shareStatus}</div>}
    </section>
  );
}
